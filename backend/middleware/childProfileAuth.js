import { canAccessChildrenProfiles } from "../../shared/pageAccess.mjs";

// requireStaff supplies the current authenticated database identity.
export function requireChildProfileAccess(req, res, next) {
  if (canAccessChildrenProfiles(req.staffUser?.role)) return next();
  return res.status(403).json({
    success: false,
    code: "CHILD_PROFILE_ACCESS_REQUIRED",
    message: "Children Profile is available only to Pamela and Pascal users.",
  });
}
