import mongoose from "mongoose";
import { randomInt } from "node:crypto";
import userModel from "../models/userModel.js";
import { createEmailJob } from "./emailQueue.js";

export const OTP_COOLDOWN_MS = 60_000;

export async function queueOtpRequest(user, kind, { users = userModel, now = Date.now } = {}) {
  const verification = kind === "verification";
  if (!verification && kind !== "passwordReset") throw new Error("Invalid OTP kind");
  const prefix = verification ? "verifyOtp" : "resetOtp";
  const requestedAt = `${prefix}RequestedAt`;
  const timestamp = now();
  const otp = String(randomInt(100000, 1000000));
  const expiresAt = timestamp + 12 * 60 * 60 * 1000;
  // Atomically reserve the cooldown and replace the OTP/job, including across tabs.
  const updated = await users.findOneAndUpdate({
    _id: user._id,
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
      [`emailJobs.${kind}`]: createEmailJob({
        to: user.email,
        subject: verification ? "The Way service OTP" : "Password Reset OTP",
        text: `Dear ${user.name},\nYour ${verification ? "verification" : "password reset"} OTP is ${otp}`,
        expiresAt,
      }),
    },
  }, { new: true, runValidators: true });

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
