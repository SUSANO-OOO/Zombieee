import { drawV100Evacuee, V100_BAY_EVACUATION_ART } from "./v100BayEvacuation.js";

export const V100_CLINICAL_STAGE = "stage-mugarian-clinical-trial-wing";
export const V100_CLINICAL_RESCUE = Object.freeze({ clinicalRescue: true });
export const CLINICAL_CONTROL_X = 650;
const entranceX = 620;
const shelterX = 166;
const spacing = 18;
const batches = [
  { people: 7, delay: 0, speed: 72 },
  { people: 7, delay: 10, speed: 69 },
  { people: 8, delay: 22, speed: 75 },
  { people: 7, delay: 35, speed: 67 },
  { people: 8, delay: 49, speed: 72 },
  { people: 6, delay: 64, speed: 66 },
].map((batch) => ({ ...batch, travel: entranceX - shelterX + (batch.people - 1) * spacing }));
export const CLINICAL_RESCUE_COUNT = batches.reduce((sum, batch) => sum + batch.people, 0);

export function hasClinicalRescue(missionType, config) {
  return missionType === "timed-defense" && config?.clinicalRescue === true;
}

export function createClinicalRescueRuntime() {
  return { missionType: "timed-defense", completed: false, failed: false, transitions: [],
    clinical: { disposalStopped: false, ready: false, wait: 0, distances: batches.map(() => 0),
      moving: batches.map(() => false), arrived: 0, groupsArrived: 0, blocked: false, settle: 0 } };
}

function activeHostile(actor) {
  return actor.side === "zombie" && actor.hp > 0 && actor.combatReady !== false
    && !actor.gateEntering && !actor.contained;
}

function cabinetReachable(fighters, routeY) {
  const inReach = (actor, dx, dy) => Math.abs(actor.x - CLINICAL_CONTROL_X) <= dx && Math.abs(actor.y - routeY) <= dy;
  return fighters.some(actor => actor.side === "human" && actor.hp > 0 && actor.combatReady === true && inReach(actor, 153, 112))
    && !fighters.some(actor => activeHostile(actor) && inReach(actor, 58, 58));
}

export function stopClinicalDisposal(runtime, fighters, routeY) {
  const clinical = runtime.clinical;
  if (runtime.completed || runtime.failed || clinical.disposalStopped || !cabinetReachable(fighters, routeY)) return runtime;
  return { ...runtime, clinical: { ...clinical, disposalStopped: true, ready: false } };
}

export function advanceClinicalRescue({ runtime, fighters, dt, routeY }) {
  if (runtime.completed || runtime.failed || dt <= 0) return runtime;
  const clinical = runtime.clinical;
  if (!clinical.disposalStopped) {
    const ready = cabinetReachable(fighters, routeY);
    return clinical.ready === ready ? runtime : { ...runtime, clinical: { ...clinical, ready } };
  }
  const wait = clinical.wait + dt;
  const distances = [...clinical.distances];
  const moving = batches.map(() => false);
  const threats = fighters.filter(activeHostile);
  let blocked = false, arrived = 0, groupsArrived = 0;
  for (const [index, batch] of batches.entries()) {
    const previousClearedDoor = index === 0 || distances[index - 1] >= 120;
    const routeHasRoom = index < 2 || distances[index - 2] >= batches[index - 2].travel;
    if (distances[index] < batch.travel && wait >= batch.delay && previousClearedDoor && routeHasRoom) {
      const front = entranceX - distances[index];
      const tail = front + (batch.people - 1) * spacing;
      const danger = threats.some(actor => actor.x >= Math.max(shelterX, front - 62) && actor.x <= tail + 46
        && Math.abs(actor.y - routeY) <= 59);
      blocked ||= danger;
      moving[index] = !danger;
      if (!danger) distances[index] = Math.min(batch.travel, distances[index] + dt * batch.speed);
    }
    if (distances[index] >= batch.travel) groupsArrived += 1;
    for (let person = 0; person < batch.people; person++) {
      if (entranceX + person * spacing - distances[index] <= shelterX) arrived += 1;
    }
  }
  const settle = arrived === CLINICAL_RESCUE_COUNT ? clinical.settle + dt : 0;
  return { ...runtime, clinical: { ...clinical, wait, distances, moving, blocked, arrived, groupsArrived, settle },
    completed: settle >= .85 };
}

export function clinicalRescueReadout(runtime) {
  const rescue = runtime?.clinical;
  const count = rescue?.arrived ?? 0;
  const total = CLINICAL_RESCUE_COUNT;
  if (!rescue?.disposalStopped) {
    return { count, total, phase: rescue?.ready ? "ready" : "secured", label: "処分を停止",
      objective: rescue?.ready ? "制御盤で処分を止める" : "味方を制御盤に近づける" };
  }
  if (count === total) {
    return { count, total, phase: "rescued", label: "全員救出", objective: "全員救出。車両を守って撤収" };
  }
  const blocked = rescue.blocked && !rescue.moving.some(Boolean);
  return { count, total, phase: blocked ? "sheltering" : "evacuating", label: blocked ? "通路に敵" : "救出中",
    objective: blocked ? "敵を倒して救出路を開ける" : "収容者が車両に着くまで援護" };
}

export function drawClinicalEvacuees(context, runtime, stageObjects, routeY) {
  const rescue = runtime.clinical;
  if (!rescue.disposalStopped) return;
  const image = stageObjects[V100_BAY_EVACUATION_ART.id];
  if (!image?.complete || !image.naturalWidth) throw new Error("Clinical evacuees must be decoded before battle");
  context.save();
  context.imageSmoothingEnabled = true;
  for (const [index, batch] of batches.entries()) {
    const distance = rescue.distances[index];
    if (distance <= 0 || distance >= batch.travel) continue;
    const pose = rescue.moving[index] ? Math.floor(distance / 13) % 2 : 2;
    for (let person = 0; person < batch.people; person++) {
      const x = entranceX + person * spacing - distance;
      if (x <= shelterX || x > CLINICAL_CONTROL_X + 32) continue;
      const identity = (person + index) % 4;
      const y = routeY + (person % 2) * 15 + (index % 2) * 7;
      drawV100Evacuee(context, image, { identity, pose, x, y, height: 54 + (identity % 3) * 3 });
    }
  }
  context.restore();
}
