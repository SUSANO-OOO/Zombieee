import { V100_COMBAT_FX_INVENTORY } from "./v100CombatPresentation.js";
import { productionEnemyRuntimeContract } from "./productionEnemyRuntime.js";

const COMBAT_SEQUENCE = Object.freeze(["source", "prep", "travel", "contact", "impact", "target-reaction", "aftermath"]);

const REPRESENTATIVE_ROWS = [
  ["combat-existing-ally-melee", "brute", "melee-windup-swing-recovery", "weapon-hand", "weapon-arc-contact", "target-flash-knock", ["weapon-brute-attack", "melee-hit"], "stage03-takuya", "brute"],
  ["combat-existing-ally-ranged", "ranger", "ranged-shot", "weapon-muzzle", "authored-trail-to-impact", "target-flash-knock", ["weapon-ranger-attack", "ranged-shot"], "stage06-spitter-seal", "ranger"],
  ["combat-existing-enemy-melee", "walker", "enemy-melee-attack", "enemy-weapon-anchor", "enemy-contact-flash", "ally-knockback", ["enemy-walker-attack", "melee-hit"], "stage03-takuya", "walker"],
  ["combat-existing-enemy-ranged-special", "spitter", "projectile-special", "enemy-projectile-muzzle", "acid-impact", "ally-hit-flash", ["enemy-spitter-attack", "object-hit"], "stage06-spitter-seal", "spitter"],
  ["combat-infected-special", "grappler", "infected-special-grapple", "organic-pulse-anchor", "grapple-contact", "stun-and-knock", ["enemy-grappler-attack", "turned"], "stage04-grappler", "grappler"],
  ["combat-red-panther-knife", "red-panther-knife", "knife-footwork", "right-hand-knife", "weapon-arc-contact", "target-flash-knock", ["enemy-red-panther-knife-attack", "melee-hit"], "stage21-panther-knife", "red-panther-knife"],
  ["combat-red-panther-smg", "red-panther-smg", "socket-smg-burst", "weapon-muzzle", "tracer-impact", "target-flash-knock", ["enemy-red-panther-smg-attack", "ranged-shot"], "stage21-panther-knife", "red-panther-smg"],
  ["combat-red-panther-shield", "red-panther-shield", "shield-block", "left-arm-shield", "shield-plane-contact", "guard-stagger", ["enemy-red-panther-shield-attack", "structure-heavy"], "stage25-president", "red-panther-shield"],
  ["combat-red-panther-commander", "red-panther-commander", "rally-command", "commander-radio", "rally-telegraph", "ally-buff-state", ["enemy-red-panther-commander-attack", "role-scout"], "stage24-panther-commander", "red-panther-commander"],
  ["combat-existing-boss", "takuya", "boss-phase-attack", "boss-telegraph", "boss-impact", "boss-hit-reaction", ["enemy-takuya-attack", "takuya-hit"], "stage03-takuya", "takuya"],
  ["combat-mutated-president", "mugarian-president-mutated", "four-arm-sweep", "four-rooted-arms", "boss-telegraph-impact", "boss-hit-reaction", ["enemy-mugarian-president-mutated-attack", "takuya-hit"], "stage25-president", "mugarian-president-mutated"],
  ["combat-takuya-omega", "takuya-omega", "giant-weapon-sweep", "two-rooted-arms-greatsword", "weapon-arc-contact", "boss-hit-reaction", ["enemy-takuya-omega-attack", "takuya-hit"], "core-battle-boss", "takuya-omega"],
  ["combat-support", "support-healing", "support-activation", "support-world-drop", "healing-pulse-contact", "ally-heal-state", ["support-heal", "status-support-target"], "core-battle-boss", "support-healing"],
  ["combat-vehicle-ability", "vehicle-barrage", "vehicle-barrage", "vehicle-weapon-muzzle", "crawler-barrage-impact", "enemy-hit-flash", ["weapon-barrage", "crawler-hit"], "stage03-takuya", "vehicle-barrage"],
  ["combat-mission-object", "stage-nishijin-station-tunnel-seal", "mission-object-state-change", "mission-object-bounds", "objective-contact", "mission-target-state", ["sfx-v070-terminal-confirm", "status-mission-target"], "stage06-spitter-seal", "stage-nishijin-station-tunnel-seal"],
  ["combat-status-target-markers", "status-mission-target", "target-marker-state", "mission-target-label", "lock-on-contact", "danger-or-target-state", ["ui-select", "status-danger"], "stage21-panther-knife", "status-mission-target"],
].map(([id, actor, action, source, contactImpact, reaction, seVfx, captureVariant, runtimeActor]) => Object.freeze({
  id,
  actor,
  action,
  source,
  contactImpact,
  reaction,
  seVfx: Object.freeze(seVfx),
  state: captureVariant.startsWith("stage") && captureVariant.includes("takuya") || captureVariant.includes("president") || captureVariant === "core-battle-boss" ? "battle-boss" : "battle-normal",
  captureVariant,
  runtimeActor,
  runtimeSequence: COMBAT_SEQUENCE,
}));

function unique(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.length > 0))];
}

export function deriveV100ProductionEnemyCoverage() {
  const runtimeContract = productionEnemyRuntimeContract();
  const requiredEnemyKinds = unique(runtimeContract.requiredEnemyKinds);
  const requiredBossKinds = unique(runtimeContract.bossKinds);
  const registeredKinds = unique(V100_COMBAT_FX_INVENTORY.map((entry) => entry.actor));
  return Object.freeze({
    source: Object.freeze(["productionEnemyRuntimeContract", "campaignStages", "v100Stages", "battleAssetPlan", "spriteManifest"]),
    requiredEnemyKinds: Object.freeze(requiredEnemyKinds),
    requiredBossKinds: Object.freeze(requiredBossKinds),
    candidateReachableKinds: Object.freeze(requiredEnemyKinds),
    registeredKinds: Object.freeze(registeredKinds),
    spriteRequirements: Object.freeze(runtimeContract.spriteRequirements),
    unknownReachableKinds: Object.freeze(runtimeContract.unknownReachableKinds),
    missingBossKinds: Object.freeze(runtimeContract.missingBossKinds),
    unreachableRegisteredKinds: Object.freeze(runtimeContract.unreachableRegisteredKinds),
    expectedCount: requiredEnemyKinds.length,
  });
}

export const V100_REPRESENTATIVE_COMBAT_CONTRACT = Object.freeze(REPRESENTATIVE_ROWS);

const ENEMY_RUNTIME_ACTORS = new Set([
  "walker", "spitter", "grappler", "red-panther-knife", "red-panther-smg", "red-panther-shield",
  "red-panther-commander", "takuya", "mugarian-president-mutated", "takuya-omega",
]);

/**
 * The canonical row describes what the evidence is meant to prove. This
 * companion rule describes the production observation that must back it.
 * Keeping the rule derived from the row prevents a screenshot count or a
 * remembered fixture from making a correctly-shaped but unrelated capture
 * acceptable.
 */
export function representativeRuntimeObservationRule(contract) {
  if (!contract || typeof contract !== "object") return Object.freeze({ kind: "missing" });
  if (contract.actor === "support-healing") {
    return Object.freeze({ kind: "support", expected: "support-healing", cueIds: Object.freeze(["support-heal"]) });
  }
  if (contract.actor === "vehicle-barrage") {
    return Object.freeze({ kind: "vehicle", expected: "vehicle-barrage", cueIds: Object.freeze(["weapon-barrage"]) });
  }
  if (contract.actor === "stage-nishijin-station-tunnel-seal") {
    return Object.freeze({ kind: "mission", expectedStageId: "stage-nishijin-station-tunnel-seal", expectedMissionType: "escort" });
  }
  if (contract.actor === "status-mission-target") {
    return Object.freeze({ kind: "status", expected: "status-mission-target" });
  }
  return Object.freeze({
    kind: "fighter",
    expected: contract.runtimeActor,
    expectedSide: ENEMY_RUNTIME_ACTORS.has(contract.runtimeActor) ? "zombie" : "human",
    attackCueIds: Object.freeze(unique(
      V100_COMBAT_FX_INVENTORY
        .filter((entry) => entry?.actor === contract.runtimeActor && typeof entry.soundCue === "string")
        .map((entry) => entry.soundCue),
    )),
  });
}

function observedRuntimeProof(runtimeEvidence) {
  return runtimeEvidence?.combatCausalProof?.observed
    ?? runtimeEvidence?.observedRuntimeProof
    ?? null;
}

function includesValue(values, expected) {
  return Array.isArray(values) && values.includes(expected);
}

function runtimeObservationError(rule, observed) {
  if (!observed || typeof observed !== "object") return "missing observed runtime proof";
  if (rule.kind === "fighter") {
    const actorKey = `${rule.expectedSide}:${rule.expected}`;
    if (!includesValue(observed.fighterActors, actorKey)) return `runtime actor not observed: ${actorKey}`;
    const stateAttackObserved = includesValue(observed.attackingActors, actorKey);
    const attackCueObserved = (rule.attackCueIds ?? []).some((cueId) => includesValue(observed.audioCueIds, cueId));
    if (!stateAttackObserved && !attackCueObserved) {
      return `runtime actor did not attack: ${actorKey}`;
    }
  } else if (rule.kind === "support") {
    if (!includesValue(observed.supportActors, rule.expected)) return `runtime support not observed: ${rule.expected}`;
  } else if (rule.kind === "vehicle") {
    if (!includesValue(observed.vehicleActions, rule.expected)) return `runtime vehicle action not observed: ${rule.expected}`;
  } else if (rule.kind === "mission") {
    if (!includesValue(observed.missionStageIds, rule.expectedStageId)) return `runtime mission stage not observed: ${rule.expectedStageId}`;
    if (!includesValue(observed.missionTypes, rule.expectedMissionType)) return `runtime mission type not observed: ${rule.expectedMissionType}`;
  } else if (rule.kind === "status") {
    if (!Array.isArray(observed.statusMarkers) || observed.statusMarkers.length === 0) return "runtime status marker not observed";
  }
  return null;
}

export function validateV100RepresentativeCombatEvidence({ contract, evidence, runtimeEvidence } = {}) {
  const errors = [];
  if (!contract || typeof contract !== "object") errors.push("missing canonical contract");
  if (!evidence || typeof evidence !== "object") errors.push("missing evidence");
  if (!runtimeEvidence || typeof runtimeEvidence !== "object") errors.push("missing runtime evidence");
  if (contract && evidence) {
    for (const field of ["id", "actor", "captureVariant", "runtimeActor", "state", "action", "source", "contactImpact", "reaction"]) {
      if (evidence[field] !== contract[field]) errors.push(`${field} mismatch`);
    }
    if (JSON.stringify(evidence.seVfx) !== JSON.stringify(contract.seVfx)) errors.push("seVfx mismatch");
    if (JSON.stringify(evidence.runtimeSequence) !== JSON.stringify(contract.runtimeSequence)) errors.push("runtimeSequence mismatch");
  }
  if (evidence && runtimeEvidence) {
    if (runtimeEvidence.id !== evidence.id) errors.push("runtime evidence id mismatch");
    if (runtimeEvidence.captureVariant !== evidence.captureVariant) errors.push("runtime evidence variant mismatch");
    const observationError = runtimeObservationError(representativeRuntimeObservationRule(contract), observedRuntimeProof(runtimeEvidence));
    if (observationError) errors.push(observationError);
  }
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors) });
}

export function validateV100EnemyCoverage({ expected = deriveV100ProductionEnemyCoverage(), observedKinds = [] } = {}) {
  const observed = new Set(observedKinds);
  const required = new Set(expected.requiredEnemyKinds);
  const missing = [...required].filter((kind) => !observed.has(kind));
  const duplicates = observedKinds.filter((kind, index) => observedKinds.indexOf(kind) !== index);
  const unknown = [...observed].filter((kind) => !expected.candidateReachableKinds.includes(kind));
  return Object.freeze({
    required: [...required],
    observed: [...observed],
    missing,
    duplicateCoverage: duplicates,
    unknown,
    ok: missing.length === 0 && duplicates.length === 0 && unknown.length === 0,
  });
}

export { COMBAT_SEQUENCE as V100_COMBAT_SEQUENCE };
