export function v100StageDiscovered(save, stageId) {
  return Boolean(stageId && (save?.availableStageIds?.includes(stageId)
    || save?.completedStageIds?.includes(stageId)));
}

export function v100MapStageName(stage, save) {
  if (!stage) return "西新ルート";
  if (!v100StageDiscovered(save, stage.id)) return `未確認区域 S${String(stage.number).padStart(2, "0")}`;
  return stage.number < 27 ? stage.displayName.replace(/RED PANTHER/gu, "赤レンズ部隊") : stage.displayName;
}
