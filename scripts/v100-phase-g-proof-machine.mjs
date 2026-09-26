export function createV100PhaseGProofMachine() {
  const PROOF_SCHEMA = "v100-phase-g-completed-impact-proof/v1";
  const RECEIPT_SCHEMA = "v100-completed-attack-impact/v1";
  const SCREENSHOT_SCHEMA = "v100-phase-g-proof-screenshot/v1";
  const TERMINAL_STATES = new Set(["COMPLETE", "FAILED"]);

  const finite = (value) => typeof value === "number" && Number.isFinite(value);
  const positiveInteger = (value) => Number.isInteger(value) && value > 0;
  const nonNegativeInteger = (value) => Number.isInteger(value) && value >= 0;
  const nonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
  const deepFreeze = (value, seen = new Set()) => {
    if (!value || typeof value !== "object" || seen.has(value)) return value;
    seen.add(value);
    for (const nested of Object.values(value)) deepFreeze(nested, seen);
    return Object.freeze(value);
  };
  const stableValue = (value) => JSON.stringify(value, Object.keys(value ?? {}).sort());
  const actorKeyFor = (receipt) => `${receipt?.sourceSide ?? ""}:${receipt?.sourceKind ?? ""}`;
  const impactKeyFor = (receipt) => [
    receipt?.battleGeneration,
    receipt?.sourceId,
    receipt?.attackSequence,
    receipt?.targetId,
    receipt?.impactOrdinal,
  ].join(":");

  const receiptValidation = (receipt) => {
    const reasons = [];
    if (receipt?.schema !== RECEIPT_SCHEMA) reasons.push("WRONG_SCHEMA");
    if (!positiveInteger(receipt?.battleGeneration)) reasons.push("BATTLE_GENERATION_INVALID");
    if (!positiveInteger(receipt?.sourceId)) reasons.push("SOURCE_ID_INVALID");
    if (!positiveInteger(receipt?.attackSequence)) reasons.push("ATTACK_SEQUENCE_INVALID");
    if (!positiveInteger(receipt?.targetId)) reasons.push("TARGET_ID_INVALID");
    if (!nonNegativeInteger(receipt?.impactOrdinal)) reasons.push("IMPACT_ORDINAL_INVALID");
    if (!["human", "zombie"].includes(receipt?.sourceSide)) reasons.push("SOURCE_SIDE_INVALID");
    if (!["human", "zombie"].includes(receipt?.targetSide)) reasons.push("TARGET_SIDE_INVALID");
    if (receipt?.sourceSide === receipt?.targetSide) reasons.push("TARGET_SIDE_NOT_OPPOSING");
    if (!nonEmptyString(receipt?.sourceKind)) reasons.push("SOURCE_KIND_INVALID");
    if (!nonEmptyString(receipt?.targetKind)) reasons.push("TARGET_KIND_INVALID");
    if (!["direct", "projectile", "delayed"].includes(receipt?.mode)) reasons.push("IMPACT_MODE_INVALID");
    if (!finite(receipt?.committedAtBattleTime)) reasons.push("COMMIT_TIME_INVALID");
    if (!finite(receipt?.contactAtBattleTime)) reasons.push("CONTACT_TIME_INVALID");
    if (finite(receipt?.committedAtBattleTime)
      && finite(receipt?.contactAtBattleTime)
      && receipt.contactAtBattleTime < receipt.committedAtBattleTime) reasons.push("CONTACT_PRECEDES_COMMIT");
    if (!["hit", "defeated"].includes(receipt?.reactionOutcome)) reasons.push("REACTION_OUTCOME_INVALID");
    if (!nonEmptyString(receipt?.audioCueId)) reasons.push("AUDIO_CUE_ID_INVALID");
    if (receipt?.audioReceiptId !== `combat-attack:${receipt?.battleGeneration}:${receipt?.sourceId}:${receipt?.attackSequence}`) {
      reasons.push("EXACT_AUDIO_RECEIPT_ID_MISMATCH");
    }
    if (receipt?.audioRequestObserved !== true) reasons.push("EXACT_AUDIO_REQUEST_MISSING");
    return deepFreeze({ ok: reasons.length === 0, reasons });
  };

  const fail = (proof, code, detail, pageNow) => {
    if (!proof || TERMINAL_STATES.has(proof.state)) return proof;
    return deepFreeze({
      ...proof,
      state: "FAILED",
      failure: {
        schema: "v100-phase-g-completed-impact-failure/v1",
        code,
        detail: detail ?? null,
        atPageTime: finite(pageNow) ? pageNow : null,
      },
    });
  };

  const createProof = ({
    battleGeneration,
    requiredActorKeys = [],
    startedAtPageTime,
    startedAtBattleTime,
    deadlineAtPageTime,
  } = {}) => {
    const required = [...new Set(requiredActorKeys.filter(nonEmptyString))];
    if (!positiveInteger(battleGeneration)
      || !finite(startedAtPageTime)
      || !finite(startedAtBattleTime)
      || !finite(deadlineAtPageTime)
      || deadlineAtPageTime <= startedAtPageTime) return null;
    return deepFreeze({
      schema: PROOF_SCHEMA,
      state: "OBSERVING",
      battleGeneration,
      requiredActorKeys: required,
      startedAtPageTime,
      startedAtBattleTime,
      deadlineAtPageTime,
      receiptsByActor: {},
      seenImpactValues: {},
      acceptedAtPageTime: null,
      screenshot: null,
      cleanupReceipt: null,
      failure: null,
    });
  };

  const observe = (proof, { snapshot, pageNow } = {}) => {
    if (proof?.schema !== PROOF_SCHEMA || TERMINAL_STATES.has(proof?.state)) return proof;
    if (proof.state !== "OBSERVING") return proof;
    if (!finite(pageNow)) return fail(proof, "PAGE_TIME_INVALID", null, pageNow);
    if (snapshot?.schema !== "v100-phase-g-combat-snapshot/v1") {
      return fail(proof, "COMBAT_SNAPSHOT_SCHEMA_INVALID", snapshot?.schema ?? null, pageNow);
    }
    if (snapshot?.screen !== "battle") return fail(proof, "BATTLE_ROUTE_LOST", snapshot?.screen ?? null, pageNow);
    const receipts = Array.isArray(snapshot.completedAttackImpacts) ? snapshot.completedAttackImpacts : null;
    if (!receipts) return fail(proof, "COMPLETED_IMPACT_ARRAY_MISSING", null, pageNow);
    let receiptsByActor = { ...proof.receiptsByActor };
    let seenImpactValues = { ...proof.seenImpactValues };
    for (const receipt of receipts) {
      if (receipt?.battleGeneration !== proof.battleGeneration) continue;
      if (finite(receipt?.committedAtBattleTime)
        && receipt.committedAtBattleTime < proof.startedAtBattleTime) continue;
      const validation = receiptValidation(receipt);
      if (!validation.ok) return fail(proof, "COMPLETED_IMPACT_RECEIPT_INVALID", {
        impactKey: impactKeyFor(receipt),
        reasons: validation.reasons,
      }, pageNow);
      const impactKey = impactKeyFor(receipt);
      const value = stableValue(receipt);
      if (seenImpactValues[impactKey] && seenImpactValues[impactKey] !== value) {
        return fail(proof, "CONFLICTING_IMPACT_IDENTITY", { impactKey }, pageNow);
      }
      seenImpactValues[impactKey] = value;
      const actorKey = actorKeyFor(receipt);
      if ((proof.requiredActorKeys.length === 0 || proof.requiredActorKeys.includes(actorKey))
        && !receiptsByActor[actorKey]) {
        receiptsByActor[actorKey] = deepFreeze({ ...receipt });
      }
    }
    const accepted = proof.requiredActorKeys.length > 0
      ? proof.requiredActorKeys.every((actorKey) => receiptsByActor[actorKey])
      : Object.keys(receiptsByActor).length > 0;
    if (accepted) {
      if (pageNow > proof.deadlineAtPageTime) {
        return fail(proof, "PROOF_DEADLINE_EXCEEDED", { missingActorKeys: [] }, pageNow);
      }
      return deepFreeze({
        ...proof,
        state: "ATTACK_ACCEPTED",
        receiptsByActor,
        seenImpactValues,
        acceptedAtPageTime: pageNow,
      });
    }
    if (pageNow >= proof.deadlineAtPageTime) {
      return fail(proof, "PROOF_DEADLINE_EXCEEDED", {
        missingActorKeys: proof.requiredActorKeys.filter((actorKey) => !receiptsByActor[actorKey]),
      }, pageNow);
    }
    return deepFreeze({ ...proof, receiptsByActor, seenImpactValues });
  };

  const attachScreenshot = (proof, { screenshot, pageNow } = {}) => {
    if (proof?.schema !== PROOF_SCHEMA || TERMINAL_STATES.has(proof?.state)) return proof;
    if (proof.state !== "ATTACK_ACCEPTED") return fail(proof, "SCREENSHOT_BEFORE_ACCEPTED_ATTACK", null, pageNow);
    if (!finite(pageNow) || pageNow > proof.deadlineAtPageTime) {
      return fail(proof, "SCREENSHOT_DEADLINE_EXCEEDED", null, pageNow);
    }
    if (!nonEmptyString(screenshot?.sha256) || !positiveInteger(screenshot?.bytes)) {
      return fail(proof, "SCREENSHOT_RECEIPT_INVALID", screenshot ?? null, pageNow);
    }
    return deepFreeze({
      ...proof,
      state: "SCREENSHOT_BOUND",
      screenshot: {
        schema: SCREENSHOT_SCHEMA,
        path: screenshot.path ?? null,
        sha256: screenshot.sha256,
        bytes: screenshot.bytes,
        capturedAtPageTime: pageNow,
        acceptedImpactKeys: Object.fromEntries(Object.entries(proof.receiptsByActor)
          .map(([actorKey, receipt]) => [actorKey, impactKeyFor(receipt)])),
      },
    });
  };

  const complete = (proof, { pageNow, observerStopped = false } = {}) => {
    if (proof?.schema !== PROOF_SCHEMA || TERMINAL_STATES.has(proof?.state)) return proof;
    if (proof.state !== "SCREENSHOT_BOUND") return fail(proof, "CLEANUP_BEFORE_SCREENSHOT", null, pageNow);
    if (observerStopped !== true) return fail(proof, "OBSERVER_STOP_RECEIPT_MISSING", null, pageNow);
    return deepFreeze({
      ...proof,
      state: "COMPLETE",
      cleanupReceipt: {
        schema: "v100-phase-g-observer-cleanup/v1",
        observerStopped: true,
        atPageTime: finite(pageNow) ? pageNow : null,
      },
    });
  };

  return Object.freeze({
    proofSchema: PROOF_SCHEMA,
    receiptSchema: RECEIPT_SCHEMA,
    screenshotSchema: SCREENSHOT_SCHEMA,
    isFiniteReceiptNumber: finite,
    receiptValidation,
    actorKeyFor,
    impactKeyFor,
    createProof,
    observe,
    attachScreenshot,
    complete,
    fail,
  });
}
