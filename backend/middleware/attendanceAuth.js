import { canAccessAllAttendanceClasses } from "../../shared/attendanceAccess.mjs";

// requireStaff supplies the current database identity, including its assigned class.
export const requireAttendanceAccess = (req, res, next) => {
  const user = req.staffUser;
  if (user && canAccessAllAttendanceClasses(user.role)) {
    req.attendanceAccess = { allClasses: true, grade: null };
    return next();
  }

  const roles = Array.isArray(user?.role) ? user.role : [user?.role];
  if (roles.includes("leader") && Number.isInteger(user.class) && user.class >= 1 && user.class <= 12) {
    req.attendanceAccess = { allClasses: false, grade: user.class };
    return next();
  }

  return res.status(403).json({
    success: false,
    code: "ATTENDANCE_CLASS_REQUIRED",
    message: "You need an assigned class to take attendance. Please contact an administrator.",
  });
};
