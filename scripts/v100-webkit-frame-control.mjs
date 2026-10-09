import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { webkit } from "playwright";

// rAF scheduling can differ between an untouched document and a dirty canvas.
// Record both on the same pinned engine; this diagnostic never accepts a game build.
function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)] ?? null;
}

const output = path.resolve(process.env.V100_WEBKIT_FRAME_CONTROL_OUT ?? "outputs/v100-webkit-frame-control/report.json");
const browser = await webkit.launch({ headless: true });
const report = {
  diagnosticOnly: true,
  head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  platform: `${process.platform}-${process.arch}`,
  browserVersion: browser.version(),
  viewport: { width: 844, height: 390 },
  results: [],
};
try {
  for (const mode of ["blank", "canvas-empty", "fill", "one-blit", "two-blits"]) {
    const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
    try {
    const measurement = await page.evaluate((mode) => {
      document.body.style.margin = "0";
      let ctx = null;
      let source = null;
      if (mode !== "blank") {
        const canvas = document.createElement("canvas");
        canvas.width = 844;
        canvas.height = 390;
        canvas.style.width = "844px";
        canvas.style.height = "390px";
        document.body.append(canvas);
        ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
        source = document.createElement("canvas");
        source.width = 960;
        source.height = 500;
        const input = source.getContext("2d");
        if (!ctx || !input) throw new Error("canvas control could not acquire 2D context");
        input.fillStyle = "#57463c";
        input.fillRect(0, 0, source.width, source.height);
      }
      return new Promise((resolve, reject) => {
        const started = performance.now();
        const times = [];
        const callbackDurations = [];
        const watchdog = setTimeout(() => reject(new Error("rAF watchdog")), 8000);
        const tick = (at) => {
          const t0 = performance.now();
          if (mode === "fill") {
            ctx.fillStyle = "#57463c";
            ctx.fillRect(0, 0, 844, 390);
          } else if (mode === "one-blit" || mode === "two-blits") {
            ctx.drawImage(source, 0, 0, 960, 500);
            if (mode === "two-blits") ctx.drawImage(source, 0, 0, 960, 500);
          }
          callbackDurations.push(performance.now() - t0);
          times.push(at);
          if (performance.now() - started >= 3000) {
            clearTimeout(watchdog);
            resolve({ times, callbackDurations, elapsedMs: performance.now() - started,
              visibilityState: document.visibilityState,
              contextAttributes: ctx?.getContextAttributes?.() ?? null });
          } else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    }, mode);
    const intervals = measurement.times.slice(1).map((at, index) => at - measurement.times[index]);
    const result = { mode, status: "captured", count: measurement.times.length, elapsedMs: measurement.elapsedMs,
      visibilityState: measurement.visibilityState, contextAttributes: measurement.contextAttributes,
      medianRafMs: percentile(intervals, .5), p95RafMs: percentile(intervals, .95),
      p95CallbackMs: percentile(measurement.callbackDurations, .95) };
    assert.ok(result.count >= 30 && result.elapsedMs >= 3000 && result.visibilityState === "visible", `${mode}: incomplete control window`);
    assert.ok(intervals.every((interval) => Number.isFinite(interval) && interval > 0), `${mode}: invalid rAF interval`);
    assert.equal(measurement.callbackDurations.length, result.count, `${mode}: callback count mismatch`);
    report.results.push(result);
    console.log(JSON.stringify(result));
    } catch (error) {
      report.results.push({ mode, status: "failed", error: String(error) });
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
const allCaptured = report.results.length === 5 && report.results.every((result) => result.status === "captured");
console.log(JSON.stringify({ status: allCaptured ? "captured" : "failed", report: output, results: report.results.length }));
assert.ok(allCaptured, "WebKit frame control did not capture all five modes");
