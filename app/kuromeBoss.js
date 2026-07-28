import { deepFreeze } from "./content/freeze.js";

export const KUROME_PROTOTYPE_TUNING = deepFreeze({
  warningSeconds: 1.25,
  trackingSeconds: .82,
  fireSeconds: .18,
  recoverySeconds: .82,
  interferenceSeconds: 1.2,
  beamHalfWidth: 18,
  finalPhaseBeamHalfWidth: 23,
  damage: 32,
  finalPhaseDamage: 39,
  cooldownSeconds: 5.8,
  finalPhaseCooldownSeconds: 4.4,
});

export function createKuromeTrackingRuntime() {
  return deepFreeze({
    phase: "idle",
    remainingSeconds: 0,
    targetId: null,
    targetX: null,
    targetY: null,
    lane: null,
  });
}

export function beginKuromeTracking(target) {
  if (!target || target.side !== "human" || Number(target.hp) <= 0 || target.combatReady === false) {
    return deepFreeze({ ok: false, runtime: createKuromeTrackingRuntime() });
  }
  return deepFreeze({
    ok: true,
    runtime: {
      phase: "tracking",
      remainingSeconds: KUROME_PROTOTYPE_TUNING.warningSeconds,
      targetId: String(target.id),
      targetX: Number(target.x) || 0,
      targetY: Number(target.y) || 0,
      lane: Number.isInteger(target.lane) ? target.lane : null,
    },
  });
}

export function advanceKuromeTracking(runtime, elapsedSeconds, liveTarget = null) {
  const current = runtime?.phase ? runtime : createKuromeTrackingRuntime();
  const elapsed = Math.max(0, Number(elapsedSeconds) || 0);
  if (current.phase === "idle") return deepFreeze({ runtime: current, fired: false, recovered: false });
  if (current.phase === "tracking" || current.phase === "locked") {
    const remainingSeconds = Math.max(0, Number(current.remainingSeconds) - elapsed);
    const lockThreshold = KUROME_PROTOTYPE_TUNING.warningSeconds - KUROME_PROTOTYPE_TUNING.trackingSeconds;
    const stillTracking = remainingSeconds > lockThreshold;
    const mayTrack = stillTracking
      && liveTarget
      && liveTarget.side === "human"
      && Number(liveTarget.hp) > 0
      && liveTarget.combatReady !== false;
    const next = {
      ...current,
      phase: stillTracking ? "tracking" : "locked",
      remainingSeconds,
      targetX: mayTrack ? Number(liveTarget.x) || 0 : current.targetX,
      targetY: mayTrack ? Number(liveTarget.y) || 0 : current.targetY,
      lane: mayTrack && Number.isInteger(liveTarget.lane) ? liveTarget.lane : current.lane,
    };
    if (remainingSeconds > 0) return deepFreeze({ runtime: next, fired: false, recovered: false });
    return deepFreeze({
      runtime: {
        ...next,
        phase: "firing",
        remainingSeconds: KUROME_PROTOTYPE_TUNING.fireSeconds,
      },
      fired: true,
      recovered: false,
    });
  }
  if (current.phase === "firing") {
    const remainingSeconds = Math.max(0, Number(current.remainingSeconds) - elapsed);
    if (remainingSeconds > 0) {
      return deepFreeze({ runtime: { ...current, remainingSeconds }, fired: false, recovered: false });
    }
    return deepFreeze({
      runtime: { ...current, phase: "recovery", remainingSeconds: KUROME_PROTOTYPE_TUNING.recoverySeconds },
      fired: false,
      recovered: false,
    });
  }
  if (current.phase === "recovery") {
    const remainingSeconds = Math.max(0, Number(current.remainingSeconds) - elapsed);
    if (remainingSeconds > 0) {
      return deepFreeze({ runtime: { ...current, remainingSeconds }, fired: false, recovered: false });
    }
    return deepFreeze({ runtime: createKuromeTrackingRuntime(), fired: false, recovered: true });
  }
  return deepFreeze({ runtime: createKuromeTrackingRuntime(), fired: false, recovered: true });
}

export function kuromeEmergencyEvadePlan({
  runtime,
  target,
  tap,
  laneCenters = [212, 282, 352],
} = {}) {
  if (!["tracking", "locked"].includes(runtime?.phase)
    || !target
    || String(runtime.targetId) !== String(target.id)
    || target.side !== "human"
    || Number(target.hp) <= 0
    || target.combatReady === false) {
    return deepFreeze({ ok: false, reason: "not-targeted" });
  }
  const targetX = Number(target.x) || 0;
  const targetY = Number(target.y) || 0;
  const tapX = Number(tap?.x);
  const tapY = Number(tap?.y);
  const horizontalRadius = Math.max(44, (Number(target.bodyRadius) || 0) * 3.2);
  const verticalRadius = Math.max(58, horizontalRadius * 1.2);
  const hitsTarget = Number.isFinite(tapX)
    && Number.isFinite(tapY)
    && Math.abs(tapX - targetX) <= horizontalRadius
    && Math.abs(tapY - (targetY - 30)) <= verticalRadius;
  if (!hitsTarget) return deepFreeze({ ok: false, reason: "tap-missed" });

  const currentLane = Number.isInteger(target.lane) ? target.lane : 1;
  const destinationLane = [0, 1, 2]
    .filter((lane) => lane !== currentLane)
    .sort((a, b) => (
      Math.abs(Number(laneCenters[b]) - targetY) - Math.abs(Number(laneCenters[a]) - targetY)
      || a - b
    ))[0];
  if (!Number.isInteger(destinationLane)) return deepFreeze({ ok: false, reason: "no-lane" });
  return deepFreeze({
    ok: true,
    lane: destinationLane,
    runtime: {
      ...runtime,
      phase: "locked",
      remainingSeconds: Math.min(
        Number(runtime.remainingSeconds) || 0,
        KUROME_PROTOTYPE_TUNING.warningSeconds - KUROME_PROTOTYPE_TUNING.trackingSeconds,
      ),
      targetX,
      targetY,
      lane: currentLane,
    },
  });
}

function pointToSegmentDistance(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const denominator = dx * dx + dy * dy;
  if (denominator <= Number.EPSILON) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / denominator));
  return Math.hypot(point.x - (start.x + dx * t), point.y - (start.y + dy * t));
}

export function resolveKuromeBeam({
  boss,
  runtime,
  candidates = [],
  beamHalfWidth = KUROME_PROTOTYPE_TUNING.beamHalfWidth,
} = {}) {
  if (!boss || runtime?.phase !== "firing"
    || !Number.isFinite(Number(runtime.targetX))
    || !Number.isFinite(Number(runtime.targetY))) {
    return deepFreeze({ hits: [], origin: null, target: null });
  }
  const origin = { x: Number(boss.x) || 0, y: (Number(boss.y) || 0) - 64 };
  const target = { x: Number(runtime.targetX), y: Number(runtime.targetY) - 38 };
  const width = Math.max(1, Number(beamHalfWidth) || 1);
  const hits = candidates
    .filter((candidate) => candidate?.side === "human"
      && Number(candidate.hp) > 0
      && candidate.combatReady !== false
      && candidate.targetable !== false)
    .filter((candidate) => pointToSegmentDistance(
      { x: Number(candidate.x) || 0, y: (Number(candidate.y) || 0) - 38 },
      origin,
      target,
    ) <= width + Math.max(0, Number(candidate.bodyRadius) || 0) * .35)
    .map((candidate) => String(candidate.id));
  return deepFreeze({ hits, origin, target });
}
