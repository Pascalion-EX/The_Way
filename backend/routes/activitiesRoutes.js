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

const activityRouter = express.Router();

activityRouter.post("/", userAuth, validateActivityVideoUrl, createActivity);
activityRouter.get("/",userAuth,  getAllActivities);
activityRouter.get("/:id",userAuth,  getActivityById);
activityRouter.put("/:id", userAuth, validateActivityVideoUrl, updateActivity);
activityRouter.delete("/:id", userAuth, deleteActivity);

export default activityRouter;
