import mongoose from "mongoose";
import gamesModel from "../models/gamesModel.js";
import userModel from "../models/userModel.js";

mongoose.set("sanitizeFilter", true);
mongoose.set("strictQuery", true);

const allowedRoles = ["admin", "leader", "pascal", "pamela"];

const hasGamePermission = (roles = []) => {
  const normalizedRoles = Array.isArray(roles) ? roles : [roles];

  return normalizedRoles
    .filter(Boolean)
    .map((role) => String(role).trim().toLowerCase())
    .some((role) => allowedRoles.includes(role));
};

const getAuthenticatedUser = async (req) => {
  const userId = req.userId;

  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return null;
  }

  return userModel.findById(userId);
};

// CREATE GAME
export const createGame = async (req, res) => {
  try {
    const { name, materials, explanation, image, video } = req.body;

    const user = await getAuthenticatedUser(req);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!hasGamePermission(user.role)) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. Admins, leaders, pascals, and pamela only.",
      });
    }

    if (
      !name?.trim() ||
      !materials?.trim() ||
      !explanation?.trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Name, materials,and explanation required.",
      });
    }

    const game = await gamesModel.create({
      name: name.trim(),
      materials: materials.trim(),
      explanation: explanation.trim(),
      image: image.trim(),
      video: video?.trim() || "",
      createdBy: user._id,
    });

    return res.status(201).json({
      success: true,
      message: "Game created successfully.",
      game,
    });
  } catch (error) {
    console.error("Create game error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create game.",
    });
  }
};

// GET ALL GAMES
export const getAllGames = async (req, res) => {
  try {
    const games = await gamesModel
      .find()
      .populate("createdBy", "name email role")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      games,
    });
  } catch (error) {
    console.error("Get all games error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch games.",
    });
  }
};

// GET GAME BY ID
export const getGameById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid game ID.",
      });
    }

    const game = await gamesModel
      .findById(id)
      .populate("createdBy", "name email role");

    if (!game) {
      return res.status(404).json({
        success: false,
        message: "Game not found.",
      });
    }

    return res.status(200).json({
      success: true,
      game,
    });
  } catch (error) {
    console.error("Get game by ID error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve game.",
    });
  }
};

// UPDATE GAME
export const updateGame = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, materials, explanation, image, video } = req.body;

    const user = await getAuthenticatedUser(req);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!hasGamePermission(user.role)) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. Admins, leaders, pascals, and pamela only.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid game ID.",
      });
    }

    const game = await gamesModel.findById(id);

    if (!game) {
      return res.status(404).json({
        success: false,
        message: "Game not found.",
      });
    }

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Game name cannot be empty.",
        });
      }

      game.name = name.trim();
    }

    if (materials !== undefined) {
      if (!materials.trim()) {
        return res.status(400).json({
          success: false,
          message: "Materials cannot be empty.",
        });
      }

      game.materials = materials.trim();
    }

    if (explanation !== undefined) {
      if (!explanation.trim()) {
        return res.status(400).json({
          success: false,
          message: "Explanation cannot be empty.",
        });
      }

      game.explanation = explanation.trim();
    }

    if (image !== undefined) {
      if (!image.trim()) {
      }

      game.image = image.trim();
    }

    if (video !== undefined) {
      game.video = video?.trim() || "";
    }

    await game.save();

    const updatedGame = await gamesModel
      .findById(game._id)
      .populate("createdBy", "name email role");

    return res.status(200).json({
      success: true,
      message: "Game updated successfully.",
      game: updatedGame,
    });
  } catch (error) {
    console.error("Update game error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update game.",
    });
  }
};

// DELETE GAME
export const deleteGame = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await getAuthenticatedUser(req);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!hasGamePermission(user.role)) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. Admins, leaders, pascals, and pamela only.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid game ID.",
      });
    }

    const game = await gamesModel.findById(id);

    if (!game) {
      return res.status(404).json({
        success: false,
        message: "Game not found.",
      });
    }

    await gamesModel.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Game deleted successfully.",
    });
  } catch (error) {
    console.error("Delete game error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete game.",
    });
  }
};