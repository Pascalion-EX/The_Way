export const PROTECTED_ACCOUNT_ROLE_PATTERNS = [/^\s*pascal\s*$/i, /^\s*pamela\s*$/i];

export function hasProtectedAccountRole(role) {
  const roles = Array.isArray(role) ? role : [role];
  return roles.some((value) => typeof value === "string" &&
    PROTECTED_ACCOUNT_ROLE_PATTERNS.some((pattern) => pattern.test(value)));
}
