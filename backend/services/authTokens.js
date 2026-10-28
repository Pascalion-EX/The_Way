import jwt from "jsonwebtoken";
import { AUTH_TOKEN_TTL_SECONDS } from "../config/authCookie.js";
import { getSecrets } from "../config/secrets.js";

export const issueAuthToken = (user) => jwt.sign(
  { id: String(user._id), tokenVersion: user.tokenVersion ?? 0 },
  getSecrets().jwtSecret,
  { algorithm: "HS256", expiresIn: AUTH_TOKEN_TTL_SECONDS }
);

export const verifyAuthToken = (token) => {
  const claims = jwt.verify(token, getSecrets().jwtSecret, { algorithms: ["HS256"] });
  // Reject legacy tokens without a revocation version, as well as malformed claims.
  if (typeof claims?.id !== "string" || !/^[a-fA-F0-9]{24}$/.test(claims.id) ||
      !Number.isSafeInteger(claims.tokenVersion) || claims.tokenVersion < 0) {
    return null;
  }
  return claims;
};
