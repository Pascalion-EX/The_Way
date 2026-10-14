import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import userModel from "../models/userModel.js";
import { register, login, verifyEmail, resetPassword, sendResetOtp } from "../controllers/authController.js";
import { authenticateUser } from "../middleware/userAuth.js";
import { issueAuthToken } from "../services/authTokens.js";
import { updateProfile } from "../controllers/userController.js";
import { queueOtpRequest, OTP_COOLDOWN_MS } from "../services/otpRequests.js";
import { reserveOtpAttempt, consumeOtpAttempt } from "../services/otpAttempts.js";
import { OTP_TTL_MS, OTP_MAX_ATTEMPTS, otpPrefix } from "../services/otpPolicy.js";
import { processNextEmailJob } from "../services/emailQueue.js";

const timestamp = 1_800_000_000_000;
const id = "6ac82222376fb9c75f5b3961";
const clone = (value) => JSON.parse(JSON.stringify(value));
const pathValue = (object, path) => path.split(".").reduce((value, key) => value?.[key], object);
const equal = (left, right) => String(left) === String(right);

function matches(document, filter) {
  return Object.entries(filter).every(([key, expected]) => {
    if (key === "$or") return expected.some((part) => matches(document, part));
    const actual = pathValue(document, key);
    if (!expected || typeof expected !== "object" || expected instanceof mongoose.Types.ObjectId || expected instanceof Date) {
      return equal(actual, expected);
    }
    return Object.entries(expected).every(([operator, value]) => {
      const comparable = value instanceof Date ? new Date(actual).getTime() : actual;
      const bound = value instanceof Date ? value.getTime() : value;
      switch (operator) {
        case "$exists": return (actual !== undefined) === value;
        case "$type": return typeof actual === value;
        case "$lt": return comparable < bound;
        case "$lte": return comparable <= bound;
        case "$gt": return comparable > bound;
        case "$eq": return equal(actual, value);
        case "$ne": return !equal(actual, value);
        default: throw new Error(`Unsupported fixture operator: ${operator}`);
      }
    });
  });
}

function writePath(document, path, value, remove = false) {
  const parts = path.split(".");
  const key = parts.pop();
  let target = document;
  for (const part of parts) target = target[part] ||= {};
  if (remove) delete target[key];
  else target[key] = clone(value);
}

// Keep real Mongoose filtering, sanitization, casting, and document hydration.
// Stub only collection I/O; each find-and-update executes synchronously against
// one synthetic record to model MongoDB's atomic operation under concurrency.
function installDatabase(t, document) {
  const previous = mongoose.get("sanitizeFilter");
  mongoose.set("sanitizeFilter", true);
  t.after(() => mongoose.set("sanitizeFilter", previous));
  const record = clone(document);
  const writes = [];
  const applyUpdate = (update) => {
    for (const [path, increment] of Object.entries(update.$inc || {})) {
      writePath(record, path, (pathValue(record, path) || 0) + increment);
    }
    for (const [path, value] of Object.entries(update.$set || {})) writePath(record, path, value);
    for (const path of Object.keys(update.$unset || {})) writePath(record, path, undefined, true);
  };
  t.mock.method(userModel.collection, "findOne", async (filter) => matches(record, filter) ? clone(record) : null);
  t.mock.method(userModel.collection, "findOneAndUpdate", async (filter, update) => {
    writes.push({ filter, update });
    if (!matches(record, filter)) return null;
    applyUpdate(update);
    return clone(record);
  });
  t.mock.method(userModel.collection, "updateOne", async (filter, update) => {
    if (!matches(record, filter)) return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
    applyUpdate(update);
    return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
  });
  return { record, writes };
}

function activeUser(kind, overrides = {}) {
  const prefix = otpPrefix(kind);
  return {
    _id: id, name: "Synthetic user", email: "test@example.com", password: "old-password-hash",
    isAccountVerified: false,
    [prefix]: "123456", [`${prefix}RequestedAt`]: timestamp,
    [`${prefix}ExpireAt`]: timestamp + OTP_TTL_MS,
    [`${prefix}Attempts`]: 0, [`${prefix}Generation`]: "old-generation",
    emailJobs: { [kind]: { id: "old-job", status: "queued", expiresAt: new Date(timestamp + OTP_TTL_MS) } },
    ...overrides,
  };
}

const createResponse = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

const submission = (kind, otp = "123456") => kind === "verification"
  ? { userId: id, body: { otp } }
  : { body: { email: "test@example.com", otp, newPassword: "a-new-test-password" } };

for (const kind of ["verification", "passwordReset"]) {
  const prefix = otpPrefix(kind);
  const controller = kind === "verification" ? verifyEmail : resetPassword;

  test(`${kind}: concurrent guesses share a five-attempt database budget, including legacy counters`, async (t) => {
    const initial = activeUser(kind);
    delete initial[`${prefix}Attempts`];
    delete initial[`${prefix}Generation`];
    const { record, writes } = installDatabase(t, initial);
    const results = await Promise.all(Array.from({ length: 30 }, () => reserveOtpAttempt({ _id: id }, kind, { now: () => timestamp + 1 })));
    assert.equal(results.filter((result) => result.success).length, OTP_MAX_ATTEMPTS);
    assert.equal(results.filter((result) => result.status === 429).length, 25);
    assert.equal(record[`${prefix}Attempts`], OTP_MAX_ATTEMPTS);
    assert.ok(writes.every(({ update }) => update.$inc[`${prefix}Attempts`] === 1));
  });

  test(`${kind}: five incorrect controller submissions block a later correct code`, async (t) => {
    t.mock.method(Date, "now", () => timestamp + 1);
    const { record } = installDatabase(t, activeUser(kind));
    for (let attempt = 0; attempt < OTP_MAX_ATTEMPTS; attempt += 1) {
      const res = createResponse();
      await controller(submission(kind, "654321"), res);
      assert.equal(res.statusCode, 400);
      assert.equal(res.body.success, false);
    }
    const res = createResponse();
    await controller(submission(kind), res);
    assert.equal(res.statusCode, 429);
    assert.equal(record[`${prefix}Attempts`], 5);
    assert.equal(record[prefix], "123456");
    assert.equal(record.password, "old-password-hash");
  });

  test(`${kind}: the fifth admitted attempt can consume once and removes its email job`, async (t) => {
    t.mock.method(Date, "now", () => timestamp + 1);
    const { record } = installDatabase(t, activeUser(kind, { [`${prefix}Attempts`]: 4 }));
    const res = createResponse();
    await controller(submission(kind), res);
    assert.equal(res.body.success, true);
    assert.equal(record[prefix], "");
    assert.equal(record[`${prefix}ExpireAt`], 0);
    assert.equal(record.emailJobs[kind], undefined);
    if (kind === "verification") assert.equal(record.isAccountVerified, true);
    else assert.equal(await bcrypt.compare("a-new-test-password", record.password), true);
    const replay = createResponse();
    await controller(submission(kind), replay);
    assert.equal(replay.statusCode, 400);
    assert.equal(replay.body.success, false);
  });

  test(`${kind}: concurrent valid submissions apply the account change exactly once`, async (t) => {
    t.mock.method(Date, "now", () => timestamp + 1);
    if (kind === "passwordReset") {
      t.mock.method(bcrypt, "compare", async () => false);
      t.mock.method(bcrypt, "hash", async () => "new-password-hash");
    }
    const { record } = installDatabase(t, activeUser(kind));
    const responses = await Promise.all(Array.from({ length: 20 }, async () => {
      const res = createResponse();
      await controller(submission(kind), res);
      return res;
    }));
    assert.equal(responses.filter((res) => res.body.success).length, 1);
    assert.equal(record[prefix], "");
    assert.equal(record.emailJobs[kind], undefined);
  });

  test(`${kind}: resend replaces generation and cannot be erased by a reserved old submission`, async (t) => {
    const { record } = installDatabase(t, activeUser(kind));
    const oldAttempt = await reserveOtpAttempt({ _id: id }, kind, { now: () => timestamp + 1 });
    const issuedAt = timestamp + OTP_COOLDOWN_MS;
    const issuance = await queueOtpRequest(oldAttempt.user, kind, { now: () => issuedAt });
    assert.equal(issuance.success, true);
    assert.equal(record[`${prefix}ExpireAt`], issuedAt + OTP_TTL_MS);
    assert.equal(record[`${prefix}Attempts`], 0);
    assert.notEqual(record[`${prefix}Generation`], "old-generation");
    // Even an accidental same-code resend must remain protected by generation.
    record[prefix] = "123456";
    const newJobId = record.emailJobs[kind].id;
    const stale = await consumeOtpAttempt(oldAttempt.user, kind, { isAccountVerified: true }, { now: () => issuedAt });
    assert.equal(stale.success, false);
    assert.equal(record[prefix], "123456");
    assert.equal(record.emailJobs[kind].id, newJobId);
    const fresh = await reserveOtpAttempt({ _id: id }, kind, { now: () => issuedAt });
    assert.equal(fresh.success, true);
    assert.equal(record[`${prefix}Attempts`], 1);
  });

  test(`${kind}: cooldown issuance is atomic across simultaneous resend requests`, async (t) => {
    const { record } = installDatabase(t, activeUser(kind));
    const results = await Promise.all(Array.from({ length: 15 }, () => queueOtpRequest(record, kind, { now: () => timestamp + OTP_COOLDOWN_MS })));
    assert.equal(results.filter((result) => result.success).length, 1);
    assert.equal(results.filter((result) => result.status === 429).length, 14);
  });

  test(`${kind}: expiry during password work/verification prevents consumption`, async (t) => {
    const { record } = installDatabase(t, activeUser(kind));
    const attempt = await reserveOtpAttempt({ _id: id }, kind, { now: () => timestamp + OTP_TTL_MS - 1 });
    assert.equal(attempt.success, true);
    const result = await consumeOtpAttempt(attempt.user, kind, { password: "replacement-hash" }, { now: () => timestamp + OTP_TTL_MS });
    assert.equal(result.success, false);
    assert.equal(record.password, "old-password-hash");
    assert.equal(record[prefix], "123456");
  });

  for (const legacy of ["expired twelve-hour code", "missing issuance timestamp"]) {
    test(`${kind}: rejects ${legacy}`, async (t) => {
      const user = activeUser(kind, { [`${prefix}ExpireAt`]: timestamp + 12 * 60 * 60_000 });
      if (legacy === "missing issuance timestamp") delete user[`${prefix}RequestedAt`];
      const { record } = installDatabase(t, user);
      const result = await reserveOtpAttempt({ _id: id }, kind, { now: () => timestamp + OTP_TTL_MS + 1 });
      assert.equal(result.success, false);
      assert.equal(record[`${prefix}Attempts`], 0);
    });
  }

  test(`${kind}: a still-fresh legacy code consumes without a generation or attempt field`, async (t) => {
    const initial = activeUser(kind, { [`${prefix}ExpireAt`]: timestamp + 12 * 60 * 60_000 });
    delete initial[`${prefix}Generation`];
    delete initial[`${prefix}Attempts`];
    const { record } = installDatabase(t, initial);
    const attempt = await reserveOtpAttempt({ _id: id }, kind, { now: () => timestamp + 1 });
    const result = await consumeOtpAttempt(attempt.user, kind, { isAccountVerified: true }, { now: () => timestamp + 2 });
    assert.equal(result.success, true);
    assert.equal(record[prefix], "");
  });

  for (const inactive of ["legacy expiry", "attempts exhausted"]) {
    test(`${kind}: email worker discards a queued code with ${inactive}`, async (t) => {
      const user = activeUser(kind, {
        [`${prefix}ExpireAt`]: timestamp + 12 * 60 * 60_000,
        [`${prefix}Attempts`]: inactive === "attempts exhausted" ? 5 : 0,
      });
      user.emailJobs[kind] = {
        id: "old-job", status: "queued", attempts: 0,
        to: user.email, subject: "Test", text: "Synthetic OTP",
        nextAttemptAt: new Date(timestamp), expiresAt: new Date(timestamp + 12 * 60 * 60_000),
      };
      const { record } = installDatabase(t, user);
      let deliveries = 0;
      const processed = await processNextEmailJob(kind, {
        now: () => new Date(timestamp + (inactive === "legacy expiry" ? OTP_TTL_MS : 1)),
        mailer: { async sendMail() { deliveries += 1; } },
      });
      assert.equal(processed, true);
      assert.equal(deliveries, 0);
      assert.equal(record.emailJobs[kind], undefined);
    });
  }

  test(`${kind}: the email worker delivers a current code before its deadline`, async (t) => {
    const user = activeUser(kind);
    user.emailJobs[kind] = {
      id: "current-job", status: "queued", attempts: 0,
      to: user.email, subject: "Test", text: "Synthetic OTP",
      nextAttemptAt: new Date(timestamp), expiresAt: new Date(timestamp + OTP_TTL_MS),
    };
    const { record } = installDatabase(t, user);
    let deliveries = 0;
    const processed = await processNextEmailJob(kind, {
      now: () => new Date(timestamp + 1),
      mailer: { async sendMail(message) {
        assert.equal(message.to, user.email);
        deliveries += 1;
      } },
    });
    assert.equal(processed, true);
    assert.equal(deliveries, 1);
    assert.equal(record.emailJobs[kind], undefined);
  });
}

test("registration codes and their delivery jobs both use the ten-minute policy", async (t) => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "test-only-secret";
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });
  t.mock.method(Date, "now", () => timestamp);
  t.mock.method(userModel, "findOne", async () => null);
  let saved;
  t.mock.method(userModel.prototype, "save", async function () { saved = this; return this; });
  const res = { ...createResponse(), cookie() {} };
  await register({ body: { name: "Test", email: "test@example.com", password: "test-password", role: "parent" } }, res);
  assert.equal(res.body.success, true);
  assert.equal(saved.verifyOtpExpireAt, timestamp + OTP_TTL_MS);
  assert.equal(saved.verifyOtpAttempts, 0);
  assert.ok(saved.verifyOtpGeneration);
  assert.equal(saved.emailJobs.verification.expiresAt.getTime(), timestamp + OTP_TTL_MS);
});

test("reset rejects object emails and non-string codes without querying or hashing", async (t) => {
  const find = t.mock.method(userModel, "findOne", () => { throw new Error("Must not query"); });
  const write = t.mock.method(userModel, "findOneAndUpdate", () => { throw new Error("Must not reserve"); });
  const hash = t.mock.method(bcrypt, "hash", () => { throw new Error("Must not hash"); });
  for (const body of [
    { email: { $ne: null }, otp: "123456", newPassword: "new-password" },
    { email: "test@example.com", otp: 123456, newPassword: "new-password" },
    { email: "test@example.com", otp: "123456", newPassword: { $ne: null } },
  ]) {
    const res = createResponse();
    await resetPassword({ body }, res);
    assert.equal(res.statusCode, 400);
  }
  const requestRes = createResponse();
  await sendResetOtp({ body: { email: { $ne: null } } }, requestRes);
  assert.equal(requestRes.statusCode, 400);
  assert.equal(find.mock.callCount(), 0);
  assert.equal(write.mock.callCount(), 0);
  assert.equal(hash.mock.callCount(), 0);
});

test("a matching reset code still spends an attempt when the replacement password is unchanged", async (t) => {
  t.mock.method(Date, "now", () => timestamp + 1);
  t.mock.method(bcrypt, "compare", async () => true);
  const hash = t.mock.method(bcrypt, "hash", () => { throw new Error("Must not hash"); });
  const { record } = installDatabase(t, activeUser("passwordReset"));
  const res = createResponse();
  await resetPassword(submission("passwordReset"), res);
  assert.equal(res.body.success, false);
  assert.equal(record.resetOtpAttempts, 1);
  assert.equal(record.resetOtp, "123456");
  assert.equal(hash.mock.callCount(), 0);
});

test("a changed account mailbox or password invalidates an in-progress reset commitment", async (t) => {
  const { record } = installDatabase(t, activeUser("passwordReset"));
  const attempt = await reserveOtpAttempt({ _id: id }, "passwordReset", { now: () => timestamp + 1 });
  record.email = "changed@example.com";
  let result = await consumeOtpAttempt(attempt.user, "passwordReset", { password: "replacement-hash" }, { now: () => timestamp + 2 });
  assert.equal(result.success, false);
  record.email = "test@example.com";
  record.password = "another-session-password-hash";
  result = await consumeOtpAttempt(attempt.user, "passwordReset", { password: "replacement-hash" }, { now: () => timestamp + 2 });
  assert.equal(result.success, false);
  assert.equal(record.password, "another-session-password-hash");
});

for (const email of ["Legacy.MixedCase@example.com", " legacy@example.com "]) {
  test(`recovery preserves the exact stored legacy mailbox ${JSON.stringify(email)}`, async (t) => {
    t.mock.method(Date, "now", () => timestamp + OTP_COOLDOWN_MS + 1);
    const { record } = installDatabase(t, activeUser("passwordReset", { email }));
    t.mock.method(bcrypt, "compare", async () => false);
    t.mock.method(bcrypt, "hash", async () => "synthetic-replacement-hash");
    const requested = { ...createResponse(), set() { return this; } };
    await sendResetOtp({ body: { email } }, requested);
    assert.equal(requested.body.success, true);
    assert.equal(record.emailJobs.passwordReset.to, email);
    const reset = createResponse();
    await resetPassword({ body: { email, otp: record.resetOtp, newPassword: "synthetic-new-password" } }, reset);
    assert.equal(reset.body.success, true);
    assert.equal(record.password, "synthetic-replacement-hash");
    assert.equal(record.resetOtp, "");
  });
}

test("OTP controllers reject absent bodies before account lookup or mutation", async (t) => {
  t.mock.method(userModel, "findOne", () => assert.fail("Invalid body queried an account"));
  t.mock.method(userModel, "findOneAndUpdate", () => assert.fail("Invalid body modified an account"));
  for (const controller of [sendResetOtp, verifyEmail, resetPassword]) {
    const res = createResponse();
    await controller({ userId: id }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
  }
});

test("changing email clears both OTP generations and queued mail, then requires a fresh verification code", async (t) => {
  t.mock.method(Date, "now", () => timestamp + 1);
  const user = {
    ...activeUser("verification"), ...activeUser("passwordReset"),
    isAccountVerified: true, password: await bcrypt.hash("current-password", 4),
    emailJobs: { welcome: { id: "old-welcome" }, verification: { id: "old-verify" }, passwordReset: { id: "old-reset" } },
  };
  const { record } = installDatabase(t, user);
  const reservedReset = await reserveOtpAttempt({ _id: id }, "passwordReset");
  assert.equal(reservedReset.success, true);
  const changed = createResponse();
  await updateProfile({ userId: id, body: { email: "new@example.com", currentPassword: "current-password" } }, changed);
  assert.equal(changed.body.success, true);
  assert.equal(record.email, "new@example.com");
  assert.equal(record.isAccountVerified, false);
  assert.equal(record.emailJobs, undefined);
  for (const prefix of ["verifyOtp", "resetOtp"]) {
    assert.equal(record[prefix], "");
    assert.equal(record[`${prefix}ExpireAt`], 0);
    assert.equal(record[`${prefix}RequestedAt`], 0);
    assert.equal(record[`${prefix}Attempts`], 0);
    assert.equal(record[`${prefix}Generation`], "");
  }
  const staleReset = await consumeOtpAttempt(reservedReset.user, "passwordReset", { password: "attacker-password-hash" });
  assert.equal(staleReset.success, false);
  assert.equal(record.password, user.password);
  const staleVerification = createResponse();
  await verifyEmail({ userId: id, body: { otp: "123456" } }, staleVerification);
  assert.equal(staleVerification.statusCode, 400);
  const staleResetSubmission = createResponse();
  await resetPassword({ body: { email: "new@example.com", otp: "123456", newPassword: "attacker-password" } }, staleResetSubmission);
  assert.equal(staleResetSubmission.statusCode, 400);
  const queued = await queueOtpRequest(record, "verification");
  assert.equal(queued.success, true);
  assert.equal(record.emailJobs.verification.to, "new@example.com");
  const verified = createResponse();
  await verifyEmail({ userId: id, body: { otp: record.verifyOtp } }, verified);
  assert.equal(verified.body.success, true);
  assert.equal(record.isAccountVerified, true);
});

test("password reset atomically revokes copied JWTs; failed resets preserve sessions and a fresh login succeeds", async (t) => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "test-only-password-reset-revocation-secret";
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });
  t.mock.method(Date, "now", () => timestamp + 1);
  const { record, writes } = installDatabase(t, activeUser("passwordReset", {
    password: await bcrypt.hash("old-password", 4), tokenVersion: 4, isAccountVerified: true,
  }));
  const oldToken = issueAuthToken(record);
  const authenticated = async (token) => {
    const res = createResponse();
    let admitted = false;
    await authenticateUser({ cookies: { token } }, res, () => { admitted = true; });
    return { admitted, res };
  };
  assert.equal((await authenticated(oldToken)).admitted, true);
  const invalid = createResponse();
  await resetPassword(submission("passwordReset", "654321"), invalid);
  assert.equal(invalid.statusCode, 400);
  assert.equal(record.tokenVersion, 4);
  assert.equal((await authenticated(oldToken)).admitted, true);
  const unchanged = createResponse();
  await resetPassword({ body: { email: record.email, otp: "123456", newPassword: "old-password" } }, unchanged);
  assert.equal(unchanged.body.success, false);
  assert.equal(record.tokenVersion, 4);
  const reset = createResponse();
  await resetPassword(submission("passwordReset"), reset);
  assert.equal(reset.body.success, true);
  assert.equal(record.tokenVersion, 5);
  const commitment = writes.find(({ update }) => update.$set?.password);
  assert.equal(commitment.update.$inc.tokenVersion, 1);
  assert.equal(commitment.update.$set.resetOtp, "");
  const revoked = await authenticated(oldToken);
  assert.equal(revoked.admitted, false);
  assert.equal(revoked.res.statusCode, 401);
  const loggedIn = { ...createResponse(), cookie(name, token) { this.token = token; } };
  await login({ body: { email: record.email, password: "a-new-test-password" } }, loggedIn);
  assert.equal(loggedIn.body.success, true);
  assert.equal((await authenticated(loggedIn.token)).admitted, true);
});
