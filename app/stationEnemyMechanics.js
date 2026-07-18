const LANE_MIN = 0;
const LANE_MAX = 2;
const EPSILON = 1e-9;

export const STATION_ENEMY_TUNING = Object.freeze({
  karamite: Object.freeze({
    windupSeconds: 0.9,
    bindRange: 128,
    breakRange: 154,
    pullSpeed: 64,
    holdSeconds: 1.75,
    stopDistance: 18,
  }),
  leakMud: Object.freeze({
    windupSeconds: 1.05,
    radiusX: 58,
    radiusY: 20,
    durationSeconds: 5,
    tickIntervalSeconds: 0.5,
    damagePerSecond: 8,
    speedMultiplier: 0.62,
  }),
  souki: Object.freeze({
    telegraphSeconds: 0.55,
    burstSeconds: 1.1,
    recoverySeconds: 0.7,
    burstSpeed: 190,
    crawlerRearBoundaryX: -96,
  }),
  ticketGateEater: Object.freeze({
    windupSeconds: 1.15,
    chargeSeconds: 0.9,
    chargeSpeed: 150,
    flankExposureSeconds: 1.6,
    flankDamageMultiplier: 1.5,
    requiredPowerCount: 3,
  }),
});

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function nonNegative(value, fallback = 0) {
  return Math.max(0, finiteNumber(value, fallback));
}

function stableId(entity) {
  if (entity?.id === undefined || entity?.id === null) return "";
  return String(entity.id);
}

function validLane(lane) {
  return Number.isInteger(lane) && lane >= LANE_MIN && lane <= LANE_MAX;
}

function availableEntity(entity) {
  return Boolean(entity)
    && finiteNumber(entity.hp) > 0
    && entity.targetable !== false
    && Number.isFinite(Number(entity.x));
}

function idleKaramiteRuntime() {
  return Object.freeze({
    phase: "idle",
    remainingSeconds: 0,
    targetId: null,
    lane: null,
  });
}

export function createKaramiteRuntime() {
  return idleKaramiteRuntime();
}

export function karamiteTargetReason({
  attacker,
  target,
  range = STATION_ENEMY_TUNING.karamite.bindRange,
} = {}) {
  if (!availableEntity(attacker)) return "attacker-unavailable";
  if (!availableEntity(target) || target.combatReady === false) return "target-unavailable";
  if (attacker.side !== undefined && target.side === attacker.side) return "same-side";
  if (!validLane(attacker.lane) || !validLane(target.lane)) return "invalid-lane";
  if (attacker.lane !== target.lane) return "different-lane";
  const maximumRange = nonNegative(range);
  if (Math.abs(Number(target.x) - Number(attacker.x)) > maximumRange) return "out-of-range";
  return null;
}

export function canKaramiteTarget(options = {}) {
  return karamiteTargetReason(options) === null;
}

export function selectKaramiteTarget({
  attacker,
  candidates = [],
  range = STATION_ENEMY_TUNING.karamite.bindRange,
} = {}) {
  return (Array.isArray(candidates) ? candidates : [])
    .filter((target) => canKaramiteTarget({ attacker, target, range }))
    .sort((left, right) => {
      const distance = Math.abs(Number(left.x) - Number(attacker?.x))
        - Math.abs(Number(right.x) - Number(attacker?.x));
      return distance || stableId(left).localeCompare(stableId(right));
    })[0] ?? null;
}

export function beginKaramiteWindup({
  attacker,
  target,
  range = STATION_ENEMY_TUNING.karamite.bindRange,
} = {}) {
  const reason = karamiteTargetReason({ attacker, target, range });
  if (reason) {
    return Object.freeze({ ok: false, reason, runtime: idleKaramiteRuntime() });
  }
  return Object.freeze({
    ok: true,
    reason: null,
    runtime: Object.freeze({
      phase: "windup",
      remainingSeconds: STATION_ENEMY_TUNING.karamite.windupSeconds,
      targetId: stableId(target),
      lane: attacker.lane,
    }),
  });
}

export function advanceKaramiteWindup(runtime = createKaramiteRuntime(), elapsedSeconds = 0) {
  if (runtime?.phase !== "windup") {
    return Object.freeze({
      phase: runtime?.phase ?? "idle",
      remainingSeconds: nonNegative(runtime?.remainingSeconds),
      targetId: runtime?.targetId ?? null,
      lane: validLane(runtime?.lane) ? runtime.lane : null,
    });
  }
  const remainingSeconds = Math.max(
    0,
    nonNegative(runtime.remainingSeconds) - nonNegative(elapsedSeconds),
  );
  return Object.freeze({
    phase: remainingSeconds <= EPSILON ? "ready" : "windup",
    remainingSeconds: remainingSeconds <= EPSILON ? 0 : remainingSeconds,
    targetId: runtime.targetId ?? null,
    lane: validLane(runtime.lane) ? runtime.lane : null,
  });
}

export function interruptKaramite() {
  return idleKaramiteRuntime();
}

export function resolveKaramiteBind({
  runtime = createKaramiteRuntime(),
  attacker,
  target,
} = {}) {
  if (runtime.phase !== "ready") {
    return Object.freeze({
      bound: false,
      reason: "windup-incomplete",
      runtime,
    });
  }
  if (stableId(target) !== String(runtime.targetId ?? "")) {
    return Object.freeze({
      bound: false,
      reason: "target-changed",
      runtime: idleKaramiteRuntime(),
    });
  }
  const reason = karamiteTargetReason({ attacker, target });
  if (reason) {
    return Object.freeze({
      bound: false,
      reason,
      runtime: idleKaramiteRuntime(),
    });
  }
  return Object.freeze({
    bound: true,
    reason: null,
    runtime: Object.freeze({
      phase: "pulling",
      remainingSeconds: STATION_ENEMY_TUNING.karamite.holdSeconds,
      targetId: stableId(target),
      lane: runtime.lane,
    }),
  });
}

export function advanceKaramitePull({
  runtime = createKaramiteRuntime(),
  attacker,
  target,
  elapsedSeconds = 0,
} = {}) {
  const originalTarget = Object.freeze({ ...(target ?? {}) });
  if (runtime.phase !== "pulling") {
    return Object.freeze({
      bound: false,
      reason: "not-pulling",
      pulledDistance: 0,
      runtime,
      target: originalTarget,
    });
  }
  if (stableId(target) !== String(runtime.targetId ?? "")) {
    return Object.freeze({
      bound: false,
      reason: "target-changed",
      pulledDistance: 0,
      runtime: idleKaramiteRuntime(),
      target: originalTarget,
    });
  }
  const targetReason = karamiteTargetReason({
    attacker,
    target,
    range: STATION_ENEMY_TUNING.karamite.breakRange,
  });
  if (targetReason) {
    return Object.freeze({
      bound: false,
      reason: targetReason,
      pulledDistance: 0,
      runtime: idleKaramiteRuntime(),
      target: originalTarget,
    });
  }

  const activeSeconds = Math.min(
    nonNegative(elapsedSeconds),
    nonNegative(runtime.remainingSeconds),
  );
  const deltaX = Number(attacker.x) - Number(target.x);
  const direction = Math.sign(deltaX);
  const pullableDistance = Math.max(
    0,
    Math.abs(deltaX) - STATION_ENEMY_TUNING.karamite.stopDistance,
  );
  const pulledDistance = Math.min(
    pullableDistance,
    STATION_ENEMY_TUNING.karamite.pullSpeed * activeSeconds,
  );
  const remainingSeconds = Math.max(0, nonNegative(runtime.remainingSeconds) - activeSeconds);
  const bound = remainingSeconds > EPSILON;
  return Object.freeze({
    bound,
    reason: bound ? null : "hold-complete",
    pulledDistance,
    runtime: bound
      ? Object.freeze({
        phase: "pulling",
        remainingSeconds,
        targetId: runtime.targetId,
        lane: runtime.lane,
      })
      : idleKaramiteRuntime(),
    target: Object.freeze({
      ...target,
      x: Number(target.x) + direction * pulledDistance,
      restrained: bound,
    }),
  });
}

function idleLeakMudRuntime() {
  return Object.freeze({
    phase: "idle",
    remainingSeconds: 0,
    zoneId: null,
    ownerId: null,
    ownerSide: null,
    lane: null,
    centerX: null,
    centerY: null,
  });
}

export function createLeakMudRuntime() {
  return idleLeakMudRuntime();
}

export function beginLeakMudWindup({
  source,
  zoneId,
  lane = source?.lane,
  centerX = source?.x,
  centerY = source?.y,
} = {}) {
  if (!availableEntity(source)) {
    return Object.freeze({ ok: false, reason: "source-unavailable", runtime: idleLeakMudRuntime() });
  }
  if (!validLane(lane)) {
    return Object.freeze({ ok: false, reason: "invalid-lane", runtime: idleLeakMudRuntime() });
  }
  if (!Number.isFinite(Number(centerX)) || !Number.isFinite(Number(centerY))) {
    return Object.freeze({ ok: false, reason: "invalid-center", runtime: idleLeakMudRuntime() });
  }
  return Object.freeze({
    ok: true,
    reason: null,
    runtime: Object.freeze({
      phase: "windup",
      remainingSeconds: STATION_ENEMY_TUNING.leakMud.windupSeconds,
      zoneId: zoneId ?? null,
      ownerId: source.id ?? null,
      ownerSide: source.side ?? null,
      lane,
      centerX: Number(centerX),
      centerY: Number(centerY),
    }),
  });
}

export function advanceLeakMudWindup(runtime = createLeakMudRuntime(), elapsedSeconds = 0) {
  if (runtime?.phase !== "windup") return runtime;
  const remainingSeconds = Math.max(
    0,
    nonNegative(runtime.remainingSeconds) - nonNegative(elapsedSeconds),
  );
  return Object.freeze({
    ...runtime,
    phase: remainingSeconds <= EPSILON ? "ready" : "windup",
    remainingSeconds: remainingSeconds <= EPSILON ? 0 : remainingSeconds,
  });
}

export function interruptLeakMud() {
  return idleLeakMudRuntime();
}

export function resolveLeakMudZone(runtime = createLeakMudRuntime()) {
  if (runtime.phase !== "ready") {
    return Object.freeze({
      created: false,
      reason: "windup-incomplete",
      runtime,
      zone: null,
    });
  }
  const zone = Object.freeze({
    id: runtime.zoneId,
    ownerId: runtime.ownerId,
    ownerSide: runtime.ownerSide,
    lane: runtime.lane,
    centerX: runtime.centerX,
    centerY: runtime.centerY,
    radiusX: STATION_ENEMY_TUNING.leakMud.radiusX,
    radiusY: STATION_ENEMY_TUNING.leakMud.radiusY,
    remainingSeconds: STATION_ENEMY_TUNING.leakMud.durationSeconds,
    tickAccumulator: 0,
    active: true,
  });
  return Object.freeze({
    created: true,
    reason: null,
    runtime: idleLeakMudRuntime(),
    zone,
  });
}

export function isInsideLeakMudZone(zone, entity) {
  if (!zone || !entity || zone.active === false) return false;
  if (!validLane(zone.lane) || entity.lane !== zone.lane) return false;
  const centerX = Number(zone.centerX);
  const centerY = Number(zone.centerY);
  const x = Number(entity.x);
  const y = Number(entity.y);
  const radiusX = nonNegative(zone.radiusX);
  const radiusY = nonNegative(zone.radiusY);
  if (
    !Number.isFinite(centerX)
    || !Number.isFinite(centerY)
    || !Number.isFinite(x)
    || !Number.isFinite(y)
    || radiusX <= 0
    || radiusY <= 0
  ) {
    return false;
  }
  const normalizedX = (x - centerX) / radiusX;
  const normalizedY = (y - centerY) / radiusY;
  return normalizedX ** 2 + normalizedY ** 2 <= 1 + EPSILON;
}

export function advanceLeakMudZone({
  zone,
  entities = [],
  elapsedSeconds = 0,
} = {}) {
  if (!zone || zone.active === false || nonNegative(zone.remainingSeconds) <= 0) {
    return Object.freeze({
      zone: Object.freeze({ ...(zone ?? {}), remainingSeconds: 0, tickAccumulator: 0, active: false }),
      tickCount: 0,
      effects: Object.freeze([]),
    });
  }
  const activeSeconds = Math.min(nonNegative(elapsedSeconds), nonNegative(zone.remainingSeconds));
  const totalTickTime = nonNegative(zone.tickAccumulator) + activeSeconds;
  const tickInterval = STATION_ENEMY_TUNING.leakMud.tickIntervalSeconds;
  const tickCount = Math.floor((totalTickTime + EPSILON) / tickInterval);
  const remainingSeconds = Math.max(0, nonNegative(zone.remainingSeconds) - activeSeconds);
  const active = remainingSeconds > EPSILON;
  const tickAccumulator = active
    ? Math.max(0, totalTickTime - tickCount * tickInterval)
    : 0;
  const damage = tickCount
    * tickInterval
    * STATION_ENEMY_TUNING.leakMud.damagePerSecond;
  const effects = tickCount <= 0
    ? []
    : (Array.isArray(entities) ? entities : [])
      .filter((entity) => (
        availableEntity(entity)
        && entity.side !== undefined
        && entity.side !== zone.ownerSide
        && isInsideLeakMudZone(zone, entity)
      ))
      .sort((first, second) => stableId(first).localeCompare(stableId(second)))
      .map((entity) => Object.freeze({
        targetId: entity.id ?? null,
        damage,
        hp: Math.max(0, finiteNumber(entity.hp) - damage),
        speedMultiplier: STATION_ENEMY_TUNING.leakMud.speedMultiplier,
      }));

  return Object.freeze({
    zone: Object.freeze({
      ...zone,
      remainingSeconds,
      tickAccumulator,
      active,
    }),
    tickCount,
    effects: Object.freeze(effects),
  });
}

export function advanceLeakMudHazards({
  hazards = [],
  entities = [],
  elapsedSeconds = 0,
} = {}) {
  const sourceHazards = Array.isArray(hazards) ? hazards : [];
  const sourceEntities = Array.isArray(entities) ? entities : [];
  const zones = [];
  const effects = [];
  for (const hazard of sourceHazards) {
    const step = advanceLeakMudZone({
      zone: hazard,
      entities: sourceEntities,
      elapsedSeconds,
    });
    if (step.zone.active) zones.push(step.zone);
    effects.push(...step.effects);
  }
  const slowByTarget = new Map();
  for (const zone of zones) {
    for (const entity of sourceEntities) {
      if (!availableEntity(entity)
        || entity.side === undefined
        || entity.side === zone.ownerSide
        || !isInsideLeakMudZone(zone, entity)) {
        continue;
      }
      const id = stableId(entity);
      if (!id) continue;
      slowByTarget.set(id, Math.min(
        slowByTarget.get(id) ?? 1,
        STATION_ENEMY_TUNING.leakMud.speedMultiplier,
      ));
    }
  }
  const slowEffects = [...slowByTarget.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([targetId, speedMultiplier]) => Object.freeze({ targetId, speedMultiplier }));
  return Object.freeze({
    zones: Object.freeze(zones),
    effects: Object.freeze(effects),
    slowEffects: Object.freeze(slowEffects),
  });
}

function idleSoukiRuntime() {
  return Object.freeze({
    phase: "idle",
    remainingSeconds: 0,
    lockedLane: null,
  });
}

export function createSoukiRuntime() {
  return idleSoukiRuntime();
}

export function beginSoukiBurst({ runner } = {}) {
  if (!availableEntity(runner) || runner.combatReady === false) {
    return Object.freeze({ ok: false, reason: "runner-unavailable", runtime: idleSoukiRuntime() });
  }
  if (!validLane(runner.lane)) {
    return Object.freeze({ ok: false, reason: "invalid-lane", runtime: idleSoukiRuntime() });
  }
  return Object.freeze({
    ok: true,
    reason: null,
    runtime: Object.freeze({
      phase: "telegraph",
      remainingSeconds: STATION_ENEMY_TUNING.souki.telegraphSeconds,
      lockedLane: runner.lane,
    }),
  });
}

export function advanceSoukiBurst({
  runtime = createSoukiRuntime(),
  runner,
  elapsedSeconds = 0,
  crawlerRearBoundaryX = STATION_ENEMY_TUNING.souki.crawlerRearBoundaryX,
} = {}) {
  const fallbackX = finiteNumber(runner?.x);
  let x = fallbackX;
  let phase = runtime?.phase ?? "idle";
  let phaseTime = nonNegative(runtime?.remainingSeconds);
  let elapsed = nonNegative(elapsedSeconds);
  const lockedLane = validLane(runtime?.lockedLane)
    ? runtime.lockedLane
    : validLane(runner?.lane)
      ? runner.lane
      : null;
  const rearBoundary = finiteNumber(
    crawlerRearBoundaryX,
    STATION_ENEMY_TUNING.souki.crawlerRearBoundaryX,
  );
  let burstStarted = false;
  let burstEnded = false;

  if (!availableEntity(runner) || !validLane(lockedLane)) {
    return Object.freeze({
      burstStarted: false,
      burstEnded: false,
      runtime: idleSoukiRuntime(),
      runner: Object.freeze({ ...(runner ?? {}) }),
    });
  }

  while (elapsed > EPSILON && phase !== "idle") {
    if (phase === "telegraph") {
      const consumed = Math.min(elapsed, phaseTime);
      phaseTime = Math.max(0, phaseTime - consumed);
      elapsed -= consumed;
      if (phaseTime <= EPSILON) {
        phase = "burst";
        phaseTime = STATION_ENEMY_TUNING.souki.burstSeconds;
        burstStarted = true;
      }
      continue;
    }
    if (phase === "burst") {
      const secondsToBoundary = Math.max(0, x - rearBoundary)
        / STATION_ENEMY_TUNING.souki.burstSpeed;
      const consumed = Math.min(elapsed, phaseTime, secondsToBoundary);
      x = Math.max(
        rearBoundary,
        x - STATION_ENEMY_TUNING.souki.burstSpeed * consumed,
      );
      phaseTime = Math.max(0, phaseTime - consumed);
      elapsed -= consumed;
      if (phaseTime <= EPSILON || x <= rearBoundary + EPSILON) {
        x = Math.max(rearBoundary, x);
        phase = "recovery";
        phaseTime = STATION_ENEMY_TUNING.souki.recoverySeconds;
        burstEnded = true;
      }
      continue;
    }
    if (phase === "recovery") {
      const consumed = Math.min(elapsed, phaseTime);
      phaseTime = Math.max(0, phaseTime - consumed);
      elapsed -= consumed;
      if (phaseTime <= EPSILON) {
        phase = "idle";
        phaseTime = 0;
      }
      continue;
    }
    phase = "idle";
    phaseTime = 0;
  }

  return Object.freeze({
    burstStarted,
    burstEnded,
    runtime: phase === "idle"
      ? idleSoukiRuntime()
      : Object.freeze({ phase, remainingSeconds: phaseTime, lockedLane }),
    runner: Object.freeze({
      ...runner,
      x: Math.max(rearBoundary, x),
      lane: lockedLane,
    }),
  });
}

function idleTicketGateEaterRuntime() {
  return Object.freeze({
    phase: "idle",
    remainingSeconds: 0,
    targetX: null,
    direction: 0,
    lockedLane: null,
  });
}

export function createTicketGateEaterRuntime() {
  return idleTicketGateEaterRuntime();
}

export function beginTicketGateEaterCharge({ boss, targetX } = {}) {
  if (!availableEntity(boss) || boss.combatReady === false) {
    return Object.freeze({
      ok: false,
      reason: "boss-unavailable",
      runtime: idleTicketGateEaterRuntime(),
    });
  }
  if (!validLane(boss.lane) || !Number.isFinite(Number(targetX))) {
    return Object.freeze({
      ok: false,
      reason: !validLane(boss.lane) ? "invalid-lane" : "invalid-target",
      runtime: idleTicketGateEaterRuntime(),
    });
  }
  const direction = Math.sign(Number(targetX) - Number(boss.x));
  if (direction === 0) {
    return Object.freeze({
      ok: false,
      reason: "target-overlap",
      runtime: idleTicketGateEaterRuntime(),
    });
  }
  return Object.freeze({
    ok: true,
    reason: null,
    runtime: Object.freeze({
      phase: "windup",
      remainingSeconds: STATION_ENEMY_TUNING.ticketGateEater.windupSeconds,
      targetX: Number(targetX),
      direction,
      lockedLane: boss.lane,
    }),
  });
}

export function ticketGateEaterFlankExposed(runtime = createTicketGateEaterRuntime()) {
  return runtime.phase === "exposed" && nonNegative(runtime.remainingSeconds) > 0;
}

export function ticketGateEaterDamageProfile({
  runtime = createTicketGateEaterRuntime(),
  attackVector = "front",
} = {}) {
  const flankExposed = ticketGateEaterFlankExposed(runtime);
  const flankHit = flankExposed && attackVector === "flank";
  return Object.freeze({
    flankExposed,
    flankHit,
    multiplier: flankHit
      ? STATION_ENEMY_TUNING.ticketGateEater.flankDamageMultiplier
      : 1,
  });
}

export function advanceTicketGateEaterCharge({
  runtime = createTicketGateEaterRuntime(),
  boss,
  elapsedSeconds = 0,
} = {}) {
  let phase = runtime?.phase ?? "idle";
  let phaseTime = nonNegative(runtime?.remainingSeconds);
  let elapsed = nonNegative(elapsedSeconds);
  let x = finiteNumber(boss?.x);
  const targetX = Number.isFinite(Number(runtime?.targetX)) ? Number(runtime.targetX) : x;
  const direction = runtime?.direction < 0 ? -1 : runtime?.direction > 0 ? 1 : 0;
  const lockedLane = validLane(runtime?.lockedLane)
    ? runtime.lockedLane
    : validLane(boss?.lane)
      ? boss.lane
      : null;
  let chargeStarted = false;
  let chargeEnded = false;
  let flankOpened = false;
  let flankClosed = false;

  if (!availableEntity(boss) || !validLane(lockedLane)) {
    return Object.freeze({
      chargeStarted,
      chargeEnded,
      flankOpened,
      flankClosed,
      runtime: idleTicketGateEaterRuntime(),
      boss: Object.freeze({ ...(boss ?? {}) }),
    });
  }

  while (elapsed > EPSILON && phase !== "idle") {
    if (phase === "windup") {
      const consumed = Math.min(elapsed, phaseTime);
      phaseTime = Math.max(0, phaseTime - consumed);
      elapsed -= consumed;
      if (phaseTime <= EPSILON) {
        phase = "charging";
        phaseTime = STATION_ENEMY_TUNING.ticketGateEater.chargeSeconds;
        chargeStarted = true;
      }
      continue;
    }
    if (phase === "charging") {
      const distanceToTarget = Math.max(0, (targetX - x) * direction);
      const secondsToTarget = distanceToTarget
        / STATION_ENEMY_TUNING.ticketGateEater.chargeSpeed;
      const consumed = Math.min(elapsed, phaseTime, secondsToTarget);
      x += direction * STATION_ENEMY_TUNING.ticketGateEater.chargeSpeed * consumed;
      phaseTime = Math.max(0, phaseTime - consumed);
      elapsed -= consumed;
      if (phaseTime <= EPSILON || Math.max(0, (targetX - x) * direction) <= EPSILON) {
        x = direction < 0 ? Math.max(targetX, x) : Math.min(targetX, x);
        phase = "exposed";
        phaseTime = STATION_ENEMY_TUNING.ticketGateEater.flankExposureSeconds;
        chargeEnded = true;
        flankOpened = true;
      }
      continue;
    }
    if (phase === "exposed") {
      const consumed = Math.min(elapsed, phaseTime);
      phaseTime = Math.max(0, phaseTime - consumed);
      elapsed -= consumed;
      if (phaseTime <= EPSILON) {
        phase = "idle";
        phaseTime = 0;
        flankClosed = true;
      }
      continue;
    }
    phase = "idle";
    phaseTime = 0;
  }

  return Object.freeze({
    chargeStarted,
    chargeEnded,
    flankOpened,
    flankClosed,
    runtime: phase === "idle"
      ? idleTicketGateEaterRuntime()
      : Object.freeze({
        phase,
        remainingSeconds: phaseTime,
        targetX,
        direction,
        lockedLane,
      }),
    boss: Object.freeze({
      ...boss,
      x,
      lane: lockedLane,
    }),
  });
}

export function ticketGateSealStatus({
  poweredCount = 0,
  bossSuppressed = false,
} = {}) {
  const normalizedPowerCount = Math.max(0, Math.floor(finiteNumber(poweredCount)));
  const requiredPowerCount = STATION_ENEMY_TUNING.ticketGateEater.requiredPowerCount;
  const powerReady = normalizedPowerCount >= requiredPowerCount;
  const bossReady = bossSuppressed === true;
  const sealed = powerReady && bossReady;
  return Object.freeze({
    sealed,
    reason: !powerReady
      ? "power-incomplete"
      : !bossReady
        ? "boss-not-suppressed"
        : null,
    poweredCount: normalizedPowerCount,
    requiredPowerCount,
    bossSuppressed: bossReady,
  });
}
