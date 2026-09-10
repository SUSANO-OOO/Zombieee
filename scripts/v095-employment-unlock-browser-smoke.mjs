import { legacyQaUrl } from "./legacy-qa-url.mjs";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  CAMPAIGN_UNIT_IDS,
  computeCampaignSaveIntegrity,
  createDefaultCampaignSave,
} from "../app/campaign.js";
import { dismissInstallOffer } from "./pwa-gate-qa.mjs";

if (!process.env.V095_EMPLOYMENT_QA_BASE_URL) {
  throw new Error("V095_EMPLOYMENT_QA_BASE_URL is required");
}
const baseUrl = new URL(process.env.V095_EMPLOYMENT_QA_BASE_URL);
if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname)) {
  throw new Error(`Version 0.9.5 employment QA is local-only: ${baseUrl}`);
}

const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href)
  : await import("playwright");
const browserTypes = { chromium: playwright.chromium, webkit: playwright.webkit };
const engines = (process.env.V095_EMPLOYMENT_QA_ENGINES ?? "chromium,webkit")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const viewports = [
  { width: 1280, height: 720 },
  { width: 844, height: 390 },
  { width: 844, height: 340 },
];
const timeout = Math.max(15_000, Number(process.env.V095_EMPLOYMENT_QA_TIMEOUT_MS) || 45_000);
const evidenceDir = path.resolve(
  process.env.V095_EMPLOYMENT_QA_EVIDENCE_DIR ?? "outputs/v095-employment-unlock",
);
const saveKey = "nishijin-campaign-v1";
const mayoUnitId = CAMPAIGN_UNIT_IDS.MAYO_CHAN;
const mayoNoticeId = `employment-available:${mayoUnitId}`;
const initialCaps = 900;

const currentDefault = createDefaultCampaignSave();
const publishedV090Fixture = {
  ...currentDefault,
  schemaVersion: 13,
  revision: 42,
  updatedAt: "2026-07-29T00:00:00.000Z",
  campaignStarted: true,
  caps: initialCaps,
  supplies: initialCaps,
  survival: {
    ...currentDefault.survival,
    highestWave: 20,
  },
};
delete publishedV090Fixture.employmentNoticeReceipts;
delete publishedV090Fixture.seenEmploymentNoticeIds;
delete publishedV090Fixture.survival.highestReachedWave;
publishedV090Fixture.integrity = computeCampaignSaveIntegrity(publishedV090Fixture);
const serializedFixture = JSON.stringify(publishedV090Fixture);
const waveEntryFixture = {
  ...currentDefault,
  revision: 43,
  updatedAt: "2026-07-29T00:01:00.000Z",
  campaignStarted: true,
  survival: {
    ...currentDefault.survival,
    highestWave: 19,
    highestReachedWave: 19,
    unlockedStartWaves: [1, 11],
  },
};
waveEntryFixture.integrity = computeCampaignSaveIntegrity(waveEntryFixture);
const serializedWaveEntryFixture = JSON.stringify(waveEntryFixture);

const results = [];
const waveEntryResults = [];
await mkdir(evidenceDir, { recursive: true });

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
    diagnostics.requestFailures.push(`${request.url()} :: ${request.failure()?.errorText ?? "unknown"}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) diagnostics.httpErrors.push(`${response.status()} ${response.url()}`);
  });
  return diagnostics;
}

async function popupEvidence(page) {
  return page.evaluate(async () => {
    const popup = document.querySelector(".employment-available-popup");
    const panel = popup?.querySelector(":scope > section");
    const art = popup?.querySelector(".employment-dossier-art");
    const buttons = [...(popup?.querySelectorAll("button") ?? [])];
    const popupRect = popup?.getBoundingClientRect();
    const panelRect = panel?.getBoundingClientRect();
    const background = art ? getComputedStyle(art).backgroundImage : "";
    const match = background.match(/^url\(["']?(.*?)["']?\)$/);
    let image = { src: match?.[1] ?? "", decoded: false, width: 0, height: 0 };
    if (image.src) {
      const probe = new Image();
      probe.src = image.src;
      try {
        await probe.decode();
        image = {
          src: image.src,
          decoded: true,
          width: probe.naturalWidth,
          height: probe.naturalHeight,
        };
      } catch {
        image.decoded = false;
      }
    }
    return {
      text: popup?.textContent ?? "",
      document: {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      },
      viewport: { width: innerWidth, height: innerHeight },
      popupRect: popupRect && {
        left: popupRect.left,
        top: popupRect.top,
        right: popupRect.right,
        bottom: popupRect.bottom,
      },
      panelRect: panelRect && {
        left: panelRect.left,
        top: panelRect.top,
        right: panelRect.right,
        bottom: panelRect.bottom,
      },
      buttons: buttons.map((button) => ({
        text: button.textContent?.trim() ?? "",
        width: button.getBoundingClientRect().width,
        height: button.getBoundingClientRect().height,
      })),
      image,
    };
  });
}

async function persistedSave(page) {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, saveKey);
}

async function blockCampaignPersistence(page) {
  await page.evaluate(() => {
    const storagePrototype = Storage.prototype;
    window.__V095_EMPLOYMENT_PERSISTENCE_RESTORE__ = {
      setItem: storagePrototype.setItem,
      indexedDbDescriptor: Object.getOwnPropertyDescriptor(window, "indexedDB"),
    };
    storagePrototype.setItem = () => {
      throw new DOMException("Version 0.9.5 QA blocked localStorage", "QuotaExceededError");
    };
    Object.defineProperty(window, "indexedDB", {
      configurable: true,
      get: () => null,
    });
  });
}

async function restoreCampaignPersistence(page) {
  await page.evaluate(() => {
    const restore = window.__V095_EMPLOYMENT_PERSISTENCE_RESTORE__;
    if (!restore) return;
    Storage.prototype.setItem = restore.setItem;
    if (restore.indexedDbDescriptor) {
      Object.defineProperty(window, "indexedDB", restore.indexedDbDescriptor);
    } else {
      delete window.indexedDB;
    }
    delete window.__V095_EMPLOYMENT_PERSISTENCE_RESTORE__;
  });
}

for (const engine of engines) {
  const browserType = browserTypes[engine];
  invariant(browserType, `Unsupported browser engine: ${engine}`);
  const browser = await browserType.launch({ headless: true });
  try {
    for (const viewport of viewports) {
      const name = `${engine}-${viewport.width}x${viewport.height}`;
      const reducedMotion = engine === "webkit" && viewport.width === 844 && viewport.height === 340
        ? "reduce"
        : "no-preference";
      const context = await browser.newContext({ viewport, hasTouch: true, reducedMotion });
      const page = await context.newPage();
      const diagnostics = diagnosticsFor(page);
      let evidence = null;
      let step = "open";
      try {
        await page.addInitScript(({ key, value }) => {
          if (!localStorage.getItem(key)) localStorage.setItem(key, value);
        }, {
          key: saveKey,
          value: serializedFixture,
        });
        await page.goto(legacyQaUrl(baseUrl), { waitUntil: "domcontentloaded", timeout });
        await dismissInstallOffer(page, { timeout });
        await page.locator("button.title-start").waitFor({ state: "visible", timeout });
        await page.locator("button.title-start").tap();
        await page.locator(".map-screen").waitFor({ state: "visible", timeout });
        const popup = page.locator(".employment-available-popup");
        await popup.waitFor({ state: "visible", timeout });
        const reveal = await popup.evaluate(async (element, motionPreference) => {
          const animations = element.getAnimations({ subtree: true })
            .filter((animation) => String(animation.animationName ?? "").startsWith("employment-dossier-"));
          const initial = animations.map((animation) => ({
            name: animation.animationName,
            playState: animation.playState,
            currentTime: Number(animation.currentTime ?? 0),
          }));
          await Promise.all(animations.map((animation) => animation.finished.catch(() => null)));
          return {
            motionPreference,
            initial,
            completed: animations.map((animation) => ({
              name: animation.animationName,
              playState: animation.playState,
              currentTime: Number(animation.currentTime ?? 0),
            })),
          };
        }, reducedMotion);
        evidence = {
          ...await popupEvidence(page),
          reveal,
        };
        if (reducedMotion === "reduce") {
          invariant(reveal.initial.length === 0, `${name}: reduced-motion reveal animation remained active`);
        } else {
          invariant(
            new Set(reveal.initial.map(({ name: animationName }) => animationName)).size === 3,
            `${name}: dossier reveal animation set incomplete`,
          );
          invariant(
            reveal.completed.every(({ playState }) => playState === "finished"),
            `${name}: dossier reveal did not finish`,
          );
        }
        invariant(evidence.text.includes("マヨちゃん"), `${name}: Mayo name missing`);
        invariant(evidence.text.includes("高速遊撃犬"), `${name}: Mayo role missing`);
        invariant(evidence.text.includes("噛みつき・タクティカル医療ハーネス"), `${name}: weapon missing`);
        invariant(evidence.text.includes("Survival Wave 20到達"), `${name}: unlock reason missing`);
        invariant(evidence.text.includes("260 キャップ"), `${name}: employment cost missing`);
        invariant(evidence.text.includes("雇用画面へ") && evidence.text.includes("あとで"), `${name}: popup actions missing`);
        invariant(!evidence.text.includes("調達"), `${name}: retired copy remained in popup`);
        invariant(evidence.image.decoded && evidence.image.width > 0 && evidence.image.height > 0, `${name}: formal card failed to decode`);
        invariant(evidence.document.width <= viewport.width && evidence.document.height <= viewport.height, `${name}: document overflow`);
        invariant(evidence.popupRect?.left === 0 && evidence.popupRect?.right === viewport.width, `${name}: popup missed viewport width`);
        invariant(evidence.buttons.length === 2 && evidence.buttons.every(({ height }) => height >= 44), `${name}: popup tap target below 44px`);

        step = "cue-request";
        await page.waitForFunction(
          (noticeId) => window.__ASHFALL_AUDIO_QA__?.getCueRequests?.()
            .filter((entry) => entry.cueId === "employment-dossier-reveal" && entry.dedupeKey === noticeId).length === 1,
          mayoNoticeId,
          { timeout },
        );
        const cueRequests = await page.evaluate(
          (noticeId) => window.__ASHFALL_AUDIO_QA__.getCueRequests()
            .filter((entry) => entry.cueId === "employment-dossier-reveal" && entry.dedupeKey === noticeId),
          mayoNoticeId,
        );
        step = "audio-running";
        await page.waitForTimeout(300);
        const popupAudioDiagnostics = await page.evaluate(
          () => window.__ASHFALL_AUDIO_QA__.getDiagnostics(),
        );
        const popupAudioRunning = popupAudioDiagnostics.unlocked === true
          && popupAudioDiagnostics.contextState === "running"
          && popupAudioDiagnostics.warningTotal === 0;
        const knownHeadlessWebkitAudioBlock = engine === "webkit"
          && popupAudioDiagnostics.unlocked === false
          && popupAudioDiagnostics.contextState === null
          && popupAudioDiagnostics.contextCreateCount === 0
          && popupAudioDiagnostics.audioState === "failed"
          && popupAudioDiagnostics.needsGesture === true
          && popupAudioDiagnostics.warningTotal === 1;
        invariant(
          popupAudioRunning || knownHeadlessWebkitAudioBlock,
          `${name}: unexpected popup audio state ${JSON.stringify(popupAudioDiagnostics)}`,
        );
        const popupAudioEvidence = popupAudioRunning
          ? "running"
          : "known-headless-webkit-blocked";

        step = "employment-screen";
        const popupPath = path.join(evidenceDir, `${name}-mayo-employment-popup.png`);
        await page.screenshot({ path: popupPath, fullPage: false });
        const popupPng = await page.screenshot({ fullPage: false });
        const popupSha256 = createHash("sha256").update(popupPng).digest("hex");

        step = "persistence-failure";
        await blockCampaignPersistence(page);
        await page.getByRole("button", { name: "雇用画面へ" }).tap();
        const saveError = popup.locator(".employment-save-error");
        await saveError.waitFor({ state: "visible", timeout });
        invariant(
          (await saveError.textContent())?.includes("通知確認を端末へ保存できませんでした"),
          `${name}: inline persistence error missing`,
        );
        invariant(await popup.isVisible(), `${name}: popup closed after persistence failure`);
        await page.getByRole("button", { name: "雇用画面へ" }).waitFor({ state: "visible", timeout });
        await page.waitForFunction(
          () => !document.querySelector(".employment-available-popup button.campaign-primary")?.disabled,
          undefined,
          { timeout },
        );
        await restoreCampaignPersistence(page);

        step = "persistence-retry";
        await page.getByRole("button", { name: "雇用画面へ" }).tap();
        const personnel = page.locator(".personnel-screen");
        await personnel.waitFor({ state: "visible", timeout });
        const employmentTab = personnel.getByRole("button", { name: "雇用", exact: true });
        await employmentTab.waitFor({ state: "visible", timeout });
        invariant(await employmentTab.getAttribute("data-active") === "true", `${name}: employment tab was not selected`);
        const mayoCard = personnel.locator(`[data-unit-id="${mayoUnitId}"]`);
        await mayoCard.waitFor({ state: "visible", timeout });
        const hireButton = personnel.getByRole("button", { name: /260キャップで雇用/ });
        await hireButton.waitFor({ state: "visible", timeout });
        invariant(!(await personnel.textContent()).includes("調達"), `${name}: retired copy remained on employment screen`);
        const hireRect = await hireButton.evaluate((button) => {
          const rect = button.getBoundingClientRect();
          return { width: rect.width, height: rect.height };
        });
        invariant(hireRect.height >= 44, `${name}: employment action below 44px`);

        if (viewport.height === 390) {
          await mayoCard.scrollIntoViewIfNeeded();
          await page.screenshot({
            path: path.join(evidenceDir, `${name}-employment-screen.png`),
            fullPage: false,
          });
        }
        await hireButton.tap();
        step = "employment-persist";
        await page.waitForFunction(
          ({ key, unitId, caps }) => {
            const raw = localStorage.getItem(key);
            if (!raw) return false;
            const save = JSON.parse(raw);
            return save.ownership?.includes(unitId)
              && save.caps === caps
              && save.processedAcquisitionIds?.filter((id) => id === `recruit:${unitId}`).length === 1;
          },
          { key: saveKey, unitId: mayoUnitId, caps: initialCaps - 260 },
          { timeout },
        );
        const hired = await persistedSave(page);
        invariant(hired.schemaVersion === 14, `${name}: save schema ${hired.schemaVersion}`);
        invariant(hired.recruitable.includes(mayoUnitId) === false, `${name}: hired Mayo remained recruitable`);
        invariant(hired.employmentNoticeReceipts.includes(mayoNoticeId), `${name}: notice receipt missing`);
        invariant(hired.seenEmploymentNoticeIds.includes(mayoNoticeId), `${name}: notice seen state missing`);

        step = "reload";
        await page.reload({ waitUntil: "domcontentloaded", timeout });
        await dismissInstallOffer(page, { timeout });
        await page.locator("button.title-start").waitFor({ state: "visible", timeout });
        await page.locator("button.title-start").tap();
        await page.locator(".map-screen").waitFor({ state: "visible", timeout });
        await page.waitForTimeout(350);
        invariant(await page.locator(".employment-available-popup").count() === 0, `${name}: acknowledged popup replayed`);
        const reloaded = await persistedSave(page);
        invariant(reloaded.caps === initialCaps - 260, `${name}: reload changed caps`);
        invariant(reloaded.ownership.filter((id) => id === mayoUnitId).length === 1, `${name}: reload duplicated ownership`);
        invariant(reloaded.processedAcquisitionIds.filter((id) => id === `recruit:${mayoUnitId}`).length === 1, `${name}: reload duplicated receipt`);

        const audioDiagnostics = await page.evaluate(() => window.__ASHFALL_AUDIO_QA__?.getDiagnostics?.() ?? null);
        invariant(diagnostics.consoleErrors.length === 0, `${name}: console errors ${diagnostics.consoleErrors}`);
        invariant(diagnostics.pageErrors.length === 0, `${name}: page errors ${diagnostics.pageErrors}`);
        invariant(diagnostics.requestFailures.length === 0, `${name}: request failures ${diagnostics.requestFailures}`);
        invariant(diagnostics.httpErrors.length === 0, `${name}: HTTP errors ${diagnostics.httpErrors}`);
        invariant((audioDiagnostics?.duplicateLoopInstanceKeys?.length ?? 0) === 0, `${name}: duplicate audio loops`);
        results.push({
          name,
          status: "passed",
          evidence,
          cueRequestCount: cueRequests.length,
          popupAudioDiagnostics,
          popupAudioEvidence,
          popupSha256,
          popupPath,
          employmentScreenPath: viewport.height === 390
            ? path.join(evidenceDir, `${name}-employment-screen.png`)
            : null,
          persistenceFailure: {
            inlineError: true,
            popupRetained: true,
            retrySucceeded: true,
          },
          persisted: {
            schemaVersion: reloaded.schemaVersion,
            caps: reloaded.caps,
            owned: reloaded.ownership.includes(mayoUnitId),
            recruitable: reloaded.recruitable.includes(mayoUnitId),
            receiptCount: reloaded.processedAcquisitionIds.filter((id) => id === `recruit:${mayoUnitId}`).length,
            noticeReceipt: reloaded.employmentNoticeReceipts.includes(mayoNoticeId),
            noticeSeen: reloaded.seenEmploymentNoticeIds.includes(mayoNoticeId),
          },
          diagnostics,
          audioDiagnostics,
        });
      } catch (error) {
        results.push({ name, status: "failed", step, error: String(error), evidence, diagnostics });
      } finally {
        await context.close();
      }
    }

    const entryContext = await browser.newContext({
      viewport: { width: 844, height: 390 },
      hasTouch: true,
    });
    const entryPage = await entryContext.newPage();
    const entryDiagnostics = diagnosticsFor(entryPage);
    let entryStep = "open";
    try {
      await entryPage.addInitScript(({ key, value }) => {
        if (!localStorage.getItem(key)) localStorage.setItem(key, value);
      }, {
        key: saveKey,
        value: serializedWaveEntryFixture,
      });
      await entryPage.goto(legacyQaUrl(baseUrl), { waitUntil: "domcontentloaded", timeout });
      await dismissInstallOffer(entryPage, { timeout });
      await entryPage.locator("button.title-start").waitFor({ state: "visible", timeout });
      await entryPage.locator("button.title-start").tap();
      await entryPage.locator(".map-screen").waitFor({ state: "visible", timeout });
      await entryPage.waitForTimeout(350);

      entryStep = "block-wave-entry-persistence";
      await blockCampaignPersistence(entryPage);
      const proof = await entryPage.evaluate(
        () => window.__ASHFALL_BATTLE_QA__.prepareSurvivalWaveEntitlementProof(),
      );
      invariant(
        proof.targetWave === 20
          && proof.reachedWaveBeforeQueue === 19
          && proof.lastCompletedWave === 19
          && proof.entryMode === "production-runtime-queue-wave",
        `${engine}: invalid Wave 20 runtime setup`,
      );
      const blocker = entryPage.locator(".survival-wave-entitlement-blocker");
      await blocker.waitFor({ state: "visible", timeout });
      await blocker.getByText("Wave 20到達を保存できません").waitFor({ state: "visible", timeout });
      const runtimeEntry = await entryPage.evaluate(
        () => window.__ASHFALL_BATTLE_QA__.getSurvivalWaveEntitlementProof(),
      );
      invariant(
        runtimeEntry.phase === "in-wave"
          && runtimeEntry.currentWave === 20
          && runtimeEntry.reachedWave === 20
          && runtimeEntry.lastCompletedWave === 19
          && runtimeEntry.runtimeWaveQueued === true
          && runtimeEntry.receiptId === mayoNoticeId
          && runtimeEntry.paused === true,
        `${engine}: production queue-wave did not enter the durable entitlement blocker`,
      );
      invariant(await entryPage.locator(".pause-screen").count() === 0, `${engine}: ordinary pause menu bypassed entitlement blocker`);
      const failedSave = await persistedSave(entryPage);
      invariant(failedSave.survival.highestReachedWave === 19, `${engine}: failed write changed durable reached wave`);
      invariant(!failedSave.employmentNoticeReceipts.includes(mayoNoticeId), `${engine}: failed write leaked Mayo receipt`);

      entryStep = "retry-wave-entry-persistence";
      await restoreCampaignPersistence(entryPage);
      await blocker.getByRole("button", { name: "保存を再試行" }).tap();
      await blocker.waitFor({ state: "detached", timeout });
      const durableSave = await persistedSave(entryPage);
      invariant(durableSave.survival.highestWave === 19, `${engine}: Wave 20 entry changed completed-wave progress`);
      invariant(durableSave.survival.highestReachedWave === 20, `${engine}: reached-wave entitlement was not durable`);
      invariant(!durableSave.survival.unlockedStartWaves.includes(21), `${engine}: Wave 21 start unlocked before Wave 20 clear`);
      invariant(durableSave.survival.processedRunIds.length === 0, `${engine}: entry settled the run`);
      invariant(durableSave.survival.claimedRewardIds.length === 0, `${engine}: entry granted an unfinished reward`);
      invariant(durableSave.employmentNoticeReceipts.includes(mayoNoticeId), `${engine}: durable Mayo receipt missing`);
      invariant(entryDiagnostics.consoleErrors.length === 0, `${engine}: entry console errors ${entryDiagnostics.consoleErrors}`);
      invariant(entryDiagnostics.pageErrors.length === 0, `${engine}: entry page errors ${entryDiagnostics.pageErrors}`);
      invariant(entryDiagnostics.requestFailures.length === 0, `${engine}: entry request failures ${entryDiagnostics.requestFailures}`);
      invariant(entryDiagnostics.httpErrors.length === 0, `${engine}: entry HTTP errors ${entryDiagnostics.httpErrors}`);
      waveEntryResults.push({
        name: `${engine}-844x390-wave20-entry`,
        status: "passed",
        proof,
        runtimeEntry,
        persistenceFailure: {
          blockerVisible: true,
          ordinaryPauseBypass: false,
          retrySucceeded: true,
        },
        persisted: {
          highestCompletedWave: durableSave.survival.highestWave,
          highestReachedWave: durableSave.survival.highestReachedWave,
          wave21StartUnlocked: durableSave.survival.unlockedStartWaves.includes(21),
          processedRunCount: durableSave.survival.processedRunIds.length,
          claimedRewardCount: durableSave.survival.claimedRewardIds.length,
          noticeReceipt: durableSave.employmentNoticeReceipts.includes(mayoNoticeId),
        },
        diagnostics: entryDiagnostics,
      });
    } catch (error) {
      waveEntryResults.push({
        name: `${engine}-844x390-wave20-entry`,
        status: "failed",
        step: entryStep,
        error: String(error),
        diagnostics: entryDiagnostics,
      });
    } finally {
      await entryContext.close();
    }
  } finally {
    await browser.close();
  }
}

const reportPath = path.join(evidenceDir, "summary.json");
await writeFile(reportPath, `${JSON.stringify({
  baseUrl: String(baseUrl),
  fixture: {
    sourceSchemaVersion: 13,
    highestSurvivalWave: 20,
    initialCaps,
    unitId: mayoUnitId,
    noticeId: mayoNoticeId,
  },
  results,
  waveEntryResults,
}, null, 2)}\n`, "utf8");
const allResults = [...results, ...waveEntryResults];
const failures = allResults.filter(({ status }) => status !== "passed");
if (failures.length > 0) {
  throw new Error(`Version 0.9.5 employment browser smoke failed (${failures.length}/${allResults.length}): ${reportPath}`);
}
console.log(`Version 0.9.5 employment browser smoke passed (${allResults.length}/${allResults.length}): ${reportPath}`);
