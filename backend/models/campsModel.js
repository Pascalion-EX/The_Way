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
    price: { type: Number, default: 0, min: 0 },
    paymentQrImage: { type: String, default: "", trim: true },

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
      ref: "user",
      required: true,
    },

    applicationType: {
      type: String,
      enum: ["parent_for_child", "child_self", "servant"],
      // Older applications contain only user and appliedAt.
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

    servantName: {
      type: String,
      trim: true,
      default: "",
    },

    servantRole: {
      type: String,
      trim: true,
      default: "",
    },

    notes: {
      type: String,
      trim: true,
      default: "",
    },
    paymentScreenshot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CampPaymentScreenshot",
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

  },
  {
    timestamps: true,
  },
);

campSchema.index({ createdAt: -1 });
campSchema.index({ years: 1, createdAt: -1 });
const Camp = mongoose.models.Camp || mongoose.model("Camp", campSchema);

export default Camp;

