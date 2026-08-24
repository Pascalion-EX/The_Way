import express from "express";
import {
  createGame,
  getAllGames,
  getGameById,
  updateGame,
  deleteGame,
} from "../controllers/gameController.js";

import userAuth from "../middleware/userAuth.js";

const gameRouter = express.Router();

gameRouter.post("/create", userAuth, createGame);
gameRouter.get("/",userAuth,  getAllGames);
gameRouter.get("/:id",userAuth,  getGameById);
gameRouter.put("/:id", userAuth, updateGame);
gameRouter.delete("/:id", userAuth, deleteGame);

export default gameRouter;