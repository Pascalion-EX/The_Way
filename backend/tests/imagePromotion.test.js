import assert from "node:assert/strict";
import { test } from "node:test";
import { execFile as run } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const execFile = promisify(run);
const script = fileURLToPath(new URL("../../deployment/promote-images.sh", import.meta.url));
const sha = "a".repeat(40);

async function setup(t, failure = "") {
  const directory = await mkdtemp(join(tmpdir(), "the-way-promotion-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const logfile = join(directory, "calls.jsonl");
  await writeFile(logfile, "");
  await writeFile(join(directory, "docker"), `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.PROMOTION_TEST_LOG, JSON.stringify(args) + '\\n');
if (args.includes(process.env.PROMOTION_TEST_FAILURE) ||
    args[2] + ':' + (args.at(-1).includes('the-way-web') ? 'web' : 'api') === process.env.PROMOTION_TEST_FAILURE) {
  process.stderr.write('Synthetic registry failure'); process.exit(17);
}
`, { mode: 0o755 });
  const env = { ...process.env, PATH: `${directory}:${process.env.PATH}`, PROMOTION_TEST_LOG: logfile, PROMOTION_TEST_FAILURE: failure };
  return {
    promote: (owner = "test-owner", release = sha) => execFile("sh", [script, owner, release], { env }),
    calls: async () => (await readFile(logfile, "utf8")).trim().split("\n").filter(Boolean).map((line) => JSON.parse(line)),
  };
}

test("production promotion checks both immutable images before retagging either image", async (t) => {
  const state = await setup(t);
  await state.promote();
  const calls = await state.calls();
  assert.equal(calls.length, 4);
  assert.deepEqual(calls.slice(0, 2), ["the-way-api", "the-way-web"].map((image) =>
    ["buildx", "imagetools", "inspect", `ghcr.io/test-owner/${image}:sha-${sha}`]));
  assert.deepEqual(calls.slice(2), ["the-way-api", "the-way-web"].map((image) =>
    ["buildx", "imagetools", "create", "--prefer-index=false", "--tag", `ghcr.io/test-owner/${image}:production`, `ghcr.io/test-owner/${image}:sha-${sha}`]));
});

test("a missing source image prevents all promotion; a registry write failure fails the release", async (t) => {
  for (const failure of ["inspect:api", "inspect:web"]) {
    const state = await setup(t, failure);
    await assert.rejects(state.promote(), /Synthetic registry failure/);
    assert.ok((await state.calls()).every((args) => args[2] === "inspect"));
  }
  const state = await setup(t, "create:web");
  const error = await state.promote().then(() => assert.fail("Promotion unexpectedly succeeded"), (error) => error);
  assert.equal(error.code, 17);
  assert.doesNotMatch(error.stdout, /Published production tags/);
});

test("invalid registry owners and release identifiers never invoke Docker", async (t) => {
  const state = await setup(t);
  for (const [owner, release] of [
    ["UPPERCASE", sha], ["owner/path", sha], ["owner;touch injected", sha],
    ["owner", "main"], ["owner", "a".repeat(39)], ["owner", "a".repeat(40) + "$(id)"],
  ]) await assert.rejects(state.promote(owner, release));
  assert.deepEqual(await state.calls(), []);
});
