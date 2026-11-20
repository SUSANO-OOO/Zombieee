import { CAMPAIGN_UNITS, campaignUnitIdToCombatKind } from "./campaign.js";
import { PREP_SECONDS } from "./gameRules.js";
import { V100_MISSION_VEHICLES } from "./v100MissionVehicles.js";
import { V100_NODE_PROFILES, V100_SUPPLY_VALVE, V100_SUPPLY_VALVE_STAGE } from "./v100MissionNodes.js";
import { V100_RAIL_EVACUATION, V100_RAIL_EVACUATION_STAGE } from "./v100RailEvacuation.js";
import { V100_RESCUE_CONTROL, V100_RESCUE_CONTROL_STAGE } from "./v100RescueControl.js";
import { V100_CENTRAL_SEAL, V100_CENTRAL_SEAL_STAGE } from "./v100CentralSeal.js";
import { V100_BAY_EVACUATION, V100_BAY_EVACUATION_STAGE } from "./v100BayEvacuation.js";
import { V100_ARCHIVE_EXTRACTION, V100_ARCHIVE_STAGE } from "./v100ArchiveExtraction.js";
import { V100_BRIDGE_ESCORT, V100_BRIDGE_STAGE } from "./v100BridgeEscort.js";
import { V100_FLOODGATE, V100_FLOODGATE_STAGE } from "./v100EstuaryFloodgate.js";
import { V100_ARMORY_OBJECTIVE, V100_ARMORY_STAGE, V100_CORPORATE_CONTROLS, V100_LURE_CONTROL_OBJECTIVE, V100_LURE_CONTROL_STAGE } from "./v100CorporateControl.js";
import { V100_DEFENSE_OBJECTIVES } from "./v100DefenseObjectives.js";
import { CLINICAL_RESCUE_COUNT, V100_CLINICAL_RESCUE, V100_CLINICAL_STAGE } from "./v100ClinicalRescue.js";
import { researchCoreObjective, V100_RESEARCH_CORE_STAGE, V100_RESEARCH_TARGETS } from "./v100ResearchCore.js";
import { v100IncreaseWaveDensity } from "./v100CombatTuning.js";
import { withClearDrivenAssaultWaves } from "./wavePacing.js";
import { v100AvailableFormation, v100StageAbsenceReason } from "./v100StageParticipation.js";
import { v100EquipmentSnapshot, v100OpeningSupportGauge } from "./v100Equipment.js";
import {
  V100_BOSS_BY_ID,
  V100_STAGE_BY_ID,
  V100_STAGE_IDS,
  V100_VEHICLE,
  v100SupportFor,
} from "./v100Registry.js";

const BOSS_KIND_BY_V100_ID = Object.freeze({
  "boss-takuya": "takuya",
  "boss-gate-eater": "gate-eater",
  "boss-mother": "mother",
  "boss-ooguchi": "ooguchi",
  "boss-kurome": "kurome",
  "boss-gairen": "gairen",
  "boss-futago": "futago",
  "boss-mugarian-president-mutated": "mugarian-president-mutated",
  "boss-takuya-omega": "takuya-omega",
});

// Design Lock 17.5 owns these identities. A missing row must fail closed:
// silently falling back to P previously put SMG units into Stage 24.
const A = Object.freeze(["walker", "runner", "spitter", "crusher"]);
const B = Object.freeze([...A, "grappler", "ooze", "sprinter"]);
const C = Object.freeze([...B, "shade", "abomination"]);
const D = Object.freeze(["resonator", "cagewalker", "spindle", "choir-knot", "pall-manta", "anchor-bloom"]);
const P = Object.freeze(["red-panther-knife", "red-panther-shield", "red-panther-smg", "red-panther-commander"]);
export const V100_ENEMY_PACKS = Object.freeze({
  A, B, C, D, P,
  "A+abomination": Object.freeze([...A, "abomination"]),
  "A+shade/abomination": Object.freeze([...A, "shade", "abomination"]),
  "A+grappler": Object.freeze([...A, "grappler"]),
  "A+ooze/sprinter": Object.freeze([...A, "ooze", "sprinter"]),
  "B+shade": Object.freeze([...B, "shade"]),
  "D+panther-knife/smg": Object.freeze([...D, "red-panther-knife", "red-panther-smg"]),
  "D+panther-shield/smg": Object.freeze([...D, "red-panther-shield", "red-panther-smg"]),
  "D+panther-smg/commander": Object.freeze([...D, "red-panther-smg", "red-panther-commander"]),
  "D+panther-shield/smg/commander": Object.freeze([...D, "red-panther-shield", "red-panther-smg", "red-panther-commander"]),
  "panther-shield/commander": Object.freeze(["red-panther-shield", "red-panther-commander"]),
  "A-add-waves": A,
});

const MISSION_TYPE_MAP = Object.freeze({
  assault: "assault",
  "timed-defense": "timed-defense",
  boss: "boss-assault",
  escort: "escort",
  power: "sequential-seal",
  seal: "sequential-seal",
});

const MISSION_LABELS = Object.freeze({
  assault: "感染拠点を制圧",
  "timed-defense": "防衛線を維持",
  boss: "ボスを撃破",
  escort: "目標を護送",
  power: "電源ノードを順番に起動",
  seal: "封鎖ノードを順番に起動",
});

// Map briefing and battle phases describe the same authored objective.
export function v100MissionObjectiveFor(stageId) {
  const stage = V100_STAGE_BY_ID[stageId];
  if (!stage) return "ステージの目標を達成";
  if (stage.number === 3) return "大型変異感染者TAKUYAを撃破";
  if (stage.number === 5) return "改札喰いを倒し、感染核を破壊";
  if (stageId === V100_SUPPLY_VALVE_STAGE) return "供給管を復旧し、MOTHERを倒す";
  if (stageId === V100_RAIL_EVACUATION_STAGE) return "レバーを3つ引いて民間車両を逃がし、オオグチを倒す";
  if (stageId === V100_RESCUE_CONTROL_STAGE) return "救難回線を3か所復旧し、制御区を守る";
  if (stageId === V100_CENTRAL_SEAL_STAGE) return "三基のゲートを閉じ、感染者の流入を止める";
  if (stageId === V100_BAY_EVACUATION_STAGE) return "クロメを退け、十二人を避難させる";
  if (stageId === V100_ARCHIVE_STAGE) return "遠隔消去を止め、紙台帳を搬出する";
  if (stage.number === 30) return "TAKUYA-Ωを撃破し、西新を守る";
  if (stageId === V100_LURE_CONTROL_STAGE) return V100_LURE_CONTROL_OBJECTIVE;
  if (stageId === V100_ARMORY_STAGE) return V100_ARMORY_OBJECTIVE;
  if (stage.number === 24) return "中央制御盤を止め、フタゴを撃破";
  if (stage.number === 25) return "医療物資を守り、変異ムガリアン社長を止める";
  const control = V100_CORPORATE_CONTROLS[stageId];
  if (control) {
    const bossId = stage.firstClearPayload.find(value => value.startsWith("boss-"));
    const bossName = V100_BOSS_BY_ID[bossId]?.displayName;
    return bossName ? `${bossName}を倒し、${control}を破壊` : `${control}を破壊`;
  }
  if (stageId === V100_CLINICAL_STAGE) return `処分を止め、${CLINICAL_RESCUE_COUNT}人を救出`;
  const defense = V100_DEFENSE_OBJECTIVES[stageId];
  if (defense) return defense.recordCount ? `${defense.goal}（全${defense.recordCount}室）` : defense.goal;
  if (stage.number === 29) return researchCoreObjective(null);
  const node = V100_NODE_PROFILES[stageId];
  if (node?.shutdown) return `国内${node.label}4基を順番に物理${node.verb}`;
  if (node) return `${stage.objectiveId.includes("four") ? 4 : 3}基の${node.label}を順番に${node.verb}`;
  const vehicle = V100_MISSION_VEHICLES[stageId];
  if (stageId === V100_BRIDGE_STAGE) return "証拠搬送車を護衛し、遮断機を開けて対岸へ";
  if (stageId === V100_FLOODGATE_STAGE) return "ガイレンを倒し、防潮門を閉める";
  if (vehicle?.count === 3) return "冷蔵車3台を封鎖地点へ追い込み、停止・確保";
  if (vehicle) return `${vehicle.targetLabel}を目的地へ護送`;
  return MISSION_LABELS[stage.missionType] ?? "ステージの目標を達成";
}

function freeze(value) {
  return Object.freeze(value);
}

function packFor(stage) {
  const pack = V100_ENEMY_PACKS[stage.enemyPack];
  if (!pack) throw new RangeError(`Unknown V1 enemy pack: ${stage.enemyPack}`);
  return pack;
}

function bossKindForStage(stage) {
  const boss = stage.firstClearPayload.find((value) => typeof value === "string" && value.startsWith("boss-"));
  return boss ? BOSS_KIND_BY_V100_ID[boss] ?? null : null;
}

function missionDurationSeconds(stage, missionType) {
  if (missionType === "timed-defense") return (Number(stage.objectiveId.match(/perimeter-(\d+)s/u)?.[1]) || 100) - 12;
  return stage.number === 6 ? 78 : stage.number === 12 ? 84 : 90;
}

function stageTimeline(stage, missionType, bossKind) {
  const pack = packFor(stage);
  const bossLabel = V100_BOSS_BY_ID[stage.firstClearPayload.find(value => value.startsWith("boss-"))]?.displayName ?? bossKind;
  if (stage.id === V100_ARMORY_STAGE) {
    // The commander leads the last pursuit instead of calling fresh
    // infected into each patrol and stretching the same encounter.
    return freeze([
      freeze({ at: PREP_SECONDS, wave: 1, label: "作戦庫の警備隊",
        units: freeze(["red-panther-knife", "red-panther-shield"]) }),
      freeze({ at: PREP_SECONDS + 19, wave: 2, label: "後方から追撃",
        units: freeze(["red-panther-smg", "red-panther-knife", "red-panther-shield"]) }),
      freeze({ at: PREP_SECONDS + 38, wave: 3, label: "指揮車への増援",
        units: freeze(["red-panther-shield", "red-panther-smg", "red-panther-knife", "red-panther-smg"]) }),
      freeze({ at: PREP_SECONDS + 61, wave: 4, label: "指揮官と最後の護衛",
        units: freeze(["red-panther-shield", "red-panther-commander", "red-panther-smg", "red-panther-knife"]) }),
    ]);
  }
  if (stage.id === V100_CLINICAL_STAGE) {
    // Each group threatens the corridor in turn. A second detachment cannot
    // enter while the previous one still occupies the evacuation route.
    return freeze([
      freeze({ at: PREP_SECONDS, wave: 1, label: "収容区画の警備隊",
        units: freeze(["red-panther-shield", "spindle", "red-panther-smg"]) }),
      freeze({ at: PREP_SECONDS + 17, wave: 2, label: "通路に感染者が侵入", waitForPriorWaveClear: true,
        units: freeze(["spindle", "cagewalker", "resonator"]) }),
      freeze({ at: PREP_SECONDS + 34, wave: 3, label: "非常口の警備隊", waitForPriorWaveClear: true,
        units: freeze(["red-panther-shield", "spindle", "pall-manta"]) }),
      freeze({ at: PREP_SECONDS + 52, wave: 4, label: "救出路への増援", waitForPriorWaveClear: true,
        units: freeze(["pall-manta", "red-panther-smg", "cagewalker", "spindle"]) }),
      freeze({ at: PREP_SECONDS + 72, wave: 5, label: "撤収前の最後の敵", waitForPriorWaveClear: true,
        units: freeze(["anchor-bloom", "choir-knot", "red-panther-smg", "spindle"]) }),
    ]);
  }
  if (missionType === "escort" || missionType === "timed-defense") {
    // Contacts follow distance travelled: a stalled cart cannot exhaust
    // every wave and spend its final half crossing an empty battlefield.
    let cursor = 0;
    const duration = missionDurationSeconds(stage, missionType);
    const counts = stage.number <= 5 ? [3, 3, 4, 4, 4, 5]
      : stage.number <= 10 ? [4, 4, 5, 5, 5, 6]
        : stage.number <= 20 ? [4, 5, 5, 6, 6, 7]
          : [5, 5, 6, 6, 7, 8];
    const bridgeEscort = stage.id === V100_BRIDGE_STAGE;
    const convoyInterception = stage.number === 26;
    const escortMilestones = bridgeEscort ? [.20, .42, .57, 1] : [.2, .45, .7, .88];
    return freeze(counts.map((count, index) => freeze({
      at: PREP_SECONDS + (missionType === "escort" ? index * 12 : Math.round(index * (duration - 15) / 5)),
      wave: index + 1,
      label: missionType === "escort" && index >= 2 ? "護送経路 // 迎撃部隊接近" : `${stage.displayName} // 第${index + 1}波`,
      ...(missionType === "escort" && index >= 2 ? { escortProgress: escortMilestones[index - 2] } : {}),
      // Clear the previous detachment before fresh guards reach the convoy.
      ...((bridgeEscort && index >= 2) || (convoyInterception && index >= 1)
        ? { waitForPriorWaveClear: true } : {}),
      units: freeze(Array.from({ length: count }, () => pack[cursor++ % pack.length])),
    })));
  }
  if (stage.number === 3) {
    const thresholds = V100_BOSS_BY_ID["boss-takuya"].phaseThresholds;
    return freeze([
      freeze({ at: PREP_SECONDS, wave: 1, label: "防衛線 // 先行感染群", units: freeze(["walker", "runner", "walker", "runner", "walker"]) }),
      // The first boss teaches three distinct contacts, not six attrition waves.
      // Even overdue contacts wait for living enemies and the pending queue.
      freeze({ at: PREP_SECONDS + 16, advanceOnClearAfter: PREP_SECONDS + 12, wave: 2, label: "防衛線 // 遠隔感染体に注意", units: freeze(["walker", "spitter", "runner", "walker", "runner"]), waitForPriorWaveClear: true }),
      freeze({ at: PREP_SECONDS + 34, advanceOnClearAfter: PREP_SECONDS + 30, wave: 3, label: "防衛線 // 重量級接近", units: freeze(["crusher", "walker", "shade", "runner", "spitter", "walker"]), waitForPriorWaveClear: true }),
      freeze({ at: PREP_SECONDS + 50, advanceOnClearAfter: PREP_SECONDS + 40, wave: 4, label: `警告 // ${bossLabel}`, units: freeze([bossKind]), waitForPriorWaveClear: true }),
      // Once the entrance is due, reinforcements follow HP, not the old prelude clock.
      freeze({ at: PREP_SECONDS + 51, wave: 5, label: "防衛線 // 増援1/2", units: freeze(["runner", "shade", "walker"]), bossHpRatio: thresholds[0], addWave: true }),
      freeze({ at: PREP_SECONDS + 52, wave: 6, label: "防衛線 // 増援2/2", units: freeze(["spitter", "walker", "runner"]), bossHpRatio: thresholds[1], addWave: true }),
    ]);
  }
  if (stage.number === 5) {
    const thresholds = V100_BOSS_BY_ID["boss-gate-eater"].phaseThresholds;
    return freeze([
      freeze({ at: PREP_SECONDS, wave: 1, label: "駅構内 // 先行感染群", units: freeze(["walker", "ooze", "runner", "walker", "runner"]) }),
      freeze({ at: PREP_SECONDS + 17, advanceOnClearAfter: PREP_SECONDS + 12, wave: 2, label: "ホーム奥 // 高速個体", units: freeze(["sprinter", "walker", "ooze", "runner", "sprinter"]) }),
      freeze({ at: PREP_SECONDS + 34, advanceOnClearAfter: PREP_SECONDS + 28, wave: 3, label: "改札前 // 左右同時", units: freeze(["ooze", "sprinter", "walker", "spitter", "runner"]) }),
      freeze({ at: PREP_SECONDS + 51, advanceOnClearAfter: PREP_SECONDS + 44, wave: 4, label: "改札前 // 重量級", units: freeze(["crusher", "sprinter", "ooze", "walker", "spitter", "runner"]) }),
      freeze({ at: PREP_SECONDS + 69, advanceOnClearAfter: PREP_SECONDS + 60, wave: 5, label: "改札前 // 防衛線に接敵", units: freeze(["ooze", "sprinter", "runner", "crusher", "spitter", "walker"]) }),
      freeze({ at: PREP_SECONDS + 85, advanceOnClearAfter: PREP_SECONDS + 76, wave: 6, label: "改札前 // 踏みとどまれ", units: freeze(["sprinter", "ooze", "walker", "runner", "spitter", "sprinter"]) }),
      freeze({ at: PREP_SECONDS + 93, advanceOnClearAfter: PREP_SECONDS + 83, wave: 7, label: "改札前 // 最終封鎖線", units: freeze(["walker", "ooze", "sprinter", "walker"]), waitForPriorWaveClear: true }),
      freeze({ at: PREP_SECONDS + 98, advanceOnClearAfter: PREP_SECONDS + 93, wave: 8, label: `警告 // ${bossLabel}`, units: freeze([bossKind, "sprinter"]), waitForPriorWaveClear: true }),
      freeze({ at: PREP_SECONDS + 109, wave: 9, label: "改札前 // 増援1/3", units: freeze(["ooze", "runner", "sprinter"]), bossHpRatio: thresholds[0], addWave: true }),
      freeze({ at: PREP_SECONDS + 127, wave: 10, label: "改札前 // 増援2/3", units: freeze(["ooze", "sprinter", "runner"]), bossHpRatio: thresholds[1], addWave: true }),
      freeze({ at: PREP_SECONDS + 145, wave: 11, label: "改札前 // 増援3/3", units: freeze(["sprinter", "ooze", "walker"]), bossHpRatio: 0.2, addWave: true }),
    ]);
  }
  if (stage.id === V100_SUPPLY_VALVE_STAGE) {
    // Establish three distinct threats before the boss. Once MOTHER enters,
    // her own brood ability supplies the reinforcements.
    return freeze([
      freeze({ at: PREP_SECONDS, wave: 1, label: "供給弁へ // 先行感染群",
        units: freeze(["walker", "runner", "walker", "runner"]) }),
      freeze({ at: PREP_SECONDS + 18, wave: 2, label: "待機室前 // 射撃と汚染", clearDelaySeconds: 2.5,
        units: freeze(["spitter", "ooze", "shade", "runner", "walker"]) }),
      freeze({ at: PREP_SECONDS + 36, wave: 3, label: "隔離槽前 // 重量級接近", clearDelaySeconds: 2.5,
        units: freeze(["crusher", "sprinter", "grappler", "abomination", "runner"]) }),
      freeze({ at: PREP_SECONDS + 55, wave: 4, label: "警告 // " + bossLabel, clearDelaySeconds: 2.5,
        units: freeze([bossKind]), waitForPriorWaveClear: true }),
    ]);
  }
  if (stage.id === V100_RAIL_EVACUATION_STAGE) {
    return freeze([
      freeze({ at: PREP_SECONDS, wave: 1, label: "貨物退避場 // レバーへ進め",
        units: freeze(["walker", "runner", "walker", "runner"]) }),
      freeze({ at: PREP_SECONDS + 18, wave: 2, label: "退避線 // 射撃と汚染に注意", clearDelaySeconds: 2.5,
        units: freeze(["spitter", "ooze", "shade", "runner"]) }),
      freeze({ at: PREP_SECONDS + 36, wave: 3, label: "退避線 // 重量級接近", clearDelaySeconds: 2.5,
        units: freeze(["crusher", "sprinter", "grappler", "abomination"]) }),
      freeze({ at: PREP_SECONDS + 53, wave: 4, label: `警告 // ${bossLabel}`, clearDelaySeconds: 2.5,
        units: freeze([bossKind]), waitForPriorWaveClear: true }),
    ]);
  }
  if (stage.id === V100_RESCUE_CONTROL_STAGE) {
    return freeze([
      freeze({ at: PREP_SECONDS, wave: 1, label: "制御室入口 // 侵入を阻止",
        units: freeze(["runner", "walker", "sprinter", "walker"]) }),
      freeze({ at: PREP_SECONDS + 18, wave: 2, label: "制御盤前 // 射撃と汚染に注意", clearDelaySeconds: 2.5,
        units: freeze(["spitter", "shade", "runner", "ooze", "grappler"]) }),
      freeze({ at: PREP_SECONDS + 36, wave: 3, label: "回線復旧 // 突入を迎撃", clearDelaySeconds: 2.5,
        requiredPowerCount: V100_RESCUE_CONTROL.powerCount,
        units: freeze(["runner", "sprinter", "ooze", "crusher", "walker"]) }),
      freeze({ at: PREP_SECONDS + 55, wave: 4, label: "制御区 // 最後の防衛", clearDelaySeconds: 2.5,
        units: freeze(["abomination", "grappler", "spitter", "runner", "walker", "crusher"]) }),
    ]);
  }
  if (stage.id === V100_CENTRAL_SEAL_STAGE) {
    return freeze([
      freeze({ at: PREP_SECONDS, wave: 1, label: "第一地下道 // 先行感染群",
        units: freeze(["walker", "runner", "walker", "sprinter"]) }),
      freeze({ at: PREP_SECONDS + 22, wave: 2, label: "第二地下道 // 汚染と射撃", clearDelaySeconds: 2, requiredPowerCount: 1,
        units: freeze(["spitter", "shade", "runner", "ooze", "grappler"]) }),
      freeze({ at: PREP_SECONDS + 45, wave: 3, label: "第三地下道 // 重量級接近", clearDelaySeconds: 2, requiredPowerCount: 2,
        units: freeze(["crusher", "abomination", "sprinter", "walker", "runner"]) }),
    ]);
  }
  if (stage.id === V100_BAY_EVACUATION_STAGE) {
    return freeze([
      freeze({ at: PREP_SECONDS, wave: 1, label: "非常回廊 // 避難路を確保",
        units: freeze(["resonator", "cagewalker", "spindle", "resonator"]) }),
      freeze({ at: PREP_SECONDS + 17, wave: 2, label: "回廊 // 避難者を守る", clearDelaySeconds: 2,
        units: freeze(["choir-knot", "pall-manta", "cagewalker", "spindle"]) }),
      freeze({ at: PREP_SECONDS + 34, wave: 3, label: "非常口手前 // 侵入を阻止", clearDelaySeconds: 2.5,
        units: freeze(["anchor-bloom", "pall-manta", "choir-knot", "resonator", "cagewalker"]) }),
      freeze({ at: PREP_SECONDS + 52, wave: 4, label: "警告 // クロメ", clearDelaySeconds: 2.5, waitForPriorWaveClear: true,
        units: freeze([bossKind]) }),
    ]);
  }
  if (stage.id === V100_FLOODGATE_STAGE) {
    const thresholds = V100_BOSS_BY_ID["boss-gairen"].phaseThresholds;
    return freeze([
      freeze({ at: PREP_SECONDS, wave: 1, label: "防潮門 // 生活道路を守る", units: freeze(["resonator", "cagewalker", "spindle", "resonator"]) }),
      freeze({ at: PREP_SECONDS + 18, wave: 2, label: "防潮門 // 侵入を迎撃", clearDelaySeconds: 2,
        units: freeze(["choir-knot", "pall-manta", "cagewalker", "spindle"]) }),
      freeze({ at: PREP_SECONDS + 36, wave: 3, label: "閉鎖盤前 // 重量級接近", clearDelaySeconds: 2,
        units: freeze(["anchor-bloom", "pall-manta", "choir-knot", "resonator", "cagewalker"]) }),
      freeze({ at: PREP_SECONDS + 53, wave: 4, label: "警告 // ガイレン", clearDelaySeconds: 2, waitForPriorWaveClear: true,
        units: freeze([bossKind]) }),
      freeze({ at: PREP_SECONDS + 54, wave: 5, label: "防潮門 // 脇から流入", bossOnly: true, bossHpRatio: thresholds[0], addWave: true,
        units: freeze(["spindle", "resonator"]) }),
      freeze({ at: PREP_SECONDS + 55, wave: 6, label: "防潮門 // 水路から流入", bossOnly: true, bossHpRatio: thresholds[1], addWave: true,
        units: freeze(["cagewalker", "pall-manta"]) }),
      freeze({ at: PREP_SECONDS, wave: 7, label: "防潮門 // 開口から新手", requiresOpenFloodgate: true, addWave: true,
        units: freeze(["spindle", "resonator"]) }),
    ]);
  }
  if (stage.id === V100_LURE_CONTROL_STAGE) {
    // The red-lens guards are already at the gate. The loudspeaker brings
    // infection from outside only while it can still send a signal.
    return freeze([
      freeze({ at: PREP_SECONDS, wave: 1, label: "物流本部の警備隊",
        units: freeze(["red-panther-knife", "red-panther-smg", "red-panther-knife"]) }),
      freeze({ at: PREP_SECONDS + 25, wave: 2, label: "門前に回収班", advanceOnClearAfter: PREP_SECONDS + 17,
        units: freeze(["red-panther-smg", "red-panther-knife"]) }),
      freeze({ at: PREP_SECONDS + 33, wave: 3, label: "音響信号・感染者接近", requiresActiveLure: true,
        units: freeze(["resonator", "spindle", "cagewalker", "resonator"]) }),
      freeze({ at: PREP_SECONDS + 48, wave: 4, label: "音響信号・感染者増援", requiresActiveLure: true, waitForPriorWaveClear: true,
        units: freeze(["pall-manta", "choir-knot", "anchor-bloom", "cagewalker"]) }),
      freeze({ at: PREP_SECONDS + 70, wave: 5, label: "音響信号・最後の増援", requiresActiveLure: true, waitForPriorWaveClear: true,
        units: freeze(["resonator", "spindle", "pall-manta", "anchor-bloom", "choir-knot"]) }),
    ]);
  }
  if (stage.number >= 27 && stage.number <= 29) {
    const [knife, shield, smg, commander] = P;
    const distribution = stage.number === 28;
    const core = stage.id === V100_RESEARCH_CORE_STAGE;
    const patrols = distribution ? [
      ["管制網 // 第1装置への進路", ["resonator", "spindle", "cagewalker"]],
      ["管制網 // 第2装置の警備", ["choir-knot", "pall-manta", shield]],
      ["管制網 // 第3装置の警備", ["anchor-bloom", smg, "spindle", "resonator"]],
      ["管制網 // 最終装置の防衛", [commander, "anchor-bloom", shield, "pall-manta"]],
    ] : core ? [
      ["研究中枢 // 国外回線の警備", [knife, shield, smg]],
      ["研究中枢 // 回線室の増援", [knife, knife, smg]],
      ["研究中枢 // 回線室の指揮官", [shield, commander, shield, knife]],
      ["研究中枢 // 原株区画の警報", [knife, smg, shield, smg]],
      ["研究中枢 // 原株容器の警備", [smg, shield, knife, knife]],
      ["研究中枢 // 原株区画の最終防衛", [commander, shield, smg, knife, shield]],
    ] : [
      ["研究区画 // 正門の隊長が迎撃", [commander, shield, knife]],
      ["研究区画 // 射撃班が接近", [shield, smg, knife, knife]],
      ["研究区画 // 搬入口の警備", [smg, smg, knife, shield]],
      ["研究区画 // 封鎖装置の最終防衛", [commander, shield, smg, knife, shield]],
    ];
    return freeze(patrols.map(([label, units], index) => freeze({
      at: PREP_SECONDS + index * (distribution ? 12 : 18),
      wave: index + 1, label, units: freeze(units),
      ...(distribution && index > 0 ? { waitForPriorWaveClear: true, requiredPowerCount: index } : {}),
      ...(core && index >= 3 ? { requiredResearchTarget: V100_RESEARCH_TARGETS[0].id } : {}),
    })));
  }
  if (stage.number === 30) {
    // Establish the defense before revealing Omega. His two later A-only
    // reinforcements follow Omega’s actual injuries, even if the earlier waves take longer.
    const [firstReinforcement, secondReinforcement] = V100_BOSS_BY_ID["boss-takuya-omega"].phaseThresholds;
    return freeze([
      freeze({ at: PREP_SECONDS, wave: 1, label: "最終防衛 // 先行感染群", units: freeze(["walker", "runner", "spitter", "walker"]) }),
      freeze({ at: PREP_SECONDS + 19, advanceOnClearAfter: PREP_SECONDS + 14, wave: 2, label: "最終防衛 // 左翼接敵", waitForPriorWaveClear: true, units: freeze(["spitter", "crusher", "walker", "runner"]) }),
      freeze({ at: PREP_SECONDS + 38, advanceOnClearAfter: PREP_SECONDS + 31, wave: 3, label: "最終防衛 // 防衛線を確保", waitForPriorWaveClear: true, units: freeze(["crusher", "runner", "spitter", "walker", "runner"]) }),
      freeze({ at: PREP_SECONDS + 57, advanceOnClearAfter: PREP_SECONDS + 49, wave: 4, label: "最終防衛 // 突破を阻止", waitForPriorWaveClear: true, units: freeze(["crusher", "spitter", "walker", "runner", "spitter"]) }),
      freeze({ at: PREP_SECONDS + 78, advanceOnClearAfter: PREP_SECONDS + 69, wave: 5, label: "最終防衛 // 目前の群れ", waitForPriorWaveClear: true, units: freeze(["runner", "walker", "crusher", "spitter", "runner", "walker"]) }),
      freeze({ at: PREP_SECONDS + 90, wave: 6, label: `警告 // ${bossLabel}`, units: freeze([bossKind]), waitForPriorWaveClear: true }),
      freeze({ at: PREP_SECONDS + 116, wave: 7, label: "最終防衛 // 増援1/2", bossHpRatio: firstReinforcement, units: freeze(["walker", "runner", "crusher", "spitter", "runner", "walker", "crusher", "spitter", "walker"]), addWave: true }),
      freeze({ at: PREP_SECONDS + 140, wave: 8, label: "最終防衛 // 増援2/2", bossHpRatio: secondReinforcement, waitForReinforcementsClear: true, units: freeze(["spitter", "crusher", "walker", "runner", "spitter", "crusher", "runner", "crusher", "spitter", "crusher"]), addWave: true }),
    ]);
  }
  if (stage.number === 24 || stage.number === 25) {
    const [knife, shield, smg, commander] = P;
    const twinRoute = stage.number === 24;
    // Each path has one commander and his own escort. Advancing requires
    // finishing that detachment before the next one commits to the fight.
    const groups = twinRoute
      ? [[shield, shield], [shield, shield], [shield, commander], [bossKind, bossKind]]
      : [[knife, shield], [smg, knife], [shield, commander], [bossKind]];
    const labels = ["先行の警備隊", "第二警備隊", "指揮官の護衛", `警告 // ${bossLabel}`];
    const offsets = [0, 19, 39, 59];
    return freeze(groups.map((units, index) => freeze({
      wave: index + 1, at: PREP_SECONDS + offsets[index], label: labels[index], units: freeze(units),
      ...(index > 0 ? { waitForPriorWaveClear: true, advanceOnClearAfter: PREP_SECONDS + offsets[index] - 5 } : {}),
    })));
  }
  const counts = stage.number === 23 ? [2, 4, 5, 6, 6, 7]
    : stage.number === 1 ? [3, 3, 4, 4, 4]
    : stage.number <= 4 ? [3, 4, 4, 5, 5]
    : stage.number <= 10 ? [4, 4, 5, 5, 6]
    : stage.number <= 16 ? [4, 5, 5, 6, 6, 7]
    : stage.number <= 22 ? [5, 5, 6, 6, 7, 7]
      : [5, 6, 6, 7, 7, 8];
  let cursor = 0;
  return freeze(counts.map((count, index) => {
    const wave = index + 1;
    const units = Array.from({length: count}, () => pack[cursor++ % pack.length]);
    const bossArrives = bossKind && wave === counts.length;
    if (bossArrives) units.push(...(bossKind === "futago" ? [bossKind, bossKind] : [bossKind]));
    return freeze({
      at: PREP_SECONDS + index * (stage.number <= 10 ? 20 : 21),
      wave,
      label: bossArrives ? `警告 // ${bossLabel}` : `${stage.displayName} // 第${wave}波`,
      units: freeze(units),
      ...(bossArrives ? { waitForPriorWaveClear: true } : {}),
      ...(bossArrives ? { bossOnly: false } : {}),
    });
  }));
}

function phaseScheduleFor(stage, missionType, objective) {
  if (stage.id === V100_BAY_EVACUATION_STAGE) {
    return { phases: freeze([
      freeze({ at: PREP_SECONDS, phase: 1, label: "非常口への道を開く", objective }),
      freeze({ at: PREP_SECONDS + 30, phase: 2, label: "避難者を守る", objective }),
      freeze({ at: PREP_SECONDS + 52, phase: 3, label: "クロメを退ける", objective }),
    ]) };
  }
  if (stage.id === V100_CENTRAL_SEAL_STAGE) {
    return { phases: freeze([
      freeze({ at: PREP_SECONDS, phase: 1, label: "第一地下道を封鎖", objective }),
      freeze({ at: PREP_SECONDS + 22, phase: 2, label: "第二地下道を封鎖", objective }),
      freeze({ at: PREP_SECONDS + 45, phase: 3, label: "第三地下道を封鎖", objective }),
    ]) };
  }
  if (stage.id === V100_RESCUE_CONTROL_STAGE) {
    return {
      phases: freeze([
        freeze({ at: PREP_SECONDS, phase: 1, label: "制御盤へ進む", objective }),
        freeze({ at: PREP_SECONDS + 30, phase: 2, label: "救難回線を復旧", objective }),
        freeze({ at: PREP_SECONDS + 60, phase: 3, label: "制御区を守る", objective }),
      ]),
    };
  }
  if (stage.id === V100_RAIL_EVACUATION_STAGE) {
    return {
      phases: freeze([
        freeze({ at: PREP_SECONDS, phase: 1, label: "赤いレバーへ進む", objective }),
        freeze({ at: PREP_SECONDS + 30, phase: 2, label: "退避線の敵を倒す", objective }),
        freeze({ at: PREP_SECONDS + 60, phase: 3, label: "民間車両を逃がす", objective }),
      ]),
    };
  }
  if (missionType === "timed-defense") {
    const durationSeconds = missionDurationSeconds(stage, missionType);
    return {
      durationSeconds,
      phases: freeze([
        freeze({ at: PREP_SECONDS, phase: 1, label: "防衛部隊を展開", objective }),
        freeze({ at: PREP_SECONDS + Math.round(durationSeconds * 0.58), phase: 2, label: "防衛線を維持", objective }),
        freeze({ at: PREP_SECONDS + Math.round(durationSeconds * 0.82), phase: 3, label: "最終防衛", objective }),
      ]),
    };
  }
  if (missionType === "escort") {
    const intercept = V100_MISSION_VEHICLES[stage.id]?.count === 3;
    return {
      durationSeconds: missionDurationSeconds(stage, missionType),
      phases: freeze([
        freeze({ at: PREP_SECONDS, phase: 1, label: intercept ? "冷蔵車3台を追跡" : "護送対象を発進", objective }),
        freeze({ at: PREP_SECONDS + Math.round(missionDurationSeconds(stage, missionType) * .4), phase: 2, label: intercept ? "冷蔵車列を包囲" : "護送経路を確保", objective }),
        freeze({ at: PREP_SECONDS + Math.round(missionDurationSeconds(stage, missionType) * .8), phase: 3, label: intercept ? "封鎖地点で冷蔵車列を確保" : "出口まで護送", objective }),
      ]),
    };
  }
  if (missionType === "sequential-seal") {
    const node = V100_NODE_PROFILES[stage.id];
    return {
      phases: freeze([
        freeze({ at: PREP_SECONDS, phase: 1, label: `${node?.label ?? "封鎖設備"}へ前進`, objective }),
        freeze({ at: PREP_SECONDS + 62, phase: 2, label: "設備周辺を警戒", objective }),
        freeze({ at: PREP_SECONDS + 120, phase: 3, label: "帰還経路を警戒", objective }),
      ]),
    };
  }
  return {
    phases: freeze([
      freeze({ at: PREP_SECONDS, phase: 1, label: "侵入路を確保", objective }),
      freeze({ at: PREP_SECONDS + 38, phase: 2, label: V100_CORPORATE_CONTROLS[stage.id] ? `${V100_CORPORATE_CONTROLS[stage.id]}へ接近` : "敵拠点へ前進", objective }),
      freeze({ at: PREP_SECONDS + 76, phase: 3, label: bossKindForStage(stage) ? "異常個体を撃破" : objective, objective }),
    ]),
  };
}

/**
 * Converts the V1 registry into the definition consumed by the existing
 * Ashfall simulation. This module owns no simulation state and must remain a
 * pure adapter: the production loop, hit resolution, result timing and UI are
 * still owned by AshfallGame.
 */
export function v100BattleDefinitionFor(stageId) {
  const stage = V100_STAGE_BY_ID[stageId];
  if (!stage) return null;
  const missionType = MISSION_TYPE_MAP[stage.missionType] ?? "assault";
  const bossKind = bossKindForStage(stage);
  const missionVehicle = V100_MISSION_VEHICLES[stageId];
  const missionNode = V100_NODE_PROFILES[stageId];
  const railEvacuation = stageId === V100_RAIL_EVACUATION_STAGE;
  const bayEvacuation = stageId === V100_BAY_EVACUATION_STAGE;
  const estuaryFloodgate = stageId === V100_FLOODGATE_STAGE;
  const objective = v100MissionObjectiveFor(stageId);
  const phase = phaseScheduleFor(stage, missionType, objective);
  const lureControl = stageId === V100_LURE_CONTROL_STAGE;
  const clinicalRescue = stageId === V100_CLINICAL_STAGE;
  const armoryKey = stageId === V100_ARMORY_STAGE;
  const authoredWaveDensity = [24, 25, 27, 28, 29, 30].includes(stage.number);
  const medicalDefense = stage.number === 25;
  const authoredTimeline = stageTimeline(stage, missionType, bossKind);
  // These two corridor missions have authored patrol size and separation.
  // Their opening must leave time to act on the device or shield evacuees.
  const timeline = lureControl || clinicalRescue ? authoredTimeline : withClearDrivenAssaultWaves(
    armoryKey || authoredWaveDensity ? authoredTimeline : v100IncreaseWaveDensity(authoredTimeline, Object.values(BOSS_KIND_BY_V100_ID), { preserveEscalation: missionType === "escort" }),
    missionType);
  const baseMaxHp = V100_VEHICLE.baseHp;
  const station = missionType === "escort"
    ? { durationSeconds: phase.durationSeconds, maxIntegrity: 500, repairSeconds: 5, minimumEscortReadiness: 1, startX: missionVehicle?.count === 3 ? 450 : 258, endX: missionVehicle?.count === 3 ? 650 : 720 }
    : missionType === "sequential-seal"
      ? { powerCount: stage.objectiveId.includes("four") ? 4 : 3, requiresContainment: false,
        // Operators, sequential hold and nearby threats own progress. A
        // cleared route must not wait for legacy absolute activation times.
        powerReadyAtSeconds: [0,0,0,0], returnSpeedMultiplier: 3.2,
        powerLabel: missionNode?.label, powerVerb: missionNode?.verb }
      : {};
  return freeze({
    stageId,
    operationId: stageId,
    operationCategory: "campaign",
    displayName: stage.displayName,
    missionType,
    prepSeconds: PREP_SECONDS,
    baseMaxHp,
    starThresholds: { 1: 0.01, 2: 0.7, 3: 0.9 },
    // Once a boss falls, breaching its gate is a short finishing action.
    enemyBaseMaxHp: bossKind ? 350 : 1000,
    enemyBaseMode: !medicalDefense && !railEvacuation && !bayEvacuation && !estuaryFloodgate
      && (missionType === "assault" || missionType === "boss-assault") ? "target" : "scenery",
    startsEnemyBaseVulnerable: lureControl || stage.number === 24 || stageId === V100_RESEARCH_CORE_STAGE,
    bossUnlocksEnemyBase: !railEvacuation && !bayEvacuation && !estuaryFloodgate && Boolean(bossKind),
    bossEnemyKind: bossKind,
    timeline,
    defenseEndAt: missionType === "timed-defense" ? PREP_SECONDS + phase.durationSeconds : null,
    phaseSchedule: phase.phases,
    objective,
    missionConfig: {
      ...station,
      ...(stageId === V100_SUPPLY_VALVE_STAGE ? V100_SUPPLY_VALVE : {}),
      ...(railEvacuation ? V100_RAIL_EVACUATION : {}),
      ...(bayEvacuation ? V100_BAY_EVACUATION : {}),
      ...(stageId === V100_ARCHIVE_STAGE ? V100_ARCHIVE_EXTRACTION : {}),
      ...(clinicalRescue ? V100_CLINICAL_RESCUE : {}),
      ...(armoryKey ? { armoryKey: true } : {}),
      ...(medicalDefense ? { medicalDefense: true } : {}),
      ...(stage.number === 24 ? { twinControl: true } : {}),
      ...(stageId === V100_BRIDGE_STAGE ? V100_BRIDGE_ESCORT : {}),
      ...(estuaryFloodgate ? V100_FLOODGATE : {}),
      ...(stageId === V100_RESCUE_CONTROL_STAGE ? V100_RESCUE_CONTROL : {}),
      ...(stageId === V100_CENTRAL_SEAL_STAGE ? V100_CENTRAL_SEAL : {}),
      ...(missionVehicle ? {targetLabel:missionVehicle.targetLabel,vehicleCount:missionVehicle.count,convoyInterception:missionVehicle.count===3} : {}),
      v100StageNumber: stage.number,
      v100ObjectiveId: stage.objectiveId,
      v100EnemyPack: stage.enemyPack,
      target: stage.missionType === "assault" ? stage.number === 4 ? "infected-relay" : "infected-stronghold" : undefined,
    },
    rescueCount: stage.missionType === "escort" ? 1 : 0,
  });
}

export function v100CombatKindForUnit(unitId) {
  return campaignUnitIdToCombatKind(unitId);
}

export function v100FormationCombatKinds(unitIds, { maxSlots = 7 } = {}) {
  return (Array.isArray(unitIds) ? unitIds : [])
    .map(v100CombatKindForUnit)
    .filter((kind) => typeof kind === "string")
    .slice(0, Math.max(0, Math.floor(Number(maxSlots) || 0)));
}

export function v100SupportSupplyFor(supportId) {
  const support = v100SupportFor(supportId);
  if (!support) return null;
  if (support.id === "support-healing") return "medical";
  return "drum";
}

export function v100ProductionSessionFor({ save, stageId, resultId, onBattleResult = null, battleMode = null }) {
  const formationUnitIds = v100AvailableFormation(stageId, save?.formationSlots);
  const formationKinds = v100FormationCombatKinds(formationUnitIds);
  const definition = v100BattleDefinitionFor(stageId);
  const enemyKinds = [...new Set(definition?.timeline?.flatMap((event) => event.units) ?? [])];
  const equippedSupportId = v100SupportFor(save?.equippedSupportId)
    && save?.ownedSupportIds?.includes(save.equippedSupportId) ? save.equippedSupportId : null;
  const equipmentSnapshot = v100EquipmentSnapshot(save);
  return freeze({
    stageId,
    resultId: resultId ?? `v100:${stageId}:${Date.now()}`,
    battleMode: battleMode === "campaign" || battleMode === "outbreak" ? battleMode : null,
    displayName: definition?.displayName ?? stageId,
    formationUnitIds: freeze([...formationUnitIds]),
    formationKinds: freeze([...formationKinds]),
    // Ikura is a rescued radio operator, not a purchasable combat unit.
    barkSpeakerKinds: freeze([...new Set([
      ...(save?.ownedUnitIds ?? []).filter(id => !v100StageAbsenceReason(stageId, id)).map(v100CombatKindForUnit).filter(Boolean),
      ...(save?.completedStageIds?.includes(V100_STAGE_IDS[0]) ? ["guide"] : []),
    ])]),
    enemyKinds: freeze([...enemyKinds]),
    selectedSupply: v100SupportSupplyFor(equippedSupportId),
    equippedSupportId,
    unitLevels: { ...(save?.unitLevels ?? {}) },
    settings: freeze({ ...(save?.settings ?? {}) }),
    // Only the owned V1 inventory can affect an external battle.
    equipmentSnapshot,
    initialSupportGauge: v100OpeningSupportGauge(equipmentSnapshot),
    vehicleMaxHp: Math.max(V100_VEHICLE.baseHp, Number(save?.vehicle?.maxHp) || V100_VEHICLE.baseHp),
    ...(typeof onBattleResult === "function" ? { onBattleResult } : {}),
  });
}

export function v100BattleAdapterContract() {
  return freeze({
    owner: "AshfallGame",
    stateOwner: "AshfallGame",
    definitionOwner: "v100BattleAdapter",
    resultOwner: "V100Campaign",
    maxFormationSlots: 7,
    stageCount: 30,
    bossCount: 9,
    duplicateFormationKindsAllowed: true,
  });
}

export const V100_BATTLE_ADAPTER = Object.freeze({
  BOSS_KIND_BY_V100_ID,
  v100BattleDefinitionFor,
  v100CombatKindForUnit,
  v100FormationCombatKinds,
  v100SupportSupplyFor,
  v100ProductionSessionFor,
  v100BattleAdapterContract,
  campaignUnitCount: CAMPAIGN_UNITS.length,
});
