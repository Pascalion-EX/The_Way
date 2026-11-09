export const NOTIFICATION_ROLES = [
  "admin", "servant", "pascal", "pamela", "parent", "child", "unAssined",
];

export function normalizeNotificationRole(role) {
  if (!role) return null;
  const normalized = String(role).trim().toLowerCase();
  if (normalized === "leader") return "servant";
  if (normalized === "unassigned" || normalized === "unassined") return "unAssined";
  return normalized;
}

export function normalizeNotificationRoles(roles) {
  const values = Array.isArray(roles) ? roles : [roles];
  return [...new Set(values.map(normalizeNotificationRole).filter(Boolean))];
}

// Read and clear old audiences until the bulk migration has rewritten them.
// These are notification audiences only; staff authorization stays separate.
export function notificationAudienceRoles(roles) {
  const normalized = normalizeNotificationRoles(roles);
  return normalized.includes("servant") ? [...normalized, "leader"] : normalized;
}
