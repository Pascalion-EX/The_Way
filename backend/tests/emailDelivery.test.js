import assert from "node:assert/strict";
import { test } from "node:test";
import { smtpOptions } from "../config/nodemailer.js";
import { emailErrorDetails } from "../services/emailErrors.js";
import { createEmailJob, processNextEmailJob } from "../services/emailQueue.js";

test("SMTP configuration preserves Gmail TLS defaults and requires STARTTLS on port 587", () => {
  const defaults = smtpOptions({});
  assert.equal(defaults.port, 465);
  assert.equal(defaults.secure, true);
  assert.equal(defaults.connectionTimeout, 15000);
  const alternate = smtpOptions({
    SMTP_HOST: " smtp.example.invalid ", SMTP_PORT: "587",
    SMTP_USER: "test@example.invalid", SMTP_PASS: "synthetic-secret",
    SMTP_CONNECTION_TIMEOUT_MS: "30000", SMTP_GREETING_TIMEOUT_MS: "20000", SMTP_SOCKET_TIMEOUT_MS: "60000",
  });
  assert.equal(alternate.host, "smtp.example.invalid");
  assert.equal(alternate.port, 587);
  assert.equal(alternate.secure, false);
  assert.equal(alternate.requireTLS, true);
  assert.equal(alternate.auth.pass, "synthetic-secret");
  assert.equal(alternate.connectionTimeout, 30000);
  assert.equal(alternate.greetingTimeout, 20000);
  assert.equal(alternate.socketTimeout, 60000);
  assert.equal(alternate.tls?.rejectUnauthorized, undefined);
});

test("invalid ports and timeouts fail without including the configured value in errors", () => {
  for (const [name, value] of [
    ["SMTP_PORT", "65536"], ["SMTP_PORT", "0"], ["SMTP_PORT", "587.5"],
    ["SMTP_PORT", "private-value"], ["SMTP_CONNECTION_TIMEOUT_MS", "-1"],
    ["SMTP_GREETING_TIMEOUT_MS", "NaN"], ["SMTP_SOCKET_TIMEOUT_MS", "Infinity"],
  ]) {
    assert.throws(() => smtpOptions({ [name]: value }), (error) => {
      assert.ok(error.message.startsWith(name));
      assert.equal(error.message.includes("private-value"), false);
      return true;
    });
  }
});

test("email errors expose timeout stages without logging mail content or credentials", () => {
  for (const timeoutType of ["CONNECT_TIMEOUT", "GREETING_TIMEOUT", "UPGRADE_TIMEOUT", "SOCKET_TIMEOUT"]) {
    assert.equal(emailErrorDetails({ code: "ETIMEDOUT", timeoutType, command: "CONN" }),
      `ETIMEDOUT, ${timeoutType}, stage=CONN`);
  }
  assert.equal(emailErrorDetails({ code: "EAUTH", command: "AUTH PLAIN private-token", responseCode: 535 }),
    "EAUTH, stage=AUTH, smtp=535");
  assert.equal(emailErrorDetails({
    code: "ETIMEDOUT", timeoutType: "private-timeout", command: "RCPT TO:<private@example.invalid>",
    message: "private password", response: "private OTP 123456", responseCode: "535 private",
  }), "ETIMEDOUT");
  assert.equal(emailErrorDetails({ code: "private@example.invalid\npassword" }), "EMAIL_DELIVERY_FAILED");
  assert.equal(emailErrorDetails(null), "EMAIL_DELIVERY_FAILED");
});

test("SMTP timeouts retain the queued job and schedule a retry with safe diagnostic logging", async () => {
  const timestamp = Date.UTC(2026, 9, 23, 12);
  const job = {
    ...createEmailJob({ to: "test@example.invalid", subject: "Synthetic", text: "Private body", expiresAt: timestamp + 600000 }),
    attempts: 1,
  };
  const user = { _id: "6ab26b08171afea3091f04b3", email: job.to, emailJobs: { welcome: job } };
  const writes = [];
  const logs = [];
  const result = await processNextEmailJob("welcome", {
    now: () => new Date(timestamp),
    users: {
      findOneAndUpdate() { return { select: async () => user }; },
      async updateOne(filter, update) { writes.push(update); },
    },
    mailer: {
      async sendMail() {
        throw Object.assign(new Error("private@example.invalid: private credentials"), {
          code: "ETIMEDOUT", command: "CONN", timeoutType: "CONNECT_TIMEOUT",
        });
      },
    },
    logger: { warn(message) { logs.push(message); } },
  });
  assert.equal(result, true);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].$set["emailJobs.welcome.status"], "queued");
  assert.equal(writes[0].$set["emailJobs.welcome.lastError"], "ETIMEDOUT");
  assert.equal(writes[0].$set["emailJobs.welcome.nextAttemptAt"].getTime(), timestamp + 5000);
  assert.equal(Object.hasOwn(writes[0].$unset, "emailJobs.welcome"), false);
  assert.equal(logs.length, 1);
  assert.ok(logs[0].includes("ETIMEDOUT, CONNECT_TIMEOUT, stage=CONN"));
  assert.equal(logs[0].includes("private"), false);
  assert.equal(logs[0].includes("Private body"), false);
});
