import mongoose from "mongoose";

const campSchema = new mongoose.Schema(
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
    TripType: {
      type: String,
      required: true,
      enum: ["Camp", "Trip", "Outing", "Other"],
      trim: true,
    },
    image: {
      type: String,
      default: "",
      trim: true,
    },

    years: {
      type: [Number],
      required: true,
      validate: {
        validator: function (value) {
          return (
            Array.isArray(value) &&
            value.length > 0 &&
            value.every(
              (year) => Number.isInteger(year) && year >= 1 && year <= 12,
            )
          );
        },
        message: "Years must be an array of integers between 1 and 6.",
      },
    },
    applicants: [
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    applicationType: {
      type: String,
      enum: ["parent_for_child", "child_self", "leader"],
      required: true,
    },

    childName: {
      type: String,
      trim: true,
      default: "",
    },

    childYear: {
      type: Number,
      min: 1,
      max: 12,
    },

    parentPhone: {
      type: String,
      trim: true,
      default: "",
    },

    leaderName: {
      type: String,
      trim: true,
      default: "",
    },

    leaderRole: {
      type: String,
      trim: true,
      default: "",
    },

    notes: {
      type: String,
      trim: true,
      default: "",
    },

    appliedAt: {
      type: Date,
      default: Date.now,
    },
  },
],

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },

    applicants: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "user",
          required: true,
        },
        appliedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  },
);

const Camp = mongoose.models.Camp || mongoose.model("Camp", campSchema);

export default Camp;

