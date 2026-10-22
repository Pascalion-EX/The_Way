import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithEsbuild } from "vite";
import { getYouTubeEmbedUrl, normalizeVideoUrl } from "../../shared/videoUrls.mjs";

const id = "M7lc1UVf-VE";
const blocked = [
  "https://attacker.example/watch?next=youtube.com/embed",
  "data:text/html,<h1>Untrusted frame</h1>#youtube.com/embed",
  "javascript:alert(1)//youtube.com/embed",
  "//youtube.com/embed/" + id,
  "http://www.youtube.com/embed/" + id,
  "https://youtube.com.attacker.example/embed/" + id,
  "https://notyoutube.com/embed/" + id,
  "https://youtu.be.attacker.example/" + id,
  "https://www.youtube.com@attacker.example/embed/" + id,
  "https://attacker.example@www.youtube.com/embed/" + id,
  "https://www.youtube.com:8443/embed/" + id,
  "https://www.youtube.com./embed/" + id,
  "https://www.youtube.com/redirect?q=https://attacker.example",
  "https://www.youtube.com/embed/" + id + "/extra",
  "https://www.youtube.com/embed/%2e%2e/redirect",
  "https://www.youtube.com/watch?v=invalid",
  "https://www.youtube.com/watch?v=" + id + "%26origin=attacker.example",
  "https://www.you\ntube.com/embed/" + id,
  "https://www.youtube.com\\@attacker.example/embed/" + id,
  "https://example.com/phishing.html",
];

test("URL validation rejects the reported payloads, hostname tricks, invalid IDs, and unsafe schemes", () => {
  for (const value of [...blocked, null, 7, [], {}, { toString: () => `https://youtu.be/${id}` }]) {
    assert.equal(getYouTubeEmbedUrl(value), "", String(value));
    assert.equal(normalizeVideoUrl(value), null, String(value));
  }
  for (const value of [undefined, "", "  "]) assert.equal(normalizeVideoUrl(value), "");
});

test("YouTube URLs are rebuilt using the fixed origin and only integer playback boundaries survive", () => {
  assert.equal(
    getYouTubeEmbedUrl(`https://www.youtube.com/embed/${id}?start=30&end=90&origin=https://attacker.example&enablejsapi=1&autoplay=1&list=unknown#youtube.com/embed`),
    `https://www.youtube.com/embed/${id}?start=30&end=90`,
  );
  for (const parameters of ["start=-1&end=Infinity", "start=1.5&end=2147483648", "start=javascript:bad&end=<script>"]) {
    assert.equal(getYouTubeEmbedUrl(`https://youtu.be/${id}?${parameters}`), `https://www.youtube.com/embed/${id}`);
  }
  const signedFile = "https://cdn.example.com/movie.mp4?signature=123&next=youtube.com/embed";
  assert.equal(normalizeVideoUrl(signedFile), signedFile);
  assert.equal(getYouTubeEmbedUrl(signedFile), "");
});

test("the real video component blocks malicious legacy records and confines supported embeds", async () => {
  // Compile the complete component with the app's JSX transformer, offline.
  const source = await readFile(new URL("../src/Components/ContentVideo.jsx", import.meta.url), "utf8");
  const transformed = await transformWithEsbuild(source, "ContentVideo.jsx", { jsx: "automatic", format: "esm" });
  const code = transformed.code
    .replace('"react/jsx-runtime"', JSON.stringify(import.meta.resolve("react/jsx-runtime")))
    .replace('"../../../shared/videoUrls.mjs"', JSON.stringify(new URL("../../shared/videoUrls.mjs", import.meta.url).href));
  const { default: ContentVideo } = await import(`data:text/javascript,${encodeURIComponent(code)}`);
  const render = (video) => renderToStaticMarkup(React.createElement(ContentVideo, { video, title: "Test video" }));
  for (const value of blocked) {
    const html = render(value);
    assert.doesNotMatch(html, /<(?:iframe|video|a)\b/);
    assert.match(html, /unsupported/);
  }
  const youtube = render(`https://youtu.be/${id}`);
  assert.match(youtube, new RegExp(`src="https://www.youtube.com/embed/${id}"`));
  assert.match(youtube, /sandbox="allow-scripts allow-same-origin allow-presentation"/);
  assert.match(youtube, /allow="autoplay; encrypted-media; picture-in-picture; fullscreen"/);
  assert.match(youtube, /referrerPolicy="strict-origin-when-cross-origin"/i);
  assert.doesNotMatch(youtube, /allow-(?:forms|popups|downloads|top-navigation)/);
  const direct = render("https://cdn.example.com/recording.webm?next=youtube.com/embed");
  assert.match(direct, /<video\b/);
  assert.doesNotMatch(direct, /<(?:iframe|a)\b/);
});
