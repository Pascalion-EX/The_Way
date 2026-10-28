import mongoose from "mongoose";
import { isScheduleWednesday } from "../utils/activitySchedule.js";

const yearOneToThreeActivitySchema = new mongoose.Schema({
  date: {
    type: String,
    required: true,
    unique: true,
    validate: { validator: isScheduleWednesday, message: "Choose a valid Wednesday" },
  },
  activity: { type: String, default: "", trim: true, maxlength: 2000 },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
}, { timestamps: true });

export default mongoose.models.yearOneToThreeActivity ||
  mongoose.model("yearOneToThreeActivity", yearOneToThreeActivitySchema);
