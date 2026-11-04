import assert from "node:assert/strict";
import { test } from "node:test";
import { execFile as run } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const execFile = promisify(run);
const script = fileURLToPath(new URL("../../deployment/mongo-tools-config.js", import.meta.url));
// Set this to a mongosh executable to run the same checks against its rewriter.
// --nodb guarantees that the integration check never connects to a database.
const mongosh = process.env.MONGO_TOOLS_TEST_MONGOSH;
const init = await readFile(new URL("../../deployment/mongo-init.js", import.meta.url), "utf8");
const passwords = [
  "synthetic-test-password",
  "  synthetic password with surrounding spaces  ",
  'synthetic:"quotes"\\slashes\n\t$#!=`عربي🔒',
];

async function setup(t) {
  const directory = await mkdtemp(join(tmpdir(), "the-way-mongo-config-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const filename = join(directory, "private tools config.json");
  return {
    filename,
    run(password, path = filename) {
      const env = { ...process.env };
      delete env.NODE_TEST_CONTEXT;
      delete env.MONGO_APP_PASSWORD;
      delete env.MONGO_TOOLS_CONFIG;
      if (password !== undefined) env.MONGO_APP_PASSWORD = password;
      if (path !== undefined) env.MONGO_TOOLS_CONFIG = path;
      return execFile(mongosh || process.execPath,
        mongosh ? ["--nodb", "--quiet", "--norc", "--file", script] : [script], { env });
    },
  };
}

test("MongoDB tools config preserves exact passwords, escapes JSON, and creates a private file without logging credentials", async (t) => {
  const state = await setup(t);
  for (const password of passwords) {
    const { stdout, stderr } = await state.run(password);
    assert.equal(stdout, "");
    assert.equal(stderr, "");
    assert.deepEqual(JSON.parse(await readFile(state.filename, "utf8")), { password });
    assert.equal((await stat(state.filename)).mode & 0o777, 0o600);
  }
});

test("missing and whitespace-only passwords fail before changing an existing tools config", async (t) => {
  const state = await setup(t);
  await writeFile(state.filename, "existing-private-config", { mode: 0o600 });
  for (const password of [undefined, "", " \t\r\n", "\uFEFF\u2003"]) {
    await assert.rejects(state.run(password), (error) => {
      // Some mongosh builds do not flush file-script errors to piped stdio.
      // Always check the exit status and side effects; Node also checks text.
      const output = error.stdout + error.stderr;
      assert.equal(error.code, 1);
      if (!mongosh || output) assert.match(output, /MONGO_APP_PASSWORD is required/);
      assert.doesNotMatch(output, /TypeError/);
      return true;
    });
    assert.equal(await readFile(state.filename, "utf8"), "existing-private-config");
  }
});

test("a missing config path fails without logging the password", async (t) => {
  const state = await setup(t);
  const password = "synthetic-confidential-test-value";
  // An empty string deliberately overrides the path default in the fixture.
  await assert.rejects(state.run(password, ""), (error) => {
    const output = error.stdout + error.stderr;
    assert.equal(error.code, 1);
    if (!mongosh || output) assert.match(output, /MONGO_TOOLS_CONFIG is required/);
    assert.equal(output.includes(password), false);
    return true;
  });
  await assert.rejects(stat(state.filename), { code: "ENOENT" });
});

test("database initialisation applies the same password validation and preserves the supplied secret", () => {
  for (const password of passwords) {
    let created;
    runInNewContext(init, {
      process: { env: { MONGO_APP_PASSWORD: password } },
      db: { getSiblingDB(name) {
        assert.equal(name, "the_way");
        return { createUser(user) { created = user; } };
      } },
    });
    assert.equal(created.pwd, password);
  }
  for (const password of [undefined, "", " \t\r\n", "\uFEFF\u2003"]) {
    assert.throws(() => runInNewContext(init, {
      process: { env: { MONGO_APP_PASSWORD: password } },
      db: { getSiblingDB() { assert.fail("Invalid credentials reached database initialisation"); } },
    }), /MONGO_APP_PASSWORD is required/);
  }
});
