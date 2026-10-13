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
import { otpIpRateLimit, verificationAccountRateLimit, recoveryAccountRateLimit } from "../middleware/otpRateLimit.js";

const authRouter = express.Router();

authRouter.post("/register", register);
authRouter.post("/login", login);
authRouter.get("/check-auth", authenticateUser, checkAuth);
authRouter.post("/logout", logout);
authRouter.post("/send-verify-otp", authenticateUser, otpIpRateLimit, verificationAccountRateLimit, sendVerifyotp);
authRouter.post("/verify-account", authenticateUser, otpIpRateLimit, verificationAccountRateLimit, verifyEmail);
authRouter.get("/is-auth", authenticateUser, isAuthenticated);
authRouter.post("/send-reset-otp", otpIpRateLimit, recoveryAccountRateLimit, sendResetOtp);
authRouter.post("/reset-password", otpIpRateLimit, recoveryAccountRateLimit, resetPassword);

export default authRouter;

