import assert from "node:assert/strict";
import { test } from "node:test";
import { Readable } from "node:stream";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import AuthRateLimit from "../models/authRateLimitModel.js";
import User from "../models/userModel.js";
import authRouter from "../routes/authRoutes.js";
import { createOtpRateLimit, OTP_RATE_WINDOW_MS } from "../middleware/otpRateLimit.js";

const response = () => ({
  statusCode: 200, headers: {},
  status(code) { this.statusCode = code; return this; },
  set(key, value) { this.headers[key] = value; return this; },
  json(body) { this.body = body; return this; },
});

// Keep real Mongoose query casting; stub only the atomic collection operation.
const counterStore = (t) => {
  const records = new Map();
  const calls = [];
  let duplicateFirstInsert = false;
  const method = t.mock.method(AuthRateLimit.collection, "findOneAndUpdate", async (filter, update, options) => {
    calls.push({ filter, update, options });
    assert.match(filter._id, /^[a-f0-9]{64}$/);
    assert.equal(update.$inc.count, 1);
    let record = records.get(filter._id);
    if (!record) {
      assert.equal(options.upsert, true);
      record = { _id: filter._id, count: 0, expiresAt: update.$setOnInsert.expiresAt };
      records.set(filter._id, record);
      if (duplicateFirstInsert) {
        duplicateFirstInsert = false;
        record.count = 1; // Another worker inserted the winning document.
        throw Object.assign(new Error("Synthetic duplicate insert"), { code: 11000 });
      }
    }
    record.count++;
    return structuredClone(record);
  });
  return { records, calls, method, collide() { duplicateFirstInsert = true; } };
};

test("separate workers share an atomic account budget and reset at the next window", async (t) => {
  const store = counterStore(t);
  let timestamp = 10 * OTP_RATE_WINDOW_MS + 1234;
  const options = { scope: "test-account", limit: 5, key: (req) => req.email, now: () => timestamp };
  const workers = [createOtpRateLimit(options), createOtpRateLimit(options)];
  const outcomes = await Promise.all(Array.from({ length: 40 }, async (_, index) => {
    const res = response();
    let admitted = false;
    await workers[index % 2]({ email: "test@example.invalid" }, res, () => { admitted = true; });
    return { res, admitted };
  }));
  assert.equal(outcomes.filter((outcome) => outcome.admitted).length, 5);
  for (const { res, admitted } of outcomes) {
    if (!admitted) {
      assert.equal(res.statusCode, 429);
      assert.equal(res.body.code, "OTP_RATE_LIMITED");
      assert.equal(Number(res.headers["Retry-After"]), res.body.retryAfter);
      assert.ok(res.body.retryAfter > 0 && res.body.retryAfter <= 900);
    }
  }
  assert.equal(store.records.size, 1);
  assert.equal([...store.records.values()][0].count, 40);
  assert.equal(JSON.stringify(store.calls).includes("test@example.invalid"), false);
  timestamp = 11 * OTP_RATE_WINDOW_MS;
  let admitted = false;
  await workers[0]({ email: "test@example.invalid" }, response(), () => { admitted = true; });
  assert.equal(admitted, true);
  assert.equal(store.records.size, 2);
  assert.ok(AuthRateLimit.schema.indexes().some(([keys, options]) => keys.expiresAt === 1 && options.expireAfterSeconds === 0));
});

test("independent subjects and scopes have separate quotas; invalid subjects never query", async (t) => {
  const store = counterStore(t);
  const options = { limit: 1, key: (req) => req.subject, now: () => OTP_RATE_WINDOW_MS };
  const one = createOtpRateLimit({ ...options, scope: "one" });
  const two = createOtpRateLimit({ ...options, scope: "two" });
  for (const [middleware, subject] of [[one, "a"], [one, "b"], [two, "a"]]) {
    let admitted = false;
    await middleware({ subject }, response(), () => { admitted = true; });
    assert.equal(admitted, true);
  }
  const res = response();
  await one({ subject: "a" }, res, () => assert.fail("Exhausted subject admitted"));
  assert.equal(res.statusCode, 429);
  const before = store.calls.length;
  for (const subject of [undefined, {}, "", "x".repeat(255)]) {
    const invalid = response();
    await one({ subject }, invalid, () => assert.fail("Invalid subject admitted"));
    assert.equal(invalid.statusCode, 400);
  }
  assert.equal(store.calls.length, before);
});

test("concurrent first-insert collisions retry against the shared winning counter", async (t) => {
  const store = counterStore(t);
  store.collide();
  const middleware = createOtpRateLimit({ scope: "collision", limit: 1, key: () => "subject" });
  const res = response();
  await middleware({}, res, () => assert.fail("Winning worker already used the allowance"));
  assert.equal(res.statusCode, 429);
  assert.equal(store.calls.length, 2);
  assert.equal(store.calls[1].options.upsert, undefined);
});

test("database outages and missing counters fail closed without internal details", async (t) => {
  const method = t.mock.method(AuthRateLimit, "findOneAndUpdate", async () => { throw new Error("Sensitive internal database failure"); });
  const middleware = createOtpRateLimit({ scope: "failure", limit: 5, key: () => "subject" });
  for (const invalid of ["throw", null, { count: 0 }, { count: Infinity }]) {
    if (invalid !== "throw") method.mock.mockImplementation(async () => invalid);
    const res = response();
    await middleware({}, res, () => assert.fail("Failed counter admitted"));
    assert.equal(res.statusCode, 503);
    assert.equal(res.headers["Retry-After"], "60");
    assert.equal(JSON.stringify(res.body).includes("Sensitive"), false);
  }
});

const request = (app, path, token, forwardedIp) => new Promise((resolve, reject) => {
  const req = Readable.from([]);
  req.method = "POST";
  req.url = path;
  req.headers = { cookie: `token=${token}`, "x-forwarded-for": forwardedIp };
  req.body = { email: "TEST@example.invalid", otp: "123456", newPassword: "test-password" };
  req.socket = { remoteAddress: "192.0.2.1" };
  req.connection = req.socket;
  const res = Object.create(express.response);
  const headers = new Map();
  res.statusCode = 200;
  res.setHeader = (name, value) => headers.set(name.toLowerCase(), value);
  res.getHeader = (name) => headers.get(name.toLowerCase());
  res.json = (body) => resolve({ status: res.statusCode, body });
  app.handle(req, res, (error) => reject(error || new Error("Unexpected route fallthrough")));
});

test("all four OTP endpoints share the IP cap and cannot evade it with forwarded headers", async (t) => {
  const previousSecret = process.env.JWT_SECRET;
  const previousSanitizer = mongoose.get("sanitizeFilter");
  process.env.JWT_SECRET = "test-only-otp-route-limit-secret";
  mongoose.set("sanitizeFilter", true);
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
    mongoose.set("sanitizeFilter", previousSanitizer);
  });
  const ids = [];
  t.mock.method(AuthRateLimit.collection, "findOneAndUpdate", async (filter) => {
    ids.push(filter._id);
    return { _id: filter._id, count: 101, expiresAt: new Date() };
  });
  t.mock.method(User.collection, "findOne", () => assert.fail("Throttled route reached account I/O"));
  t.mock.method(User.collection, "findOneAndUpdate", () => assert.fail("Throttled route reached account mutation"));
  const app = express();
  app.use(cookieParser());
  app.use("/api/auth", authRouter);
  const token = jwt.sign({ id: "6ab26b08171afea3091f04b3" }, process.env.JWT_SECRET);
  for (const [index, route] of ["send-verify-otp", "verify-account", "send-reset-otp", "reset-password"].entries()) {
    const result = await request(app, `/api/auth/${route}`, token, `198.51.100.${index + 1}`);
    assert.equal(result.status, 429);
    assert.equal(result.body.code, "OTP_RATE_LIMITED");
  }
  assert.equal(new Set(ids).size, 1);
});
