import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { test } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import User from "../models/userModel.js";
import AuthRateLimit from "../models/authRateLimitModel.js";
import authRouter from "../routes/authRoutes.js";
import { issueAuthToken } from "../services/authTokens.js";
import { normalizeAuthEmail } from "../services/authEmail.js";
import { authIpKey, createAuthRateLimit } from "../middleware/authRateLimit.js";
import { register, login } from "../controllers/authController.js";
import { processNextEmailJob } from "../services/emailQueue.js";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const userId = "6ab26b08171afea3091f04b3";
const ip = (index) => `198.18.${index >> 8}.${index & 255}`;
const signup = (email) => ({ name: "Test", email, password: "test-only-signup-password", role: "parent" });
const response = () => ({
  statusCode: 200, headers: {},
  status(code) { this.statusCode = code; return this; },
  set(key, value) { this.headers[key.toLowerCase()] = value; return this; },
  json(body) { this.body = body; return this; }, cookie() {},
});

function setup(t) {
  const oldSecret = process.env.JWT_SECRET;
  const oldSanitizer = mongoose.get("sanitizeFilter");
  process.env.JWT_SECRET = "test-only-auth-abuse-secret";
  mongoose.set("sanitizeFilter", true);
  t.after(() => {
    if (oldSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = oldSecret;
    mongoose.set("sanitizeFilter", oldSanitizer);
  });
  const state = { time: Date.UTC(2026, 9, 14, 0, 0, 1), records: new Map(), saved: [] };
  t.mock.method(Date, "now", () => state.time);
  state.id = (scope, subject, windowMs) => createHash("sha256")
    .update(`${scope}\0${subject}\0${Math.floor(state.time / windowMs)}`).digest("hex");
  // Exercise real Mongoose casting and atomic updates; replace collection I/O.
  state.counter = t.mock.method(AuthRateLimit.collection, "findOneAndUpdate", async (filter, update) => {
    const record = state.records.get(filter._id) || { _id: filter._id, count: 0, expiresAt: update.$setOnInsert?.expiresAt };
    record.count += update.$inc.count;
    state.records.set(filter._id, record);
    return structuredClone(record);
  });
  state.lookup = t.mock.method(User.collection, "findOne", async () => null);
  state.write = t.mock.method(User.collection, "findOneAndUpdate", async () => assert.fail("Unexpected account mutation"));
  t.mock.method(User.prototype, "save", async function () { state.saved.push(this); return this; });
  state.hash = t.mock.method(bcrypt, "hash", async () => "synthetic-hash");
  state.compare = t.mock.method(bcrypt, "compare", async () => false);
  state.app = express();
  state.app.use(cookieParser());
  state.app.use("/api/auth", authRouter);
  state.token = issueAuthToken({ _id: userId, tokenVersion: 0 });
  state.request = (route, body, address = ip(1), token, headers = {}) => new Promise((resolve, reject) => {
    const req = Readable.from([]);
    req.method = "POST";
    req.url = `/api/auth/${route}`;
    req.headers = { ...headers, ...(token ? { cookie: `token=${token}` } : {}) };
    req.body = body;
    req.socket = { remoteAddress: address };
    req.connection = req.socket;
    const res = Object.create(express.response);
    const responseHeaders = new Map();
    res.statusCode = 200;
    res.setHeader = (name, value) => responseHeaders.set(name.toLowerCase(), value);
    res.getHeader = (name) => responseHeaders.get(name.toLowerCase());
    res.json = (value) => resolve({ status: res.statusCode, body: value, headers: responseHeaders });
    state.app.handle(req, res, (error) => reject(error || new Error("Unexpected route fallthrough")));
  });
  return state;
}

const assertLimited = (result, code = "AUTH_RATE_LIMITED") => {
  assert.equal(result.status, 429);
  assert.equal(result.body.code, code);
  assert.equal(Number(result.headers.get("retry-after")), result.body.retryAfter);
  assert.ok(result.body.retryAfter > 0);
};

for (const exists of [true, false]) {
  test(`login caps concurrent guesses across IPs and email variants (account exists: ${exists})`, async (t) => {
    const state = setup(t);
    state.lookup.mock.mockImplementation(async () => exists ? { _id: userId, password: "synthetic-hash" } : null);
    const results = await Promise.all(Array.from({ length: 25 }, (_, index) => state.request("login", {
      email: index % 2 ? " TEST@Example.com " : "test@example.com", password: "wrong-password",
    }, ip(index + 1))));
    assert.equal(results.filter((result) => result.status === 401).length, 10);
    results.filter((result) => result.status !== 401).forEach((result) => assertLimited(result));
    assert.equal(state.lookup.mock.callCount(), exists ? 10 : 15, "Unknown legacy variants may require an exact fallback lookup");
    assert.equal(state.compare.mock.callCount(), exists ? 10 : 0);
    state.time += 15 * 60_000;
    assert.equal((await state.request("login", { email: "test@example.com", password: "wrong" })).status, 401);
  });
}

test("password spraying shares an IP cap despite rotating accounts and forwarded headers", async (t) => {
  const state = setup(t);
  for (let index = 0; index < 31; index++) {
    const result = await state.request("login", { email: `user${index}@example.com`, password: "wrong" }, ip(1), undefined,
      { "x-forwarded-for": ip(index + 20), "x-real-ip": ip(index + 100), forwarded: `for=${ip(index + 200)}` });
    if (index < 30) assert.equal(result.status, 401);
    else assertLimited(result);
  }
  assert.equal(state.lookup.mock.callCount(), 30);
});

test("normal login succeeds, but success cannot reset a consumed account budget", async (t) => {
  const state = setup(t);
  state.lookup.mock.mockImplementation(async () => ({ _id: userId, password: "synthetic-hash", tokenVersion: 0 }));
  state.compare.mock.mockImplementation(async (password) => password === "correct");
  for (let index = 0; index < 9; index++) {
    assert.equal((await state.request("login", { email: "test@example.com", password: "wrong" })).status, 401);
  }
  assert.equal((await state.request("login", { email: "test@example.com", password: "correct" })).body.success, true);
  assertLimited(await state.request("login", { email: "test@example.com", password: "correct" }, ip(2)));
  assert.equal(state.compare.mock.callCount(), 10);
});

test("registration permits five hourly requests per IP and blocks hashing, writes, and mail on the sixth", async (t) => {
  const state = setup(t);
  for (let index = 0; index < 6; index++) {
    const result = await state.request("register", signup(`user${index}@example.com`));
    if (index < 5) assert.equal(result.body.success, true);
    else assertLimited(result);
  }
  assert.equal(state.saved.length, 5);
  assert.equal(state.hash.mock.callCount(), 5);
  assert.equal(state.records.get(state.id("email-global-hour", "all", HOUR)).count, 10, "Two emails reserved per registration");
});

test("registration has a daily IP budget independent of hourly rollover", async (t) => {
  const state = setup(t);
  for (let hour = 0; hour < 4; hour++) {
    for (let index = 0; index < 5; index++) {
      assert.equal((await state.request("register", signup(`user${hour}-${index}@example.com`))).body.success, true);
    }
    state.time += HOUR;
  }
  assertLimited(await state.request("register", signup("over-day-budget@example.com")));
  assert.equal(state.saved.length, 20);
});

test("registration and recovery share recipient quotas across IPs; verification uses the stored mailbox", async (t) => {
  const state = setup(t);
  const registered = await state.request("register", signup(" TEST@Example.com "), ip(1));
  assert.equal(registered.body.success, true);
  assert.equal(state.saved[0].email, "test@example.com");
  state.lookup.mock.mockImplementation(async (filter) => ({
    _id: filter._id || userId, email: "test@example.com", tokenVersion: 0,
  }));
  state.write.mock.mockImplementation(async () => ({ _id: userId, email: "test@example.com" }));
  for (let index = 0; index < 3; index++) {
    state.time += 61_000;
    const result = await state.request("send-reset-otp", { email: "test@example.com" }, ip(index + 2));
    assert.equal(result.body.success, true);
  }
  const writes = state.write.mock.callCount();
  assertLimited(await state.request("send-verify-otp", { email: "attacker-chosen@example.com" }, ip(10), state.token), "EMAIL_RATE_LIMITED");
  assertLimited(await state.request("send-reset-otp", { email: " TEST@Example.com " }, ip(11)), "EMAIL_RATE_LIMITED");
  assert.equal(state.write.mock.callCount(), writes);
  assert.equal(state.records.get(state.id("email-recipient-hour", "test@example.com", HOUR)).count, 7);
});

test("mail IP and global budgets stop bursts spread across recipients and networks", async (t) => {
  const state = setup(t);
  for (let index = 0; index < 21; index++) {
    const result = await state.request("send-reset-otp", { email: `user${index}@example.com` });
    if (index < 20) assert.notEqual(result.status, 429);
    else assertLimited(result, "EMAIL_RATE_LIMITED");
  }
  // A separate worker's previous reservations must apply to this worker too.
  state.records.set(state.id("email-global-hour", "all", HOUR), { count: 200 });
  const reads = state.lookup.mock.callCount();
  assertLimited(await state.request("send-reset-otp", { email: "fresh@example.com" }, ip(99)), "EMAIL_RATE_LIMITED");
  assert.equal(state.lookup.mock.callCount(), reads, "Global exhaustion stops account lookup and queue work");
});

test("a concurrent mailbox change cannot queue verification against another recipient's quota", async (t) => {
  const state = setup(t);
  state.lookup.mock.mockImplementation(async (filter, options) => ({
    _id: userId, tokenVersion: 0,
    email: options?.projection?.email === 1 ? "old@example.com" : "new@example.com",
  }));
  const result = await state.request("send-verify-otp", {}, ip(1), state.token);
  assert.equal(result.status, 409);
  assert.equal(state.write.mock.callCount(), 0);
});

test("an exhausted IP cannot drain the service-wide request allowance", async (t) => {
  const state = setup(t);
  state.records.set(state.id("auth-ip", ip(1), 15 * 60_000), { count: 100 });
  assertLimited(await state.request("login", { email: "test@example.com", password: "wrong" }));
  assert.equal(state.records.has(state.id("auth-global", "all", 60_000)), false);
});

test("daily recipient and global email quotas survive hourly rollover", async (t) => {
  const state = setup(t);
  for (let hour = 0; hour < 2; hour++) {
    for (let index = 0; index < 5; index++) {
      assert.notEqual((await state.request("send-reset-otp", { email: "test@example.com" }, ip(hour * 5 + index))).status, 429);
    }
    state.time += HOUR;
  }
  assertLimited(await state.request("send-reset-otp", { email: "test@example.com" }, ip(20)), "EMAIL_RATE_LIMITED");
  state.records.set(state.id("email-global-day", "all", DAY), { count: 1000 });
  assertLimited(await state.request("send-reset-otp", { email: "different@example.com" }, ip(21)), "EMAIL_RATE_LIMITED");
});

test("authentication IP budgets span every sensitive endpoint and global budgets span IPs", async (t) => {
  const state = setup(t);
  state.records.set(state.id("auth-ip", ip(1), 15 * 60_000), { count: 100 });
  for (const route of ["login", "register", "send-reset-otp", "reset-password", "send-verify-otp", "verify-account"]) {
    assertLimited(await state.request(route, signup("test@example.com")));
  }
  assert.equal(state.lookup.mock.callCount(), 0);
  state.records.set(state.id("auth-global", "all", 60_000), { count: 1000 });
  assertLimited(await state.request("login", { email: "fresh@example.com", password: "wrong" }, ip(2)));
});

test("registration global quotas apply across networks before hashing or account creation", async (t) => {
  const state = setup(t);
  for (const [scope, limit, windowMs] of [["registration-global-hour", 100, HOUR], ["registration-global-day", 500, DAY]]) {
    state.records.clear();
    state.records.set(state.id(scope, "all", windowMs), { count: limit });
    assertLimited(await state.request("register", signup("test@example.com")));
  }
  assert.equal(state.saved.length, 0);
  assert.equal(state.hash.mock.callCount(), 0);
});

test("counter outages fail closed on login, registration, and email routes", async (t) => {
  const state = setup(t);
  state.counter.mock.mockImplementation(async () => { throw new Error("private database details"); });
  for (const route of ["login", "register", "send-reset-otp", "send-verify-otp"]) {
    const result = await state.request(route, signup("test@example.com"));
    assert.equal(result.status, 503);
    assert.equal(result.headers.get("retry-after"), "60");
    assert.equal(JSON.stringify(result.body).includes("private"), false);
  }
  assert.equal(state.lookup.mock.callCount(), 0);
  assert.equal(state.hash.mock.callCount(), 0);
});

test("IPv6 interface rotation shares a /64 and IPv4-mapped peers share IPv4 budgets", () => {
  const key = (address) => authIpKey({ ip: address });
  assert.equal(key("2001:db8:abcd:1234::1"), key("2001:0db8:abcd:1234:ffff:0:0:2"));
  assert.notEqual(key("2001:db8:abcd:1234::1"), key("2001:db8:abcd:1235::1"));
  assert.equal(key("::ffff:192.0.2.1"), key("192.0.2.1"));
  assert.equal(key("0:0:0:0:0:ffff:c000:0201"), key("192.0.2.1"));
  assert.equal(key("::1"), "0:0:0:0::/64");
});

test("mailbox validation rejects lists, display names, injected headers, and oversized input", async (t) => {
  setup(t);
  for (const email of [undefined, {}, ["a@example.com"], "a@example.com,b@example.com", "a@example.com;b@example.com",
    "Name <a@example.com>", "a@example.com\r\nBcc:b@example.com", "x".repeat(65) + "@example.com", "a..b@example.com"]) {
    assert.equal(normalizeAuthEmail(email), null);
    const res = response();
    await register({ body: signup(email) }, res);
    assert.equal(res.statusCode, 400);
  }
  assert.equal(normalizeAuthEmail(" Test+tag@Example.com "), "test+tag@example.com");
  for (const controller of [register, login]) {
    const res = response();
    await controller({}, res);
    assert.equal(res.statusCode, 400);
  }
});

test("legacy queued recipient lists are discarded without calling SMTP", async () => {
  const recipient = "a@example.com,b@example.com";
  let discarded = false;
  const users = {
    findOneAndUpdate() { return { select: async () => ({
      _id: userId, email: recipient,
      emailJobs: { welcome: { to: recipient, expiresAt: new Date(Date.now() + DAY), attempts: 1 } },
    }) }; },
    async updateOne() { discarded = true; },
  };
  await processNextEmailJob("welcome", { users, mailer: { sendMail() { assert.fail("Unsafe recipient reached SMTP"); } } });
  assert.equal(discarded, true);
});

test("weighted email reservations remain atomic across workers", async (t) => {
  const state = setup(t);
  const options = { scope: "weighted-test", limit: 5, cost: () => 2, key: () => "recipient" };
  const workers = [createAuthRateLimit(options), createAuthRateLimit(options)];
  let admitted = 0;
  const results = await Promise.all(Array.from({ length: 20 }, async (_, index) => {
    const res = response();
    await workers[index % 2]({}, res, () => { admitted++; });
    return res;
  }));
  assert.equal(admitted, 2);
  assert.equal(results.filter((res) => res.statusCode === 429).length, 18);
  assert.equal([...state.records.values()][0].count, 40);
});
