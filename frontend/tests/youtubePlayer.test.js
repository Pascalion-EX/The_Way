import assert from "node:assert/strict";
import { test } from "node:test";
import { formatMediaTime, getYouTubeEmbedUrl } from "../src/utils/youtubePlayer.js";

const setBrowserGlobal = (t, key, value) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, key);
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, key, previous);
    else delete globalThis[key];
  });
};

test("chant video links support watch, share, mobile, embed, Shorts, and live URLs", () => {
  const id = "M7lc1UVf-VE";
  for (const url of [
    `https://www.youtube.com/watch?v=${id}&feature=shared`,
    `https://youtu.be/${id}?si=share`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://www.youtube.com/embed/${id}`,
    `https://www.youtube-nocookie.com/embed/${id}`,
    `https://www.youtube.com/shorts/${id}`,
    `https://www.youtube.com/live/${id}`,
  ]) {
    assert.equal(getYouTubeEmbedUrl(url), `https://www.youtube.com/embed/${id}`);
  }
  for (const url of [undefined, "", "not a URL", "https://youtube.com/watch", "https://example.com/watch?v=M7lc1UVf-VE", "https://youtube.com.evil.test/embed/M7lc1UVf-VE", "https://youtu.be/invalid", "ftp://youtube.com/embed/M7lc1UVf-VE"]) {
    assert.equal(getYouTubeEmbedUrl(url), "");
  }
  assert.equal(
    getYouTubeEmbedUrl(`https://www.youtube.com/embed/${id}?start=30&end=90`),
    `https://www.youtube.com/embed/${id}?start=30&end=90`,
  );
});

test("audio timestamps support an unloaded player and chants longer than an hour", () => {
  for (const [seconds, expected] of [[undefined, "0:00"], [0, "0:00"], [-1, "0:00"], [65.9, "1:05"], [3601, "1:00:01"]]) {
    assert.equal(formatMediaTime(seconds), expected);
  }
});

test("YouTube API loads once, shares readiness, and reuses the loaded API", async (t) => {
  const scripts = [];
  const timers = new Map();
  let previousReadyCalls = 0;
  setBrowserGlobal(t, "window", {
    setTimeout(callback) { timers.set(1, callback); return 1; },
    clearTimeout(id) { timers.delete(id); },
    onYouTubeIframeAPIReady() { previousReadyCalls++; },
  });
  setBrowserGlobal(t, "document", {
    createElement: () => ({ addEventListener() {}, remove() {} }),
    head: { append(script) { scripts.push(script); } },
  });
  const { loadYouTubePlayerApi } = await import("../src/utils/youtubePlayer.js?ready");
  const first = loadYouTubePlayerApi();
  assert.equal(loadYouTubePlayerApi(), first);
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].src, "https://www.youtube.com/iframe_api");
  window.YT = { Player() {} };
  window.onYouTubeIframeAPIReady();
  assert.equal(await first, window.YT);
  assert.equal(await loadYouTubePlayerApi(), window.YT);
  assert.equal(timers.size, 0);
  assert.equal(previousReadyCalls, 1);
});

test("API errors and timeouts allow a subsequent retry", async (t) => {
  let timerCallback;
  let scriptError;
  let removed = 0;
  setBrowserGlobal(t, "window", {
    setTimeout(callback) { timerCallback = callback; return 1; },
    clearTimeout() {},
  });
  setBrowserGlobal(t, "document", {
    createElement: () => ({
      addEventListener(_name, callback) { scriptError = callback; },
      remove() { removed++; },
    }),
    head: { append() {} },
  });
  const { loadYouTubePlayerApi } = await import("../src/utils/youtubePlayer.js?retry");
  const failed = loadYouTubePlayerApi();
  scriptError();
  await assert.rejects(failed, /YouTube could not load/);
  const timedOut = loadYouTubePlayerApi();
  assert.notEqual(timedOut, failed);
  timerCallback();
  await assert.rejects(timedOut, /YouTube could not load/);
  assert.equal(removed, 2);
  const retried = loadYouTubePlayerApi();
  window.YT = { Player() {} };
  window.onYouTubeIframeAPIReady();
  assert.equal(await retried, window.YT);
});
