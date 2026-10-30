import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { transformWithEsbuild } from "vite";
import { AppContent } from "../src/Context/AppContent.js";

const dataUrl = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
const hiddenContent = "FULL_CONTENT_SHOULD_ONLY_APPEAR_IN_THE_VIEWER";
const record = {
  _id: "6ab26af3171afea3091f04af", name: "Card name", title: "Card title",
  image: `/uploads/${"a".repeat(64)}.webp`, year: 3, years: [3],
  body: hiddenContent, description: hiddenContent, materials: hiddenContent, explanation: hiddenContent,
  partitions: [{ title: "Section", body: hiddenContent }], lyrics: { english: hiddenContent },
  video: "https://www.youtube.com/embed/M7lc1UVf-VE", isFavorite: true, hasApplied: true,
};
const contextUrl = new URL("../src/Context/AppContent.js", import.meta.url).href;
const hookUrl = dataUrl(`export default () => ({
  items: [${JSON.stringify(record)}], loading: false,
  filters: { search: "", year: "0", sortOrder: "asc" },
  setItems() {}, setPage() {}, setFilters() {}, refresh() {}
});`);
const emptyComponentUrl = dataUrl("export default () => null;");
const helperSource = await readFile(new URL("../src/utils/imageUrls.js", import.meta.url), "utf8");
const helperUrl = dataUrl(helperSource.replace('import.meta.env.VITE_BACKEND_URL || ""', '""'));

async function compile(path, overrides = {}) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const { code } = await transformWithEsbuild(source, path, { jsx: "automatic", format: "esm" });
  return dataUrl(code.replace(/from "([^"]+)"/g, (_, specifier) => {
    const target = overrides[specifier] || (
      specifier === "../Context/AppContent.js" ? contextUrl :
      specifier.startsWith("../utils/axios") ? new URL("../src/utils/axios.js", import.meta.url).href :
      specifier.startsWith(".") ? new URL(specifier, new URL(path, import.meta.url)).href :
      import.meta.resolve(specifier)
    );
    return `from ${JSON.stringify(target)}`;
  }));
}

const imageUrl = await compile("../src/Components/ContentImage.jsx", { "../utils/imageUrls.js": helperUrl });
const chantUrl = await compile("../src/Components/chantCard.jsx", { "./ContentImage.jsx": imageUrl });
const overrides = {
  "../Components/ContentImage.jsx": imageUrl,
  "../Components/Pagination.jsx": emptyComponentUrl,
  "../hooks/usePaginatedList.js": hookUrl,
  "@/Components/Navbar.jsx": emptyComponentUrl,
  "@/Components/Navbar": emptyComponentUrl,
  "@/Components/footer.jsx": emptyComponentUrl,
  "../Components/Navbar.jsx": emptyComponentUrl,
  "../Components/Navbar": emptyComponentUrl,
  "../Components/chantCard.jsx": chantUrl,
};

for (const page of ["Lessons", "Games", "Activities", "Chants", "Camps"]) {
  test(`${page} renders an identifying image and name without full content`, async () => {
    const { default: Page } = await import(await compile(`../src/Pages/${page}.jsx`, overrides));
    const html = renderToStaticMarkup(React.createElement(MemoryRouter, null,
      React.createElement(AppContent.Provider, { value: { backendUrl: "", userData: { role: ["leader"] }, isLoggedin: true } },
        React.createElement(Page))));
    assert.match(html, /Card (?:name|title)/);
    assert.match(html, /src="\/uploads\/a{64}\.webp"/);
    assert.doesNotMatch(html, new RegExp(hiddenContent));
    assert.doesNotMatch(html, /No preview available|No description available|No explanation available|No lyrics available/);
    assert.match(html, /(?:View|Open)<\/button>/);
    assert.match(html, /Delete<\/button>/);
    if (page === "Chants") assert.match(html, /★ Favorite/);
    if (page === "Camps") assert.match(html, /Withdraw/);
    else assert.match(html, /Edit<\/button>/);
  });
}
