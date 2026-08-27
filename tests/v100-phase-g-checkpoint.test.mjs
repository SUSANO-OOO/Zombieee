import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import path from "node:path";
import { enemyCombatCueFor, weaponCueForUnit } from "../app/productionAudio.js";
import {
  V100_PHASE_G_V7_REQUIRED_NUMERIC_PATHS,
  attachValidV100PhaseGScreenshotReceipt,
  createV100PhaseGV7ExactContactEpoch,
  setV100PhaseGV7NumericPath,
} from "./fixtures/v100-phase-g-v6-contract.mjs";

const repositoryRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const failFastAssert = assert;

function createCompleteStaticContractAssertionAudit() {
  const failures = [];
  const summarize = (value) => {
    if (value instanceof RegExp) return value.toString();
    if (typeof value === "string") {
      return { type: "string", length: value.length, preview: value.slice(0, 160) };
    }
    if (Array.isArray(value)) return { type: "array", length: value.length };
    if (value && typeof value === "object") return { type: value.constructor?.name ?? "object" };
    return value;
  };
  const audited = {};
  for (const method of ["match", "doesNotMatch", "equal", "deepEqual", "ok"]) {
    audited[method] = (...args) => {
      try {
        failFastAssert[method](...args);
      } catch (error) {
        const localFrames = String(error?.stack ?? "")
          .split(/\r?\n/u)
          .filter((line) => line.includes("v100-phase-g-checkpoint.test.mjs"));
        failures.push({
          method,
          callsite: localFrames.at(-1)?.trim() ?? null,
          operator: error?.operator ?? null,
          expected: summarize(error?.expected),
          actual: summarize(error?.actual),
          message: String(error?.message ?? error).split(/\r?\n/u)[0],
        });
      }
    };
  }
  audited.complete = () => {
    if (failures.length > 0) {
      failFastAssert.fail(`PHASE_G_STATIC_CONTRACT_AUDIT_FAILED:${JSON.stringify(failures, null, 2)}`);
    }
  };
  return Object.freeze(audited);
}

function runContractProbe(input) {
  const result = spawnSync(process.execPath, ["scripts/v100-phase-g-production-matrix.mjs"], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      V100_PHASE_G_CONTRACT_PROBE: "1",
      V100_PHASE_G_CONTRACT_PROBE_INPUT: JSON.stringify(input),
    },
    encoding: "utf8",
  });
  const output = `${result.stdout}\n${result.stderr}`;
  assert.equal(result.status, 0, output);
  return JSON.parse(result.stdout.trim());
}

function runPointerProbe(input) {
  const result = spawnSync(process.execPath, ["scripts/v100-phase-g-production-matrix.mjs"], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      V100_PHASE_G_DEPLOYMENT_POINTER_PROBE: "1",
      V100_PHASE_G_DEPLOYMENT_POINTER_PROBE_INPUT: JSON.stringify(input),
    },
    encoding: "utf8",
  });
  const output = `${result.stdout}\n${result.stderr}`;
  assert.equal(result.status, 0, output);
  return JSON.parse(result.stdout.trim());
}

function runCheckpointFinalizationProbe(input) {
  const result = spawnSync(process.execPath, ["scripts/v100-phase-g-production-matrix.mjs"], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      V100_PHASE_G_CHECKPOINT_FINALIZATION_PROBE: "1",
      V100_PHASE_G_CHECKPOINT_FINALIZATION_PROBE_INPUT: JSON.stringify(input),
    },
    encoding: "utf8",
  });
  const output = `${result.stdout}\n${result.stderr}`;
  assert.equal(result.status, 0, output);
  return JSON.parse(result.stdout.trim());
}

function runHistoryProbe(input) {
  const result = spawnSync(process.execPath, ["scripts/v100-phase-g-production-matrix.mjs"], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      V100_PHASE_G_CAUSAL_HISTORY_PROBE: "1",
      V100_PHASE_G_CAUSAL_HISTORY_PROBE_INPUT: JSON.stringify(input),
    },
    encoding: "utf8",
  });
  const output = `${result.stdout}\n${result.stderr}`;
  assert.equal(result.status, 0, output);
  return JSON.parse(result.stdout.trim());
}

function runBrowserLifecycleProbe(input) {
  const result = spawnSync(process.execPath, ["scripts/v100-phase-g-production-matrix.mjs"], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      V100_PHASE_G_BROWSER_LIFECYCLE_PROBE: "1",
      V100_PHASE_G_BROWSER_LIFECYCLE_PROBE_INPUT: JSON.stringify(input),
    },
    encoding: "utf8",
  });
  const output = `${result.stdout}\n${result.stderr}`;
  assert.equal(result.status, 0, output);
  return JSON.parse(result.stdout.trim());
}

function runCausalConvergenceProbe(input) {
  const result = spawnSync(process.execPath, ["scripts/v100-phase-g-production-matrix.mjs"], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      V100_PHASE_G_CAUSAL_CONVERGENCE_PROBE: "1",
      V100_PHASE_G_CAUSAL_CONVERGENCE_PROBE_INPUT: JSON.stringify(input),
    },
    encoding: "utf8",
  });
  const output = `${result.stdout}\n${result.stderr}`;
  assert.equal(result.status, 0, output);
  return JSON.parse(result.stdout.trim());
}

function runExactActorProbe(input) {
  const encodedInput = JSON.stringify(input, (_key, value) => {
    if (typeof value !== "number" || Number.isFinite(value)) return value;
    return {
      __phaseGNonFiniteNumber__: Number.isNaN(value)
        ? "NaN"
        : value === Number.POSITIVE_INFINITY
          ? "Infinity"
          : "-Infinity",
    };
  });
  const result = spawnSync(process.execPath, ["scripts/v100-phase-g-production-matrix.mjs"], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      V100_PHASE_G_EXACT_ACTOR_PROBE: "1",
      V100_PHASE_G_EXACT_ACTOR_PROBE_INPUT: encodedInput,
    },
    encoding: "utf8",
  });
  const output = `${result.stdout}\n${result.stderr}`;
  assert.equal(result.status, 0, output);
  return JSON.parse(result.stdout.trim());
}

function readyCard(kind, cost) {
  return {
    kind,
    state: "ready",
    ariaDisabled: "false",
    cost,
    rect: { visible: true, width: 80, height: 80 },
  };
}

function liveBattle(overrides = {}) {
  return {
    screen: "battle",
    running: true,
    paused: false,
    over: false,
    won: false,
    energy: 100,
    deployQueue: [],
    deployCooldowns: { ranger: 0, medic: 0 },
    ...overrides,
  };
}

const pointerIdentity = Object.freeze({ nodeId: "deployment-card-1", kind: "ranger", slot: "0" });

function actionablePointerCard(overrides = {}) {
  const rect = { x: 10, y: 20, width: 80, height: 60, visible: true, ...(overrides.rect ?? {}) };
  return {
    ...pointerIdentity,
    state: "ready",
    ariaDisabled: "false",
    disabled: false,
    actionability: { eligible: true, reasons: [] },
    rect,
    center: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
    centerInCard: true,
    centerInViewport: true,
    centerInRail: true,
    viewportIntersection: true,
    railIntersection: true,
    pointerEvents: "auto",
    hitOwnerMatches: true,
    rail: { scrollLeft: 12, rect: { x: 0, y: 0, width: 320, height: 90 } },
    ...overrides,
    rect,
  };
}

function pointerSample(sampleOrdinal, overrides = {}) {
  const {
    schedulerStatus = "pending",
    hostTurn: hostTurnOverrides = {},
    sampledAtWallTimeMs = 1_000 + sampleOrdinal * 40,
    sampledAtPerformanceMs = 2_000 + sampleOrdinal * 40,
    sampleOrdinal: observedOrdinal = sampleOrdinal,
    ...cardOverrides
  } = overrides;
  return {
    sampleOrdinal: observedOrdinal,
    hostTurn: {
      sequence: sampleOrdinal,
      startedAtWallTimeMs: 5_000 + sampleOrdinal * 40,
      endedAtWallTimeMs: 5_040 + sampleOrdinal * 40,
      elapsedMs: 40,
      ...hostTurnOverrides,
    },
    sampledAtWallTimeMs,
    sampledAtPerformanceMs,
    schedulerProbe: { probeId: "probe-1", status: schedulerStatus },
    card: actionablePointerCard(cardOverrides),
  };
}

function pointerReceipt(type, overrides = {}) {
  const sequence = type === "pointerdown" ? 1 : type === "pointerup" ? 2 : 3;
  const preHandler = {
    identity: { ...pointerIdentity },
    eligible: true,
    card: actionablePointerCard({ cost: 45 }),
    battle: liveBattle({ energy: 100 }),
    hitOwner: { ...pointerIdentity },
    ...(overrides.preHandler ?? {}),
  };
  return {
    attemptId: "attempt-1",
    type,
    sequence,
    isTrusted: true,
    pointerType: "mouse",
    button: 0,
    clientX: 50,
    clientY: 50,
    elapsedMs: sequence * 2,
    elapsedSinceDispatchStartMs: sequence,
    owner: { ...pointerIdentity },
    ...overrides,
    preHandler,
  };
}

function verifiedOutcomeInput(overrides = {}) {
  return {
    dispatch: { status: "completed", elapsedMs: 20 },
    receipts: [pointerReceipt("pointerdown"), pointerReceipt("pointerup"), pointerReceipt("click")],
    expectedIdentity: { ...pointerIdentity },
    point: { x: 50, y: 50 },
    attemptId: "attempt-1",
    acceptance: true,
    ...overrides,
  };
}

test("Phase G checkpoint recorder negative mode names the unresolved predicate and lifecycle", () => {
  const result = spawnSync(process.execPath, ["scripts/v100-phase-g-production-matrix.mjs"], {
    cwd: repositoryRoot,
    env: { ...process.env, V100_PHASE_G_CHECKPOINT_NEGATIVE: "1" },
    encoding: "utf8",
  });
  const output = `${result.stdout}\n${result.stderr}`;
  assert.notEqual(result.status, 0, output);
  assert.match(output, /unresolvedCheckpoint=deployment-attempts-recorded/u);
  assert.match(output, /lastCompletedCheckpoint=combat-observer-started/u);
  assert.match(output, /lifecycleStatus=attached/u);
});

test("Phase G rejects a stale ready DOM card when runtime affordability is insufficient without a click", () => {
  const result = runContractProbe({
    cards: [readyCard("ranger", 45)],
    battle: liveBattle({ energy: 27.8 }),
  });
  assert.deepEqual(result.candidates, []);
  assert.match(JSON.stringify(result.sample), /insufficient-energy/u);
});

test("Phase G selects an affordable cooldown-zero candidate from the coherent sample", () => {
  const result = runContractProbe({
    cards: [readyCard("ranger", 45), readyCard("medic", 30)],
    battle: liveBattle({ energy: 45, deployCooldowns: { ranger: 0, medic: 1.2 } }),
  });
  assert.deepEqual(result.candidates, ["ranger"]);
});

test("Phase G preserves the bounded exclusion set when choosing a coherent primary candidate", () => {
  const result = runContractProbe({
    cards: [readyCard("ranger", 45), readyCard("medic", 30)],
    battle: liveBattle({ energy: 100 }),
    excludedKinds: ["ranger"],
  });
  assert.deepEqual(result.candidates, ["medic"]);
});

test("Phase G rejects full queues and terminal battle state before any candidate selection", () => {
  const fullQueue = runContractProbe({
    cards: [readyCard("ranger", 45)],
    battle: liveBattle({ deployQueue: ["medic", "brute", "sniper"] }),
  });
  assert.deepEqual(fullQueue.candidates, []);
  assert.match(JSON.stringify(fullQueue.sample), /deployment-queue-full/u);
  const terminal = runContractProbe({
    cards: [readyCard("ranger", 45)],
    battle: liveBattle({ running: false, over: true }),
  });
  assert.deepEqual(terminal.candidates, []);
  assert.match(JSON.stringify(terminal.sample), /runtime-not-live/u);
});

test("Phase G statically owns all deployment pointers, overlap locks, cursor freeze, and fifteen checkpoints", async () => {
  const assert = createCompleteStaticContractAssertionAudit();
  const [source, appSource, hostTelemetrySource, proofMachineSource] = await Promise.all([
    readFile(path.join(repositoryRoot, "scripts/v100-phase-g-production-matrix.mjs"), "utf8"),
    readFile(path.join(repositoryRoot, "app/AshfallGame.tsx"), "utf8"),
    readFile(path.join(repositoryRoot, "scripts/webkit-host-resource-telemetry.mjs"), "utf8"),
    readFile(path.join(repositoryRoot, "scripts/v100-phase-g-proof-machine.mjs"), "utf8"),
  ]);
  assert.equal(weaponCueForUnit("ranger"), "weapon-rifle", "exact ally proof must use the production unit-weapon cue owner");
  assert.equal(enemyCombatCueFor("spitter", "attack"), "enemy-spitter-attack", "exact enemy proof must use the production combat-cue owner");
  assert.match(source, /import \{ enemyCombatCueFor, weaponCueForUnit \} from "\.\.\/app\/productionAudio\.js"/u);
  assert.doesNotMatch(source, /V100_COMBAT_FX_INVENTORY/u);
  const leanSnapshotBlock = appSource.match(/getPhaseGCombatSnapshot: \(\) => \{([\s\S]*?)\r?\n      \},\r?\n      getSnapshot: \(\) => \{/u)?.[1] ?? "";
  assert.ok(leanSnapshotBlock.length > 0, "missing localhost-only Phase G combat snapshot method");
  assert.equal((appSource.match(/getPhaseGCombatSnapshot:/gu) ?? []).length, 1);
  assert.ok(
    appSource.indexOf('if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") return;')
      < appSource.indexOf("getPhaseGCombatSnapshot:"),
    "lean snapshot must remain inside the existing localhost bridge guard",
  );
  for (const contract of [
    'schema: "v100-phase-g-combat-snapshot/v1"',
    "formationKinds",
    "deployCooldowns",
    "pendingSpawnCount",
    "stageMission",
    "crawlerAbility",
    "attackIdentity",
    "pendingWeaponHits",
    "battlePresentation",
    "manualAbilityReceipts",
    "manualAbilityVfx",
    "animationPresentation",
    "enemyVfx",
  ]) assert.match(leanSnapshotBlock, new RegExp(contract, "u"));
  for (const forbidden of [
    "getSnapshot",
    "renderAudit",
    "renderAuditHistory",
    "survivalRun",
    "survivalProgress",
    "equipmentInventory",
    "geometry",
    "battleSpace",
    "navigationRouteReleases",
    "campaignSave",
    "corpses",
    "areaEffects",
  ]) assert.doesNotMatch(leanSnapshotBlock, new RegExp(forbidden, "u"));
  assert.match(source, /typeof bridge\.getPhaseGCombatSnapshot !== "function"/u);
  assert.match(source, /const snapshot = bridge\.getPhaseGCombatSnapshot\(\)/u);
  assert.match(source, /window\.__PHASE_G_READ_COMBAT_SNAPSHOT__ = readCombatSnapshot/u);
  assert.doesNotMatch(source, /__ASHFALL_BATTLE_QA__[\s\S]{0,80}getSnapshot/u);
  assert.match(source, /const timer = window\.setInterval\(observe, 40\)/u);
  assert.match(source, /phaseGCombatSnapshotProfile/u);
  assert.match(source, /consumerMode: "single-producer-cache"/u);
  assert.match(source, /sampleBytes: new TextEncoder\(\)\.encode\(serialized\)\.byteLength/u);
  assert.match(source, /forbiddenFieldHitCount: forbiddenFieldHits\.length/u);
  assert.match(source, /window\.__PHASE_G_LAST_COMBAT_SNAPSHOT__ = profileSample/u);
  assert.match(source, /window\.__PHASE_G_LAST_COMBAT_SNAPSHOT__ = snapshot/u);
  assert.equal((source.match(/window\.__PHASE_G_LAST_COMBAT_SNAPSHOT_AT__ = performance\.now\(\)/gu) ?? []).length, 2);
  assert.equal((source.match(/window\.__PHASE_G_READ_COMBAT_SNAPSHOT__\(\)/gu) ?? []).length, 2);
  assert.ok((source.match(/window\.__PHASE_G_LAST_COMBAT_SNAPSHOT__/gu) ?? []).length >= 20);
  assert.ok((source.match(/polling: 100/gu) ?? []).length >= 6);
  const presentationBridgeBlock = appSource.match(/const qaPresentationQuiescenceSnapshot = \(\) => \{([\s\S]*?)\r?\n    const bridge = \{/u)?.[1] ?? "";
  assert.ok(presentationBridgeBlock.length > 0, "missing localhost-only QA presentation quiescence bridge");
  assert.ok(
    appSource.indexOf('if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") return;')
      < appSource.indexOf("const qaPresentationQuiescenceSnapshot"),
    "presentation quiescence must remain inside the localhost bridge guard",
  );
  assert.match(presentationBridgeBlock, /parameters\.get\("phase-g"\) === "1"/u);
  assert.match(presentationBridgeBlock, /"phase-g-pre-proof"/u);
  assert.match(presentationBridgeBlock, /schema: "v100-qa-presentation-quiescence\/v1"/u);
  assert.match(presentationBridgeBlock, /battleRoot\.getAnimations\(\{ subtree: true \}\)/u);
  assert.match(presentationBridgeBlock, /state\.enteredAtBattleTime = g\.time/u);
  assert.match(presentationBridgeBlock, /state\.releasedAtBattleTime = g\.time/u);
  assert.match(presentationBridgeBlock, /delete document\.documentElement\.dataset\.qaPresentationQuiesced/u);
  assert.doesNotMatch(presentationBridgeBlock, /g\.time\s*=|g\.fighters\s*=|\.hp\s*=|\.timeline\s*=|\.speed\s*=/u);
  const presentationLoopBlock = appSource.match(/const qaPresentationQuiescence = qaPresentationQuiescenceRef\.current;([\s\S]*?)\r?\n      ctx\.imageSmoothingEnabled/u)?.[1] ?? "";
  assert.match(presentationLoopBlock, /!cadence\.shouldRender \|\| qaPresentationQuiescence\.active/u);
  assert.match(presentationLoopBlock, /qaPresentationQuiescence\.suppressedRenderFrames \+= 1/u);
  const presentationBoundaryNormalizer = source.match(/function normalizePhaseGPresentationQuiescenceBoundary\(value\) \{([\s\S]*?)(?=\nasync function armPhaseGPresentationQuiescence)/u)?.[1] ?? "";
  assert.ok(presentationBoundaryNormalizer.length > 0, "missing single optional presentation-boundary normalizer");
  assert.match(presentationBoundaryNormalizer, /value === null \|\| value === undefined/u);
  assert.match(presentationBoundaryNormalizer, /const normalized = Number\(value\)/u);
  assert.match(presentationBoundaryNormalizer, /!Number\.isFinite\(normalized\) \|\| normalized <= 0/u);
  assert.match(presentationBoundaryNormalizer, /presentation quiescence requires a finite positive battle-time boundary/u);
  assert.equal((source.match(/normalizePhaseGPresentationQuiescenceBoundary/gu) ?? []).length, 3);
  const presentationHarnessBlock = source.match(/async function armPhaseGPresentationQuiescence([\s\S]*?)(?=\nasync function battlePage)/u)?.[1] ?? "";
  assert.ok(presentationHarnessBlock.length > 0, "missing bounded presentation quiescence harness");
  assert.equal((source.match(/presentationQuiescence: true/gu) ?? []).length, 3);
  for (const variant of ["stage06-spitter-seal", "stage24-panther-commander", "stage25-president"]) {
    assert.match(source, new RegExp(`variant: "${variant}"[^\\n]+presentationQuiescence: true`, "u"));
  }
  assert.match(source, /presentationQuiescenceUntilBattleTime: 34/u);
  assert.equal((source.match(/presentationQuiescenceUntilBattleTime: 34/gu) ?? []).length, 1);
  assert.match(source, /const presentationQuiescenceBattleTime = normalizePhaseGPresentationQuiescenceBoundary\(presentationQuiescenceUntilBattleTime\)/u);
  assert.match(source, /if \(!presentationQuiescenceEnabled\) recorder\.mark\("presentation-quiescence-released-or-not-required", "not-required"/u);
  assert.match(source, /if \(presentationQuiescenceEnabled\) \{[\s\S]*?presentationQuiescenceArm = await armPhaseGPresentationQuiescence/u);
  assert.match(source, /if \(presentationQuiescenceArm\) \{[\s\S]*?presentationQuiescence = await releasePhaseGPresentationQuiescence[\s\S]*?untilBattleTime: presentationQuiescenceBattleTime/u);
  assert.doesNotMatch(source, /Number\.isFinite\(Number\(presentationQuiescenceUntilBattleTime\)\)/u);
  assert.match(presentationHarnessBlock, /const receipt = bridge\.setQaPresentationQuiesced\(false, "phase-g-pre-proof"\)/u);
  assert.match(presentationHarnessBlock, /actorAttackObservedBeforeRelease/u);
  assert.doesNotMatch(presentationHarnessBlock, /proof actor attacked while presentation evidence was quiesced/u);
  assert.match(presentationHarnessBlock, /releasedAtRenderFrames\) === Number\(release\.enteredAtRenderFrames/u);
  assert.match(presentationHarnessBlock, /releasedAtSimulationTicks\) > Number\(release\.enteredAtSimulationTicks/u);
  assert.match(presentationHarnessBlock, /Number\(quiescence\?\.renderFrames\) >= Number\(releasedRenderFrames\) \+ 3/u);
  assert.match(presentationHarnessBlock, /style\.visibility !== "hidden"/u);
  assert.match(presentationHarnessBlock, /v100-phase-g-pre-release-readiness\/v2/u);
  assert.doesNotMatch(presentationHarnessBlock, /v100-phase-g-release-interruption-guard\/v1/u);
  assert.match(presentationHarnessBlock, /v100-phase-g-post-quiescence-proof\/v7/u);
  assert.match(presentationHarnessBlock, /const releaseAnchorKey = actorSpecs\.length > 0 \? actorKey\(actorSpecs\[0\]\) : null/u);
  assert.match(presentationHarnessBlock, /releaseRole: index === 0 \? "release-anchor" : "supporting-prerequisite"/u);
  assert.match(presentationHarnessBlock, /releaseMode: index === 0 \? "unconsumed-production-windup" : "completed-hidden-attack"/u);
  const releasePredicateBlock = presentationHarnessBlock.match(/const releaseHandle = await page\.waitForFunction\(\(\{[\s\S]*?releaseAnchorLateWindupMaxSeconds,[\s\S]*?\}\) => \{([\s\S]*?)\r?\n  \}, \{\r?\n    stageId: expectedStageId,/u)?.[1] ?? "";
  assert.ok(releasePredicateBlock.length > 0, "missing atomic live release predicate");
  assert.equal((releasePredicateBlock.match(/bridge\.getPhaseGCombatSnapshot\(\)/gu) ?? []).length, 1, "release predicate must own exactly one direct live snapshot read");
  assert.match(releasePredicateBlock, /Number\(quiescence\.generation\) !== Number\(armGeneration\)[\s\S]*const snapshot = bridge\.getPhaseGCombatSnapshot\(\)/u);
  assert.match(releasePredicateBlock, /snapshot\?\.schema !== "v100-phase-g-combat-snapshot\/v1"[\s\S]*snapshot\?\.stageId !== stageId[\s\S]*snapshot\?\.running !== true/u);
  assert.doesNotMatch(releasePredicateBlock, /__PHASE_G_LAST_COMBAT_SNAPSHOT__|__PHASE_G_LAST_COMBAT_SNAPSHOT_AT__|snapshotAgeMs|attackWindupSeconds \* 1_000|bridge\.getPhaseGCombatSnapshot\?\./u);
  assert.match(releasePredicateBlock, /selectionSnapshotObservedAtPageTime[\s\S]*selectionSnapshotBattleTime[\s\S]*sameTaskSnapshotReadCount: 1[\s\S]*cachedObserverSnapshotUsedForHandoff: false/u);
  assert.match(releasePredicateBlock, /String\(fighter\.targetId\) === String\(fighter\.attackWindupTargetId\)[\s\S]*target\?\.side === expectedTargetSide[\s\S]*Number\(target\.hp\) > 0/u);
  assert.match(releasePredicateBlock, /windupContinuity: \[\]/u);
  assert.match(releasePredicateBlock, /const previousContinuity = Array\.isArray\(actorReadiness\.windupContinuity\)[\s\S]*const newProductionSnapshot = previous[\s\S]*const monotonicallyDecreased = newProductionSnapshot/u);
  assert.match(releasePredicateBlock, /sampleCount: previous\.sampleCount \+ 1[\s\S]*lastWindup: windup[\s\S]*lastBattleTime: snapshot\.time/u);
  assert.match(releasePredicateBlock, /continuity\.sampleCount >= 2[\s\S]*continuity\.firstWindup > continuity\.lastWindup[\s\S]*fighter\.attackWindup <= releaseAnchorLateWindupMaxSeconds/u);
  assert.match(releasePredicateBlock, /const receipt = bridge\.setQaPresentationQuiesced\(false, "phase-g-pre-proof"\)[\s\S]*const releaseSnapshot = snapshot/u);
  assert.match(releasePredicateBlock, /receipt\.owner === quiescence\.owner[\s\S]*receipt\.route === quiescence\.route[\s\S]*Number\(receipt\.generation\) === Number\(quiescence\.generation\)[\s\S]*receipt\.stageId === releaseSnapshot\.stageId[\s\S]*receipt\.running === releaseSnapshot\.running[\s\S]*receipt\.paused === releaseSnapshot\.paused[\s\S]*receipt\.over === releaseSnapshot\.over[\s\S]*receipt\.battleTime === releaseSnapshot\.time/u);
  const releaseSelectionCompleteIndex = releasePredicateBlock.indexOf("if (!readiness.actors.every(readinessFor)) return false;");
  const releaseCallIndex = releasePredicateBlock.indexOf('bridge.setQaPresentationQuiesced(false, "phase-g-pre-proof")');
  const releaseReceiptValidatedIndex = releasePredicateBlock.indexOf("if (!releaseReceiptMatchesSelectionSnapshot)");
  const releaseEpochIndex = releasePredicateBlock.indexOf('schema: "v100-phase-g-post-quiescence-proof/v7"');
  assert.ok(releaseSelectionCompleteIndex >= 0
    && releaseSelectionCompleteIndex < releaseCallIndex
    && releaseCallIndex < releaseReceiptValidatedIndex
    && releaseReceiptValidatedIndex < releaseEpochIndex,
  "selection, same-task release, exact receipt validation, and v7 transaction must remain ordered");
  assert.match(presentationHarnessBlock, /armGeneration: Number\(arm\.generation\)/u);
  assert.match(presentationHarnessBlock, /releaseAnchorLateWindupMaxSeconds: RELEASE_ANCHOR_LATE_WINDUP_MAX_SECONDS/u);
  assert.match(presentationHarnessBlock, /timeout: Math\.min\(battleTimeout, 45_000\), polling: "raf"/u);
  assert.match(presentationHarnessBlock, /releaseAnchorHandoffValid[\s\S]*releaseAnchorFighter\.attackWindup > 0[\s\S]*String\(releaseAnchorFighter\?\.attackWindupTargetId\) === String\(releaseAnchorReadiness\.selectedAttackWindupTargetId\)/u);
  assert.match(presentationHarnessBlock, /lateWindupMaxSeconds: releaseAnchorLateWindupMaxSeconds[\s\S]*continuitySampleCount: releaseAnchorReadiness\.selectedContinuitySampleCount[\s\S]*continuityLastBattleTime: releaseAnchorReadiness\.selectedContinuityLastBattleTime/u);
  assert.match(presentationHarnessBlock, /sameTaskSnapshotReadCount: readiness\.sameTaskSnapshotReadCount[\s\S]*cachedObserverSnapshotUsedForHandoff: readiness\.cachedObserverSnapshotUsedForHandoff[\s\S]*releaseReceiptMatchesSelectionSnapshot/u);
  assert.match(presentationHarnessBlock, /releaseAnchor,[\s\S]*preReleaseReadiness: structuredClone\(readiness\)/u);
  assert.match(presentationHarnessBlock, /post-quiescence release anchor did not preserve an unconsumed exact production attack/u);
  assert.match(presentationHarnessBlock, /selectedFighterId: readyActor\.selectedFighterId/u);
  assert.match(presentationHarnessBlock, /baselineAttackSequence,[\s\S]*state: readyActor\.releaseRole === "release-anchor" \? "TRACKING_CANDIDATE" : "WAITING_SEQUENCE"/u);
  assert.match(presentationHarnessBlock, /activeCandidate: releaseCandidate/u);
  assert.match(presentationHarnessBlock, /candidateHistory: releaseCandidate/u);
  assert.match(presentationHarnessBlock, /contactReceipt: null/u);
  assert.match(presentationHarnessBlock, /audioReceipt: null/u);
  assert.match(presentationHarnessBlock, /acceptedWitnesses: \[\]/u);
  assert.match(presentationHarnessBlock, /const visibleProofStartedAt = performance\.now\(\)/u);
  assert.match(presentationHarnessBlock, /visibleProofDeadlineAt: visibleProofStartedAt \+ proofDurationMs/u);
  assert.match(presentationHarnessBlock, /audioCueRequestBaselineCount: audioCueRequestBaseline\.length/u);
  assert.match(presentationHarnessBlock, /excludedQuiescedAttackObserved/u);
  const battlePageBlock = source.match(/async function battlePage([\s\S]*?)(?=\nfor \(const viewport of requiredViewports\))/u)?.[1] ?? "";
  assert.match(battlePageBlock, /const proofActorAttackCueId = proofActor\s*\? enemyCombatCueFor\(proofActor, "attack"\)\s*: null/u);
  assert.match(battlePageBlock, /const proofUnitAttackCueId = proofUnitKind\s*\? weaponCueForUnit\(proofUnitKind\)\s*: null/u);
  assert.doesNotMatch(battlePageBlock, /\.find\(\(entry\) => entry\?\.actor === proof(?:Actor|UnitKind)\)\?\.soundCue/u);
  const failureReadbackBlock = source.match(/const failureState = await page\.evaluate\(\(battleState\) => \(\{([\s\S]*?)\}\), state\.startsWith\("battle"\)\)\.catch/u)?.[1] ?? "";
  assert.ok(failureReadbackBlock.length > 0, "missing bounded Phase G failure-state readback");
  assert.match(failureReadbackBlock, /preReleaseReadiness: \(\(\) => \{/u);
  assert.match(failureReadbackBlock, /readiness\?\.schema !== "v100-phase-g-pre-release-readiness\/v2"/u);
  assert.match(failureReadbackBlock, /actorKeys: \[\.\.\.\(readiness\.actorKeys \?\? \[\]\)\]\.slice\(0, 4\)/u);
  for (const field of ["releaseAnchorKey", "selectionSnapshotObservedAtPageTime", "selectionSnapshotBattleTime", "sameTaskSnapshotReadCount", "cachedObserverSnapshotUsedForHandoff"]) {
    assert.match(failureReadbackBlock, new RegExp(`${field}: readiness\\.${field}`, "u"));
  }
  assert.match(failureReadbackBlock, /actors: \(readiness\.actors \?\? \[\]\)\.slice\(0, 4\)\.map/u);
  assert.match(failureReadbackBlock, /fighterBaselines: \(actor\.fighterBaselines \?\? \[\]\)\.slice\(0, 16\)\.map/u);
  for (const field of ["releaseRole", "releaseMode", "cueObserved", "hiddenQualificationObserved", "windupObserved", "selectedFighterId", "selectedAttackSequence", "selectedAttackWindup", "selectedAttackWindupTargetId", "selectedTargetId", "selectedTargetSide", "selectedTargetKind", "selectedTargetAlive", "selectedContinuitySampleCount", "selectedContinuityFirstWindup", "selectedContinuityLastWindup", "selectedContinuityFirstBattleTime", "selectedContinuityLastBattleTime", "readyAtPageTime", "readyAtBattleTime"]) {
    assert.match(failureReadbackBlock, new RegExp(`${field}: actor\\.${field}`, "u"));
  }
  assert.match(failureReadbackBlock, /windupContinuity: \(actor\.windupContinuity \?\? \[\]\)\.slice\(0, 16\)\.map/u);
  const readinessFailureReceipt = failureReadbackBlock.match(/preReleaseReadiness: \(\(\) => \{([\s\S]*?)\n          \}\)\(\),/u)?.[1] ?? "";
  assert.ok(readinessFailureReceipt.length > 0, "missing bounded pre-release readiness receipt region");
  assert.doesNotMatch(readinessFailureReceipt, /getCueRequests|document\.|querySelector|innerHTML|outerHTML|PHASE_G_LAST_COMBAT_SNAPSHOT/u);
  const postQuiescenceFailureReceipt = failureReadbackBlock.match(/postQuiescenceProof: \(\(\) => \{([\s\S]*?)\n          \}\)\(\),/u)?.[1] ?? "";
  assert.ok(postQuiescenceFailureReceipt.length > 0, "missing bounded post-quiescence proof receipt region");
  assert.match(postQuiescenceFailureReceipt, /epoch\?\.schema === "v100-phase-g-post-quiescence-proof\/v7"/u);
  assert.match(postQuiescenceFailureReceipt, /return structuredClone\(epoch\)/u);
  assert.doesNotMatch(postQuiescenceFailureReceipt, /getCueRequests|document\.|querySelector|innerHTML|outerHTML|PHASE_G_LAST_COMBAT_SNAPSHOT|observedPostEpochAttack/u);
  assert.match(presentationHarnessBlock, /attackIdentity: \[\][\s\S]*sourceToTargetEdges: \[\][\s\S]*reactionHistory: \[\]/u);
  assert.doesNotMatch(presentationHarnessBlock, /\.time\s*=|eventIndex\s*=|(?:snapshot|game|g)\.fighters\s*=|\.hp\s*=|\.speed\s*=|setGraphicsQuality|accelerateBossFoundationEntry/u);
  const battleRegionStart = source.indexOf("async function battlePage");
  const quiescenceArmIndex = source.indexOf("presentationQuiescenceArm = await armPhaseGPresentationQuiescence", battleRegionStart);
  const sustainTaskIndex = source.indexOf("const sustainTask = bossKind", battleRegionStart);
  const quiescenceReleaseIndex = source.indexOf("presentationQuiescence = await releasePhaseGPresentationQuiescence", battleRegionStart);
  const frontlineCheckpointIndex = source.indexOf('recorder?.mark("frontline-deployment-sequence-completed"', battleRegionStart);
  const sustainDrainIndex = source.indexOf("sustainActive = false;", frontlineCheckpointIndex);
  const proofActorTargetWaitIndex = source.indexOf('recorder?.setAwaiting("proof-actor-live-human-target"', battleRegionStart);
  const proofActorWaitIndex = source.indexOf('recorder?.setAwaiting("proof-actor-attack"', proofActorTargetWaitIndex);
  assert.ok(quiescenceArmIndex < sustainTaskIndex && sustainTaskIndex < frontlineCheckpointIndex && frontlineCheckpointIndex < sustainDrainIndex && sustainDrainIndex < quiescenceReleaseIndex && quiescenceReleaseIndex < proofActorTargetWaitIndex && proofActorTargetWaitIndex < proofActorWaitIndex, "presentation must quiesce before sustain/deployment setup, drain host actions before the release deadline, and keep legacy serial proof waits after the bounded release path");
  assert.match(source, /if \(!presentationQuiescence && proofActor\) \{/u);
  assert.match(source, /if \(!presentationQuiescence && proofUnitKind && !proofUnitAttackObserved\) \{/u);
  assert.match(source, /if \(!presentationQuiescence\) \{[\s\S]*?await page\.waitForFunction\(\(\) => window\.__PHASE_G_LAST_COMBAT_SNAPSHOT__[\s\S]*?await waitForCombatActivity/u);
  assert.match(source, /if \(presentationQuiescenceArm && !presentationQuiescence && !page\.isClosed\(\)\)[\s\S]*?setQaPresentationQuiesced\?\.\(false, "phase-g-pre-proof"\)/u);
  const causalCollector = source.match(/async function collectCombatCausalProof[\s\S]+?(?=\nasync function capture)/u)?.[0] ?? "";
  assert.match(causalCollector, /window\.__PHASE_G_LAST_COMBAT_SNAPSHOT__/u);
  assert.doesNotMatch(causalCollector, /__PHASE_G_READ_COMBAT_SNAPSHOT__\(\)/u);
  assert.match(causalCollector, /battleTime: snapshot\?\.time \?\? null/u);
  assert.match(causalCollector, /activityReactionHistory: observedCombatActivity\.reactionHistory \?\? \[\]/u);
  assert.match(causalCollector, /schema: "v100-phase-g-causal-atomic-receipt\/v1"/u);
  assert.match(causalCollector, /reactionHistory: lastAtomicReceipt\.activityReactionHistory \?\? \[\]/u);
  assert.match(causalCollector, /const isFiniteReceiptNumber = window\.__PHASE_G_IS_FINITE_RECEIPT_NUMBER__/u);
  assert.match(causalCollector, /allAudio\.filter\(\(request\) => \([\s\S]*typeof isFiniteReceiptNumber === "function"[\s\S]*isFiniteReceiptNumber\(request\?\.at\)[\s\S]*isFiniteReceiptNumber\(proofEpoch\.audioCueRequestCutoffAt\)[\s\S]*request\.at > proofEpoch\.audioCueRequestCutoffAt/u);
  assert.doesNotMatch(causalCollector, /Number\(request\.at\) > Number\(proofEpoch\.audioCueRequestCutoffAt\)/u);
  assert.doesNotMatch(causalCollector, /audioCueRequestBaseline|allAudio\.slice\(/u);
  const saturatedAudioRing = Array.from({ length: 128 }, (_, index) => ({ cueId: `old-${index}`, at: index + 1 }));
  const audioCutoffAt = 128.5;
  const rotatedAudioRing = [...saturatedAudioRing, { cueId: "enemy-red-panther-commander-attack", at: 129 }].slice(-128);
  assert.equal(rotatedAudioRing.length, saturatedAudioRing.length, "the production QA ring must reproduce the saturated-length condition");
  assert.deepEqual(rotatedAudioRing.slice(saturatedAudioRing.length), [], "a length cursor must demonstrably lose the new request after rotation");
  assert.deepEqual(
    rotatedAudioRing.filter((request) => Number.isFinite(Number(request.at)) && Number(request.at) > audioCutoffAt),
    [{ cueId: "enemy-red-panther-commander-attack", at: 129 }],
    "the monotonic page-clock cutoff must retain the new request after ring rotation",
  );
  assert.match(causalCollector, /attackSequenceAdvanced/u);
  assert.match(causalCollector, /await new Promise\(\(resolve\) => setTimeout\(resolve, Math\.min\(120, remainingMs\)\)\)/u);
  assert.doesNotMatch(causalCollector, /page\.waitForTimeout/u);
  assert.match(source, /const combatProofDurationMs = Math\.max\(2_400, Number\(process\.env\.V100_PHASE_G_COMBAT_PROOF_MS\) \|\| 12_000\)/u);
  assert.match(source, /const COMBAT_CAUSAL_CONVERGENCE_MIN_DWELL_MS = 2_400/u);
  assert.match(source, /const COMBAT_CAUSAL_CONVERGENCE_MIN_SAMPLES = 8/u);
  assert.match(source, /const COMBAT_CAUSAL_PAGE_TRANSACTION_TIMEOUT_MS = 2_000/u);
  assert.match(source, /const RELEASE_ANCHOR_COMMIT_SCHEDULER_TOLERANCE_SECONDS = RUNTIME_SIMULATION_STEP_SECONDS[\s\S]*\* RUNTIME_MAX_CATCH_UP_STEPS;[\s\S]*const RELEASE_ANCHOR_LATE_WINDUP_MAX_SECONDS = RELEASE_ANCHOR_COMMIT_SCHEDULER_TOLERANCE_SECONDS;/u);
  assert.match(source, /combatProofDurationMs: 4_800/u);
  assert.match(causalCollector, /const proofAndSamplesComplete = convergenceDecision\.proofOk === true[\s\S]*convergenceDecision\.samplesComplete === true[\s\S]*exactActorDecision\.accepted === true/u);
  assert.match(causalCollector, /const residualDwellMs = Math\.max\(0, COMBAT_CAUSAL_CONVERGENCE_MIN_DWELL_MS - elapsedMs\)[\s\S]*await new Promise\(\(resolve\) => setTimeout\(resolve, residualDwellMs\)\)[\s\S]*break/u);
  assert.match(causalCollector, /const proof = buildCombatCausalProof\(samples, stableHistory, \{ requiredActorKeys \}\)/u);
  assert.equal((causalCollector.match(/buildCombatCausalProof\(samples, \{\}, \{ requiredActorKeys \}\)/gu) ?? []).length, 2);
  assert.match(causalCollector, /const stableHistory = lastAtomicReceipt \? \{/u);
  assert.doesNotMatch(causalCollector, /const stableHistory = await page\.evaluate/u);
  assert.match(causalCollector, /v100-phase-g-causal-collection\/v1/u);
  assert.match(causalCollector, /effectiveDurationMs = Math\.max\(0, Math\.min\([\s\S]*visibleProofDeadlineAt/u);
  assert.match(causalCollector, /const hostDeadlineAt = deadlineReadStartedAt \+ effectiveDurationMs/u);
  assert.match(causalCollector, /if \(remainingHostMs < COMBAT_CAUSAL_PAGE_TRANSACTION_TIMEOUT_MS\) break;[\s\S]*const transactionTimeoutMs = COMBAT_CAUSAL_PAGE_TRANSACTION_TIMEOUT_MS/u);
  assert.doesNotMatch(causalCollector, /Math\.min\(COMBAT_CAUSAL_PAGE_TRANSACTION_TIMEOUT_MS, remainingHostMs\)/u);
  assert.match(causalCollector, /observePromiseWithin\(page\.evaluate\([\s\S]*transactionTimeoutMs/u);
  assert.match(causalCollector, /PHASE_G_CAUSAL_TRANSACTION_/u);
  assert.match(causalCollector, /phaseGCausalNoFurtherPageRpc = true/u);
  assert.match(causalCollector, /lastAtomicReceipt,[\s\S]*noFurtherPageRpc: true/u);
  assert.match(causalCollector, /postQuiescenceExactActorDecision/u);
  assert.match(proofMachineSource, /const releaseAnchorExpectedKey = required\[0\] \?\? null/u);
  assert.match(proofMachineSource, /const releaseAnchorOk = releaseAnchorNumericDomainOk/u);
  assert.match(proofMachineSource, /releaseAnchor\.handoffAtPageTime === proofEpoch\.visibleProofStartedAt/u);
  assert.match(proofMachineSource, /releaseAnchorIdentityValid[\s\S]*String\(witness\?\.selectedFighterId\) === String\(releaseAnchor\.fighterId\)[\s\S]*witness\?\.baselineAttackSequence === releaseAnchor\.baselineAttackSequence[\s\S]*String\(witness\?\.targetId\) === String\(releaseAnchor\.targetId\)/u);
  assert.match(source, /import \{ RUNTIME_MAX_CATCH_UP_STEPS, RUNTIME_SIMULATION_STEP_SECONDS \} from "\.\.\/app\/renderPerformance\.js"/u);
  assert.match(source, /RELEASE_ANCHOR_COMMIT_SCHEDULER_TOLERANCE_SECONDS = RUNTIME_SIMULATION_STEP_SECONDS[\s\S]*\* RUNTIME_MAX_CATCH_UP_STEPS/u);
  assert.match(proofMachineSource, /const releaseAnchorCommitWindowSecondsFor = \(releaseAnchor\) =>[\s\S]*Math\.max\(0\.8, attackWindupSeconds \+ 0\.5\) \+ schedulerToleranceSeconds/u);
  assert.match(proofMachineSource, /target\.__PHASE_G_RELEASE_ANCHOR_COMMIT_WINDOW_SECONDS_FOR__ = releaseAnchorCommitWindowSecondsFor/u);
  assert.match(source, /window\.__PHASE_G_RELEASE_ANCHOR_COMMIT_WINDOW_SECONDS_FOR__\?\.\(releaseAnchor\) \?\? null/u);
  assert.doesNotMatch(source, /Math\.max\(0\.8, Number\(releaseAnchor\.attackWindupSeconds\) \+ 0\.5\)/u);
  assert.match(proofMachineSource, /targetEvidenceSourceValid: witness\?\.targetEvidenceSource === "live-attacker-target"/u);
  assert.doesNotMatch(source, /release-anchor-bound-windup/u);
  assert.match(proofMachineSource, /proofEpoch\?\.genericEvidence\?\.allRequirementsGreen === true/u);
  assert.match(proofMachineSource, /proofEpoch\.acceptedWitnesses\?\.find/u);
  assert.doesNotMatch(source, /proofEpoch\.actors\?\.find\([\s\S]*observedPostEpochAttack/u);
  assert.match(causalCollector, /withinReleaseDeadline = requiredActorKeys\.length === 0[\s\S]*finalExactActorDecision\.withinReleaseDeadline === true/u);
  assert.match(causalCollector, /proofCompletedAtPageTime: finalExactActorDecision\.proofCompletedAtPageTime \?\? null/u);
  assert.match(causalCollector, /finalPageNow: stableHistory\.pageNow \?\? null/u);
  assert.doesNotMatch(causalCollector, /Number\(stableHistory\.pageNow\) <= Number\(stableHistory\.proofEpoch\?\.visibleProofDeadlineAt\)/u);
  assert.match(causalCollector, /attemptedSampleCount: samples\.length/u);
  assert.match(causalCollector, /validSampleCount: proof\.sampleCount/u);
  assert.match(causalCollector, /postConvergencePageSampleCount,[\s\S]*finalStableHistoryReadbackCount/u);
  assert.match(causalCollector, /causal-and-exact-actor-contract-satisfied-after-minimum-observation/u);
  assert.match(causalCollector, /release-origin-duration-budget-exhausted-or-proof-incomplete/u);
  const completeCausalProof = {
    ok: true,
    sampleCount: 8,
    stages: { source: true, travelOrContact: true, targetReaction: true, audio: true },
  };
  assert.equal(runCausalConvergenceProbe({ proof: completeCausalProof, options: { elapsedMs: 2_400 } }).accepted, true);
  assert.equal(runCausalConvergenceProbe({ proof: completeCausalProof, options: { elapsedMs: 2_399 } }).accepted, false);
  assert.equal(runCausalConvergenceProbe({ proof: { ...completeCausalProof, sampleCount: 7 }, options: { elapsedMs: 12_000 } }).accepted, false);
  assert.equal(runCausalConvergenceProbe({
    proof: { ...completeCausalProof, stages: { ...completeCausalProof.stages, targetReaction: false } },
    options: { elapsedMs: 12_000 },
  }).accepted, false);
  assert.equal(runCausalConvergenceProbe({ proof: { ...completeCausalProof, ok: false }, options: { elapsedMs: 12_000 } }).accepted, false);
  const exactEpoch = createV100PhaseGV7ExactContactEpoch();
  const exactOptions = { requiredActorKeys: ["zombie:spitter"] };
  const acceptedAfterLaterDeath = runExactActorProbe({ proofEpoch: exactEpoch, options: exactOptions });
  assert.equal(acceptedAfterLaterDeath.accepted, true);
  assert.equal(acceptedAfterLaterDeath.actors[0].actorAlive, false);
  assert.equal(acceptedAfterLaterDeath.actors[0].sourceAliveAtObservation, true);
  assert.equal(acceptedAfterLaterDeath.proofCompletedAtPageTime, 260);
  assert.equal(acceptedAfterLaterDeath.withinReleaseDeadline, true);
  assert.equal(acceptedAfterLaterDeath.releaseAnchorOk, true);
  assert.equal(acceptedAfterLaterDeath.actors[0].targetEvidenceSourceValid, true);
  assert.equal(acceptedAfterLaterDeath.actors[0].releaseAnchorCommitBoundValid, true);
  const schedulerCatchUpEpoch = structuredClone(exactEpoch);
  schedulerCatchUpEpoch.acceptedWitnesses[0].sourceObservedAtBattleTime = 40.95;
  schedulerCatchUpEpoch.acceptedWitnesses[0].observedAtBattleTime = 40.95;
  schedulerCatchUpEpoch.acceptedWitnesses[0].contactReceipt.sourceObservedAtBattleTime = 40.95;
  schedulerCatchUpEpoch.acceptedWitnesses[0].contactReceipt.observedAtBattleTime = 40.95;
  schedulerCatchUpEpoch.acceptedWitnesses[0].candidateCommitDeltaSeconds = 40.95 - 40.1;
  const schedulerCatchUpDecision = runExactActorProbe({ proofEpoch: schedulerCatchUpEpoch, options: exactOptions });
  assert.equal(schedulerCatchUpDecision.accepted, true);
  assert.equal(schedulerCatchUpDecision.actors[0].releaseAnchorCommitBoundValid, true);
  assert.ok(schedulerCatchUpDecision.actors[0].releaseAnchorCommitDeltaSeconds <= schedulerCatchUpDecision.actors[0].releaseAnchorCommitWindowSeconds);
  const outsideSchedulerBoundEpoch = structuredClone(exactEpoch);
  outsideSchedulerBoundEpoch.acceptedWitnesses[0].sourceObservedAtBattleTime = 40.1 + 0.8833333333333334 + 1e-6;
  outsideSchedulerBoundEpoch.acceptedWitnesses[0].observedAtBattleTime = 40.1 + 0.8833333333333334 + 1e-6;
  outsideSchedulerBoundEpoch.acceptedWitnesses[0].contactReceipt.sourceObservedAtBattleTime = 40.1 + 0.8833333333333334 + 1e-6;
  outsideSchedulerBoundEpoch.acceptedWitnesses[0].contactReceipt.observedAtBattleTime = 40.1 + 0.8833333333333334 + 1e-6;
  outsideSchedulerBoundEpoch.acceptedWitnesses[0].candidateCommitDeltaSeconds = 0.8833333333333334 + 1e-6;
  const outsideSchedulerBoundDecision = runExactActorProbe({ proofEpoch: outsideSchedulerBoundEpoch, options: exactOptions });
  assert.equal(outsideSchedulerBoundDecision.accepted, false);
  assert.equal(outsideSchedulerBoundDecision.actors[0].releaseAnchorCommitBoundValid, false);
  const fallbackTargetSourceEpoch = structuredClone(exactEpoch);
  fallbackTargetSourceEpoch.acceptedWitnesses[0].targetEvidenceSource = "release-anchor-bound-windup";
  assert.equal(runExactActorProbe({ proofEpoch: fallbackTargetSourceEpoch, options: exactOptions }).accepted, false);
  const consumedAnchorEpoch = structuredClone(exactEpoch);
  consumedAnchorEpoch.releaseAnchor.handoffValid = false;
  assert.equal(runExactActorProbe({ proofEpoch: consumedAnchorEpoch, options: exactOptions }).accepted, false);
  const singleSnapshotAnchorEpoch = structuredClone(exactEpoch);
  singleSnapshotAnchorEpoch.releaseAnchor.continuitySampleCount = 1;
  assert.equal(runExactActorProbe({ proofEpoch: singleSnapshotAnchorEpoch, options: exactOptions }).accepted, false);
  const nonDecreasingAnchorEpoch = structuredClone(exactEpoch);
  nonDecreasingAnchorEpoch.releaseAnchor.continuityLastWindup = nonDecreasingAnchorEpoch.releaseAnchor.continuityFirstWindup;
  assert.equal(runExactActorProbe({ proofEpoch: nonDecreasingAnchorEpoch, options: exactOptions }).accepted, false);
  const staleContinuityAnchorEpoch = structuredClone(exactEpoch);
  staleContinuityAnchorEpoch.releaseAnchor.continuityLastBattleTime = 40;
  assert.equal(runExactActorProbe({ proofEpoch: staleContinuityAnchorEpoch, options: exactOptions }).accepted, false);
  const wrongAnchorBaselineEpoch = structuredClone(exactEpoch);
  wrongAnchorBaselineEpoch.releaseAnchor.baselineAttackSequence = 5;
  assert.equal(runExactActorProbe({ proofEpoch: wrongAnchorBaselineEpoch, options: exactOptions }).accepted, false);
  const wrongAnchorTargetEpoch = structuredClone(exactEpoch);
  wrongAnchorTargetEpoch.releaseAnchor.targetId = 2;
  assert.equal(runExactActorProbe({ proofEpoch: wrongAnchorTargetEpoch, options: exactOptions }).accepted, false);
  const audioOnlyEpoch = structuredClone(exactEpoch);
  audioOnlyEpoch.acceptedWitnesses = [];
  assert.equal(runExactActorProbe({ proofEpoch: audioOnlyEpoch, options: exactOptions }).accepted, false);
  const duplicateWitnessEpoch = structuredClone(exactEpoch);
  duplicateWitnessEpoch.acceptedWitnesses.push(structuredClone(duplicateWitnessEpoch.acceptedWitnesses[0]));
  assert.equal(runExactActorProbe({ proofEpoch: duplicateWitnessEpoch, options: exactOptions }).accepted, false);
  const staleSequenceEpoch = structuredClone(exactEpoch);
  staleSequenceEpoch.acceptedWitnesses[0].observedAttackSequence = 4;
  assert.equal(runExactActorProbe({ proofEpoch: staleSequenceEpoch, options: exactOptions }).accepted, false);
  const skippedFirstSequenceEpoch = structuredClone(exactEpoch);
  skippedFirstSequenceEpoch.acceptedWitnesses[0].observedAttackSequence = 6;
  assert.equal(runExactActorProbe({ proofEpoch: skippedFirstSequenceEpoch, options: exactOptions }).accepted, false);
  const invalidTargetSourceEpoch = structuredClone(exactEpoch);
  invalidTargetSourceEpoch.acceptedWitnesses[0].targetEvidenceSource = null;
  assert.equal(runExactActorProbe({ proofEpoch: invalidTargetSourceEpoch, options: exactOptions }).accepted, false);
  const lateBoundCommitEpoch = structuredClone(exactEpoch);
  lateBoundCommitEpoch.acceptedWitnesses[0].sourceObservedAtBattleTime = 41;
  lateBoundCommitEpoch.acceptedWitnesses[0].observedAtBattleTime = 41;
  lateBoundCommitEpoch.acceptedWitnesses[0].contactReceipt.sourceObservedAtBattleTime = 41;
  lateBoundCommitEpoch.acceptedWitnesses[0].contactReceipt.observedAtBattleTime = 41;
  lateBoundCommitEpoch.acceptedWitnesses[0].candidateCommitDeltaSeconds = 41 - 40.1;
  assert.equal(runExactActorProbe({ proofEpoch: lateBoundCommitEpoch, options: exactOptions }).accepted, false);
  const wrongFighterEpoch = structuredClone(exactEpoch);
  wrongFighterEpoch.acceptedWitnesses[0].sourceId = 7;
  assert.equal(runExactActorProbe({ proofEpoch: wrongFighterEpoch, options: exactOptions }).accepted, false);
  const invalidTargetEpoch = structuredClone(exactEpoch);
  invalidTargetEpoch.acceptedWitnesses[0].targetSide = "zombie";
  assert.equal(runExactActorProbe({ proofEpoch: invalidTargetEpoch, options: exactOptions }).accepted, false);
  const sourceDeadAtObservationEpoch = structuredClone(exactEpoch);
  sourceDeadAtObservationEpoch.acceptedWitnesses[0].sourceAliveAtObservation = false;
  assert.equal(runExactActorProbe({ proofEpoch: sourceDeadAtObservationEpoch, options: exactOptions }).accepted, false);
  const observationAfterDeadlineEpoch = structuredClone(exactEpoch);
  observationAfterDeadlineEpoch.acceptedWitnesses[0].observedAtPageTime = 501;
  assert.equal(runExactActorProbe({ proofEpoch: observationAfterDeadlineEpoch, options: exactOptions }).accepted, false);
  const audioAfterDeadlineEpoch = structuredClone(exactEpoch);
  audioAfterDeadlineEpoch.acceptedWitnesses[0].audioReceipt.observedAtPageTime = 501;
  audioAfterDeadlineEpoch.acceptedWitnesses[0].proofCompletedAtPageTime = 501;
  assert.equal(runExactActorProbe({ proofEpoch: audioAfterDeadlineEpoch, options: exactOptions }).accepted, false);
  const missingAudioTimeEpoch = structuredClone(exactEpoch);
  missingAudioTimeEpoch.acceptedWitnesses[0].audioReceipt.observedAtPageTime = null;
  assert.equal(runExactActorProbe({ proofEpoch: missingAudioTimeEpoch, options: exactOptions }).accepted, false);
  const exactScreenshotEpoch = structuredClone(exactEpoch);
  attachValidV100PhaseGScreenshotReceipt(exactScreenshotEpoch);
  assert.equal(runExactActorProbe({ proofEpoch: exactScreenshotEpoch, options: exactOptions }).accepted, true);
  const invalidReceiptNumbers = [
    ["null", null],
    ["numeric-string", "260"],
    ["boolean", true],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["-Infinity", Number.NEGATIVE_INFINITY],
  ];
  const strictNumericDomainCases = [];
  for (const fieldLabel of V100_PHASE_G_V7_REQUIRED_NUMERIC_PATHS) {
    for (const [invalidLabel, invalidValue] of invalidReceiptNumbers) {
      const proofEpoch = structuredClone(exactEpoch);
      setV100PhaseGV7NumericPath(proofEpoch, fieldLabel, invalidValue);
      strictNumericDomainCases.push({
        label: `${fieldLabel}:${invalidLabel}`,
        proofEpoch,
        options: exactOptions,
      });
    }
  }
  const strictNumericDomainResults = runExactActorProbe({ cases: strictNumericDomainCases });
  assert.equal(strictNumericDomainResults.length, V100_PHASE_G_V7_REQUIRED_NUMERIC_PATHS.length * invalidReceiptNumbers.length);
  for (const { label, decision } of strictNumericDomainResults) {
    assert.equal(decision.accepted, false, `${label} crossed the strict v7 numeric receipt boundary`);
  }
  const observingEpoch = structuredClone(exactEpoch);
  observingEpoch.state = "OBSERVING";
  assert.equal(runExactActorProbe({ proofEpoch: observingEpoch, options: exactOptions }).accepted, false);
  const genericEvidenceRedEpoch = structuredClone(exactEpoch);
  genericEvidenceRedEpoch.genericEvidence.allRequirementsGreen = false;
  assert.equal(runExactActorProbe({ proofEpoch: genericEvidenceRedEpoch, options: exactOptions }).accepted, false);
  const legacyActorOnlyEpoch = structuredClone(exactEpoch);
  legacyActorOnlyEpoch.acceptedWitnesses = [];
  legacyActorOnlyEpoch.actors[0].observedPostEpochAttack = true;
  legacyActorOnlyEpoch.actors[0].observedAttackSequence = 5;
  assert.equal(runExactActorProbe({ proofEpoch: legacyActorOnlyEpoch, options: exactOptions }).accepted, false);
  const causalTransactionSources = `${source}\n${proofMachineSource}`;
  assert.equal((causalTransactionSources.match(/Object\.assign\(epochActor, \{/gu) ?? []).length, 0);
  assert.doesNotMatch(causalTransactionSources, /v100-phase-g-post-quiescence-proof\/v5/u);
  assert.doesNotMatch(source, /v100-phase-g-post-quiescence-proof\/v6/u);
  assert.match(source, /import \{ createV100PhaseGProofMachine \} from "\.\/v100-phase-g-proof-machine\.mjs"/u);
  assert.match(source, /const phaseGProofMachineFactorySource = createV100PhaseGProofMachine\.toString\(\)/u);
  assert.match(source, /const createProofMachine = \(0, eval\)\(`\(\$\{proofMachineFactorySource\}\)`\)[\s\S]*proofMachine\.installGlobals\(window\)/u);
  assert.match(source, /return phaseGProofMachine\.postQuiescenceExactActorDecision\(proofEpoch, options\)/u);
  assert.match(source, /return phaseGProofMachine\.exactActorDirectContactCausalDecision\(proofEpoch, options\)/u);
  assert.match(proofMachineSource, /const isFiniteReceiptNumber = \(value\) => typeof value === "number" && Number\.isFinite\(value\)/u);
  assert.match(proofMachineSource, /target\.__PHASE_G_IS_FINITE_RECEIPT_NUMBER__ = isFiniteReceiptNumber/u);
  assert.match(proofMachineSource, /PHASE_G_V7_EPOCH_INSTALL_SCHEMA_OR_DOMAIN_INVALID/u);
  assert.match(proofMachineSource, /PHASE_G_SCREENSHOT_DEADLINE_RECEIPT_INVALID/u);
  const strictHostDecision = source.match(/function postQuiescenceExactActorDecision[\s\S]+?(?=\nfunction exactActorDirectContactCausalDecision)/u)?.[0] ?? "";
  const strictDirectContactDecision = source.match(/function exactActorDirectContactCausalDecision[\s\S]+?(?=\nif \(process\.env\.V100_PHASE_G_BROWSER_LIFECYCLE_PROBE)/u)?.[0] ?? "";
  assert.doesNotMatch(strictHostDecision, /Number\.isFinite\(Number\(/u);
  assert.doesNotMatch(strictDirectContactDecision, /Number\.isFinite\(Number\(/u);
  assert.doesNotMatch(source, /const advanceProofEpoch = \(snapshot\) =>/u);
  assert.match(proofMachineSource, /const advanceEpoch = \(epoch, \{[\s\S]*snapshot,[\s\S]*audioRequests = \[\],[\s\S]*pageNow,[\s\S]*\} = \{\}\) =>/u);
  assert.match(proofMachineSource, /event: "INVALIDATED"[\s\S]*WINDUP_RESTARTED_BEFORE_CONTACT[\s\S]*WINDUP_CLEARED_BEFORE_CONTACT[\s\S]*WINDUP_TARGET_CHANGED_BEFORE_CONTACT/u);
  assert.match(proofMachineSource, /state: "WAITING_SUCCESSOR"[\s\S]*activeCandidate: null[\s\S]*successorContinuity: \[\]/u);
  assert.match(proofMachineSource, /continuity\.length >= 2[\s\S]*continuity\[0\]\.windup > continuity\.at\(-1\)\.windup[\s\S]*lateWindupMaxSeconds/u);
  assert.match(proofMachineSource, /origin: "same-epoch-successor"/u);
  assert.match(proofMachineSource, /RELEASE_ANCHOR_SEQUENCE_WITHOUT_ACTIVE_CANDIDATE/u);
  assert.match(proofMachineSource, /EXACT_ATTACK_SEQUENCE_INVALID/u);
  assert.match(proofMachineSource, /RELEASE_ANCHOR_CONTACT_TARGET_MISMATCH/u);
  assert.match(proofMachineSource, /RELEASE_ANCHOR_CANDIDATE_COMMIT_WINDOW_EXCEEDED/u);
  assert.match(proofMachineSource, /state: "SOURCE_COMMITTED"[\s\S]*state: "IMPACT_PENDING"/u);
  assert.match(proofMachineSource, /EXACT_PENDING_IMPACT_REACTION_ACCEPTED/u);
  assert.match(proofMachineSource, /acceptedWitnesses = actors\.map\(\(actor\) => actor\.witness\)\.filter\(Boolean\)/u);
  assert.match(proofMachineSource, /acceptedWitnessesCardinalityOk[\s\S]*acceptedWitnesses\.length === required\.length[\s\S]*\.filter\(\(witness\) => witness\?\.actorKey === actorKey\)\.length === 1/u);
  assert.match(proofMachineSource, /"WITNESS_ACCEPTED", "ALL_EXACT_AND_GENERIC_WITNESSES_ACCEPTED"/u);
  const directContactCapture = proofMachineSource.match(/const contactReceiptFor = \(actor, sourceCommit, target, snapshot, pageNow, causalMode\) => \{[\s\S]+?\n  \};/u)?.[0] ?? "";
  assert.ok(directContactCapture.length > 0, "missing exact-actor direct-contact capture");
  assert.match(directContactCapture, /String\(target\?\.id\) === String\(sourceCommit\?\.targetId\)[\s\S]*target\?\.side === sourceCommit\?\.targetSide[\s\S]*targetHpAtContact > 0/u);
  assert.match(proofMachineSource, /const sourceCommitFor[\s\S]*authored\.observed[\s\S]*const contactReceiptFor[\s\S]*reaction\.observed/u);
  assert.match(proofMachineSource, /const CONTACT_SCHEMA = "v100-phase-g-exact-actor-direct-contact\/v2"/u);
  assert.match(directContactCapture, /targetEvidenceSource: sourceCommit\.targetEvidenceSource/u);
  assert.match(proofMachineSource, /targetEvidenceSource: "live-attacker-target"/u);
  assert.match(proofMachineSource, /const exactAudioReceiptFor = \(actor, epoch, requests, pageNow\) =>/u);
  assert.match(proofMachineSource, /v100-phase-g-exact-audio-receipt\/v1/u);
  const moduleHistoryMerge = source.match(/function mergeCombatActivityHistory[\s\S]+?(?=\nfunction proofActorHumanTargetFromHistory)/u)?.[0] ?? "";
  const pageHistoryMerge = source.match(/const mergeCombatActivityHistory = \(previous = \{\}, snapshot = \{\}\) => \{[\s\S]+?(?=\n    const proofActorHumanTargetFromHistory)/u)?.[0] ?? "";
  for (const historyOwner of [moduleHistoryMerge, pageHistoryMerge]) {
    assert.match(historyOwner, /const hasTargetReactionIdentity = \(observation\) =>/u);
    assert.match(historyOwner, /observation\?\.targetId !== undefined[\s\S]+?typeof observation\?\.targetSide === "string"[\s\S]+?typeof observation\?\.targetKind === "string"/u);
    assert.match(historyOwner, /const isAllowedFighterReaction = \(observation\) =>/u);
    assert.match(historyOwner, /observation\.channel === "fighter-flash"[\s\S]+?observation\.channel === "fighter-knock"[\s\S]+?observation\.channel === "fighter-animation"/u);
    assert.match(historyOwner, /const reactionHistory = \[\.\.\.\(previous\.reactionHistory \?\? \[\]\)\][\s\S]+?\.filter\(isAllowedFighterReaction\)[\s\S]+?\.slice\(0, 96\)/u);
    assert.match(historyOwner, /if \(!isAllowedFighterReaction\(observation\) \|\| reactionHistory\.length >= 96\) return/u);
    assert.match(historyOwner, /reactionHistory\.length >= 96/u);
    assert.match(historyOwner, /channel: "fighter-flash"/u);
    assert.match(historyOwner, /channel: "fighter-knock"/u);
    assert.match(historyOwner, /channel: "fighter-animation"/u);
    assert.match(historyOwner, /\/hurt\|hit\|stagger\|die\/u/u);
    assert.doesNotMatch(historyOwner, /channel: "damage-text"|snapshot\.damageTexts/u);
  }
  const causalProofBuilder = source.match(/function buildCombatCausalProof[\s\S]+?(?=\nasync function startCombatRuntimeObserver)/u)?.[0] ?? "";
  const directContactDecision = proofMachineSource.match(/const exactActorDirectContactCausalDecision = \(proofEpoch,[\s\S]+?(?=\n\n  const installGlobals)/u)?.[0] ?? "";
  assert.ok(directContactDecision.length > 0, "missing strict exact-actor direct-contact validator");
  assert.match(directContactDecision, /receipt\.schema === CONTACT_SCHEMA/u);
  assert.match(directContactDecision, /receipt\.targetEvidenceSource === "live-attacker-target"/u);
  assert.match(directContactDecision, /receipt\.observedAttackSequence === receipt\.baselineAttackSequence \+ 1/u);
  assert.match(directContactDecision, /receipt\.sourceObservedAtBattleTime === witness\.sourceObservedAtBattleTime[\s\S]*receipt\.observedAtBattleTime === witness\.observedAtBattleTime[\s\S]*receipt\.observedAtPageTime === witness\.observedAtPageTime/u);
  assert.match(directContactDecision, /authoredPresentationValid[\s\S]*reactionValid/u);
  assert.match(directContactDecision, /rejectedActorKeys[\s\S]*integrityOk: rejectedActorKeys\.length === 0/u);
  assert.match(causalProofBuilder, /const hasTargetReactionIdentity = \(observation\) =>/u);
  assert.match(causalProofBuilder, /const isAllowedFighterReaction = \(observation\) =>/u);
  assert.match(causalProofBuilder, /if \(!isAllowedFighterReaction\(observation\) \|\| reactionHistory\.length >= 96\) return/u);
  assert.match(causalProofBuilder, /for \(const observation of stableHistory\.reactionHistory \?\? \[\]\) addReactionHistory\(observation\)/u);
  assert.match(causalProofBuilder, /for \(const observation of sample\.activityReactionHistory \?\? \[\]\) addReactionHistory\(observation\)/u);
  assert.match(causalProofBuilder, /const sourceEdgeTargetIds = new Set\(sourceAttribution/u);
  assert.match(causalProofBuilder, /edges\.has\(attribution\.edge\)[\s\S]+?String\(attribution\.targetId\)/u);
  assert.match(causalProofBuilder, /const targetReactionHistory = reactionHistory\.filter\(\(observation\) => sourceEdgeTargetIds\.has\(String\(observation\.targetId\)\)\)/u);
  assert.match(causalProofBuilder, /const targetReactionKeys = new Set\(targetReactionHistory\.map\(reactionHistoryKey\)\)/u);
  assert.match(causalProofBuilder, /reactionHistory,/u);
  assert.match(causalProofBuilder, /targetReactionHistory,/u);
  assert.match(causalProofBuilder, /exactActorDirectContactCausalDecision\(directContactProofEpoch,[\s\S]*requiredActorKeys/u);
  assert.match(causalProofBuilder, /channel: "exact-actor-direct-contact"/u);
  assert.match(causalProofBuilder, /visualEvents\.add\("exact-actor-direct-contact"\)/u);
  assert.match(causalProofBuilder, /for \(const reaction of actor\.reactionObservations\) addReactionHistory\(reaction\)/u);
  assert.match(causalProofBuilder, /exactActorDirectContact\.integrityOk/u);
  assert.match(causalProofBuilder, /targetReaction: targetReactionKeys\.size > 0/u);
  assert.doesNotMatch(causalProofBuilder, /channel: "damage-text"/u);
  assert.doesNotMatch(causalProofBuilder, /attackWindup[^\n]*reactionKeys|pendingWeaponHits[^\n]*reactionKeys|audioCueIds[^\n]*reactionKeys/u);
  const captureFailure = source.match(/let failureState = null;[\s\S]+?(?=\n    const failure = new Error)/u)?.[0] ?? "";
  assert.match(captureFailure, /window\.__PHASE_G_LAST_COMBAT_SNAPSHOT__/u);
  assert.match(captureFailure, /v100-phase-g-causal-no-further-page-rpc\/v1/u);
  assert.match(captureFailure, /allowPageRpc: false/u);
  assert.doesNotMatch(captureFailure, /__PHASE_G_READ_COMBAT_SNAPSHOT__\(\)/u);
  assert.match(captureFailure, /phaseGActivity: window\.__PHASE_G_COMBAT_ACTIVITY__ \?\? null/u);
  assert.match(source, /recorder\?\.setPhaseGCombatSnapshotProfile\(phaseGCombatSnapshotProfile\)/u);
  assert.match(source, /if \(state !== undefined && state !== null\) latestReadableState = state/u);
  assert.match(source, /phaseGCombatSnapshotProfile: window\.__PHASE_G_COMBAT_SNAPSHOT_PROFILE__ \?\? null/u);
  assert.match(source, /const DEPLOYMENT_POINTER_PREFLIGHT_DEADLINE_MS = 5_000/u);
  assert.match(source, /const DEPLOYMENT_POINTER_DIAGNOSTIC_READ_TIMEOUT_MS = 1_000/u);
  assert.match(source, /const DEPLOYMENT_POINTER_SAMPLE_SEPARATION_MS = 40/u);
  assert.doesNotMatch(source, /DEPLOYMENT_POINTER_FRAME_SAMPLE_TIMEOUT_MS/u);
  assert.match(source, /const DEPLOYMENT_POINTER_MAX_SAMPLES = 12/u);
  assert.match(source, /const DEPLOYMENT_POINTER_DISPATCH_DEADLINE_MS = 2_000/u);
  assert.equal((source.match(/\bperformVerifiedDeploymentPointer\b/gu) ?? []).length, 6);
  assert.equal((source.match(/page\.mouse\.click/gu) ?? []).length, 1);
  assert.equal((source.match(/\bwithPhaseGPageInputLock\b/gu) ?? []).length, 8);
  for (const phase of ["sustain-proof", "sustain-redeploy", "non-boss-primary", "boss-primary", "proof-fallback"]) {
    const phaseMarker = `phase: "${phase}"`;
    const phaseIndex = source.indexOf(phaseMarker);
    const helperIndex = source.lastIndexOf("performVerifiedDeploymentPointer", phaseIndex);
    assert.ok(phaseIndex >= 0, `missing deployment phase ${phase}`);
    assert.ok(helperIndex >= 0 && phaseIndex - helperIndex < 240, `${phase} is not owned by performVerifiedDeploymentPointer`);
  }
  assert.equal((source.match(/const lockedAbility =/gu) ?? []).length, 2);
  assert.equal((source.match(/const lockedCrawler =/gu) ?? []).length, 2);
  assert.equal((source.match(/const lockedCanvas =/gu) ?? []).length, 2);
  assert.equal((source.match(/await withPhaseGPageInputLock\(page, async \(\) => \{\s*const lockedAbility =/gu) ?? []).length, 2);
  assert.equal((source.match(/await withPhaseGPageInputLock\(page, async \(\) => \{\s*const lockedCrawler =/gu) ?? []).length, 2);
  assert.equal((source.match(/await withPhaseGPageInputLock\(page, async \(\) => \{\s*const lockedCanvas =/gu) ?? []).length, 2);
  assert.match(source, /targetLeft = clamp\(rail\.scrollLeft \+ cardCenterX - railCenterX, 0, rail\.scrollWidth - rail\.clientWidth\)/u);
  assert.match(source, /rail\.scrollTo\(\{ left: targetLeft, behavior: "instant" \}\)/u);
  assert.match(source, /deploymentWasAccepted/u);
  assert.match(source, /candidate-invalidated-before-pointer/u);
  assert.match(source, /coordinate-invalidated-before-pointer/u);
  assert.match(source, /QA_HARNESS_POINTER_PREFLIGHT_DIVERGENCE/u);
  assert.match(source, /terminalError/u);
  assert.match(source, /recordPointerResult/u);
  assert.match(source, /terminateTimedOutDeploymentPointer/u);
  assert.match(source, /terminateTimedOutDeploymentPreinput/u);
  assert.match(source, /withDeploymentPreinputDeadline/u);
  assert.match(source, /installDeploymentSchedulerProbe/u);
  assert.match(source, /removeDeploymentSchedulerProbe/u);
  assert.match(source, /observePromiseWithin\(page\.evaluate/u);
  assert.match(source, /elapsedSinceDispatchStartMs/u);
  assert.ok(source.indexOf("V100_PHASE_G_DEPLOYMENT_POINTER_PROBE") < source.indexOf("await mkdir(evidenceDir"));
  assert.ok(source.indexOf("V100_PHASE_G_BROWSER_LIFECYCLE_PROBE") < source.indexOf("await mkdir(evidenceDir"));
  assert.ok(source.indexOf("V100_PHASE_G_CAUSAL_CONVERGENCE_PROBE") < source.indexOf("await mkdir(evidenceDir"));
  assert.ok(source.indexOf("V100_PHASE_G_EXACT_ACTOR_PROBE") < source.indexOf("await mkdir(evidenceDir"));
  assert.deepEqual(runBrowserLifecycleProbe({ engineName: "webkit", state: "battle-extra" }), {
    engineName: "webkit",
    state: "battle-extra",
    isolation: "fresh-process-per-capture",
    closeExistingBeforeCapture: true,
    closeAfterCapture: true,
    maxCapturesPerBrowser: 1,
  });
  assert.deepEqual(runBrowserLifecycleProbe({ engineName: "webkit", state: "battle-normal" }), {
    engineName: "webkit",
    state: "battle-normal",
    isolation: "shared-per-engine",
    closeExistingBeforeCapture: false,
    closeAfterCapture: false,
    maxCapturesPerBrowser: null,
  });
  assert.deepEqual(runBrowserLifecycleProbe({ engineName: "chromium", state: "battle-extra" }), {
    engineName: "chromium",
    state: "battle-extra",
    isolation: "shared-per-engine",
    closeExistingBeforeCapture: false,
    closeAfterCapture: false,
    maxCapturesPerBrowser: null,
  });
  const captureState = source.match(/async function captureStateImpl[\s\S]+?(?=\nasync function readBattleDeploymentDiagnostics)/u)?.[0] ?? "";
  assert.match(captureState, /phaseGBrowserLifecyclePolicy\(engineName, state\)/u);
  assert.match(captureState, /if \(browserPolicy\.closeExistingBeforeCapture\) await resetPhaseGBrowser\(engineName\)/u);
  assert.match(captureState, /phaseGBrowserSessionForCapture\(browser, browserPolicy\)/u);
  assert.match(captureState, /browserSession, hostResourceTelemetry \}\)/u);
  assert.match(captureState, /reactionHistory: observedCombatActivity\.reactionHistory \?\? \[\]/u);
  assert.match(captureState, /let phaseGCaptureTransaction = null;[\s\S]*let screenshot = null/u);
  assert.match(captureState, /let combatCausalProof = null;[\s\S]*let causalPageRpcSealed = false;[\s\S]*?try \{[\s\S]*combatCausalProof = await runPhaseGTelemetryOperation\([\s\S]*collectCombatCausalProof\([\s\S]*catch \(error\) \{[\s\S]*phaseGCausalNoFurtherPageRpc[\s\S]*throw error;[\s\S]*finally \{[\s\S]*!causalPageRpcSealed[\s\S]*window\.__PHASE_G_COMBAT_OBSERVER__\?\.stop\?\.\(\)/u);
  assert.match(captureState, /requiredPostEpochActorKeys,[\s\S]*postQuiescenceExactActorProof\?\.accepted === true[\s\S]*collection\?\.converged === true/u);
  assert.match(captureState, /"phase-g\/production-screenshot"[\s\S]*v100-phase-g-release-deadline-receipt\/v1[\s\S]*__PHASE_G_ATTACH_SCREENSHOT_RECEIPT__[\s\S]*withinReleaseDeadline === true[\s\S]*SCREENSHOT_RECEIPT_ACCEPTED[\s\S]*"phase-g\/observer-stop"/u);
  assert.equal((captureState.match(/window\.__PHASE_G_COMBAT_OBSERVER__\?\.stop\?\.\(\)/gu) ?? []).length, 2);
  assert.ok(captureState.indexOf("combatCausalProof = await runPhaseGTelemetryOperation")
    < captureState.indexOf("window.__PHASE_G_COMBAT_OBSERVER__?.stop?.()"));
  assert.match(captureState, /if \(browserPolicy\.closeAfterCapture\) \{[\s\S]*await resetPhaseGBrowser\(engineName\)[\s\S]*\}/u);
  assert.match(source, /import \{ createWebKitHostResourceTelemetry \} from "\.\/webkit-host-resource-telemetry\.mjs"/u);
  assert.match(captureState, /await createWebKitHostResourceTelemetry\(\{/u);
  assert.ok(captureState.indexOf("const page = await context.newPage()")
    < captureState.indexOf("await createWebKitHostResourceTelemetry({"));
  assert.ok(captureState.indexOf("await createWebKitHostResourceTelemetry({")
    < captureState.indexOf("const captureMeta = await runPhaseGTelemetryOperation"));
  assert.match(captureState, /hostResourceTelemetry\?\.setContext\(operationContext\)/u);
  assert.match(captureState, /hostResourceTelemetry\?\.event\("operation-begin", operationContext\)/u);
  assert.match(captureState, /hostResourceTelemetry\?\.event\("operation-end"/u);
  for (const operation of [
    "phase-g/configure",
    "phase-g/production-contract-readback",
    "phase-g/causal-proof",
    "phase-g/observer-stop",
    "phase-g/production-screenshot",
    "phase-g/overflow-audit",
    "phase-g/runtime-readback",
    "phase-g/final-diagnostics",
  ]) assert.match(captureState, new RegExp(operation.replaceAll("/", "\\/"), "u"));
  assert.ok(captureState.indexOf('"phase-g/configure"') < captureState.indexOf('"phase-g/production-contract-readback"'));
  assert.ok(captureState.indexOf('"phase-g/causal-proof"') < captureState.indexOf('"phase-g/production-screenshot"'));
  assert.ok(captureState.indexOf('"phase-g/production-screenshot"') < captureState.indexOf('"phase-g/observer-stop"'));
  assert.ok(captureState.indexOf("screenshot.releaseDeadlineReceipt = releaseDeadlineReceipt")
    < captureState.indexOf('"phase-g/observer-stop"'));
  assert.ok(captureState.indexOf('"phase-g/production-screenshot"') < captureState.indexOf('"phase-g/overflow-audit"'));
  assert.ok(captureState.indexOf('"phase-g/observer-stop"') < captureState.indexOf('"phase-g/overflow-audit"'));
  assert.ok(captureState.indexOf('"phase-g/overflow-audit"') < captureState.indexOf('"phase-g/runtime-readback"'));
  const captureTransactionWriter = source.match(/async function writePhaseGCaptureTransaction[\s\S]+?(?=\nasync function phaseGBrowser)/u)?.[0] ?? "";
  assert.match(captureTransactionWriter, /v100-phase-g-capture-transaction\/v1/u);
  assert.match(captureTransactionWriter, /proofEpoch: cloneDiagnosticValue\(proofEpoch\)/u);
  assert.match(captureTransactionWriter, /screenshot: cloneDiagnosticValue\(screenshot\)/u);
  assert.match(captureTransactionWriter, /browserSession: cloneDiagnosticValue\(browserSession\)/u);
  assert.match(captureTransactionWriter, /cleanupOutcome/u);
  assert.equal((captureState.match(/writePhaseGCaptureTransaction\(\{/gu) ?? []).length, 2);
  assert.match(captureState, /proofEpoch\.state === "CLEANED"[\s\S]*proofEpoch\.cleanupReceipt\.outcome === "success"/u);
  assert.match(captureState, /__PHASE_G_FAIL_PROOF_TRANSACTION__[\s\S]*__PHASE_G_COMBAT_OBSERVER__\?\.stop[\s\S]*__PHASE_G_CLEAN_PROOF_TRANSACTION__/u);
  assert.match(captureState, /PHASE_G_CAPTURE_TRANSACTION_PAGE_RPC_SEALED/u);
  assert.match(captureState, /failureProofEpoch\?\.state !== "CLEANED_AFTER_FAILURE"/u);
  assert.match(captureState, /PHASE_G_FAILURE_DIAGNOSTICS_PERSISTENCE_FAILED[\s\S]*v100-phase-g-failure-diagnostics-unavailable\/v1[\s\S]*allowPageRpc: false/u);
  assert.match(source, /stop: \(\) => \{[\s\S]*window\.clearInterval\(timer\);[\s\S]*try \{[\s\S]*observe\(\);[\s\S]*finally \{[\s\S]*__PHASE_G_CLEAN_PROOF_TRANSACTION__[\s\S]*__PHASE_G_COMBAT_OBSERVER__ = null/u);
  for (const event of ["page-created", "page-crash", "page-close", "context-close", "browser-disconnect", "context-cleanup-begin", "browser-cleanup-begin"]) {
    assert.match(captureState, new RegExp(`hostResourceTelemetry\\?\\.event\\("${event}"`, "u"));
  }
  assert.match(captureState, /await hostResourceTelemetry\?\.stop\(\{/u);
  assert.ok(captureState.indexOf("await resetPhaseGBrowser(engineName)")
    < captureState.lastIndexOf("await hostResourceTelemetry?.stop({"));
  assert.match(hostTelemetrySource, /v100-webkit-host-resource-telemetry\/v1/u);
  assert.match(hostTelemetrySource, /WEBKIT_HOST_RESOURCE_TELEMETRY_INTERVAL_MS = 500/u);
  assert.match(hostTelemetrySource, /setInterval\([\s\S]*sampleIntervalMs/u);
  assert.match(hostTelemetrySource, /writeQueue = operation\.catch/u);
  assert.match(hostTelemetrySource, /linux-proc-cgroup-unavailable/u);
  for (const systemPath of ["/proc", "/sys/fs/cgroup", "/pressure/memory", "/pressure/cpu", "/pressure/io"]) {
    assert.match(hostTelemetrySource, new RegExp(systemPath.replaceAll("/", "\\/"), "u"));
  }
  assert.match(hostTelemetrySource, /descendantTree\(rootPid\)/u);
  assert.match(hostTelemetrySource, /parseWebKitHostProcStat/u);
  assert.match(hostTelemetrySource, /`\$\{PROC_ROOT\}\/self`/u);
  assert.match(hostTelemetrySource, /boundedProcParentIndex/u);
  assert.match(hostTelemetrySource, /wpeweb/u);
  assert.match(hostTelemetrySource, /rootObservedCount/u);
  assert.match(hostTelemetrySource, /webContentObservedCount/u);
  assert.match(hostTelemetrySource, /status = writeError \? "failed" : invalidReason \? "invalid" : "complete"/u);
  assert.match(hostTelemetrySource, /cgroupEventDeltas/u);
  assert.match(hostTelemetrySource, /descendantLeftovers/u);
  assert.match(hostTelemetrySource, /persistedEntries\.length !== expectedEntryCount/u);
  assert.match(hostTelemetrySource, /v100-webkit-wait-owner\/v1/u);
  assert.match(hostTelemetrySource, /d-state-wait-owner-attempt-missing/u);
  assert.match(hostTelemetrySource, /persistedWaitOwnerAttemptCount !== persistedDStateSampleCount/u);
  assert.match(hostTelemetrySource, /telemetry persistence integrity failed/u);
  assert.doesNotMatch(hostTelemetrySource, /node:child_process|\bspawn\s*\(|\bexec\s*\(|process\.env|page\.|mouse\.|keyboard\.|evaluate\s*\(/u);
  assert.match(captureState, /let pageCrashPrimary = null/u);
  assert.match(captureState, /code: "WEBKIT_PAGE_CRASH"/u);
  assert.match(captureState, /primary WebKit page crash/u);
  assert.match(captureState, /secondaryError/u);
  assert.match(captureState, /WEBKIT_HOST_TELEMETRY_INVALID/u);
  assert.match(captureState, /capturePrimaryFailure\.phaseGFailure\.telemetryFailure/u);
  const browserSessionHelper = source.match(/function phaseGBrowserSessionForCapture[\s\S]+?(?=\nasync function closePhaseGBrowsers)/u)?.[0] ?? "";
  assert.match(browserSessionHelper, /metadata\.captureCount \+= 1/u);
  assert.match(browserSessionHelper, /metadata\.captureCount <= policy\.maxCapturesPerBrowser/u);
  assert.match(browserSessionHelper, /captureOrdinal: metadata\.captureCount/u);
  const checkpointRecorder = source.match(/function createBattleExtraCheckpointRecorder[\s\S]+?(?=\nif \(process\.env\.V100_PHASE_G_CHECKPOINT_NEGATIVE)/u)?.[0] ?? "";
  assert.match(checkpointRecorder, /browserSession: cloneDiagnosticValue\(browserSession\)/u);
  assert.match(checkpointRecorder, /hostResourceTelemetry: cloneDiagnosticValue\(hostResourceTelemetry\?\.reference\(\) \?\? null\)/u);
  assert.match(source, /if \(failurePayload\) return/u);
  assert.match(source, /deepFreezeDiagnosticValue/u);
  assert.doesNotMatch(source, /clickDeploymentCard/u);
  const deploymentHelper = source.match(/async function performVerifiedDeploymentPointer[\s\S]*?(?=\nasync function openRoute)/u)?.[0] ?? "";
  assert.match(deploymentHelper, /page\.mouse\.click/u);
  assert.match(deploymentHelper, /waitForDeploymentAcceptance/u);
  assert.match(deploymentHelper, /terminateTimedOutDeploymentPointer/u);
  assert.match(deploymentHelper, /let primaryError = null/u);
  assert.match(deploymentHelper, /receiptCleanupFailure/u);
  assert.match(deploymentHelper, /preflightEvidence/u);
  assert.match(deploymentHelper, /recordPointerResult\(\{[\s\S]*?pointerCount: error\?\.pointerCount \?\? 0/u);
  assert.match(deploymentHelper, /setTimeout\(resolve, DEPLOYMENT_POINTER_SAMPLE_SEPARATION_MS\)/u);
  assert.match(deploymentHelper, /schedulerProbeId/u);
  assert.match(deploymentHelper, /hostTurns/u);
  assert.match(deploymentHelper, /timeoutCancellation/u);
  assert.doesNotMatch(deploymentHelper, /await pointerPromise\b|context\(\)\.close\(\)\.catch/u);
  const cancellationHelper = source.match(/async function terminateTimedOutDeploymentPointer[\s\S]*?(?=\nasync function centerDeploymentCardInRail)/u)?.[0] ?? "";
  assert.match(cancellationHelper, /await operation\(\)/u);
  assert.match(cancellationHelper, /terminalLifecycleVerified/u);
  assert.match(cancellationHelper, /independentLifecycleLoss/u);
  assert.doesNotMatch(cancellationHelper, /BROWSER_POINTER_CANCELLATION_FAILURE|observePromiseWithin\(operation/u);
  const preinputCancellation = source.match(/async function terminateTimedOutDeploymentPreinput[\s\S]*?(?=\nasync function terminateTimedOutDeploymentPointer)/u)?.[0] ?? "";
  assert.match(preinputCancellation, /context\.close\(\)/u);
  assert.match(preinputCancellation, /operationSettlement/u);
  assert.match(preinputCancellation, /terminalLifecycleVerified/u);
  assert.doesNotMatch(preinputCancellation, /browser\.close\(\)/u);
  const schedulerProbe = source.match(/async function installDeploymentSchedulerProbe[\s\S]*?(?=\nasync function centerDeploymentCardInRail)/u)?.[0] ?? "";
  assert.equal((schedulerProbe.match(/requestAnimationFrame/gu) ?? []).length, 1);
  assert.match(schedulerProbe, /status: "pending"/u);
  assert.match(schedulerProbe, /entry\.status = "observed"/u);
  const diagnosticHelper = source.match(/async function readBattleDeploymentDiagnostics[\s\S]*?(?=\nfunction deploymentWasAccepted)/u)?.[0] ?? "";
  assert.doesNotMatch(diagnosticHelper, /awaitAnimationFrame|waitForAnimationFrame|requestAnimationFrame/u);
  assert.match(diagnosticHelper, /sampleOrdinal/u);
  assert.match(diagnosticHelper, /document\.hasFocus\(\)/u);
  assert.match(diagnosticHelper, /schedulerProbe/u);
  const receiptWait = source.match(/async function waitForDeploymentPointerReceipts[\s\S]*?(?=\nasync function removeDeploymentPointerReceipt)/u)?.[0] ?? "";
  assert.match(receiptWait, /if \(read\.status === "fulfilled"\) receipts = read\.receipts/u);
  assert.doesNotMatch(receiptWait, /^\s{4}receipts = read\.receipts;/mu);
  const acceptanceWait = source.match(/async function waitForDeploymentAcceptance[\s\S]*?(?=\nfunction isTransientBrowserClosure)/u)?.[0] ?? "";
  assert.match(acceptanceWait, /let latest = null/u);
  assert.match(acceptanceWait, /let fulfilledPostRead = false/u);
  assert.match(acceptanceWait, /fulfilledPostRead = true/u);
  assert.match(acceptanceWait, /const accepted = fulfilledPostRead && latest !== null/u);
  assert.match(acceptanceWait, /while \(Date\.now\(\) < deadline\)/u);
  assert.doesNotMatch(acceptanceWait, /let latest = before|while \(!deploymentWasAccepted/u);
  const failurePersistence = source.match(/const persistFailure = async[\s\S]*?(?=\n\s*const recorder = \{)/u)?.[0] ?? "";
  assert.match(failurePersistence, /structuredError/u);
  assert.match(failurePersistence, /pointerEvidence: cloneDiagnosticValue/u);
  assert.match(failurePersistence, /receiptCleanupFailure: cloneDiagnosticValue/u);
  assert.doesNotMatch(deploymentHelper, /locator\.click|scrollIntoViewIfNeeded|force\s*:\s*true|dispatchEvent|\.evaluate\([^)]*\.click\(/u);
  const battleRegion = source.slice(source.indexOf("async function battlePage"), source.indexOf("for (const viewport of requiredViewports)"));
  assert.doesNotMatch(battleRegion, /window\.__PHASE_G_COMBAT_OBSERVER__\?\.stop\?\.\(\)/u);
  assert.doesNotMatch(battleRegion, /page\.locator\([^)]*button\.unit-card[^)]*\)[\s\S]{0,160}?\.click\s*\(/u);
  assert.doesNotMatch(battleRegion, /document\.querySelector\([^)]*button\.unit-card[^)]*\)[\s\S]{0,80}?\.click\s*\(/u);
  assert.doesNotMatch(battleRegion, /scrollIntoViewIfNeeded|force\s*:\s*true|dispatchEvent\([^)]*unit-card/u);
  assert.doesNotMatch(source, /JSON\.stringify\(\{ \.\.\.failurePayload, \.\.\.snapshot\(\) \}/u);
  const checkpointBlock = source.match(/const BATTLE_EXTRA_CHECKPOINTS = Object\.freeze\(\[([\s\S]*?)\]\);/u)?.[1] ?? "";
  assert.equal((checkpointBlock.match(/"[^"]+"/gu) ?? []).length, 15);
  assert.match(checkpointBlock, /"presentation-quiescence-released-or-not-required"/u);
  assert.equal((source.match(/const targetOwnershipHistory = \[\.\.\.\(previous\.targetOwnershipHistory \?\? \[\]\)\];/gu) ?? []).length, 2);
  assert.match(source, /function proofActorHumanTargetFromHistory\(history = \[\], expectedKind = null, expectedFighterId = null\)/u);
  assert.match(source, /const proofActorHumanTargetFromHistory = \(history = \[\], expectedKind = null, expectedFighterId = null\) =>/u);
  assert.match(source, /String\(observation\?\.sourceId\) === String\(expectedFighterId\)/u);
  assert.match(source, /activityTargetOwnershipHistory: observedCombatActivity\.targetOwnershipHistory \?\? \[\]/u);
  assert.match(source, /targetOwnershipHistory: observedCombatActivity\.targetOwnershipHistory \?\? \[\]/u);
  const finalProofStart = source.indexOf('recorder?.setAwaiting("proof-actor-live-human-target"');
  const finalProofEnd = source.indexOf("if (!presentationQuiescence && proofUnitKind && !proofUnitDeployed) await observeProofUnitAttack();", finalProofStart);
  const finalProofRegion = source.slice(finalProofStart, finalProofEnd);
  assert.ok(finalProofStart >= 0 && finalProofEnd > finalProofStart);
  assert.match(finalProofRegion, /if \(proofActorRequiresContactFirst\)/u);
  assert.match(finalProofRegion, /const contactDeadline = Date\.now\(\) \+ Math\.min\(battleTimeout, 45_000\)/u);
  assert.match(finalProofRegion, /contactState\?\.hasLiveHumanTarget !== true/u);
  assert.match(finalProofRegion, /proofActorAttackObserved \|\| contactState\?\.hasLiveHumanTarget === true/u);
  assert.match(finalProofRegion, /proofActorAttackObserved[\s\S]+contactState\?\.hasHumanTarget === true/u);
  assert.match(finalProofRegion, /if \(!proofActorAttackObserved\)[\s\S]+setAwaiting\("proof-actor-attack"/u);
  assert.match(finalProofRegion, /const proofActorDeadline = Date\.now\(\) \+ Math\.min\(battleTimeout, 45_000\)/u);
  assert.match(finalProofRegion, /while \(!proofActorAttackObserved && Date\.now\(\) < proofActorDeadline\)/u);
  assert.match(finalProofRegion, /invariant\(proofActorAttackObserved, `proof enemy actor did not attack/u);
  assert.equal((finalProofRegion.match(/Math\.min\(battleTimeout, 45_000\)/gu) ?? []).length, 2);
  assert.match(finalProofRegion, /finalContactState\?\.hasHumanTarget === true/u);
  assert.doesNotMatch(finalProofRegion, /proofActorAttackObserved = true;/u);
  assert.equal((finalProofRegion.match(/contactState\?\.hasLiveHumanTarget === true/gu) ?? []).length, 2);
  assert.equal((finalProofRegion.match(/contactState\?\.hasHumanTarget === true/gu) ?? []).length, 1);
  assert.equal((source.match(/(?:recorder|recorder\?)\.markOnce\("proof-actor-mounted-or-absent"/gu) ?? []).length, 4);
  assert.equal((source.match(/(?:recorder|recorder\?)\.markOnce\("living-human-target-acquired-or-not-required"/gu) ?? []).length, 2);
  assert.match(captureState, /checkpointRecorder\?\.markOnce\("proof-actor-mounted-or-absent"[\s\S]*checkpointRecorder\?\.markOnce\("living-human-target-acquired-or-not-required"/u);
  assert.match(source, /proofActorAttackObserved = proofActor === null;[\s\S]*proofUnitAttackObserved = proofUnitKind === null;/u);
  assert.match(source, /postQuiescenceExactActorProof\?\.accepted === true/u);
  assert.match(source, /exact post-quiescence actor proof failed inside the single release deadline/u);
  assert.doesNotMatch(source, /(?:recorder|recorder\?)\.mark\("proof-actor-mounted-or-absent"/u);
  assert.doesNotMatch(source, /(?:recorder|recorder\?)\.mark\("living-human-target-acquired-or-not-required"/u);
  assert.match(source, /function proofActorTargetContinuityDecision\(\{/u);
  assert.match(source, /hasLiveHumanTarget: liveHumanTarget/u);
  const bossContactRegionStart = source.indexOf("for (let deployment = 0; deployment < bossDeploymentLimit; deployment += 1)");
  const bossContactRegionEnd = source.indexOf("bossDeploymentFinished = true;", bossContactRegionStart);
  assert.ok(bossContactRegionStart >= 0 && bossContactRegionEnd > bossContactRegionStart);
  const bossContactRegion = source.slice(bossContactRegionStart, bossContactRegionEnd);
  assert.equal((bossContactRegion.match(/contactState\?\.hasLiveHumanTarget === true/gu) ?? []).length, 0);
  assert.equal((bossContactRegion.match(/contactState\?\.hasHumanTarget === true/gu) ?? []).length, 0);
  assert.match(source, /let bossFrontlineTerminalHandoff = null;/u);
  assert.match(source, /const latchBossFrontlineTerminalHandoff = \(contactState, observationPhase\) => \{/u);
  assert.match(source, /!presentationQuiescenceArm \|\| !proofActor/u);
  assert.match(source, /const exactAttackObserved = proofActorAttackObserved === true;/u);
  assert.match(source, /const liveHumanTargetObserved = contactState\?\.hasLiveHumanTarget === true;/u);
  assert.match(source, /if \(!exactAttackObserved && !liveHumanTargetObserved\) return null;/u);
  assert.match(source, /reason: exactAttackObserved[\s\S]*?"exact-proof-actor-attack-observed"[\s\S]*?"current-live-human-target-observed"/u);
  const terminalHandoffHelper = source.match(/const latchBossFrontlineTerminalHandoff[\s\S]+?(?=\n  const observeProofUnitAttack)/u)?.[0] ?? "";
  assert.doesNotMatch(terminalHandoffHelper, /hasHumanTarget|targetOwnershipHistory|monotonic-target-history/u);
  assert.match(terminalHandoffHelper, /const observeBossFrontlineTerminalHandoff/u);
  assert.match(terminalHandoffHelper, /boundedContactWait = false/u);
  assert.match(terminalHandoffHelper, /await observeProofActorAttack\(\);[\s\S]*await readProofActorContactState\(\);[\s\S]*latchBossFrontlineTerminalHandoff/u);
  assert.match(terminalHandoffHelper, /Date\.now\(\) \+ \(boundedContactWait \? 1_800 : 0\)/u);
  const bossOuterLoopIndex = bossContactRegion.indexOf("for (let deployment = 0; deployment < bossDeploymentLimit; deployment += 1)");
  const beforeNextSlotLatchIndex = bossContactRegion.indexOf('observeBossFrontlineTerminalHandoff("before-next-slot")');
  const nextSlotAwaitingIndex = bossContactRegion.indexOf('recorder?.setAwaiting("boss-frontline-deployment"');
  const candidateSampleIndex = bossContactRegion.indexOf('phase: "candidate-sample"');
  const beforeRealPointerIndex = bossContactRegion.indexOf('observeBossFrontlineTerminalHandoff("before-real-pointer")');
  const pointerIndex = bossContactRegion.indexOf("await performVerifiedDeploymentPointer");
  assert.ok(bossOuterLoopIndex >= 0
    && bossOuterLoopIndex < beforeNextSlotLatchIndex
    && beforeNextSlotLatchIndex < nextSlotAwaitingIndex
    && nextSlotAwaitingIndex < candidateSampleIndex
    && candidateSampleIndex < beforeRealPointerIndex
    && beforeRealPointerIndex < pointerIndex,
  "generalized exact-actor terminal handoff must run before every later slot, candidate sample, and pointer");
  assert.match(bossContactRegion, /observeBossFrontlineTerminalHandoff\("before-candidate-sample", \{[\s\S]*?boundedContactWait: proofActorRequiresContactFirst[\s\S]*?if \(bossFrontlineTerminalHandoff\) break;/u);
  assert.match(bossContactRegion, /observeBossFrontlineTerminalHandoff\("after-accepted-pointer", \{[\s\S]*?boundedContactWait: proofActorRequiresContactFirst[\s\S]*?if \(bossFrontlineTerminalHandoff\) break;/u);
  assert.match(bossContactRegion, /if \(bossFrontlineTerminalHandoff\) break;[\s\S]*?if \(await bossIsLive\(\)\) break;/u);
  assert.match(source, /contactFirstTerminalHandoff: proofActorRequiresContactFirst \? bossFrontlineTerminalHandoff : null/u);
  assert.match(source, /proofActorTerminalHandoff: bossFrontlineTerminalHandoff/u);
  assert.match(source, /targetContinuity\.allowSustainRedeploy/u);
  assert.match(source, /targetContinuity\.targetSurvivalPlanPending/u);
  const continuityHelper = source.match(/function proofActorTargetContinuityDecision\(\{([\s\S]+?)\n\}\n\nfunction combatCausalConvergenceDecision/u)?.[1] ?? "";
  assert.doesNotMatch(continuityHelper, /page\.|window\.|fighter|targetId|attackIdentity|audio|\bhp\b|resource|clock/u);

  const livingHumanHistory = runHistoryProbe({
    proofActor: "red-panther-shield",
    observerFrames: [{
      time: 40_483,
      fighters: [
        { id: 10, side: "zombie", kind: "red-panther-shield", hp: 240, targetId: 20 },
        { id: 20, side: "human", kind: "guardian", hp: 190, targetId: null },
      ],
    }, {
      time: 40_523,
      fighters: [],
      attackIdentity: [],
      pendingWeaponHits: [],
    }],
    waitSnapshot: { time: 40_563, fighters: [], attackIdentity: [], pendingWeaponHits: [] },
    targetContinuity: {
      bossDeploymentFinished: true,
      bossEngaged: true,
      keepHumanTargetAlive: false,
      proofActorRequiresContactFirst: true,
      proofActorAttackObserved: false,
      liveHumanTargetCount: 0,
    },
  });
  assert.equal(livingHumanHistory.history.targetOwnershipHistory.length, 1);
  assert.deepEqual(livingHumanHistory.humanTarget, {
    channel: "targetId",
    battleTime: 40_483,
    sourceId: 10,
    sourceSide: "zombie",
    sourceKind: "red-panther-shield",
    targetId: 20,
    targetSide: "human",
    targetKind: "guardian",
    targetHp: 190,
    targetAlive: true,
  });
  assert.deepEqual(livingHumanHistory.targetContinuity, {
    proofActorContactPlanPending: true,
    targetSurvivalPlanPending: true,
    allowSustainRedeploy: true,
  });

  const oneLiveHuman = runHistoryProbe({
    targetContinuity: {
      bossDeploymentFinished: true,
      bossEngaged: true,
      proofActorRequiresContactFirst: true,
      proofActorAttackObserved: false,
      liveHumanTargetCount: 1,
    },
  });
  assert.deepEqual(oneLiveHuman.targetContinuity, {
    proofActorContactPlanPending: true,
    targetSurvivalPlanPending: true,
    allowSustainRedeploy: true,
  });

  const twoLiveHumans = runHistoryProbe({
    targetContinuity: {
      bossDeploymentFinished: true,
      bossEngaged: true,
      proofActorRequiresContactFirst: true,
      proofActorAttackObserved: false,
      liveHumanTargetCount: 2,
    },
  });
  assert.deepEqual(twoLiveHumans.targetContinuity, {
    proofActorContactPlanPending: true,
    targetSurvivalPlanPending: false,
    allowSustainRedeploy: false,
  });

  const disengagedBoss = runHistoryProbe({
    targetContinuity: {
      bossDeploymentFinished: true,
      bossEngaged: false,
      proofActorRequiresContactFirst: true,
      proofActorAttackObserved: false,
      liveHumanTargetCount: 0,
    },
  });
  assert.deepEqual(disengagedBoss.targetContinuity, {
    proofActorContactPlanPending: true,
    targetSurvivalPlanPending: false,
    allowSustainRedeploy: false,
  });

  const unfinishedOpening = runHistoryProbe({
    targetContinuity: {
      bossDeploymentFinished: false,
      bossEngaged: true,
      proofActorRequiresContactFirst: true,
      proofActorAttackObserved: false,
      liveHumanTargetCount: 0,
    },
  });
  assert.deepEqual(unfinishedOpening.targetContinuity, {
    proofActorContactPlanPending: true,
    targetSurvivalPlanPending: true,
    allowSustainRedeploy: false,
  });

  const observedAttack = runHistoryProbe({
    targetContinuity: {
      bossDeploymentFinished: true,
      bossEngaged: true,
      proofActorRequiresContactFirst: true,
      proofActorAttackObserved: true,
      liveHumanTargetCount: 0,
    },
  });
  assert.deepEqual(observedAttack.targetContinuity, {
    proofActorContactPlanPending: false,
    targetSurvivalPlanPending: false,
    allowSustainRedeploy: true,
  });

  const nonHumanHistory = runHistoryProbe({
    proofActor: "red-panther-shield",
    observerFrames: [{
      time: 12_000,
      fighters: [
        { id: 30, side: "zombie", kind: "red-panther-shield", hp: 240, targetId: 31 },
        { id: 31, side: "object", kind: "medical-support", hp: 100, targetId: null },
      ],
      attackIdentity: [{ sourceId: 30, targetId: 31 }],
    }],
  });
  assert.equal(nonHumanHistory.humanTarget, null);
  assert.equal(nonHumanHistory.history.targetOwnershipHistory.every((observation) => observation.targetSide !== "human"), true);

  const identitylessHistory = runHistoryProbe({
    proofActor: "red-panther-shield",
    observerFrames: [{
      time: 15_000,
      fighters: [],
      attackIdentity: [{ sourceId: 40, targetId: 41 }],
      attackingActors: ["zombie:red-panther-shield"],
    }],
    proofSamples: [{
      activitySourceToTargetEdges: ["40->41"],
      battlePresentationEffects: [{ semantic: "impact" }],
      audioCueRequests: [{ cueId: "shield-hit" }],
    }],
  });
  assert.equal(identitylessHistory.humanTarget, null);
  assert.deepEqual(identitylessHistory.history.targetOwnershipHistory, []);
  assert.deepEqual(identitylessHistory.history.sourceToTargetEdges, ["40->41"]);

  const boundedFrames = Array.from({ length: 98 }, (_, index) => ({
    time: index,
    fighters: [
      { id: `shield-${index}`, side: "zombie", kind: "red-panther-shield", hp: 240, targetId: `human-${index}` },
      { id: `human-${index}`, side: "human", kind: `human-${index}`, hp: 100, targetId: null },
    ],
  }));
  const boundedHistory = runHistoryProbe({
    proofActor: "red-panther-shield",
    observerFrames: boundedFrames,
    waitSnapshot: { time: 99, fighters: [] },
  });
  assert.equal(boundedHistory.history.targetOwnershipHistory.length, 96);
  assert.equal(boundedHistory.history.targetOwnershipHistory[0].targetId, "human-0");
  assert.equal(boundedHistory.history.targetOwnershipHistory[95].targetId, "human-95");
  assert.equal(boundedHistory.humanTarget.targetId, "human-0");
  assert.complete();
});

test("r14 pointer precondition accepts scheduler-independent samples with pending or observed rAF and an immediate terminal recheck", () => {
  for (const schedulerStatus of ["pending", "observed"]) {
    const samples = [
      pointerSample(1, { schedulerStatus }),
      pointerSample(2, { schedulerStatus, rect: { x: 10.75 }, rail: { scrollLeft: 12.75 } }),
    ];
    const terminal = pointerSample(3, { schedulerStatus, rect: { x: 11.5 }, rail: { scrollLeft: 13.5 } });
    const result = runPointerProbe({
      precondition: { expectedIdentity: pointerIdentity, samples, terminal },
    }).precondition;
    assert.equal(result.status, "ready-for-pointer");
    assert.equal(result.pointerCount, 0);
    assert.deepEqual(result.identity, pointerIdentity);
    assert.deepEqual(result.point, terminal.card.center);
  }
});

test("r12 pointer precondition keeps identity and terminal coordinate invalidations at zero input", () => {
  const samples = [pointerSample(1), pointerSample(2)];
  const identityChange = runPointerProbe({
    precondition: {
      expectedIdentity: pointerIdentity,
      samples,
      terminal: pointerSample(2, { nodeId: "deployment-card-2" }),
    },
  }).precondition;
  assert.equal(identityChange.status, "candidate-invalidated-before-pointer");
  assert.equal(identityChange.pointerCount, 0);
  const coordinateChange = runPointerProbe({
    precondition: {
      expectedIdentity: pointerIdentity,
      samples,
      terminal: pointerSample(2, { hitOwnerMatches: false }),
    },
  }).precondition;
  assert.equal(coordinateChange.status, "coordinate-invalidated-before-pointer");
  assert.equal(coordinateChange.pointerCount, 0);
  const eligibilityChange = runPointerProbe({
    precondition: {
      expectedIdentity: pointerIdentity,
      samples,
      terminal: pointerSample(2, { actionability: { eligible: false, reasons: ["insufficient-energy"] } }),
    },
  }).precondition;
  assert.equal(eligibilityChange.status, "candidate-invalidated-before-pointer");
  assert.equal(eligibilityChange.pointerCount, 0);
});

test("r14 pointer preflight hard-fails unstable, obstructed, off-viewport, same-turn, clock, ordinal, and lifecycle evidence without input", () => {
  const cases = [
    {
      expected: "QA_HARNESS_POINTER_PREFLIGHT_DIVERGENCE",
      input: { expectedIdentity: pointerIdentity, samples: [pointerSample(1), pointerSample(2, { rect: { x: 10.76 } })] },
    },
    {
      expected: "QA_HARNESS_POINTER_PREFLIGHT_DIVERGENCE",
      input: { expectedIdentity: pointerIdentity, samples: [pointerSample(1), pointerSample(2, { hitOwnerMatches: false })] },
    },
    {
      expected: "QA_HARNESS_POINTER_PREFLIGHT_DIVERGENCE",
      input: { expectedIdentity: pointerIdentity, samples: [pointerSample(1), pointerSample(2, { centerInViewport: false, viewportIntersection: false })] },
    },
    {
      expected: "QA_HARNESS_POINTER_PREFLIGHT_DIVERGENCE",
      input: { expectedIdentity: pointerIdentity, samples: [pointerSample(1), pointerSample(2, { schedulerStatus: "observed", hostTurn: { elapsedMs: 0 } })] },
    },
    {
      expected: "QA_HARNESS_POINTER_PREFLIGHT_DIVERGENCE",
      input: { expectedIdentity: pointerIdentity, samples: [pointerSample(1), pointerSample(2, { sampleOrdinal: 1 })] },
    },
    {
      expected: "QA_HARNESS_POINTER_PREFLIGHT_DIVERGENCE",
      input: {
        expectedIdentity: pointerIdentity,
        samples: [pointerSample(1), pointerSample(2, { sampledAtWallTimeMs: 1_040, sampledAtPerformanceMs: 2_040 })],
      },
    },
    {
      expected: "lifecycle-loss",
      input: { expectedIdentity: pointerIdentity, samples: [pointerSample(1), pointerSample(2)], lifecycle: { lost: true, reason: "page-close" } },
    },
  ];
  for (const entry of cases) {
    const result = runPointerProbe({ precondition: entry.input }).precondition;
    assert.equal(result.status, entry.expected);
    assert.equal(result.pointerCount, 0);
  }
});

test("r12 pointer outcome requires the attempt-correlated trusted trio and production acceptance", () => {
  const unrelated = pointerReceipt("pointerdown", {
    attemptId: "another-attempt",
    owner: { nodeId: "deployment-card-9", kind: "medic", slot: "1" },
  });
  const result = runPointerProbe({
    outcome: verifiedOutcomeInput({
      receipts: [unrelated, pointerReceipt("pointerdown"), pointerReceipt("pointerup"), pointerReceipt("click")],
      acceptance: true,
      post: {
        card: actionablePointerCard({ nodeId: "post-handler-node", state: "cooldown", rect: { x: 80 } }),
        beforeRect: { x: 10, y: 20, width: 80, height: 60 },
      },
    }),
  }).outcome;
  assert.deepEqual(result, { status: "accepted", pointerCount: 1, retry: false });
});

test("r12 pointer outcome keeps dispatch, receipt, during-pointer, and no-acceptance failures distinct with no retry", () => {
  const otherIdentity = { nodeId: "deployment-card-2", kind: "medic", slot: "1" };
  const exactOtherOwner = ["pointerdown", "pointerup", "click"].map((type) => pointerReceipt(type, {
    owner: otherIdentity,
    preHandler: { identity: otherIdentity, eligible: true, hitOwner: otherIdentity },
  }));
  const mixedOwner = [
    pointerReceipt("pointerdown"),
    pointerReceipt("pointerup", { owner: otherIdentity }),
    pointerReceipt("click"),
  ];
  const identityMismatch = [
    pointerReceipt("pointerdown"),
    pointerReceipt("pointerup"),
    pointerReceipt("click", { preHandler: { identity: otherIdentity, eligible: true, hitOwner: pointerIdentity } }),
  ];
  const coordinateMismatch = [
    pointerReceipt("pointerdown"),
    pointerReceipt("pointerup"),
    pointerReceipt("click", { preHandler: { identity: pointerIdentity, eligible: true, hitOwner: otherIdentity } }),
  ];
  const nullOwner = ["pointerdown", "pointerup", "click"].map((type) => pointerReceipt(type, { owner: null }));
  const touchSequence = ["pointerdown", "pointerup", "click"].map((type) => pointerReceipt(type, { pointerType: "touch" }));
  const nonMonotonicSequence = [
    pointerReceipt("pointerdown"),
    pointerReceipt("pointerup", { sequence: 1, elapsedMs: 1 }),
    pointerReceipt("click"),
  ];
  const nonMonotonicDispatchElapsed = [
    pointerReceipt("pointerdown"),
    pointerReceipt("pointerup", { elapsedSinceDispatchStartMs: 0.5 }),
    pointerReceipt("click"),
  ];
  const missingRawState = [
    pointerReceipt("pointerdown"),
    pointerReceipt("pointerup"),
    pointerReceipt("click", { preHandler: { card: null } }),
  ];
  const stablePost = {
    card: actionablePointerCard(),
    beforeRect: { x: 10, y: 20, width: 80, height: 60 },
  };
  const rows = [
    ["BROWSER_POINTER_DISPATCH_TIMEOUT", { dispatch: { status: "timeout", elapsedMs: 2_000 } }],
    ["lifecycle-loss", { dispatch: { status: "lifecycle-error", elapsedMs: 12 } }],
    ["BROWSER_POINTER_API_ERROR", { dispatch: { status: "api-error", elapsedMs: 12 } }],
    ["PRODUCT_ACTIONABILITY_SURFACE_DIVERGENCE", { receipts: exactOtherOwner }],
    ["PRODUCT_ACTIONABILITY_SURFACE_DIVERGENCE", { receipts: nullOwner }],
    ["BROWSER_POINTER_RECEIPT_MISSING", { receipts: [pointerReceipt("pointerdown"), pointerReceipt("pointerup")] }],
    ["BROWSER_POINTER_RECEIPT_MISSING", { receipts: [pointerReceipt("pointerdown"), pointerReceipt("pointerup", { isTrusted: false }), pointerReceipt("click")] }],
    ["BROWSER_POINTER_RECEIPT_MISSING", { receipts: mixedOwner, acceptance: true }],
    ["BROWSER_POINTER_RECEIPT_MISSING", { receipts: touchSequence, acceptance: true }],
    ["BROWSER_POINTER_RECEIPT_MISSING", { receipts: nonMonotonicSequence, acceptance: true }],
    ["BROWSER_POINTER_RECEIPT_MISSING", { receipts: nonMonotonicDispatchElapsed, acceptance: true }],
    ["candidate-invalidated-during-pointer", { receipts: identityMismatch }],
    ["candidate-invalidated-during-pointer", { receipts: missingRawState }],
    ["coordinate-invalidated-during-pointer", { receipts: coordinateMismatch }],
    ["PRODUCT_DEPLOYMENT_ACCEPTANCE_MISSING", { acceptance: false, post: stablePost }],
    ["candidate-invalidated-during-pointer", { acceptance: false, post: { candidateMissing: true, card: null } }],
    ["coordinate-invalidated-during-pointer", { acceptance: false, post: { card: actionablePointerCard({ rect: { x: 11 } }), beforeRect: stablePost.beforeRect } }],
    ["lifecycle-loss", { acceptance: false, post: { lifecycleLost: true } }],
  ];
  for (const [expected, overrides] of rows) {
    const result = runPointerProbe({ outcome: verifiedOutcomeInput(overrides) }).outcome;
    assert.equal(result.status, expected);
    assert.equal(result.pointerCount, 1);
    assert.equal(result.retry, false);
  }
});

test("r12 failure cursor preserves the immutable pre-finalization truth against hostile detail keys", () => {
  const snapshot = {
    awaiting: { predicate: "formation-deployment", details: { slot: 2 } },
    lastCompletedCheckpoint: "combat-observer-started",
    unresolvedCheckpoints: ["deployment-attempts-recorded", "frontline-deployment-sequence-completed", "screenshot-saved"],
    checkpoints: [
      { name: "combat-observer-started", status: "completed" },
      { name: "deployment-attempts-recorded", status: "unresolved" },
      { name: "screenshot-saved", status: "unresolved" },
    ],
    lifecycle: [{ event: "attached" }],
  };
  const result = runCheckpointFinalizationProbe({
    snapshot,
    details: {
      label: "hostile-overlay",
      awaitingAtFailure: null,
      lastCompletedBeforeFailure: "screenshot-saved",
      unresolvedBeforeFailure: [],
      preFinalizationCheckpointSnapshot: { corrupted: true },
    },
    secondDetails: { label: "second-finalization-must-not-win" },
    laterAppend: { lifecycle: [{ event: "page-close" }], latestReadableState: { phase: "later" } },
    attemptedOverlay: {
      awaitingAtFailure: null,
      lastCompletedBeforeFailure: "screenshot-saved",
      unresolvedBeforeFailure: [],
    },
  });
  assert.deepEqual(result.payload.failure.preFinalizationCheckpointSnapshot, snapshot);
  assert.deepEqual(result.payload.failure.awaitingAtFailure, snapshot.awaiting);
  assert.equal(result.payload.failure.lastCompletedBeforeFailure, snapshot.lastCompletedCheckpoint);
  assert.deepEqual(result.payload.failure.unresolvedBeforeFailure, snapshot.unresolvedCheckpoints);
  assert.equal(result.payload.failure.preFinalizationCheckpointSnapshot.checkpoints[1].status, "unresolved");
  assert.equal(result.payload.failure.preFinalizationCheckpointSnapshot.checkpoints[2].status, "unresolved");
  assert.deepEqual(result.persisted.postFinalizationAppend.lifecycle, [{ event: "page-close" }]);
  assert.equal(result.audit.nestedDeepFrozen, true);
  assert.equal(result.audit.mutationRejected, true);
  assert.equal(result.audit.mutationUnchanged, true);
  assert.equal(result.audit.firstWriteWins, true);
  assert.equal(result.audit.attemptedOverlayIgnored, true);
});
