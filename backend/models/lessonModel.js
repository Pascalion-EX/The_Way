import mongoose from "mongoose";


const partitionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    body: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    _id: true,
  }
);


const lessonSchema = new mongoose.Schema(
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
      required: false,
      trim: true,
      default: "",
    },


    partitions: {
      type: [partitionSchema],
      default: [],
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
      default: "",
    },

    activity: {
      type: String,
      required: false,
      trim: true,
      default: "",
    },

    year: {
      type: Number,
      required: true,
      min: 1,
    },

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

const lessonModel =
  mongoose.models.lesson || mongoose.model("lesson", lessonSchema);

export default lessonModel;