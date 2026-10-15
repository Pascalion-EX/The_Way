import assert from "node:assert/strict";
import { test } from "node:test";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import mongoose from "mongoose";
import User from "../models/userModel.js";
import { register, login, sendResetOtp, resetPassword } from "../controllers/authController.js";
import { updateProfile } from "../controllers/userController.js";
import { findUserByAuthEmail } from "../services/authIdentity.js";
import { createEmailJob, processNextEmailJob } from "../services/emailQueue.js";
import { queueOtpRequest } from "../services/otpRequests.js";
import { normalizeAuthEmail, newPasswordError, passwordInputError } from "../../shared/authValidation.mjs";

const id = "6ab26b08171afea3091f04b3";
const goodPassword = "amber river sky"; // Exactly 15 characters.
const ascii72 = `${goodPassword} ${"x".repeat(56)}`;
const unicode72 = `${"🔒".repeat(17)}Abcd`;
const signup = (password, email = "test@example.com") => ({ name: "Test", email, password, role: "parent" });
const response = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  set() { return this; },
  cookie(name, value) { this.token = value; return this; },
  json(body) { this.body = body; return this; },
});
const secret = (t) => {
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "test-only-input-validation-secret";
  t.after(() => {
    if (previous === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previous;
  });
};
const denyIo = (t) => {
  for (const method of ["findOne", "findOneAndUpdate", "findById"]) {
    t.mock.method(User, method, () => assert.fail(`Invalid input reached ${method}`));
  }
  t.mock.method(User.prototype, "save", () => assert.fail("Invalid input saved an account"));
  t.mock.method(bcrypt, "hash", () => assert.fail("Invalid input reached hashing"));
  t.mock.method(bcrypt, "compare", () => assert.fail("Invalid input reached comparison"));
};

const invalidEmails = [
  undefined, null, 123, {}, ["a@example.com"], "", "invalid", "a@example.com,b@example.com",
  "a@example.com;b@example.com", "a,b@example.com", "a;b@example.com", "Name <a@example.com>",
  "Name<a@example.com>", "team:a@example.com;", '"a"@example.com', "a@example.com\r\nBcc:b@example.com",
  "\na@example.com", "a@example.com\t", "a\u0000@example.com", "a..b@example.com", ".a@example.com",
  "a.@example.com", "a@-example.com", "a@example-.com", "a@exam_ple.com", "a@localhost",
  `${"a".repeat(65)}@example.com`, `a@${"b".repeat(64)}.com`, `${"x".repeat(257)}@example.com`,
];

test("registration, login, recovery, reset, and profile edits reject unsafe mailbox inputs before account work", async (t) => {
  denyIo(t);
  for (const email of invalidEmails) {
    for (const [controller, req] of [
      [register, { body: { ...signup(goodPassword), email } }],
      [login, { body: { email, password: goodPassword } }],
      [sendResetOtp, { body: { email } }],
      [resetPassword, { body: { email, otp: "123456", newPassword: goodPassword } }],
      [updateProfile, { userId: id, body: { email, currentPassword: goodPassword } }],
    ]) {
      // Omitting email from an ordinary profile edit is deliberately permitted.
      if (controller === updateProfile && email === undefined) continue;
      const res = response();
      await controller(req, res);
      assert.equal(res.statusCode, 400, `${controller.name} accepted ${JSON.stringify(email)}`);
      assert.equal(res.body.success, false);
    }
  }
});

test("new passwords reject short, common, predictable, malformed, and oversized secrets before hashing or OTP reservation", async (t) => {
  denyIo(t);
  for (const password of [
    undefined, null, {}, [], 123, "", "x", "short-password", "x".repeat(14), "🔒".repeat(8),
    "PasswordPassword1!", "password123456789", "correcthorsebatterystaple", "1234567890123456",
    "abcdefghijklmnop", "abcd".repeat(5), " ".repeat(20), `${ascii72}x`, `${unicode72}x`,
    `${goodPassword}\u0000`, `${goodPassword}\uD800`,
  ]) {
    for (const [controller, req] of [
      [register, { body: signup(password) }],
      [resetPassword, { body: { email: "test@example.com", otp: "123456", newPassword: password } }],
    ]) {
      const res = response();
      await controller(req, res);
      assert.equal(res.statusCode, 400, `${controller.name} accepted an invalid secret`);
      assert.equal(res.body.code, "INVALID_PASSWORD");
    }
  }
});

test("password policy counts Unicode code points and enforces the UTF-8 byte boundary", () => {
  assert.equal([...goodPassword].length, 15);
  assert.equal(Buffer.byteLength(ascii72), 72);
  assert.equal(Buffer.byteLength(unicode72), 72);
  for (const password of [goodPassword, ascii72, unicode72, "🔒".repeat(14) + "A", "نافذة نهر وسماء مشرقة", `  ${goodPassword}  `]) {
    assert.equal(newPasswordError(password), null);
  }
  assert.match(newPasswordError("🔒".repeat(8)), /15 characters/);
  assert.match(newPasswordError(`${unicode72}x`), /72 UTF-8 bytes/);
  assert.equal(passwordInputError("x"), null, "Legacy verification does not apply new-password strength rules");
});

test("registration stores one normalized mailbox and hashes the exact supplied secret", async (t) => {
  secret(t);
  const find = t.mock.method(User, "findOne", async () => null);
  const saved = [];
  t.mock.method(User.prototype, "save", async function () { saved.push(this); return this; });
  const password = `  ${goodPassword}  `;
  const res = response();
  await register({ body: signup(password, " Test+tag@Example.COM ") }, res);
  assert.equal(res.body.success, true);
  assert.equal(find.mock.calls[0].arguments[0].email, "test+tag@example.com");
  assert.equal(saved[0].email, "test+tag@example.com");
  assert.equal(saved[0].emailJobs.welcome.to, saved[0].email);
  assert.equal(saved[0].emailJobs.verification.to, saved[0].email);
  assert.equal(await bcrypt.compare(password, saved[0].password), true);
  assert.equal(await bcrypt.compare(password.trim(), saved[0].password), false);
});

test("registration and reset accept 72-byte secrets without modifying or truncating them", async (t) => {
  secret(t);
  const previousSanitizer = mongoose.get("sanitizeFilter");
  mongoose.set("sanitizeFilter", true);
  t.after(() => mongoose.set("sanitizeFilter", previousSanitizer));
  const hash = t.mock.method(bcrypt, "hash", async () => "synthetic-new-hash");
  t.mock.method(bcrypt, "compare", async () => false);
  const lookup = t.mock.method(User.collection, "findOne", async () => null);
  t.mock.method(User.prototype, "save", async function () { return this; });
  const changes = [];
  t.mock.method(User.collection, "findOneAndUpdate", async (filter, update) => {
    assert.equal(filter.email, "test@example.com");
    if (update.$set?.password) changes.push(update.$set);
    return {
      _id: id, email: "test@example.com", password: "old-hash", resetOtp: "123456",
      resetOtpExpireAt: Date.now() + 600_000, resetOtpRequestedAt: Date.now(), resetOtpAttempts: 1,
    };
  });
  for (const password of [ascii72, unicode72]) {
    lookup.mock.mockImplementation(async () => null);
    const registered = response();
    await register({ body: signup(password) }, registered);
    assert.equal(registered.body.success, true);
    lookup.mock.mockImplementation(async () => ({ _id: id, email: "test@example.com", password: "old-hash" }));
    const reset = response();
    await resetPassword({ body: { email: " TEST@Example.COM ", otp: "123456", newPassword: password } }, reset);
    assert.equal(reset.body.success, true);
  }
  assert.deepEqual(hash.mock.calls.map((call) => call.arguments[0]), [ascii72, ascii72, unicode72, unicode72]);
  assert.equal(changes.length, 2);
});

test("legacy short passwords still authenticate, while overlong login inputs never reach bcrypt", async (t) => {
  secret(t);
  const hash = await bcrypt.hash("x", 4);
  const lookup = t.mock.method(User.collection, "findOne", async (filter) => {
    assert.equal(filter.email, "test@example.com");
    return { _id: id, email: filter.email, password: hash, tokenVersion: 0 };
  });
  const res = response();
  await login({ body: { email: " TEST@Example.com ", password: "x" } }, res);
  assert.equal(res.body.success, true);
  assert.ok(res.token);
  const compare = t.mock.method(bcrypt, "compare", () => assert.fail("Overlong input reached comparison"));
  for (const password of [`${ascii72}x`, `${unicode72}x`]) {
    const invalid = response();
    await login({ body: { email: "test@example.com", password } }, invalid);
    assert.equal(invalid.statusCode, 400);
  }
  assert.equal(lookup.mock.callCount(), 1);
  assert.equal(compare.mock.callCount(), 0);
});

test("login, recovery, and duplicate-account checks share normalized lookups with exact legacy fallback", async (t) => {
  const queries = [];
  t.mock.method(User, "findOne", async (filter) => {
    queries.push(filter.email);
    return filter.email === " Legacy@Example.COM " ? { _id: id, email: filter.email } : null;
  });
  assert.equal((await findUserByAuthEmail(" Legacy@Example.COM ")).email, " Legacy@Example.COM ");
  assert.deepEqual(queries, ["legacy@example.com", " Legacy@Example.COM "]);
  assert.equal(await findUserByAuthEmail({ $ne: null }), null);
  assert.equal(queries.length, 2);
});

test("recovery variants find normalized accounts and queue only the stored mailbox", async (t) => {
  t.mock.method(User.collection, "findOne", async (filter) => {
    assert.equal(filter.email, "test@example.com");
    return { _id: id, email: "test@example.com", name: "Test" };
  });
  let recipient;
  t.mock.method(User.collection, "findOneAndUpdate", async (filter, update) => {
    assert.equal(filter.email, "test@example.com");
    recipient = update.$set["emailJobs.passwordReset"].to;
    return { _id: id, email: filter.email };
  });
  const res = response();
  await sendResetOtp({ body: { email: " TEST@Example.COM " } }, res);
  assert.equal(res.body.success, true);
  assert.equal(recipient, "test@example.com");
});

test("profile mailbox validation and reauthentication enforce the same safe password-input boundary", async (t) => {
  t.mock.method(User.collection, "findOne", async () => ({ _id: id, email: "old@example.com", password: "hash" }));
  t.mock.method(User.collection, "findOneAndUpdate", () => assert.fail("Invalid profile input was persisted"));
  t.mock.method(bcrypt, "compare", () => assert.fail("Overlong input reached reauthentication"));
  for (const currentPassword of [`${ascii72}x`, `${unicode72}x`]) {
    const res = response();
    await updateProfile({ userId: id, body: { email: "new@example.com", currentPassword } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.code, "INVALID_PASSWORD");
  }
});

test("mailbox lengths are bounded independently for local, domain labels, and complete address", () => {
  const email = `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(61)}`;
  assert.equal(email.length, 254);
  assert.equal(normalizeAuthEmail(email), email);
  assert.equal(normalizeAuthEmail(` ${email} `), email);
  assert.equal(normalizeAuthEmail(`${email}x`), null);
});

test("Mongoose also rejects recipient lists and display names on account writes", async () => {
  for (const email of invalidEmails.filter((value) => typeof value === "string")) {
    await assert.rejects(new User({ ...signup(goodPassword), email }).validate(["email"]),
      (error) => Boolean(error.errors?.email), "Invalid mailbox passed the account schema");
  }
  await new User(signup(goodPassword)).validate(["email"]);
});

test("email-job construction and OTP queueing reject unsafe legacy destinations", async (t) => {
  denyIo(t);
  for (const to of ["a@example.com,b@example.com", "Name<a@example.com>", "a@example.com\n"]) {
    assert.throws(() => createEmailJob({ to }), /valid email address/);
    const result = await queueOtpRequest({ _id: id, email: to }, "verification");
    assert.equal(result.status, 400);
  }
});

test("the worker canonicalizes legacy single mailboxes into exactly one SMTP recipient", async () => {
  const raw = " Legacy@Example.COM ";
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true });
  let envelope;
  const users = {
    findOneAndUpdate() { return { select: async () => ({
      _id: id, email: raw,
      emailJobs: { welcome: { id: "synthetic", to: raw, subject: "Test", text: "Hello", expiresAt: new Date(Date.now() + 60_000) } },
    }) }; },
    async updateOne() {},
  };
  await processNextEmailJob("welcome", { users, mailer: { async sendMail(message) {
    assert.equal(message.to, "legacy@example.com");
    const result = await transport.sendMail({ ...message, from: "test@example.invalid" });
    envelope = result.envelope;
  } } });
  assert.deepEqual(envelope.to, ["legacy@example.com"]);
});
