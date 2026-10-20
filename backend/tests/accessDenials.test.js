import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { test } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/userModel.js";
import authRouter from "../routes/authRoutes.js";
import userAuth from "../middleware/userAuth.js";
import { requireStaff } from "../middleware/staffAuth.js";
import { denyAccess, recordAccessDenial } from "../services/accessDenials.js";
import { issueAuthToken } from "../services/authTokens.js";
import { login, register, sendResetOtp, resetPassword } from "../controllers/authController.js";
import { createEmailJob, processNextEmailJob } from "../services/emailQueue.js";
import { pageAccessRoles, canAccessPage } from "../../shared/pageAccess.mjs";

const userId = "6ab26b08171afea3091f04b3";
const otherId = "6ac82222376fb9c75f5b3961";
const password = "test-only-ban-password";
const clone = (value) => structuredClone(value?.toObject ? value.toObject() : value);
const readPath = (object, path) => path.split(".").reduce((value, key) => value?.[key], object);
const writePath = (object, path, value, remove = false) => {
  const parts = path.split(".");
  const key = parts.pop();
  const target = parts.reduce((value, part) => value[part] ||= {}, object);
  if (remove) delete target[key];
  else target[key] = clone(value);
};
const matches = (object, filter) => Object.entries(filter).every(([key, expected]) => {
  if (key === "$or") return expected.some((part) => matches(object, part));
  const actual = readPath(object, key);
  if (expected && typeof expected === "object" && !(expected instanceof mongoose.Types.ObjectId)) {
    if ("$ne" in expected) return actual !== expected.$ne;
    if ("$in" in expected) return expected.$in.some((value) => value == null ? actual == null : value === actual);
    if ("$lte" in expected) return actual != null && actual <= expected.$lte;
  }
  return String(actual) === String(expected);
});
const response = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
  cookie() { this.cookieIssued = true; },
  clearCookie() { this.cookieCleared = true; },
});

async function setup(t) {
  const oldSecret = process.env.JWT_SECRET;
  const oldSanitizer = mongoose.get("sanitizeFilter");
  process.env.JWT_SECRET = "test-only-access-denial-secret";
  mongoose.set("sanitizeFilter", true);
  t.after(() => {
    if (oldSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = oldSecret;
    mongoose.set("sanitizeFilter", oldSanitizer);
  });
  const state = {
    user: {
      _id: userId, email: "viewer@example.com", name: "Viewer", role: ["parent"],
      password: await bcrypt.hash(password, 4), isAccountVerified: true, tokenVersion: 0,
      emailJobs: {}, verifyOtp: "123456", resetOtp: "654321",
    },
    writes: [], outage: false, mail: [], time: Date.now() + 1000,
  };
  // Exercise real Mongoose casting, validation and filter sanitization; fake
  // only collection I/O, with atomic matching against the current record.
  t.mock.method(User.collection, "findOne", async (filter) =>
    state.user && matches(state.user, filter) ? clone(state.user) : null);
  t.mock.method(User.collection, "findOneAndUpdate", async (filter, update) => {
    if (state.outage) throw new Error("Private database details");
    if (!state.user || !matches(state.user, filter)) return null;
    for (const [key, value] of Object.entries(update.$set || {})) writePath(state.user, key, value);
    for (const [key, value] of Object.entries(update.$inc || {})) writePath(state.user, key, (readPath(state.user, key) || 0) + value);
    for (const key of Object.keys(update.$unset || {})) writePath(state.user, key, null, true);
    state.writes.push(clone(update));
    return clone(state.user);
  });
  t.mock.method(User.collection, "updateOne", async (filter, update) => {
    if (!state.user || !matches(state.user, filter)) return { matchedCount: 0 };
    for (const [key, value] of Object.entries(update.$set || {})) writePath(state.user, key, value);
    for (const key of Object.keys(update.$unset || {})) writePath(state.user, key, null, true);
    return { matchedCount: 1 };
  });
  const app = express();
  app.use(cookieParser());
  app.use("/api/auth", authRouter);
  app.get("/staff", userAuth, requireStaff, (req, res) => res.json({ success: true }));
  app.get("/member", userAuth, (req, res) => res.json({ success: true }));
  state.token = issueAuthToken(state.user);
  state.request = (path, body, token = state.token) => new Promise((resolve, reject) => {
    const req = Readable.from([]);
    req.method = body === undefined ? "GET" : "POST";
    req.url = path;
    req.body = body;
    req.headers = token ? { cookie: `token=${token}` } : {};
    req.socket = {};
    const res = Object.create(express.response);
    const headers = new Map();
    res.statusCode = 200;
    res.setHeader = (key, value) => headers.set(key.toLowerCase(), value);
    res.getHeader = (key) => headers.get(key.toLowerCase());
    res.json = (value) => resolve({ status: res.statusCode, body: value, headers });
    app.handle(req, res, (error) => reject(error || new Error(`Unmatched route ${path}`)));
  });
  state.deliver = (mailer = { sendMail: async (mail) => state.mail.push(mail) }) => processNextEmailJob("ban", {
    mailer, now: () => new Date(state.time), logger: { warn() {} },
  });
  return state;
}

test("three denied page visits ban only the authenticated user, flag their email, and block sessions and login", async (t) => {
  const state = await setup(t);
  for (const kind of ["welcome", "verification", "passwordReset"]) {
    state.user.emailJobs[kind] = createEmailJob({
      to: state.user.email, subject: "Pending authentication email", text: "Test only",
      expiresAt: Date.now() + 60_000,
    });
  }
  for (const [index, pathname] of ["/admin", "/attendance", "/create-lesson"].entries()) {
    const result = await state.request("/api/auth/page-access", { pathname, userId: otherId, role: ["admin"] });
    assert.equal(result.status, 403);
    assert.equal(state.user.accessDeniedCount, index + 1);
    if (index < 2) {
      assert.equal(result.body.remainingAttempts, 2 - index);
      assert.equal(state.user.isBanned, undefined);
      assert.equal((await state.request("/member")).status, 200);
    } else {
      assert.equal(result.body.code, "ACCOUNT_BANNED");
      assert.match(String(result.headers.get("set-cookie")), /token=;/);
    }
  }
  assert.equal(state.user.isBanned, true);
  assert.equal(state.user.emailFlagged, true);
  assert.equal(state.user.flaggedEmail, "viewer@example.com");
  assert.ok(state.user.bannedAt instanceof Date);
  assert.equal(state.user.tokenVersion, 1);
  assert.equal(state.user.verifyOtp, "");
  assert.equal(state.user.resetOtp, "");
  assert.deepEqual(Object.keys(state.user.emailJobs), ["ban"]);
  assert.equal(state.user.emailJobs.ban.to, state.user.flaggedEmail);
  assert.match(state.user.emailJobs.ban.text, /three denied attempts/);
  assert.equal((await state.request("/member")).body.code, "ACCOUNT_BANNED");
  const res = response();
  await login({ body: { email: " VIEWER@EXAMPLE.COM ", password } }, res);
  assert.equal(res.body.code, "ACCOUNT_BANNED");
  assert.equal(res.cookieIssued, undefined);
  const wrong = response();
  await login({ body: { email: state.user.email, password: "wrong" } }, wrong);
  assert.equal(wrong.statusCode, 401);
});

test("concurrent denials cap at three and persist one notification and one session revocation", async (t) => {
  const state = await setup(t);
  state.user.email = " Viewer@Example.COM ";
  const results = await Promise.all(Array.from({ length: 24 }, () => recordAccessDenial(userId)));
  assert.ok(results.every(Boolean));
  assert.equal(state.user.accessDeniedCount, 3);
  assert.equal(state.user.flaggedEmail, "viewer@example.com");
  assert.equal(state.user.tokenVersion, 1);
  assert.equal(state.writes.length, 3);
  assert.equal(state.writes.filter((update) => update.$set["emailJobs.ban"]).length, 1);
  const id = state.user.emailJobs.ban.id;
  await recordAccessDenial(userId);
  assert.equal(state.user.emailJobs.ban.id, id);
  assert.equal(state.writes.length, 3);
});

test("API permission denials share the page counter; allowed, anonymous, unverified and unknown pages do not count", async (t) => {
  const state = await setup(t);
  assert.equal((await state.request("/member")).status, 200);
  assert.equal((await state.request("/api/auth/page-access", { pathname: "/admin" }, null)).status, 401);
  for (const pathname of ["/profile", null, { $ne: null }]) {
    assert.equal((await state.request("/api/auth/page-access", { pathname })).status, 400);
  }
  state.user.isAccountVerified = false;
  assert.equal((await state.request("/api/auth/page-access", { pathname: "/admin" })).body.code, "EMAIL_VERIFICATION_REQUIRED");
  assert.equal(state.writes.length, 0);
  state.user.isAccountVerified = true;
  state.user.role = ["admin"];
  assert.equal((await state.request("/api/auth/page-access", { pathname: "/admin" })).status, 200);
  state.user.role = ["parent"];
  assert.equal((await state.request("/staff")).body.remainingAttempts, 2);
  assert.equal((await state.request("/api/auth/page-access", { pathname: "/admin" })).body.remainingAttempts, 1);
  assert.equal((await state.request("/staff")).body.code, "ACCOUNT_BANNED");
});

test("a failed atomic write denies access without a partial ban or queued notification", async (t) => {
  const state = await setup(t);
  state.user.accessDeniedCount = 2;
  state.outage = true;
  const result = await state.request("/api/auth/page-access", { pathname: "/admin" });
  assert.equal(result.status, 503);
  assert.equal(JSON.stringify(result).includes("Private database"), false);
  assert.equal(state.user.accessDeniedCount, 2);
  assert.equal(state.user.isBanned, undefined);
  assert.deepEqual(state.user.emailJobs, {});
  state.outage = false;
  assert.equal((await state.request("/api/auth/page-access", { pathname: "/admin" })).body.code, "ACCOUNT_BANNED");
});

test("banned accounts cannot queue password recovery, reset credentials or re-register", async (t) => {
  const state = await setup(t);
  await Promise.all([1, 2, 3].map(() => recordAccessDenial(userId)));
  const writes = state.writes.length;
  const before = clone(state.user);
  for (const controller of [sendResetOtp, resetPassword]) {
    const res = response();
    await controller({ body: { email: state.user.email, otp: "654321", newPassword: "test-new-password" } }, res);
    assert.equal(res.body.code, "ACCOUNT_BANNED");
  }
  const res = response();
  await register({ body: { name: "Viewer", email: state.user.email, password, role: "parent", isBanned: false } }, res);
  assert.equal(res.body.success, false);
  assert.equal(res.cookieIssued, undefined);
  assert.equal(state.writes.length, writes);
  assert.deepEqual(state.user, before);
});

test("ban mail delivers without verification or OTP, retries SMTP failures and retains its message ID", async (t) => {
  const state = await setup(t);
  await Promise.all([1, 2, 3].map(() => recordAccessDenial(userId)));
  state.user.isAccountVerified = false;
  const id = state.user.emailJobs.ban.id;
  await state.deliver({ sendMail: async () => { throw Object.assign(new Error("Private SMTP details"), { code: "ECONNECTION" }); } });
  assert.equal(state.user.emailJobs.ban.status, "queued");
  assert.equal(state.user.emailJobs.ban.lastError, "ECONNECTION");
  assert.equal(state.user.emailJobs.ban.attempts, 1);
  state.time += 6000;
  assert.equal(await state.deliver(), true);
  assert.equal(state.mail.length, 1);
  assert.equal(state.mail[0].to, "viewer@example.com");
  assert.equal(state.mail[0].messageId, `<${id}@the-way.invalid>`);
  assert.equal(state.user.emailJobs.ban, undefined);
  assert.equal(await state.deliver(), false);
});

test("expired ban mail and mail for a cleared ban are discarded", async (t) => {
  const state = await setup(t);
  await Promise.all([1, 2, 3].map(() => recordAccessDenial(userId)));
  const job = clone(state.user.emailJobs.ban);
  state.user.isBanned = false;
  assert.equal(await state.deliver(), true);
  assert.equal(state.mail.length, 0);
  state.user.isBanned = true;
  state.user.emailJobs.ban = job;
  state.time += 8 * 24 * 60 * 60 * 1000;
  assert.equal(await state.deliver(), true);
  assert.equal(state.mail.length, 0);
  assert.equal(state.user.emailJobs.ban, undefined);
});

test("page permissions preserve admin/staff distinctions and cover create and edit routes", () => {
  assert.equal(canAccessPage("/admin", ["leader"]), false);
  assert.equal(canAccessPage("/ADMIN", ["parent"]), false);
  assert.equal(canAccessPage("/%61dmin/", ["parent"]), false);
  assert.equal(pageAccessRoles("/%invalid"), null);
  assert.equal(canAccessPage("/admin", ["parent", "pascal"]), true);
  for (const page of ["/attendance", "/childrenProfile", "/video-requests", "/create-lesson", "/create-camp", "/create-game", "/create-chant", "/create-activity", "/lessons/123/edit", "/games/123/edit", "/chants/123/edit", "/edit-chant/123", "/activities/123/edit", "/events/create", "/events/123/edit"]) {
    assert.ok(pageAccessRoles(page), page);
    assert.equal(canAccessPage(page, ["parent"]), false, page);
    for (const role of ["admin", "leader", "pascal", "pamela"]) assert.equal(canAccessPage(page, role), true, `${page}: ${role}`);
  }
  assert.equal(pageAccessRoles("/profile"), null);
});

test("missing identities cannot create access strikes", async (t) => {
  const state = await setup(t);
  const res = response();
  await denyAccess({}, res);
  assert.equal(res.statusCode, 401);
  state.user = null;
  const missing = response();
  await denyAccess({ userId }, missing);
  assert.equal(missing.statusCode, 401);
  assert.equal(state.writes.length, 0);
});
