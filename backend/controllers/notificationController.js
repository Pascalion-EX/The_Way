// controllers/notificationController.js

import notificationModel from "../models/notificationModel.js";
import userModel from "../models/userModel.js";

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

    if (!url) {
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
        message: "At least one target role is required",
      });
    }

    const allowedRoles = [
      "admin",
      "leader",
      "pascal",
      "Pamela",
      "parent",
      "child",
      "unAssined",
    ];

    const invalidRoles = targetRoles.filter(
      (role) => !allowedRoles.includes(role)
    );

    if (invalidRoles.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid roles: ${invalidRoles.join(", ")}`,
      });
    }

    const notification = await notificationModel.create({
      title: title || "New Notification",
      message: message || "",
      targetRoles,
      type: type || "None",
      url,
    });

    return res.status(201).json({
      success: true,
      message: "Notification sent successfully",
      notification,
    });
  } catch (error) {
    console.error("Create notification error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ======================================================
// SEND NOTIFICATION TO ONE SPECIFIC ROLE
// ======================================================
export const sendNotificationToRole = async (req, res) => {
  try {
    const { role } = req.params;

    const {
      title,
      message,
      type,
      url,
    } = req.body;

    const allowedRoles = [
      "admin",
      "leader",
      "pascal",
      "Pamela",
      "parent",
      "child",
      "unAssined",
    ];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid target role",
      });
    }

    if (!url) {
      return res.status(400).json({
        success: false,
        message: "Notification URL is required",
      });
    }

    const notification = await notificationModel.create({
      title: title || "New Notification",
      message: message || "",
      targetRoles: [role],
      type: type || "None",
      url,
    });

    return res.status(201).json({
      success: true,
      message: `Notification sent to ${role}`,
      notification,
    });
  } catch (error) {
    console.error("Send notification to role error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ======================================================
// GET NOTIFICATIONS FOR LOGGED-IN USER
// ======================================================
export const getMyNotifications = async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const user = await userModel
      .findById(userId)
      .select("role");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const userRoles = Array.isArray(user.role)
      ? user.role
      : [user.role];

    const notifications = await notificationModel
      .find({
        targetRoles: {
          $in: userRoles,
        },
      })
      .sort({
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,
      count: notifications.length,
      notifications,
    });
  } catch (error) {
    console.error("Get notifications error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ======================================================
// GET UNSEEN NOTIFICATIONS
// ======================================================
export const getUnseenNotifications = async (req, res) => {
  try {
    const userId = req.userId;

    const user = await userModel
      .findById(userId)
      .select("role");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const userRoles = Array.isArray(user.role)
      ? user.role
      : [user.role];

    const notifications = await notificationModel
      .find({
        targetRoles: {
          $in: userRoles,
        },

        seenBy: {
          $ne: userId,
        },
      })
      .sort({
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,
      count: notifications.length,
      notifications,
    });
  } catch (error) {
    console.error("Get unseen notifications error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
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

    const notification = await notificationModel.findByIdAndUpdate(
      id,
      {
        $addToSet: {
          seenBy: userId,
        },
      },
      {
        new: true,
      }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification marked as seen",
      notification,
    });
  } catch (error) {
    console.error("Mark notification seen error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ======================================================
// MARK ALL USER NOTIFICATIONS AS SEEN
// ======================================================
export const markAllNotificationsAsSeen = async (req, res) => {
  try {
    const userId = req.userId;

    const user = await userModel
      .findById(userId)
      .select("role");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const userRoles = Array.isArray(user.role)
      ? user.role
      : [user.role];

    await notificationModel.updateMany(
      {
        targetRoles: {
          $in: userRoles,
        },

        seenBy: {
          $ne: userId,
        },
      },

      {
        $addToSet: {
          seenBy: userId,
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: "All notifications marked as seen",
    });
  } catch (error) {
    console.error("Mark all notifications seen error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ======================================================
// DELETE NOTIFICATION
// ======================================================
export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    const notification =
      await notificationModel.findByIdAndDelete(id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification deleted successfully",
    });
  } catch (error) {
    console.error("Delete notification error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};