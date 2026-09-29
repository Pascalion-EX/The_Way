// controllers/notificationController.js

import mongoose from "mongoose";
import notificationModel from "../models/notificationModel.js";
import userModel from "../models/userModel.js";

// ======================================================
// ALLOWED ROLES
// ======================================================

const allowedRoles = [
  "admin",
  "leader",
  "pascal",
  "pamela",
  "parent",
  "child",
  "unAssined",
];

// ======================================================
// ROLE HELPERS
// ======================================================

const normalizeRole = (role) => {
  if (!role) return null;

  const normalized = String(role).trim().toLowerCase();

  // Keep compatibility with your current schema values
  if (normalized === "pamela") {
    return "pamela";
  }

  if (
    normalized === "unassigned" ||
    normalized === "unassined"
  ) {
    return "unAssined";
  }

  return normalized;
};

const normalizeRoles = (roles) => {
  const roleArray = Array.isArray(roles)
    ? roles
    : [roles];

  return [
    ...new Set(
      roleArray
        .map(normalizeRole)
        .filter(Boolean)
    ),
  ];
};

const hasValidRoles = (roles) => {
  return roles.every((role) =>
    allowedRoles.includes(role)
  );
};

// ======================================================
// CREATE / SEND NOTIFICATION
// ======================================================

export const createNotification = async (req, res) => {
  try {
    const {
      title,
      message,
      targetRoles,
      type,
      url,
    } = req.body;

    if (!url || typeof url !== "string") {
      return res.status(400).json({
        success: false,
        message: "Notification URL is required",
      });
    }

    if (
      !targetRoles ||
      !Array.isArray(targetRoles) ||
      targetRoles.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "At least one target role is required",
      });
    }

    const normalizedTargetRoles =
      normalizeRoles(targetRoles);

    if (!hasValidRoles(normalizedTargetRoles)) {
      const invalidRoles =
        normalizedTargetRoles.filter(
          (role) => !allowedRoles.includes(role)
        );

      return res.status(400).json({
        success: false,
        message: `Invalid roles: ${invalidRoles.join(
          ", "
        )}`,
      });
    }

    const notification =
      await notificationModel.create({
        title:
          typeof title === "string" && title.trim()
            ? title.trim()
            : "New Notification",

        message:
          typeof message === "string"
            ? message.trim()
            : "",

        targetRoles: normalizedTargetRoles,

        type:
          typeof type === "string" && type.trim()
            ? type.trim()
            : "None",

        url: url.trim(),
      });

    return res.status(201).json({
      success: true,
      message: "Notification sent successfully",
      notification,
    });
  } catch (error) {
    console.error(
      "Create notification error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to create notification",
    });
  }
};

// ======================================================
// SEND NOTIFICATION TO ONE SPECIFIC ROLE
// ======================================================

export const sendNotificationToRole = async (
  req,
  res
) => {
  try {
    const { role } = req.params;

    const {
      title,
      message,
      type,
      url,
    } = req.body;

    const normalizedRole = normalizeRole(role);

    if (
      !normalizedRole ||
      !allowedRoles.includes(normalizedRole)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid target role",
      });
    }

    if (!url || typeof url !== "string") {
      return res.status(400).json({
        success: false,
        message: "Notification URL is required",
      });
    }

    const notification =
      await notificationModel.create({
        title:
          typeof title === "string" && title.trim()
            ? title.trim()
            : "New Notification",

        message:
          typeof message === "string"
            ? message.trim()
            : "",

        targetRoles: [normalizedRole],

        type:
          typeof type === "string" && type.trim()
            ? type.trim()
            : "None",

        url: url.trim(),
      });

    return res.status(201).json({
      success: true,
      message: `Notification sent to ${normalizedRole}`,
      notification,
    });
  } catch (error) {
    console.error(
      "Send notification to role error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to send notification",
    });
  }
};

// ======================================================
// GET LOGGED-IN USER
// INTERNAL HELPER
// ======================================================

const getLoggedInUser = async (userId) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return null;
  }

  return userModel
    .findById(userId)
    .select("role");
};

// ======================================================
// GET NOTIFICATIONS FOR LOGGED-IN USER
// ======================================================

export const getMyNotifications = async (
  req,
  res
) => {
  try {
    const userId = req.userId;

    const user = await getLoggedInUser(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const userRoles = normalizeRoles(user.role);

    /*
      mongoose.trusted() is required here because
      sanitizeFilter is enabled and $in is intentional.
    */
    const notifications =
      await notificationModel
        .find({
          targetRoles: mongoose.trusted({
            $in: userRoles,
          }),
        })
        .sort({
          createdAt: -1,
        });

    const formattedNotifications =
      notifications.map((notification) => {
        const notificationObject =
          notification.toObject();

        const isSeen =
          notification.seenBy?.some(
            (seenUserId) =>
              seenUserId.toString() ===
              userId.toString()
          ) ?? false;

        return {
          ...notificationObject,
          isSeen,
        };
      });

    return res.status(200).json({
      success: true,
      count: formattedNotifications.length,
      notifications: formattedNotifications,
    });
  } catch (error) {
    console.error(
      "Get notifications error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to get notifications",
    });
  }
};

// ======================================================
// GET UNSEEN NOTIFICATIONS
// ======================================================

export const getUnseenNotifications = async (
  req,
  res
) => {
  try {
    const userId = req.userId;

    const user = await getLoggedInUser(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const userRoles = normalizeRoles(user.role);

    const notifications =
      await notificationModel
        .find({
          targetRoles: mongoose.trusted({
            $in: userRoles,
          }),

          seenBy: mongoose.trusted({
            $ne: userId,
          }),
        })
        .sort({
          createdAt: -1,
        });

    const formattedNotifications =
      notifications.map((notification) => ({
        ...notification.toObject(),
        isSeen: false,
      }));

    return res.status(200).json({
      success: true,
      count: formattedNotifications.length,
      notifications: formattedNotifications,
    });
  } catch (error) {
    console.error(
      "Get unseen notifications error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to get unseen notifications",
    });
  }
};

// ======================================================
// MARK ONE NOTIFICATION AS SEEN
// ======================================================
export const markNotificationAsSeen = async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const notification =
      await notificationModel.findById(id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    /*
      Check whether user is already inside seenBy
    */
    const alreadySeen = notification.seenBy.some(
      (seenUserId) =>
        seenUserId.toString() === userId.toString()
    );

    /*
      Only add if not already present
    */
    if (!alreadySeen) {
      notification.seenBy.push(userId);

      await notification.save();
    }

    return res.status(200).json({
      success: true,
      message: "Notification marked as seen",

      notification: {
        ...notification.toObject(),
        isSeen: true,
      },
    });
  } catch (error) {
    console.error(
      "Mark notification as seen error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
// ======================================================
// MARK ALL USER NOTIFICATIONS AS SEEN
// ======================================================

export const markAllNotificationsAsSeen = async (
  req,
  res
) => {
  try {
    const userId = req.userId;

    const user = await getLoggedInUser(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const userRoles = normalizeRoles(user.role);

    const result =
      await notificationModel.updateMany(
        {
          targetRoles: mongoose.trusted({
            $in: userRoles,
          }),

          seenBy: mongoose.trusted({
            $ne: userId,
          }),
        },
        {
          $addToSet: {
            seenBy: userId,
          },
        }
      );

    return res.status(200).json({
      success: true,
      message:
        "All notifications marked as seen",
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error(
      "Mark all notifications seen error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to mark notifications as seen",
    });
  }
};

// ======================================================
// DELETE NOTIFICATION
// ======================================================

export const deleteNotification = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID",
      });
    }

    const notification =
      await notificationModel.findByIdAndDelete(
        id
      );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Notification deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete notification error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to delete notification",
    });
  }
};

export const deleteNotificationsByRoles = async (req, res) => {
  try {
    const { targetRoles } = req.body;

    if (
      !targetRoles ||
      !Array.isArray(targetRoles) ||
      targetRoles.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "At least one target role is required",
      });
    }

    const normalizedTargetRoles =
      normalizeRoles(targetRoles);

    if (!hasValidRoles(normalizedTargetRoles)) {
      return res.status(400).json({
        success: false,
        message: "One or more roles are invalid",
      });
    }

    /*
      Find notifications that contain at least
      one of the selected roles.
    */
    const notifications =
      await notificationModel.find({
        targetRoles: mongoose.trusted({
          $in: normalizedTargetRoles,
        }),
      });

    let deletedCount = 0;
    let updatedCount = 0;

    for (const notification of notifications) {
      /*
        Remove only the selected target roles.
      */
      notification.targetRoles =
        notification.targetRoles.filter(
          (role) =>
            !normalizedTargetRoles.includes(
              normalizeRole(role)
            )
        );

      /*
        If no roles remain, delete the whole
        notification.
      */
      if (
        notification.targetRoles.length === 0
      ) {
        await notification.deleteOne();

        deletedCount++;
      } else {
        await notification.save();

        updatedCount++;
      }
    }

    return res.status(200).json({
      success: true,
      message:
        "Notifications cleared for selected roles",
      deletedCount,
      updatedCount,
    });
  } catch (error) {
    console.error(
      "Delete notifications by roles error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to clear notifications",
    });
  }
};