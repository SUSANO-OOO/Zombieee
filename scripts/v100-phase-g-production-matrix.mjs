import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";
import { createDefaultV100Save, normalizeV100Save, serializeV100Save } from "../app/v100Save.js";
import { V100_STAGE_IDS, V100_SUPPORTS, V100_UNITS } from "../app/v100Registry.js";

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
const coreStates = [
  "title-name", "dialogue-left", "dialogue-right", "map-normal", "map-locked-boss", "formation", "personnel", "support-vehicle-management",
  "battle-normal", "battle-boss", "result-win", "result-lose", "ending", "credits", "epilogue-postgame", "data-management-modal",
];
const onlyState = process.env.V100_PHASE_G_ONLY ?? "";
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

function fullSave({ availableStageIds = [V100_STAGE_IDS[0]], completedStageIds = [], flowState = null, pendingResult = null } = {}) {
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
    formationSlots: V100_UNITS.slice(0, 7).map((unit) => unit.id),
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
    await configure(page);
    const screenshot = await saveScreenshot(page, imagePath(label), label);
    const overflow = await overflowAudit(page);
    const runtime = await page.evaluate(() => {
      const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
      if (!snapshot) return null;
      const observedCombatActivity = window.__PHASE_G_COMBAT_ACTIVITY__ ?? {};
      return {
        screen: snapshot.screen,
        stageId: snapshot.stageId,
        fighters: snapshot.fighters?.map((fighter) => ({ side: fighter.side, kind: fighter.kind, hp: fighter.hp, attack: fighter.attack, attackWindup: fighter.attackWindup, targetId: fighter.targetId, x: fighter.x, y: fighter.y, combatReady: fighter.combatReady })) ?? [],
        attackIdentity: (snapshot.attackIdentity?.length ?? 0) > 0 ? snapshot.attackIdentity : observedCombatActivity.attackIdentity ?? [],
        pendingWeaponHits: (snapshot.pendingWeaponHits?.length ?? 0) > 0 ? snapshot.pendingWeaponHits : observedCombatActivity.pendingWeaponHits ?? [],
        battlePresentationEffects: (snapshot.battlePresentation?.effects?.length ?? 0) > 0 ? snapshot.battlePresentation.effects : observedCombatActivity.battlePresentationEffects ?? [],
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
    results.push({ engine: engineName, viewport: viewportLabel(viewport), state, pwaOfferShown: await page.evaluate(() => document.documentElement.dataset.phaseGPwaOffer === "shown"), evidence: screenshot, diagnostics, overflow, runtime });
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

async function captureState(engineName, viewport, state, configure) {
  if (onlyState && state !== onlyState) return null;
  return captureStateImpl(engineName, viewport, state, configure);
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
    const finalChapter = page.getByRole("button", { name: /最終章/u });
    if (await finalChapter.isVisible().catch(() => false)) await click(page, finalChapter, "final chapter tab");
    await click(page, page.getByRole("button", { name: new RegExp(stageName, "u") }), "stage selection");
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
  const deployIndexes = bossKind ? [0, 3, 5] : [0];
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
    return;
  }
  // Stage 30 is intentionally hostile enough to defeat a passive fixture
  // before wave 4. Keep the evidence path player-like: use the real ready
  // cards as they recover instead of injecting a boss or mutating runtime HP.
  let sustainActive = true;
  const sustainDone = (async () => {
    while (sustainActive) {
      const battleVisible = await page.locator('.game-shell[data-screen="battle"]').isVisible().catch(() => false);
      if (!battleVisible) break;
      const readyCards = page.locator('button.unit-card[data-kind][data-state="ready"]');
      const readyCount = await readyCards.count().catch(() => 0);
      for (let index = 0; index < Math.min(readyCount, 3); index += 1) {
        await readyCards.first().click({ timeout: 500 }).catch(() => {});
        await page.waitForTimeout(120);
      }
      await page.waitForTimeout(900);
    }
  })();
  try {
    await waitForCombatActivity(page, { bossKind });
  } finally {
    sustainActive = false;
    await sustainDone;
  }
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
    await click(page, page.getByRole("button", { name: /人員管理/u }), "personnel management");
    await page.locator('main.v100-shell[data-v100-surface="personnel"]').waitFor({ state: "visible", timeout });
  });
  await captureState("chromium", viewport, "support-vehicle-management", async (page) => {
    await mapPage(page, fullSave());
    await click(page, page.getByRole("button", { name: /支援・車両管理/u }), "support vehicle management");
    await page.locator('main.v100-shell[data-v100-surface="support-vehicle"]').waitFor({ state: "visible", timeout });
  });
  await captureState("chromium", viewport, "battle-normal", async (page) => battlePage(page, fullSave()));
  await captureState("chromium", viewport, "battle-boss", async (page) => battlePage(page, fullSave({ availableStageIds: V100_STAGE_IDS, completedStageIds: V100_STAGE_IDS.slice(0, 29) }), "TAKUYA-Ω", { bossKind: "takuya-omega" }));
  await captureState("chromium", viewport, "result-win", async (page) => { await openRoute(page, resultSave(true)); await page.locator('[data-v100-surface="result-win"]').waitFor({ state: "visible", timeout }); });
  await captureState("chromium", viewport, "result-lose", async (page) => { await openRoute(page, resultSave(false)); await page.locator('[data-v100-surface="result-lose"]').waitFor({ state: "visible", timeout }); });
  await captureState("chromium", viewport, "ending", async (page) => { await openRoute(page, eventSave("ending", "v100:event:ending")); await page.locator('[data-v100-surface="ending"]').waitFor({ state: "visible", timeout }); });
  await captureState("chromium", viewport, "credits", async (page) => { await openRoute(page, eventSave("credits", "v100:event:credits")); await page.locator('[data-v100-surface="credits"]').waitFor({ state: "visible", timeout }); });
  await captureState("chromium", viewport, "epilogue-postgame", async (page) => { await openRoute(page, eventSave("epilogue", "v100:event:epilogue")); await page.locator('[data-v100-surface="epilogue"]').waitFor({ state: "visible", timeout }); });
  await captureState("chromium", viewport, "data-management-modal", async (page) => {
    await mapPage(page, fullSave());
    await click(page, page.getByRole("button", { name: "データ管理", exact: true }), "data management");
    await page.getByRole("dialog", { name: "データ管理" }).waitFor({ state: "visible", timeout });
  });
}

for (const engineName of ["chromium", "webkit"]) {
  for (const viewport of extraBattleViewports) {
    await captureState(engineName, viewport, "battle-extra", async (page) => battlePage(page, fullSave()));
  }
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
const expectedCount = onlyState ? results.length : 54;
invariant(results.length === expectedCount, `Phase G capture count ${results.length} !== ${expectedCount}`);
invariant(new Set(results.map(({ evidence }) => evidence.path)).size === results.length, "Phase G evidence paths are not unique");
invariant(new Set(results.map(({ evidence }) => evidence.sha256)).size === results.length, "Phase G screenshot content hashes are not unique");
console.log(JSON.stringify({ status: "passed", screenshots: results.length, uniquePaths: new Set(results.map(({ evidence }) => evidence.path)).size, uniqueHashes: new Set(results.map(({ evidence }) => evidence.sha256)).size, report: relativeEvidence(reportPath), onlyState: onlyState || null }, null, 2));
