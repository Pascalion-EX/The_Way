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

test("paid camp applications allow a full payment screenshot and form fields through the production proxy", async () => {
  const route = http.routers["camp-payment-application"];
  assert.match(route.rule, /Host\(`/);
  assert.match(route.rule, /Method\(`POST`\)/);
  const pattern = new RegExp(route.rule.match(/PathRegexp\(`([^`]+)`\)/)[1]);
  assert.ok(pattern.test(`/api/camps/${"a".repeat(24)}/apply`));
  for (const path of ["/api/camps", `/api/camps/${"a".repeat(24)}`, "/api/camps/invalid/apply", `/api/camps/${"a".repeat(24)}/apply/other`]) assert.ok(!pattern.test(path));
  assert.equal(route.service, "api");
  assert.ok(route.priority > http.routers.api.priority);
  assert.ok(route.middlewares.includes("security-headers"));
  assert.ok(!route.middlewares.includes("api-body-limit"));
  const limit = http.middlewares["camp-payment-body-limit"].buffering;
  const body = new FormData();
  body.append("paymentScreenshot", new Blob([new Uint8Array(5 * 1024 * 1024)], { type: "image/png" }), "payment.png");
  for (const field of ["applicationType", "childName", "childYear", "parentPhone", "servantName", "servantRole", "notes"]) body.append(field, "a".repeat(10 * 1024));
  const request = new Request(`https://way.example.invalid/api/camps/${"a".repeat(24)}/apply`, { method: "POST", body });
  assert.ok((await request.arrayBuffer()).byteLength <= limit.maxRequestBodyBytes);
  assert.equal(limit.memRequestBodyBytes, limit.maxRequestBodyBytes);
});
