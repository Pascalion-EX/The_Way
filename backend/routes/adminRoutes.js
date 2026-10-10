import express from "express";
import {
  getAdminDashboard,
  deleteUserByAdmin,
  updateUserRolesByAdmin,
  updateUserClassByAdmin,
} from "../controllers/adminController.js";
import userAuth from "../middleware/userAuth.js";

const adminRouter = express.Router();

adminRouter.get("/dashboard", userAuth, getAdminDashboard);
adminRouter.delete("/users/:id", userAuth, deleteUserByAdmin);
adminRouter.patch("/users/:id/roles", userAuth, updateUserRolesByAdmin);
adminRouter.patch("/users/:id/class", userAuth, updateUserClassByAdmin);

export default adminRouter;
