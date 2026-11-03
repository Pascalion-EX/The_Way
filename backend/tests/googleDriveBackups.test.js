import assert from "node:assert/strict";
import { test } from "node:test";
import { execFile as run, spawn } from "node:child_process";
import { once } from "node:events";
import { promisify } from "node:util";
import { copyFile, mkdtemp, mkdir, readFile, readdir, rm, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

const execFile = promisify(run);
const image = `${"a".repeat(64)}.webp`;
const initialServices = ["db", "api", "api2", "worker", "web", "web2", "traefik", "watchtower"];

// Exercise real shell scripts, tar, ZIP creation/validation, and filesystem
// cleanup. Only Docker/MongoDB and Drive are substituted; no live data or
// credentials are used, and the fake dump cannot contact a database.
async function setup(t, extraEnv = {}) {
  const root = await mkdtemp(join(tmpdir(), "the-way drive backup "));
  t.after(() => rm(root, { recursive: true, force: true }));
  const deployment = join(root, "deployment");
  const backups = join(deployment, "backups");
  const bin = join(root, "bin");
  const uploads = join(root, "uploads");
  const cloud = join(root, "cloud");
  const config = join(deployment, "secrets", "rclone", "rclone.conf");
  await Promise.all([backups, bin, uploads, cloud, join(deployment, "secrets", "rclone")].map((path) => mkdir(path, { recursive: true })));
  for (const name of ["backup-to-gdrive.sh", "backup-container.sh"]) {
    await copyFile(new URL(`../../deployment/${name}`, import.meta.url), join(deployment, name));
  }
  await writeFile(config, "[gdrive]\ntype = drive\ntoken = test-only\n", { mode: 0o600 });
  await writeFile(join(root, ".env"), "MONGO_APP_PASSWORD=never-include-this-in-the-zip\n");
  await writeFile(join(uploads, image), "saved-image-bytes");
  await writeFile(join(uploads, ".unfinished.tmp"), "partial-upload");
  await writeFile(join(root, "services.json"), JSON.stringify(initialServices));

  const commands = {
    docker: `
const args = process.argv.slice(2);
if (args.shift() !== "compose") throw new Error("Unexpected Docker command");
if (args[0] === "--profile") args.splice(0, 2);
const command = args.shift();
const servicesPath = join(root, "services.json");
let services = JSON.parse(readFileSync(servicesPath, "utf8"));
record({ tool: "docker", command, args });
if (command === "version") {
  console.log("Docker Compose test CLI");
} else if (command === "ps") {
  console.log(services.join("\\n"));
} else if (command === "stop" || command === "start") {
  const selected = args.filter((value) => ["api", "api2", "worker", "watchtower"].includes(value));
  if (command === "start" && process.env.GDRIVE_TEST_FAILURE === "restart") process.exit(51);
  services = command === "stop" ? services.filter((name) => !selected.includes(name)) : [...new Set([...services, ...selected])];
  writeFileSync(servicesPath, JSON.stringify(services));
  if (command === "stop" && selected.includes("api") && process.env.GDRIVE_TEST_FAILURE === "stop") process.exit(44);
} else if (command === "run") {
  if (services.some((name) => ["api", "api2", "worker", "watchtower"].includes(name))) throw new Error("Writers/updater still running during dump");
  for (const flag of ["--rm", "--no-deps", "-T"]) if (!args.includes(flag)) throw new Error("Missing " + flag);
  if (args[args.indexOf("--user") + 1] !== process.getuid() + ":" + process.getgid()) throw new Error("Host UID mismatch");
  const volume = args[args.indexOf("--volume") + 1];
  if (!volume.endsWith(":/backups")) throw new Error("Missing isolated backup mount");
  const staging = volume.slice(0, -":/backups".length);
  if (process.env.GDRIVE_TEST_FAILURE === "signal") { process.kill(process.ppid, "SIGTERM"); process.exit(1); }
  if (process.env.GDRIVE_TEST_FAILURE === "images") renameSync(join(root, "uploads"), join(root, "uploads-unavailable"));
  const script = readFileSync(join(root, "deployment", "backup-container.sh"), "utf8")
    .replaceAll("mkdir -p /backups", 'mkdir -p "$GDRIVE_TEST_STAGING"')
    .replaceAll("find /backups ", 'find "$GDRIVE_TEST_STAGING" ')
    .replaceAll('archive="/backups/', 'archive="$GDRIVE_TEST_STAGING/')
    .replaceAll("-C /uploads ", '-C "$GDRIVE_TEST_UPLOADS" ');
  const temporaryScript = join(staging, "container.sh");
  writeFileSync(temporaryScript, script);
  const result = spawnSync("sh", [temporaryScript], { env: { ...process.env, GDRIVE_TEST_STAGING: staging, GDRIVE_TEST_UPLOADS: join(root, "uploads"), MONGO_APP_PASSWORD: "test-only-password" }, stdio: "inherit" });
  process.exit(result.status ?? 1);
} else throw new Error("Unexpected Compose command: " + command);
`,
    rclone: `
const [command, ...args] = process.argv.slice(2);
record({ tool: "rclone", command, args });
if (process.env.RCLONE_CONFIG !== join(root, "deployment", "secrets", "rclone", "rclone.conf")) throw new Error("Unexpected config file");
if (command === "mkdir") {
  if (process.env.GDRIVE_TEST_FAILURE === "auth") process.exit(40);
} else if (command === "copyto") {
  if (process.env.GDRIVE_TEST_FAILURE === "upload") process.exit(41);
  copyFileSync(args[0], join(root, "cloud", basename(args[0])));
} else if (command === "check") {
  const filename = args[args.indexOf("--include") + 1].slice(1);
  if (!args.includes("--one-way")) throw new Error("Missing one-way check");
  if (process.env.GDRIVE_TEST_FAILURE === "verify") writeFileSync(join(root, "cloud", filename), "corrupt-transfer");
  if (!readFileSync(join(args[0], filename)).equals(readFileSync(join(root, "cloud", filename)))) process.exit(42);
} else throw new Error("Unexpected rclone command: " + command);
`,
    mongosh: "",
    mongodump: `
if (process.env.GDRIVE_TEST_FAILURE === "dump") process.exit(43);
const archive = process.argv.slice(2).find((value) => value.startsWith("--archive="));
writeFileSync(archive.slice("--archive=".length), gzipSync("database-bson-and-metadata"));
`,
  };
  for (const [name, body] of Object.entries(commands)) {
    await writeFile(join(bin, name), `#!${process.execPath}
import { appendFileSync, copyFileSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { spawnSync } from "node:child_process";
import { gzipSync } from "node:zlib";
const root = process.env.GDRIVE_TEST_ROOT;
const record = (event) => appendFileSync(join(root, "events.jsonl"), JSON.stringify(event) + "\\n");
${body}
`, { mode: 0o755 });
  }
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, GDRIVE_TEST_ROOT: root };
  for (const key of ["NODE_TEST_CONTEXT", "RCLONE_CONFIG", "GDRIVE_BACKUP_REMOTE", "GDRIVE_BACKUP_RETENTION_DAYS", "GDRIVE_TEST_FAILURE"]) delete env[key];
  Object.assign(env, extraEnv);
  const script = join(deployment, "backup-to-gdrive.sh");
  const runBackup = (args = []) => execFile("bash", [script, ...args], { env, cwd: tmpdir() });
  const events = async () => {
    try { return (await readFile(join(root, "events.jsonl"), "utf8")).trim().split("\n").map(JSON.parse); }
    catch (error) { if (error.code === "ENOENT") return []; throw error; }
  };
  const zipFiles = async () => (await readdir(backups)).filter((name) => name.endsWith(".zip"));
  const services = async () => JSON.parse(await readFile(join(root, "services.json"), "utf8"));
  return { root, backups, cloud, env, events, runBackup, zipFiles, services };
}

async function seedOldFiles(state) {
  const oldZip = "the_way-gdrive-old.zip";
  for (const name of [oldZip, "manual-backup.zip", "the_way-old.archive.gz"]) {
    const path = join(state.backups, name);
    await writeFile(path, "previous-backup");
    await utimes(path, new Date(0), new Date(0));
  }
  return oldZip;
}

test("Drive backup produces a private ZIP with a restorable database/image pair, resumes services before upload, and prunes only its old ZIPs", async (t) => {
  const state = await setup(t);
  const oldZip = await seedOldFiles(state);
  const { stdout } = await state.runBackup(["gdrive:Team backups/production"]);
  assert.match(stdout, /Verified Google Drive backup/);
  const files = await readdir(state.backups);
  const archive = files.find((name) => name.startsWith("the_way-gdrive-") && name.endsWith(".zip"));
  assert.ok(archive);
  assert.ok(!files.includes(oldZip));
  assert.ok(files.includes("manual-backup.zip"));
  assert.ok(files.includes("the_way-old.archive.gz"));
  assert.ok(!files.some((name) => name.startsWith(".gdrive.")));
  const path = join(state.backups, archive);
  assert.equal((await stat(path)).mode & 0o077, 0);
  assert.deepEqual(await readFile(path), await readFile(join(state.cloud, archive)));
  const { stdout: entries } = await execFile("unzip", ["-Z1", path]);
  const names = entries.trim().split("\n");
  assert.equal(names.length, 2);
  const database = names.find((name) => name.endsWith(".archive.gz"));
  assert.ok(database);
  const images = database.replace(".archive.gz", ".uploads.tar.gz");
  assert.ok(names.includes(images));
  const extracted = join(state.root, "extracted");
  await execFile("unzip", ["-q", path, "-d", extracted]);
  assert.equal(gunzipSync(await readFile(join(extracted, database))).toString(), "database-bson-and-metadata");
  const { stdout: savedImage } = await execFile("tar", ["-xOzf", join(extracted, images), `./${image}`]);
  assert.equal(savedImage, "saved-image-bytes");
  const { stdout: imageEntries } = await execFile("tar", ["-tzf", join(extracted, images)]);
  assert.doesNotMatch(imageEntries, /unfinished/);
  assert.deepEqual((await state.services()).sort(), [...initialServices].sort());
  const events = await state.events();
  const stopUpdater = events.findIndex((event) => event.command === "stop" && event.args.includes("watchtower"));
  const stopWriters = events.findIndex((event) => event.command === "stop" && event.args.includes("api"));
  const dump = events.findIndex((event) => event.command === "run");
  const restartWriters = events.findIndex((event) => event.command === "start" && event.args.includes("api"));
  const restartUpdater = events.findIndex((event) => event.command === "start" && event.args.includes("watchtower"));
  const upload = events.findIndex((event) => event.command === "copyto");
  assert.ok(stopUpdater < stopWriters && stopWriters < dump && dump < restartWriters && restartWriters < restartUpdater && restartUpdater < upload);
  assert.ok(events[upload].args.includes("--checksum"));
  assert.ok(events[upload].args.includes("--immutable"));
  assert.match(events[upload].args[1], /^gdrive:Team backups\/production\//);
});

for (const failure of ["dump", "images", "signal"]) {
  test(`failed ${failure} resumes the original services, removes incomplete archives, and never uploads`, async (t) => {
    const state = await setup(t, { GDRIVE_TEST_FAILURE: failure });
    await assert.rejects(state.runBackup(), (error) => {
      assert.equal(error.code, { dump: 43, images: 2, signal: 143 }[failure]);
      return true;
    });
    assert.deepEqual((await state.services()).sort(), [...initialServices].sort());
    assert.deepEqual(await state.zipFiles(), []);
    assert.ok(!(await readdir(state.backups)).some((name) => name.startsWith(".gdrive.")));
    const events = await state.events();
    assert.ok(events.some((event) => event.command === "run"));
    assert.ok(!events.some((event) => event.command === "copyto"));
  });
}

test("a partially failed stop operation restarts services without attempting a dump", async (t) => {
  const state = await setup(t, { GDRIVE_TEST_FAILURE: "stop" });
  await assert.rejects(state.runBackup(), (error) => error.code === 44);
  assert.deepEqual((await state.services()).sort(), [...initialServices].sort());
  assert.ok(!(await state.events()).some((event) => event.command === "run"));
});

for (const failure of ["upload", "verify"]) {
  test(`failed ${failure} retains the completed local ZIP and older backups after services restart`, async (t) => {
    const state = await setup(t, { GDRIVE_TEST_FAILURE: failure });
    const oldZip = await seedOldFiles(state);
    await assert.rejects(state.runBackup(), /Backup kept locally for retry/);
    const files = await state.zipFiles();
    assert.ok(files.includes(oldZip));
    assert.equal(files.filter((name) => name.startsWith("the_way-gdrive-")).length, 2);
    assert.deepEqual((await state.services()).sort(), [...initialServices].sort());
  });
}

test("Drive authentication failures and invalid configuration do not interrupt the application", async (t) => {
  for (const settings of [{ GDRIVE_TEST_FAILURE: "auth" }, { GDRIVE_BACKUP_RETENTION_DAYS: "0" }, { GDRIVE_BACKUP_REMOTE: "/local/folder" }, { RCLONE_CONFIG: "/nonexistent/rclone.conf" }]) {
    const state = await setup(t, settings);
    await assert.rejects(state.runBackup());
    assert.ok(!(await state.events()).some((event) => event.command === "stop"));
    assert.deepEqual(await state.services(), initialServices);
    assert.deepEqual(await state.zipFiles(), []);
  }
});

test("an unavailable database is rejected before stopping any services", async (t) => {
  const state = await setup(t);
  await writeFile(join(state.root, "services.json"), JSON.stringify(initialServices.filter((name) => name !== "db")));
  await assert.rejects(state.runBackup(), /db service must already be running/);
  assert.ok(!(await state.events()).some((event) => event.command === "stop"));
});

test("services that were stopped before the backup are not started", async (t) => {
  const state = await setup(t);
  const services = ["db", "api", "web", "traefik"];
  await writeFile(join(state.root, "services.json"), JSON.stringify(services));
  await state.runBackup();
  assert.deepEqual((await state.services()).sort(), services.sort());
});

test("a failed application restart leaves Watchtower stopped and prevents upload", async (t) => {
  const state = await setup(t, { GDRIVE_TEST_FAILURE: "restart" });
  await assert.rejects(state.runBackup(), /Watchtower remains stopped/);
  assert.ok(!(await state.services()).includes("watchtower"));
  assert.ok(!(await state.events()).some((event) => event.command === "copyto"));
});

test("the backup lock rejects overlapping runs before any remote or maintenance action", async (t) => {
  const state = await setup(t);
  const holder = spawn("bash", ["-c", 'exec 9>"$1"; flock 9; printf locked; read -r', "lock", join(state.backups, ".gdrive-backup.lock")], { stdio: ["pipe", "pipe", "pipe"] });
  await once(holder.stdout, "data");
  try {
    await assert.rejects(state.runBackup(), /already running/);
    assert.ok(!(await state.events()).some((event) => event.tool === "rclone" || event.command === "stop"));
  } finally {
    const exited = once(holder, "exit");
    holder.stdin.end();
    await exited;
  }
});
