import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const configuredBaseUrl = process.env.PERF_QA_BASE_URL?.trim() || null;
let baseUrl = new URL(configuredBaseUrl ?? "http://127.0.0.1/");
if (!['localhost', '127.0.0.1'].includes(baseUrl.hostname)) {
  throw new Error(`Performance QA routes are local-only; refusing ${baseUrl}`);
}
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href)
  : await import('playwright');
const engineName = process.env.PERF_QA_ENGINE ?? 'chromium';
const browserType = playwright[engineName];
if (!browserType) throw new Error(`Unsupported PERF_QA_ENGINE: ${engineName}`);

const runMode = process.env.PERF_QA_MODE ?? 'gate';
if (!['gate', 'smoke'].includes(runMode)) throw new Error(`Unsupported PERF_QA_MODE: ${runMode}`);
const isGate = runMode === 'gate';
const durationMs = Math.max(30_000, Number(process.env.PERF_QA_DURATION_MS) || 15 * 60_000);
if (isGate && durationMs < 15 * 60_000) {
  throw new Error('Performance gate requires at least 15 minutes; use PERF_QA_MODE=smoke for shorter diagnostics');
}
const [width, height] = (process.env.PERF_QA_VIEWPORT ?? '844x390').split('x').map(Number);
if (!Number.isFinite(width) || !Number.isFinite(height)) throw new Error('PERF_QA_VIEWPORT must use WIDTHxHEIGHT');
const outputPath = path.resolve(process.env.PERF_QA_OUTPUT ?? `outputs/performance/${engineName}-${width}x${height}.json`);
const resultVersion = process.env.PERF_QA_VERSION ?? '0.8.0';

function percentile(values, ratio) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))];
}

function median(values) {
  return percentile(values, 0.5);
}

function round(value, digits = 2) {
  return value === null || !Number.isFinite(value) ? null : Number(value.toFixed(digits));
}

async function serverIsReady() {
  try {
    const response = await fetch(baseUrl, { signal: AbortSignal.timeout(5_000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function reserveQaPort(requestedPort) {
  return new Promise((resolve, reject) => {
    const reservation = createServer();
    reservation.unref();
    reservation.once("error", (error) => {
      reject(new Error(
        requestedPort
          ? `Performance QA port ${requestedPort} is unavailable; refusing to reuse an unknown server`
          : `Could not reserve an isolated performance QA port: ${String(error)}`,
      ));
    });
    reservation.listen({ host: baseUrl.hostname, port: requestedPort || 0, exclusive: true }, () => {
      const address = reservation.address();
      const port = typeof address === "object" && address ? address.port : null;
      reservation.close((error) => {
        if (error) reject(error);
        else resolve(Number(port));
      });
    });
  });
}

async function ensureLocalServer() {
  if (process.env.PERF_QA_START_SERVER === '0') {
    if (!configuredBaseUrl) {
      throw new Error("PERF_QA_BASE_URL is required when PERF_QA_START_SERVER=0");
    }
    if (isGate) {
      throw new Error("Performance gate requires an isolated managed server; external servers are smoke-only");
    }
    if (await serverIsReady()) return null;
    throw new Error(`No local production server is available at ${baseUrl}`);
  }

  const requestedPort = configuredBaseUrl ? Number(baseUrl.port || 80) : 0;
  const reservedPort = await reserveQaPort(requestedPort);
  baseUrl = new URL(`http://${baseUrl.hostname}:${reservedPort}/`);
  const logs = [];
  const server = spawn(process.execPath, [
    path.join(projectRoot, 'scripts', 'run-vinext.mjs'),
    'start',
    '--host',
    baseUrl.hostname,
    '--port',
    baseUrl.port || '80',
  ], {
    cwd: projectRoot,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const capture = (chunk) => {
    logs.push(String(chunk));
    if (logs.length > 20) logs.shift();
  };
  server.stdout.on('data', capture);
  server.stderr.on('data', capture);

  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (await serverIsReady()) return server;
    if (server.exitCode !== null) {
      throw new Error(`Local production server exited with ${server.exitCode}\n${logs.join('')}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  server.kill();
  throw new Error(`Local production server did not become ready at ${baseUrl}\n${logs.join('')}`);
}

async function stopLocalServer(server) {
  if (!server || server.exitCode !== null) return;
  server.kill();
  await Promise.race([
    new Promise((resolve) => server.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
}

async function advanceToBattle(page, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const screen = await page.locator('.game-shell').getAttribute('data-screen');
    if (screen === 'battle') return;
    if (screen === 'loadout') {
      const deploy = page.getByRole('button', { name: /この編成で出撃/u });
      if (await deploy.count() === 1 && await deploy.isEnabled()) await deploy.click();
    } else if (screen === 'event') {
      const advance = page.locator('button[aria-label="セリフを送る"]');
      if (await advance.count() === 1) await advance.click();
    } else if (screen === 'result') {
      const retry = page.getByRole('button', { name: '同じ編成で再戦', exact: true });
      if (await retry.count() === 1) await retry.click();
    }
    await page.waitForTimeout(25);
  }
  throw new Error('Performance QA could not enter battle');
}

const diagnostics = { consoleErrors: [], pageErrors: [], requestFailures: [], httpErrors: [] };
const server = await ensureLocalServer();
const target = new URL(baseUrl);
target.search = new URLSearchParams({ qa: 'stress', safe: 'iphone-landscape' }).toString();
let browser;
let context;
try {
  browser = await browserType.launch({
    headless: true,
    ...(engineName === 'chromium' ? { args: ['--enable-precise-memory-info'] } : {}),
  });
  context = await browser.newContext({ viewport: { width, height } });
  await context.addInitScript(({ frameCapacity }) => {
    const state = {
      startedAt: 0,
      measuring: false,
      frameAts: new Float32Array(frameCapacity),
      frameDurations: new Float32Array(frameCapacity),
      frameCount: 0,
      frameSamplesDropped: 0,
      maxFrameGapMs: 0,
      unaccountedFrameGapMs: 0,
      longTasks: [],
      memory: [],
      memoryProxy: [],
      excludedHarnessMs: 0,
      harnessExclusions: [],
      battleActiveMs: 0,
      longTaskSupported: false,
      memorySupported: false,
    };
    Object.defineProperty(window, '__ASHFALL_PERFORMANCE_QA__', { value: state });
    let lastBattleFrame = null;
    const tick = (now) => {
      const battle = document.querySelector('.game-shell')?.getAttribute('data-screen') === 'battle';
      if (state.measuring && battle && lastBattleFrame !== null) {
        const duration = now - lastBattleFrame;
        if (duration > 0 && duration < 120_000) {
          if (state.frameCount < state.frameDurations.length) {
            state.frameAts[state.frameCount] = now - state.startedAt - state.excludedHarnessMs;
            state.frameDurations[state.frameCount] = duration;
            state.frameCount += 1;
          } else {
            state.frameSamplesDropped += 1;
          }
          state.maxFrameGapMs = Math.max(state.maxFrameGapMs, duration);
          if (duration <= 1_000) state.battleActiveMs += duration;
          else state.unaccountedFrameGapMs += duration;
        }
      }
      lastBattleFrame = state.measuring && battle ? now : null;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    const supportsLongTasks = typeof PerformanceObserver === 'function'
      && PerformanceObserver.supportedEntryTypes?.includes('longtask');
    if (supportsLongTasks) {
      try {
        const observer = new PerformanceObserver((list) => {
          if (!state.measuring) return;
          for (const entry of list.getEntries()) {
            const excluded = state.harnessExclusions.some(({ start, end }) => (
              end !== null
              && entry.startTime < end
              && entry.startTime + entry.duration > start
            ));
            if (excluded) continue;
            state.longTasks.push({
              at: entry.startTime - state.startedAt - state.excludedHarnessMs,
              duration: entry.duration,
            });
          }
        });
        observer.observe({ entryTypes: ['longtask'] });
        state.longTaskSupported = true;
      } catch {
        // Long Task API is optional (notably absent in WebKit).
      }
    }
    const sampleMemory = () => {
      if (!state.measuring) return;
      const memory = performance.memory;
      if (memory && Number.isFinite(memory.usedJSHeapSize)) {
        state.memorySupported = true;
        state.memory.push({
          at: performance.now() - state.startedAt - state.excludedHarnessMs,
          usedJSHeapSize: memory.usedJSHeapSize,
        });
      }
      const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
      const audio = window.__ASHFALL_AUDIO_QA__?.getDiagnostics?.();
      const domNodes = document.getElementsByTagName("*").length;
      const fighters = snapshot?.fighters?.length ?? 0;
      const battlefieldObjects = snapshot?.battlefieldObjects?.length ?? 0;
      const pendingWeaponHits = snapshot?.pendingWeaponHits?.length ?? 0;
      const activeVoices = audio?.activeVoices ?? 0;
      const resources = performance.getEntriesByType("resource").length;
      state.memoryProxy.push({
        at: performance.now() - state.startedAt - state.excludedHarnessMs,
        score: domNodes
          + fighters * 20
          + battlefieldObjects * 12
          + pendingWeaponHits * 4
          + activeVoices * 10
          + resources,
        domNodes,
        fighters,
        battlefieldObjects,
        pendingWeaponHits,
        activeVoices,
        resources,
      });
    };
    setInterval(sampleMemory, 10_000);
    state.beginMeasurement = () => {
      state.startedAt = performance.now();
      state.measuring = true;
      state.frameCount = 0;
      state.frameSamplesDropped = 0;
      state.maxFrameGapMs = 0;
      state.unaccountedFrameGapMs = 0;
      state.longTasks = [];
      state.memory = [];
      state.memoryProxy = [];
      state.excludedHarnessMs = 0;
      state.harnessExclusions = [];
      state.battleActiveMs = 0;
      lastBattleFrame = null;
      sampleMemory();
    };
    state.pauseForHarness = () => {
      state.measuring = false;
      lastBattleFrame = null;
      state.harnessExclusions.push({ start: performance.now(), end: null });
    };
    state.resumeAfterHarness = (durationMs) => {
      const exclusion = state.harnessExclusions.at(-1);
      if (exclusion && exclusion.end === null) exclusion.end = performance.now();
      state.excludedHarnessMs += Math.max(0, Number(durationMs) || 0);
      state.measuring = true;
      lastBattleFrame = null;
    };
  }, {
    frameCapacity: Math.ceil(durationMs / 1_000 * 180) + 1_024,
  });

  const page = await context.newPage();
  const memoryCdpSession = engineName === 'chromium' && typeof context.newCDPSession === 'function'
    ? await context.newCDPSession(page).catch(() => null)
    : null;
  if (memoryCdpSession) await memoryCdpSession.send('HeapProfiler.enable').catch(() => undefined);
  const collectRetainedHeap = async ({ excludeFromPerformance = false } = {}) => {
    if (!memoryCdpSession) return { bytes: null, durationMs: 0 };
    if (excludeFromPerformance) {
      await page.evaluate(() => window.__ASHFALL_PERFORMANCE_QA__.pauseForHarness());
    }
    const startedAt = Date.now();
    let bytes = null;
    let failure = null;
    try {
      await memoryCdpSession.send('HeapProfiler.collectGarbage');
      const usage = await memoryCdpSession.send('Runtime.getHeapUsage');
      bytes = Number.isFinite(usage?.usedSize) ? usage.usedSize : null;
    } catch (error) {
      failure = error;
    }
    const checkpointDurationMs = Math.max(0, Date.now() - startedAt);
    if (excludeFromPerformance) {
      await page.evaluate(
        (durationMs) => window.__ASHFALL_PERFORMANCE_QA__.resumeAfterHarness(durationMs),
        checkpointDurationMs,
      );
    }
    if (failure) throw failure;
    return { bytes, durationMs: checkpointDurationMs };
  };
  let topLevelNavigations = 0;
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) topLevelNavigations += 1;
  });
  page.on('console', (message) => { if (message.type() === 'error') diagnostics.consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => diagnostics.pageErrors.push(String(error)));
  page.on('requestfailed', (request) => diagnostics.requestFailures.push(`${request.url()} :: ${request.failure()?.errorText ?? 'unknown'}`));
  page.on('response', (response) => { if (response.status() >= 400) diagnostics.httpErrors.push(`${response.status()} ${response.url()}`); });

  let retries = 0;
  const response = await page.goto(String(target), { waitUntil: 'domcontentloaded', timeout: 120_000 });
  if (!response?.ok()) throw new Error(`Navigation failed with HTTP ${response?.status()}`);
  await page.locator('.game-shell').waitFor({ state: 'attached', timeout: 120_000 });
  await advanceToBattle(page);
  await page.evaluate(() => window.__ASHFALL_PERFORMANCE_QA__.beginMeasurement());
  const navigationCountAtMeasurementStart = topLevelNavigations;
  const runtimePerformanceBefore = await page.evaluate(
    () => window.__ASHFALL_BATTLE_QA__?.getPerformanceSnapshot?.() ?? null,
  );

  const measurementStartedAt = Date.now();
  let excludedHarnessDurationMs = 0;
  const warmupStart = Math.min(30_000, durationMs * 0.1);
  const warmupEnd = Math.min(180_000, Math.max(warmupStart + 1, durationMs * 0.35));
  const finalStart = Math.max(warmupEnd, durationMs - Math.min(120_000, durationMs * 0.2));
  let warmupRetainedHeapBytes = null;
  let warmupRetainedHeapGcDurationMs = null;
  let warmupRetainedHeapCollected = false;
  while (Date.now() - measurementStartedAt - excludedHarnessDurationMs < durationMs) {
    const elapsed = Date.now() - measurementStartedAt - excludedHarnessDurationMs;
    if (!warmupRetainedHeapCollected && elapsed >= warmupEnd) {
      const checkpoint = await collectRetainedHeap({ excludeFromPerformance: true });
      warmupRetainedHeapCollected = true;
      warmupRetainedHeapBytes = checkpoint.bytes;
      warmupRetainedHeapGcDurationMs = checkpoint.durationMs;
      excludedHarnessDurationMs += checkpoint.durationMs;
    }
    const screen = await page.locator('.game-shell').getAttribute('data-screen');
    if (screen === 'result') retries += 1;
    if (screen !== 'battle') await advanceToBattle(page, 30_000);
    const remaining = durationMs - (Date.now() - measurementStartedAt - excludedHarnessDurationMs);
    await page.waitForTimeout(Math.min(1_000, Math.max(1, remaining)));
  }
  await page.evaluate(() => {
    window.__ASHFALL_PERFORMANCE_QA__.measuring = false;
  });
  const finalRetainedCheckpoint = await collectRetainedHeap();
  const finalRetainedHeapBytes = finalRetainedCheckpoint.bytes;
  const finalRetainedHeapGcDurationMs = finalRetainedCheckpoint.durationMs;

  const raw = await page.evaluate(() => {
    const state = window.__ASHFALL_PERFORMANCE_QA__;
    const frames = Array.from({ length: state.frameCount }, (_, index) => ({
      at: state.frameAts[index],
      duration: state.frameDurations[index],
    }));
    return {
      frames,
      frameSamplesDropped: state.frameSamplesDropped,
      maxFrameGapMs: state.maxFrameGapMs,
      unaccountedFrameGapMs: state.unaccountedFrameGapMs,
      longTasks: state.longTasks,
      memory: state.memory,
      memoryProxy: state.memoryProxy,
      excludedHarnessMs: state.excludedHarnessMs,
      harnessExclusions: state.harnessExclusions,
      battleActiveMs: state.battleActiveMs,
      longTaskSupported: state.longTaskSupported,
      memorySupported: state.memorySupported,
      runtimePerformance: window.__ASHFALL_BATTLE_QA__?.getPerformanceSnapshot?.()
        ?? window.__ASHFALL_RUNTIME_PERFORMANCE__
        ?? null,
    };
  });
  const frameTimes = raw.frames.map((frame) => frame.duration);
  const warmupFrames = raw.frames.filter((frame) => frame.at >= warmupStart && frame.at <= warmupEnd).map((frame) => frame.duration);
  const finalFrames = raw.frames.filter((frame) => frame.at >= finalStart).map((frame) => frame.duration);
  const warmupMedian = median(warmupFrames);
  const finalMedian = median(finalFrames);
  const frameTimeDegradationPercent = warmupMedian && finalMedian
    ? (finalMedian - warmupMedian) / warmupMedian * 100
    : null;
  const warmupMemorySamples = raw.memory
    .filter((sample) => sample.at >= warmupStart && sample.at <= warmupEnd)
    .map((sample) => sample.usedJSHeapSize);
  const finalMemorySamples = raw.memory
    .filter((sample) => sample.at >= finalStart)
    .map((sample) => sample.usedJSHeapSize);
  const warmupUsedJsHeapMedianBytes = median(warmupMemorySamples);
  const finalUsedJsHeapMedianBytes = median(finalMemorySamples);
  const memoryGrowthPercent = warmupUsedJsHeapMedianBytes && finalUsedJsHeapMedianBytes
    ? (finalUsedJsHeapMedianBytes - warmupUsedJsHeapMedianBytes) / warmupUsedJsHeapMedianBytes * 100
    : null;
  const retainedHeapGrowthPercent = warmupRetainedHeapBytes && finalRetainedHeapBytes
    ? (finalRetainedHeapBytes - warmupRetainedHeapBytes) / warmupRetainedHeapBytes * 100
    : null;
  const warmupMemoryProxySamples = raw.memoryProxy
    .filter((sample) => sample.at >= warmupStart && sample.at <= warmupEnd);
  const finalMemoryProxySamples = raw.memoryProxy
    .filter((sample) => sample.at >= finalStart);
  const warmupMemoryProxyMedian = median(warmupMemoryProxySamples.map((sample) => sample.score));
  const finalMemoryProxyMedian = median(finalMemoryProxySamples.map((sample) => sample.score));
  const memoryProxyGrowthPercent = warmupMemoryProxyMedian && finalMemoryProxyMedian
    ? (finalMemoryProxyMedian - warmupMemoryProxyMedian) / warmupMemoryProxyMedian * 100
    : null;
  const longTasksOver100Ms = raw.longTasks.filter((task) => task.duration > 100);
  const maxLongTaskMs = raw.longTasks.reduce((maximum, task) => Math.max(maximum, task.duration), 0);
  const consecutiveLongTaskClusters = longTasksOver100Ms.reduce((clusters, task, index, tasks) => (
    index > 0 && task.at - (tasks[index - 1].at + tasks[index - 1].duration) < 100 ? clusters + 1 : clusters
  ), 0);
  let consecutiveRafStallRun = 0;
  let maxConsecutiveRafStallsOver100Ms = 0;
  const rafStallsOver100Ms = raw.frames.filter((frame) => {
    if (frame.duration > 100) {
      consecutiveRafStallRun += 1;
      maxConsecutiveRafStallsOver100Ms = Math.max(
        maxConsecutiveRafStallsOver100Ms,
        consecutiveRafStallRun,
      );
      return true;
    }
    consecutiveRafStallRun = 0;
    return false;
  });
  const medianFrameMs = median(frameTimes);
  const p95FrameMs = percentile(frameTimes, 0.95);
  const battleCoveragePercent = Math.min(100, raw.battleActiveMs / durationMs * 100);
  const minimumFrameSamples = Math.floor(durationMs / 1_000 * 10);
  const unexpectedNavigationCount = Math.max(0, topLevelNavigations - navigationCountAtMeasurementStart);
  const unaccountedFrameGapPercent = raw.unaccountedFrameGapMs / durationMs * 100;
  const runtimePerformanceAfter = raw.runtimePerformance;
  const simulationTickDelta = runtimePerformanceBefore && runtimePerformanceAfter
    ? runtimePerformanceAfter.simulationTicks - runtimePerformanceBefore.simulationTicks
    : null;
  const renderFrameDelta = runtimePerformanceBefore && runtimePerformanceAfter
    ? runtimePerformanceAfter.renderFrames - runtimePerformanceBefore.renderFrames
    : null;
  const memoryProxyBudgetPassed = memoryProxyGrowthPercent !== null
    && warmupMemoryProxySamples.length > 0
    && finalMemoryProxySamples.length > 0
    && memoryProxyGrowthPercent <= 25;
  const retainedHeapBudgetPassed = retainedHeapGrowthPercent !== null
    && retainedHeapGrowthPercent <= 25;
  const memoryBudgetPassed = memoryProxyBudgetPassed
    && (!raw.memorySupported || retainedHeapBudgetPassed);
  const longTaskBudgetPassed = raw.longTaskSupported
    ? consecutiveLongTaskClusters === 0 && maxLongTaskMs <= 1_000
    : maxConsecutiveRafStallsOver100Ms <= 1
      && raw.maxFrameGapMs <= 1_000
      && unaccountedFrameGapPercent <= 1;
  const gateChecks = {
    durationAtLeast15Minutes: durationMs >= 15 * 60_000,
    battleActiveAtLeast95Percent: battleCoveragePercent >= 95,
    frameSamplesSufficient: frameTimes.length >= minimumFrameSamples,
    simulationUpdatesSufficient: simulationTickDelta !== null && simulationTickDelta >= minimumFrameSamples,
    renderUpdatesSufficient: renderFrameDelta !== null && renderFrameDelta >= minimumFrameSamples,
    noFrameSampleOverflow: raw.frameSamplesDropped === 0,
    maxFrameGapAtMost1000Ms: raw.maxFrameGapMs <= 1_000,
    unaccountedFrameGapAtMost1Percent: unaccountedFrameGapPercent <= 1,
    noUnexpectedNavigationOrReload: unexpectedNavigationCount === 0,
    medianFpsAtLeast50: medianFrameMs !== null && 1_000 / medianFrameMs >= 50,
    p95FrameAtMost33Ms: p95FrameMs !== null && p95FrameMs <= 33,
    degradationAtMost10Percent: frameTimeDegradationPercent !== null && frameTimeDegradationPercent <= 10,
    memoryGrowthAtMost25Percent: memoryBudgetPassed,
    noConsecutiveLongTasks: longTaskBudgetPassed,
    maxLongTaskAtMost1000Ms: longTaskBudgetPassed,
  };
  const unsupportedChecks = Object.entries(gateChecks)
    .filter(([, check]) => check === null)
    .map(([name]) => name);
  const gatePassed = isGate && Object.values(gateChecks).every((check) => check === true);
  const summary = {
    resultVersion,
    runMode,
    engine: engineName,
    viewport: { width, height },
    durationMs,
    battleActiveMs: round(raw.battleActiveMs),
    battleCoveragePercent: round(battleCoveragePercent),
    retries,
    frameSamples: frameTimes.length,
    frameSamplesDropped: raw.frameSamplesDropped,
    maxFrameGapMs: round(raw.maxFrameGapMs),
    unaccountedFrameGapMs: round(raw.unaccountedFrameGapMs),
    unaccountedFrameGapPercent: round(unaccountedFrameGapPercent),
    unexpectedNavigationCount,
    minimumFrameSamples,
    medianFrameMs: round(medianFrameMs),
    medianFps: round(medianFrameMs ? 1_000 / medianFrameMs : null),
    p95FrameMs: round(p95FrameMs),
    frameTimeDegradationPercent: round(frameTimeDegradationPercent),
    memorySamples: raw.memory.length,
    warmupMemorySamples: warmupMemorySamples.length,
    finalMemorySamples: finalMemorySamples.length,
    warmupUsedJsHeapMedianBytes: round(warmupUsedJsHeapMedianBytes, 0),
    finalUsedJsHeapMedianBytes: round(finalUsedJsHeapMedianBytes, 0),
    memoryGrowthPercent: round(memoryGrowthPercent),
    warmupRetainedHeapBytes: round(warmupRetainedHeapBytes, 0),
    finalRetainedHeapBytes: round(finalRetainedHeapBytes, 0),
    retainedHeapGrowthPercent: round(retainedHeapGrowthPercent),
    memoryBudgetMethod: raw.memorySupported
      ? "cdp-retained-heap-after-gc-and-bounded-runtime-proxy"
      : "bounded-runtime-proxy",
    retainedHeapBudgetPassed: raw.memorySupported ? retainedHeapBudgetPassed : null,
    memoryProxyBudgetPassed,
    memoryProxySamples: raw.memoryProxy.length,
    warmupMemoryProxySamples: warmupMemoryProxySamples.length,
    finalMemoryProxySamples: finalMemoryProxySamples.length,
    warmupMemoryProxyMedian: round(warmupMemoryProxyMedian),
    finalMemoryProxyMedian: round(finalMemoryProxyMedian),
    memoryProxyGrowthPercent: round(memoryProxyGrowthPercent),
    longTasksOver100Ms: longTasksOver100Ms.length,
    maxLongTaskMs: round(maxLongTaskMs),
    consecutiveLongTaskClusters,
    rafStallsOver100Ms: rafStallsOver100Ms.length,
    maxConsecutiveRafStallsOver100Ms,
    capabilities: {
      memory: raw.memorySupported,
      longTask: raw.longTaskSupported,
    },
    runtimePerformance: {
      before: runtimePerformanceBefore,
      after: runtimePerformanceAfter,
      simulationTickDelta,
      renderFrameDelta,
    },
    harness: {
      measurementStartsAfterBattleEntry: true,
      frameCapacity: Math.ceil(durationMs / 1_000 * 180) + 1_024,
      animationFrameDomProbe: true,
      runtimeDiagnosticsPollMs: 250,
      retainedHeapGcCheckpoints: memoryCdpSession ? ["warmup-end", "measurement-end"] : [],
      warmupRetainedHeapGcDurationMs,
      finalRetainedHeapGcDurationMs,
      excludedHarnessDurationMs: round(raw.excludedHarnessMs),
      harnessExclusions: raw.harnessExclusions,
    },
    diagnostics,
    gate: {
      evaluated: isGate,
      passed: isGate ? gatePassed : null,
      checks: isGate ? gateChecks : null,
      unsupportedChecks: isGate ? unsupportedChecks : [],
    },
  };
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(summary, null, 2));
  const diagnosticsFailed = Object.values(diagnostics).some((entries) => entries.length > 0);
  if (diagnosticsFailed || (isGate && !gatePassed)) process.exitCode = 1;
} finally {
  await context?.close();
  await browser?.close();
  await stopLocalServer(server);
}
