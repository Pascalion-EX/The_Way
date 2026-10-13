import express from "express";

import {
  createNotification,
  sendNotificationToRole,
  getMyNotifications,
  getUnseenNotifications,
  markNotificationAsSeen,
  markAllNotificationsAsSeen,
  deleteNotification,
  deleteNotificationsByRoles,
} from "../controllers/notificationController.js";

import userAuth from "../middleware/userAuth.js";
import { requireStaff } from "../middleware/staffAuth.js";

const notificationRouter = express.Router();

notificationRouter.get(
  "/",
  userAuth,
  getMyNotifications
);

notificationRouter.get(
  "/unseen",
  userAuth,
  getUnseenNotifications
);

notificationRouter.post(
  "/",
  userAuth,
  requireStaff,
  createNotification
);

notificationRouter.put(
  "/clear/roles",
  userAuth,
  requireStaff,
  deleteNotificationsByRoles
);

notificationRouter.post(
  "/role/:role",
  userAuth,
  requireStaff,
  sendNotificationToRole
);

notificationRouter.put(
  "/:id/seen",
  userAuth,
  markNotificationAsSeen
);

notificationRouter.put(
  "/seen/all",
  userAuth,
  markAllNotificationsAsSeen
);

notificationRouter.delete(
  "/:id",
  userAuth,
  requireStaff,
  deleteNotification
);

export default notificationRouter;
