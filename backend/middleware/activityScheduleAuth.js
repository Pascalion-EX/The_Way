import { canAccessYearOneToThreeActivities } from "../../shared/pageAccess.mjs";

// requireStaff supplies the current database identity, including the assigned class.
export function requireYearOneToThreeActivities(req, res, next) {
  const user = req.staffUser;
  if (user && canAccessYearOneToThreeActivities(user.role, user.class)) return next();
  return res.status(403).json({
    success: false,
    message: "Year 1–3 activities are available only to servants assigned to classes 1–3, admins, Pascal, and Pamela users.",
  });
}
