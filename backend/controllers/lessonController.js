import lessonModel from "../models/lessonModel.js";
import userModel from "../models/userModel.js";

const allowedRoles = ["pascal", "admin", "leader", "Pamela"];

const hasLessonPermission = (roles = []) => {
  const normalizedRoles = Array.isArray(roles) ? roles : [roles];
  return normalizedRoles.some((role) => allowedRoles.includes(role));
};

export const createLesson = async (req, res) => {
  try {
    const userId = req.userId;
    const { title, name, body, image, year, video, activity } = req.body;

    if (!title || !name || !body || !image || !year) {
      return res.status(400).json({
        success: false,
        message: "Title, name, body, image, and year are required",
      });
    }

    const user = await userModel.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!hasLessonPermission(user.role)) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to create lessons",
      });
    }

    const lesson = await lessonModel.create({
      title,
      name,
      body,
      video,
      activity,
      image,
      year: Number(year),
      createdBy: userId,
    });

    return res.status(201).json({
      success: true,
      message: "Lesson created successfully",
      lesson,
    });
  } catch (error) {
    console.log("createLesson error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getLessons = async (req, res) => {
  try {
    const { search = "", year = "" } = req.query;

    const filter = {};

    if (year) {
      filter.year = Number(year);
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } },
        { body: { $regex: search, $options: "i" } },
      ];
    }

    const lessons = await lessonModel
      .find(filter)
      .sort({ createdAt: -1 })
      .populate("createdBy", "name email role");

    return res.json({
      success: true,
      lessons,
    });
  } catch (error) {
    console.log("getLessons error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getLessonById = async (req, res) => {
  try {
    const { lessonId } = req.params;

    const lesson = await lessonModel
      .findById(lessonId)
      .populate("createdBy", "name email role");

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: "Lesson not found",
      });
    }

    return res.json({
      success: true,
      lesson,
    });
  } catch (error) {
    console.log("getLessonById error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateLesson = async (req, res) => {
  try {
    const userId = req.userId;
    const { lessonid } = req.params;
    const { title, name, body, image, year, video, activity } = req.body;

    if (!title || !name || !body || !image || !year) {
      return res.status(400).json({
        success: false,
        message: "Title, name, body, image, and year are required",
      });
    }

    const user = await userModel.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!hasLessonPermission(user.role)) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to update lessons",
      });
    }

    const updatedLesson = await lessonModel.findByIdAndUpdate(
      lessonid,
      {
        title,
        name,
        body,
        video,
        activity,
        image,
        year: Number(year),
      },
      { new: true, runValidators: true }
    );

    if (!updatedLesson) {
      return res.status(404).json({
        success: false,
        message: "Lesson not found",
      });
    }

    return res.json({
      success: true,
      message: "Lesson updated successfully",
      lesson: updatedLesson,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
export const deleteLesson = async (req, res) => {
  try {
    const userId = req.userId;
    const { lessonId } = req.params;

    const user = await userModel.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!hasLessonPermission(user.role)) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to delete lessons",
      });
    }

    const lesson = await lessonModel.findById(lessonId);

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: "Lesson not found",
      });
    }

    await lessonModel.findByIdAndDelete(lessonId);

    return res.json({
      success: true,
      message: "Lesson deleted successfully",
    });
  } catch (error) {
    console.log("deleteLesson error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};