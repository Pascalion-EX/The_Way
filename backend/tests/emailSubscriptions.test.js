import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { test } from "node:test";
import express from "express";
import nodemailer from "nodemailer";
import { createEmailRouter } from "../routes/emailRoutes.js";
import { createUnsubscribeUrl, subscriptionEmailHash, verifyUnsubscribeToken } from "../services/emailSubscriptions.js";
import { issueAuthToken, verifyAuthToken } from "../services/authTokens.js";
import { buildBrandedEmail } from "../services/emailTemplate.js";
import { createEmailJob, processNextEmailJob } from "../services/emailQueue.js";
import { withEmailEnvironment } from "./helpers/emailEnvironment.js";

const id = "6ab26b08171afea3091f04b3";
const user = () => ({ _id: id, email: "test@example.invalid", emailUpdatesEnabled: true,
  emailJobs: { welcome: { id: "welcome" }, verification: { id: "verification" } } });
const tokenFor = (value) => new URL(createUnsubscribeUrl(value)).searchParams.get("token");

function setup(t) {
  withEmailEnvironment(t);
  const state = { user: user(), reads: 0, writes: 0, failure: "", race: false };
  const users = {
    findById(subject) {
      state.reads++;
      assert.equal(subject, id);
      return { select: async () => {
        if (state.failure === "read") throw new Error("Private database details");
        const snapshot = structuredClone(state.user);
        if (state.race) state.user.email = "changed@example.invalid";
        return snapshot;
      } };
    },
    async updateOne(filter, update) {
      if (state.failure === "write") throw new Error("Private database details");
      if (!state.user || filter._id !== id || filter.email !== state.user.email) return { matchedCount: 0 };
      state.writes++;
      assert.deepEqual(update, { $set: { emailUpdatesEnabled: false }, $unset: { "emailJobs.welcome": "" } });
      state.user.emailUpdatesEnabled = false;
      delete state.user.emailJobs.welcome;
      return { matchedCount: 1 };
    },
  };
  const app = express();
  app.use("/api/email", createEmailRouter({ users }));
  state.request = (method, fields = {}, query = "") => new Promise((resolve, reject) => {
    const body = new URLSearchParams(fields).toString();
    const req = Readable.from(method === "POST" ? [Buffer.from(body)] : []);
    req.method = method;
    req.url = `/api/email/unsubscribe${query ? `?token=${encodeURIComponent(query)}` : ""}`;
    req.headers = method === "POST" ? { "content-type": "application/x-www-form-urlencoded", "content-length": String(Buffer.byteLength(body)) } : {};
    req.socket = {};
    req.connection = req.socket;
    const res = Object.create(express.response);
    const headers = new Map();
    res.statusCode = 200;
    res.setHeader = (name, value) => headers.set(name.toLowerCase(), value);
    res.getHeader = (name) => headers.get(name.toLowerCase());
    res.send = (html) => resolve({ status: res.statusCode, html, headers });
    app.handle(req, res, (error) => reject(error || new Error("Unmatched unsubscribe route")));
  });
  return state;
}

test("unsubscribe capabilities are scoped, mailbox-bound, expiring and cannot authenticate", (t) => {
  withEmailEnvironment(t);
  const token = tokenFor(user());
  const claims = verifyUnsubscribeToken(token);
  assert.equal(claims.sub, id);
  assert.equal(claims.emailHash, subscriptionEmailHash(" TEST@EXAMPLE.INVALID "));
  assert.equal(claims.exp - claims.iat, 365 * 86400);
  assert.equal(verifyUnsubscribeToken(issueAuthToken({ _id: id })), null);
  assert.throws(() => verifyAuthToken(token));
  assert.equal(verifyUnsubscribeToken(`${token.slice(0, -8)}tampered`), null);
  assert.equal(verifyUnsubscribeToken([token]), null);
  let time = Date.now() - 366 * 86400_000;
  t.mock.method(Date, "now", () => time);
  const expired = tokenFor(user());
  time += 366 * 86400_000;
  assert.equal(verifyUnsubscribeToken(expired), null);
  assert.throws(() => createUnsubscribeUrl({ _id: id, email: "a@example.invalid,b@example.invalid" }));
});

test("GET and HEAD previews never unsubscribe users or access the database", async (t) => {
  const state = setup(t);
  const token = tokenFor(state.user);
  for (const method of ["GET", "HEAD"]) {
    const result = await state.request(method, {}, token);
    assert.equal(result.status, 200);
    assert.match(result.html, /method="post"/);
    assert.match(result.html, /Unsubscribe from optional emails/);
    assert.equal(result.headers.get("cache-control"), "no-store");
    assert.equal(result.headers.get("referrer-policy"), "no-referrer");
    assert.match(result.headers.get("content-security-policy"), /form-action 'self'/);
  }
  assert.equal(state.reads, 0);
  assert.equal(state.writes, 0);
  assert.equal(state.user.emailUpdatesEnabled, true);
});

test("confirmation works without login, is idempotent, and only cancels optional queued mail", async (t) => {
  const state = setup(t);
  const fields = { token: tokenFor(state.user), confirm: "unsubscribe", userId: "another-account" };
  for (let repeat = 0; repeat < 2; repeat++) {
    const result = await state.request("POST", fields);
    assert.equal(result.status, 200);
    assert.match(result.html, /You’re unsubscribed/);
  }
  assert.equal(state.user.emailUpdatesEnabled, false);
  assert.equal(state.user.emailJobs.welcome, undefined);
  assert.equal(state.user.emailJobs.verification.id, "verification");
});

test("invalid links and missing confirmation cannot write preferences or reflect markup", async (t) => {
  const state = setup(t);
  for (const token of ["", "<script>alert(1)</script>", "x".repeat(2049), issueAuthToken({ _id: id })]) {
    const result = await state.request("POST", { token, confirm: "unsubscribe" });
    assert.equal(result.status, 400);
    assert.doesNotMatch(result.html, /<script>/);
  }
  assert.equal((await state.request("POST", { token: tokenFor(state.user) })).status, 400);
  assert.equal(state.reads, 0);
  assert.equal(state.writes, 0);
});

test("changed/deleted mailboxes and email-change races cannot unsubscribe a new mailbox", async (t) => {
  for (const change of ["changed", "deleted", "race"]) {
    const state = setup(t);
    const token = tokenFor(state.user);
    if (change === "changed") state.user.email = "new@example.invalid";
    if (change === "deleted") state.user = null;
    if (change === "race") state.race = true;
    const result = await state.request("POST", { token, confirm: "unsubscribe" });
    assert.equal(result.status, 400, change);
    assert.equal(state.writes, 0, change);
  }
});

test("database failures never report a successful unsubscribe or expose private errors", async (t) => {
  for (const failure of ["read", "write"]) {
    const state = setup(t);
    state.failure = failure;
    const result = await state.request("POST", { token: tokenFor(state.user), confirm: "unsubscribe" });
    assert.equal(result.status, 503);
    assert.doesNotMatch(result.html, /Private database/);
    assert.equal(state.user.emailUpdatesEnabled, true);
  }
});

test("queued welcome mail respects opt-out while verification, recovery and security notices still send", async (t) => {
  withEmailEnvironment(t);
  const timestamp = Date.now();
  for (const kind of ["welcome", "verification", "passwordReset", "ban"]) {
    const account = { ...user(), emailUpdatesEnabled: false, isBanned: kind === "ban", flaggedEmail: user().email,
      verifyOtp: "123456", verifyOtpRequestedAt: timestamp, verifyOtpExpireAt: timestamp + 600_000,
      resetOtp: "654321", resetOtpRequestedAt: timestamp, resetOtpExpireAt: timestamp + 600_000,
      emailJobs: { [kind]: createEmailJob({ to: user().email, subject: "Test", text: "Body", expiresAt: timestamp + 600_000 }) } };
    const sent = [];
    const writes = [];
    await processNextEmailJob(kind, {
      users: { findOneAndUpdate: () => ({ select: async () => account }), updateOne: async (filter, update) => writes.push(update) },
      mailer: { sendMail: async (mail) => sent.push(mail) },
    });
    assert.equal(sent.length, kind === "welcome" ? 0 : 1, kind);
    assert.deepEqual(writes, [{ $unset: { [`emailJobs.${kind}`]: "" } }]);
    if (sent.length) {
      assert.match(sent[0].html, /Unsubscribe from optional emails/);
      assert.equal(sent[0].list, undefined, "Account emails do not advertise themselves as optional list mail");
    }
  }
});

test("optional messages contain functional HTML/plain-text links and a real List-Unsubscribe header", async (t) => {
  withEmailEnvironment(t);
  const url = createUnsubscribeUrl(user());
  const mail = buildBrandedEmail({ kind: "camp", text: "Keep this message", unsubscribeUrl: url });
  assert.ok(mail.html.includes(`href="${url}"`));
  assert.ok(mail.text.startsWith("Keep this message\n\n"));
  assert.ok(mail.text.includes(url));
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true });
  try {
    const result = await transport.sendMail({ from: "sender@example.invalid", to: user().email, subject: "Trip", ...mail });
    const headers = result.message.toString().split(/\r?\n\r?\n/)[0].replace(/\r?\n[ \t]+/g, " ");
    assert.match(headers, /List-Unsubscribe: <https:\/\/way\.example\.org\/api\/email\/unsubscribe\?token=/);
  } finally { transport.close(); }
  assert.throws(() => buildBrandedEmail({ kind: "camp", unsubscribeUrl: "javascript:alert(1)" }));
});
