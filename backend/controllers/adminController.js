import { denyAccess } from "../services/accessDenials.js";
import userModel from "../models/userModel.js";
import lessonModel from "../models/lessonModel.js";
import mongoose from "mongoose";
import { hasProtectedAccountRole, PROTECTED_ACCOUNT_ROLE_PATTERNS } from "../../shared/accountProtection.mjs";

const allowedAdminRoles = ["admin", "pamela", "pascal"];
const assignableRoles = ["pascal", "admin", "servant", "parent", "pamela", "unAssigned"];

const hasAdminAccess = (roles = []) => {
  const normalizedRoles = Array.isArray(roles) ? roles : [roles];
  return normalizedRoles.some((role) => allowedAdminRoles.includes(role));
};

export const updateUserClassByAdmin = async (req, res) => {
  try {
    const currentUser = await userModel.findById(req.userId);

    if (!currentUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!hasAdminAccess(currentUser.role)) {
      return await denyAccess(req, res, { success: false, message: "Access denied. Admins only." });
    }

    const { id } = req.params;
    const userClass = req.body?.class;

    if (!mongoose.isObjectIdOrHexString(id)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    if (!Number.isSafeInteger(userClass) || userClass < 0 || userClass > 12) {
      return res.status(400).json({ success: false, message: "Class must be a whole number from 0 to 12. Use 0 for no class." });
    }

    const user = await userModel.findByIdAndUpdate(
      id,
      { class: userClass },
      { returnDocument: "after", runValidators: true }
    ).select("-password -verifyOtp -resetOtp -verifyOtpAttempts -resetOtpAttempts -verifyOtpGeneration -resetOtpGeneration -verifyOtpExpireAt -resetOtpExpireAt -emailJobs");

    if (!user) {
      return res.status(404).json({ success: false, message: "User to update was not found" });
    }

    return res.status(200).json({ success: true, message: "User class updated successfully", user });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
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
      return await denyAccess(req, res, {
        success: false,
        message: "Access denied. Admins only.",
      });
    }

    const usersQuery = userModel
      .find()
      .select("-password -verifyOtp -resetOtp -verifyOtpAttempts -resetOtpAttempts -verifyOtpGeneration -resetOtpGeneration -verifyOtpExpireAt -resetOtpExpireAt -emailJobs")
      .sort({ _id: -1 })
      .lean();

    // All role counts share one scan. Multi-role users still count in each role.
    const roles = ["admin", "servant", "pascal", "pamela", "parent"];
    const [users, counts, totalLessons] = await Promise.all([
      usersQuery,
      userModel.aggregate([{ $group: {
        _id: null, totalUsers: { $sum: 1 },
        ...Object.fromEntries(roles.map((role) => [`${role}Count`, {
          $sum: { $cond: [{ $in: [role, { $ifNull: ["$role", []] }] }, 1, 0] },
        }])),
      } }]),
      lessonModel.countDocuments(),
    ]);
    const { totalUsers = 0, adminCount = 0, servantCount = 0, pascalCount = 0,
      pamelaCount = 0, parentCount = 0 } = counts[0] || {};

    return res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        totalLessons,
        adminCount,
        servantCount,
        pascalCount,
        pamelaCount,
        parentCount,
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
      return await denyAccess(req, res, {
        success: false,
        message: "Access denied. Admins only.",
      });
    }

    if (!mongoose.isObjectIdOrHexString(id)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    if (String(userId) === id) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account",
      });
    }

    const targetUser = await userModel.findById(id).select("role");
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User to delete was not found",
      });
    }

    if (hasProtectedAccountRole(targetUser.role)) {
      return res.status(403).json({ success: false, message: "Pascal and Pamela accounts cannot be deleted" });
    }

    const deletedUser = await userModel.findOneAndDelete({
      _id: id,
      role: mongoose.trusted({ $nin: PROTECTED_ACCOUNT_ROLE_PATTERNS }),
    });
    if (!deletedUser) {
      return res.status(409).json({ success: false, message: "Account changed. Please reload and try again." });
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

export const updateUserRolesByAdmin = async (req, res) => {
  try {
    const currentUser = await userModel.findById(req.userId);

    if (!currentUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!hasAdminAccess(currentUser.role)) {
      return await denyAccess(req, res, { success: false, message: "Access denied. Admins only." });
    }

    const { id } = req.params;
    const { role } = req.body || {};

    if (!mongoose.isObjectIdOrHexString(id)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    if (!Array.isArray(role) || role.length === 0 || role.some((value) => !assignableRoles.includes(value))) {
      return res.status(400).json({ success: false, message: "Select at least one valid role" });
    }

    if (role.includes("unAssigned") && role.length > 1) {
      return res.status(400).json({ success: false, message: "Unassigned cannot be combined with other roles" });
    }

    const targetUser = await userModel.findById(id).select("role");
    if (!targetUser) {
      return res.status(404).json({ success: false, message: "User to update was not found" });
    }

    const canEditAllRoles = hasProtectedAccountRole(currentUser.role);
    if (hasProtectedAccountRole(targetUser.role) && !canEditAllRoles) {
      return res.status(403).json({ success: false, message: "Only Pascal and Pamela users can change this account's roles" });
    }

    const userFilter = { _id: id };
    if (!canEditAllRoles) {
      userFilter.role = mongoose.trusted({ $nin: PROTECTED_ACCOUNT_ROLE_PATTERNS });
    }

    const user = await userModel.findOneAndUpdate(
      userFilter,
      { $set: { role: [...new Set(role)] } },
      { returnDocument: "after", runValidators: true }
    ).select("-password -verifyOtp -resetOtp -verifyOtpAttempts -resetOtpAttempts -verifyOtpGeneration -resetOtpGeneration -verifyOtpExpireAt -resetOtpExpireAt -emailJobs");

    if (!user) {
      return res.status(409).json({ success: false, message: "Account changed. Please reload and try again." });
    }

    return res.status(200).json({ success: true, message: "User roles updated successfully", user });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
