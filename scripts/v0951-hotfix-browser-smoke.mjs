import { legacyQaUrl } from "./legacy-qa-url.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  computeCampaignSaveIntegrity,
  createDefaultCampaignSave,
} from "../app/campaign.js";
import { dismissInstallOffer, readSaveEnvironment } from "./pwa-gate-qa.mjs";

const baseUrl = new URL(process.env.V0951_HOTFIX_QA_BASE_URL ?? "");
if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname)) {
  throw new Error(`Version 0.9.5.1 hotfix QA is local-only: ${baseUrl}`);
}
const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href)
  : await import("playwright");
const browserTypes = { chromium: playwright.chromium, webkit: playwright.webkit };
const engines = (process.env.V0951_HOTFIX_QA_ENGINES ?? "chromium,webkit").split(",").map((value) => value.trim()).filter(Boolean);
const viewports = [
  { width: 1280, height: 720 },
  { width: 844, height: 390 },
  { width: 844, height: 340 },
];
const timeout = 45_000;
const evidenceDir = path.resolve(process.env.V0951_HOTFIX_QA_EVIDENCE_DIR ?? "outputs/v0951-hotfix");
const saveKey = "nishijin-campaign-v1";
const results = [];
await mkdir(evidenceDir, { recursive: true });

const currentSave = {
  ...createDefaultCampaignSave(),
  campaignStarted: true,
  readStoryEventIds: ["prologue-opening-v070", "prologue-summary-v070"],
  revision: 51,
  updatedAt: "2026-07-31T00:00:00.000Z",
};
currentSave.integrity = computeCampaignSaveIntegrity(currentSave);
const serializedCurrentSave = JSON.stringify(currentSave);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function diagnosticsFor(page) {
  const diagnostics = { consoleErrors: [], pageErrors: [], requestFailures: [], httpErrors: [] };
  page.on("console", (message) => {
    if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(String(error)));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown";
    if (failure !== "net::ERR_ABORTED") diagnostics.requestFailures.push(`${request.url()} :: ${failure}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) diagnostics.httpErrors.push(`${response.status()} ${response.url()}`);
  });
  return diagnostics;
}

async function advanceToMap(page) {
  for (let step = 0; step < 12; step += 1) {
    if (await page.locator(".map-screen").isVisible()) return;
    if (await page.locator(".event-screen").isVisible()) {
      await page.getByRole("button", { name: "スキップ", exact: true }).click();
      await page.getByRole("button", { name: "この会話をスキップ", exact: true }).click();
      await page.waitForTimeout(100);
      continue;
    }
    await page.waitForTimeout(100);
  }
  await page.locator(".map-screen").waitFor({ state: "visible", timeout });
}

async function advanceToBattle(page) {
  for (let step = 0; step < 12; step += 1) {
    if (await page.locator('.game-shell[data-screen="battle"]').isVisible()) return;
    if (await page.locator(".event-screen").isVisible()) {
      await page.getByRole("button", { name: "スキップ", exact: true }).click();
      await page.getByRole("button", { name: "この会話をスキップ", exact: true }).click();
      await page.waitForTimeout(100);
      continue;
    }
    await page.waitForTimeout(100);
  }
  await page.locator('.game-shell[data-screen="battle"]').waitFor({ state: "visible", timeout });
}

async function reachLoadout(page) {
  await page.locator('.game-shell:not([data-save-persistence="checking"])').waitFor({ state: "visible", timeout });
  const start = page.locator(".title-start");
  invariant(await start.isEnabled(), "title start button stayed disabled");
  await start.click();
  await advanceToMap(page);
  const prepare = page.getByRole("button", { name: "この作戦を編成", exact: true });
  invariant(await prepare.isEnabled(), "stage prepare button is disabled");
  await prepare.click();
  await page.locator(".formation-screen").waitFor({ state: "visible", timeout });
}

async function runCase(browser, engine, viewport, scenario) {
  const context = await browser.newContext({
    viewport,
    hasTouch: true,
    deviceScaleFactor: viewport.width === 1280 ? 1 : 3,
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  const seeded = scenario !== "fresh";
  if (seeded) {
    await page.addInitScript(({ key, serialized }) => localStorage.setItem(key, serialized), {
      key: saveKey,
      serialized: serializedCurrentSave,
    });
  }
  if (scenario === "idb-timeout") {
    await page.addInitScript(() => {
      Object.defineProperty(window, "indexedDB", {
        configurable: true,
        value: { open: () => ({}) },
      });
    });
  }
  if (scenario === "idb-blocked") {
    await page.addInitScript(() => {
      Object.defineProperty(window, "indexedDB", {
        configurable: true,
        value: {
          open() {
            const request = {};
            queueMicrotask(() => request.onblocked?.());
            return request;
          },
        },
      });
    });
  }
  if (scenario === "decode-hang") {
    await page.addInitScript(() => {
      HTMLImageElement.prototype.decode = () => new Promise(() => {});
    });
  }
  if (scenario === "load-timeout") {
    await page.route("**/art/v060/battle-nishijin-shopping-street-v1.webp", () => {});
  }
  if (scenario === "optional-hang") {
    await page.route("**/tactical-drop-pod-v1.png", () => {});
  }
  if (scenario === "slow-network") {
    await page.route("**/*.{png,webp}", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 180));
      await route.continue();
    });
  }

  try {
    await page.goto(legacyQaUrl(baseUrl), { waitUntil: "domcontentloaded", timeout });
    await dismissInstallOffer(page, { timeout });
    await page.locator(".title-screen-v060").waitFor({ state: "visible", timeout });
    const environment = await readSaveEnvironment(page, { timeout });
    invariant(environment.kind === "loopback", `${scenario}: wrong environment ${JSON.stringify(environment)}`);
    await reachLoadout(page);
    await page.locator('.game-shell[data-assets-state="ready"], .game-shell[data-assets-state="error"]').waitFor({ state: "visible", timeout });
    let assetState = await page.locator(".game-shell").getAttribute("data-assets-state");
    const persistence = await page.locator(".game-shell").getAttribute("data-save-persistence");
    if (scenario === "idb-timeout" || scenario === "idb-blocked") {
      invariant(persistence === "recovered", `${scenario}: save did not settle as recovered`);
      invariant(await page.locator(".save-persistence-warning").isVisible(), `${scenario}: player-facing degraded reason missing`);
      invariant(await page.getByRole("button", { name: "保存先を再確認", exact: true }).isEnabled(), `${scenario}: save retry missing`);
    }
    if (scenario === "load-timeout") {
      invariant(assetState === "error", "load timeout did not expose assetError");
      const retry = page.locator(".formation-footer .campaign-primary");
      invariant(await retry.isEnabled(), "asset reload control is disabled");
      invariant((await retry.innerText()).includes("アセット再読込"), "asset reload control is missing");
      await page.unroute("**/art/v060/battle-nishijin-shopping-street-v1.webp");
      await retry.click();
      await page.locator(".title-screen-v060").waitFor({ state: "visible", timeout });
      await reachLoadout(page);
      await page.locator('.game-shell[data-assets-state="ready"]').waitFor({ state: "visible", timeout });
      assetState = await page.locator(".game-shell").getAttribute("data-assets-state");
      invariant(assetState === "ready", "asset reload did not create and finish a new load generation");
      const deploy = page.locator(".formation-footer .campaign-primary");
      invariant(await deploy.isEnabled(), "deploy stayed disabled after asset reload");
      await deploy.click();
      await advanceToBattle(page);
    } else {
      invariant(assetState === "ready", `${scenario}: critical assets did not become ready`);
      const deploy = page.locator(".formation-footer .campaign-primary");
      invariant(await deploy.isEnabled(), `${scenario}: deploy button stayed disabled`);
      await deploy.click();
      await advanceToBattle(page);
    }
    if (scenario === "normal") {
      await page.reload({ waitUntil: "domcontentloaded", timeout });
      await page.locator('.game-shell:not([data-save-persistence="checking"])').waitFor({ state: "visible", timeout });
      await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
      const resynced = await page.evaluate(() => document.documentElement.dataset.saveEnvironmentKind ?? null);
      invariant(resynced === "loopback", `reload/BFCache environment resync failed: ${resynced}`);
    }
    const dimensions = await page.evaluate(() => ({
      width: innerWidth,
      height: innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    invariant(dimensions.scrollWidth === dimensions.width, `${scenario}: horizontal overflow ${JSON.stringify(dimensions)}`);
    invariant(
      diagnostics.consoleErrors.length === 0
        && diagnostics.pageErrors.length === 0
        && diagnostics.requestFailures.length === 0
        && diagnostics.httpErrors.length === 0,
      `${scenario}: diagnostics ${JSON.stringify(diagnostics)}`,
    );
    const name = `${engine}-${viewport.width}x${viewport.height}-${scenario}`;
    if (scenario !== "load-timeout") {
      await page.screenshot({ path: path.join(evidenceDir, `${name}.png`), fullPage: true });
    }
    results.push({ name, environment, persistence, assetState, dimensions, diagnostics, pass: true });
  } finally {
    await context.close();
  }
}

for (const engine of engines) {
  const browserType = browserTypes[engine];
  invariant(browserType, `Unsupported browser engine: ${engine}`);
  const browser = await browserType.launch({ headless: true });
  try {
    for (const viewport of viewports) {
      await runCase(browser, engine, viewport, viewport.width === 1280 ? "fresh" : "normal");
    }
    for (const scenario of ["idb-timeout", "idb-blocked", "decode-hang", "load-timeout", "slow-network", "optional-hang"]) {
      await runCase(browser, engine, { width: 844, height: 390 }, scenario);
    }
  } finally {
    await browser.close();
  }
}

const summary = { version: "0.9.5.1", total: results.length, passed: results.length, results };
await writeFile(path.join(evidenceDir, "summary.json"), JSON.stringify(summary, null, 2), "utf8");
console.log(JSON.stringify(summary, null, 2));
