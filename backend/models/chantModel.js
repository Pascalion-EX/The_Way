import mongoose from "mongoose";
import { isValidVideoUrl, VIDEO_URL_ERROR } from "../../shared/videoUrls.mjs";

const chantSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: 120,
    },

    category: {
      type: String,
      enum: ["Praise", "Worship", "Kids", "Mass", "Tasbeha", "Other"],
      default: "Other",
      trim: true,
    },

    image: {
      type: String,
      default: "",
      trim: true,
    },

    audio: {
      type: String,
      default: "",
      trim: true,
    },

    video: {
      type: String,
      validate: { validator: isValidVideoUrl, message: VIDEO_URL_ERROR },
      default: "",
      trim: true,
    },

    lyrics: {
      arabic: {
        type: String,
        default: "",
        trim: true,
      },
      coptic: {
        type: String,
        default: "",
        trim: true,
      },
      english: {
        type: String,
        default: "",
        trim: true,
      },
    },

    favorites: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
      },
    ],

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
  },
  { timestamps: true }
);

chantSchema.index({ createdAt: -1 });
chantSchema.index({ category: 1, createdAt: -1 });
chantSchema.index({ favorites: 1, createdAt: -1 });

const chantModel =
  mongoose.models.chant || mongoose.model("chant", chantSchema);

export default chantModel;
