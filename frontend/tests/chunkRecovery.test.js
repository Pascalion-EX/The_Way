import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithEsbuild } from "vite";
import { installChunkRecovery } from "../src/utils/chunkRecovery.js";

const browser = () => {
  const target = new EventTarget();
  const values = new Map();
  target.navigator = { onLine: true };
  target.reloads = 0;
  target.location = { reload() { target.reloads++; } };
  target.sessionStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  target.failImport = () => {
    const event = new Event("vite:preloadError", { cancelable: true });
    event.payload = new TypeError("Failed to fetch dynamically imported module");
    target.dispatchEvent(event);
    return event;
  };
  return target;
};

test("an obsolete dynamic import reloads once and concurrent failures cannot cause repeated refreshes", () => {
  const target = browser();
  const dispose = installChunkRecovery(target, "/assets/index-A.js");
  assert.equal(target.failImport().defaultPrevented, true);
  assert.equal(target.failImport().defaultPrevented, true);
  assert.equal(target.reloads, 1);
  dispose();
  // Simulate the reload still receiving the same broken deployment.
  const next = installChunkRecovery(target, "/assets/index-A.js");
  assert.equal(target.failImport().defaultPrevented, false);
  assert.equal(target.reloads, 1);
  next();
  installChunkRecovery(target, "/assets/index-B.js");
  assert.equal(target.failImport().defaultPrevented, true);
  assert.equal(target.reloads, 2);
});

test("offline browsers, blocked storage and failed reloads retain the error for the recovery UI", () => {
  const offline = browser();
  offline.navigator.onLine = false;
  installChunkRecovery(offline, "entry");
  assert.equal(offline.failImport().defaultPrevented, false);
  assert.equal(offline.reloads, 0);
  offline.navigator.onLine = true;
  assert.equal(offline.failImport().defaultPrevented, true);
  for (const kind of ["read", "write", "reload"]) {
    const target = browser();
    if (kind === "read") Object.defineProperty(target, "sessionStorage", { get() { throw new Error("Blocked storage"); } });
    if (kind === "write") target.sessionStorage.setItem = () => { throw new Error("Storage full"); };
    if (kind === "reload") target.location.reload = () => { throw new Error("Reload unavailable"); };
    installChunkRecovery(target, "entry");
    assert.equal(target.failImport().defaultPrevented, false);
    assert.equal(target.reloads, 0);
  }
});

test("persistent page errors display an accessible reload action and preserve normal content otherwise", async () => {
  const source = await readFile(new URL("../src/Components/PageErrorBoundary.jsx", import.meta.url), "utf8");
  const compiled = await transformWithEsbuild(source, "PageErrorBoundary.jsx", { jsx: "automatic", format: "esm" });
  const code = compiled.code
    .replace('"react/jsx-runtime"', JSON.stringify(import.meta.resolve("react/jsx-runtime")))
    .replace('"react"', JSON.stringify(import.meta.resolve("react")));
  const { default: Boundary } = await import(`data:text/javascript,${encodeURIComponent(code)}`);
  const boundary = new Boundary({ children: React.createElement("p", null, "Normal page") });
  assert.match(renderToStaticMarkup(boundary.render()), /Normal page/);
  boundary.state = Boundary.getDerivedStateFromError(new Error("Private technical details"));
  const fallback = renderToStaticMarkup(boundary.render());
  assert.match(fallback, /role="alert"/);
  assert.match(fallback, /Reload page/);
  assert.match(fallback, /href="\/"/);
  assert.doesNotMatch(fallback, /Private technical details/);
});
