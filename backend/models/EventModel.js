import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
    },

    eventType: {
      type: String,
      enum: [
        "Trip",
        "Visit",
        "Fasting",
        "Mass",
        "Meeting",
        "Other",
      ],
      required: true,
    },

    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
    },

    allDay: {
      type: Boolean,
      default: false,
    },

    location: {
      type: String,
      default: "",
    },

    years: [
      {
        type: Number,
        min: 1,
        max: 12,
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
  }
);

const EventModel = mongoose.model("EventModel", eventSchema);

export default EventModel;