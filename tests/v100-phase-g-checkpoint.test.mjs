import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import path from "node:path";

const repositoryRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

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

test("Phase G statically owns all deployment pointers, overlap locks, cursor freeze, and fourteen checkpoints", async () => {
  const [source, appSource, hostTelemetrySource] = await Promise.all([
    readFile(path.join(repositoryRoot, "scripts/v100-phase-g-production-matrix.mjs"), "utf8"),
    readFile(path.join(repositoryRoot, "app/AshfallGame.tsx"), "utf8"),
    readFile(path.join(repositoryRoot, "scripts/webkit-host-resource-telemetry.mjs"), "utf8"),
  ]);
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
  assert.equal((source.match(/window\.__PHASE_G_READ_COMBAT_SNAPSHOT__\(\)/gu) ?? []).length, 2);
  assert.ok((source.match(/window\.__PHASE_G_LAST_COMBAT_SNAPSHOT__/gu) ?? []).length >= 20);
  assert.ok((source.match(/polling: 100/gu) ?? []).length >= 6);
  const causalCollector = source.match(/async function collectCombatCausalProof[\s\S]+?(?=\nasync function capture)/u)?.[0] ?? "";
  assert.match(causalCollector, /window\.__PHASE_G_LAST_COMBAT_SNAPSHOT__/u);
  assert.doesNotMatch(causalCollector, /__PHASE_G_READ_COMBAT_SNAPSHOT__\(\)/u);
  assert.match(causalCollector, /battleTime: snapshot\?\.time \?\? null/u);
  assert.match(causalCollector, /activityReactionHistory: observedCombatActivity\.reactionHistory \?\? \[\]/u);
  assert.match(causalCollector, /reactionHistory: activity\.reactionHistory \?\? \[\]/u);
  assert.match(causalCollector, /await page\.waitForTimeout\(120\)/u);
  assert.match(source, /const combatProofDurationMs = Math\.max\(2_400, Number\(process\.env\.V100_PHASE_G_COMBAT_PROOF_MS\) \|\| 12_000\)/u);
  assert.match(source, /const COMBAT_CAUSAL_CONVERGENCE_MIN_DWELL_MS = 2_400/u);
  assert.match(source, /const COMBAT_CAUSAL_CONVERGENCE_MIN_SAMPLES = 8/u);
  assert.match(source, /combatProofDurationMs: 4_800/u);
  assert.match(causalCollector, /combatCausalConvergenceDecision\([\s\S]*buildCombatCausalProof\(samples\)[\s\S]*if \(convergenceDecision\.accepted\) break/u);
  assert.match(causalCollector, /const proof = buildCombatCausalProof\(samples, stableHistory\)/u);
  assert.match(causalCollector, /v100-phase-g-causal-collection\/v1/u);
  assert.match(causalCollector, /attemptedSampleCount: samples\.length/u);
  assert.match(causalCollector, /validSampleCount: proof\.sampleCount/u);
  assert.match(causalCollector, /causal-contract-satisfied-after-minimum-observation/u);
  assert.match(causalCollector, /duration-budget-exhausted/u);
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
  assert.match(causalProofBuilder, /targetReaction: targetReactionKeys\.size > 0/u);
  assert.doesNotMatch(causalProofBuilder, /channel: "damage-text"/u);
  assert.doesNotMatch(causalProofBuilder, /attackWindup[^\n]*reactionKeys|pendingWeaponHits[^\n]*reactionKeys|audioCueIds[^\n]*reactionKeys/u);
  const captureFailure = source.match(/const \{ failureState, checkpointFailure \} = await runPhaseGTelemetryOperation[\s\S]+?(?=\n    const failure = new Error)/u)?.[0] ?? "";
  assert.match(captureFailure, /window\.__PHASE_G_LAST_COMBAT_SNAPSHOT__/u);
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
  assert.match(captureState, /let combatCausalProof = null;\s*try \{[\s\S]*combatCausalProof = await runPhaseGTelemetryOperation\([\s\S]*collectCombatCausalProof\([\s\S]*\}\s*finally \{[\s\S]*window\.__PHASE_G_COMBAT_OBSERVER__\?\.stop\?\.\(\)/u);
  assert.equal((captureState.match(/window\.__PHASE_G_COMBAT_OBSERVER__\?\.stop\?\.\(\)/gu) ?? []).length, 1);
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
  assert.ok(captureState.indexOf('"phase-g/causal-proof"') < captureState.indexOf('"phase-g/observer-stop"'));
  assert.ok(captureState.indexOf('"phase-g/observer-stop"') < captureState.indexOf('"phase-g/production-screenshot"'));
  assert.ok(captureState.indexOf('"phase-g/production-screenshot"') < captureState.indexOf('"phase-g/overflow-audit"'));
  assert.ok(captureState.indexOf('"phase-g/overflow-audit"') < captureState.indexOf('"phase-g/runtime-readback"'));
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
  assert.equal((checkpointBlock.match(/"[^"]+"/gu) ?? []).length, 14);
  assert.equal((source.match(/const targetOwnershipHistory = \[\.\.\.\(previous\.targetOwnershipHistory \?\? \[\]\)\];/gu) ?? []).length, 2);
  assert.match(source, /function proofActorHumanTargetFromHistory\(history = \[\], expectedKind = null\)/u);
  assert.match(source, /const proofActorHumanTargetFromHistory = \(history = \[\], expectedKind = null\) =>/u);
  assert.match(source, /activityTargetOwnershipHistory: observedCombatActivity\.targetOwnershipHistory \?\? \[\]/u);
  assert.match(source, /targetOwnershipHistory: observedCombatActivity\.targetOwnershipHistory \?\? \[\]/u);
  assert.match(source, /proofActorAttackObserved = true;\s*if \(proofActorRequiresContactFirst\) await readProofActorContactState\(\);/u);
  assert.match(source, /function proofActorTargetContinuityDecision\(\{/u);
  assert.match(source, /hasLiveHumanTarget: liveHumanTarget/u);
  assert.equal((source.match(/contactState\?\.hasLiveHumanTarget === true/gu) ?? []).length, 2);
  assert.equal((source.match(/contactState\?\.hasHumanTarget === true/gu) ?? []).length, 0);
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
