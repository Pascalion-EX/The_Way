import express from "express";
import userAuth from "../middleware/userAuth.js";
import validateVideoUrl from "../middleware/validateVideoUrl.js";
import {
  createLesson,
  getLessons,
  getLessonById,
  deleteLesson,
  updateLesson,
  createLessonVariant,
} from "../controllers/lessonController.js";

const lessonRouter = express.Router();

lessonRouter.get("/",userAuth, getLessons);
lessonRouter.get("/:lessonId",userAuth,  getLessonById);
lessonRouter.post("/", userAuth, validateVideoUrl, createLesson);
lessonRouter.post("/:lessonId/variants", userAuth, createLessonVariant);
lessonRouter.delete("/:lessonId", userAuth, deleteLesson);
lessonRouter.put("/:lessonid", userAuth, validateVideoUrl, updateLesson);

export default lessonRouter;
