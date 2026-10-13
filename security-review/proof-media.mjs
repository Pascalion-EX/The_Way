// AUDIT ARTIFACT: passing assertions reproduce known vulnerabilities, not secure behavior.
// Evaluates only trusted, local getEmbedUrl helpers. Opens no URLs or browser.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import React from '../frontend/node_modules/react/index.js';
import { renderToStaticMarkup } from '../frontend/node_modules/react-dom/server.node.js';

const inputs = [
  'https://attacker.example/watch?next=youtube.com/embed',
  'data:text/html,<h1>Untrusted frame</h1>#youtube.com/embed',
];
for (const page of ['GamesViewer', 'LessonViewer', 'ActivitiesViewer']) {
  const source = readFileSync(new URL(`../frontend/src/Pages/${page}.jsx`, import.meta.url), 'utf8');
  const start = source.indexOf('const getEmbedUrl =');
  const end = source.indexOf('\n};', start);
  assert.ok(start >= 0 && end > start);
  const helper = runInNewContext(source.slice(start, end + 3) + '\ngetEmbedUrl', { URL });
  assert.match(source, /const isYouTubeVideo\s*=\s*embedUrl\.includes\(\s*["']youtube\.com\/embed["']\s*\)/);
  for (const input of inputs) {
    const output = helper(input);
    assert.equal(output, input);
    assert.equal(output.includes('youtube.com/embed'), true);
    const html = renderToStaticMarkup(React.createElement('iframe', { src: output }));
    assert.match(html, /<iframe src=/);
    assert.equal(html.includes('sandbox='), false);
  }
  console.log(`PASS: ${page} preserves both untrusted URLs and selects the iframe branch.`);
}
console.log('Synthetic rendering only; no third-party page was contacted. This does not prove same-origin XSS.');
