export const canAccessAllAttendanceClasses = (role) => {
  const roles = Array.isArray(role) ? role : [role];
  return roles.some((value) => ["admin", "pascal", "pamela"].includes(value));
};
