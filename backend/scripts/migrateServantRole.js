import mongoose from "mongoose";
import { databaseUrl } from "../config/mongodb.js";
import User from "../models/userModel.js";
import Notification from "../models/notificationModel.js";
import Camp from "../models/campsModel.js";
import { migrateServantRole, ServantRoleMigrationError } from "../services/servantRoleMigration.js";

const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log("Usage: npm run migrate:servant-role -- [--apply]\nDefaults to a read-only preview. Stop application writes and take a backup before --apply.");
} else if (args.length > 1 || args.some((arg) => arg !== "--apply")) {
  console.error("Unknown arguments. Use --help for usage.");
  process.exitCode = 1;
} else {
  try {
    // Disable model initialization writes even in development: a preview must
    // never create collections or indexes as a side effect of connecting.
    await mongoose.connect(databaseUrl(), {
      autoIndex: false, autoCreate: false, maxPoolSize: 2,
      serverSelectionTimeoutMS: 5000, connectTimeoutMS: 10000,
    });
    const result = await migrateServantRole({
      users: mongoose.connection.db.collection(User.collection.collectionName),
      notifications: mongoose.connection.db.collection(Notification.collection.collectionName),
      camps: mongoose.connection.db.collection(Camp.collection.collectionName),
    }, { apply: args.includes("--apply") });
    console.log(JSON.stringify({ database: mongoose.connection.name, ...result }, null, 2));
  } catch (error) {
    console.error(error instanceof ServantRoleMigrationError ? error.message : "Migration failed. Check database connectivity and permissions, then rerun the dry run.");
    console.error("Any completed document updates are retained. The migration is safe to rerun; keep application writes stopped until verification succeeds.");
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
