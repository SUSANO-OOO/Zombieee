export const V100_NODE_ART = "/art/v100/mission-objects/node-states-v1.webp";
export const V100_NODE_PROFILES = Object.freeze({
  "stage-hospital-evacuation-route": Object.freeze({ label: "電源", verb: "起動", shape: "cabinet" }),
  "stage-t-plan-outer-core": Object.freeze({ label: "電源", verb: "起動", shape: "cabinet" }),
  "stage-t-plan-central-seal": Object.freeze({ label: "封鎖装置", verb: "作動", shape: "cabinet" }),
  "stage-national-dispersal-network": Object.freeze({ label: "散布装置", verb: "停止", shape: "trailer", shutdown: true }),
});
export const V100_NODE_STATES = Object.freeze(["off", "engaged", "on", "connection", "disconnection"]);
const TRANSITION_SECONDS = .65;

export function v100NodeState(runtime, index, elapsed, profile) {
  const initial = profile.shutdown ? "on" : "off";
  if (index < (runtime.powerActivated ?? 0)) {
    const completedAt = runtime.powerCompletedAt?.[index];
    if (Number.isFinite(completedAt) && elapsed - completedAt < TRANSITION_SECONDS) {
      return profile.shutdown ? "disconnection" : "connection";
    }
    return profile.shutdown ? "off" : "on";
  }
  if (index !== (runtime.powerActivated ?? 0)) return initial;
  if (runtime.powerOperating) {
    return elapsed - runtime.powerOperationStartedAt < TRANSITION_SECONDS ? "connection" : "engaged";
  }
  if (Number.isFinite(runtime.powerInterruptedAt) && elapsed - runtime.powerInterruptedAt < TRANSITION_SECONDS) {
    return "disconnection";
  }
  return initial;
}

// The authored rows have different heights. Anchors keep the actual cabinet
// or wheel base fixed while a cable is plugged/unplugged at its side.
const columns = [0, 400, 778, 1150, 1533, 1983];
const anchors = [213, 593, 971, 1342, 1718];
export function v100NodeFrame(shape, state) {
  const column = V100_NODE_STATES.indexOf(state);
  if (column < 0) throw new Error(`Unknown mission node state: ${state}`);
  const trailer = shape === "trailer";
  return { x: columns[column], y: trailer ? 500 : 0,
    w: columns[column + 1] - columns[column], h: trailer ? 293 : 500,
    anchorX: anchors[column], anchorY: trailer ? 714 : 480, scale: trailer ? .28 : .20 };
}

export function drawV100MissionNode(context, game, stageObjects, index, x, y) {
  const profile = game.definition.missionConfig.v100StageNumber && V100_NODE_PROFILES[game.definition.stageId];
  if (!profile) return false;
  const image = stageObjects["v100-mission-node-states"];
  if (!image?.complete || !image.naturalWidth) throw new Error("Mission node states must be decoded before battle starts");
  // Mission timestamps exclude preparation, exactly as advanceStationMissionRuntime does.
  const elapsed = Math.max(0, game.time - (game.definition.prepSeconds ?? 0));
  const state = v100NodeState(game.stageMission, index, elapsed, profile);
  const frame = v100NodeFrame(profile.shape, state);
  context.save();
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.fillStyle = "rgba(0,0,0,.45)";
  context.beginPath(); context.ellipse(x, y + 2, profile.shape === "trailer" ? 48 : 24, 5, 0, 0, Math.PI * 2); context.fill();
  context.drawImage(image, frame.x, frame.y, frame.w, frame.h,
    x + (frame.x - frame.anchorX) * frame.scale,
    y + (frame.y - frame.anchorY) * frame.scale,
    frame.w * frame.scale, frame.h * frame.scale);
  const complete = index < (game.stageMission.powerActivated ?? 0);
  context.font = "bold 10px sans-serif";
  context.textAlign = "center";
  context.lineWidth = 3;
  context.strokeStyle = "rgba(0,0,0,.9)";
  context.fillStyle = complete ? "#b8df83" : "#f2dbae";
  const label = `${index + 1}${complete ? ` ${profile.verb}済` : ""}`;
  context.strokeText(label, x, y + 15);
  context.fillText(label, x, y + 15);
  context.restore();
  return true;
}
