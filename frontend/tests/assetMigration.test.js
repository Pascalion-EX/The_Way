import assert from "node:assert/strict";
import { test } from "node:test";
import { execFile as run } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm, stat, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const execFile = promisify(run);
const script = fileURLToPath(new URL("../../deployment/preserve-frontend-assets.sh", import.meta.url));

async function setup(t) {
  const directory = await mkdtemp(join(tmpdir(), "the-way-asset-migration-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const cache = join(directory, "cache");
  const logfile = join(directory, "calls.jsonl");
  for (const name of ["cache", "web", "web2"]) await mkdir(join(directory, name));
  await writeFile(logfile, "");
  // Simulate the Docker boundary, but execute the actual volume-seeding shell
  // against temporary directories so copy, pruning and publication are tested.
  await writeFile(join(directory, "docker"), `#!/usr/bin/env node
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const args = process.argv.slice(2);
const directory = process.env.ASSET_MIGRATION_TEST_DIR;
fs.appendFileSync(path.join(directory, 'calls.jsonl'), JSON.stringify(args) + '\\n');
if (args[0] !== 'compose') process.exit(19);
switch (args[1]) {
  case 'config': break;
  case 'ps':
    if (process.env.ASSET_MIGRATION_TEST_SERVICES.split(',').includes(args.at(-1))) process.stdout.write('running-container');
    break;
  case 'cp': {
    const service = args[2].split(':')[0];
    if (service === process.env.ASSET_MIGRATION_TEST_FAILURE) {
      fs.writeSync(2, 'Snapshot failed'); process.exit(17);
    }
    fs.cpSync(path.join(directory, service), args[3], { recursive: true, preserveTimestamps: true });
    break;
  }
  case 'run': {
    const backup = args[args.indexOf('--volume') + 1].slice(0, -':/seed:ro'.length);
    const shell = args.at(-1).replaceAll('/seed', backup).replaceAll('/srv/assets', path.join(directory, 'cache'));
    execFileSync('sh', ['-eu', '-c', shell], { stdio: 'inherit' });
    break;
  }
  default: process.exit(19);
}
`, { mode: 0o755 });
  return {
    directory, cache,
    preserve: (values = {}) => execFile("sh", [script], { env: {
      ...process.env, PATH: `${directory}:${process.env.PATH}`, TMPDIR: directory,
      ASSET_MIGRATION_TEST_DIR: directory, ASSET_MIGRATION_TEST_SERVICES: "web,web2", ...values,
    } }),
    calls: async () => (await readFile(logfile, "utf8")).trim().split("\n").filter(Boolean).map((line) => JSON.parse(line)),
  };
}

test("migration preserves both old releases, keeps current cache entries and excludes private metadata", async (t) => {
  const state = await setup(t);
  await writeFile(join(state.directory, "web", "old-A.js"), "first release");
  const monthsAgo = new Date(Date.now() - 90 * 86400_000);
  await utimes(join(state.directory, "web", "old-A.js"), monthsAgo, monthsAgo);
  await mkdir(join(state.directory, "web2", "nested"));
  await writeFile(join(state.directory, "web2", "nested", "old-B.css"), "second release");
  await writeFile(join(state.directory, "web", ".asset-manifest"), "stale manifest");
  await mkdir(join(state.directory, "web2", ".stage.partial"));
  await writeFile(join(state.directory, "web2", ".stage.partial", "unfinished.js"), "partial");
  await writeFile(join(state.cache, "current.js"), "published bytes");
  await writeFile(join(state.directory, "web2", "current.js"), "old copy");
  await state.preserve();
  assert.equal(await readFile(join(state.cache, "old-A.js"), "utf8"), "first release");
  assert.ok((await stat(join(state.cache, "old-A.js"))).mtimeMs > Date.now() - 60_000);
  assert.equal(await readFile(join(state.cache, "nested", "old-B.css"), "utf8"), "second release");
  assert.equal(await readFile(join(state.cache, "current.js"), "utf8"), "published bytes");
  assert.deepEqual((await readdir(state.cache)).sort(), ["current.js", "nested", "old-A.js"]);
  const calls = await state.calls();
  const seed = calls.find((args) => args[1] === "run");
  assert.ok(seed.includes("com.centurylinklabs.watchtower.enable=false"));
  assert.ok(seed.includes("never"));
  assert.ok(!calls.some((args) => ["up", "down", "stop"].includes(args[1])));
  assert.equal((await readdir(state.directory)).filter((name) => name.startsWith("the-way-frontend-assets.")).length, 1);
});

test("snapshot failure prevents seeding and leaves running services alone", async (t) => {
  const state = await setup(t);
  await assert.rejects(state.preserve({ ASSET_MIGRATION_TEST_FAILURE: "web2" }), /Snapshot failed/);
  assert.ok(!(await state.calls()).some((args) => args[1] === "run"));
});

test("a single old replica can be migrated; an empty deployment cannot be seeded", async (t) => {
  const single = await setup(t);
  await writeFile(join(single.directory, "web", "old.js"), "old page");
  await single.preserve({ ASSET_MIGRATION_TEST_SERVICES: "web" });
  assert.equal(await readFile(join(single.cache, "old.js"), "utf8"), "old page");
  const empty = await setup(t);
  await assert.rejects(empty.preserve({ ASSET_MIGRATION_TEST_SERVICES: "" }), /No running frontend assets found/);
  assert.ok(!(await empty.calls()).some((args) => args[1] === "run"));
});
