import { canAccessChildrenProfiles, canManageChildrenProfiles } from "../../shared/pageAccess.mjs";
import { getRequestIdentity } from "../services/requestIdentity.js";

// userAuth supplies the current verified database identity.
export function requireChildProfileAccess(req, res, next) {
  const user = getRequestIdentity(req);
  if (!user) {
    return res.status(401).json({ success: false, message: "Not authorized. Please log in again." });
  }
  if (canAccessChildrenProfiles(user.role)) {
    req.childProfileUser = user;
    req.childProfileFilter = canManageChildrenProfiles(user.role) ? {} : { createdBy: req.userId };
    return next();
  }
  return res.status(403).json({
    success: false,
    code: "CHILD_PROFILE_ACCESS_REQUIRED",
    message: "Children Profile is available to parents, Pamela, and Pascal users.",
  });
}

export function requireChildProfileManagement(req, res, next) {
  if (canManageChildrenProfiles(req.childProfileUser?.role)) return next();
  return res.status(403).json({
    success: false,
    code: "CHILD_PROFILE_ACCESS_REQUIRED",
    message: "Only Pamela and Pascal can edit or delete child profiles.",
  });
}
