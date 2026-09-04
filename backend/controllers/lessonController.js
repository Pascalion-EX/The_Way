import lessonModel from "../models/lessonModel.js";
import userModel from "../models/userModel.js";

const allowedRoles = ["pascal", "admin", "leader", "Pamela"];

/*
|--------------------------------------------------------------------------
| Permission Helper
|--------------------------------------------------------------------------
*/

const hasLessonPermission = (roles = []) => {
  const normalizedRoles = Array.isArray(roles) ? roles : [roles];

  return normalizedRoles.some((role) => allowedRoles.includes(role));
};

/*
|--------------------------------------------------------------------------
| Partition Validation / Cleaning
|--------------------------------------------------------------------------
|
| Removes invalid/empty partitions and ensures only title/body are stored.
|
*/

const cleanPartitions = (partitions = []) => {
  if (!Array.isArray(partitions)) {
    return [];
  }

  return partitions
    .map((partition) => ({
      title: String(partition?.title || "").trim(),
      body: String(partition?.body || "").trim(),
    }))
    .filter((partition) => partition.title && partition.body);
};

/*
|--------------------------------------------------------------------------
| Create Lesson
|--------------------------------------------------------------------------
*/

export const createLesson = async (req, res) => {
  try {
    const userId = req.userId;

    const {
      title,
      name,
      body,
      partitions,
      image,
      year,
      video,
      activity,
    } = req.body;

    /*
    |--------------------------------------------------------------------------
    | Basic Validation
    |--------------------------------------------------------------------------
    */

    if (!title || !name || !image || !year) {
      return res.status(400).json({
        success: false,
        message: "Title, name, image, and year are required",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Check User
    |--------------------------------------------------------------------------
    */

    const user = await userModel.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Check Permission
    |--------------------------------------------------------------------------
    */

    if (!hasLessonPermission(user.role)) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to create lessons",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Clean Partitions
    |--------------------------------------------------------------------------
    */

    const cleanedPartitions = cleanPartitions(partitions);

    /*
    |--------------------------------------------------------------------------
    | Lesson Content Validation
    |--------------------------------------------------------------------------
    |
    | We allow either:
    |
    | 1. New modular lessons:
    |    partitions.length > 0
    |
    | OR
    |
    | 2. Legacy lesson format:
    |    body exists
    |
    */

    const hasLegacyBody =
      typeof body === "string" && body.trim().length > 0;

    if (cleanedPartitions.length === 0 && !hasLegacyBody) {
      return res.status(400).json({
        success: false,
        message: "At least one lesson partition is required",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Create Lesson
    |--------------------------------------------------------------------------
    */

    const lesson = await lessonModel.create({
      title: title.trim(),
      name: name.trim(),

      // Keep legacy body if it is supplied.
      body: hasLegacyBody ? body.trim() : "",

      partitions: cleanedPartitions,

      image: image.trim(),

      video:
        typeof video === "string"
          ? video.trim()
          : "",

      activity:
        typeof activity === "string"
          ? activity.trim()
          : "",

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

/*
|--------------------------------------------------------------------------
| Get All Lessons
|--------------------------------------------------------------------------
*/

export const getLessons = async (req, res) => {
  try {
    const {
      search = "",
      year = "",
    } = req.query;

    const filter = {};

    /*
    |--------------------------------------------------------------------------
    | Year Filter
    |--------------------------------------------------------------------------
    */

    if (year) {
      filter.year = Number(year);
    }

    /*
    |--------------------------------------------------------------------------
    | Search
    |--------------------------------------------------------------------------
    |
    | Search:
    |
    | - lesson title
    | - lesson name
    | - legacy body
    | - partition titles
    | - partition bodies
    |
    */

    if (search.trim()) {
      filter.$or = [
        {
          title: {
            $regex: search.trim(),
            $options: "i",
          },
        },

        {
          name: {
            $regex: search.trim(),
            $options: "i",
          },
        },

        {
          body: {
            $regex: search.trim(),
            $options: "i",
          },
        },

        {
          "partitions.title": {
            $regex: search.trim(),
            $options: "i",
          },
        },

        {
          "partitions.body": {
            $regex: search.trim(),
            $options: "i",
          },
        },
      ];
    }

    const lessons = await lessonModel
      .find(filter)
      .sort({
        createdAt: -1,
      })
      .populate(
        "createdBy",
        "name email role"
      );

    return res.status(200).json({
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

/*
|--------------------------------------------------------------------------
| Get Lesson By ID
|--------------------------------------------------------------------------
*/

export const getLessonById = async (req, res) => {
  try {
    const { lessonId } = req.params;

    const lesson = await lessonModel
      .findById(lessonId)
      .populate(
        "createdBy",
        "name email role"
      );

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: "Lesson not found",
      });
    }

    return res.status(200).json({
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

/*
|--------------------------------------------------------------------------
| Update Lesson
|--------------------------------------------------------------------------
*/

export const updateLesson = async (req, res) => {
  try {
    const userId = req.userId;

    /*
    |--------------------------------------------------------------------------
    | IMPORTANT
    |--------------------------------------------------------------------------
    |
    | Your route currently uses:
    |
    | PUT /:lessonid
    |
    | Therefore we use lessonid here.
    |
    */

    const { lessonid } = req.params;

    const {
      title,
      name,
      body,
      partitions,
      image,
      year,
      video,
      activity,
    } = req.body;

    /*
    |--------------------------------------------------------------------------
    | Basic Validation
    |--------------------------------------------------------------------------
    */

    if (!title || !name || !image || !year) {
      return res.status(400).json({
        success: false,
        message: "Title, name, image, and year are required",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Check User
    |--------------------------------------------------------------------------
    */

    const user = await userModel.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Permission Check
    |--------------------------------------------------------------------------
    */

    if (!hasLessonPermission(user.role)) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to update lessons",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Check Existing Lesson
    |--------------------------------------------------------------------------
    */

    const existingLesson =
      await lessonModel.findById(lessonid);

    if (!existingLesson) {
      return res.status(404).json({
        success: false,
        message: "Lesson not found",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Clean New Partitions
    |--------------------------------------------------------------------------
    */

    let cleanedPartitions = cleanPartitions(partitions);

    /*
    |--------------------------------------------------------------------------
    | Automatic Legacy Migration
    |--------------------------------------------------------------------------
    |
    | If this is an old lesson that has:
    |
    | body: "old text"
    |
    | but no partitions, automatically turn it into:
    |
    | partitions: [
    |   {
    |     title: "Lesson Body",
    |     body: "old text"
    |   }
    | ]
    |
    | This mostly exists as a safety mechanism.
    | EditLesson.jsx will also handle this on the frontend.
    |
    */

    if (
      cleanedPartitions.length === 0 &&
      existingLesson.partitions.length === 0 &&
      existingLesson.body
    ) {
      cleanedPartitions = [
        {
          title: "Lesson Body",
          body: existingLesson.body,
        },
      ];
    }

    /*
    |--------------------------------------------------------------------------
    | Content Validation
    |--------------------------------------------------------------------------
    */

    const hasLegacyBody =
      typeof body === "string" && body.trim().length > 0;

    if (
      cleanedPartitions.length === 0 &&
      !hasLegacyBody
    ) {
      return res.status(400).json({
        success: false,
        message: "At least one lesson partition is required",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Update
    |--------------------------------------------------------------------------
    */

    const updatedLesson =
      await lessonModel.findByIdAndUpdate(
        lessonid,
        {
          title: title.trim(),

          name: name.trim(),

          /*
          |--------------------------------------------------------------------------
          | Legacy Body
          |--------------------------------------------------------------------------
          |
          | New modular lessons don't need this.
          |
          | We clear it once partitions exist so the new structure becomes
          | the canonical content.
          |
          */

          body:
            cleanedPartitions.length > 0
              ? ""
              : hasLegacyBody
              ? body.trim()
              : "",

          partitions: cleanedPartitions,

          image: image.trim(),

          video:
            typeof video === "string"
              ? video.trim()
              : "",

          activity:
            typeof activity === "string"
              ? activity.trim()
              : "",

          year: Number(year),
        },
        {
          new: true,
          runValidators: true,
        }
      ).populate(
        "createdBy",
        "name email role"
      );

    return res.status(200).json({
      success: true,
      message: "Lesson updated successfully",
      lesson: updatedLesson,
    });
  } catch (error) {
    console.log("updateLesson error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/*
|--------------------------------------------------------------------------
| Delete Lesson
|--------------------------------------------------------------------------
*/

export const deleteLesson = async (req, res) => {
  try {
    const userId = req.userId;
    const { lessonId } = req.params;

    /*
    |--------------------------------------------------------------------------
    | Check User
    |--------------------------------------------------------------------------
    */

    const user = await userModel.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Permission Check
    |--------------------------------------------------------------------------
    */

    if (!hasLessonPermission(user.role)) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to delete lessons",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Find Lesson
    |--------------------------------------------------------------------------
    */

    const lesson = await lessonModel.findById(lessonId);

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: "Lesson not found",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Delete
    |--------------------------------------------------------------------------
    */

    await lessonModel.findByIdAndDelete(lessonId);

    return res.status(200).json({
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