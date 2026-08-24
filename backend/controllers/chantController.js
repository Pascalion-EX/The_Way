import mongoose from "mongoose";
import chantModel from "../models/chantModel.js";
import userModel from "../models/userModel.js";

mongoose.set("sanitizeFilter", true);
mongoose.set("strictQuery", true);

const allowedRoles = ["admin", "leader", "pascal", "Pamela"];

const hasChantPermission = (roles = []) => {
  const normalizedRoles = Array.isArray(roles) ? roles : [roles];
  return normalizedRoles.some((role) => allowedRoles.includes(role));
};

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const escapeRegex = (value = "") => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const hasAtLeastOneLyricsLanguage = (lyrics = {}) => {
  return Boolean(
    lyrics.arabic?.trim() ||
      lyrics.coptic?.trim() ||
      lyrics.english?.trim()
  );
};

const getSafeUpdateData = (body) => {
  const allowedFields = [
    "title",
    "category",
    "image",
    "audio",
    "video",
    "lyrics",
  ];

  const updateData = {};

  allowedFields.forEach((field) => {
    if (body[field] !== undefined) {
      updateData[field] = body[field];
    }
  });

  return updateData;
};

export const createChant = async (req, res) => {
  try {
    const userId = req.userId;

    const { title, category, image, audio, video, lyrics } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Title is required",
      });
    }

    if (!hasAtLeastOneLyricsLanguage(lyrics)) {
      return res.status(400).json({
        success: false,
        message:
          "At least one lyrics language is required: Arabic, Coptic, or English",
      });
    }

    const user = await userModel.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!hasChantPermission(user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admins, leaders, and pascal only.",
      });
    }

    const chant = await chantModel.create({
      title,
      category,
      image,
      audio,
      video,
      lyrics: {
        arabic: lyrics?.arabic || "",
        coptic: lyrics?.coptic || "",
        english: lyrics?.english || "",
      },
      createdBy: userId,
    });

    return res.status(201).json({
      success: true,
      message: "Chant created successfully",
      chant,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getAllChants = async (req, res) => {
  try {
    const { search = "", category = "", favoriteOnly = "false" } = req.query;

    const query = {};

    if (search.trim()) {
      query.title = {
        $regex: escapeRegex(search.trim()),
        $options: "i",
      };
    }

    if (category && category !== "All") {
      query.category = category;
    }

    if (favoriteOnly === "true") {
      const userId = req.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Login required to view favorite chants",
        });
      }

      query.favorites = userId;
    }

    const chants = await chantModel
      .find(query)
      .populate("createdBy", "name email role")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      chants,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getChantById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid chant ID",
      });
    }

    const chant = await chantModel
      .findById(id)
      .populate("createdBy", "name email role");

    if (!chant) {
      return res.status(404).json({
        success: false,
        message: "Chant not found",
      });
    }

    return res.status(200).json({
      success: true,
      chant,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateChant = async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid chant ID",
      });
    }

    const user = await userModel.findById(userId);

    if (!user || !hasChantPermission(user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied.",
      });
    }

    const updateData = getSafeUpdateData(req.body);

    if (updateData.title !== undefined && !updateData.title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Title cannot be empty",
      });
    }

    if (
      updateData.lyrics !== undefined &&
      !hasAtLeastOneLyricsLanguage(updateData.lyrics)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "At least one lyrics language is required: Arabic, Coptic, or English",
      });
    }

    const updatedChant = await chantModel
      .findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
      })
      .populate("createdBy", "name email role");

    if (!updatedChant) {
      return res.status(404).json({
        success: false,
        message: "Chant not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Chant updated successfully",
      chant: updatedChant,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const deleteChant = async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid chant ID",
      });
    }

    const user = await userModel.findById(userId);

    if (!user || !hasChantPermission(user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied.",
      });
    }

    const deletedChant = await chantModel.findByIdAndDelete(id);

    if (!deletedChant) {
      return res.status(404).json({
        success: false,
        message: "Chant not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Chant deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const toggleFavoriteChant = async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid chant ID",
      });
    }

    const chant = await chantModel.findById(id);

    if (!chant) {
      return res.status(404).json({
        success: false,
        message: "Chant not found",
      });
    }

    const alreadyFavorite = chant.favorites.some(
      (favoriteUserId) => favoriteUserId.toString() === userId
    );

    let updatedChant;

    if (alreadyFavorite) {
      updatedChant = await chantModel.findByIdAndUpdate(
        id,
        { $pull: { favorites: userId } },
        { new: true }
      );
    } else {
      updatedChant = await chantModel.findByIdAndUpdate(
        id,
        { $addToSet: { favorites: userId } },
        { new: true }
      );
    }

    return res.status(200).json({
      success: true,
      message: alreadyFavorite
        ? "Removed from favorites"
        : "Added to favorites",
      isFavorite: !alreadyFavorite,
      favoritesCount: updatedChant.favorites.length,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};