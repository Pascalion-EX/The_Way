import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";
import { MAX_LESSON_DOCUMENT_BYTES } from "../../shared/lessonImport.mjs";

// Use the YAML reader supplied by the project's installed ESLint tooling.
const { load } = createRequire(import.meta.resolve("eslint"))("js-yaml");
const { http } = load(await readFile(new URL("../../deployment/traefik/dynamic.yml", import.meta.url), "utf8"));

test("production document imports bypass the general JSON limit and allow a full multipart upload", async () => {
  const route = http.routers["lesson-import"];
  assert.match(route.rule, /Host\(`/);
  assert.match(route.rule, /Method\(`POST`\)/);
  assert.match(route.rule, /Path\(`\/api\/lessons\/import`\)/);
  assert.equal(route.service, "api");
  assert.ok(route.priority > http.routers.api.priority);
  assert.ok(route.middlewares.includes("security-headers"));
  assert.ok(!route.middlewares.includes("api-body-limit"));
  const middleware = route.middlewares.find((name) => http.middlewares[name]?.buffering);
  const limit = http.middlewares[middleware].buffering;
  const body = new FormData();
  body.append("document", new Blob([new Uint8Array(MAX_LESSON_DOCUMENT_BYTES)], { type: "application/pdf" }), "lesson.pdf");
  const request = new Request("https://way.example.invalid/api/lessons/import", { method: "POST", body });
  const size = (await request.arrayBuffer()).byteLength;
  assert.ok(size > MAX_LESSON_DOCUMENT_BYTES, "Multipart overhead must be allowed above the file limit");
  assert.ok(size <= limit.maxRequestBodyBytes, "The largest accepted document must reach the API through Traefik");
  assert.ok(limit.maxRequestBodyBytes <= MAX_LESSON_DOCUMENT_BYTES + 64 * 1024);
  assert.equal(limit.memRequestBodyBytes, limit.maxRequestBodyBytes, "The read-only proxy must not need temporary disk storage");
});

test("production retains the existing JSON and image upload limits", () => {
  assert.ok(http.routers.api.middlewares.includes("api-body-limit"));
  assert.equal(http.middlewares["api-body-limit"].buffering.maxRequestBodyBytes, 100000);
  assert.ok(http.routers["image-upload"].middlewares.includes("image-body-limit"));
  assert.equal(http.middlewares["image-body-limit"].buffering.maxRequestBodyBytes, 5 * 1024 * 1024);
});
