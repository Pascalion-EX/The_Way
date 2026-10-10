import jwt from "jsonwebtoken";
import userModel from "../models/userModel.js";

export const authenticateUser = async (req, res, next) => {
  try {
    const token = req.cookies?.token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized. Please log in again.",
      });
    }

    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);

    if (!decodedToken?.id) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token.",
      });
    }

    req.userId = decodedToken.id;

    return next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Your session has expired. Please log in again.",
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Authentication failed.",
    });
  }
};

export const requireVerifiedUser = async (req, res, next) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ success: false, message: "Not authorized. Please log in again." });
    }

    const user = await userModel.findById(req.userId).select("isAccountVerified");
    if (!user) {
      return res.status(401).json({ success: false, message: "User not found. Please log in again." });
    }

    if (!user.isAccountVerified) {
      return res.status(403).json({
        success: false,
        code: "EMAIL_VERIFICATION_REQUIRED",
        message: "Please verify your email before using the site.",
        redirectTo: "/email-verify",
      });
    }

    return next();
  } catch {
    return res.status(500).json({ success: false, message: "Unable to check email verification." });
  }
};

const userAuth = (req, res, next) =>
  authenticateUser(req, res, () => requireVerifiedUser(req, res, next));

export default userAuth;
