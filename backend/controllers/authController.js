import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import userModel from "../models/userModel.js";
import transporter from "../config/nodemailer.js";


export const checkAuth = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: "User is authenticated.",
    userId: req.userId,
  });
};

export const register = async (req, res) => {
  const { name, email, password } = req.body;
  if (!name) {
    return res.json({ success: false, message: "Missing name" });
  }
  if (!email) {
    return res.json({ success: false, message: "Missing email" });
  }
  if (!password) {
    return res.json({ success: false, message: "Missing password" });
  }
  try {
    const existinguser = await userModel.findOne({ email });
    if (existinguser) {
      return res.json({ success: false, message: "User already exists" });
    }

    const hashedpassword = await bcrypt.hash(password, 10);

    const user = new userModel({ name, email, password: hashedpassword });
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "2d",
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      maxAge: 2 * 24 * 60 * 60 * 1000,
    });

    const mailoptions = {
      from: process.env.SENDER_EMAIL,
      to: email,
      subject: "Welcome to the Way service",
      text: `Welcome to the Way service website. Your account has been created with email id: ${email}`,
    };

    await transporter.sendMail(mailoptions);
    return res.json({ success: true });
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
        expiresIn: "2d",
      }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite:
        process.env.NODE_ENV === "production"
          ? "none"
          : "strict",
      maxAge: 2 * 24 * 60 * 60 * 1000,
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
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
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

    const otp = String(Math.floor(100000 + Math.random() * 900000));

    user.verifyOtp = otp;
    user.verifyOtpExpireAt = Date.now() + 12 * 60 * 60 * 1000;

    await user.save();

    const mailoptions = {
      from: process.env.SENDER_EMAIL,
      to: user.email,
      subject: "The Way service OTP",
      text: `Dear ${user.name},
Your OTP is ${otp}`,
    };

    await transporter.sendMail(mailoptions);

    return res.json({
      success: true,
      message: "OTP sent",
    });
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};

export const verifyEmail = async (req, res) => {
  const userId = req.userId;
  const {otp } = req.body;
  if (!userId || !otp) {
    return res.json({ success: false, message: "missing details" });
  }
  try {
    const user = await userModel.findById(userId);
    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }
    if (user.verifyOtp == "" || user.verifyOtp != otp) {
      return res.json({
        success: false,
        message: "Your OTP is wrong or empty",
      });
    }
    if (user.verifyOtpExpireAt < Date.now()) {
      return res.json({ success: false, message: "OTP Expired" });
    }

    user.isAccountVerified = true;
    user.verifyOtp = "";
    user.verifyOtpExpireAt = 0;

    await user.save();
    return res.json({
      success: true,
      message: "Email is verified successfully",
    });
  } catch (error) {
    return res.json({ success: false, message: error.message });
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
  const { email } = req.body;
  if (!email) {
    return res.json({ success: false, message: "Email is required" });
  }

  try {
    const user = await userModel.findOne({ email });
    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    user.resetOtp = otp;
    user.resetOtpExpireAt = Date.now() + 12 * 60 * 60 * 1000;

    await user.save();

    const mailoptions = {
      from: process.env.SENDER_EMAIL,
      to: user.email,
      subject: "Password Reset OTP",
      text: `Welcome to the Way service website. 
            Your Password Reset OTP is ${otp}.
            Use this OTP to proceed with resetting your password.`,
    };
    await transporter.sendMail(mailoptions);
    return res.json({ success: true, message: "OTP sent to your Email" });
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};
export const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) {
    return res.json({
      success: false,
      message: "Email, otp, and new password are required",
    });
  }

  try {
    const user = await userModel.findOne({ email });
    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }
    if (user.resetOtp === "" || user.resetOtp != otp) {
      return res.json({ success: false, message: "Invalid OTP" });
    }
    const isMatch = await bcrypt.compare(newPassword, user.password);
    if (isMatch) {
      return res.json({
        success: false,
        message: "This is the same password as the old one.",
      });
    }
    if (user.resetOtpExpireAt < Date.now()) {
      return res.json({ success: false, message: "OTP Expired" });
    }

    const hashedpassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedpassword;
    user.resetOtp = "";
    user.resetOtpExpireAt = 0;

    await user.save();

    return res.json({
      success: true,
      message: "Password has been reset successfully",
    });
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};

