import express from "express";
import {
  getAdminDashboard,
  deleteUserByAdmin,
} from "../controllers/adminController.js";
import userAuth from "../middleware/userAuth.js";

const adminRouter = express.Router();

adminRouter.get("/dashboard", userAuth, getAdminDashboard);
adminRouter.delete("/users/:id", userAuth, deleteUserByAdmin);

export default adminRouter;