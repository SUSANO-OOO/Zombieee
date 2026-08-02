import { pathToFileURL } from "node:url";
import path from "node:path";

import { dismissInstallOffer } from "./pwa-gate-qa.mjs";

const baseUrl = new URL(process.env.SAVE_BOUNDARY_QA_BASE_URL ?? "http://127.0.0.1:4177/");
if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname)) {
  throw new Error(`Save-boundary QA is local-only; refusing ${baseUrl}`);
}

const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href)
  : await import("playwright");
const browserTypes = { chromium: playwright.chromium, webkit: playwright.webkit };
const engines = (process.env.SAVE_BOUNDARY_QA_ENGINES ?? "chromium,webkit")
  .split(",")
  .map((engine) => engine.trim())
  .filter(Boolean);
const viewports = (process.env.SAVE_BOUNDARY_QA_VIEWPORTS ?? "1280x720,844x390,844x340")
  .split(",")
  .map((entry) => {
    const [width, height] = entry.trim().split("x").map(Number);
    if (!Number.isFinite(width) || !Number.isFinite(height)) throw new Error(`Invalid viewport: ${entry}`);
    return { width, height, safeArea: width === 844 && (height === 390 || height === 340) };
  });
const timeout = Math.max(15_000, Number(process.env.SAVE_BOUNDARY_QA_TIMEOUT_MS) || 45_000);
const saveKey = "nishijin-campaign-v1";
const operationCueIds = new Set([
  "ui-select",
  "ui-confirm",
  "ui-cancel",
  "sfx-v070-terminal-confirm",
  "sfx-v070-power-switch",
  "sfx-v070-rescue-confirm",
  "support-pod-deploy",
  "ui-error",
]);
const results = [];

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

function runtimeState(snapshot) {
  return {
    time: snapshot.time,
    paused: snapshot.paused,
    over: snapshot.over,
    wave: snapshot.wave,
    eventIndex: snapshot.eventIndex,
    pendingSpawnCount: snapshot.pendingSpawnCount,
    energy: snapshot.energy,
    scrap: snapshot.scrap,
    supportGauge: snapshot.supportGauge,
    deployQueue: snapshot.deployQueue,
    fighters: snapshot.fighters.map(({ id, hp, x, y, cooldown, manualAbility }) => ({
      id,
      hp,
      x,
      y,
      cooldown,
      manualAbility: manualAbility
        ? { phase: manualAbility.phase, cooldownRemaining: manualAbility.cooldownRemaining, activationId: manualAbility.activationId }
        : null,
    })),
    corpses: snapshot.corpses.map(({ id, state, elapsed }) => ({ id, state, elapsed })),
    battlefieldObjects: snapshot.battlefieldObjects.map(({ id, kind, x, y, phase }) => ({ id, kind, x, y, phase })),
    manualAbilityReceipts: snapshot.manualAbilityReceipts.map(({ ownerId, activationId, eventType }) => ({ ownerId, activationId, eventType })),
    placementIndicator: snapshot.placementIndicator,
  };
}

async function readSave(page) {
  return page.evaluate((key) => localStorage.getItem(key), saveKey);
}

async function readCues(page) {
  return page.evaluate(() => window.__ASHFALL_AUDIO_QA__?.getCueRequests?.() ?? []);
}

function cueDelta(cues, start) {
  return cues.slice(start).map((cue) => cue.cueId);
}

async function openBattle(page, viewport) {
  const url = new URL(baseUrl);
  url.search = new URLSearchParams({ qa: "roles", ...(viewport.safeArea ? { safe: "iphone-landscape" } : {}) }).toString();
  const response = await page.goto(String(url), { waitUntil: "domcontentloaded", timeout });
  invariant(response?.ok(), `navigation failed: HTTP ${response?.status()}`);
  await dismissInstallOffer(page, { timeout: Math.min(timeout, 5_000) });
  const migrationButton = page.getByRole("button", { name: "内容を確認", exact: true });
  if (await migrationButton.isVisible().catch(() => false)) await migrationButton.click();
  const start = page.locator(".formation-footer .campaign-primary");
  await start.waitFor({ state: "visible", timeout });
  await page.waitForFunction(() => {
    const button = document.querySelector(".formation-footer .campaign-primary");
    return button instanceof HTMLButtonElement && !button.disabled;
  }, null, { timeout });
  await start.click();
  for (let count = 0; count < 8; count += 1) {
    await page.waitForFunction(() => (
      Boolean(document.querySelector("canvas.battlefield.active"))
      || Boolean(document.querySelector(".event-screen"))
    ), null, { timeout });
    if (await page.locator("canvas.battlefield.active").isVisible().catch(() => false)) break;
    const skip = page.locator(".event-screen").getByRole("button", { name: "スキップ", exact: true });
    if (await skip.count()) {
      await skip.click();
      const confirmSkip = page.getByRole("button", { name: "この会話をスキップ", exact: true });
      if (await confirmSkip.count()) await confirmSkip.click();
    }
  }
  await page.locator("canvas.battlefield.active").waitFor({ state: "visible", timeout });
  await page.waitForFunction(() => typeof window.__ASHFALL_BATTLE_QA__?.getSnapshot === "function", null, { timeout });
}

async function assertBlocked(page, label, trigger, baseline, saveBefore, cueBefore) {
  await trigger();
  await page.waitForTimeout(60);
  const snapshot = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
  const saveAfter = await readSave(page);
  const cues = await readCues(page);
  const delta = cueDelta(cues, cueBefore);
  invariant(JSON.stringify(runtimeState(snapshot)) === JSON.stringify(baseline),
    `${label}: runtime changed while save boundary was pending: ${JSON.stringify({ before: baseline, after: runtimeState(snapshot) })}`);
  invariant(saveAfter === saveBefore, `${label}: durable localStorage save changed while blocked`);
  invariant(snapshot.saveBoundaryPending === true, `${label}: save boundary was not active`);
  invariant(snapshot.banner === "保存処理中 // 操作を待機" && snapshot.bannerTime > 0,
    `${label}: reject feedback missing: ${JSON.stringify({ banner: snapshot.banner, bannerTime: snapshot.bannerTime })}`);
  const operationDelta = delta.filter((cueId) => operationCueIds.has(cueId));
  invariant(operationDelta.length === 1 && operationDelta[0] === "ui-error",
    `${label}: expected one reject operation cue, got ${JSON.stringify(delta)}`);
  return { label, cueDelta: delta, banner: snapshot.banner };
}

for (const engine of engines) {
  invariant(browserTypes[engine], `Unknown browser engine: ${engine}`);
  let browser;
  try {
    browser = await browserTypes[engine].launch({ headless: true });
  } catch (error) {
    results.push({ engine, status: "failed", error: `browser launch failed: ${String(error)}` });
    continue;
  }
  try {
    for (const viewport of viewports) {
      const name = `${engine}-${viewport.width}x${viewport.height}`;
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        hasTouch: viewport.safeArea,
        isMobile: viewport.safeArea,
      });
      const page = await context.newPage();
      const diagnostics = diagnosticsFor(page);
      const result = { engine, viewport, status: "failed" };
      try {
        await openBattle(page, viewport);
        await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.prepareManualAbilityProof("scout"));
        await page.waitForFunction(() => document.querySelector('.manual-ability-ready[data-ability-kind="scout"]') !== null, null, { timeout });
        const boundaryCueStart = (await readCues(page)).length;
        await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setSaveBoundaryPending(true));
        await page.waitForFunction(() => window.__ASHFALL_BATTLE_QA__.getSnapshot().saveBoundaryPending === true, null, { timeout });
        const beforeSnapshot = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
        const baseline = runtimeState(beforeSnapshot);
        const saveBefore = await readSave(page);
        const attempts = [];
        const pauseButton = page.getByRole("button", { name: "一時停止", exact: true }).first();

        const runAttempt = async (label, trigger) => {
          const cueBefore = (await readCues(page)).length;
          attempts.push(await assertBlocked(page, label, trigger, baseline, saveBefore, cueBefore));
          await page.waitForTimeout(260);
        };

        await runAttempt("mouse-pause", async () => {
          const box = await pauseButton.boundingBox();
          invariant(box && box.width > 0 && box.height > 0, "pause button has no mouse bounds");
          await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        });
        if (viewport.safeArea) {
          await runAttempt("touch-pause", async () => {
            const box = await pauseButton.boundingBox();
            invariant(box && box.width > 0 && box.height > 0, "pause button has no touch bounds");
            await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
          });
        }
        await runAttempt("keyboard-enter-pause", async () => {
          await pauseButton.focus();
          await page.keyboard.press("Enter");
        });
        await runAttempt("keyboard-space-pause", async () => {
          await pauseButton.focus();
          await page.keyboard.press("Space");
        });
        const support = page.locator("button.support-btn.pod");
        if (await support.count()) await runAttempt("mouse-support", () => support.click({ force: true }));
        const deploy = page.locator('button.unit-card[aria-disabled="false"]').first();
        if (await deploy.count()) await runAttempt("mouse-deploy", () => deploy.click({ force: true }));
        const ability = page.locator('.manual-ability-ready[data-ability-kind="scout"]');
        await runAttempt("mouse-ability", () => ability.click({ force: true }));

        const pendingCues = (await readCues(page)).slice(boundaryCueStart);
        const pendingOperationCues = pendingCues.filter((cue) => operationCueIds.has(cue.cueId));
        invariant(pendingOperationCues.filter((cue) => cue.cueId === "ui-error").length === attempts.length,
          `${name}: blocked attempts did not produce one reject cue each: ${JSON.stringify({ attempts, cues: pendingCues })}`);
        invariant(pendingOperationCues.filter((cue) => cue.cueId !== "ui-error").length === 0,
          `${name}: blocked attempts emitted a non-reject cue: ${JSON.stringify(pendingCues)}`);

        await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setSaveBoundaryPending(false));
        await page.waitForFunction(() => window.__ASHFALL_BATTLE_QA__.getSnapshot().saveBoundaryPending === false, null, { timeout });
        await pauseButton.click();
        await page.waitForFunction(() => window.__ASHFALL_BATTLE_QA__.getSnapshot().paused === true, null, { timeout });
        await page.getByRole("button", { name: "作戦を再開", exact: true }).click();
        await page.waitForFunction(() => window.__ASHFALL_BATTLE_QA__.getSnapshot().paused === false, null, { timeout });
        const afterResume = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
        invariant(afterResume.saveBoundaryPending === false, `${name}: save boundary stayed active after clear`);
        invariant((await readSave(page)) === saveBefore, `${name}: save changed during normal pause/resume QA`);
        result.status = "passed";
        result.attempts = attempts;
        result.pendingRuntimeUnchanged = true;
        result.durableSaveUnchanged = true;
        result.resumeAfterClear = true;
        result.diagnostics = diagnostics;
      } catch (error) {
        result.error = String(error);
        result.diagnostics = diagnostics;
      } finally {
        await context.close();
      }
      invariant(result.status === "passed", `${name}: ${result.error ?? "failed"}`);
      invariant(Object.values(diagnostics).every((entries) => entries.length === 0),
        `${name}: browser diagnostics ${JSON.stringify(diagnostics)}`);
      results.push(result);
    }
  } finally {
    await browser.close();
  }
}

console.log(JSON.stringify({ status: "passed", results }, null, 2));
