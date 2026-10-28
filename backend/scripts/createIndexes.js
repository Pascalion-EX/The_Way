import "../config/environment.js";
import { validateEnvironment } from "../config/environment.js";
import { readdir } from "node:fs/promises";
import mongoose from "mongoose";
import connectDB from "../config/mongodb.js";

validateEnvironment();
await connectDB();
try {
  for (const file of (await readdir(new URL("../models/", import.meta.url))).filter((file) => file.endsWith(".js"))) {
    await import(new URL(`../models/${file}`, import.meta.url));
  }
  for (const model of Object.values(mongoose.models)) {
    // Never syncIndexes(): it can drop existing production indexes.
    await model.createIndexes();
    console.log(`Indexes ready: ${model.modelName}`);
  }
} finally {
  await mongoose.disconnect();
}
