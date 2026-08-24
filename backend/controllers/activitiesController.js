import activitiesModel from "../models/activitiesModel.js";
import mongoose from "mongoose";

mongoose.set("sanitizeFilter", true);
mongoose.set("strictQuery", true);

const allowedRoles = ["admin", "leader", "pascal", "Pamela"];

const hasActivityPermission = (user) => {
  if (!user || !user.role) return false;

  const userRoles = Array.isArray(user.role) ? user.role : [user.role];

  return userRoles.some((role) => allowedRoles.includes(role));
};

// CREATE ACTIVITY
export const createActivity = async (req, res) => {
  try {
    const { name, materials, explanation, image, video } = req.body;

    if (!hasActivityPermission(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admins, leaders, and pascals only.",
      });
    }

    if (!name || !materials || !explanation || !image) {
      return res.status(400).json({
        success: false,
        message: "Name, materials, explanation, and image are required.",
      });
    }

    const activity = await activitiesModel.create({
      name,
      materials,
      explanation,
      image,
      video,
      createdBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: "Activity created successfully.",
      activity,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating activity.",
      error: error.message,
    });
  }
};

// GET ALL ACTIVITIES
export const getAllActivities = async (req, res) => {
  try {
    const activities = await activitiesModel
      .find()
      .populate("createdBy", "name email role")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      activities,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching activities.",
      error: error.message,
    });
  }
};

// GET ACTIVITY BY ID
export const getActivityById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid activity ID.",
      });
    }

    const activity = await activitiesModel
      .findById(id)
      .populate("createdBy", "name email role");

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Activity not found.",
      });
    }

    res.status(200).json({
      success: true,
      activity,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching activity.",
      error: error.message,
    });
  }
};

// UPDATE ACTIVITY
export const updateActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, materials, explanation, image, video } = req.body;

    if (!hasActivityPermission(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admins, leaders, and pascals only.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid activity ID.",
      });
    }

    const activity = await activitiesModel.findById(id);

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Activity not found.",
      });
    }

    activity.name = name || activity.name;
    activity.materials = materials || activity.materials;
    activity.explanation = explanation || activity.explanation;
    activity.image = image || activity.image;
    activity.video = video !== undefined ? video : activity.video;

    await activity.save();

    res.status(200).json({
      success: true,
      message: "Activity updated successfully.",
      activity,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating activity.",
      error: error.message,
    });
  }
};

// DELETE ACTIVITY
export const deleteActivity = async (req, res) => {
  try {
    const { id } = req.params;

    if (!hasActivityPermission(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admins, leaders, and pascals only.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid activity ID.",
      });
    }

    const activity = await activitiesModel.findById(id);

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Activity not found.",
      });
    }

    await activity.deleteOne();

    res.status(200).json({
      success: true,
      message: "Activity deleted successfully.",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting activity.",
      error: error.message,
    });
  }
};