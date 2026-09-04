import assert from "node:assert/strict";
import test from "node:test";
import { deriveV100RuntimeObservation, setupActorObservation, setupVehicleActionObserved, babayagaMarkerInputReady, validateV100ProofImageLink, manualMarkerActivation, V100_MANUAL_MARKER_CLICK_TIMEOUT_MS, validateV100CaptureRepresentativeEvidence } from "../scripts/v100-phase-g-runtime-evidence.mjs";
import { createManualAbilityRuntime, beginManualAbility, selectBabayagaAbilityTarget } from "../app/manualAbilities.js";
import { createV100PhaseGProofMachine } from "../scripts/v100-phase-g-proof-machine.mjs";
import { V100_REPRESENTATIVE_COMBAT_CONTRACT, representativeRuntimeObservationRule, validateV100RepresentativeCombatEvidence } from "../app/v100PhaseGContract.js";

function receipt(kind, side = "zombie", overrides = {}) {
  return {
    schema: "v100-completed-attack-impact/v1", battleGeneration: 2,
    sourceId: 3, sourceSide: side, sourceKind: kind, attackSequence: 1,
    targetId: 1, targetSide: side === "zombie" ? "human" : "zombie", targetKind: "fixture-target",
    impactOrdinal: 0, mode: "direct", committedAtBattleTime: 30, contactAtBattleTime: 30.2,
    reactionOutcome: "hit", audioCueId: "fixture-attack", audioReceiptId: "combat-attack:2:3:1",
    audioRequestObserved: true, ...overrides,
  };
}

const runtime = (values = {}) => ({ screen: "battle", battleGeneration: 2, fighters: [], completedAttackImpacts: [], ...values });

function imageCollection() {
  const machine = createV100PhaseGProofMachine();
  const snapshot = { ...runtime(), schema: "v100-phase-g-combat-snapshot/v1", completedAttackImpacts: [receipt("spitter")] };
  const accepted = machine.observe(machine.createProof({ battleGeneration: 2, requiredActorKeys: ["zombie:spitter"],
    startedAtPageTime: 1000, startedAtBattleTime: 30, deadlineAtPageTime: 13000 }), { snapshot, pageNow: 1100 });
  const bound = machine.attachScreenshot(accepted, { pageNow: 1200, screenshot: { path: "case-action.png", bytes: 2000, sha256: "a".repeat(64) } });
  return { ok: true, collection: { converged: true, withinReleaseDeadline: true },
    screenshot: { path: "case-action.png", bytes: 2000, sha256: "a".repeat(64), releaseDeadlineReceipt: {
      pageNow: 1200, visibleProofStartedAt: 1000, visibleProofDeadlineAt: 13000, withinReleaseDeadline: true,
    } },
    completedImpactProof: structuredClone(machine.complete(bound, { pageNow: 1201, observerStopped: true })) };
}

test("exact action image is bound to its complete atomic receipt and original clock", () => {
  const sample = imageCollection();
  assert.deepEqual(validateV100ProofImageLink(sample, runtime()), { ok: true, errors: [] });
});

for (const [name, mutate] of [
  ["foreign battle", (p) => { p.battleGeneration = 3; }],
  ["different attack", (p) => { p.screenshot.acceptedImpactKeys["zombie:spitter"] = "2:3:2:1:0"; }],
  ["different target", (p) => { p.receiptsByActor["zombie:spitter"].targetId = 9; }],
  ["mixed audio", (p) => { p.receiptsByActor["zombie:spitter"].audioReceiptId = "combat-attack:2:8:1"; }],
  ["late screenshot", (p) => { p.screenshot.capturedAtPageTime = 13001; }],
  ["pre-acceptance screenshot", (p) => { p.screenshot.capturedAtPageTime = 1099; }],
  ["missing cleanup", (p) => { p.cleanupReceipt.observerStopped = false; }],
  ["unfinished proof", (p) => { p.state = "ATTACK_ACCEPTED"; }],
]) test("action image validator rejects " + name, () => {
  const sample = imageCollection();
  mutate(sample.completedImpactProof);
  assert.equal(validateV100ProofImageLink(sample, runtime()).ok, false);
});
function validate(contract, sample) {
  return validateV100RepresentativeCombatEvidence({
    contract, evidence: contract,
    runtimeEvidence: { id: contract.id, captureVariant: contract.captureVariant,
      observedRuntimeProof: deriveV100RuntimeObservation(sample) },
  });
}

test("capture acceptance delegates all sixteen rows to the unchanged canonical validator", () => {
  const variants = [...new Set(V100_REPRESENTATIVE_COMBAT_CONTRACT.map((c) => c.captureVariant))];
  let total = 0;
  for (const variant of variants) {
    const contracts = V100_REPRESENTATIVE_COMBAT_CONTRACT.filter((c) => c.captureVariant === variant);
    const actors = contracts.map(representativeRuntimeObservationRule).filter((r) => r.kind === "fighter");
    const sample = runtime({ stageId: "stage-nishijin-station-gate", observedAtPageTime: 1000,
      completedAttackImpacts: actors.map((r) => receipt(r.expected, r.expectedSide)),
      audioCueRequests: [{ cueId: "support-heal" }], crawlerAbility: { abilityId: "vehicle-barrage", phase: "firing" },
      stageMission: { missionType: "" }, fighters: [{ side: "zombie", kind: "walker", marked: 1 }] });
    const mission = contracts.map(representativeRuntimeObservationRule).find((r) => r.kind === "mission");
    if (mission) sample.stageMission.missionType = mission.expectedMissionType;
    const valid = validateV100CaptureRepresentativeEvidence({ variant, runtime: sample });
    assert.equal(valid.ok, true, valid.errors.join(", ")); total += valid.rows;
    assert.equal(validateV100CaptureRepresentativeEvidence({ variant, runtime: runtime() }).ok, false);
  }
  assert.equal(total, 16);
  assert.equal(validateV100CaptureRepresentativeEvidence({ variant: "typo", runtime: runtime() }).ok, false);
  assert.equal(validateV100CaptureRepresentativeEvidence({ variant: "core-battle-normal", runtime: runtime() }).rows, 0);
});

test("actual Stage25 warning-only return fails while its committed control and retained winning frame pass", () => {
  const kind = "mugarian-president-mutated";
  const boss = { id: 25, side: "zombie", kind, hp: 6200, attackSequence: 0,
    attack: 0, attackWindup: 0, abilityWindup: 0, stationAbility: { phase: "warning", remainingSeconds: .45 } };
  const sample = runtime({ stageId: "stage", observedAtPageTime: 88485, fighters: [boss],
    completedAttackImpacts: [receipt("red-panther-shield")] });
  const check = (value, setupObservations) => validateV100CaptureRepresentativeEvidence({ variant: "stage25-president", runtime: value, setupObservations });
  assert.equal(check(sample).ok, false);
  const committed = { ...sample, observedAtPageTime: 98711, fighters: [{ ...boss, attackSequence: 1 }] };
  assert.equal(check(committed).ok, true);
  const later = { ...sample, observedAtPageTime: 99000 };
  assert.equal(check(later, { boss: committed }).ok, true);
  assert.throws(() => check(later, { boss: { ...committed, battleGeneration: 3 } }), /SETUP_CAPTURE_MISMATCH/u);
});

test("all sixteen unchanged representative rows require their actual runtime action", () => {
  for (const contract of V100_REPRESENTATIVE_COMBAT_CONTRACT) {
    const rule = representativeRuntimeObservationRule(contract);
    let sample;
    if (rule.kind === "fighter") sample = runtime({ completedAttackImpacts: [receipt(rule.expected, rule.expectedSide)] });
    if (rule.kind === "support") sample = runtime({ audioCueRequests: [{ cueId: "support-heal" }] });
    if (rule.kind === "vehicle") sample = runtime({ crawlerAbility: { abilityId: "vehicle-barrage", phase: "firing" } });
    if (rule.kind === "mission") sample = runtime({ stageId: rule.expectedStageId, stageMission: { missionType: rule.expectedMissionType } });
    if (rule.kind === "status") sample = runtime({ fighters: [{ side: "zombie", kind: "red-panther-knife", marked: 2 }] });
    assert.equal(validate(contract, sample).ok, true, contract.id);
    assert.equal(validate(contract, runtime()).ok, false, `empty runtime must not satisfy ${contract.id}`);
  }
});

test("a present idle actor or another actor's impact is not the required attack", () => {
  const contract = V100_REPRESENTATIVE_COMBAT_CONTRACT.find((c) => c.actor === "red-panther-shield");
  assert.equal(validate(contract, runtime({ fighters: [{ side: "zombie", kind: "red-panther-shield", attackSequence: 0 }] })).ok, false);
  assert.equal(validate(contract, runtime({ completedAttackImpacts: [receipt("red-panther-smg")] })).ok, false);
  assert.equal(validate(contract, runtime({ completedAttackImpacts: [receipt("red-panther-shield", "human")] })).ok, false);
});

test("stale generations and incomplete or mixed receipt data cannot create observed coverage", () => {
  const contract = V100_REPRESENTATIVE_COMBAT_CONTRACT.find((c) => c.actor === "red-panther-shield");
  assert.equal(validate(contract, runtime({ completedAttackImpacts: [receipt("red-panther-shield", "zombie", { battleGeneration: 1 })] })).ok, false);
  for (const invalid of [{ targetId: null }, { reactionOutcome: null }, { audioReceiptId: "combat-attack:2:9:1" }, { audioRequestObserved: false }]) {
    assert.throws(() => deriveV100RuntimeObservation(runtime({ completedAttackImpacts: [receipt("red-panther-shield", "zombie", invalid)] })), /REPRESENTATIVE_COMPLETED_RECEIPT_INVALID/u);
  }
  assert.throws(() => deriveV100RuntimeObservation({ screen: "battle" }), /GENERATION_MISSING/u);
  assert.throws(() => deriveV100RuntimeObservation(runtime({ screen: "result" })), /GENERATION_MISSING/u);
});

test("support, vehicle, mission and marker labels alone cannot fabricate their action", () => {
  const vehicle = V100_REPRESENTATIVE_COMBAT_CONTRACT.find((c) => c.actor === "vehicle-barrage");
  assert.equal(validate(vehicle, runtime({ crawlerAbility: { abilityId: "vehicle-barrage", phase: "idle" } })).ok, false);
  const mission = V100_REPRESENTATIVE_COMBAT_CONTRACT.find((c) => c.actor === "stage-nishijin-station-gate");
  assert.equal(validate(mission, runtime({ stageId: "wrong-stage", stageMission: { missionType: "boss-assault" } })).ok, false);
  const status = V100_REPRESENTATIVE_COMBAT_CONTRACT.find((c) => c.actor === "status-mission-target");
  assert.equal(validate(status, runtime({ fighters: [{ side: "human", kind: "babayaga", marked: 0 }] })).ok, false);
});

test("coverage projection is read-only and does not return an alternate causal proof", () => {
  const sample = runtime({ completedAttackImpacts: [receipt("red-panther-shield")] });
  const before = JSON.stringify(sample);
  const observation = deriveV100RuntimeObservation(sample);
  assert.equal(JSON.stringify(sample), before);
  assert.equal(observation.ok, undefined);
  assert.equal(observation.state, undefined);
  assert.equal(observation.sourceToTargetEdges, undefined);
});

test("shared setup actor reader preserves source and side and cannot accept an unrelated or stale receipt", () => {
  const sample = runtime({ completedAttackImpacts: [receipt("brute", "human")] });
  assert.deepEqual(setupActorObservation(sample, "human", "brute", null), { mounted: false, observed: true });
  assert.equal(setupActorObservation(sample, "zombie", "brute", null).observed, false);
  assert.equal(setupActorObservation(sample, "human", "ranger", null).observed, false);
  assert.equal(setupActorObservation(runtime({ completedAttackImpacts: [receipt("brute", "human", { battleGeneration: 1 })] }), "human", "brute", null).observed, false);
  assert.equal(setupActorObservation(runtime({ fighters: [{ side: "human", kind: "brute", hp: 10, attackSequence: 1 }] }), "human", "brute", null).observed, true);
  assert.equal(setupActorObservation(runtime({ fighters: [{ side: "human", kind: "brute", hp: 10, attackSequence: 0 }] }), "human", "brute", null).observed, false);
});

test("completed vehicle evidence survives natural expiry without a second activation or fabricated idle evidence", () => {
  const first = runtime({ stageId: "stage3", observedAtPageTime: 30000,
    crawlerAbility: { abilityId: "vehicle-barrage", phase: "firing" } });
  const final = runtime({ stageId: "stage3", observedAtPageTime: 81000,
    crawlerAbility: { abilityId: "vehicle-barrage", phase: "idle" } });
  assert.equal(setupVehicleActionObserved(first), true);
  assert.equal(setupVehicleActionObserved(final), false);
  assert.equal(setupVehicleActionObserved(runtime({ crawlerAbility: { abilityId: "other", phase: "firing" } })), false);
  assert.deepEqual(deriveV100RuntimeObservation(final).vehicleActions, []);
  const before = JSON.stringify([first, final]);
  const observed = deriveV100RuntimeObservation(final, null, { "vehicle-barrage": first });
  assert.deepEqual(observed.vehicleActions, ["vehicle-barrage"]);
  assert.equal(observed.state, undefined);
  assert.equal(JSON.stringify([first, final]), before);
});

test("retained action coverage rejects wrong generation, stage, future or missing timing and malformed impacts", () => {
  const final = runtime({ stageId: "stage3", observedAtPageTime: 81000 });
  const first = runtime({ stageId: "stage3", observedAtPageTime: 30000, completedAttackImpacts: [receipt("brute", "human")] });
  for (const invalid of [{ ...first, battleGeneration: 1 }, { ...first, stageId: "stage25" },
    { ...first, observedAtPageTime: 81001 }, { ...first, observedAtPageTime: undefined },
    { ...first, observedAtPageTime: -1 }]) {
    assert.throws(() => deriveV100RuntimeObservation(final, null, { action: invalid }), /CAPTURE_MISMATCH/u);
  }
  assert.throws(() => deriveV100RuntimeObservation(final, null, { action: { ...first,
    completedAttackImpacts: [receipt("brute", "human", { audioReceiptId: "combat-attack:2:999:1" })] } }), /RECEIPT_INVALID/u);
  assert.deepEqual(deriveV100RuntimeObservation(final, null, { action: first }).attackingActors, ["human:brute"]);
});

test("support and marker first-positive runtime facts survive expiry only inside their capture", () => {
  const first = runtime({ stageId: "stage21", observedAtPageTime: 20000,
    audioCueRequests: [{ cueId: "support-heal" }], fighters: [{ id: 5, side: "zombie", kind: "red-panther-smg", marked: 3 }] });
  const final = runtime({ stageId: "stage21", observedAtPageTime: 21000 });
  const observed = deriveV100RuntimeObservation(final, null, { support: first, marker: first });
  assert.deepEqual(observed.supportActors, ["support-healing"]);
  assert.deepEqual(observed.statusMarkers, ["zombie:red-panther-smg:marked"]);
});

test("authored grappler pulling is an action only with its exact living stunned human target", () => {
  const grappler = { id: 4, side: "zombie", kind: "grappler", hp: 169, attackSequence: 0,
    stationAbility: { phase: "pulling", remainingSeconds: 1.05, targetId: 2 } };
  const target = { id: 2, side: "human", kind: "scout", hp: 40, stunned: .08 };
  const observed = (g, t) => deriveV100RuntimeObservation(runtime({ fighters: [g, t] })).attackingActors;
  assert.deepEqual(observed(grappler, target), ["zombie:grappler"]);
  for (const invalid of [{ ...target, id: 8 }, { ...target, side: "zombie" }, { ...target, hp: 0 }, { ...target, stunned: 0 }]) {
    assert.deepEqual(observed(grappler, invalid), []);
  }
  for (const stationAbility of [{ phase: "idle", targetId: 2, remainingSeconds: 1 },
    { phase: "pulling", targetId: 2, remainingSeconds: 0 }, { phase: "pulling", remainingSeconds: 1 }]) {
    assert.deepEqual(observed({ ...grappler, stationAbility }, target), []);
  }
});

test("marker input uses the production-selected target without bypassing health, range or target priority", () => {
  const owner = { id: 9, side: "human", kind: "babayaga", hp: 70, combatReady: true, x: 300, y: 280, attackWindup: 0, cooldown: .9 };
  const enemy = { id: 3, side: "zombie", kind: "red-panther-smg", hp: 100, combatReady: true, x: 350, y: 280 };
  const ready = (fighters, ownerId = 9) => babayagaMarkerInputReady(runtime({ fighters }), ownerId);
  assert.equal(ready([owner, enemy]), true);
  assert.equal(ready([owner, { ...enemy, hp: 65 }]), false);
  assert.equal(ready([owner, { ...enemy, hp: 0 }]), false);
  assert.equal(ready([owner, { ...enemy, x: 900 }]), false);
  assert.equal(ready([owner, { ...enemy, combatReady: false }]), false);
  assert.equal(ready([owner, enemy], 8), false);
  const priorityThreat = { ...enemy, id: 4, kind: "spitter", hp: 40 };
  assert.equal(ready([owner, enemy, priorityThreat]), false, "cannot silently choose a healthier lower-priority target");
  const before = JSON.stringify([owner, enemy]);
  ready([owner, enemy]);
  assert.equal(JSON.stringify([owner, enemy]), before);
});

test("marker input excludes the actual Stage21 committed contact race without reserving a target", () => {
  const owner = { id: 9, side: "human", kind: "babayaga", hp: 76, combatReady: true, x: 203, y: 262, attackWindup: 0, cooldown: .9 };
  const target = { id: 8, side: "zombie", kind: "turned", hp: 95, combatReady: true, x: 368, y: 242 };
  const lowerPriority = { ...target, id: 3, kind: "red-panther-smg", hp: 149, x: 444 };
  const hit = { eventKind: "impact", applyDamage: true, damage: 31, targetKind: "fighter", targetId: 8 };
  const sample = { fighters: [owner, target, lowerPriority], pendingWeaponHits: [hit] };
  const before = JSON.stringify(sample);
  assert.equal(babayagaMarkerInputReady(sample, 9), false);
  assert.equal(JSON.stringify(sample), before);
  assert.equal(babayagaMarkerInputReady({ ...sample, pendingWeaponHits: [], fighters: [owner, { ...target, hp: 64 }, lowerPriority] }, 9), false);
  assert.equal(babayagaMarkerInputReady({ fighters: [owner, lowerPriority], pendingWeaponHits: [] }, 9), true);
  for (const irrelevant of [{ ...hit, targetId: 7 }, { ...hit, eventKind: "muzzle" },
    { ...hit, applyDamage: false }, { ...hit, damage: 0 }, { ...hit, targetKind: "enemy-base" }]) {
    assert.equal(babayagaMarkerInputReady({ ...sample, pendingWeaponHits: [irrelevant] }, 9), true);
  }
});

function markerDispatchFacts() {
  const owner = { id: 9, side: "human", kind: "babayaga", hp: 76, combatReady: true, x: 203, y: 262,
    attackWindup: 0, cooldown: .833333, attackSequence: 3, manualAbility: createManualAbilityRuntime("babayaga") };
  const target = { id: 8, side: "zombie", kind: "turned", hp: 95, combatReady: true, x: 368, y: 242 };
  const beforeInput = runtime({ stageId: "stage21", time: 36, fighters: [owner, target], pendingWeaponHits: [] });
  const selected = selectBabayagaAbilityTarget({ owner, fighters: beforeInput.fighters });
  const started = beginManualAbility(owner.manualAbility, selected);
  return { ownerId: "9", beforeInput, afterInput: { ...beforeInput, time: 36.24,
    fighters: [{ ...owner, manualAbility: { ...started.runtime, target: { ...started.runtime.target } } }, { ...target }],
    manualAbilityReceipts: [{ ownerId: 9, activationId: 1, kind: "babayaga", eventType: "start", at: 36.23, attackSequence: 3 }],
  } };
}
test("manual dispatch uses the actual native target shape and unchanged click budget", () => {
  const evidence = markerDispatchFacts();
  assert.equal(V100_MANUAL_MARKER_CLICK_TIMEOUT_MS, 700);
  assert.equal(babayagaMarkerInputReady(evidence.beforeInput, 9), true);
  const result = manualMarkerActivation(evidence, "babayaga");
  assert.equal(result.ok, true, result.errors.join(","));
  assert.equal(result.identity.targetId, 8);
  const before = JSON.stringify(evidence);
  manualMarkerActivation(evidence, "babayaga");
  assert.equal(JSON.stringify(evidence), before);
});
test("actual red precommit windup and zero pending list cannot admit the marker click", () => {
  const evidence = markerDispatchFacts();
  const owner = evidence.beforeInput.fighters[0];
  owner.attackWindup = .023333; owner.cooldown = 0; owner.attackSequence = 0;
  assert.equal(babayagaMarkerInputReady(evidence.beforeInput, 9), false);
  assert.equal(manualMarkerActivation(evidence, "babayaga").ok, false);
  owner.attackWindup = 0; owner.cooldown = .7;
  assert.equal(babayagaMarkerInputReady(evidence.beforeInput, 9), false);
});
for (const [name, mutate] of [
  ["normal commit during dispatch", (e) => { e.afterInput.manualAbilityReceipts[0].attackSequence += 1; }],
  ["dispatch beyond cooldown", (e) => { e.afterInput.manualAbilityReceipts[0].at = 36.9; e.afterInput.time = 36.91; }],
  ["wrong activation", (e) => { e.afterInput.fighters[0].manualAbility.activationId = 2; }],
  ["wrong owner", (e) => { e.afterInput.manualAbilityReceipts[0].ownerId = 8; }],
  ["missing native target", (e) => { e.afterInput.fighters[0].manualAbility.target = null; }],
  ["foreign generation", (e) => { e.afterInput.battleGeneration = 3; }],
  ["foreign stage", (e) => { e.afterInput.stageId = "stage24"; }],
  ["lethal selection", (e) => { e.afterInput.fighters[0].manualAbility.target.hp = 65; }],
  ["pending exact contact", (e) => { e.afterInput.pendingWeaponHits = [{ eventKind: "impact", applyDamage: true, damage: 31, targetKind: "fighter", targetId: 8 }]; }],
]) test("manual dispatch fails closed for " + name, () => {
  const evidence = markerDispatchFacts(); mutate(evidence);
  assert.equal(manualMarkerActivation(evidence, "babayaga").ok, false);
});
