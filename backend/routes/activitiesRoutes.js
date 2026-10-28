import express from "express";
import {
  createActivity,
  getAllActivities,
  getActivityById,
  updateActivity,
  deleteActivity,
} from "../controllers/activitiesController.js";

import userAuth from "../middleware/userAuth.js";
import { validateActivityVideoUrl } from "../middleware/validateVideoUrl.js";
import { requireStaff } from "../middleware/staffAuth.js";
import { requireYearOneToThreeActivities } from "../middleware/activityScheduleAuth.js";
import { getYearOneToThreeSchedule, saveYearOneToThreeActivity } from "../controllers/activityScheduleController.js";

const activityRouter = express.Router();

activityRouter.get("/year-1-3/schedule", userAuth, requireStaff, requireYearOneToThreeActivities, getYearOneToThreeSchedule);
activityRouter.put("/year-1-3/schedule/:date", userAuth, requireStaff, requireYearOneToThreeActivities, saveYearOneToThreeActivity);

activityRouter.post("/", userAuth, validateActivityVideoUrl, createActivity);
activityRouter.get("/",userAuth,  getAllActivities);
activityRouter.get("/:id",userAuth,  getActivityById);
activityRouter.put("/:id", userAuth, validateActivityVideoUrl, updateActivity);
activityRouter.delete("/:id", userAuth, deleteActivity);

export default activityRouter;
