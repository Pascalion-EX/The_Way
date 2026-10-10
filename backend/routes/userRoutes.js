import express from "express";
import userAuth, { authenticateUser } from "../middleware/userAuth.js";
import { getUserData, updateProfile } from "../controllers/userController.js";

const userRouter = express.Router();

userRouter.get('/data', authenticateUser, getUserData);
userRouter.put("/update-profile", userAuth, updateProfile);

export default userRouter;
