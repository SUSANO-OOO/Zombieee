import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const baseUrl = new URL(process.env.PERF_QA_BASE_URL ?? "http://127.0.0.1:4177/");
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
const resultVersion = process.env.PERF_QA_VERSION ?? '0.7.1';
const target = new URL(baseUrl);
target.search = new URLSearchParams({ qa: 'stress', safe: 'iphone-landscape' }).toString();

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

async function ensureLocalServer() {
  if (await serverIsReady()) return null;
  if (process.env.PERF_QA_START_SERVER === '0') {
    throw new Error(`No local production server is available at ${baseUrl}`);
  }

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
let browser;
let context;
try {
  browser = await browserType.launch({
    headless: true,
    ...(engineName === 'chromium' ? { args: ['--enable-precise-memory-info'] } : {}),
  });
  context = await browser.newContext({ viewport: { width, height } });
  await context.addInitScript(() => {
    const state = {
      startedAt: performance.now(),
      frames: [],
      longTasks: [],
      memory: [],
      battleActiveMs: 0,
      longTaskSupported: false,
      memorySupported: false,
    };
    Object.defineProperty(window, '__ASHFALL_PERFORMANCE_QA__', { value: state });
    let lastBattleFrame = null;
    const tick = (now) => {
      const battle = document.querySelector('.game-shell')?.getAttribute('data-screen') === 'battle';
      if (battle && lastBattleFrame !== null) {
        const duration = now - lastBattleFrame;
        if (duration > 0 && duration < 1_000) {
          state.frames.push({ at: now - state.startedAt, duration });
          state.battleActiveMs += duration;
        }
      }
      lastBattleFrame = battle ? now : null;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    if (typeof PerformanceObserver === 'function') {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            state.longTasks.push({ at: entry.startTime - state.startedAt, duration: entry.duration });
          }
        });
        observer.observe({ entryTypes: ['longtask'] });
        state.longTaskSupported = true;
      } catch {
        // Long Task API is optional (notably absent in WebKit).
      }
    }
    const sampleMemory = () => {
      const memory = performance.memory;
      if (memory && Number.isFinite(memory.usedJSHeapSize)) {
        state.memorySupported = true;
        state.memory.push({ at: performance.now() - state.startedAt, usedJSHeapSize: memory.usedJSHeapSize });
      }
    };
    sampleMemory();
    setInterval(sampleMemory, 10_000);
  });

  const page = await context.newPage();
  page.on('console', (message) => { if (message.type() === 'error') diagnostics.consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => diagnostics.pageErrors.push(String(error)));
  page.on('requestfailed', (request) => diagnostics.requestFailures.push(`${request.url()} :: ${request.failure()?.errorText ?? 'unknown'}`));
  page.on('response', (response) => { if (response.status() >= 400) diagnostics.httpErrors.push(`${response.status()} ${response.url()}`); });

  let retries = 0;
  const response = await page.goto(String(target), { waitUntil: 'domcontentloaded', timeout: 120_000 });
  if (!response?.ok()) throw new Error(`Navigation failed with HTTP ${response?.status()}`);
  await page.locator('.game-shell').waitFor({ state: 'attached', timeout: 120_000 });
  await advanceToBattle(page);

  const deadline = Date.now() + durationMs;
  while (Date.now() < deadline) {
    const screen = await page.locator('.game-shell').getAttribute('data-screen');
    if (screen === 'result') retries += 1;
    if (screen !== 'battle') await advanceToBattle(page, 30_000);
    await page.waitForTimeout(Math.min(1_000, Math.max(1, deadline - Date.now())));
  }

  const raw = await page.evaluate(() => window.__ASHFALL_PERFORMANCE_QA__);
  const frameTimes = raw.frames.map((frame) => frame.duration);
  const warmupStart = Math.min(30_000, durationMs * 0.1);
  const warmupEnd = Math.min(180_000, Math.max(warmupStart + 1, durationMs * 0.35));
  const finalStart = Math.max(warmupEnd, durationMs - Math.min(120_000, durationMs * 0.2));
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
  const longTasksOver100Ms = raw.longTasks.filter((task) => task.duration > 100);
  const consecutiveLongTaskClusters = longTasksOver100Ms.reduce((clusters, task, index, tasks) => (
    index > 0 && task.at - (tasks[index - 1].at + tasks[index - 1].duration) < 100 ? clusters + 1 : clusters
  ), 0);
  const medianFrameMs = median(frameTimes);
  const p95FrameMs = percentile(frameTimes, 0.95);
  const battleCoveragePercent = Math.min(100, raw.battleActiveMs / durationMs * 100);
  const minimumFrameSamples = Math.floor(durationMs / 1_000 * 10);
  const gateChecks = {
    durationAtLeast15Minutes: durationMs >= 15 * 60_000,
    battleActiveAtLeast95Percent: battleCoveragePercent >= 95,
    frameSamplesSufficient: frameTimes.length >= minimumFrameSamples,
    medianFpsAtLeast50: medianFrameMs !== null && 1_000 / medianFrameMs >= 50,
    p95FrameAtMost33Ms: p95FrameMs !== null && p95FrameMs <= 33,
    degradationAtMost10Percent: frameTimeDegradationPercent !== null && frameTimeDegradationPercent <= 10,
    memoryGrowthAtMost25Percent: raw.memorySupported && memoryGrowthPercent !== null
      ? memoryGrowthPercent <= 25
      : null,
    noConsecutiveLongTasks: raw.longTaskSupported ? consecutiveLongTaskClusters === 0 : null,
  };
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
    longTasksOver100Ms: longTasksOver100Ms.length,
    consecutiveLongTaskClusters,
    capabilities: {
      memory: raw.memorySupported,
      longTask: raw.longTaskSupported,
    },
    diagnostics,
    gate: {
      evaluated: isGate,
      passed: isGate ? gatePassed : null,
      checks: isGate ? gateChecks : null,
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
