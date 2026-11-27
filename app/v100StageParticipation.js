import { V100_STAGE_IDS } from "./v100Registry.js";

// R9 S01/S02: Paisen carries out the rescue inside the building while the
// combat party protects the route. This affects the sortie, never ownership.
export function v100StageAbsenceReason(stageId, unitId) {
  if (unitId !== "unit-paisen") return null;
  if (stageId === V100_STAGE_IDS[0]) return "パイセンは薬局で救助中。";
  if (stageId === V100_STAGE_IDS[1]) return "パイセンは庁舎で救助中。";
  return null;
}

export function v100AvailableFormation(stageId, unitIds) {
  return (Array.isArray(unitIds) ? unitIds : []).slice(0, 7)
    .filter(unitId => unitId && !v100StageAbsenceReason(stageId, unitId));
}

export function v100SortieBlockReason(stageId, unitIds) {
  if (v100AvailableFormation(stageId, unitIds).length) return null;
  const selected = (Array.isArray(unitIds) ? unitIds : []).slice(0, 7).find(Boolean);
  const absence = v100StageAbsenceReason(stageId, selected);
  return absence ? absence + "ほかの仲間を編成してください。" : "編成が空です。出撃する仲間を選んでください。";
}
