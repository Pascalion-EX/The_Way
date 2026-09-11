import mongoose from "mongoose";
import userModel from "./userModel.js";

const videoRequestSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    videoLink: {
      type: String,
      required: true,
      trim: true,
    },

    referenceLink: {
      type: String,
      default: "",
      trim: true,
    },

    deadline: {
      type: Date,
      default: null,
    },

    priority: {
      type: String,
      enum: [
        "Low",
        "Normal",
        "High",
        "Urgent",
      ],
      default: "Normal",
    },

    status: {
      type: String,
      enum: [
        "Pending",
        "In Progress",
        "Completed",
        "Rejected",
      ],
      default: "Pending",
    },

    notes: {
      type: String,
      default: "",
      trim: true,
    },

    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,

      // Use the actual registered User model name
      ref: userModel.modelName,

      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const VideoRequest =
  mongoose.models.VideoRequest ||
  mongoose.model(
    "VideoRequest",
    videoRequestSchema
  );

export default VideoRequest;