import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import userModel from "../models/userModel.js";
import transporter from "../config/nodemailer.js";
import { OTP_TTL_MS, OTP_MAX_ATTEMPTS, otpPrefix } from "./otpPolicy.js";
import { normalizeAuthEmail } from "./authEmail.js";

export const EMAIL_JOB_KINDS = ["welcome", "verification", "passwordReset"];
const LEASE_MS = 5 * 60 * 1000;

export const createEmailJob = ({ to, subject, text, expiresAt }) => {
  const recipient = normalizeAuthEmail(to);
  if (!recipient) throw new Error("A valid email address is required");
  return {
    id: randomUUID(), to: recipient, subject, text,
    status: "queued", attempts: 0,
    nextAttemptAt: new Date(), expiresAt: new Date(expiresAt),
  };
};

export const retryDelayMs = (attempts) => Math.min(5000 * 2 ** Math.min(attempts - 1, 6), 5 * 60 * 1000);

export async function processNextEmailJob(kind, {
  users = userModel, mailer = transporter, now = () => new Date(), logger = console,
} = {}) {
  if (!EMAIL_JOB_KINDS.includes(kind)) throw new Error("Invalid email job kind");
  const path = `emailJobs.${kind}`;
  const leaseToken = randomUUID();
  const startedAt = now();
  // The atomic lease also lets another process recover jobs after a crash.
  // Only these server-generated operators bypass the global filter sanitizer.
  const user = await users.findOneAndUpdate({
    $or: [
      { [`${path}.status`]: "queued", [`${path}.nextAttemptAt`]: mongoose.trusted({ $lte: startedAt }) },
      { [`${path}.status`]: "processing", [`${path}.lockedUntil`]: mongoose.trusted({ $lte: startedAt }) },
    ],
  }, {
    $set: {
      [`${path}.status`]: "processing",
      [`${path}.leaseToken`]: leaseToken,
      [`${path}.lockedUntil`]: new Date(startedAt.getTime() + LEASE_MS),
    },
    $inc: { [`${path}.attempts`]: 1 },
  }, { returnDocument: "after" }).select(`emailJobs.${kind} isAccountVerified email
    verifyOtp verifyOtpRequestedAt verifyOtpExpireAt verifyOtpAttempts
    resetOtp resetOtpRequestedAt resetOtpExpireAt resetOtpAttempts`);

  if (!user) return false;
  const job = user.emailJobs[kind];
  const lease = { _id: user._id, [`${path}.leaseToken`]: leaseToken };
  const discard = () => users.updateOne(lease, { $unset: { [path]: "" } });

  const checkedAt = now().getTime();
  const prefix = kind === "welcome" ? null : otpPrefix(kind);
  const inactiveCode = prefix && (
    !user[prefix] || !user[`${prefix}RequestedAt`] ||
    user[`${prefix}RequestedAt`] > checkedAt ||
    user[`${prefix}RequestedAt`] + OTP_TTL_MS <= checkedAt ||
    user[`${prefix}ExpireAt`] <= checkedAt ||
    user[`${prefix}Attempts`] >= OTP_MAX_ATTEMPTS
  );
  const recipient = normalizeAuthEmail(job.to);
  if (!recipient || new Date(job.expiresAt).getTime() <= checkedAt || normalizeAuthEmail(user.email) !== recipient || inactiveCode ||
      (kind === "verification" && (user.isAccountVerified || !user.verifyOtp)) ||
      (kind === "passwordReset" && !user.resetOtp)) {
    await discard();
    return true;
  }

  try {
    await mailer.sendMail({
      from: process.env.SENDER_EMAIL, to: recipient, subject: job.subject, text: job.text,
      messageId: `<${job.id}@the-way.invalid>`,
    });
  } catch (error) {
    // Keep error metadata only: SMTP errors can contain addresses and mail content.
    const errorCode = String(error.code || "EMAIL_DELIVERY_FAILED").slice(0, 80);
    await users.updateOne(lease, {
      $set: {
        [`${path}.status`]: "queued",
        [`${path}.nextAttemptAt`]: new Date(now().getTime() + retryDelayMs(job.attempts)),
        [`${path}.lastError`]: errorCode,
      },
      $unset: { [`${path}.leaseToken`]: "", [`${path}.lockedUntil`]: "" },
    });
    logger.warn(`Email job ${job.id} failed (${errorCode}); retry scheduled.`);
    return true;
  }

  await discard();
  return true;
}

export function startEmailWorker({ pollMs = 2000, logger = console, ...dependencies } = {}) {
  let stopped = false;
  let timer;
  let running;
  let failures = 0;
  const tick = async () => {
    try {
      for (const kind of EMAIL_JOB_KINDS) {
        if (stopped) break;
        await processNextEmailJob(kind, { ...dependencies, logger });
      }
      failures = 0;
    } catch (error) {
      failures += 1;
      // Log useful metadata without query values, credentials, or email bodies.
      const details = [error?.name, error?.code, error?.path]
        .filter((value) => value !== undefined)
        .map((value) => String(value).replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 80))
        .join(", ");
      logger.error(`Email worker could not process jobs (${details || "unknown error"}); retrying automatically.`);
    } finally {
      const delay = failures ? Math.max(pollMs, retryDelayMs(failures)) : pollMs;
      if (!stopped) timer = setTimeout(() => { running = tick(); }, delay);
    }
  };
  running = tick();
  return async () => {
    stopped = true;
    clearTimeout(timer);
    await running;
  };
}
