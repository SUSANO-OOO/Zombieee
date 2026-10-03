import { V100_STAGE_BY_ID } from "./v100Registry.js";
import { V100_NODE_PROFILES } from "./v100MissionNodes.js";
import { V100_MISSION_VEHICLES } from "./v100MissionVehicles.js";
import { V100_DEFENSE_OBJECTIVES } from "./v100DefenseObjectives.js";
import { V100_CORPORATE_CONTROLS } from "./v100CorporateControl.js";
import { v100BattleDefinitionFor } from "./v100BattleAdapter.js";
import { ENEMY_CONTENT } from "./content/enemyCatalog.js";

export function v100MissionThreatsFor(stageId) {
  const stage = V100_STAGE_BY_ID[stageId];
  if (!stage) return [];
  const pack = new Set(v100BattleDefinitionFor(stageId)?.timeline.flatMap(wave => wave.units) ?? []);
  const purposes = { charge: "突進して前線を抜ける。予告に守備の固有技を合わせる", contamination: "汚染する範囲を残す。射撃で近づく前に倒す", backline: "後衛を狙う", "crawler-priority": "装甲車両を狙う", ranged: "離れた位置から攻撃", "support-object": "支援物を狙う" };
  return Object.keys(purposes).flatMap(profile => ENEMY_CONTENT
    .filter(enemy => pack.has(enemy.id) && enemy.aiProfile === profile)
    .map(enemy => ({ id: enemy.id, name: stage.number < 27 ? enemy.displayName.replace("RED PANTHER", "赤レンズ部隊") : enemy.displayName, purpose: purposes[profile] }))).slice(0, 4);
}

// The drawing explains the authored objective, not battlefield coordinates
// or freely positionable formation slots.
export function v100MissionBriefingFor(stageId) {
  const stage = V100_STAGE_BY_ID[stageId];
  if (!stage) return null;
  const node = V100_NODE_PROFILES[stageId];
  if (node) return { mode: "sequence", count: stage.objectiveId.includes("four") ? 4 : 3, label: node.label, verb: node.verb };
  const vehicle = V100_MISSION_VEHICLES[stageId];
  if (vehicle) return { mode: "escort", origin: vehicle.count === 3 ? "冷蔵車3台" : vehicle.targetLabel, target: vehicle.destinationLabel ?? "目的地", verb: vehicle.count === 3 ? "追込み・確保" : "護送" };
  if (stage.number === 29) return { mode: "dual-target", targets: ["国外起動回線", "感染源原株"], verb: "両方を破壊" };
  if (stage.missionType === "timed-defense") return { mode: "hold", origin: V100_DEFENSE_OBJECTIVES[stageId]?.label ?? "防衛線", target: "敵侵入", verb: "維持" };
  const control = V100_CORPORATE_CONTROLS[stageId];
  if (stage.missionType === "boss") return { mode: "advance", origin: "部隊", target: control ?? (stage.number === 3 || stage.number === 30 ? "ボス" : "ボス・感染核"), verb: control ? "ボス撃破 → 破壊" : stage.number === 3 || stage.number === 30 ? "撃破・残敵排除" : "撃破 → 核破壊" };
  return { mode: "advance", origin: "部隊", target: control ?? "感染拠点", verb: "制圧" };
}
