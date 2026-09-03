import express from "express";

import {
  getEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
} from "../controllers/eventController.js";

import userAuth  from "../middleware/userAuth.js";
import { eventAdminOnly } from "../middleware/eventPermission.js";

const eventRouter = express.Router();

eventRouter.get("/", userAuth, getEvents);

eventRouter.get("/:id", userAuth, getEventById);

eventRouter.post(
  "/",
  userAuth,
  eventAdminOnly,
  createEvent
);

eventRouter.put(
  "/:id",
  userAuth,
  eventAdminOnly,
  updateEvent
);

eventRouter.delete(
  "/:id",
  userAuth,
  eventAdminOnly,
  deleteEvent
);

export default eventRouter;