import mongoose from "mongoose";

// Embedded in the user so saving an account/OTP also durably saves its email.
const emailJobSchema = new mongoose.Schema({
  id: { type: String, required: true },
  to: { type: String, required: true },
  subject: { type: String, required: true },
  text: { type: String, required: true },
  status: { type: String, enum: ["queued", "processing"], default: "queued" },
  attempts: { type: Number, default: 0 },
  nextAttemptAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  lockedUntil: Date,
  leaseToken: String,
  lastError: String,
}, { _id: false });

export default emailJobSchema;
