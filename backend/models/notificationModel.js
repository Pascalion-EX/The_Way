import mongoose from "mongoose";

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
        enum: [
          "admin",
          "leader",
          "pascal",
          "Pamela",
          "parent",
          "child",
          "unAssined",
        ],
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

const notificationModel = mongoose.model(
  "Notification",
  notificationSchema
);

export default notificationModel;