import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";
import { createWebKitHostResourceTelemetry } from "./webkit-host-resource-telemetry.mjs";
import { createDefaultV100Save, normalizeV100Save, serializeV100Save } from "../app/v100Save.js";
import { V100_STAGE_IDS, V100_STAGES, V100_SUPPORTS, V100_UNITS } from "../app/v100Registry.js";
import { v100BattleDefinitionFor } from "../app/v100BattleAdapter.js";
import { v100EventPresentationFor } from "../app/v100EventPresentation.js";
import { V100_STORY_EVENTS } from "../app/v100StoryEvents.js";
import { enemyAiProfileFor } from "../app/combatAiProfiles.js";
import { enemyContentFor } from "../app/content/enemyCatalog.js";
import { unitContentFor } from "../app/content/unitCatalog.js";
import { deriveV100ProductionEnemyCoverage, V100_REPRESENTATIVE_COMBAT_CONTRACT } from "../app/v100PhaseGContract.js";
import { enemyCombatCueFor, weaponCueForUnit } from "../app/productionAudio.js";
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
const COMBAT_CAUSAL_CONVERGENCE_MIN_DWELL_MS = 2_400;
const COMBAT_CAUSAL_CONVERGENCE_MIN_SAMPLES = 8;
const COMBAT_CAUSAL_PAGE_TRANSACTION_TIMEOUT_MS = 2_000;
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
  { variant: "stage06-spitter-seal", engine: "webkit", viewport: extraBattleViewports[0], stageNumber: 6, bossKind: null, proofActor: "spitter", proofUnitKind: "ranger", proofUnitFirst: true, presentationQuiescence: true, presentationQuiescenceUntilBattleTime: 34, formationUnitIds: ["unit-hachi", "unit-mizuchi", "unit-babayaga", "unit-paisen", "unit-nao", "unit-kumaverson", "unit-tatara"] },
  // The compact WebKit boss route establishes an opening frontline with the
  // first three currently ready cards, then continues real redeploy actions
  // as cards recover. It does not force a fixed DOM index or mutate battle
  // state; the boss gate and combat proof remain fully production-owned.
  { variant: "stage24-panther-commander", engine: "webkit", viewport: extraBattleViewports[1], stageNumber: 24, bossKind: "futago", proofActor: "red-panther-commander", waitForBossAttack: false, combatProofDurationMs: 4_800, presentationQuiescence: true, unitLevels: MAXED_QA_UNIT_LEVELS, formationUnitIds: ["unit-nao", "unit-hachi", "unit-mizuchi", "unit-paisen", "unit-babayaga", "unit-kumaverson", "unit-tatara"] },
  // Start every boss fixture with the same low-cost opening a player can use
  // to establish a frontline before the expensive cards recover. The
  // interaction below selects the first currently ready cards, so the
  // compact WebKit proof does not depend on a fixed card index.
  // The formation still contains seven canonical V1 units; this is a QA
  // interaction plan, not a gameplay or balance change.
  { variant: "stage25-president", engine: "webkit", viewport: extraBattleViewports[2], stageNumber: 25, bossKind: "mugarian-president-mutated", proofActor: "red-panther-shield", presentationQuiescence: true, formationUnitIds: ["unit-gantetsu", "unit-nao", "unit-kumaverson", "unit-paisen", "unit-babayaga", "unit-mizuchi", "unit-tatara"], unitLevels: MAXED_QA_UNIT_LEVELS },
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
const phaseGBrowserMetadata = new WeakMap();
let phaseGBrowserSessionOrdinal = 0;
const phaseGCheckpointRecorders = new Set();
const pageCheckpointRecorders = new WeakMap();
const phaseGPageInputTails = new WeakMap();

const BATTLE_EXTRA_CHECKPOINTS = Object.freeze([
  "route-opened",
  "formation-visible",
  "battle-mounted-lifecycle-active",
  "combat-observer-started",
  "contract-identified",
  "deployment-attempts-recorded",
  "presentation-quiescence-released-or-not-required",
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
const DEPLOYMENT_QUEUE_CAPACITY = 3;
const DEPLOYMENT_POINTER_PREFLIGHT_DEADLINE_MS = 5_000;
const DEPLOYMENT_POINTER_DIAGNOSTIC_READ_TIMEOUT_MS = 1_000;
const DEPLOYMENT_POINTER_SAMPLE_SEPARATION_MS = 40;
const DEPLOYMENT_POINTER_MAX_SAMPLES = 12;
const DEPLOYMENT_POINTER_DISPATCH_DEADLINE_MS = 2_000;
const DEPLOYMENT_POINTER_ACCEPTANCE_DEADLINE_MS = 5_000;
const DEPLOYMENT_POINTER_STABILITY_EPSILON_PX = 0.75;

function deploymentEligibilityForCard(card, battle) {
  const reasons = [];
  const cost = card?.cost === null || card?.cost === undefined ? Number.NaN : Number(card.cost);
  const energy = Number(battle?.energy);
  const cooldown = card?.kind ? Number(battle?.deployCooldowns?.[card.kind]) : Number.NaN;
  const queue = Array.isArray(battle?.deployQueue) ? battle.deployQueue : null;
  const domReady = card?.rect?.visible === true
    && card?.state === "ready"
    && card?.ariaDisabled === "false"
    && card?.disabled !== true;
  const liveBattle = battle?.screen === "battle"
    && battle.running === true
    && battle.paused !== true
    && battle.over !== true
    && battle.won !== true;
  if (!card?.kind) reasons.push("missing-kind");
  if (!domReady) reasons.push("dom-not-deployable");
  if (!liveBattle) reasons.push("runtime-not-live");
  if (!queue || queue.length >= DEPLOYMENT_QUEUE_CAPACITY) reasons.push("deployment-queue-full");
  if (!Number.isFinite(cost)) reasons.push("cost-not-finite");
  if (!Number.isFinite(energy) || energy < cost) reasons.push("insufficient-energy");
  if (!Number.isFinite(cooldown) || cooldown !== 0) reasons.push("cooldown-not-zero");
  return {
    eligible: reasons.length === 0,
    reasons,
    domReady,
    liveBattle,
    queueLength: queue?.length ?? null,
    queueCapacity: DEPLOYMENT_QUEUE_CAPACITY,
    cost: Number.isFinite(cost) ? cost : null,
    energy: Number.isFinite(energy) ? energy : null,
    cooldown: Number.isFinite(cooldown) ? cooldown : null,
  };
}

function deploymentCandidatesFromDiagnostics(diagnostics, excludedKinds = new Set()) {
  const excluded = excludedKinds instanceof Set ? excludedKinds : new Set(excludedKinds);
  return (diagnostics?.cards ?? [])
    .filter((card) => !excluded.has(card.kind) && card.actionability?.eligible === true);
}

function deploymentCardIdentity(card) {
  if (!card) return null;
  return {
    nodeId: card.nodeId ?? null,
    kind: card.kind ?? null,
    slot: card.slot ?? null,
  };
}

function sameDeploymentCardIdentity(left, right) {
  return Boolean(left && right)
    && left.nodeId === right.nodeId
    && left.kind === right.kind
    && left.slot === right.slot;
}

function sameNormalizedDeploymentOwner(left, right) {
  if (left === null && right === null) return true;
  return sameDeploymentCardIdentity(left, right);
}

function stableDeploymentRect(left, right) {
  if (!left || !right) return false;
  return ["x", "y", "width", "height"].every((key) => (
    Number.isFinite(Number(left[key]))
    && Number.isFinite(Number(right[key]))
    && Math.abs(Number(left[key]) - Number(right[key])) <= DEPLOYMENT_POINTER_STABILITY_EPSILON_PX
  ));
}

function deploymentPointerPreconditionDecision({ expectedIdentity, samples = [], terminal = null, lifecycle = null } = {}) {
  if (lifecycle?.lost === true) {
    return { status: "lifecycle-loss", pointerCount: 0, retry: false, reason: lifecycle.reason ?? "independent-lifecycle-loss" };
  }
  const expected = expectedIdentity ?? deploymentCardIdentity(samples[0]?.card);
  if (terminal) {
    if (samples.length < 2) {
      return { status: "QA_HARNESS_POINTER_PREFLIGHT_DIVERGENCE", pointerCount: 0, reason: "two-consecutive-task-turn-samples-required" };
    }
    const sampleDecision = deploymentPointerPreconditionDecision({ expectedIdentity: expected, samples });
    if (sampleDecision.status !== "ready-for-pointer") return sampleDecision;
  }
  const current = terminal ?? samples.at(-1) ?? null;
  if (!expected || !current?.card) {
    return { status: "candidate-invalidated-before-pointer", pointerCount: 0, reason: "candidate-missing" };
  }
  const currentIdentity = deploymentCardIdentity(current.card);
  if (!sameDeploymentCardIdentity(expected, currentIdentity)
    || current.card.actionability?.eligible !== true) {
    return {
      status: "candidate-invalidated-before-pointer",
      pointerCount: 0,
      reason: !sameDeploymentCardIdentity(expected, currentIdentity) ? "candidate-identity-changed" : "candidate-ineligible",
      expectedIdentity: expected,
      actualIdentity: currentIdentity,
    };
  }
  const previous = terminal ? samples.at(-1) : samples.at(-2);
  const previousIdentity = deploymentCardIdentity(previous?.card);
  const schedulerStateValid = (sample) => ["pending", "observed"].includes(sample?.schedulerProbe?.status);
  const taskTurnEvidenceValid = terminal || Boolean(
    Number.isFinite(Number(previous?.sampleOrdinal))
      && Number.isFinite(Number(current?.sampleOrdinal))
      && Number(current.sampleOrdinal) > Number(previous.sampleOrdinal)
      && Number.isFinite(Number(current?.hostTurn?.elapsedMs))
      && Number(current.hostTurn.elapsedMs) >= DEPLOYMENT_POINTER_SAMPLE_SEPARATION_MS - 1
      && Number.isFinite(Number(previous?.sampledAtWallTimeMs))
      && Number.isFinite(Number(current?.sampledAtWallTimeMs))
      && Number(current.sampledAtWallTimeMs) - Number(previous.sampledAtWallTimeMs) >= 16
      && Number.isFinite(Number(previous?.sampledAtPerformanceMs))
      && Number.isFinite(Number(current?.sampledAtPerformanceMs))
      && Number(current.sampledAtPerformanceMs) - Number(previous.sampledAtPerformanceMs) >= 16
      && schedulerStateValid(previous)
      && schedulerStateValid(current)
  );
  const actionable = current.card.rect?.visible === true
    && Number(current.card.rect.width) >= 28
    && Number(current.card.rect.height) >= 24
    && current.card.disabled !== true
    && current.card.centerInCard === true
    && current.card.centerInViewport === true
    && current.card.centerInRail === true
    && current.card.viewportIntersection === true
    && current.card.railIntersection === true
    && current.card.hitOwnerMatches === true
    && current.card.pointerEvents !== "none";
  if (!actionable) {
    return {
      status: terminal ? "coordinate-invalidated-before-pointer" : "QA_HARNESS_POINTER_PREFLIGHT_DIVERGENCE",
      pointerCount: 0,
      reason: current.card.hitOwnerMatches !== true
        ? "pointer-owner-mismatch"
        : current.card.centerInViewport !== true || current.card.centerInRail !== true
          ? "candidate-offviewport"
          : "candidate-not-actionable",
    };
  }
  if (!previous
    || !sameDeploymentCardIdentity(expected, previousIdentity)
    || previous.card.actionability?.eligible !== true
    || previous.card.rect?.visible !== true
    || Number(previous.card.rect.width) < 28
    || Number(previous.card.rect.height) < 24
    || previous.card.disabled === true
    || previous.card.centerInCard !== true
    || previous.card.centerInViewport !== true
    || previous.card.centerInRail !== true
    || previous.card.viewportIntersection !== true
    || previous.card.railIntersection !== true
    || previous.card.hitOwnerMatches !== true
    || previous.card.pointerEvents === "none"
    || !stableDeploymentRect(previous.card.rect, current.card.rect)
    || Math.abs(Number(previous.card.rail?.scrollLeft ?? 0) - Number(current.card.rail?.scrollLeft ?? 0)) > DEPLOYMENT_POINTER_STABILITY_EPSILON_PX
    || !taskTurnEvidenceValid) {
    return {
      status: terminal ? "coordinate-invalidated-before-pointer" : "QA_HARNESS_POINTER_PREFLIGHT_DIVERGENCE",
      pointerCount: 0,
      reason: taskTurnEvidenceValid ? "candidate-not-stable" : "scheduler-independent-sample-separation-missing",
    };
  }
  return {
    status: "ready-for-pointer",
    pointerCount: 0,
    identity: expected,
    point: current.card.center,
  };
}

function deploymentPointerOutcome({ dispatch = {}, receipts = [], expectedIdentity, point, attemptId = null, acceptance = null, post = null } = {}) {
  if (dispatch.status === "timeout") return { status: "BROWSER_POINTER_DISPATCH_TIMEOUT", pointerCount: 1, retry: false };
  if (dispatch.status === "lifecycle-error") return { status: "lifecycle-loss", pointerCount: 1, retry: false };
  if (dispatch.status !== "completed") return { status: "BROWSER_POINTER_API_ERROR", pointerCount: 1, retry: false };
  const correlated = receipts.filter((receipt) => (
    receipt?.attemptId === attemptId
    && receipt?.button === 0
    && Number.isFinite(Number(receipt.clientX))
    && Number.isFinite(Number(receipt.clientY))
    && Math.abs(Number(receipt.clientX) - Number(point?.x)) <= 1
    && Math.abs(Number(receipt.clientY) - Number(point?.y)) <= 1
    && Number(receipt.elapsedMs) >= 0
    && receipt.elapsedSinceDispatchStartMs !== null
    && receipt.elapsedSinceDispatchStartMs !== undefined
    && Number(receipt.elapsedSinceDispatchStartMs) >= 0
    && (!Number.isFinite(Number(dispatch.elapsedMs)) || Number(receipt.elapsedMs) <= Number(dispatch.elapsedMs) + 1_000)
    && (!Number.isFinite(Number(dispatch.elapsedMs)) || Number(receipt.elapsedSinceDispatchStartMs) <= Number(dispatch.elapsedMs) + 1_000)
  ));
  const orderedTypes = correlated.map((receipt) => receipt.type);
  const exactOrder = correlated.length === 3
    && orderedTypes[0] === "pointerdown"
    && orderedTypes[1] === "pointerup"
    && orderedTypes[2] === "click";
  const allTrusted = correlated.every((receipt) => receipt.isTrusted === true);
  const exactMouseSequence = correlated.every((receipt) => receipt.pointerType === "mouse"
      && Number.isFinite(Number(receipt.sequence))
      && Number.isFinite(Number(receipt.elapsedMs))
      && Number.isFinite(Number(receipt.elapsedSinceDispatchStartMs)))
    && correlated.every((receipt, index) => index === 0
      || Number(receipt.sequence) > Number(correlated[index - 1].sequence))
    && correlated.every((receipt, index) => index === 0
      || Number(receipt.elapsedMs) >= Number(correlated[index - 1].elapsedMs))
    && correlated.every((receipt, index) => index === 0
      || Number(receipt.elapsedSinceDispatchStartMs) >= Number(correlated[index - 1].elapsedSinceDispatchStartMs));
  const oneOtherOwner = exactOrder
    && allTrusted
    && exactMouseSequence
    && correlated.every((receipt) => sameNormalizedDeploymentOwner(correlated[0]?.owner ?? null, receipt.owner ?? null))
    && !sameDeploymentCardIdentity(expectedIdentity, correlated[0]?.owner);
  if (oneOtherOwner) {
    return { status: "PRODUCT_ACTIONABILITY_SURFACE_DIVERGENCE", pointerCount: 1, retry: false };
  }
  if (!exactOrder
    || !allTrusted
    || !exactMouseSequence
    || correlated.some((receipt) => !sameDeploymentCardIdentity(expectedIdentity, receipt.owner))) {
    return { status: "BROWSER_POINTER_RECEIPT_MISSING", pointerCount: 1, retry: false };
  }
  if (correlated.some((receipt) => (
    !sameDeploymentCardIdentity(expectedIdentity, receipt.preHandler?.identity)
    || receipt.preHandler?.eligible !== true
    || !sameDeploymentCardIdentity(expectedIdentity, deploymentCardIdentity(receipt.preHandler?.card))
    || deploymentEligibilityForCard(receipt.preHandler?.card, receipt.preHandler?.battle).eligible !== true
  ))) {
    return { status: "candidate-invalidated-during-pointer", pointerCount: 1, retry: false };
  }
  if (correlated.some((receipt) => !sameDeploymentCardIdentity(expectedIdentity, receipt.preHandler?.hitOwner))) {
    return { status: "coordinate-invalidated-during-pointer", pointerCount: 1, retry: false };
  }
  if (acceptance === null) return { status: "receipt-verified", pointerCount: 1, retry: false };
  if (acceptance !== true) {
    if (post?.lifecycleLost === true) return { status: "lifecycle-loss", pointerCount: 1, retry: false };
    if (post?.candidateMissing === true) return { status: "candidate-invalidated-during-pointer", pointerCount: 1, retry: false };
    if (post?.card && !sameDeploymentCardIdentity(expectedIdentity, deploymentCardIdentity(post.card))) {
      return { status: "candidate-invalidated-during-pointer", pointerCount: 1, retry: false };
    }
    if (post?.card && (post.card.hitOwnerMatches !== true || !stableDeploymentRect(post.card.rect, post.beforeRect))) {
      return { status: "coordinate-invalidated-during-pointer", pointerCount: 1, retry: false };
    }
    return { status: "PRODUCT_DEPLOYMENT_ACCEPTANCE_MISSING", pointerCount: 1, retry: false };
  }
  return { status: "accepted", pointerCount: 1, retry: false };
}

function cloneDiagnosticValue(value) {
  return value === undefined ? null : JSON.parse(JSON.stringify(value));
}

function deepFreezeDiagnosticValue(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreezeDiagnosticValue(nested);
  return Object.freeze(value);
}

function isDeepFrozenDiagnosticValue(value) {
  if (!value || typeof value !== "object") return true;
  return Object.isFrozen(value) && Object.values(value).every(isDeepFrozenDiagnosticValue);
}

function freezeCheckpointFailureCursor(snapshotValue) {
  return deepFreezeDiagnosticValue(cloneDiagnosticValue(snapshotValue ?? {}));
}

function buildCheckpointFailurePayload(snapshotValue, details = {}) {
  const frozen = freezeCheckpointFailureCursor(snapshotValue);
  const awaitingAtFailure = cloneDiagnosticValue(frozen.awaiting ?? null);
  const lastCompletedBeforeFailure = frozen.lastCompletedCheckpoint ?? null;
  const unresolvedBeforeFailure = [...(frozen.unresolvedCheckpoints ?? [])];
  return {
    ...frozen,
    awaitingAtFailure,
    lastCompletedBeforeFailure,
    unresolvedBeforeFailure,
    failure: {
      ...cloneDiagnosticValue(details),
      awaitingAtFailure,
      lastCompletedBeforeFailure,
      unresolvedBeforeFailure,
      preFinalizationCheckpointSnapshot: frozen,
    },
  };
}

function checkpointRecorderFor(page) {
  return pageCheckpointRecorders.get(page) ?? null;
}

function createBattleExtraCheckpointRecorder({ contract, engineName, viewport, context, page, browser, browserSession = null, hostResourceTelemetry = null }) {
  const startedAt = Date.now();
  const checkpointLog = [];
  const checkpointState = new Map();
  const eventLog = [];
  const lifecycle = [];
  const deploymentAttempts = [];
  let awaiting = null;
  let latestReadableState = null;
  let phaseGCombatSnapshotProfile = null;
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
    if (state !== undefined && state !== null) latestReadableState = state;
  };

  const setPhaseGCombatSnapshotProfile = (profile) => {
    phaseGCombatSnapshotProfile = cloneDiagnosticValue(profile);
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
      browserSession: cloneDiagnosticValue(browserSession),
      hostResourceTelemetry: cloneDiagnosticValue(hostResourceTelemetry?.reference() ?? null),
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
        presentationQuiescence: contract.presentationQuiescence === true,
        presentationQuiescenceUntilBattleTime: contract.presentationQuiescenceUntilBattleTime ?? null,
        formationUnitIds: contract.formationUnitIds ?? [],
      },
      checkpoints,
      checkpointLog: [...checkpointLog],
      lastCompletedCheckpoint: [...checkpointState.values()].filter((entry) => RESOLVED_CHECKPOINT_STATUSES.has(entry.status)).sort((left, right) => left.sequence - right.sequence).at(-1)?.name ?? null,
      unresolvedCheckpoints: checkpoints.filter((entry) => !RESOLVED_CHECKPOINT_STATUSES.has(entry.status)).map((entry) => entry.name),
      awaiting,
      deploymentAttempts: [...deploymentAttempts],
      phaseGCombatSnapshotProfile,
      latestReadableState,
      lifecycle: [...lifecycle],
      events: [...eventLog],
    };
  };

  const finalizeFailure = (details = {}) => {
    if (failurePayload) return;
    failurePayload = buildCheckpointFailurePayload(snapshot(), details);
  };

  async function writeFailureFile() {
    if (!failureFilePath || !failurePayload) return;
    await writeFile(failureFilePath, `${JSON.stringify(failurePayload, null, 2)}\n`).catch(() => {});
  }

  const persistFailure = async ({ label, error, failureState, diagnostics, allowPageRpc = true }) => {
    const safeLabel = `${contract.variant}-${engineName}-${viewportLabel(viewport)}`;
    const diagnosticsDir = path.join(evidenceDir, "diagnostics");
    const structuredError = error && typeof error === "object" ? {
      name: error.name ?? null,
      code: error.code ?? null,
      pointerCount: error.pointerCount ?? null,
      terminalInputFailure: error.phaseGTerminalInputFailure === true,
      pointerEvidence: cloneDiagnosticValue(error.phaseGPointerEvidence ?? null),
      receiptCleanupFailure: cloneDiagnosticValue(error.phaseGReceiptCleanupFailure ?? null),
    } : null;
    await mkdir(diagnosticsDir, { recursive: true });
    failureFilePath = path.join(diagnosticsDir, `${safeLabel}.json`);
    failureScreenshotPath = path.join(diagnosticsDir, `${safeLabel}.png`);
    setLatestReadableState(failureState);
    finalizeFailure({ label, error: String(error), structuredError, diagnostics });
    try {
      if (allowPageRpc && !page.isClosed()) await page.screenshot({ path: failureScreenshotPath, animations: "disabled" });
      else failureScreenshotPath = null;
    } catch {
      failureScreenshotPath = null;
    }
    failurePayload.failure = {
      ...failurePayload.failure,
      structuredError,
      screenshot: failureScreenshotPath ? relativeEvidence(failureScreenshotPath) : null,
    };
    await writeFailureFile();
    return {
      file: relativeEvidence(failureFilePath),
      screenshot: failureScreenshotPath ? relativeEvidence(failureScreenshotPath) : null,
      ...failurePayload,
    };
  };

  const recorder = {
    attach,
    mark,
    markOnce,
    setAwaiting,
    clearAwaiting,
    setLatestReadableState,
    setPhaseGCombatSnapshotProfile,
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
    browserSession: cloneDiagnosticValue(browserSession),
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

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function phaseGBrowserLifecyclePolicy(engineName, state) {
  const isolated = engineName === "webkit" && state === "battle-extra";
  return Object.freeze({
    engineName,
    state,
    isolation: isolated ? "fresh-process-per-capture" : "shared-per-engine",
    closeExistingBeforeCapture: isolated,
    closeAfterCapture: isolated,
    maxCapturesPerBrowser: isolated ? 1 : null,
  });
}

function proofActorTargetContinuityDecision({
  bossDeploymentFinished = false,
  bossEngaged = false,
  keepHumanTargetAlive = false,
  proofActorRequiresContactFirst = false,
  proofActorAttackObserved = false,
  liveHumanTargetCount = 0,
} = {}) {
  const normalizedLiveHumanTargetCount = Number.isFinite(Number(liveHumanTargetCount))
    ? Math.max(0, Number(liveHumanTargetCount))
    : 0;
  const proofActorContactPlanPending = Boolean(proofActorRequiresContactFirst) && !proofActorAttackObserved;
  const targetSurvivalPlanPending = Boolean(bossEngaged)
    && normalizedLiveHumanTargetCount < 2
    && (Boolean(keepHumanTargetAlive) || proofActorContactPlanPending);
  return Object.freeze({
    proofActorContactPlanPending,
    targetSurvivalPlanPending,
    allowSustainRedeploy: Boolean(bossDeploymentFinished)
      && (!proofActorContactPlanPending || targetSurvivalPlanPending),
  });
}

function combatCausalConvergenceDecision(proof, {
  elapsedMs = 0,
  minimumDwellMs = COMBAT_CAUSAL_CONVERGENCE_MIN_DWELL_MS,
  minimumSamples = COMBAT_CAUSAL_CONVERGENCE_MIN_SAMPLES,
} = {}) {
  const stages = proof?.stages ?? {};
  const sampleCount = Number(proof?.sampleCount) || 0;
  const allStagesComplete = stages.source === true
    && stages.travelOrContact === true
    && stages.targetReaction === true
    && stages.audio === true;
  const dwellComplete = Number(elapsedMs) >= minimumDwellMs;
  const samplesComplete = sampleCount >= minimumSamples;
  return Object.freeze({
    accepted: proof?.ok === true && allStagesComplete && dwellComplete && samplesComplete,
    proofOk: proof?.ok === true,
    allStagesComplete,
    dwellComplete,
    samplesComplete,
    elapsedMs: Number(elapsedMs) || 0,
    sampleCount,
    minimumDwellMs,
    minimumSamples,
  });
}

function postQuiescenceExactActorDecision(proofEpoch, {
  requiredActorKeys = [],
} = {}) {
  const required = [...new Set(requiredActorKeys.filter((key) => typeof key === "string" && key.includes(":")))];
  if (required.length === 0) {
    return Object.freeze({
      accepted: true,
      schemaOk: proofEpoch === null || proofEpoch === undefined || proofEpoch?.schema === "v100-phase-g-post-quiescence-proof/v5",
      proofCompletedAtPageTime: null,
      withinReleaseDeadline: true,
      requiredActorKeys: [],
      observedActorKeys: [],
      missingActorKeys: [],
      actors: [],
    });
  }
  const schemaOk = proofEpoch?.schema === "v100-phase-g-post-quiescence-proof/v5";
  const releaseAnchorExpectedKey = required[0] ?? null;
  const releaseAnchor = schemaOk ? proofEpoch.releaseAnchor ?? null : null;
  const releaseAnchorOk = releaseAnchor?.handoffValid === true
    && releaseAnchor.actorKey === releaseAnchorExpectedKey
    && releaseAnchor.releaseMode === "unconsumed-production-windup"
    && releaseAnchor.fighterId !== null
    && releaseAnchor.fighterId !== undefined
    && Number.isFinite(Number(releaseAnchor.baselineAttackSequence))
    && releaseAnchor.targetId !== null
    && releaseAnchor.targetId !== undefined
    && releaseAnchor.targetAlive === true
    && Number(releaseAnchor.attackWindupSeconds) > 0
    && Number.isFinite(Number(releaseAnchor.handoffAtBattleTime))
    && Number.isFinite(Number(releaseAnchor.handoffAtPageTime))
    && Number(releaseAnchor.handoffAtPageTime) === Number(proofEpoch.visibleProofStartedAt);
  const actors = required.map((actorKey) => {
    const splitAt = actorKey.indexOf(":");
    const side = actorKey.slice(0, splitAt);
    const kind = actorKey.slice(splitAt + 1);
    const actor = schemaOk
      ? proofEpoch.actors?.find((candidate) => candidate?.side === side && candidate?.kind === kind) ?? null
      : null;
    const baseline = actor?.fighterBaselines?.find((candidate) => (
      String(candidate?.fighterId) === String(actor?.selectedFighterId)
    )) ?? null;
    const selectedIdentity = actor?.selectedFighterId !== null
      && actor?.selectedFighterId !== undefined
      && String(actor?.observedFighterId) === String(actor.selectedFighterId)
      && String(baseline?.fighterId) === String(actor.selectedFighterId);
    const sequenceAdvanced = Number.isFinite(Number(actor?.observedAttackSequence))
      && Number.isFinite(Number(baseline?.baselineAttackSequence))
      && Number(actor.observedAttackSequence) > Number(baseline.baselineAttackSequence);
    const expectedTargetSide = side === "human" ? "zombie" : side === "zombie" ? "human" : null;
    const targetValid = actor?.targetId !== null
      && actor?.targetId !== undefined
      && expectedTargetSide !== null
      && actor?.targetSide === expectedTargetSide
      && actor?.targetAlive === true;
    const targetEvidenceSourceValid = actorKey === releaseAnchorExpectedKey
      ? ["live-attacker-target", "release-anchor-bound-windup"].includes(actor?.targetEvidenceSource)
      : actor?.targetEvidenceSource === "live-attacker-target";
    const sourceAliveAtObservation = actor?.sourceAliveAtObservation === true;
    const observedAtPageTime = actor?.observedAtPageTime ?? null;
    const audioObservedAtPageTime = actor?.audioObservedAtPageTime ?? null;
    const observedAtPageTimeFinite = observedAtPageTime !== null
      && Number.isFinite(Number(observedAtPageTime));
    const audioObservedAtPageTimeFinite = audioObservedAtPageTime !== null
      && Number.isFinite(Number(audioObservedAtPageTime));
    const cueValid = actor?.cueId
      ? actor?.audioObserved === true && audioObservedAtPageTimeFinite
      : true;
    const releaseAnchorIdentityValid = actorKey !== releaseAnchorExpectedKey || (
      releaseAnchorOk
      && String(actor?.selectedFighterId) === String(releaseAnchor.fighterId)
      && Number(baseline?.baselineAttackSequence) === Number(releaseAnchor.baselineAttackSequence)
      && Number(actor?.observedAttackSequence) === Number(releaseAnchor.baselineAttackSequence) + 1
      && String(actor?.targetId) === String(releaseAnchor.targetId)
    );
    const releaseAnchorCommitWindowSeconds = releaseAnchorOk
      ? Math.max(0.8, Number(releaseAnchor.attackWindupSeconds) + 0.5)
      : null;
    const releaseAnchorCommitDeltaSeconds = actorKey === releaseAnchorExpectedKey
      && releaseAnchorOk
      && Number.isFinite(Number(actor?.observedAtBattleTime))
      ? Number(actor.observedAtBattleTime) - Number(releaseAnchor.handoffAtBattleTime)
      : null;
    const releaseAnchorCommitBoundValid = actorKey !== releaseAnchorExpectedKey || (
      Number.isFinite(Number(releaseAnchorCommitDeltaSeconds))
      && Number(releaseAnchorCommitDeltaSeconds) >= 0
      && Number(releaseAnchorCommitDeltaSeconds) <= Number(releaseAnchorCommitWindowSeconds)
    );
    const proofCompletedAtPageTime = observedAtPageTimeFinite
      && (actor?.cueId ? audioObservedAtPageTimeFinite : true)
      ? Math.max(Number(observedAtPageTime), actor?.cueId ? Number(audioObservedAtPageTime) : Number(observedAtPageTime))
      : null;
    const visibleProofStartedAtFinite = proofEpoch?.visibleProofStartedAt !== null
      && proofEpoch?.visibleProofStartedAt !== undefined
      && Number.isFinite(Number(proofEpoch.visibleProofStartedAt));
    const visibleProofDeadlineAtFinite = proofEpoch?.visibleProofDeadlineAt !== null
      && proofEpoch?.visibleProofDeadlineAt !== undefined
      && Number.isFinite(Number(proofEpoch.visibleProofDeadlineAt));
    const eventTimeValid = proofCompletedAtPageTime !== null
      && Number.isFinite(Number(proofCompletedAtPageTime))
      && visibleProofStartedAtFinite
      && visibleProofDeadlineAtFinite
      && Number(proofCompletedAtPageTime) >= Number(proofEpoch.visibleProofStartedAt)
      && Number(proofCompletedAtPageTime) <= Number(proofEpoch.visibleProofDeadlineAt);
    const accepted = actor?.observedPostEpochAttack === true
      && sourceAliveAtObservation
      && selectedIdentity
      && sequenceAdvanced
      && targetValid
      && targetEvidenceSourceValid
      && cueValid
      && releaseAnchorIdentityValid
      && releaseAnchorCommitBoundValid
      && eventTimeValid;
    return Object.freeze({
      actorKey,
      accepted,
      actorPresent: Boolean(actor),
      actorAlive: actor?.actorAlive === true,
      sourceAliveAtObservation,
      selectedIdentity,
      sequenceAdvanced,
      targetValid,
      targetEvidenceSourceValid,
      cueValid,
      releaseAnchorIdentityValid,
      releaseAnchorCommitBoundValid,
      releaseAnchorCommitDeltaSeconds,
      releaseAnchorCommitWindowSeconds,
      eventTimeValid,
      selectedFighterId: actor?.selectedFighterId ?? null,
      observedFighterId: actor?.observedFighterId ?? null,
      baselineAttackSequence: baseline?.baselineAttackSequence ?? null,
      observedAttackSequence: actor?.observedAttackSequence ?? null,
      observedAtBattleTime: actor?.observedAtBattleTime ?? null,
      observedAtPageTime: actor?.observedAtPageTime ?? null,
      targetId: actor?.targetId ?? null,
      targetSide: actor?.targetSide ?? null,
      targetAlive: actor?.targetAlive ?? null,
      targetEvidenceSource: actor?.targetEvidenceSource ?? null,
      cueId: actor?.cueId ?? null,
      audioObserved: actor?.audioObserved ?? null,
      audioObservedAtPageTime: actor?.audioObservedAtPageTime ?? null,
      proofCompletedAtPageTime,
    });
  });
  const observedActorKeys = actors.filter((actor) => actor.accepted).map((actor) => actor.actorKey);
  const proofCompletionTimes = actors.map((actor) => actor.proofCompletedAtPageTime ?? null);
  const proofCompletedAtPageTime = proofCompletionTimes.length === actors.length
    && proofCompletionTimes.every((time) => time !== null && Number.isFinite(Number(time)))
    ? Math.max(...proofCompletionTimes.map(Number))
    : null;
  const withinReleaseDeadline = proofCompletedAtPageTime !== null
    && Number.isFinite(Number(proofCompletedAtPageTime))
    && proofEpoch?.visibleProofStartedAt !== null
    && proofEpoch?.visibleProofStartedAt !== undefined
    && Number.isFinite(Number(proofEpoch.visibleProofStartedAt))
    && proofEpoch?.visibleProofDeadlineAt !== null
    && proofEpoch?.visibleProofDeadlineAt !== undefined
    && Number.isFinite(Number(proofEpoch.visibleProofDeadlineAt))
    && Number(proofCompletedAtPageTime) >= Number(proofEpoch.visibleProofStartedAt)
    && Number(proofCompletedAtPageTime) <= Number(proofEpoch.visibleProofDeadlineAt);
  return Object.freeze({
    accepted: schemaOk && releaseAnchorOk && observedActorKeys.length === required.length && withinReleaseDeadline,
    schemaOk,
    releaseAnchorOk,
    releaseAnchor,
    proofCompletedAtPageTime,
    withinReleaseDeadline,
    requiredActorKeys: required,
    observedActorKeys,
    missingActorKeys: required.filter((key) => !observedActorKeys.includes(key)),
    actors,
  });
}

if (process.env.V100_PHASE_G_BROWSER_LIFECYCLE_PROBE === "1") {
  const input = JSON.parse(process.env.V100_PHASE_G_BROWSER_LIFECYCLE_PROBE_INPUT ?? "{}");
  console.log(JSON.stringify(phaseGBrowserLifecyclePolicy(input.engineName, input.state)));
  process.exit(0);
}

if (process.env.V100_PHASE_G_CAUSAL_CONVERGENCE_PROBE === "1") {
  const input = JSON.parse(process.env.V100_PHASE_G_CAUSAL_CONVERGENCE_PROBE_INPUT ?? "{}");
  console.log(JSON.stringify(combatCausalConvergenceDecision(input.proof, input.options)));
  process.exit(0);
}

if (process.env.V100_PHASE_G_EXACT_ACTOR_PROBE === "1") {
  const input = JSON.parse(process.env.V100_PHASE_G_EXACT_ACTOR_PROBE_INPUT ?? "{}");
  console.log(JSON.stringify(postQuiescenceExactActorDecision(input.proofEpoch, input.options)));
  process.exit(0);
}

if (process.env.V100_PHASE_G_CONTRACT_PROBE === "1") {
  const input = JSON.parse(process.env.V100_PHASE_G_CONTRACT_PROBE_INPUT ?? "{}");
  const withActionability = (diagnostics) => ({
    ...diagnostics,
    cards: (diagnostics?.cards ?? []).map((card) => ({
      ...card,
      actionability: deploymentEligibilityForCard(card, diagnostics?.battle),
    })),
  });
  const sample = withActionability({ cards: input.cards ?? [], battle: input.battle ?? null });
  const candidates = deploymentCandidatesFromDiagnostics(sample, new Set(input.excludedKinds ?? []));
  console.log(JSON.stringify({
    candidates: candidates.map((card) => card.kind),
    sample: sample.cards.map((card) => ({ kind: card.kind, actionability: card.actionability })),
  }));
  process.exit(0);
}

if (process.env.V100_PHASE_G_DEPLOYMENT_POINTER_PROBE === "1") {
  const input = JSON.parse(process.env.V100_PHASE_G_DEPLOYMENT_POINTER_PROBE_INPUT ?? "{}");
  console.log(JSON.stringify({
    precondition: input.precondition
      ? deploymentPointerPreconditionDecision(input.precondition)
      : null,
    outcome: input.outcome
      ? deploymentPointerOutcome(input.outcome)
      : null,
  }));
  process.exit(0);
}

if (process.env.V100_PHASE_G_CHECKPOINT_FINALIZATION_PROBE === "1") {
  const input = JSON.parse(process.env.V100_PHASE_G_CHECKPOINT_FINALIZATION_PROBE_INPUT ?? "{}");
  let payload = null;
  const finalize = (details) => {
    if (payload) return payload;
    payload = buildCheckpointFailurePayload(input.snapshot ?? {}, details ?? {});
    return payload;
  };
  const first = finalize(input.details ?? {});
  const firstSerialized = JSON.stringify(first);
  const frozenSnapshot = first.failure.preFinalizationCheckpointSnapshot;
  let mutationRejected = false;
  try {
    frozenSnapshot.awaiting = { predicate: "mutated" };
  } catch {
    mutationRejected = true;
  }
  const mutationUnchanged = JSON.stringify(first) === firstSerialized;
  const second = finalize(input.secondDetails ?? { label: "second-finalization-must-not-win" });
  const persisted = {
    ...first,
    postFinalizationAppend: cloneDiagnosticValue(input.laterAppend ?? null),
  };
  console.log(JSON.stringify({
    payload: first,
    persisted,
    audit: {
      nestedDeepFrozen: isDeepFrozenDiagnosticValue(frozenSnapshot),
      mutationRejected,
      mutationUnchanged,
      firstWriteWins: second === first && JSON.stringify(second) === firstSerialized,
      attemptedOverlayIgnored: input.attemptedOverlay === undefined
        || persisted.awaitingAtFailure === first.awaitingAtFailure
        && persisted.lastCompletedBeforeFailure === first.lastCompletedBeforeFailure
        && JSON.stringify(persisted.unresolvedBeforeFailure) === JSON.stringify(first.unresolvedBeforeFailure),
    },
  }));
  process.exit(0);
}

if (process.env.V100_PHASE_G_CAUSAL_HISTORY_PROBE === "1") {
  const input = JSON.parse(process.env.V100_PHASE_G_CAUSAL_HISTORY_PROBE_INPUT ?? "{}");
  let history = {};
  for (const frame of input.observerFrames ?? []) history = mergeCombatActivityHistory(history, frame);
  history = mergeCombatActivityHistory(history, input.waitSnapshot ?? {});
  const proof = buildCombatCausalProof(input.proofSamples ?? [], history);
  const humanTarget = proofActorHumanTargetFromHistory(history.targetOwnershipHistory, input.proofActor);
  const targetContinuity = proofActorTargetContinuityDecision(input.targetContinuity ?? {});
  console.log(JSON.stringify({ history, proof, humanTarget, targetContinuity }));
  process.exit(0);
}

await mkdir(evidenceDir, { recursive: true });

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

function phaseGPageInputState(page) {
  let state = phaseGPageInputTails.get(page);
  if (!state) {
    state = { tail: Promise.resolve(), terminalError: null };
    phaseGPageInputTails.set(page, state);
  }
  return state;
}

async function withPhaseGPageInputLock(page, operation) {
  const state = phaseGPageInputState(page);
  const previous = state.tail;
  let release;
  state.tail = new Promise((resolve) => { release = resolve; });
  await previous.catch(() => {});
  try {
    if (state.terminalError) throw state.terminalError;
    return await operation();
  } catch (error) {
    if (error?.phaseGTerminalInputFailure === true && !state.terminalError) state.terminalError = error;
    throw error;
  } finally {
    release();
  }
}

function phaseGPointerFailure(code, evidence = {}, pointerCount = 0) {
  const error = new Error(`${code}: ${JSON.stringify(evidence)}`);
  error.name = "PhaseGPointerContractError";
  error.code = code;
  error.pointerCount = pointerCount;
  error.phaseGTerminalInputFailure = true;
  error.phaseGPointerEvidence = evidence;
  return error;
}

async function withDeploymentPreinputDeadline(page, operationPromise, deadlineMs, code, evidence = {}) {
  let timeoutId;
  try {
    const outcome = await Promise.race([
      operationPromise.then(
        (value) => ({ status: "fulfilled", value }),
        (error) => ({ status: "rejected", error }),
      ),
      new Promise((resolve) => {
        timeoutId = setTimeout(() => resolve({ status: "timeout" }), deadlineMs);
      }),
    ]);
    if (outcome.status === "fulfilled") return outcome.value;
    if (outcome.status === "rejected") throw outcome.error;
    const cancellation = await terminateTimedOutDeploymentPreinput(page, operationPromise);
    throw phaseGPointerFailure(code, {
      ...evidence,
      reason: "preinput-operation-timeout",
      deadlineMs,
      cancellation,
    }, 0);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function observePromiseWithin(promise, timeoutMs) {
  const boundedMs = Math.max(1, Math.floor(Number(timeoutMs) || 1));
  let timeoutId;
  try {
    return await Promise.race([
      promise.then(
        (value) => ({ status: "fulfilled", value }),
        (error) => ({ status: "rejected", error: String(error) }),
      ),
      new Promise((resolve) => {
        timeoutId = setTimeout(() => resolve({ status: "timeout", timeoutMs: boundedMs }), boundedMs);
      }),
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function terminateTimedOutDeploymentPreinput(page, operationPromise) {
  const context = page.context();
  const browser = context.browser();
  const lifecycle = [];
  const pageClosedBeforeCancellation = page.isClosed();
  const browserConnectedBeforeCancellation = browser?.isConnected() ?? null;
  const independentLifecycleLoss = pageClosedBeforeCancellation || browserConnectedBeforeCancellation === false;
  const attemptClose = async (owner, operation, closed) => {
    const startedAt = Date.now();
    try {
      await operation();
      const verifiedClosed = closed();
      lifecycle.push({ owner, status: "fulfilled", verifiedClosed, elapsedMs: Date.now() - startedAt });
      return verifiedClosed;
    } catch (error) {
      const verifiedClosed = closed();
      lifecycle.push({ owner, status: "rejected", error: String(error), verifiedClosed, elapsedMs: Date.now() - startedAt });
      return verifiedClosed;
    }
  };
  let closed = independentLifecycleLoss;
  if (!closed) closed = await attemptClose("context", () => context.close(), () => page.isClosed());
  if (!closed) closed = await attemptClose("page", () => page.close({ runBeforeUnload: false }), () => page.isClosed());
  const operationSettlement = await observePromiseWithin(operationPromise, 250);
  return {
    lifecycle,
    operationSettlement: { ...operationSettlement, value: undefined },
    pageClosedBeforeCancellation,
    browserConnectedBeforeCancellation,
    independentLifecycleLoss,
    pageClosed: page.isClosed(),
    browserConnected: browser?.isConnected() ?? null,
    terminalLifecycleVerified: closed,
    lateOperationFulfillment: operationSettlement.status === "fulfilled",
  };
}

async function terminateTimedOutDeploymentPointer(page, pointerPromise) {
  const context = page.context();
  const browser = context.browser();
  const lifecycle = [];
  const pageClosedBeforeCancellation = page.isClosed();
  const browserConnectedBeforeCancellation = browser?.isConnected() ?? null;
  const independentLifecycleLoss = pageClosedBeforeCancellation || browserConnectedBeforeCancellation === false;
  const attemptClose = async (owner, operation, closed) => {
    const startedAt = Date.now();
    try {
      await operation();
      const verifiedClosed = closed();
      lifecycle.push({ owner, status: "fulfilled", verifiedClosed, elapsedMs: Date.now() - startedAt });
      return verifiedClosed;
    } catch (error) {
      const verifiedClosed = closed();
      lifecycle.push({ owner, status: "rejected", error: String(error), verifiedClosed, elapsedMs: Date.now() - startedAt });
      return verifiedClosed;
    }
  };
  let closed = independentLifecycleLoss;
  // Never unwind the input mutex while a timed-out pointer can still settle
  // against a live document. Browser disposal is therefore awaited without a
  // secondary deadline; rejected owners fall through to the remaining owners.
  if (!closed && browser) closed = await attemptClose("browser", () => browser.close(), () => page.isClosed() || !browser.isConnected());
  if (!closed) closed = await attemptClose("context", () => context.close(), () => page.isClosed());
  if (!closed) closed = await attemptClose("page", () => page.close({ runBeforeUnload: false }), () => page.isClosed());
  if (!closed) {
    await new Promise((resolve) => {
      const verify = () => {
        if (page.isClosed() || (browser && !browser.isConnected())) resolve();
      };
      page.once("close", verify);
      browser?.once("disconnected", verify);
      verify();
    });
    closed = page.isClosed() || (browser ? !browser.isConnected() : false);
  }
  const pointerSettlement = await observePromiseWithin(pointerPromise, 250);
  const evidence = {
    lifecycle,
    pointerSettlement: { ...pointerSettlement, value: undefined },
    pageClosedBeforeCancellation,
    browserConnectedBeforeCancellation,
    independentLifecycleLoss,
    pageClosed: page.isClosed(),
    browserConnected: browser?.isConnected() ?? null,
    terminalLifecycleVerified: closed,
    latePointerFulfillment: pointerSettlement.status === "fulfilled",
  };
  return evidence;
}

async function installDeploymentSchedulerProbe(page, probeId) {
  if (page.isClosed()) return { probeId, status: "disposed-with-page" };
  return page.evaluate((schedulerProbeId) => {
    const registry = window.__V100_PHASE_G_DEPLOYMENT_SCHEDULER_PROBES__ ??= new Map();
    const existing = registry.get(schedulerProbeId);
    if (existing?.status === "pending" && Number.isFinite(Number(existing.handle))) {
      cancelAnimationFrame(existing.handle);
    }
    const entry = {
      probeId: schedulerProbeId,
      status: "pending",
      requestedAtWallTimeMs: Date.now(),
      requestedAtPerformanceMs: performance.now(),
      handle: null,
      observedAtWallTimeMs: null,
      observedAtPerformanceMs: null,
      callbackTimestamp: null,
    };
    entry.handle = requestAnimationFrame((callbackTimestamp) => {
      entry.status = "observed";
      entry.observedAtWallTimeMs = Date.now();
      entry.observedAtPerformanceMs = performance.now();
      entry.callbackTimestamp = callbackTimestamp;
    });
    registry.set(schedulerProbeId, entry);
    return {
      probeId: entry.probeId,
      status: entry.status,
      requestedAtWallTimeMs: entry.requestedAtWallTimeMs,
      requestedAtPerformanceMs: entry.requestedAtPerformanceMs,
      observedAtWallTimeMs: entry.observedAtWallTimeMs,
      observedAtPerformanceMs: entry.observedAtPerformanceMs,
      callbackTimestamp: entry.callbackTimestamp,
    };
  }, probeId);
}

async function removeDeploymentSchedulerProbe(page, probeId) {
  if (page.isClosed()) return { probeId, status: "disposed-with-page" };
  return page.evaluate((schedulerProbeId) => {
    const registry = window.__V100_PHASE_G_DEPLOYMENT_SCHEDULER_PROBES__;
    const entry = registry?.get(schedulerProbeId) ?? null;
    if (!entry) return { probeId: schedulerProbeId, status: "missing" };
    const statusBeforeCleanup = entry.status;
    if (entry.status === "pending" && Number.isFinite(Number(entry.handle))) cancelAnimationFrame(entry.handle);
    registry.delete(schedulerProbeId);
    return {
      probeId: schedulerProbeId,
      status: "removed",
      statusBeforeCleanup,
      requestedAtWallTimeMs: entry.requestedAtWallTimeMs,
      requestedAtPerformanceMs: entry.requestedAtPerformanceMs,
      observedAtWallTimeMs: entry.observedAtWallTimeMs,
      observedAtPerformanceMs: entry.observedAtPerformanceMs,
      callbackTimestamp: entry.callbackTimestamp,
    };
  }, probeId);
}

async function centerDeploymentCardInRail(page, identity) {
  return page.evaluate((expectedIdentity) => {
    const registry = window.__V100_PHASE_G_DEPLOYMENT_NODE_IDS__ ??= {
      ids: new WeakMap(),
      next: 1,
    };
    const nodeIdFor = (node) => {
      if (!registry.ids.has(node)) registry.ids.set(node, `deployment-card-${registry.next++}`);
      return registry.ids.get(node);
    };
    const card = [...document.querySelectorAll("button.unit-card")].find((candidate) => (
      nodeIdFor(candidate) === expectedIdentity.nodeId
      && candidate.getAttribute("data-kind") === expectedIdentity.kind
      && candidate.getAttribute("data-slot-index") === expectedIdentity.slot
    ));
    if (!card) return { status: "candidate-invalidated-before-pointer", reason: "candidate-node-missing" };
    const rail = card.closest(".unit-cards");
    if (!rail) return { status: "QA_HARNESS_POINTER_PREFLIGHT_DIVERGENCE", reason: "unit-cards-rail-missing" };
    const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(value, maximum));
    const cardRect = card.getBoundingClientRect();
    const railRect = rail.getBoundingClientRect();
    const cardCenterX = cardRect.left + cardRect.width / 2;
    const railCenterX = railRect.left + railRect.width / 2;
    const targetLeft = clamp(rail.scrollLeft + cardCenterX - railCenterX, 0, rail.scrollWidth - rail.clientWidth);
    rail.scrollTo({ left: targetLeft, behavior: "instant" });
    return { status: "centered", targetLeft };
  }, identity);
}

async function installDeploymentPointerReceipt(page, attemptId, expectedIdentity) {
  return page.evaluate(({ receiptAttemptId, identity }) => {
    const nodeRegistry = window.__V100_PHASE_G_DEPLOYMENT_NODE_IDS__ ??= {
      ids: new WeakMap(),
      next: 1,
    };
    const nodeIdFor = (node) => {
      if (!nodeRegistry.ids.has(node)) nodeRegistry.ids.set(node, `deployment-card-${nodeRegistry.next++}`);
      return nodeRegistry.ids.get(node);
    };
    const receiptRegistry = window.__V100_PHASE_G_DEPLOYMENT_POINTER_RECEIPTS__ ??= new Map();
    const receipts = [];
    const receiptStartedAt = performance.now();
    const handler = (event) => {
      const observedAtPerformanceMs = performance.now();
      const dispatchStartedAtPerformanceMs = receiptRegistry.get(receiptAttemptId)?.dispatchStartedAtPerformanceMs ?? null;
      const target = event.target instanceof Element ? event.target : null;
      const owner = target?.closest("button.unit-card") ?? null;
      const hitTarget = document.elementFromPoint(event.clientX, event.clientY);
      const hitOwner = hitTarget instanceof Element ? hitTarget.closest("button.unit-card") : null;
      const snapshot = window.__PHASE_G_READ_COMBAT_SNAPSHOT__();
      const ariaLabel = owner?.getAttribute("aria-label") ?? "";
      const costMatch = ariaLabel.match(/コスト\s*(\d+)/u);
      const card = owner ? {
        nodeId: nodeIdFor(owner),
        kind: owner.getAttribute("data-kind"),
        slot: owner.getAttribute("data-slot-index"),
        state: owner.getAttribute("data-state"),
        ariaDisabled: owner.getAttribute("aria-disabled"),
        disabled: owner.disabled === true,
        cost: costMatch ? Number(costMatch[1]) : null,
        rect: { visible: owner.getBoundingClientRect().width > 0 && owner.getBoundingClientRect().height > 0 },
      } : null;
      const battle = snapshot ? {
        screen: snapshot.screen ?? null,
        running: snapshot.running === true,
        paused: snapshot.paused === true,
        over: snapshot.over === true,
        won: snapshot.won === true,
        energy: Number(snapshot.energy ?? Number.NaN),
        deployQueue: snapshot.deployQueue ?? [],
        deployCooldowns: snapshot.deployCooldowns ?? {},
      } : null;
      const reasons = [];
      const numericCost = Number(card?.cost);
      const energy = Number(battle?.energy);
      const cooldown = card?.kind ? Number(battle?.deployCooldowns?.[card.kind]) : Number.NaN;
      if (!card?.kind) reasons.push("missing-kind");
      if (!(card?.rect?.visible === true && card?.state === "ready" && card?.ariaDisabled === "false" && card?.disabled !== true)) reasons.push("dom-not-deployable");
      if (!(battle?.screen === "battle" && battle.running === true && battle.paused !== true && battle.over !== true && battle.won !== true)) reasons.push("runtime-not-live");
      if (!Array.isArray(battle?.deployQueue) || battle.deployQueue.length >= 3) reasons.push("deployment-queue-full");
      if (!Number.isFinite(numericCost)) reasons.push("cost-not-finite");
      if (!Number.isFinite(energy) || energy < numericCost) reasons.push("insufficient-energy");
      if (!Number.isFinite(cooldown) || cooldown !== 0) reasons.push("cooldown-not-zero");
      receipts.push({
        sequence: receipts.length + 1,
        attemptId: receiptAttemptId,
        elapsedMs: Math.round((observedAtPerformanceMs - receiptStartedAt) * 100) / 100,
        elapsedSinceDispatchStartMs: Number.isFinite(Number(dispatchStartedAtPerformanceMs))
          ? Math.round((observedAtPerformanceMs - dispatchStartedAtPerformanceMs) * 100) / 100
          : null,
        type: event.type,
        isTrusted: event.isTrusted,
        pointerType: event.pointerType ?? "mouse",
        button: event.button,
        clientX: event.clientX,
        clientY: event.clientY,
        targetNodeName: target?.nodeName ?? null,
        targetClassName: target instanceof Element ? target.getAttribute("class") : null,
        owner: card ? { nodeId: card.nodeId, kind: card.kind, slot: card.slot } : null,
        expectedIdentity: identity,
        preHandler: {
          identity: card ? { nodeId: card.nodeId, kind: card.kind, slot: card.slot } : null,
          eligible: reasons.length === 0,
          reasons,
          card,
          battle,
          hitOwner: hitOwner ? {
            nodeId: nodeIdFor(hitOwner),
            kind: hitOwner.getAttribute("data-kind"),
            slot: hitOwner.getAttribute("data-slot-index"),
          } : null,
        },
      });
    };
    for (const type of ["pointerdown", "pointerup", "click"]) document.addEventListener(type, handler, true);
    receiptRegistry.set(receiptAttemptId, { receipts, handler, dispatchStartedAtPerformanceMs: null });
    return true;
  }, { receiptAttemptId: attemptId, identity: expectedIdentity });
}

async function readDeploymentPointerReceipts(page, attemptId, timeoutMs) {
  if (page.isClosed()) return { status: "page-closed", receipts: [] };
  if (timeoutMs <= 0) return { status: "timeout", timeoutMs: 0, receipts: [] };
  const result = await observePromiseWithin(page.evaluate((receiptAttemptId) => (
    window.__V100_PHASE_G_DEPLOYMENT_POINTER_RECEIPTS__?.get(receiptAttemptId)?.receipts ?? []
  ), attemptId), timeoutMs);
  return {
    ...result,
    value: undefined,
    receipts: result.status === "fulfilled" && Array.isArray(result.value) ? result.value : [],
  };
}

async function waitForDeploymentPointerReceipts(page, attemptId, deadlineAt) {
  const reads = [];
  let receipts = [];
  while (Date.now() < deadlineAt && !page.isClosed()) {
    const read = await readDeploymentPointerReceipts(page, attemptId, deadlineAt - Date.now());
    reads.push({ ...read, receiptCount: read.receipts.length });
    if (read.status === "fulfilled") receipts = read.receipts;
    if (receipts.length >= 3 && receipts.some((receipt) => receipt.type === "click")) break;
    if (read.status !== "fulfilled") break;
    await new Promise((resolve) => setTimeout(resolve, Math.min(8, Math.max(1, deadlineAt - Date.now()))));
  }
  return { receipts, reads };
}

async function removeDeploymentPointerReceipt(page, attemptId) {
  if (page.isClosed()) return { status: "disposed-with-page" };
  const removal = await observePromiseWithin(page.evaluate((receiptAttemptId) => {
    const registry = window.__V100_PHASE_G_DEPLOYMENT_POINTER_RECEIPTS__;
    const entry = registry?.get(receiptAttemptId);
    if (!entry) return;
    for (const type of ["pointerdown", "pointerup", "click"]) document.removeEventListener(type, entry.handler, true);
    registry.delete(receiptAttemptId);
  }, attemptId), DEPLOYMENT_POINTER_DIAGNOSTIC_READ_TIMEOUT_MS);
  if (removal.status !== "fulfilled") {
    throw phaseGPointerFailure("QA_HARNESS_POINTER_RECEIPT_CLEANUP_DIVERGENCE", { attemptId, removal }, 1);
  }
  return { status: "removed" };
}

async function performVerifiedDeploymentPointer(page, {
  requestedKind = null,
  requestedSlot = null,
  phase = "deployment-pointer",
} = {}) {
  return withPhaseGPageInputLock(page, async () => {
    const recorder = checkpointRecorderFor(page);
    let attemptRecorded = false;
    const recordPointerResult = (result) => {
      if (attemptRecorded) return result;
      attemptRecorded = true;
      const entry = {
        requestedKind: result.requestedKind ?? requestedKind,
        requestedSlot,
        action: result.status,
        accepted: result.accepted === true,
        pointerCount: result.pointerCount ?? 0,
        samples: result.samples ?? result.evidence?.samples ?? [],
        diagnostics: result.diagnostics ?? null,
        evidence: result.evidence ?? null,
      };
      recorder?.recordDeploymentAttempt(entry);
      recorder?.setLatestReadableState(entry);
      return result;
    };
    const preflightStartedAt = Date.now();
    const schedulerProbeId = `deployment-scheduler-${preflightStartedAt}-${Math.random().toString(36).slice(2)}`;
    const preflightEvidence = {
      schemaVersion: 1,
      phase,
      requestedKind,
      requestedSlot,
      startedAt: new Date(preflightStartedAt).toISOString(),
      schedulerProbe: {
        probeId: schedulerProbeId,
        installation: null,
        cleanup: null,
      },
      initial: null,
      resolvedIdentity: null,
      centered: null,
      hostTurns: [],
      samples: [],
      terminal: null,
      receiptInstallation: null,
      timeoutCancellation: null,
      preinputErrors: [],
      primaryError: null,
      cleanupErrors: [],
    };
    let schedulerProbeInstalled = false;
    let pointerDispatched = false;
    let executionError = null;
    const preflightRemaining = () => DEPLOYMENT_POINTER_PREFLIGHT_DEADLINE_MS - (Date.now() - preflightStartedAt);
    const preflightStep = async (operationFactory, code = "QA_HARNESS_POINTER_PREFLIGHT_DIVERGENCE", evidence = {}) => {
      const remaining = preflightRemaining();
      if (remaining <= 0) {
        const failureEvidence = { phase, ...evidence, reason: "preflight-budget-exhausted" };
        recorder?.setLatestReadableState(failureEvidence);
        throw phaseGPointerFailure(code, failureEvidence, 0);
      }
      try {
        const operationPromise = Promise.resolve().then(operationFactory);
        return await withDeploymentPreinputDeadline(
          page,
          operationPromise,
          Math.min(remaining, DEPLOYMENT_POINTER_DIAGNOSTIC_READ_TIMEOUT_MS),
          code,
          { phase, ...evidence },
        );
      } catch (error) {
        const preinputError = {
          code: error?.code ?? code,
          error: String(error),
          pointerCount: error?.pointerCount ?? 0,
          evidence: error?.phaseGPointerEvidence ?? null,
        };
        preflightEvidence.preinputErrors.push(preinputError);
        if (error?.phaseGPointerEvidence?.cancellation) {
          preflightEvidence.timeoutCancellation = error.phaseGPointerEvidence.cancellation;
        }
        if (error?.phaseGTerminalInputFailure === true) {
          recorder?.setLatestReadableState({ preflight: preflightEvidence, failure: preinputError });
          throw error;
        }
        const failureEvidence = { phase, ...evidence, error: String(error) };
        recorder?.setLatestReadableState({ preflight: preflightEvidence, failure: failureEvidence });
        if (isTransientBrowserClosure(error)) {
          throw phaseGPointerFailure("lifecycle-loss", failureEvidence, 0);
        }
        throw phaseGPointerFailure(code, failureEvidence, 0);
      }
    };
    const executePointer = async () => {
    preflightEvidence.schedulerProbe.installation = await preflightStep(
      () => installDeploymentSchedulerProbe(page, schedulerProbeId),
      "QA_HARNESS_POINTER_PREFLIGHT_DIVERGENCE",
      { operation: "scheduler-probe-install", schedulerProbeId },
    );
    schedulerProbeInstalled = ["pending", "observed"].includes(preflightEvidence.schedulerProbe.installation?.status);
    if (!schedulerProbeInstalled) {
      throw phaseGPointerFailure("QA_HARNESS_POINTER_PREFLIGHT_DIVERGENCE", {
        phase,
        reason: "scheduler-probe-installation-missing",
        schedulerProbe: preflightEvidence.schedulerProbe.installation,
      }, 0);
    }
    const initial = await preflightStep(() => readBattleDeploymentDiagnostics(page, {
      requestedKind,
      requestedSlot,
      phase: `${phase}:final-requery`,
      schedulerProbeId,
    }));
    preflightEvidence.initial = initial;
    recorder?.setLatestReadableState(initial);
    if (initial.pageClosed || initial.evaluateError) {
      throw phaseGPointerFailure("lifecycle-loss", { phase, initial }, 0);
    }
    const candidate = requestedKind
      ? initial.cards?.find((card) => card.kind === requestedKind)
      : deploymentCandidatesFromDiagnostics(initial)[0];
    if (!candidate || candidate.actionability?.eligible !== true) {
      return recordPointerResult({
        status: "candidate-invalidated-before-pointer",
        pointerCount: 0,
        accepted: false,
        requestedKind,
        requestedSlot,
        diagnostics: initial,
        evidence: { preflight: preflightEvidence },
      });
    }
    const identity = deploymentCardIdentity(candidate);
    preflightEvidence.resolvedIdentity = identity;
    const centered = await preflightStep(() => centerDeploymentCardInRail(page, identity));
    preflightEvidence.centered = centered;
    if (centered.status === "candidate-invalidated-before-pointer") {
      return recordPointerResult({
        ...centered,
        pointerCount: 0,
        accepted: false,
        requestedKind: candidate.kind,
        requestedSlot,
        diagnostics: initial,
        evidence: { preflight: preflightEvidence },
      });
    }
    if (centered.status !== "centered") {
      throw phaseGPointerFailure("QA_HARNESS_POINTER_PREFLIGHT_DIVERGENCE", { phase, identity, centered }, 0);
    }

    const samples = preflightEvidence.samples;
    let stableDecision = null;
    for (let sampleIndex = 0; sampleIndex < DEPLOYMENT_POINTER_MAX_SAMPLES; sampleIndex += 1) {
      const hostTurnStartedAtWallTimeMs = Date.now();
      await new Promise((resolve) => setTimeout(resolve, DEPLOYMENT_POINTER_SAMPLE_SEPARATION_MS));
      const hostTurnEndedAtWallTimeMs = Date.now();
      const hostTurn = {
        sequence: sampleIndex + 1,
        startedAtWallTimeMs: hostTurnStartedAtWallTimeMs,
        endedAtWallTimeMs: hostTurnEndedAtWallTimeMs,
        elapsedMs: hostTurnEndedAtWallTimeMs - hostTurnStartedAtWallTimeMs,
      };
      preflightEvidence.hostTurns.push(hostTurn);
      let diagnostics;
      try {
        diagnostics = await preflightStep(() => readBattleDeploymentDiagnostics(page, {
          requestedKind: candidate.kind,
          requestedSlot,
          phase: `${phase}:sample-${sampleIndex + 1}`,
          schedulerProbeId,
        }), "QA_HARNESS_POINTER_PREFLIGHT_DIVERGENCE", { operation: "diagnostic-snapshot", sampleIndex: sampleIndex + 1 });
      } catch (error) {
        samples.push({
          sampleOrdinal: null,
          hostTurn,
          schedulerProbe: null,
          status: error?.phaseGPointerEvidence?.deadlineMs ? "timeout" : "error",
          sampleIndex: sampleIndex + 1,
          elapsedMs: Date.now() - preflightStartedAt,
          error: String(error),
        });
        const failureEvidence = { phase, identity, samples, cause: error?.phaseGPointerEvidence ?? null };
        recorder?.setLatestReadableState(failureEvidence);
        throw phaseGPointerFailure(error?.code ?? "QA_HARNESS_POINTER_PREFLIGHT_DIVERGENCE", failureEvidence, 0);
      }
      const card = diagnostics.cards?.find((entry) => sameDeploymentCardIdentity(identity, deploymentCardIdentity(entry))) ?? null;
      const sample = {
        sampleOrdinal: diagnostics.sampleOrdinal ?? null,
        hostTurn,
        sampledAtWallTimeMs: diagnostics.sampledAtWallTimeMs ?? null,
        sampledAtPerformanceMs: diagnostics.sampledAtPerformanceMs ?? null,
        schedulerProbe: diagnostics.schedulerProbe ?? null,
        card,
        diagnostics,
      };
      samples.push(sample);
      if (diagnostics.pageClosed || diagnostics.evaluateError) {
        const failureEvidence = { phase, identity, samples, diagnostics };
        recorder?.setLatestReadableState(failureEvidence);
        throw phaseGPointerFailure("lifecycle-loss", failureEvidence, 0);
      }
      const invalidation = deploymentPointerPreconditionDecision({ expectedIdentity: identity, samples: [sample] });
      if (invalidation.status === "candidate-invalidated-before-pointer") {
        return recordPointerResult({
          ...invalidation,
          accepted: false,
          requestedKind: candidate.kind,
          requestedSlot,
          samples,
          diagnostics,
          evidence: { preflight: preflightEvidence },
        });
      }
      if (samples.length >= 2) {
        const decision = deploymentPointerPreconditionDecision({ expectedIdentity: identity, samples: samples.slice(-2) });
        if (decision.status === "ready-for-pointer") {
          stableDecision = decision;
          break;
        }
      }
    }
    if (!stableDecision) {
      const failureEvidence = {
        phase,
        identity,
        reason: "no-two-consecutive-stable-actionable-task-turn-samples",
        samples,
      };
      recorder?.setLatestReadableState(failureEvidence);
      throw phaseGPointerFailure("QA_HARNESS_POINTER_PREFLIGHT_DIVERGENCE", failureEvidence, 0);
    }

    const attemptId = `deployment-pointer-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let receiptInstalled = false;
    let primaryError = null;
    try {
      preflightEvidence.receiptInstallation = await preflightStep(
        () => installDeploymentPointerReceipt(page, attemptId, identity),
        "QA_HARNESS_POINTER_PREFLIGHT_DIVERGENCE",
        { operation: "receipt-install", attemptId, identity },
      );
      receiptInstalled = true;
      const terminalDiagnostics = await preflightStep(() => readBattleDeploymentDiagnostics(page, {
        requestedKind: candidate.kind,
        requestedSlot,
        phase: `${phase}:terminal-recheck`,
        schedulerProbeId,
        dispatchAttemptId: attemptId,
      }), "QA_HARNESS_POINTER_PREFLIGHT_DIVERGENCE", { operation: "terminal-diagnostic", attemptId, identity });
      preflightEvidence.terminal = terminalDiagnostics;
      if (terminalDiagnostics.pageClosed || terminalDiagnostics.evaluateError) {
        const failureEvidence = { phase, identity, samples, terminalDiagnostics };
        recorder?.setLatestReadableState(failureEvidence);
        throw phaseGPointerFailure("lifecycle-loss", failureEvidence, 0);
      }
      if (terminalDiagnostics.dispatchStartedAtPerformanceMs === null
        || terminalDiagnostics.dispatchStartedAtPerformanceMs === undefined
        || !Number.isFinite(Number(terminalDiagnostics.dispatchStartedAtPerformanceMs))) {
        const failureEvidence = { phase, identity, samples, terminalDiagnostics, reason: "dispatch-correlation-marker-missing" };
        recorder?.setLatestReadableState(failureEvidence);
        throw phaseGPointerFailure("QA_HARNESS_POINTER_PREFLIGHT_DIVERGENCE", failureEvidence, 0);
      }
      const terminalCard = terminalDiagnostics.cards?.find((entry) => sameDeploymentCardIdentity(identity, deploymentCardIdentity(entry))) ?? null;
      const terminal = {
        sampleOrdinal: terminalDiagnostics.sampleOrdinal ?? null,
        sampledAtWallTimeMs: terminalDiagnostics.sampledAtWallTimeMs ?? null,
        sampledAtPerformanceMs: terminalDiagnostics.sampledAtPerformanceMs ?? null,
        schedulerProbe: terminalDiagnostics.schedulerProbe ?? null,
        card: terminalCard,
        diagnostics: terminalDiagnostics,
      };
      const terminalDecision = deploymentPointerPreconditionDecision({
        expectedIdentity: identity,
        samples,
        terminal,
      });
      if (["candidate-invalidated-before-pointer", "coordinate-invalidated-before-pointer"].includes(terminalDecision.status)) {
        return recordPointerResult({
          ...terminalDecision,
          accepted: false,
          requestedKind: candidate.kind,
          requestedSlot,
          samples,
          diagnostics: terminalDiagnostics,
          evidence: { preflight: preflightEvidence },
        });
      }
      if (terminalDecision.status !== "ready-for-pointer") {
        const failureEvidence = {
          phase,
          identity,
          samples,
          terminalDecision,
          terminalDiagnostics,
        };
        recorder?.setLatestReadableState(failureEvidence);
        throw phaseGPointerFailure("QA_HARNESS_POINTER_PREFLIGHT_DIVERGENCE", failureEvidence, 0);
      }
      if (preflightRemaining() <= 0) {
        const failureEvidence = { phase, identity, samples, terminalDiagnostics, reason: "preflight-budget-exhausted-before-dispatch" };
        recorder?.setLatestReadableState(failureEvidence);
        throw phaseGPointerFailure("QA_HARNESS_POINTER_PREFLIGHT_DIVERGENCE", failureEvidence, 0);
      }

      const point = terminalDecision.point;
      const dispatchStartedAt = Date.now();
      pointerDispatched = true;
      const pointerPromise = page.mouse.click(point.x, point.y);
      let dispatchTimer;
      const dispatchResult = await Promise.race([
        pointerPromise.then(() => ({ status: "completed" }), (error) => ({
          status: isTransientBrowserClosure(error) ? "lifecycle-error" : "api-error",
          error: String(error),
        })),
        new Promise((resolve) => {
          dispatchTimer = setTimeout(() => resolve({ status: "timeout" }), DEPLOYMENT_POINTER_DISPATCH_DEADLINE_MS);
        }),
      ]);
      clearTimeout(dispatchTimer);
      let cancellation = null;
      if (dispatchResult.status === "timeout") {
        cancellation = await terminateTimedOutDeploymentPointer(page, pointerPromise);
      }
      let dispatch = {
        ...dispatchResult,
        attemptId,
        startedAt: new Date(dispatchStartedAt).toISOString(),
        endedAt: new Date().toISOString(),
        elapsedMs: Date.now() - dispatchStartedAt,
        lifecycle: {
          pageClosed: page.isClosed(),
        },
        cancellation,
      };
      if (dispatch.status === "timeout" && cancellation?.independentLifecycleLoss === true) {
        dispatch = { ...dispatch, status: "lifecycle-error", error: "independent lifecycle loss won the pointer deadline race" };
      }
      if (dispatch.status === "completed" && page.isClosed()) {
        dispatch = { ...dispatch, status: "lifecycle-error", error: "independent page close after pointer dispatch" };
      }
      const receiptResult = dispatch.status === "completed"
        ? await waitForDeploymentPointerReceipts(
          page,
          attemptId,
          dispatchStartedAt + DEPLOYMENT_POINTER_DISPATCH_DEADLINE_MS,
        )
        : { receipts: [], reads: [] };
      const receipts = receiptResult.receipts;
      const receiptOutcome = deploymentPointerOutcome({
        dispatch,
        receipts,
        expectedIdentity: identity,
        point,
        attemptId,
        acceptance: null,
      });
      if (receiptOutcome.status !== "receipt-verified") {
        throw phaseGPointerFailure(receiptOutcome.status, {
          phase,
          requestedKind: candidate.kind,
          requestedSlot,
          identity,
          point,
          dispatch,
          receipts,
          receiptReads: receiptResult.reads,
          samples,
          before: terminalDiagnostics,
          preflight: preflightEvidence,
        }, receiptOutcome.pointerCount);
      }
      const acceptance = await waitForDeploymentAcceptance(
        page,
        terminalDiagnostics,
        candidate.kind,
        requestedSlot,
        DEPLOYMENT_POINTER_ACCEPTANCE_DEADLINE_MS,
      );
      const postCard = acceptance.diagnostics?.cards?.find((entry) => entry.kind === candidate.kind) ?? null;
      const post = {
        lifecycleLost: acceptance.diagnostics?.pageClosed === true
          || /target page, context or browser has been closed/i.test(String(acceptance.diagnostics?.evaluateError ?? "")),
        candidateMissing: !postCard,
        card: postCard,
        beforeRect: terminalCard?.rect ?? null,
      };
      const outcome = deploymentPointerOutcome({
        dispatch,
        receipts,
        receiptReads: receiptResult.reads,
        expectedIdentity: identity,
        point,
        attemptId,
        acceptance: acceptance.accepted,
        post,
      });
      const evidence = {
        phase,
        requestedKind: candidate.kind,
        requestedSlot,
        identity,
        point,
        dispatch,
        receipts,
        samples,
        before: terminalDiagnostics,
        after: acceptance.diagnostics,
        acceptanceReads: acceptance.reads,
        preflight: preflightEvidence,
      };
      recorder?.setLatestReadableState(evidence);
      if (outcome.status !== "accepted") {
        throw phaseGPointerFailure(outcome.status, evidence, outcome.pointerCount);
      }
      return recordPointerResult({
        ...outcome,
        accepted: true,
        requestedKind: candidate.kind,
        requestedSlot,
        diagnostics: acceptance.diagnostics,
        evidence,
      });
    } catch (error) {
      primaryError = error;
      throw error;
    } finally {
      if (receiptInstalled) {
        try {
          await removeDeploymentPointerReceipt(page, attemptId);
        } catch (cleanupError) {
          const cleanupEvidence = cleanupError?.phaseGPointerEvidence ?? { attemptId, error: String(cleanupError) };
          if (!primaryError) throw cleanupError;
          primaryError.phaseGPointerEvidence = {
            ...(primaryError.phaseGPointerEvidence ?? {}),
            receiptCleanupFailure: cleanupEvidence,
          };
          primaryError.phaseGReceiptCleanupFailure = cleanupEvidence;
          recorder?.setLatestReadableState({
            primaryFailure: primaryError.phaseGPointerEvidence,
            receiptCleanupFailure: cleanupEvidence,
          });
        }
      }
    }
    };
    try {
      return await executePointer();
    } catch (error) {
      executionError = error;
      preflightEvidence.primaryError = {
        name: error?.name ?? null,
        code: error?.code ?? null,
        message: error?.message ?? String(error),
        pointerCount: error?.pointerCount ?? 0,
      };
      if (!pointerDispatched) {
        const failureEvidence = {
          ...(error?.phaseGPointerEvidence ?? {}),
          preflight: preflightEvidence,
        };
        error.phaseGPointerEvidence = failureEvidence;
        if (!attemptRecorded) {
          recordPointerResult({
            status: error?.code ?? "QA_HARNESS_POINTER_PREFLIGHT_DIVERGENCE",
            pointerCount: error?.pointerCount ?? 0,
            accepted: false,
            requestedKind: preflightEvidence.resolvedIdentity?.kind ?? requestedKind,
            requestedSlot,
            samples: preflightEvidence.samples,
            diagnostics: preflightEvidence.terminal
              ?? preflightEvidence.samples.at(-1)?.diagnostics
              ?? preflightEvidence.initial,
            evidence: failureEvidence,
          });
        }
      }
      throw error;
    } finally {
      if (schedulerProbeInstalled) {
        try {
          const cleanupPromise = Promise.resolve().then(() => removeDeploymentSchedulerProbe(page, schedulerProbeId));
          preflightEvidence.schedulerProbe.cleanup = await withDeploymentPreinputDeadline(
            page,
            cleanupPromise,
            DEPLOYMENT_POINTER_DIAGNOSTIC_READ_TIMEOUT_MS,
            "QA_HARNESS_POINTER_SCHEDULER_CLEANUP_DIVERGENCE",
            { phase, schedulerProbeId, operation: "scheduler-probe-cleanup" },
          );
        } catch (cleanupError) {
          const cleanupEvidence = cleanupError?.phaseGPointerEvidence ?? {
            phase,
            schedulerProbeId,
            error: String(cleanupError),
          };
          preflightEvidence.schedulerProbe.cleanup = { status: "failed", evidence: cleanupEvidence };
          preflightEvidence.cleanupErrors.push({ owner: "scheduler-probe", evidence: cleanupEvidence });
          if (executionError) {
            executionError.phaseGPointerEvidence = {
              ...(executionError.phaseGPointerEvidence ?? {}),
              schedulerCleanupFailure: cleanupEvidence,
              preflight: preflightEvidence,
            };
            recorder?.setLatestReadableState({
              primaryFailure: executionError.phaseGPointerEvidence,
              schedulerCleanupFailure: cleanupEvidence,
            });
          } else {
            const cleanupFailure = phaseGPointerFailure(
              "QA_HARNESS_POINTER_SCHEDULER_CLEANUP_DIVERGENCE",
              { phase, schedulerProbeId, preflight: preflightEvidence, cleanup: cleanupEvidence },
              pointerDispatched ? 1 : 0,
            );
            if (!attemptRecorded) {
              recordPointerResult({
                status: cleanupFailure.code,
                pointerCount: cleanupFailure.pointerCount,
                accepted: false,
                requestedKind: preflightEvidence.resolvedIdentity?.kind ?? requestedKind,
                requestedSlot,
                samples: preflightEvidence.samples,
                diagnostics: preflightEvidence.terminal
                  ?? preflightEvidence.samples.at(-1)?.diagnostics
                  ?? preflightEvidence.initial,
                evidence: cleanupFailure.phaseGPointerEvidence,
              });
            }
            throw cleanupFailure;
          }
        }
      }
    }
  });
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

function mergeCombatActivityHistory(previous = {}, snapshot = {}) {
  const currentAttackIdentity = Array.isArray(snapshot.attackIdentity) ? snapshot.attackIdentity : [];
  const currentPendingWeaponHits = Array.isArray(snapshot.pendingWeaponHits) ? snapshot.pendingWeaponHits : [];
  const currentPresentationEffects = Array.isArray(snapshot.battlePresentationEffects)
    ? snapshot.battlePresentationEffects
    : snapshot.battlePresentation?.effects ?? [];
  const appendBounded = (existing, current, limit) => [...(existing ?? []), ...current].slice(-limit);
  const sourceToTargetEdges = [...new Set(previous.sourceToTargetEdges ?? [])];
  const sourceEdgeSet = new Set(sourceToTargetEdges);
  const sourceAttribution = [...(previous.sourceAttribution ?? [])];
  const sourceAttributionKeys = new Set(sourceAttribution.map(({ edge, channel }) => `${channel}:${edge}`));
  const targetOwnershipHistory = [...(previous.targetOwnershipHistory ?? [])];
  const targetOwnershipKeys = new Set(targetOwnershipHistory.map((observation) => JSON.stringify([
    observation?.channel ?? null,
    observation?.sourceId ?? null,
    observation?.sourceSide ?? null,
    observation?.sourceKind ?? null,
    observation?.targetId ?? null,
    observation?.targetSide ?? null,
    observation?.targetKind ?? null,
    observation?.targetAlive === true,
  ])));
  const hasTargetReactionIdentity = (observation) => (
    observation?.targetId !== undefined
    && observation?.targetId !== null
    && typeof observation?.targetSide === "string"
    && observation.targetSide.trim().length > 0
    && typeof observation?.targetKind === "string"
    && observation.targetKind.trim().length > 0
  );
  const isAllowedFighterReaction = (observation) => (
    hasTargetReactionIdentity(observation)
    && (
      (observation.channel === "fighter-flash" && Number.isFinite(Number(observation.value)) && Number(observation.value) > 0)
      || (observation.channel === "fighter-knock" && Number.isFinite(Number(observation.value)) && Number(observation.value) > 0)
      || (observation.channel === "fighter-animation" && /hurt|hit|stagger|die/u.test(String(observation.state ?? "")))
    )
  );
  const reactionHistory = [...(previous.reactionHistory ?? [])]
    .filter(isAllowedFighterReaction)
    .slice(0, 96);
  const reactionHistoryKey = (observation) => JSON.stringify([
    observation?.channel ?? null,
    observation?.targetId ?? null,
    observation?.targetSide ?? null,
    observation?.targetKind ?? null,
    observation?.state ?? null,
    observation?.value ?? null,
  ]);
  const reactionHistoryKeys = new Set(reactionHistory.map(reactionHistoryKey));
  const appendReaction = (observation) => {
    if (!isAllowedFighterReaction(observation) || reactionHistory.length >= 96) return;
    const key = reactionHistoryKey(observation);
    if (reactionHistoryKeys.has(key)) return;
    reactionHistoryKeys.add(key);
    reactionHistory.push(observation);
  };
  const fighters = Array.isArray(snapshot.fighters) ? snapshot.fighters : [];
  const fighterById = new Map(fighters
    .filter((fighter) => fighter?.id !== undefined && fighter?.id !== null)
    .map((fighter) => [fighter.id, fighter]));
  const records = [
    ...currentAttackIdentity.map((record) => ["attackIdentity", record]),
    ...currentPendingWeaponHits.map((record) => ["pendingWeaponHits", record]),
  ];
  for (const [channel, record] of records) {
    if (record?.sourceId === undefined || record?.sourceId === null || record?.targetId === undefined || record?.targetId === null) continue;
    const edge = `${record.sourceId}->${record.targetId}`;
    if (!sourceEdgeSet.has(edge)) {
      sourceEdgeSet.add(edge);
      sourceToTargetEdges.push(edge);
    }
    const attributionKey = `${channel}:${edge}`;
    if (!sourceAttributionKeys.has(attributionKey)) {
      sourceAttributionKeys.add(attributionKey);
      sourceAttribution.push({ edge, sourceId: record.sourceId, targetId: record.targetId, channel });
    }
  }
  const ownershipRecords = [
    ...fighters
      .filter((fighter) => fighter?.id !== undefined && fighter?.id !== null && fighter?.targetId !== undefined && fighter?.targetId !== null)
      .map((fighter) => ["targetId", { sourceId: fighter.id, targetId: fighter.targetId }]),
    ...records,
  ];
  const battleTime = Number(snapshot.time);
  const observedBattleTime = Number.isFinite(battleTime) ? battleTime : null;
  for (const fighter of fighters) {
    const target = {
      battleTime: observedBattleTime,
      targetId: fighter?.id ?? null,
      targetSide: fighter?.side ?? null,
      targetKind: fighter?.kind ?? null,
    };
    const flash = Number(fighter?.flash);
    const knock = Number(fighter?.knock);
    const animationState = String(fighter?.animationPresentation?.state ?? "");
    if (Number.isFinite(flash) && flash > 0) appendReaction({ ...target, channel: "fighter-flash", state: null, value: flash });
    if (Number.isFinite(knock) && knock > 0) appendReaction({ ...target, channel: "fighter-knock", state: null, value: knock });
    if (/hurt|hit|stagger|die/u.test(animationState)) appendReaction({ ...target, channel: "fighter-animation", state: animationState, value: null });
  }
  for (const [channel, record] of ownershipRecords) {
    if (record?.sourceId === undefined || record?.sourceId === null || record?.targetId === undefined || record?.targetId === null) continue;
    const source = fighterById.get(record.sourceId);
    const target = fighterById.get(record.targetId);
    if (!source || !target) continue;
    const targetHp = Number(target.hp);
    const observation = {
      channel,
      battleTime: Number.isFinite(battleTime) ? battleTime : null,
      sourceId: source.id,
      sourceSide: source.side ?? null,
      sourceKind: source.kind ?? null,
      targetId: target.id,
      targetSide: target.side ?? null,
      targetKind: target.kind ?? null,
      targetHp: Number.isFinite(targetHp) ? targetHp : null,
      targetAlive: Number.isFinite(targetHp) && targetHp > 0,
    };
    const key = JSON.stringify([
      observation.channel,
      observation.sourceId,
      observation.sourceSide,
      observation.sourceKind,
      observation.targetId,
      observation.targetSide,
      observation.targetKind,
      observation.targetAlive,
    ]);
    if (targetOwnershipKeys.has(key) || targetOwnershipHistory.length >= 96) continue;
    targetOwnershipKeys.add(key);
    targetOwnershipHistory.push(observation);
  }
  return {
    ...previous,
    attackIdentity: appendBounded(previous.attackIdentity, currentAttackIdentity, 24),
    pendingWeaponHits: appendBounded(previous.pendingWeaponHits, currentPendingWeaponHits, 24),
    battlePresentationEffects: appendBounded(previous.battlePresentationEffects, currentPresentationEffects, 24),
    sourceToTargetEdges,
    sourceAttribution,
    targetOwnershipHistory,
    reactionHistory,
  };
}

function proofActorHumanTargetFromHistory(history = [], expectedKind = null, expectedFighterId = null) {
  if (!expectedKind || !Array.isArray(history)) return null;
  return history.find((observation) => (
    observation?.sourceSide === "zombie"
    && observation?.sourceKind === expectedKind
    && (expectedFighterId === null || expectedFighterId === undefined || String(observation?.sourceId) === String(expectedFighterId))
    && observation?.targetSide === "human"
    && observation?.targetAlive === true
  )) ?? null;
}

function buildCombatCausalProof(samples, stableHistory = {}) {
  const valid = samples.filter(Boolean);
  const edges = new Set(stableHistory.sourceToTargetEdges ?? []);
  const sourceAttribution = [];
  const sourceAttributionKeys = new Set();
  const targetOwnershipHistory = [];
  const targetOwnershipKeys = new Set();
  const addTargetOwnership = (observation) => {
    if (!observation || targetOwnershipHistory.length >= 96) return;
    const key = JSON.stringify([
      observation.channel ?? null,
      observation.sourceId ?? null,
      observation.sourceSide ?? null,
      observation.sourceKind ?? null,
      observation.targetId ?? null,
      observation.targetSide ?? null,
      observation.targetKind ?? null,
      observation.targetAlive === true,
    ]);
    if (targetOwnershipKeys.has(key)) return;
    targetOwnershipKeys.add(key);
    targetOwnershipHistory.push(observation);
  };
  const addAttribution = (attribution) => {
    if (!attribution?.edge || !attribution?.channel) return;
    const key = `${attribution.channel}:${attribution.edge}`;
    if (sourceAttributionKeys.has(key)) return;
    sourceAttributionKeys.add(key);
    sourceAttribution.push({
      edge: attribution.edge,
      sourceId: attribution.sourceId,
      targetId: attribution.targetId,
      channel: attribution.channel,
    });
  };
  for (const edge of stableHistory.sourceToTargetEdges ?? []) edges.add(edge);
  for (const attribution of stableHistory.sourceAttribution ?? []) addAttribution(attribution);
  for (const observation of stableHistory.targetOwnershipHistory ?? []) addTargetOwnership(observation);
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
  const hasTargetReactionIdentity = (observation) => (
    observation?.targetId !== undefined
    && observation?.targetId !== null
    && typeof observation?.targetSide === "string"
    && observation.targetSide.trim().length > 0
    && typeof observation?.targetKind === "string"
    && observation.targetKind.trim().length > 0
  );
  const isAllowedFighterReaction = (observation) => (
    hasTargetReactionIdentity(observation)
    && (
      (observation.channel === "fighter-flash" && Number.isFinite(Number(observation.value)) && Number(observation.value) > 0)
      || (observation.channel === "fighter-knock" && Number.isFinite(Number(observation.value)) && Number(observation.value) > 0)
      || (observation.channel === "fighter-animation" && /hurt|hit|stagger|die/u.test(String(observation.state ?? "")))
    )
  );
  const reactionHistory = [];
  const reactionHistoryKey = (observation) => JSON.stringify([
    observation?.channel ?? null,
    observation?.targetId ?? null,
    observation?.targetSide ?? null,
    observation?.targetKind ?? null,
    observation?.state ?? null,
    observation?.value ?? null,
  ]);
  const reactionHistoryKeys = new Set();
  const addReactionHistory = (observation) => {
    if (!isAllowedFighterReaction(observation) || reactionHistory.length >= 96) return;
    const key = reactionHistoryKey(observation);
    if (reactionHistoryKeys.has(key)) return;
    reactionHistoryKeys.add(key);
    reactionHistory.push(observation);
    reactionKeys.add(key);
    if (observation.targetSide && observation.targetKind) reactingActors.add(`${observation.targetSide}:${observation.targetKind}`);
  };
  for (const observation of stableHistory.reactionHistory ?? []) addReactionHistory(observation);
  for (const sample of valid) {
    for (const edge of sample.activitySourceToTargetEdges ?? []) edges.add(edge);
    for (const attribution of sample.activitySourceAttribution ?? []) addAttribution(attribution);
    for (const observation of sample.activityTargetOwnershipHistory ?? []) addTargetOwnership(observation);
    for (const observation of sample.activityReactionHistory ?? []) addReactionHistory(observation);
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
        || (fighter.attackSequenceBaseline === null || fighter.attackSequenceBaseline === undefined
          ? Number(fighter.attackSequence) > 0
          : fighter.attackSequenceAdvanced === true)
        || fighter.enemyVfx?.attacking === true
        || fighter.enemyVfx?.attackWindup === true
        || fighter.enemyVfx?.abilityActive === true
        || ["attack", "warning"].includes(fighter.enemyVfx?.phase)
        || /attack|windup|ability/u.test(animationState);
      if (attacking) attackingActors.add(actorKey);
      const sampleBattleTime = Number(sample.battleTime);
      const reactionTarget = {
        battleTime: Number.isFinite(sampleBattleTime) ? sampleBattleTime : null,
        targetId: fighter.id ?? null,
        targetSide: fighter.side ?? null,
        targetKind: fighter.kind ?? null,
      };
      const flash = Number(fighter.flash);
      const knock = Number(fighter.knock);
      if (Number.isFinite(flash) && flash > 0) addReactionHistory({ ...reactionTarget, channel: "fighter-flash", state: null, value: flash });
      if (Number.isFinite(knock) && knock > 0) addReactionHistory({ ...reactionTarget, channel: "fighter-knock", state: null, value: knock });
      if (/hurt|hit|stagger|die/u.test(animationState)) addReactionHistory({ ...reactionTarget, channel: "fighter-animation", state: animationState, value: null });
      if (Number(fighter.marked) > 0) statusMarkers.add(`${actorKey}:marked`);
    }
    const fightersById = new Map((sample.fighters ?? []).map((fighter) => [String(fighter.id), fighter]));
    for (const [channel, records] of [["attackIdentity", sample.attackIdentity ?? []], ["pendingWeaponHits", sample.pendingWeaponHits ?? []]]) {
      for (const attack of records) {
        if (attack.sourceId !== undefined && attack.sourceId !== null && attack.targetId !== undefined && attack.targetId !== null) {
          const edge = `${attack.sourceId}->${attack.targetId}`;
          edges.add(edge);
          addAttribution({ edge, sourceId: attack.sourceId, targetId: attack.targetId, channel });
        }
        if (attack.weapon || attack.effect) visualEvents.add(String(attack.weapon ?? attack.effect));
        const source = attack.sourceId === undefined || attack.sourceId === null
          ? null
          : fightersById.get(String(attack.sourceId));
        if (source?.kind && source?.side) attackingActors.add(`${source.side}:${source.kind}`);
      }
    }
    for (const effect of sample.battlePresentationEffects ?? []) visualEvents.add(String(effect.semantic ?? effect.kind ?? "presentation"));
    for (const text of sample.damageTexts ?? []) {
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
  const sourceEdgeTargetIds = new Set(sourceAttribution
    .filter((attribution) => edges.has(attribution.edge) && attribution.targetId !== undefined && attribution.targetId !== null)
    .map((attribution) => String(attribution.targetId)));
  const targetReactionHistory = reactionHistory.filter((observation) => sourceEdgeTargetIds.has(String(observation.targetId)));
  const targetReactionKeys = new Set(targetReactionHistory.map(reactionHistoryKey));
  const causalProof = {
    sampleCount: valid.length,
    sourceToTargetEdges: [...edges],
    sourceAttribution,
    targetOwnershipHistory,
    visualEvents: [...visualEvents],
    reactionEvents: [...reactionKeys],
    reactionHistory,
    targetReactionEvents: [...targetReactionKeys],
    targetReactionHistory,
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
      targetReaction: targetReactionKeys.size > 0,
      audio: audioCueIds.size > 0,
    },
  };
  causalProof.ok = causalProof.sampleCount > 0 && causalProof.stages.source && causalProof.stages.travelOrContact && causalProof.stages.targetReaction && causalProof.stages.audio;
  return causalProof;
}

async function startCombatRuntimeObserver(page) {
  const phaseGCombatSnapshotProfile = await page.evaluate(() => {
    window.__PHASE_G_COMBAT_OBSERVER__?.stop?.();
    const bridge = window.__ASHFALL_BATTLE_QA__;
    if (!bridge || typeof bridge.getPhaseGCombatSnapshot !== "function") {
      throw new Error("PHASE_G_LEAN_COMBAT_SNAPSHOT_METHOD_MISSING");
    }
    const forbiddenFields = new Set([
      "renderAudit",
      "renderAuditHistory",
      "survivalRun",
      "survivalProgress",
      "equipmentInventory",
      "geometry",
      "battleSpace",
      "navigationRouteReleases",
      "completedStageIds",
      "unlockedStageIds",
      "processedResultIds",
      "unitLevels",
      "unitRanks",
      "settings",
      "corpses",
      "areaEffects",
    ]);
    const readCombatSnapshot = () => {
      const snapshot = bridge.getPhaseGCombatSnapshot();
      if (!snapshot || typeof snapshot !== "object") throw new Error("PHASE_G_LEAN_COMBAT_SNAPSHOT_NULL_SCHEMA");
      if (snapshot.schema !== "v100-phase-g-combat-snapshot/v1") throw new Error("PHASE_G_LEAN_COMBAT_SNAPSHOT_WRONG_SCHEMA");
      if (snapshot.screen !== "battle" || typeof snapshot.stageId !== "string") throw new Error("PHASE_G_LEAN_COMBAT_SNAPSHOT_WRONG_ROUTE");
      if (!Array.isArray(snapshot.fighters) || !Array.isArray(snapshot.attackIdentity) || !Array.isArray(snapshot.pendingWeaponHits)) {
        throw new Error("PHASE_G_LEAN_COMBAT_SNAPSHOT_REQUIRED_ARRAY_MISSING");
      }
      return snapshot;
    };
    window.__PHASE_G_READ_COMBAT_SNAPSHOT__ = readCombatSnapshot;
    const readStartedAt = performance.now();
    const profileSample = readCombatSnapshot();
    const readDurationMs = Math.round((performance.now() - readStartedAt) * 1000) / 1000;
    const forbiddenFieldHits = [];
    const scanForbiddenFields = (value, path = "$", seen = new Set()) => {
      if (!value || typeof value !== "object" || seen.has(value)) return;
      seen.add(value);
      if (Array.isArray(value)) {
        value.forEach((entry, index) => scanForbiddenFields(entry, `${path}[${index}]`, seen));
        return;
      }
      for (const [key, nested] of Object.entries(value)) {
        if (forbiddenFields.has(key)) forbiddenFieldHits.push(`${path}.${key}`);
        scanForbiddenFields(nested, `${path}.${key}`, seen);
      }
    };
    scanForbiddenFields(profileSample);
    if (forbiddenFieldHits.length > 0) {
      throw new Error(`PHASE_G_LEAN_COMBAT_SNAPSHOT_FORBIDDEN_FIELDS:${forbiddenFieldHits.join(",")}`);
    }
    const serialized = JSON.stringify(profileSample);
    const profile = {
      schema: profileSample.schema,
      method: "getPhaseGCombatSnapshot",
      consumerMode: "single-producer-cache",
      sampleBytes: new TextEncoder().encode(serialized).byteLength,
      readDurationMs,
      fighterCount: profileSample.fighters.length,
      forbiddenFieldHits,
      forbiddenFieldHitCount: forbiddenFieldHits.length,
    };
    window.__PHASE_G_COMBAT_SNAPSHOT_PROFILE__ = profile;
    window.__PHASE_G_LAST_COMBAT_SNAPSHOT__ = profileSample;
    window.__PHASE_G_LAST_COMBAT_SNAPSHOT_AT__ = performance.now();
    const mergeCombatActivityHistory = (previous = {}, snapshot = {}) => {
      const currentAttackIdentity = Array.isArray(snapshot.attackIdentity) ? snapshot.attackIdentity : [];
      const currentPendingWeaponHits = Array.isArray(snapshot.pendingWeaponHits) ? snapshot.pendingWeaponHits : [];
      const currentPresentationEffects = Array.isArray(snapshot.battlePresentationEffects)
        ? snapshot.battlePresentationEffects
        : snapshot.battlePresentation?.effects ?? [];
      const appendBounded = (existing, current, limit) => [...(existing ?? []), ...current].slice(-limit);
      const sourceToTargetEdges = [...new Set(previous.sourceToTargetEdges ?? [])];
      const sourceEdgeSet = new Set(sourceToTargetEdges);
      const sourceAttribution = [...(previous.sourceAttribution ?? [])];
      const sourceAttributionKeys = new Set(sourceAttribution.map(({ edge, channel }) => `${channel}:${edge}`));
      const targetOwnershipHistory = [...(previous.targetOwnershipHistory ?? [])];
      const targetOwnershipKeys = new Set(targetOwnershipHistory.map((observation) => JSON.stringify([
        observation?.channel ?? null,
        observation?.sourceId ?? null,
        observation?.sourceSide ?? null,
        observation?.sourceKind ?? null,
        observation?.targetId ?? null,
        observation?.targetSide ?? null,
        observation?.targetKind ?? null,
        observation?.targetAlive === true,
      ])));
      const hasTargetReactionIdentity = (observation) => (
        observation?.targetId !== undefined
        && observation?.targetId !== null
        && typeof observation?.targetSide === "string"
        && observation.targetSide.trim().length > 0
        && typeof observation?.targetKind === "string"
        && observation.targetKind.trim().length > 0
      );
      const isAllowedFighterReaction = (observation) => (
        hasTargetReactionIdentity(observation)
        && (
          (observation.channel === "fighter-flash" && Number.isFinite(Number(observation.value)) && Number(observation.value) > 0)
          || (observation.channel === "fighter-knock" && Number.isFinite(Number(observation.value)) && Number(observation.value) > 0)
          || (observation.channel === "fighter-animation" && /hurt|hit|stagger|die/u.test(String(observation.state ?? "")))
        )
      );
      const reactionHistory = [...(previous.reactionHistory ?? [])]
        .filter(isAllowedFighterReaction)
        .slice(0, 96);
      const reactionHistoryKey = (observation) => JSON.stringify([
        observation?.channel ?? null,
        observation?.targetId ?? null,
        observation?.targetSide ?? null,
        observation?.targetKind ?? null,
        observation?.state ?? null,
        observation?.value ?? null,
      ]);
      const reactionHistoryKeys = new Set(reactionHistory.map(reactionHistoryKey));
      const appendReaction = (observation) => {
        if (!isAllowedFighterReaction(observation) || reactionHistory.length >= 96) return;
        const key = reactionHistoryKey(observation);
        if (reactionHistoryKeys.has(key)) return;
        reactionHistoryKeys.add(key);
        reactionHistory.push(observation);
      };
      const fighters = Array.isArray(snapshot.fighters) ? snapshot.fighters : [];
      const fighterById = new Map(fighters
        .filter((fighter) => fighter?.id !== undefined && fighter?.id !== null)
        .map((fighter) => [fighter.id, fighter]));
      const records = [
        ...currentAttackIdentity.map((record) => ["attackIdentity", record]),
        ...currentPendingWeaponHits.map((record) => ["pendingWeaponHits", record]),
      ];
      for (const [channel, record] of records) {
        if (record?.sourceId === undefined || record?.sourceId === null || record?.targetId === undefined || record?.targetId === null) continue;
        const edge = `${record.sourceId}->${record.targetId}`;
        if (!sourceEdgeSet.has(edge)) {
          sourceEdgeSet.add(edge);
          sourceToTargetEdges.push(edge);
        }
        const attributionKey = `${channel}:${edge}`;
        if (!sourceAttributionKeys.has(attributionKey)) {
          sourceAttributionKeys.add(attributionKey);
          sourceAttribution.push({ edge, sourceId: record.sourceId, targetId: record.targetId, channel });
        }
      }
      const ownershipRecords = [
        ...fighters
          .filter((fighter) => fighter?.id !== undefined && fighter?.id !== null && fighter?.targetId !== undefined && fighter?.targetId !== null)
          .map((fighter) => ["targetId", { sourceId: fighter.id, targetId: fighter.targetId }]),
        ...records,
      ];
      const battleTime = Number(snapshot.time);
      const observedBattleTime = Number.isFinite(battleTime) ? battleTime : null;
      for (const fighter of fighters) {
        const target = {
          battleTime: observedBattleTime,
          targetId: fighter?.id ?? null,
          targetSide: fighter?.side ?? null,
          targetKind: fighter?.kind ?? null,
        };
        const flash = Number(fighter?.flash);
        const knock = Number(fighter?.knock);
        const animationState = String(fighter?.animationPresentation?.state ?? "");
        if (Number.isFinite(flash) && flash > 0) appendReaction({ ...target, channel: "fighter-flash", state: null, value: flash });
        if (Number.isFinite(knock) && knock > 0) appendReaction({ ...target, channel: "fighter-knock", state: null, value: knock });
        if (/hurt|hit|stagger|die/u.test(animationState)) appendReaction({ ...target, channel: "fighter-animation", state: animationState, value: null });
      }
      for (const [channel, record] of ownershipRecords) {
        if (record?.sourceId === undefined || record?.sourceId === null || record?.targetId === undefined || record?.targetId === null) continue;
        const source = fighterById.get(record.sourceId);
        const target = fighterById.get(record.targetId);
        if (!source || !target) continue;
        const targetHp = Number(target.hp);
        const observation = {
          channel,
          battleTime: Number.isFinite(battleTime) ? battleTime : null,
          sourceId: source.id,
          sourceSide: source.side ?? null,
          sourceKind: source.kind ?? null,
          targetId: target.id,
          targetSide: target.side ?? null,
          targetKind: target.kind ?? null,
          targetHp: Number.isFinite(targetHp) ? targetHp : null,
          targetAlive: Number.isFinite(targetHp) && targetHp > 0,
        };
        const key = JSON.stringify([
          observation.channel,
          observation.sourceId,
          observation.sourceSide,
          observation.sourceKind,
          observation.targetId,
          observation.targetSide,
          observation.targetKind,
          observation.targetAlive,
        ]);
        if (targetOwnershipKeys.has(key) || targetOwnershipHistory.length >= 96) continue;
        targetOwnershipKeys.add(key);
        targetOwnershipHistory.push(observation);
      }
      return {
        ...previous,
        attackIdentity: appendBounded(previous.attackIdentity, currentAttackIdentity, 24),
        pendingWeaponHits: appendBounded(previous.pendingWeaponHits, currentPendingWeaponHits, 24),
        battlePresentationEffects: appendBounded(previous.battlePresentationEffects, currentPresentationEffects, 24),
        sourceToTargetEdges,
        sourceAttribution,
        targetOwnershipHistory,
        reactionHistory,
      };
    };
    const proofActorHumanTargetFromHistory = (history = [], expectedKind = null, expectedFighterId = null) => {
      if (!expectedKind || !Array.isArray(history)) return null;
      return history.find((observation) => (
        observation?.sourceSide === "zombie"
        && observation?.sourceKind === expectedKind
        && (expectedFighterId === null || expectedFighterId === undefined || String(observation?.sourceId) === String(expectedFighterId))
        && observation?.targetSide === "human"
        && observation?.targetAlive === true
      )) ?? null;
    };
    window.__PHASE_G_COMBAT_HISTORY_MERGE__ = mergeCombatActivityHistory;
    window.__PHASE_G_PROOF_ACTOR_HUMAN_TARGET_FROM_HISTORY__ = proofActorHumanTargetFromHistory;
    const observe = () => {
      const snapshot = window.__PHASE_G_READ_COMBAT_SNAPSHOT__();
      if (!snapshot || snapshot.screen !== "battle") return;
      window.__PHASE_G_LAST_COMBAT_SNAPSHOT__ = snapshot;
      window.__PHASE_G_LAST_COMBAT_SNAPSHOT_AT__ = performance.now();
      const activity = window.__PHASE_G_COMBAT_ACTIVITY__ ?? {};
      const fighterActors = new Set(activity.fighterActors ?? []);
      const attackingActors = new Set(activity.attackingActors ?? []);
      const statusMarkers = new Set(activity.statusMarkers ?? []);
      const audioCues = new Set(activity.audioCues ?? []);
      const bossLifecycle = [...(activity.bossLifecycle ?? [])];
      const actorById = new Map((snapshot.fighters ?? []).map((fighter) => [String(fighter.id), fighter]));
      const postQuiescenceProofEpoch = window.__PHASE_G_POST_QUIESCENCE_PROOF_EPOCH__;
      const epochActorFor = (fighter) => (
        postQuiescenceProofEpoch?.schema === "v100-phase-g-post-quiescence-proof/v5"
          ? postQuiescenceProofEpoch.actors?.find((candidate) => (
            candidate.side === fighter?.side
            && candidate.kind === fighter?.kind
            && String(candidate.selectedFighterId) === String(fighter?.id)
          )) ?? null
          : null
      );
      for (const fighter of snapshot.fighters ?? []) {
        if (!fighter.side || !fighter.kind) continue;
        const actorKey = `${fighter.side}:${fighter.kind}`;
        // Keep the actor once the production runtime has actually mounted it;
        // this history survives a later defeat before the evidence window.
        if (fighter.combatReady === true || fighter.gateEntering === true || Number(fighter.hp) > 0) {
          fighterActors.add(actorKey);
        }
        const animationState = String(fighter.animationPresentation?.state ?? "");
        const epochActor = epochActorFor(fighter);
        const epochFighterBaseline = epochActor?.fighterBaselines?.find((baseline) => (
          String(baseline.fighterId) === String(fighter.id)
        )) ?? null;
        const attackSequenceAdvanced = epochActor
          ? Number(fighter.attackSequence) > Number(epochFighterBaseline?.baselineAttackSequence)
          : Number(fighter.attackSequence) > 0;
        const attacking = Number(fighter.attack) > 0
          || Number(fighter.attackWindup) > 0
          || Number(fighter.abilityWindup) > 0
          || attackSequenceAdvanced
          || fighter.enemyVfx?.attacking === true
          || fighter.enemyVfx?.attackWindup === true
          || ["attack", "warning"].includes(fighter.enemyVfx?.phase)
          || /attack|windup|ability/u.test(animationState);
        if (attacking) attackingActors.add(actorKey);
        if (epochActor) epochActor.actorAlive = Number(fighter.hp) > 0;
        if (epochActor && attackSequenceAdvanced && epochActor.observedPostEpochAttack !== true) {
          const releaseAnchor = postQuiescenceProofEpoch.releaseAnchor ?? null;
          const releaseAnchorCommitWindowSeconds = releaseAnchor
            ? Math.max(0.8, Number(releaseAnchor.attackWindupSeconds) + 0.5)
            : null;
          const releaseAnchorCommitDeltaSeconds = releaseAnchor
            && Number.isFinite(Number(snapshot.time))
            ? Number(snapshot.time) - Number(releaseAnchor.handoffAtBattleTime)
            : null;
          const releaseAnchorBindingValid = releaseAnchor?.handoffValid === true
            && releaseAnchor.actorKey === actorKey
            && String(releaseAnchor.fighterId) === String(fighter.id)
            && Number(epochFighterBaseline?.baselineAttackSequence) === Number(releaseAnchor.baselineAttackSequence)
            && Number(fighter.attackSequence) === Number(releaseAnchor.baselineAttackSequence) + 1
            && Number.isFinite(Number(releaseAnchorCommitDeltaSeconds))
            && Number(releaseAnchorCommitDeltaSeconds) >= 0
            && Number(releaseAnchorCommitDeltaSeconds) <= Number(releaseAnchorCommitWindowSeconds);
          const directTargetId = fighter.targetId === null || fighter.targetId === undefined
            ? null
            : fighter.targetId;
          const targetId = directTargetId ?? (releaseAnchorBindingValid ? releaseAnchor.targetId : null);
          const target = targetId === null || targetId === undefined
            ? null
            : actorById.get(String(targetId)) ?? null;
          Object.assign(epochActor, {
            observedPostEpochAttack: true,
            observedFighterId: fighter.id,
            observedAttackSequence: Number(fighter.attackSequence),
            observedAtBattleTime: Number(snapshot.time),
            observedAtPageTime: performance.now(),
            sourceAliveAtObservation: Number(fighter.hp) > 0,
            targetId: target?.id ?? targetId ?? null,
            targetSide: target?.side ?? null,
            targetKind: target?.kind ?? null,
            targetAlive: target ? Number(target.hp) > 0 : null,
            targetEvidenceSource: directTargetId !== null
              ? "live-attacker-target"
              : releaseAnchorBindingValid
                ? "release-anchor-bound-windup"
                : null,
          });
        }
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
      if (postQuiescenceProofEpoch?.schema === "v100-phase-g-post-quiescence-proof/v5") {
        for (const epochActor of postQuiescenceProofEpoch.actors ?? []) {
          const selectedFighter = actorById.get(String(epochActor.selectedFighterId)) ?? null;
          epochActor.actorAlive = Number(selectedFighter?.hp) > 0;
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
      const allAudioRequests = window.__ASHFALL_AUDIO_QA__?.getCueRequests?.() ?? [];
      const proofAudioRequests = postQuiescenceProofEpoch?.schema === "v100-phase-g-post-quiescence-proof/v5"
        ? allAudioRequests.filter((request) => (
          Number.isFinite(Number(request?.at))
          && Number(request.at) > Number(postQuiescenceProofEpoch.audioCueRequestCutoffAt)
        ))
        : allAudioRequests;
      for (const request of proofAudioRequests) {
        if (request?.cueId) audioCues.add(String(request.cueId));
        for (const epochActor of postQuiescenceProofEpoch?.actors ?? []) {
          if (epochActor.cueId && request?.cueId === epochActor.cueId && epochActor.audioObserved !== true) {
            epochActor.audioObserved = true;
            epochActor.audioObservedAtBattleTime = Number(snapshot.time);
            epochActor.audioObservedAtPageTime = Number(request.at);
          }
        }
      }
      if ((snapshot.damageTexts ?? []).some((text) => /索敵|マーク|目標|ロック/u.test(String(text?.value ?? "")))) {
        statusMarkers.add("status-mission-target");
      }
      const mergedHistory = mergeCombatActivityHistory(activity, snapshot);
      window.__PHASE_G_COMBAT_ACTIVITY__ = {
        ...activity,
        ...mergedHistory,
        fighterActors: [...fighterActors],
        attackingActors: [...attackingActors],
        statusMarkers: [...statusMarkers],
        audioCues: [...audioCues],
        bossLifecycle: bossLifecycle.slice(-48),
        postQuiescenceProofEpoch: postQuiescenceProofEpoch ?? activity.postQuiescenceProofEpoch ?? null,
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
    return profile;
  });
  const recorder = checkpointRecorderFor(page);
  recorder?.setPhaseGCombatSnapshotProfile(phaseGCombatSnapshotProfile);
  recorder?.markOnce("combat-observer-started", "completed", { intervalMs: 40, phaseGCombatSnapshotProfile });
  return phaseGCombatSnapshotProfile;
}

async function waitForCombatActivity(page, { bossKind = null } = {}) {
  const recorder = checkpointRecorderFor(page);
  recorder?.setAwaiting("combat-activity", { bossKind, predicate: "production attack/contact/presentation activity" });
  try {
    await page.waitForFunction(() => {
      const snapshot = window.__PHASE_G_LAST_COMBAT_SNAPSHOT__;
      if (!snapshot || snapshot.screen !== "battle") return false;
      const hasFighters = Array.isArray(snapshot.fighters) && snapshot.fighters.some((fighter) => fighter.hp > 0);
      const activity = window.__PHASE_G_COMBAT_ACTIVITY__ ?? {};
      const mergedActivity = window.__PHASE_G_COMBAT_HISTORY_MERGE__?.(activity, snapshot) ?? activity;
      const hasPresentation = (snapshot.attackIdentity?.length ?? 0) > 0
        || (snapshot.pendingWeaponHits?.length ?? 0) > 0
        || (snapshot.battlePresentation?.effects?.length ?? 0) > 0
        || (mergedActivity.attackIdentity?.length ?? 0) > 0
        || (mergedActivity.pendingWeaponHits?.length ?? 0) > 0
        || (mergedActivity.battlePresentationEffects?.length ?? 0) > 0;
      if (!hasFighters || !hasPresentation) return false;
      window.__PHASE_G_COMBAT_ACTIVITY__ = {
        ...activity,
        ...mergedActivity,
      };
      return true;
    }, null, { timeout: Math.min(battleTimeout, 45_000), polling: 100 });
    recorder?.clearAwaiting();
  } catch (error) {
    const state = await page.evaluate(() => ({
      battleScreen: document.querySelector(".game-shell")?.getAttribute("data-screen") ?? null,
      snapshot: (() => {
        const snapshot = window.__PHASE_G_LAST_COMBAT_SNAPSHOT__;
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
          const snapshot = window.__PHASE_G_LAST_COMBAT_SNAPSHOT__;
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
      }, bossKind, { timeout: battleTimeout, polling: 100 });
      recorder?.clearAwaiting();
    } catch (error) {
      const state = await page.evaluate(() => ({
        url: location.href,
        campaignPhase: document.querySelector(".v100-shell")?.getAttribute("data-v100-phase") ?? null,
        battleScreen: document.querySelector(".game-shell")?.getAttribute("data-screen") ?? null,
        body: document.body.innerText.slice(0, 1400),
        snapshot: window.__PHASE_G_LAST_COMBAT_SNAPSHOT__,
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
  const observed = await page.evaluate(({ expected, battleState }) => {
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
    const snapshot = battleState ? window.__PHASE_G_LAST_COMBAT_SNAPSHOT__ : null;
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
  }, { expected: contract, battleState: state.startsWith("battle") });
  const missingSelectors = contract.selectors.filter((selector) => observed.selectorHits?.[selector] !== true);
  const phaseOk = contract.phases.includes(observed.phase);
  const surfaceOk = !contract.surfaces || contract.surfaces.includes(observed.surface);
  const battleOk = !state.startsWith("battle") || (observed.screen === "battle" && observed.battleMounted === true && (observed.canvas?.visiblePixels ?? 0) > 0);
  return { ok: missingSelectors.length === 0 && phaseOk && surfaceOk && battleOk, expected: contract, observed, missingSelectors, phaseOk, surfaceOk, battleOk };
}

async function collectCombatCausalProof(page, {
  durationMs = 4_800,
  requiredPostEpochActorKeys = [],
} = {}) {
  const requiredActorKeys = [...new Set(requiredPostEpochActorKeys)];
  const deadlineReadStartedAt = Date.now();
  const deadlineRead = await observePromiseWithin(page.evaluate(() => ({
    pageNow: performance.now(),
    proofEpoch: window.__PHASE_G_POST_QUIESCENCE_PROOF_EPOCH__ ?? null,
  })), COMBAT_CAUSAL_PAGE_TRANSACTION_TIMEOUT_MS);
  if (deadlineRead.status !== "fulfilled") {
    const error = new Error(`PHASE_G_CAUSAL_TRANSACTION_${deadlineRead.status === "timeout" ? "TIMEOUT" : "REJECTED"}: initial release-deadline envelope`);
    error.code = deadlineRead.status === "timeout"
      ? "PHASE_G_CAUSAL_TRANSACTION_TIMEOUT"
      : "PHASE_G_CAUSAL_TRANSACTION_REJECTED";
    error.phaseGCausalNoFurtherPageRpc = true;
    error.phaseGCausalTransaction = {
      schema: "v100-phase-g-causal-transaction-failure/v1",
      phase: "deadline-envelope",
      status: deadlineRead.status,
      lastAtomicReceipt: null,
      noFurtherPageRpc: true,
    };
    throw error;
  }
  const deadlineEnvelope = deadlineRead.value;
  let effectiveDurationMs = durationMs;
  if (requiredActorKeys.length > 0) {
    invariant(deadlineEnvelope.proofEpoch?.schema === "v100-phase-g-post-quiescence-proof/v5"
      && Number.isFinite(Number(deadlineEnvelope.proofEpoch.visibleProofDeadlineAt)),
    `exact actor collection lacks a finite v4 release deadline: ${JSON.stringify(deadlineEnvelope)}`);
    effectiveDurationMs = Math.max(0, Math.min(
      durationMs,
      Number(deadlineEnvelope.proofEpoch.visibleProofDeadlineAt) - Number(deadlineEnvelope.pageNow),
    ));
  }
  const samples = [];
  const startedAt = Date.now();
  const hostDeadlineAt = deadlineReadStartedAt + effectiveDurationMs;
  let lastAtomicReceipt = null;
  let pageTransactionCount = 0;
  let postConvergencePageSampleCount = 0;
  let finalStableHistoryReadbackCount = 0;
  let convergenceDecision = null;
  let exactActorDecision = postQuiescenceExactActorDecision(deadlineEnvelope.proofEpoch, { requiredActorKeys });
  const causalTransactionFailure = (status, phase, timeoutMs, detail = null) => {
    const error = new Error(`PHASE_G_CAUSAL_TRANSACTION_${status === "timeout" ? "TIMEOUT" : "REJECTED"}: ${phase}`);
    error.code = status === "timeout"
      ? "PHASE_G_CAUSAL_TRANSACTION_TIMEOUT"
      : "PHASE_G_CAUSAL_TRANSACTION_REJECTED";
    error.phaseGCausalNoFurtherPageRpc = true;
    error.phaseGCausalTransaction = {
      schema: "v100-phase-g-causal-transaction-failure/v1",
      phase,
      status,
      timeoutMs,
      detail,
      pageTransactionCount,
      hostDeadlineAt,
      lastAtomicReceipt,
      noFurtherPageRpc: true,
    };
    return error;
  };
  while (Date.now() < hostDeadlineAt) {
    const remainingHostMs = hostDeadlineAt - Date.now();
    const transactionTimeoutMs = Math.min(COMBAT_CAUSAL_PAGE_TRANSACTION_TIMEOUT_MS, remainingHostMs);
    if (transactionTimeoutMs <= 0) break;
    const transaction = await observePromiseWithin(page.evaluate(() => {
      const snapshot = window.__PHASE_G_LAST_COMBAT_SNAPSHOT__;
      const proofEpoch = window.__PHASE_G_POST_QUIESCENCE_PROOF_EPOCH__;
      const allAudio = window.__ASHFALL_AUDIO_QA__?.getCueRequests?.() ?? [];
      const audio = proofEpoch?.schema === "v100-phase-g-post-quiescence-proof/v5"
        ? allAudio.filter((request) => (
          Number.isFinite(Number(request?.at))
          && Number(request.at) > Number(proofEpoch.audioCueRequestCutoffAt)
        ))
        : allAudio;
      const observedCombatActivity = window.__PHASE_G_COMBAT_ACTIVITY__ ?? {};
      return {
        schema: "v100-phase-g-causal-atomic-receipt/v1",
        pageNow: performance.now(),
        battleTime: snapshot?.time ?? null,
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
        activitySourceToTargetEdges: observedCombatActivity.sourceToTargetEdges ?? [],
        activitySourceAttribution: observedCombatActivity.sourceAttribution ?? [],
        activityTargetOwnershipHistory: observedCombatActivity.targetOwnershipHistory ?? [],
        activityReactionHistory: observedCombatActivity.reactionHistory ?? [],
        activityFighterActors: observedCombatActivity.fighterActors ?? [],
        activityAttackingActors: observedCombatActivity.attackingActors ?? [],
        activityStatusMarkers: observedCombatActivity.statusMarkers ?? [],
        activityVehicleActions: observedCombatActivity.vehicleActions ?? [],
        fighters: snapshot?.fighters?.map((fighter) => {
          const epochActor = proofEpoch?.schema === "v100-phase-g-post-quiescence-proof/v5"
            ? proofEpoch.actors?.find((candidate) => (
              candidate.side === fighter.side
              && candidate.kind === fighter.kind
              && String(candidate.selectedFighterId) === String(fighter.id)
            )) ?? null
            : null;
          const epochFighterBaseline = epochActor?.fighterBaselines?.find((baseline) => (
            String(baseline.fighterId) === String(fighter.id)
          )) ?? null;
          return {
            id: fighter.id,
            side: fighter.side,
            kind: fighter.kind,
            hp: fighter.hp,
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
            attackSequenceBaseline: epochFighterBaseline?.baselineAttackSequence ?? null,
            attackSequenceAdvanced: epochActor
              ? Number(fighter.attackSequence) > Number(epochFighterBaseline?.baselineAttackSequence)
              : null,
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
          };
        }) ?? [],
        shots: snapshot?.shots ?? [],
        damageTexts: snapshot?.damageTexts ?? [],
        battlefieldObjects: snapshot?.battlefieldObjects ?? [],
        researchContainer: snapshot?.researchContainer ?? null,
        manualAbilityReceipts: snapshot?.manualAbilityReceipts ?? [],
        manualAbilityVfx: snapshot?.manualAbilityVfx ?? [],
        battlePresentationEffects: (snapshot?.battlePresentation?.effects?.length ?? 0) > 0 ? snapshot.battlePresentation.effects : observedCombatActivity.battlePresentationEffects ?? [],
        audioCueRequests: audio,
        postQuiescenceProofEpoch: proofEpoch ?? null,
      };
    }), transactionTimeoutMs);
    pageTransactionCount += 1;
    if (transaction.status !== "fulfilled") {
      throw causalTransactionFailure(
        transaction.status,
        "causal-sample",
        transactionTimeoutMs,
        transaction.error ?? null,
      );
    }
    const atomicReceipt = transaction.value;
    if (atomicReceipt?.schema !== "v100-phase-g-causal-atomic-receipt/v1") {
      throw causalTransactionFailure("rejected", "causal-sample-schema", transactionTimeoutMs, atomicReceipt ?? null);
    }
    samples.push(atomicReceipt);
    lastAtomicReceipt = atomicReceipt;
    const elapsedMs = Date.now() - startedAt;
    convergenceDecision = combatCausalConvergenceDecision(
      buildCombatCausalProof(samples),
      { elapsedMs },
    );
    exactActorDecision = postQuiescenceExactActorDecision(
      samples.at(-1)?.postQuiescenceProofEpoch ?? null,
      { requiredActorKeys },
    );
    const proofAndSamplesComplete = convergenceDecision.proofOk === true
      && convergenceDecision.allStagesComplete === true
      && convergenceDecision.samplesComplete === true
      && exactActorDecision.accepted === true;
    if (proofAndSamplesComplete) {
      const residualDwellMs = Math.max(0, COMBAT_CAUSAL_CONVERGENCE_MIN_DWELL_MS - elapsedMs);
      if (residualDwellMs > 0) {
        const remainingAfterSampleMs = hostDeadlineAt - Date.now();
        if (residualDwellMs > remainingAfterSampleMs) break;
        await new Promise((resolve) => setTimeout(resolve, residualDwellMs));
      }
      convergenceDecision = combatCausalConvergenceDecision(
        buildCombatCausalProof(samples),
        { elapsedMs: Date.now() - startedAt },
      );
      break;
    }
    const remainingMs = hostDeadlineAt - Date.now();
    if (remainingMs > 0) await new Promise((resolve) => setTimeout(resolve, Math.min(120, remainingMs)));
  }
  const stableHistory = lastAtomicReceipt ? {
    pageNow: lastAtomicReceipt.pageNow,
    proofEpoch: lastAtomicReceipt.postQuiescenceProofEpoch ?? null,
    sourceToTargetEdges: lastAtomicReceipt.activitySourceToTargetEdges ?? [],
    sourceAttribution: lastAtomicReceipt.activitySourceAttribution ?? [],
    targetOwnershipHistory: lastAtomicReceipt.activityTargetOwnershipHistory ?? [],
    reactionHistory: lastAtomicReceipt.activityReactionHistory ?? [],
    battlePresentationEffects: lastAtomicReceipt.battlePresentationEffects ?? [],
  } : {};
  const proof = buildCombatCausalProof(samples, stableHistory);
  const elapsedMs = Date.now() - startedAt;
  const finalConvergence = combatCausalConvergenceDecision(proof, { elapsedMs });
  const finalExactActorDecision = postQuiescenceExactActorDecision(stableHistory.proofEpoch ?? null, { requiredActorKeys });
  const withinReleaseDeadline = requiredActorKeys.length === 0
    || finalExactActorDecision.withinReleaseDeadline === true;
  const converged = convergenceDecision?.accepted === true
    && finalConvergence.accepted === true
    && exactActorDecision.accepted === true
    && finalExactActorDecision.accepted === true
    && withinReleaseDeadline;
  return {
    ...proof,
    postQuiescenceExactActorProof: finalExactActorDecision,
    postQuiescenceProofEpoch: stableHistory.proofEpoch ?? null,
    collection: {
      schema: "v100-phase-g-causal-collection/v1",
      durationBudgetMs: durationMs,
      effectiveDurationBudgetMs: effectiveDurationMs,
      visibleProofDeadlineAt: stableHistory.proofEpoch?.visibleProofDeadlineAt ?? null,
      proofCompletedAtPageTime: finalExactActorDecision.proofCompletedAtPageTime ?? null,
      finalPageNow: stableHistory.pageNow ?? null,
      withinReleaseDeadline,
      elapsedMs,
      attemptedSampleCount: samples.length,
      validSampleCount: proof.sampleCount,
      atomicReceiptSchema: lastAtomicReceipt?.schema ?? null,
      pageTransactionCount,
      pageTransactionTimeoutMs: COMBAT_CAUSAL_PAGE_TRANSACTION_TIMEOUT_MS,
      hostDeadlineAt,
      postConvergencePageSampleCount,
      finalStableHistoryReadbackCount,
      minimumDwellMs: COMBAT_CAUSAL_CONVERGENCE_MIN_DWELL_MS,
      minimumSamples: COMBAT_CAUSAL_CONVERGENCE_MIN_SAMPLES,
      converged,
      terminationReason: converged
        ? "causal-and-exact-actor-contract-satisfied-after-minimum-observation"
        : "release-origin-duration-budget-exhausted-or-proof-incomplete",
    },
  };
}

async function saveScreenshot(page, filePath, label) {
  await page.screenshot({ path: filePath, animations: "disabled" });
  const bytes = await readFile(filePath);
  const metadata = await stat(filePath);
  invariant(metadata.size > 1000 && bytes.slice(0, 8).toString("hex") === "89504e470d0a1a0a", `${label} is not a valid PNG`);
  return { path: relativeEvidence(filePath), sha256: createHash("sha256").update(bytes).digest("hex"), bytes: metadata.size };
}

async function phaseGBrowser(engineName, isolation = "shared-per-engine") {
  const current = phaseGBrowsers.get(engineName);
  if (current?.isConnected?.()) return current;
  if (current) await current.close().catch(() => {});
  const browser = await playwright[engineName].launch({ headless: true });
  phaseGBrowserSessionOrdinal += 1;
  phaseGBrowserMetadata.set(browser, {
    sessionId: `${engineName}-${phaseGBrowserSessionOrdinal}`,
    launchOrdinal: phaseGBrowserSessionOrdinal,
    engineName,
    isolation,
    captureCount: 0,
  });
  phaseGBrowsers.set(engineName, browser);
  return browser;
}

function phaseGBrowserSessionForCapture(browser, policy) {
  const metadata = phaseGBrowserMetadata.get(browser);
  invariant(metadata, `Phase G browser metadata missing for ${policy.engineName}/${policy.state}`);
  metadata.captureCount += 1;
  invariant(policy.maxCapturesPerBrowser === null || metadata.captureCount <= policy.maxCapturesPerBrowser,
    `Phase G browser session ${metadata.sessionId} exceeded ${policy.maxCapturesPerBrowser} capture(s)`);
  return Object.freeze({
    sessionId: metadata.sessionId,
    launchOrdinal: metadata.launchOrdinal,
    engineName: metadata.engineName,
    isolation: metadata.isolation,
    captureOrdinal: metadata.captureCount,
    maxCapturesPerBrowser: policy.maxCapturesPerBrowser,
  });
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
  const browserPolicy = phaseGBrowserLifecyclePolicy(engineName, state);
  if (browserPolicy.closeExistingBeforeCapture) await resetPhaseGBrowser(engineName);
  const browser = await phaseGBrowser(engineName, browserPolicy.isolation);
  const browserSession = phaseGBrowserSessionForCapture(browser, browserPolicy);
  const context = await browser.newContext({ viewport, hasTouch: viewport.safeArea, isMobile: viewport.safeArea });
  const page = await context.newPage();
  const label = `${engineName}-${viewportLabel(viewport)}-${state}`;
  const captureStartedAt = Date.now();
  let pageCrashPrimary = null;
  let capturePrimaryFailure = null;
  const hostResourceTelemetry = engineName === "webkit" && state === "battle-extra" && checkpointContract
    ? await createWebKitHostResourceTelemetry({
      evidenceDir: path.join(evidenceDir, "diagnostics"),
      label: `${checkpointContract.variant}-${engineName}-${viewportLabel(viewport)}`,
      referenceRoot: process.cwd(),
      metadata: {
        owner: "phase-g-battle-extra",
        variant: checkpointContract.variant,
        engine: engineName,
        viewport: viewportLabel(viewport),
        browserSessionId: browserSession.sessionId,
        captureOrdinal: browserSession.captureOrdinal,
      },
    })
    : null;
  const telemetryCaseDetails = {
    owner: "phase-g-battle-extra",
    variant: checkpointContract?.variant ?? state,
    engine: engineName,
    viewport: viewportLabel(viewport),
    browserSessionId: browserSession.sessionId,
    captureOrdinal: browserSession.captureOrdinal,
  };
  const setTelemetryIdle = () => hostResourceTelemetry?.setContext({
    ...telemetryCaseDetails,
    operationId: "phase-g-idle",
    operationStatus: "idle",
  });
  const runPhaseGTelemetryOperation = async (operationId, details, operation) => {
    const operationContext = {
      ...telemetryCaseDetails,
      ...details,
      operationId,
      operationStatus: "running",
    };
    hostResourceTelemetry?.setContext(operationContext);
    hostResourceTelemetry?.event("operation-begin", operationContext);
    try {
      const result = await operation();
      hostResourceTelemetry?.event("operation-end", { ...operationContext, operationStatus: "completed" });
      setTelemetryIdle();
      return result;
    } catch (error) {
      const failedContext = { ...operationContext, operationStatus: "failed", error: String(error) };
      hostResourceTelemetry?.event("operation-end", failedContext);
      hostResourceTelemetry?.setContext(failedContext);
      throw error;
    }
  };
  setTelemetryIdle();
  hostResourceTelemetry?.event("page-created", {
    variant: checkpointContract?.variant ?? null,
    browserSessionId: browserSession.sessionId,
  });
  page.on("crash", () => {
    pageCrashPrimary ??= {
      code: "WEBKIT_PAGE_CRASH",
      label,
      occurredAt: new Date().toISOString(),
      elapsedMs: Date.now() - captureStartedAt,
    };
    hostResourceTelemetry?.event("page-crash", pageCrashPrimary);
  });
  page.on("close", () => hostResourceTelemetry?.event("page-close"));
  context.on("close", () => hostResourceTelemetry?.event("context-close"));
  browser.on("disconnected", () => hostResourceTelemetry?.event("browser-disconnect"));
  const diagnostics = diagnosticsFor(page);
  const checkpointRecorder = engineName === "webkit" && state === "battle-extra" && checkpointContract
    ? createBattleExtraCheckpointRecorder({ contract: checkpointContract, engineName, viewport, context, page, browser, browserSession, hostResourceTelemetry })
    : null;
  checkpointRecorder?.attach();
  try {
    const captureMeta = await runPhaseGTelemetryOperation(
      "phase-g/configure",
      { state },
      async () => await configure(page) ?? {},
    );
    const productionContract = await runPhaseGTelemetryOperation(
      "phase-g/production-contract-readback",
      { state },
      () => productionStateContract(page, state),
    );
    invariant(productionContract.ok, `${label} production state contract failed: ${JSON.stringify(productionContract)}`);
    checkpointRecorder?.setLatestReadableState(productionContract);
    checkpointRecorder?.setAwaiting("causal-proof", { predicate: "source -> contact/travel -> reaction -> audio" });
    let combatCausalProof = null;
    const requiredPostEpochActorKeys = Array.isArray(captureMeta.requiredPostEpochActorKeys)
      ? [...new Set(captureMeta.requiredPostEpochActorKeys)]
      : [];
    let causalPageRpcSealed = false;
    try {
      if (state.startsWith("battle")) {
        combatCausalProof = await runPhaseGTelemetryOperation(
          "phase-g/causal-proof",
          { state, durationMs: captureMeta.combatProofDurationMs ?? combatProofDurationMs },
          () => collectCombatCausalProof(page, {
            durationMs: captureMeta.combatProofDurationMs ?? combatProofDurationMs,
            requiredPostEpochActorKeys,
          }),
        );
      }
    } catch (error) {
      causalPageRpcSealed = error?.phaseGCausalNoFurtherPageRpc === true;
      throw error;
    } finally {
      if (state.startsWith("battle") && !causalPageRpcSealed) {
        await runPhaseGTelemetryOperation(
          "phase-g/observer-stop",
          { state },
          () => page.evaluate(() => window.__PHASE_G_COMBAT_OBSERVER__?.stop?.()).catch(() => {}),
        );
      }
    }
    if (state.startsWith("battle")) invariant(combatCausalProof?.ok === true, `${label} combat causal proof failed: ${JSON.stringify(combatCausalProof)}`);
    if (requiredPostEpochActorKeys.length > 0) {
      invariant(combatCausalProof?.postQuiescenceExactActorProof?.accepted === true
        && combatCausalProof?.collection?.converged === true
        && combatCausalProof?.collection?.withinReleaseDeadline === true,
      `${label} exact post-quiescence actor proof failed inside the single release deadline: ${JSON.stringify(combatCausalProof)}`);
      if (captureMeta.presentationQuiescence) {
        captureMeta.presentationQuiescence.postReleaseProofEpochFinal = combatCausalProof.postQuiescenceProofEpoch;
      }
      for (const actor of combatCausalProof.postQuiescenceExactActorProof.actors) {
        const [side, kind] = actor.actorKey.split(":", 2);
        if (side === "zombie") {
          checkpointRecorder?.markOnce("proof-actor-mounted-or-absent", "observed", {
            actor: kind,
            source: "post-quiescence-exact-sequence",
            fighterId: actor.observedFighterId,
          });
          checkpointRecorder?.markOnce("living-human-target-acquired-or-not-required", "observed", {
            actor: kind,
            evidence: "post-quiescence-exact-live-target",
            sourceId: actor.observedFighterId,
            targetId: actor.targetId,
            targetSide: actor.targetSide,
          });
          checkpointRecorder?.mark("proof-actor-attack-observed-or-not-required", "observed", {
            actor: kind,
            evidence: "post-quiescence-exact-sequence-target-cue",
          });
        } else if (side === "human") {
          checkpointRecorder?.mark("proof-unit-deployed-and-attacked-or-not-required", "observed", {
            unitKind: kind,
            evidence: "post-quiescence-exact-sequence-target-cue",
          });
        }
      }
    }
    if (checkpointRecorder) {
      checkpointRecorder.clearAwaiting();
      checkpointRecorder.mark("causal-proof-complete", "completed", {
        sampleCount: combatCausalProof?.sampleCount ?? 0,
        stages: combatCausalProof?.stages ?? null,
        exactActorProof: combatCausalProof?.postQuiescenceExactActorProof ?? null,
        collection: combatCausalProof?.collection ?? null,
      });
    }
    const screenshot = await runPhaseGTelemetryOperation(
      "phase-g/production-screenshot",
      { state, output: relativeEvidence(imagePath(label)) },
      () => saveScreenshot(page, imagePath(label), label),
    );
    if (requiredPostEpochActorKeys.length > 0) {
      const releaseDeadlineReceipt = await page.evaluate(() => {
        const epoch = window.__PHASE_G_POST_QUIESCENCE_PROOF_EPOCH__ ?? null;
        const pageNow = performance.now();
        return {
          schema: "v100-phase-g-release-deadline-receipt/v1",
          pageNow,
          visibleProofStartedAt: epoch?.visibleProofStartedAt ?? null,
          visibleProofDeadlineAt: epoch?.visibleProofDeadlineAt ?? null,
          withinReleaseDeadline: Number(pageNow) <= Number(epoch?.visibleProofDeadlineAt),
        };
      });
      invariant(releaseDeadlineReceipt.withinReleaseDeadline === true,
        `${label} production screenshot exceeded the single release-origin deadline: ${JSON.stringify(releaseDeadlineReceipt)}`);
      screenshot.releaseDeadlineReceipt = releaseDeadlineReceipt;
    }
    checkpointRecorder?.mark("screenshot-saved", "completed", { evidence: screenshot });
    const overflow = await runPhaseGTelemetryOperation(
      "phase-g/overflow-audit",
      { state },
      () => overflowAudit(page),
    );
    const runtime = await runPhaseGTelemetryOperation(
      "phase-g/runtime-readback",
      { state },
      () => page.evaluate((battleState) => {
      const snapshot = battleState ? window.__PHASE_G_LAST_COMBAT_SNAPSHOT__ : null;
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
        targetOwnershipHistory: observedCombatActivity.targetOwnershipHistory ?? [],
        reactionHistory: observedCombatActivity.reactionHistory ?? [],
        battlePresentationEffects: (snapshot.battlePresentation?.effects?.length ?? 0) > 0 ? snapshot.battlePresentation.effects : observedCombatActivity.battlePresentationEffects ?? [],
        shots: snapshot.shots?.map((shot) => ({ sourceId: shot.sourceId, targetId: shot.targetId, weapon: shot.weapon, effect: shot.effect, x: shot.x, y: shot.y, tx: shot.tx, ty: shot.ty, life: shot.life })) ?? [],
        damageTexts: snapshot.damageTexts?.map((entry) => ({ value: entry.value, x: entry.x, y: entry.y, life: entry.life })) ?? [],
        audioCueRequests: window.__ASHFALL_AUDIO_QA__?.getCueRequests?.() ?? [],
        crawlerAbility: snapshot.crawlerAbility ?? null,
        missionObjects: snapshot.battlefieldObjects ?? [],
        manualAbilityVfx: snapshot.manualAbilityVfx ?? [],
        manualAbilityReceipts: snapshot.manualAbilityReceipts ?? [],
        phaseGCombatSnapshotProfile: window.__PHASE_G_COMBAT_SNAPSHOT_PROFILE__ ?? null,
      };
      }, state.startsWith("battle")),
    );
    const finalDiagnostics = await runPhaseGTelemetryOperation(
      "phase-g/final-diagnostics",
      { state },
      async () => {
        invariant(overflow.every(({ delta }) => delta <= 1), `${label} horizontal overflow: ${JSON.stringify(overflow)}`);
        invariant(await page.locator("body").evaluate((body) => body.innerText.trim().length > 0), `${label} blank body`);
        invariant(diagnostics.consoleErrors.length === 0, `${label} console errors: ${JSON.stringify(diagnostics.consoleErrors)}`);
        invariant(diagnostics.pageErrors.length === 0, `${label} page errors: ${JSON.stringify(diagnostics.pageErrors)}`);
        invariant(diagnostics.httpFailures.length === 0, `${label} HTTP failures: ${JSON.stringify(diagnostics.httpFailures)}`);
        invariant(diagnostics.requestFailures.length === 0, `${label} request failures: ${JSON.stringify(diagnostics.requestFailures)}`);
        const checkpointEvidence = checkpointRecorder?.snapshot() ?? null;
        if (checkpointEvidence) invariant(checkpointEvidence.unresolvedCheckpoints.length === 0, `${label} checkpoint recorder incomplete: ${JSON.stringify(checkpointEvidence)}`);
        const pwaOfferShown = await page.evaluate(() => document.documentElement.dataset.phaseGPwaOffer === "shown");
        return { checkpointEvidence, pwaOfferShown };
      },
    );
    const { checkpointEvidence, pwaOfferShown } = finalDiagnostics;
    results.push({ engine: engineName, viewport: viewportLabel(viewport), state, variant: captureMeta.variant ?? state, capturedAt: new Date().toISOString(), pwaOfferShown, evidence: screenshot, diagnostics, overflow, productionContract, combatCausalProof, runtime, checkpointEvidence, hostResourceTelemetry: hostResourceTelemetry?.reference() ?? null, ...captureMeta });
    return screenshot;
  } catch (error) {
    const primaryError = pageCrashPrimary
      ? Object.assign(new Error(`${label} primary WebKit page crash at ${pageCrashPrimary.elapsedMs} ms`), {
        code: pageCrashPrimary.code,
        pageCrash: pageCrashPrimary,
        secondaryError: String(error),
        cause: error,
      })
      : error;
    const { failureState, checkpointFailure } = await runPhaseGTelemetryOperation(
      "phase-g/final-diagnostics",
      { state, diagnosticOutcome: "failure" },
      async () => {
        if (primaryError?.phaseGCausalNoFurtherPageRpc === true) {
          const failureState = {
            schema: "v100-phase-g-causal-no-further-page-rpc/v1",
            causalTransaction: cloneDiagnosticValue(primaryError.phaseGCausalTransaction ?? null),
            pageRpcSealed: true,
          };
          const checkpointFailure = checkpointRecorder
            ? await checkpointRecorder.persistFailure({
              label,
              error: primaryError,
              failureState,
              diagnostics,
              allowPageRpc: false,
            })
            : null;
          return { failureState, checkpointFailure };
        }
        const failureState = await page.evaluate((battleState) => ({
          url: location.href,
          phase: document.querySelector(".v100-shell")?.getAttribute("data-v100-phase") ?? null,
          surface: document.querySelector(".v100-shell")?.getAttribute("data-v100-surface") ?? null,
          body: document.body.innerText.slice(0, 1600),
          phaseGCombatSnapshotProfile: window.__PHASE_G_COMBAT_SNAPSHOT_PROFILE__ ?? null,
          snapshot: (() => {
            const snapshot = battleState ? window.__PHASE_G_LAST_COMBAT_SNAPSHOT__ : null;
            return snapshot ? {
              screen: snapshot.screen,
              stageId: snapshot.stageId,
              time: snapshot.time,
              wave: snapshot.wave,
              fighters: snapshot.fighters?.map((fighter) => ({
                id: fighter.id,
                side: fighter.side,
                kind: fighter.kind,
                hp: fighter.hp,
                maxHp: fighter.maxHp,
                x: fighter.x,
                combatReady: fighter.combatReady,
                gateEntering: fighter.gateEntering,
                cooldown: fighter.cooldown,
                stunned: fighter.stunned,
                attack: fighter.attack,
                attackWindup: fighter.attackWindup,
                abilityWindup: fighter.abilityWindup,
                attackSequence: fighter.attackSequence,
                targetId: fighter.targetId,
                attackWindupTargetId: fighter.attackWindupTargetId,
                enemyVfxPhase: fighter.enemyVfx?.phase,
                enemyVfxAttacking: fighter.enemyVfx?.attacking,
              })) ?? [],
            } : null;
          })(),
          preReleaseReadiness: (() => {
            const readiness = window.__PHASE_G_PRE_RELEASE_READINESS__;
            if (readiness?.schema !== "v100-phase-g-pre-release-readiness/v2") return null;
            return {
              schema: readiness.schema,
              stageId: readiness.stageId ?? null,
              armedAtPageTime: readiness.armedAtPageTime ?? null,
              armedAtBattleTime: readiness.armedAtBattleTime ?? null,
              audioCueRequestCutoffAt: readiness.audioCueRequestCutoffAt ?? null,
              actorKeys: [...(readiness.actorKeys ?? [])].slice(0, 4),
              releaseAnchorKey: readiness.releaseAnchorKey ?? null,
              selectionSnapshotObservedAtPageTime: readiness.selectionSnapshotObservedAtPageTime ?? null,
              selectionSnapshotBattleTime: readiness.selectionSnapshotBattleTime ?? null,
              sameTaskSnapshotReadCount: readiness.sameTaskSnapshotReadCount ?? null,
              cachedObserverSnapshotUsedForHandoff: readiness.cachedObserverSnapshotUsedForHandoff ?? null,
              actors: (readiness.actors ?? []).slice(0, 4).map((actor) => ({
                side: actor.side ?? null,
                kind: actor.kind ?? null,
                cueId: actor.cueId ?? null,
                releaseRole: actor.releaseRole ?? null,
                releaseMode: actor.releaseMode ?? null,
                cueObserved: actor.cueObserved ?? null,
                hiddenQualificationObserved: actor.hiddenQualificationObserved ?? null,
                windupObserved: actor.windupObserved ?? null,
                fighterBaselines: (actor.fighterBaselines ?? []).slice(0, 16).map((baseline) => ({
                  fighterId: baseline.fighterId ?? null,
                  baselineAttackSequence: baseline.baselineAttackSequence ?? null,
                })),
                selectedFighterId: actor.selectedFighterId ?? null,
                selectedAttackSequence: actor.selectedAttackSequence ?? null,
                selectedAttackWindup: actor.selectedAttackWindup ?? null,
                selectedAttackWindupTargetId: actor.selectedAttackWindupTargetId ?? null,
                selectedTargetId: actor.selectedTargetId ?? null,
                selectedTargetSide: actor.selectedTargetSide ?? null,
                selectedTargetKind: actor.selectedTargetKind ?? null,
                selectedTargetAlive: actor.selectedTargetAlive ?? null,
                readyAtPageTime: actor.readyAtPageTime ?? null,
                readyAtBattleTime: actor.readyAtBattleTime ?? null,
              })),
            };
          })(),
          postQuiescenceProof: (() => {
            const epoch = window.__PHASE_G_POST_QUIESCENCE_PROOF_EPOCH__;
            if (epoch?.schema !== "v100-phase-g-post-quiescence-proof/v5") return null;
            return {
              schema: epoch.schema,
              stageId: epoch.stageId ?? null,
              visibleProofStartedAt: epoch.visibleProofStartedAt ?? null,
              visibleProofDeadlineAt: epoch.visibleProofDeadlineAt ?? null,
              audioCueRequestCutoffAt: epoch.audioCueRequestCutoffAt ?? null,
              releaseAnchor: epoch.releaseAnchor ? {
                actorKey: epoch.releaseAnchor.actorKey ?? null,
                releaseMode: epoch.releaseAnchor.releaseMode ?? null,
                fighterId: epoch.releaseAnchor.fighterId ?? null,
                baselineAttackSequence: epoch.releaseAnchor.baselineAttackSequence ?? null,
                targetId: epoch.releaseAnchor.targetId ?? null,
                targetSide: epoch.releaseAnchor.targetSide ?? null,
                targetKind: epoch.releaseAnchor.targetKind ?? null,
                targetAlive: epoch.releaseAnchor.targetAlive ?? null,
                attackWindupSeconds: epoch.releaseAnchor.attackWindupSeconds ?? null,
                handoffAtBattleTime: epoch.releaseAnchor.handoffAtBattleTime ?? null,
                handoffAtPageTime: epoch.releaseAnchor.handoffAtPageTime ?? null,
                handoffValid: epoch.releaseAnchor.handoffValid ?? null,
                selectionSnapshotObservedAtPageTime: epoch.releaseAnchor.selectionSnapshotObservedAtPageTime ?? null,
                selectionSnapshotBattleTime: epoch.releaseAnchor.selectionSnapshotBattleTime ?? null,
                sameTaskSnapshotReadCount: epoch.releaseAnchor.sameTaskSnapshotReadCount ?? null,
                cachedObserverSnapshotUsedForHandoff: epoch.releaseAnchor.cachedObserverSnapshotUsedForHandoff ?? null,
                releaseReceiptMatchesSelectionSnapshot: epoch.releaseAnchor.releaseReceiptMatchesSelectionSnapshot ?? null,
              } : null,
              actors: (epoch.actors ?? []).slice(0, 4).map((actor) => {
                const observedAtPageTime = actor.observedAtPageTime ?? null;
                const audioObservedAtPageTime = actor.audioObservedAtPageTime ?? null;
                const proofCompletedAtPageTime = observedAtPageTime !== null
                  && Number.isFinite(Number(observedAtPageTime))
                  && (!actor.cueId || audioObservedAtPageTime !== null && Number.isFinite(Number(audioObservedAtPageTime)))
                  ? Math.max(Number(observedAtPageTime), actor.cueId ? Number(audioObservedAtPageTime) : Number(observedAtPageTime))
                  : null;
                return {
                  side: actor.side ?? null,
                  kind: actor.kind ?? null,
                  cueId: actor.cueId ?? null,
                  selectedFighterId: actor.selectedFighterId ?? null,
                  observedPostEpochAttack: actor.observedPostEpochAttack ?? null,
                  observedFighterId: actor.observedFighterId ?? null,
                  observedAttackSequence: actor.observedAttackSequence ?? null,
                  observedAtBattleTime: actor.observedAtBattleTime ?? null,
                  observedAtPageTime,
                  sourceAliveAtObservation: actor.sourceAliveAtObservation ?? null,
                  targetId: actor.targetId ?? null,
                  targetSide: actor.targetSide ?? null,
                  targetKind: actor.targetKind ?? null,
                  targetAlive: actor.targetAlive ?? null,
                  targetEvidenceSource: actor.targetEvidenceSource ?? null,
                  audioObserved: actor.audioObserved ?? null,
                  audioObservedAtPageTime,
                  proofCompletedAtPageTime,
                  eventTimeWithinDeadline: proofCompletedAtPageTime !== null
                    && Number(proofCompletedAtPageTime) >= Number(epoch.visibleProofStartedAt)
                    && Number(proofCompletedAtPageTime) <= Number(epoch.visibleProofDeadlineAt),
                  currentActorAlive: actor.actorAlive ?? null,
                };
              }),
            };
          })(),
          phaseGActivity: window.__PHASE_G_COMBAT_ACTIVITY__ ?? null,
        }), state.startsWith("battle")).catch(() => null);
        const checkpointFailure = checkpointRecorder
          ? await checkpointRecorder.persistFailure({ label, error: primaryError, failureState, diagnostics, allowPageRpc: true })
          : null;
        return { failureState, checkpointFailure };
      },
    );
    const failure = new Error(`${label} failed: ${String(primaryError)} secondary=${pageCrashPrimary ? String(error) : "none"} state=${JSON.stringify(failureState)} diagnostics=${JSON.stringify(diagnostics)} checkpointEvidence=${JSON.stringify(checkpointFailure)}`);
    failure.cause = primaryError;
    failure.phaseGFailure = {
      label,
      primaryCode: primaryError?.code ?? null,
      pageCrash: pageCrashPrimary,
      secondaryError: pageCrashPrimary ? String(error) : null,
      failureState,
      diagnostics,
      checkpointEvidence: checkpointFailure,
    };
    capturePrimaryFailure = failure;
    throw failure;
  } finally {
    try {
      hostResourceTelemetry?.event("context-cleanup-begin");
      await context.close();
    } finally {
      if (checkpointRecorder) {
        await checkpointRecorder.writeFailureFile();
        phaseGCheckpointRecorders.delete(checkpointRecorder);
        pageCheckpointRecorders.delete(page);
      }
      if (browserPolicy.closeAfterCapture) {
        hostResourceTelemetry?.event("browser-cleanup-begin");
        await resetPhaseGBrowser(engineName);
      }
      let hostResourceTelemetrySummary = null;
      try {
        hostResourceTelemetrySummary = await hostResourceTelemetry?.stop({
          event: "capture-cleanup-complete",
          variant: checkpointContract?.variant ?? null,
        });
      } catch (telemetryError) {
        if (capturePrimaryFailure) {
          capturePrimaryFailure.phaseGFailure.telemetryFailure = {
            code: "WEBKIT_HOST_TELEMETRY_PERSISTENCE_FAILED",
            error: String(telemetryError),
          };
        } else {
          throw telemetryError;
        }
      }
      if (hostResourceTelemetrySummary?.supported === true
        && hostResourceTelemetrySummary.status !== "complete") {
        const telemetryFailure = {
          code: "WEBKIT_HOST_TELEMETRY_INVALID",
          status: hostResourceTelemetrySummary.status,
          invalidReason: hostResourceTelemetrySummary.invalidReason ?? null,
        };
        if (capturePrimaryFailure) {
          capturePrimaryFailure.phaseGFailure.telemetryFailure = telemetryFailure;
        } else {
          throw Object.assign(new Error(`${label} host telemetry invalid: ${JSON.stringify(telemetryFailure)}`), telemetryFailure);
        }
      }
    }
  }
}

async function readBattleDeploymentDiagnostics(page, {
  requestedKind = null,
  requestedSlot = null,
  phase = null,
  schedulerProbeId = null,
  dispatchAttemptId = null,
} = {}) {
  if (page.isClosed()) {
    return {
      capturedAt: new Date().toISOString(),
      pageClosed: true,
      requestedKind,
      requestedSlot,
      phase,
      schedulerProbeId,
      dispatchAttemptId,
    };
  }
  const diagnostics = await page.evaluate(({ requestedKind: kind, requestedSlot: slot, phase: diagnosticPhase, activeSchedulerProbeId, receiptAttemptId }) => {
    const diagnosticRegistry = window.__V100_PHASE_G_DEPLOYMENT_DIAGNOSTICS__ ??= { sampleOrdinal: 0 };
    diagnosticRegistry.sampleOrdinal += 1;
    const sampleOrdinal = diagnosticRegistry.sampleOrdinal;
    const schedulerEntry = activeSchedulerProbeId
      ? window.__V100_PHASE_G_DEPLOYMENT_SCHEDULER_PROBES__?.get(activeSchedulerProbeId)
      : null;
    const schedulerProbe = schedulerEntry ? {
      probeId: schedulerEntry.probeId,
      status: schedulerEntry.status,
      requestedAtWallTimeMs: schedulerEntry.requestedAtWallTimeMs,
      requestedAtPerformanceMs: schedulerEntry.requestedAtPerformanceMs,
      observedAtWallTimeMs: schedulerEntry.observedAtWallTimeMs,
      observedAtPerformanceMs: schedulerEntry.observedAtPerformanceMs,
      callbackTimestamp: schedulerEntry.callbackTimestamp,
    } : (activeSchedulerProbeId ? { probeId: activeSchedulerProbeId, status: "missing" } : null);
    const snapshot = window.__PHASE_G_LAST_COMBAT_SNAPSHOT__;
    const nodeRegistry = window.__V100_PHASE_G_DEPLOYMENT_NODE_IDS__ ??= {
      ids: new WeakMap(),
      next: 1,
    };
    const nodeIdFor = (node) => {
      if (!nodeRegistry.ids.has(node)) nodeRegistry.ids.set(node, `deployment-card-${nodeRegistry.next++}`);
      return nodeRegistry.ids.get(node);
    };
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
      const style = window.getComputedStyle(card);
      const rail = card.closest(".unit-cards");
      const railRect = rail ? visibleRect(rail) : null;
      const viewportRect = {
        x: window.visualViewport?.offsetLeft ?? 0,
        y: window.visualViewport?.offsetTop ?? 0,
        width: window.visualViewport?.width ?? window.innerWidth,
        height: window.visualViewport?.height ?? window.innerHeight,
      };
      const intersects = (left, right) => Boolean(left && right)
        && left.x < right.x + right.width
        && left.x + left.width > right.x
        && left.y < right.y + right.height
        && left.y + left.height > right.y;
      const center = {
        x: Math.round((rect.x + rect.width / 2) * 100) / 100,
        y: Math.round((rect.y + rect.height / 2) * 100) / 100,
      };
      const hitTarget = document.elementFromPoint(center.x, center.y);
      const hitOwner = hitTarget instanceof Element ? hitTarget.closest("button.unit-card") : null;
      const nodeId = nodeIdFor(card);
      const ariaLabel = card.getAttribute("aria-label") ?? "";
      const cost = ariaLabel.match(/コスト\s*(\d+)/u)?.[1] ?? null;
      return {
        nodeId,
        kind: card.getAttribute("data-kind"),
        slot: card.getAttribute("data-slot-index"),
        state: card.getAttribute("data-state"),
        blockReason: card.getAttribute("data-block-reason"),
        ariaDisabled: card.getAttribute("aria-disabled"),
        disabled: card.disabled === true,
        ariaLabel,
        cost: cost === null ? null : Number(cost),
        text: (card.textContent ?? "").trim().replace(/\s+/gu, " ").slice(0, 180),
        rect,
        center,
        centerInCard: center.x >= rect.x
          && center.x <= rect.x + rect.width
          && center.y >= rect.y
          && center.y <= rect.y + rect.height,
        centerInViewport: center.x >= viewportRect.x
          && center.x <= viewportRect.x + viewportRect.width
          && center.y >= viewportRect.y
          && center.y <= viewportRect.y + viewportRect.height,
        centerInRail: Boolean(railRect)
          && center.x >= railRect.x
          && center.x <= railRect.x + railRect.width
          && center.y >= railRect.y
          && center.y <= railRect.y + railRect.height,
        viewportIntersection: intersects(rect, viewportRect),
        railIntersection: intersects(rect, railRect),
        pointerEvents: style.pointerEvents,
        style: {
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
          pointerEvents: style.pointerEvents,
        },
        activeAnimations: card.getAnimations().filter((animation) => animation.playState === "running").map((animation) => ({
          playState: animation.playState,
          currentTime: Number.isFinite(Number(animation.currentTime)) ? Number(animation.currentTime) : null,
          playbackRate: animation.playbackRate,
        })),
        hitOwner: hitOwner ? {
          nodeId: nodeIdFor(hitOwner),
          kind: hitOwner.getAttribute("data-kind"),
          slot: hitOwner.getAttribute("data-slot-index"),
        } : null,
        hitOwnerMatches: hitOwner === card,
        hitTarget: hitTarget instanceof Element ? {
          tag: hitTarget.tagName,
          classes: hitTarget.getAttribute("class"),
        } : null,
        rail: rail ? {
          scrollLeft: Math.round(rail.scrollLeft * 100) / 100,
          scrollWidth: rail.scrollWidth,
          clientWidth: rail.clientWidth,
          rect: railRect,
        } : null,
      };
    });
    const dispatchReceipt = receiptAttemptId
      ? window.__V100_PHASE_G_DEPLOYMENT_POINTER_RECEIPTS__?.get(receiptAttemptId)
      : null;
    const humanFighters = (snapshot?.fighters ?? []).filter((fighter) => (
      fighter.side === "human" && Number(fighter.hp) > 0
    ));
    const mission = snapshot?.stageMission ?? null;
    const objectiveText = [...document.querySelectorAll(
      ".battle-objective, [data-battle-objective], [aria-label*='目標' i]",
    )].map((element) => (element.textContent ?? "").trim()).filter(Boolean);
    if (dispatchReceipt) dispatchReceipt.dispatchStartedAtPerformanceMs = performance.now();
    return {
      capturedAt: new Date().toISOString(),
      pageClosed: false,
      url: location.href,
      requestedKind: kind,
      requestedSlot: slot,
      phase: diagnosticPhase,
      dispatchAttemptId: receiptAttemptId,
      dispatchStartedAtPerformanceMs: dispatchReceipt?.dispatchStartedAtPerformanceMs ?? null,
      sampleOrdinal,
      sampledAtWallTimeMs: Date.now(),
      sampledAtPerformanceMs: performance.now(),
      schedulerProbe,
      viewport: {
        x: window.visualViewport?.offsetLeft ?? 0,
        y: window.visualViewport?.offsetTop ?? 0,
        width: window.visualViewport?.width ?? window.innerWidth,
        height: window.visualViewport?.height ?? window.innerHeight,
        scale: window.visualViewport?.scale ?? 1,
      },
      pageLifecycle: {
        visibilityState: document.visibilityState,
        hidden: document.hidden,
        readyState: document.readyState,
        hasFocus: document.hasFocus(),
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
  }, { requestedKind, requestedSlot, phase, activeSchedulerProbeId: schedulerProbeId, receiptAttemptId: dispatchAttemptId }).catch((error) => ({
    capturedAt: new Date().toISOString(),
    pageClosed: page.isClosed(),
    requestedKind,
    requestedSlot,
    phase,
    schedulerProbeId,
    dispatchAttemptId,
    evaluateError: String(error),
  }));
  if (!Array.isArray(diagnostics.cards)) return diagnostics;
  return {
    ...diagnostics,
    cards: diagnostics.cards.map((card) => ({
      ...card,
      actionability: deploymentEligibilityForCard(card, diagnostics.battle),
    })),
  };
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
  const reads = [];
  let latest = null;
  let fulfilledPostRead = false;
  let sampleIndex = 0;
  while (Date.now() < deadline) {
    const remaining = deadline - Date.now();
    const read = await observePromiseWithin(readBattleDeploymentDiagnostics(page, {
      requestedKind,
      requestedSlot,
      phase: sampleIndex === 0 ? "after-click" : "after-click-wait",
    }), remaining);
    reads.push({
      status: read.status,
      timeoutMs: read.timeoutMs ?? null,
      error: read.error ?? null,
      sampleIndex: sampleIndex + 1,
    });
    sampleIndex += 1;
    if (read.status !== "fulfilled") {
      latest = {
        ...before,
        phase: "after-click-read-bounded-stop",
        acceptanceReadStatus: read.status,
        acceptanceReadError: read.error ?? null,
      };
      break;
    }
    latest = read.value;
    fulfilledPostRead = true;
    if (deploymentWasAccepted(before, latest, requestedKind) || latest?.pageClosed || latest?.evaluateError) break;
    await new Promise((resolve) => setTimeout(resolve, Math.min(60, Math.max(1, deadline - Date.now()))));
  }
  const accepted = fulfilledPostRead && latest !== null && deploymentWasAccepted(before, latest, requestedKind);
  if (accepted) recorder?.clearAwaiting();
  recorder?.setLatestReadableState(latest);
  return {
    accepted,
    diagnostics: latest,
    reads,
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

function normalizePhaseGPresentationQuiescenceBoundary(value) {
  if (value === null || value === undefined) return null;
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new Error("presentation quiescence requires a finite positive battle-time boundary");
  }
  return normalized;
}

async function armPhaseGPresentationQuiescence(page, {
  expectedStageId,
  recorder = null,
}) {
  recorder?.setAwaiting("presentation-quiescence", {
    expectedStageId,
    predicate: "production simulation and player setup advance while pre-proof presentation is held",
  });
  const arm = await page.evaluate(({ stageId }) => {
    const bridge = window.__ASHFALL_BATTLE_QA__;
    if (typeof bridge?.setQaPresentationQuiesced !== "function"
      || typeof bridge?.getQaPresentationQuiescence !== "function") {
      throw new Error("Phase G presentation quiescence bridge is unavailable");
    }
    const before = bridge.getQaPresentationQuiescence();
    if (before?.stageId !== stageId) throw new Error(`Phase G presentation stage mismatch before arm: ${before?.stageId ?? "missing"}`);
    return bridge.setQaPresentationQuiesced(true, "phase-g-pre-proof");
  }, { stageId: expectedStageId });
  invariant(arm?.schema === "v100-qa-presentation-quiescence/v1", `presentation quiescence arm schema drifted: ${JSON.stringify(arm)}`);
  invariant(arm.active === true && arm.datasetActive === true && arm.owner === "phase-g-pre-proof" && arm.route === "phase-g", `presentation quiescence did not arm: ${JSON.stringify(arm)}`);
  invariant(arm.stageId === expectedStageId && arm.running === true && arm.paused !== true && arm.over !== true, `presentation quiescence armed outside the live expected battle: ${JSON.stringify(arm)}`);
  return arm;
}

async function releasePhaseGPresentationQuiescence(page, {
  arm,
  expectedStageId,
  proofActor,
  proofActorAttackCueId,
  proofUnitKind,
  proofUnitAttackCueId,
  untilBattleTime,
  visibleProofDurationMs,
  recorder = null,
}) {
  invariant(arm?.schema === "v100-qa-presentation-quiescence/v1" && arm.active === true, `presentation quiescence release lacks its exact arm receipt: ${JSON.stringify(arm)}`);
  const normalizedUntilBattleTime = normalizePhaseGPresentationQuiescenceBoundary(untilBattleTime);
  invariant(Number.isFinite(Number(visibleProofDurationMs)) && Number(visibleProofDurationMs) > 0,
    `presentation quiescence release lacks its existing finite proof duration: ${visibleProofDurationMs}`);
  recorder?.setAwaiting("presentation-quiescence", {
    expectedStageId,
    proofActor,
    untilBattleTime: normalizedUntilBattleTime,
    predicate: "player setup, supporting hidden qualification, and an unconsumed exact release-anchor windup converge before same-task release and v5 proof arm",
  });
  if (normalizedUntilBattleTime !== null) {
    invariant(Number(arm.battleTime) < normalizedUntilBattleTime, `presentation quiescence armed after its release boundary: ${JSON.stringify({ arm, normalizedUntilBattleTime })}`);
    await page.waitForFunction(({ stageId, targetBattleTime }) => {
      const bridge = window.__ASHFALL_BATTLE_QA__;
      const quiescence = bridge?.getQaPresentationQuiescence?.();
      const snapshot = window.__PHASE_G_LAST_COMBAT_SNAPSHOT__;
      return quiescence?.schema === "v100-qa-presentation-quiescence/v1"
        && quiescence.active === true
        && quiescence.owner === "phase-g-pre-proof"
        && quiescence.route === "phase-g"
        && quiescence.datasetActive === true
        && quiescence.stageId === stageId
        && snapshot?.stageId === stageId
        && snapshot?.screen === "battle"
        && snapshot?.running === true
        && snapshot?.paused !== true
        && snapshot?.over !== true
        && Number(snapshot?.time) >= targetBattleTime;
    }, { stageId: expectedStageId, targetBattleTime: normalizedUntilBattleTime }, { timeout: Math.min(battleTimeout, 45_000), polling: 100 });
  }
  const specs = [
    proofActor ? { side: "zombie", kind: proofActor, cueId: proofActorAttackCueId ?? null } : null,
    proofUnitKind ? { side: "human", kind: proofUnitKind, cueId: proofUnitAttackCueId ?? null } : null,
  ].filter(Boolean);
  const releaseHandle = await page.waitForFunction(({ stageId, actorSpecs, proofDurationMs, armGeneration }) => {
    const bridge = window.__ASHFALL_BATTLE_QA__;
    const quiescence = bridge?.getQaPresentationQuiescence?.();
    if (quiescence?.schema !== "v100-qa-presentation-quiescence/v1"
      || quiescence.active !== true
      || quiescence.datasetActive !== true
      || quiescence.owner !== "phase-g-pre-proof"
      || quiescence.route !== "phase-g"
      || Number(quiescence.generation) !== Number(armGeneration)
      || quiescence.stageId !== stageId
      || quiescence.running !== true
      || quiescence.paused === true
      || quiescence.over === true
      || typeof bridge?.getPhaseGCombatSnapshot !== "function") return false;
    const snapshot = bridge.getPhaseGCombatSnapshot();
    const selectionSnapshotObservedAtPageTime = performance.now();
    if (snapshot?.schema !== "v100-phase-g-combat-snapshot/v1"
      || snapshot?.stageId !== stageId
      || snapshot?.screen !== "battle"
      || snapshot?.running !== true
      || snapshot?.paused === true
      || snapshot?.over === true) return false;

    const actorKey = (spec) => `${spec.side}:${spec.kind}`;
    let readiness = window.__PHASE_G_PRE_RELEASE_READINESS__;
    if (readiness?.schema !== "v100-phase-g-pre-release-readiness/v2"
      || readiness.stageId !== stageId
      || readiness.actorKeys?.join("|") !== actorSpecs.map(actorKey).join("|")) {
      const armedAtPageTime = performance.now();
      const releaseAnchorKey = actorSpecs.length > 0 ? actorKey(actorSpecs[0]) : null;
      readiness = {
        schema: "v100-phase-g-pre-release-readiness/v2",
        stageId,
        armedAtPageTime,
        armedAtBattleTime: Number(snapshot.time),
        audioCueRequestCutoffAt: armedAtPageTime,
        actorKeys: actorSpecs.map(actorKey),
        releaseAnchorKey,
        selectionSnapshotObservedAtPageTime,
        selectionSnapshotBattleTime: Number(snapshot.time),
        sameTaskSnapshotReadCount: 1,
        cachedObserverSnapshotUsedForHandoff: false,
        actors: actorSpecs.map((spec, index) => ({
          side: spec.side,
          kind: spec.kind,
          cueId: spec.cueId ?? null,
          releaseRole: index === 0 ? "release-anchor" : "supporting-prerequisite",
          releaseMode: index === 0 ? "unconsumed-production-windup" : "completed-hidden-attack",
          fighterBaselines: (snapshot.fighters ?? [])
            .filter((fighter) => fighter.side === spec.side && fighter.kind === spec.kind && Number(fighter.hp) > 0)
            .map((fighter) => ({ fighterId: fighter.id, baselineAttackSequence: Number(fighter.attackSequence) || 0 })),
          cueObserved: index === 0 ? null : spec.cueId ? false : null,
          hiddenQualificationObserved: false,
          windupObserved: false,
          selectedFighterId: null,
          selectedAttackSequence: null,
          selectedAttackWindup: null,
          selectedAttackWindupTargetId: null,
          selectedTargetId: null,
          selectedTargetSide: null,
          selectedTargetKind: null,
          selectedTargetAlive: null,
          readyAtPageTime: null,
          readyAtBattleTime: null,
        })),
      };
      window.__PHASE_G_PRE_RELEASE_READINESS__ = readiness;
    }

    readiness.selectionSnapshotObservedAtPageTime = selectionSnapshotObservedAtPageTime;
    readiness.selectionSnapshotBattleTime = Number(snapshot.time);
    readiness.sameTaskSnapshotReadCount = 1;
    readiness.cachedObserverSnapshotUsedForHandoff = false;
    const allAudioRequests = window.__ASHFALL_AUDIO_QA__?.getCueRequests?.() ?? [];
    const postArmAudio = allAudioRequests.filter((request) => (
      Number.isFinite(Number(request?.at))
      && Number(request.at) > Number(readiness.audioCueRequestCutoffAt)
    ));
    const fighterById = new Map((snapshot.fighters ?? []).map((fighter) => [String(fighter.id), fighter]));
    const actorIsNeutral = (fighter) => (
      Number(fighter?.attack) <= 0
      && Number(fighter?.attackWindup) <= 0
      && Number(fighter?.abilityWindup) <= 0
      && fighter?.enemyVfx?.attacking !== true
      && fighter?.enemyVfx?.attackWindup !== true
      && !["attack", "warning"].includes(fighter?.enemyVfx?.phase)
      && !/attack|windup|ability/u.test(String(fighter?.animationPresentation?.state ?? ""))
    );
    const clearSelection = (actorReadiness) => {
      actorReadiness.hiddenQualificationObserved = false;
      actorReadiness.windupObserved = false;
      actorReadiness.selectedFighterId = null;
      actorReadiness.selectedAttackSequence = null;
      actorReadiness.selectedAttackWindup = null;
      actorReadiness.selectedAttackWindupTargetId = null;
      actorReadiness.selectedTargetId = null;
      actorReadiness.selectedTargetSide = null;
      actorReadiness.selectedTargetKind = null;
      actorReadiness.selectedTargetAlive = null;
      actorReadiness.readyAtPageTime = null;
      actorReadiness.readyAtBattleTime = null;
    };
    const readinessFor = (actorReadiness) => {
      const releaseAnchor = actorReadiness.releaseRole === "release-anchor"
        && actorKey(actorReadiness) === readiness.releaseAnchorKey;
      if (!releaseAnchor && actorReadiness.cueId
        && postArmAudio.some((request) => request?.cueId === actorReadiness.cueId)) {
        actorReadiness.cueObserved = true;
      }
      const candidates = (snapshot.fighters ?? [])
        .filter((fighter) => (
          fighter.side === actorReadiness.side
          && fighter.kind === actorReadiness.kind
          && Number(fighter.hp) > 0
        ))
        .sort((left, right) => Number(left.id) - Number(right.id));
      for (const fighter of candidates) {
        if (!actorReadiness.fighterBaselines.some((baseline) => String(baseline.fighterId) === String(fighter.id))) {
          actorReadiness.fighterBaselines.push({ fighterId: fighter.id, baselineAttackSequence: 0 });
        }
      }
      if (releaseAnchor) {
        const acceptedCandidate = candidates.find((fighter) => {
          if (fighter.attackWindupTargetId === null || fighter.attackWindupTargetId === undefined) return false;
          const target = fighterById.get(String(fighter.attackWindupTargetId)) ?? null;
          const expectedTargetSide = actorReadiness.side === "human" ? "zombie" : "human";
          const attackWindupSeconds = Number(fighter.attackWindup);
          return Number.isFinite(attackWindupSeconds)
            && attackWindupSeconds > 0
            && Number(fighter.attack) <= 0
            && Number(fighter.abilityWindup) <= 0
            && fighter.combatReady === true
            && fighter.gateEntering !== true
            && String(fighter.targetId) === String(fighter.attackWindupTargetId)
            && target?.side === expectedTargetSide
            && Number(target.hp) > 0;
        }) ?? null;
        if (!acceptedCandidate) {
          clearSelection(actorReadiness);
          return false;
        }
        const target = fighterById.get(String(acceptedCandidate.attackWindupTargetId));
        actorReadiness.hiddenQualificationObserved = false;
        actorReadiness.windupObserved = true;
        actorReadiness.selectedFighterId = acceptedCandidate.id;
        actorReadiness.selectedAttackSequence = Number(acceptedCandidate.attackSequence);
        actorReadiness.selectedAttackWindup = Number(acceptedCandidate.attackWindup);
        actorReadiness.selectedAttackWindupTargetId = acceptedCandidate.attackWindupTargetId;
        actorReadiness.selectedTargetId = target?.id ?? null;
        actorReadiness.selectedTargetSide = target?.side ?? null;
        actorReadiness.selectedTargetKind = target?.kind ?? null;
        actorReadiness.selectedTargetAlive = Number(target?.hp) > 0;
        actorReadiness.readyAtPageTime = performance.now();
        actorReadiness.readyAtBattleTime = Number(snapshot.time);
        return true;
      }
      const acceptedCandidate = candidates.find((fighter) => {
        const baseline = actorReadiness.fighterBaselines.find((entry) => String(entry.fighterId) === String(fighter.id));
        const target = fighter.targetId === null || fighter.targetId === undefined
          ? null
          : fighterById.get(String(fighter.targetId)) ?? null;
        const expectedTargetSide = actorReadiness.side === "human" ? "zombie" : "human";
        return Number(fighter.attackSequence) > Number(baseline?.baselineAttackSequence)
          && actorIsNeutral(fighter)
          && target?.side === expectedTargetSide
          && Number(target.hp) > 0
          && (!actorReadiness.cueId || actorReadiness.cueObserved === true);
      }) ?? null;
      if (!acceptedCandidate) {
        clearSelection(actorReadiness);
        return false;
      }
      const target = fighterById.get(String(acceptedCandidate.targetId));
      actorReadiness.hiddenQualificationObserved = true;
      actorReadiness.windupObserved = false;
      actorReadiness.selectedFighterId = acceptedCandidate.id;
      actorReadiness.selectedAttackSequence = Number(acceptedCandidate.attackSequence);
      actorReadiness.selectedAttackWindup = null;
      actorReadiness.selectedAttackWindupTargetId = null;
      actorReadiness.selectedTargetId = target?.id ?? null;
      actorReadiness.selectedTargetSide = target?.side ?? null;
      actorReadiness.selectedTargetKind = target?.kind ?? null;
      actorReadiness.selectedTargetAlive = Number(target?.hp) > 0;
      actorReadiness.readyAtPageTime = performance.now();
      actorReadiness.readyAtBattleTime = Number(snapshot.time);
      return true;
    };
    if (!readiness.actors.every(readinessFor)) return false;

    const receipt = bridge.setQaPresentationQuiesced(false, "phase-g-pre-proof");
    const releaseSnapshot = snapshot;
    const releaseReceiptMatchesSelectionSnapshot = receipt?.schema === "v100-qa-presentation-quiescence/v1"
      && receipt.active === false
      && receipt.datasetActive === false
      && receipt.owner === quiescence.owner
      && receipt.route === quiescence.route
      && Number(receipt.generation) === Number(quiescence.generation)
      && receipt.stageId === releaseSnapshot.stageId
      && receipt.running === releaseSnapshot.running
      && receipt.paused === releaseSnapshot.paused
      && receipt.over === releaseSnapshot.over
      && Number(receipt.battleTime) === Number(releaseSnapshot.time);
    if (!releaseReceiptMatchesSelectionSnapshot) {
      throw new Error(`release receipt did not match the atomic live selection snapshot: ${JSON.stringify({
        quiescence,
        receipt,
        selectionSnapshot: {
          schema: releaseSnapshot.schema,
          stageId: releaseSnapshot.stageId,
          screen: releaseSnapshot.screen,
          running: releaseSnapshot.running,
          paused: releaseSnapshot.paused,
          over: releaseSnapshot.over,
          time: releaseSnapshot.time,
        },
      })}`);
    }
    const releaseAnchorReadiness = readiness.actors.find((actor) => (
      actor.releaseRole === "release-anchor"
      && actorKey(actor) === readiness.releaseAnchorKey
    )) ?? null;
    const releaseAnchorFighter = releaseAnchorReadiness
      ? releaseSnapshot.fighters?.find((fighter) => String(fighter.id) === String(releaseAnchorReadiness.selectedFighterId)) ?? null
      : null;
    const releaseAnchorTarget = releaseAnchorFighter?.attackWindupTargetId === null
      || releaseAnchorFighter?.attackWindupTargetId === undefined
      ? null
      : releaseSnapshot.fighters?.find((fighter) => String(fighter.id) === String(releaseAnchorFighter.attackWindupTargetId)) ?? null;
    const releaseAnchorExpectedTargetSide = releaseAnchorReadiness?.side === "human" ? "zombie" : "human";
    const releaseAnchorHandoffValid = !releaseAnchorReadiness || (
      releaseAnchorReadiness.releaseMode === "unconsumed-production-windup"
      && releaseAnchorReadiness.windupObserved === true
      && Number(releaseAnchorFighter?.hp) > 0
      && releaseAnchorFighter?.combatReady === true
      && releaseAnchorFighter?.gateEntering !== true
      && Number(releaseAnchorFighter?.attack) <= 0
      && Number(releaseAnchorFighter?.attackWindup) > 0
      && Number(releaseAnchorFighter?.abilityWindup) <= 0
      && Number(releaseAnchorFighter?.attackSequence) === Number(releaseAnchorReadiness.selectedAttackSequence)
      && String(releaseAnchorFighter?.targetId) === String(releaseAnchorReadiness.selectedTargetId)
      && String(releaseAnchorFighter?.attackWindupTargetId) === String(releaseAnchorReadiness.selectedAttackWindupTargetId)
      && String(releaseAnchorTarget?.id) === String(releaseAnchorReadiness.selectedTargetId)
      && releaseAnchorTarget?.side === releaseAnchorExpectedTargetSide
      && Number(releaseAnchorTarget?.hp) > 0
    );
    if (!releaseAnchorHandoffValid) {
      throw new Error(`release-anchor windup was consumed before the atomic visible epoch handoff: ${JSON.stringify({
        releaseAnchorKey: readiness.releaseAnchorKey,
        releaseAnchorReadiness,
        releaseAnchorFighter,
        releaseAnchorTarget,
      })}`);
    }
    const visibleProofStartedAt = performance.now();
    const audioCueRequestBaseline = window.__ASHFALL_AUDIO_QA__?.getCueRequests?.() ?? [];
    const releaseAnchor = releaseAnchorReadiness ? {
      actorKey: readiness.releaseAnchorKey,
      releaseMode: releaseAnchorReadiness.releaseMode,
      fighterId: releaseAnchorReadiness.selectedFighterId,
      baselineAttackSequence: Number(releaseAnchorFighter?.attackSequence) || 0,
      targetId: releaseAnchorTarget?.id ?? null,
      targetSide: releaseAnchorTarget?.side ?? null,
      targetKind: releaseAnchorTarget?.kind ?? null,
      targetAlive: Number(releaseAnchorTarget?.hp) > 0,
      attackWindupSeconds: Number(releaseAnchorFighter?.attackWindup),
      handoffAtBattleTime: Number(releaseSnapshot.time),
      handoffAtPageTime: visibleProofStartedAt,
      handoffValid: releaseAnchorHandoffValid,
      selectionSnapshotObservedAtPageTime: readiness.selectionSnapshotObservedAtPageTime,
      selectionSnapshotBattleTime: readiness.selectionSnapshotBattleTime,
      sameTaskSnapshotReadCount: readiness.sameTaskSnapshotReadCount,
      cachedObserverSnapshotUsedForHandoff: readiness.cachedObserverSnapshotUsedForHandoff,
      releaseReceiptMatchesSelectionSnapshot,
    } : null;
    const epoch = {
      schema: "v100-phase-g-post-quiescence-proof/v5",
      stageId,
      armedAtBattleTime: Number(releaseSnapshot.time),
      visibleProofStartedAt,
      visibleProofDeadlineAt: visibleProofStartedAt + Number(proofDurationMs),
      visibleProofDurationMs: Number(proofDurationMs),
      audioCueRequestCutoffAt: visibleProofStartedAt,
      audioCueRequestBaselineCount: audioCueRequestBaseline.length,
      excludedQuiescedAttackObserved: readiness.actors.some((actor) => actor.hiddenQualificationObserved === true),
      releaseAnchor,
      preReleaseReadiness: readiness,
      actors: readiness.actors.map((readyActor) => {
        const fighter = releaseSnapshot.fighters?.find((candidate) => String(candidate.id) === String(readyActor.selectedFighterId));
        return {
          side: readyActor.side,
          kind: readyActor.kind,
          cueId: readyActor.cueId ?? null,
          releaseRole: readyActor.releaseRole,
          releaseMode: readyActor.releaseMode,
          selectedFighterId: readyActor.selectedFighterId,
          fighterIds: [readyActor.selectedFighterId],
          fighterBaselines: [{
            fighterId: readyActor.selectedFighterId,
            baselineAttackSequence: Number(fighter?.attackSequence) || 0,
          }],
          observedPostEpochAttack: false,
          actorAlive: Number(fighter?.hp) > 0,
          observedFighterId: null,
          observedAttackSequence: null,
          observedAtBattleTime: null,
          observedAtPageTime: null,
          sourceAliveAtObservation: null,
          targetId: null,
          targetSide: null,
          targetKind: null,
          targetAlive: null,
          targetEvidenceSource: null,
          audioObserved: readyActor.cueId ? false : null,
          audioObservedAtBattleTime: null,
          audioObservedAtPageTime: null,
        };
      }),
    };
    window.__PHASE_G_POST_QUIESCENCE_PROOF_EPOCH__ = epoch;
    const activity = window.__PHASE_G_COMBAT_ACTIVITY__ ?? {};
    window.__PHASE_G_COMBAT_ACTIVITY__ = {
      ...activity,
      attackIdentity: [],
      pendingWeaponHits: [],
      battlePresentationEffects: [],
      sourceToTargetEdges: [],
      sourceAttribution: [],
      targetOwnershipHistory: [],
      reactionHistory: [],
      attackingActors: [],
      audioCues: [],
      statusMarkers: [],
      vehicleActions: [],
      fighterActors: [...new Set((releaseSnapshot.fighters ?? [])
        .filter((fighter) => fighter?.side && fighter?.kind && Number(fighter.hp) > 0)
        .map((fighter) => `${fighter.side}:${fighter.kind}`))],
      postQuiescenceProofEpoch: epoch,
    };
    const proofActorState = epoch.actors.find((actor) => actor.side === "zombie") ?? null;
    return {
      receipt,
      readiness,
      epoch,
      actorMountedAtRelease: Boolean(proofActorState),
      actorAttackObservedBeforeRelease: epoch.excludedQuiescedAttackObserved,
      actorStateAtRelease: proofActorState ? {
        id: proofActorState.selectedFighterId,
        kind: proofActorState.kind,
        attackSequence: proofActorState.fighterBaselines[0]?.baselineAttackSequence ?? null,
        targetId: readiness.actors.find((actor) => actor.side === "zombie")?.selectedTargetId ?? null,
        attackWindup: releaseAnchor?.actorKey === `zombie:${proofActorState.kind}` ? releaseAnchor.attackWindupSeconds : null,
        releaseRole: proofActorState.releaseRole,
        releaseMode: proofActorState.releaseMode,
      } : null,
      releaseAnchor,
    };
  }, {
    stageId: expectedStageId,
    actorSpecs: specs,
    proofDurationMs: Number(visibleProofDurationMs),
    armGeneration: Number(arm.generation),
  }, { timeout: Math.min(battleTimeout, 45_000), polling: 40 });
  const releaseEnvelope = await releaseHandle.jsonValue();
  await releaseHandle.dispose();

  invariant(releaseEnvelope?.readiness?.schema === "v100-phase-g-pre-release-readiness/v2"
    && Number.isFinite(Number(releaseEnvelope.readiness.selectionSnapshotObservedAtPageTime))
    && Number.isFinite(Number(releaseEnvelope.readiness.selectionSnapshotBattleTime))
    && Number(releaseEnvelope.readiness.sameTaskSnapshotReadCount) === 1
    && releaseEnvelope.readiness.cachedObserverSnapshotUsedForHandoff === false
    && releaseEnvelope.readiness.actors?.every((actor) => actor.selectedFighterId !== null && actor.selectedTargetAlive === true),
  `pre-release exact actor readiness did not converge: ${JSON.stringify(releaseEnvelope)}`);
  invariant(releaseEnvelope?.receipt?.schema === "v100-qa-presentation-quiescence/v1", `presentation quiescence release receipt missing: ${JSON.stringify(releaseEnvelope)}`);
  const release = releaseEnvelope.receipt;
  const postReleaseProofEpoch = releaseEnvelope.epoch;
  invariant(release.active === false && release.datasetActive === false, `presentation quiescence did not release: ${JSON.stringify(releaseEnvelope)}`);
  invariant(release.stageId === expectedStageId, `presentation quiescence released outside the expected stage: ${JSON.stringify({ releaseEnvelope, expectedStageId })}`);
  if (normalizedUntilBattleTime !== null) {
    invariant(Number(release.battleTime) >= normalizedUntilBattleTime, `presentation quiescence released before the required battle-time boundary: ${JSON.stringify({ releaseEnvelope, normalizedUntilBattleTime })}`);
  }
  invariant(Number(release.releasedAtRenderFrames) === Number(release.enteredAtRenderFrames), `a production render escaped the quiescence window: ${JSON.stringify(release)}`);
  invariant(Number(release.releasedAtSimulationTicks) > Number(release.enteredAtSimulationTicks), `simulation did not advance through presentation quiescence: ${JSON.stringify(release)}`);
  invariant(Number(release.suppressedRenderFrames) > 0, `presentation quiescence suppressed no scheduled render: ${JSON.stringify(release)}`);
  invariant(postReleaseProofEpoch?.schema === "v100-phase-g-post-quiescence-proof/v5"
    && Number.isFinite(Number(postReleaseProofEpoch.audioCueRequestCutoffAt))
    && Number.isFinite(Number(postReleaseProofEpoch.visibleProofDeadlineAt)),
  `post-quiescence proof epoch did not arm in the release task: ${JSON.stringify(postReleaseProofEpoch)}`);
  if (specs.length > 0) {
    const expectedReleaseAnchorKey = `${specs[0].side}:${specs[0].kind}`;
    const releaseAnchor = postReleaseProofEpoch.releaseAnchor;
    const anchorActor = postReleaseProofEpoch.actors?.find((actor) => `${actor.side}:${actor.kind}` === expectedReleaseAnchorKey) ?? null;
    invariant(releaseAnchor?.handoffValid === true
      && releaseAnchor.actorKey === expectedReleaseAnchorKey
      && releaseAnchor.releaseMode === "unconsumed-production-windup"
      && Number(releaseAnchor.attackWindupSeconds) > 0
      && releaseAnchor.targetAlive === true
      && Number.isFinite(Number(releaseAnchor.selectionSnapshotObservedAtPageTime))
      && Number(releaseAnchor.selectionSnapshotBattleTime) === Number(releaseAnchor.handoffAtBattleTime)
      && Number(releaseAnchor.sameTaskSnapshotReadCount) === 1
      && releaseAnchor.cachedObserverSnapshotUsedForHandoff === false
      && releaseAnchor.releaseReceiptMatchesSelectionSnapshot === true
      && String(releaseAnchor.fighterId) === String(anchorActor?.selectedFighterId)
      && Number(releaseAnchor.baselineAttackSequence) === Number(anchorActor?.fighterBaselines?.[0]?.baselineAttackSequence),
    `post-quiescence release anchor did not preserve an unconsumed exact production attack: ${JSON.stringify({ expectedReleaseAnchorKey, releaseAnchor, anchorActor })}`);
  }
  const restoredHandle = await page.waitForFunction(({ stageId, releasedRenderFrames, visibleProofDeadlineAt }) => {
    const bridge = window.__ASHFALL_BATTLE_QA__;
    const quiescence = bridge?.getQaPresentationQuiescence?.();
    const snapshot = window.__PHASE_G_LAST_COMBAT_SNAPSHOT__;
    const canvas = document.querySelector("canvas.battlefield");
    if (!canvas) return false;
    const rect = canvas.getBoundingClientRect();
    const style = getComputedStyle(canvas);
    const restored = quiescence?.active === false
      && quiescence?.datasetActive === false
      && quiescence?.owner === "phase-g-pre-proof"
      && quiescence?.route === "phase-g"
      && quiescence?.stageId === stageId
      && snapshot?.stageId === stageId
      && snapshot?.screen === "battle"
      && snapshot?.running === true
      && snapshot?.paused !== true
      && snapshot?.over !== true
      && Number(quiescence?.renderFrames) >= Number(releasedRenderFrames) + 3
      && performance.now() <= Number(visibleProofDeadlineAt)
      && style.display !== "none"
      && style.visibility !== "hidden"
      && Number(style.opacity) > 0
      && rect.width > 0
      && rect.height > 0;
    return restored ? {
      quiescence,
      battleTime: snapshot.time,
      pageNow: performance.now(),
      canvas: { width: rect.width, height: rect.height, display: style.display, visibility: style.visibility, opacity: style.opacity },
    } : false;
  }, {
    stageId: expectedStageId,
    releasedRenderFrames: release.releasedAtRenderFrames,
    visibleProofDeadlineAt: postReleaseProofEpoch.visibleProofDeadlineAt,
  }, { timeout: Math.min(battleTimeout, Number(visibleProofDurationMs), 10_000), polling: 50 });
  const restored = await restoredHandle.jsonValue();
  await restoredHandle.dispose();
  invariant(Number(restored.pageNow) <= Number(postReleaseProofEpoch.visibleProofDeadlineAt),
    `production restoration exceeded the single release-origin deadline: ${JSON.stringify({ restored, postReleaseProofEpoch })}`);
  invariant(postReleaseProofEpoch.stageId === expectedStageId
    && Number(postReleaseProofEpoch.armedAtBattleTime) === Number(release.battleTime),
  `post-quiescence proof epoch did not share the exact atomic release battle time: ${JSON.stringify({ release, postReleaseProofEpoch })}`);
  recorder?.clearAwaiting();
  recorder?.mark("presentation-quiescence-released-or-not-required", "completed", {
    untilBattleTime: normalizedUntilBattleTime,
    arm,
    release,
    actorMountedAtRelease: releaseEnvelope.actorMountedAtRelease,
    actorStateAtRelease: releaseEnvelope.actorStateAtRelease,
    excludedQuiescedAttackObserved: releaseEnvelope.actorAttackObservedBeforeRelease === true,
    preReleaseReadiness: releaseEnvelope.readiness,
    restored,
    postReleaseProofEpoch,
  });
  return { arm, release, restored, postReleaseProofEpoch };
}

async function battlePage(page, save, stageName = null, { bossKind = null, proofActor = null, proofUnitKind = null, proofUnitFirst = false, manualAbilityKind = null, requireVehicleAction = false, keepHumanTargetAlive = false, waitForBossAttack = true, combatProofDurationMs: requestedCombatProofDurationMs = null, presentationQuiescenceEnabled = false, presentationQuiescenceUntilBattleTime = null } = {}) {
  const recorder = checkpointRecorderFor(page);
  const presentationQuiescenceBattleTime = normalizePhaseGPresentationQuiescenceBoundary(presentationQuiescenceUntilBattleTime);
  invariant(presentationQuiescenceBattleTime === null || presentationQuiescenceEnabled === true, "presentation quiescence battle-time boundary requires the explicit quiescence contract");
  invariant(!presentationQuiescenceEnabled || (!manualAbilityKind && !requireVehicleAction),
    "presentation-quiesced exact actor proof cannot share its single visible deadline with manual or vehicle actions");
  await formationPage(page, save, stageName);
  // The seeded save already contains the canonical formation for this capture.
  // Do not overwrite slot 1 with the first roster card: doing so erases the
  // stage-specific representative (for example brute) before the battle
  // starts and makes the runtime proof depend on roster DOM order.
  await click(page, page.getByRole("button", { name: "戦闘へ", exact: true }), "formation battle CTA");
  await waitBattle(page);
  const phaseGCombatSnapshotProfile = await startCombatRuntimeObserver(page);
  const expectedStageId = V100_STAGES.find((entry) => entry.displayName === stageName)?.id ?? V100_STAGE_IDS[0];
  let presentationQuiescenceArm = null;
  let presentationQuiescence = null;
  if (presentationQuiescenceEnabled) {
    presentationQuiescenceArm = await armPhaseGPresentationQuiescence(page, {
      expectedStageId,
      recorder,
    });
  }
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
    ? enemyCombatCueFor(proofActor, "attack")
    : null;
  const proofUnitAttackCueId = proofUnitKind
    ? weaponCueForUnit(proofUnitKind)
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
    if (!proofActor) recorder.markOnce("proof-actor-mounted-or-absent", "not-required", { reason: "contract-has-no-proof-actor" });
    if (!proofActor) recorder.mark("proof-actor-attack-observed-or-not-required", "not-required", { reason: "contract-has-no-proof-actor" });
    if (!proofActorRequiresContactFirst) recorder.markOnce("living-human-target-acquired-or-not-required", "not-required", { reason: "contract-does-not-require-contact-first" });
    if (!proofUnitKind) recorder.mark("proof-unit-deployed-and-attacked-or-not-required", "not-required", { reason: "contract-has-no-proof-unit" });
    if (!manualAbilityKind && !requireVehicleAction) recorder.mark("manual-vehicle-action-observed-or-not-required", "not-required", { reason: "contract-has-no-manual-or-vehicle-action" });
    if (!presentationQuiescenceEnabled) recorder.mark("presentation-quiescence-released-or-not-required", "not-required", { reason: "contract-has-no-presentation-quiescence" });
  }
  const observeProofActorAttack = async () => {
    if (proofActorAttackObserved || !proofActor) return proofActorAttackObserved;
    const observation = await page.evaluate(({ expectedKind, expectedCueId }) => {
      const snapshot = window.__PHASE_G_LAST_COMBAT_SNAPSHOT__;
      const activity = window.__PHASE_G_COMBAT_ACTIVITY__ ?? {};
      const proofEpoch = window.__PHASE_G_POST_QUIESCENCE_PROOF_EPOCH__;
      const epochActor = proofEpoch?.schema === "v100-phase-g-post-quiescence-proof/v5"
        ? proofEpoch.actors?.find((candidate) => candidate.side === "zombie" && candidate.kind === expectedKind) ?? null
        : null;
      const epochBaselineFor = (fighter) => epochActor?.fighterBaselines?.find((baseline) => (
        String(baseline.fighterId) === String(fighter?.id)
      )) ?? null;
      const matchingActors = (snapshot?.fighters ?? []).filter((fighter) => (
        fighter.side === "zombie"
        && fighter.kind === expectedKind
        && (!epochActor || Boolean(epochBaselineFor(fighter)))
      ));
      const actor = matchingActors.find((fighter) => (
        Number(fighter.attackSequence) > Number(epochBaselineFor(fighter)?.baselineAttackSequence)
        || Number(fighter.attack) > 0
        || Number(fighter.attackWindup) > 0
        || fighter.enemyVfx?.attacking === true
        || fighter.enemyVfx?.attackWindup === true
        || ["attack", "warning"].includes(fighter.enemyVfx?.phase)
      )) ?? matchingActors[0] ?? null;
      const actorBaseline = epochBaselineFor(actor);
      const actorKey = `zombie:${expectedKind}`;
      const fighterMounted = Boolean(actor)
        || Boolean(epochActor)
        || (activity.fighterActors ?? []).includes(actorKey);
      if (!fighterMounted) return { observed: false, mounted: false, evidence: "not-mounted" };
      const sequenceAttack = actor && (epochActor
        ? Number(actor.attackSequence) > Number(actorBaseline?.baselineAttackSequence)
        : Number(actor.attackSequence) > 0);
      const stateAttack = actor && (Number(actor.attack) > 0
        || Number(actor.attackWindup) > 0
        || sequenceAttack
        || actor.enemyVfx?.attacking === true
        || actor.enemyVfx?.attackWindup === true
        || ["attack", "warning"].includes(actor.enemyVfx?.phase));
      const allAudioRequests = window.__ASHFALL_AUDIO_QA__?.getCueRequests?.() ?? [];
      const proofAudioRequests = proofEpoch?.schema === "v100-phase-g-post-quiescence-proof/v5"
        ? allAudioRequests.filter((request) => (
          Number.isFinite(Number(request?.at))
          && Number(request.at) > Number(proofEpoch.audioCueRequestCutoffAt)
        ))
        : allAudioRequests;
      const matchingAudioRequest = expectedCueId
        ? proofAudioRequests.find((request) => request?.cueId === expectedCueId) ?? null
        : null;
      const audioAttack = matchingAudioRequest !== null;
      const historicalAudioAttack = expectedCueId && (epochActor
        ? epochActor.audioObserved === true
        : (activity.audioCues ?? []).includes(expectedCueId));
      // The runtime observer retains fleeting attack states after a sprite
      // leaves the live fighter list. Use that production history so a short
      // WebKit frame cannot erase a real attack that already occurred.
      const historicalAttack = epochActor
        ? epochActor.observedAttackSequence !== null
        : (activity.attackingActors ?? []).includes(actorKey);
      const observed = historicalAttack || stateAttack === true || audioAttack === true || historicalAudioAttack === true;
      if (observed) {
        if (epochActor) {
          const releaseAnchor = proofEpoch.releaseAnchor ?? null;
          const actorBaselineSequence = Number(actorBaseline?.baselineAttackSequence);
          const releaseAnchorCommitWindowSeconds = releaseAnchor
            ? Math.max(0.8, Number(releaseAnchor.attackWindupSeconds) + 0.5)
            : null;
          const releaseAnchorCommitDeltaSeconds = releaseAnchor
            && Number.isFinite(Number(snapshot?.time))
            ? Number(snapshot.time) - Number(releaseAnchor.handoffAtBattleTime)
            : null;
          const releaseAnchorBindingValid = releaseAnchor?.handoffValid === true
            && releaseAnchor.actorKey === actorKey
            && String(releaseAnchor.fighterId) === String(actor?.id)
            && actorBaselineSequence === Number(releaseAnchor.baselineAttackSequence)
            && Number(actor?.attackSequence) === Number(releaseAnchor.baselineAttackSequence) + 1
            && Number.isFinite(Number(releaseAnchorCommitDeltaSeconds))
            && Number(releaseAnchorCommitDeltaSeconds) >= 0
            && Number(releaseAnchorCommitDeltaSeconds) <= Number(releaseAnchorCommitWindowSeconds);
          const directTargetId = actor?.targetId === null || actor?.targetId === undefined
            ? null
            : actor.targetId;
          const targetId = directTargetId ?? (releaseAnchorBindingValid ? releaseAnchor.targetId : null);
          const target = targetId === null || targetId === undefined
            ? null
            : snapshot?.fighters?.find((fighter) => String(fighter.id) === String(targetId)) ?? null;
          if (sequenceAttack
            && String(actor?.id) === String(epochActor.selectedFighterId)
            && epochActor.observedPostEpochAttack !== true) {
            Object.assign(epochActor, {
              observedPostEpochAttack: true,
              observedAtBattleTime: Number(snapshot?.time),
              observedAtPageTime: performance.now(),
              sourceAliveAtObservation: Number(actor?.hp) > 0,
              observedFighterId: actor.id,
              observedAttackSequence: Number(actor.attackSequence),
              targetId: target?.id ?? targetId ?? null,
              targetSide: target?.side ?? null,
              targetKind: target?.kind ?? null,
              targetAlive: target ? Number(target.hp) > 0 : null,
              targetEvidenceSource: directTargetId !== null
                ? "live-attacker-target"
                : releaseAnchorBindingValid
                  ? "release-anchor-bound-windup"
                  : null,
            });
          }
          if (audioAttack || historicalAudioAttack) {
            epochActor.audioObserved = true;
            epochActor.audioObservedAtBattleTime ??= Number(snapshot?.time);
            if (matchingAudioRequest) epochActor.audioObservedAtPageTime ??= Number(matchingAudioRequest.at);
          }
        }
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
        evidence: epochActor
          ? historicalAttack ? "post-quiescence-attack-sequence" : audioAttack || historicalAudioAttack ? "post-quiescence-audio-cue" : stateAttack ? "post-quiescence-live-runtime-state" : "unobserved"
          : historicalAttack ? "historical-runtime-state" : audioAttack || historicalAudioAttack ? "audio-cue" : stateAttack ? "live-runtime-state" : "unobserved",
      };
    }, { expectedKind: proofActor, expectedCueId: proofActorAttackCueId }).catch(() => false);
    if (observation?.mounted === true) recorder?.markOnce("proof-actor-mounted-or-absent", "observed", { actor: proofActor });
    if (observation?.observed === true) recorder?.mark("proof-actor-attack-observed-or-not-required", "observed", { actor: proofActor, evidence: observation.evidence });
    proofActorAttackObserved = observation?.observed === true;
    return proofActorAttackObserved;
  };
  const readProofActorContactState = async () => {
    if (!proofActor) return null;
    const state = await page.evaluate((expectedKind) => {
      const snapshot = window.__PHASE_G_LAST_COMBAT_SNAPSHOT__;
      const fighters = snapshot?.fighters ?? [];
      const activity = window.__PHASE_G_COMBAT_ACTIVITY__ ?? {};
      const proofEpoch = window.__PHASE_G_POST_QUIESCENCE_PROOF_EPOCH__;
      const epochActor = proofEpoch?.schema === "v100-phase-g-post-quiescence-proof/v5"
        ? proofEpoch.actors?.find((candidate) => candidate.side === "zombie" && candidate.kind === expectedKind) ?? null
        : null;
      const epochFighterIds = new Set((epochActor?.fighterBaselines ?? []).map((baseline) => String(baseline.fighterId)));
      const actorCandidates = fighters.filter((fighter) => (
        fighter.side === "zombie"
        && fighter.kind === expectedKind
        && (!epochActor || epochFighterIds.has(String(fighter.id)))
      ));
      const liveHumanTargetFor = (fighter) => {
        const target = fighter?.targetId === null || fighter?.targetId === undefined
          ? null
          : fighters.find((candidate) => String(candidate.id) === String(fighter.targetId)) ?? null;
        return target?.side === "human" && Number.isFinite(Number(target.hp)) && Number(target.hp) > 0;
      };
      const actor = actorCandidates.find((fighter) => (
        epochActor?.observedFighterId !== null
        && epochActor?.observedFighterId !== undefined
        && String(fighter.id) === String(epochActor.observedFighterId)
      )) ?? actorCandidates.find(liveHumanTargetFor) ?? actorCandidates[0] ?? null;
      const actorKey = `zombie:${expectedKind}`;
      const target = actor?.targetId === null || actor?.targetId === undefined
        ? null
        : fighters.find((fighter) => String(fighter.id) === String(actor.targetId)) ?? null;
      const liveHumanTarget = target?.side === "human" && Number.isFinite(Number(target.hp)) && Number(target.hp) > 0;
      const historicalTarget = window.__PHASE_G_PROOF_ACTOR_HUMAN_TARGET_FROM_HISTORY__?.(
        activity.targetOwnershipHistory ?? [],
        expectedKind,
        epochActor?.observedFighterId ?? null,
      ) ?? null;
      const evidence = liveHumanTarget ? {
        evidence: "live-target",
        channel: "targetId",
        battleTime: Number.isFinite(Number(snapshot?.time)) ? Number(snapshot.time) : null,
        sourceId: actor?.id ?? null,
        targetId: target?.id ?? null,
        targetKind: target?.kind ?? null,
        targetSide: target?.side ?? null,
      } : historicalTarget ? {
        evidence: "monotonic-target-history",
        channel: historicalTarget.channel ?? null,
        battleTime: historicalTarget.battleTime ?? null,
        sourceId: historicalTarget.sourceId ?? null,
        targetId: historicalTarget.targetId ?? null,
        targetKind: historicalTarget.targetKind ?? null,
        targetSide: historicalTarget.targetSide ?? null,
      } : null;
      return {
        mounted: Boolean(actor) || Boolean(epochActor) || (activity.fighterActors ?? []).includes(actorKey),
        hasLiveHumanTarget: liveHumanTarget,
        hasHumanTarget: evidence !== null,
        actorX: actor?.x ?? null,
        actorLane: actor?.lane ?? null,
        evidence: evidence?.evidence ?? null,
        observationChannel: evidence?.channel ?? null,
        sourceId: evidence?.sourceId ?? null,
        targetId: evidence?.targetId ?? null,
        targetKind: evidence?.targetKind ?? target?.kind ?? null,
        targetSide: evidence?.targetSide ?? target?.side ?? null,
        productionTime: evidence?.battleTime ?? null,
      };
    }, proofActor).catch(() => null);
    if (state?.mounted === true) recorder?.markOnce("proof-actor-mounted-or-absent", "observed", { actor: proofActor });
    if (state?.hasHumanTarget === true) recorder?.markOnce("living-human-target-acquired-or-not-required", "observed", {
      actor: proofActor,
      evidence: state.evidence,
      observationChannel: state.observationChannel,
      sourceId: state.sourceId,
      targetId: state.targetId,
      targetKind: state.targetKind,
      productionTime: state.productionTime,
    });
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
  let bossFrontlineContactLatch = null;
  const latchBossFrontlineContact = (contactState, observationPhase) => {
    if (bossFrontlineContactLatch || !proofActorRequiresContactFirst) return bossFrontlineContactLatch;
    const exactAttackObserved = proofActorAttackObserved === true;
    const liveHumanTargetObserved = contactState?.hasLiveHumanTarget === true;
    if (!exactAttackObserved && !liveHumanTargetObserved) return null;
    bossFrontlineContactLatch = Object.freeze({
      reason: exactAttackObserved
        ? "exact-proof-actor-attack-observed"
        : "current-live-human-target-observed",
      observationPhase,
      actor: proofActor,
      exactAttackObserved,
      liveHumanTargetObserved,
      sourceId: contactState?.sourceId ?? null,
      targetId: contactState?.targetId ?? null,
      targetKind: contactState?.targetKind ?? null,
      productionTime: contactState?.productionTime ?? null,
    });
    recorder?.clearAwaiting();
    return bossFrontlineContactLatch;
  };
  const observeProofUnitAttack = async () => {
    if (proofUnitAttackObserved || !proofUnitKind) return proofUnitAttackObserved;
    const observation = await page.evaluate(({ expectedKind, expectedCueId }) => {
      const snapshot = window.__PHASE_G_LAST_COMBAT_SNAPSHOT__;
      const activity = window.__PHASE_G_COMBAT_ACTIVITY__ ?? {};
      const proofEpoch = window.__PHASE_G_POST_QUIESCENCE_PROOF_EPOCH__;
      const epochActor = proofEpoch?.schema === "v100-phase-g-post-quiescence-proof/v5"
        ? proofEpoch.actors?.find((candidate) => candidate.side === "human" && candidate.kind === expectedKind) ?? null
        : null;
      const epochBaselineFor = (fighter) => epochActor?.fighterBaselines?.find((baseline) => (
        String(baseline.fighterId) === String(fighter?.id)
      )) ?? null;
      const matchingActors = (snapshot?.fighters ?? []).filter((fighter) => (
        fighter.side === "human"
        && fighter.kind === expectedKind
        && Number(fighter.hp) > 0
      ));
      const actor = matchingActors.find((fighter) => (
        (!epochActor || Boolean(epochBaselineFor(fighter)))
        && (Number(fighter.attackSequence) > Number(epochBaselineFor(fighter)?.baselineAttackSequence)
          || Number(fighter.attack) > 0
          || Number(fighter.attackWindup) > 0)
      )) ?? matchingActors.find((fighter) => !epochActor || Boolean(epochBaselineFor(fighter))) ?? null;
      const actorBaseline = epochBaselineFor(actor);
      const actorKey = `human:${expectedKind}`;
      const fighterMounted = Boolean(actor)
        || Boolean(epochActor)
        || (activity.fighterActors ?? []).includes(actorKey);
      if (!fighterMounted) return null;
      const sequenceAttack = actor && (epochActor
        ? Number(actor.attackSequence) > Number(actorBaseline?.baselineAttackSequence)
        : Number(actor.attackSequence) > 0);
      const stateAttack = Number(actor?.attack) > 0
        || Number(actor?.attackWindup) > 0
        || sequenceAttack
        || actor?.manualAbility?.phase === "active"
        || (snapshot?.manualAbilityReceipts ?? []).some((receipt) => receipt?.kind === expectedKind && receipt?.eventType === "impact");
      // A proof unit can complete a real production attack and then be
      // defeated before the polling frame that checks its live fighter. Keep
      // the same observer history used for enemy proof actors so that a
      // fleeting but genuine player attack is not erased by defeat.
      const allAudioRequests = window.__ASHFALL_AUDIO_QA__?.getCueRequests?.() ?? [];
      const proofAudioRequests = proofEpoch?.schema === "v100-phase-g-post-quiescence-proof/v5"
        ? allAudioRequests.filter((request) => (
          Number.isFinite(Number(request?.at))
          && Number(request.at) > Number(proofEpoch.audioCueRequestCutoffAt)
        ))
        : allAudioRequests;
      const matchingAudioRequest = expectedCueId
        ? proofAudioRequests.find((request) => request?.cueId === expectedCueId) ?? null
        : null;
      const audioAttack = matchingAudioRequest !== null || epochActor?.audioObserved === true;
      const historicalAttack = epochActor
        ? epochActor.observedAttackSequence !== null
        : (activity.attackingActors ?? []).includes(actorKey);
      const observedAttack = historicalAttack || stateAttack === true || audioAttack === true;
      if (observedAttack && epochActor) {
        const target = actor?.targetId === null || actor?.targetId === undefined
          ? null
          : snapshot?.fighters?.find((fighter) => String(fighter.id) === String(actor.targetId)) ?? null;
        if (sequenceAttack
          && String(actor?.id) === String(epochActor.selectedFighterId)
          && epochActor.observedPostEpochAttack !== true) {
          Object.assign(epochActor, {
            observedPostEpochAttack: true,
            observedAtBattleTime: Number(snapshot?.time),
            observedAtPageTime: performance.now(),
            sourceAliveAtObservation: Number(actor?.hp) > 0,
            observedFighterId: actor.id,
            observedAttackSequence: Number(actor.attackSequence),
            targetId: target?.id ?? actor?.targetId ?? null,
            targetSide: target?.side ?? null,
            targetKind: target?.kind ?? null,
            targetAlive: target ? Number(target.hp) > 0 : null,
            targetEvidenceSource: target ? "live-attacker-target" : null,
          });
        }
        if (audioAttack) {
          epochActor.audioObserved = true;
          epochActor.audioObservedAtBattleTime ??= Number(snapshot?.time);
          if (matchingAudioRequest) epochActor.audioObservedAtPageTime ??= Number(matchingAudioRequest.at);
        }
      }
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
    }, { expectedKind: proofUnitKind, expectedCueId: proofUnitAttackCueId }).catch(() => false);
    if (observation?.deployed === true) proofUnitDeployed = true;
    proofUnitAttackObserved = observation?.attacking === true;
    if (proofUnitAttackObserved) recorder?.mark("proof-unit-deployed-and-attacked-or-not-required", "observed", { unitKind: proofUnitKind, evidence: "live-or-historical-runtime-state" });
    return proofUnitAttackObserved;
  };
  const observeVehicleAction = async () => {
    if (vehicleActionObserved) return vehicleActionObserved;
    vehicleActionObserved = await page.evaluate(() => {
      const snapshot = window.__PHASE_G_LAST_COMBAT_SNAPSHOT__;
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
  let sustainFailure = null;
  const bossIsLive = async () => bossKind && await page.evaluate((expectedKind) => {
    const snapshot = window.__PHASE_G_LAST_COMBAT_SNAPSHOT__;
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
  const sustainTask = bossKind ? (async () => {
    // These are ordinary player-facing controls.  The loop keeps the
    // evidence run alive long enough to reach the authored boss wave without
    // mutating HP, clocks, enemy state, or battle definitions.
    while (sustainActive) {
      const battleVisible = await page.locator('.game-shell[data-screen="battle"]').isVisible().catch(() => false);
      if (!battleVisible) break;
      const bossEngaged = await bossIsLive();
      const liveHumanTargetCount = await page.evaluate(() => {
        const snapshot = window.__PHASE_G_LAST_COMBAT_SNAPSHOT__;
        return (snapshot?.fighters ?? []).filter((fighter) => fighter.side === "human" && Number(fighter.hp) > 0).length;
      }).catch(() => 0);
      await observeProofActorAttack();
      await observeProofUnitAttack();
      await observeVehicleAction();

      if (proofActorAttackObserved && proofUnitKind && !proofUnitDeployed) {
        const proofPointer = await performVerifiedDeploymentPointer(page, {
          requestedKind: proofUnitKind,
          phase: "sustain-proof",
        });
        proofUnitDeployed = proofPointer.accepted === true;
      }

      const abilityButtons = page.locator('button.manual-ability-ready.available:not([disabled])');
      const abilityCount = await abilityButtons.count().catch(() => 0);
      const proofCombatReady = proofActorAttackObserved && proofUnitAttackObserved;
      if (!bossEngaged && proofCombatReady) {
        for (let index = 0; index < Math.min(abilityCount, 4); index += 1) {
          await withPhaseGPageInputLock(page, async () => {
            const lockedAbility = page.locator('button.manual-ability-ready.available:not([disabled])').nth(index);
            if (await lockedAbility.count().catch(() => 0)) await lockedAbility.click({ timeout: 500 }).catch(() => {});
          });
          await page.waitForTimeout(85);
        }
      }

      const crawler = page.locator('button.support-btn.barrage[data-state="ready"][aria-disabled="false"]').first();
      if (proofCombatReady && !vehicleActionObserved && await crawler.count().catch(() => 0)) {
        await withPhaseGPageInputLock(page, async () => {
          const lockedCrawler = page.locator('button.support-btn.barrage[data-state="ready"][aria-disabled="false"]').first();
          if (await lockedCrawler.count().catch(() => 0)) await lockedCrawler.click({ timeout: 500 }).catch(() => {});
        });
      }

      const canvas = page.locator("canvas.battlefield");
      const box = await canvas.boundingBox().catch(() => null);
      if (box) {
        if (!bossEngaged && proofCombatReady) {
          await withPhaseGPageInputLock(page, async () => {
            const lockedCanvas = page.locator("canvas.battlefield");
            const lockedBox = await lockedCanvas.boundingBox().catch(() => null);
            const airstrike = page.locator('button.support-btn.airstrike[data-state="ready"][aria-disabled="false"]').first();
            if (lockedBox && await airstrike.count().catch(() => 0)) {
              await airstrike.click({ timeout: 500 }).catch(() => {});
              await lockedCanvas.click({ position: { x: lockedBox.width * .67, y: lockedBox.height * .5 }, timeout: 700 }).catch(() => {});
            }
          });
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
        await withPhaseGPageInputLock(page, async () => {
          const lockedCanvas = page.locator("canvas.battlefield");
          const lockedBox = await lockedCanvas.boundingBox().catch(() => null);
          const medical = page.locator('button.support-btn.medical[data-state="ready"][aria-disabled="false"]').first();
          if (!lockedBox || !(await medical.count().catch(() => 0))) return;
          const medicalY = proofActorContactPlanPending && Number.isFinite(Number(proofActorContactState?.actorLane))
            ? (Number(proofActorContactState?.actorLane) >= 1 ? lockedBox.height * .3 : lockedBox.height * .7)
            : lockedBox.height * .5;
          await medical.click({ timeout: 500 }).catch(() => {});
          await lockedCanvas.click({ position: { x: lockedBox.width * .34, y: medicalY }, timeout: 700 }).catch(() => {});
        });
      }
      const targetContinuity = proofActorTargetContinuityDecision({
        bossDeploymentFinished,
        bossEngaged,
        keepHumanTargetAlive,
        proofActorRequiresContactFirst,
        proofActorAttackObserved,
        liveHumanTargetCount,
      });
      if (targetContinuity.allowSustainRedeploy) {
        // Once the opening formation has been established, keep the same
        // player-facing redeploy control alive as cards recover. This is
        // especially important for compact boss routes where a fallen
        // frontline unit must be replaced before the authored boss entry.
        // Continue after the boss is live as well: medical support and
        // ordinary redeployment keep a real target on the battlefield long
        // enough for the boss-owned attack/ability lifecycle to be observed.
        // Monotonic target history proves prior ownership only. While a
        // contact-first attack is still pending, current live-human count
        // owns survival planning and may use only this real production card.
        if ((proofCombatReady && proofUnitDeployed) || targetContinuity.targetSurvivalPlanPending) {
          await performVerifiedDeploymentPointer(page, {
            phase: "sustain-redeploy",
          });
        }
      }
      if (bossKind) {
        // The QA bridge only accelerates the authored boss gate-entry
        // animation. Spawn, entry state, sprite mount, and combat remain
        // production-owned; this prevents compact WebKit from losing the
        // vehicle before the real boss reaches the battlefield.
        await page.evaluate((expectedKind) => {
          const bridge = window.__ASHFALL_BATTLE_QA__;
          const snapshot = window.__PHASE_G_LAST_COMBAT_SNAPSHOT__;
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
  const sustainDone = sustainTask?.catch((error) => {
    sustainFailure = error;
    sustainActive = false;
  }) ?? null;
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
          const candidateSample = await readBattleDeploymentDiagnostics(page, {
            requestedSlot: slot + 1,
            phase: "candidate-sample",
          });
          recorder?.setLatestReadableState(candidateSample);
          const candidateCards = deploymentCandidatesFromDiagnostics(candidateSample, deployedKinds);
          // When a focused contract names a canonical player proof unit,
          // prefer that currently-ready card first. This keeps the evidence
          // plan on the real formation without substituting a different
          // actor or changing the production battle rules.
          const openingCandidates = candidateCards
            .filter((card) => card.kind !== proofUnitKind)
            .map((card, candidateIndex) => ({ card, kind: card.kind, content: unitContentFor(card.kind), candidateIndex }))
            .sort((left, right) => {
              const leftDps = Number(left.content?.damage) / Math.max(.01, Number(left.content?.attackEvery) || 1);
              const rightDps = Number(right.content?.damage) / Math.max(.01, Number(right.content?.attackEvery) || 1);
              if (leftDps !== rightDps) return leftDps - rightDps;
              return Number(left.content?.cost ?? 0) - Number(right.content?.cost ?? 0);
            });
          const selectedCandidate = (proofUnitFirst && slot === 0 && proofUnitKind
            ? candidateCards.find((card) => card.kind === proofUnitKind)
            : slot > 0 && proofUnitKind
            ? candidateCards.find((card) => card.kind === proofUnitKind)
            : null)
            ?? openingCandidates[0]?.card
            ?? candidateCards[0]
            ?? null;
          if (!selectedCandidate) {
            await page.waitForTimeout(120);
            continue;
          }
          const kind = selectedCandidate.kind;
          const pointerResult = await performVerifiedDeploymentPointer(page, {
            requestedKind: kind,
            requestedSlot: slot + 1,
            phase: "non-boss-primary",
          });
          recordDeployment({
            slot: slot + 1,
            requestedKind: kind,
            action: pointerResult.status,
            accepted: pointerResult.accepted,
            pointerCount: pointerResult.pointerCount,
            diagnostics: pointerResult.diagnostics,
            pointerEvidence: pointerResult.evidence ?? null,
          });
          if (!pointerResult.accepted) {
            await page.waitForTimeout(120);
            continue;
          }
          recorder?.clearAwaiting();
          deployedKinds.add(kind);
          if (kind === proofUnitKind) proofUnitDeployed = true;
          deployed = true;
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
      }
    } else {
      for (let deployment = 0; deployment < bossDeploymentLimit; deployment += 1) {
        if (proofActorRequiresContactFirst) {
          await observeProofActorAttack();
          const contactState = proofActorAttackObserved
            ? null
            : await readProofActorContactState();
          latchBossFrontlineContact(contactState, "before-next-slot");
          if (bossFrontlineContactLatch) break;
        }
        let deployed = false;
        recorder?.setAwaiting("boss-frontline-deployment", { slot: deployment + 1, predicate: "a real ready boss-frontline card is accepted by production runtime" });
        for (let attempt = 0; attempt < 180; attempt += 1) {
          if (page.isClosed()) throw new Error("Target page, context or browser has been closed during boss unit deployment");
          const battleVisible = await page.locator('.game-shell[data-screen="battle"]').isVisible().catch(() => false);
          if (!battleVisible) break;
          if (await bossIsLive()) break;
          if (proofActorRequiresContactFirst) {
            const contactState = await waitForProofActorContact();
            latchBossFrontlineContact(contactState, "before-candidate-sample");
            if (bossFrontlineContactLatch) break;
          }
          const candidateSample = await readBattleDeploymentDiagnostics(page, {
            requestedSlot: deployment + 1,
            phase: "candidate-sample",
          });
          recorder?.setLatestReadableState(candidateSample);
          const readyCandidates = deploymentCandidatesFromDiagnostics(candidateSample, deployedKinds)
            .map((card, candidateIndex) => ({ card, kind: card.kind, content: unitContentFor(card.kind), candidateIndex }));
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
            const pointerResult = await performVerifiedDeploymentPointer(page, {
              requestedKind: kind,
              requestedSlot: deployment + 1,
              phase: "boss-primary",
            });
            recordDeployment({
              slot: deployment + 1,
              requestedKind: kind,
              action: pointerResult.status,
              accepted: pointerResult.accepted,
              pointerCount: pointerResult.pointerCount,
              diagnostics: pointerResult.diagnostics,
              pointerEvidence: pointerResult.evidence ?? null,
            });
            if (pointerResult.accepted) {
              recorder?.clearAwaiting();
              deployed = true;
              if (kind) deployedKinds.add(kind);
              if (kind === proofUnitKind) proofUnitDeployed = true;
              if (proofActorRequiresContactFirst) {
                const contactState = await waitForProofActorContact();
                latchBossFrontlineContact(contactState, "after-accepted-pointer");
                if (bossFrontlineContactLatch) break;
              }
              break;
            }
          }
          await page.waitForTimeout(400);
        }
        // Contact-first setup is terminal once the exact proof actor has
        // genuinely attacked or currently owns a living human target.  Do not
        // let an already-observed attack skip the guard and start a later real
        // pointer; the completed production formation is the release input.
        if (bossFrontlineContactLatch) break;
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
      terminalCardStates: deploymentTrace.filter((entry) => entry.accepted === true).map((entry) => ({ slot: entry.slot, kind: entry.requestedKind, state: entry.diagnostics?.cards?.find((card) => card.kind === entry.requestedKind)?.state ?? null })),
      contactFirstTerminalHandoff: bossFrontlineContactLatch,
    });
    if (presentationQuiescenceArm) {
      // Drain every host-side player action while presentation is still held.
      // This prevents an already-started deployment pointer preflight from
      // consuming the release-origin visible deadline after the exact epoch
      // is armed. The completed real frontline remains production-owned.
      sustainActive = false;
      await sustainDone;
      if (sustainFailure) throw sustainFailure;
      presentationQuiescence = await releasePhaseGPresentationQuiescence(page, {
        arm: presentationQuiescenceArm,
        expectedStageId,
        proofActor,
        proofActorAttackCueId,
        proofUnitKind,
        proofUnitAttackCueId,
        untilBattleTime: presentationQuiescenceBattleTime,
        visibleProofDurationMs: requestedCombatProofDurationMs ?? combatProofDurationMs,
        recorder,
      });
      // Hidden simulation is allowed to complete a real attack.  Acceptance,
      // however, begins at the restored production-frame epoch and therefore
      // requires both exact proof actors to attack again after that boundary.
      proofActorAttackObserved = proofActor === null;
      proofUnitAttackObserved = proofUnitKind === null;
    }
    if (!presentationQuiescence && proofActor) {
      if (proofActorRequiresContactFirst) {
        recorder?.setAwaiting("proof-actor-live-human-target", {
          actor: proofActor,
          predicate: "exact proof actor owns a current living-human target, or its exact authored attack is already observed with monotonic target history",
        });
        const contactDeadline = Date.now() + Math.min(battleTimeout, 45_000);
        let contactState = await readProofActorContactState();
        while (!proofActorAttackObserved && contactState?.hasLiveHumanTarget !== true && Date.now() < contactDeadline) {
          await observeProofActorAttack();
          contactState = await readProofActorContactState();
          if (proofActorAttackObserved || contactState?.hasLiveHumanTarget === true) break;
          await page.waitForTimeout(100);
        }
        if (proofActorAttackObserved) {
          invariant(contactState?.hasHumanTarget === true, `proof actor ${proofActor} attacked without exact living-human target history`);
        } else {
          invariant(contactState?.hasLiveHumanTarget === true, `proof actor ${proofActor} never acquired an exact live human target before attack proof`);
        }
        recorder?.clearAwaiting();
      }
      if (!proofActorAttackObserved) {
        recorder?.setAwaiting("proof-actor-attack", { actor: proofActor, predicate: "live state, historical runtime observation, or owned audio cue" });
        const proofActorDeadline = Date.now() + Math.min(battleTimeout, 45_000);
        while (!proofActorAttackObserved && Date.now() < proofActorDeadline) {
          await observeProofActorAttack();
          if (!proofActorAttackObserved) await page.waitForTimeout(100);
        }
        invariant(proofActorAttackObserved, `proof enemy actor did not attack: ${proofActor}`);
      }
      if (proofActorRequiresContactFirst) {
        const finalContactState = await readProofActorContactState();
        invariant(finalContactState?.hasHumanTarget === true, `proof actor ${proofActor} attack lacks exact living-human target history`);
      }
      recorder?.clearAwaiting();
      recorder?.markOnce("proof-actor-mounted-or-absent", "observed", { actor: proofActor, source: "final-proof-predicate" });
      recorder?.mark("proof-actor-attack-observed-or-not-required", "observed", { actor: proofActor, evidence: "final-proof-predicate" });
    }
    if (!presentationQuiescence && proofUnitKind && !proofUnitDeployed) await observeProofUnitAttack();
    if (!presentationQuiescence && proofUnitKind && !proofUnitDeployed) {
      recorder?.setAwaiting("proof-unit-deployment", { unitKind: proofUnitKind, predicate: "proof unit card leaves ready state" });
      const fallbackDeadline = Date.now() + Math.min(battleTimeout, 45_000);
      while (!proofUnitDeployed && Date.now() < fallbackDeadline) {
        const proofPointer = await performVerifiedDeploymentPointer(page, {
          requestedKind: proofUnitKind,
          phase: "proof-fallback",
        });
        proofUnitDeployed = proofPointer.accepted === true;
        if (!proofUnitDeployed) await page.waitForTimeout(120);
      }
      invariant(proofUnitDeployed, `proof unit was not deployable inside the bounded fallback: ${proofUnitKind}`);
      recorder?.clearAwaiting();
    }
    if (!presentationQuiescence && proofUnitKind && !proofUnitAttackObserved) {
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
      await page.waitForFunction((expectedKind) => (
        window.__PHASE_G_LAST_COMBAT_SNAPSHOT__?.screen === "battle"
          && Boolean(document.querySelector(`button.manual-ability-ready.available[data-ability-kind="${expectedKind}"][aria-disabled="false"]`))
      ), manualAbilityKind, { timeout: Math.min(battleTimeout, 45_000), polling: 100 });
      await withPhaseGPageInputLock(page, async () => {
        const lockedAbility = page.locator(`button.manual-ability-ready.available[data-ability-kind="${manualAbilityKind}"][aria-disabled="false"]`).first();
        await lockedAbility.click({ timeout: 700 });
      });
      await page.waitForFunction((expectedKind) => {
        const snapshot = window.__PHASE_G_LAST_COMBAT_SNAPSHOT__;
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
      }, manualAbilityKind, { timeout: Math.min(battleTimeout, 10_000), polling: 100 });
      recorder?.clearAwaiting();
      recorder?.mark("manual-vehicle-action-observed-or-not-required", "observed", { action: `manual-ability:${manualAbilityKind}` });
    }
    if (requireVehicleAction) {
      recorder?.setAwaiting("vehicle-action", { predicate: "vehicle barrage cue or authored crawler firing state" });
      for (let attempt = 0; attempt < 120 && !vehicleActionObserved; attempt += 1) {
        await observeVehicleAction();
        if (vehicleActionObserved) break;
        const crawler = page.locator('button.support-btn.barrage[data-state="ready"][aria-disabled="false"]').first();
        if (await crawler.count().catch(() => 0)) {
          await withPhaseGPageInputLock(page, async () => {
            const lockedCrawler = page.locator('button.support-btn.barrage[data-state="ready"][aria-disabled="false"]').first();
            if (await lockedCrawler.count().catch(() => 0)) await lockedCrawler.click({ timeout: 700 }).catch(() => {});
          });
        }
        await page.waitForTimeout(250);
      }
      await page.waitForFunction(() => {
        const snapshot = window.__PHASE_G_LAST_COMBAT_SNAPSHOT__;
        const crawler = snapshot?.crawlerAbility;
        const activity = window.__PHASE_G_COMBAT_ACTIVITY__ ?? {};
        const runtimeCue = window.__ASHFALL_AUDIO_QA__?.getCueRequests?.()?.some((request) => request?.cueId === "weapon-barrage");
        const historicalAction = (activity.vehicleActions ?? []).includes("vehicle-barrage");
        return historicalAction === true
          || runtimeCue === true
          || crawler?.abilityId === "vehicle-barrage"
          && (crawler.phase === "firing" || crawler.damageTriggered === true || Number(crawler.hitCount ?? crawler.hits?.length ?? 0) > 0);
      }, null, { timeout: Math.min(battleTimeout, 45_000), polling: 100 });
      vehicleActionObserved = true;
      recorder?.clearAwaiting();
      recorder?.mark("manual-vehicle-action-observed-or-not-required", "observed", { action: "vehicle-barrage" });
    }
    if (!presentationQuiescence) {
      await page.waitForFunction(() => window.__PHASE_G_LAST_COMBAT_SNAPSHOT__?.fighters?.some((fighter) => fighter.side === "human" && fighter.hp > 0) === true, null, { timeout: battleTimeout, polling: 100 });
      if (!bossKind || !waitForBossAttack) {
        await waitForCombatActivity(page);
      } else {
        // Boss fixtures are intentionally hostile enough to defeat a passive
        // fixture before wave 4. Keep the evidence path player-like: use the
        // real ready cards as they recover instead of mutating runtime HP.
        await waitForCombatActivity(page, { bossKind });
      }
    }
  } finally {
    sustainActive = false;
    await sustainDone;
    if (presentationQuiescenceArm && !presentationQuiescence && !page.isClosed()) {
      await page.evaluate(({ stageId }) => {
        const bridge = window.__ASHFALL_BATTLE_QA__;
        const current = bridge?.getQaPresentationQuiescence?.();
        if (current?.stageId !== stageId || current?.active !== true || current?.owner !== "phase-g-pre-proof") return current ?? null;
        return bridge?.setQaPresentationQuiesced?.(false, "phase-g-pre-proof") ?? null;
      }, { stageId: expectedStageId }).catch(() => null);
    }
    if (sustainFailure) throw sustainFailure;
  }
  const runtime = await page.evaluate(() => {
    const snapshot = window.__PHASE_G_LAST_COMBAT_SNAPSHOT__;
    return {
      stageId: snapshot?.stageId ?? null,
      enemyKinds: [...new Set((snapshot?.fighters ?? []).filter((fighter) => fighter.side === "zombie").map((fighter) => fighter.kind))],
      fighterKinds: [...new Set((snapshot?.fighters ?? []).map((fighter) => `${fighter.side}:${fighter.kind}`))],
    };
  });
  const stageId = runtime.stageId ?? V100_STAGES.find((entry) => entry.displayName === stageName)?.id ?? V100_STAGE_IDS[0];
  const definition = v100BattleDefinitionFor(stageId);
  const requiredPostEpochActorKeys = presentationQuiescence
    ? [
      proofActor ? `zombie:${proofActor}` : null,
      proofUnitKind ? `human:${proofUnitKind}` : null,
    ].filter(Boolean)
    : [];
  return {
    variant: stageName ? `stage-${V100_STAGES.find((entry) => entry.id === stageId)?.number ?? "unknown"}` : "battle-runtime",
    stageId,
    stageName: V100_STAGES.find((entry) => entry.id === stageId)?.displayName ?? stageName,
    bossKind,
    ...(requestedCombatProofDurationMs ? { combatProofDurationMs: requestedCombatProofDurationMs } : {}),
    expectedEnemyKinds: [...new Set(definition?.timeline?.flatMap((wave) => wave.units) ?? [])],
    observedEnemyKinds: runtime.enemyKinds,
    fighterKinds: runtime.fighterKinds,
    phaseGCombatSnapshotProfile,
    deploymentTrace,
    presentationQuiescence,
    requiredPostEpochActorKeys,
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
    ...await battlePage(page, fullSave({ availableStageIds: V100_STAGE_IDS, completedStageIds: V100_STAGE_IDS.slice(0, contract.stageNumber - 1), formationUnitIds: contract.formationUnitIds, unitLevels: contract.unitLevels }), contract.stageName, { bossKind: contract.bossKind, proofActor: contract.proofActor ?? null, proofUnitKind: contract.proofUnitKind ?? null, proofUnitFirst: contract.proofUnitFirst === true, manualAbilityKind: contract.manualAbilityKind ?? null, requireVehicleAction: contract.requireVehicleAction === true, keepHumanTargetAlive: contract.keepHumanTargetAlive === true, waitForBossAttack: contract.waitForBossAttack !== false, combatProofDurationMs: contract.combatProofDurationMs ?? null, presentationQuiescenceEnabled: contract.presentationQuiescence === true, presentationQuiescenceUntilBattleTime: contract.presentationQuiescenceUntilBattleTime ?? null }),
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
