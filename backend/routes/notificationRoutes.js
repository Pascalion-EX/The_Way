import express from "express";

import {
  createNotification,
  sendNotificationToRole,
  getMyNotifications,
  getUnseenNotifications,
  markNotificationAsSeen,
  markAllNotificationsAsSeen,
  deleteNotification,
} from "../controllers/notificationController.js";

import userAuth from "../middleware/userAuth.js";

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
  createNotification
);

notificationRouter.post(
  "/role/:role",
  userAuth,
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
  deleteNotification
);

export default notificationRouter;