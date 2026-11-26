export const V100_FLOODGATE_STAGE = "stage-estuary-floodgate-seal";
export const V100_FLOODGATE = Object.freeze({ estuaryFloodgate: true });
export const ESTUARY_GATE_SILL_X = 588;
export const ESTUARY_CROP_TOP = .18;
export const FLOODGATE_CLOSE_SECONDS = 1.65;
const LOCK_SETTLE_SECONDS = .85;
const EXTRA_ARRIVAL_SECONDS = 9;

export function hasEstuaryFloodgate(missionType, config) {
  return missionType === "boss-assault" && config?.estuaryFloodgate === true;
}

export function createEstuaryFloodgateRuntime() {
  return Object.freeze({
    missionType: "boss-assault",
    completed: false,
    failed: false,
    transitions: Object.freeze([]),
    floodgateElapsed: null,
    floodgateOpenAfterDefeat: 0,
  });
}

export function beginEstuaryFloodgateClosure(runtime, bossDefeated) {
  if (!bossDefeated || runtime?.failed || runtime?.floodgateElapsed !== null) return runtime;
  return Object.freeze({ ...runtime, floodgateElapsed: 0 });
}

export function advanceEstuaryFloodgate(runtime, dt, bossDefeated) {
  if (!bossDefeated || runtime.completed || runtime.failed || !(dt > 0)) return runtime;
  if (runtime.floodgateElapsed === null) {
    const floodgateOpenAfterDefeat = Math.min(EXTRA_ARRIVAL_SECONDS, runtime.floodgateOpenAfterDefeat + dt);
    return floodgateOpenAfterDefeat === runtime.floodgateOpenAfterDefeat
      ? runtime : Object.freeze({ ...runtime, floodgateOpenAfterDefeat });
  }
  const elapsed = runtime.floodgateElapsed + dt;
  const end = FLOODGATE_CLOSE_SECONDS + LOCK_SETTLE_SECONDS;
  const completed = elapsed >= end - 1e-8;
  return Object.freeze({ ...runtime, floodgateElapsed: completed ? end : elapsed, completed });
}

export function floodgateIngressDisposition(runtime) {
  if (runtime?.floodgateElapsed != null) return "blocked";
  return runtime?.floodgateOpenAfterDefeat >= EXTRA_ARRIVAL_SECONDS ? "enter" : "hold";
}

export function floodgateClosureProgress(runtime) {
  return Math.min(1, Math.max(0, (runtime?.floodgateElapsed ?? 0) / FLOODGATE_CLOSE_SECONDS));
}

export function floodgateReadout(runtime, bossDefeated) {
  const progress = floodgateClosureProgress(runtime);
  if (progress >= 1) {
    return { phase: "sealed", label: "閉鎖完了", progress, objective: "防潮門を閉鎖。残る敵を倒す" };
  }
  if (runtime?.floodgateElapsed != null) {
    return { phase: "closing", label: "閉鎖中", progress, objective: "防潮門を閉鎖中" };
  }
  if (bossDefeated) {
    return { phase: "ready", label: "閉鎖可", progress, objective: "閉鎖盤で防潮門を閉める" };
  }
  return { phase: "blocked", label: "開放中", progress, objective: "ガイレンを倒し、防潮門を閉める" };
}

// Reuse the gates and their rain-worn metal from the actual battlefield
// painting. Each shutter descends inside its own existing aperture.
const plateWidth = 1600;
const plateHeight = 900;
const shutters = Object.freeze([
  { opening: [516,395,75,57], metal: [521,271,73,57] },
  { opening: [906,390,148,68], metal: [913,270,145,68] },
]);

export function drawEstuaryFloodgate(ctx, background, progress, width, height) {
  if (!(progress > 0) || !background?.complete || !background.naturalWidth || !background.naturalHeight) return;
  const cropTop = Math.round(background.naturalHeight * ESTUARY_CROP_TOP);
  const scaleX = background.naturalWidth / plateWidth;
  const scaleY = background.naturalHeight / plateHeight;
  const worldScaleX = width / plateWidth;
  const worldScaleY = height / (background.naturalHeight - cropTop);
  const descent = Math.min(1, progress);
  for (const { opening: [x,y,w,h], metal: [sx,sy,sw,sh] } of shutters) {
    ctx.drawImage(background, sx * scaleX, (sy + sh * (1 - descent)) * scaleY, sw * scaleX, sh * descent * scaleY,
      x * worldScaleX, (y * scaleY - cropTop) * worldScaleY, w * worldScaleX, h * descent * scaleY * worldScaleY);
  }
}
