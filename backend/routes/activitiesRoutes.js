import express from "express";
import {
  createActivity,
  getAllActivities,
  getActivityById,
  updateActivity,
  deleteActivity,
} from "../controllers/activitiesController.js";

import userAuth from "../middleware/userAuth.js";

const activityRouter = express.Router();

activityRouter.post("/", userAuth, createActivity);
activityRouter.get("/",userAuth,  getAllActivities);
activityRouter.get("/:id",userAuth,  getActivityById);
activityRouter.put("/:id", userAuth, updateActivity);
activityRouter.delete("/:id", userAuth, deleteActivity);

export default activityRouter;