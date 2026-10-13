import mongoose from "mongoose";
import { timingSafeEqual } from "node:crypto";
import userModel from "../models/userModel.js";
import { OTP_TTL_MS, OTP_MAX_ATTEMPTS, otpPrefix } from "./otpPolicy.js";

const invalidOtp = () => ({
  success: false,
  status: 400,
  message: "Invalid or expired OTP. Request a new code.",
});
// understand later
function activeCodeFilter(prefix, timestamp) {
  return {
    [prefix]: mongoose.trusted({ $type: "string", $ne: "" }),
    [`${prefix}ExpireAt`]: mongoose.trusted({ $gt: timestamp }),
    // Also cap codes issued before the ten-minute policy was introduced.
    // Legacy codes without an issuance timestamp must be requested again.
    [`${prefix}RequestedAt`]: mongoose.trusted({
      $gt: Math.max(0, timestamp - OTP_TTL_MS), $lte: timestamp,
    }),
  };
}

export function otpMatches(expected, submitted) {
  if (typeof expected !== "string" || typeof submitted !== "string" ||
      !/^\d{6}$/.test(expected) || !/^\d{6}$/.test(submitted)) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(submitted));
}

// Admission is a single database increment, so concurrent requests and separate
// server processes share the same five-attempt budget. No code comparison or
// password hashing happens before an attempt has been admitted.
export async function reserveOtpAttempt(identity, kind, {
  users = userModel, now = Date.now,
} = {}) {
  const prefix = otpPrefix(kind);
  const timestamp = now();
  const attempts = `${prefix}Attempts`;
  const user = await users.findOneAndUpdate({
    ...identity,
    ...activeCodeFilter(prefix, timestamp),
    ...(kind === "verification" ? { isAccountVerified: mongoose.trusted({ $ne: true }) } : {}),
    $or: [
      { [attempts]: mongoose.trusted({ $lt: OTP_MAX_ATTEMPTS }) },
      { [attempts]: mongoose.trusted({ $exists: false }) },
    ],
  }, { $inc: { [attempts]: 1 } }, { returnDocument: "after" });

  if (user) return { success: true, user };

  const current = await users.findOne(identity);
  if (current && current[attempts] >= OTP_MAX_ATTEMPTS &&
      current[`${prefix}ExpireAt`] > timestamp &&
      current[`${prefix}RequestedAt`] > Math.max(0, timestamp - OTP_TTL_MS)) {
    return {
      success: false, status: 429,
      message: "Too many OTP attempts. Request a new code.",
    };
  }
  return invalidOtp();
}

// Consume the reserved generation and apply the account change in one write.
// A resend, another successful submission, or expiry makes this write fail.
export async function consumeOtpAttempt(user, kind, accountChanges, {
  users = userModel, now = Date.now,
} = {}) {
  const prefix = otpPrefix(kind);
  const generation = `${prefix}Generation`;
  const timestamp = now();
  const updated = await users.findOneAndUpdate({
    _id: user._id,
    email: user.email,
    ...activeCodeFilter(prefix, timestamp),
    [prefix]: user[prefix],
    [`${prefix}ExpireAt`]: mongoose.trusted({ $eq: user[`${prefix}ExpireAt`], $gt: timestamp }),
    [`${prefix}RequestedAt`]: mongoose.trusted({
      $eq: user[`${prefix}RequestedAt`], $gt: Math.max(0, timestamp - OTP_TTL_MS), $lte: timestamp,
    }),
    [generation]: user[generation] || mongoose.trusted({ $exists: false }),
    ...(kind === "verification"
      ? { isAccountVerified: mongoose.trusted({ $ne: true }) }
      : { password: user.password }),
  }, {
    $set: {
      ...accountChanges,
      [prefix]: "",
      [`${prefix}ExpireAt`]: 0,
      [`${prefix}Attempts`]: 0,
      [generation]: "",
    },
    $unset: { [`emailJobs.${kind}`]: "" },
  }, { returnDocument: "after", runValidators: true });
  return updated ? { success: true } : invalidOtp();
}
