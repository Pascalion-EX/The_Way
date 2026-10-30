import assert from "node:assert/strict";
import { test } from "node:test";
import { execFile as run } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm, stat, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

const execFile = promisify(run);
const source = await readFile(new URL("../start-frontend.sh", import.meta.url), "utf8");

async function setup(t) {
  const directory = await mkdtemp(join(tmpdir(), "the-way-assets-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const cache = join(directory, "cache");
  const current = join(directory, "current");
  await mkdir(current);
  const script = join(directory, "start.sh");
  await writeFile(script, source.replaceAll("/opt/frontend-assets", current).replaceAll("/srv/assets", cache));
  return {
    current, cache, directory,
    start: (retention = "30", args = ["true"]) => execFile("sh", [script, ...args], {
      env: { ...process.env, ASSET_RETENTION_DAYS: retention },
    }),
  };
}

test("frontend replacements publish new chunks while retaining lazy imports from previous releases", async (t) => {
  const state = await setup(t);
  await writeFile(join(state.current, "Activities-old.js"), "old page");
  await state.start();
  const monthsAgo = new Date(Date.now() - 90 * 86400_000);
  await utimes(join(state.cache, "Activities-old.js"), monthsAgo, monthsAgo);
  await rm(join(state.current, "Activities-old.js"));
  await writeFile(join(state.current, "Activities-new.js"), "new page");
  await state.start("30", ["sh", "-c", 'test -s "$1/Activities-new.js" && test -s "$1/Activities-old.js"', "check", state.cache]);
  assert.equal(await readFile(join(state.cache, "Activities-old.js"), "utf8"), "old page");
  assert.equal(await readFile(join(state.cache, "Activities-new.js"), "utf8"), "new page");
  assert.deepEqual((await readdir(state.cache)).filter((name) => !name.startsWith(".")).sort(), ["Activities-new.js", "Activities-old.js"]);
});

test("retention removes expired unused assets and refreshes assets needed by the current image", async (t) => {
  const state = await setup(t);
  await mkdir(state.cache);
  const old = new Date(Date.now() - 45 * 86400_000);
  for (const name of ["expired.js", "current.js"]) {
    await writeFile(join(state.cache, name), "old");
    await utimes(join(state.cache, name), old, old);
  }
  await writeFile(join(state.current, "current.js"), "current");
  await utimes(join(state.current, "current.js"), old, old);
  await state.start();
  assert.deepEqual((await readdir(state.cache)).filter((name) => !name.startsWith(".")), ["current.js"]);
  assert.equal(await readFile(join(state.cache, "current.js"), "utf8"), "current");
  assert.ok((await stat(join(state.cache, "current.js"))).mtimeMs > Date.now() - 60_000);
  // Retention is limited to the dedicated asset cache, not uploads/other data.
  await writeFile(join(state.directory, "uploaded-image.webp"), "image");
  await state.start();
  assert.equal(await readFile(join(state.directory, "uploaded-image.webp"), "utf8"), "image");
});

test("invalid retention and missing build assets fail before the frontend server can start", async (t) => {
  const state = await setup(t);
  for (const value of ["0", "-1", "366", "invalid", "30;anything"]) {
    await assert.rejects(state.start(value), /ASSET_RETENTION_DAYS/);
  }
  await assert.rejects(stat(state.cache), { code: "ENOENT" });
  await rm(state.current, { recursive: true });
  await assert.rejects(state.start());
  await assert.rejects(stat(state.cache), { code: "ENOENT" });
});
