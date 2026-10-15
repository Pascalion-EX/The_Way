import express from "express";
import userAuth from "../middleware/userAuth.js";
import { requireStaff } from "../middleware/staffAuth.js";
import {
  createCamp,
  getAllCamps,
  getCampById,
  getCampApplicants,
  updateCamp,
  deleteCamp,
  applyToCamp,
  withdrawFromCamp,
  notifyCampApplicants,
} from "../controllers/campController.js";

const campRouter = express.Router();

// Summaries contain viewer-specific registration status; rosters are private.
campRouter.use((req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  next();
});

campRouter.post("/", userAuth, createCamp);
campRouter.get("/",userAuth,  getAllCamps);
campRouter.get("/:id/applicants", userAuth, requireStaff, getCampApplicants);
campRouter.get("/:id",userAuth,  getCampById);
campRouter.put("/:id", userAuth, updateCamp);
campRouter.post("/:id/notify", userAuth, notifyCampApplicants);
campRouter.delete("/:id", userAuth, deleteCamp);

campRouter.post("/:id/apply", userAuth, applyToCamp);
campRouter.delete("/:id/apply", userAuth, withdrawFromCamp);

export default campRouter;
