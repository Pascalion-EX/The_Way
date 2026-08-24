import express from "express";
import userAuth from "../middleware/userAuth.js";

import {
  createChant,
  getAllChants,
  getChantById,
  updateChant,
  deleteChant,
  toggleFavoriteChant,
} from "../controllers/chantController.js";

const chantRouter = express.Router();

chantRouter.get("/",userAuth,  getAllChants);
chantRouter.get("/:id",userAuth,  getChantById);

chantRouter.post("/create", userAuth, createChant);
chantRouter.put("/:id", userAuth, updateChant);
chantRouter.delete("/:id", userAuth, deleteChant);

chantRouter.patch("/:id/favorite", userAuth, toggleFavoriteChant);

export default chantRouter;