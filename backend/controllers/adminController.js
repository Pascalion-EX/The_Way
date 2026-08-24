import userModel from "../models/userModel.js";
import lessonModel from "../models/lessonModel.js";

const allowedAdminRoles = ["admin", "Pamela", "pascal"];

const hasAdminAccess = (roles = []) => {
  const normalizedRoles = Array.isArray(roles) ? roles : [roles];
  return normalizedRoles.some((role) => allowedAdminRoles.includes(role));
};

export const getAdminDashboard = async (req, res) => {
  try {
    const userId = req.userId;

    const currentUser = await userModel.findById(userId);

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!hasAdminAccess(currentUser.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admins only.",
      });
    }

    const users = await userModel
      .find()
      .select("-password -verifyOtp -resetOtp -verifyOtpExpireAt -resetOtpExpireAt")
      .sort({ createdAt: -1 });

    const totalUsers = await userModel.countDocuments();
    const totalLessons = await lessonModel.countDocuments();

    const adminCount = await userModel.countDocuments({ role: "admin" });
    const leaderCount = await userModel.countDocuments({ role: "leader" });
    const pascalCount = await userModel.countDocuments({ role: "pascal" });
    const pamelaCount = await userModel.countDocuments({ role: "Pamela" });
    const parentCount = await userModel.countDocuments({ role: "parent" });
    const childCount = await userModel.countDocuments({ role: "child" });

    return res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        totalLessons,
        adminCount,
        leaderCount,
        pascalCount,
        pamelaCount,
        parentCount,
        childCount,
      },
      users,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const deleteUserByAdmin = async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    const currentUser = await userModel.findById(userId);

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!hasAdminAccess(currentUser.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admins only.",
      });
    }

    if (userId === id) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account",
      });
    }

    const deletedUser = await userModel.findByIdAndDelete(id);

    if (!deletedUser) {
      return res.status(404).json({
        success: false,
        message: "User to delete was not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};