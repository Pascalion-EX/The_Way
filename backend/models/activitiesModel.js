import mongoose from "mongoose";

mongoose.set("sanitizeFilter", true);
mongoose.set("strictQuery", true);

const activitySchema = new mongoose.Schema(
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
      required: true,
      trim: true,
    },
    video: {
      type: String,
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

const activityModel =
  mongoose.models.activity || mongoose.model("activity", activitySchema);

export default activityModel;