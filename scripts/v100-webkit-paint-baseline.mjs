import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

assert.equal(process.env.NEW_V100_NATIVE_CURRENT_WEBKIT, "1", "set NEW_V100_NATIVE_CURRENT_WEBKIT=1 for the current WebKit runtime");
const baseUrl = process.env.V100_CAMPAIGN_QA_BASE_URL;
const output = process.env.V100_WEBKIT_PAINT_BASELINE_OUT;
assert.ok(baseUrl, "V100_CAMPAIGN_QA_BASE_URL is required");
assert.ok(output, "V100_WEBKIT_PAINT_BASELINE_OUT is required");
const origin = new URL(baseUrl);
assert.ok(["localhost", "127.0.0.1"].includes(origin.hostname));
const { webkit } = await import("./pwa-native-runtime/node_modules/playwright/index.mjs");
const viewports = [{ width: 1280, height: 720 }, { width: 844, height: 340 }];
const modes = ["empty", "static-canvas", "raf-fill", "restore-empty"];

async function runWindow(page, mode) {
  return page.evaluate(async ({ mode }) => {
    const startedAt = performance.now(); const intervals = []; const callbackCosts = []; let callbackCount = 0; let fillCount = 0; let intervalOverflow = 0; let callbackCostOverflow = 0; let lastTimestamp = null; let rafId = null; let finishTimer = null; let watchdogTimer = null;
    document.body.replaceChildren(); document.body.style.cssText = "margin:0;visibility:visible";
    const canvas = ["empty", "restore-empty"].includes(mode) ? null : document.createElement("canvas");
    if (canvas) { canvas.width = innerWidth; canvas.height = innerHeight; canvas.style.cssText = "display:block;width:100%;height:100%"; document.body.append(canvas); }
    const context = canvas?.getContext("2d") ?? null;
    if (mode === "static-canvas") { context.fillStyle = "#183247"; context.fillRect(0, 0, canvas.width, canvas.height); fillCount += 1; }
    const firstRect = canvas?.getBoundingClientRect() ?? null;
    const onFrame = timestamp => {
      const callbackStarted = performance.now();
      if (lastTimestamp !== null) { if (intervals.length < 180) intervals.push(timestamp - lastTimestamp); else intervalOverflow += 1; }
      lastTimestamp = timestamp; callbackCount += 1;
      if (mode === "raf-fill") { context.fillStyle = "#183247"; context.fillRect(0, 0, canvas.width, canvas.height); fillCount += 1; }
      if (callbackCosts.length < 180) callbackCosts.push(Math.max(0, performance.now() - callbackStarted)); else callbackCostOverflow += 1;
      rafId = requestAnimationFrame(onFrame);
    };
    let result = null;
    try {
      rafId = requestAnimationFrame(onFrame);
      const finish = new Promise(resolve => { finishTimer = setTimeout(() => resolve("finished"), 2_000); });
      const watchdog = new Promise((_, reject) => { watchdogTimer = setTimeout(() => reject(new Error("paint baseline watchdog timeout")), 10_000); });
      await Promise.race([finish, watchdog]);
      const finishedAt = performance.now(); const sorted = [...callbackCosts].sort((left, right) => left - right); const intervalSorted = [...intervals].sort((left, right) => left - right); const percentile = (values, fraction) => values.length ? values[Math.min(values.length - 1, Math.floor((values.length - 1) * fraction))] : null;
      result = { mode, requestedDurationMs: 2000, wallDurationMs: finishedAt - startedAt, timedOut: false, visibility: document.visibilityState, devicePixelRatio: window.devicePixelRatio, canvas: canvas ? { width: canvas.width, height: canvas.height, cssWidth: firstRect?.width ?? null, cssHeight: firstRect?.height ?? null } : null, callbackCount, fillCount, intervalsCount: intervals.length, intervalsMs: intervals, intervalOverflow, interval: { count: intervals.length, p50Ms: percentile(intervalSorted, .5), p95Ms: percentile(intervalSorted, .95), maxMs: intervalSorted.at(-1) ?? null, overflow: intervalOverflow }, callbackCost: { count: callbackCosts.length, overflow: callbackCostOverflow, totalMs: callbackCosts.reduce((sum, value) => sum + value, 0), p50Ms: percentile(sorted, .5), p95Ms: percentile(sorted, .95), maxMs: sorted.at(-1) ?? null } };
    } finally {
      if (finishTimer !== null) clearTimeout(finishTimer);
      if (watchdogTimer !== null) clearTimeout(watchdogTimer);
      if (rafId !== null) cancelAnimationFrame(rafId);
      document.body.replaceChildren();
    }
    return result;
  }, { mode });
}

await mkdir(output, { recursive: false });
const browser = await webkit.launch({ headless: true });
const report = { engine: "current-webkit-runtime", origin: origin.href, windowDurationMs: 2000, watchdogMs: 10000, modes, viewports, cases: [], status: "running" };
try {
  const page = await browser.newPage({ viewport: viewports[0] });
  await page.setContent("<!doctype html><html><head></head><body></body></html>", { waitUntil: "domcontentloaded" });
  for (const viewport of viewports) { await page.setViewportSize(viewport); for (const mode of modes) report.cases.push({ viewport, ...(await runWindow(page, mode)) }); }
  report.status = "diagnostic-complete";
  await page.close();
} catch (error) { report.status = "failed"; report.error = String(error.stack ?? error); throw error; } finally { await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); }
console.log(JSON.stringify({ status: report.status, cases: report.cases.length, output: `${output}/report.json` }));
