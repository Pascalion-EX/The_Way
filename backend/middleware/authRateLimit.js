import { createHash } from "node:crypto";
import { isIP } from "node:net";
import AuthRateLimit from "../models/authRateLimitModel.js";
import User from "../models/userModel.js";
import { normalizeAuthEmail } from "../services/authEmail.js";

export const AUTH_RATE_WINDOW_MS = 15 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const createAuthRateLimit = ({
  scope, limit, key, windowMs = AUTH_RATE_WINDOW_MS, cost = () => 1,
  counters = AuthRateLimit, now = () => Date.now(),
  code = "AUTH_RATE_LIMITED",
  message = "Too many authentication requests. Please try again later.",
  unavailableMessage = "Unable to process authentication requests. Please try again later.",
}) => async (req, res, next) => {
  try {
    const subject = await key(req);
    if (typeof subject !== "string" || !subject || subject.length > 254) {
      return res.status(400).json({ success: false, message: "Invalid authentication request." });
    }
    const increment = cost(req);
    if (!Number.isSafeInteger(increment) || increment < 1) throw new Error("Invalid rate cost");
    const timestamp = now();
    const bucket = Math.floor(timestamp / windowMs);
    const expiresAt = (bucket + 1) * windowMs;
    // No raw email addresses or client IPs are persisted in the counter store.
    const id = createHash("sha256").update(`${scope}\0${subject}\0${bucket}`).digest("hex");
    let counter;
    try {
      counter = await counters.findOneAndUpdate({ _id: id }, {
        $inc: { count: increment }, $setOnInsert: { expiresAt: new Date(expiresAt) },
      }, { upsert: true, returnDocument: "after", setDefaultsOnInsert: false });
    } catch (error) {
      // Concurrent first inserts can collide on _id; increment the winning row.
      if (error?.code !== 11000) throw error;
      counter = await counters.findOneAndUpdate({ _id: id }, { $inc: { count: increment } }, { returnDocument: "after" });
    }
    if (!counter || !Number.isSafeInteger(counter.count) || counter.count < increment) throw new Error("Invalid rate counter");
    if (counter.count > limit) {
      const retryAfter = Math.max(1, Math.ceil((expiresAt - timestamp) / 1000));
      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({ success: false, code, retryAfter, message });
    }
    return next();
  } catch {
    res.set("Retry-After", "60");
    return res.status(503).json({ success: false, message: unavailableMessage });
  }
};

export const authIpKey = (req) => {
  // req.ip honors forwarded headers only when Express explicitly trusts a proxy.
  const ip = req.ip || req.socket?.remoteAddress || "unknown-peer";
  if (isIP(ip) !== 6) return ip;
  // Canonicalize IPv6 and share a /64 budget against interface-address rotation.
  const canonical = new URL(`http://[${ip}]/`).hostname.slice(1, -1);
  const parts = canonical.split(":");
  if (canonical.startsWith("::ffff:") && parts.length === 5) {
    const high = parseInt(parts[3], 16);
    const low = parseInt(parts[4], 16);
    return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
  }
  const [left, right = ""] = canonical.split("::");
  const start = left ? left.split(":") : [];
  const end = right ? right.split(":") : [];
  const groups = canonical.includes("::") ? [...start, ...Array(8 - start.length - end.length).fill("0"), ...end] : start;
  return `${groups.slice(0, 4).map((part) => parseInt(part, 16).toString(16)).join(":")}::/64`;
};

const ipLimit = (scope, limit, windowMs) => createAuthRateLimit({ scope, limit, windowMs, key: authIpKey });
const globalLimit = (scope, limit, windowMs) => createAuthRateLimit({ scope, limit, windowMs, key: () => "all" });

export const authIpRateLimit = ipLimit("auth-ip", 100, AUTH_RATE_WINDOW_MS);
// An already-blocked peer must not consume the service-wide allowance.
export const authRequestRateLimits = [authIpRateLimit, globalLimit("auth-global", 1000, 60_000)];
export const loginRateLimits = [
  ipLimit("login-ip", 30, AUTH_RATE_WINDOW_MS),
  createAuthRateLimit({ scope: "login-account", limit: 10, key: (req) => normalizeAuthEmail(req.body?.email) }),
];
export const registrationRateLimits = [
  ipLimit("registration-ip-hour", 5, HOUR),
  ipLimit("registration-ip-day", 20, DAY),
  globalLimit("registration-global-hour", 100, HOUR),
  globalLimit("registration-global-day", 500, DAY),
  createAuthRateLimit({ scope: "registration-email", limit: 3, windowMs: HOUR, key: (req) => normalizeAuthEmail(req.body?.email) }),
];

const resolveEmailRecipient = async (req, res, next) => {
  try {
    const email = req.userId ? (await User.findById(req.userId).select("email"))?.email : req.body?.email;
    req.abuseEmailRecipient = normalizeAuthEmail(email);
    if (!req.abuseEmailRecipient) return res.status(400).json({ success: false, message: "A valid email address is required" });
    return next();
  } catch {
    res.set("Retry-After", "60");
    return res.status(503).json({ success: false, message: "Unable to process email requests. Please try again later." });
  }
};

// Registration queues two messages. Reserve both before any account write.
// Failed/rejected requests conservatively retain reservations until expiry.
const emailCost = (req) => req.route.path === "/register" ? 2 : 1;
const emailLimit = (scope, limit, windowMs, key) => createAuthRateLimit({
  scope, limit, windowMs, key, cost: emailCost, code: "EMAIL_RATE_LIMITED",
  message: "Too many email requests. Please try again later.",
});
export const emailDeliveryRateLimits = [
  resolveEmailRecipient,
  emailLimit("email-ip-hour", 20, HOUR, authIpKey),
  emailLimit("email-ip-day", 50, DAY, authIpKey),
  emailLimit("email-recipient-hour", 5, HOUR, (req) => req.abuseEmailRecipient),
  emailLimit("email-recipient-day", 10, DAY, (req) => req.abuseEmailRecipient),
  emailLimit("email-global-hour", 200, HOUR, () => "all"),
  emailLimit("email-global-day", 1000, DAY, () => "all"),
];
