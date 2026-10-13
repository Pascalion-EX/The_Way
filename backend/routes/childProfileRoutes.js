import { createChildProfile,
     getAllChildProfiles,
     getChildProfileById,
     getChildrenByGrade,
     updateChildProfile,
     deleteChildProfile,
    } from "../controllers/childProfileController.js";
import userAuth from "../middleware/userAuth.js";
import { requireStaff } from "../middleware/staffAuth.js";
import express from "express";

const childProfileRouter = express.Router();

childProfileRouter.use(userAuth, requireStaff);

childProfileRouter.get("/", getAllChildProfiles);
childProfileRouter.post("/", createChildProfile);
childProfileRouter.get("/:id", getChildProfileById);
childProfileRouter.get("/grade/:grade", getChildrenByGrade);
childProfileRouter.put("/:id", updateChildProfile);
childProfileRouter.delete("/:id", deleteChildProfile);

export default childProfileRouter;
