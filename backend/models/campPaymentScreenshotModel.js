import mongoose from "mongoose";

// Keep receipt bytes out of camp documents and public uploads. Each receipt has
// its own document so a camp roster cannot exceed MongoDB's document size limit.
const schema = new mongoose.Schema({
  camp: { type: mongoose.Schema.Types.ObjectId, ref: "Camp", required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
  image: { type: Buffer, required: true, select: false },
}, { timestamps: true });

export default mongoose.models.CampPaymentScreenshot || mongoose.model("CampPaymentScreenshot", schema);
