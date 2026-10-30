import { createHash, createHmac } from "node:crypto";
import jwt from "jsonwebtoken";
import { getSecrets } from "../config/secrets.js";
import { normalizeAuthEmail } from "./authEmail.js";

const audience = "the-way:email-unsubscribe";
const signingKey = () => {
  const secret = getSecrets().jwtSecret;
  if (!secret) throw new Error("JWT_SECRET is required for email unsubscribe links");
  // Unsubscribe capabilities must never be usable as authentication tokens.
  return createHmac("sha256", secret).update(audience).digest();
};

export function subscriptionEmailHash(email) {
  const normalized = normalizeAuthEmail(email);
  if (!normalized) return null;
  return createHash("sha256").update(normalized).digest("hex");
}

export function createUnsubscribeUrl(user) {
  const subject = String(user._id);
  const emailHash = subscriptionEmailHash(user.email);
  if (!/^[a-fA-F0-9]{24}$/.test(subject) || !emailHash) throw new Error("Invalid email subscriber");
  const origin = process.env.APP_ORIGIN || "http://localhost:4000";
  const base = new URL(origin);
  if (!["https:", "http:"].includes(base.protocol) || base.origin !== origin) {
    throw new Error("APP_ORIGIN must be a web origin for unsubscribe links");
  }
  const url = new URL("/api/email/unsubscribe", base);
  url.searchParams.set("token", jwt.sign({ emailHash }, signingKey(), {
    algorithm: "HS256", audience, subject, expiresIn: "365d",
  }));
  return url.href;
}

export function verifyUnsubscribeToken(token) {
  if (typeof token !== "string" || token.length > 2048) return null;
  try {
    const claims = jwt.verify(token, signingKey(), { algorithms: ["HS256"], audience });
    if (typeof claims.sub !== "string" || !/^[a-fA-F0-9]{24}$/.test(claims.sub) ||
        typeof claims.emailHash !== "string" || !/^[a-f0-9]{64}$/.test(claims.emailHash)) return null;
    return claims;
  } catch {
    return null;
  }
}
