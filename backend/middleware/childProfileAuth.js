import { canAccessChildrenProfiles, canEditChildrenProfiles, canManageChildrenProfiles } from "../../shared/pageAccess.mjs";
import { getRequestIdentity } from "../services/requestIdentity.js";

// userAuth supplies the current verified database identity.
export function requireChildProfileAccess(req, res, next) {
  const user = getRequestIdentity(req);
  if (!user) {
    return res.status(401).json({ success: false, message: "Not authorized. Please log in again." });
  }
  if (canAccessChildrenProfiles(user.role)) {
    req.childProfileUser = user;
    req.childProfileFilter = canEditChildrenProfiles(user.role) ? {} : { createdBy: req.userId };
    return next();
  }
  return res.status(403).json({
    success: false,
    code: "CHILD_PROFILE_ACCESS_REQUIRED",
    message: "Children Profile is available to parents, leaders, admins, Pamela, and Pascal users.",
  });
}

export function requireChildProfileEditing(req, res, next) {
  if (canEditChildrenProfiles(req.childProfileUser?.role)) return next();
  return res.status(403).json({
    success: false,
    code: "CHILD_PROFILE_ACCESS_REQUIRED",
    message: "Only leaders, admins, Pamela, and Pascal can edit child profiles.",
  });
}

export function requireChildProfileManagement(req, res, next) {
  if (canManageChildrenProfiles(req.childProfileUser?.role)) return next();
  return res.status(403).json({
    success: false,
    code: "CHILD_PROFILE_ACCESS_REQUIRED",
    message: "Only admins, Pamela, and Pascal can delete child profiles.",
  });
}
