import { legacyQaUrl } from "./legacy-qa-url.mjs";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";

import { chromium } from "playwright";
import { computeCampaignSaveIntegrity, createDefaultCampaignSave } from "../app/campaign.js";

const parent = path.dirname(process.cwd());
const versions = [
  {
    version: "0.9.5",
    sha: "18e1fb349faa54602c956371d7224200acc17225",
    cwd: path.resolve(process.env.V0952_PERF_V095_DIR ?? path.join(parent, "new-chat-v095-release-measure")),
  },
  {
    version: "0.9.5.1",
    sha: "4a21e551d4a5e9641b2374a3ba1da6f37e28e4c8",
    cwd: path.resolve(process.env.V0952_PERF_V0951_DIR ?? path.join(parent, "new-chat-v0951-hotfix")),
  },
  {
    version: "0.9.5.2-candidate",
    sha: process.env.V0952_PERF_CANDIDATE_SHA ?? "working-tree",
    cwd: process.cwd(),
  },
];
const outputPath = path.resolve(process.env.V0952_PERF_OUTPUT ?? "outputs/v0952-hotfix/performance-comparison.json");
const saveKey = "nishijin-campaign-v1";
const save = {
  ...createDefaultCampaignSave(),
  campaignStarted: true,
  readStoryEventIds: ["prologue-opening-v070", "prologue-summary-v070"],
  revision: 52,
  updatedAt: "2026-07-31T00:00:00.000Z",
};
save.integrity = computeCampaignSaveIntegrity(save);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

async function reservePort() {
  const server = createServer();
  server.unref();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port: 0, exclusive: true }, resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : null;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function withServer(version, task) {
  const port = await reservePort();
  const origin = `http://127.0.0.1:${port}/`;
  const server = spawn(process.execPath, ["scripts/run-vinext.mjs", "start", "--host", "127.0.0.1", "--port", String(port)], {
    cwd: version.cwd,
    env: process.env,
    stdio: ["ignore", "ignore", "inherit"],
  });
  try {
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      if (server.exitCode !== null) throw new Error(`${version.version} server exited with ${server.exitCode}`);
      try {
        const response = await fetch(origin);
        if (response.ok) break;
      } catch {
        // Server is still starting.
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    invariant((await fetch(origin)).ok, `${version.version} server did not become ready`);
    return await task(origin);
  } finally {
    if (server.exitCode === null) server.kill();
    await Promise.race([once(server, "exit"), new Promise((resolve) => setTimeout(resolve, 2000))]);
    if (server.exitCode === null) server.kill("SIGKILL");
  }
}

async function skipEventsUntil(page, selector) {
  for (let step = 0; step < 16; step += 1) {
    if (await page.locator(selector).isVisible()) return;
    if (await page.locator(".event-screen").isVisible()) {
      await page.getByRole("button", { name: "スキップ", exact: true }).click();
      await page.getByRole("button", { name: "この会話をスキップ", exact: true }).click();
    }
    await page.waitForTimeout(60);
  }
  await page.locator(selector).waitFor({ state: "visible", timeout: 30_000 });
}

async function measurePage(page, origin, cacheState) {
  await page.addInitScript(({ key, serialized }) => localStorage.setItem(key, serialized), {
    key: saveKey,
    serialized: JSON.stringify(save),
  });
  const startedAt = performance.now();
  await page.goto(legacyQaUrl(origin), { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.locator('.game-shell:not([data-save-persistence="checking"])').waitFor({ state: "visible", timeout: 30_000 });
  await page.locator(".title-screen-v060").waitFor({ state: "visible", timeout: 30_000 });
  const titleReadyMs = performance.now() - startedAt;
  const mapStartedAt = performance.now();
  await page.locator(".title-start").click();
  await skipEventsUntil(page, ".map-screen");
  const mapReadyMs = performance.now() - mapStartedAt;
  const loadoutStartedAt = performance.now();
  await page.getByRole("button", { name: "この作戦を編成", exact: true }).click();
  let loadoutTimedOut = false;
  try {
    await page.locator('.game-shell[data-assets-state="ready"],.game-shell[data-assets-state="degraded-ready"],.game-shell[data-assets-state="error"]').waitFor({ state: "visible", timeout: 15_000 });
  } catch {
    loadoutTimedOut = true;
  }
  const loadoutTerminalMs = performance.now() - loadoutStartedAt;
  const metrics = await page.evaluate(() => {
    const entries = performance.getEntriesByType("resource");
    const navigation = performance.getEntriesByType("navigation")[0];
    const sum = (values) => Math.round(values.reduce((total, value) => total + value, 0));
    const scripts = entries.filter((entry) => /\.js(?:$|\?)/.test(entry.name));
    const audio = entries.filter((entry) => /\.(?:mp3|ogg|m4a)(?:$|\?)/.test(entry.name));
    const images = entries.filter((entry) => /\.(?:png|webp|svg)(?:$|\?)/.test(entry.name));
    const qa = window.__ASHFALL_ASSET_QA__;
    return {
      htmlResponseEndMs: Math.round(navigation?.responseEnd ?? 0),
      domContentLoadedMs: Math.round(navigation?.domContentLoadedEventEnd ?? 0),
      totalRequests: entries.length + 1,
      transferBytes: sum(entries.map((entry) => entry.transferSize || 0)) + Math.round(navigation?.transferSize || 0),
      jsRequests: scripts.length,
      jsTransferBytes: sum(scripts.map((entry) => entry.transferSize || 0)),
      imageRequests: images.length,
      imageTransferBytes: sum(images.map((entry) => entry.transferSize || 0)),
      audioPreloadRequests: audio.length,
      audioPreloadTransferBytes: sum(audio.map((entry) => entry.transferSize || 0)),
      criticalAssetCount: qa?.getState?.().total ?? null,
      assetState: document.querySelector(".game-shell")?.getAttribute("data-assets-state") ?? null,
      usedJsHeapBytes: performance.memory?.usedJSHeapSize ?? null,
    };
  });
  return {
    cacheState,
    titleReadyMs: Math.round(titleReadyMs),
    mapReadyMs: Math.round(mapReadyMs),
    loadoutTerminalMs: Math.round(loadoutTerminalMs),
    loadoutTimedOut,
    ...metrics,
  };
}

const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const version of versions) {
    const measurements = await withServer(version, async (origin) => {
      const context = await browser.newContext({
        viewport: { width: 844, height: 390 },
        hasTouch: true,
        deviceScaleFactor: 3,
        serviceWorkers: "block",
      });
      try {
        const page = await context.newPage();
        const cold = await measurePage(page, origin, "cold");
        // The candidate intentionally releases the battle gate before optional
        // art finishes. Let that bounded background session settle so the warm
        // pass measures cache reuse rather than cancelling deferred work.
        if (version.version === "0.9.5.2-candidate") await page.waitForTimeout(6500);
        const warm = await measurePage(page, origin, "warm");
        return [cold, warm];
      } finally {
        await context.close();
      }
    });
    results.push({ ...version, cwd: undefined, measurements });
  }
} finally {
  await browser.close();
}

const report = {
  measuredAt: new Date().toISOString(),
  viewport: { width: 844, height: 390, deviceScaleFactor: 3, hasTouch: true },
  methodology: "Chromium production builds; identical v14 save; title to map to Stage 1 loadout; cold then warm in one isolated context.",
  results,
};
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify(report, null, 2));
