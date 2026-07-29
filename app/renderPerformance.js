export const GRAPHICS_QUALITY_MODES = Object.freeze({
  AUTO: "auto",
  HIGH: "high",
  POWER_SAVE: "power-save",
});

export const GRAPHICS_QUALITY_ORDER = Object.freeze([
  GRAPHICS_QUALITY_MODES.AUTO,
  GRAPHICS_QUALITY_MODES.HIGH,
  GRAPHICS_QUALITY_MODES.POWER_SAVE,
]);

export const RUNTIME_SIMULATION_HZ = 60;
export const RUNTIME_SIMULATION_STEP_SECONDS = 1 / RUNTIME_SIMULATION_HZ;
export const RUNTIME_MAX_CATCH_UP_STEPS = 5;

const QUALITY_PROFILES = Object.freeze({
  high: Object.freeze({
    resolvedMode: "high",
    renderHz: 60,
    dprCap: 2,
    effectDensity: 1,
    cullingMargin: 96,
    smoothingQuality: "high",
  }),
  balanced: Object.freeze({
    resolvedMode: "balanced",
    renderHz: 45,
    dprCap: 1.5,
    effectDensity: 0.72,
    cullingMargin: 72,
    smoothingQuality: "medium",
  }),
  "power-save": Object.freeze({
    resolvedMode: "power-save",
    renderHz: 30,
    dprCap: 1,
    effectDensity: 0.48,
    cullingMargin: 48,
    smoothingQuality: "low",
  }),
});

function normalizedQualityMode(value) {
  return GRAPHICS_QUALITY_ORDER.includes(value)
    ? value
    : GRAPHICS_QUALITY_MODES.AUTO;
}

function finitePositive(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

export function resolveGraphicsProfile(requestedMode, hints = {}) {
  const mode = normalizedQualityMode(requestedMode);
  const width = finitePositive(hints.width, 1280);
  const height = finitePositive(hints.height, 720);
  const shortestSide = Math.min(width, height);
  const deviceMemory = finitePositive(hints.deviceMemory, 8);
  const hardwareConcurrency = finitePositive(hints.hardwareConcurrency, 8);
  const mobileLandscape = shortestSide <= 500 || hints.mobile === true;
  const constrainedDevice = deviceMemory <= 4 || hardwareConcurrency <= 4;
  const profileKey = mode === GRAPHICS_QUALITY_MODES.HIGH
    ? "high"
    : mode === GRAPHICS_QUALITY_MODES.POWER_SAVE
      ? "power-save"
      : mobileLandscape || constrainedDevice
        ? "balanced"
        : "high";
  return Object.freeze({
    requestedMode: mode,
    simulationHz: RUNTIME_SIMULATION_HZ,
    ...QUALITY_PROFILES[profileKey],
  });
}

export function createRuntimeFrameSchedule(nowMs = null) {
  const normalizedNow = Number(nowMs);
  return {
    previousNowMs: Number.isFinite(normalizedNow) ? normalizedNow : null,
    lastRenderAtMs: null,
    simulationAccumulatorSeconds: 0,
    renderAccumulatorMs: 0,
  };
}

export function resetRuntimeFrameSchedule(schedule, nowMs = null) {
  const reset = createRuntimeFrameSchedule(nowMs);
  if (schedule && typeof schedule === "object") {
    schedule.previousNowMs = reset.previousNowMs;
    schedule.lastRenderAtMs = reset.lastRenderAtMs;
    schedule.simulationAccumulatorSeconds = reset.simulationAccumulatorSeconds;
    schedule.renderAccumulatorMs = reset.renderAccumulatorMs;
    return schedule;
  }
  return reset;
}

export function advanceRuntimeFrameSchedule(schedule, nowMs, profile) {
  const runtime = schedule && typeof schedule === "object"
    ? schedule
    : createRuntimeFrameSchedule();
  const now = Number.isFinite(Number(nowMs)) ? Number(nowMs) : 0;
  const renderHz = Math.min(60, Math.max(1, finitePositive(profile?.renderHz, 60)));
  const renderIntervalMs = 1000 / renderHz;
  const previousNow = runtime.previousNowMs;
  const rawElapsedSeconds = previousNow === null
    ? 0
    : Math.max(0, (now - previousNow) / 1000);
  const acceptedElapsedSeconds = Math.min(
    rawElapsedSeconds,
    RUNTIME_SIMULATION_STEP_SECONDS * RUNTIME_MAX_CATCH_UP_STEPS,
  );
  runtime.previousNowMs = now;
  const previousAccumulator = Number(runtime.simulationAccumulatorSeconds);
  runtime.simulationAccumulatorSeconds = (
    Number.isFinite(previousAccumulator) && previousAccumulator >= 0
      ? previousAccumulator
      : 0
  ) + acceptedElapsedSeconds;
  let simulationStepCount = Math.min(
    RUNTIME_MAX_CATCH_UP_STEPS,
    Math.floor((runtime.simulationAccumulatorSeconds + 1e-9) / RUNTIME_SIMULATION_STEP_SECONDS),
  );
  runtime.simulationAccumulatorSeconds = Math.max(
    0,
    runtime.simulationAccumulatorSeconds - simulationStepCount * RUNTIME_SIMULATION_STEP_SECONDS,
  );
  const previousRenderAccumulator = Number(runtime.renderAccumulatorMs);
  runtime.renderAccumulatorMs = Math.max(
    0,
    Number.isFinite(previousRenderAccumulator) ? previousRenderAccumulator : 0,
  ) + Math.min(renderIntervalMs, rawElapsedSeconds * 1000);
  const firstRender = runtime.lastRenderAtMs === null;
  const shouldRender = firstRender
    || runtime.renderAccumulatorMs + 1e-6 >= renderIntervalMs;
  if (shouldRender) {
    runtime.lastRenderAtMs = now;
    runtime.renderAccumulatorMs = firstRender
      ? 0
      : Math.max(0, runtime.renderAccumulatorMs - renderIntervalMs);
  }
  return {
    simulationStepCount,
    simulationStepSeconds: RUNTIME_SIMULATION_STEP_SECONDS,
    shouldRender,
    renderHz,
    droppedSimulationSeconds: Math.max(0, rawElapsedSeconds - acceptedElapsedSeconds),
  };
}

export function graphicsProfileDataset(profile) {
  return {
    graphicsQualityRequested: profile.requestedMode,
    graphicsQualityResolved: profile.resolvedMode,
    graphicsSimulationHz: String(profile.simulationHz),
    graphicsRenderHz: String(profile.renderHz),
    graphicsDprCap: String(profile.dprCap),
    graphicsEffectDensity: String(profile.effectDensity),
  };
}
