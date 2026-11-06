import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { setImmediate } from "node:timers";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { transformWithEsbuild } from "vite";
import { AppContent } from "../src/Context/AppContent.js";
import { canManagePrayers } from "../../shared/pageAccess.mjs";
import { PRAYER_LANGUAGES, getPrayerSlides } from "../../shared/prayerSlides.mjs";

const dataUrl = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
const emptyComponent = dataUrl("export default () => null;");
const prayers = [{ _id: "prayer-id", title: "Prayer of thanksgiving" }];
const listHook = dataUrl(`export default () => ({ items: ${JSON.stringify(prayers)}, loading: false,
  pagination: {}, setPage() {}, setFilters() {}, refresh() {}, filters: { search: "" } });`);

async function compileModule(path) {
  const { code } = await transformWithEsbuild(await readFile(path, "utf8"), path.pathname, { jsx: "automatic", format: "esm" });
  const targets = new Map();
  for (const [, specifier] of code.matchAll(/from "([^"]+)"/g)) {
    const target = specifier.includes("Navbar") || specifier.includes("Pagination") ? emptyComponent :
      specifier.includes("usePaginatedList") ? listHook :
      specifier.includes("imageUrls") ? dataUrl((await readFile(new URL(specifier, path), "utf8")).replace('import.meta.env.VITE_BACKEND_URL || ""', '""')) :
      specifier.endsWith(".jsx") ? await compileModule(new URL(specifier, path)) :
      specifier.includes("utils/axios") ? new URL("../src/utils/axios.js", import.meta.url).href :
      specifier.startsWith(".") ? new URL(specifier, path).href : import.meta.resolve(specifier);
    targets.set(specifier, target);
  }
  return dataUrl(code.replace(/from "([^"]+)"/g, (_, specifier) => `from ${JSON.stringify(targets.get(specifier))}`));
}

const compilePage = async (name) => import(await compileModule(new URL(`../src/Pages/${name}.jsx`, import.meta.url)));

const render = (Component, roles) => renderToStaticMarkup(React.createElement(MemoryRouter, null,
  React.createElement(AppContent.Provider, { value: { backendUrl: "", userData: { role: roles } } }, React.createElement(Component))));

test("Prayer has a viewer link for all members and add/edit controls only for its managers", async () => {
  const { default: Prayer } = await compilePage("Prayer");
  for (const roles of [["parent"], ["leader"], ["child"], ["admin"], ["pascal"], ["pamela"], ["leader", "pamela"]]) {
    const html = render(Prayer, roles);
    assert.match(html, /<h1[^>]*>Prayer<\/h1>/);
    assert.match(html, /Prayer of thanksgiving/);
    assert.match(html, /href="\/prayer\/prayer-id"/);
    assert.equal(html.includes('href="/prayer/new"'), canManagePrayers(roles));
    assert.equal(html.includes('href="/prayer/prayer-id/edit"'), canManagePrayers(roles));
    assert.equal(html.includes("Delete prayer"), canManagePrayers(roles));
  }
});

test("prayer editors offer three languages and slide instructions while leaders and members cannot edit", async () => {
  const { default: Editor } = await compilePage("PrayerEditor");
  for (const roles of [["admin"], ["pascal"], ["pamela"]]) {
    const html = render(Editor, roles);
    assert.match(html, /Add prayer/);
    assert.match(html, /Each card is one presentation slide/);
    assert.match(html, /Arabic prayer text/);
    assert.match(html, /Coptic prayer text/);
    assert.match(html, /English prayer text/);
    assert.match(html, /dir="rtl" lang="ar"/);
    assert.match(html, /maxLength="120"/);
    assert.match(html, /Arabic slide 1 image/);
    assert.match(html, /Coptic slide 1 image/);
    assert.match(html, /English slide 1 image/);
    assert.equal((html.match(/accept="image\/jpeg,image\/png,image\/webp"/g) || []).length, 3);
    assert.equal((html.match(/<form/g) || []).length, 1);
  }
  for (const roles of [["parent"], ["leader"], ["child"]]) {
    const html = render(Editor, roles);
    assert.match(html, /Only admin, Pascal, and Pamela/);
    assert.doesNotMatch(html, /<form|<textarea/);
  }
});

const viewerSource = await readFile(new URL("../src/Pages/ChantViewer.jsx", import.meta.url), "utf8");
const { code: viewerCode } = await transformWithEsbuild(viewerSource, "ChantViewer.jsx", { loader: "jsx", format: "cjs", jsx: "automatic" });
const listSource = await readFile(new URL("../src/Pages/Prayer.jsx", import.meta.url), "utf8");
const { code: listCode } = await transformWithEsbuild(listSource, "Prayer.jsx", { loader: "jsx", format: "cjs", jsx: "automatic" });
const editorSource = await readFile(new URL("../src/Pages/PrayerEditor.jsx", import.meta.url), "utf8");
const { code: editorCode } = await transformWithEsbuild(editorSource, "PrayerEditor.jsx", { loader: "jsx", format: "cjs", jsx: "automatic" });
const children = (node) => Array.isArray(node) ? node : [node];
const nodeText = (node) => Array.isArray(node) ? node.map(nodeText).join("") : node == null || typeof node === "boolean" ? "" : typeof node !== "object" ? String(node) : children(node.props?.children).map(nodeText).join("");
const find = (node, predicate) => {
  if (!node || typeof node !== "object") return null;
  if (predicate(node)) return node;
  for (const child of children(node.props?.children)) {
    const result = Array.isArray(child) ? child.map((entry) => find(entry, predicate)).find(Boolean) : find(child, predicate);
    if (result) return result;
  }
  return null;
};

async function mountViewer({ roles = ["parent"], contentType = "prayer", failure = false,
  page = "viewer", confirmed = true, deleteFailure = false, holdDelete = false, slides, editorId } = {}) {
  const values = [];
  const effects = [];
  const pending = [];
  const events = new Map();
  const requests = [];
  const navigations = [];
  const deletions = [];
  const prompts = [];
  const messages = { errors: [], successes: [] };
  const saves = [];
  let finishDelete;
  let refreshes = 0;
  const navigate = (path) => navigations.push(path);
  let cursor = 0;
  let tree;
  let fullscreenRequests = 0;
  const record = {
    _id: "test-id", title: "Thanksgiving", category: "Praise",
    lyrics: { arabic: "صلاة الشكر\n\nنشكرك يا رب", english: "We give thanks.\n\nAmen." },
    text: { arabic: "صلاة الشكر\n\nنشكرك يا رب", english: "We give thanks.\n\nAmen." },
    ...(slides ? { slides } : {}),
  };
  const jsx = (type, props) => ({ type, props });
  class Element { closest() { return null; } }
  const module = { exports: {} };
  const save = async (url, body) => {
    saves.push({ url, body: JSON.parse(JSON.stringify(body)) });
    return { data: { success: true, prayer: { _id: record._id } } };
  };
  runInNewContext(page === "list" ? listCode : page === "editor" ? editorCode : viewerCode, {
    module,
    AbortController,
    crypto,
    TextEncoder,
    Set,
    HTMLElement: Element,
    window: { addEventListener: (name, callback) => events.set(name, callback), removeEventListener: (name) => events.delete(name),
      confirm(message) { prompts.push(message); return confirmed; } },
    document: { fullscreenElement: null, documentElement: { requestFullscreen() { fullscreenRequests++; } } },
    require(specifier) {
      if (specifier === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (specifier === "react") return {
        useContext: () => ({ backendUrl: "https://api.example.invalid", userData: { role: roles } }),
        useState(initial) {
          const index = cursor++;
          if (!(index in values)) values[index] = typeof initial === "function" ? initial() : initial;
          return [values[index], (next) => { values[index] = typeof next === "function" ? next(values[index]) : next; }];
        },
        useMemo: (factory) => factory(),
        useRef(initial) {
          const index = cursor++;
          if (!(index in values)) values[index] = { current: initial };
          return values[index];
        },
        useEffect(callback, dependencies) {
          const index = cursor++;
          if (!effects[index] || dependencies.some((dependency, position) => dependency !== effects[index].dependencies[position])) pending.push(() => {
            effects[index]?.cleanup?.();
            effects[index] = { dependencies, cleanup: callback() };
          });
        },
      };
      if (specifier === "react-router-dom") return { useParams: () => ({ id: page === "editor" ? editorId : record._id }), useNavigate: () => navigate, Link: "a" };
      if (specifier.includes("usePaginatedList")) return () => ({ items: [record], loading: false, filters: { search: "" }, pagination: {}, refresh() { refreshes++; } });
      if (specifier.includes("AppContent")) return { AppContent: {} };
      if (specifier.includes("pageAccess")) return { canManagePrayers };
      if (specifier.includes("prayerSlides")) return { PRAYER_LANGUAGES, getPrayerSlides };
      if (specifier.includes("ContentImage")) return "slide-image";
      if (specifier.includes("ImageUpload")) return "image-upload";
      if (specifier.includes("youtubePlayer")) return { getYouTubeEmbedUrl: () => "" };
      if (specifier.includes("axios")) return { defaults: {}, post: save, put: save, get: async (url) => {
        requests.push(url);
        if (failure) throw new Error("Unable to load");
        return { data: { success: true, [contentType]: record } };
      }, delete: async (url) => {
        deletions.push(url);
        if (holdDelete) await new Promise((resolve) => { finishDelete = resolve; });
        if (deleteFailure === true) throw new Error("Unable to delete prayer");
        return { data: { success: !deleteFailure, message: deleteFailure ? "Unable to delete prayer" : "Prayer deleted" } };
      } };
      if (specifier === "react-toastify") return { toast: { error: (message) => messages.errors.push(message), success: (message) => messages.successes.push(message) } };
      if (specifier === "jspdf") return class {};
      if (specifier === "lucide-react") return { BookOpen: () => null };
      if (specifier.includes("Navbar") || specifier.includes("ContentVideo") || specifier.includes("ChantYouTubePlayer") || specifier.includes("Pagination")) return () => null;
      throw new Error(`Unexpected viewer import: ${specifier}`);
    },
  });
  const expandEditor = (node) => {
    if (!node || typeof node !== "object") return node;
    if (Array.isArray(node)) return node.map(expandEditor);
    if (typeof node.type === "function" && node.type.name === "PrayerEditorForm") return expandEditor(node.type(node.props));
    return { ...node, props: { ...node.props, children: Array.isArray(node.props.children) ? node.props.children.map(expandEditor) : expandEditor(node.props.children) } };
  };
  const render = () => {
    cursor = 0;
    tree = expandEditor(module.exports.default({ contentType }));
    pending.splice(0).forEach((effect) => effect());
    return tree;
  };
  render();
  await new Promise((resolve) => setImmediate(resolve));
  render();
  render();
  return {
    requests, navigations, render, deletions, prompts, messages, saves,
    finishDelete: () => finishDelete(),
    get refreshes() { return refreshes; },
    get tree() { return tree; },
    get fullscreenRequests() { return fullscreenRequests; },
    button(label) { return find(tree, (node) => node.type === "button" && nodeText(node).trim() === label); },
    key(key, input = false) { const target = new Element(); if (input) target.closest = () => ({}); events.get("keydown")({ key, target, preventDefault() {} }); render(); },
    cleanup() { effects.forEach((effect) => effect?.cleanup?.()); },
  };
}

test("prayers reuse the chant viewer's language, slide, keyboard, fullscreen and projector controls", async () => {
  const viewer = await mountViewer();
  try {
    assert.deepEqual(viewer.requests, ["https://api.example.invalid/api/prayers/test-id"]);
    assert.match(nodeText(viewer.tree), /صلاة الشكر/);
    assert.equal(find(viewer.tree, (node) => node.type === "p" && node.props.dir === "rtl").props.children, "صلاة الشكر");
    assert.equal(viewer.button("Previous").props.disabled, true);
    viewer.button("Next").props.onClick(); viewer.render();
    assert.match(nodeText(viewer.tree), /نشكرك يا رب/);
    assert.equal(viewer.button("Next").props.disabled, true);
    viewer.key("ArrowLeft", true);
    assert.match(nodeText(viewer.tree), /نشكرك يا رب/);
    viewer.key("ArrowLeft");
    assert.match(nodeText(viewer.tree), /صلاة الشكر/);
    viewer.button("English").props.onClick(); viewer.render(); viewer.render();
    assert.match(nodeText(viewer.tree), /We give thanks\./);
    viewer.button("Projector Mode").props.onClick(); viewer.render();
    assert.equal(viewer.tree.props["data-projector-mode"], "");
    assert.ok(viewer.button("Exit Projector"));
    viewer.key("ArrowRight");
    assert.match(nodeText(viewer.tree), /Amen\./);
    viewer.button("Full Screen").props.onClick();
    assert.equal(viewer.fullscreenRequests, 1);
    viewer.key("Escape");
    assert.equal(viewer.tree.props["data-projector-mode"], undefined);
    assert.equal(viewer.button("Edit"), null);
    assert.equal(viewer.button("Delete"), null);
    assert.equal(viewer.button("Delete prayer"), null);
  } finally { viewer.cleanup(); }
});

test("prayer management roles stay narrower than chant roles and failed prayer reads return to Prayer", async () => {
  for (const roles of [["leader"], ["admin"], ["pascal"], ["pamela"]]) {
    const viewer = await mountViewer({ roles });
    assert.equal(Boolean(viewer.button("Edit")), canManagePrayers(roles));
    assert.equal(Boolean(viewer.button("Delete prayer")), canManagePrayers(roles));
    if (viewer.button("Edit")) { viewer.button("Edit").props.onClick(); assert.deepEqual(viewer.navigations, ["/prayer/test-id/edit"]); }
    viewer.cleanup();
  }
  const chant = await mountViewer({ roles: ["leader"], contentType: "chant" });
  assert.deepEqual(chant.requests, ["https://api.example.invalid/api/chants/test-id"]);
  assert.ok(chant.button("Edit"));
  assert.ok(chant.button("Delete"));
  await chant.button("Delete").props.onClick();
  assert.deepEqual(chant.deletions, ["https://api.example.invalid/api/chants/test-id"]);
  assert.deepEqual(chant.navigations, ["/chants"]);
  chant.cleanup();
  const missing = await mountViewer({ failure: true });
  assert.deepEqual(missing.navigations, ["/prayer"]);
  missing.cleanup();
});

test("deletion requires confirmation, prevents duplicate requests, and returns from the viewer or refreshes the list", async () => {
  for (const page of ["viewer", "list"]) {
    const cancelled = await mountViewer({ roles: ["admin"], page, confirmed: false });
    await cancelled.button("Delete prayer").props.onClick();
    assert.equal(cancelled.prompts.length, 1);
    assert.match(cancelled.prompts[0], /Thanksgiving/);
    assert.deepEqual(cancelled.deletions, []);
    assert.deepEqual(cancelled.navigations, []);
    cancelled.cleanup();

    const confirmed = await mountViewer({ roles: ["pamela"], page, holdDelete: true });
    const button = confirmed.button("Delete prayer");
    const pending = button.props.onClick();
    confirmed.render();
    assert.equal(confirmed.button("Deleting...").props.disabled, true);
    await button.props.onClick();
    assert.equal(confirmed.deletions.length, 1);
    confirmed.finishDelete();
    await pending;
    assert.deepEqual(confirmed.deletions, ["https://api.example.invalid/api/prayers/test-id"]);
    assert.deepEqual(confirmed.messages.successes, ["Prayer deleted"]);
    assert.deepEqual(confirmed.navigations, page === "viewer" ? ["/prayer"] : []);
    assert.equal(confirmed.refreshes, page === "list" ? 1 : 0);
    confirmed.cleanup();
  }
});

test("failed prayer deletions keep the prayer visible and let the manager retry", async () => {
  for (const page of ["viewer", "list"]) {
    for (const deleteFailure of [true, "unsuccessful-response"]) {
      const viewer = await mountViewer({ roles: ["pascal"], page, deleteFailure });
      await viewer.button("Delete prayer").props.onClick();
      viewer.render();
      assert.equal(viewer.button("Delete prayer").props.disabled, false);
      assert.deepEqual(viewer.messages.errors, ["Unable to delete prayer"]);
      assert.deepEqual(viewer.messages.successes, []);
      assert.deepEqual(viewer.navigations, []);
      assert.equal(viewer.refreshes, 0);
      assert.match(nodeText(viewer.tree), /Thanksgiving/);
      viewer.cleanup();
    }
  }
});

test("slide images follow the selected prayer slide and language in normal and projector views", async () => {
  const images = ["a", "b"].map((letter) => `/uploads/${letter.repeat(64)}.webp`);
  const viewer = await mountViewer({ slides: {
    arabic: [{ text: "First slide\n\nSame slide", image: images[0] }, { text: "Second slide", image: images[1] }],
    english: [{ text: "English text", image: "" }], coptic: [],
  } });
  const image = () => find(viewer.tree, (node) => node.type === "slide-image");
  try {
    assert.equal(image().props.src, images[0]);
    assert.match(image().props.alt, /slide 1/);
    assert.match(image().props.className, /object-contain/);
    assert.match(nodeText(viewer.tree), /First slide\n\nSame slide/);
    viewer.button("Next").props.onClick(); viewer.render();
    assert.equal(image().props.src, images[1]);
    assert.match(nodeText(viewer.tree), /Second slide/);
    viewer.button("Projector Mode").props.onClick(); viewer.render();
    assert.equal(image().props.src, images[1]);
    assert.match(image().props.className, /max-h-\[60vh\]/);
    viewer.button("Exit Projector").props.onClick(); viewer.render();
    viewer.button("English").props.onClick(); viewer.render(); viewer.render();
    assert.equal(image(), null);
    assert.match(nodeText(viewer.tree), /English text/);
  } finally { viewer.cleanup(); }
  const imageOnly = await mountViewer({ slides: { arabic: [], coptic: [], english: [{ text: "", image: images[0] }] } });
  assert.equal(find(imageOnly.tree, (node) => node.type === "slide-image").props.src, images[0]);
  assert.doesNotMatch(nodeText(imageOnly.tree), /No prayer text available/);
  assert.equal(imageOnly.button("English").props.disabled, false);
  imageOnly.cleanup();
});

test("prayer slide editing waits for uploads and keeps text and images together when reordered", async () => {
  const editor = await mountViewer({ page: "editor", roles: ["admin"] });
  const image = (index) => find(editor.tree, (node) => node.type === "image-upload" && node.props.label === `Arabic slide ${index} image`);
  const slideText = (index) => {
    let count = 0;
    return find(editor.tree, (node) => node.type === "textarea" && node.props.lang === "ar" && ++count === index);
  };
  const title = find(editor.tree, (node) => node.type === "input" && node.props.placeholder === "Prayer title");
  title.props.onChange({ target: { value: "Illustrated prayer" } }); editor.render();
  slideText(1).props.onChange({ target: { value: "First slide" } }); editor.render();
  const firstUpload = image(1);
  firstUpload.props.onUploadingChange(true); editor.render();
  assert.equal(find(editor.tree, (node) => node.type === "fieldset").props.disabled, true);
  await find(editor.tree, (node) => node.type === "form").props.onSubmit({ preventDefault() {} });
  editor.render();
  assert.equal(editor.saves.length, 0);
  assert.match(nodeText(editor.tree), /wait for slide images/);
  const firstImage = `/uploads/${"a".repeat(64)}.webp`;
  firstUpload.props.onChange(firstImage);
  firstUpload.props.onUploadingChange(false); editor.render();
  assert.equal(find(editor.tree, (node) => node.type === "fieldset").props.disabled, false);
  editor.button("Add Arabic slide").props.onClick(); editor.render();
  slideText(2).props.onChange({ target: { value: "Second slide" } }); editor.render();
  const secondImage = `/uploads/${"b".repeat(64)}.webp`;
  image(2).props.onChange(secondImage); editor.render();
  find(editor.tree, (node) => node.props?.["aria-label"] === "Move Arabic slide 2 up").props.onClick(); editor.render();
  assert.equal(slideText(1).props.value, "Second slide");
  assert.equal(image(1).props.value, secondImage);
  assert.equal(slideText(2).props.value, "First slide");
  assert.equal(image(2).props.value, firstImage);
  image(2).props.onChange(""); editor.render();
  await find(editor.tree, (node) => node.type === "form").props.onSubmit({ preventDefault() {} });
  assert.equal(editor.saves.length, 1);
  assert.deepEqual(editor.saves[0], { url: "https://api.example.invalid/api/prayers", body: {
    title: "Illustrated prayer", slides: { arabic: [{ text: "Second slide", image: secondImage }, { text: "First slide", image: "" }], coptic: [], english: [] },
  } });
  assert.deepEqual(editor.navigations, ["/prayer/test-id"]);
  editor.cleanup();
});

test("existing prayers load legacy text or saved slide images into editable slide cards", async () => {
  const legacy = await mountViewer({ page: "editor", roles: ["pascal"], editorId: "test-id" });
  assert.ok(find(legacy.tree, (node) => node.type === "image-upload" && node.props.label === "Arabic slide 2 image"));
  assert.ok(find(legacy.tree, (node) => node.type === "image-upload" && node.props.label === "English slide 2 image"));
  legacy.cleanup();
  const image = `/uploads/${"c".repeat(64)}.webp`;
  const editor = await mountViewer({ page: "editor", roles: ["pamela"], editorId: "test-id", slides: { arabic: [{ text: "Saved text", image }], coptic: [], english: [] } });
  const upload = find(editor.tree, (node) => node.type === "image-upload" && node.props.label === "Arabic slide 1 image");
  assert.equal(upload.props.value, image);
  await find(editor.tree, (node) => node.type === "form").props.onSubmit({ preventDefault() {} });
  assert.equal(editor.saves[0].url, "https://api.example.invalid/api/prayers/test-id");
  assert.deepEqual(editor.saves[0].body.slides.arabic, [{ text: "Saved text", image }]);
  editor.cleanup();
});
