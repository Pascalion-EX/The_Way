import { createHash } from "node:crypto";
import AuthRateLimit from "../models/authRateLimitModel.js";

export const OTP_RATE_WINDOW_MS = 15 * 60 * 1000;

export const createOtpRateLimit = ({
  scope, limit, key, windowMs = OTP_RATE_WINDOW_MS,
  counters = AuthRateLimit, now = Date.now,
}) => async (req, res, next) => {
  const subject = key(req);
  if (typeof subject !== "string" || !subject || subject.length > 254) {
    return res.status(400).json({ success: false, message: "Invalid authentication request." });
  }

  const timestamp = now();
  const bucket = Math.floor(timestamp / windowMs);
  const expiresAt = (bucket + 1) * windowMs;
  // Do not persist raw email addresses or IPs in this collection.
  const id = createHash("sha256").update(`${scope}\0${subject}\0${bucket}`).digest("hex");

  try {
    let counter;
    try {
      counter = await counters.findOneAndUpdate({ _id: id }, {
        $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(expiresAt) },
      }, { upsert: true, returnDocument: "after", setDefaultsOnInsert: false });
    } catch (error) {
      // Concurrent first inserts can collide on _id; increment the winning row.
      if (error?.code !== 11000) throw error;
      counter = await counters.findOneAndUpdate({ _id: id }, { $inc: { count: 1 } }, { returnDocument: "after" });
    }

    if (!counter || !Number.isSafeInteger(counter.count) || counter.count < 1) {
      throw new Error("Invalid rate counter");
    }
    if (counter.count > limit) {
      const retryAfter = Math.max(1, Math.ceil((expiresAt - timestamp) / 1000));
      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({
        success: false, code: "OTP_RATE_LIMITED", retryAfter,
        message: "Too many code requests or attempts. Please try again later.",
      });
    }

    return next();
  } catch {
    res.set("Retry-After", "60");
    return res.status(503).json({ success: false, message: "Unable to process code requests. Please try again later." });
  }
};

export const otpIpRateLimit = createOtpRateLimit({
  scope: "otp-ip", limit: 100,
  // Express does not trust caller-supplied forwarded headers unless explicitly configured.
  key: (req) => req.ip || req.socket?.remoteAddress || "unknown-peer",
});

export const verificationAccountRateLimit = createOtpRateLimit({
  scope: "otp-verification-account", limit: 15,
  key: (req) => req.userId,
});

export const recoveryAccountRateLimit = createOtpRateLimit({
  scope: "otp-recovery-account", limit: 15,
  key: (req) => typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : null,
});
