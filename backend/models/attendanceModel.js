import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
    {
        child:{
            type: mongoose.Schema.Types.ObjectId,
            ref: "childprofile",
            required: true,
        },
        serviceDate: {
            type: Date,
            required: true,
        },
        serviceYear: {
            type: Number,
            required: true,
        },status: {
      type: String,
      enum: ["present", "absent", "late", "excused"],
      default: "present",
    },

    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    notes: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);
attendanceSchema.index(
  {
    child: 1,
    serviceDate: 1,
  },
  {
    unique: true,
  }
);

export default mongoose.model("Attendance", attendanceSchema);