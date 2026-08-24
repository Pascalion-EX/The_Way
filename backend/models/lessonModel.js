import mongoose from "mongoose";

const lessonSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
    },
    image: {
      type: String,
      required: true,
      trim: true,
    },
    video: {
      type: String,
      required: false,
      trim: true,
    },
    activity: {
      type: String,
      required: false,
      trim: true,
    },
    year: {
      type: Number,
      required: true,
      min: 1,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
  },
  { timestamps: true }
);

const lessonModel =
  mongoose.models.lesson || mongoose.model("lesson", lessonSchema);

export default lessonModel;