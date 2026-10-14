import assert from "node:assert/strict";
import { test } from "node:test";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/userModel.js";
import { login, logout } from "../controllers/authController.js";
import { authenticateUser } from "../middleware/userAuth.js";

const userId = "6ab26b08171afea3091f04b3";
const password = "test-only-password";
const secret = "test-only-session-revocation-secret";
const response = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
  cookie(name, token) { this.token = token; },
  clearCookie() { this.cookieCleared = true; },
});

const setup = async (t, version = 0) => {
  const previousSecret = process.env.JWT_SECRET;
  const previousSanitizer = mongoose.get("sanitizeFilter");
  process.env.JWT_SECRET = secret;
  mongoose.set("sanitizeFilter", true);
  // Deliberately keep time fixed: revocation must work even within the same second.
  t.mock.method(Date, "now", () => 1_800_000_000_000);
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
    mongoose.set("sanitizeFilter", previousSanitizer);
  });
  const state = {
    user: {
      _id: userId, email: "test@example.com", password: await bcrypt.hash(password, 4),
      isAccountVerified: true, tokenVersion: version,
    },
    lookupError: false,
    writeError: false,
    revocations: 0,
  };
  t.mock.method(User.collection, "findOne", async (filter) => {
    if (state.lookupError) throw new Error("Private lookup error");
    return state.user && Object.entries(filter).every(([key, value]) => String(state.user[key]) === String(value))
      ? structuredClone(state.user) : null;
  });
  state.update = t.mock.method(User.collection, "updateOne", async (filter, update) => {
    if (state.writeError) throw new Error("Private revocation error");
    assert.equal(String(filter._id), userId);
    assert.equal(update.$inc.tokenVersion, 1);
    const version = state.user?.tokenVersion;
    const matchesVersion = typeof filter.tokenVersion === "number"
      ? filter.tokenVersion === version
      : filter.tokenVersion.$in.some((value) => value === version || (value === null && version === undefined));
    if (!state.user || !matchesVersion) return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
    state.user.tokenVersion = (version || 0) + 1;
    state.revocations++;
    return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
  });
  state.authenticate = async (token) => {
    const req = { cookies: { token } };
    const res = response();
    let admitted = false;
    await authenticateUser(req, res, () => { admitted = true; });
    return { admitted, req, res };
  };
  state.logout = async (token) => {
    const res = response();
    await logout({ cookies: { token }, body: { userId: "6ac82222376fb9c75f5b3961" } }, res);
    return res;
  };
  state.login = async () => {
    const res = response();
    await login({ body: { email: state.user.email, password } }, res);
    assert.equal(res.body.success, true);
    return res.token;
  };
  return state;
};

test("logout immediately revokes every copied token, while a fresh login works in the same second", async (t) => {
  const state = await setup(t);
  const token = await state.login();
  assert.equal((await state.authenticate(token)).admitted, true);
  const claims = jwt.verify(token, secret);
  assert.equal(claims.exp - claims.iat, 172800);
  const result = await state.logout(token);
  assert.equal(result.body.success, true);
  assert.equal(result.cookieCleared, true);
  const replay = await state.authenticate(token);
  assert.equal(replay.admitted, false);
  assert.equal(replay.res.statusCode, 401);
  assert.equal(replay.req.userId, undefined);
  const fresh = await state.login();
  assert.equal(jwt.verify(fresh, secret).tokenVersion, 1);
  assert.equal((await state.authenticate(fresh)).admitted, true);
  // Replaying the old logout cannot invalidate a later login.
  await state.logout(token);
  assert.equal((await state.authenticate(fresh)).admitted, true);
  assert.equal(state.revocations, 1);
});

test("existing accounts without tokenVersion can log in and revoke version-zero tokens", async (t) => {
  const state = await setup(t);
  delete state.user.tokenVersion;
  const token = await state.login();
  assert.equal(jwt.verify(token, secret).tokenVersion, 0);
  assert.equal((await state.authenticate(token)).admitted, true);
  assert.equal((await state.logout(token)).body.success, true);
  assert.equal(state.user.tokenVersion, 1);
  assert.equal((await state.authenticate(token)).res.statusCode, 401);
});

test("concurrent logouts revoke a generation once and leave newer sessions intact", async (t) => {
  const state = await setup(t, 5);
  const token = await state.login();
  const results = await Promise.all(Array.from({ length: 10 }, () => state.logout(token)));
  assert.ok(results.every((res) => res.body.success && res.cookieCleared));
  assert.equal(state.user.tokenVersion, 6);
  assert.equal(state.revocations, 1);
  assert.equal((await state.authenticate(token)).admitted, false);
});

test("legacy, malformed, expired, and forged JWTs cannot authenticate or revoke sessions", async (t) => {
  const state = await setup(t);
  const tokens = [
    undefined, "invalid", jwt.sign({ id: userId }, secret),
    jwt.sign({ id: userId, tokenVersion: "0" }, secret),
    jwt.sign({ id: userId, tokenVersion: -1 }, secret),
    jwt.sign({ id: "invalid", tokenVersion: 0 }, secret),
    jwt.sign({ id: userId, tokenVersion: 0 }, secret, { expiresIn: -1 }),
    jwt.sign({ id: userId, tokenVersion: 0 }, secret, { notBefore: "1h" }),
    jwt.sign({ id: userId, tokenVersion: 0 }, "incorrect-secret"),
    jwt.sign({ id: userId, tokenVersion: 0 }, secret, { algorithm: "HS384" }),
  ];
  for (const token of tokens) {
    const result = await state.authenticate(token);
    assert.equal(result.admitted, false);
    assert.equal(result.res.statusCode, 401);
    const loggedOut = await state.logout(token);
    assert.equal(loggedOut.body.success, true);
    assert.equal(loggedOut.cookieCleared, true);
  }
  assert.equal(state.update.mock.callCount(), 0);
});

test("deleted accounts and database outages fail closed; failed revocation must not report logout success", async (t) => {
  const state = await setup(t);
  const token = await state.login();
  state.lookupError = true;
  const auth = await state.authenticate(token);
  assert.equal(auth.admitted, false);
  assert.equal(auth.res.statusCode, 500);
  assert.equal(auth.res.body.message, "Authentication failed.");
  state.lookupError = false;
  state.writeError = true;
  const result = await state.logout(token);
  assert.equal(result.statusCode, 503);
  assert.equal(result.body.success, false);
  assert.equal(result.cookieCleared, undefined);
  assert.equal(state.revocations, 0);
  state.writeError = false;
  state.user = null;
  assert.equal((await state.authenticate(token)).res.statusCode, 401);
});
