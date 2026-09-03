import express from "express";
import cors from "cors";
import "dotenv/config";
import cookieParser from "cookie-parser";
import connectDB from "./config/mongodb.js";
import authRouter from "./routes/authRoutes.js";
import userRouter from "./routes/userRoutes.js";
import lessonRouter from "./routes/lessonRoutes.js";
import campRouter from "./routes/campRoutes.js";
import adminRouter from "./routes/adminRoutes.js";
import gameRouter from "./routes/gameRoutes.js";
import chantRouter from "./routes/chantRoutes.js";
import activityRouter from "./routes/activitiesRoutes.js";
import eventRouter from "./routes/eventRoutes.js"

const app = express();
const port = process.env.PORT || 4000;
connectDB();

const allowedOrigins = ["http://localhost:5173"];

app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: allowedOrigins, credentials: true }));

app.get("/", (req, res) => res.send("API IS WORKING!, and nodeman is working"));

app.use("/api/games", gameRouter);
app.use("/api/auth", authRouter);
app.use("/api/chants", chantRouter);
app.use("/api/activities", activityRouter);
app.use("/api/admin", adminRouter);
app.use("/api/user", userRouter);
app.use("/api/events", eventRouter);
app.use("/api/lessons", lessonRouter);
app.use("/api/camps", campRouter);

app.listen(port, () => console.log(`Server started on port:${port}`));

