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
import userAuth, { authenticateUser } from "../middleware/userAuth.js";
import { checkPageAccess } from "../controllers/pageAccessController.js";
import { verificationAccountRateLimit, recoveryAccountRateLimit } from "../middleware/otpRateLimit.js";
import { authRequestRateLimits, loginRateLimits, registrationRateLimits, emailDeliveryRateLimits } from "../middleware/authRateLimit.js";

const authRouter = express.Router();

authRouter.post("/register", ...authRequestRateLimits, ...registrationRateLimits, ...emailDeliveryRateLimits, register);
authRouter.post("/login", ...authRequestRateLimits, ...loginRateLimits, login);
authRouter.get("/check-auth", authenticateUser, checkAuth);
authRouter.post("/page-access", userAuth, checkPageAccess);
authRouter.post("/logout", logout);
authRouter.post("/send-verify-otp", ...authRequestRateLimits, authenticateUser, verificationAccountRateLimit, ...emailDeliveryRateLimits, sendVerifyotp);
authRouter.post("/verify-account", ...authRequestRateLimits, authenticateUser, verificationAccountRateLimit, verifyEmail);
authRouter.get("/is-auth", authenticateUser, isAuthenticated);
authRouter.post("/send-reset-otp", ...authRequestRateLimits, recoveryAccountRateLimit, ...emailDeliveryRateLimits, sendResetOtp);
authRouter.post("/reset-password", ...authRequestRateLimits, recoveryAccountRateLimit, resetPassword);

export default authRouter;

