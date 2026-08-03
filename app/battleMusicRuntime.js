export const PRESSURE_LATCH_SECONDS = 0.75;

export function createPressureLatchRuntime() {
  return {
    latched: false,
    deadline: null,
    battleGeneration: 0,
  };
}

export function resetPressureLatchRuntime(runtime, reason = "reset") {
  if (!runtime || typeof runtime !== "object") return createPressureLatchRuntime();
  runtime.latched = false;
  runtime.deadline = null;
  runtime.battleGeneration += 1;
  runtime.lastResetReason = reason;
  return runtime;
}

export function advancePressureLatch(runtime, { rawPressure = false, simulationTime = 0 } = {}) {
  if (!runtime || typeof runtime !== "object") return createPressureLatchRuntime();
  const now = Number(simulationTime);
  if (!Number.isFinite(now)) return runtime;
  if (rawPressure) {
    runtime.latched = true;
    runtime.deadline = null;
    return runtime;
  }
  if (!runtime.latched) return runtime;
  if (runtime.deadline === null) {
    runtime.deadline = now + PRESSURE_LATCH_SECONDS;
    return runtime;
  }
  if (now >= runtime.deadline) {
    runtime.latched = false;
    runtime.deadline = null;
  }
  return runtime;
}

export function pressureLatchSnapshot(runtime) {
  if (!runtime) return null;
  return Object.freeze({
    latched: Boolean(runtime.latched),
    deadline: runtime.deadline,
    battleGeneration: runtime.battleGeneration,
  });
}
