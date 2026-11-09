import "../config/environment.js";
import { writeFile } from "node:fs/promises";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import connectDB from "../config/mongodb.js";
import User from "../models/userModel.js";
import Lesson from "../models/lessonModel.js";
import Game from "../models/gamesModel.js";
import Chant from "../models/chantModel.js";
import Child from "../models/childProfileModel.js";
import Attendance from "../models/attendanceModel.js";
import Notification from "../models/notificationModel.js";
import Event from "../models/EventModel.js";

if (process.env.LOAD_TEST_CONFIRM !== "disposable-empty-database") {
  throw new Error("Use only on a disposable, isolated deployment with LOAD_TEST_CONFIRM=disposable-empty-database");
}
if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is required");
await connectDB();
try {
  for (const collection of await mongoose.connection.db.listCollections().toArray()) {
    if (await mongoose.connection.db.collection(collection.name).countDocuments() > 0) {
      throw new Error("Refusing to seed: database contains data. Use a fresh isolated deployment.");
    }
  }
  const password = await bcrypt.hash("synthetic-load-test-password", 10);
  const users = await User.insertMany(Array.from({ length: 1000 }, (_, i) => ({
    name: `Synthetic ${i}`, email: `load-${i}@example.invalid`, password,
    role: [i === 0 ? "admin" : i % 5 === 0 ? "servant" : "parent"], class: 1 + i % 12, isAccountVerified: true,
  })));
  const creator = users[0]._id;
  const lessons = await Lesson.insertMany(Array.from({ length: 500 }, (_, i) => ({
    title: `Synthetic lesson ${i}`, name: `Lesson ${i}`, year: 1 + i % 12,
    body: "Synthetic lesson text for capacity testing. ".repeat(100), image: "/test.svg", createdBy: creator,
  })));
  await Game.insertMany(Array.from({ length: 200 }, (_, i) => ({
    name: `Synthetic game ${i}`, materials: "Paper", explanation: "Synthetic instructions. ".repeat(50), createdBy: creator,
  })));
  await Chant.insertMany(Array.from({ length: 200 }, (_, i) => ({
    title: `Synthetic chant ${i}`, lyrics: { english: "Synthetic lyrics. ".repeat(100) }, createdBy: creator,
  })));
  await Notification.insertMany(Array.from({ length: 100 }, (_, i) => ({
    title: `Synthetic notice ${i}`, targetRoles: ["parent", "servant"], url: "/", message: "Synthetic message",
  })));
  await Event.insertMany(Array.from({ length: 100 }, (_, i) => ({
    title: `Synthetic event ${i}`, eventType: "Other", startDate: new Date(2026, 0, 1 + i), createdBy: creator,
  })));
  const children = await Child.insertMany(Array.from({ length: 200 }, (_, i) => ({ name: `Synthetic child ${i}`, grade: 1 + i % 12 })));
  const serviceDate = "2026-10-21";
  for (let week = 0; week < 104; week++) {
    const date = new Date(`${serviceDate}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - week * 7);
    await Attendance.insertMany(children.map((child, i) => ({
      child: child._id, serviceDate: date, serviceYear: date.getUTCFullYear(), recordedBy: creator,
      status: (i + week) % 4 === 0 ? "absent" : "present",
    })));
  }
  const fixture = { serviceDate, lessonIds: lessons.map((lesson) => String(lesson._id)),
    tokens: users.map((user) => jwt.sign({ id: String(user._id), tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: "2h" })) };
  // Copy out with docker compose cp; tokens must never enter source control.
  const path = process.env.LOAD_TEST_OUTPUT || "/tmp/load-fixture.json";
  await writeFile(path, JSON.stringify(fixture), { mode: 0o600 });
  console.log(`Seeded 1000 users, 500 lessons, 200 games, 200 chants, 100 notices, 100 events, 200 children, 20800 attendance rows. Fixture: ${path}`);
} finally {
  await mongoose.disconnect();
}
