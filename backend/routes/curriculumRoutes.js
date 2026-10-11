import express from "express";
import userAuth from "../middleware/userAuth.js";
import {
  createCurriculum,
  getCurricula,
  getCurriculumById,
  updateCurriculum,
  deleteCurriculum,
} from "../controllers/curriculumController.js";

const curriculumRouter = express.Router();

curriculumRouter.use(userAuth);
curriculumRouter.get("/", getCurricula);
curriculumRouter.post("/", createCurriculum);
curriculumRouter.get("/:curriculumId", getCurriculumById);
curriculumRouter.put("/:curriculumId", updateCurriculum);
curriculumRouter.delete("/:curriculumId", deleteCurriculum);

export default curriculumRouter;
