import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithEsbuild } from "vite";
import { AppContent } from "../src/Context/AppContent.js";

const dataUrl = (code) => `data:text/javascript,${encodeURIComponent(code)}`;
const helperSource = await readFile(new URL("../src/utils/imageUrls.js", import.meta.url), "utf8");
const helperUrl = (backend) => dataUrl(helperSource.replace('import.meta.env.VITE_BACKEND_URL || ""', JSON.stringify(backend)));

test("uploaded image paths use the configured API origin while existing links remain visible", async () => {
  const path = `/uploads/${"a".repeat(64)}.webp`;
  for (const backend of ["", "https://api.example.invalid", "https://api.example.invalid/"]) {
    const { contentImageUrl } = await import(helperUrl(backend));
    assert.equal(contentImageUrl(path), backend.replace(/\/$/, "") + path);
    for (const existing of ["https://images.example.invalid/old.jpg", "/avatars/mark.png", "", undefined]) {
      assert.equal(contentImageUrl(existing), existing);
    }
  }
});

test("real image picker renders file selection, upload constraints, previews, and required/optional states", async () => {
  const imageSource = await readFile(new URL("../src/Components/ContentImage.jsx", import.meta.url), "utf8");
  const compiledImage = await transformWithEsbuild(imageSource, "ContentImage.jsx", { jsx: "automatic", format: "esm" });
  const imageUrl = dataUrl(compiledImage.code
    .replace('"react/jsx-runtime"', JSON.stringify(import.meta.resolve("react/jsx-runtime")))
    .replace('"../utils/imageUrls.js"', JSON.stringify(helperUrl("https://api.example.invalid"))));
  const pickerSource = await readFile(new URL("../src/Components/ImageUpload.jsx", import.meta.url), "utf8");
  const compiledPicker = await transformWithEsbuild(pickerSource, "ImageUpload.jsx", { jsx: "automatic", format: "esm" });
  const code = compiledPicker.code
    .replace('"react/jsx-runtime"', JSON.stringify(import.meta.resolve("react/jsx-runtime")))
    .replace('"react"', JSON.stringify(import.meta.resolve("react")))
    .replace('"../Context/AppContent.js"', JSON.stringify(new URL("../src/Context/AppContent.js", import.meta.url).href))
    .replace('"../utils/axios"', JSON.stringify(new URL("../src/utils/axios.js", import.meta.url).href))
    .replace('"./ContentImage.jsx"', JSON.stringify(imageUrl));
  const { default: ImageUpload } = await import(dataUrl(code));
  const render = (props) => renderToStaticMarkup(React.createElement(AppContent.Provider,
    { value: { backendUrl: "https://api.example.invalid" } },
    React.createElement(ImageUpload, { value: "", onChange() {}, onUploadingChange() {}, ...props })));
  const empty = render({ required: true });
  assert.match(empty, /type="file"/);
  assert.match(empty, /accept="image\/jpeg,image\/png,image\/webp"/);
  assert.match(empty, /required=""/);
  assert.match(empty, /5 MB/);
  assert.doesNotMatch(empty, /type="url"/);
  const existing = render({ required: true, value: "https://images.example.invalid/old.jpg" });
  assert.match(existing, /src="https:\/\/images.example.invalid\/old.jpg"/);
  assert.doesNotMatch(existing, /required=""|Remove image/);
  const uploaded = render({ value: `/uploads/${"b".repeat(64)}.webp` });
  assert.match(uploaded, /src="https:\/\/api.example.invalid\/uploads\//);
  assert.match(uploaded, /Remove image/);
  assert.match(render({ disabled: true }), /disabled=""/);
});
