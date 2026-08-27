import assert from "node:assert/strict";
import test from "node:test";

import { createV100PhaseGProofMachine } from "../scripts/v100-phase-g-proof-machine.mjs";

const machine = createV100PhaseGProofMachine({
  runtimeSimulationStepSeconds: 1 / 60,
  runtimeMaxCatchUpSteps: 5,
});

function fighter({
  id,
  side,
  kind,
  hp = 100,
  targetId = null,
  attackSequence = 0,
  attackWindup = 0,
  attackWindupTargetId = null,
  attack = 0,
  flash = 0,
  knock = 0,
  animationState = "idle",
  enemyVfxAttacking = false,
  enemyVfxPhase = "idle",
} = {}) {
  return {
    id,
    side,
    kind,
    hp,
    targetId,
    attackSequence,
    attackWindup,
    attackWindupTargetId,
    attack,
    flash,
    knock,
    animationPresentation: { state: animationState },
    enemyVfx: { attacking: enemyVfxAttacking, phase: enemyVfxPhase },
  };
}

function pendingImpact({
  sourceId,
  targetId,
  attackSequence = null,
  damage = 13,
  impactDelaySeconds = 0.22,
  remainingSeconds = 0.2,
  weapon = "spitter",
  damageMode = "enemy-projectile",
  transactionId = null,
} = {}) {
  return {
    transactionId,
    sourceId,
    targetId,
    attackSequence,
    damage,
    impactDelaySeconds,
    remainingSeconds,
    weapon,
    damageMode,
    eventKind: "impact",
    applyDamage: true,
  };
}

function releaseAnchor({
  actorKey = "zombie:spitter",
  fighterId = 3,
  targetId = 1,
  baselineAttackSequence = 0,
  handoffBattleTime = 39.76666666666569,
  handoffPageTime = 100,
  attackWindupSeconds = 0.07,
} = {}) {
  return {
    actorKey,
    releaseMode: "unconsumed-production-windup",
    fighterId,
    baselineAttackSequence,
    targetId,
    targetSide: "human",
    targetKind: "ranger",
    targetAlive: true,
    attackWindupSeconds,
    lateWindupMaxSeconds: 1 / 12,
    continuitySampleCount: 7,
    continuityFirstWindup: 0.22,
    continuityLastWindup: attackWindupSeconds,
    continuityFirstBattleTime: handoffBattleTime - 0.15,
    continuityLastBattleTime: handoffBattleTime,
    handoffAtBattleTime: handoffBattleTime,
    handoffAtPageTime: handoffPageTime,
    handoffValid: true,
    selectionSnapshotObservedAtPageTime: handoffPageTime,
    selectionSnapshotBattleTime: handoffBattleTime,
    sameTaskSnapshotReadCount: 1,
    cachedObserverSnapshotUsedForHandoff: false,
    releaseReceiptMatchesSelectionSnapshot: true,
  };
}

function actor({
  actorKey = "zombie:spitter",
  side = "zombie",
  kind = "spitter",
  cueId = "enemy-spitter-attack",
  releaseRole = "release-anchor",
  releaseMode = "unconsumed-production-windup",
  selectedFighterId = 3,
  baselineAttackSequence = 0,
  originalTargetId = 1,
  originalTargetSide = "human",
  anchorBattleTime = 39.76666666666569,
  anchorPageTime = 100,
  attackWindupSeconds = 0.07,
} = {}) {
  const activeCandidate = releaseRole === "release-anchor" ? {
    schema: "v100-phase-g-release-candidate/v1",
    ordinal: 1,
    origin: "release-anchor",
    fighterId: selectedFighterId,
    targetId: originalTargetId,
    baselineAttackSequence,
    attackWindupSeconds,
    anchorBattleTime,
    anchorPageTime,
    commitWindowSeconds: machine.releaseAnchorCommitWindowSecondsFor({ attackWindupSeconds }),
    continuity: [
      { battleTime: anchorBattleTime - 0.15, pageTime: null, windup: 0.22 },
      { battleTime: anchorBattleTime, pageTime: anchorPageTime, windup: attackWindupSeconds },
    ],
  } : null;
  return {
    actorKey,
    side,
    kind,
    cueId,
    releaseRole,
    releaseMode,
    selectedFighterId,
    baselineAttackSequence,
    originalTargetId: releaseRole === "release-anchor" ? originalTargetId : null,
    originalTargetSide: releaseRole === "release-anchor" ? originalTargetSide : null,
    releaseTargetDiagnostic: null,
    state: releaseRole === "release-anchor" ? "TRACKING_CANDIDATE" : "WAITING_SEQUENCE",
    candidateOrdinal: releaseRole === "release-anchor" ? 1 : 0,
    activeCandidate,
    successorContinuity: [],
    candidateHistory: activeCandidate ? [{ schema: "v100-phase-g-candidate-event/v1", event: "CREATED", candidate: activeCandidate }] : [],
    actorTransitionLog: [],
    sourceCommitReceipt: null,
    contactReceipt: null,
    audioReceipt: null,
    witness: null,
  };
}

function epoch({
  actors = [actor()],
  anchor = releaseAnchor(),
  visibleProofStartedAt = 100,
  visibleProofDurationMs = 12_000,
} = {}) {
  return machine.installEpoch({
    schema: "v100-phase-g-post-quiescence-proof/v7",
    state: "OBSERVING",
    stageId: "stage-nishijin-station-tunnel-seal",
    armedAtBattleTime: anchor.handoffAtBattleTime,
    visibleProofStartedAt,
    visibleProofDeadlineAt: visibleProofStartedAt + visibleProofDurationMs,
    visibleProofDurationMs,
    audioCueRequestCutoffAt: visibleProofStartedAt,
    audioCueRequestBaselineCount: 0,
    excludedQuiescedAttackObserved: true,
    releaseAnchor: anchor,
    preReleaseReadiness: null,
    actors,
    acceptedWitnesses: [],
    genericEvidence: {
      schema: "v100-phase-g-generic-causal-evidence/v1",
      source: false,
      travelOrContact: false,
      targetReaction: false,
      audio: false,
      allRequirementsGreen: false,
    },
    transitionLog: [{ schema: "v100-phase-g-proof-transition/v1", from: null, to: "OBSERVING", reason: "ATOMIC_SAME_TASK_RELEASE", atPageTime: visibleProofStartedAt }],
    proofCompletedAtPageTime: null,
    screenshotReceipt: null,
    cleanupReceipt: null,
    terminalFailure: null,
    currentActorStates: {},
  });
}

function snapshot(time, fighters, pendingWeaponHits = []) {
  return {
    schema: "v100-phase-g-combat-snapshot/v1",
    screen: "battle",
    stageId: "stage-nishijin-station-tunnel-seal",
    time,
    fighters,
    attackIdentity: [],
    pendingWeaponHits,
  };
}

test("replays the r103 Stage 6 spitter projectile as commit, pending impact, then exact witness", () => {
  let proof = epoch();
  proof = machine.advanceEpoch(proof, {
    pageNow: 220,
    audioRequests: [{ cueId: "enemy-spitter-attack", at: 210 }],
    snapshot: snapshot(39.86666666666569, [
      fighter({ id: 3, side: "zombie", kind: "spitter", hp: 78, targetId: 1, attackSequence: 1, attack: 0.18, enemyVfxPhase: "attack" }),
      fighter({ id: 1, side: "human", kind: "ranger", hp: 70 }),
    ], [pendingImpact({ sourceId: 3, targetId: 1 })]),
  });
  assert.equal(proof.state, "OBSERVING");
  assert.equal(proof.terminalFailure, null);
  assert.equal(proof.actors[0].state, "IMPACT_PENDING");
  assert.equal(proof.actors[0].sourceCommitReceipt.transportReceipt.sourceTargetEdge, "3->1");

  proof = machine.advanceEpoch(proof, {
    pageNow: 437,
    audioRequests: [{ cueId: "enemy-spitter-attack", at: 210 }],
    snapshot: snapshot(40.08333333333234, [
      fighter({ id: 3, side: "zombie", kind: "spitter", hp: 78, targetId: 1, attackSequence: 1 }),
      fighter({ id: 1, side: "human", kind: "ranger", hp: 57, flash: 0.10333333333333333, knock: 2.7, animationState: "hit-light" }),
    ]),
  });
  assert.equal(proof.state, "WITNESS_ACCEPTED");
  assert.equal(proof.acceptedWitnesses[0].contactReceipt.causalMode, "pending-impact");
  assert.equal(proof.acceptedWitnesses[0].contactReceipt.targetHpBefore, 70);
  assert.equal(proof.acceptedWitnesses[0].contactReceipt.targetHpAtContact, 57);
  assert.equal(machine.postQuiescenceExactActorDecision(proof, { requiredActorKeys: ["zombie:spitter"] }).accepted, true);
  assert.equal(machine.exactActorDirectContactCausalDecision(proof, { requiredActorKeys: ["zombie:spitter"] }).actors[0].accepted, true);
  const missingTransportTime = structuredClone(proof);
  missingTransportTime.acceptedWitnesses[0].contactReceipt.transportReceipt.observedAtBattleTime = null;
  assert.equal(machine.postQuiescenceExactActorDecision(missingTransportTime, { requiredActorKeys: ["zombie:spitter"] }).accepted, false);
  const wrongTransportSequence = structuredClone(proof);
  wrongTransportSequence.acceptedWitnesses[0].contactReceipt.transportReceipt.attackSequence = 99;
  assert.equal(machine.postQuiescenceExactActorDecision(wrongTransportSequence, { requiredActorKeys: ["zombie:spitter"] }).accepted, false);
});

test("keeps an in-flight exact impact valid after the committed source leaves the snapshot", () => {
  let proof = machine.advanceEpoch(epoch(), {
    pageNow: 220,
    audioRequests: [{ cueId: "enemy-spitter-attack", at: 210 }],
    snapshot: snapshot(39.86666666666569, [
      fighter({ id: 3, side: "zombie", kind: "spitter", hp: 78, targetId: 1, attackSequence: 1, attack: 0.18, enemyVfxPhase: "attack" }),
      fighter({ id: 1, side: "human", kind: "ranger", hp: 70 }),
    ], [pendingImpact({ sourceId: 3, targetId: 1 })]),
  });
  proof = machine.advanceEpoch(proof, {
    pageNow: 437,
    audioRequests: [{ cueId: "enemy-spitter-attack", at: 210 }],
    snapshot: snapshot(40.08333333333234, [
      fighter({ id: 1, side: "human", kind: "ranger", hp: 57, flash: 0.1, knock: 2.7, animationState: "hit-light" }),
    ]),
  });
  assert.equal(proof.state, "WITNESS_ACCEPTED");
  assert.equal(proof.currentActorStates["zombie:spitter"].alive, false);
});

test("keeps the strict Stage 24 same-snapshot direct-contact path", () => {
  const commanderActor = actor({
    actorKey: "zombie:red-panther-commander",
    kind: "red-panther-commander",
    cueId: "enemy-red-panther-commander-attack",
    selectedFighterId: 4,
    originalTargetId: 2,
    anchorBattleTime: 19.6,
  });
  let proof = epoch({
    actors: [commanderActor],
    anchor: releaseAnchor({
      actorKey: "zombie:red-panther-commander",
      fighterId: 4,
      targetId: 2,
      handoffBattleTime: 19.6,
    }),
  });
  proof = machine.advanceEpoch(proof, {
    pageNow: 216,
    audioRequests: [{ cueId: "enemy-red-panther-commander-attack", at: 205 }],
    snapshot: snapshot(19.71666666666683, [
      fighter({ id: 4, side: "zombie", kind: "red-panther-commander", targetId: 2, attackSequence: 1, attack: 0.14666666666666667, enemyVfxPhase: "attack" }),
      fighter({ id: 2, side: "human", kind: "medic", hp: 90, flash: 0.08666666666666667, knock: 2.43, animationState: "hit-light" }),
    ]),
  });
  assert.equal(proof.state, "WITNESS_ACCEPTED");
  const receipt = proof.acceptedWitnesses[0].contactReceipt;
  assert.equal(receipt.causalMode, "same-snapshot-direct");
  assert.equal(receipt.transportReceipt, null);
  assert.equal(receipt.sourceObservedAtPageTime, receipt.observedAtPageTime);
});

test("accepts an exact supporting ranger only through its own pending impact", () => {
  const commanderActor = actor({
    actorKey: "zombie:red-panther-commander",
    kind: "red-panther-commander",
    cueId: "enemy-red-panther-commander-attack",
    selectedFighterId: 4,
    originalTargetId: 2,
    anchorBattleTime: 19.6,
  });
  const rangerActor = actor({
    actorKey: "human:ranger",
    side: "human",
    kind: "ranger",
    cueId: "weapon-rifle",
    releaseRole: "supporting-prerequisite",
    releaseMode: "completed-hidden-attack",
    selectedFighterId: 1,
    baselineAttackSequence: 3,
  });
  let proof = epoch({
    actors: [commanderActor, rangerActor],
    anchor: releaseAnchor({
      actorKey: "zombie:red-panther-commander",
      fighterId: 4,
      targetId: 2,
      handoffBattleTime: 19.6,
    }),
  });
  proof = machine.advanceEpoch(proof, {
    pageNow: 216,
    audioRequests: [
      { cueId: "enemy-red-panther-commander-attack", at: 205 },
      { cueId: "weapon-rifle", at: 212 },
    ],
    snapshot: snapshot(19.71666666666683, [
      fighter({ id: 4, side: "zombie", kind: "red-panther-commander", targetId: 2, attackSequence: 1, attack: 0.15, enemyVfxPhase: "attack" }),
      fighter({ id: 2, side: "human", kind: "medic", hp: 90, flash: 0.08, knock: 2.4, animationState: "hit-light" }),
      fighter({ id: 1, side: "human", kind: "ranger", targetId: 8, attackSequence: 4, attack: 0.1, animationState: "attack" }),
      fighter({ id: 8, side: "zombie", kind: "turned", hp: 84 }),
    ], [pendingImpact({ sourceId: 1, targetId: 8, attackSequence: 4, damage: 23, impactDelaySeconds: 0.12, remainingSeconds: 0.12, weapon: "ranger", damageMode: "direct", transactionId: "1:3:fighter:8:0" })]),
  });
  assert.equal(proof.state, "OBSERVING");
  assert.equal(proof.actors[0].state, "WITNESS_ACCEPTED");
  assert.equal(proof.actors[1].state, "IMPACT_PENDING");
  proof = machine.advanceEpoch(proof, {
    pageNow: 350,
    audioRequests: [
      { cueId: "enemy-red-panther-commander-attack", at: 205 },
      { cueId: "weapon-rifle", at: 212 },
    ],
    snapshot: snapshot(19.85, [
      fighter({ id: 4, side: "zombie", kind: "red-panther-commander", targetId: 2, attackSequence: 1 }),
      fighter({ id: 2, side: "human", kind: "medic", hp: 90 }),
      fighter({ id: 1, side: "human", kind: "ranger", targetId: 8, attackSequence: 4 }),
      fighter({ id: 8, side: "zombie", kind: "turned", hp: 61, flash: 0.1, knock: 2.5, animationState: "hit-light" }),
    ]),
  });
  assert.equal(proof.state, "WITNESS_ACCEPTED");
  assert.deepEqual(proof.acceptedWitnesses.map((entry) => entry.actorKey), ["zombie:red-panther-commander", "human:ranger"]);
});

test("fails closed when sequence commits without direct reaction or exact transport", () => {
  const proof = machine.advanceEpoch(epoch(), {
    pageNow: 220,
    audioRequests: [{ cueId: "enemy-spitter-attack", at: 210 }],
    snapshot: snapshot(39.86666666666569, [
      fighter({ id: 3, side: "zombie", kind: "spitter", hp: 78, targetId: 1, attackSequence: 1, attack: 0.18, enemyVfxPhase: "attack" }),
      fighter({ id: 1, side: "human", kind: "ranger", hp: 70 }),
    ]),
  });
  assert.equal(proof.state, "FAILED");
  assert.equal(proof.terminalFailure.code, "EXACT_CAUSAL_TRANSPORT_OR_DIRECT_REACTION_MISSING");
});

test("does not accept stale reaction or unchanged target HP during pending impact", () => {
  let proof = machine.advanceEpoch(epoch(), {
    pageNow: 220,
    audioRequests: [{ cueId: "enemy-spitter-attack", at: 210 }],
    snapshot: snapshot(39.86666666666569, [
      fighter({ id: 3, side: "zombie", kind: "spitter", hp: 78, targetId: 1, attackSequence: 1, attack: 0.18, enemyVfxPhase: "attack" }),
      fighter({ id: 1, side: "human", kind: "ranger", hp: 70, flash: 0.1, knock: 2.5, animationState: "hit-light" }),
    ], [pendingImpact({ sourceId: 3, targetId: 1 })]),
  });
  proof = machine.advanceEpoch(proof, {
    pageNow: 437,
    audioRequests: [{ cueId: "enemy-spitter-attack", at: 210 }],
    snapshot: snapshot(40.08333333333234, [
      fighter({ id: 3, side: "zombie", kind: "spitter", hp: 78, targetId: 1, attackSequence: 1 }),
      fighter({ id: 1, side: "human", kind: "ranger", hp: 70, flash: 0.05, knock: 1.9, animationState: "hit-light" }),
    ]),
  });
  assert.equal(proof.state, "OBSERVING");
  assert.equal(proof.actors[0].state, "IMPACT_PENDING");
  assert.equal(proof.acceptedWitnesses.length, 0);
});

test("fails pending impact when the exact source advances a second sequence", () => {
  let proof = machine.advanceEpoch(epoch(), {
    pageNow: 220,
    audioRequests: [{ cueId: "enemy-spitter-attack", at: 210 }],
    snapshot: snapshot(39.86666666666569, [
      fighter({ id: 3, side: "zombie", kind: "spitter", hp: 78, targetId: 1, attackSequence: 1, attack: 0.18, enemyVfxPhase: "attack" }),
      fighter({ id: 1, side: "human", kind: "ranger", hp: 70 }),
    ], [pendingImpact({ sourceId: 3, targetId: 1 })]),
  });
  proof = machine.advanceEpoch(proof, {
    pageNow: 437,
    audioRequests: [{ cueId: "enemy-spitter-attack", at: 210 }],
    snapshot: snapshot(40.08333333333234, [
      fighter({ id: 3, side: "zombie", kind: "spitter", hp: 78, targetId: 1, attackSequence: 2 }),
      fighter({ id: 1, side: "human", kind: "ranger", hp: 57, flash: 0.1, knock: 2.7, animationState: "hit-light" }),
    ]),
  });
  assert.equal(proof.state, "FAILED");
  assert.equal(proof.terminalFailure.code, "EXACT_SOURCE_SECOND_SEQUENCE_BEFORE_WITNESS");
});

test("keeps contact pending until the exact post-cutoff cue arrives", () => {
  let proof = epoch();
  proof = machine.advanceEpoch(proof, {
    pageNow: 216,
    audioRequests: [],
    snapshot: snapshot(39.86666666666569, [
      fighter({ id: 3, side: "zombie", kind: "spitter", hp: 78, targetId: 1, attackSequence: 1, attack: 0.18, enemyVfxPhase: "attack" }),
      fighter({ id: 1, side: "human", kind: "ranger", hp: 57, flash: 0.1, knock: 2.7, animationState: "hit-light" }),
    ]),
  });
  assert.equal(proof.actors[0].state, "CONTACT_ACCEPTED");
  proof = machine.advanceEpoch(proof, {
    pageNow: 300,
    audioRequests: [{ cueId: "enemy-spitter-attack", at: 310 }],
    snapshot: snapshot(39.95, [
      fighter({ id: 3, side: "zombie", kind: "spitter", hp: 78, targetId: 1, attackSequence: 1 }),
      fighter({ id: 1, side: "human", kind: "ranger", hp: 57 }),
    ]),
  });
  assert.equal(proof.state, "OBSERVING");
  assert.equal(proof.actors[0].state, "CONTACT_ACCEPTED");
  proof = machine.advanceEpoch(proof, {
    pageNow: 320,
    audioRequests: [{ cueId: "enemy-spitter-attack", at: 310 }],
    snapshot: snapshot(39.97, [
      fighter({ id: 3, side: "zombie", kind: "spitter", hp: 78, targetId: 1, attackSequence: 1 }),
      fighter({ id: 1, side: "human", kind: "ranger", hp: 57 }),
    ]),
  });
  assert.equal(proof.state, "WITNESS_ACCEPTED");
});

test("rejects a second source sequence while exact contact waits for its cue", () => {
  let proof = machine.advanceEpoch(epoch(), {
    pageNow: 216,
    audioRequests: [],
    snapshot: snapshot(39.86666666666569, [
      fighter({ id: 3, side: "zombie", kind: "spitter", hp: 78, targetId: 1, attackSequence: 1, attack: 0.18, enemyVfxPhase: "attack" }),
      fighter({ id: 1, side: "human", kind: "ranger", hp: 57, flash: 0.1, knock: 2.7, animationState: "hit-light" }),
    ]),
  });
  assert.equal(proof.actors[0].state, "CONTACT_ACCEPTED");
  proof = machine.advanceEpoch(proof, {
    pageNow: 320,
    audioRequests: [{ cueId: "enemy-spitter-attack", at: 310 }],
    snapshot: snapshot(39.97, [
      fighter({ id: 3, side: "zombie", kind: "spitter", hp: 78, targetId: 1, attackSequence: 2 }),
      fighter({ id: 1, side: "human", kind: "ranger", hp: 57 }),
    ]),
  });
  assert.equal(proof.state, "FAILED");
  assert.equal(proof.terminalFailure.code, "EXACT_SOURCE_SECOND_SEQUENCE_BEFORE_WITNESS");
});

test("preserves screenshot then cleanup ordering and immutable accepted witness", () => {
  let proof = epoch();
  proof = machine.advanceEpoch(proof, {
    pageNow: 216,
    audioRequests: [{ cueId: "enemy-spitter-attack", at: 205 }],
    snapshot: snapshot(39.86666666666569, [
      fighter({ id: 3, side: "zombie", kind: "spitter", hp: 78, targetId: 1, attackSequence: 1, attack: 0.18, enemyVfxPhase: "attack" }),
      fighter({ id: 1, side: "human", kind: "ranger", hp: 57, flash: 0.1, knock: 2.7, animationState: "hit-light" }),
    ]),
  });
  const witness = proof.acceptedWitnesses[0];
  assert.equal(Object.isFrozen(witness), true);
  assert.throws(() => { witness.targetId = 999; }, TypeError);
  proof = machine.attachScreenshotReceipt(proof, {
    pageNow: 300,
    screenshot: { path: "production.png", bytes: 1, sha256: "a" },
    releaseDeadlineReceipt: {
      schema: "v100-phase-g-release-deadline-receipt/v1",
      pageNow: 299,
      visibleProofStartedAt: proof.visibleProofStartedAt,
      visibleProofDeadlineAt: proof.visibleProofDeadlineAt,
      withinReleaseDeadline: true,
    },
  });
  assert.equal(proof.state, "SCREENSHOT_RECEIPT_ACCEPTED");
  proof = machine.cleanEpoch(proof, { reason: "OBSERVER_STOP_FINALLY_CLEANUP", pageNow: 301 });
  assert.equal(proof.state, "CLEANED");
  assert.deepEqual(proof.transitionLog.map((entry) => entry.to), ["OBSERVING", "WITNESS_ACCEPTED", "SCREENSHOT_RECEIPT_ACCEPTED", "CLEANED"]);
});

test("rejects v6 and invalid numeric-domain epochs at the v7 install boundary", () => {
  const valid = structuredClone(epoch());
  valid.schema = "v100-phase-g-post-quiescence-proof/v6";
  assert.throws(() => machine.installEpoch(valid), /V7_EPOCH_INSTALL/u);
  const invalid = structuredClone(epoch());
  invalid.visibleProofStartedAt = "100";
  assert.throws(() => machine.installEpoch(invalid), /V7_EPOCH_INSTALL/u);
});

test("fails the original fixed deadline without rearm or retry", () => {
  const proof = machine.advanceEpoch(epoch(), {
    pageNow: 12_101,
    audioRequests: [],
    snapshot: snapshot(39.9, [
      fighter({ id: 3, side: "zombie", kind: "spitter", hp: 78, targetId: 1, attackSequence: 0, attackWindup: 0.05, attackWindupTargetId: 1 }),
      fighter({ id: 1, side: "human", kind: "ranger", hp: 70 }),
    ]),
  });
  assert.equal(proof.state, "FAILED");
  assert.equal(proof.terminalFailure.code, "VISIBLE_PROOF_DEADLINE_EXPIRED");
  assert.equal(proof.visibleProofStartedAt, 100);
  assert.equal(proof.visibleProofDeadlineAt, 12_100);
});

test("runs byte-identical reducer source in Node and the serialized page factory", () => {
  const pageFactory = (0, eval)(`(${createV100PhaseGProofMachine.toString()})`);
  const pageMachine = pageFactory({
    runtimeSimulationStepSeconds: 1 / 60,
    runtimeMaxCatchUpSteps: 5,
  });
  let nodeProof = epoch();
  let pageProof = pageMachine.installEpoch(structuredClone(nodeProof));
  const commitInput = {
    pageNow: 220,
    audioRequests: [{ cueId: "enemy-spitter-attack", at: 210 }],
    snapshot: snapshot(39.86666666666569, [
      fighter({ id: 3, side: "zombie", kind: "spitter", hp: 78, targetId: 1, attackSequence: 1, attack: 0.18, enemyVfxPhase: "attack" }),
      fighter({ id: 1, side: "human", kind: "ranger", hp: 70 }),
    ], [pendingImpact({ sourceId: 3, targetId: 1 })]),
  };
  nodeProof = machine.advanceEpoch(nodeProof, commitInput);
  pageProof = pageMachine.advanceEpoch(pageProof, structuredClone(commitInput));
  assert.deepEqual(pageProof, nodeProof);
  const contactInput = {
    pageNow: 437,
    audioRequests: [{ cueId: "enemy-spitter-attack", at: 210 }],
    snapshot: snapshot(40.08333333333234, [
      fighter({ id: 3, side: "zombie", kind: "spitter", hp: 78, targetId: 1, attackSequence: 1 }),
      fighter({ id: 1, side: "human", kind: "ranger", hp: 57, flash: 0.10333333333333333, knock: 2.7, animationState: "hit-light" }),
    ]),
  };
  nodeProof = machine.advanceEpoch(nodeProof, contactInput);
  pageProof = pageMachine.advanceEpoch(pageProof, structuredClone(contactInput));
  assert.deepEqual(pageProof, nodeProof);
  assert.equal(pageProof.state, "WITNESS_ACCEPTED");
});
