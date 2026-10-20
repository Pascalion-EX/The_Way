const STAFF = ["admin", "leader", "pascal", "pamela"];
const restrictedPages = [
  [/^\/admin\/?$/i, ["admin", "pascal", "pamela"]],
  [/^\/(attendance|childrenProfile|video-requests)\/?$/i, STAFF],
  [/^\/create-(lesson|camp|game|chant|activity)\/?$/i, STAFF],
  [/^\/(lessons|games|chants|activities)\/[^/]+\/edit\/?$/i, STAFF],
  [/^\/events\/(create|[^/]+\/edit)\/?$/i, STAFF],
  [/^\/edit-chant\/[^/]+\/?$/i, STAFF],
];

export function pageAccessRoles(pathname) {
  if (typeof pathname !== "string") return null;
  try {
    // Match React Router's case-insensitive, decoded path segments.
    const path = pathname.split("/").map((part) => decodeURIComponent(part).replace(/\//g, "%2F")).join("/");
    return restrictedPages.find(([pattern]) => pattern.test(path))?.[1] || null;
  } catch {
    return null;
  }
}

export function canAccessPage(pathname, role) {
  const required = pageAccessRoles(pathname);
  const roles = Array.isArray(role) ? role : [role];
  return !required || roles.some((value) => required.includes(value));
}
