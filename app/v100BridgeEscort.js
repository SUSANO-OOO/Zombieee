export const V100_BRIDGE_STAGE = "stage-coastal-link-bridge";
export const V100_BRIDGE_ESCORT = Object.freeze({
  bridgeEscort: true,
  startX: 258,
  endX: 884,
  // Enemies on the general road can fight the escort. Proximity damage
  // to the truck belongs to its own maintenance lane or the cannon.
  threatRadiusY: 28,
});
export const V100_BRIDGE_ART = Object.freeze({
  id: "v100-coastal-bridge-escort",
  path: "/art/v100/mission-objects/s19-coastal-bridge-escort-r1.webp",
});

export const BRIDGE_GATE_X = 753;
export const BRIDGE_HOLD_X = 645;
export const BRIDGE_GATE_SECONDS = 7;
export const BRIDGE_SHOT_FLASH = .2;
export const BRIDGE_HOLD_PROGRESS = (BRIDGE_HOLD_X - V100_BRIDGE_ESCORT.startX)
  / (V100_BRIDGE_ESCORT.endX - V100_BRIDGE_ESCORT.startX);
const CROSSING_SECONDS = 5.35;
const ARMOR_APPROACH = .39;
const FIRE_INTERVAL = 5;
const FIRE_WARNING_AT = 3.6;
const CANNON_DAMAGE = 34;

export function hasBridgeEscort(missionType, config) {
  return missionType === "escort" && config?.bridgeEscort === true;
}

export function createBridgeEscortState() {
  return { gateElapsed: null, gateReady: false, covered: false, approachSecured: false, aimTime: 0, shotFlash: 0 };
}

export function bridgeArmorCovered(escort, cartX, cartY) {
  return escort.some(unit => !unit.gateEntering && !(unit.stunned > 0)
    && unit.x - cartX >= 26 && unit.x - cartX <= 155 && Math.abs(unit.y - cartY) <= 102);
}

export function openBridgeGate(runtime) {
  if (!runtime?.bridge?.gateReady || runtime.failed || runtime.bridge.gateElapsed !== null) return runtime;
  return Object.freeze({
    ...runtime,
    bridge: Object.freeze({ ...runtime.bridge, gateElapsed: 0, gateReady: false }),
  });
}

export function advanceBridgeEscort({ runtime, nextProgress, integrity, stalled, routeBlocked, covered, approachSecured, seconds }) {
  const previous = runtime.bridge ?? createBridgeEscortState();
  const elapsed = previous.gateElapsed === null ? null : previous.gateElapsed + seconds;
  const gateElapsed = elapsed !== null && elapsed >= BRIDGE_GATE_SECONDS - 1e-9 ? BRIDGE_GATE_SECONDS : elapsed;
  const approaching = gateElapsed === null;
  // The truck halts with its nose before the bar. At the far shoulder,
  // its rear has cleared the hinge, so the closing bar cannot cut across it.
  // Once the driver accelerates, losing a flank guard exposes the truck to
  // a shot. Only an actual obstruction or damage repair stops its wheels.
  const progress = approaching ? Math.min(BRIDGE_HOLD_PROGRESS, nextProgress)
    : routeBlocked ? runtime.progress : Math.min(1, runtime.progress
      + (1 - BRIDGE_HOLD_PROGRESS) * (gateElapsed - previous.gateElapsed) / CROSSING_SECONDS);
  const arrived = progress >= 1 - 1e-9;
  const hasFiringLine = !covered && !arrived && progress >= ARMOR_APPROACH && integrity > 0;
  const aimTime = hasFiringLine ? previous.aimTime + seconds : 0;
  const fired = aimTime >= FIRE_INTERVAL;
  const remainingIntegrity = Math.max(0, integrity - (fired ? CANNON_DAMAGE : 0));

  return {
    progress: arrived ? 1 : progress,
    integrity: remainingIntegrity,
    gateTimedOut: gateElapsed === BRIDGE_GATE_SECONDS && !arrived,
    gateSecured: gateElapsed === BRIDGE_GATE_SECONDS && arrived,
    bridge: Object.freeze({
      gateElapsed,
      gateReady: approaching && progress === BRIDGE_HOLD_PROGRESS && covered && approachSecured && !stalled && remainingIntegrity > 0,
      covered,
      approachSecured,
      aimTime: fired ? 0 : aimTime,
      shotFlash: fired ? BRIDGE_SHOT_FLASH : Math.max(0, previous.shotFlash - seconds),
    }),
  };
}

export function bridgeEscortReadout(runtime) {
  const bridge = runtime?.bridge ?? createBridgeEscortState();
  const gateElapsed = bridge.gateElapsed;
  const progress = Number(runtime?.progress) || 0;
  if (runtime?.failed) {
    return { phase: "failed", label: "護衛失敗", status: runtime.gateTimedOut ? "遮断機が閉じた" : "搬送車を守れなかった",
      objective: runtime.gateTimedOut ? "遮断機が閉じ、搬送車が通れなかった" : "証拠搬送車を守れなかった" };
  }
  if (runtime?.completed) {
    return { phase: "secured", label: "通過完了", status: "閉鎖", objective: "搬送車は対岸に到着" };
  }
  if (gateElapsed !== null) {
    const remaining = Math.ceil(BRIDGE_GATE_SECONDS - gateElapsed - 1e-8);
    const objective = progress >= 1 ? "搬送車が通過。敵の追撃を止める"
      : runtime.stalled ? "進路をふさぐ敵を止める" : bridge.aimTime >= FIRE_WARNING_AT
        ? "敵装甲車が照準。味方で砲撃を抑える" : "搬送車が加速。対岸まで守る";
    return { phase: "open", label: "保守車線", status: `残り ${remaining}秒`, remaining, objective };
  }
  if (bridge.gateReady) {
    return { phase: "ready", label: "開放準備", status: "準備完了", objective: "遮断機を開け、搬送車を通す" };
  }
  if (bridge.aimTime >= FIRE_WARNING_AT) {
    return { phase: "aim", label: "敵車両が照準", status: "砲撃接近", objective: "搬送車の前に味方を出して砲撃を抑える" };
  }
  if (progress >= BRIDGE_HOLD_PROGRESS) {
    return { phase: "hold", label: "遮断機前", status: bridge.approachSecured ? "護衛待ち" : "前方を迎撃中",
      objective: bridge.approachSecured ? "搬送車の前に味方を送り、開放に備える" : "前方の敵を倒して、保守車線を確保する" };
  }
  return { phase: "escort", label: "遮断機へ", status: "閉鎖", objective: "証拠搬送車を守って遮断機へ進む" };
}
