import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import path from "node:path";

const repositoryRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
function assertProbeProcessSucceeded(result) {
  const receipt = JSON.stringify({
    error: result.error
      ? {
          name: result.error.name ?? null,
          message: result.error.message ?? String(result.error),
          code: result.error.code ?? null,
          errno: result.error.errno ?? null,
          syscall: result.error.syscall ?? null,
          path: result.error.path ?? null,
          spawnargs: result.error.spawnargs ?? null,
        }
      : null,
    status: result.status ?? null,
    signal: result.signal ?? null,
    stdout: result.stdout ?? null,
    stderr: result.stderr ?? null,
  });
  assert.equal(result.error, undefined, receipt);
  assert.equal(result.status, 0, receipt);
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
  assertProbeProcessSucceeded(result);
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
  assertProbeProcessSucceeded(result);
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
  assertProbeProcessSucceeded(result);
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
  assertProbeProcessSucceeded(result);
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

test("Phase G completed-impact replacement is single-owner, fail-closed, and keeps release strength", async () => {
  const [source, app, proof] = await Promise.all([
    readFile("scripts/v100-phase-g-production-matrix.mjs", "utf8"),
    readFile("app/AshfallGame.tsx", "utf8"),
    readFile("scripts/v100-phase-g-proof-machine.mjs", "utf8"),
  ]);

  for (const variant of ["stage06-spitter-seal", "stage24-panther-commander", "stage25-president"]) {
    assert.match(source, new RegExp('variant: "' + variant + '"[^\\n]*completedImpactProof: true', "u"));
  }
  assert.match(source, /stage24-panther-commander[^\n]*combatProofDurationMs: 4_800/u);
  assert.match(source, /consumerMode: "awaited-direct-read"/u);
  assert.match(source, /requiredCompletedImpactActorKeys/u);
  assert.match(source, /completedAttackImpacts/u);
  assert.match(app, /battleGeneration: g\.battleAudioGeneration/u);
  assert.match(app, /sourceId: f\.id/u);
  assert.match(app, /attackSequence: committedAttackSequence/u);
  assert.match(app, /targetId: target\.id/u);
  assert.match(app, /receiptId: attackObservationBase\.audioReceiptId/u);
  assert.match(app, /ownerId: attackObservationBase\.sourceId/u);
  assert.match(app, /activationId: attackObservationBase\.attackSequence/u);

  for (const obsolete of [
    "__PHASE_G_COMBAT_ACTIVITY__",
    "__PHASE_G_COMBAT_HISTORY_MERGE__",
    "__PHASE_G_PROOF_ACTOR_HUMAN_TARGET_FROM_HISTORY__",
    "phase-g-pre-proof",
    "postQuiescence",
    "exact-actor-lease",
    "actor-kind-successor",
    "releaseAnchor",
    "candidateReservation",
    "__PHASE_G_LAST_COMBAT_SNAPSHOT__",
    "__PHASE_G_READ_COMBAT_SNAPSHOT__",
    "__PHASE_G_COMBAT_OBSERVER__",
  ]) {
    assert.equal(source.includes(obsolete) || proof.includes(obsolete), false, obsolete);
  }

  // Actual coordinator fixtures exercise order, cleanup and both images.
  // Lexical position across helper declarations is not execution order.
  assert.match(proof, /state: "OBSERVING"/u);
  assert.match(proof, /state: "ATTACK_ACCEPTED"/u);
  assert.match(proof, /state: "SCREENSHOT_BOUND"/u);
  assert.match(proof, /state: "COMPLETE"/u);
  assert.match(proof, /state: "FAILED"/u);
  assert.match(source, /metadata\.size > 1000/u);
  assert.match(source, /89504e470d0a1a0a/u);
});

test("WebKit battle-extra keeps one fresh browser process per capture", () => {
  assert.deepEqual(runBrowserLifecycleProbe({ engineName: "webkit", state: "battle-extra" }), {
    engineName: "webkit",
    state: "battle-extra",
    isolation: "fresh-process-per-capture",
    closeExistingBeforeCapture: true,
    closeAfterCapture: true,
    maxCapturesPerBrowser: 1,
  });
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
