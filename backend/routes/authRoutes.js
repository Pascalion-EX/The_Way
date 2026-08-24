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
import userAuth from "../middleware/userAuth.js";

const authRouter = express.Router();

authRouter.post("/register", register);
authRouter.post("/login", login);
authRouter.get("/check-auth", userAuth, checkAuth);
authRouter.post("/logout", logout);
authRouter.post("/send-verify-otp", userAuth, sendVerifyotp);
authRouter.post("/verify-account", userAuth, verifyEmail);
authRouter.get("/is-auth", userAuth, isAuthenticated);
authRouter.post("/send-reset-otp", sendResetOtp);
authRouter.post("/reset-password", resetPassword);

export default authRouter;

