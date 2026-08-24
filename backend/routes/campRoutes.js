import express from "express";
import userAuth from "../middleware/userAuth.js";
import {
  createCamp,
  getAllCamps,
  getCampById,
  updateCamp,
  deleteCamp,
  applyToCamp,
  withdrawFromCamp,
  notifyCampApplicants,
} from "../controllers/campController.js";

const campRouter = express.Router();

campRouter.post("/", userAuth, createCamp);
campRouter.get("/",userAuth,  getAllCamps);
campRouter.get("/:id",userAuth,  getCampById);
campRouter.put("/:id", userAuth, updateCamp);
campRouter.post("/:id/notify", userAuth, notifyCampApplicants);
campRouter.delete("/:id", userAuth, deleteCamp);

campRouter.post("/:id/apply", userAuth, applyToCamp);
campRouter.delete("/:id/apply", userAuth, withdrawFromCamp);

export default campRouter;