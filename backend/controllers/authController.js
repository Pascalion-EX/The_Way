import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import userModel from "../models/userModel.js";
import { createEmailJob } from "../services/emailQueue.js";
import { randomInt, randomUUID } from "node:crypto";
import { queueOtpRequest } from "../services/otpRequests.js";
import { OTP_TTL_MS } from "../services/otpPolicy.js";
import { reserveOtpAttempt, consumeOtpAttempt, otpMatches } from "../services/otpAttempts.js";
import { AUTH_TOKEN_TTL_SECONDS, getAuthCookieOptions } from "../config/authCookie.js";


export const checkAuth = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: "User is authenticated.",
    userId: req.userId,
  });
};

export const register = async (req, res) => {
  const { name, email, password, phone, role } = req.body;
  if (!name) {
    return res.json({ success: false, message: "Missing name" });
  }
  if (!email) {
    return res.json({ success: false, message: "Missing email" });
  }
  if (!password) {
    return res.json({ success: false, message: "Missing password" });
  }
  if (role != "parent" && role != "unAssigned"){
    return res.json({success: false, message: "Welcome to the honeypot"});
  }
  try {
    const existinguser = await userModel.findOne({ email });
    if (existinguser) {
      return res.json({ success: false, message: "User already exists" });
    }

    const hashedpassword = await bcrypt.hash(password, 10);

    const otp = String(randomInt(100000, 1000000));
    const otpRequestedAt = Date.now();
    const otpExpiresAt = otpRequestedAt + OTP_TTL_MS;
    const user = new userModel({
      name, email, password: hashedpassword, phone, role,
      verifyOtp: otp, verifyOtpExpireAt: otpExpiresAt,
      verifyOtpRequestedAt: otpRequestedAt,
      verifyOtpAttempts: 0, verifyOtpGeneration: randomUUID(),
      emailJobs: {
        welcome: createEmailJob({
          to: email, subject: "Welcome to the Way service",
          text: `Welcome to the Way service website. Your account has been created with email id: ${email}`,
          expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        }),
        verification: createEmailJob({
          to: email, subject: "The Way service OTP", text: `Dear ${name},\nYour OTP is ${otp}`,
          expiresAt: otpExpiresAt,
        }),
      },
    });
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: AUTH_TOKEN_TTL_SECONDS,
    });

    res.cookie("token", token, {
      ...getAuthCookieOptions(),
      maxAge: AUTH_TOKEN_TTL_SECONDS * 1000,
    });

    return res.json({ success: true, message: "Account created. Your verification email will arrive shortly.", emailQueued: true });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Reject arrays, objects, numbers, null, etc.
    if (
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Email and password must be valid strings",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // Basic email-format validation
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const user = await userModel
      .findOne({
        email: normalizedEmail,
      })
      .setOptions({
        sanitizeFilter: true,
      });

    // Use the same response for both cases to reduce account enumeration
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const isMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not configured");

      return res.status(500).json({
        success: false,
        message: "Server configuration error",
      });
    }

    const token = jwt.sign(
      {
        id: user._id,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: AUTH_TOKEN_TTL_SECONDS,
      }
    );

    res.cookie("token", token, {
      ...getAuthCookieOptions(),
      maxAge: AUTH_TOKEN_TTL_SECONDS * 1000,
    });

    return res.status(200).json({
      success: true,
      message: "Logged in successfully",
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to log in",
    });
  }
};

export const logout = async (req, res) => {
  try {
    res.clearCookie("token", getAuthCookieOptions());
    return res.json({ success: true, message: "Logged Out" });
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};
export const sendVerifyotp = async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.json({ success: false, message: "Unauthorized" });
    }

    const user = await userModel.findById(userId);

    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    if (user.isAccountVerified) {
      return res.json({
        success: false,
        message: "Account already verified",
      });
    }

    const result = await queueOtpRequest(user, "verification");
    if (!result.success) {
      if (result.retryAfter) res.set("Retry-After", String(result.retryAfter));
      return res.status(result.status).json(result);
    }

    return res.json({
      success: true,
      message: "Verification email requested. It will arrive shortly; delivery retries automatically.",
      emailQueued: true,
      otpResendAvailableAt: result.otpResendAvailableAt,
    });
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};

export const verifyEmail = async (req, res) => {
  const userId = req.userId;
  const { otp } = req.body || {};
  if (!userId || typeof otp !== "string" || !/^\d{6}$/.test(otp)) {
    return res.status(400).json({ success: false, message: "Enter a valid 6-digit OTP" });
  }
  try {
    const attempt = await reserveOtpAttempt({ _id: userId }, "verification");
    if (!attempt.success) return res.status(attempt.status).json(attempt);
    if (!otpMatches(attempt.user.verifyOtp, otp)) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }
    const result = await consumeOtpAttempt(attempt.user, "verification", { isAccountVerified: true });
    if (!result.success) return res.status(result.status).json(result);
    return res.json({
      success: true,
      message: "Email is verified successfully",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Unable to verify email" });
  }
};
export const isAuthenticated = async (req, res) => {
  try {
    return res.json({ success: true });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

export const sendResetOtp = async (req, res) => {
  const { email } = req.body || {};
  if (typeof email !== "string" || !email.trim()) {
    return res.status(400).json({ success: false, message: "Email is required" });
  }

  try {
    // Existing accounts store the supplied address verbatim; preserve that identity.
    const user = await userModel.findOne({ email });
    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    const result = await queueOtpRequest(user, "passwordReset");
    if (!result.success) {
      if (result.retryAfter) res.set("Retry-After", String(result.retryAfter));
      return res.status(result.status).json(result);
    }
    return res.json({ success: true, message: "Password reset email requested. It will arrive shortly.", emailQueued: true, otpResendAvailableAt: result.otpResendAvailableAt });
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};
export const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body || {};
  if (typeof email !== "string" || !email.trim() ||
      typeof otp !== "string" || !/^\d{6}$/.test(otp) ||
      typeof newPassword !== "string" || !newPassword) {
    return res.status(400).json({
      success: false,
      message: "Email, a valid 6-digit OTP, and new password are required",
    });
  }

  try {
    const attempt = await reserveOtpAttempt({ email }, "passwordReset");
    if (!attempt.success) return res.status(attempt.status).json(attempt);
    const user = attempt.user;
    if (!otpMatches(user.resetOtp, otp)) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }
    const isMatch = await bcrypt.compare(newPassword, user.password);
    if (isMatch) {
      return res.json({
        success: false,
        message: "This is the same password as the old one.",
      });
    }
    const hashedpassword = await bcrypt.hash(newPassword, 10);
    const result = await consumeOtpAttempt(user, "passwordReset", { password: hashedpassword });
    if (!result.success) return res.status(result.status).json(result);

    return res.json({
      success: true,
      message: "Password has been reset successfully",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Unable to reset password" });
  }
};

