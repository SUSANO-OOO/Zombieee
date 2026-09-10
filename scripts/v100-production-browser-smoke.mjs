import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";

const baseUrl = new URL(process.env.V100_CAMPAIGN_QA_BASE_URL ?? "http://127.0.0.1:4177/");
if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname)) {
  throw new Error(`V1 production QA is local-only; refusing ${baseUrl}`);
}
const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href)
  : await import("playwright");
const browserTypes = { chromium: playwright.chromium, webkit: playwright.webkit };
const engines = (process.env.V100_CAMPAIGN_QA_ENGINES ?? "chromium,webkit")
  .split(",")
  .map((engine) => engine.trim())
  .filter(Boolean);
const unknownEngines = engines.filter((engine) => !browserTypes[engine]);
if (unknownEngines.length > 0) throw new Error(`Unknown V100_CAMPAIGN_QA_ENGINES: ${unknownEngines.join(", ")}`);

const defaultViewports = [
  { width: 844, height: 340, safeArea: true },
  { width: 844, height: 390, safeArea: true },
  { width: 1280, height: 720, safeArea: false },
];
const viewports = process.env.V100_CAMPAIGN_QA_VIEWPORTS
  ? process.env.V100_CAMPAIGN_QA_VIEWPORTS.split(",").map((entry) => {
    const match = entry.trim().match(/^(\d+)x(\d+)$/u);
    if (!match) throw new Error(`Invalid V100_CAMPAIGN_QA_VIEWPORTS entry: ${entry}`);
    const width = Number(match[1]);
    const height = Number(match[2]);
    return { width, height, safeArea: width === 844 && (height === 340 || height === 390) };
  })
  : defaultViewports;
const timeout = Math.max(15_000, Number(process.env.V100_CAMPAIGN_QA_TIMEOUT_MS) || 45_000);
const battleTimeout = Math.max(45_000, Number(process.env.V100_CAMPAIGN_BATTLE_TIMEOUT_MS) || 120_000);
const evidenceDir = path.resolve(process.env.V100_CAMPAIGN_QA_EVIDENCE_DIR ?? "outputs/v100-production-browser-smoke");
const requirePwaOffer = process.env.V100_CAMPAIGN_QA_REQUIRE_PWA_OFFER === "1";
const results = [];

await mkdir(evidenceDir, { recursive: true });

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function diagnosticsFor(page) {
  const diagnostics = { consoleErrors: [], pageErrors: [], requestFailures: [], httpFailures: [], warnings: [] };
  page.on("console", (message) => {
    if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
    if (message.type() === "warning" && !message.text().includes("was preloaded using link preload but not used")) {
      diagnostics.warnings.push(message.text());
    }
  });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(String(error)));
  page.on("requestfailed", (request) => {
    const errorText = request.failure()?.errorText ?? "unknown";
    if (errorText !== "net::ERR_ABORTED") diagnostics.requestFailures.push(`${request.url()} :: ${errorText}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) diagnostics.httpFailures.push(`${response.status()} ${response.url()}`);
  });
  return diagnostics;
}

async function visible(locator) {
  if (await locator.count() === 0) return false;
  return locator.first().isVisible().catch(() => false);
}

async function clickButton(page, locator, label) {
  await locator.waitFor({ state: "visible", timeout });
  const box = await locator.boundingBox();
  invariant(box && box.width >= 40 && box.height >= 28, `${label} has no usable hit target: ${JSON.stringify(box)}`);
  await locator.click();
}

async function advanceToMap(page) {
  for (let step = 0; step < 220; step += 1) {
    if (await visible(page.locator(".v100-map-layout"))) return step;
    const skip = page.getByRole("button", { name: "スキップ", exact: true });
    if (await visible(skip)) {
      await clickButton(page, skip, "story skip");
    } else {
      const advance = page.locator(".v100-event-actions .v100-primary");
      await clickButton(page, advance, "story advance");
    }
    await page.waitForTimeout(20);
  }
  throw new Error("V1 story did not reach the map within 220 transitions");
}

async function advanceToFormation(page) {
  for (let step = 0; step < 40; step += 1) {
    if (await visible(page.locator(".v100-formation-panel"))) return step;
    const skip = page.getByRole("button", { name: "スキップ", exact: true });
    if (await visible(skip)) {
      await clickButton(page, skip, "pre-operation skip");
    } else {
      await clickButton(page, page.locator(".v100-event-actions .v100-primary"), "pre-operation advance");
    }
    await page.waitForTimeout(20);
  }
  throw new Error("V1 pre-operation event did not reach formation");
}

async function overflowAudit(page) {
  return page.evaluate(() => {
    const round = (value) => Math.max(0, Math.ceil(Number(value || 0) * 100) / 100);
    const elements = [
      ["document", document.documentElement],
      ["body", document.body],
      ["v100-shell", document.querySelector(".v100-shell")],
      ["game-shell", document.querySelector(".game-shell")],
    ];
    return Object.fromEntries(elements.map(([name, element]) => [name, element ? {
      scrollWidth: round(element.scrollWidth),
      clientWidth: round(element.clientWidth),
      overflowX: getComputedStyle(element).overflowX,
      delta: round(element.scrollWidth - element.clientWidth),
    } : null]));
  });
}

async function debugSnapshot(page) {
  return page.evaluate(() => ({
    url: location.href,
    phase: document.querySelector(".v100-shell")?.getAttribute("data-v100-phase") ?? null,
    stage: document.querySelector(".v100-shell")?.getAttribute("data-v100-stage") ?? null,
    pwa: document.querySelector("[role=dialog][aria-label='ゲームデータの準備']")?.textContent?.slice(0, 500) ?? null,
    assetState: document.documentElement.dataset.assetLoadState ?? null,
    asset: window.__ASHFALL_ASSET_QA__?.getState?.() ?? null,
    mount: window.__ASHFALL_ASSET_QA__?.getBattleMountState?.() ?? null,
  }));
}

for (const engine of engines) {
  let browser;
  try {
    browser = await browserTypes[engine].launch({ headless: true });
  } catch (error) {
    throw new Error(`${engine} launch failed: ${String(error)}`);
  }
  try {
    for (const viewport of viewports) {
      const name = `${engine}-${viewport.width}x${viewport.height}`;
      const context = await browser.newContext({
        viewport,
        hasTouch: viewport.safeArea,
        isMobile: viewport.safeArea,
      });
      const page = await context.newPage();
      const diagnostics = diagnosticsFor(page);
      const result = { name, engine, viewport, status: "failed", pwaOfferShown: false, path: null };
      try {
        const url = new URL("v100", baseUrl);
        if (viewport.safeArea) url.searchParams.set("safe", "iphone-landscape");
        const response = await page.goto(String(url), { waitUntil: "domcontentloaded", timeout });
        invariant(response?.ok(), `V1 navigation failed: HTTP ${response?.status()}`);
        await page.waitForFunction(() => Boolean(
          document.querySelector(".v100-shell")
            || document.querySelector("[role=dialog][aria-label='ゲームデータの準備'] button"),
        ), null, { timeout });

        const offer = page.getByRole("button", { name: "ブラウザで遊ぶ", exact: true });
        await offer.waitFor({ state: "visible", timeout: Math.min(timeout, 10_000) }).catch(() => {});
        result.pwaOfferShown = await visible(offer);
        if (result.pwaOfferShown) {
          const pwaEvidence = path.join(evidenceDir, `${name}-pwa-offer.png`);
          await page.screenshot({ path: pwaEvidence });
          result.pwaOfferEvidence = path.relative(process.cwd(), pwaEvidence).replaceAll("\\", "/");
          await clickButton(page, offer, "PWA browser play");
        }
        if (requirePwaOffer) invariant(result.pwaOfferShown, `${name}: PWA offer was not displayed`);
        await page.locator(".v100-shell").waitFor({ state: "attached", timeout }).catch(async (error) => {
          const body = await page.locator("body").innerText().catch(() => "");
          throw new Error(`${String(error)}; post-offer body=${body.slice(0, 800)}`);
        });

        const nameTitle = page.locator("#v100-name-title");
        await page.waitForFunction(() => Boolean(document.querySelector("#v100-name-title, .v100-map-layout")), null, { timeout });
        if (await visible(nameTitle)) {
          await page.locator("#v100-player-name").fill("QAプレイヤー");
          const nameEvidence = path.join(evidenceDir, `${name}-name.png`);
          await page.screenshot({ path: nameEvidence });
          result.nameEvidence = path.relative(process.cwd(), nameEvidence).replaceAll("\\", "/");
          await clickButton(page, page.locator(".v100-name-card .v100-primary"), "start V1 story");
        }
        await advanceToMap(page);
        result.nameOrResume = await page.locator("#v100-name-title, .v100-map-layout").first().isVisible();
        result.map = true;
        const mapEvidence = path.join(evidenceDir, `${name}-map.png`);
        await page.screenshot({ path: mapEvidence });
        result.mapEvidence = path.relative(process.cwd(), mapEvidence).replaceAll("\\", "/");

        const formationCta = page.getByRole("button", { name: "この作戦を編成", exact: true });
        await clickButton(page, formationCta, "map formation CTA");
        await advanceToFormation(page);
        await page.locator(".v100-formation-panel").waitFor({ state: "visible", timeout });
        const formationEvidence = path.join(evidenceDir, `${name}-formation.png`);
        await page.screenshot({ path: formationEvidence });
        result.formationEvidence = path.relative(process.cwd(), formationEvidence).replaceAll("\\", "/");
        const roster = page.locator(".v100-roster-card").first();
        await clickButton(page, roster, "formation roster card");
        const battleButton = page.getByRole("button", { name: "戦闘へ", exact: true });
        await clickButton(page, battleButton, "formation battle CTA");
        await page.locator('.game-shell[data-screen="battle"]').waitFor({ state: "visible", timeout: battleTimeout });
        await page.waitForFunction(() => document.documentElement.dataset.assetLoadState === "ready", null, { timeout: battleTimeout });
        await page.waitForFunction(() => window.__ASHFALL_ASSET_QA__?.getBattleMountState?.().battleMounted === true, null, { timeout: battleTimeout });
        invariant(await page.locator(".crawler-alert").count() === 0, `${name}: ambiguous crawler alert still mounted`);
        result.formation = true;
        result.battle = true;
        result.assetState = await page.evaluate(() => document.documentElement.dataset.assetLoadState);
        result.mount = await page.evaluate(() => window.__ASHFALL_ASSET_QA__?.getBattleMountState?.() ?? null);
        result.overflow = await overflowAudit(page);
        for (const [owner, audit] of Object.entries(result.overflow)) {
          invariant(!audit || audit.delta <= 1, `${name}: horizontal overflow on ${owner}: ${JSON.stringify(audit)}`);
        }
        const battleEvidence = path.join(evidenceDir, `${name}-battle.png`);
        await page.screenshot({ path: battleEvidence });
        result.battleEvidence = path.relative(process.cwd(), battleEvidence).replaceAll("\\", "/");
        result.status = "passed";
      } catch (error) {
        result.error = String(error);
        result.debug = await debugSnapshot(page).catch(() => null);
        result.overflow = await overflowAudit(page).catch(() => null);
        throw error;
      } finally {
        result.diagnostics = diagnostics;
        results.push(result);
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  build: await productionBuildIdentity(),
  baseUrl: String(baseUrl),
  requirePwaOffer,
  results,
};
const reportPath = path.join(evidenceDir, "report.json");
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
const failures = results.filter((entry) => entry.status !== "passed" || entry.diagnostics.consoleErrors.length > 0 || entry.diagnostics.pageErrors.length > 0 || entry.diagnostics.httpFailures.length > 0 || entry.diagnostics.requestFailures.length > 0);
if (failures.length > 0) throw new Error(`V1 production QA failed: ${JSON.stringify(failures, null, 2)}`);
console.log(JSON.stringify({ status: "passed", cases: results.length, pwaOffers: results.filter(({ pwaOfferShown }) => pwaOfferShown).length, report: path.relative(process.cwd(), reportPath).replaceAll("\\", "/") }, null, 2));
