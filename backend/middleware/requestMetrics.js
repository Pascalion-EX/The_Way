import { randomUUID } from "node:crypto";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { requestContext } from "../services/performance.js";

export function requestMetrics(req, res, next) {
  const started = performance.now();
  const requestId = randomUUID();
  const context = { requestId, dbCommands: 0, dbMs: 0, phases: {} };
  res.setHeader("X-Request-Id", requestId);
  res.setHeader("Cache-Control", "no-store");
  res.on("finish", () => {
    if (process.env.REQUEST_LOGS !== "true") return;
    console.log(JSON.stringify({ type: "request", pid: process.pid, requestId,
      method: req.method, route: `${req.baseUrl || ""}${req.route?.path || "unmatched"}`,
      status: res.statusCode, durationMs: Math.round((performance.now() - started) * 10) / 10,
      bytes: Number(res.getHeader("content-length") || 0),
      dbCommands: context.dbCommands, dbMs: Math.round(context.dbMs),
      phases: Object.fromEntries(Object.entries(context.phases).map(([name, ms]) => [name, Math.round(ms)])) }));
  });
  requestContext.run(context, next);
}

export function startRuntimeMetrics() {
  const histogram = monitorEventLoopDelay({ resolution: 20 });
  histogram.enable();
  const timer = setInterval(() => {
    console.log(JSON.stringify({ type: "runtime", pid: process.pid,
      rssMiB: Math.round(process.memoryUsage().rss / 1024 / 1024),
      eventLoopP95Ms: Math.round(histogram.percentile(95) / 1e6),
      eventLoopMaxMs: Math.round(histogram.max / 1e6) }));
    histogram.reset();
  }, 30000);
  timer.unref();
  return () => { clearInterval(timer); histogram.disable(); };
}
