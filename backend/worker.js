import "./config/environment.js";
import { validateEnvironment } from "./config/environment.js";
import mongoose from "mongoose";
import connectDB from "./config/mongodb.js";
import transporter from "./config/nodemailer.js";
import { startEmailWorker } from "./services/emailQueue.js";

validateEnvironment();
await connectDB();
const stop = startEmailWorker();
let stopping = false;
const shutdown = async () => {
  if (stopping) return;
  stopping = true;
  const deadline = setTimeout(() => process.exit(1), 40000);
  deadline.unref();
  await stop();
  transporter.close();
  await mongoose.disconnect();
  clearTimeout(deadline);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
