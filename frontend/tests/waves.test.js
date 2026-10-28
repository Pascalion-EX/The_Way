import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { transformWithEsbuild } from "vite";

const source = await readFile(new URL("../src/Components/Waves.jsx", import.meta.url), "utf8");
const { code } = await transformWithEsbuild(source, "Waves.jsx", {
  loader: "jsx", format: "cjs", jsx: "automatic",
});

function mountWaves({ hidden = false, reducedMotion = false } = {}) {
  const effects = [];
  const frames = new Map();
  const listeners = new Map();
  const paths = [];
  let nextFrame = 0;
  let coordinates = [];
  let resize;
  let disconnected = false;
  const ctx = {
    clearRect() { coordinates = []; },
    beginPath() {},
    moveTo(x, y) { coordinates.push([x, y]); },
    lineTo(x, y) { coordinates.push([x, y]); },
    stroke() { paths.push(coordinates); },
  };
  const container = {
    getBoundingClientRect: () => ({ width: 320, height: 240, left: 0, top: 0 }),
    style: { setProperty() {} },
  };
  const browserEvents = {
    addEventListener(name, callback) { listeners.set(name, callback); },
    removeEventListener(name, callback) {
      if (listeners.get(name) === callback) listeners.delete(name);
    },
  };
  const document = { hidden, ...browserEvents };
  const jsx = (type, props) => {
    if (props.ref) props.ref.current = type === "canvas" ? { getContext: () => ctx } : container;
    return { type, props };
  };
  const module = { exports: {} };
  runInNewContext(code, {
    module,
    require(name) {
      if (name === "react") return {
        useRef: (current) => ({ current }),
        useEffect: (effect) => effects.push(effect),
      };
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      throw new Error(`Unexpected import: ${name}`);
    },
    document,
    window: {
      ...browserEvents,
      matchMedia: () => ({ matches: reducedMotion, ...browserEvents }),
    },
    ResizeObserver: class {
      constructor(callback) { resize = callback; }
      observe() {}
      disconnect() { disconnected = true; }
    },
    requestAnimationFrame(callback) { frames.set(++nextFrame, callback); return nextFrame; },
    cancelAnimationFrame(id) { frames.delete(id); },
  });
  module.exports.default({});
  const cleanups = effects.map((effect) => effect());
  return {
    paths, frames, listeners, document,
    resize: () => resize(),
    get disconnected() { return disconnected; },
    frame(time) {
      assert.equal(frames.size, 1, "exactly one animation frame should be pending");
      const [id, callback] = frames.entries().next().value;
      frames.delete(id);
      callback(time);
    },
    cleanup() { cleanups.forEach((cleanup) => cleanup?.()); },
  };
}

test("waves keep changing over time even when reduced motion is reported", () => {
  const waves = mountWaves({ reducedMotion: true });
  waves.frame(100);
  waves.frame(1100);
  assert.equal(waves.paths.length, 2);
  assert.notDeepEqual(waves.paths[0], waves.paths[1]);
  waves.cleanup();
  assert.equal(waves.frames.size, 0);
  assert.equal(waves.listeners.size, 0);
  assert.equal(waves.disconnected, true);
});

test("waves pause in hidden tabs and resume after visibility and resize changes", () => {
  const waves = mountWaves({ hidden: true });
  assert.equal(waves.frames.size, 0);
  waves.document.hidden = false;
  waves.listeners.get("visibilitychange")();
  waves.frame(100);
  waves.document.hidden = true;
  waves.listeners.get("visibilitychange")();
  assert.equal(waves.frames.size, 0);
  waves.document.hidden = false;
  waves.listeners.get("visibilitychange")();
  waves.resize();
  waves.resize();
  waves.frame(1100);
  assert.notDeepEqual(waves.paths[0], waves.paths[1]);
  waves.cleanup();
  assert.equal(waves.frames.size, 0);
});
