import "./environment.js";

// Runtime values only. Do not log this object or send it to the browser.
// Read on each call so callers do not retain an import-time credential snapshot.
export function getSecrets(env = process.env) {
  return {
    jwtSecret: env.JWT_SECRET,
    mongodbUrl: env.MONGODB_URL,
    mongoAppPassword: env.MONGO_APP_PASSWORD,
    smtpUser: env.SMTP_USER,
    smtpPass: env.SMTP_PASS,
    senderEmail: env.SENDER_EMAIL,
    videoRequestEmail: env.VIDEO_REQUEST_EMAIL,
  };
}
