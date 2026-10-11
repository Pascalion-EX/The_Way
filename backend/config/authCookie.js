export const AUTH_TOKEN_TTL_SECONDS = 2 * 24 * 60 * 60;

export const getAuthCookieOptions = () => ({
  httpOnly: true,
  // Allow plain HTTP only through an explicit non-production development override.
  secure:
    process.env.NODE_ENV === "production" ||
    process.env.AUTH_COOKIE_SECURE !== "false",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
  path: "/",
});
