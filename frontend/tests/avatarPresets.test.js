import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { AVATAR_PRESETS, getAvatarPreset } from "../../shared/avatarPresets.mjs";

test("every saved preset has a unique, bundled PNG profile picture", async () => {
  assert.equal(new Set(AVATAR_PRESETS.map(({ id }) => id)).size, AVATAR_PRESETS.length);
  assert.equal(new Set(AVATAR_PRESETS.map(({ image }) => image)).size, AVATAR_PRESETS.length);
  for (const { id, label, image } of AVATAR_PRESETS) {
    assert.match(id, /^[a-z]+$/);
    assert.ok(label);
    assert.match(image, /^[a-z-]+\.png$/);
    const png = await readFile(new URL(`../public/avatars/${image}`, import.meta.url));
    assert.deepEqual(png.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    assert.equal(png.toString("ascii", 12, 16), "IHDR");
    assert.equal(png.readUInt32BE(16), 512);
    assert.equal(png.readUInt32BE(20), 512);
    assert.equal(png.toString("ascii", png.length - 8, png.length - 4), "IEND");
  }
  assert.equal(getAvatarPreset(undefined), undefined);
  assert.equal(getAvatarPreset("unknown"), undefined);
  assert.equal(getAvatarPreset(""), undefined);
});
