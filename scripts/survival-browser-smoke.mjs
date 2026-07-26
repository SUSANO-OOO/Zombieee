import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

if (!process.env.SURVIVAL_QA_BASE_URL) {
  throw new Error("SURVIVAL_QA_BASE_URL is required; use the isolated QA runner");
}
const baseUrl = new URL(process.env.SURVIVAL_QA_BASE_URL);
if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname)) {
  throw new Error(`Survival QA is local-only; refusing ${baseUrl}`);
}
const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href)
  : await import("playwright");
const browserTypes = { chromium: playwright.chromium, webkit: playwright.webkit };
const engines = (process.env.SURVIVAL_QA_ENGINES ?? "chromium,webkit")
  .split(",")
  .map((engine) => engine.trim())
  .filter(Boolean);
const viewports = [
  { width: 1280, height: 720, safeArea: false },
  { width: 844, height: 390, safeArea: true },
  { width: 844, height: 340, safeArea: true },
];
const timeout = Math.max(10_000, Number(process.env.SURVIVAL_QA_TIMEOUT_MS) || 30_000);
const evidenceDir = path.resolve(
  process.env.SURVIVAL_QA_EVIDENCE_DIR ?? "outputs/survival-browser-smoke",
);
const results = [];
await mkdir(evidenceDir, { recursive: true });

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function diagnosticsFor(page) {
  const state = {
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
    httpErrors: [],
  };
  page.on("console", (message) => {
    if (message.type() === "error") state.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => state.pageErrors.push(String(error)));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown";
    if (failure !== "net::ERR_ABORTED") {
      state.requestFailures.push(`${request.url()} :: ${failure}`);
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 400) state.httpErrors.push(`${response.status()} ${response.url()}`);
  });
  return state;
}

async function snapshot(page) {
  return page.evaluate(() => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.());
}

async function activate(page, locator, useTouch) {
  await locator.waitFor({ state: "visible", timeout });
  if (!useTouch) {
    await locator.click();
    return "mouse";
  }
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  invariant(box && box.width > 0 && box.height > 0, "touch target has no visible bounds");
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  return "touch";
}

async function assertCompactLayout(page, viewport) {
  const layout = await page.evaluate(() => {
    const rect = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return {
        left: box.left,
        right: box.right,
        top: box.top,
        bottom: box.bottom,
        width: box.width,
        height: box.height,
      };
    };
    const tapTargets = [...document.querySelectorAll(
      ".survival-speed button,.survival-pause,.bottom-hud button",
    )].filter((element) => !element.disabled).map((element) => {
      const box = element.getBoundingClientRect();
      return { width: box.width, height: box.height };
    });
    return {
      frame: rect(".game-frame"),
      hud: rect(".survival-hud"),
      bottom: rect(".bottom-hud"),
      stats: rect(".stats-strip"),
      tapTargets,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
    };
  });
  invariant(layout.frame && layout.hud && layout.bottom && layout.stats, "Survival layout is incomplete");
  invariant(layout.hud.bottom <= layout.bottom.top, `top and bottom HUD overlap: ${JSON.stringify(layout)}`);
  invariant(layout.bottom.bottom <= layout.stats.top + 1, `bottom HUD overlaps stats: ${JSON.stringify(layout)}`);
  invariant(layout.scrollWidth <= layout.innerWidth + 1, `horizontal overflow: ${JSON.stringify(layout)}`);
  invariant(layout.scrollHeight <= layout.innerHeight + 1, `vertical overflow: ${JSON.stringify(layout)}`);
  invariant(layout.tapTargets.length > 0, "no enabled Survival tap targets");
  invariant(
    layout.tapTargets.every(({ width, height }) => width >= 43.5 && height >= 43.5),
    `tap target below 44px at ${viewport.width}x${viewport.height}: ${JSON.stringify(layout.tapTargets)}`,
  );
  return layout;
}

for (const engine of engines) {
  if (!browserTypes[engine]) throw new Error(`Unknown SURVIVAL_QA_ENGINES entry: ${engine}`);
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
        viewport,
        hasTouch: viewport.safeArea,
        isMobile: viewport.safeArea,
      });
      const page = await context.newPage();
      const diagnostics = diagnosticsFor(page);
      const result = { engine, viewport, status: "failed" };
      try {
        const url = new URL(baseUrl);
        const search = new URLSearchParams({
          qa: "flow",
          screen: "map",
          stage: "stage-t-plan-central-seal",
          stars: "3",
        });
        if (viewport.safeArea) search.set("safe", "iphone-landscape");
        url.search = search.toString();
        const response = await page.goto(String(url), {
          waitUntil: "domcontentloaded",
          timeout,
        });
        invariant(response?.ok(), `navigation failed: HTTP ${response?.status()}`);
        await page.locator('.game-shell[data-screen="map"]').waitFor({ timeout });
        let touchActivationCount = 0;
        if (await activate(
          page,
          page.getByRole("button", { name: "サバイバル", exact: true }),
          viewport.safeArea,
        ) === "touch") touchActivationCount += 1;
        await page.locator('.game-shell[data-screen="survival"]').waitFor({ timeout });
        invariant(await page.getByText("Survival Mode", { exact: true }).isVisible(), "Survival lobby missing");
        await page.screenshot({ path: path.join(evidenceDir, `${name}-lobby.png`) });

        if (await activate(
          page,
          page.getByRole("button", { name: "新しいrunを開始", exact: true }),
          viewport.safeArea,
        ) === "touch") touchActivationCount += 1;
        await page.locator('.game-shell[data-screen="battle"] .survival-hud').waitFor({ timeout });
        const unitCard = page.locator(".unit-card:not(:disabled)").first();
        await unitCard.waitFor({ timeout });
        if (await activate(page, unitCard, viewport.safeArea) === "touch") touchActivationCount += 1;
        await page.waitForFunction(() => (
          window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().survivalRun?.phase === "in-wave"
        ), undefined, { timeout });

        await page.waitForFunction(() => {
          const fighters = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().fighters ?? [];
          return fighters.some((fighter) => (
            fighter.side === "zombie"
            && fighter.gateEntering
            && !fighter.combatReady
            && fighter.x > 960
          ));
        }, undefined, { timeout });
        const entrySnapshot = await snapshot(page);
        const enteringEnemy = entrySnapshot.fighters.find((fighter) => (
          fighter.side === "zombie"
          && fighter.gateEntering
          && !fighter.combatReady
          && fighter.x > 960
        ));
        invariant(enteringEnemy.targetId === null, `entering enemy acquired target: ${JSON.stringify(enteringEnemy)}`);
        invariant(
          enteringEnemy.x > enteringEnemy.combatReadyX,
          `enemy combat-ready boundary is invalid: ${JSON.stringify(enteringEnemy)}`,
        );

        const speed2 = page.getByRole("button", { name: "2倍", exact: true });
        if (await activate(page, speed2, viewport.safeArea) === "touch") touchActivationCount += 1;
        await page.waitForFunction(() => (
          window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().survivalRun?.speed === 2
        ), undefined, { timeout });
        const layout = await assertCompactLayout(page, viewport);
        await page.screenshot({ path: path.join(evidenceDir, `${name}-battle.png`) });

        const entryVisibilityProof = await page.evaluate(() => (
          window.__ASHFALL_BATTLE_QA__.prepareSurvivalEntryVisibilityProof()
        ));
        invariant(
          entryVisibilityProof.x > entryVisibilityProof.combatReadyX,
          `entry visibility proof crossed combat-ready boundary: ${JSON.stringify(entryVisibilityProof)}`,
        );
        await page.waitForTimeout(50);
        const canvas = page.locator("canvas").first();
        const visibleEntryPng = await canvas.screenshot({
          path: path.join(evidenceDir, `${name}-entry-visible.png`),
        });
        const switchedToLegacyClip = await page.evaluate(
          ({ fighterId }) => window.__ASHFALL_BATTLE_QA__
            .setSurvivalEntryVisibilityMode(fighterId, "base-interior"),
          entryVisibilityProof,
        );
        invariant(switchedToLegacyClip, "could not apply legacy entry clip for pixel comparison");
        await page.waitForTimeout(50);
        const legacyClippedPng = await canvas.screenshot();
        const visibleMetadata = await sharp(visibleEntryPng).metadata();
        const proofCropWidth = Math.min(180, visibleMetadata.width);
        const proofCrop = {
          left: visibleMetadata.width - proofCropWidth,
          top: 0,
          width: proofCropWidth,
          height: visibleMetadata.height,
        };
        const visibleEntryPixels = await sharp(visibleEntryPng).extract(proofCrop).raw().toBuffer();
        const legacyClippedPixels = await sharp(legacyClippedPng).extract(proofCrop).raw().toBuffer();
        let entryChangedChannels = 0;
        for (let index = 0; index < visibleEntryPixels.length; index += 1) {
          if (Math.abs(visibleEntryPixels[index] - legacyClippedPixels[index]) >= 8) {
            entryChangedChannels += 1;
          }
        }
        invariant(
          entryChangedChannels >= 120,
          `right-edge entry is not visibly different from the legacy hidden clip: ${entryChangedChannels}`,
        );
        const restoredRightEdgeClip = await page.evaluate(
          ({ fighterId }) => window.__ASHFALL_BATTLE_QA__
            .setSurvivalEntryVisibilityMode(fighterId, "right-edge-outside"),
          entryVisibilityProof,
        );
        invariant(restoredRightEdgeClip, "could not restore right-edge entry clip");

        const checkpoint = await page.evaluate(() => (
          window.__ASHFALL_BATTLE_QA__.prepareSurvivalUpgradeProof()
        ));
        invariant(checkpoint.choices.length === 3, `upgrade choice count mismatch: ${JSON.stringify(checkpoint)}`);
        await page.locator(".survival-upgrade-screen").waitFor({ timeout });
        const upgradeChoice = page.locator(".survival-upgrade-choices button:not(:disabled)").first();
        await upgradeChoice.waitFor({ timeout });
        await page.screenshot({ path: path.join(evidenceDir, `${name}-upgrade.png`) });
        if (await activate(page, upgradeChoice, viewport.safeArea) === "touch") touchActivationCount += 1;
        await page.waitForFunction(() => {
          const run = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().survivalRun;
          return run?.phase === "wave-ready" && Object.keys(run.temporaryUpgradeStacks).length > 0;
        }, undefined, { timeout });

        const settlementAttemptsBeforeFailure = await page.evaluate(() => (
          window.__ASHFALL_BATTLE_QA__.failNextSurvivalSettlementSave()
        ));
        if (await activate(page, page.locator(".survival-pause"), viewport.safeArea) === "touch") {
          touchActivationCount += 1;
        }
        if (await activate(
          page,
          page.getByRole("button", { name: "エリアマップへ撤退", exact: true }),
          viewport.safeArea,
        ) === "touch") touchActivationCount += 1;
        if (await activate(
          page,
          page.getByRole("button", { name: "実行する", exact: true }),
          viewport.safeArea,
        ) === "touch") touchActivationCount += 1;
        await page.waitForFunction((expectedAttempts) => (
          window.__ASHFALL_BATTLE_QA__?.getSnapshot?.()
            .survivalSettlementPersistenceAttempts === expectedAttempts
          && [...document.querySelectorAll("h2")]
            .some((heading) => heading.textContent === "Survival結果を保存できません")
        ), settlementAttemptsBeforeFailure + 1, { timeout });
        const settlementAttemptsAfterFailure = (await snapshot(page))
          .survivalSettlementPersistenceAttempts;
        invariant(
          settlementAttemptsAfterFailure === settlementAttemptsBeforeFailure + 1,
          `settlement failure attempt count mismatch: ${settlementAttemptsBeforeFailure} -> ${settlementAttemptsAfterFailure}`,
        );
        await page.waitForTimeout(250);
        const settlementAttemptsWhileAwaitingRetry = (await snapshot(page))
          .survivalSettlementPersistenceAttempts;
        invariant(
          settlementAttemptsWhileAwaitingRetry === settlementAttemptsAfterFailure,
          `settlement auto-retried while awaiting user action: ${settlementAttemptsAfterFailure} -> ${settlementAttemptsWhileAwaitingRetry}`,
        );
        if (await activate(
          page,
          page.getByRole("button", { name: "一括保存を再試行", exact: true }),
          viewport.safeArea,
        ) === "touch") touchActivationCount += 1;
        await page.locator('.game-shell[data-screen="survival-result"]').waitFor({ timeout });
        const settlementSnapshot = await snapshot(page);
        const runId = settlementSnapshot.survivalRun.runId;
        invariant(
          settlementSnapshot.survivalProgress.processedRunIds.filter((id) => id === runId).length === 1,
          `run receipt was not stored exactly once: ${JSON.stringify(settlementSnapshot.survivalProgress)}`,
        );
        invariant(
          settlementSnapshot.survivalProgress.activeCheckpoint === null,
          "settlement did not delete the active checkpoint",
        );
        invariant(
          settlementSnapshot.equipmentInventory.some(({ quantity }) => quantity >= 1),
          `equipment quantity was not persisted: ${JSON.stringify(settlementSnapshot.equipmentInventory)}`,
        );
        await page.screenshot({ path: path.join(evidenceDir, `${name}-result.png`) });

        invariant(diagnostics.consoleErrors.length === 0, `console errors: ${diagnostics.consoleErrors.join(" | ")}`);
        invariant(diagnostics.pageErrors.length === 0, `page errors: ${diagnostics.pageErrors.join(" | ")}`);
        invariant(diagnostics.requestFailures.length === 0, `request failures: ${diagnostics.requestFailures.join(" | ")}`);
        invariant(diagnostics.httpErrors.length === 0, `HTTP errors: ${diagnostics.httpErrors.join(" | ")}`);
        Object.assign(result, {
          status: "passed",
          entryEnemy: {
            kind: enteringEnemy.kind,
            x: enteringEnemy.x,
            combatReadyX: enteringEnemy.combatReadyX,
          },
          entryVisibilityProof: {
            ...entryVisibilityProof,
            changedChannels: entryChangedChannels,
          },
          settlementRetryProof: {
            beforeFailure: settlementAttemptsBeforeFailure,
            afterFailure: settlementAttemptsAfterFailure,
            whileAwaitingRetry: settlementAttemptsWhileAwaitingRetry,
            afterManualRetry: settlementSnapshot.survivalSettlementPersistenceAttempts,
          },
          inputMode: viewport.safeArea ? "touch" : "mouse",
          touchActivationCount,
          checkpointId: checkpoint.checkpointId,
          processedRunId: runId,
          equipmentInventory: settlementSnapshot.equipmentInventory,
          layout,
          diagnostics,
        });
      } catch (error) {
        result.error = String(error);
        result.diagnostics = diagnostics;
      } finally {
        results.push(result);
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}

await writeFile(
  path.join(evidenceDir, "results.json"),
  `${JSON.stringify(results, null, 2)}\n`,
  "utf8",
);
const failures = results.filter(({ status }) => status !== "passed");
if (failures.length > 0) {
  throw new Error(`Survival browser smoke failed: ${JSON.stringify(failures)}`);
}
console.log(`Survival browser smoke passed (${results.length} viewport runs)`);
