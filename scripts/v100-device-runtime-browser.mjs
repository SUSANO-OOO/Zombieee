import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { createDefaultV100Save, normalizeV100Save, serializeV100Save } from "../app/v100Save.js";
import { V100_STAGE_IDS } from "../app/v100Registry.js";
import { v100BattleDefinitionFor } from "../app/v100BattleAdapter.js";
import { normalTacticalInput } from "./v100-normal-tactical-input.mjs";
import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";

const configuredBaseUrl = process.env.V100_DEVICE_RUNTIME_BASE_URL ?? process.env.V100_CAMPAIGN_QA_BASE_URL;
assert.ok(configuredBaseUrl, "V100_DEVICE_RUNTIME_BASE_URL or V100_CAMPAIGN_QA_BASE_URL is required");
const baseUrl = new URL(configuredBaseUrl);
assert.ok(["127.0.0.1", "localhost"].includes(baseUrl.hostname), `local origin required: ${baseUrl}`);
const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href)
  : await import("playwright");
const engine = process.env.V100_DEVICE_RUNTIME_ENGINE ?? "chromium";
assert.ok(["chromium", "webkit"].includes(engine), `unsupported engine: ${engine}`);
const evidenceDir = path.resolve(process.env.V100_DEVICE_RUNTIME_OUT ?? "outputs/v100-device-runtime-browser-r1");
const setupTimeoutMs = 8 * 60_000;
const paintIsolation = process.env.V100_DEVICE_RUNTIME_PAINT_ISOLATION ?? "none";
assert.ok(["none", "hud", "canvas", "hud-and-canvas", "draw-suppressed"].includes(paintIsolation), `invalid paint isolation: ${paintIsolation}`);
const qualityDiagnostic = process.env.V100_DEVICE_RUNTIME_QUALITY_DIAGNOSTIC ?? "auto";
assert.ok(["auto", "power-save"].includes(qualityDiagnostic), `invalid quality diagnostic: ${qualityDiagnostic}`);
const diagnosticSeconds = Number(process.env.V100_DEVICE_RUNTIME_DIAGNOSTIC_SECONDS ?? 15);
assert.ok(Number.isInteger(diagnosticSeconds) && diagnosticSeconds >= 10 && diagnosticSeconds <= 30, "diagnostic seconds must be 10..30");
const measurementMs = paintIsolation === "none" && qualityDiagnostic === "auto" ? 30_000 : diagnosticSeconds * 1_000;
const callbackDiagnostic = process.env.V100_DEVICE_RUNTIME_CALLBACK_DIAGNOSTIC === "1";
const blankBaselineDiagnostic = process.env.V100_DEVICE_RUNTIME_BLANK_BASELINE === "1";
const contextSyncDiagnostic = process.env.V100_DEVICE_RUNTIME_CONTEXT_SYNC_DIAGNOSTIC === "1";
const observerlessDiagnostic = process.env.V100_DEVICE_RUNTIME_OBSERVERLESS === "1";
const suppressDebugDatasetDiagnostic = process.env.V100_DEVICE_RUNTIME_SUPPRESS_DEBUG_DATASET === "1";
const defaultViewports = [
  { width: 844, height: 340, safeArea: true },
  { width: 844, height: 390, safeArea: true },
  { width: 1280, height: 720, safeArea: false },
];
const viewports = process.env.V100_DEVICE_RUNTIME_VIEWPORT
  ? (() => {
    const match = process.env.V100_DEVICE_RUNTIME_VIEWPORT.match(/^(\d+)x(\d+)$/u);
    assert.ok(match, `invalid V100_DEVICE_RUNTIME_VIEWPORT: ${process.env.V100_DEVICE_RUNTIME_VIEWPORT}`);
    const width = Number(match[1]);
    const height = Number(match[2]);
    return [{ width, height, safeArea: width === 844 && (height === 340 || height === 390) }];
  })()
  : defaultViewports;
const bossKind = "mugarian-president-mutated";
const formation = ["unit-gantetsu", "unit-nao", "unit-babayaga", "unit-mizuchi", null, null, null];
const owned = formation.filter(Boolean);

function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
async function fileSha256(relativePath) {
  return sha256(await readFile(path.resolve(relativePath)));
}
async function packageVersionFromModule(modulePath) {
  let directory = path.dirname(modulePath);
  for (let depth = 0; depth < 8; depth += 1) {
    try {
      const packageJson = JSON.parse(await readFile(path.join(directory, "package.json"), "utf8"));
      if (packageJson.name === "playwright") return { version: packageJson.version, packagePath: path.join(directory, "package.json") };
    } catch { /* continue toward the imported package root */ }
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  throw new Error(`Could not resolve Playwright package metadata from ${modulePath}`);
}
function gitValue(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}
function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
}
function median(values) { return percentile(values, 0.5); }
async function measureBlankRaf(browser, viewport) {
  const context = await browser.newContext({ viewport, hasTouch: viewport.safeArea, isMobile: viewport.safeArea });
  try {
    const page = await context.newPage();
    await page.setContent("<!doctype html><html><body></body></html>");
    const observation = await page.evaluate(() => new Promise((resolve, reject) => {
      const started = performance.now();
      const times = [];
      let handle = null;
      const watchdog = setTimeout(() => {
        if (handle !== null) cancelAnimationFrame(handle);
        reject(new Error("blank rAF diagnostic watchdog"));
      }, 8_000);
      const tick = (at) => {
        times.push(at);
        if (performance.now() - started >= 2_000) {
          clearTimeout(watchdog);
          resolve({ times, visibilityState: document.visibilityState, elapsedMs: performance.now() - started });
        } else handle = requestAnimationFrame(tick);
      };
      handle = requestAnimationFrame(tick);
    }));
    const intervals = observation.times.slice(1).map((at, index) => at - observation.times[index]);
    return {
      diagnosticOnly: true,
      status: "captured",
      callbackCount: observation.times.length,
      elapsedMs: observation.elapsedMs,
      visibilityState: observation.visibilityState,
      medianRafMs: median(intervals),
      p95RafMs: percentile(intervals, .95),
    };
  } catch (error) {
    return { diagnosticOnly: true, status: "failed", error: String(error) };
  } finally {
    await context.close();
  }
}
function snapshotProjection(snapshot) {
  if (!snapshot) return null;
  const living = (snapshot.fighters ?? []).filter((fighter) => Number(fighter.hp) > 0);
  return {
    time: snapshot.time,
    running: snapshot.running,
    over: snapshot.over,
    won: typeof snapshot.won === "boolean" ? snapshot.won : null,
    baseHp: snapshot.baseHp,
    baseMaxHp: snapshot.baseMaxHp,
    humanCount: living.filter((fighter) => fighter.side === "human").length,
    enemyCount: living.filter((fighter) => fighter.side === "zombie").length,
    boss: living.filter((fighter) => fighter.side === "zombie" && fighter.kind === bossKind)
      .map(({ id, kind, hp, maxHp, x, y, lane, combatReady }) => ({ id, kind, hp, maxHp, x, y, lane, combatReady })),
    humans: living.filter((fighter) => fighter.side === "human")
      .map(({ id, kind, hp, maxHp, x, y, lane }) => ({ id, kind, hp, maxHp, x, y, lane })),
  };
}
function fixtureSave() {
  const base = createDefaultV100Save({ playerName: "V1 device runtime observation" });
  const unitLevels = { ...base.unitLevels };
  for (const id of owned) unitLevels[id] = 22;
  return normalizeV100Save({
    ...base,
    revision: 7,
    campaignStarted: true,
    availableStageIds: V100_STAGE_IDS.slice(0, 25),
    completedStageIds: V100_STAGE_IDS.slice(0, 24),
    ownedUnitIds: owned,
    registeredUnitIds: owned,
    unitLevels,
    levelCap: 30,
    formationSlots: formation,
    caps: 0,
    vehicle: { ...base.vehicle, upgradeLevel: 5, maxHp: 1080 },
    flowState: {
      phase: "formation",
      eventId: null,
      stageId: V100_STAGE_IDS[24],
      stageNumber: 25,
      destination: "formation",
      nodeIndex: 0,
      firstClear: false,
      finalized: true,
    },
  });
}
async function waitForBattle(page, deadline) {
  while (Date.now() < deadline) {
    const phase = await page.locator(".v100-shell").getAttribute("data-v100-phase").catch(() => null);
    if (phase === "map") {
      await page.getByRole("button", { name: "この作戦を編成", exact: true }).click();
    } else if (phase === "formation") {
      try {
        await page.getByRole("button", { name: "戦闘へ", exact: true }).click({ timeout: 5_000 });
      } catch (error) {
        // WebKit can detach the button after the accepted click while
        // Playwright is still waiting for a stable element. The live battle
        // state is the authoritative acknowledgement of this transition.
        const accepted = await page.evaluate(() => document.querySelector(".v100-shell")?.getAttribute("data-v100-phase") === "battle"
          && window.__ASHFALL_BATTLE_QA__?.getSnapshot?.()?.running === true).catch(() => false);
        if (!accepted) throw error;
      }
    } else if (await page.locator(".v100-event-actions .v100-primary").count()) {
      await page.locator(".v100-event-actions .v100-primary").click();
    } else if (phase === "result" || await page.locator(".v100-result-actions .v100-primary").count()) {
      throw new Error("Unexpected S25 result during setup; preserve and diagnose");
    }
    if (await page.evaluate(() => Boolean(window.__ASHFALL_BATTLE_QA__?.getSnapshot?.()?.running))) return;
    await page.waitForTimeout(100);
  }
  throw new Error("S25 did not reach a live battle during setup");
}
async function beginMeasurement(page) {
  return page.evaluate(() => {
    window.__V100_RAF_CALLBACK_DIAG__?.start();
    const state = { startedAt: performance.now(), times: [], overflow: 0, active: true, handle: 0, visibilityEvents: [] };
    const mark = (type) => state.visibilityEvents.push({ type, at: performance.now(), visibilityState: document.visibilityState });
    state.listeners = { visibilitychange: () => mark("visibilitychange"), blur: () => mark("blur"), pagehide: () => mark("pagehide") };
    for (const [type, listener] of Object.entries(state.listeners)) window.addEventListener(type, listener, { passive: true });
    const tick = (at) => {
      if (!state.active) return;
      if (state.times.length < 2_400) state.times.push(at);
      else state.overflow += 1;
      state.handle = requestAnimationFrame(tick);
    };
    state.handle = requestAnimationFrame(tick);
    state.performanceBefore = window.__ASHFALL_BATTLE_QA__?.getPerformanceSnapshot?.() ?? null;
    window.__V100_DEVICE_RAF__ = state;
    return { startedAt: state.startedAt, performance: state.performanceBefore, visibilityState: document.visibilityState };
  });
}
async function endMeasurement(page) {
  return page.evaluate(() => {
    const state = window.__V100_DEVICE_RAF__;
    if (!state) return null;
    state.active = false;
    cancelAnimationFrame(state.handle);
    const endedAt = performance.now();
    const performanceAfter = window.__ASHFALL_BATTLE_QA__?.getPerformanceSnapshot?.() ?? null;
    const callbackDiagnostic = window.__V100_RAF_CALLBACK_DIAG__?.stop() ?? null;
    for (const [type, listener] of Object.entries(state.listeners ?? {})) window.removeEventListener(type, listener);
    return { startedAt: state.startedAt, endedAt, times: state.times, overflow: state.overflow, visibilityEvents: state.visibilityEvents, performanceBefore: state.performanceBefore, performanceAfter, visibilityState: document.visibilityState, callbackDiagnostic };
  });
}

const seed = fixtureSave();
const seedRaw = serializeV100Save(seed);
assert.deepEqual(seed.formationSlots, formation, "normalized fixture formation drifted");
assert.deepEqual(owned, ["unit-gantetsu", "unit-nao", "unit-babayaga", "unit-mizuchi"], "fixture IDs drifted");
for (const id of owned) assert.equal(seed.unitLevels[id], 22, `fixture level drifted for ${id}`);
assert.equal(seed.vehicle.upgradeLevel, 5, "fixture vehicle upgrade drifted");
assert.equal(seed.vehicle.maxHp, 1080, "fixture vehicle HP drifted");
const expectedDefinition = v100BattleDefinitionFor(V100_STAGE_IDS[24]);
assert.equal(expectedDefinition.stageId, V100_STAGE_IDS[24], "V1 stage definition identity drifted");
const build = await productionBuildIdentity();
const report = {
  scope: "V1 S25 representative device-runtime window; isolated S24-complete fixture, normal production UI, no QA setters, no physical-device or stress acceptance",
  generatedAt: new Date().toISOString(),
  baseUrl: String(baseUrl),
  engine,
  build,
  provenance: {
    head: gitValue(["rev-parse", "HEAD"]),
    tree: gitValue(["rev-parse", "HEAD^{tree}"]),
    node: process.version,
    platform: `${process.platform}-${process.arch}`,
    sourceFiles: {
      ashfallGame: await fileSha256("app/AshfallGame.tsx"),
      battleAdapter: await fileSha256("app/v100BattleAdapter.js"),
      tacticalInput: await fileSha256("scripts/v100-normal-tactical-input.mjs"),
      runner: await fileSha256("scripts/v100-device-runtime-browser.mjs"),
    },
  },
  fixture: {
    stageNumber: 25,
    legalUnlockBasis: "completedStageIds contains V100_STAGE_IDS[0..23]; availableStageIds contains [0..24]",
    formation,
    owned,
    normalizedSave: {
      availableStageIds: [...seed.availableStageIds],
      completedStageIds: [...seed.completedStageIds],
      ownedUnitIds: [...seed.ownedUnitIds],
      registeredUnitIds: [...seed.registeredUnitIds],
      formationSlots: [...seed.formationSlots],
      unitLevels: Object.fromEntries(owned.map((id) => [id, seed.unitLevels[id]])),
      vehicle: { ...seed.vehicle },
    },
    level: 22,
    vehicleMaxHp: 1080,
    expectedBattleIdentity: { stageId: expectedDefinition.stageId, operationId: expectedDefinition.operationId, missionType: expectedDefinition.missionType },
    sourceSha256: sha256(seedRaw),
  },
  measurement: { seconds: measurementMs / 1000, representative: paintIsolation === "none" && qualityDiagnostic === "auto" && !contextSyncDiagnostic && !observerlessDiagnostic && !suppressDebugDatasetDiagnostic, uninterrupted: true, paintIsolation, qualityDiagnostic, contextSyncDiagnostic, observerlessDiagnostic, suppressDebugDatasetDiagnostic, diagnosticOnly: paintIsolation !== "none" || qualityDiagnostic !== "auto" || contextSyncDiagnostic || observerlessDiagnostic || suppressDebugDatasetDiagnostic },
  results: [],
};
await mkdir(path.dirname(evidenceDir), { recursive: true });
await mkdir(evidenceDir, { recursive: false });
const require = createRequire(import.meta.url);
const playwrightModulePath = process.env.PLAYWRIGHT_MODULE_PATH
  ? path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)
  : require.resolve("playwright");
const playwrightPackage = await packageVersionFromModule(playwrightModulePath);
report.provenance.playwrightModulePath = playwrightModulePath;
report.provenance.playwrightPackageVersion = playwrightPackage.version;
const browser = await playwright[engine].launch({ headless: true });
report.provenance.browserVersion = await browser.version();
try {
  for (const viewport of viewports) {
    const name = `${engine}-${viewport.width}x${viewport.height}`;
    const blankBaseline = blankBaselineDiagnostic ? await measureBlankRaf(browser, viewport) : null;
    const context = await browser.newContext({ viewport, hasTouch: viewport.safeArea, isMobile: viewport.safeArea });
    const page = await context.newPage();
    if (suppressDebugDatasetDiagnostic) {
      await page.addInitScript(() => {
        const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "dataset");
        Object.defineProperty(HTMLElement.prototype, "dataset", {
          ...descriptor,
          get() {
            const raw = descriptor.get.call(this);
            if (this !== document.documentElement) return raw;
            return new Proxy(raw, {
              set(target, key, value) {
                if (key === "manualAbilityLayoutDebug") {
                  window.__V100_DEBUG_DATASET_SUPPRESSED__ = (window.__V100_DEBUG_DATASET_SUPPRESSED__ ?? 0) + 1;
                  return true;
                }
                return Reflect.set(target, key, value);
              },
            });
          },
        });
      });
    }
    if (contextSyncDiagnostic) {
      await page.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(type, options) {
          if (type === "2d" && this.matches("canvas.battlefield") && options?.desynchronized === true) {
            return original.call(this, type, { ...options, desynchronized: false });
          }
          return original.call(this, type, options);
        };
      });
    }
    if (callbackDiagnostic) {
      await page.addInitScript(() => {
        const original = window.requestAnimationFrame.bind(window);
        const durations = [];
        let active = false;
        window.requestAnimationFrame = (callback) => original((timestamp) => {
          const started = performance.now();
          try { return callback(timestamp); }
          finally {
            if (active && durations.length < 8_000) durations.push(performance.now() - started);
          }
        });
        window.__V100_RAF_CALLBACK_DIAG__ = {
          start() { durations.length = 0; active = true; },
          stop() {
            active = false;
            const sorted = [...durations].sort((a, b) => a - b);
            const at = (fraction) => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)] ?? null;
            return {
              diagnosticOnly: true,
              count: sorted.length,
              p50Ms: at(.5),
              p95Ms: at(.95),
              maxMs: sorted.at(-1) ?? null,
              over8Ms: sorted.filter((duration) => duration > 8).length,
              over16Ms: sorted.filter((duration) => duration > 16).length,
              over33Ms: sorted.filter((duration) => duration > 33).length,
            };
          },
        };
      });
    }
    const result = { name, viewport, status: "failed", blankBaseline, diagnostics: { consoleErrors: [], pageErrors: [], requestFailures: [], httpFailures: [] }, samples: [], measurementSamples: [], inputs: [] };
    report.results.push(result);
    let measurementActive = false;
    page.on("console", (message) => { if (message.type() === "error") result.diagnostics.consoleErrors.push(message.text()); });
    page.on("pageerror", (error) => result.diagnostics.pageErrors.push(String(error)));
    page.on("requestfailed", (request) => result.diagnostics.requestFailures.push(`${request.url()} :: ${request.failure()?.errorText ?? "unknown"}`));
    page.on("response", (response) => { if (response.status() >= 400) result.diagnostics.httpFailures.push(`${response.status()} ${response.url()}`); });
    try {
      await page.addInitScript((raw) => {
        localStorage.setItem("nishijin-campaign-v100", raw);
        localStorage.setItem("nishijin-campaign-v100:mirror", raw);
        localStorage.setItem("nishijin-campaign-v100:last-known-good", raw);
      }, seedRaw);
      const url = new URL("v100", baseUrl);
      if (viewport.safeArea) url.searchParams.set("safe", "iphone-landscape");
      const response = await page.goto(String(url), { waitUntil: "domcontentloaded", timeout: setupTimeoutMs });
      assert.ok(response?.ok(), `navigation HTTP ${response?.status()}`);
      await page.getByRole("button", { name: "ブラウザで遊ぶ", exact: true }).click().catch(() => {});
      await page.locator(".v100-shell").waitFor({ state: "attached", timeout: setupTimeoutMs });
      const setupDeadline = Date.now() + setupTimeoutMs;
      await waitForBattle(page, setupDeadline);
      const initial = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.() ?? null);
      const initialProjection = snapshotProjection(initial);
      assert.equal(initial?.stageId, V100_STAGE_IDS[24], "live fixture must be S25");
      assert.equal(initial?.operationId, expectedDefinition.operationId, "live V1 operation identity drifted");
      let latest = initialProjection;
      while (Date.now() < setupDeadline) {
        const snapshot = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.() ?? null);
        latest = snapshotProjection(snapshot);
        if (latest?.running && !latest.over && latest.boss.length > 0 && latest.humanCount > 0) break;
        if (!latest?.running || latest?.over) throw new Error("S25 ended before boss and human coverage were observed");
        await normalTacticalInput(page, result);
        await page.waitForTimeout(350);
      }
      assert.ok(latest?.running && !latest.over && latest.boss.length > 0 && latest.humanCount > 0, "live S25 boss/human setup coverage missing");
      result.setup = { initial: initialProjection, firstLive: latest };
      if (qualityDiagnostic !== "auto") {
        await page.evaluate((mode) => window.__ASHFALL_BATTLE_QA__.setGraphicsQuality(mode), qualityDiagnostic);
        await page.waitForFunction((mode) => window.__ASHFALL_BATTLE_QA__?.getPerformanceSnapshot?.()?.graphicsProfile?.requestedMode === mode, qualityDiagnostic);
      }
      result.canvasContext = await page.locator("canvas.battlefield").evaluate((canvas) => ({
        width: canvas.width,
        height: canvas.height,
        cssWidth: canvas.getBoundingClientRect().width,
        cssHeight: canvas.getBoundingClientRect().height,
        dpr: window.devicePixelRatio,
        attributes: canvas.getContext("2d")?.getContextAttributes?.() ?? null,
      }));
      if (paintIsolation !== "none") {
        if (paintIsolation === "draw-suppressed") {
          result.paintIsolation = await page.locator("canvas.battlefield").evaluate((canvas) => {
            const ctx = canvas.getContext("2d");
            const methods = ["drawImage", "fillRect", "clearRect", "strokeRect", "fill", "stroke", "fillText", "strokeText", "putImageData"];
            for (const method of methods) {
              const silent = () => {};
              ctx[method] = silent;
              if (ctx[method] !== silent) throw new Error(`Canvas diagnostic could not suppress ${method}`);
            }
            return { diagnosticOnly: true, methods };
          });
        } else {
          const selectors = [];
          if (paintIsolation.includes("hud")) selectors.push(".top-hud", ".survival-hud", ".boss-hud", ".crawler-alert", ".bottom-hud", ".stats-strip", ".barrier-health", ".manual-ability-legend", ".manual-ability-ready");
          if (paintIsolation.includes("canvas")) selectors.push("canvas.battlefield");
          await page.addStyleTag({ content: `${selectors.join(",")} { opacity:0!important; }` });
          result.paintIsolation = { diagnosticOnly: true, selectors };
        }
      }
      await page.screenshot({ path: path.join(evidenceDir, `${name}-before.png`) });
      measurementActive = true;
      const measurement = await beginMeasurement(page);
      result.measurementStarted = true;
      assert.equal(measurement.visibilityState, "visible", "measurement did not start while visible");
      if (observerlessDiagnostic) {
        await page.waitForTimeout(measurementMs);
        const final = snapshotProjection(await page.evaluate(() => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.() ?? null));
        if (!final?.running || final.over || final.humanCount <= 0 || final.boss.length === 0) {
          throw new Error("observerless diagnostic lost live battle, humans, or boss");
        }
        result.measurementSamples.push(final);
      } else {
        const started = Date.now();
        let previousSample = 0;
        while (Date.now() - started < measurementMs) {
          await normalTacticalInput(page, result, { observeSnapshot(snapshot) {
            const projected = snapshotProjection(snapshot);
            if (!projected?.running || projected.over || projected.humanCount <= 0 || projected.boss.length === 0) {
              throw new Error("30-second window lost live battle, humans, or boss");
            }
            if (Date.now() - previousSample >= 1000) {
              result.measurementSamples.push(projected);
              previousSample = Date.now();
            }
          } });
          await page.waitForTimeout(350);
        }
      }
      const raf = await endMeasurement(page);
      measurementActive = false;
      result.measurementEnded = true;
      if (suppressDebugDatasetDiagnostic) {
        result.suppressedDatasetWrites = await page.evaluate(() => window.__V100_DEBUG_DATASET_SUPPRESSED__ ?? 0);
        assert.ok(result.suppressedDatasetWrites > 0, "debug dataset suppression did not intercept writes");
      }
      const intervals = (raf?.times ?? []).slice(1).map((time, index) => time - raf.times[index]);
      const invalidIntervals = (raf?.times ?? []).slice(1).filter((time, index) => !Number.isFinite(time) || !Number.isFinite(raf.times[index]) || time <= raf.times[index]);
      const elapsed = (raf?.endedAt ?? measurement.startedAt) - measurement.startedAt;
      const medianRafMs = median(intervals);
      const p95RafMs = percentile(intervals, 0.95);
      const medianFps = medianRafMs ? 1000 / medianRafMs : 0;
      const renderDelta = measurement.performance && raf.performanceAfter ? raf.performanceAfter.renderFrames - measurement.performance.renderFrames : null;
      const effectiveRenderHz = renderDelta === null ? null : renderDelta / (elapsed / 1000);
      const expectedRenderHz = Number(raf.performanceAfter?.graphicsProfile?.renderHz);
      const renderCadenceToleranceHz = Number.isFinite(expectedRenderHz) ? Math.max(3, expectedRenderHz * 0.1) : null;
      const gates = {
        sampleCount: (raf?.times?.length ?? 0) >= 300,
        overflow: (raf?.overflow ?? 0) === 0,
        strictlyIncreasing: invalidIntervals.length === 0 && intervals.every((interval) => Number.isFinite(interval) && interval > 0),
        visible: raf?.visibilityState === "visible",
        uninterrupted: (raf?.visibilityEvents ?? []).length === 0,
        elapsed: elapsed >= measurementMs,
        p95Raf: p95RafMs !== null && p95RafMs <= 33,
        medianFps: medianFps >= 50,
        renderCadence: renderCadenceToleranceHz !== null && effectiveRenderHz !== null && Math.abs(effectiveRenderHz - expectedRenderHz) <= renderCadenceToleranceHz,
      };
      result.performance = { before: measurement.performance, after: raf.performanceAfter, raf: { count: raf?.times?.length ?? 0, overflow: raf?.overflow ?? 0, elapsedMs: elapsed, times: raf?.times ?? [], intervals, invalidIntervals }, visibility: { state: raf.visibilityState, events: raf.visibilityEvents ?? [] }, callbackDiagnostic: raf.callbackDiagnostic, medianRafMs, p95RafMs, medianFps, renderDelta, effectiveRenderHz, expectedRenderHz, renderCadenceToleranceHz, gates };
      await page.screenshot({ path: path.join(evidenceDir, `${name}-after.png`) });
      assert.ok(gates.sampleCount, "insufficient rAF samples for representative window");
      assert.ok(gates.overflow, "rAF observer overflowed");
      assert.ok(gates.strictlyIncreasing, "rAF timestamps are not strictly increasing");
      assert.ok(gates.visible, "document was hidden during measurement");
      assert.ok(gates.uninterrupted, "measurement was interrupted by visibility/focus events");
      assert.ok(gates.elapsed, "measurement window was shortened");
      assert.ok(gates.p95Raf, `p95 rAF ${p95RafMs}ms exceeds 33ms`);
      assert.ok(gates.medianFps, `median FPS ${medianFps} below 50`);
      assert.ok(gates.renderCadence, "render cadence differs from graphics profile");
      result.status = "passed";
    } catch (error) {
      result.error = String(error);
      if (measurementActive) {
        result.partialMeasurement = await endMeasurement(page).catch((cleanupError) => ({ cleanupError: String(cleanupError) }));
        measurementActive = false;
      }
      result.debug = await page.evaluate(() => ({ phase: document.querySelector(".v100-shell")?.dataset.v100Phase ?? null, screen: document.querySelector(".game-shell")?.dataset.screen ?? null, snapshot: window.__ASHFALL_BATTLE_QA__?.getSnapshot?.() ?? null })).catch(() => null);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}

const reportPath = path.join(evidenceDir, "report.json");
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
const failures = report.results.filter((result) => result.status !== "passed" || Object.values(result.diagnostics).some((items) => items.length > 0));
if (failures.length > 0) {
  console.error(JSON.stringify({ status: "failed", report: reportPath, failures: failures.map(result => ({
    name: result.name, error: result.error, blankBaseline: result.blankBaseline,
    performance: result.performance && { p95RafMs: result.performance.p95RafMs,
      medianFps: result.performance.medianFps, effectiveRenderHz: result.performance.effectiveRenderHz,
      callbackDiagnostic: result.performance.callbackDiagnostic, gates: result.performance.gates },
    diagnosticCounts: Object.fromEntries(Object.entries(result.diagnostics).map(([kind, items]) => [kind, items.length])),
  })) }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ status: "passed", report: reportPath, cases: report.results.length }, null, 2));
}
