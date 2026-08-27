export function createV100PhaseGProofMachine({
  runtimeSimulationStepSeconds = 1 / 60,
  runtimeMaxCatchUpSteps = 5,
} = {}) {
  const PROOF_SCHEMA = "v100-phase-g-post-quiescence-proof/v7";
  const CONTACT_SCHEMA = "v100-phase-g-exact-actor-direct-contact/v2";
  const WITNESS_SCHEMA = "v100-phase-g-exact-actor-witness/v2";
  const TRANSPORT_SCHEMA = "v100-phase-g-exact-pending-impact/v1";
  const TERMINAL_STATES = new Set(["CLEANED", "CLEANED_AFTER_FAILURE"]);
  const ACCEPTED_STATES = new Set(["WITNESS_ACCEPTED", "SCREENSHOT_RECEIPT_ACCEPTED", "CLEANED"]);
  const schedulerToleranceSeconds = runtimeSimulationStepSeconds * runtimeMaxCatchUpSteps;

  const isFiniteReceiptNumber = (value) => typeof value === "number" && Number.isFinite(value);

  const deepFreeze = (value, seen = new Set()) => {
    if (!value || typeof value !== "object" || seen.has(value)) return value;
    seen.add(value);
    for (const nested of Object.values(value)) deepFreeze(nested, seen);
    return Object.freeze(value);
  };

  const releaseAnchorCommitWindowSecondsFor = (releaseAnchor) => {
    const attackWindupSeconds = releaseAnchor?.attackWindupSeconds;
    if (!isFiniteReceiptNumber(attackWindupSeconds) || attackWindupSeconds <= 0) return null;
    return Math.max(0.8, attackWindupSeconds + 0.5) + schedulerToleranceSeconds;
  };

  const transition = (epoch, state, reason, pageNow, patch = {}) => deepFreeze({
    ...epoch,
    ...patch,
    state,
    transitionLog: [
      ...(epoch.transitionLog ?? []),
      {
        schema: "v100-phase-g-proof-transition/v1",
        from: epoch.state ?? null,
        to: state,
        reason,
        atPageTime: pageNow,
      },
    ],
  });

  const failEpoch = (epoch, code, detail = null, pageNow = 0) => {
    if (epoch?.schema !== PROOF_SCHEMA) return epoch;
    if (TERMINAL_STATES.has(epoch.state) || epoch.state === "FAILED") return epoch;
    return transition(epoch, "FAILED", code, pageNow, {
      terminalFailure: {
        schema: "v100-phase-g-proof-failure/v1",
        code,
        detail,
        atPageTime: pageNow,
      },
    });
  };

  const authoredPresentationFor = (fighter) => {
    const animationState = String(fighter?.animationPresentation?.state ?? "");
    const presentation = {
      attack: isFiniteReceiptNumber(fighter?.attack) ? fighter.attack : null,
      animationState,
      enemyVfxAttacking: fighter?.enemyVfx?.attacking === true,
      enemyVfxPhase: fighter?.enemyVfx?.phase ?? null,
    };
    return {
      presentation,
      observed: (isFiniteReceiptNumber(presentation.attack) && presentation.attack > 0)
        || presentation.enemyVfxAttacking === true
        || presentation.enemyVfxPhase === "attack"
        || /attack/u.test(animationState),
    };
  };

  const targetReactionFor = (fighter) => {
    const animationState = String(fighter?.animationPresentation?.state ?? "");
    const reaction = {
      flash: isFiniteReceiptNumber(fighter?.flash) ? fighter.flash : null,
      knock: isFiniteReceiptNumber(fighter?.knock) ? fighter.knock : null,
      animationState,
    };
    return {
      reaction,
      observed: (isFiniteReceiptNumber(reaction.flash) && reaction.flash > 0)
        || (isFiniteReceiptNumber(reaction.knock) && reaction.knock > 0)
        || /hurt|hit|stagger|die/u.test(animationState),
    };
  };

  const freshReactionFor = (baseline, current) => current?.observed === true && (
    baseline?.observed !== true
    || (isFiniteReceiptNumber(current.reaction?.flash)
      && (!isFiniteReceiptNumber(baseline?.reaction?.flash) || current.reaction.flash > baseline.reaction.flash))
    || (isFiniteReceiptNumber(current.reaction?.knock)
      && (!isFiniteReceiptNumber(baseline?.reaction?.knock) || current.reaction.knock > baseline.reaction.knock))
    || (
      /hurt|hit|stagger|die/u.test(String(current.reaction?.animationState ?? ""))
      && current.reaction.animationState !== baseline?.reaction?.animationState
    )
  );

  const exactAudioReceiptFor = (actor, epoch, requests, pageNow) => {
    if (!actor.cueId || !isFiniteReceiptNumber(pageNow)) return null;
    const request = (Array.isArray(requests) ? requests : []).find((candidate) => (
      candidate?.cueId === actor.cueId
      && isFiniteReceiptNumber(candidate?.at)
      && candidate.at > epoch.audioCueRequestCutoffAt
      && candidate.at <= pageNow
      && candidate.at <= epoch.visibleProofDeadlineAt
    )) ?? null;
    return request ? deepFreeze({
      schema: "v100-phase-g-exact-audio-receipt/v1",
      actorKey: actor.actorKey,
      cueId: actor.cueId,
      observedAtPageTime: request.at,
    }) : null;
  };

  const exactPendingImpactFor = (fighter, target, snapshot) => {
    const observedSequence = fighter?.attackSequence;
    const candidates = (Array.isArray(snapshot?.pendingWeaponHits) ? snapshot.pendingWeaponHits : []).filter((hit) => (
      String(hit?.sourceId) === String(fighter?.id)
      && String(hit?.targetId) === String(target?.id)
      && hit?.applyDamage === true
      && hit?.eventKind === "impact"
      && isFiniteReceiptNumber(hit?.damage)
      && hit.damage > 0
      && isFiniteReceiptNumber(hit?.impactDelaySeconds)
      && hit.impactDelaySeconds > 0
      && isFiniteReceiptNumber(hit?.remainingSeconds)
      && hit.remainingSeconds >= 0
      && hit.remainingSeconds <= hit.impactDelaySeconds
      && (
        hit?.attackSequence === null
        || hit?.attackSequence === undefined
        || (isFiniteReceiptNumber(hit.attackSequence) && hit.attackSequence === observedSequence)
      )
    ));
    if (candidates.length !== 1) return null;
    const hit = candidates[0];
    return deepFreeze({
      schema: TRANSPORT_SCHEMA,
      sourceId: fighter.id,
      targetId: target.id,
      sourceTargetEdge: `${fighter.id}->${target.id}`,
      transactionId: typeof hit.transactionId === "string" && hit.transactionId.length > 0 ? hit.transactionId : null,
      damageMode: typeof hit.damageMode === "string" ? hit.damageMode : null,
      weapon: typeof hit.weapon === "string" ? hit.weapon : null,
      eventKind: "impact",
      applyDamage: true,
      attackSequence: isFiniteReceiptNumber(hit.attackSequence) ? hit.attackSequence : null,
      damage: hit.damage,
      impactDelaySeconds: hit.impactDelaySeconds,
      remainingSecondsAtCommit: hit.remainingSeconds,
      observedAtBattleTime: snapshot.time,
    });
  };

  const sourceCommitFor = (actor, fighter, target, snapshot, pageNow) => {
    const authored = authoredPresentationFor(fighter);
    const reactionBaseline = targetReactionFor(target);
    const expectedTargetSide = actor.side === "human" ? "zombie" : actor.side === "zombie" ? "human" : null;
    const targetHpBefore = target?.hp;
    const identityValid = Number(fighter?.hp) > 0
      && fighter?.side === actor.side
      && fighter?.kind === actor.kind
      && String(fighter?.id) === String(actor.selectedFighterId)
      && target !== null
      && target !== undefined
      && target?.side === expectedTargetSide
      && isFiniteReceiptNumber(targetHpBefore)
      && targetHpBefore > 0
      && String(fighter?.id) !== String(target?.id)
      && String(fighter?.targetId) === String(target?.id);
    const numericDomainOk = [
      actor?.baselineAttackSequence,
      fighter?.attackSequence,
      snapshot?.time,
      pageNow,
      targetHpBefore,
    ].every(isFiniteReceiptNumber);
    if (!identityValid || !numericDomainOk || !authored.observed) return null;
    return deepFreeze({
      schema: "v100-phase-g-exact-source-commit/v1",
      actorKey: actor.actorKey,
      sourceId: fighter.id,
      sourceSide: fighter.side,
      sourceKind: fighter.kind,
      sourceAlive: true,
      targetId: target.id,
      targetSide: target.side,
      targetKind: target.kind,
      targetAlive: true,
      targetEvidenceSource: "live-attacker-target",
      sourceTargetEdge: `${fighter.id}->${target.id}`,
      baselineAttackSequence: actor.baselineAttackSequence,
      observedAttackSequence: fighter.attackSequence,
      sourceObservedAtBattleTime: snapshot.time,
      sourceObservedAtPageTime: pageNow,
      presentation: authored.presentation,
      targetHpBefore,
      reactionBaseline: reactionBaseline.reaction,
      reactionBaselineObserved: reactionBaseline.observed,
      transportReceipt: exactPendingImpactFor(fighter, target, snapshot),
      candidate: actor.releaseRole === "release-anchor" ? actor.activeCandidate : null,
    });
  };

  const contactReceiptFor = (actor, sourceCommit, target, snapshot, pageNow, causalMode) => {
    const reaction = targetReactionFor(target);
    const targetHpAtContact = target?.hp;
    const sourceTime = sourceCommit?.sourceObservedAtBattleTime;
    const sourcePageTime = sourceCommit?.sourceObservedAtPageTime;
    const contactTime = snapshot?.time;
    const exactIdentity = sourceCommit?.actorKey === actor.actorKey
      && String(sourceCommit?.sourceId) === String(actor.selectedFighterId)
      && String(target?.id) === String(sourceCommit?.targetId)
      && target?.side === sourceCommit?.targetSide
      && target?.kind === sourceCommit?.targetKind
      && isFiniteReceiptNumber(targetHpAtContact)
      && targetHpAtContact > 0;
    const numericDomainOk = [sourceTime, sourcePageTime, contactTime, pageNow, targetHpAtContact]
      .every(isFiniteReceiptNumber);
    if (!exactIdentity || !numericDomainOk || !reaction.observed) return null;
    if (causalMode === "same-snapshot-direct") {
      if (contactTime !== sourceTime || pageNow !== sourcePageTime || sourceCommit.transportReceipt !== null) return null;
    } else if (causalMode === "pending-impact") {
      const baseline = {
        observed: sourceCommit.reactionBaselineObserved === true,
        reaction: sourceCommit.reactionBaseline,
      };
      if (sourceCommit.transportReceipt?.schema !== TRANSPORT_SCHEMA
        || contactTime <= sourceTime
        || pageNow <= sourcePageTime
        || !(targetHpAtContact < sourceCommit.targetHpBefore)
        || !freshReactionFor(baseline, reaction)) return null;
    } else {
      return null;
    }
    return deepFreeze({
      schema: CONTACT_SCHEMA,
      causalMode,
      actorKey: actor.actorKey,
      sourceId: sourceCommit.sourceId,
      sourceSide: sourceCommit.sourceSide,
      sourceKind: sourceCommit.sourceKind,
      sourceAlive: sourceCommit.sourceAlive,
      targetId: sourceCommit.targetId,
      targetSide: sourceCommit.targetSide,
      targetKind: sourceCommit.targetKind,
      targetAlive: true,
      targetEvidenceSource: sourceCommit.targetEvidenceSource,
      sourceTargetEdge: sourceCommit.sourceTargetEdge,
      baselineAttackSequence: sourceCommit.baselineAttackSequence,
      observedAttackSequence: sourceCommit.observedAttackSequence,
      sourceObservedAtBattleTime: sourceTime,
      sourceObservedAtPageTime: sourcePageTime,
      observedAtBattleTime: contactTime,
      observedAtPageTime: pageNow,
      presentation: sourceCommit.presentation,
      transportReceipt: sourceCommit.transportReceipt,
      targetHpBefore: sourceCommit.targetHpBefore,
      targetHpAtContact,
      reaction: reaction.reaction,
    });
  };

  const witnessFor = (actor) => {
    const contact = actor.contactReceipt;
    if (contact?.schema !== CONTACT_SCHEMA || (actor.cueId && !actor.audioReceipt)) return null;
    const numericDomainOk = [
      contact.baselineAttackSequence,
      contact.observedAttackSequence,
      contact.sourceObservedAtBattleTime,
      contact.sourceObservedAtPageTime,
      contact.observedAtBattleTime,
      contact.observedAtPageTime,
      contact.targetHpBefore,
      contact.targetHpAtContact,
    ].every(isFiniteReceiptNumber);
    const audioDomainOk = !actor.cueId || isFiniteReceiptNumber(actor.audioReceipt?.observedAtPageTime);
    const candidate = actor.releaseRole === "release-anchor" ? actor.sourceCommitReceipt?.candidate ?? null : null;
    const candidateDomainOk = actor.releaseRole !== "release-anchor" || [
      candidate?.ordinal,
      candidate?.baselineAttackSequence,
      candidate?.attackWindupSeconds,
      candidate?.anchorBattleTime,
      candidate?.anchorPageTime,
      candidate?.commitWindowSeconds,
    ].every(isFiniteReceiptNumber);
    if (!numericDomainOk || !audioDomainOk || !candidateDomainOk) return null;
    const proofCompletedAtPageTime = Math.max(
      contact.observedAtPageTime,
      actor.cueId ? actor.audioReceipt.observedAtPageTime : contact.observedAtPageTime,
    );
    return deepFreeze({
      schema: WITNESS_SCHEMA,
      actorKey: actor.actorKey,
      releaseRole: actor.releaseRole,
      selectedFighterId: actor.selectedFighterId,
      sourceId: contact.sourceId,
      sourceSide: contact.sourceSide,
      sourceKind: contact.sourceKind,
      sourceAliveAtObservation: contact.sourceAlive === true,
      baselineAttackSequence: contact.baselineAttackSequence,
      observedAttackSequence: contact.observedAttackSequence,
      sourceObservedAtBattleTime: contact.sourceObservedAtBattleTime,
      sourceObservedAtPageTime: contact.sourceObservedAtPageTime,
      observedAtBattleTime: contact.observedAtBattleTime,
      observedAtPageTime: contact.observedAtPageTime,
      targetId: contact.targetId,
      targetSide: contact.targetSide,
      targetKind: contact.targetKind,
      targetAliveAtObservation: contact.targetAlive === true,
      targetEvidenceSource: contact.targetEvidenceSource,
      sourceTargetEdge: contact.sourceTargetEdge,
      cueId: actor.cueId,
      audioReceipt: actor.audioReceipt,
      contactReceipt: contact,
      candidateOrdinal: candidate?.ordinal ?? null,
      candidateOrigin: candidate?.origin ?? null,
      candidateTargetId: candidate?.targetId ?? null,
      candidateBaselineAttackSequence: candidate?.baselineAttackSequence ?? null,
      candidateAttackWindupSeconds: candidate?.attackWindupSeconds ?? null,
      candidateAnchorBattleTime: candidate?.anchorBattleTime ?? null,
      candidateAnchorPageTime: candidate?.anchorPageTime ?? null,
      candidateCommitWindowSeconds: candidate?.commitWindowSeconds ?? null,
      candidateCommitDeltaSeconds: candidate
        ? contact.sourceObservedAtBattleTime - candidate.anchorBattleTime
        : null,
      proofCompletedAtPageTime,
    });
  };

  const finalizeActorWitness = (actor) => {
    const witness = witnessFor(actor);
    return witness ? { ...actor, state: "WITNESS_ACCEPTED", witness } : actor;
  };

  const exactSourceSequenceFailureFor = (actor, fighterById) => {
    const source = fighterById.get(String(actor.selectedFighterId)) ?? null;
    if (!source) return null;
    if (source.side !== actor.side || source.kind !== actor.kind) {
      return { code: "EXACT_SOURCE_IDENTITY_INVALID_AFTER_COMMIT", actorKey: actor.actorKey };
    }
    if (!isFiniteReceiptNumber(source.attackSequence)
      || source.attackSequence !== actor.sourceCommitReceipt?.observedAttackSequence) {
      return {
        code: "EXACT_SOURCE_SECOND_SEQUENCE_BEFORE_WITNESS",
        actorKey: actor.actorKey,
        committedSequence: actor.sourceCommitReceipt?.observedAttackSequence ?? null,
        observedSequence: source.attackSequence ?? null,
      };
    }
    return null;
  };

  const advancePendingImpact = (actor, fighterById, snapshot, pageNow, audioRequests) => {
    const target = fighterById.get(String(actor.sourceCommitReceipt?.targetId)) ?? null;
    const sourceFailure = exactSourceSequenceFailureFor(actor, fighterById);
    if (sourceFailure) return { actor, failure: sourceFailure };
    if (!target
      || target.side !== actor.sourceCommitReceipt.targetSide
      || target.kind !== actor.sourceCommitReceipt.targetKind
      || Number(target.hp) <= 0) {
      return { actor, failure: {
        code: "EXACT_PENDING_IMPACT_TARGET_INVALID",
        actorKey: actor.actorKey,
        targetId: actor.sourceCommitReceipt.targetId,
      } };
    }
    const next = {
      ...actor,
      audioReceipt: actor.audioReceipt ?? exactAudioReceiptFor(actor, { ...actor.epochTiming }, audioRequests, pageNow),
    };
    const contactReceipt = contactReceiptFor(actor, actor.sourceCommitReceipt, target, snapshot, pageNow, "pending-impact");
    if (!contactReceipt) return { actor: next, failure: null };
    const contacted = {
      ...next,
      state: "CONTACT_ACCEPTED",
      contactReceipt,
      actorTransitionLog: [
        ...(actor.actorTransitionLog ?? []),
        { from: actor.state, to: "CONTACT_ACCEPTED", reason: "EXACT_PENDING_IMPACT_REACTION_ACCEPTED", atPageTime: pageNow },
      ],
    };
    return { actor: finalizeActorWitness(contacted), failure: null };
  };

  const advanceEpoch = (epoch, {
    snapshot,
    audioRequests = [],
    pageNow,
  } = {}) => {
    if (epoch?.schema !== PROOF_SCHEMA || epoch.state !== "OBSERVING") return epoch;
    if (![pageNow, epoch.visibleProofStartedAt, epoch.visibleProofDeadlineAt, epoch.audioCueRequestCutoffAt, snapshot?.time]
      .every(isFiniteReceiptNumber)) {
      return failEpoch(epoch, "V7_REQUIRED_NUMERIC_RECEIPT_DOMAIN_INVALID", { pageNow }, pageNow);
    }
    if (pageNow > epoch.visibleProofDeadlineAt) {
      return failEpoch(epoch, "VISIBLE_PROOF_DEADLINE_EXPIRED", { pageNow }, pageNow);
    }
    const fighterById = new Map((snapshot.fighters ?? []).map((fighter) => [String(fighter.id), fighter]));
    let failure = null;
    const actors = (epoch.actors ?? []).map((actor) => {
      if (actor.state === "WITNESS_ACCEPTED") return actor;
      const epochTiming = {
        audioCueRequestCutoffAt: epoch.audioCueRequestCutoffAt,
        visibleProofDeadlineAt: epoch.visibleProofDeadlineAt,
      };
      if (actor.state === "CONTACT_ACCEPTED") {
        const sourceFailure = exactSourceSequenceFailureFor(actor, fighterById);
        if (sourceFailure) {
          failure ??= sourceFailure;
          return actor;
        }
        return finalizeActorWitness({
          ...actor,
          epochTiming,
          audioReceipt: actor.audioReceipt ?? exactAudioReceiptFor(actor, epoch, audioRequests, pageNow),
        });
      }
      if (actor.state === "IMPACT_PENDING") {
        const pending = advancePendingImpact({ ...actor, epochTiming }, fighterById, snapshot, pageNow, audioRequests);
        failure ??= pending.failure;
        return pending.actor;
      }
      const fighter = fighterById.get(String(actor.selectedFighterId)) ?? null;
      if (!fighter || Number(fighter.hp) <= 0 || fighter.side !== actor.side || fighter.kind !== actor.kind) {
        failure ??= { code: "EXACT_SOURCE_IDENTITY_INVALID", actorKey: actor.actorKey, fighterId: actor.selectedFighterId };
        return actor;
      }
      const observedSequence = fighter.attackSequence;
      const baselineSequence = actor.baselineAttackSequence;
      if (![observedSequence, baselineSequence].every(isFiniteReceiptNumber)
        || observedSequence < baselineSequence || observedSequence > baselineSequence + 1) {
        failure ??= { code: "EXACT_ATTACK_SEQUENCE_INVALID", actorKey: actor.actorKey, baselineSequence, observedSequence };
        return actor;
      }
      let next = {
        ...actor,
        epochTiming,
        audioReceipt: actor.audioReceipt ?? exactAudioReceiptFor(actor, epoch, audioRequests, pageNow),
      };
      if (observedSequence === baselineSequence + 1) {
        if (actor.releaseRole === "release-anchor" && !actor.activeCandidate) {
          failure ??= { code: "RELEASE_ANCHOR_SEQUENCE_WITHOUT_ACTIVE_CANDIDATE", actorKey: actor.actorKey };
          return next;
        }
        const target = fighter.targetId === null || fighter.targetId === undefined
          ? null
          : fighterById.get(String(fighter.targetId)) ?? null;
        if (actor.releaseRole === "release-anchor" && String(target?.id) !== String(actor.originalTargetId)) {
          failure ??= { code: "RELEASE_ANCHOR_CONTACT_TARGET_MISMATCH", actorKey: actor.actorKey, targetId: target?.id ?? null };
          return next;
        }
        const sourceCommitReceipt = sourceCommitFor(actor, fighter, target, snapshot, pageNow);
        if (!sourceCommitReceipt) {
          failure ??= { code: "EXACT_SOURCE_COMMIT_RECEIPT_MISSING", actorKey: actor.actorKey, targetId: target?.id ?? null };
          return next;
        }
        if (actor.releaseRole === "release-anchor") {
          const delta = sourceCommitReceipt.sourceObservedAtBattleTime - actor.activeCandidate.anchorBattleTime;
          if (!isFiniteReceiptNumber(delta)
            || !isFiniteReceiptNumber(actor.activeCandidate.commitWindowSeconds)
            || delta < 0 || delta > actor.activeCandidate.commitWindowSeconds) {
            failure ??= {
              code: "RELEASE_ANCHOR_CANDIDATE_COMMIT_WINDOW_EXCEEDED",
              actorKey: actor.actorKey,
              delta,
              commitWindowSeconds: actor.activeCandidate.commitWindowSeconds,
              candidateOrdinal: actor.activeCandidate.ordinal,
            };
            return next;
          }
        }
        next = {
          ...next,
          state: "SOURCE_COMMITTED",
          sourceCommitReceipt,
          candidateHistory: actor.releaseRole === "release-anchor" ? [
            ...(actor.candidateHistory ?? []),
            deepFreeze({
              schema: "v100-phase-g-candidate-event/v1",
              event: "SOURCE_COMMITTED",
              candidateOrdinal: actor.activeCandidate.ordinal,
              observedAtBattleTime: sourceCommitReceipt.sourceObservedAtBattleTime,
              observedAtPageTime: sourceCommitReceipt.sourceObservedAtPageTime,
            }),
          ] : actor.candidateHistory,
          actorTransitionLog: [
            ...(actor.actorTransitionLog ?? []),
            { from: actor.state, to: "SOURCE_COMMITTED", reason: "EXACT_SOURCE_SEQUENCE_COMMITTED", atPageTime: pageNow },
          ],
        };
        if (sourceCommitReceipt.transportReceipt) {
          next = {
            ...next,
            state: "IMPACT_PENDING",
            actorTransitionLog: [
              ...next.actorTransitionLog,
              { from: "SOURCE_COMMITTED", to: "IMPACT_PENDING", reason: "EXACT_PENDING_IMPACT_FROZEN", atPageTime: pageNow },
            ],
          };
        } else {
          const directReceipt = contactReceiptFor(actor, sourceCommitReceipt, target, snapshot, pageNow, "same-snapshot-direct");
          if (!directReceipt) {
            failure ??= { code: "EXACT_CAUSAL_TRANSPORT_OR_DIRECT_REACTION_MISSING", actorKey: actor.actorKey, targetId: target?.id ?? null };
            return next;
          }
          next = {
            ...next,
            state: "CONTACT_ACCEPTED",
            contactReceipt: directReceipt,
            actorTransitionLog: [
              ...next.actorTransitionLog,
              { from: "SOURCE_COMMITTED", to: "CONTACT_ACCEPTED", reason: "EXACT_SAME_SNAPSHOT_DIRECT_ACCEPTED", atPageTime: pageNow },
            ],
          };
          next = finalizeActorWitness(next);
        }
      } else if (actor.releaseRole === "release-anchor") {
        const originalTarget = fighterById.get(String(actor.originalTargetId)) ?? null;
        if (!originalTarget || Number(originalTarget.hp) <= 0 || originalTarget.side !== actor.originalTargetSide) {
          failure ??= { code: "RELEASE_ANCHOR_ORIGINAL_TARGET_INVALID", actorKey: actor.actorKey, targetId: actor.originalTargetId };
          return next;
        }
        const windup = fighter.attackWindup;
        const directlyTracksOriginal = String(fighter.targetId) === String(actor.originalTargetId)
          && String(fighter.attackWindupTargetId) === String(actor.originalTargetId);
        if (actor.state === "TRACKING_CANDIDATE") {
          const restartedBeforeContact = isFiniteReceiptNumber(windup)
            && isFiniteReceiptNumber(actor.activeCandidate?.attackWindupSeconds)
            && windup > actor.activeCandidate.attackWindupSeconds;
          if (!(isFiniteReceiptNumber(windup) && windup > 0 && directlyTracksOriginal) || restartedBeforeContact) {
            const invalidation = deepFreeze({
              schema: "v100-phase-g-candidate-event/v1",
              event: "INVALIDATED",
              candidateOrdinal: actor.activeCandidate?.ordinal ?? null,
              reason: restartedBeforeContact
                ? "WINDUP_RESTARTED_BEFORE_CONTACT"
                : directlyTracksOriginal
                  ? "WINDUP_CLEARED_BEFORE_CONTACT"
                  : "WINDUP_TARGET_CHANGED_BEFORE_CONTACT",
              fighterId: fighter.id,
              targetId: fighter.targetId ?? null,
              attackWindupTargetId: fighter.attackWindupTargetId ?? null,
              attackSequence: observedSequence,
              attackWindup: isFiniteReceiptNumber(windup) ? windup : null,
              observedAtBattleTime: snapshot.time,
              observedAtPageTime: pageNow,
            });
            next = {
              ...next,
              state: "WAITING_SUCCESSOR",
              activeCandidate: null,
              successorContinuity: restartedBeforeContact && directlyTracksOriginal
                ? [{ battleTime: snapshot.time, pageTime: pageNow, windup }]
                : [],
              candidateHistory: [...(actor.candidateHistory ?? []), invalidation],
            };
          }
        } else if (actor.state === "WAITING_SUCCESSOR") {
          if (isFiniteReceiptNumber(windup) && windup > 0 && directlyTracksOriginal) {
            const previous = actor.successorContinuity?.at(-1) ?? null;
            const distinctProductionSnapshot = previous && snapshot.time > previous.battleTime;
            const decreasing = distinctProductionSnapshot && windup < previous.windup;
            const continuity = !previous || (distinctProductionSnapshot && !decreasing)
              ? [{ battleTime: snapshot.time, pageTime: pageNow, windup }]
              : !distinctProductionSnapshot
                ? actor.successorContinuity
                : [...actor.successorContinuity, { battleTime: snapshot.time, pageTime: pageNow, windup }];
            next = { ...next, successorContinuity: continuity };
            if (continuity.length >= 2
              && [continuity[0].windup, continuity.at(-1).windup, epoch.releaseAnchor.lateWindupMaxSeconds]
                .every(isFiniteReceiptNumber)
              && continuity[0].windup > continuity.at(-1).windup
              && continuity.at(-1).windup > 0
              && continuity.at(-1).windup <= epoch.releaseAnchor.lateWindupMaxSeconds) {
              const ordinal = actor.candidateOrdinal + 1;
              const commitWindowSeconds = releaseAnchorCommitWindowSecondsFor({ attackWindupSeconds: windup });
              if (![ordinal, windup, snapshot.time, pageNow, commitWindowSeconds].every(isFiniteReceiptNumber)) {
                failure ??= { code: "RELEASE_ANCHOR_CANDIDATE_NUMERIC_DOMAIN_INVALID", actorKey: actor.actorKey };
                return next;
              }
              const activeCandidate = deepFreeze({
                schema: "v100-phase-g-release-candidate/v1",
                ordinal,
                origin: "same-epoch-successor",
                fighterId: actor.selectedFighterId,
                targetId: actor.originalTargetId,
                baselineAttackSequence: actor.baselineAttackSequence,
                attackWindupSeconds: windup,
                anchorBattleTime: snapshot.time,
                anchorPageTime: pageNow,
                commitWindowSeconds,
                continuity,
              });
              next = {
                ...next,
                state: "TRACKING_CANDIDATE",
                candidateOrdinal: ordinal,
                activeCandidate,
                successorContinuity: [],
                candidateHistory: [
                  ...(actor.candidateHistory ?? []),
                  deepFreeze({ schema: "v100-phase-g-candidate-event/v1", event: "CREATED", candidate: activeCandidate }),
                ],
              };
            }
          } else if ((actor.successorContinuity ?? []).length > 0) {
            next = { ...next, successorContinuity: [] };
          }
        }
      }
      return next;
    });
    const currentActorStates = Object.fromEntries(actors.map((actor) => {
      const fighter = fighterById.get(String(actor.selectedFighterId)) ?? null;
      return [actor.actorKey, {
        fighterId: actor.selectedFighterId,
        alive: Number(fighter?.hp) > 0,
        attackSequence: isFiniteReceiptNumber(fighter?.attackSequence) ? fighter.attackSequence : null,
        observedAtBattleTime: snapshot.time,
        observedAtPageTime: pageNow,
      }];
    }));
    let nextEpoch = deepFreeze({ ...epoch, actors, currentActorStates });
    if (failure) return failEpoch(nextEpoch, failure.code, failure, pageNow);
    const acceptedWitnesses = actors.map((actor) => actor.witness).filter(Boolean);
    if (acceptedWitnesses.length === actors.length && actors.length > 0) {
      const genericEvidence = deepFreeze({
        schema: "v100-phase-g-generic-causal-evidence/v1",
        source: acceptedWitnesses.every((witness) => typeof witness.sourceTargetEdge === "string"),
        travelOrContact: acceptedWitnesses.every((witness) => witness.contactReceipt !== null),
        targetReaction: acceptedWitnesses.every((witness) => witness.contactReceipt?.reaction !== null),
        audio: acceptedWitnesses.every((witness) => !witness.cueId || witness.audioReceipt !== null),
        allRequirementsGreen: acceptedWitnesses.every((witness) => (
          typeof witness.sourceTargetEdge === "string"
          && witness.contactReceipt !== null
          && witness.contactReceipt?.reaction !== null
          && (!witness.cueId || witness.audioReceipt !== null)
        )),
      });
      if (genericEvidence.allRequirementsGreen) {
        nextEpoch = transition(nextEpoch, "WITNESS_ACCEPTED", "ALL_EXACT_AND_GENERIC_WITNESSES_ACCEPTED", pageNow, {
          actors,
          acceptedWitnesses,
          genericEvidence,
          proofCompletedAtPageTime: Math.max(...acceptedWitnesses.map((witness) => witness.proofCompletedAtPageTime)),
        });
      }
    }
    return nextEpoch;
  };

  const validateInstallEpoch = (epoch) => {
    if (epoch?.schema !== PROOF_SCHEMA || epoch?.state !== "OBSERVING") return false;
    const epochNumbers = [
      epoch.armedAtBattleTime,
      epoch.visibleProofStartedAt,
      epoch.visibleProofDeadlineAt,
      epoch.visibleProofDurationMs,
      epoch.audioCueRequestCutoffAt,
      epoch.audioCueRequestBaselineCount,
    ];
    if (!epochNumbers.every(isFiniteReceiptNumber)
      || epoch.visibleProofDeadlineAt < epoch.visibleProofStartedAt
      || epoch.audioCueRequestCutoffAt !== epoch.visibleProofStartedAt
      || epoch.proofCompletedAtPageTime !== null) return false;
    const releaseAnchor = epoch.releaseAnchor;
    if (!releaseAnchor || ![
      releaseAnchor.baselineAttackSequence,
      releaseAnchor.attackWindupSeconds,
      releaseAnchor.lateWindupMaxSeconds,
      releaseAnchor.continuitySampleCount,
      releaseAnchor.continuityFirstWindup,
      releaseAnchor.continuityLastWindup,
      releaseAnchor.continuityFirstBattleTime,
      releaseAnchor.continuityLastBattleTime,
      releaseAnchor.handoffAtBattleTime,
      releaseAnchor.handoffAtPageTime,
      releaseAnchor.selectionSnapshotObservedAtPageTime,
      releaseAnchor.selectionSnapshotBattleTime,
      releaseAnchor.sameTaskSnapshotReadCount,
    ].every(isFiniteReceiptNumber)) return false;
    return Array.isArray(epoch.actors) && epoch.actors.length > 0 && epoch.actors.every((actor) => (
      isFiniteReceiptNumber(actor?.baselineAttackSequence)
      && isFiniteReceiptNumber(actor?.candidateOrdinal)
      && (actor.releaseRole !== "release-anchor" || [
        actor.activeCandidate?.ordinal,
        actor.activeCandidate?.baselineAttackSequence,
        actor.activeCandidate?.attackWindupSeconds,
        actor.activeCandidate?.anchorBattleTime,
        actor.activeCandidate?.anchorPageTime,
        actor.activeCandidate?.commitWindowSeconds,
      ].every(isFiniteReceiptNumber))
    ));
  };

  const installEpoch = (epoch) => {
    if (!validateInstallEpoch(epoch)) throw new Error("PHASE_G_V7_EPOCH_INSTALL_SCHEMA_OR_DOMAIN_INVALID");
    return deepFreeze(epoch);
  };

  const attachScreenshotReceipt = (epoch, { screenshot, releaseDeadlineReceipt, pageNow } = {}) => {
    if (epoch?.schema !== PROOF_SCHEMA || epoch.state !== "WITNESS_ACCEPTED") {
      throw new Error(`PHASE_G_SCREENSHOT_RECEIPT_OUT_OF_ORDER:${epoch?.state ?? "missing"}`);
    }
    if (releaseDeadlineReceipt?.schema !== "v100-phase-g-release-deadline-receipt/v1"
      || releaseDeadlineReceipt.withinReleaseDeadline !== true
      || ![
        releaseDeadlineReceipt.pageNow,
        releaseDeadlineReceipt.visibleProofStartedAt,
        releaseDeadlineReceipt.visibleProofDeadlineAt,
        epoch.visibleProofStartedAt,
        epoch.visibleProofDeadlineAt,
        epoch.proofCompletedAtPageTime,
        pageNow,
      ].every(isFiniteReceiptNumber)
      || releaseDeadlineReceipt.visibleProofStartedAt !== epoch.visibleProofStartedAt
      || releaseDeadlineReceipt.visibleProofDeadlineAt !== epoch.visibleProofDeadlineAt
      || releaseDeadlineReceipt.pageNow < epoch.visibleProofStartedAt
      || releaseDeadlineReceipt.pageNow > epoch.visibleProofDeadlineAt) {
      throw new Error("PHASE_G_SCREENSHOT_DEADLINE_RECEIPT_INVALID");
    }
    return transition(epoch, "SCREENSHOT_RECEIPT_ACCEPTED", "PRODUCTION_SCREENSHOT_AND_DEADLINE_RECEIPT_ACCEPTED", pageNow, {
      screenshotReceipt: deepFreeze({
        schema: "v100-phase-g-screenshot-receipt/v1",
        screenshot,
        releaseDeadlineReceipt,
      }),
    });
  };

  const cleanEpoch = (epoch, { reason = "OBSERVER_STOP", pageNow } = {}) => {
    if (epoch?.schema !== PROOF_SCHEMA || TERMINAL_STATES.has(epoch.state)) return epoch ?? null;
    if (!isFiniteReceiptNumber(pageNow)) throw new Error("PHASE_G_CLEANUP_PAGE_TIME_INVALID");
    if (epoch.state === "SCREENSHOT_RECEIPT_ACCEPTED") {
      return transition(epoch, "CLEANED", reason, pageNow, {
        cleanupReceipt: deepFreeze({
          schema: "v100-phase-g-proof-cleanup-receipt/v1",
          outcome: "success",
          reason,
          atPageTime: pageNow,
        }),
      });
    }
    const failed = failEpoch(epoch, "CLEANUP_BEFORE_SUCCESS_TERMINAL", { reason }, pageNow);
    return transition(failed, "CLEANED_AFTER_FAILURE", reason, pageNow, {
      cleanupReceipt: deepFreeze({
        schema: "v100-phase-g-proof-cleanup-receipt/v1",
        outcome: "failure",
        reason,
        atPageTime: pageNow,
      }),
    });
  };

  const postQuiescenceExactActorDecision = (proofEpoch, { requiredActorKeys = [] } = {}) => {
    const required = [...new Set(requiredActorKeys.filter((key) => typeof key === "string" && key.includes(":")))];
    if (required.length === 0) return deepFreeze({
      accepted: true,
      schemaOk: proofEpoch === null || proofEpoch === undefined || proofEpoch?.schema === PROOF_SCHEMA,
      proofCompletedAtPageTime: null,
      withinReleaseDeadline: true,
      requiredActorKeys: [],
      observedActorKeys: [],
      missingActorKeys: [],
      actors: [],
    });
    const schemaOk = proofEpoch?.schema === PROOF_SCHEMA;
    const witnessStateOk = ACCEPTED_STATES.has(proofEpoch?.state);
    const acceptedWitnesses = schemaOk && Array.isArray(proofEpoch.acceptedWitnesses) ? proofEpoch.acceptedWitnesses : [];
    const acceptedWitnessesCardinalityOk = acceptedWitnesses.length === required.length
      && required.every((actorKey) => acceptedWitnesses.filter((witness) => witness?.actorKey === actorKey).length === 1);
    const epochNumericDomainOk = [
      proofEpoch?.visibleProofStartedAt,
      proofEpoch?.visibleProofDeadlineAt,
      proofEpoch?.audioCueRequestCutoffAt,
      proofEpoch?.proofCompletedAtPageTime,
    ].every(isFiniteReceiptNumber)
      && proofEpoch.visibleProofDeadlineAt >= proofEpoch.visibleProofStartedAt
      && proofEpoch.audioCueRequestCutoffAt === proofEpoch.visibleProofStartedAt;
    const screenshotDeadlineReceipt = proofEpoch?.screenshotReceipt?.releaseDeadlineReceipt ?? null;
    const screenshotDeadlineNumericDomainOk = proofEpoch?.state === "WITNESS_ACCEPTED" || (
      ["SCREENSHOT_RECEIPT_ACCEPTED", "CLEANED"].includes(proofEpoch?.state)
      && proofEpoch?.screenshotReceipt?.schema === "v100-phase-g-screenshot-receipt/v1"
      && screenshotDeadlineReceipt?.schema === "v100-phase-g-release-deadline-receipt/v1"
      && [screenshotDeadlineReceipt.pageNow, screenshotDeadlineReceipt.visibleProofStartedAt, screenshotDeadlineReceipt.visibleProofDeadlineAt]
        .every(isFiniteReceiptNumber)
      && screenshotDeadlineReceipt.visibleProofStartedAt === proofEpoch.visibleProofStartedAt
      && screenshotDeadlineReceipt.visibleProofDeadlineAt === proofEpoch.visibleProofDeadlineAt
      && screenshotDeadlineReceipt.pageNow >= proofEpoch.visibleProofStartedAt
      && screenshotDeadlineReceipt.pageNow <= proofEpoch.visibleProofDeadlineAt
      && screenshotDeadlineReceipt.withinReleaseDeadline === true
    );
    const releaseAnchorExpectedKey = required[0] ?? null;
    const releaseAnchor = schemaOk ? proofEpoch.releaseAnchor ?? null : null;
    const releaseAnchorNumericDomainOk = [
      releaseAnchor?.baselineAttackSequence,
      releaseAnchor?.attackWindupSeconds,
      releaseAnchor?.lateWindupMaxSeconds,
      releaseAnchor?.continuitySampleCount,
      releaseAnchor?.continuityFirstWindup,
      releaseAnchor?.continuityLastWindup,
      releaseAnchor?.continuityFirstBattleTime,
      releaseAnchor?.continuityLastBattleTime,
      releaseAnchor?.handoffAtBattleTime,
      releaseAnchor?.handoffAtPageTime,
    ].every(isFiniteReceiptNumber);
    const releaseAnchorOk = releaseAnchorNumericDomainOk
      && releaseAnchor?.handoffValid === true
      && releaseAnchor.actorKey === releaseAnchorExpectedKey
      && releaseAnchor.releaseMode === "unconsumed-production-windup"
      && releaseAnchor.fighterId !== null
      && releaseAnchor.fighterId !== undefined
      && releaseAnchor.targetId !== null
      && releaseAnchor.targetId !== undefined
      && releaseAnchor.targetAlive === true
      && releaseAnchor.attackWindupSeconds > 0
      && releaseAnchor.attackWindupSeconds <= schedulerToleranceSeconds
      && releaseAnchor.lateWindupMaxSeconds === schedulerToleranceSeconds
      && releaseAnchor.continuitySampleCount >= 2
      && releaseAnchor.continuityFirstWindup > releaseAnchor.continuityLastWindup
      && releaseAnchor.continuityLastWindup === releaseAnchor.attackWindupSeconds
      && releaseAnchor.continuityFirstBattleTime < releaseAnchor.continuityLastBattleTime
      && releaseAnchor.continuityLastBattleTime === releaseAnchor.handoffAtBattleTime
      && releaseAnchor.handoffAtPageTime === proofEpoch.visibleProofStartedAt;
    const actors = required.map((actorKey) => {
      const splitAt = actorKey.indexOf(":");
      const side = actorKey.slice(0, splitAt);
      const witness = acceptedWitnesses.find((candidate) => candidate?.actorKey === actorKey) ?? null;
      const contact = witness?.contactReceipt ?? null;
      const selectedIdentity = witness?.selectedFighterId !== null
        && witness?.selectedFighterId !== undefined
        && String(witness?.sourceId) === String(witness.selectedFighterId)
        && witness?.sourceSide === side
        && witness?.sourceKind === actorKey.slice(splitAt + 1);
      const witnessNumericDomainOk = [
        witness?.baselineAttackSequence,
        witness?.observedAttackSequence,
        witness?.sourceObservedAtBattleTime,
        witness?.sourceObservedAtPageTime,
        witness?.observedAtBattleTime,
        witness?.observedAtPageTime,
        witness?.proofCompletedAtPageTime,
      ].every(isFiniteReceiptNumber);
      const sequenceAdvanced = witnessNumericDomainOk
        && witness.observedAttackSequence === witness.baselineAttackSequence + 1;
      const expectedTargetSide = side === "human" ? "zombie" : side === "zombie" ? "human" : null;
      const targetValid = witness?.targetId !== null
        && witness?.targetId !== undefined
        && expectedTargetSide !== null
        && witness?.targetSide === expectedTargetSide
        && witness?.targetAliveAtObservation === true
        && String(witness.sourceId) !== String(witness.targetId);
      const cueValid = witness?.cueId
        ? witness?.audioReceipt?.schema === "v100-phase-g-exact-audio-receipt/v1"
          && witness.audioReceipt.cueId === witness.cueId
          && isFiniteReceiptNumber(witness.audioReceipt.observedAtPageTime)
        : true;
      const contactNumericDomainOk = contact?.schema === CONTACT_SCHEMA
        && [
          contact.baselineAttackSequence,
          contact.observedAttackSequence,
          contact.sourceObservedAtBattleTime,
          contact.sourceObservedAtPageTime,
          contact.observedAtBattleTime,
          contact.observedAtPageTime,
          contact.targetHpBefore,
          contact.targetHpAtContact,
        ].every(isFiniteReceiptNumber);
      const pendingTransportValid = contact?.causalMode !== "pending-impact" || (
        contact.transportReceipt?.schema === TRANSPORT_SCHEMA
        && String(contact.transportReceipt.sourceId) === String(contact.sourceId)
        && String(contact.transportReceipt.targetId) === String(contact.targetId)
        && contact.transportReceipt.sourceTargetEdge === contact.sourceTargetEdge
        && contact.transportReceipt.applyDamage === true
        && isFiniteReceiptNumber(contact.transportReceipt.damage)
        && contact.transportReceipt.damage > 0
        && isFiniteReceiptNumber(contact.transportReceipt.impactDelaySeconds)
        && contact.transportReceipt.impactDelaySeconds > 0
        && isFiniteReceiptNumber(contact.transportReceipt.remainingSecondsAtCommit)
        && contact.transportReceipt.remainingSecondsAtCommit >= 0
        && isFiniteReceiptNumber(contact.transportReceipt.observedAtBattleTime)
        && contact.transportReceipt.observedAtBattleTime === contact.sourceObservedAtBattleTime
        && (
          contact.transportReceipt.attackSequence === null
          || (
            isFiniteReceiptNumber(contact.transportReceipt.attackSequence)
            && contact.transportReceipt.attackSequence === contact.observedAttackSequence
          )
        )
        && contact.observedAtBattleTime > contact.sourceObservedAtBattleTime
        && contact.observedAtPageTime > contact.sourceObservedAtPageTime
        && contact.targetHpAtContact > 0
        && contact.targetHpAtContact < contact.targetHpBefore
      );
      const directModeValid = contact?.causalMode !== "same-snapshot-direct" || (
        contact.transportReceipt === null
        && contact.observedAtBattleTime === contact.sourceObservedAtBattleTime
        && contact.observedAtPageTime === contact.sourceObservedAtPageTime
      );
      const releaseAnchorIdentityValid = actorKey !== releaseAnchorExpectedKey || (
        releaseAnchorOk
        && witness?.releaseRole === "release-anchor"
        && String(witness?.selectedFighterId) === String(releaseAnchor.fighterId)
        && witness?.baselineAttackSequence === releaseAnchor.baselineAttackSequence
        && String(witness?.targetId) === String(releaseAnchor.targetId)
      );
      const candidateNumericDomainOk = actorKey !== releaseAnchorExpectedKey || [
        witness?.candidateOrdinal,
        witness?.candidateBaselineAttackSequence,
        witness?.candidateAttackWindupSeconds,
        witness?.candidateAnchorBattleTime,
        witness?.candidateAnchorPageTime,
        witness?.candidateCommitWindowSeconds,
        witness?.candidateCommitDeltaSeconds,
      ].every(isFiniteReceiptNumber);
      const expectedCommitWindow = actorKey === releaseAnchorExpectedKey
        ? releaseAnchorCommitWindowSecondsFor({ attackWindupSeconds: witness?.candidateAttackWindupSeconds })
        : null;
      const releaseAnchorCandidateBindingValid = actorKey !== releaseAnchorExpectedKey || (
        candidateNumericDomainOk
        && ["release-anchor", "same-epoch-successor"].includes(witness?.candidateOrigin)
        && witness.candidateOrdinal >= 1
        && String(witness.candidateTargetId) === String(releaseAnchor.targetId)
        && witness.candidateBaselineAttackSequence === releaseAnchor.baselineAttackSequence
        && witness.candidateAnchorPageTime >= proofEpoch.visibleProofStartedAt
        && witness.candidateAnchorPageTime <= witness.sourceObservedAtPageTime
        && witness.candidateCommitWindowSeconds === expectedCommitWindow
        && witness.candidateCommitDeltaSeconds === witness.sourceObservedAtBattleTime - witness.candidateAnchorBattleTime
      );
      const releaseAnchorCommitBoundValid = actorKey !== releaseAnchorExpectedKey || (
        releaseAnchorCandidateBindingValid
        && witness.candidateCommitDeltaSeconds >= 0
        && witness.candidateCommitDeltaSeconds <= witness.candidateCommitWindowSeconds
      );
      const eventTimeValid = epochNumericDomainOk
        && witnessNumericDomainOk
        && witness.sourceObservedAtPageTime >= proofEpoch.visibleProofStartedAt
        && witness.sourceObservedAtPageTime <= witness.observedAtPageTime
        && witness.observedAtPageTime <= proofEpoch.visibleProofDeadlineAt
        && witness.proofCompletedAtPageTime >= witness.observedAtPageTime
        && witness.proofCompletedAtPageTime <= proofEpoch.visibleProofDeadlineAt;
      const accepted = witness?.schema === WITNESS_SCHEMA
        && witness?.sourceAliveAtObservation === true
        && selectedIdentity
        && sequenceAdvanced
        && targetValid
        && witness?.targetEvidenceSource === "live-attacker-target"
        && cueValid
        && contactNumericDomainOk
        && ["same-snapshot-direct", "pending-impact"].includes(contact?.causalMode)
        && pendingTransportValid
        && directModeValid
        && releaseAnchorIdentityValid
        && releaseAnchorCommitBoundValid
        && eventTimeValid;
      return deepFreeze({
        actorKey,
        accepted,
        actorPresent: Boolean(witness),
        actorAlive: proofEpoch?.currentActorStates?.[actorKey]?.alive === true,
        sourceAliveAtObservation: witness?.sourceAliveAtObservation === true,
        selectedIdentity,
        sequenceAdvanced,
        targetValid,
        targetEvidenceSourceValid: witness?.targetEvidenceSource === "live-attacker-target",
        cueValid,
        witnessNumericDomainOk,
        contactNumericDomainOk,
        pendingTransportValid,
        directModeValid,
        candidateNumericDomainOk,
        releaseAnchorIdentityValid,
        releaseAnchorCandidateBindingValid,
        releaseAnchorCommitBoundValid,
        releaseAnchorCommitDeltaSeconds: witness?.candidateCommitDeltaSeconds ?? null,
        releaseAnchorCommitWindowSeconds: witness?.candidateCommitWindowSeconds ?? null,
        eventTimeValid,
        selectedFighterId: witness?.selectedFighterId ?? null,
        observedFighterId: witness?.sourceId ?? null,
        baselineAttackSequence: witness?.baselineAttackSequence ?? null,
        observedAttackSequence: witness?.observedAttackSequence ?? null,
        sourceObservedAtBattleTime: witness?.sourceObservedAtBattleTime ?? null,
        sourceObservedAtPageTime: witness?.sourceObservedAtPageTime ?? null,
        observedAtBattleTime: witness?.observedAtBattleTime ?? null,
        observedAtPageTime: witness?.observedAtPageTime ?? null,
        targetId: witness?.targetId ?? null,
        targetSide: witness?.targetSide ?? null,
        targetAlive: witness?.targetAliveAtObservation ?? null,
        targetEvidenceSource: witness?.targetEvidenceSource ?? null,
        directContactReceipt: contact,
        cueId: witness?.cueId ?? null,
        audioObserved: witness?.cueId ? cueValid : null,
        audioObservedAtPageTime: witness?.audioReceipt?.observedAtPageTime ?? null,
        proofCompletedAtPageTime: witness?.proofCompletedAtPageTime ?? null,
      });
    });
    const observedActorKeys = actors.filter((actor) => actor.accepted).map((actor) => actor.actorKey);
    const proofTimes = actors.map((actor) => actor.proofCompletedAtPageTime);
    const proofCompletedAtPageTime = proofTimes.length === actors.length && proofTimes.every(isFiniteReceiptNumber)
      ? Math.max(...proofTimes)
      : null;
    const withinReleaseDeadline = epochNumericDomainOk
      && isFiniteReceiptNumber(proofCompletedAtPageTime)
      && proofCompletedAtPageTime === proofEpoch.proofCompletedAtPageTime
      && proofCompletedAtPageTime >= proofEpoch.visibleProofStartedAt
      && proofCompletedAtPageTime <= proofEpoch.visibleProofDeadlineAt;
    return deepFreeze({
      accepted: schemaOk
        && witnessStateOk
        && acceptedWitnessesCardinalityOk
        && epochNumericDomainOk
        && screenshotDeadlineNumericDomainOk
        && releaseAnchorOk
        && proofEpoch?.genericEvidence?.allRequirementsGreen === true
        && observedActorKeys.length === required.length
        && withinReleaseDeadline,
      schemaOk,
      witnessStateOk,
      acceptedWitnessesCardinalityOk,
      epochNumericDomainOk,
      screenshotDeadlineNumericDomainOk,
      releaseAnchorNumericDomainOk,
      releaseAnchorOk,
      releaseAnchor,
      proofCompletedAtPageTime,
      withinReleaseDeadline,
      requiredActorKeys: required,
      observedActorKeys,
      missingActorKeys: required.filter((key) => !observedActorKeys.includes(key)),
      actors,
    });
  };

  const exactActorDirectContactCausalDecision = (proofEpoch, { requiredActorKeys = [] } = {}) => {
    const required = [...new Set(requiredActorKeys.filter((key) => typeof key === "string" && key.includes(":")))];
    const exactDecision = postQuiescenceExactActorDecision(proofEpoch, { requiredActorKeys: required });
    const schemaOk = proofEpoch?.schema === PROOF_SCHEMA;
    const actors = required.map((actorKey) => {
      const witness = schemaOk
        ? proofEpoch.acceptedWitnesses?.find((candidate) => candidate?.actorKey === actorKey) ?? null
        : null;
      const exactActor = exactDecision.actors?.find((candidate) => candidate.actorKey === actorKey) ?? null;
      const receipt = witness?.contactReceipt ?? null;
      const receiptPresent = receipt !== null && receipt !== undefined;
      const expectedTargetSide = witness?.sourceSide === "human" ? "zombie" : witness?.sourceSide === "zombie" ? "human" : null;
      const identityValid = receiptPresent
        && receipt.schema === CONTACT_SCHEMA
        && receipt.actorKey === actorKey
        && String(receipt.sourceId) === String(witness?.selectedFighterId)
        && String(receipt.sourceId) === String(witness?.sourceId)
        && receipt.sourceSide === witness?.sourceSide
        && receipt.sourceKind === witness?.sourceKind
        && receipt.sourceAlive === true
        && receipt.targetEvidenceSource === "live-attacker-target"
        && String(receipt.targetId) === String(witness?.targetId)
        && receipt.targetSide === witness?.targetSide
        && receipt.targetKind === witness?.targetKind
        && receipt.targetAlive === true
        && receipt.targetSide === expectedTargetSide
        && String(receipt.sourceId) !== String(receipt.targetId)
        && receipt.sourceTargetEdge === `${receipt.sourceId}->${receipt.targetId}`;
      const sequenceValid = receiptPresent
        && [receipt.baselineAttackSequence, receipt.observedAttackSequence, witness?.baselineAttackSequence, witness?.observedAttackSequence]
          .every(isFiniteReceiptNumber)
        && receipt.baselineAttackSequence === witness.baselineAttackSequence
        && receipt.observedAttackSequence === receipt.baselineAttackSequence + 1
        && receipt.observedAttackSequence === witness.observedAttackSequence;
      const eventTimeValid = receiptPresent
        && [
          receipt.sourceObservedAtBattleTime,
          receipt.sourceObservedAtPageTime,
          receipt.observedAtBattleTime,
          receipt.observedAtPageTime,
          witness?.sourceObservedAtBattleTime,
          witness?.sourceObservedAtPageTime,
          witness?.observedAtBattleTime,
          witness?.observedAtPageTime,
          proofEpoch?.visibleProofStartedAt,
          proofEpoch?.visibleProofDeadlineAt,
        ].every(isFiniteReceiptNumber)
        && receipt.sourceObservedAtBattleTime === witness.sourceObservedAtBattleTime
        && receipt.sourceObservedAtPageTime === witness.sourceObservedAtPageTime
        && receipt.observedAtBattleTime === witness.observedAtBattleTime
        && receipt.observedAtPageTime === witness.observedAtPageTime
        && receipt.sourceObservedAtPageTime >= proofEpoch.visibleProofStartedAt
        && receipt.sourceObservedAtPageTime <= receipt.observedAtPageTime
        && receipt.observedAtPageTime <= proofEpoch.visibleProofDeadlineAt;
      const presentation = receipt?.presentation ?? null;
      const authoredPresentationValid = receiptPresent && (
        (isFiniteReceiptNumber(presentation?.attack) && presentation.attack > 0)
        || presentation?.enemyVfxAttacking === true
        || presentation?.enemyVfxPhase === "attack"
        || /attack/u.test(String(presentation?.animationState ?? ""))
      );
      const reaction = receipt?.reaction ?? null;
      const reactionValid = receiptPresent && (
        (isFiniteReceiptNumber(reaction?.flash) && reaction.flash > 0)
        || (isFiniteReceiptNumber(reaction?.knock) && reaction.knock > 0)
        || /hurt|hit|stagger|die/u.test(String(reaction?.animationState ?? ""))
      );
      const reactionObservations = [];
      if (identityValid && eventTimeValid && isFiniteReceiptNumber(reaction?.flash) && reaction.flash > 0) {
        reactionObservations.push({
          battleTime: receipt.observedAtBattleTime,
          targetId: receipt.targetId,
          targetSide: receipt.targetSide,
          targetKind: receipt.targetKind,
          channel: "fighter-flash",
          state: null,
          value: reaction.flash,
        });
      }
      if (identityValid && eventTimeValid && isFiniteReceiptNumber(reaction?.knock) && reaction.knock > 0) {
        reactionObservations.push({
          battleTime: receipt.observedAtBattleTime,
          targetId: receipt.targetId,
          targetSide: receipt.targetSide,
          targetKind: receipt.targetKind,
          channel: "fighter-knock",
          state: null,
          value: reaction.knock,
        });
      }
      if (identityValid && eventTimeValid && /hurt|hit|stagger|die/u.test(String(reaction?.animationState ?? ""))) {
        reactionObservations.push({
          battleTime: receipt.observedAtBattleTime,
          targetId: receipt.targetId,
          targetSide: receipt.targetSide,
          targetKind: receipt.targetKind,
          channel: "fighter-animation",
          state: reaction.animationState,
          value: null,
        });
      }
      const accepted = exactActor?.accepted === true
        && identityValid
        && sequenceValid
        && eventTimeValid
        && authoredPresentationValid
        && reactionValid;
      return deepFreeze({
        actorKey,
        receiptPresent,
        accepted,
        exactActorAccepted: exactActor?.accepted === true,
        identityValid,
        sequenceValid,
        eventTimeValid,
        authoredPresentationValid,
        reactionValid,
        receipt,
        reactionObservations,
      });
    });
    const presentActorKeys = actors.filter((actor) => actor.receiptPresent).map((actor) => actor.actorKey);
    const acceptedActorKeys = actors.filter((actor) => actor.accepted).map((actor) => actor.actorKey);
    const rejectedActorKeys = actors.filter((actor) => actor.receiptPresent && !actor.accepted).map((actor) => actor.actorKey);
    return deepFreeze({
      schema: "v100-phase-g-exact-actor-direct-contact-decision/v1",
      schemaOk,
      requiredActorKeys: required,
      presentActorKeys,
      acceptedActorKeys,
      rejectedActorKeys,
      integrityOk: rejectedActorKeys.length === 0,
      hasAcceptedReceipt: acceptedActorKeys.length > 0,
      actors,
    });
  };

  const installGlobals = (target) => {
    const now = () => target.performance.now();
    target.__PHASE_G_PROOF_MACHINE__ = api;
    target.__PHASE_G_IS_FINITE_RECEIPT_NUMBER__ = isFiniteReceiptNumber;
    target.__PHASE_G_RELEASE_ANCHOR_COMMIT_WINDOW_SECONDS_FOR__ = releaseAnchorCommitWindowSecondsFor;
    target.__PHASE_G_INSTALL_POST_QUIESCENCE_PROOF_EPOCH__ = (epoch) => {
      const installed = installEpoch(epoch);
      target.__PHASE_G_POST_QUIESCENCE_PROOF_EPOCH__ = installed;
      return installed;
    };
    target.__PHASE_G_ADVANCE_POST_QUIESCENCE_PROOF_EPOCH__ = (snapshot) => {
      const next = advanceEpoch(target.__PHASE_G_POST_QUIESCENCE_PROOF_EPOCH__, {
        snapshot,
        audioRequests: target.__ASHFALL_AUDIO_QA__?.getCueRequests?.() ?? [],
        pageNow: now(),
      });
      target.__PHASE_G_POST_QUIESCENCE_PROOF_EPOCH__ = next;
      return next;
    };
    target.__PHASE_G_ATTACH_SCREENSHOT_RECEIPT__ = ({ screenshot, releaseDeadlineReceipt }) => {
      const next = attachScreenshotReceipt(target.__PHASE_G_POST_QUIESCENCE_PROOF_EPOCH__, {
        screenshot,
        releaseDeadlineReceipt,
        pageNow: now(),
      });
      target.__PHASE_G_POST_QUIESCENCE_PROOF_EPOCH__ = next;
      return next;
    };
    target.__PHASE_G_FAIL_PROOF_TRANSACTION__ = (code, detail = null) => {
      const next = failEpoch(target.__PHASE_G_POST_QUIESCENCE_PROOF_EPOCH__, code, detail, now());
      target.__PHASE_G_POST_QUIESCENCE_PROOF_EPOCH__ = next;
      return next;
    };
    target.__PHASE_G_CLEAN_PROOF_TRANSACTION__ = (reason = "OBSERVER_STOP") => {
      const next = cleanEpoch(target.__PHASE_G_POST_QUIESCENCE_PROOF_EPOCH__, { reason, pageNow: now() });
      target.__PHASE_G_POST_QUIESCENCE_PROOF_EPOCH__ = next;
      return next;
    };
    return api;
  };

  const api = Object.freeze({
    proofSchema: PROOF_SCHEMA,
    contactSchema: CONTACT_SCHEMA,
    witnessSchema: WITNESS_SCHEMA,
    transportSchema: TRANSPORT_SCHEMA,
    isFiniteReceiptNumber,
    releaseAnchorCommitWindowSecondsFor,
    installEpoch,
    advanceEpoch,
    failEpoch,
    attachScreenshotReceipt,
    cleanEpoch,
    postQuiescenceExactActorDecision,
    exactActorDirectContactCausalDecision,
    installGlobals,
  });
  return api;
}
