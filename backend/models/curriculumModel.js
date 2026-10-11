import mongoose from "mongoose";
import { validateCurriculumTree } from "../utils/curriculumTree.js";

const curriculumNodeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    lesson: { type: mongoose.Schema.Types.ObjectId, ref: "lesson", required: true },
    parentId: { type: String, required: true },
  },
  { _id: false }
);

const curriculumSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    nodes: {
      type: [curriculumNodeSchema],
      default: [],
      validate: {
        validator: (nodes) => validateCurriculumTree(nodes) === null,
        message: "Curriculum nodes must form a connected tree with unique ids rooted at root",
      },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
  },
  { timestamps: true, optimisticConcurrency: true }
);

const curriculumModel = mongoose.models.curriculum || mongoose.model("curriculum", curriculumSchema);

export default curriculumModel;
