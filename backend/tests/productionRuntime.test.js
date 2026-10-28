import assert from "node:assert/strict";
import { test } from "node:test";
import jwt from "jsonwebtoken";
import User from "../models/userModel.js";
import { authenticateUser, requireVerifiedUser } from "../middleware/userAuth.js";
import { requireStaff } from "../middleware/staffAuth.js";
import { validateEnvironment } from "../config/environment.js";
import { databaseUrl } from "../config/mongodb.js";
import { issueAuthToken, verifyAuthToken } from "../services/authTokens.js";

const response = () => ({
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

test("one database authorization read per request still rechecks revocations on the next request", async (t) => {
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "test-only-production-runtime-secret";
  t.after(() => {
    if (previous === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previous;
  });
  const id = "6ab26b08171afea3091f04b3";
  let identity = { _id: id, tokenVersion: 0, role: ["leader"], class: 2, isAccountVerified: true };
  const lookup = t.mock.method(User, "findById", () => ({ select: async () => structuredClone(identity) }));
  const token = jwt.sign({ id, tokenVersion: 0 }, process.env.JWT_SECRET);
  const request = async () => {
    const req = { cookies: { token }, body: { role: ["admin"] }, staffUser: { role: ["admin"] } };
    const res = response();
    let admitted = false;
    await authenticateUser(req, res, async () => {
      await requireVerifiedUser(req, res, async () => {
        await requireStaff(req, res, () => { admitted = true; });
      });
    });
    return { admitted, res, req };
  };
  assert.equal((await request()).admitted, true);
  assert.equal(lookup.mock.callCount(), 1);
  identity = { ...identity, isAccountVerified: false };
  const unverified = await request();
  assert.equal(unverified.admitted, false);
  assert.equal(unverified.res.statusCode, 403);
  identity = { ...identity, isAccountVerified: true, tokenVersion: 1 };
  const revoked = await request();
  assert.equal(revoked.admitted, false);
  assert.equal(revoked.res.statusCode, 401);
  assert.equal(lookup.mock.callCount(), 3);
});

test("production environment fails early for missing credentials and non-HTTPS origins", () => {
  const env = { NODE_ENV: "production", JWT_SECRET: "a".repeat(64), APP_ORIGIN: "https://way.example.org",
    SMTP_HOST: "smtp.example.org", SMTP_USER: "sender@example.org", SMTP_PASS: "secret",
    SENDER_EMAIL: "sender@example.org", VIDEO_REQUEST_EMAIL: "video@example.org", MONGO_APP_PASSWORD: "secret" };
  assert.doesNotThrow(() => validateEnvironment(env));
  for (const key of ["JWT_SECRET", "SMTP_PASS", "MONGO_APP_PASSWORD"]) {
    assert.throws(() => validateEnvironment({ ...env, [key]: "" }));
  }
  for (const origin of ["http://way.example.org", "https://way.example.org/", "https://way.example.org/path"]) {
    assert.throws(() => validateEnvironment({ ...env, APP_ORIGIN: origin }));
  }
  assert.match(databaseUrl({ MONGO_APP_PASSWORD: "p@ss:word" }), /p%40ss%3Aword@db/);
});

test("token signing and verification use the current runtime secret", (t) => {
  const previous = process.env.JWT_SECRET;
  t.after(() => {
    if (previous === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previous;
  });
  const user = { _id: "6ab26b08171afea3091f04b3", tokenVersion: 2 };
  process.env.JWT_SECRET = "synthetic-first-runtime-secret";
  const firstToken = issueAuthToken(user);
  assert.equal(verifyAuthToken(firstToken).id, user._id);

  process.env.JWT_SECRET = "synthetic-replacement-runtime-secret";
  assert.throws(() => verifyAuthToken(firstToken), /invalid signature/);
  const nextToken = issueAuthToken(user);
  assert.equal(verifyAuthToken(nextToken).tokenVersion, 2);
  assert.throws(() => jwt.verify(nextToken, "synthetic-first-runtime-secret"), /invalid signature/);
});
