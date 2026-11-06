import mongoose from "mongoose";

const slideSchema = new mongoose.Schema({
  text: { type: String, default: "", trim: true },
  image: {
    type: String, default: "", trim: true,
    validate: { validator: (value) => !value || /^\/uploads\/[a-f0-9]{64}\.webp$/.test(value), message: "Upload a valid slide image" },
  },
}, { _id: false });

const prayerSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  text: {
    arabic: { type: String, default: "", trim: true },
    coptic: { type: String, default: "", trim: true },
    english: { type: String, default: "", trim: true },
  },
  // Undefined arrays preserve blank-line slides on older prayer documents.
  slides: {
    arabic: { type: [slideSchema], default: undefined },
    coptic: { type: [slideSchema], default: undefined },
    english: { type: [slideSchema], default: undefined },
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
}, { timestamps: true });

prayerSchema.index({ createdAt: -1 });

export default mongoose.models.Prayer || mongoose.model("Prayer", prayerSchema);
