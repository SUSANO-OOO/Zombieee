export const V100_BAY_EVACUATION_STAGE = "stage-bay-tower-service";
export const V100_BAY_EVACUATION = Object.freeze({ bayEvacuation: true });
export const V100_BAY_EVACUATION_ART = Object.freeze({
  id: "v100-bay-evacuees",
  path: "/art/v100/mission-objects/s17-bay-evacuees-r1.webp",
});
export const V100_BAY_BACKGROUND = "/art/v100/stages/s17-bay-emergency-gallery-r1.webp";

const groups = Object.freeze([715, 773, 833]);
const peoplePerGroup = 4;
const spacing = 30;
const shelterX = 146;
const spread = (peoplePerGroup - 1) * spacing;
const speeds = Object.freeze([76, 72, 63]);
export const V100_BAY_REFUGEE_COUNT = groups.length * peoplePerGroup;
export const V100_BAY_ROUTE_Y = 267;

export function hasBayEvacuation(missionType, config) {
  return missionType === "boss-assault" && config?.bayEvacuation === true;
}

export function createBayEvacuationRuntime() {
  return { missionType: "boss-assault", evacuationDistances: [0, 0, 0], evacuationMoving: [false, false, false],
    evacuatedCount: 0, evacuationBlocked: false, evacuationSettling: 0, completed: false, failed: false, transitions: [] };
}

export function advanceBayEvacuationRuntime({ runtime, fighters, dt, eventIndex, baseHp, bossDefeated, bossDefeatPending, routeY }) {
  if (baseHp <= 0) return { ...runtime, failed: true, completed: false };
  if (runtime.completed || runtime.failed || eventIndex < 1 || dt <= 0) return runtime;
  const safeBoss = bossDefeated === true || bossDefeatPending === true;
  const hostiles = fighters.filter(actor => actor.side === "zombie" && actor.hp > 0 && !actor.contained);
  const boss = hostiles.find(actor => actor.kind === "kurome");
  const beam = boss?.stationAbility;
  const beamAtRoute = beam && ["locked", "firing"].includes(beam.phase)
    && Number.isFinite(beam.targetY) && Math.abs(beam.targetY - routeY) < 48;
  const cover = safeBoss || fighters.some(actor => actor.side === "human" && actor.hp > 0 && actor.combatReady && actor.x > 225);
  const distances = [...runtime.evacuationDistances], moving = [false, false, false];
  let evacuatedCount = 0;
  let blocked = false;
  for (const [i, start] of groups.entries()) {
    const max = start - shelterX + spread;
    const x = start - distances[i];
    const ready = (i === 0 || distances[i - 1] >= 140) && (i < 2 || Boolean(boss) || safeBoss);
    if (ready && distances[i] < max) {
      const routeThreat = hostiles.some(actor => actor.x >= Math.max(shelterX, x - 76) && actor.x <= x + spread + 54
        && Math.abs(actor.y - routeY) < 56);
      moving[i] = cover && !routeThreat && !beamAtRoute;
      if (moving[i]) distances[i] = Math.min(max, distances[i] + dt * speeds[i]);
      else blocked ||= Boolean(routeThreat || beamAtRoute);
    }
    for (let person = 0; person < peoplePerGroup; person++) {
      if (start + person * spacing - distances[i] <= shelterX) evacuatedCount++;
    }
  }
  const evacuationSettling = evacuatedCount >= V100_BAY_REFUGEE_COUNT ? (runtime.evacuationSettling ?? 0) + dt : 0;
  return { ...runtime, evacuationDistances: distances, evacuationMoving: moving, evacuatedCount,
    evacuationBlocked: blocked, evacuationSettling, completed: evacuationSettling >= .85 };
}

export function bayEvacuationReadout(runtime) {
  const count = runtime.evacuatedCount ?? 0;
  const complete = count >= V100_BAY_REFUGEE_COUNT;
  const moving = runtime.evacuationMoving?.some(Boolean);
  const phase = complete ? "safe" : moving ? "moving" : runtime.evacuationBlocked ? "sheltering" : "waiting";
  return {
    phase, count, total: V100_BAY_REFUGEE_COUNT,
    label: "避難者", status: count + "/" + V100_BAY_REFUGEE_COUNT + " 人",
    phaseLabel: complete ? "避難完了" : moving ? "避難中" : "避難路確保",
  };
}

export function bayEvacuationObjective(runtime, bossDefeated) {
  if ((runtime?.evacuatedCount ?? 0) >= V100_BAY_REFUGEE_COUNT) return bossDefeated ? "全員避難。残る敵を倒す" : "全員避難。クロメを倒す";
  if (runtime?.evacuationBlocked && !runtime.evacuationMoving?.some(Boolean)) return "敵を倒して避難路を開ける";
  return "十二人の避難路を守る";
}

const cellWidth = 122;
const cellHeight = 148;

export function drawV100Evacuee(context, image, { identity, pose, x, y, height }) {
  const width = height * cellWidth / cellHeight;
  context.fillStyle = "rgba(0,0,0,.30)";
  context.beginPath();
  context.ellipse(x, y + 1, 10, 2.4, 0, 0, Math.PI * 2);
  context.fill();
  context.drawImage(image, identity * cellWidth, pose * cellHeight, cellWidth, cellHeight, x - width / 2, y - height, width, height);
}

export function drawV100BayEvacuees(context, runtime, stageObjects, laneY) {
  const image = stageObjects[V100_BAY_EVACUATION_ART.id];
  if (!image?.complete || !image.naturalWidth) throw new Error("Bay Tower evacuees must be decoded before battle");
  context.save();
  context.imageSmoothingEnabled = true;
  for (const [index,start] of groups.entries()) {
    const distance = runtime.evacuationDistances[index];
    // Await the path in the doorway until each group reaches the corridor.
    if (index > 0 && distance === 0) continue;
    const step = runtime.evacuationMoving[index] ? Math.floor(distance / 16) % 2 : 2;
    const groundY = laneY + index * 7;
    for (let person = 0; person < peoplePerGroup; person++) {
      const x = start + spacing * person - distance;
      if (x <= shelterX) continue;
      const identity = (person + index) % peoplePerGroup;
      const y = groundY + (person % 2) * 9;
      drawV100Evacuee(context, image, { identity, pose: step, x, y, height: 59 + (identity % 3) * 3 });
    }
  }
  context.restore();
}
