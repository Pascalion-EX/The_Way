// mongosh supplies Node's fs API. JSON is also valid YAML for MongoDB tools.
const password = process.env.MONGO_APP_PASSWORD;
const filename = process.env.MONGO_TOOLS_CONFIG;
// mongosh's async rewriter can lose the receiver of optional method calls.
// Validate without optional chaining, and preserve the password byte-for-byte.
if (typeof password !== "string" || /^\s*$/.test(password)) {
  throw new Error("MONGO_APP_PASSWORD is required");
}
if (!filename) throw new Error("MONGO_TOOLS_CONFIG is required");
require("node:fs").writeFileSync(filename, JSON.stringify({ password }), { mode: 0o600 });
