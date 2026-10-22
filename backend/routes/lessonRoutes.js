import express from "express";
import userAuth from "../middleware/userAuth.js";
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
lessonRouter.post("/", userAuth, createLesson);
lessonRouter.post("/:lessonId/variants", userAuth, createLessonVariant);
lessonRouter.delete("/:lessonId", userAuth, deleteLesson);
lessonRouter.put("/:lessonid", userAuth,updateLesson);

export default lessonRouter;
