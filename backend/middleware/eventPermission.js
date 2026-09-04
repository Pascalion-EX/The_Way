import userModel from "../models/userModel.js";

export const eventAdminOnly = async (req, res, next) => {
  try {
    const allowedRoles = ["pascal", "admin", "leader", "pamela"];

    if (!req.userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const user = await userModel.findById(req.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    const userRoles = Array.isArray(user.role)
      ? user.role
      : [user.role];

    const hasPermission = userRoles.some((role) =>
      allowedRoles.includes(role)
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to manage events",
      });
    }

    next();
  } catch (error) {
    console.error("Event permission error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to check event permissions",
    });
  }
};