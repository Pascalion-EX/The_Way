import "../config/environment.js";
import { validateEnvironment } from "../config/environment.js";
import mongoose from "mongoose";
import connectDB from "../config/mongodb.js";
import User from "../models/userModel.js";
import { normalizeAuthEmail } from "../../shared/authValidation.mjs";

validateEnvironment();
const email = normalizeAuthEmail(process.argv[2]);
if (!email) throw new Error("Pass the registered, verified first administrator's email");
await connectDB();
try {
  if (await User.exists({ role: "admin" })) throw new Error("An administrator already exists. Use the admin dashboard.");
  const result = await User.updateOne({ email, isAccountVerified: true, isBanned: false }, {
    $set: { role: ["admin"] }, $inc: { tokenVersion: 1 },
  });
  if (result.modifiedCount !== 1) throw new Error("No eligible verified account found");
  console.log("First administrator assigned. Log in again to start a fresh session.");
} finally {
  await mongoose.disconnect();
}
