import activitiesModel from "../models/activitiesModel.js";
import userModel from "../models/userModel.js";
import mongoose from "mongoose";

mongoose.set("sanitizeFilter", true);
mongoose.set("strictQuery", true);

const allowedRoles = [
  "admin",
  "leader",
  "pascal",
  "pamela",
];

/*
|--------------------------------------------------------------------------
| Permission Helper
|--------------------------------------------------------------------------
*/

const hasActivityPermission = (roles = []) => {
  const normalizedRoles = Array.isArray(roles)
    ? roles
    : [roles];

  return normalizedRoles
    .filter(Boolean)
    .map((role) =>
      String(role).trim().toLowerCase()
    )
    .some((role) =>
      allowedRoles.includes(role)
    );
};

/*
|--------------------------------------------------------------------------
| CREATE ACTIVITY
|--------------------------------------------------------------------------
*/

export const createActivity = async (req, res) => {
  try {
    const userId = req.userId;

    const {
      name,
      materials,
      explanation,
      image,
      video,
    } = req.body;

    /*
    |--------------------------------------------------------------------------
    | Check User
    |--------------------------------------------------------------------------
    */

    const user = await userModel.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Check Permission
    |--------------------------------------------------------------------------
    */

    if (!hasActivityPermission(user.role)) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. You are not allowed to create activities.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Validation
    |--------------------------------------------------------------------------
    */

    if (
      !name?.trim() ||
      !materials?.trim() ||
      !explanation?.trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Name, materials, explanation, and image are required.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Create
    |--------------------------------------------------------------------------
    */

    const activity =
      await activitiesModel.create({
        name: name.trim(),
        materials: materials.trim(),
        explanation: explanation.trim(),
        image: image.trim(),

        video:
          typeof video === "string"
            ? video.trim()
            : "",

        createdBy: userId,
      });

    return res.status(201).json({
      success: true,
      message:
        "Activity created successfully.",
      activity,
    });
  } catch (error) {
    console.log(
      "createActivity error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Error creating activity.",
      error: error.message,
    });
  }
};

/*
|--------------------------------------------------------------------------
| GET ALL ACTIVITIES
|--------------------------------------------------------------------------
*/

export const getAllActivities = async (
  req,
  res
) => {
  try {
    const { search = "" } = req.query;

    const filter = {};

    /*
    |--------------------------------------------------------------------------
    | Search
    |--------------------------------------------------------------------------
    */

    if (search.trim()) {
      const escapedSearch = search
        .trim()
        .replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        );

      filter.$or = [
        {
          name: {
            $regex: escapedSearch,
            $options: "i",
          },
        },

        {
          materials: {
            $regex: escapedSearch,
            $options: "i",
          },
        },

        {
          explanation: {
            $regex: escapedSearch,
            $options: "i",
          },
        },
      ];
    }

    const activities =
      await activitiesModel
        .find(filter)
        .populate(
          "createdBy",
          "name email role"
        )
        .sort({
          createdAt: -1,
        });

    return res.status(200).json({
      success: true,
      activities,
    });
  } catch (error) {
    console.log(
      "getAllActivities error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Error fetching activities.",
      error: error.message,
    });
  }
};

/*
|--------------------------------------------------------------------------
| GET ACTIVITY BY ID
|--------------------------------------------------------------------------
*/

export const getActivityById = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    /*
    |--------------------------------------------------------------------------
    | Validate ID
    |--------------------------------------------------------------------------
    */

    if (
      !mongoose.Types.ObjectId.isValid(
        id
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid activity ID.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Find Activity
    |--------------------------------------------------------------------------
    */

    const activity =
      await activitiesModel
        .findById(id)
        .populate(
          "createdBy",
          "name email role"
        );

    if (!activity) {
      return res.status(404).json({
        success: false,
        message:
          "Activity not found.",
      });
    }

    return res.status(200).json({
      success: true,
      activity,
    });
  } catch (error) {
    console.log(
      "getActivityById error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Error fetching activity.",
      error: error.message,
    });
  }
};

/*
|--------------------------------------------------------------------------
| UPDATE ACTIVITY
|--------------------------------------------------------------------------
*/

export const updateActivity = async (
  req,
  res
) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    const {
      name,
      materials,
      explanation,
      image,
      video,
    } = req.body;

    /*
    |--------------------------------------------------------------------------
    | Check User
    |--------------------------------------------------------------------------
    */

    const user = await userModel.findById(
      userId
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Permission
    |--------------------------------------------------------------------------
    */

    if (
      !hasActivityPermission(user.role)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. You are not allowed to update activities.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Validate ID
    |--------------------------------------------------------------------------
    */

    if (
      !mongoose.Types.ObjectId.isValid(
        id
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid activity ID.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Validation
    |--------------------------------------------------------------------------
    */

    if (
      !name?.trim() ||
      !materials?.trim() ||
      !explanation?.trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Name, materials, explanation, and image are required.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Update
    |--------------------------------------------------------------------------
    */

    const activity =
      await activitiesModel
        .findByIdAndUpdate(
          id,
          {
            name: name.trim(),

            materials:
              materials.trim(),

            explanation:
              explanation.trim(),

            image: image.trim(),

            video:
              typeof video === "string"
                ? video.trim()
                : "",
          },
          {
            new: true,
            runValidators: true,
          }
        )
        .populate(
          "createdBy",
          "name email role"
        );

    if (!activity) {
      return res.status(404).json({
        success: false,
        message:
          "Activity not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Activity updated successfully.",
      activity,
    });
  } catch (error) {
    console.log(
      "updateActivity error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Error updating activity.",
      error: error.message,
    });
  }
};

/*
|--------------------------------------------------------------------------
| DELETE ACTIVITY
|--------------------------------------------------------------------------
*/

export const deleteActivity = async (
  req,
  res
) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    /*
    |--------------------------------------------------------------------------
    | Check User
    |--------------------------------------------------------------------------
    */

    const user = await userModel.findById(
      userId
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Permission
    |--------------------------------------------------------------------------
    */

    if (
      !hasActivityPermission(user.role)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. You are not allowed to delete activities.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Validate ID
    |--------------------------------------------------------------------------
    */

    if (
      !mongoose.Types.ObjectId.isValid(
        id
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid activity ID.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Delete
    |--------------------------------------------------------------------------
    */

    const activity =
      await activitiesModel.findByIdAndDelete(
        id
      );

    if (!activity) {
      return res.status(404).json({
        success: false,
        message:
          "Activity not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Activity deleted successfully.",
    });
  } catch (error) {
    console.log(
      "deleteActivity error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Error deleting activity.",
      error: error.message,
    });
  }
};