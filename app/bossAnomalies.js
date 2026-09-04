import { deepFreeze } from "./content/freeze.js";

export const BOSS_ANOMALY_KINDS = deepFreeze([
  "mother",
  "ooguchi",
  "gairen",
  "futago",
  "mugarian-president-mutated",
  "takuya-omega",
]);

export const BOSS_ANOMALY_TUNING = deepFreeze({
  mother: {
    warningSeconds: 1.1,
    activeSeconds: .9,
    recoverySeconds: 1,
    cooldownSeconds: 7.8,
    summonKinds: ["runner", "resonator", "spindle"],
    summonCount: 3,
    summonCap: 9,
    controlRadius: 128,
    controlDamage: 24,
  },
  ooguchi: {
    warningSeconds: 1.05,
    activeSeconds: .72,
    recoverySeconds: 1.05,
    cooldownSeconds: 6.4,
    chargeSpeed: 310,
    chargeDamage: 48,
    chargeHalfHeight: 34,
  },
  gairen: {
    warningSeconds: 1.15,
    activeSeconds: 3.2,
    recoverySeconds: .82,
    cooldownSeconds: 7.2,
    guardedFrontMultiplier: .3,
    guardedFlankMultiplier: .58,
    exposedMultiplier: 1.28,
    sweepDamage: 38,
    sweepRadius: 104,
    sweepHalfHeight: 52,
  },
  futago: {
    warningSeconds: 1.2,
    activeSeconds: 3.6,
    recoverySeconds: .9,
    cooldownSeconds: 7,
    splitThreshold: .62,
    crossStrikeDamage: 34,
    crossStrikeRadius: 118,
    crossStrikeHalfWidth: 18,
    crossStrikeAngleRadians: .43,
    splitSpeedMultiplier: 1.42,
  },
  "mugarian-president-mutated": {
    warningSeconds: 1.05,
    activeSeconds: .86,
    recoverySeconds: 1.02,
    cooldownSeconds: 7.4,
    controlRadius: 150,
    controlDamage: 46,
    splitThreshold: .7,
  },
  "takuya-omega": {
    warningSeconds: 1.18,
    activeSeconds: 1.1,
    recoverySeconds: 1.08,
    cooldownSeconds: 6.8,
    controlRadius: 210,
    controlDamage: 58,
    splitThreshold: .45,
  },
});

function finite(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function livingHuman(candidate) {
  return candidate?.side === "human"
    && Number(candidate.hp) > 0
    && candidate.combatReady !== false
    && candidate.targetable !== false;
}

export function isBossAnomalyKind(kind) {
  return BOSS_ANOMALY_KINDS.includes(kind);
}

export function createBossAnomalyRuntime(kind) {
  if (!isBossAnomalyKind(kind)) {
    return deepFreeze({ kind: null, phase: "idle", remainingSeconds: 0 });
  }
  return deepFreeze({
    kind,
    phase: "idle",
    remainingSeconds: 0,
    targetId: null,
    targetX: null,
    targetY: null,
    lane: null,
    guarded: kind === "gairen",
    split: false,
  });
}

function selectTarget(boss, candidates) {
  const humans = (Array.isArray(candidates) ? candidates : [])
    .filter(livingHuman);
  if (humans.length === 0) return null;
  if (boss?.kind === "ooguchi") {
    return [...humans].sort((left, right) => (
      Math.abs(finite(left.y) - finite(boss.y)) - Math.abs(finite(right.y) - finite(boss.y))
      || finite(left.x) - finite(right.x)
      || String(left.id).localeCompare(String(right.id))
    ))[0];
  }
  return [...humans].sort((left, right) => (
    Math.hypot(finite(left.x) - finite(boss?.x), finite(left.y) - finite(boss?.y))
      - Math.hypot(finite(right.x) - finite(boss?.x), finite(right.y) - finite(boss?.y))
    || String(left.id).localeCompare(String(right.id))
  ))[0];
}

export function beginBossAnomalyAbility({
  boss,
  candidates = [],
} = {}) {
  if (!boss || !isBossAnomalyKind(boss.kind)
    || boss.side !== "zombie"
    || Number(boss.hp) <= 0
    || boss.combatReady === false) {
    return deepFreeze({ ok: false, runtime: createBossAnomalyRuntime(boss?.kind) });
  }
  const tuning = BOSS_ANOMALY_TUNING[boss.kind];
  const target = selectTarget(boss, candidates);
  if (boss.kind !== "mother" && !target) {
    return deepFreeze({ ok: false, runtime: createBossAnomalyRuntime(boss.kind) });
  }
  const hpRatio = Math.max(0, Number(boss.hp)) / Math.max(1, Number(boss.maxHp) || 1);
  return deepFreeze({
    ok: true,
    runtime: {
      kind: boss.kind,
      phase: "warning",
      remainingSeconds: tuning.warningSeconds,
      targetId: target ? String(target.id) : null,
      targetX: target ? finite(target.x) : finite(boss.x) - 84,
      targetY: target ? finite(target.y) : finite(boss.y),
      lane: target && Number.isInteger(target.lane) ? target.lane : boss.lane ?? null,
      guarded: boss.kind === "gairen",
      split: boss.kind === "futago" && hpRatio <= tuning.splitThreshold,
    },
  });
}

export function advanceBossAnomalyAbility(runtime, elapsedSeconds) {
  const kind = runtime?.kind;
  if (!isBossAnomalyKind(kind)) {
    return deepFreeze({
      runtime: createBossAnomalyRuntime(kind),
      events: [],
    });
  }
  const current = runtime?.phase ? runtime : createBossAnomalyRuntime(kind);
  const elapsed = Math.max(0, finite(elapsedSeconds));
  if (current.phase === "idle") return deepFreeze({ runtime: current, events: [] });
  const remainingSeconds = Math.max(0, finite(current.remainingSeconds) - elapsed);
  if (remainingSeconds > 0) {
    return deepFreeze({
      runtime: { ...current, remainingSeconds },
      events: [],
    });
  }
  const tuning = BOSS_ANOMALY_TUNING[kind];
  if (current.phase === "warning") {
    return deepFreeze({
      runtime: {
        ...current,
        phase: "active",
        remainingSeconds: tuning.activeSeconds,
        guarded: kind === "gairen" ? false : current.guarded,
      },
      events: ["activate"],
    });
  }
  if (current.phase === "active") {
    return deepFreeze({
      runtime: {
        ...current,
        phase: "recovery",
        remainingSeconds: tuning.recoverySeconds,
        guarded: kind === "gairen",
        split: false,
      },
      events: ["recover"],
    });
  }
  return deepFreeze({
    runtime: createBossAnomalyRuntime(kind),
    events: ["complete"],
  });
}

export function gairenIncomingDamageMultiplier({
  runtime,
  attackerX,
  bossX,
  verticalDistance = 0,
} = {}) {
  const tuning = BOSS_ANOMALY_TUNING.gairen;
  if (runtime?.kind !== "gairen") return 1;
  if (runtime.phase === "active" || runtime.guarded === false) return tuning.exposedMultiplier;
  const flank = Math.abs(finite(verticalDistance)) > 28 || finite(attackerX) > finite(bossX) + 8;
  return flank ? tuning.guardedFlankMultiplier : tuning.guardedFrontMultiplier;
}

export function ooguchiChargeStep({
  runtime,
  boss,
  elapsedSeconds,
  minimumX = 0,
} = {}) {
  if (runtime?.kind !== "ooguchi" || runtime.phase !== "active" || !boss) {
    return deepFreeze({ active: false, boss, hitIds: [] });
  }
  const tuning = BOSS_ANOMALY_TUNING.ooguchi;
  const x = Math.max(
    finite(minimumX),
    finite(boss.x) - tuning.chargeSpeed * Math.max(0, finite(elapsedSeconds)),
  );
  return deepFreeze({
    active: true,
    boss: { ...boss, x },
    targetId: runtime.targetId ?? null,
    lane: runtime.lane ?? boss.lane ?? null,
  });
}

export function bossAnomalyAreaTargetIds({
  kind,
  boss,
  candidates = [],
} = {}) {
  if (!isBossAnomalyKind(kind) || !boss) return deepFreeze([]);
  const tuning = BOSS_ANOMALY_TUNING[kind];
  const radius = kind === "mother"
    ? tuning.controlRadius
    : kind === "gairen"
      ? tuning.sweepRadius
      : kind === "futago"
        ? tuning.crossStrikeRadius
        : tuning.controlRadius;
  if (!(radius > 0)) return deepFreeze([]);
  return deepFreeze((Array.isArray(candidates) ? candidates : [])
    .filter(livingHuman)
    .filter((candidate) => {
      const dx = finite(candidate.x) - finite(boss.x);
      const dy = finite(candidate.y) - finite(boss.y);
      if (kind === "gairen") {
        const halfHeight = tuning.sweepHalfHeight;
        return dx <= 0
          && (dx * dx) / (radius * radius)
            + (dy * dy) / (halfHeight * halfHeight) <= 1;
      }
      if (kind === "futago") {
        return [-tuning.crossStrikeAngleRadians, tuning.crossStrikeAngleRadians]
          .some((angle) => {
            const cosine = Math.cos(angle);
            const sine = Math.sin(angle);
            const along = dx * cosine + dy * sine;
            const across = -dx * sine + dy * cosine;
            return Math.abs(along) <= radius
              && Math.abs(across) <= tuning.crossStrikeHalfWidth;
          });
      }
      return Math.hypot(dx, dy * 1.5) <= radius;
    })
    .map(({ id }) => String(id)));
}

export function motherBroodSummonPlan({
  boss,
  candidates = [],
  attackSequence = 0,
  cap = BOSS_ANOMALY_TUNING.mother.summonCap,
} = {}) {
  if (!boss
    || boss.kind !== "mother"
    || boss.side !== "zombie"
    || Number(boss.hp) <= 0) {
    return deepFreeze([]);
  }
  const tuning = BOSS_ANOMALY_TUNING.mother;
  const ownerId = String(boss.id);
  const livingOwnedBrood = (Array.isArray(candidates) ? candidates : [])
    .filter((candidate) => (
      candidate?.side === "zombie"
      && Number(candidate.hp) > 0
      && candidate.summonSource === "mother-brood"
      && String(candidate.summonOwnerId) === ownerId
      && tuning.summonKinds.includes(candidate.kind)
    )).length;
  const normalizedCap = Math.max(0, Math.floor(finite(cap, tuning.summonCap)));
  const summonCount = Math.min(
    tuning.summonCount,
    Math.max(0, normalizedCap - livingOwnedBrood),
  );
  const sequence = Math.max(0, Math.floor(finite(attackSequence)));
  const laneOffsets = [-1, 1, 0];
  const xOffsets = [-84, 58, -22];
  return deepFreeze(Array.from({ length: summonCount }, (_, index) => ({
    kind: tuning.summonKinds[(sequence + index) % tuning.summonKinds.length],
    laneOffset: laneOffsets[index % laneOffsets.length],
    xOffset: xOffsets[index % xOffsets.length],
  })));
}
