import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  createDefaultCampaignSave,
  deserializeCampaignSave,
  reviseCampaignSave,
  serializeCampaignSave,
} from "../app/campaign.js";
import {
  OUTBREAK_MISSIONS,
  OUTBREAK_MISSION_IDS,
} from "../app/outbreakMissions.js";

if (!process.env.OUTBREAK_QA_BASE_URL) throw new Error("OUTBREAK_QA_BASE_URL is required");
const baseUrl = new URL(process.env.OUTBREAK_QA_BASE_URL);
if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname)) {
  throw new Error(`Outbreak QA is local-only: ${baseUrl}`);
}

const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href)
  : await import("playwright");
const engines = (process.env.OUTBREAK_QA_ENGINES ?? "chromium,webkit")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const browserTypes = { chromium: playwright.chromium, webkit: playwright.webkit };
const viewports = [
  { width: 1280, height: 720 },
  { width: 844, height: 390 },
  { width: 844, height: 340 },
];
const timeout = Math.max(12_000, Number(process.env.OUTBREAK_QA_TIMEOUT_MS) || 45_000);
const evidenceDir = path.resolve(
  process.env.OUTBREAK_QA_EVIDENCE_DIR ?? "outputs/outbreak-runtime-browser-smoke",
);
const saveKey = "nishijin-campaign-v1";
const prerequisiteStageIds = [...new Set(OUTBREAK_MISSIONS.map(({ prerequisiteStageId }) => prerequisiteStageId))];
const seededSave = reviseCampaignSave({
  ...createDefaultCampaignSave(),
  campaignStarted: true,
  completedStageIds: prerequisiteStageIds,
  unlockedStageIds: prerequisiteStageIds,
  lastSelectedStageId: prerequisiteStageIds[0],
}, { updatedAt: "2026-07-27T00:00:00.000Z" });
const serializedSeed = serializeCampaignSave(seededSave);
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
    diagnostics.requestFailures.push(`${request.url()} :: ${request.failure()?.errorText ?? "unknown"}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) diagnostics.httpErrors.push(`${response.status()} ${response.url()}`);
  });
  return diagnostics;
}

async function openOutbreakDossier(page) {
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
    key: saveKey,
    value: serializedSeed,
  });
  await page.goto(String(baseUrl), { waitUntil: "domcontentloaded", timeout });
  await page.locator("button.title-start").waitFor({ state: "visible", timeout });
  await page.locator("button.title-start").click();
  await page.locator(".map-screen").waitFor({ state: "visible", timeout });
  await page.locator("button.outbreak-entry").click();
  await page.locator(".outbreak-screen").waitFor({ state: "visible", timeout });
}

async function dossierEvidence(page) {
  return page.evaluate(async () => {
    const missionButtons = [...document.querySelectorAll(".outbreak-mission-list button")];
    const selectedButton = document.querySelector(".outbreak-mission-list button[data-selected='true']");
    const prepareButton = document.querySelector(".outbreak-intel .campaign-primary");
    const bossArt = document.querySelector(".outbreak-boss-art");
    const backgroundImage = bossArt ? getComputedStyle(bossArt).backgroundImage : "";
    const imageUrl = backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1] ?? "";
    const image = imageUrl ? await new Promise((resolve) => {
      const probe = new Image();
      probe.onload = () => resolve({ ok: true, width: probe.naturalWidth, height: probe.naturalHeight });
      probe.onerror = () => resolve({ ok: false, width: 0, height: 0 });
      probe.src = imageUrl;
    }) : { ok: false, width: 0, height: 0 };
    const rectFor = (element) => {
      const rect = element?.getBoundingClientRect();
      return rect ? {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      } : null;
    };
    return {
      missionCount: missionButtons.length,
      unlockedCount: missionButtons.filter((button) => !button.disabled).length,
      labels: missionButtons.map((button) => button.textContent ?? ""),
      selectedButtonRect: rectFor(selectedButton),
      prepareButtonRect: rectFor(prepareButton),
      image,
      dimensions: {
        width: window.innerWidth,
        height: window.innerHeight,
        documentWidth: document.documentElement.scrollWidth,
        documentHeight: document.documentElement.scrollHeight,
      },
    };
  });
}

async function accelerateAllEntries(page) {
  await page.waitForFunction(() => {
    const bridge = window.__ASHFALL_BATTLE_QA__;
    bridge?.accelerateOutbreakEntries?.();
    const snapshot = bridge?.getSnapshot?.();
    return snapshot
      && snapshot.pendingSpawnCount === 0
      && snapshot.fighters
        .filter((fighter) => fighter.side === "zombie" && fighter.hp > 0)
        .every((fighter) => fighter.combatReady && !fighter.gateEntering);
  }, undefined, { timeout });
}

async function runFullOutbreak(page, name) {
  const mission = OUTBREAK_MISSIONS[0];
  const selected = page.locator(".outbreak-mission-list button").filter({ hasText: mission.displayName });
  await selected.click();
  await page.locator(".outbreak-intel .campaign-primary").click();
  await page.locator(".formation-screen").waitFor({ state: "visible", timeout });
  const startButton = page.locator(".formation-footer .campaign-primary");
  await startButton.waitFor({ state: "visible", timeout });
  await page.waitForFunction(() => {
    const button = document.querySelector(".formation-footer .campaign-primary");
    return button && !button.disabled && button.textContent?.includes("この編成で出撃");
  }, undefined, { timeout });
  await startButton.click();
  await page.waitForFunction(() => (
    window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().screen === "battle"
  ), undefined, { timeout });

  const initial = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
  invariant(initial.operationId === mission.id, `${name}: operation ID mismatch`);
  invariant(initial.stageId === mission.prerequisiteStageId, `${name}: battlefield stage mismatch`);
  invariant(initial.operationCategory === "outbreak", `${name}: operation category mismatch`);

  let entryProof = null;
  while (true) {
    const before = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
    if (before.eventIndex >= before.timelineLength) break;
    await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.advanceOutbreakTimeline());
    await page.waitForFunction((eventIndex) => (
      window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().eventIndex > eventIndex
    ), before.eventIndex, { timeout });
    await page.waitForFunction(() => {
      const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
      return snapshot?.pendingSpawnCount > 0
        || snapshot?.fighters?.some((fighter) => fighter.side === "zombie" && fighter.hp > 0);
    }, undefined, { timeout });
    if (!entryProof) {
      entryProof = await page.evaluate(() => {
        const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
        const fighter = snapshot.fighters.find((candidate) => (
          candidate.side === "zombie"
          && candidate.hp > 0
          && candidate.gateEntering
          && !candidate.combatReady
        ));
        return fighter ? {
          hp: fighter.hp,
          maxHp: fighter.maxHp,
          targetId: fighter.targetId,
          targetObjectId: fighter.targetObjectId,
          combatReady: fighter.combatReady,
          gateEntering: fighter.gateEntering,
          entryMode: fighter.spawnEntryMode,
        } : null;
      });
    }
    await accelerateAllEntries(page);
  }
  invariant(entryProof, `${name}: no right-edge entry observed`);
  invariant(entryProof.hp === entryProof.maxHp, `${name}: entry damage leaked`);
  invariant(entryProof.targetId === null && entryProof.targetObjectId === null, `${name}: entry targeting leaked`);
  invariant(!entryProof.combatReady && entryProof.gateEntering, `${name}: entry combat lock missing`);
  invariant(
    ["right-edge", "right-edge-outside"].includes(entryProof.entryMode),
    `${name}: wrong entry mode ${entryProof.entryMode}`,
  );

  await accelerateAllEntries(page);
  const ready = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
  const boss = ready.fighters.find((fighter) => fighter.kind === mission.boss.enemyKind && fighter.hp > 0);
  invariant(boss?.combatReady && !boss.gateEntering, `${name}: boss became attackable before full-body entry`);
  await page.waitForFunction(() => document.querySelector(".boss-hud")?.textContent?.includes("マザー"), undefined, {
    timeout,
  });
  const combatPath = path.join(evidenceDir, `${name}-combat-ready.png`);
  await page.screenshot({ path: combatPath, fullPage: false });

  await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.failNextOutbreakSettlementSave());
  const bossDefeat = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.defeatOutbreakBoss());
  invariant(bossDefeat, `${name}: outbreak boss-first defeat gate rejected the boss`);
  await page.waitForFunction(() => {
    const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
    return snapshot?.bossDefeated
      && snapshot.fighters.some((fighter) => (
        fighter.side === "zombie" && fighter.hp > 0 && fighter.kind !== "mother"
      ));
  }, undefined, { timeout });
  await page.waitForFunction(() => (
    document.querySelector(".mission-health")?.textContent?.includes("残存感染体を掃討")
  ), undefined, { timeout });
  await page.waitForTimeout(300);
  const cleanup = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
  invariant(cleanup.barricadeVulnerable === false, `${name}: phantom infection base became vulnerable`);
  invariant(cleanup.barricadeHp === bossDefeat.barricadeHp, `${name}: phantom infection base took damage`);
  invariant(cleanup.operationId === mission.id, `${name}: operation ID changed during cleanup`);
  const cleanupPath = path.join(evidenceDir, `${name}-boss-first-cleanup.png`);
  await page.screenshot({ path: cleanupPath, fullPage: false });

  const defeated = await page.evaluate(() => (
    window.__ASHFALL_BATTLE_QA__.defeatOutbreakRemainingEnemies()
  ));
  invariant(defeated > 0, `${name}: residual infected cleanup gate rejected ready enemies`);
  await page.locator(".outbreak-settlement-blocker").waitFor({ state: "visible", timeout });
  invariant(
    await page.locator(".outbreak-settlement-blocker").innerText().then((text) => (
      text.includes("結果を保存できません") && text.includes("一括保存を再試行")
    )),
    `${name}: atomic failure did not stop before reward publication`,
  );
  const failedRaw = await page.evaluate((key) => localStorage.getItem(key), saveKey);
  const failedSave = deserializeCampaignSave(failedRaw);
  invariant(failedSave.caps === seededSave.caps, `${name}: failed save leaked caps`);
  invariant(failedSave.outbreaks.processedResultIds.length === 0, `${name}: failed save leaked receipt`);
  invariant(failedSave.equipmentInventory.length === 0, `${name}: failed save leaked equipment`);
  await page.getByRole("button", { name: "一括保存を再試行" }).click();
  await page.locator(".outbreak-result-screen").waitFor({ state: "visible", timeout });
  await page.waitForFunction(() => !document.querySelector(".outbreak-settlement-blocker"), undefined, { timeout });
  const committedProof = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
  invariant(
    committedProof.outbreakSettlementPersistenceAttempts === 2,
    `${name}: settlement retry count ${committedProof.outbreakSettlementPersistenceAttempts}`,
  );
  const resultText = await page.locator(".outbreak-result-panel").innerText();
  invariant(resultText.includes("異常個体を制圧"), `${name}: victory result missing`);
  invariant(resultText.includes("マザー"), `${name}: boss result identity missing`);
  invariant(resultText.includes("×1"), `${name}: equipment quantity missing`);
  const resultPath = path.join(evidenceDir, `${name}-atomic-result.png`);
  await page.screenshot({ path: resultPath, fullPage: false });

  const persistedRaw = await page.evaluate((key) => localStorage.getItem(key), saveKey);
  const persistedEnvelope = JSON.parse(persistedRaw);
  const persisted = deserializeCampaignSave(persistedRaw);
  const expectedGrant = mission.firstClearEquipmentGrant;
  invariant(persisted.outbreaks.clearedMissionIds.includes(mission.id), `${name}: mission clear not persisted`);
  invariant(persisted.outbreaks.survivalBossKinds.includes(mission.boss.enemyKind), `${name}: Survival boss not unlocked`);
  invariant(persisted.outbreaks.processedResultIds.length === 1, `${name}: receipt count mismatch`);
  invariant(persisted.outbreaks.bossDefeatCounts[mission.boss.enemyKind] === 1, `${name}: defeat count mismatch`);
  invariant(persisted.caps === seededSave.caps + mission.baseRewardCaps, `${name}: caps settlement mismatch`);
  invariant(
    persisted.equipmentInventory.some(({ equipmentId, quantity }) => (
      equipmentId === expectedGrant.equipmentId && quantity === expectedGrant.quantity
    )),
    `${name}: equipment quantity settlement mismatch`,
  );
  invariant(persisted.revision === seededSave.revision + 1, `${name}: settlement used more than one revision`);
  invariant(
    typeof persistedEnvelope.integrity === "string" && persistedEnvelope.integrity.length > 0,
    `${name}: integrity missing`,
  );
  invariant(persisted.outbreaks.lastResult?.missionId === mission.id, `${name}: last result mismatch`);

  await page.reload({ waitUntil: "domcontentloaded", timeout });
  await page.locator("button.title-start").waitFor({ state: "visible", timeout });
  await page.waitForTimeout(250);
  const reloadedRaw = await page.evaluate((key) => localStorage.getItem(key), saveKey);
  const reloaded = deserializeCampaignSave(reloadedRaw);
  invariant(reloaded.caps === persisted.caps, `${name}: reload duplicated caps`);
  invariant(reloaded.equipmentInventory.find(({ equipmentId }) => (
    equipmentId === expectedGrant.equipmentId
  ))?.quantity === expectedGrant.quantity, `${name}: reload duplicated equipment`);
  invariant(reloaded.outbreaks.processedResultIds.length === 1, `${name}: reload duplicated receipt`);
  invariant(reloaded.revision === persisted.revision, `${name}: reload mutated settlement revision`);
  return {
    combatPath,
    cleanupPath,
    resultPath,
    resultId: persisted.outbreaks.lastResult.resultId,
    revision: persisted.revision,
    capsAfter: persisted.caps,
    equipmentGrant: expectedGrant,
  };
}

for (const engine of engines) {
  const browserType = browserTypes[engine];
  if (!browserType) throw new Error(`Unknown OUTBREAK_QA_ENGINES value: ${engine}`);
  const browser = await browserType.launch({ headless: true });
  try {
    for (const viewport of viewports) {
      const name = `${engine}-outbreak-${viewport.width}x${viewport.height}`;
      const context = await browser.newContext({ viewport, hasTouch: true });
      const page = await context.newPage();
      const diagnostics = diagnosticsFor(page);
      try {
        await openOutbreakDossier(page);
        const dossier = await dossierEvidence(page);
        invariant(dossier.missionCount === 5, `${name}: mission count ${dossier.missionCount}`);
        invariant(dossier.unlockedCount === 5, `${name}: locked mission remained`);
        for (const mission of OUTBREAK_MISSIONS) {
          invariant(
            dossier.labels.some((label) => label.includes(mission.displayName)),
            `${name}: ${mission.displayName} missing`,
          );
        }
        invariant(dossier.image.ok && dossier.image.width > 0, `${name}: approved boss art failed to decode`);
        invariant(dossier.selectedButtonRect?.height >= 44, `${name}: mission tap target below 44px`);
        invariant(dossier.prepareButtonRect?.height >= 44, `${name}: prepare tap target below 44px`);
        invariant(
          dossier.dimensions.documentWidth <= viewport.width
            && dossier.dimensions.documentHeight <= viewport.height,
          `${name}: dossier overflow`,
        );
        const dossierPath = path.join(evidenceDir, `${name}-dossier.png`);
        await page.screenshot({ path: dossierPath, fullPage: false });
        const fullRuntime = engine === "chromium" && viewport.width === 844 && viewport.height === 340
          ? await runFullOutbreak(page, name)
          : null;
        invariant(diagnostics.consoleErrors.length === 0, `${name}: console ${diagnostics.consoleErrors}`);
        invariant(diagnostics.pageErrors.length === 0, `${name}: page ${diagnostics.pageErrors}`);
        invariant(diagnostics.requestFailures.length === 0, `${name}: request ${diagnostics.requestFailures}`);
        invariant(diagnostics.httpErrors.length === 0, `${name}: HTTP ${diagnostics.httpErrors}`);
        results.push({ name, status: "passed", dossierPath, fullRuntime });
      } catch (error) {
        results.push({ name, status: "failed", error: String(error), diagnostics });
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}

const reportPath = path.join(evidenceDir, "report.json");
await writeFile(reportPath, `${JSON.stringify(results, null, 2)}\n`, "utf8");
const failures = results.filter(({ status }) => status !== "passed");
if (failures.length > 0) {
  throw new Error(`Outbreak browser smoke failed (${failures.length}/${results.length}): ${reportPath}`);
}
invariant(
  results.some(({ fullRuntime }) => fullRuntime?.resultId),
  "No full outbreak runtime settlement proof was recorded",
);
invariant(
  OUTBREAK_MISSION_IDS.MOTHER_BROOD_VAULT === OUTBREAK_MISSIONS[0].id,
  "Mother vertical slice order changed",
);
console.log(`Outbreak browser smoke passed (${results.length}/${results.length}): ${reportPath}`);
