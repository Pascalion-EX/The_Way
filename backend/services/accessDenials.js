import mongoose from "mongoose";
import userModel from "../models/userModel.js";
import { createEmailJob } from "./emailQueue.js";
import { normalizeAuthEmail } from "./authEmail.js";
import { getAuthCookieOptions } from "../config/authCookie.js";

export const ACCESS_DENIAL_LIMIT = 3;
export const BAN_REASON = "Three denied attempts to access restricted pages or resources.";

export function sendBannedResponse(res) {
  res.clearCookie("token", getAuthCookieOptions());
  return res.status(403).json({
    success: false, code: "ACCOUNT_BANNED",
    message: "Your account has been banned after three access denials. Please contact an administrator.",
  });
}

export async function recordAccessDenial(userId, { users = userModel, now = Date.now } = {}) {
  // Compare-and-swap keeps the counter, ban, mailbox flag, session revocation,
  // and notification in one atomic write, including across server processes.
  for (;;) {
    const user = await users.findById(userId).select("email accessDeniedCount isBanned");
    if (!user) return null;
    if (user.isBanned) return user;
    const count = user.accessDeniedCount || 0;
    const nextCount = Math.min(count + 1, ACCESS_DENIAL_LIMIT);
    const set = { accessDeniedCount: nextCount };
    const update = { $set: set };
    if (nextCount === ACCESS_DENIAL_LIMIT) {
      const email = normalizeAuthEmail(user.email);
      if (!email) throw new Error("Cannot flag an invalid account email");
      const timestamp = now();
      Object.assign(set, {
        isBanned: true, bannedAt: new Date(timestamp), banReason: BAN_REASON,
        emailFlagged: true, flaggedEmail: email,
        "emailJobs.ban": createEmailJob({
          to: email, subject: "The Way — Account banned",
          text: `Your account on The Way (${email}) has been banned after three denied attempts to access restricted pages or resources.\n\nIf you believe this was a mistake, please contact an administrator.`,
          expiresAt: timestamp + 7 * 24 * 60 * 60 * 1000,
        }),
        verifyOtp: "", resetOtp: "", verifyOtpExpireAt: 0, resetOtpExpireAt: 0,
      });
      update.$inc = { tokenVersion: 1 };
      update.$unset = { "emailJobs.welcome": "", "emailJobs.verification": "", "emailJobs.passwordReset": "" };
    }
    const updated = await users.findOneAndUpdate({
      _id: userId, email: user.email,
      isBanned: mongoose.trusted({ $ne: true }),
      accessDeniedCount: count === 0 ? mongoose.trusted({ $in: [0, null] }) : count,
    }, update, { returnDocument: "after", runValidators: true });
    if (updated) return updated;
    // Another denial or email change won the write. Re-read its current state.
  }
}

export async function denyAccess(req, res, body = {}) {
  if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required." });
  try {
    const user = await recordAccessDenial(req.userId);
    if (!user) return res.status(401).json({ success: false, message: "User not found. Please log in again." });
    if (user.isBanned) return sendBannedResponse(res);
    const remaining = ACCESS_DENIAL_LIMIT - user.accessDeniedCount;
    return res.status(403).json({
      ...body, success: false, code: body.code || "ACCESS_DENIED",
      message: `${body.message || "Access denied."} ${remaining} more denied ${remaining === 1 ? "attempt" : "attempts"} will ban your account.`,
      accessDeniedCount: user.accessDeniedCount, remainingAttempts: remaining,
    });
  } catch {
    return res.status(503).json({ success: false, message: "Unable to check access. Please try again later." });
  }
}
