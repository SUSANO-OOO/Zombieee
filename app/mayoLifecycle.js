import { deepFreeze } from "./content/freeze.js";

export const MAYO_RETREAT_TIMING = deepFreeze({
  fallSeconds: .34,
  riseSeconds: .22,
  runSpeed: 190,
});

export function createMayoRetreatRuntime({ reason = "injury" } = {}) {
  return Object.freeze({
    phase: "fall",
    phaseElapsed: 0,
    reason: reason === "ability" ? "ability" : "injury",
    complete: false,
  });
}

export function mayoRetreatBlocksDamage(runtime) {
  return Boolean(runtime && runtime.complete !== true);
}

export function advanceMayoRetreat(runtime, seconds, {
  x,
  baseX,
  runSpeed = MAYO_RETREAT_TIMING.runSpeed,
} = {}) {
  if (!runtime || runtime.complete) return Object.freeze({ runtime, x: Number(x) || 0 });
  let remaining = Math.max(0, Number(seconds) || 0);
  let next = { ...runtime };
  let nextX = Number(x) || 0;

  if (next.phase === "fall") {
    const available = Math.max(0, MAYO_RETREAT_TIMING.fallSeconds - next.phaseElapsed);
    const used = Math.min(available, remaining);
    next.phaseElapsed += used;
    remaining -= used;
    if (next.phaseElapsed >= MAYO_RETREAT_TIMING.fallSeconds - Number.EPSILON) {
      next.phase = "rise";
      next.phaseElapsed = 0;
    }
  }
  if (next.phase === "rise" && remaining > 0) {
    const available = Math.max(0, MAYO_RETREAT_TIMING.riseSeconds - next.phaseElapsed);
    const used = Math.min(available, remaining);
    next.phaseElapsed += used;
    remaining -= used;
    if (next.phaseElapsed >= MAYO_RETREAT_TIMING.riseSeconds - Number.EPSILON) {
      next.phase = "run";
      next.phaseElapsed = 0;
    }
  }
  if (next.phase === "run" && remaining > 0) {
    nextX -= Math.max(0, Number(runSpeed) || 0) * remaining;
    next.phaseElapsed += remaining;
    const destination = Number(baseX) || 0;
    if (nextX <= destination) {
      nextX = destination;
      next.complete = true;
    }
  }
  return Object.freeze({ runtime: Object.freeze(next), x: nextX });
}

export function mayoRetreatSpriteState(runtime) {
  if (!runtime) return "idle";
  if (runtime.phase === "fall") return "death";
  if (runtime.phase === "rise") return "hit";
  return runtime.phase === "run" ? "move" : "idle";
}
