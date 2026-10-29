const STAFF = ["admin", "leader", "pascal", "pamela"];
const CHILD_PROFILE_ROLES = ["pascal", "pamela"];
const restrictedPages = [
  [/^\/admin\/?$/i, ["admin", "pascal", "pamela"]],
  [/^\/activities\/year-1-3\/?$/i, STAFF, canAccessYearOneToThreeActivities],
  [/^\/childrenProfile\/?$/i, CHILD_PROFILE_ROLES],
  [/^\/(attendance|video-requests)\/?$/i, STAFF],
  [/^\/create-(lesson|camp|game|chant|activity)\/?$/i, STAFF],
  [/^\/(lessons|games|chants|activities)\/[^/]+\/edit\/?$/i, STAFF],
  [/^\/events\/(create|[^/]+\/edit)\/?$/i, STAFF],
  [/^\/edit-chant\/[^/]+\/?$/i, STAFF],
];

export function canAccessChildrenProfiles(role) {
  const roles = Array.isArray(role) ? role : [role];
  return roles.some((value) => CHILD_PROFILE_ROLES.includes(value));
}

export function canAccessYearOneToThreeActivities(role, assignedClass) {
  const roles = Array.isArray(role) ? role : [role];
  return roles.some((value) => ["admin", "pascal", "pamela"].includes(value)) ||
    (roles.includes("leader") && Number.isInteger(assignedClass) && assignedClass >= 1 && assignedClass <= 3);
}

function findPageRule(pathname) {
  if (typeof pathname !== "string") return null;
  try {
    // Match React Router's case-insensitive, decoded path segments.
    const path = pathname.split("/").map((part) => decodeURIComponent(part).replace(/\//g, "%2F")).join("/");
    return restrictedPages.find(([pattern]) => pattern.test(path)) || null;
  } catch {
    return null;
  }
}

export function pageAccessRoles(pathname) {
  return findPageRule(pathname)?.[1] || null;
}

export function canAccessPage(pathname, role, assignedClass) {
  const rule = findPageRule(pathname);
  if (!rule) return true;
  if (rule[2]) return rule[2](role, assignedClass);
  const roles = Array.isArray(role) ? role : [role];
  return roles.some((value) => rule[1].includes(value));
}
