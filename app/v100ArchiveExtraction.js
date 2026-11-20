export const V100_ARCHIVE_STAGE = "stage-civic-archive-route";
export const V100_ARCHIVE_EXTRACTION = Object.freeze({ archiveExtraction: true });
export const V100_ARCHIVE_ART = Object.freeze({
  id: "v100-archive-extraction",
  path: "/art/v100/mission-objects/s18-archive-extraction-r1.webp",
});
export const V100_ARCHIVE_BACKGROUND = "/art/v100/stages/s18-civic-archive-basement-r1.webp";

export const ARCHIVE_TERMINAL_X = 665;
export const ARCHIVE_ROUTE_Y = 282;
export const ARCHIVE_BOX_COUNT = 3;
// The opening scene stages the cartons behind the defense line.
export const ARCHIVE_PICKUP_X = 452;
const vehicleX = 166;
const routeLength = ARCHIVE_PICKUP_X - vehicleX;
const dispatchWaves = [1, 3, 5];
const courierSpeeds = [70, 65, 69];

export function hasArchiveExtraction(missionType, config) {
  return missionType === "timed-defense" && config?.archiveExtraction === true;
}

export function createArchiveExtractionRuntime() {
  return {
    missionType: "timed-defense",
    archiveReady: false,
    archiveStopped: false,
    archiveDistances: [0, 0, 0],
    archiveMoving: [false, false, false],
    archiveDelivered: 0,
    archiveBlocked: false,
    completed: false,
    failed: false,
    transitions: [],
  };
}

function activeInfected(actor) {
  return actor.side === "zombie" && actor.hp > 0 && actor.combatReady !== false
    && actor.gateEntering !== true && actor.contained !== true;
}

export function archiveTerminalReady(fighters, routeY) {
  const covered = fighters.some(actor => actor.side === "human" && actor.hp > 0 && actor.combatReady
    && Math.abs(actor.x - ARCHIVE_TERMINAL_X) <= 138 && Math.abs(actor.y - routeY) <= 92);
  return covered && !fighters.some(actor => activeInfected(actor)
    && Math.abs(actor.x - ARCHIVE_TERMINAL_X) <= 61 && Math.abs(actor.y - routeY) <= 66);
}

export function stopArchiveErase(runtime, fighters, routeY) {
  if (runtime.archiveStopped || !archiveTerminalReady(fighters, routeY)) return runtime;
  return { ...runtime, archiveStopped: true, archiveReady: false };
}

export function advanceArchiveExtraction({ runtime, fighters, dt, eventIndex, routeY }) {
  if (runtime.completed || runtime.failed || eventIndex < 1 || dt <= 0) return runtime;
  if (!runtime.archiveStopped) {
    const archiveReady = archiveTerminalReady(fighters, routeY);
    return archiveReady === runtime.archiveReady ? runtime : { ...runtime, archiveReady };
  }

  const threats = fighters.filter(activeInfected);
  const archiveDistances = [...runtime.archiveDistances];
  const archiveMoving = [false, false, false];
  let archiveBlocked = false;
  for (const [index, firstWave] of dispatchWaves.entries()) {
    if (eventIndex < firstWave || archiveDistances[index] >= routeLength
      || (index > 0 && archiveDistances[index - 1] < 155)) continue;
    const x = ARCHIVE_PICKUP_X - archiveDistances[index];
    const y = routeY + index * 8;
    const blocked = threats.some(actor => actor.x >= x - 87 && actor.x <= x + 58
      && Math.abs(actor.y - y) <= 54);
    if (blocked) {
      archiveBlocked = true;
      continue;
    }
    archiveDistances[index] = Math.min(routeLength, archiveDistances[index] + dt * courierSpeeds[index]);
    archiveMoving[index] = true;
  }
  const archiveDelivered = archiveDistances.filter(distance => distance === routeLength).length;
  return { ...runtime, archiveDistances, archiveMoving, archiveDelivered, archiveBlocked,
    completed: archiveDelivered === ARCHIVE_BOX_COUNT };
}

export function archiveExtractionReadout(runtime, remaining) {
  const stopped = runtime?.archiveStopped === true;
  const count = runtime?.archiveDelivered ?? 0;
  if (!stopped) {
    const ready = runtime?.archiveReady === true;
    return { phase: ready ? "ready" : "erasing", phaseLabel: "消去を阻止", count, remaining,
      objective: ready ? "消去を止めるボタンをタップ" : "端末に味方を近づける" };
  }
  if (count === ARCHIVE_BOX_COUNT) {
    return { phase: "secured", phaseLabel: "搬出完了", count, remaining,
      objective: remaining > 0 ? "搬出完了。車両を守る" : "台帳の搬出完了" };
  }
  return { phase: "transfer", phaseLabel: "台帳搬出", count, remaining,
    objective: runtime.archiveBlocked && !runtime.archiveMoving.some(Boolean)
      ? "敵を倒して搬出路を開ける" : "紙台帳を運ぶ仲間を援護" };
}

const cellWidth = 104;
const cellHeight = 132;

export function drawArchiveExtraction(ctx, runtime, stageObjects, routeY) {
  const art = stageObjects[V100_ARCHIVE_ART.id];
  if (!art?.complete || !art.naturalWidth) throw new Error("Archive artwork must be decoded before battle");
  function draw(cell, x, y, scale) {
    const width = cellWidth * scale, height = cellHeight * scale;
    ctx.fillStyle = "rgba(0,0,0,.32)";
    ctx.beginPath();
    ctx.ellipse(x, y + 1, width * .24, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(art, cell % 3 * cellWidth, Math.floor(cell / 3) * cellHeight,
      cellWidth, cellHeight, x - width / 2, y - height, width, height);
  }

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  draw(runtime.archiveStopped ? 1 : 0, ARCHIVE_TERMINAL_X, routeY - 5, .72);
  if (runtime.archiveDistances.some(distance => distance === 0)) draw(2, ARCHIVE_PICKUP_X + 20, routeY + 7, .65);
  for (const [index, distance] of runtime.archiveDistances.entries()) {
    if (distance <= 0 || distance >= routeLength) continue;
    const pose = runtime.archiveMoving[index] ? 3 + Math.floor(distance / 14) % 2 : 5;
    draw(pose, ARCHIVE_PICKUP_X - distance, routeY + index * 8, .60);
  }
  ctx.restore();
}
