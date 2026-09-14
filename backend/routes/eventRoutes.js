import express from "express";

import {
  getEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
} from "../controllers/eventController.js";
import {
  seedCopticCalendar,
} from "../controllers/copticCalendarController.js";

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
eventRouter.post(
  "/seed-coptic-calendar",
  userAuth,
  eventAdminOnly,
  seedCopticCalendar
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