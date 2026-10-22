import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { test } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import userRouter from "../routes/userRoutes.js";
import User from "../models/userModel.js";
import { AVATAR_IDS } from "../../shared/avatarPresets.mjs";

const userId = "6ab26b08171afea3091f04b3";
const password = "test-only-current-password";
const jwtSecret = "test-only-profile-security-secret";
const clone = (value) => structuredClone(value);

const setup = async (t) => {
  const previousSecret = process.env.JWT_SECRET;
  const previousSanitizer = mongoose.get("sanitizeFilter");
  process.env.JWT_SECRET = jwtSecret;
  mongoose.set("sanitizeFilter", true);
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
    mongoose.set("sanitizeFilter", previousSanitizer);
  });
  const state = {
    user: {
      _id: userId, name: "Original name", email: "original@example.com",
      password: await bcrypt.hash(password, 4), phone: "123", class: 1,
      role: ["parent"], isAccountVerified: true, verifyOtp: "123456", resetOtp: "654321",
    },
    writeError: null,
    writes: 0,
  };
  const matches = (filter) => state.user && Object.entries(filter).every(([key, value]) => String(state.user[key]) === String(value));
  const project = (projection) => projection
    ? Object.fromEntries(Object.entries(state.user).filter(([key]) => key === "_id" || projection[key] === 1))
    : clone(state.user);
  t.mock.method(User.collection, "findOne", async (filter, options) => matches(filter) ? project(options?.projection) : null);
  state.update = t.mock.method(User.collection, "findOneAndUpdate", async (filter, update, options) => {
    if (state.writeError) throw state.writeError;
    if (!matches(filter)) return null;
    assert.equal(options.returnDocument, "after");
    Object.assign(state.user, update.$set);
    for (const key of Object.keys(update.$unset || {})) delete state.user[key];
    state.writes++;
    return project(options.projection);
  });
  const app = express();
  app.use(cookieParser());
  app.use("/api/user", userRouter);
  const token = jwt.sign({ id: userId, tokenVersion: 0 }, jwtSecret, { expiresIn: "1h" });
  state.request = (body, requestToken = token, method = "PUT") => new Promise((resolve, reject) => {
    const req = Readable.from([]);
    req.method = method;
    req.url = method === "GET" ? "/api/user/data" : "/api/user/update-profile";
    req.headers = requestToken ? { cookie: `token=${requestToken}` } : {};
    req.body = body;
    req.socket = {};
    req.connection = req.socket;
    const res = Object.create(express.response);
    const headers = new Map();
    res.statusCode = 200;
    res.setHeader = (name, value) => headers.set(name.toLowerCase(), value);
    res.getHeader = (name) => headers.get(name.toLowerCase());
    res.json = (result) => resolve({ status: res.statusCode, body: result });
    app.handle(req, res, (error) => reject(error || new Error("Unmatched route")));
  });
  return state;
};

test("a session alone cannot change email or partially apply profile edits", async (t) => {
  const state = await setup(t);
  const before = clone(state.user);
  for (const [currentPassword, status] of [[undefined, 400], ["", 400], [{ $ne: null }, 400], ["incorrect", 403]]) {
    const result = await state.request({ name: "Attacker edit", email: "attacker@example.com", currentPassword, isAccountVerified: true });
    assert.equal(result.status, status);
    assert.equal(result.body.success, false);
    assert.deepEqual(state.user, before);
  }
  assert.equal(state.update.mock.callCount(), 0);
});

test("email changes require the authenticated user's password and return an unverified public profile", async (t) => {
  const state = await setup(t);
  const result = await state.request({
    userId: "6ac82222376fb9c75f5b3961", role: ["admin"], isAccountVerified: true,
    email: " New@Example.com ", currentPassword: password,
  });
  assert.equal(result.status, 200);
  assert.equal(state.user.email, "new@example.com");
  assert.equal(state.user.isAccountVerified, false);
  assert.deepEqual(state.user.role, ["parent"]);
  assert.equal(result.body.user.isAccountVerified, false);
  for (const key of ["password", "verifyOtp", "resetOtp", "emailJobs", "currentPassword"]) {
    assert.equal(Object.hasOwn(result.body.user.toObject(), key), false);
  }
  const blocked = await state.request({ name: "More edits" });
  assert.equal(blocked.status, 403);
  assert.equal(blocked.body.code, "EMAIL_VERIFICATION_REQUIRED");
  assert.equal(state.writes, 1);
});

test("ordinary edits and unchanged email preserve verification and credentials without requiring a password", async (t) => {
  const state = await setup(t);
  state.user.email = "Legacy.MixedCase@example.com";
  const originalPassword = state.user.password;
  for (const email of [undefined, " Legacy.MixedCase@EXAMPLE.COM "]) {
    const result = await state.request({ name: "Updated name", phone: "456", class: "2", ...(email ? { email } : {}) });
    assert.equal(result.status, 200);
    assert.equal(state.user.email, "Legacy.MixedCase@example.com");
    assert.equal(state.user.isAccountVerified, true);
    assert.equal(state.user.password, originalPassword);
    assert.equal(state.user.verifyOtp, "123456");
    assert.equal(state.user.resetOtp, "654321");
    assert.equal(state.user.class, 2);
  }
});

test("email changes fail if password, email, or verified status changes during reauthentication", async (t) => {
  const state = await setup(t);
  const initial = clone(state.user);
  for (const change of [{ password: "concurrent-reset-hash" }, { email: "concurrent@example.com" }, { isAccountVerified: false }]) {
    state.user = clone(initial);
    t.mock.method(bcrypt, "compare", async () => { Object.assign(state.user, change); return true; });
    const result = await state.request({ email: "new@example.com", currentPassword: password });
    assert.equal(result.status, 409);
    assert.deepEqual(state.user, { ...initial, ...change });
  }
  assert.equal(state.writes, 0);
});

test("invalid profile input and authentication failures never write the account", async (t) => {
  const state = await setup(t);
  for (const body of [undefined, [], { email: { $ne: null } }, { email: "" }, { email: "invalid" }, { class: 13 }]) {
    assert.equal((await state.request(body)).status, 400);
  }
  assert.equal((await state.request({ email: "new@example.com", currentPassword: password }, null)).status, 401);
  assert.equal(state.update.mock.callCount(), 0);
});

test("duplicate email and database errors leave the verified address intact without exposing internals", async (t) => {
  const state = await setup(t);
  const initial = clone(state.user);
  for (const [code, status, message] of [[11000, 409, "Email address is already in use"], [undefined, 500, "Unable to update profile"]]) {
    state.writeError = Object.assign(new Error("Private database details"), { code });
    const result = await state.request({ email: "new@example.com", currentPassword: password });
    assert.equal(result.status, status);
    assert.equal(result.body.message, message);
    assert.deepEqual(state.user, initial);
  }
});

test("every preset is saved to the authenticated account and returned on later profile loads", async (t) => {
  const state = await setup(t);
  const original = clone(state.user);
  for (const avatarId of AVATAR_IDS) {
    const saved = await state.request({ avatarId, userId: "6ac82222376fb9c75f5b3961", role: ["admin"] });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.user.avatarId, avatarId);
    assert.deepEqual(state.user, { ...original, avatarId });
    const loaded = await state.request(undefined, undefined, "GET");
    assert.equal(loaded.status, 200);
    assert.equal(loaded.body.userData.avatarId, avatarId);
    assert.equal(Object.hasOwn(loaded.body.userData, "password"), false);
  }
});

test("legacy accounts use initials, ordinary edits preserve the preset, and an empty ID resets it", async (t) => {
  const state = await setup(t);
  assert.equal((await state.request(undefined, undefined, "GET")).body.userData.avatarId, "");
  await state.request({ avatarId: "fox" });
  await state.request({ name: "New name", phone: "456" });
  assert.equal(state.user.avatarId, "fox");
  assert.equal((await state.request(undefined, undefined, "GET")).body.userData.avatarId, "fox");
  const reset = await state.request({ avatarId: "" });
  assert.equal(reset.status, 200);
  assert.equal(reset.body.user.avatarId, "");
  assert.equal((await state.request(undefined, undefined, "GET")).body.userData.avatarId, "");
});

test("invalid picture choices reject the entire edit before writing", async (t) => {
  const state = await setup(t);
  const original = clone(state.user);
  for (const avatarId of [null, 0, false, [], ["fox"], { $ne: null }, "Fox", "unknown", "https://example.com/picture.png", "../../etc/passwd"]) {
    const result = await state.request({ avatarId, name: "Partial edit" });
    assert.equal(result.status, 400);
    assert.equal(result.body.success, false);
    assert.deepEqual(state.user, original);
  }
  assert.equal((await state.request({ avatarId: "fox" }, null)).status, 401);
  assert.equal(state.writes, 0);
});
