import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";
import { createDefaultV100Save, normalizeV100Save, serializeV100Save } from "../app/v100Save.js";
import { V100_STAGE_IDS, V100_STAGES, V100_SUPPORTS, V100_UNITS } from "../app/v100Registry.js";
import { v100BattleDefinitionFor } from "../app/v100BattleAdapter.js";
import { deriveV100ProductionEnemyCoverage, V100_REPRESENTATIVE_COMBAT_CONTRACT } from "../app/v100PhaseGContract.js";
import { validateProductionEnemyRuntimeShards } from "./v0995-enemy-runtime-shards.mjs";

const baseUrl = new URL(process.env.V100_CAMPAIGN_QA_BASE_URL ?? "http://127.0.0.1:4177/");
if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname)) throw new Error(`V1 matrix is local-only; refusing ${baseUrl}`);
const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href)
  : await import("playwright");
const evidenceDir = path.resolve(process.env.V100_PHASE_G_EVIDENCE_DIR ?? "outputs/v100-phase-g");
const timeout = Math.max(20_000, Number(process.env.V100_PHASE_G_TIMEOUT_MS) || 60_000);
const battleTimeout = Math.max(60_000, Number(process.env.V100_PHASE_G_BATTLE_TIMEOUT_MS) || 150_000);
const requiredViewports = [
  { width: 1280, height: 720, safeArea: false },
  { width: 844, height: 390, safeArea: true },
  { width: 844, height: 340, safeArea: true },
];
const extraBattleViewports = [
  { width: 667, height: 375, safeArea: true },
  { width: 736, height: 414, safeArea: true },
  { width: 932, height: 430, safeArea: true },
];
const extraBattleContracts = Object.freeze([
  { variant: "stage03-takuya", engine: "chromium", viewport: extraBattleViewports[0], stageNumber: 3, bossKind: "takuya", formationUnitIds: ["unit-tatara", "unit-mizuchi", "unit-hachi", "unit-paisen", "unit-kumaverson", "unit-babayaga", "unit-nao"] },
  { variant: "stage04-grappler", engine: "chromium", viewport: extraBattleViewports[1], stageNumber: 4, bossKind: null, formationUnitIds: ["unit-tatara", "unit-mizuchi", "unit-hachi", "unit-paisen", "unit-kumaverson", "unit-babayaga", "unit-nao"] },
  { variant: "stage21-panther-knife", engine: "chromium", viewport: extraBattleViewports[2], stageNumber: 21, bossKind: null, formationUnitIds: ["unit-tatara", "unit-mizuchi", "unit-hachi", "unit-paisen", "unit-kumaverson", "unit-babayaga", "unit-nao"] },
  { variant: "stage22-panther-shield", engine: "webkit", viewport: extraBattleViewports[0], stageNumber: 22, bossKind: null, formationUnitIds: ["unit-tatara", "unit-mizuchi", "unit-hachi", "unit-paisen", "unit-kumaverson", "unit-babayaga", "unit-nao"] },
  { variant: "stage24-panther-commander", engine: "webkit", viewport: extraBattleViewports[1], stageNumber: 24, bossKind: "futago", formationUnitIds: ["unit-hachi", "unit-paisen", "unit-kumaverson", "unit-babayaga", "unit-mizuchi", "unit-nao", "unit-tatara"] },
  // Start every boss fixture with the same low-cost opening a player can use
  // to establish a frontline before the expensive cards recover. The
  // formation still contains seven canonical V1 units; this only makes the
  // production interaction reproducible inside the timed boss approach.
  // The order is a QA interaction plan, not a gameplay or balance change.
  { variant: "stage25-president", engine: "webkit", viewport: extraBattleViewports[2], stageNumber: 25, bossKind: "mugarian-president-mutated", formationUnitIds: ["unit-hachi", "unit-paisen", "unit-kumaverson", "unit-babayaga", "unit-mizuchi", "unit-nao", "unit-tatara"] },
].map((contract) => Object.freeze({
  ...contract,
  stageId: V100_STAGE_IDS[contract.stageNumber - 1],
  stageName: V100_STAGES[contract.stageNumber - 1]?.displayName,
})));
const coreStates = [
  "title-name", "dialogue-left", "dialogue-right", "map-normal", "map-locked-boss", "formation", "personnel", "support-vehicle-management",
  "battle-normal", "battle-boss", "result-win", "result-lose", "ending", "credits", "epilogue-postgame", "data-management-modal",
];
const onlyState = process.env.V100_PHASE_G_ONLY ?? "";
const onlyVariant = process.env.V100_PHASE_G_ONLY_VARIANT ?? "";
const storageKeys = ["nishijin-campaign-v100", "nishijin-campaign-v100:mirror", "nishijin-campaign-v100:last-known-good", "nishijin-campaign-v100:owner"];
const results = [];

await mkdir(evidenceDir, { recursive: true });

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function viewportLabel(viewport) {
  return `${viewport.width}x${viewport.height}`;
}

function imagePath(label) {
  return path.join(evidenceDir, `${label}.png`);
}

function relativeEvidence(filePath) {
  return path.relative(process.cwd(), filePath).replaceAll("\\", "/");
}

function fullSave({ availableStageIds = [V100_STAGE_IDS[0]], completedStageIds = [], flowState = null, pendingResult = null, formationUnitIds = null } = {}) {
  const base = createDefaultV100Save({ playerName: "QAプレイヤー" });
  return normalizeV100Save({
    ...base,
    revision: 4,
    campaignStarted: true,
    playerName: "QAプレイヤー",
    caps: 9999,
    availableStageIds,
    completedStageIds,
    registeredUnitIds: V100_UNITS.map((unit) => unit.id),
    ownedUnitIds: V100_UNITS.map((unit) => unit.id),
    supportPurchaseUnlockedIds: V100_SUPPORTS.map((support) => support.id),
    ownedSupportIds: V100_SUPPORTS.map((support) => support.id),
    equippedSupportId: V100_SUPPORTS[0]?.id ?? null,
    formationSlots: (formationUnitIds ?? V100_UNITS.slice(0, 7).map((unit) => unit.id)).slice(0, 7),
    levelCap: 30,
    vehicle: { upgradeLevel: 3, maxHp: 920, upgradeReceipts: ["v100:vehicle:upgrade:1", "v100:vehicle:upgrade:2", "v100:vehicle:upgrade:3"] },
    flowState: flowState ?? { phase: "map", eventId: null, stageId: V100_STAGE_IDS[0], stageNumber: 1, destination: "map", nodeIndex: 0, firstClear: false, finalized: true },
    pendingResult,
  });
}

function resultSave(won) {
  const stageId = V100_STAGE_IDS[0];
  const pendingResult = {
    resultId: `qa-result-${won ? "win" : "lose"}`,
    battleRunId: `qa-run-${won ? "win" : "lose"}`,
    stageId,
    stageNumber: 1,
    won,
    objectiveComplete: won,
    bossDefeated: false,
    vehicleHp: won ? 612 : 0,
    vehicleMaxHp: 920,
    stars: won ? 3 : 0,
    elapsedSeconds: won ? 74 : 51,
    unitDeaths: won ? 1 : 4,
  };
  return fullSave({ flowState: { phase: "result", eventId: null, stageId, stageNumber: 1, destination: "result", nodeIndex: 0, firstClear: won, finalized: false }, pendingResult });
}

function eventSave(phase, eventId) {
  const stageId = V100_STAGE_IDS[29];
  return fullSave({
    availableStageIds: V100_STAGE_IDS,
    completedStageIds: V100_STAGE_IDS.slice(0, 29),
    flowState: { phase, eventId, stageId, stageNumber: 30, destination: phase, nodeIndex: 0, firstClear: false, finalized: true },
  });
}

async function seedPage(page, save) {
  const serialized = serializeV100Save(save);
  await page.addInitScript(({ keys, value }) => {
    for (const key of keys) localStorage.removeItem(key);
    for (const key of keys.slice(0, 3)) localStorage.setItem(key, value);
  }, { keys: storageKeys, value: serialized });
}

function diagnosticsFor(page) {
  const diagnostics = { consoleErrors: [], pageErrors: [], requestFailures: [], httpFailures: [] };
  page.on("console", (message) => { if (message.type() === "error") diagnostics.consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(String(error)));
  page.on("requestfailed", (request) => {
    const errorText = request.failure()?.errorText ?? "unknown";
    if (errorText !== "net::ERR_ABORTED") diagnostics.requestFailures.push(`${request.url()} :: ${errorText}`);
  });
  page.on("response", (response) => { if (response.status() >= 400) diagnostics.httpFailures.push(`${response.status()} ${response.url()}`); });
  return diagnostics;
}

async function visible(page, selector) {
  return page.locator(selector).first().isVisible().catch(() => false);
}

async function click(page, locator, label) {
  await locator.waitFor({ state: "visible", timeout });
  const box = await locator.boundingBox();
  invariant(box && box.width >= 28 && box.height >= 24, `${label} has unusable hit target: ${JSON.stringify(box)}`);
  await locator.click();
}

async function openRoute(page, save = null) {
  const url = new URL("v100", baseUrl);
  url.searchParams.set("phase-g", "1");
  await page.goto(String(url), { waitUntil: "domcontentloaded", timeout });
  const waitForGateOrShell = () => page.waitForFunction(() => Boolean(
    document.querySelector(".v100-shell")
      || document.querySelector("[role=dialog][aria-label='ゲームデータの準備'] button"),
  ), null, { timeout });
  await waitForGateOrShell();
  if (save) {
    await seedPage(page, save);
    await page.reload({ waitUntil: "domcontentloaded", timeout });
    await waitForGateOrShell();
  }
  const offer = page.getByRole("button", { name: "ブラウザで遊ぶ", exact: true });
  await offer.waitFor({ state: "visible", timeout: Math.min(timeout, 10_000) }).catch(() => {});
  if (await offer.isVisible().catch(() => false)) {
    await page.evaluate(() => { document.documentElement.dataset.phaseGPwaOffer = "shown"; });
    await click(page, offer, "PWA browser play");
  }
  await page.locator(".v100-shell").waitFor({ state: "attached", timeout });
}

async function advanceStory(page, stopSelector) {
  for (let index = 0; index < 240; index += 1) {
    if (await visible(page, stopSelector)) return;
    const skip = page.getByRole("button", { name: "スキップ", exact: true });
    if (await skip.isVisible().catch(() => false)) await click(page, skip, "story skip");
    else {
      const advance = page.locator(".v100-event-actions .v100-primary");
      if (!(await advance.isVisible().catch(() => false))) {
        const state = await page.evaluate(() => ({
          phase: document.querySelector(".v100-shell")?.getAttribute("data-v100-phase") ?? null,
          stage: document.querySelector(".v100-shell")?.getAttribute("data-v100-stage") ?? null,
          body: document.body.innerText.slice(0, 1200),
        }));
        throw new Error(`story stopped before ${stopSelector}: ${JSON.stringify(state)}`);
      }
      await click(page, advance, "story advance");
    }
    await page.waitForTimeout(18);
  }
  throw new Error(`story did not reach ${stopSelector}`);
}

async function waitBattle(page) {
  try {
    await page.locator('.game-shell[data-screen="battle"]').waitFor({ state: "visible", timeout: Math.min(battleTimeout, 30_000) });
  } catch (error) {
    const state = await page.evaluate(() => ({
      url: location.href,
      phase: document.querySelector(".v100-shell")?.getAttribute("data-v100-phase") ?? null,
      stage: document.querySelector(".v100-shell")?.getAttribute("data-v100-stage") ?? null,
      body: document.body.innerText.slice(0, 1600),
      assetState: document.documentElement.dataset.assetLoadState ?? null,
      mount: window.__ASHFALL_ASSET_QA__?.getBattleMountState?.() ?? null,
    })).catch(() => null);
    throw new Error(`battle did not mount: ${String(error)} state=${JSON.stringify(state)}`);
  }
  await page.waitForFunction(() => document.documentElement.dataset.assetLoadState === "ready", null, { timeout: battleTimeout });
  await page.waitForFunction(() => window.__ASHFALL_ASSET_QA__?.getBattleMountState?.().battleMounted === true, null, { timeout: battleTimeout });
}

async function waitForCombatActivity(page, { bossKind = null } = {}) {
  try {
    await page.waitForFunction(() => {
      const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
      if (!snapshot || snapshot.screen !== "battle") return false;
      const hasFighters = Array.isArray(snapshot.fighters) && snapshot.fighters.some((fighter) => fighter.hp > 0);
      const hasPresentation = (snapshot.attackIdentity?.length ?? 0) > 0
        || (snapshot.pendingWeaponHits?.length ?? 0) > 0
        || (snapshot.battlePresentation?.effects?.length ?? 0) > 0;
      if (!hasFighters || !hasPresentation) return false;
      window.__PHASE_G_COMBAT_ACTIVITY__ = {
        attackIdentity: snapshot.attackIdentity ?? [],
        pendingWeaponHits: snapshot.pendingWeaponHits ?? [],
        battlePresentationEffects: snapshot.battlePresentation?.effects ?? [],
      };
      return true;
    }, null, { timeout: Math.min(battleTimeout, 45_000) });
  } catch (error) {
    const state = await page.evaluate(() => ({
      battleScreen: document.querySelector(".game-shell")?.getAttribute("data-screen") ?? null,
      snapshot: (() => {
        const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.() ?? null;
        return snapshot ? {
          time: snapshot.time,
          wave: snapshot.wave,
          eventIndex: snapshot.eventIndex,
          pendingSpawnCount: snapshot.pendingSpawnCount,
          attackIdentity: snapshot.attackIdentity?.length ?? 0,
          pendingWeaponHits: snapshot.pendingWeaponHits?.length ?? 0,
          presentationEffects: snapshot.battlePresentation?.effects?.length ?? 0,
          fighters: snapshot.fighters?.map((fighter) => ({ side: fighter.side, kind: fighter.kind, hp: fighter.hp, x: fighter.x, targetId: fighter.targetId, combatReady: fighter.combatReady, attackWindup: fighter.attackWindup })) ?? [],
        } : null;
      })(),
    })).catch(() => null);
    throw new Error(`combat activity did not become visible: ${String(error)} state=${JSON.stringify(state)}`);
  }
  if (bossKind) {
    try {
      await page.waitForFunction((expectedKind) => {
        const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
        return snapshot?.fighters?.some((fighter) => (
          fighter.side === "zombie"
          && fighter.kind === expectedKind
          && fighter.hp > 0
          && fighter.combatReady === true
          && Number(fighter.x) < 900
        )) === true;
      }, bossKind, { timeout: battleTimeout });
    } catch (error) {
      const state = await page.evaluate(() => ({
        url: location.href,
        campaignPhase: document.querySelector(".v100-shell")?.getAttribute("data-v100-phase") ?? null,
        battleScreen: document.querySelector(".game-shell")?.getAttribute("data-screen") ?? null,
        body: document.body.innerText.slice(0, 1400),
        snapshot: window.__ASHFALL_BATTLE_QA__?.getSnapshot?.() ?? null,
      })).catch(() => null);
      throw new Error(`boss ${bossKind} did not become live: ${String(error)} state=${JSON.stringify(state)}`);
    }
  }
}

async function overflowAudit(page) {
  return page.evaluate(() => {
    const values = [document.documentElement, document.body, document.querySelector(".v100-shell"), document.querySelector(".game-shell")].filter(Boolean);
    return values.map((element) => ({ scrollWidth: element.scrollWidth, clientWidth: element.clientWidth, delta: element.scrollWidth - element.clientWidth }));
  });
}

const stateContracts = Object.freeze({
  "title-name": { phases: ["name"], selectors: [".v100-title-screen", "#v100-name-title", "#v100-player-name", ".v100-name-card .v100-primary"] },
  "dialogue-left": { phases: ["event"], selectors: [".v100-event-panel", '[data-v100-state="dialogue-left"]', ".v100-event-actions .v100-primary"] },
  "dialogue-right": { phases: ["event"], selectors: [".v100-event-panel", '[data-v100-state="dialogue-right"]', ".v100-event-actions .v100-primary"] },
  "map-normal": { phases: ["map"], surfaces: ["campaign"], selectors: [".v100-map-layout", ".v100-map-hero", ".v100-route-label", ".v100-stage-list", ".v100-map-side", ".v100-map-actions"] },
  "map-locked-boss": { phases: ["map"], surfaces: ["campaign"], selectors: [".v100-map-layout", ".v100-route-label", ".v100-stage-list", ".v100-boss-callout", ".v100-map-side"] },
  formation: { phases: ["formation"], selectors: [".v100-formation-panel", ".v100-slot-track", ".v100-roster-card", ".v100-formation-footer .v100-primary"] },
  personnel: { phases: ["map"], surfaces: ["personnel"], selectors: ['main.v100-shell[data-v100-surface="personnel"]', ".v100-personnel-grid", ".v100-personnel-card", ".v100-management-panel"] },
  "support-vehicle-management": { phases: ["map"], surfaces: ["support-vehicle"], selectors: ['main.v100-shell[data-v100-surface="support-vehicle"]', ".v100-support-section", ".v100-support-management-card", ".v100-vehicle-section", ".v100-vehicle-stats"] },
  "battle-normal": { phases: ["battle"], selectors: ['.game-shell[data-screen="battle"]', ".game-shell[data-screen=\"battle\"] canvas", "button.unit-card[data-kind]"] },
  "battle-boss": { phases: ["battle"], selectors: ['.game-shell[data-screen="battle"]', ".game-shell[data-screen=\"battle\"] canvas", "button.unit-card[data-kind]"] },
  "result-win": { phases: ["result"], selectors: ['[data-v100-surface="result-win"]', ".v100-result-records", ".v100-result-rewards", ".v100-result-actions"] },
  "result-lose": { phases: ["result"], selectors: ['[data-v100-surface="result-lose"]', ".v100-result-records", ".v100-result-actions"] },
  ending: { phases: ["ending"], selectors: ['[data-v100-surface="ending"]', ".v100-event-panel", ".v100-story-node", ".v100-event-actions"] },
  credits: { phases: ["credits"], selectors: ['[data-v100-surface="credits"]', ".v100-event-panel", ".v100-story-node", ".v100-event-actions"] },
  "epilogue-postgame": { phases: ["epilogue"], selectors: ['[data-v100-surface="epilogue"]', ".v100-event-panel", ".v100-story-node", ".v100-event-actions"] },
  "data-management-modal": { phases: ["map"], surfaces: ["data"], selectors: ['[data-v100-surface="data"]', '[role="dialog"][aria-labelledby="v100-data-title"]', ".v100-data-actions"] },
  "battle-extra": { phases: ["battle"], selectors: ['.game-shell[data-screen="battle"]', ".game-shell[data-screen=\"battle\"] canvas", "button.unit-card[data-kind]"] },
});

async function productionStateContract(page, state) {
  const contract = stateContracts[state];
  invariant(contract, `missing Phase G state contract: ${state}`);
  const observed = await page.evaluate((expected) => {
    const visible = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const shell = document.querySelector(".v100-shell");
    const canvas = document.querySelector(".game-shell[data-screen=\"battle\"] canvas");
    let canvasAudit = null;
    if (canvas instanceof HTMLCanvasElement && canvas.width > 0 && canvas.height > 0) {
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (context) {
        const sample = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let sampled = 0;
        let visiblePixels = 0;
        let lumaTotal = 0;
        for (let index = 0; index < sample.length; index += 16) {
          const alpha = sample[index + 3] ?? 0;
          const luma = ((sample[index] ?? 0) * .2126) + ((sample[index + 1] ?? 0) * .7152) + ((sample[index + 2] ?? 0) * .0722);
          sampled += 1;
          if (alpha > 8 && luma > 4) visiblePixels += 1;
          lumaTotal += luma;
        }
        const mean = sampled ? lumaTotal / sampled : 0;
        let varianceTotal = 0;
        for (let index = 0; index < sample.length; index += 16) {
          const luma = ((sample[index] ?? 0) * .2126) + ((sample[index + 1] ?? 0) * .7152) + ((sample[index + 2] ?? 0) * .0722);
          varianceTotal += (luma - mean) ** 2;
        }
        canvasAudit = { width: canvas.width, height: canvas.height, sampled, visiblePixels, visibleRatio: sampled ? visiblePixels / sampled : 0, lumaMean: mean, lumaVariance: sampled ? varianceTotal / sampled : 0 };
      }
    }
    const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.() ?? null;
    const mount = window.__ASHFALL_ASSET_QA__?.getBattleMountState?.() ?? null;
    const buttons = [...document.querySelectorAll("button")].filter((button) => {
      const rect = button.getBoundingClientRect();
      const style = getComputedStyle(button);
      return style.display !== "none" && style.visibility !== "hidden" && !button.disabled && rect.width >= 28 && rect.height >= 24;
    }).length;
    return {
      phase: shell?.getAttribute("data-v100-phase") ?? null,
      surface: shell?.getAttribute("data-v100-surface") ?? null,
      selectorHits: Object.fromEntries(expected.selectors.map((selector) => [selector, visible(selector)])),
      buttonCount: buttons,
      bodyTextLength: document.body.innerText.trim().length,
      screen: snapshot?.screen ?? document.querySelector(".game-shell")?.getAttribute("data-screen") ?? null,
      battleMounted: mount?.battleMounted === true,
      canvas: canvasAudit,
      fighterKinds: Array.isArray(snapshot?.fighters) ? [...new Set(snapshot.fighters.map((fighter) => `${fighter.side}:${fighter.kind}`))] : [],
    };
  }, contract);
  const missingSelectors = contract.selectors.filter((selector) => observed.selectorHits?.[selector] !== true);
  const phaseOk = contract.phases.includes(observed.phase);
  const surfaceOk = !contract.surfaces || contract.surfaces.includes(observed.surface);
  const battleOk = !state.startsWith("battle") || (observed.screen === "battle" && observed.battleMounted === true && (observed.canvas?.visiblePixels ?? 0) > 0);
  return { ok: missingSelectors.length === 0 && phaseOk && surfaceOk && battleOk, expected: contract, observed, missingSelectors, phaseOk, surfaceOk, battleOk };
}

async function collectCombatCausalProof(page, { durationMs = 2_400 } = {}) {
  const samples = [];
  const startedAt = Date.now();
  while (Date.now() - startedAt < durationMs) {
    samples.push(await page.evaluate(() => {
      const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.() ?? null;
      const audio = window.__ASHFALL_AUDIO_QA__?.getCueRequests?.() ?? [];
      const observedCombatActivity = window.__PHASE_G_COMBAT_ACTIVITY__ ?? {};
      return {
        attackIdentity: (snapshot?.attackIdentity?.length ?? 0) > 0 ? snapshot.attackIdentity : observedCombatActivity.attackIdentity ?? [],
        pendingWeaponHits: (snapshot?.pendingWeaponHits?.length ?? 0) > 0 ? snapshot.pendingWeaponHits : observedCombatActivity.pendingWeaponHits ?? [],
        fighters: snapshot?.fighters?.map((fighter) => ({ id: fighter.id, side: fighter.side, kind: fighter.kind, targetId: fighter.targetId, flash: fighter.flash, knock: fighter.knock, attackWindup: fighter.attackWindup })) ?? [],
        shots: snapshot?.shots ?? [],
        damageTexts: snapshot?.damageTexts ?? [],
        battlePresentationEffects: (snapshot?.battlePresentation?.effects?.length ?? 0) > 0 ? snapshot.battlePresentation.effects : observedCombatActivity.battlePresentationEffects ?? [],
        audioCueRequests: audio,
      };
    }).catch(() => null));
    await page.waitForTimeout(120);
  }
  const valid = samples.filter(Boolean);
  const edges = new Set();
  const visualEvents = new Set();
  const reactionKeys = new Set();
  const audioCueIds = new Set();
  for (const sample of valid) {
    for (const attack of [...(sample.attackIdentity ?? []), ...(sample.pendingWeaponHits ?? [])]) {
      if (attack.sourceId !== undefined && attack.targetId !== undefined && attack.targetId !== null) edges.add(`${attack.sourceId}->${attack.targetId}`);
      if (attack.weapon || attack.effect) visualEvents.add(String(attack.weapon ?? attack.effect));
    }
    for (const effect of sample.battlePresentationEffects ?? []) visualEvents.add(String(effect.semantic ?? effect.kind ?? "presentation"));
    for (const fighter of sample.fighters ?? []) if (Number(fighter.flash) > 0 || Number(fighter.knock) > 0 || Number(fighter.attackWindup) > 0) reactionKeys.add(`${fighter.id}:${fighter.flash > 0 ? "flash" : "knock"}`);
    for (const text of sample.damageTexts ?? []) if (text?.value !== undefined) reactionKeys.add(`damage:${text.value}`);
    for (const request of sample.audioCueRequests ?? []) if (request?.cueId) audioCueIds.add(request.cueId);
  }
  const causalProof = {
    sampleCount: valid.length,
    sourceToTargetEdges: [...edges],
    visualEvents: [...visualEvents],
    reactionEvents: [...reactionKeys],
    audioCueIds: [...audioCueIds],
    stages: {
      source: edges.size > 0,
      travelOrContact: visualEvents.size > 0,
      targetReaction: reactionKeys.size > 0,
      audio: audioCueIds.size > 0,
    },
  };
  causalProof.ok = causalProof.sampleCount > 0 && causalProof.stages.source && causalProof.stages.travelOrContact && causalProof.stages.targetReaction && causalProof.stages.audio;
  return causalProof;
}

async function saveScreenshot(page, filePath, label) {
  await page.screenshot({ path: filePath, animations: "disabled" });
  const bytes = await readFile(filePath);
  const metadata = await stat(filePath);
  invariant(metadata.size > 1000 && bytes.slice(0, 8).toString("hex") === "89504e470d0a1a0a", `${label} is not a valid PNG`);
  return { path: relativeEvidence(filePath), sha256: createHash("sha256").update(bytes).digest("hex"), bytes: metadata.size };
}

async function captureStateImpl(engineName, viewport, state, configure) {
  const browser = await playwright[engineName].launch({ headless: true });
  const context = await browser.newContext({ viewport, hasTouch: viewport.safeArea, isMobile: viewport.safeArea });
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  const label = `${engineName}-${viewportLabel(viewport)}-${state}`;
  try {
    const captureMeta = await configure(page) ?? {};
    const productionContract = await productionStateContract(page, state);
    invariant(productionContract.ok, `${label} production state contract failed: ${JSON.stringify(productionContract)}`);
    const combatCausalProof = state.startsWith("battle") ? await collectCombatCausalProof(page) : null;
    if (state.startsWith("battle")) invariant(combatCausalProof?.ok === true, `${label} combat causal proof failed: ${JSON.stringify(combatCausalProof)}`);
    const screenshot = await saveScreenshot(page, imagePath(label), label);
    const overflow = await overflowAudit(page);
    const runtime = await page.evaluate(() => {
      const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
      if (!snapshot) return { screen: null };
      const observedCombatActivity = window.__PHASE_G_COMBAT_ACTIVITY__ ?? {};
      return {
        screen: snapshot.screen,
        stageId: snapshot.stageId,
        fighters: snapshot.fighters?.map((fighter) => ({ side: fighter.side, kind: fighter.kind, hp: fighter.hp, attack: fighter.attack, attackWindup: fighter.attackWindup, targetId: fighter.targetId, x: fighter.x, y: fighter.y, combatReady: fighter.combatReady })) ?? [],
        attackIdentity: (snapshot.attackIdentity?.length ?? 0) > 0 ? snapshot.attackIdentity : observedCombatActivity.attackIdentity ?? [],
        pendingWeaponHits: (snapshot.pendingWeaponHits?.length ?? 0) > 0 ? snapshot.pendingWeaponHits : observedCombatActivity.pendingWeaponHits ?? [],
        battlePresentationEffects: (snapshot.battlePresentation?.effects?.length ?? 0) > 0 ? snapshot.battlePresentation.effects : observedCombatActivity.battlePresentationEffects ?? [],
        shots: snapshot.shots?.map((shot) => ({ sourceId: shot.sourceId, targetId: shot.targetId, weapon: shot.weapon, effect: shot.effect, x: shot.x, y: shot.y, tx: shot.tx, ty: shot.ty, life: shot.life })) ?? [],
        damageTexts: snapshot.damageTexts?.map((entry) => ({ value: entry.value, x: entry.x, y: entry.y, life: entry.life })) ?? [],
        audioCueRequests: window.__ASHFALL_AUDIO_QA__?.getCueRequests?.() ?? [],
        crawlerAbility: snapshot.crawlerAbility ?? null,
        missionObjects: snapshot.battlefieldObjects ?? [],
      };
    });
    invariant(overflow.every(({ delta }) => delta <= 1), `${label} horizontal overflow: ${JSON.stringify(overflow)}`);
    invariant(await page.locator("body").evaluate((body) => body.innerText.trim().length > 0), `${label} blank body`);
    invariant(diagnostics.consoleErrors.length === 0, `${label} console errors: ${JSON.stringify(diagnostics.consoleErrors)}`);
    invariant(diagnostics.pageErrors.length === 0, `${label} page errors: ${JSON.stringify(diagnostics.pageErrors)}`);
    invariant(diagnostics.httpFailures.length === 0, `${label} HTTP failures: ${JSON.stringify(diagnostics.httpFailures)}`);
    invariant(diagnostics.requestFailures.length === 0, `${label} request failures: ${JSON.stringify(diagnostics.requestFailures)}`);
    results.push({ engine: engineName, viewport: viewportLabel(viewport), state, variant: captureMeta.variant ?? state, capturedAt: new Date().toISOString(), pwaOfferShown: await page.evaluate(() => document.documentElement.dataset.phaseGPwaOffer === "shown"), evidence: screenshot, diagnostics, overflow, productionContract, combatCausalProof, runtime, ...captureMeta });
    return screenshot;
  } catch (error) {
    const failureState = await page.evaluate(() => ({
      url: location.href,
      phase: document.querySelector(".v100-shell")?.getAttribute("data-v100-phase") ?? null,
      surface: document.querySelector(".v100-shell")?.getAttribute("data-v100-surface") ?? null,
      body: document.body.innerText.slice(0, 1600),
    })).catch(() => null);
    throw new Error(`${label} failed: ${String(error)} state=${JSON.stringify(failureState)} diagnostics=${JSON.stringify(diagnostics)}`);
  } finally {
    await context.close();
    await browser.close();
  }
}

function isTransientBrowserClosure(error) {
  return /target page, context or browser has been closed/i.test(String(error));
}

function isRetryableCaptureFailure(error) {
  const message = String(error);
  return isTransientBrowserClosure(error)
    || /combat activity did not become visible: TimeoutError: page\.waitForFunction: Timeout 45000ms exceeded/i.test(message);
}

async function captureState(engineName, viewport, state, configure) {
  if (onlyState && state !== onlyState) return null;
  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await captureStateImpl(engineName, viewport, state, configure);
    } catch (error) {
      lastError = error;
      if (attempt === 2 || !isRetryableCaptureFailure(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw lastError;
}

async function writePhaseGManifest(report) {
  const entries = report.results.map((result) => {
    const [width, height] = result.viewport.split("x").map(Number);
    const battle = result.state.startsWith("battle");
    return {
      id: `${result.category ?? (battle ? "battle-extra" : "core")}-${result.engine}-${result.viewport}-${result.state}`,
      category: result.state === "battle-extra" ? "battle-extra" : "core",
      state: result.state,
      variant: result.variant,
      engine: result.engine,
      viewport: result.viewport,
      capturedAt: result.capturedAt,
      stageId: result.stageId ?? result.runtime?.stageId ?? null,
      stageName: result.stageName ?? null,
      visibleActors: [...new Set((result.runtime?.fighters ?? []).filter((fighter) => fighter.hp > 0).map((fighter) => `${fighter.side}:${fighter.kind}`))],
      expectedEnemyKinds: result.expectedEnemyKinds ?? [],
      observedEnemyKinds: result.observedEnemyKinds ?? [...new Set((result.runtime?.fighters ?? []).filter((fighter) => fighter.side === "zombie").map((fighter) => fighter.kind))],
      missionType: result.missionType ?? null,
      support: result.runtime?.battlefieldObjects?.filter((object) => String(object.kind ?? "").includes("support")) ?? [],
      vehicle: result.runtime?.crawlerAbility ?? null,
      evidence: result.evidence.path,
      dimensions: { width, height },
      sha256: result.evidence.sha256,
      diagnostics: result.diagnostics,
      overflow: result.overflow,
      productionContract: {
        ok: result.productionContract?.ok === true,
        selectors: result.productionContract?.expected?.selectors ?? [],
        observed: result.productionContract?.observed ?? null,
      },
    };
  });
  const resultByVariant = new Map(report.results.map((result) => [result.variant, result]));
  const combatEvidence = [];
  const combatDir = path.join(evidenceDir, "combat");
  await mkdir(combatDir, { recursive: true });
  for (const contract of V100_REPRESENTATIVE_COMBAT_CONTRACT) {
    const result = resultByVariant.get(contract.captureVariant);
    invariant(result, `${contract.id} has no production capture for ${contract.captureVariant}`);
    const runtimeEvidencePath = path.join(combatDir, `${contract.id}.json`);
    const runtimeEvidence = {
      schemaVersion: 1,
      id: contract.id,
      actor: contract.actor,
      action: contract.action,
      source: contract.source,
      contactImpact: contract.contactImpact,
      reaction: contract.reaction,
      seVfx: contract.seVfx,
      state: contract.state,
      captureVariant: contract.captureVariant,
      runtimeActor: contract.runtimeActor,
      stageId: result.stageId ?? result.runtime?.stageId ?? null,
      stageName: result.stageName ?? null,
      engine: result.engine,
      viewport: result.viewport,
      capturedAt: result.capturedAt,
      checkpoints: contract.runtimeSequence,
      runtime: result.runtime,
      combatCausalProof: result.combatCausalProof,
      productionContract: result.productionContract,
      diagnostics: result.diagnostics,
    };
    await writeFile(runtimeEvidencePath, `${JSON.stringify(runtimeEvidence, null, 2)}\n`);
    combatEvidence.push({
      ...contract,
      evidence: result.evidence.path,
      runtimeEvidence: relativeEvidence(runtimeEvidencePath),
      stageId: runtimeEvidence.stageId,
      engine: result.engine,
      viewport: result.viewport,
      timestamp: result.capturedAt,
      diagnostics: result.diagnostics,
    });
  }
  const runtimeEnemyShards = validateProductionEnemyRuntimeShards();
  const expectedEnemyCoverage = deriveV100ProductionEnemyCoverage();
  const observedBattleKinds = [...new Set(report.results.flatMap((result) => result.observedEnemyKinds ?? result.runtime?.fighters?.filter((fighter) => fighter.side === "zombie").map((fighter) => fighter.kind) ?? []))];
  const manifest = {
    schemaVersion: 3,
    runtimeContractVersion: 2,
    route: report.route,
    totalScreenshots: entries.length,
    coreStateCount: 16,
    combatEvidenceCount: combatEvidence.length,
    requiredEngines: ["chromium", "webkit"],
    requiredCoreViewports: requiredViewports.map(viewportLabel),
    additionalBattleViewports: extraBattleViewports.map(viewportLabel),
    requiredCoreStates: coreStates,
    entries,
    combatEvidence,
    enemyRuntimeCoverage: {
      source: expectedEnemyCoverage.source,
      expectedCount: expectedEnemyCoverage.expectedCount,
      requiredEnemyKinds: expectedEnemyCoverage.requiredEnemyKinds,
      requiredBossKinds: expectedEnemyCoverage.requiredBossKinds,
      observedBattleKinds,
      missingObservedKinds: expectedEnemyCoverage.requiredEnemyKinds.filter((kind) => !observedBattleKinds.includes(kind)),
      runtimeSpriteStateMissing: expectedEnemyCoverage.spriteRequirements.filter((requirement) => requirement.error || requirement.states.length === 0).map(({ kind, error }) => ({ kind, error })),
      unknownReachableKinds: expectedEnemyCoverage.unknownReachableKinds,
      missingBossKinds: expectedEnemyCoverage.missingBossKinds,
      unreachableRegisteredKinds: expectedEnemyCoverage.unreachableRegisteredKinds,
      shardCount: runtimeEnemyShards.shardCount,
      shards: runtimeEnemyShards.shards,
      shardContractValid: runtimeEnemyShards.valid,
    },
  };
  const manifestPath = path.resolve("docs/qa/v100/phase-g-screenshot-manifest.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { manifest, manifestPath, combatEvidenceDir: combatDir };
}

async function freshNamePage(page) {
  await openRoute(page);
  await page.locator("#v100-name-title").waitFor({ state: "visible", timeout });
}

async function storyPage(page, targetState) {
  await freshNamePage(page);
  await page.locator("#v100-player-name").fill("QAプレイヤー");
  await click(page, page.locator(".v100-name-card .v100-primary"), "start V1 campaign");
  for (let index = 0; index < 20; index += 1) {
    if (await visible(page, `[data-v100-state="${targetState === "dialogue-left" ? "dialogue-left" : "dialogue-right"}"]`)) return;
    await click(page, page.locator(".v100-event-actions .v100-primary"), "dialogue advance");
  }
  throw new Error(`${targetState} dialogue was not reachable`);
}

async function mapPage(page, save) {
  await openRoute(page, save);
  await page.locator(".v100-map-layout").waitFor({ state: "visible", timeout });
}

async function formationPage(page, save, stageName = null) {
  await mapPage(page, save);
  if (stageName) {
    const stage = V100_STAGES.find((entry) => entry.displayName === stageName);
    invariant(stage, `unknown stage in Phase G contract: ${stageName}`);
    const chapter = stage.number <= 6 ? "第一章" : stage.number <= 12 ? "第二章" : stage.number <= 20 ? "第三章" : stage.number <= 25 ? "第四章" : stage.number <= 29 ? "第五章" : "最終章";
    const chapterButton = page.getByRole("button", { name: new RegExp(`^${chapter}(?:\\s|$)`, "u") }).first();
    await click(page, chapterButton, `${chapter} chapter tab`);
    await click(page, page.locator(".v100-stage-list button").filter({ hasText: stageName }).first(), "stage selection");
    await page.waitForTimeout(50);
  }
  const cta = page.getByRole("button", { name: /この作戦を編成|再出撃/u }).first();
  await click(page, cta, "map formation CTA");
  await advanceStory(page, ".v100-formation-panel");
}

async function battlePage(page, save, stageName = null, { bossKind = null } = {}) {
  await formationPage(page, save, stageName);
  await click(page, page.locator(".v100-roster-card").first(), "formation roster card");
  await click(page, page.getByRole("button", { name: "戦闘へ", exact: true }), "formation battle CTA");
  await waitBattle(page);
  const unitCards = page.locator("button.unit-card[data-kind]");
  let sustainActive = Boolean(bossKind);
  const sustainDone = bossKind ? (async () => {
    // These are ordinary player-facing controls.  The loop keeps the
    // evidence run alive long enough to reach the authored boss wave without
    // mutating HP, clocks, enemy state, or battle definitions.
    while (sustainActive) {
      const battleVisible = await page.locator('.game-shell[data-screen="battle"]').isVisible().catch(() => false);
      if (!battleVisible) break;

      const abilityButtons = page.locator('button.manual-ability-ready.available:not([disabled])');
      const abilityCount = await abilityButtons.count().catch(() => 0);
      for (let index = 0; index < Math.min(abilityCount, 4); index += 1) {
        await abilityButtons.nth(index).click({ timeout: 500 }).catch(() => {});
        await page.waitForTimeout(85);
      }

      const crawler = page.locator('button.support-btn.barrage[data-state="ready"][aria-disabled="false"]').first();
      if (await crawler.count().catch(() => 0)) {
        await crawler.click({ timeout: 500 }).catch(() => {});
      }

      const canvas = page.locator("canvas.battlefield");
      const box = await canvas.boundingBox().catch(() => null);
      if (box) {
        const target = { x: box.width * .67, y: box.height * .5 };
        const airstrike = page.locator('button.support-btn.airstrike[data-state="ready"][aria-disabled="false"]').first();
        if (await airstrike.count().catch(() => 0)) {
          await airstrike.click({ timeout: 500 }).catch(() => {});
          await canvas.click({ position: target, timeout: 700 }).catch(() => {});
        }
        const medical = page.locator('button.support-btn.medical[data-state="ready"][aria-disabled="false"]').first();
        if (await medical.count().catch(() => 0)) {
          await medical.click({ timeout: 500 }).catch(() => {});
          await canvas.click({ position: { x: box.width * .34, y: box.height * .5 }, timeout: 700 }).catch(() => {});
        }
      }
      await page.waitForTimeout(520);
    }
  })() : null;
  // Keep the fixture player-like while ensuring the early wave reaches an
  // authored attack/contact state on WebKit as well as Chromium.
  const deployIndexes = bossKind ? [0, 1, 2, 3, 4, 5, 6] : [0, 2, 4];
  try {
    for (const index of deployIndexes) {
      const card = unitCards.nth(index);
      if (!bossKind) {
        await click(page, card, `deploy battle unit ${index + 1}`);
        await page.waitForTimeout(120);
        continue;
      }
      let deployed = false;
      for (let attempt = 0; attempt < 180; attempt += 1) {
        const battleVisible = await page.locator('.game-shell[data-screen="battle"]').isVisible().catch(() => false);
        if (!battleVisible) break;
        if (await card.getAttribute("data-state") === "ready") {
          await click(page, card, `deploy battle unit ${index + 1}`);
          await page.waitForTimeout(140);
          if (await card.getAttribute("data-state") !== "ready") {
            deployed = true;
            break;
          }
        }
        await page.waitForTimeout(400);
      }
      invariant(deployed, `battle unit ${index + 1} never entered cooldown from the ready state`);
    }
    await page.waitForFunction(() => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().fighters?.some((fighter) => fighter.side === "human" && fighter.hp > 0) === true, null, { timeout: battleTimeout });
    if (!bossKind) {
      await waitForCombatActivity(page);
    } else {
      // Boss fixtures are intentionally hostile enough to defeat a passive
      // fixture before wave 4. Keep the evidence path player-like: use the
      // real ready cards as they recover instead of mutating runtime HP.
      await waitForCombatActivity(page, { bossKind });
    }
  } finally {
    sustainActive = false;
    await sustainDone;
  }
  const runtime = await page.evaluate(() => {
    const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
    return {
      stageId: snapshot?.stageId ?? null,
      enemyKinds: [...new Set((snapshot?.fighters ?? []).filter((fighter) => fighter.side === "zombie").map((fighter) => fighter.kind))],
      fighterKinds: [...new Set((snapshot?.fighters ?? []).map((fighter) => `${fighter.side}:${fighter.kind}`))],
    };
  });
  const stageId = runtime.stageId ?? V100_STAGES.find((entry) => entry.displayName === stageName)?.id ?? V100_STAGE_IDS[0];
  const definition = v100BattleDefinitionFor(stageId);
  return {
    variant: stageName ? `stage-${V100_STAGES.find((entry) => entry.id === stageId)?.number ?? "unknown"}` : "battle-runtime",
    stageId,
    stageName: V100_STAGES.find((entry) => entry.id === stageId)?.displayName ?? stageName,
    bossKind,
    expectedEnemyKinds: [...new Set(definition?.timeline?.flatMap((wave) => wave.units) ?? [])],
    observedEnemyKinds: runtime.enemyKinds,
    fighterKinds: runtime.fighterKinds,
  };
}

for (const viewport of requiredViewports) {
  await captureState("chromium", viewport, "title-name", async (page) => freshNamePage(page));
  await captureState("chromium", viewport, "dialogue-left", async (page) => storyPage(page, "dialogue-left"));
  await captureState("chromium", viewport, "dialogue-right", async (page) => storyPage(page, "dialogue-right"));
  await captureState("chromium", viewport, "map-normal", async (page) => mapPage(page, fullSave()));
  await captureState("chromium", viewport, "map-locked-boss", async (page) => {
    await mapPage(page, fullSave({ availableStageIds: [V100_STAGE_IDS[0]] }));
    await click(page, page.getByRole("button", { name: /最終章/u }), "final chapter tab");
    await click(page, page.getByRole("button", { name: /TAKUYA-Ω/u }), "locked boss node");
    await page.locator(".v100-boss-callout").waitFor({ state: "visible", timeout });
  });
  await captureState("chromium", viewport, "formation", async (page) => formationPage(page, fullSave()));
  await captureState("chromium", viewport, "personnel", async (page) => {
    await mapPage(page, fullSave());
    await click(page, page.getByRole("button", { name: /隊員を編成/u }), "personnel formation");
    await page.locator('main.v100-shell[data-v100-surface="personnel"]').waitFor({ state: "visible", timeout });
  });
  await captureState("chromium", viewport, "support-vehicle-management", async (page) => {
    await mapPage(page, fullSave());
    await click(page, page.getByRole("button", { name: /出撃装備を選ぶ/u }), "sortie loadout");
    await page.locator('main.v100-shell[data-v100-surface="support-vehicle"]').waitFor({ state: "visible", timeout });
  });
  await captureState("chromium", viewport, "battle-normal", async (page) => ({ ...(await battlePage(page, fullSave())), variant: "core-battle-normal" }));
  await captureState("chromium", viewport, "battle-boss", async (page) => ({ ...(await battlePage(page, fullSave({ availableStageIds: V100_STAGE_IDS, completedStageIds: V100_STAGE_IDS.slice(0, 29) }), V100_STAGES[29].displayName, { bossKind: "takuya-omega" })), variant: "core-battle-boss" }));
  await captureState("chromium", viewport, "result-win", async (page) => { await openRoute(page, resultSave(true)); await page.locator('[data-v100-surface="result-win"]').waitFor({ state: "visible", timeout }); });
  await captureState("chromium", viewport, "result-lose", async (page) => { await openRoute(page, resultSave(false)); await page.locator('[data-v100-surface="result-lose"]').waitFor({ state: "visible", timeout }); });
  await captureState("chromium", viewport, "ending", async (page) => { await openRoute(page, eventSave("ending", "v100:event:ending")); await page.locator('[data-v100-surface="ending"]').waitFor({ state: "visible", timeout }); });
  await captureState("chromium", viewport, "credits", async (page) => { await openRoute(page, eventSave("credits", "v100:event:credits")); await page.locator('[data-v100-surface="credits"]').waitFor({ state: "visible", timeout }); });
  await captureState("chromium", viewport, "epilogue-postgame", async (page) => { await openRoute(page, eventSave("epilogue", "v100:event:epilogue")); await page.locator('[data-v100-surface="epilogue"]').waitFor({ state: "visible", timeout }); });
  await captureState("chromium", viewport, "data-management-modal", async (page) => {
    await mapPage(page, fullSave());
    await click(page, page.getByLabel("作戦地図").getByRole("button", { name: "データ管理", exact: true }), "data management");
    await page.getByRole("dialog", { name: "データ管理" }).waitFor({ state: "visible", timeout });
  });
}

for (const contract of extraBattleContracts) {
  if (onlyVariant && contract.variant !== onlyVariant) continue;
  await captureState(contract.engine, contract.viewport, "battle-extra", async (page) => ({
    stageId: contract.stageId,
    stageNumber: contract.stageNumber,
    stageName: contract.stageName,
    expectedEnemyKinds: [...new Set(v100BattleDefinitionFor(contract.stageId)?.timeline?.flatMap((wave) => wave.units) ?? [])],
    ...await battlePage(page, fullSave({ availableStageIds: V100_STAGE_IDS, completedStageIds: V100_STAGE_IDS.slice(0, contract.stageNumber - 1), formationUnitIds: contract.formationUnitIds }), contract.stageName, { bossKind: contract.bossKind }),
    variant: contract.variant,
  }));
}

const report = {
  generatedAt: new Date().toISOString(),
  build: await productionBuildIdentity(),
  route: "/Zombieee/v100",
  requiredCoreStates: coreStates,
  requiredCoreViewports: requiredViewports.map(viewportLabel),
  additionalBattleViewports: extraBattleViewports.map(viewportLabel),
  pwaOfferShownCount: results.filter(({ pwaOfferShown }) => pwaOfferShown).length,
  results,
};
const reportPath = path.join(evidenceDir, "phase-g-report.json");
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
const materialized = onlyState || onlyVariant ? null : await writePhaseGManifest(report);
const expectedCount = onlyState || onlyVariant ? results.length : 54;
invariant(results.length === expectedCount, `Phase G capture count ${results.length} !== ${expectedCount}`);
invariant(new Set(results.map(({ evidence }) => evidence.path)).size === results.length, "Phase G evidence paths are not unique");
invariant(new Set(results.map(({ evidence }) => evidence.sha256)).size === results.length, "Phase G screenshot content hashes are not unique");
console.log(JSON.stringify({ status: "passed", screenshots: results.length, uniquePaths: new Set(results.map(({ evidence }) => evidence.path)).size, uniqueHashes: new Set(results.map(({ evidence }) => evidence.sha256)).size, report: relativeEvidence(reportPath), manifest: materialized ? relativeEvidence(materialized.manifestPath) : null, combatEvidence: V100_REPRESENTATIVE_COMBAT_CONTRACT.length, onlyState: onlyState || null, onlyVariant: onlyVariant || null }, null, 2));
