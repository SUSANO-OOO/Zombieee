import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  CAMPAIGN_RECRUITMENT_COSTS,
  CAMPAIGN_STAGES,
  CAMPAIGN_UNIT_IDS,
  computeCampaignSaveIntegrity,
  createDefaultCampaignSave,
  employmentNoticeIdForUnit,
  campaignUnitUpgradeQuote,
} from "../app/campaign.js";
import { dismissInstallOffer } from "./pwa-gate-qa.mjs";

const baseUrl = new URL(
  process.env.PR1_TRANSACTIONS_QA_BASE_URL ?? process.env.PROGRESSION_QA_BASE_URL ?? "",
);
if (!baseUrl.hostname || !["localhost", "127.0.0.1"].includes(baseUrl.hostname)) {
  throw new Error("PR1 transaction QA is local-only; use the isolated QA runner");
}
const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href)
  : await import("playwright");
const browserTypes = { chromium: playwright.chromium, webkit: playwright.webkit };
const engines = (process.env.PR1_TRANSACTIONS_QA_ENGINES ?? "chromium,webkit")
  .split(",")
  .map((engine) => engine.trim())
  .filter(Boolean);
const viewports = (process.env.PR1_TRANSACTIONS_QA_VIEWPORTS ?? "1280x720,844x390")
  .split(",")
  .map((entry) => {
    const [width, height] = entry.trim().split("x").map(Number);
    if (!Number.isFinite(width) || !Number.isFinite(height)) throw new Error(`Invalid viewport: ${entry}`);
    return { width, height, safeArea: width === 844 && height === 390 };
  });
const timeout = Math.max(15_000, Number(process.env.PR1_TRANSACTIONS_QA_TIMEOUT_MS) || 45_000);
const evidenceDir = path.resolve(
  process.env.PR1_TRANSACTIONS_QA_EVIDENCE_DIR ?? "outputs/pr1-transaction-browser-smoke",
);
const saveKey = "nishijin-campaign-v1";
const recruitIds = [CAMPAIGN_UNIT_IDS.TATARA, CAMPAIGN_UNIT_IDS.RAIDER];
const recruitCosts = recruitIds.map((unitId) => CAMPAIGN_RECRUITMENT_COSTS[unitId]);
const fixtureBase = createDefaultCampaignSave();
const completedStageIds = CAMPAIGN_STAGES.slice(0, 3).map((stage) => stage.id);
const fixture = {
  ...fixtureBase,
  revision: 120,
  updatedAt: "2026-08-02T00:00:00.000Z",
  campaignStarted: true,
  completedStageIds,
  caps: 2400,
  supplies: 2400,
  discovery: [...new Set([...fixtureBase.discovery, ...recruitIds])],
  recruitable: [...recruitIds],
  employmentNoticeReceipts: recruitIds.map(employmentNoticeIdForUnit),
  seenEmploymentNoticeIds: recruitIds.map(employmentNoticeIdForUnit),
  unlockedStageIds: [...new Set([...fixtureBase.unlockedStageIds, ...completedStageIds])],
};
fixture.integrity = computeCampaignSaveIntegrity(fixture);
const serializedFixture = JSON.stringify(fixture);

const results = [];
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
    const failure = request.failure()?.errorText ?? "unknown";
    if (failure !== "net::ERR_ABORTED") diagnostics.requestFailures.push(`${request.url()} :: ${failure}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) diagnostics.httpErrors.push(`${response.status()} ${response.url()}`);
  });
  return diagnostics;
}

async function readSave(page) {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? { raw, save: JSON.parse(raw) } : null;
  }, saveKey);
}

async function openEmployment(page) {
  const fixtureUrl = new URL(baseUrl);
  fixtureUrl.searchParams.set("pr1_fixture", "1");
  await page.goto(String(fixtureUrl), { waitUntil: "domcontentloaded", timeout });
  await page.evaluate(() => history.replaceState(null, "", `${location.pathname}${location.hash}`));
  await dismissInstallOffer(page, { timeout: Math.min(timeout, 5_000) });
  await page.locator("button.title-start").waitFor({ state: "visible", timeout });
  await page.locator("button.title-start").click();
  await page.locator('.game-shell[data-screen="map"]').waitFor({ state: "visible", timeout });
  invariant(await page.locator(".employment-available-popup").count() === 0, "employment notice unexpectedly blocked QA flow");
  await page.getByRole("button", { name: "部隊", exact: true }).click();
  await page.locator('.game-shell[data-screen="personnel"]').waitFor({ state: "visible", timeout });
  await page.getByRole("button", { name: "雇用", exact: true }).click();
  await page.locator('.personnel-units[data-mode="acquisition"]').waitFor({ state: "visible", timeout });
  await page.locator(".formation-unit-recruit").first().waitFor({ state: "visible", timeout });
}

async function installFixture(page) {
  await page.addInitScript(async ({ key, value }) => {
    if (!new URL(location.href).searchParams.has("pr1_fixture")) return;
    localStorage.clear();
    await new Promise((resolve) => {
      try {
        const request = indexedDB.deleteDatabase("nishijin-campaign-backup");
        request.addEventListener("success", resolve, { once: true });
        request.addEventListener("error", resolve, { once: true });
        request.addEventListener("blocked", resolve, { once: true });
      } catch {
        resolve();
      }
    });
    localStorage.setItem(key, value);
  }, { key: saveKey, value: serializedFixture });
}

async function installFeedbackAudit(page) {
  await page.evaluate(() => {
    const events = [];
    let last = "";
    const observer = new MutationObserver(() => {
      const feedback = document.querySelector(".operation-feedback");
      if (!feedback) return;
      const signature = `${feedback.getAttribute("data-kind")}:${feedback.textContent?.trim() ?? ""}`;
      if (signature === last) return;
      last = signature;
      events.push({ kind: feedback.getAttribute("data-kind"), text: feedback.textContent?.trim() ?? "" });
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    window.__PR1_FEEDBACK_AUDIT__ = { events, observer };
  });
}

async function readCues(page) {
  return page.evaluate(() => window.__ASHFALL_AUDIO_QA__?.getCueRequests?.() ?? []);
}

async function assertDiagnostics(diagnostics, label) {
  invariant(Object.values(diagnostics).every((entries) => entries.length === 0),
    `${label}: browser diagnostics ${JSON.stringify(diagnostics)}`);
}

async function feedbackEvents(page) {
  return page.evaluate(() => [...(window.__PR1_FEEDBACK_AUDIT__?.events ?? [])]);
}

async function blockPersistence(page) {
  await page.evaluate(() => {
    window.__PR1_PERSISTENCE_RESTORE__ = {
      setItem: Storage.prototype.setItem,
      indexedDb: Object.getOwnPropertyDescriptor(window, "indexedDB"),
    };
    Storage.prototype.setItem = () => {
      throw new DOMException("PR1 QA persistence blocked", "QuotaExceededError");
    };
    Object.defineProperty(window, "indexedDB", { configurable: true, get: () => null });
  });
}

async function restorePersistence(page) {
  await page.evaluate(() => {
    const restore = window.__PR1_PERSISTENCE_RESTORE__;
    if (!restore) return;
    Storage.prototype.setItem = restore.setItem;
    if (restore.indexedDb) Object.defineProperty(window, "indexedDB", restore.indexedDb);
    else delete window.indexedDB;
    delete window.__PR1_PERSISTENCE_RESTORE__;
  });
}

async function waitForFeedback(page, kind, count = 1) {
  await page.waitForFunction(
    ({ expectedKind, expectedCount }) => (window.__PR1_FEEDBACK_AUDIT__?.events ?? [])
      .filter(({ kind }) => kind === expectedKind).length >= expectedCount,
    { expectedKind: kind, expectedCount: count },
    { timeout },
  );
}

async function runIsolatedCase(browser, viewport, name, action) {
  const context = await browser.newContext({
    viewport,
    hasTouch: viewport.safeArea,
    isMobile: viewport.safeArea,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(timeout);
  const diagnostics = diagnosticsFor(page);
  try {
    await installFixture(page);
    await openEmployment(page);
    await installFeedbackAudit(page);
    const evidence = await action(page);
    await assertDiagnostics(diagnostics, name);
    return { name, status: "passed", evidence, diagnostics };
  } catch (error) {
    return { name, status: "failed", error: String(error), diagnostics };
  } finally {
    await context.close();
  }
}

for (const engine of engines) {
  invariant(browserTypes[engine], `Unsupported engine: ${engine}`);
  const browser = await browserTypes[engine].launch({ headless: true });
  try {
    for (const viewport of viewports) {
      const name = `${engine}-${viewport.width}x${viewport.height}`;
      const context = await browser.newContext({
        viewport,
        hasTouch: viewport.safeArea,
        isMobile: viewport.safeArea,
      });
      const page = await context.newPage();
      page.setDefaultTimeout(timeout);
      const diagnostics = diagnosticsFor(page);
      const result = { name, engine, viewport, status: "failed" };
      try {
        await installFixture(page);
        await openEmployment(page);
        await installFeedbackAudit(page);

        const hireButtons = page.locator(".formation-unit-recruit");
        const hireIds = await hireButtons.evaluateAll((buttons) => buttons.slice(0, 2).map((button) => button
          .closest(".formation-unit-card")?.querySelector("[data-unit-id]")?.getAttribute("data-unit-id")));
        invariant(JSON.stringify(hireIds) === JSON.stringify(recruitIds), `recruit targets changed: ${JSON.stringify(hireIds)}`);
        const before = await readSave(page);
        const cueStart = (await readCues(page)).length;
        await page.evaluate(() => {
          const clicks = [];
          document.addEventListener("click", (event) => {
            const button = event.target instanceof Element ? event.target.closest("button.formation-unit-recruit") : null;
            if (button) {
              clicks.push({
                unitId: button.closest(".formation-unit-card")?.querySelector("[data-unit-id]")?.getAttribute("data-unit-id") ?? null,
                disabled: Boolean(button.disabled),
                ariaDisabled: button.getAttribute("aria-disabled"),
              });
            }
          }, true);
          window.__PR1_CLICK_AUDIT__ = clicks;
        });
        await page.evaluate(() => {
          const buttons = [...document.querySelectorAll(".formation-unit-recruit")].slice(0, 2);
          buttons[0]?.click();
          buttons[0]?.click();
          buttons[1]?.click();
        });
        try {
          await page.waitForFunction(({ key, ids, caps }) => {
            const raw = localStorage.getItem(key);
            if (!raw) return false;
            const save = JSON.parse(raw);
            return save.caps === caps
              && ids.every((unitId) => save.ownership.filter((id) => id === unitId).length === 1)
              && ids.every((unitId) => save.processedAcquisitionIds.filter((id) => id === `recruit:${unitId}`).length === 1);
          }, { key: saveKey, ids: recruitIds, caps: fixture.caps - recruitCosts.reduce((sum, cost) => sum + cost, 0) }, { timeout });
        } catch (error) {
          const debug = await page.evaluate((key) => ({
            save: localStorage.getItem(key),
            clicks: window.__PR1_CLICK_AUDIT__ ?? [],
            feedback: window.__PR1_FEEDBACK_AUDIT__?.events ?? [],
            cues: window.__ASHFALL_AUDIO_QA__?.getCueRequests?.() ?? [],
          }), saveKey);
          throw new Error(`${String(error)} :: recruitment debug ${JSON.stringify(debug)}`);
        }
        await page.waitForFunction(
          () => (window.__PR1_FEEDBACK_AUDIT__?.events ?? []).filter(({ kind }) => kind === "success").length >= 2,
          undefined,
          { timeout },
        );
        const after = await readSave(page);
        invariant(after?.save.schemaVersion === fixture.schemaVersion, "recruitment changed save schema");
        invariant(after?.save.caps === fixture.caps - recruitCosts.reduce((sum, cost) => sum + cost, 0),
          `concurrent recruitment caps mismatch: ${JSON.stringify({ before, after, clicks: await page.evaluate(() => window.__PR1_CLICK_AUDIT__ ?? []), feedback: await feedbackEvents(page), cues: await readCues(page) })}`);
        invariant(recruitIds.every((unitId) => after.save.processedAcquisitionIds.filter((id) => id === `recruit:${unitId}`).length === 1),
          `concurrent recruitment receipt duplicated: ${JSON.stringify(after.save.processedAcquisitionIds)}`);
        const hireCues = (await readCues(page)).slice(cueStart);
        invariant(hireCues.filter((entry) => entry.cueId === "sfx-v070-terminal-confirm").length === 2,
          `hire success cue count mismatch: ${JSON.stringify(hireCues)}`);
        invariant(hireCues.filter((entry) => entry.cueId === "ui-select").length === 0,
          `generic hire selection cue leaked: ${JSON.stringify(hireCues)}`);
        const successFeedback = (await feedbackEvents(page)).filter(({ kind }) => kind === "success");
        invariant(successFeedback.length === 2, `hire success feedback count mismatch: ${JSON.stringify(successFeedback)}`);

        await page.reload({ waitUntil: "domcontentloaded", timeout });
        await dismissInstallOffer(page, { timeout: Math.min(timeout, 5_000) });
        await page.locator("button.title-start").click();
        await page.locator('.game-shell[data-screen="map"]').waitFor({ state: "visible", timeout });
        const reloaded = await readSave(page);
        invariant(reloaded?.save.caps === after.save.caps,
          `reload changed caps after concurrent hire: ${JSON.stringify({ after, reloaded })}`);
        invariant(recruitIds.every((unitId) => reloaded.save.ownership.filter((id) => id === unitId).length === 1),
          `reload changed ownership after concurrent hire: ${JSON.stringify({ after, reloaded })}`);

        const isolatedCases = [];
        isolatedCases.push(await runIsolatedCase(browser, viewport, `${name}-failure-then-success`, async (casePage) => {
          const firstHire = casePage.locator(".formation-unit-recruit").first();
          const secondHire = casePage.locator(".formation-unit-recruit").nth(1);
          const initial = await readSave(casePage);
          const cueStartForCase = (await readCues(casePage)).length;
          await blockPersistence(casePage);
          await firstHire.evaluate((button) => button.click());
          await waitForFeedback(casePage, "reject");
          await casePage.waitForTimeout(100);
          const failedSave = await readSave(casePage);
          invariant(failedSave.raw === initial.raw, "failed first hire changed durable save");
          const failedCues = (await readCues(casePage)).slice(cueStartForCase);
          invariant(failedCues.filter((entry) => entry.cueId === "ui-error").length === 1
            && failedCues.filter((entry) => entry.cueId === "sfx-v070-terminal-confirm").length === 0,
          `failed first hire cue contract mismatch: ${JSON.stringify(failedCues)}`);
          await restorePersistence(casePage);
          await secondHire.evaluate((button) => button.click());
          await casePage.waitForFunction(({ key, unitId, caps }) => {
            const raw = localStorage.getItem(key);
            if (!raw) return false;
            const save = JSON.parse(raw);
            return save.caps === caps
              && save.ownership.includes(unitId)
              && save.processedAcquisitionIds.filter((id) => id === `recruit:${unitId}`).length === 1;
          }, { key: saveKey, unitId: recruitIds[1], caps: fixture.caps - recruitCosts[1] }, { timeout });
          await waitForFeedback(casePage, "success");
          const secondSuccessSave = await readSave(casePage);
          invariant(!secondSuccessSave.save.ownership.includes(recruitIds[0])
            && secondSuccessSave.save.ownership.includes(recruitIds[1]),
          "first failed hire leaked into second success");
          await firstHire.evaluate((button) => button.click());
          await casePage.waitForFunction(({ key, ids, caps }) => {
            const raw = localStorage.getItem(key);
            if (!raw) return false;
            const save = JSON.parse(raw);
            return save.caps === caps
              && ids.every((unitId) => save.ownership.includes(unitId))
              && ids.every((unitId) => save.processedAcquisitionIds.filter((id) => id === `recruit:${unitId}`).length === 1);
          }, { key: saveKey, ids: recruitIds, caps: fixture.caps - recruitCosts.reduce((sum, cost) => sum + cost, 0) }, { timeout });
          await waitForFeedback(casePage, "success", 2);
          const finalSave = await readSave(casePage);
          const cues = (await readCues(casePage)).slice(cueStartForCase);
          invariant(cues.filter((entry) => entry.cueId === "sfx-v070-terminal-confirm").length === 2,
            `failure/retry purchase cue contract mismatch: ${JSON.stringify(cues)}`);
          return {
            durableSaveBytes: Buffer.byteLength(finalSave.raw, "utf8"),
            failedFirst: true,
            secondSuccess: true,
            retrySuccess: true,
            cueIds: cues.map((entry) => entry.cueId),
            feedbackEvents: await feedbackEvents(casePage),
            receiptCounts: Object.fromEntries(recruitIds.map((unitId) => [unitId,
              finalSave.save.processedAcquisitionIds.filter((id) => id === `recruit:${unitId}`).length])),
            rejectCueCount: cues.filter((entry) => entry.cueId === "ui-error").length,
            purchaseCueCount: cues.filter((entry) => entry.cueId === "sfx-v070-terminal-confirm").length,
          };
        }));
        isolatedCases.push(await runIsolatedCase(browser, viewport, `${name}-success-then-failure`, async (casePage) => {
          const firstHire = casePage.locator(".formation-unit-recruit").first();
          const secondHire = casePage.locator(`.formation-unit-card:has([data-unit-id="${recruitIds[1]}"]) .formation-unit-recruit`);
          const cueStartForCase = (await readCues(casePage)).length;
          await firstHire.evaluate((button) => button.click());
          await casePage.waitForFunction(({ key, unitId, caps }) => {
            const raw = localStorage.getItem(key);
            if (!raw) return false;
            const save = JSON.parse(raw);
            return save.caps === caps && save.ownership.includes(unitId);
          }, { key: saveKey, unitId: recruitIds[0], caps: fixture.caps - recruitCosts[0] }, { timeout });
          await waitForFeedback(casePage, "success");
          await blockPersistence(casePage);
          await secondHire.evaluate((button) => button.click());
          await waitForFeedback(casePage, "reject");
          await casePage.waitForTimeout(100);
          const finalSave = await readSave(casePage);
          invariant(finalSave.save.caps === fixture.caps - recruitCosts[0]
            && finalSave.save.ownership.includes(recruitIds[0])
            && !finalSave.save.ownership.includes(recruitIds[1])
            && finalSave.save.processedAcquisitionIds.filter((id) => id === `recruit:${recruitIds[0]}`).length === 1
            && finalSave.save.processedAcquisitionIds.filter((id) => id === `recruit:${recruitIds[1]}`).length === 0,
          "failed second hire overwrote the first success");
          const cues = (await readCues(casePage)).slice(cueStartForCase);
          return {
            durableSaveBytes: Buffer.byteLength(finalSave.raw, "utf8"),
            firstSuccess: true,
            secondFailure: true,
            rejectCueCount: cues.filter((entry) => entry.cueId === "ui-error").length,
            purchaseCueCount: cues.filter((entry) => entry.cueId === "sfx-v070-terminal-confirm").length,
          };
        }));
        isolatedCases.push(await runIsolatedCase(browser, viewport, `${name}-hire-plus-upgrade`, async (casePage) => {
          const hireButton = casePage.locator(".formation-unit-recruit").first();
          const hireCueStart = (await readCues(casePage)).length;
          await hireButton.evaluate((button) => button.click());
          await casePage.waitForFunction(({ key, unitId, caps }) => {
            const raw = localStorage.getItem(key);
            if (!raw) return false;
            const save = JSON.parse(raw);
            return save.caps === caps && save.ownership.includes(unitId);
          }, { key: saveKey, unitId: recruitIds[0], caps: fixture.caps - recruitCosts[0] }, { timeout });
          await waitForFeedback(casePage, "success");
          const hireCues = (await readCues(casePage)).slice(hireCueStart);
          invariant(hireCues.filter((entry) => entry.cueId === "sfx-v070-terminal-confirm").length === 1
            && hireCues.filter((entry) => entry.cueId === "ui-select").length === 0,
          `cross transaction hire cue contract mismatch: ${JSON.stringify(hireCues)}`);
          await casePage.getByRole("button", { name: "Level", exact: true }).click();
          const upgradeButton = casePage.locator(".formation-unit-upgrade:not(:disabled)").first();
          await upgradeButton.waitFor({ state: "visible", timeout });
          const upgradeUnitId = await upgradeButton.evaluate((button) => button.closest(".formation-unit-card")
            ?.querySelector("[data-unit-id]")?.getAttribute("data-unit-id"));
          invariant(upgradeUnitId, "cross transaction upgrade unit missing");
          const upgradeQuote = campaignUnitUpgradeQuote(fixture, upgradeUnitId);
          const upgradeCueStart = (await readCues(casePage)).length;
          await upgradeButton.evaluate((button) => button.click());
          await casePage.waitForFunction(({ key, recruitId, upgradeId, caps }) => {
            const raw = localStorage.getItem(key);
            if (!raw) return false;
            const save = JSON.parse(raw);
            return save.caps === caps
              && save.ownership.includes(recruitId)
              && save.processedAcquisitionIds.filter((id) => id === `recruit:${recruitId}`).length === 1
              && save.processedUpgradeIds.filter((id) => id === upgradeId).length === 1;
          }, {
            key: saveKey,
            recruitId: recruitIds[0],
            upgradeId: `upgrade:${upgradeUnitId}:level-${upgradeQuote.nextLevel}`,
            caps: fixture.caps - recruitCosts[0] - upgradeQuote.costCaps,
          }, { timeout });
          await waitForFeedback(casePage, "success", 2);
          const finalSave = await readSave(casePage);
          const cues = (await readCues(casePage)).slice(upgradeCueStart);
          invariant(cues.filter((entry) => entry.cueId === "sfx-v070-terminal-confirm").length === 0
            && cues.filter((entry) => entry.cueId === "sfx-v070-power-switch").length === 1
            && cues.filter((entry) => entry.cueId === "ui-select").length === 0,
          `cross transaction cue contract mismatch: ${JSON.stringify(cues)}`);
          return {
            recruitId: recruitIds[0],
            upgradeUnitId,
            upgradeCost: upgradeQuote.costCaps,
            durableSaveBytes: Buffer.byteLength(finalSave.raw, "utf8"),
            transactionOrder: [
              `recruit:${recruitIds[0]}`,
              `upgrade:${upgradeUnitId}:level-${upgradeQuote.nextLevel}`,
            ],
            successFeedbackCount: (await feedbackEvents(casePage)).filter(({ kind }) => kind === "success").length,
            purchaseCueCount: hireCues.filter((entry) => entry.cueId === "sfx-v070-terminal-confirm").length,
            upgradeCueCount: cues.filter((entry) => entry.cueId === "sfx-v070-power-switch").length,
            genericSelectionCueCount: cues.filter((entry) => entry.cueId === "ui-select").length,
          };
        }));
        invariant(isolatedCases.every(({ status }) => status === "passed"),
          `PR1 transaction cases failed: ${JSON.stringify(isolatedCases)}`);

        result.status = "passed";
        result.concurrent = {
          recruitIds,
          costs: recruitCosts,
          capsBefore: fixture.caps,
          capsAfter: after.save.caps,
          receiptCounts: Object.fromEntries(recruitIds.map((unitId) => [unitId,
            after.save.processedAcquisitionIds.filter((id) => id === `recruit:${unitId}`).length])),
          successFeedbackCount: successFeedback.length,
          purchaseCueCount: hireCues.filter((entry) => entry.cueId === "sfx-v070-terminal-confirm").length,
          genericSelectionCueCount: hireCues.filter((entry) => entry.cueId === "ui-select").length,
          durableSaveBytes: Buffer.byteLength(after.raw, "utf8"),
          reloadPreserved: true,
        };
        result.cases = isolatedCases;
        await assertDiagnostics(diagnostics, name);
      } catch (error) {
        result.error = String(error);
        result.diagnostics = diagnostics;
        try {
          await page.screenshot({ path: path.join(evidenceDir, `${name}-FAILED.png`) });
        } catch {
          // Keep the failure report if navigation already tore the page down.
        }
      } finally {
        results.push(result);
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}

const summary = {
  generatedAt: new Date().toISOString(),
  baseUrl: String(baseUrl),
  fixture: {
    schemaVersion: fixture.schemaVersion,
    recruitIds,
    completedStageIds,
  },
  passed: results.filter(({ status }) => status === "passed").length,
  failed: results.filter(({ status }) => status === "failed").length,
  results,
};
await writeFile(path.join(evidenceDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify(summary, null, 2));
if (summary.failed > 0) throw new Error(`PR1 transaction browser smoke failed ${summary.failed}/${results.length}`);
