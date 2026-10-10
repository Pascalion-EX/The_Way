import express from "express";
import {
  register,
  login,
  logout,
  sendVerifyotp,
  verifyEmail,
  isAuthenticated,
  sendResetOtp,
  resetPassword,
  checkAuth,
} from "../controllers/authController.js";
import { authenticateUser } from "../middleware/userAuth.js";

const authRouter = express.Router();

authRouter.post("/register", register);
authRouter.post("/login", login);
authRouter.get("/check-auth", authenticateUser, checkAuth);
authRouter.post("/logout", logout);
authRouter.post("/send-verify-otp", authenticateUser, sendVerifyotp);
authRouter.post("/verify-account", authenticateUser, verifyEmail);
authRouter.get("/is-auth", authenticateUser, isAuthenticated);
authRouter.post("/send-reset-otp", sendResetOtp);
authRouter.post("/reset-password", resetPassword);

export default authRouter;

