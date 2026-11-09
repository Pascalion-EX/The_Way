import mongoose from "mongoose";
import { NOTIFICATION_ROLES, normalizeNotificationRoles } from "../services/notificationRoles.js";

const notificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: "New Notification",
      trim: true,
    },

    message: {
      type: String,
      default: "",
      trim: true,
    },

    seenBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    targetRoles: [
      {
        type: String,
        enum: NOTIFICATION_ROLES,
      },
    ],

    type: {
      type: String,
      default: "None",
    },

    url: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Hydration does not run setters, so legacy stored audiences must be converted
// before document validation as well as incoming notification requests.
notificationSchema.pre("validate", function () {
  this.targetRoles = normalizeNotificationRoles(this.targetRoles);
});

notificationSchema.index({ targetRoles: 1, createdAt: -1 });

const notificationModel = mongoose.model(
  "Notification",
  notificationSchema
);

export default notificationModel;
