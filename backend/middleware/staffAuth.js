import { denyAccess } from "../services/accessDenials.js";
import userModel from "../models/userModel.js";

const STAFF_ROLES = new Set(["admin", "leader", "pascal", "pamela"]);

// Read current permissions from the database, never from request data or JWT claims.
export const requireStaff = async (req, res, next) => {
  try {
    if (!req.userId) {
      return res.status(401).json({
        success: false,
        message: "Not authorized. Please log in again.",
      });
    }

    const user = await userModel.findById(req.userId).select("role isAccountVerified");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found. Please log in again.",
      });
    }

    if (!user.isAccountVerified) {
      return res.status(403).json({
        success: false,
        code: "EMAIL_VERIFICATION_REQUIRED",
        message: "Please verify your email before using the site.",
        redirectTo: "/email-verify",
      });
    }

    const roles = Array.isArray(user.role) ? user.role : [user.role];

    if (!roles.some((role) => STAFF_ROLES.has(role))) {
      return await denyAccess(req, res, {
        success: false,
        code: "STAFF_ACCESS_REQUIRED",
        message: "Staff access required.",
      });
    }

    return next();
  } catch {
    return res.status(500).json({
      success: false,
      message: "Unable to check staff permissions.",
    });
  }
};
