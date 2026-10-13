import mongoose from "mongoose";

// Shared counters survive process restarts and apply across backend workers.
const authRateLimitSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  count: { type: Number, required: true, min: 0 },
  expiresAt: { type: Date, required: true },
}, { versionKey: false });

authRateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.authRateLimit || mongoose.model("authRateLimit", authRateLimitSchema);
