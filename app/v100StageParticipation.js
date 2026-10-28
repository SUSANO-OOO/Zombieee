import { V100_STAGE_IDS } from "./v100Registry.js";

// R9 S01/S02: Paisen carries out the rescue inside the building while the
// combat party protects the route. This affects the sortie, never ownership.
export function v100StageAbsenceReason(stageId, unitId) {
  if (unitId !== "unit-paisen") return null;
  if (stageId === V100_STAGE_IDS[0]) return "パイセンは薬局で救助中。この作戦では出撃できません。";
  if (stageId === V100_STAGE_IDS[1]) return "パイセンは庁舎で救助中。この作戦では出撃できません。";
  return null;
}

export function v100AvailableFormation(stageId, unitIds) {
  return (Array.isArray(unitIds) ? unitIds : []).slice(0, 7)
    .filter(unitId => unitId && !v100StageAbsenceReason(stageId, unitId));
}
