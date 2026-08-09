export const CRAWLER_DOOR_PHASES = Object.freeze({
  CLOSED: "closed",
  WARNING: "warning",
  OPENING: "opening",
  OPEN: "open",
  CLOSING: "closing",
});

export const CRAWLER_DOOR_TIMINGS = Object.freeze({
  warningSeconds: 0.22,
  openingSeconds: 0.38,
  openHoldSeconds: 0.18,
  launchGapSeconds: 0.16,
  closingSeconds: 0.34,
});

const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));

export const CRAWLER_DEPLOYMENT_UNIT_FAMILIES = Object.freeze({
  HACHI: "hachi",
  MIZUCHI: "mizuchi",
  PAISEN: "paisen",
  CRAZY_KING: "crazy-king",
  MAYO_CHAN: "mayo-chan",
  TATARA: "tatara",
  STANDARD_HUMAN: "standard-human",
});

const CRAWLER_DEPLOYMENT_STANDARD_HUMAN_KINDS = Object.freeze([
  "medic",
  "gunner",
  "guardian",
  "engineer",
  "kumaverson",
  "babayaga",
  "zakimiya",
  "tky",
  "mrs-chiha",
  "miyamoto-musashi",
]);

const CRAWLER_DEPLOYMENT_FAMILY_BY_KIND = Object.freeze({
  scout: CRAWLER_DEPLOYMENT_UNIT_FAMILIES.HACHI,
  ranger: CRAWLER_DEPLOYMENT_UNIT_FAMILIES.MIZUCHI,
  brawler: CRAWLER_DEPLOYMENT_UNIT_FAMILIES.PAISEN,
  "crazy-king": CRAWLER_DEPLOYMENT_UNIT_FAMILIES.CRAZY_KING,
  "mayo-chan": CRAWLER_DEPLOYMENT_UNIT_FAMILIES.MAYO_CHAN,
  brute: CRAWLER_DEPLOYMENT_UNIT_FAMILIES.TATARA,
  ...Object.fromEntries(CRAWLER_DEPLOYMENT_STANDARD_HUMAN_KINDS.map((kind) => [
    kind,
    CRAWLER_DEPLOYMENT_UNIT_FAMILIES.STANDARD_HUMAN,
  ])),
});

export const CRAWLER_DEPLOYMENT_CHECKPOINTS = Object.freeze([
  Object.freeze({ id: "fully-inside", progress: 0 }),
  // Representative evidence waits until authored pixels clear the foreground
  // door mask while remaining inside the first-visible semantic interval.
  Object.freeze({ id: "first-visible", progress: .08 }),
  Object.freeze({ id: "quarter", progress: .25 }),
  Object.freeze({ id: "half", progress: .5 }),
  Object.freeze({ id: "three-quarters", progress: .75 }),
  Object.freeze({ id: "fully-outside", progress: 1 }),
]);

const INSIDE_DRAW_ORDER = Object.freeze([
  "crawler-base",
  "crawler-interior",
  "unit",
  "crawler-foreground-mask",
]);
const OUTSIDE_DRAW_ORDER = Object.freeze([
  "crawler-base",
  "crawler-interior",
  "crawler-foreground-mask",
  "unit",
]);

/**
 * Opaque authored layers used by the deployment composite. The closed host is
 * always the base; the authored interior and foreground mask switch as
 * opaque phases instead of cross-fading the whole vehicle.
 */
export function crawlerDeploymentCompositePlan({
  doorProgress = 0,
  entryRampCleared = false,
} = {}) {
  const progress = clamp01(doorProgress);
  const doorOpen = progress > 0;
  const outside = entryRampCleared === true || progress >= 1;
  return Object.freeze({
    checkpoint: crawlerDeploymentCheckpoint(progress),
    layers: Object.freeze([
      Object.freeze({ id: "crawler-command-base-closed", alpha: 1, drawCount: 1, opaque: true }),
      ...(doorOpen
        ? [Object.freeze({ id: "crawler-deployment-base-interior", alpha: 1, drawCount: 1, opaque: true })]
        : []),
    ]),
    foregroundMask: doorOpen
      ? Object.freeze({ alpha: 1, drawCount: 1, opaque: true })
      : null,
    unit: Object.freeze({
      alpha: 1,
      drawCount: 1,
      pass: outside ? "after-foreground-mask" : "before-foreground-mask",
    }),
  });
}

export function crawlerDeploymentUnitFamily(unitKind) {
  return CRAWLER_DEPLOYMENT_FAMILY_BY_KIND[String(unitKind ?? "")] ?? null;
}

export function crawlerDeploymentCheckpoint(progress) {
  const normalized = clamp01(progress);
  if (normalized >= 1) return "fully-outside";
  if (normalized >= .75) return "three-quarters";
  if (normalized >= .5) return "half";
  if (normalized >= .25) return "quarter";
  if (normalized > 0) return "first-visible";
  return "fully-inside";
}

/**
 * Describes which authored CRAWLER layers own a deploying unit.
 *
 * This contract deliberately exposes no rectangle or reveal width. The unit is
 * drawn exactly once at alpha 1; the authored foreground hull/door-frame layer
 * supplies physical occlusion while the unit is inside the vehicle. Once the
 * ramp threshold is cleared, the same unit draw moves in front of that layer.
 */
export function crawlerDeploymentRenderPlan({
  side,
  gateEntering,
  spawnPortalId,
  entryRampCleared = false,
  unitKind,
  progress = 0,
} = {}) {
  const active = side === "human"
    && gateEntering === true
    && spawnPortalId === "crawler-door";
  if (!active) {
    return Object.freeze({
      active: false,
      family: crawlerDeploymentUnitFamily(unitKind),
      checkpoint: crawlerDeploymentCheckpoint(progress),
    });
  }

  const outside = entryRampCleared === true || clamp01(progress) >= 1;
  return Object.freeze({
    active: true,
    family: crawlerDeploymentUnitFamily(unitKind),
    checkpoint: crawlerDeploymentCheckpoint(progress),
    alpha: 1,
    unitDrawCount: 1,
    clipMode: "none",
    unitPass: outside ? "after-foreground-mask" : "before-foreground-mask",
    foregroundMaskPass: outside ? "before-unit" : "after-unit",
    drawOrder: outside ? OUTSIDE_DRAW_ORDER : INSIDE_DRAW_ORDER,
  });
}

export function createCrawlerDoorRuntime() {
  return {
    phase: CRAWLER_DOOR_PHASES.CLOSED,
    elapsed: 0,
    doorProgress: 0,
    launchCooldown: 0,
    cycle: 0,
  };
}

function immutableStep(runtime, events) {
  return Object.freeze({
    runtime: Object.freeze(runtime),
    events: Object.freeze(events),
  });
}

export function advanceCrawlerDoorRuntime(runtime, dt, {
  queuedUnits = 0,
  doorwayOccupied = false,
} = {}) {
  const seconds = Math.max(0, Number(dt) || 0);
  const queueLength = Math.max(0, Math.floor(Number(queuedUnits) || 0));
  const events = [];
  const next = {
    ...createCrawlerDoorRuntime(),
    ...(runtime && typeof runtime === "object" ? runtime : {}),
  };
  next.elapsed = Math.max(0, Number(next.elapsed) || 0) + seconds;
  next.launchCooldown = Math.max(0, (Number(next.launchCooldown) || 0) - seconds);
  next.doorProgress = clamp01(next.doorProgress);

  if (next.phase === CRAWLER_DOOR_PHASES.CLOSED) {
    next.doorProgress = 0;
    if (queueLength > 0) {
      next.phase = CRAWLER_DOOR_PHASES.WARNING;
      next.elapsed = 0;
      next.cycle = Math.max(0, Math.floor(Number(next.cycle) || 0)) + 1;
      events.push("warning");
    }
    return immutableStep(next, events);
  }

  if (next.phase === CRAWLER_DOOR_PHASES.WARNING) {
    next.doorProgress = 0;
    if (queueLength <= 0) {
      next.phase = CRAWLER_DOOR_PHASES.CLOSED;
      next.elapsed = 0;
      events.push("cancelled");
    } else if (next.elapsed >= CRAWLER_DOOR_TIMINGS.warningSeconds) {
      next.phase = CRAWLER_DOOR_PHASES.OPENING;
      next.elapsed = 0;
      events.push("opening");
    }
    return immutableStep(next, events);
  }

  if (next.phase === CRAWLER_DOOR_PHASES.OPENING) {
    next.doorProgress = clamp01(next.elapsed / CRAWLER_DOOR_TIMINGS.openingSeconds);
    if (next.doorProgress >= 1) {
      next.phase = CRAWLER_DOOR_PHASES.OPEN;
      next.elapsed = 0;
      next.doorProgress = 1;
      events.push("opened");
    }
    return immutableStep(next, events);
  }

  if (next.phase === CRAWLER_DOOR_PHASES.OPEN) {
    next.doorProgress = 1;
    if (queueLength > 0 && !doorwayOccupied && next.launchCooldown <= 0) {
      next.launchCooldown = CRAWLER_DOOR_TIMINGS.launchGapSeconds;
      next.elapsed = 0;
      events.push("launch");
    } else if (queueLength <= 0
      && !doorwayOccupied
      && next.elapsed >= CRAWLER_DOOR_TIMINGS.openHoldSeconds) {
      next.phase = CRAWLER_DOOR_PHASES.CLOSING;
      next.elapsed = 0;
      events.push("closing");
    }
    return immutableStep(next, events);
  }

  if (next.phase === CRAWLER_DOOR_PHASES.CLOSING) {
    next.doorProgress = clamp01(1 - next.elapsed / CRAWLER_DOOR_TIMINGS.closingSeconds);
    if (queueLength > 0) {
      next.phase = CRAWLER_DOOR_PHASES.OPENING;
      next.elapsed = next.doorProgress * CRAWLER_DOOR_TIMINGS.openingSeconds;
      events.push("reopening");
    } else if (next.doorProgress <= 0) {
      next.phase = CRAWLER_DOOR_PHASES.CLOSED;
      next.elapsed = 0;
      next.doorProgress = 0;
      events.push("closed");
    }
    return immutableStep(next, events);
  }

  return immutableStep(createCrawlerDoorRuntime(), ["reset"]);
}
