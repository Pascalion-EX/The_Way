import express from "express";
import {
  createGame,
  getAllGames,
  getGameById,
  updateGame,
  deleteGame,
} from "../controllers/gameController.js";

import userAuth from "../middleware/userAuth.js";
import validateVideoUrl from "../middleware/validateVideoUrl.js";

const gameRouter = express.Router();

gameRouter.post("/create", userAuth, validateVideoUrl, createGame);
gameRouter.get("/",userAuth,  getAllGames);
gameRouter.get("/:id",userAuth,  getGameById);
gameRouter.put("/:id", userAuth, validateVideoUrl, updateGame);
gameRouter.delete("/:id", userAuth, deleteGame);

export default gameRouter;
