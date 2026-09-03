import { createV100PhaseGProofMachine } from "./v100-phase-g-proof-machine.mjs";
import { MANUAL_ABILITY_REGISTRY, selectBabayagaAbilityTarget } from "../app/manualAbilities.js";
import { V100_REPRESENTATIVE_COMBAT_CONTRACT, validateV100RepresentativeCombatEvidence } from "../app/v100PhaseGContract.js";

const receiptContract = createV100PhaseGProofMachine();
export const V100_MANUAL_MARKER_CLICK_TIMEOUT_MS = 700;

export function validateV100CaptureRepresentativeEvidence({ variant, runtime, completedImpactProof, setupObservations } = {}) {
  const contracts = V100_REPRESENTATIVE_COMBAT_CONTRACT.filter((contract) => contract.captureVariant === variant);
  if (!contracts.length) return { ok: variant === "core-battle-normal", errors: variant === "core-battle-normal" ? [] : ["UNKNOWN_REPRESENTATIVE_CAPTURE"], rows: 0 };
  const observedRuntimeProof = deriveV100RuntimeObservation(runtime, completedImpactProof, setupObservations);
  const errors = contracts.flatMap((contract) => {
    const result = validateV100RepresentativeCombatEvidence({ contract, evidence: contract,
      runtimeEvidence: { id: contract.id, captureVariant: variant, observedRuntimeProof } });
    return result.errors.map((error) => `${contract.id}: ${error}`);
  });
  return { ok: errors.length === 0, errors, rows: contracts.length };
}

export function validateV100ProofImageLink(collection, runtime) {
  const errors = [];
  const proof = collection?.completedImpactProof;
  const image = proof?.screenshot;
  const require = (condition, code) => { if (!condition) errors.push(code); };
  require(collection?.ok === true && collection?.collection?.converged === true
    && collection?.collection?.withinReleaseDeadline === true, "COLLECTION_INCOMPLETE");
  require(proof?.schema === receiptContract.proofSchema && proof?.state === "COMPLETE", "PROOF_NOT_COMPLETE");
  require(proof?.battleGeneration === runtime?.battleGeneration && runtime?.screen === "battle", "FOREIGN_BATTLE");
  const receipts = Object.entries(proof?.receiptsByActor ?? {});
  require(receipts.length > 0, "NO_ACCEPTED_ATTACK");
  for (const key of proof?.requiredActorKeys ?? []) require(receipts.some(([actor]) => actor === key), "REQUIRED_ACTOR_MISSING");
  for (const [actor, receipt] of receipts) {
    require(receiptContract.receiptValidation(receipt).ok && receipt.battleGeneration === proof?.battleGeneration
      && receiptContract.actorKeyFor(receipt) === actor, "INVALID_ATOMIC_RECEIPT");
    require(image?.acceptedImpactKeys?.[actor] === receiptContract.impactKeyFor(receipt), "IMAGE_ATTACK_MISMATCH");
  }
  require(Object.keys(image?.acceptedImpactKeys ?? {}).length === receipts.length, "IMAGE_ACTOR_SET_MISMATCH");
  require(image?.schema === receiptContract.screenshotSchema && typeof image?.path === "string"
    && /^[a-f0-9]{64}$/u.test(image?.sha256 ?? "") && image?.bytes > 1000, "IMAGE_RECEIPT_INVALID");
  require([proof?.startedAtPageTime, proof?.acceptedAtPageTime, proof?.deadlineAtPageTime,
    image?.capturedAtPageTime, proof?.cleanupReceipt?.atPageTime].every(Number.isFinite), "INVALID_CLOCK");
  require(proof?.startedAtPageTime <= proof?.acceptedAtPageTime
    && proof?.acceptedAtPageTime <= image?.capturedAtPageTime
    && image?.capturedAtPageTime <= proof?.deadlineAtPageTime
    && image?.capturedAtPageTime <= proof?.cleanupReceipt?.atPageTime, "IMAGE_CLOCK_MISMATCH");
  require(proof?.cleanupReceipt?.observerStopped === true, "OBSERVER_NOT_STOPPED");
  const imageEvidence = collection?.screenshot;
  const deadline = imageEvidence?.releaseDeadlineReceipt;
  require(imageEvidence?.path === image?.path && imageEvidence?.sha256 === image?.sha256
    && imageEvidence?.bytes === image?.bytes, "IMAGE_EVIDENCE_LINK_MISMATCH");
  require(deadline?.withinReleaseDeadline === true && deadline?.pageNow === image?.capturedAtPageTime
    && deadline?.visibleProofStartedAt === proof?.startedAtPageTime
    && deadline?.visibleProofDeadlineAt === proof?.deadlineAtPageTime, "AFTER_SCREENSHOT_DEADLINE_MISMATCH");
  return { ok: errors.length === 0, errors };
}

export function babayagaMarkerInputReady(runtime, ownerId) {
  const fighters = runtime?.fighters ?? [];
  const owner = fighters.find((f) => String(f.id) === String(ownerId) && f.side === "human" && f.kind === "babayaga");
  const target = selectBabayagaAbilityTarget({ owner, fighters });
  return Number(owner?.attackWindup) === 0
    && Number(owner?.cooldown) > V100_MANUAL_MARKER_CLICK_TIMEOUT_MS / 1000
    && Number(target?.hp) > MANUAL_ABILITY_REGISTRY.babayaga.impactDamage
    && !(runtime?.pendingWeaponHits ?? []).some((hit) => hit.eventKind === "impact"
      && hit.applyDamage === true && Number(hit.damage) > 0 && hit.targetKind === "fighter"
      && String(hit.targetId) === String(target.targetId));
}

export function manualMarkerActivation(evidence, kind) {
  const before = evidence?.beforeInput;
  const after = evidence?.afterInput;
  const ownerId = evidence?.ownerId;
  const prior = before?.fighters?.find((f) => String(f.id) === String(ownerId));
  const owner = after?.fighters?.find((f) => String(f.id) === String(ownerId));
  const activationId = owner?.manualAbility?.activationId;
  const start = after?.manualAbilityReceipts?.find((r) => String(r.ownerId) === String(ownerId)
    && r.kind === kind && r.eventType === "start" && r.activationId === activationId);
  const target = owner?.manualAbility?.target;
  const targetActor = after?.fighters?.find((f) => String(f.id) === String(target?.targetId));
  const errors = [];
  const require = (condition, code) => { if (!condition) errors.push(code); };
  require(before?.screen === "battle" && after?.screen === "battle"
    && Number.isInteger(before?.battleGeneration) && before.battleGeneration === after?.battleGeneration
    && typeof before.stageId === "string" && before.stageId === after?.stageId, "MANUAL_FOREIGN_BATTLE");
  require(kind === "babayaga" && prior?.kind === kind && owner?.kind === kind
    && owner?.side === "human" && owner?.hp > 0
    && activationId === prior?.manualAbility?.activationId + 1, "MANUAL_ACTIVATION_ID_INVALID");
  require(start && start.attackSequence === prior?.attackSequence
    && start.at >= before?.time && start.at - before.time < prior?.cooldown
    && after?.time >= start.at, "MANUAL_DISPATCH_CROSSED_NORMAL_ATTACK");
  require(targetActor?.side === "zombie" && targetActor.hp > 0 && target?.targetId != null
    && target.hp > MANUAL_ABILITY_REGISTRY.babayaga.impactDamage, "MANUAL_EXACT_TARGET_UNAVAILABLE");
  require(![...(before?.pendingWeaponHits ?? []), ...(after?.pendingWeaponHits ?? [])].some((h) =>
    h.eventKind === "impact" && h.applyDamage === true && Number(h.damage) > 0
    && h.targetKind === "fighter" && String(h.targetId) === String(target?.targetId)), "MANUAL_TARGET_CONTACT_PENDING");
  return { ok: errors.length === 0, errors, identity: {
    ownerId, activationId, targetId: target?.targetId, kind,
    battleGeneration: after?.battleGeneration, stageId: after?.stageId, startedAt: start?.at,
  } };
}

function observedGrapplerPull(fighter, fighters) {
  if (fighter.side !== "zombie" || fighter.kind !== "grappler" || Number(fighter.hp) <= 0
    || fighter.stationAbility?.phase !== "pulling" || Number(fighter.stationAbility.remainingSeconds) <= 0) return false;
  return fighters.some((target) => String(target.id) === String(fighter.stationAbility.targetId)
    && target.side === "human" && Number(target.hp) > 0 && Number(target.stunned) > 0);
}

export function setupActorObservation(runtime, side, kind, cueId) {
  const actor = runtime?.fighters?.find((f) => f.side === side && f.kind === kind && Number(f.hp) > 0);
  const completed = runtime?.completedAttackImpacts?.some((r) => r.battleGeneration === runtime.battleGeneration
    && r.sourceSide === side && r.sourceKind === kind && receiptContract.receiptValidation(r).ok);
  const active = actor && (Number(actor.attackSequence) > 0 || Number(actor.attack) > 0
    || Number(actor.attackWindup) > 0 || (side === "zombie" && (actor.enemyVfx?.attacking === true
      || actor.enemyVfx?.attackWindup === true || ["attack", "warning"].includes(actor.enemyVfx?.phase))));
  const audio = cueId && runtime?.audioCueRequests?.some((r) => r.cueId === cueId);
  return { mounted: Boolean(actor), observed: Boolean(completed || active || audio) };
}

export function setupVehicleActionObserved(runtime) {
  const crawler = runtime?.crawlerAbility;
  return runtime?.audioCueRequests?.some((r) => r.cueId === "weapon-barrage") === true
    || crawler?.abilityId === "vehicle-barrage"
      && (crawler.phase === "firing" || crawler.damageTriggered === true || Number(crawler.hitCount ?? crawler.hits?.length ?? 0) > 0);
}

// Stateless action-coverage projection, never an alternative causal proof.
// The caller supplies only the runtime persisted with this capture.
export function deriveV100RuntimeObservation(runtime, completedImpactProof, setupObservations = {}) {
  const generation = runtime?.battleGeneration ?? completedImpactProof?.battleGeneration;
  if (!Number.isInteger(generation) || generation <= 0 || runtime?.screen !== "battle") {
    throw new Error("REPRESENTATIVE_RUNTIME_GENERATION_MISSING");
  }
  const fighters = runtime.fighters ?? [];
  const actorKey = (fighter) => `${fighter.side}:${fighter.kind}`;
  const fighterActors = new Set(fighters.filter((f) => f.side && f.kind).map(actorKey));
  const attackingActors = new Set(fighters.filter((f) => f.side && f.kind && (
    Number(f.attackSequence) > 0 || Number(f.attack) > 0 || Number(f.attackWindup) > 0
    || Number(f.abilityWindup) > 0 || observedGrapplerPull(f, fighters)
  )).map(actorKey));
  for (const receipt of runtime.completedAttackImpacts ?? []) {
    if (receipt.battleGeneration !== generation) continue;
    if (!receiptContract.receiptValidation(receipt).ok) throw new Error("REPRESENTATIVE_COMPLETED_RECEIPT_INVALID");
    const key = `${receipt.sourceSide}:${receipt.sourceKind}`;
    fighterActors.add(key);
    attackingActors.add(key);
  }
  const audioCueIds = new Set((runtime.audioCueRequests ?? []).map((request) => request.cueId).filter(Boolean));
  const supportActors = new Set((runtime.missionObjects ?? [])
    .filter((object) => String(object.kind ?? "").includes("support-healing"))
    .map(() => "support-healing"));
  if (audioCueIds.has("support-heal")) supportActors.add("support-healing");
  const crawler = runtime.crawlerAbility;
  const vehicleActions = setupVehicleActionObserved({ crawlerAbility: crawler, audioCueRequests: runtime.audioCueRequests }) ? ["vehicle-barrage"] : [];
  const statusMarkers = fighters.filter((f) => Number(f.marked) > 0).map((f) => `${actorKey(f)}:marked`);
  if ((runtime.damageTexts ?? []).some((entry) => /索敵|マーク|目標|ロック/u.test(String(entry.value ?? "")))) {
    statusMarkers.push("status-mission-target");
  }
  const observed = {
    fighterActors: [...fighterActors], attackingActors: [...attackingActors],
    audioCueIds: [...audioCueIds], supportActors: [...supportActors], vehicleActions,
    missionStageIds: runtime.stageId ? [runtime.stageId] : [],
    missionTypes: runtime.stageMission?.missionType ? [runtime.stageMission.missionType] : [],
    statusMarkers: [...new Set(statusMarkers)],
  };
  for (const snapshot of Object.values(setupObservations)) {
    if (snapshot?.battleGeneration !== generation || snapshot?.stageId !== runtime.stageId
      || !Number.isFinite(snapshot?.observedAtPageTime) || !Number.isFinite(runtime.observedAtPageTime)
      || snapshot.observedAtPageTime < 0 || snapshot.observedAtPageTime > runtime.observedAtPageTime) {
      throw new Error("REPRESENTATIVE_SETUP_CAPTURE_MISMATCH");
    }
    const prior = deriveV100RuntimeObservation(snapshot);
    for (const key of Object.keys(observed)) observed[key] = [...new Set([...observed[key], ...prior[key]])];
  }
  return observed;
}
