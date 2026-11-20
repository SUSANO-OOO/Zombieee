export const V100_CENTRAL_SEAL_STAGE = "stage-t-plan-central-seal";
export const V100_CENTRAL_SEAL_ART = Object.freeze({
  id: "v100-central-seal-gates",
  path: "/art/v100/mission-objects/s16-tunnel-gates-r1.webp",
});

const gateCenters = Object.freeze([556, 712, 852]);
const gateLanes = Object.freeze([212, 282, 352]);
const closingSeconds = .9;
const finalSettleSeconds = 1.1;
const reinforcementSeconds = 14;

export const V100_CENTRAL_SEAL = Object.freeze({
  centralSeal: true,
  powerCount: gateCenters.length,
  powerHoldSeconds: 4.5,
  powerXs: Object.freeze(gateCenters.map(x => x - 58)),
  powerYs: gateLanes,
  powerRadiusX: 70,
  powerRadiusY: 40,
  powerLabel: "閉鎖盤",
  powerVerb: "操作",
});

export function hasCentralSeal(missionType, config) {
  return missionType === "sequential-seal" && config?.centralSeal === true;
}

export function centralSealGateX(index) {
  return gateCenters[index];
}

export function centralSealGateDescent(runtime, index) {
  const closed = runtime.powerActivated ?? 0;
  if (index < closed) return 1;
  if (index > closed) return 0;
  const start = V100_CENTRAL_SEAL.powerHoldSeconds - closingSeconds;
  const p = Math.max(0, Math.min(1, ((runtime.powerHold ?? 0) - start) / closingSeconds));
  return p * p * (3 - 2 * p);
}

export function centralSealFinalGateSettled(power, elapsed) {
  const count = V100_CENTRAL_SEAL.powerCount;
  return power.powerActivated >= count
    && elapsed - power.powerCompletedAt[count - 1] >= finalSettleSeconds;
}

export function centralSealGateEngaged(runtime, eventIndex) {
  const closed = runtime.powerActivated ?? 0;
  return closed < V100_CENTRAL_SEAL.powerCount && eventIndex === closed + 1;
}

export function centralSealCanReinforce(game) {
  if (!centralSealGateEngaged(game.stageMission, game.eventIndex)
    || game.stageMission.powerOperating || game.enemySpawn.pending.length
    || !(game.time - game.centralSealLastIngressAt >= reinforcementSeconds)) return false;
  return game.fighters.filter(actor => actor.side === "zombie" && actor.hp > 0).length < 2;
}

export function centralSealIngressPoint(index, laneCenters, visualHalfWidth) {
  const x = centralSealGateX(index);
  const y = laneCenters[index];
  return {
    portalId: "central-tunnel-gate-" + (index + 1),
    routeId: "internal-route-" + (index + 1),
    x: x + visualHalfWidth + 4,
    y,
    combatReadyX: x - visualHalfWidth - 10,
    combatReadyY: y,
    revealX: x,
  };
}

export function centralSealReadout(runtime) {
  const closed = runtime.powerActivated ?? 0;
  const total = V100_CENTRAL_SEAL.powerCount;
  return { closed, total, phaseLabel: closed >= total ? "流入停止" : "ゲート閉鎖" };
}

export function drawV100CentralSealGates(context, runtime, stageObjects, projectY) {
  const art = stageObjects[V100_CENTRAL_SEAL_ART.id];
  if (!art?.complete || !art.naturalWidth) throw new Error("The central seal gate atlas must be decoded");
  context.save();
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  for (const [index, x] of gateCenters.entries()) {
    const y = projectY(gateLanes[index]);
    const { frame, slab, dimensions } = centralSealGateAtlas;
    context.drawImage(art, frame.x, frame.y, frame.w, frame.h,
      x - dimensions.width / 2, y - dimensions.height, dimensions.width, dimensions.height);
    const descent = centralSealGateDescent(runtime, index);
    if (descent <= 0) continue;
    // Show the lower section of the moving plate as it emerges from the housing.
    // A fixed edge and an alpha sprite keep the tunnel itself visible as it closes.
    context.drawImage(art, slab.x, slab.y + slab.h * (1 - descent), slab.w, slab.h * descent,
      x + dimensions.shutterX, y + dimensions.shutterTop, dimensions.shutterWidth, dimensions.shutterHeight * descent);
  }
  context.restore();
}

// The selected plate and frame share one compact offline sheet.
const centralSealGateAtlas = Object.freeze({
  frame: { x: 0, y: 0, w: 460, h: 319 },
  slab: { x: 476, y: 0, w: 336, h: 251 },
  dimensions: { width: 168, height: 116.5, shutterX: -56, shutterTop: -81, shutterWidth: 115, shutterHeight: 75 },
});
