import { createAuthRateLimit, AUTH_RATE_WINDOW_MS } from "./authRateLimit.js";
import { normalizeAuthEmail } from "../services/authEmail.js";

export const OTP_RATE_WINDOW_MS = AUTH_RATE_WINDOW_MS;
export const createOtpRateLimit = (options) => createAuthRateLimit({
  code: "OTP_RATE_LIMITED",
  message: "Too many code requests or attempts. Please try again later.",
  unavailableMessage: "Unable to process code requests. Please try again later.",
  ...options,
});

export { authIpRateLimit as otpIpRateLimit } from "./authRateLimit.js";

export const verificationAccountRateLimit = createOtpRateLimit({
  scope: "otp-verification-account", limit: 15, key: (req) => req.userId,
});

export const recoveryAccountRateLimit = createOtpRateLimit({
  scope: "otp-recovery-account", limit: 15,
  key: (req) => normalizeAuthEmail(req.body?.email),
});
