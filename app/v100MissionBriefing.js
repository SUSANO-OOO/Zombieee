import { V100_STAGE_BY_ID } from "./v100Registry.js";
import { v100BasePresentationFor } from "./v100BasePresentation.js";
import { V100_NODE_PROFILES, V100_SUPPLY_VALVE_STAGE } from "./v100MissionNodes.js";
import { V100_RAIL_EVACUATION_STAGE } from "./v100RailEvacuation.js";
import { V100_RESCUE_CONTROL, V100_RESCUE_CONTROL_STAGE } from "./v100RescueControl.js";
import { V100_CENTRAL_SEAL, V100_CENTRAL_SEAL_STAGE } from "./v100CentralSeal.js";
import { V100_BAY_EVACUATION_STAGE } from "./v100BayEvacuation.js";
import { V100_ARCHIVE_STAGE } from "./v100ArchiveExtraction.js";
import { V100_BRIDGE_STAGE } from "./v100BridgeEscort.js";
import { V100_FLOODGATE_STAGE } from "./v100EstuaryFloodgate.js";
import { V100_MISSION_VEHICLES } from "./v100MissionVehicles.js";
import { V100_DEFENSE_OBJECTIVES } from "./v100DefenseObjectives.js";
import { CLINICAL_RESCUE_COUNT, V100_CLINICAL_STAGE } from "./v100ClinicalRescue.js";
import { V100_ARMORY_STAGE, V100_ARMORY_VEHICLE_NAME, V100_CORPORATE_CONTROLS, V100_LURE_CONTROL_NAME, V100_LURE_CONTROL_STAGE } from "./v100CorporateControl.js";
import { v100BattleDefinitionFor } from "./v100BattleAdapter.js";
import { ENEMY_CONTENT } from "./content/enemyCatalog.js";

export function v100MissionThreatsFor(stageId) {
  const stage = V100_STAGE_BY_ID[stageId];
  if (!stage) return [];
  const pack = new Set(v100BattleDefinitionFor(stageId)?.timeline.flatMap(wave => wave.units) ?? []);
  const protectedSite = v100BasePresentationFor(stage.number).label;
  const purposes = {
    charge: "突進してくる。敵が構えたら、前衛の防御技を使おう。",
    contamination: "地面を汚染する。近づかれる前に射撃で倒そう。",
    backline: "後ろにいる仲間を狙う。",
    "crawler-priority": `${protectedSite}を狙う。`,
    ranged: "離れた場所から攻撃してくる。",
    "support-object": "こちらの支援物資を狙う。",
  };
  return Object.keys(purposes).flatMap(profile => ENEMY_CONTENT
    .filter(enemy => pack.has(enemy.id) && enemy.aiProfile === profile)
    .map(enemy => ({ id: enemy.id, name: stage.number < 27 ? enemy.displayName.replace("RED PANTHER", "赤レンズ部隊") : enemy.displayName, purpose: purposes[profile] }))).slice(0, 4);
}

// The drawing explains the authored objective, not battlefield coordinates
// or freely positionable formation slots.
export function v100MissionBriefingFor(stageId) {
  const stage = V100_STAGE_BY_ID[stageId];
  if (!stage) return null;
  if (stageId === V100_SUPPLY_VALVE_STAGE) {
    return { mode: "advance", origin: "供給弁", target: "待機室", verb: "供給管を復旧" };
  }
  if (stageId === V100_RAIL_EVACUATION_STAGE) {
    return { mode: "sequence", count: 3, countUnit: "本", label: "赤いレバー", verb: "引いて民間車両を逃がす" };
  }
  if (stageId === V100_BAY_EVACUATION_STAGE) {
    return { mode: "escort", origin: "避難者十二人", target: "非常口", verb: "クロメを退け、避難路を守る" };
  }
  if (stageId === V100_ARCHIVE_STAGE) {
    return { mode: "escort", origin: "紙台帳3箱", target: "車両", verb: "遠隔消去を止め、搬出を援護" };
  }
  if (stageId === V100_BRIDGE_STAGE) {
    return { mode: "escort", origin: "証拠搬送車", target: "対岸", verb: "敵車両を抑え、遮断機を7秒だけ開ける" };
  }
  if (stageId === V100_FLOODGATE_STAGE) {
    return { mode: "advance", origin: "ガイレンを撃破", target: "防潮門", verb: "閉鎖盤で閉める" };
  }
  if (stageId === V100_CLINICAL_STAGE) {
    return { mode: "escort", origin: `収容者${CLINICAL_RESCUE_COUNT}人`, target: "車両", verb: "処分を止め、救出路を守る" };
  }
  if (stageId === V100_LURE_CONTROL_STAGE) {
    return { mode: "advance", origin: "物流本部の門", target: V100_LURE_CONTROL_NAME, verb: "航空支援でも直接狙える" };
  }
  if (stageId === V100_ARMORY_STAGE) {
    return { mode: "advance", origin: "追撃を退ける", target: V100_ARMORY_VEHICLE_NAME, verb: "止めて認証キーを回収" };
  }
  if (stageId === V100_CENTRAL_SEAL_STAGE) {
    return { mode: "sequence", count: V100_CENTRAL_SEAL.powerCount, countUnit: "基",
      label: "地下道のゲート", verb: "閉じて感染者の流入を止める" };
  }
  if (stageId === V100_RESCUE_CONTROL_STAGE) {
    return { mode: "sequence", count: V100_RESCUE_CONTROL.powerCount, countUnit: "台",
      label: "救難回線の制御盤", verb: "復旧して制御区を守る" };
  }
  const node = V100_NODE_PROFILES[stageId];
  if (node) return { mode: "sequence", count: stage.objectiveId.includes("four") ? 4 : 3, label: node.label, verb: node.verb };
  const vehicle = V100_MISSION_VEHICLES[stageId];
  if (vehicle) return { mode: "escort", origin: vehicle.count === 3 ? "冷蔵車3台" : vehicle.targetLabel, target: vehicle.destinationLabel ?? "目的地", verb: vehicle.count === 3 ? "追い込んで確保する" : "護送" };
  if (stage.number === 24) return { mode: "advance", origin: "中央制御盤", target: "フタゴ", verb: "制御を止めて二体を撃破" };
  if (stage.number === 25) return { mode: "hold", origin: "医療物資", target: "変異ムガリアン社長", verb: "医療物資を守って撃破" };
  if (stage.number === 29) return { mode: "dual-target", targets: ["国外起動回線", "感染源原株"], verb: "両方を破壊" };
  if (stage.missionType === "timed-defense") return { mode: "hold", origin: V100_DEFENSE_OBJECTIVES[stageId]?.label ?? "防衛線", target: "敵", verb: "近づく敵を食い止める" };
  const control = V100_CORPORATE_CONTROLS[stageId];
  if (stage.missionType === "boss") {
    if (control) return { mode: "advance", origin: "部隊", target: control, verb: "ボスを倒して装置を壊す" };
    if (stage.number === 3 || stage.number === 30) return { mode: "advance", origin: "部隊", target: "ボス", verb: "ボスと残りの敵を倒す" };
    return { mode: "advance", origin: "部隊", target: "ボス・感染核", verb: "ボスを倒し、感染核を壊す" };
  }
  return { mode: "advance", origin: "部隊", target: control ?? "感染拠点", verb: "制圧" };
}
