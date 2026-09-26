import { v100DefenseStatus } from "./v100DefenseObjectives.js";

export const V100_CLINICAL_STAGE = "stage-mugarian-clinical-trial-wing";
export const V100_CLINICAL_CONTROL_ART = "/art/v100/mission-objects/clinical-control-states-v1.webp";
export const V100_CLINICAL_CONTROL_STATES = Object.freeze(["sealed", "releasing", "complete", "failed"]);
// Blank columns isolate complete authored silhouettes, including the lever and
// attached roots. Body anchors share the same scale and ground baseline.
const columns = [0, 530, 1030, 1535, 2010];
const anchors = [275, 780, 1280, 1785];
export function v100ClinicalControlState(definition, game) {
  if (definition.stageId !== V100_CLINICAL_STAGE) return null;
  const defense = v100DefenseStatus(definition, game);
  if (!defense) return null;
  return defense.phase === "failed" ? "failed" : defense.completed ? "complete"
    : game.time <= definition.prepSeconds ? "sealed" : "releasing";
}

export function drawV100ClinicalControl(context, game, stageObjects, x, y) {
  const state = v100ClinicalControlState(game.definition, game);
  if (!state) return false;
  const image = stageObjects.clinicalControlStates;
  if (!image?.complete || !image.naturalWidth) throw new Error("Clinical control states must be decoded before battle starts");
  const index = V100_CLINICAL_CONTROL_STATES.indexOf(state), left = columns[index];
  const width = columns[index + 1] - left, scale = .32;
  context.save();
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.fillStyle = "rgba(0,0,0,.4)";
  context.beginPath(); context.ellipse(x, y, 54, 6, 0, 0, Math.PI * 2); context.fill();
  context.drawImage(image, left, 0, width, 782,
    x + (left - anchors[index]) * scale, y - 577 * scale, width * scale, 782 * scale);
  context.restore();
  return true;
}
