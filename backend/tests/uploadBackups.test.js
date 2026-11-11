import assert from "node:assert/strict";
import { test } from "node:test";
import { execFile as run } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const execFile = promisify(run);
const filename = `${"a".repeat(64)}.webp`;

async function setup(t) {
  const directory = await mkdtemp(join(tmpdir(), "the-way-upload-backup-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const backups = join(directory, "backups");
  const uploads = join(directory, "uploads");
  const bin = join(directory, "bin");
  await Promise.all([backups, uploads, bin].map((path) => mkdir(path)));
  const marker = join(directory, "database-restored");
  const commands = {
    mongosh: "exit 0",
    mongodump: 'for argument do case "$argument" in --archive=*) printf database > "${argument#--archive=}" ;; esac; done',
    mongorestore: 'printf restored > "$UPLOAD_RESTORE_TEST_MARKER"',
    // Production runs in the backup container as root. Test current-user files.
    chown: "exit 0",
  };
  for (const [name, body] of Object.entries(commands)) {
    await writeFile(join(bin, name), `#!/bin/sh\nset -eu\n${body}\n`, { mode: 0o755 });
  }
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, MONGO_APP_PASSWORD: "test-only", UPLOAD_RESTORE_TEST_MARKER: marker };
  const script = async (name) => {
    const source = await readFile(new URL(`../../deployment/${name}-container.sh`, import.meta.url), "utf8");
    const path = join(directory, `${name}.sh`);
    await writeFile(path, source.replaceAll("/backups", backups).replaceAll("/uploads", uploads));
    return path;
  };
  return { backups, uploads, marker, env, script };
}

test("backup and recovery keep a matching database/image pair, exclude partial uploads and preserve image bytes", async (t) => {
  const state = await setup(t);
  await writeFile(join(state.uploads, filename), "stored-image-bytes");
  await writeFile(join(state.uploads, ".unfinished.tmp"), "partial");
  await mkdir(join(state.uploads, ".thumbnails", "v1"), { recursive: true });
  await writeFile(join(state.uploads, ".thumbnails", "v1", filename), "derived-thumbnail-bytes");
  await execFile("sh", [await state.script("backup")], { env: state.env });
  const files = await readdir(state.backups);
  assert.equal(files.length, 2);
  const archive = files.find((name) => name.endsWith(".archive.gz"));
  const images = archive.replace(".archive.gz", ".uploads.tar.gz");
  assert.ok(files.includes(images));
  const listed = await execFile("tar", ["-tzf", join(state.backups, images)]);
  assert.match(listed.stdout, new RegExp(filename));
  assert.doesNotMatch(listed.stdout, /unfinished|thumbnails/);
  await rm(join(state.uploads, filename));
  await execFile("sh", [await state.script("restore"), join(state.backups, archive)], { env: state.env });
  assert.equal(await readFile(join(state.uploads, filename), "utf8"), "stored-image-bytes");
  assert.equal(await readFile(state.marker, "utf8"), "restored");
});

test("restore refuses linked image entries or corrupted image archives before touching the database", async (t) => {
  const state = await setup(t);
  const archive = join(state.backups, "test.archive.gz");
  const images = join(state.backups, "test.uploads.tar.gz");
  await writeFile(archive, "database");
  await symlink("/etc/passwd", join(state.uploads, filename));
  await execFile("tar", ["-czf", images, "-C", state.uploads, "."]);
  const restore = await state.script("restore");
  await assert.rejects(execFile("sh", [restore, archive], { env: state.env }), /cannot contain links/);
  await assert.rejects(readFile(state.marker), { code: "ENOENT" });
  await writeFile(images, "not a gzip archive");
  await assert.rejects(execFile("sh", [restore, archive], { env: state.env }));
  await assert.rejects(readFile(state.marker), { code: "ENOENT" });
});
