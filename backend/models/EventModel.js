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
        "Feast",
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

    // =====================================================
    // GENERATED CALENDAR FIELDS
    // =====================================================

    source: {
      type: String,
      enum: [
        "manual",
        "coptic-calendar",
      ],
      default: "manual",
    },

    /*
      Only automatically generated Coptic events get
      a calendarKey.

      Examples:

      coptic:2027:resurrection
      coptic:2027:great-lent
      coptic:2027:nativity-fast

      Manual events do not need one.
    */
    calendarKey: {
      type: String,
      trim: true,
    },

    generatedYear: {
      type: Number,
    },
  },
  {
    timestamps: true,
  }
);


// =========================================================
// UNIQUE GENERATED EVENT
// =========================================================
//
// sparse means documents without calendarKey are ignored.
//
// This prevents:
//   coptic:2027:resurrection
//
// from being inserted twice.
//

eventSchema.index(
  {
    calendarKey: 1,
  },
  {
    unique: true,
    sparse: true,
  }
);


// =========================================================
// USEFUL CALENDAR INDEX
// =========================================================

eventSchema.index({
  startDate: 1,
});


const Event =
  mongoose.models.Event ||
  mongoose.model(
    "Event",
    eventSchema
  );

export default Event;