import mongoose from "mongoose";
import { isValidVideoUrl, VIDEO_URL_ERROR } from "../../shared/videoUrls.mjs";

const gameSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    materials: {
      type: String,
      required: true,
      trim: true,
    },
    explanation: {
      type: String,
      required: true,
      trim: true,
    },
    image: {
      type: String,
      required: false,
      trim: true,
    },
    video: {
      type: String,
      validate: { validator: isValidVideoUrl, message: VIDEO_URL_ERROR },
      required: false,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
  },
  { timestamps: true }
);

const gamesModel =
  mongoose.models.game || mongoose.model("game", gameSchema);

export default gamesModel;
