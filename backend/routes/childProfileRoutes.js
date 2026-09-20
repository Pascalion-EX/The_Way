import { createChildProfile,
     getAllChildProfiles,
     getChildProfileById,
     getChildrenByGrade,
     updateChildProfile,
     deleteChildProfile,
    } from "../controllers/childProfileController.js";
import userAuth from "../middleware/userAuth.js";
import express from "express";

const childProfileRouter = express.Router();

childProfileRouter.get("/", userAuth, getAllChildProfiles);
childProfileRouter.post("/", userAuth, createChildProfile);
childProfileRouter.get("/:id", userAuth, getChildProfileById);
childProfileRouter.get("/grade/:grade", userAuth, getChildrenByGrade);
childProfileRouter.put("/:id", userAuth, updateChildProfile);
childProfileRouter.delete("/:id", userAuth, deleteChildProfile);

export default childProfileRouter;
