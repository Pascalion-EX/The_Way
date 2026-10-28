import "dotenv/config";
import { readFileSync } from "node:fs";

// Direct environment variables work with Compose/CI. Keep optional file loading
// for standalone containers that mount credentials instead.
for (const name of ["JWT_SECRET", "MONGODB_URL", "MONGO_APP_PASSWORD", "SMTP_PASS"]) {
  if (process.env[`${name}_FILE`]) {
    process.env[name] = readFileSync(process.env[`${name}_FILE`], "utf8").trim();
  }
}

export function validateEnvironment(env = process.env) {
  if (env.NODE_ENV !== "production") return;
  for (const name of ["JWT_SECRET", "APP_ORIGIN", "SMTP_HOST", "SMTP_USER", "SMTP_PASS", "SENDER_EMAIL", "VIDEO_REQUEST_EMAIL"]) {
    if (!env[name]?.trim()) throw new Error(`${name} is required in production`);
  }
  if (env.JWT_SECRET.length < 32) throw new Error("JWT_SECRET must have at least 32 characters");
  const origin = new URL(env.APP_ORIGIN);
  if (origin.protocol !== "https:" || origin.origin !== env.APP_ORIGIN) {
    throw new Error("APP_ORIGIN must be an HTTPS origin without a trailing slash or path");
  }
  if (!env.MONGODB_URL && !env.MONGO_APP_PASSWORD) throw new Error("Database credentials are required");
}
