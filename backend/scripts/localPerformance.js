import { performance } from "node:perf_hooks";
import { cpus } from "node:os";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import bcrypt from "bcryptjs";

const samples = [];
for (let i = 0; i < 10; i++) {
  const started = performance.now();
  await bcrypt.hash("synthetic-benchmark-password", 10);
  samples.push(performance.now() - started);
}
const sorted = [...samples].sort((a, b) => a - b);
const dist = new URL("../../frontend/dist/", import.meta.url);
const manifest = JSON.parse(await readFile(new URL(".vite/manifest.json", dist), "utf8"));
const entry = Object.entries(manifest).find(([, chunk]) => chunk.isEntry);
const visited = new Set();
const assets = [];
const visit = async (key) => {
  if (visited.has(key)) return;
  visited.add(key);
  const chunk = manifest[key];
  for (const dependency of chunk.imports || []) await visit(dependency);
  if (chunk.file.endsWith(".js")) {
    const content = await readFile(new URL(chunk.file, dist));
    assets.push({ file: chunk.file, bytes: content.length, gzipBytes: gzipSync(content).length });
  }
};
await visit(entry[0]);
const result = {
  measuredAt: new Date().toISOString(), node: process.version,
  environment: "Local development host; NOT the target VPS",
  hostCpu: cpus()[0]?.model, hostLogicalCpus: cpus().length,
  bcryptCost10: { samples: 10, medianMs: Number(sorted[5].toFixed(2)), maxMs: Number(sorted.at(-1).toFixed(2)),
    note: "Sequential JS CPU benchmark only. Login also includes database/rate-limit queries; this is not login throughput." },
  initialStaticJavaScript: { assets, bytes: assets.reduce((n, a) => n + a.bytes, 0),
    gzipBytes: assets.reduce((n, a) => n + a.gzipBytes, 0),
    note: "Static entry dependency graph only; the active route adds its own lazy chunks, plus CSS/fonts/images." },
};
await mkdir(new URL("../../deployment/reports/", import.meta.url), { recursive: true });
await writeFile(new URL("../../deployment/reports/local-performance.json", import.meta.url), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
