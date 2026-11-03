import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer as createHttpServer } from "node:http";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToReadableStream } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";

let server;
let hmrServer;
let App;
let AppContent;
let AppContextProvider;

before(async () => {
  // Render the actual routes without a browser, network listener, or API.
  hmrServer = createHttpServer();
  server = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    server: { middlewareMode: true, hmr: { server: hmrServer } },
    appType: "custom",
  });
  ({ default: App } = await server.ssrLoadModule("/src/App.jsx"));
  ({ AppContent } = await server.ssrLoadModule("/src/Context/AppContent.js"));
  ({ AppContextProvider } = await server.ssrLoadModule("/src/Context/AppContext.jsx"));
});

after(async () => {
  await server?.close();
  hmrServer?.close();
});

async function renderPage(path, state) {
  const content = state
    ? React.createElement(AppContent.Provider, { value: { backendUrl: "", ...state } }, React.createElement(App))
    : React.createElement(AppContextProvider, null, React.createElement(App));
  const stream = await renderToReadableStream(React.createElement(MemoryRouter, { initialEntries: [path] }, content));
  await stream.allReady;
  return new Response(stream).text();
}

test("initial session restoration hides the login form instead of flashing another sign-in", async () => {
  const html = await renderPage("/login");
  assert.match(html, /Checking your session/);
  assert.match(html, /role="status"/);
  assert.doesNotMatch(html, /<form/);
});

for (const verified of [true, false]) {
  test(`a signed-in account cannot render another login or registration form (verified: ${verified})`, async () => {
    const html = await renderPage("/login", {
      authLoading: false, isLoggedin: true, userData: { isAccountVerified: verified, role: ["parent"] },
    });
    assert.doesNotMatch(html, /<form/);
    assert.doesNotMatch(html, /Welcome back|Create account|Register/);
    assert.doesNotMatch(html, /Checking your session/);
  });
}

test("login waits for the restored profile and allows the form after logout", async () => {
  const pending = await renderPage("/login", { authLoading: false, isLoggedin: true, userData: null });
  assert.match(pending, /Checking your session/);
  assert.doesNotMatch(pending, /<form/);
  const signedOut = await renderPage("/login", { authLoading: false, isLoggedin: false, userData: null });
  assert.match(signedOut, /Welcome back/);
  assert.match(signedOut, /<form/);
  assert.match(signedOut, /Register/);
});

for (const path of ["/privacy-policy", "/terms-of-service"]) {
  test(`${path} remains public and contains no sign-in button for guests or signed-in users`, async () => {
    for (const state of [
      { authLoading: true, isLoggedin: false, userData: null },
      { authLoading: false, isLoggedin: false, userData: null },
      { authLoading: false, isLoggedin: true, userData: { isAccountVerified: true, role: ["parent"] } },
    ]) {
      const html = await renderPage(path, state);
      assert.match(html, /<h1/);
      assert.match(html, /mailto:kerolos\.a\.fam@gmail\.com/);
      assert.doesNotMatch(html, /href="\/login"/);
      assert.doesNotMatch(html, />\s*Sign in\s*</);
    }
  });
}
