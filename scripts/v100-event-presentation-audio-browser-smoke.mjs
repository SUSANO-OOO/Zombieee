import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";
import { V100_STAGES, V100_SUPPORTS, V100_UNITS, V100_STAGE_IDS } from "../app/v100Registry.js";
import { createDefaultV100Save, normalizeV100Save, serializeV100Save } from "../app/v100Save.js";
import { v100EventPresentationFor } from "../app/v100EventPresentation.js";

const baseUrl = new URL(process.env.V100_EVENT_AUDIO_QA_BASE_URL ?? process.env.V100_CAMPAIGN_QA_BASE_URL ?? "http://127.0.0.1:4177/");
if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname)) throw new Error(`V1 event QA is local-only; refusing ${baseUrl}`);
const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href)
  : await import("playwright");
const browserTypes = { chromium: playwright.chromium, webkit: playwright.webkit };
const engines = (process.env.V100_EVENT_AUDIO_QA_ENGINES ?? "chromium,webkit").split(",").map((value) => value.trim()).filter(Boolean);
const viewports = (process.env.V100_EVENT_AUDIO_QA_VIEWPORTS ?? "1280x720,844x390").split(",").map((value) => {
  const match = value.match(/^(\d+)x(\d+)$/u);
  if (!match) throw new Error(`Invalid V100_EVENT_AUDIO_QA_VIEWPORTS value: ${value}`);
  const width = Number(match[1]);
  const height = Number(match[2]);
  return { width, height, safeArea: width === 844 && [340, 390].includes(height) };
});
const timeout = Math.max(15_000, Number(process.env.V100_EVENT_AUDIO_QA_TIMEOUT_MS) || 45_000);
const evidenceDir = path.resolve(process.env.V100_EVENT_AUDIO_QA_EVIDENCE_DIR ?? "outputs/v100-event-presentation-audio");
const storageKeys = ["nishijin-campaign-v100", "nishijin-campaign-v100:mirror", "nishijin-campaign-v100:last-known-good", "nishijin-campaign-v100:owner"];
const bossStage = V100_STAGES.find((stage) => stage.missionType === "boss") ?? V100_STAGES[2];
const eventCases = Object.freeze([
  { id: "prologue", eventId: "v100:event:prologue", phase: "event" },
  { id: "boss-reveal", eventId: bossStage.eventIds.pre, phase: "event" },
  { id: "battle-post", eventId: bossStage.eventIds.post, phase: "post" },
  { id: "ending", eventId: "v100:event:ending", phase: "ending" },
  { id: "credits", eventId: "v100:event:credits", phase: "credits" },
  { id: "epilogue", eventId: "v100:event:epilogue", phase: "epilogue" },
]);
const results = [];

await mkdir(evidenceDir, { recursive: true });

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function diagnosticsFor(page) {
  const diagnostics = { consoleErrors: [], pageErrors: [], requestFailures: [], httpFailures: [] };
  page.on("console", (message) => { if (message.type() === "error") diagnostics.consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(String(error)));
  page.on("requestfailed", (request) => {
    const reason = request.failure()?.errorText ?? "unknown";
    if (reason !== "net::ERR_ABORTED") diagnostics.requestFailures.push(`${request.url()} :: ${reason}`);
  });
  page.on("response", (response) => { if (response.status() >= 400) diagnostics.httpFailures.push(`${response.status()} ${response.url()}`); });
  return diagnostics;
}

function eventSave(eventCase) {
  const base = createDefaultV100Save({ playerName: "QAプレイヤー" });
  return normalizeV100Save({
    ...base,
    revision: 7,
    campaignStarted: true,
    playerName: "QAプレイヤー",
    caps: 9999,
    availableStageIds: [...V100_STAGE_IDS],
    completedStageIds: V100_STAGE_IDS.slice(0, -1),
    registeredUnitIds: V100_UNITS.map((unit) => unit.id),
    ownedUnitIds: V100_UNITS.map((unit) => unit.id),
    supportPurchaseUnlockedIds: V100_SUPPORTS.map((support) => support.id),
    ownedSupportIds: V100_SUPPORTS.map((support) => support.id),
    equippedSupportId: V100_SUPPORTS[0]?.id ?? null,
    formationSlots: V100_UNITS.slice(0, 7).map((unit) => unit.id),
    flowState: {
      phase: eventCase.phase,
      eventId: eventCase.eventId,
      stageId: bossStage.id,
      stageNumber: bossStage.number,
      destination: eventCase.phase,
      nodeIndex: 0,
      firstClear: false,
      finalized: true,
    },
  });
}

async function seedPage(page, save) {
  const serialized = serializeV100Save(save);
  await page.addInitScript(({ keys, value }) => {
    for (const key of keys) localStorage.removeItem(key);
    for (const key of keys.slice(0, 3)) localStorage.setItem(key, value);
  }, { keys: storageKeys, value: serialized });
}

async function clickUsable(locator, label) {
  await locator.waitFor({ state: "visible", timeout });
  const box = await locator.boundingBox();
  invariant(box && box.width >= 28 && box.height >= 24, `${label} unusable: ${JSON.stringify(box)}`);
  await locator.click();
}

function uniqueRequestedKeys(receipts) {
  return receipts.filter(({ action }) => action === "requested").map(({ eventId, nodeIndex, sceneId }) => `${eventId}:${nodeIndex}:${sceneId}`);
}

for (const engine of engines) {
  if (!browserTypes[engine]) throw new Error(`Unknown V100 event QA engine: ${engine}`);
  const browser = await browserTypes[engine].launch({ headless: true });
  try {
    for (const viewport of viewports) {
      for (const eventCase of eventCases) {
        const name = `${engine}-${viewport.width}x${viewport.height}-${eventCase.id}`;
        const context = await browser.newContext({ viewport, hasTouch: viewport.safeArea, isMobile: viewport.safeArea });
        const page = await context.newPage();
        const diagnostics = diagnosticsFor(page);
        const result = { name, engine, viewport, eventCase, status: "failed" };
        try {
          await seedPage(page, eventSave(eventCase));
          const url = new URL("v100", baseUrl);
          url.searchParams.set("event-audio-qa", "1");
          const response = await page.goto(String(url), { waitUntil: "domcontentloaded", timeout });
          invariant(response?.ok(), `navigation HTTP ${response?.status()}`);
          const offer = page.getByRole("button", { name: "ブラウザで遊ぶ", exact: true });
          await offer.waitFor({ state: "visible", timeout: Math.min(timeout, 10_000) }).catch(() => {});
          if (await offer.isVisible().catch(() => false)) await clickUsable(offer, "PWA browser play");
          const eventSelector = `[data-v100-event-id="${eventCase.eventId}"]`;
          await page.locator(eventSelector).waitFor({ state: "visible", timeout });
          const observed = await page.locator(eventSelector).evaluate((element) => ({
            category: element.getAttribute("data-v100-event-category"),
            phase: element.getAttribute("data-v100-transition"),
            nodeIndex: element.getAttribute("data-v100-node-index"),
            audioOwner: element.getAttribute("data-v100-audio-owner"),
            bodyText: document.body.innerText.trim(),
            overflow: Math.max(document.documentElement.scrollWidth - document.documentElement.clientWidth, document.body.scrollWidth - document.body.clientWidth),
          }));
          const expected = v100EventPresentationFor({ eventId: eventCase.eventId, phase: eventCase.phase, node: { kind: "action" }, nodeIndex: 0 });
          invariant(observed.category === expected.category, `${name} category ${observed.category} !== ${expected.category}`);
          invariant(observed.audioOwner === "v100-event-runtime", `${name} event audio owner missing`);
          invariant(observed.bodyText.length > 0, `${name} blank body`);
          invariant(observed.overflow <= 1, `${name} horizontal overflow ${observed.overflow}`);
          await page.waitForTimeout(180);
          const before = await page.evaluate(() => window.__V100_EVENT_AUDIO_QA__?.getSnapshot?.() ?? null);
          invariant(before?.owner === "v100-event-runtime", `${name} QA audio owner missing`);
          invariant((before.receipts ?? []).some(({ action }) => action === "requested"), `${name} has no requested event audio`);
          const primary = page.locator(".v100-event-actions .v100-primary");
          if (await primary.isVisible().catch(() => false)) {
            await clickUsable(primary, `${name} event action`);
            await page.waitForTimeout(220);
          }
          await page.evaluate(() => window.__V100_EVENT_AUDIO_QA__?.stop?.("qa-boundary"));
          const after = await page.evaluate(() => window.__V100_EVENT_AUDIO_QA__?.getSnapshot?.() ?? null);
          const requestedKeys = uniqueRequestedKeys(after?.receipts ?? []);
          invariant(new Set(requestedKeys).size === requestedKeys.length, `${name} duplicate event audio requests`);
          invariant((after?.receipts ?? []).some(({ action }) => action === "stopped"), `${name} missing stop receipt`);
          const evidencePath = path.join(evidenceDir, `${name}.png`);
          await page.screenshot({ path: evidencePath, animations: "disabled" });
          result.observed = observed;
          result.expected = { category: expected.category, sceneId: expected.sceneId, transition: expected.transition, audioOwner: expected.audioOwner };
          result.receipts = after?.receipts ?? [];
          result.audioDiagnostics = after?.diagnostics ?? null;
          result.evidence = path.relative(process.cwd(), evidencePath).replaceAll("\\", "/");
          result.status = "passed";
        } catch (error) {
          result.error = String(error);
          result.debug = await page.evaluate(() => ({ url: location.href, body: document.body.innerText.slice(0, 1000), audio: window.__V100_EVENT_AUDIO_QA__?.getSnapshot?.() ?? null })).catch(() => null);
          throw new Error(`${String(error)} debug=${JSON.stringify(result.debug)}`);
        } finally {
          result.diagnostics = diagnostics;
          results.push(result);
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
}

const report = { generatedAt: new Date().toISOString(), build: await productionBuildIdentity(), baseUrl: String(baseUrl), cases: results };
const reportPath = path.join(evidenceDir, "report.json");
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
const failures = results.filter((result) => result.status !== "passed"
  || result.diagnostics.consoleErrors.length > 0
  || result.diagnostics.pageErrors.length > 0
  || result.diagnostics.requestFailures.length > 0
  || result.diagnostics.httpFailures.length > 0);
if (failures.length > 0) throw new Error(`V1 event presentation/audio QA failed: ${JSON.stringify(failures, null, 2)}`);
console.log(JSON.stringify({ status: "passed", cases: results.length, report: path.relative(process.cwd(), reportPath).replaceAll("\\", "/") }, null, 2));
