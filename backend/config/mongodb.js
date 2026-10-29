import mongoose from "mongoose";
import { requestContext } from "../services/performance.js";
import { getSecrets } from "./secrets.js";
mongoose.set("sanitizeFilter", true);
mongoose.set("strictQuery", true);

export const databaseUrl = (env = process.env) => {
    const { mongodbUrl, mongoAppPassword } = getSecrets(env);
    return mongodbUrl ||
        `mongodb://kerolosafam_db_user:${encodeURIComponent(mongoAppPassword || "")}@db:27017/the_way?authSource=the_way`;
};

const connectDB = async () => {
    mongoose.set("bufferCommands", false);
    mongoose.set("maxTimeMS", 15000);
    await mongoose.connect(databaseUrl(), {
        autoIndex: process.env.NODE_ENV !== "production",
        maxPoolSize: Number(process.env.MONGO_POOL_SIZE || 20),
        minPoolSize: 0,
        maxIdleTimeMS: 60000,
        waitQueueTimeoutMS: 5000,
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        monitorCommands: process.env.QUERY_TIMING_LOGS === "true",
    });
    if (process.env.QUERY_TIMING_LOGS === "true") {
        // Never log filters, command bodies, documents, or connection strings.
        const commands = new Map();
        const client = mongoose.connection.getClient();
        client.on("commandStarted", (event) => {
            const collection = event.command[event.commandName];
            commands.set(event.requestId, { context: requestContext.getStore(),
                collection: typeof collection === "string" ? collection : undefined });
        });
        client.on("commandFailed", (event) => commands.delete(event.requestId));
        client.on("commandSucceeded", (event) => {
            const { context, collection } = commands.get(event.requestId) || {};
            commands.delete(event.requestId);
            if (context) { context.dbCommands += 1; context.dbMs += event.duration; }
            if (event.duration >= Number(process.env.SLOW_QUERY_MS || 100)) {
                console.log(JSON.stringify({ type: "slow_database_command", pid: process.pid,
                    requestId: context?.requestId, collection,
                    operation: event.commandName, durationMs: event.duration }));
            }
        });
    }
    console.log("Database connected");
};
export default connectDB;
