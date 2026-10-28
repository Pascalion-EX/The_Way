import "./config/environment.js";
import { validateEnvironment } from "./config/environment.js";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import connectDB from "./config/mongodb.js";
import authRouter from "./routes/authRoutes.js";
import userRouter from "./routes/userRoutes.js";
import lessonRouter from "./routes/lessonRoutes.js";
import curriculumRouter from "./routes/curriculumRoutes.js";
import campRouter from "./routes/campRoutes.js";
import adminRouter from "./routes/adminRoutes.js";
import gameRouter from "./routes/gameRoutes.js";
import chantRouter from "./routes/chantRoutes.js";
import activityRouter from "./routes/activitiesRoutes.js";
import eventRouter from "./routes/eventRoutes.js"
import videoRequestRouter from "./routes/videoRequestRoutes.js";
import childProfileRouter from "./routes/childProfileRoutes.js";
import notificationRouter from "./routes/notificationRoutes.js";
import attendanceRouter from "./routes/attendanceRoutes.js";
import { startEmailWorker } from "./services/emailQueue.js";
import transporter from "./config/nodemailer.js";
import { requestMetrics, startRuntimeMetrics } from "./middleware/requestMetrics.js";

const app = express();
const port = process.env.PORT || 4000;
validateEnvironment();
await connectDB();
const stopEmailWorker = process.env.EMAIL_WORKER_ENABLED === "false" ? async () => {} : startEmailWorker();
const stopMetrics = process.env.REQUEST_LOGS === "true" ? startRuntimeMetrics() : () => {};
let stopping = false;

const allowedOrigins = process.env.APP_ORIGIN ? [process.env.APP_ORIGIN] : ["http://localhost:5173"];
app.disable("x-powered-by");
// Exactly one proxy; API ports must remain private to the Docker network.
if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);

app.use(requestMetrics);
app.use((req, res, next) => {
  const origin = req.get("origin");
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && origin && !allowedOrigins.includes(origin)) {
    return res.status(403).json({ success: false, message: "Origin is not allowed" });
  }
  next();
});
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());
app.use(cors({ origin: allowedOrigins, credentials: true }));

app.get("/", (req, res) => res.send("API IS WORKING!, and nodeman is working"));
app.get("/health/live", (req, res) => res.json({ status: "ok" }));
app.get("/health/ready", async (req, res) => {
  try {
    if (stopping || mongoose.connection.readyState !== 1) throw new Error("Not ready");
    await mongoose.connection.db.admin().ping({ timeoutMS: 2000 });
    res.json({ status: "ready" });
  } catch {
    res.status(503).json({ status: "unavailable" });
  }
});

app.use("/api/games", gameRouter);
app.use("/api/auth", authRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/children", childProfileRouter);
app.use("/api/attendance", attendanceRouter);
app.use("/api/chants", chantRouter);
app.use("/api/activities", activityRouter);
app.use("/api/admin", adminRouter);
app.use("/api/user", userRouter);
app.use("/api/events", eventRouter);
app.use("/api/lessons", lessonRouter);
app.use("/api/curriculum", curriculumRouter);
app.use("/api/camps", campRouter);
app.use("/api/childProfile", childProfileRouter);
app.use("/api/video-requests", videoRequestRouter);

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = error.status === 413 ? 413 : error.type === "entity.parse.failed" ? 400 : 500;
  res.status(status).json({ success: false, message: status === 413 ? "Request body is too large" : status === 400 ? "Invalid JSON" : "Unable to process request" });
});

const server = app.listen(port, "0.0.0.0", () => console.log(`Server started on port:${port}`));
server.requestTimeout = 30000;
server.headersTimeout = 15000;
server.keepAliveTimeout = 5000;

const shutdown = async () => {
  if (stopping) return;
  stopping = true;
  const deadline = setTimeout(() => process.exit(1), 40000);
  deadline.unref();
  await new Promise((resolve) => server.close(resolve));
  await stopEmailWorker();
  stopMetrics();
  transporter.close();
  await mongoose.disconnect();
  clearTimeout(deadline);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

