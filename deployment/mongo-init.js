// Executed by the official MongoDB image only when /data/db is empty.
const password = process.env.MONGO_APP_PASSWORD;
// Avoid mongosh's optional-method-call rewriting bug; keep the original secret.
if (typeof password !== "string" || /^\s*$/.test(password)) {
  throw new Error("MONGO_APP_PASSWORD is required");
}

db.getSiblingDB("the_way").createUser({
  user: "kerolosafam_db_user",
  pwd: password,
  roles: [{ role: "readWrite", db: "the_way" }],
});
