import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { AVATAR_PRESETS, getAvatarPreset } from "../../shared/avatarPresets.mjs";

test("every saved preset has a unique, bundled illustration available at its stable URL", async () => {
  assert.equal(new Set(AVATAR_PRESETS.map(({ id }) => id)).size, AVATAR_PRESETS.length);
  for (const { id, label } of AVATAR_PRESETS) {
    assert.match(id, /^[a-z]+$/);
    assert.ok(label);
    const svg = await readFile(new URL(`../public/avatars/${id}.svg`, import.meta.url), "utf8");
    assert.match(svg, /viewBox="0 0 120 120"/);
    assert.match(svg, /<\/svg>\s*$/);
  }
  assert.equal(getAvatarPreset(undefined), undefined);
  assert.equal(getAvatarPreset("unknown"), undefined);
  assert.equal(getAvatarPreset(""), undefined);
});
