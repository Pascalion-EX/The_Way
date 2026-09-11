import userModel from "../models/userModel.js";

const VIDEO_REQUEST_ROLES = [
  "Pamela",
  "leader",
  "pascal",
  "admin",
];


// ============================================================
// Helper
// Convert role into an array
// Supports:
// role: "pascal"
// role: ["leader", "pascal"]
// ============================================================

const normalizeRoles = (role) => {
  if (!role) {
    return [];
  }

  return Array.isArray(role)
    ? role
    : [role];
};


// ============================================================
// VIDEO REQUEST USER ACCESS
//
// Allowed:
// Pamela
// leader
// pascal
// admin
//
// Used for:
// - Creating requests
// - Viewing own requests
// ============================================================

export const videoRequestUserOnly = async (
  req,
  res,
  next
) => {
  try {
    if (!req.userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }


    const user = await userModel
      .findById(req.userId)
      .select("role");


    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }


    const roles = normalizeRoles(user.role);


    const hasAccess = roles.some((role) =>
      VIDEO_REQUEST_ROLES.includes(role)
    );


    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to access video editing requests.",
      });
    }


    // Optional:
    // Attach user to req so later middleware/controllers
    // can use it without another database query.

    req.user = user;

    next();

  } catch (error) {
    console.error(
      "Video request authorization error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// ============================================================
// PASCAL ONLY
//
// Used for:
// - Viewing ALL requests
// - Viewing specific requests
// - Updating status
// - Adding notes
// - Deleting requests
// ============================================================

export const pascalOnly = async (
  req,
  res,
  next
) => {
  try {
    if (!req.userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }


    const user = await userModel
      .findById(req.userId)
      .select("role");


    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }


    const roles = normalizeRoles(user.role);


    const hasPascalRole =
      roles.includes("pascal");


    if (!hasPascalRole) {
      return res.status(403).json({
        success: false,
        message:
          "Only Pascal users can manage video editing requests.",
      });
    }


    req.user = user;

    next();

  } catch (error) {
    console.error(
      "Pascal authorization error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};