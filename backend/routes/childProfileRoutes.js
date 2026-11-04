import { createChildProfile,
     getAllChildProfiles,
     getChildProfileById,
     getChildrenByGrade,
     updateChildProfile,
     deleteChildProfile,
    } from "../controllers/childProfileController.js";
import userAuth from "../middleware/userAuth.js";
import { requireChildProfileAccess, requireChildProfileManagement } from "../middleware/childProfileAuth.js";
import express from "express";

const childProfileRouter = express.Router();

childProfileRouter.use(userAuth, requireChildProfileAccess);

childProfileRouter.get("/", getAllChildProfiles);
childProfileRouter.post("/", createChildProfile);
childProfileRouter.get("/:id", getChildProfileById);
childProfileRouter.get("/grade/:grade", getChildrenByGrade);
childProfileRouter.put("/:id", requireChildProfileManagement, updateChildProfile);
childProfileRouter.delete("/:id", requireChildProfileManagement, deleteChildProfile);

export default childProfileRouter;
