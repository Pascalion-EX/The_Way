import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import User from "../models/userModel.js";
import Lesson from "../models/lessonModel.js";
import Counters from "../models/authRateLimitModel.js";
import lessonRouter from "../routes/lessonRoutes.js";
import { parseLessonHtml, parseLessonText, parseLessonDocument } from "../services/lessonDocumentParser.js";
import { extractLessonDraft } from "../services/lessonImports.js";
import { MAX_LESSON_DOCUMENT_BYTES } from "../../shared/lessonImport.mjs";
import { lessonDocx, lessonPdf } from "./helpers/lessonDocuments.js";

const userId = "6ab26b08171afea3091f04b3";
const expectedPartitions = [
  { title: "Introduction", body: "God loves us." },
  { title: "Activity", body: "Pray together." },
];

async function setup(t) {
  const previous = process.env.JWT_SECRET;
  const secret = "test-only-lesson-import-secret";
  process.env.JWT_SECRET = secret;
  t.after(() => {
    if (previous === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previous;
  });
  const state = {
    user: { _id: userId, role: ["leader"], isAccountVerified: true, tokenVersion: 0 },
    writes: [], counter: 0, counterOutage: false,
  };
  t.mock.method(User.collection, "findOne", async () => structuredClone(state.user));
  t.mock.method(User, "findOneAndUpdate", async () => ({ accessDeniedCount: 1 }));
  t.mock.method(Counters.collection, "findOneAndUpdate", async () => {
    if (state.counterOutage) throw new Error("Private database details");
    return { count: ++state.counter };
  });
  t.mock.method(Lesson.collection, "insertOne", async (document) => {
    state.writes.push(document);
    return { acknowledged: true, insertedId: document._id };
  });
  t.mock.method(Lesson.collection, "findOne", async (filter) => state.writes.find((lesson) => String(lesson._id) === String(filter._id)) || null);
  const app = express();
  app.use(cookieParser());
  app.use(express.json({ limit: "100kb" }));
  app.use("/api/lessons", lessonRouter);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  const url = `http://127.0.0.1:${server.address().port}/api/lessons`;
  const token = jwt.sign({ id: userId, tokenVersion: 0, role: ["admin"] }, secret, { expiresIn: "1h" });
  state.request = async (path, body, { authenticated = true, headers = {} } = {}) => {
    const response = await fetch(url + path, {
      method: "POST", body,
      headers: { ...(authenticated ? { Cookie: `token=${token}` } : {}), ...headers },
    });
    return { status: response.status, headers: response.headers, body: await response.json() };
  };
  state.upload = (buffer, name = "lesson.txt", options = {}) => {
    const body = new FormData();
    body.append("document", new Blob([buffer], { type: options.type || "application/octet-stream" }), name);
    if (options.extra) body.append("role", "admin");
    if (options.secondFile) body.append("document", new Blob([buffer]), name);
    return state.request("/import", body, options);
  };
  return state;
}

test("HTML headings split editable text while preserving preambles, lists, tables, and Arabic", () => {
  const result = parseLessonHtml('<title>Faith</title><p>Before the headings.</p><h1>المقدمة</h1><p>الله يحبنا.</p><h2>Activity</h2><ul><li>Pray <b>together</b>.</li><li>Sing.</li></ul><table><tr><td>Question</td><td>Answer</td></tr></table>', "lesson.html");
  assert.equal(result.draft.title, "Faith");
  assert.deepEqual(result.draft.partitions, [
    { title: "Introduction", body: "Before the headings." },
    { title: "المقدمة", body: "الله يحبنا." },
    { title: "Activity", body: "• Pray together.\n\n• Sing.\n\nQuestion\tAnswer" },
  ]);
});

test("HTML import returns plain text and excludes active content and attributes", () => {
  const { draft } = parseLessonHtml('<h1>Faith</h1><script>private-script</script><style>private-style</style><iframe>private-frame</iframe><p onclick="private-handler">Safe <a href="javascript:private-link">text</a><br>Next line.</p><img src="https://private.invalid/image">', "lesson.html");
  assert.deepEqual(draft.partitions, [{ title: "Faith", body: "Safe text\nNext line." }]);
  assert.doesNotMatch(JSON.stringify(draft), /private|<|>/);
});

test("plain prose becomes one editable partition and explicit text headings split predictably", () => {
  const plain = "God loves us.\n\nWe pray together.";
  const fallback = parseLessonText(plain, "Faith_lesson.txt");
  assert.equal(fallback.draft.title, "Faith lesson");
  assert.deepEqual(fallback.draft.partitions, [{ title: "Lesson content", body: plain }]);
  assert.equal(fallback.warnings.length, 1);
  for (const source of ["# Faith\n## Introduction\nGod loves us.\n## Activity\nPray together.", "Faith\n===\nIntroduction\n---\nGod loves us.\nActivity\n---\nPray together."]) {
    assert.deepEqual(parseLessonText(source, "lesson.txt").draft, { title: "Faith", partitions: expectedPartitions });
  }
});

test("real Word documents and PDFs convert into headed partitions", async () => {
  assert.deepEqual((await parseLessonDocument(lessonDocx(), "faith.docx")).draft, { title: "Faith", partitions: expectedPartitions });
  const pdf = await parseLessonDocument(lessonPdf(), "faith.pdf");
  assert.deepEqual(pdf.draft.partitions, expectedPartitions.map((partition) => ({ ...partition, title: partition.title.toUpperCase() })));
  assert.doesNotMatch(JSON.stringify(pdf), /-- 1 of 1 --/);
});

test("empty, textless, malformed, and oversized drafts return actionable errors without truncation", async () => {
  assert.throws(() => parseLessonText(" ", "empty.txt"), { code: "NO_DOCUMENT_TEXT" });
  assert.throws(() => parseLessonHtml("<img src='image.png'>", "image.html"), { code: "NO_DOCUMENT_TEXT" });
  assert.throws(() => parseLessonText("a".repeat(90 * 1024), "large.txt"), { code: "LESSON_IMPORT_TOO_LARGE" });
  await assert.rejects(parseLessonDocument(lessonPdf([]), "scan.pdf"), { code: "NO_DOCUMENT_TEXT" });
  await assert.rejects(parseLessonDocument(Buffer.from([0xff, 0xfe]), "invalid.txt"), /UTF-8/);
  await assert.rejects(parseLessonDocument(Buffer.from("not a pdf"), "fake.pdf"), /valid PDF/);
});

test("the worker terminates on its deadline and later imports still work", async () => {
  await assert.rejects(extractLessonDraft({ originalname: "faith.txt", buffer: Buffer.from("Body.") }, { timeoutMs: 1 }), { code: "LESSON_IMPORT_TIMEOUT" });
  const result = await extractLessonDraft({ originalname: "faith.txt", buffer: Buffer.from("Body.") });
  assert.equal(result.draft.partitions[0].body, "Body.");
});

test("the real import route accepts Word, PDF, HTML, and text and saves only through normal creation", async (t) => {
  const state = await setup(t);
  let imported;
  for (const [name, buffer] of [
    ["faith.docx", lessonDocx()], ["faith.pdf", lessonPdf()],
    // A valid PDF above the old production proxy's 100 KB JSON allowance.
    ["large-faith.pdf", lessonPdf(["INTRODUCTION", "God loves us.", " ".repeat(150_000)])],
    ["faith.html", "<h1>Faith</h1><p>God loves us.</p>"], ["faith.txt", "God loves us."],
  ]) {
    imported = await state.upload(buffer, name);
    assert.equal(imported.status, 200, JSON.stringify(imported.body));
    assert.equal(imported.body.success, true);
    assert.ok(imported.body.draft.partitions.length);
    assert.equal(imported.headers.get("cache-control"), "private, no-store");
    assert.equal(state.writes.length, 0, "Import must not persist a lesson");
  }
  const draft = imported.body.draft;
  const missing = await state.request("", JSON.stringify(draft), { headers: { "Content-Type": "application/json" } });
  assert.equal(missing.status, 400);
  assert.equal(state.writes.length, 0);
  const saved = await state.request("", JSON.stringify({ ...draft, name: "Service team", image: "/uploads/lesson.webp", year: 2 }), { headers: { "Content-Type": "application/json" } });
  assert.equal(saved.status, 201);
  assert.equal(state.writes.length, 1);
  assert.equal(saved.body.lesson.partitions[0].body, draft.partitions[0].body);
});

test("a Word import can be reviewed and saved as a variant with its own uploaded image", async (t) => {
  const state = await setup(t);
  const headers = { "Content-Type": "application/json" };
  const source = await state.request("", JSON.stringify({
    title: "Original lesson", name: "Service", image: "https://example.com/original.jpg", year: 3,
    partitions: [{ title: "Original section", body: "Original text" }], activity: "Original activity",
  }), { headers });
  assert.equal(source.status, 201);
  const before = JSON.stringify(state.writes[0]);
  const imported = await state.upload(lessonDocx(), "faith.docx");
  assert.equal(imported.status, 200);
  assert.equal(state.writes.length, 1, "Import must not create or modify a lesson");
  const image = `/uploads/${"c".repeat(64)}.webp`;
  const saved = await state.request(`/${source.body.lesson._id}/variants`, JSON.stringify({
    name: "Younger group", draft: imported.body.draft, image,
  }), { headers });
  assert.equal(saved.status, 201);
  assert.equal(saved.body.lesson.name, "Younger group");
  assert.equal(saved.body.lesson.title, "Faith");
  assert.equal(saved.body.lesson.image, image);
  assert.equal(saved.body.lesson.variantGroup, source.body.lesson._id);
  assert.equal(saved.body.lesson.year, 3);
  assert.equal(saved.body.lesson.activity, "Original activity");
  assert.deepEqual(saved.body.lesson.partitions.map(({ title, body }) => ({ title, body })), expectedPartitions);
  assert.equal(state.writes.length, 2);
  assert.equal(JSON.stringify(state.writes[0]), before);
});

test("import authorization checks current roles before accepting uploads", async (t) => {
  const state = await setup(t);
  for (const role of ["leader", "admin", "pascal", "pamela"]) {
    state.user.role = [role];
    assert.equal((await state.upload("Content.")).status, 200);
  }
  const counter = state.counter;
  assert.equal((await state.upload("Content.", "lesson.txt", { authenticated: false })).status, 401);
  state.user.isAccountVerified = false;
  assert.equal((await state.upload("Content.")).body.code, "EMAIL_VERIFICATION_REQUIRED");
  state.user.isAccountVerified = true;
  state.user.role = ["parent"];
  assert.equal((await state.upload("Content.")).status, 403);
  state.user.role = ["leader"];
  state.user.isBanned = true;
  assert.equal((await state.upload("Content.")).body.code, "ACCOUNT_BANNED");
  assert.equal(state.counter, counter, "Denied requests must not consume import quota or parse a document");
});

test("upload errors, spoofed files, and parser failures return JSON without internal details", async (t) => {
  const state = await setup(t);
  for (const [name, buffer, options, status] of [
    ["lesson.exe", "bad", {}, 415], ["lesson.doc", "old Word", {}, 415],
    ["empty.txt", "", {}, 400], ["fake.pdf", "not a pdf", {}, 422],
    ["bad.docx", "PK not a Word document", {}, 422],
    ["scan.pdf", lessonPdf([]), {}, 422],
    ["lesson.txt", "Content", { extra: true }, 400],
    ["lesson.txt", "Content", { secondFile: true }, 400],
    ["large.txt", Buffer.alloc(MAX_LESSON_DOCUMENT_BYTES + 1, 97), {}, 413],
  ]) {
    const result = await state.upload(buffer, name, options);
    assert.equal(result.status, status, `${name}: ${JSON.stringify(result.body)}`);
    assert.equal(result.body.success, false);
    assert.doesNotMatch(JSON.stringify(result.body), /node_modules|Error:|stack|\/home\//);
  }
  const json = await state.request("/import", JSON.stringify({ document: "/etc/passwd" }), { headers: { "Content-Type": "application/json" } });
  assert.equal(json.status, 415);
});

test("imports enforce the account quota and fail closed during counter outages", async (t) => {
  const state = await setup(t);
  state.counter = 20;
  const limited = await state.upload("Content.");
  assert.equal(limited.status, 429);
  assert.equal(limited.body.code, "LESSON_IMPORT_RATE_LIMITED");
  state.counterOutage = true;
  assert.equal((await state.upload("Content.")).status, 503);
  assert.equal(state.writes.length, 0);
});
