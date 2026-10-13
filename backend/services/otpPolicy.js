export const OTP_TTL_MS = 10 * 60_000;
export const OTP_MAX_ATTEMPTS = 5;

export function otpPrefix(kind) {
  if (kind === "verification") return "verifyOtp";
  if (kind === "passwordReset") return "resetOtp";
  throw new Error("Invalid OTP kind");
}
