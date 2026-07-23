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
