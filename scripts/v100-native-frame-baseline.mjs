import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const outputDirectory = path.resolve(process.env.V100_NATIVE_FRAME_BASELINE_OUT ?? "outputs/v100-native-frame-baseline");
const outputPath = path.join(outputDirectory, "report.json");
const sourcePath = path.resolve("scripts/v100-native-frame-baseline.mjs");
const durationMs = 30_000;
const sampleCap = 60_000;
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const git = (args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const modulePath = process.env.PLAYWRIGHT_MODULE_PATH ? path.resolve(process.env.PLAYWRIGHT_MODULE_PATH) : path.resolve("node_modules/playwright/index.mjs");
const playwright = await import(pathToFileURL(modulePath).href);
const packageJson = JSON.parse(await readFile(path.join(path.dirname(modulePath), "package.json"), "utf8"));

const report = {
  diagnosticOnly: true,
  scope: "native WebKit frame baseline without game, audio, save, or production application",
  startedAt: new Date().toISOString(),
  durationMs,
  sampleCap,
  source: { path: path.relative(process.cwd(), sourcePath).replaceAll("\\", "/"), sha256: sha256(await readFile(sourcePath)) },
  environment: { expectedNode: "22.13.0", expectedPlaywright: "1.56.1", expectedRunner: "macos-15-intel", node: process.version, platform: process.platform + "-" + process.arch, runnerOS: process.env.RUNNER_OS ?? null, runnerArch: process.env.RUNNER_ARCH ?? null, imageOS: process.env.ImageOS ?? null, head: git(["rev-parse", "HEAD"]), tree: git(["rev-parse", "HEAD^{tree}"]), parent: git(["rev-parse", "HEAD^"]) },
  playwright: { version: packageJson.version, expected: "1.56.1", matchesExpected: packageJson.version === "1.56.1" },
  browser: null,
  page: null,
  phases: [],
  errors: { console: [], page: [], request: [], http: [] },
  harnessErrors: [],
  cleanup: { attempted: false, contextClosed: false, browserClosed: false },
  status: "failed",
};
if (packageJson.version !== "1.56.1") report.harnessErrors.push(`Playwright package version mismatch: ${packageJson.version}`);
if (process.env.GITHUB_ACTIONS === "true") {
  const expected = [
    [process.version === "v22.13.0", `Node version mismatch: ${process.version}`],
    [process.platform === "darwin" && process.arch === "x64", `Platform mismatch: ${process.platform}-${process.arch}`],
    [process.env.RUNNER_OS === "macOS", `RUNNER_OS mismatch: ${process.env.RUNNER_OS}`],
    [process.env.RUNNER_ARCH === "X64", `RUNNER_ARCH mismatch: ${process.env.RUNNER_ARCH}`],
    [!process.env.ImageOS || /macos.?15/i.test(process.env.ImageOS), `ImageOS mismatch: ${process.env.ImageOS}`],
  ];
  for (const [valid, message] of expected) if (!valid) report.harnessErrors.push(message);
}

let browser = null;
let context = null;
let page = null;
try {
  browser = await playwright.webkit.launch({ headless: true, timeout: 30_000 });
  report.browser = { version: browser.version(), engine: "webkit" };
  context = await browser.newContext({ viewport: { width: 844, height: 340 }, hasTouch: true, isMobile: true });
  page = await context.newPage();
  report.page = await page.evaluate(() => ({ userAgent: navigator.userAgent, devicePixelRatio: window.devicePixelRatio, viewport: { width: innerWidth, height: innerHeight } }));
  page.on("console", (message) => { if (message.type() === "error") report.errors.console.push(message.text()); });
  page.on("pageerror", (error) => report.errors.page.push(String(error)));
  page.on("requestfailed", (request) => report.errors.request.push(`${request.url()} :: ${request.failure()?.errorText ?? "unknown"}`));
  page.on("response", (response) => { if (response.status() >= 400) report.errors.http.push(`${response.status()} ${response.url()}`); });

  const collect = async (phase) => {
    let result;
    try {
      result = await page.evaluate(({ phaseName, duration, cap }) => new Promise((resolve) => {
        const timestamps = [];
        const events = [];
        const documentMarker = window.__V100_NATIVE_FRAME_DOCUMENT__ ??= `${performance.timeOrigin}:${location.href}`;
        let eventCount = 0;
        const record = (event) => {
          eventCount += 1;
          if (events.length < 100) events.push({ type: event.type, at: performance.now(), visibilityState: document.visibilityState, hidden: document.hidden, hasFocus: document.hasFocus() });
        };
        for (const type of ["visibilitychange", "focus", "blur"]) addEventListener(type, record, { passive: true });
        const started = performance.now();
        const startState = { visibilityState: document.visibilityState, hidden: document.hidden, hasFocus: document.hasFocus() };
        let callbackCount = 0;
        let rafId = null;
        let timerId = null;
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          if (rafId !== null) cancelAnimationFrame(rafId);
          clearTimeout(timerId);
          for (const type of ["visibilitychange", "focus", "blur"]) removeEventListener(type, record);
          const deltas = timestamps.slice(1).map((value, index) => value - timestamps[index]);
          const sorted = [...deltas].sort((a, b) => a - b);
          resolve({
            phase: phaseName, documentMarker, elapsedMs: performance.now() - started, callbackCount, timestamps, events, eventCount,
            eventOverflow: eventCount > events.length,
            startState, endState: { visibilityState: document.visibilityState, hidden: document.hidden, hasFocus: document.hasFocus() },
            sampleCount: timestamps.length, overflow: callbackCount > cap,
            finiteTimestamps: timestamps.every(Number.isFinite),
            strictlyIncreasing: timestamps.every((value, index) => index === 0 || value > timestamps[index - 1]),
            rafDeltaMs: { median: sorted.length ? sorted[Math.floor(sorted.length / 2)] : null, p95: sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : null, min: sorted.length ? sorted[0] : null, max: sorted.length ? sorted[sorted.length - 1] : null },
          });
        };
        const tick = (timestamp) => {
          callbackCount += 1;
          if (timestamps.length < cap) timestamps.push(timestamp);
          if (timestamp - started >= duration) finish();
          else rafId = requestAnimationFrame(tick);
        };
        timerId = setTimeout(finish, duration);
        rafId = requestAnimationFrame(tick);
      }), { phaseName: phase, duration: durationMs, cap: sampleCap });
    } catch (error) {
      result = { phase, error: String(error), rawEvidencePreserved: false };
      report.harnessErrors.push(`${phase}: ${String(error)}`);
    }
    report.phases.push(result);
    if (result.error) return;
    try {
      assert.ok(result.elapsedMs >= durationMs, `${phase}: 30 second observation incomplete`);
      assert.ok(result.sampleCount > 1, `${phase}: finite RAF timestamps required`);
      assert.equal(result.overflow, false, `${phase}: RAF sample cap overflow`);
      assert.equal(result.eventOverflow, false, `${phase}: lifecycle event cap overflow`);
      assert.equal(result.finiteTimestamps, true, `${phase}: non-finite RAF timestamp`);
      assert.equal(result.strictlyIncreasing, true, `${phase}: RAF timestamps not strictly increasing`);
    } catch (error) {
      result.validationError = String(error);
      report.harnessErrors.push(`${phase}: ${String(error)}`);
    }
  };

  await page.goto("about:blank");
  await collect("blank-before");
  await page.setContent("<canvas id=\"baseline\" width=\"844\" height=\"340\"></canvas>");
  await page.evaluate(() => { const canvas = document.querySelector("#baseline"); const ctx = canvas.getContext("2d"); ctx.fillStyle = "#18304a"; ctx.fillRect(0, 0, canvas.width, canvas.height); });
  await collect("static-canvas");
  await page.evaluate(() => { const canvas = document.querySelector("#baseline"); const ctx = canvas.getContext("2d"); let frame = 0; const animate = (timestamp) => { frame += 1; ctx.fillStyle = "#18304a"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = "#f0c36a"; ctx.fillRect(frame % 800, 120, 24, 24); requestAnimationFrame(animate); }; requestAnimationFrame(animate); });
  await collect("animated-canvas");
  await page.goto("about:blank");
  await collect("blank-after");
} catch (error) {
  report.harnessErrors.push(String(error));
} finally {
  report.cleanup.attempted = true;
  if (context) await context.close().then(() => { report.cleanup.contextClosed = true; }).catch((error) => report.harnessErrors.push(`cleanup context: ${String(error)}`));
  if (browser) await browser.close().then(() => { report.cleanup.browserClosed = true; }).catch((error) => report.harnessErrors.push(`cleanup browser: ${String(error)}`));
}
report.status = report.harnessErrors.length === 0 && report.phases.length === 4 && report.phases.every((phase) => !phase.error && !phase.validationError) && report.errors.console.length === 0 && report.errors.page.length === 0 && report.errors.request.length === 0 && report.errors.http.length === 0 ? "passed" : "failed";
report.finishedAt = new Date().toISOString();
await mkdir(outputDirectory, { recursive: true });
await writeFile(outputPath, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ status: report.status, report: outputPath, phases: report.phases.map(({ phase, elapsedMs, sampleCount, callbackCount, overflow, eventCount, eventOverflow, validationError }) => ({ phase, elapsedMs, sampleCount, callbackCount, overflow, eventCount, eventOverflow, validationError })), errors: report.errors, harnessErrors: report.harnessErrors }, null, 2));
if (report.status !== "passed" || report.phases.length !== 4) process.exitCode = 1;
