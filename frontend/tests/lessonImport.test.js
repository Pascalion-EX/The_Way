import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer as createHttpServer } from "node:http";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";
import { lessonDocumentFileError, MAX_LESSON_DOCUMENT_BYTES } from "../../shared/lessonImport.mjs";
import axios from "../src/utils/axios.js";
import { requestLessonImport, LESSON_IMPORT_TIMEOUT_MS } from "../src/utils/lessonImport.js";

let server;
let hmrServer;
let AppContent;
let CreateLesson;
let LessonImportUploader;

before(async () => {
  hmrServer = createHttpServer();
  server = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    server: { middlewareMode: true, hmr: { server: hmrServer } },
    appType: "custom",
  });
  ({ AppContent } = await server.ssrLoadModule("/src/Context/AppContent.js"));
  ({ default: CreateLesson } = await server.ssrLoadModule("/src/Pages/CreateLesson.jsx"));
  ({ default: LessonImportUploader } = await server.ssrLoadModule("/src/Components/LessonImportUploader.jsx"));
});

after(async () => {
  await server?.close();
  hmrServer?.close();
});

const render = (Component, props = {}, role = "leader") => renderToStaticMarkup(
  React.createElement(MemoryRouter, null,
    React.createElement(AppContent.Provider, { value: { backendUrl: "", userData: { role: [role], isAccountVerified: true } } },
      React.createElement(Component, props))));

test("document requests include the PDF, cancellation signal, and a bounded upload and parsing timeout", async (t) => {
  const file = new File(["%PDF-1.4 test"], "lesson.pdf", { type: "application/pdf" });
  const request = new AbortController();
  const response = { data: { success: true, draft: { title: "Faith", partitions: [{ title: "Introduction", body: "Text." }] } } };
  t.mock.method(axios, "post", async (url, body, options) => {
    assert.equal(url, "https://api.example.invalid/api/lessons/import");
    assert.equal(body.get("document"), file);
    assert.equal(options.signal, request.signal);
    assert.equal(options.timeout, LESSON_IMPORT_TIMEOUT_MS);
    assert.equal(options.timeout, 90_000);
    return response;
  });
  assert.equal(await requestLessonImport("https://api.example.invalid", file, request.signal), response);
});

test("stalled requests and gateway timeouts produce a clear retry message", async (t) => {
  const post = t.mock.method(axios, "post");
  const file = new File(["content"], "lesson.txt");
  for (const failure of [{ code: "ECONNABORTED" }, { code: "ETIMEDOUT" }, { response: { status: 408 } }, { response: { status: 504 } }]) {
    post.mock.mockImplementation(async () => { throw failure; });
    await assert.rejects(requestLessonImport("", file), /import timed out.*try again/i);
  }
});

test("proxy size errors are understandable and server validation and cancellation errors are preserved", async (t) => {
  const post = t.mock.method(axios, "post");
  const file = new File(["content"], "lesson.txt");
  post.mock.mockImplementation(async () => { throw { response: { status: 413, data: "Request Entity Too Large" } }; });
  await assert.rejects(requestLessonImport("", file), /server rejected this upload as too large/i);
  for (const failure of [
    { response: { status: 413, data: { message: "Split this lesson into smaller documents." } } },
    { response: { status: 422, data: { message: "Scanned PDFs need OCR." } } },
    { code: "ERR_CANCELED" },
  ]) {
    post.mock.mockImplementation(async () => { throw failure; });
    await assert.rejects(requestLessonImport("", file), (error) => error === failure);
  }
});

test("file selection accepts all supported extensions and rejects missing, empty, oversized, and unsupported documents", () => {
  for (const name of ["lesson.docx", "lesson.PDF", "lesson.html", "lesson.htm", "lesson.txt"]) {
    assert.equal(lessonDocumentFileError({ name, size: MAX_LESSON_DOCUMENT_BYTES }), null);
  }
  for (const file of [null, { name: "lesson.doc", size: 1 }, { name: "lesson.exe", size: 1 }, { name: "lesson.txt", size: 0 }, { name: "lesson.pdf", size: MAX_LESSON_DOCUMENT_BYTES + 1 }]) {
    assert.equal(typeof lessonDocumentFileError(file), "string");
  }
});

test("the importer explains supported formats, heading fallback, OCR, and draft replacement", () => {
  const html = render(LessonImportUploader, { onImported() {}, hasExistingContent: true, disabled: true });
  assert.match(html, /accept="\.docx,\.pdf,\.html,\.htm,\.txt"/);
  assert.match(html, /10 MB/);
  assert.match(html, /Documents without headings use one partition/);
  assert.match(html, /Scanned PDFs need OCR first/);
  assert.match(html, /replace the current lesson title and partitions/);
  assert.match(html, /type="file"[^>]*disabled=""/);
  assert.doesNotMatch(html, /<form/);
});

test("every lesson creator sees import alongside the unchanged required lesson fields", () => {
  for (const role of ["leader", "admin", "pamela", "pascal"]) {
    const html = render(CreateLesson, {}, role);
    assert.match(html, /Import a lesson document/);
    assert.match(html, /placeholder="Lesson title"[^>]*required=""/);
    assert.match(html, /placeholder="Lesson name"[^>]*required=""/);
    assert.match(html, /placeholder="Year"[^>]*required=""/);
    assert.match(html, /accept="image\/jpeg,image\/png,image\/webp"[^>]*required=""/);
    assert.equal((html.match(/<form/g) || []).length, 1, "The uploader must not introduce a nested form");
  }
  const denied = render(CreateLesson, {}, "parent");
  assert.match(denied, /You do not have permission/);
  assert.doesNotMatch(denied, /Import a lesson document/);
});
