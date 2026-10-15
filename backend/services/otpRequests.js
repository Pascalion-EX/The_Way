import mongoose from "mongoose";
import { randomInt, randomUUID } from "node:crypto";
import userModel from "../models/userModel.js";
import { createEmailJob } from "./emailQueue.js";
import { OTP_TTL_MS, otpPrefix } from "./otpPolicy.js";
import { normalizeAuthEmail } from "./authEmail.js";

export const OTP_COOLDOWN_MS = 60_000;

export async function queueOtpRequest(user, kind, { users = userModel, now = Date.now } = {}) {
  if (!normalizeAuthEmail(user.email)) {
    return { success: false, status: 400, message: "A valid email address is required" };
  }
  const verification = kind === "verification";
  const prefix = otpPrefix(kind);
  const requestedAt = `${prefix}RequestedAt`;
  const timestamp = now();
  const otp = String(randomInt(100000, 1000000));
  const expiresAt = timestamp + OTP_TTL_MS;
  // Atomically reserve the cooldown and replace the OTP/job, including across tabs.
  const updated = await users.findOneAndUpdate({
    _id: user._id,
    email: user.email,
    ...(verification ? { isAccountVerified: mongoose.trusted({ $ne: true }) } : {}),
    $or: [
      { [requestedAt]: mongoose.trusted({ $lte: timestamp - OTP_COOLDOWN_MS }) },
      { [requestedAt]: mongoose.trusted({ $exists: false }) },
    ],
  }, {
    $set: {
      [prefix]: otp,
      [`${prefix}ExpireAt`]: expiresAt,
      [requestedAt]: timestamp,
      [`${prefix}Attempts`]: 0,
      [`${prefix}Generation`]: randomUUID(),
      [`emailJobs.${kind}`]: createEmailJob({
        to: user.email,
        subject: verification ? "The Way service OTP" : "Password Reset OTP",
        text: `Dear ${user.name},\nYour ${verification ? "verification" : "password reset"} OTP is ${otp}`,
        expiresAt,
      }),
    },
  }, { returnDocument: "after", runValidators: true });

  if (updated) return { success: true, otpResendAvailableAt: timestamp + OTP_COOLDOWN_MS };

  const current = await users.findById(user._id);
  if (!current) return { success: false, status: 404, message: "User not found" };
  if (verification && current.isAccountVerified) return { success: false, status: 400, message: "Account already verified" };
  const retryAfter = Math.max(1, Math.ceil(((current[requestedAt] || 0) + OTP_COOLDOWN_MS - now()) / 1000));
  return {
    success: false, status: 429, retryAfter,
    otpResendAvailableAt: (current[requestedAt] || 0) + OTP_COOLDOWN_MS,
    message: `Please wait ${retryAfter} seconds before requesting another OTP.`,
  };
}
