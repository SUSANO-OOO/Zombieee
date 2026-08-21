import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";
import { createDefaultV100Save, normalizeV100Save, serializeV100Save } from "../app/v100Save.js";
import { V100_STAGE_IDS, V100_STAGES, V100_SUPPORTS, V100_UNITS } from "../app/v100Registry.js";
import { v100BattleDefinitionFor } from "../app/v100BattleAdapter.js";
import { v100EventPresentationFor } from "../app/v100EventPresentation.js";
import { V100_STORY_EVENTS } from "../app/v100StoryEvents.js";
import { enemyAiProfileFor } from "../app/combatAiProfiles.js";
import { enemyContentFor } from "../app/content/enemyCatalog.js";
import { unitContentFor } from "../app/content/unitCatalog.js";
import { deriveV100ProductionEnemyCoverage, V100_REPRESENTATIVE_COMBAT_CONTRACT } from "../app/v100PhaseGContract.js";
import { V100_COMBAT_FX_INVENTORY } from "../app/v100CombatPresentation.js";
import { validateProductionEnemyRuntimeShards } from "./v0995-enemy-runtime-shards.mjs";

const baseUrl = new URL(process.env.V100_CAMPAIGN_QA_BASE_URL ?? "http://127.0.0.1:4177/");
if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname)) throw new Error(`V1 matrix is local-only; refusing ${baseUrl}`);
const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href)
  : await import("playwright");
const evidenceDir = path.resolve(process.env.V100_PHASE_G_EVIDENCE_DIR ?? "outputs/v100-phase-g");
const timeout = Math.max(20_000, Number(process.env.V100_PHASE_G_TIMEOUT_MS) || 60_000);
const battleTimeout = Math.max(60_000, Number(process.env.V100_PHASE_G_BATTLE_TIMEOUT_MS) || 150_000);
const combatProofDurationMs = Math.max(2_400, Number(process.env.V100_PHASE_G_COMBAT_PROOF_MS) || 12_000);
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
const MAXED_QA_UNIT_LEVELS = Object.freeze(Object.fromEntries(
  V100_UNITS.map((unit) => [unit.id, 30]),
));
const extraBattleContracts = Object.freeze([
  // Keep the first deployed responder light enough for the canonical walker
  // to complete its own attack lifecycle before the later boss support loop
  // opens the full formation. This is a player-facing card order, not a
  // runtime mutation or a synthetic enemy fixture.
  { variant: "stage03-takuya", engine: "chromium", viewport: extraBattleViewports[0], stageNumber: 3, bossKind: "takuya", proofActor: "walker", proofUnitKind: "brute", requireVehicleAction: true, keepHumanTargetAlive: true, formationUnitIds: ["unit-nao", "unit-tatara", "unit-hachi", "unit-monkey", "unit-mizuchi", "unit-paisen", "unit-kumaverson"] },
  { variant: "stage04-grappler", engine: "chromium", viewport: extraBattleViewports[1], stageNumber: 4, bossKind: null, formationUnitIds: ["unit-tatara", "unit-mizuchi", "unit-hachi", "unit-paisen", "unit-kumaverson", "unit-babayaga", "unit-nao"] },
  { variant: "stage21-panther-knife", engine: "chromium", viewport: extraBattleViewports[2], stageNumber: 21, bossKind: null, proofActor: "red-panther-smg", proofUnitKind: "babayaga", proofUnitFirst: false, manualAbilityKind: "babayaga", formationUnitIds: ["unit-tatara", "unit-mizuchi", "unit-hachi", "unit-paisen", "unit-kumaverson", "unit-babayaga", "unit-nao"] },
  // Keep the three deployed slots combat-active on the compact WebKit proof:
  // a ranged card and a support card make the authored hit/impact sequence
  // visible without changing the stage, roster, or production battle rules.
  { variant: "stage06-spitter-seal", engine: "webkit", viewport: extraBattleViewports[0], stageNumber: 6, bossKind: null, proofActor: "spitter", proofUnitKind: "ranger", proofUnitFirst: true, formationUnitIds: ["unit-hachi", "unit-mizuchi", "unit-babayaga", "unit-paisen", "unit-nao", "unit-kumaverson", "unit-tatara"] },
  // The compact WebKit boss route establishes an opening frontline with the
  // first three currently ready cards, then continues real redeploy actions
  // as cards recover. It does not force a fixed DOM index or mutate battle
  // state; the boss gate and combat proof remain fully production-owned.
  { variant: "stage24-panther-commander", engine: "webkit", viewport: extraBattleViewports[1], stageNumber: 24, bossKind: "futago", proofActor: "red-panther-commander", waitForBossAttack: false, combatProofDurationMs: 4_800, unitLevels: MAXED_QA_UNIT_LEVELS, formationUnitIds: ["unit-nao", "unit-hachi", "unit-mizuchi", "unit-paisen", "unit-babayaga", "unit-kumaverson", "unit-tatara"] },
  // Start every boss fixture with the same low-cost opening a player can use
  // to establish a frontline before the expensive cards recover. The
  // interaction below selects the first currently ready cards, so the
  // compact WebKit proof does not depend on a fixed card index.
  // The formation still contains seven canonical V1 units; this is a QA
  // interaction plan, not a gameplay or balance change.
  { variant: "stage25-president", engine: "webkit", viewport: extraBattleViewports[2], stageNumber: 25, bossKind: "mugarian-president-mutated", proofActor: "red-panther-shield", formationUnitIds: ["unit-gantetsu", "unit-nao", "unit-kumaverson", "unit-paisen", "unit-babayaga", "unit-mizuchi", "unit-tatara"], unitLevels: MAXED_QA_UNIT_LEVELS },
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
const onlyEngine = process.env.V100_PHASE_G_ONLY_ENGINE ?? "";
const sequenceId = process.env.V100_PHASE_G_SEQUENCE_ID ?? null;
const storageKeys = ["nishijin-campaign-v100", "nishijin-campaign-v100:mirror", "nishijin-campaign-v100:last-known-good", "nishijin-campaign-v100:owner"];
const results = [];
const phaseGBrowsers = new Map();
const phaseGCheckpointRecorders = new Set();
const pageCheckpointRecorders = new WeakMap();

const BATTLE_EXTRA_CHECKPOINTS = Object.freeze([
  "route-opened",
  "formation-visible",
  "battle-mounted-lifecycle-active",
  "combat-observer-started",
  "contract-identified",
  "deployment-attempts-recorded",
  "proof-actor-mounted-or-absent",
  "living-human-target-acquired-or-not-required",
  "proof-actor-attack-observed-or-not-required",
  "proof-unit-deployed-and-attacked-or-not-required",
  "frontline-deployment-sequence-completed",
  "manual-vehicle-action-observed-or-not-required",
  "causal-proof-complete",
  "screenshot-saved",
]);
const RESOLVED_CHECKPOINT_STATUSES = new Set(["completed", "observed", "not-required", "absent"]);

function checkpointRecorderFor(page) {
  return pageCheckpointRecorders.get(page) ?? null;
}

function createBattleExtraCheckpointRecorder({ contract, engineName, viewport, context, page, browser }) {
  const startedAt = Date.now();
  const checkpointLog = [];
  const checkpointState = new Map();
  const eventLog = [];
  const lifecycle = [];
  const deploymentAttempts = [];
  let awaiting = null;
  let latestReadableState = null;
  let failureFilePath = null;
  let failureScreenshotPath = null;
  let failurePayload = null;

  const append = (kind, details = {}) => {
    const entry = {
      sequence: eventLog.length + 1,
      kind,
      elapsedMs: Date.now() - startedAt,
      ...details,
    };
    eventLog.push(entry);
    return entry;
  };

  const mark = (name, status = "completed", details = {}) => {
    invariant(BATTLE_EXTRA_CHECKPOINTS.includes(name), `unknown battle-extra checkpoint: ${name}`);
    const entry = {
      sequence: checkpointLog.length + 1,
      name,
      status,
      elapsedMs: Date.now() - startedAt,
      details,
    };
    checkpointLog.push(entry);
    const previous = checkpointState.get(name);
    if (!previous || !RESOLVED_CHECKPOINT_STATUSES.has(previous.status) || RESOLVED_CHECKPOINT_STATUSES.has(status)) {
      checkpointState.set(name, entry);
    }
    append("checkpoint", { checkpoint: name, status, details });
    if (RESOLVED_CHECKPOINT_STATUSES.has(status)) awaiting = null;
    return entry;
  };

  const markOnce = (name, status = "completed", details = {}) => {
    const current = checkpointState.get(name);
    if (current && RESOLVED_CHECKPOINT_STATUSES.has(current.status)) return current;
    return mark(name, status, details);
  };

  const setAwaiting = (predicate, details = {}) => {
    awaiting = { predicate, elapsedMs: Date.now() - startedAt, details };
    append("awaiting", { predicate, details });
  };

  const clearAwaiting = () => {
    if (!awaiting) return;
    append("awaiting-cleared", { predicate: awaiting.predicate });
    awaiting = null;
  };

  const lifecycleEvent = (event, details = {}) => {
    const entry = { event, elapsedMs: Date.now() - startedAt, ...details };
    lifecycle.push(entry);
    append("lifecycle", entry);
  };

  const setLatestReadableState = (state) => {
    if (state !== undefined) latestReadableState = state;
  };

  const recordDeploymentAttempt = (details) => {
    const entry = {
      sequence: deploymentAttempts.length + 1,
      elapsedMs: Date.now() - startedAt,
      ...details,
    };
    deploymentAttempts.push(entry);
    append("deployment-attempt", entry);
    if (details?.diagnostics) setLatestReadableState(details.diagnostics);
    return entry;
  };

  const attach = () => {
    pageCheckpointRecorders.set(page, recorder);
    phaseGCheckpointRecorders.add(recorder);
    page.on("close", () => lifecycleEvent("page-close"));
    page.on("crash", () => lifecycleEvent("page-crash"));
    context.on("close", () => lifecycleEvent("context-close"));
    browser.on("disconnected", () => {
      lifecycleEvent("browser-disconnect");
      void writeFailureFile();
    });
  };

  const snapshot = () => {
    const checkpoints = BATTLE_EXTRA_CHECKPOINTS.map((name) => checkpointState.get(name) ?? {
      name,
      status: "unresolved",
      elapsedMs: Date.now() - startedAt,
      details: {},
    });
    return {
      schemaVersion: 1,
      recorder: "v100-webkit-battle-extra",
      variant: contract.variant,
      engine: engineName,
      viewport: viewportLabel(viewport),
      sequenceId,
      orderedRunPosition: ["stage06-spitter-seal", "stage24-panther-commander", "stage25-president"].indexOf(contract.variant) + 1,
      startedAt: new Date(startedAt).toISOString(),
      elapsedMs: Date.now() - startedAt,
      contract: {
        variant: contract.variant,
        stageId: contract.stageId,
        stageNumber: contract.stageNumber,
        stageName: contract.stageName,
        expectedBoss: contract.bossKind,
        proofActor: contract.proofActor ?? null,
        proofUnitKind: contract.proofUnitKind ?? null,
        manualAbilityKind: contract.manualAbilityKind ?? null,
        requireVehicleAction: contract.requireVehicleAction === true,
        formationUnitIds: contract.formationUnitIds ?? [],
      },
      checkpoints,
      checkpointLog: [...checkpointLog],
      lastCompletedCheckpoint: [...checkpointState.values()].filter((entry) => RESOLVED_CHECKPOINT_STATUSES.has(entry.status)).sort((left, right) => left.sequence - right.sequence).at(-1)?.name ?? null,
      unresolvedCheckpoints: checkpoints.filter((entry) => !RESOLVED_CHECKPOINT_STATUSES.has(entry.status)).map((entry) => entry.name),
      awaiting,
      deploymentAttempts: [...deploymentAttempts],
      latestReadableState,
      lifecycle: [...lifecycle],
      events: [...eventLog],
    };
  };

  const finalizeFailure = (details = {}) => {
    if (failurePayload) return;
    const current = snapshot();
    for (const name of current.unresolvedCheckpoints) {
      const absence = [
        "proof-actor-mounted-or-absent",
        "living-human-target-acquired-or-not-required",
        "proof-unit-deployed-and-attacked-or-not-required",
      ].includes(name);
      mark(name, absence ? "absent" : "unresolved", {
        reason: "diagnostic-failure-before-checkpoint-completion",
        lastReadableState: current.latestReadableState,
      });
    }
    failurePayload = {
      ...snapshot(),
      failure: {
        ...details,
        lastCompletedCheckpoint: snapshot().lastCompletedCheckpoint,
        unresolvedCheckpoints: snapshot().unresolvedCheckpoints,
        awaiting: snapshot().awaiting,
      },
    };
  };

  async function writeFailureFile() {
    if (!failureFilePath || !failurePayload) return;
    await writeFile(failureFilePath, `${JSON.stringify({ ...failurePayload, ...snapshot() }, null, 2)}\n`).catch(() => {});
  }

  const persistFailure = async ({ label, error, failureState, diagnostics }) => {
    const safeLabel = `${contract.variant}-${engineName}-${viewportLabel(viewport)}`;
    const diagnosticsDir = path.join(evidenceDir, "diagnostics");
    await mkdir(diagnosticsDir, { recursive: true });
    failureFilePath = path.join(diagnosticsDir, `${safeLabel}.json`);
    failureScreenshotPath = path.join(diagnosticsDir, `${safeLabel}.png`);
    setLatestReadableState(failureState);
    finalizeFailure({ label, error: String(error), diagnostics });
    try {
      if (!page.isClosed()) await page.screenshot({ path: failureScreenshotPath, animations: "disabled" });
    } catch {
      failureScreenshotPath = null;
    }
    failurePayload.failure = {
      ...failurePayload.failure,
      screenshot: failureScreenshotPath ? relativeEvidence(failureScreenshotPath) : null,
    };
    await writeFailureFile();
    return {
      file: relativeEvidence(failureFilePath),
      screenshot: failureScreenshotPath ? relativeEvidence(failureScreenshotPath) : null,
      ...snapshot(),
    };
  };

  const recorder = {
    attach,
    mark,
    markOnce,
    setAwaiting,
    clearAwaiting,
    setLatestReadableState,
    recordDeploymentAttempt,
    snapshot,
    persistFailure,
    writeFailureFile,
  };
  mark("contract-identified", "completed", {
    variant: contract.variant,
    stageId: contract.stageId,
    viewport: viewportLabel(viewport),
    expectedBoss: contract.bossKind,
    proofActor: contract.proofActor ?? null,
    proofUnitKind: contract.proofUnitKind ?? null,
    orderedRunPosition: recorder.snapshot().orderedRunPosition,
  });
  return recorder;
}

if (process.env.V100_PHASE_G_CHECKPOINT_NEGATIVE === "1") {
  const recorder = createBattleExtraCheckpointRecorder({
    contract: {
      variant: "negative-impossible-predicate",
      stageId: "stage-negative",
      stageNumber: 0,
      stageName: "negative",
      bossKind: null,
      proofActor: "impossible-actor",
      proofUnitKind: null,
      manualAbilityKind: null,
      requireVehicleAction: false,
      formationUnitIds: [],
    },
    engineName: "webkit",
    viewport: { width: 667, height: 375 },
    context: { on() {} },
    page: { on() {} },
    browser: { on() {} },
  });
  recorder.mark("route-opened", "completed", { url: "http://negative.invalid/" });
  recorder.mark("formation-visible", "completed", { selector: ".v100-formation-panel" });
  recorder.mark("battle-mounted-lifecycle-active", "completed", { battleMounted: true });
  recorder.mark("combat-observer-started", "completed", { intervalMs: 40 });
  recorder.setAwaiting("impossible-predicate", { predicate: "intentional impossible checkpoint" });
  const evidence = recorder.snapshot();
  throw new Error(`[Phase G checkpoint negative] unresolvedCheckpoint=${evidence.unresolvedCheckpoints[0]} lastCompletedCheckpoint=${evidence.lastCompletedCheckpoint} lifecycleStatus=attached`);
}

const dialogueEvidenceTargets = Object.freeze(Object.fromEntries(
  ["left", "right"].map((side) => {
    for (const event of Object.values(V100_STORY_EVENTS)) {
      const nodeIndex = event.nodes.findIndex((node, index) => node.kind === "dialogue"
        && node.portraitOwner
        && v100EventPresentationFor({ eventId: event.id, phase: event.id.endsWith(":post") ? "post" : "event", node, nodeIndex: index }).portraitSide === side);
      if (nodeIndex >= 0) {
        return [side, Object.freeze({
          eventId: event.id,
          phase: event.id.endsWith(":post") ? "post" : "event",
          stageNumber: event.stageNumber ?? 1,
          nodeIndex,
        })];
      }
    }
    throw new Error(`No canonical ${side} dialogue evidence target exists`);
  }),
));

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

function fullSave({ availableStageIds = [V100_STAGE_IDS[0]], completedStageIds = [], flowState = null, pendingResult = null, formationUnitIds = null, unitLevels = null } = {}) {
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
    unitLevels: unitLevels ?? base.unitLevels,
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

function eventSave(phase, eventId, { nodeIndex = 0, stageNumber = 30 } = {}) {
  const boundedStageNumber = Math.min(V100_STAGE_IDS.length, Math.max(1, Math.floor(Number(stageNumber) || 1)));
  const stageId = V100_STAGE_IDS[boundedStageNumber - 1];
  return fullSave({
    availableStageIds: V100_STAGE_IDS,
    completedStageIds: V100_STAGE_IDS.slice(0, 29),
    flowState: { phase, eventId, stageId, stageNumber: boundedStageNumber, destination: phase, nodeIndex, firstClear: false, finalized: true },
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
  checkpointRecorderFor(page)?.markOnce("route-opened", "completed", { url: page.url() });
  // PwaGate starts the published metadata fetch without blocking an already
  // playable shell. A seeded route reload must wait for that real fetch to
  // settle; otherwise WebKit reports the first-party request as cancelled at
  // the reload boundary and the evidence becomes a lifecycle artifact rather
  // than a production failure.
  await page.waitForFunction(() => ["ready", "unreachable", "unsupported"].includes(
    document.documentElement.dataset.pwaManifestState,
  ), null, { timeout });
  if (save) {
    await seedPage(page, save);
    await page.reload({ waitUntil: "domcontentloaded", timeout });
    await waitForGateOrShell();
    await page.waitForFunction(() => ["ready", "unreachable", "unsupported"].includes(
      document.documentElement.dataset.pwaManifestState,
    ), null, { timeout });
    const seeded = await page.evaluate(() => {
      try {
        const raw = localStorage.getItem("nishijin-campaign-v100");
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    });
    invariant(
      seeded?.equippedSupportId === save.equippedSupportId
        && seeded?.caps === save.caps
        && seeded?.completedStageIds?.length === save.completedStageIds.length,
      `QA save seed drifted before route validation: ${JSON.stringify({ expected: { equippedSupportId: save.equippedSupportId, caps: save.caps, completedStages: save.completedStageIds.length }, actual: { equippedSupportId: seeded?.equippedSupportId ?? null, caps: seeded?.caps ?? null, completedStages: seeded?.completedStageIds?.length ?? null } })}`,
    );
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
  const recorder = checkpointRecorderFor(page);
  recorder?.setAwaiting("battle-mounted", { predicate: "battle screen visible, assets ready, battle mount active" });
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
  recorder?.clearAwaiting();
  recorder?.markOnce("battle-mounted-lifecycle-active", "completed", {
    battleScreen: true,
    assetState: "ready",
    battleMounted: true,
  });
}

async function startCombatRuntimeObserver(page) {
  await page.evaluate(() => {
    window.__PHASE_G_COMBAT_OBSERVER__?.stop?.();
    const observe = () => {
      const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.() ?? null;
      if (!snapshot || snapshot.screen !== "battle") return;
      const activity = window.__PHASE_G_COMBAT_ACTIVITY__ ?? {};
      const fighterActors = new Set(activity.fighterActors ?? []);
      const attackingActors = new Set(activity.attackingActors ?? []);
      const statusMarkers = new Set(activity.statusMarkers ?? []);
      const audioCues = new Set(activity.audioCues ?? []);
      const attackIdentity = [...(activity.attackIdentity ?? [])];
      const pendingWeaponHits = [...(activity.pendingWeaponHits ?? [])];
      const battlePresentationEffects = [...(activity.battlePresentationEffects ?? [])];
      const bossLifecycle = [...(activity.bossLifecycle ?? [])];
      const actorById = new Map((snapshot.fighters ?? []).map((fighter) => [String(fighter.id), fighter]));
      for (const fighter of snapshot.fighters ?? []) {
        if (!fighter.side || !fighter.kind) continue;
        const actorKey = `${fighter.side}:${fighter.kind}`;
        // Keep the actor once the production runtime has actually mounted it;
        // this history survives a later defeat before the evidence window.
        if (fighter.combatReady === true || fighter.gateEntering === true || Number(fighter.hp) > 0) {
          fighterActors.add(actorKey);
        }
        const animationState = String(fighter.animationPresentation?.state ?? "");
        const attacking = Number(fighter.attack) > 0
          || Number(fighter.attackWindup) > 0
          || Number(fighter.abilityWindup) > 0
          || Number(fighter.attackSequence) > 0
          || fighter.enemyVfx?.attacking === true
          || fighter.enemyVfx?.attackWindup === true
          || ["attack", "warning"].includes(fighter.enemyVfx?.phase)
          || /attack|windup|ability/u.test(animationState);
        if (attacking) attackingActors.add(actorKey);
        if (Number(fighter.marked) > 0) statusMarkers.add(`${actorKey}:marked`);
        if (fighter.gateEntering === true || /president|takuya|futago|gate-eater|kurome|mother|ooguchi|gairen/u.test(String(fighter.kind))) {
          bossLifecycle.push({
            time: Number(snapshot.time ?? 0),
            id: fighter.id,
            kind: fighter.kind,
            x: fighter.x,
            y: fighter.y,
            hp: fighter.hp,
            combatReady: fighter.combatReady,
            gateEntering: fighter.gateEntering,
            combatReadyX: fighter.combatReadyX,
            gateEntrySpeed: fighter.gateEntrySpeed,
            targetId: fighter.targetId,
            attacking,
            attack: fighter.attack,
            attackWindup: fighter.attackWindup,
            attackSequence: fighter.attackSequence,
            enemyVfxPhase: fighter.enemyVfx?.phase ?? null,
            stationAbilityPhase: fighter.stationAbility?.phase ?? null,
          });
        }
      }
      for (const attack of [...(snapshot.attackIdentity ?? []), ...(snapshot.pendingWeaponHits ?? [])]) {
        if (attack?.sourceId === undefined || attack?.sourceId === null) continue;
        const source = actorById.get(String(attack.sourceId));
        if (source?.side && source?.kind) {
          const actorKey = `${source.side}:${source.kind}`;
          fighterActors.add(actorKey);
          attackingActors.add(actorKey);
        }
      }
      for (const attack of snapshot.attackIdentity ?? []) attackIdentity.push(attack);
      for (const hit of snapshot.pendingWeaponHits ?? []) pendingWeaponHits.push(hit);
      for (const effect of snapshot.battlePresentation?.effects ?? []) battlePresentationEffects.push(effect);
      for (const request of window.__ASHFALL_AUDIO_QA__?.getCueRequests?.() ?? []) {
        if (request?.cueId) audioCues.add(String(request.cueId));
      }
      if ((snapshot.damageTexts ?? []).some((text) => /索敵|マーク|目標|ロック/u.test(String(text?.value ?? "")))) {
        statusMarkers.add("status-mission-target");
      }
      window.__PHASE_G_COMBAT_ACTIVITY__ = {
        ...activity,
        fighterActors: [...fighterActors],
        attackingActors: [...attackingActors],
        statusMarkers: [...statusMarkers],
        audioCues: [...audioCues],
        attackIdentity: attackIdentity.slice(-24),
        pendingWeaponHits: pendingWeaponHits.slice(-24),
        battlePresentationEffects: battlePresentationEffects.slice(-24),
        bossLifecycle: bossLifecycle.slice(-48),
      };
    };
    const timer = window.setInterval(observe, 40);
    window.__PHASE_G_COMBAT_OBSERVER__ = {
      stop: () => {
        window.clearInterval(timer);
        observe();
        window.__PHASE_G_COMBAT_OBSERVER__ = null;
      },
    };
    observe();
  });
  checkpointRecorderFor(page)?.markOnce("combat-observer-started", "completed", { intervalMs: 40 });
}

async function waitForCombatActivity(page, { bossKind = null } = {}) {
  const recorder = checkpointRecorderFor(page);
  recorder?.setAwaiting("combat-activity", { bossKind, predicate: "production attack/contact/presentation activity" });
  try {
    await page.waitForFunction(() => {
      const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
      if (!snapshot || snapshot.screen !== "battle") return false;
      const hasFighters = Array.isArray(snapshot.fighters) && snapshot.fighters.some((fighter) => fighter.hp > 0);
      const activity = window.__PHASE_G_COMBAT_ACTIVITY__ ?? {};
      const hasPresentation = (snapshot.attackIdentity?.length ?? 0) > 0
        || (snapshot.pendingWeaponHits?.length ?? 0) > 0
        || (snapshot.battlePresentation?.effects?.length ?? 0) > 0
        || (activity.attackIdentity?.length ?? 0) > 0
        || (activity.pendingWeaponHits?.length ?? 0) > 0
        || (activity.battlePresentationEffects?.length ?? 0) > 0;
      if (!hasFighters || !hasPresentation) return false;
      window.__PHASE_G_COMBAT_ACTIVITY__ = {
        ...(window.__PHASE_G_COMBAT_ACTIVITY__ ?? {}),
        attackIdentity: snapshot.attackIdentity ?? [],
        pendingWeaponHits: snapshot.pendingWeaponHits ?? [],
        battlePresentationEffects: snapshot.battlePresentation?.effects ?? [],
      };
      return true;
    }, null, { timeout: Math.min(battleTimeout, 45_000) });
    recorder?.clearAwaiting();
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
    recorder?.setAwaiting("boss-attack", { bossKind, predicate: `production ${bossKind} attack, cue, or authored active phase` });
    try {
      await page.waitForFunction((expectedKind) => {
          const activity = window.__PHASE_G_COMBAT_ACTIVITY__ ?? {};
          const actorKey = `zombie:${expectedKind}`;
          const historicalAttack = (activity.attackingActors ?? []).includes(actorKey);
          const historicalCue = (activity.audioCues ?? []).includes(`enemy-${expectedKind}-attack`);
          const runtimeCue = window.__ASHFALL_AUDIO_QA__?.getCueRequests?.()?.some((request) => request?.cueId === `enemy-${expectedKind}-attack`);
          if (historicalAttack || historicalCue || runtimeCue) return true;
          const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
          return snapshot?.fighters?.some((fighter) => (
            fighter.side === "zombie"
            && fighter.kind === expectedKind
            && fighter.hp > 0
            && fighter.combatReady === true
            && fighter.gateEntering !== true
            && Number(fighter.x) < 960
            && (
              Number(fighter.attack) > 0
              || Number(fighter.attackWindup) > 0
              || Number(fighter.abilityWindup) > 0
              || Number(fighter.attackSequence) > 0
              || ["warning", "active", "recovery"].includes(fighter.stationAbility?.phase)
              || ["warning", "attack"].includes(fighter.enemyVfx?.phase)
            )
          )) === true;
      }, bossKind, { timeout: battleTimeout });
      recorder?.clearAwaiting();
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
  "dialogue-left": { phases: [dialogueEvidenceTargets.left.phase], selectors: [".v100-event-panel", '[data-v100-state="dialogue-left"]', ".v100-event-actions .v100-primary"] },
  "dialogue-right": { phases: [dialogueEvidenceTargets.right.phase], selectors: [".v100-event-panel", '[data-v100-state="dialogue-right"]', ".v100-event-actions .v100-primary"] },
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

async function collectCombatCausalProof(page, { durationMs = 4_800 } = {}) {
  const samples = [];
  const startedAt = Date.now();
  while (Date.now() - startedAt < durationMs) {
    samples.push(await page.evaluate(() => {
      const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.() ?? null;
      const audio = window.__ASHFALL_AUDIO_QA__?.getCueRequests?.() ?? [];
      const observedCombatActivity = window.__PHASE_G_COMBAT_ACTIVITY__ ?? {};
      return {
        stageId: snapshot?.stageId ?? null,
        stageMission: snapshot?.stageMission ? {
          missionType: snapshot.stageMission.missionType ?? null,
          transitions: snapshot.stageMission.transitions ?? [],
          powerActivated: snapshot.stageMission.powerActivated ?? null,
          sealed: snapshot.stageMission.sealed ?? false,
          completed: snapshot.stageMission.completed ?? false,
        } : null,
        crawlerAbility: snapshot?.crawlerAbility ? {
          abilityId: snapshot.crawlerAbility.abilityId ?? null,
          phase: snapshot.crawlerAbility.phase ?? null,
          damageTriggered: snapshot.crawlerAbility.damageTriggered ?? false,
          hitCount: snapshot.crawlerAbility.hits?.length ?? snapshot.crawlerAbility.hitCount ?? 0,
        } : null,
        attackIdentity: (snapshot?.attackIdentity?.length ?? 0) > 0 ? snapshot.attackIdentity : observedCombatActivity.attackIdentity ?? [],
        pendingWeaponHits: (snapshot?.pendingWeaponHits?.length ?? 0) > 0 ? snapshot.pendingWeaponHits : observedCombatActivity.pendingWeaponHits ?? [],
        activityFighterActors: observedCombatActivity.fighterActors ?? [],
        activityAttackingActors: observedCombatActivity.attackingActors ?? [],
        activityStatusMarkers: observedCombatActivity.statusMarkers ?? [],
        activityVehicleActions: observedCombatActivity.vehicleActions ?? [],
        fighters: snapshot?.fighters?.map((fighter) => ({
          id: fighter.id,
          side: fighter.side,
          kind: fighter.kind,
          targetId: fighter.targetId,
          targetObjectId: fighter.targetObjectId,
          flash: fighter.flash,
          knock: fighter.knock,
          marked: fighter.marked,
          attack: fighter.attack,
          attackWindup: fighter.attackWindup,
          abilityWindup: fighter.abilityWindup,
          abilityCooldown: fighter.abilityCooldown,
          cooldown: fighter.cooldown,
          aiMoveDirection: fighter.aiMoveDirection,
          aiDestinationX: fighter.aiDestinationX,
          attackSequence: fighter.attackSequence,
          stunned: fighter.stunned,
          stationAbility: fighter.stationAbility ? {
            phase: fighter.stationAbility.phase,
            remainingSeconds: fighter.stationAbility.remainingSeconds,
          } : null,
          animationPresentation: fighter.animationPresentation ? {
            state: fighter.animationPresentation.state,
            moving: fighter.animationPresentation.moving,
            direction: fighter.animationPresentation.direction,
          } : null,
          enemyVfx: fighter.enemyVfx ? {
            attacking: fighter.enemyVfx.attacking,
            attackWindup: fighter.enemyVfx.attackWindup,
            abilityPhase: fighter.enemyVfx.abilityPhase,
            abilityActive: fighter.enemyVfx.abilityActive,
            phase: fighter.enemyVfx.phase,
          } : null,
        })) ?? [],
        shots: snapshot?.shots ?? [],
        damageTexts: snapshot?.damageTexts ?? [],
        battlefieldObjects: snapshot?.battlefieldObjects ?? [],
        researchContainer: snapshot?.researchContainer ?? null,
        manualAbilityReceipts: snapshot?.manualAbilityReceipts ?? [],
        manualAbilityVfx: snapshot?.manualAbilityVfx ?? [],
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
  const actorKinds = new Set();
  const fighterActors = new Set();
  const attackingActors = new Set();
  const abilityActors = new Set();
  const actorPhaseObservations = new Set();
  const reactingActors = new Set();
  const supportActors = new Set();
  const vehicleActions = new Set();
  const missionStageIds = new Set();
  const missionTypes = new Set();
  const missionSignals = new Set();
  const statusMarkers = new Set();
  for (const sample of valid) {
    for (const actorKey of sample.activityFighterActors ?? []) fighterActors.add(actorKey);
    for (const actorKey of sample.activityAttackingActors ?? []) attackingActors.add(actorKey);
    for (const action of sample.activityVehicleActions ?? []) vehicleActions.add(action);
    for (const marker of sample.activityStatusMarkers ?? []) statusMarkers.add(marker);
    if (sample.stageId) missionStageIds.add(sample.stageId);
    if (sample.stageMission?.missionType) missionTypes.add(sample.stageMission.missionType);
    for (const transition of sample.stageMission?.transitions ?? []) missionSignals.add(transition);
    for (const fighter of sample.fighters ?? []) {
      if (!fighter.kind || !fighter.side) continue;
      const actorKey = `${fighter.side}:${fighter.kind}`;
      actorKinds.add(fighter.kind);
      fighterActors.add(actorKey);
      const abilityPhase = String(fighter.stationAbility?.phase ?? fighter.enemyVfx?.abilityPhase ?? "idle");
      const vfxPhase = String(fighter.enemyVfx?.phase ?? "idle");
      actorPhaseObservations.add(`${actorKey}:${abilityPhase}:${vfxPhase}`);
      if (fighter.enemyVfx?.abilityActive === true
        || ["warning", "active", "recovery"].includes(abilityPhase)
        || ["warning", "attack"].includes(vfxPhase)) {
        abilityActors.add(actorKey);
      }
      const animationState = String(fighter.animationPresentation?.state ?? "");
      const attacking = Number(fighter.attack) > 0
        || Number(fighter.attackWindup) > 0
        || Number(fighter.abilityWindup) > 0
        || Number(fighter.attackSequence) > 0
        || fighter.enemyVfx?.attacking === true
        || fighter.enemyVfx?.attackWindup === true
        || fighter.enemyVfx?.abilityActive === true
        || ["attack", "warning"].includes(fighter.enemyVfx?.phase)
        || /attack|windup|ability/u.test(animationState);
      if (attacking) attackingActors.add(actorKey);
      if (Number(fighter.flash) > 0 || Number(fighter.knock) > 0 || /hurt|hit|stagger|die/u.test(animationState)) reactingActors.add(actorKey);
      if (Number(fighter.marked) > 0) statusMarkers.add(`${actorKey}:marked`);
    }
    const fightersById = new Map((sample.fighters ?? []).map((fighter) => [String(fighter.id), fighter]));
    for (const attack of [...(sample.attackIdentity ?? []), ...(sample.pendingWeaponHits ?? [])]) {
      if (attack.sourceId !== undefined && attack.targetId !== undefined && attack.targetId !== null) edges.add(`${attack.sourceId}->${attack.targetId}`);
      if (attack.weapon || attack.effect) visualEvents.add(String(attack.weapon ?? attack.effect));
      const source = attack.sourceId === undefined || attack.sourceId === null
        ? null
        : fightersById.get(String(attack.sourceId));
      if (source?.kind && source?.side) attackingActors.add(`${source.side}:${source.kind}`);
    }
    for (const effect of sample.battlePresentationEffects ?? []) visualEvents.add(String(effect.semantic ?? effect.kind ?? "presentation"));
    for (const fighter of sample.fighters ?? []) if (Number(fighter.flash) > 0 || Number(fighter.knock) > 0 || Number(fighter.attackWindup) > 0) reactionKeys.add(`${fighter.id}:${fighter.flash > 0 ? "flash" : "knock"}`);
    for (const text of sample.damageTexts ?? []) {
      if (text?.value !== undefined) reactionKeys.add(`damage:${text.value}`);
      if (/索敵|マーク|目標|ロック/u.test(String(text?.value ?? ""))) statusMarkers.add("status-mission-target");
    }
    for (const object of sample.battlefieldObjects ?? []) {
      const objectKind = String(object.kind ?? "");
      if (objectKind.includes("support-healing")) supportActors.add("support-healing");
      if (objectKind.includes("support")) visualEvents.add(objectKind);
    }
    for (const effect of sample.manualAbilityVfx ?? []) if (effect?.kind) visualEvents.add(`manual:${effect.kind}`);
    for (const request of sample.audioCueRequests ?? []) {
      if (!request?.cueId) continue;
      audioCueIds.add(request.cueId);
      if (request.cueId === "support-heal") supportActors.add("support-healing");
      if (request.cueId === "support-airstrike") supportActors.add("support-airstrike");
      if (request.cueId === "support-explosion") supportActors.add("support-explosion");
      if (request.cueId === "weapon-barrage") vehicleActions.add("vehicle-barrage");
    }
    for (const receipt of sample.manualAbilityReceipts ?? []) {
      if (receipt?.kind) visualEvents.add(`receipt:${receipt.kind}:${receipt.eventType ?? "unknown"}`);
    }
    if (sample.crawlerAbility?.abilityId === "vehicle-barrage"
      || sample.crawlerAbility?.phase === "firing"
      || sample.crawlerAbility?.damageTriggered === true
      || Number(sample.crawlerAbility?.hitCount) > 0) {
      vehicleActions.add("vehicle-barrage");
      visualEvents.add("vehicle-barrage");
    }
    if (sample.researchContainer || sample.stageMission?.missionType === "sequential-seal") missionSignals.add("station-mission-runtime");
    if ((sample.damageTexts ?? []).some((text) => /索敵|マーク|目標|ロック/u.test(String(text?.value ?? "")))) statusMarkers.add("status-mission-target");
  }
  const causalProof = {
    sampleCount: valid.length,
    sourceToTargetEdges: [...edges],
    visualEvents: [...visualEvents],
    reactionEvents: [...reactionKeys],
    audioCueIds: [...audioCueIds],
    observed: {
      actorKinds: [...actorKinds],
      fighterActors: [...fighterActors],
      attackingActors: [...attackingActors],
      abilityActors: [...abilityActors],
      actorPhaseObservations: [...actorPhaseObservations],
      reactingActors: [...reactingActors],
      supportActors: [...supportActors],
      vehicleActions: [...vehicleActions],
      missionStageIds: [...missionStageIds],
      missionTypes: [...missionTypes],
      missionSignals: [...missionSignals],
      statusMarkers: [...statusMarkers],
      audioCueIds: [...audioCueIds],
    },
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

async function phaseGBrowser(engineName) {
  const current = phaseGBrowsers.get(engineName);
  if (current?.isConnected?.()) return current;
  if (current) await current.close().catch(() => {});
  const browser = await playwright[engineName].launch({ headless: true });
  phaseGBrowsers.set(engineName, browser);
  return browser;
}

async function closePhaseGBrowsers() {
  const browsers = [...phaseGBrowsers.values()];
  phaseGBrowsers.clear();
  await Promise.all(browsers.map((browser) => browser.close().catch(() => {})));
}

async function resetPhaseGBrowser(engineName) {
  const browser = phaseGBrowsers.get(engineName);
  phaseGBrowsers.delete(engineName);
  await browser?.close().catch(() => {});
}

async function captureStateImpl(engineName, viewport, state, configure, checkpointContract = null) {
  const browser = await phaseGBrowser(engineName);
  const context = await browser.newContext({ viewport, hasTouch: viewport.safeArea, isMobile: viewport.safeArea });
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  const label = `${engineName}-${viewportLabel(viewport)}-${state}`;
  const checkpointRecorder = engineName === "webkit" && state === "battle-extra" && checkpointContract
    ? createBattleExtraCheckpointRecorder({ contract: checkpointContract, engineName, viewport, context, page, browser })
    : null;
  checkpointRecorder?.attach();
  try {
    const captureMeta = await configure(page) ?? {};
    const productionContract = await productionStateContract(page, state);
    invariant(productionContract.ok, `${label} production state contract failed: ${JSON.stringify(productionContract)}`);
    checkpointRecorder?.setLatestReadableState(productionContract);
    checkpointRecorder?.setAwaiting("causal-proof", { predicate: "source -> contact/travel -> reaction -> audio" });
    const combatCausalProof = state.startsWith("battle") ? await collectCombatCausalProof(page, { durationMs: captureMeta.combatProofDurationMs ?? combatProofDurationMs }) : null;
    if (state.startsWith("battle")) invariant(combatCausalProof?.ok === true, `${label} combat causal proof failed: ${JSON.stringify(combatCausalProof)}`);
    if (checkpointRecorder) {
      checkpointRecorder.clearAwaiting();
      checkpointRecorder.mark("causal-proof-complete", "completed", {
        sampleCount: combatCausalProof?.sampleCount ?? 0,
        stages: combatCausalProof?.stages ?? null,
      });
    }
    const screenshot = await saveScreenshot(page, imagePath(label), label);
    checkpointRecorder?.mark("screenshot-saved", "completed", { evidence: screenshot });
    const overflow = await overflowAudit(page);
    const runtime = await page.evaluate(() => {
      const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
      if (!snapshot) return { screen: null };
      const observedCombatActivity = window.__PHASE_G_COMBAT_ACTIVITY__ ?? {};
      return {
        screen: snapshot.screen,
        stageId: snapshot.stageId,
        stageMission: snapshot.stageMission ? {
          missionType: snapshot.stageMission.missionType ?? null,
          transitions: snapshot.stageMission.transitions ?? [],
          powerActivated: snapshot.stageMission.powerActivated ?? null,
          sealed: snapshot.stageMission.sealed ?? false,
          completed: snapshot.stageMission.completed ?? false,
        } : null,
        researchContainer: snapshot.researchContainer ?? null,
        fighters: snapshot.fighters?.map((fighter) => ({ side: fighter.side, kind: fighter.kind, hp: fighter.hp, attack: fighter.attack, attackWindup: fighter.attackWindup, abilityWindup: fighter.abilityWindup, abilityCooldown: fighter.abilityCooldown, cooldown: fighter.cooldown, stunned: fighter.stunned, aiMoveDirection: fighter.aiMoveDirection, aiDestinationX: fighter.aiDestinationX, stationAbility: fighter.stationAbility ? { phase: fighter.stationAbility.phase, remainingSeconds: fighter.stationAbility.remainingSeconds } : null, targetId: fighter.targetId, x: fighter.x, y: fighter.y, combatReady: fighter.combatReady })) ?? [],
        attackIdentity: (snapshot.attackIdentity?.length ?? 0) > 0 ? snapshot.attackIdentity : observedCombatActivity.attackIdentity ?? [],
        pendingWeaponHits: (snapshot.pendingWeaponHits?.length ?? 0) > 0 ? snapshot.pendingWeaponHits : observedCombatActivity.pendingWeaponHits ?? [],
        battlePresentationEffects: (snapshot.battlePresentation?.effects?.length ?? 0) > 0 ? snapshot.battlePresentation.effects : observedCombatActivity.battlePresentationEffects ?? [],
        shots: snapshot.shots?.map((shot) => ({ sourceId: shot.sourceId, targetId: shot.targetId, weapon: shot.weapon, effect: shot.effect, x: shot.x, y: shot.y, tx: shot.tx, ty: shot.ty, life: shot.life })) ?? [],
        damageTexts: snapshot.damageTexts?.map((entry) => ({ value: entry.value, x: entry.x, y: entry.y, life: entry.life })) ?? [],
        audioCueRequests: window.__ASHFALL_AUDIO_QA__?.getCueRequests?.() ?? [],
        crawlerAbility: snapshot.crawlerAbility ?? null,
        missionObjects: snapshot.battlefieldObjects ?? [],
        manualAbilityVfx: snapshot.manualAbilityVfx ?? [],
        manualAbilityReceipts: snapshot.manualAbilityReceipts ?? [],
      };
    });
    invariant(overflow.every(({ delta }) => delta <= 1), `${label} horizontal overflow: ${JSON.stringify(overflow)}`);
    invariant(await page.locator("body").evaluate((body) => body.innerText.trim().length > 0), `${label} blank body`);
    invariant(diagnostics.consoleErrors.length === 0, `${label} console errors: ${JSON.stringify(diagnostics.consoleErrors)}`);
    invariant(diagnostics.pageErrors.length === 0, `${label} page errors: ${JSON.stringify(diagnostics.pageErrors)}`);
    invariant(diagnostics.httpFailures.length === 0, `${label} HTTP failures: ${JSON.stringify(diagnostics.httpFailures)}`);
    invariant(diagnostics.requestFailures.length === 0, `${label} request failures: ${JSON.stringify(diagnostics.requestFailures)}`);
    const checkpointEvidence = checkpointRecorder?.snapshot() ?? null;
    if (checkpointEvidence) invariant(checkpointEvidence.unresolvedCheckpoints.length === 0, `${label} checkpoint recorder incomplete: ${JSON.stringify(checkpointEvidence)}`);
    results.push({ engine: engineName, viewport: viewportLabel(viewport), state, variant: captureMeta.variant ?? state, capturedAt: new Date().toISOString(), pwaOfferShown: await page.evaluate(() => document.documentElement.dataset.phaseGPwaOffer === "shown"), evidence: screenshot, diagnostics, overflow, productionContract, combatCausalProof, runtime, checkpointEvidence, ...captureMeta });
    return screenshot;
  } catch (error) {
    const failureState = await page.evaluate(() => ({
      url: location.href,
      phase: document.querySelector(".v100-shell")?.getAttribute("data-v100-phase") ?? null,
      surface: document.querySelector(".v100-shell")?.getAttribute("data-v100-surface") ?? null,
      body: document.body.innerText.slice(0, 1600),
      snapshot: (() => {
        const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.() ?? null;
        return snapshot ? {
          screen: snapshot.screen,
          stageId: snapshot.stageId,
          time: snapshot.time,
          wave: snapshot.wave,
          fighters: snapshot.fighters?.map((fighter) => ({
            side: fighter.side,
            kind: fighter.kind,
            hp: fighter.hp,
            x: fighter.x,
            combatReady: fighter.combatReady,
            gateEntering: fighter.gateEntering,
            attack: fighter.attack,
            attackWindup: fighter.attackWindup,
            attackSequence: fighter.attackSequence,
            enemyVfxPhase: fighter.enemyVfx?.phase,
            enemyVfxAttacking: fighter.enemyVfx?.attacking,
          })) ?? [],
        } : null;
      })(),
      phaseGActivity: window.__PHASE_G_COMBAT_ACTIVITY__ ?? null,
    })).catch(() => null);
    const checkpointFailure = checkpointRecorder
      ? await checkpointRecorder.persistFailure({ label, error, failureState, diagnostics })
      : null;
    const failure = new Error(`${label} failed: ${String(error)} state=${JSON.stringify(failureState)} diagnostics=${JSON.stringify(diagnostics)} checkpointEvidence=${JSON.stringify(checkpointFailure)}`);
    failure.phaseGFailure = { label, failureState, diagnostics, checkpointEvidence: checkpointFailure };
    throw failure;
  } finally {
    await context.close();
    if (checkpointRecorder) {
      await checkpointRecorder.writeFailureFile();
      phaseGCheckpointRecorders.delete(checkpointRecorder);
      pageCheckpointRecorders.delete(page);
    }
  }
}

async function readBattleDeploymentDiagnostics(page, {
  requestedKind = null,
  requestedSlot = null,
  phase = null,
} = {}) {
  if (page.isClosed()) {
    return {
      capturedAt: new Date().toISOString(),
      pageClosed: true,
      requestedKind,
      requestedSlot,
      phase,
    };
  }
  return page.evaluate(({ requestedKind: kind, requestedSlot: slot, phase: diagnosticPhase }) => {
    const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.() ?? null;
    const visibleRect = (element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return {
        visible: rect.width > 0
          && rect.height > 0
          && style.display !== "none"
          && style.visibility !== "hidden"
          && Number(style.opacity) > 0,
        x: Math.round(rect.x * 100) / 100,
        y: Math.round(rect.y * 100) / 100,
        width: Math.round(rect.width * 100) / 100,
        height: Math.round(rect.height * 100) / 100,
      };
    };
    const cards = [...document.querySelectorAll("button.unit-card")].map((card) => {
      const rect = visibleRect(card);
      const ariaLabel = card.getAttribute("aria-label") ?? "";
      const cost = ariaLabel.match(/コスト\s*(\d+)/u)?.[1] ?? null;
      return {
        kind: card.getAttribute("data-kind"),
        slot: card.getAttribute("data-slot-index"),
        state: card.getAttribute("data-state"),
        blockReason: card.getAttribute("data-block-reason"),
        ariaDisabled: card.getAttribute("aria-disabled"),
        ariaLabel,
        cost: cost === null ? null : Number(cost),
        text: (card.textContent ?? "").trim().replace(/\s+/gu, " ").slice(0, 180),
        rect,
      };
    });
    const humanFighters = (snapshot?.fighters ?? []).filter((fighter) => (
      fighter.side === "human" && Number(fighter.hp) > 0
    ));
    const mission = snapshot?.stageMission ?? null;
    const objectiveText = [...document.querySelectorAll(
      ".battle-objective, [data-battle-objective], [aria-label*='目標' i]",
    )].map((element) => (element.textContent ?? "").trim()).filter(Boolean);
    return {
      capturedAt: new Date().toISOString(),
      pageClosed: false,
      url: location.href,
      requestedKind: kind,
      requestedSlot: slot,
      phase: diagnosticPhase,
      pageLifecycle: {
        visibilityState: document.visibilityState,
        hidden: document.hidden,
        readyState: document.readyState,
        v100Phase: document.querySelector(".v100-shell")?.getAttribute("data-v100-phase") ?? null,
        battleScreen: document.querySelector(".game-shell")?.getAttribute("data-screen") ?? null,
      },
      cards,
      visibleCardCount: cards.filter((card) => card.rect.visible).length,
      selectedCard: document.querySelector("button.unit-card[aria-pressed='true'], button.unit-card.selected")?.getAttribute("data-kind") ?? null,
      deployedUnitCount: humanFighters.length,
      battle: snapshot ? {
        screen: snapshot.screen ?? null,
        stageId: snapshot.stageId ?? null,
        elapsed: Number(snapshot.time ?? 0),
        phase: snapshot.phase ?? null,
        running: snapshot.running === true,
        paused: snapshot.paused === true,
        over: snapshot.over === true,
        won: snapshot.won === true,
        wave: snapshot.wave ?? null,
        eventIndex: snapshot.eventIndex ?? null,
        timelineLength: snapshot.timelineLength ?? null,
        energy: Number(snapshot.energy ?? NaN),
        deployQueue: snapshot.deployQueue ?? [],
        deployCooldowns: snapshot.deployCooldowns ?? {},
        formationKinds: snapshot.formationKinds ?? [],
        pendingSpawnCount: snapshot.pendingSpawnCount ?? null,
        mission: mission ? {
          missionType: mission.missionType ?? null,
          transitions: mission.transitions ?? [],
          completed: mission.completed === true,
          sealed: mission.sealed === true,
        } : null,
        objective: snapshot.objective ?? objectiveText,
      } : null,
      fighters: humanFighters.map((fighter) => ({
        kind: fighter.kind,
        hp: fighter.hp,
        combatReady: fighter.combatReady,
        x: fighter.x,
        y: fighter.y,
      })),
      objectiveText,
    };
  }, { requestedKind, requestedSlot, phase }).catch((error) => ({
    capturedAt: new Date().toISOString(),
    pageClosed: page.isClosed(),
    requestedKind,
    requestedSlot,
    phase,
    evaluateError: String(error),
  }));
}

function deploymentWasAccepted(before, after, requestedKind) {
  if (!after || after.pageClosed) return false;
  const beforeBattle = before?.battle ?? {};
  const afterBattle = after?.battle ?? {};
  const queueAccepted = Array.isArray(afterBattle.deployQueue)
    && afterBattle.deployQueue.includes(requestedKind);
  const energyAccepted = Number.isFinite(Number(beforeBattle.energy))
    && Number.isFinite(Number(afterBattle.energy))
    && Number(afterBattle.energy) < Number(beforeBattle.energy) - 0.01;
  const humanAccepted = Number(after.deployedUnitCount ?? 0) > Number(before?.deployedUnitCount ?? 0);
  const cardAfter = (after.cards ?? []).find((card) => card.kind === requestedKind);
  const cardAccepted = cardAfter && cardAfter.state !== "ready";
  // The production queue can drain and a spawned unit can be defeated before
  // the next diagnostic sample. The authored cooldown transition is a durable
  // existing runtime signal that the requested card was accepted; it does not
  // create or mutate a deployment.
  const cooldownBefore = Number(beforeBattle.deployCooldowns?.[requestedKind]);
  const cooldownAfter = Number(afterBattle.deployCooldowns?.[requestedKind]);
  const cooldownAccepted = Number.isFinite(cooldownBefore)
    && Number.isFinite(cooldownAfter)
    && cooldownAfter > cooldownBefore + 0.01;
  return queueAccepted || energyAccepted || humanAccepted || cardAccepted || cooldownAccepted;
}

async function waitForDeploymentAcceptance(page, before, requestedKind, requestedSlot, timeoutMs = 5_000) {
  const recorder = checkpointRecorderFor(page);
  recorder?.setAwaiting("deployment-accepted", { requestedKind, requestedSlot, predicate: "production card leaves ready state or enters deployment queue" });
  const deadline = Date.now() + timeoutMs;
  let latest = await readBattleDeploymentDiagnostics(page, {
    requestedKind,
    requestedSlot,
    phase: "after-click",
  });
  while (!deploymentWasAccepted(before, latest, requestedKind) && Date.now() < deadline) {
    await page.waitForTimeout(60);
    latest = await readBattleDeploymentDiagnostics(page, {
      requestedKind,
      requestedSlot,
      phase: "after-click-wait",
    });
  }
  const accepted = deploymentWasAccepted(before, latest, requestedKind);
  if (accepted) recorder?.clearAwaiting();
  recorder?.setLatestReadableState(latest);
  return {
    accepted,
    diagnostics: latest,
  };
}

function isTransientBrowserClosure(error) {
  return /target page, context or browser has been closed/i.test(String(error));
}

function isRetryableCaptureFailure(error) {
  const message = String(error);
  return isTransientBrowserClosure(error)
    || /request failures:\s*\["[^"]*\/asset-manifest\.json :: Load request cancelled"\]/i.test(message)
    || /combat activity did not become visible: TimeoutError: page\.waitForFunction: Timeout 45000ms exceeded/i.test(message)
    // Deployment/resource/cooldown failures are production-state assertions,
    // not transient capture failures. They are diagnosed and hard-failed by
    // battlePage instead of being hidden by a same-route retry.
    ;
}

async function captureState(engineName, viewport, state, configure, checkpointContract = null) {
  if (onlyEngine && engineName !== onlyEngine) return null;
  if (onlyState && state !== onlyState) return null;
  if (onlyVariant && state !== "battle-extra") return null;
  const maxAttempts = engineName === "webkit" && state === "battle-extra" ? 1 : 2;
  let lastError = null;
  let firstFailure = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await captureStateImpl(engineName, viewport, state, configure, checkpointContract);
      if (firstFailure) result.retryDiagnostics = firstFailure;
      return result;
    } catch (error) {
      lastError = error;
      const failureDetails = error?.phaseGFailure ?? { message: String(error) };
      if (!firstFailure) firstFailure = { attempt, ...failureDetails };
      if (attempt === maxAttempts || !isRetryableCaptureFailure(error)) {
        if (firstFailure && attempt === maxAttempts) {
          const finalError = new Error(`${String(error)} firstAttempt=${JSON.stringify(firstFailure)}`);
          finalError.cause = error;
          throw finalError;
        }
        throw error;
      }
      if (isTransientBrowserClosure(error)) await resetPhaseGBrowser(engineName);
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
       missionType: result.missionType ?? result.runtime?.stageMission?.missionType ?? null,
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
      checkpointEvidence: result.checkpointEvidence ?? null,
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
      checkpointEvidence: result.checkpointEvidence ?? null,
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
      runtimeHarnessCoverage: {
        source: expectedEnemyCoverage.source,
        requiredEnemyKinds: runtimeEnemyShards.requiredEnemyKinds,
        missing: runtimeEnemyShards.missing,
        duplicateCoverage: runtimeEnemyShards.duplicateCoverage,
        unknown: runtimeEnemyShards.unknown,
        runtimeSpriteStateMissing: runtimeEnemyShards.runtimeSpriteStateMissing,
        shardCount: runtimeEnemyShards.shardCount,
        shards: runtimeEnemyShards.shards,
        valid: runtimeEnemyShards.valid,
      },
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
  const side = targetState === "dialogue-left" ? "left" : "right";
  const target = dialogueEvidenceTargets[side];
  await openRoute(page, eventSave(target.phase, target.eventId, target));
  await page.locator(`[data-v100-event-id="${target.eventId}"][data-v100-node-index="${target.nodeIndex}"]`).waitFor({ state: "visible", timeout });
  await page.locator(`[data-v100-state="dialogue-${side}"]`).waitFor({ state: "visible", timeout });
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
  checkpointRecorderFor(page)?.markOnce("formation-visible", "completed", { selector: ".v100-formation-panel" });
}

async function battlePage(page, save, stageName = null, { bossKind = null, proofActor = null, proofUnitKind = null, proofUnitFirst = false, manualAbilityKind = null, requireVehicleAction = false, keepHumanTargetAlive = false, waitForBossAttack = true, combatProofDurationMs: requestedCombatProofDurationMs = null } = {}) {
  const recorder = checkpointRecorderFor(page);
  await formationPage(page, save, stageName);
  // The seeded save already contains the canonical formation for this capture.
  // Do not overwrite slot 1 with the first roster card: doing so erases the
  // stage-specific representative (for example brute) before the battle
  // starts and makes the runtime proof depend on roster DOM order.
  await click(page, page.getByRole("button", { name: "戦闘へ", exact: true }), "formation battle CTA");
  await waitBattle(page);
  await startCombatRuntimeObserver(page);
  if (bossKind) {
    const equippedSupport = await page.evaluate(() => {
      const button = document.querySelector(".support-row button.support-btn[data-category=\"support\"]");
      return button ? {
        className: button.className,
        label: button.getAttribute("aria-label"),
        state: button.getAttribute("data-state"),
        disabled: button.getAttribute("aria-disabled"),
      } : null;
    });
    invariant(equippedSupport?.className.split(/\s+/u).includes("medical"), `boss support fixture did not equip canonical recovery support: ${JSON.stringify(equippedSupport)}`);
  }
  const deployedKinds = new Set();
  let proofActorAttackObserved = proofActor === null;
  let vehicleActionObserved = !requireVehicleAction;
  let proofUnitDeployed = proofUnitKind === null;
  let proofUnitAttackObserved = proofUnitKind === null;
  const proofActorAttackCueId = proofActor
    ? V100_COMBAT_FX_INVENTORY.find((entry) => entry?.actor === proofActor)?.soundCue ?? null
    : null;
  const proofActorContent = proofActor ? enemyContentFor(proofActor) : null;
  const proofActorAiProfile = proofActorContent
    ? enemyAiProfileFor(proofActorContent.aiProfile ?? proofActor)
    : null;
  // Some canonical enemy profiles intentionally do not pursue humans at a
  // distance. For those actors, the real production condition for a human
  // attack is contact or a route-blocking engagement. Derive that condition
  // from the content and AI registry instead of coupling the interaction plan
  // to a stage number, actor id, or arbitrary deployment count.
  const proofActorRequiresContactFirst = Boolean(
    proofActorAiProfile
    && proofActorAiProfile.humanPursuit === false
    && Number(proofActorContent?.range) > 0
    && Number(proofActorContent.range) <= Number(proofActorAiProfile.engagementRadius),
  );
  if (recorder) {
    if (!proofActor) recorder.mark("proof-actor-mounted-or-absent", "not-required", { reason: "contract-has-no-proof-actor" });
    if (!proofActor) recorder.mark("proof-actor-attack-observed-or-not-required", "not-required", { reason: "contract-has-no-proof-actor" });
    if (!proofActorRequiresContactFirst) recorder.mark("living-human-target-acquired-or-not-required", "not-required", { reason: "contract-does-not-require-contact-first" });
    if (!proofUnitKind) recorder.mark("proof-unit-deployed-and-attacked-or-not-required", "not-required", { reason: "contract-has-no-proof-unit" });
    if (!manualAbilityKind && !requireVehicleAction) recorder.mark("manual-vehicle-action-observed-or-not-required", "not-required", { reason: "contract-has-no-manual-or-vehicle-action" });
  }
  const observeProofActorAttack = async () => {
    if (proofActorAttackObserved || !proofActor) return proofActorAttackObserved;
    const observation = await page.evaluate(({ expectedKind, expectedCueId }) => {
      const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
      const actor = snapshot?.fighters?.find((fighter) => fighter.side === "zombie" && fighter.kind === expectedKind);
      const activity = window.__PHASE_G_COMBAT_ACTIVITY__ ?? {};
      const actorKey = `zombie:${expectedKind}`;
      const fighterMounted = Boolean(actor)
        || (activity.fighterActors ?? []).includes(actorKey);
      if (!fighterMounted) return { observed: false, mounted: false, evidence: "not-mounted" };
      const stateAttack = actor && (Number(actor.attack) > 0
        || Number(actor.attackWindup) > 0
        || Number(actor.attackSequence) > 0
        || actor.enemyVfx?.attacking === true
        || actor.enemyVfx?.attackWindup === true
        || ["attack", "warning"].includes(actor.enemyVfx?.phase));
      const audioAttack = expectedCueId
        && window.__ASHFALL_AUDIO_QA__?.getCueRequests?.()?.some((request) => request?.cueId === expectedCueId);
      const historicalAudioAttack = expectedCueId && (activity.audioCues ?? []).includes(expectedCueId);
      // The runtime observer retains fleeting attack states after a sprite
      // leaves the live fighter list. Use that production history so a short
      // WebKit frame cannot erase a real attack that already occurred.
      const historicalAttack = (activity.attackingActors ?? []).includes(actorKey);
      const observed = historicalAttack || stateAttack === true || audioAttack === true || historicalAudioAttack === true;
      if (observed) {
        const fighterActors = new Set(activity.fighterActors ?? []);
        const attackingActors = new Set(activity.attackingActors ?? []);
        fighterActors.add(actorKey);
        attackingActors.add(actorKey);
        window.__PHASE_G_COMBAT_ACTIVITY__ = {
          ...activity,
          fighterActors: [...fighterActors],
          attackingActors: [...attackingActors],
        };
      }
      return {
        observed,
        mounted: true,
        evidence: historicalAttack ? "historical-runtime-state" : audioAttack || historicalAudioAttack ? "audio-cue" : stateAttack ? "live-runtime-state" : "unobserved",
      };
    }, { expectedKind: proofActor, expectedCueId: proofActorAttackCueId }).catch(() => false);
    if (observation?.mounted === true) recorder?.mark("proof-actor-mounted-or-absent", "observed", { actor: proofActor });
    if (observation?.observed === true) recorder?.mark("proof-actor-attack-observed-or-not-required", "observed", { actor: proofActor, evidence: observation.evidence });
    proofActorAttackObserved = observation?.observed === true;
    return proofActorAttackObserved;
  };
  const readProofActorContactState = async () => {
    if (!proofActor) return null;
    const state = await page.evaluate((expectedKind) => {
      const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
      const fighters = snapshot?.fighters ?? [];
      const actor = fighters.find((fighter) => fighter.side === "zombie" && fighter.kind === expectedKind);
      const activity = window.__PHASE_G_COMBAT_ACTIVITY__ ?? {};
      const actorKey = `zombie:${expectedKind}`;
      const target = actor?.targetId === null || actor?.targetId === undefined
        ? null
        : fighters.find((fighter) => String(fighter.id) === String(actor.targetId)) ?? null;
      return {
        mounted: Boolean(actor) || (activity.fighterActors ?? []).includes(actorKey),
        hasHumanTarget: target?.side === "human" && Number(target.hp) > 0,
        actorX: actor?.x ?? null,
        actorLane: actor?.lane ?? null,
        targetKind: target?.kind ?? null,
        targetSide: target?.side ?? null,
      };
    }, proofActor).catch(() => null);
    if (state?.mounted === true) recorder?.mark("proof-actor-mounted-or-absent", "observed", { actor: proofActor });
    if (state?.hasHumanTarget === true) recorder?.mark("living-human-target-acquired-or-not-required", "observed", { actor: proofActor, targetKind: state.targetKind });
    return state;
  };
  const waitForProofActorContact = async (durationMs = 1_800) => {
    if (!proofActorRequiresContactFirst || proofActorAttackObserved) return null;
    const deadline = Date.now() + durationMs;
    let state = null;
    while (Date.now() < deadline && !proofActorAttackObserved) {
      await observeProofActorAttack();
      state = await readProofActorContactState();
      if (proofActorAttackObserved || state?.hasHumanTarget === true) break;
      await page.waitForTimeout(120);
    }
    return state;
  };
  const observeProofUnitAttack = async () => {
    if (proofUnitAttackObserved || !proofUnitKind) return proofUnitAttackObserved;
    const observation = await page.evaluate((expectedKind) => {
      const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
      const activity = window.__PHASE_G_COMBAT_ACTIVITY__ ?? {};
      const actor = snapshot?.fighters?.find((fighter) => (
        fighter.side === "human"
        && fighter.kind === expectedKind
        && Number(fighter.hp) > 0
      ));
      const actorKey = `human:${expectedKind}`;
      const fighterMounted = Boolean(actor)
        || (activity.fighterActors ?? []).includes(actorKey);
      if (!fighterMounted) return null;
      const stateAttack = Number(actor?.attack) > 0
        || Number(actor?.attackWindup) > 0
        || Number(actor?.attackSequence) > 0
        || actor?.manualAbility?.phase === "active"
        || (snapshot?.manualAbilityReceipts ?? []).some((receipt) => receipt?.kind === expectedKind && receipt?.eventType === "impact");
      // A proof unit can complete a real production attack and then be
      // defeated before the polling frame that checks its live fighter. Keep
      // the same observer history used for enemy proof actors so that a
      // fleeting but genuine player attack is not erased by defeat.
      const historicalAttack = (activity.attackingActors ?? []).includes(actorKey);
      const observedAttack = historicalAttack || stateAttack === true;
      const fighterActors = new Set(activity.fighterActors ?? []);
      const attackingActors = new Set(activity.attackingActors ?? []);
      fighterActors.add(actorKey);
      if (observedAttack) attackingActors.add(actorKey);
      window.__PHASE_G_COMBAT_ACTIVITY__ = {
        ...activity,
        fighterActors: [...fighterActors],
        ...(observedAttack ? { attackingActors: [...attackingActors] } : {}),
      };
      return { deployed: true, attacking: observedAttack };
    }, proofUnitKind).catch(() => false);
    if (observation?.deployed === true) proofUnitDeployed = true;
    proofUnitAttackObserved = observation?.attacking === true;
    if (proofUnitAttackObserved) recorder?.mark("proof-unit-deployed-and-attacked-or-not-required", "observed", { unitKind: proofUnitKind, evidence: "live-or-historical-runtime-state" });
    return proofUnitAttackObserved;
  };
  const observeVehicleAction = async () => {
    if (vehicleActionObserved) return vehicleActionObserved;
    vehicleActionObserved = await page.evaluate(() => {
      const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
      const crawler = snapshot?.crawlerAbility;
      const runtimeCue = window.__ASHFALL_AUDIO_QA__?.getCueRequests?.()?.some((request) => request?.cueId === "weapon-barrage");
      const observed = runtimeCue === true
        || crawler?.abilityId === "vehicle-barrage"
        && (crawler.phase === "firing" || crawler.damageTriggered === true || Number(crawler.hitCount ?? crawler.hits?.length ?? 0) > 0);
      if (observed) {
        const activity = window.__PHASE_G_COMBAT_ACTIVITY__ ?? {};
        window.__PHASE_G_COMBAT_ACTIVITY__ = {
          ...activity,
          vehicleActions: [...new Set([...(activity.vehicleActions ?? []), "vehicle-barrage"])],
        };
      }
      return observed;
    }).catch(() => false);
    if (vehicleActionObserved) recorder?.mark("manual-vehicle-action-observed-or-not-required", "observed", { action: "vehicle-barrage" });
    return vehicleActionObserved;
  };
  let sustainActive = Boolean(bossKind);
  let bossDeploymentFinished = !bossKind;
  const bossIsLive = async () => bossKind && await page.evaluate((expectedKind) => {
    const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
    return snapshot?.screen === "battle" && snapshot.fighters?.some((fighter) => (
      fighter.side === "zombie"
      && fighter.kind === expectedKind
      && fighter.hp > 0
      // Boss entrance is an authored production state. Start causal capture
      // only once the real boss has completed that entry lifecycle; otherwise
      // the proof window can be consumed by the gate animation and never
      // observe the boss-owned action.
      && fighter.combatReady === true
      && fighter.gateEntering !== true
      && Number(fighter.x) < 960
    )) === true;
  }, bossKind).catch(() => false);
  const sustainDone = bossKind ? (async () => {
    // These are ordinary player-facing controls.  The loop keeps the
    // evidence run alive long enough to reach the authored boss wave without
    // mutating HP, clocks, enemy state, or battle definitions.
    while (sustainActive) {
      const battleVisible = await page.locator('.game-shell[data-screen="battle"]').isVisible().catch(() => false);
      if (!battleVisible) break;
      const bossEngaged = await bossIsLive();
      const liveHumanTargetCount = await page.evaluate(() => {
        const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
        return (snapshot?.fighters ?? []).filter((fighter) => fighter.side === "human" && Number(fighter.hp) > 0).length;
      }).catch(() => 0);
      await observeProofActorAttack();
      await observeProofUnitAttack();
      await observeVehicleAction();

      if (proofActorAttackObserved && proofUnitKind && !proofUnitDeployed) {
        const proofCard = page.locator(`button.unit-card[data-kind="${proofUnitKind}"][data-state="ready"][aria-disabled="false"]`).first();
        if (await proofCard.count().catch(() => 0)) {
          await proofCard.click({ timeout: 700 }).catch(() => {});
          const proofState = await page.locator(`button.unit-card[data-kind="${proofUnitKind}"]`).first().getAttribute("data-state").catch(() => null);
          proofUnitDeployed = proofState !== "ready";
        }
      }

      const abilityButtons = page.locator('button.manual-ability-ready.available:not([disabled])');
      const abilityCount = await abilityButtons.count().catch(() => 0);
      const proofCombatReady = proofActorAttackObserved && proofUnitAttackObserved;
      if (!bossEngaged && proofCombatReady) {
        for (let index = 0; index < Math.min(abilityCount, 4); index += 1) {
          await abilityButtons.nth(index).click({ timeout: 500 }).catch(() => {});
          await page.waitForTimeout(85);
        }
      }

      const crawler = page.locator('button.support-btn.barrage[data-state="ready"][aria-disabled="false"]').first();
      if (proofCombatReady && !vehicleActionObserved && await crawler.count().catch(() => 0)) {
        await crawler.click({ timeout: 500 }).catch(() => {});
      }

      const canvas = page.locator("canvas.battlefield");
      const box = await canvas.boundingBox().catch(() => null);
      if (box) {
        const target = { x: box.width * .67, y: box.height * .5 };
        if (!bossEngaged && proofCombatReady) {
          const airstrike = page.locator('button.support-btn.airstrike[data-state="ready"][aria-disabled="false"]').first();
          if (await airstrike.count().catch(() => 0)) {
            await airstrike.click({ timeout: 500 }).catch(() => {});
            await canvas.click({ position: target, timeout: 700 }).catch(() => {});
          }
        }
        // Keep recovery available while keeping a contact-first enemy's route
        // clear: before the proof attack, place the real medical supply on an
        // adjacent lane relative to the live actor. The player still gets a
        // normal survival action, while the support-object AI cannot choose
        // that supply instead of a human target on the proof lane.
        const proofActorContactPlanPending = proofActorRequiresContactFirst && !proofActorAttackObserved;
        const proofActorContactState = proofActorContactPlanPending
          ? await readProofActorContactState()
          : null;
        const medicalY = proofActorContactPlanPending && Number.isFinite(Number(proofActorContactState?.actorLane))
          ? (Number(proofActorContactState?.actorLane) >= 1 ? box.height * .3 : box.height * .7)
          : box.height * .5;
        const medical = page.locator('button.support-btn.medical[data-state="ready"][aria-disabled="false"]').first();
        if (await medical.count().catch(() => 0)) {
          await medical.click({ timeout: 500 }).catch(() => {});
          await canvas.click({ position: { x: box.width * .34, y: medicalY }, timeout: 700 }).catch(() => {});
        }
      }
      const proofActorContactPlanPending = proofActorRequiresContactFirst && !proofActorAttackObserved;
      if (bossDeploymentFinished && !proofActorContactPlanPending) {
        // Once the opening formation has been established, keep the same
        // player-facing redeploy control alive as cards recover. This is
        // especially important for compact boss routes where a fallen
        // frontline unit must be replaced before the authored boss entry.
        // Continue after the boss is live as well: medical support and
        // ordinary redeployment keep a real target on the battlefield long
        // enough for the boss-owned attack/ability lifecycle to be observed.
        const redeploy = page.locator('button.unit-card[data-state="ready"][aria-disabled="false"]').first();
        const targetSurvivalPlanPending = keepHumanTargetAlive && bossEngaged && liveHumanTargetCount < 2;
        if (((proofCombatReady && proofUnitDeployed) || targetSurvivalPlanPending) && await redeploy.count().catch(() => 0)) {
          await redeploy.click({ timeout: 500 }).catch(() => {});
        }
      }
      if (bossKind) {
        // The QA bridge only accelerates the authored boss gate-entry
        // animation. Spawn, entry state, sprite mount, and combat remain
        // production-owned; this prevents compact WebKit from losing the
        // vehicle before the real boss reaches the battlefield.
        await page.evaluate((expectedKind) => {
          const bridge = window.__ASHFALL_BATTLE_QA__;
          const snapshot = bridge?.getSnapshot?.();
          const boss = snapshot?.fighters?.find((fighter) => (
            fighter.side === "zombie"
            && fighter.kind === expectedKind
            && fighter.gateEntering
          ));
          if (boss) bridge?.accelerateBossFoundationEntry?.(boss.id);
        }, bossKind).catch(() => {});
      }
      await page.waitForTimeout(520);
    }
  })() : null;
  // Keep the fixture player-like while ensuring the long pre-boss wave has
  // the canonical formation available on WebKit as well as Chromium. These
  // are ordinary card clicks against the current seeded formation; no HP,
  // clock, enemy state, or battle definition is changed. The capacity comes
  // from the actual formation instead of a proof-specific deployment count.
  // Contact-first proof actors stop the plan from adding another card once
  // the production runtime has acquired a human target, so a transient attack
  // cannot be erased by a later player action.
  const bossDeploymentLimit = bossKind
    ? new Set((save.formationSlots ?? []).filter(Boolean)).size
    : 0;
  const deploymentTrace = [];
  const recordDeployment = (entry) => {
    deploymentTrace.push(entry);
    recorder?.recordDeploymentAttempt(entry);
  };
  try {
    if (!bossKind) {
      // Compact fixtures can reorder the formation and start with less
      // command than an arbitrary third card costs. Select only a real,
      // currently deployable card instead of coupling the proof to a slot
      // index or a fixed resource snapshot.
      for (let slot = 0; slot < 3; slot += 1) {
        const deadline = Date.now() + battleTimeout;
        let deployed = false;
        recorder?.setAwaiting("formation-deployment", { slot: slot + 1, predicate: "a real ready formation card is accepted by production runtime" });
        while (!deployed && Date.now() < deadline) {
          if (page.isClosed()) throw new Error("Target page, context or browser has been closed during non-boss unit deployment");
          let selectedKind = null;
          const readyKinds = await page.evaluate(() => [...document.querySelectorAll(
            'button.unit-card[data-state="ready"][aria-disabled="false"]',
          )].map((card) => card.getAttribute("data-kind")).filter(Boolean)).catch(() => []);
          // When a focused contract names a canonical player proof unit,
          // prefer that currently-ready card first. This keeps the evidence
          // plan on the real formation without substituting a different
          // actor or changing the production battle rules.
          const openingCandidates = readyKinds
            .filter((kind) => kind !== proofUnitKind)
            .map((kind) => ({ kind, content: unitContentFor(kind) }))
            .sort((left, right) => {
              const leftDps = Number(left.content?.damage) / Math.max(.01, Number(left.content?.attackEvery) || 1);
              const rightDps = Number(right.content?.damage) / Math.max(.01, Number(right.content?.attackEvery) || 1);
              if (leftDps !== rightDps) return leftDps - rightDps;
              return Number(left.content?.cost ?? 0) - Number(right.content?.cost ?? 0);
            });
          selectedKind = (proofUnitFirst && slot === 0 && proofUnitKind
            ? readyKinds.find((kind) => kind === proofUnitKind)
            : slot > 0 && proofUnitKind
            ? readyKinds.find((kind) => kind === proofUnitKind)
            : null)
            ?? openingCandidates[0]?.kind
            ?? readyKinds[0]
            ?? null;
          // If the formation has only one affordable card at this moment, a
          // card that already completed its cooldown is still a real player
          // choice. Prefer a new kind, but never fail on a fixed uniqueness
          // assumption when the production roster exposes a valid ready card.
          if (!selectedKind && readyKinds.length > 0) selectedKind = readyKinds[0];
          if (!selectedKind) {
            await page.waitForTimeout(120);
            continue;
          }
          // Re-query by stable data-kind after reading the live collection.
          // WebKit can rerender the card rail between the nth() read and the
          // click; never let a stale positional locator turn that repaint
          // into a false product failure.
          const card = page.locator(`button.unit-card[data-kind="${selectedKind}"][data-state="ready"][aria-disabled="false"]`).first();
          if (await card.count().catch(() => 0) === 0 || !await card.isVisible().catch(() => false)) {
            await page.waitForTimeout(120);
            continue;
          }
          const kind = selectedKind;
          const before = await readBattleDeploymentDiagnostics(page, {
            requestedKind: kind,
            requestedSlot: slot + 1,
            phase: "before-click",
          });
          const requestedCard = before.cards?.find((entry) => entry.kind === kind);
          // The selector and the production runtime can cross a resource tick
          // between collection/read and click. A card that was ready in the
          // stale DOM but is already insufficient in the runtime must not be
          // treated as a failed player action or clicked again.
          if (requestedCard?.state !== "ready" || requestedCard.ariaDisabled === "true") {
            recordDeployment({
              slot: slot + 1,
              requestedKind: kind,
              action: "stale-ready-card",
              accepted: false,
              diagnostics: before,
            });
            await page.waitForTimeout(120);
            continue;
          }
          recordDeployment({ slot: slot + 1, requestedKind: kind, action: "before-click", diagnostics: before });
          let clickError = null;
          try {
            await click(page, card, `deploy ready battle unit ${slot + 1}`);
          } catch (error) {
            clickError = String(error);
          }
          const acceptance = await waitForDeploymentAcceptance(
            page,
            before,
            kind,
            slot + 1,
            clickError ? 1_000 : 5_000,
          );
          recordDeployment({
            slot: slot + 1,
            requestedKind: kind,
            action: clickError ? "click-error-after-state-check" : "after-click",
            clickError,
            accepted: acceptance.accepted,
            diagnostics: acceptance.diagnostics,
          });
           if (!acceptance.accepted) {
             throw new Error(`battle unit ${slot + 1} deployment was not accepted by production runtime deploymentDiagnostics=${JSON.stringify({ before, after: acceptance.diagnostics, clickError })}`);
           }
           recorder?.clearAwaiting();
           deployedKinds.add(kind);
          if (kind === proofUnitKind) proofUnitDeployed = true;
          deployed = true;
          }
          invariant(deployed, `no ready battle unit for slot ${slot + 1}`);
          if (slot === 0 && proofActor && proofUnitKind && !proofActorAttackObserved) {
            const proofActorDeadline = Date.now() + Math.min(6_000, battleTimeout);
            while (!proofActorAttackObserved && Date.now() < proofActorDeadline) {
              await observeProofActorAttack();
              if (proofActorAttackObserved) break;
              await page.waitForTimeout(120);
            }
          }
          await page.waitForTimeout(60);
        }
    } else {
      for (let deployment = 0; deployment < bossDeploymentLimit; deployment += 1) {
        let deployed = false;
        recorder?.setAwaiting("boss-frontline-deployment", { slot: deployment + 1, predicate: "a real ready boss-frontline card is accepted by production runtime" });
        for (let attempt = 0; attempt < 180; attempt += 1) {
          if (page.isClosed()) throw new Error("Target page, context or browser has been closed during boss unit deployment");
          const battleVisible = await page.locator('.game-shell[data-screen="battle"]').isVisible().catch(() => false);
          if (!battleVisible) break;
          if (await bossIsLive()) break;
          if (proofActorRequiresContactFirst && !proofActorAttackObserved) {
            const contactState = await waitForProofActorContact();
            if (proofActorAttackObserved || contactState?.hasHumanTarget === true) {
              break;
            }
          }
          const readyKinds = await page.evaluate(() => [...document.querySelectorAll(
            'button.unit-card[data-state="ready"][aria-disabled="false"]',
          )].map((card) => card.getAttribute("data-kind")).filter(Boolean)).catch(() => []);
          let card = null;
          const readyCandidates = readyKinds
            .map((kind, candidateIndex) => ({ kind, content: unitContentFor(kind), candidateIndex }))
            .filter(({ kind }) => !deployedKinds.has(kind));
          if (proofActorRequiresContactFirst && !proofActorAttackObserved) {
            readyCandidates.sort((left, right) => {
              const leftSupport = left.content?.aiProfile === "support" ? 0 : 1;
              const rightSupport = right.content?.aiProfile === "support" ? 0 : 1;
              if (leftSupport !== rightSupport) return leftSupport - rightSupport;
              const leftDps = Number(left.content?.damage) / Math.max(.01, Number(left.content?.attackEvery) || 1);
              const rightDps = Number(right.content?.damage) / Math.max(.01, Number(right.content?.attackEvery) || 1);
              if (leftDps !== rightDps) return leftDps - rightDps;
              return left.candidateIndex - right.candidateIndex;
            });
          }
          const selectedCandidate = readyCandidates[0] ?? null;
          if (selectedCandidate) {
            const kind = selectedCandidate.kind;
            card = page.locator(`button.unit-card[data-kind="${kind}"][data-state="ready"][aria-disabled="false"]`).first();
            const before = await readBattleDeploymentDiagnostics(page, {
              requestedKind: kind,
              requestedSlot: deployment + 1,
              phase: "before-click",
            });
            recordDeployment({ slot: deployment + 1, requestedKind: kind, action: "before-click", diagnostics: before });
            let clickError = null;
            try {
              await click(page, card, `deploy boss frontline unit ${deployment + 1}`);
            } catch (error) {
              clickError = String(error);
            }
            const acceptance = await waitForDeploymentAcceptance(
              page,
              before,
              kind,
              deployment + 1,
              clickError ? 1_000 : 5_000,
            );
            recordDeployment({
              slot: deployment + 1,
              requestedKind: kind,
              action: clickError ? "click-error-after-state-check" : "after-click",
              clickError,
              accepted: acceptance.accepted,
              diagnostics: acceptance.diagnostics,
            });
            if (clickError && !acceptance.accepted) {
              throw new Error(`boss frontline unit ${deployment + 1} deployment click failed deploymentDiagnostics=${JSON.stringify({ before, after: acceptance.diagnostics, clickError })}`);
            }
            if (acceptance.accepted) {
              recorder?.clearAwaiting();
              deployed = true;
              if (kind) deployedKinds.add(kind);
              if (kind === proofUnitKind) proofUnitDeployed = true;
              if (proofActorRequiresContactFirst && !proofActorAttackObserved) {
                const contactState = await waitForProofActorContact();
                if (proofActorAttackObserved || contactState?.hasHumanTarget === true) break;
              }
              break;
            }
          }
          await page.waitForTimeout(400);
        }
        // A proof actor's first contact is only the opening condition. Keep
        // using the real ready cards until the authored boss is live so the
        // production target set remains populated through the boss attack
        // window; stopping at contact alone can leave a live boss without a
        // human target after the opening three units are defeated.
        if (await bossIsLive()) break;
        if (!deployed) {
          const proofActorState = await readProofActorContactState();
          // A mounted actor with no currently deployable card is a valid
          // player state: wait for the actor's authored contact/attack and
          // let the sustain loop use the next real ready card. Do not invent
          // an extra deployment or turn temporary resource pressure into a
          // false production failure.
          if (proofActorState?.mounted === true || proofActorAttackObserved) break;
        }
        invariant(deployed, `boss frontline unit ${deployment + 1} never entered cooldown from the ready state`);
      }
    }
    bossDeploymentFinished = true;
    recorder?.mark("deployment-attempts-recorded", "completed", {
      count: deploymentTrace.length,
      attempts: deploymentTrace.map(({ slot, requestedKind, action, accepted, diagnostics }) => ({ slot, requestedKind, action, accepted: accepted ?? null, terminalState: diagnostics?.cards?.find((card) => card.kind === requestedKind)?.state ?? null })),
    });
    recorder?.mark("frontline-deployment-sequence-completed", "completed", {
      attemptedSlots: [...new Set(deploymentTrace.map((entry) => entry.slot))],
      terminalCardStates: deploymentTrace.filter((entry) => entry.action === "after-click").map((entry) => ({ slot: entry.slot, kind: entry.requestedKind, state: entry.diagnostics?.cards?.find((card) => card.kind === entry.requestedKind)?.state ?? null })),
    });
    if (proofActor) {
      recorder?.setAwaiting("proof-actor-attack", { actor: proofActor, predicate: "live state, historical runtime observation, or owned audio cue" });
      await page.waitForFunction(({ expectedKind, expectedCueId }) => {
        const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
        const actor = snapshot?.fighters?.find((fighter) => fighter.side === "zombie" && fighter.kind === expectedKind);
        const activity = window.__PHASE_G_COMBAT_ACTIVITY__ ?? {};
        const actorKey = `zombie:${expectedKind}`;
        const fighterMounted = Boolean(actor)
          || (activity.fighterActors ?? []).includes(actorKey);
        if (!fighterMounted) return false;
        const stateAttack = actor && (Number(actor.attack) > 0
          || Number(actor.attackWindup) > 0
          || Number(actor.attackSequence) > 0
          || actor.enemyVfx?.attacking === true
          || actor.enemyVfx?.attackWindup === true
          || ["attack", "warning"].includes(actor.enemyVfx?.phase));
        const audioAttack = expectedCueId
          && window.__ASHFALL_AUDIO_QA__?.getCueRequests?.()?.some((request) => request?.cueId === expectedCueId);
        const historicalAttack = (activity.attackingActors ?? []).includes(actorKey);
        const observed = historicalAttack || stateAttack === true || audioAttack === true;
        if (observed) {
          window.__PHASE_G_COMBAT_ACTIVITY__ = {
            ...activity,
            fighterActors: [...new Set([...(activity.fighterActors ?? []), actorKey])],
            attackingActors: [...new Set([...(activity.attackingActors ?? []), actorKey])],
          };
        }
        return observed;
      }, { expectedKind: proofActor, expectedCueId: proofActorAttackCueId }, { timeout: Math.min(battleTimeout, 45_000) });
      proofActorAttackObserved = true;
      recorder?.clearAwaiting();
      recorder?.mark("proof-actor-mounted-or-absent", "observed", { actor: proofActor, source: "final-proof-predicate" });
      recorder?.mark("proof-actor-attack-observed-or-not-required", "observed", { actor: proofActor, evidence: "final-proof-predicate" });
    }
    if (proofUnitKind && !proofUnitDeployed) await observeProofUnitAttack();
    if (proofUnitKind && !proofUnitDeployed) {
      recorder?.setAwaiting("proof-unit-deployment", { unitKind: proofUnitKind, predicate: "proof unit card leaves ready state" });
      await page.waitForFunction((expectedKind) => Boolean(
        document.querySelector(`button.unit-card[data-kind="${expectedKind}"][data-state="ready"][aria-disabled="false"]`),
      ), proofUnitKind, { timeout: Math.min(battleTimeout, 45_000) });
      const proofCard = page.locator(`button.unit-card[data-kind="${proofUnitKind}"][data-state="ready"][aria-disabled="false"]`).first();
      await proofCard.click({ timeout: 700 });
      await page.waitForFunction((expectedKind) => {
        const card = document.querySelector(`button.unit-card[data-kind="${expectedKind}"]`);
        return card?.getAttribute("data-state") !== "ready";
      }, proofUnitKind, { timeout: 5_000 });
      proofUnitDeployed = true;
      recorder?.clearAwaiting();
    }
    if (proofUnitKind && !proofUnitAttackObserved) {
      recorder?.setAwaiting("proof-unit-attack", { unitKind: proofUnitKind, predicate: "proof unit live or historical attack" });
      for (let attempt = 0; attempt < 120 && !proofUnitAttackObserved; attempt += 1) {
        await observeProofUnitAttack();
        if (proofUnitAttackObserved) break;
        await page.waitForTimeout(250);
      }
      invariant(proofUnitAttackObserved, `proof human actor did not attack: ${proofUnitKind}`);
      recorder?.clearAwaiting();
      recorder?.mark("proof-unit-deployed-and-attacked-or-not-required", "observed", { unitKind: proofUnitKind, evidence: "live-or-historical-runtime-state" });
    }
    if (manualAbilityKind) {
      recorder?.setAwaiting("manual-ability-action", { abilityKind: manualAbilityKind, predicate: "manual ability impact marker or receipt" });
      const abilityButton = page.locator(`button.manual-ability-ready.available[data-ability-kind="${manualAbilityKind}"][aria-disabled="false"]`).first();
      await page.waitForFunction((expectedKind) => Boolean(
        document.querySelector(`button.manual-ability-ready.available[data-ability-kind="${expectedKind}"][aria-disabled="false"]`),
      ), manualAbilityKind, { timeout: Math.min(battleTimeout, 45_000) });
      await abilityButton.click({ timeout: 700 });
      await page.waitForFunction((expectedKind) => {
        const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
        const markedEnemy = snapshot?.fighters?.some((fighter) => fighter.side === "zombie" && Number(fighter.marked) > 0);
        const receipt = snapshot?.manualAbilityReceipts?.some((entry) => entry?.kind === expectedKind && entry?.eventType === "impact");
        if (markedEnemy === true) {
          const activity = window.__PHASE_G_COMBAT_ACTIVITY__ ?? {};
          window.__PHASE_G_COMBAT_ACTIVITY__ = {
            ...activity,
            statusMarkers: [...new Set([...(activity.statusMarkers ?? []), "status-mission-target"])],
          };
        }
        return markedEnemy === true || receipt === true;
      }, manualAbilityKind, { timeout: Math.min(battleTimeout, 10_000) });
      recorder?.clearAwaiting();
      recorder?.mark("manual-vehicle-action-observed-or-not-required", "observed", { action: `manual-ability:${manualAbilityKind}` });
    }
    if (requireVehicleAction) {
      recorder?.setAwaiting("vehicle-action", { predicate: "vehicle barrage cue or authored crawler firing state" });
      for (let attempt = 0; attempt < 120 && !vehicleActionObserved; attempt += 1) {
        await observeVehicleAction();
        if (vehicleActionObserved) break;
        const crawler = page.locator('button.support-btn.barrage[data-state="ready"][aria-disabled="false"]').first();
        if (await crawler.count().catch(() => 0)) await crawler.click({ timeout: 700 }).catch(() => {});
        await page.waitForTimeout(250);
      }
      await page.waitForFunction(() => {
        const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
        const crawler = snapshot?.crawlerAbility;
        const activity = window.__PHASE_G_COMBAT_ACTIVITY__ ?? {};
        const runtimeCue = window.__ASHFALL_AUDIO_QA__?.getCueRequests?.()?.some((request) => request?.cueId === "weapon-barrage");
        const historicalAction = (activity.vehicleActions ?? []).includes("vehicle-barrage");
        return historicalAction === true
          || runtimeCue === true
          || crawler?.abilityId === "vehicle-barrage"
          && (crawler.phase === "firing" || crawler.damageTriggered === true || Number(crawler.hitCount ?? crawler.hits?.length ?? 0) > 0);
      }, null, { timeout: Math.min(battleTimeout, 45_000) });
      vehicleActionObserved = true;
      recorder?.clearAwaiting();
      recorder?.mark("manual-vehicle-action-observed-or-not-required", "observed", { action: "vehicle-barrage" });
    }
    await page.waitForFunction(() => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().fighters?.some((fighter) => fighter.side === "human" && fighter.hp > 0) === true, null, { timeout: battleTimeout });
    if (!bossKind || !waitForBossAttack) {
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
    await page.evaluate(() => window.__PHASE_G_COMBAT_OBSERVER__?.stop?.()).catch(() => {});
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
    ...(requestedCombatProofDurationMs ? { combatProofDurationMs: requestedCombatProofDurationMs } : {}),
    expectedEnemyKinds: [...new Set(definition?.timeline?.flatMap((wave) => wave.units) ?? [])],
    observedEnemyKinds: runtime.enemyKinds,
    fighterKinds: runtime.fighterKinds,
    deploymentTrace,
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
  if (onlyEngine && contract.engine !== onlyEngine) continue;
  await captureState(contract.engine, contract.viewport, "battle-extra", async (page) => ({
    stageId: contract.stageId,
    stageNumber: contract.stageNumber,
    stageName: contract.stageName,
    expectedEnemyKinds: [...new Set(v100BattleDefinitionFor(contract.stageId)?.timeline?.flatMap((wave) => wave.units) ?? [])],
    ...await battlePage(page, fullSave({ availableStageIds: V100_STAGE_IDS, completedStageIds: V100_STAGE_IDS.slice(0, contract.stageNumber - 1), formationUnitIds: contract.formationUnitIds, unitLevels: contract.unitLevels }), contract.stageName, { bossKind: contract.bossKind, proofActor: contract.proofActor ?? null, proofUnitKind: contract.proofUnitKind ?? null, proofUnitFirst: contract.proofUnitFirst === true, manualAbilityKind: contract.manualAbilityKind ?? null, requireVehicleAction: contract.requireVehicleAction === true, keepHumanTargetAlive: contract.keepHumanTargetAlive === true, waitForBossAttack: contract.waitForBossAttack !== false, combatProofDurationMs: contract.combatProofDurationMs ?? null }),
    variant: contract.variant,
  }), contract);
}

await closePhaseGBrowsers();

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
