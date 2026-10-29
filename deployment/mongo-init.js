// Executed by the official MongoDB image only when /data/db is empty.
const password = process.env.MONGO_APP_PASSWORD;
if (!password?.trim()) throw new Error("MONGO_APP_PASSWORD is required");

db.getSiblingDB("the_way").createUser({
  user: "kerolosafam_db_user",
  pwd: password,
  roles: [{ role: "readWrite", db: "the_way" }],
});
