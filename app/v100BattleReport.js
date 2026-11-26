import { CLINICAL_RESCUE_COUNT, V100_CLINICAL_STAGE } from "./v100ClinicalRescue.js";
import { campaignUnitIdToCombatKind } from "./campaign.js";
import { V100_BOSS_BY_ID, V100_STAGE_BY_ID, V100_STAGE_IDS, V100_UNITS } from "./v100Registry.js";
import { ENEMY_CONTENT } from "./content/enemyCatalog.js";
import { V100_MISSION_VEHICLES } from "./v100MissionVehicles.js";
import { V100_DEFENSE_OBJECTIVES } from "./v100DefenseObjectives.js";
import { V100_NODE_PROFILES, V100_SUPPLY_VALVE_STAGE } from "./v100MissionNodes.js";
import { V100_RAIL_EVACUATION, V100_RAIL_EVACUATION_STAGE } from "./v100RailEvacuation.js";
import { V100_RESCUE_CONTROL, V100_RESCUE_CONTROL_STAGE } from "./v100RescueControl.js";
import { V100_CENTRAL_SEAL, V100_CENTRAL_SEAL_STAGE } from "./v100CentralSeal.js";
import { V100_BAY_EVACUATION_STAGE, V100_BAY_REFUGEE_COUNT } from "./v100BayEvacuation.js";
import { ARCHIVE_BOX_COUNT, V100_ARCHIVE_STAGE } from "./v100ArchiveExtraction.js";
import { V100_BRIDGE_STAGE } from "./v100BridgeEscort.js";

const amount = value => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
const counter = value => amount(value) && Number.isInteger(value);
const record = value => value !== null && typeof value === "object" && !Array.isArray(value);
const enemies = new Map(ENEMY_CONTENT.map(enemy => [enemy.id, enemy]));

function normalizeDeviceProgress(value) {
  if (!record(value)) return null;
  const supplyValve = value.stageId === V100_SUPPLY_VALVE_STAGE;
  const railEvacuation = value.stageId === V100_RAIL_EVACUATION_STAGE;
  if (!supplyValve && !railEvacuation && !Object.hasOwn(V100_NODE_PROFILES, value.stageId)) return null;
  const powerCount = supplyValve ? 1 : railEvacuation ? V100_RAIL_EVACUATION.powerCount
    : V100_STAGE_BY_ID[value.stageId].objectiveId.includes("four") ? 4 : 3;
  if (!counter(value.powerActivated) || value.powerActivated > powerCount) return null;
  const normalized = { stageId: value.stageId, powerActivated: value.powerActivated };
  if (!railEvacuation) return Object.freeze(normalized);
  if (typeof value.evacuated !== "boolean" || (value.evacuated && value.powerActivated !== powerCount)) return null;
  return Object.freeze({ ...normalized, evacuated: value.evacuated });
}

function normalizeBayEvacuation(value) {
  if (!record(value) || value.stageId !== V100_BAY_EVACUATION_STAGE
    || !counter(value.evacuatedCount) || value.evacuatedCount > V100_BAY_REFUGEE_COUNT) return null;
  return Object.freeze({ stageId: value.stageId, evacuatedCount: value.evacuatedCount });
}

function normalizeArchiveExtraction(value) {
  if (!record(value) || value.stageId !== V100_ARCHIVE_STAGE || typeof value.stopped !== "boolean"
    || !counter(value.delivered) || value.delivered > ARCHIVE_BOX_COUNT
    || (!value.stopped && value.delivered !== 0)) return null;
  return Object.freeze({ stageId: value.stageId, stopped: value.stopped, delivered: value.delivered });
}

export function v100DeviceResultText(result) {
  const archive = normalizeArchiveExtraction(result?.battleReport?.archiveExtraction);
  if (result?.won === false && archive && archive.stageId === result.stageId) {
    const detail = !archive.stopped ? "遠隔消去を止められなかった。"
      : "遠隔消去は停止した。";
    return { progress: `紙台帳 ${archive.delivered}/${ARCHIVE_BOX_COUNT} 箱を搬出`, detail };
  }
  const bayEvacuation = normalizeBayEvacuation(result?.battleReport?.bayEvacuation);
  if (result?.won === false && bayEvacuation && bayEvacuation.stageId === result.stageId) {
    const count = bayEvacuation.evacuatedCount;
    return { progress: `避難者 ${count}/${V100_BAY_REFUGEE_COUNT} 人`,
      detail: count === V100_BAY_REFUGEE_COUNT ? "全員が非常口に到着した。" : `非常口に着いていない人があと${V100_BAY_REFUGEE_COUNT - count}人` };
  }
  const device = normalizeDeviceProgress(result?.battleReport?.deviceProgress);
  if (result?.won !== false || !device || device.stageId !== result.stageId) return null;
  if (device.stageId === V100_RAIL_EVACUATION_STAGE) {
    if (device.evacuated) return { progress: "民間車両 退避完了", detail: "連結器はすべて解除済み" };
    const count = device.powerActivated;
    return {
      progress: `連結器 ${count}/3 解除`,
      detail: count === 3 ? "民間車両の退避前に戦闘終了" : "民間車両はまだ連結されたまま",
    };
  }
  if (device.stageId === V100_SUPPLY_VALVE_STAGE) {
    return device.powerActivated === 1
      ? { progress: "供給管 復旧済み", detail: "待機室への供給が再開した。" }
      : { progress: "供給管 未復旧", detail: "" };
  }
  if (device.stageId === V100_CENTRAL_SEAL_STAGE) {
    const total = V100_CENTRAL_SEAL.powerCount;
    return { progress: `ゲート ${device.powerActivated}/${total} 閉鎖`,
      detail: device.powerActivated === total ? "地下道への流入は止まった。"
        : `開いたままのゲートがあと${total - device.powerActivated}基` };
  }
  if (device.stageId === V100_RESCUE_CONTROL_STAGE) {
    const total = V100_RESCUE_CONTROL.powerCount;
    return { progress: `救難回線 ${device.powerActivated}/${total} 復旧`,
      detail: device.powerActivated === total ? "救難回線はすべて復旧した。"
        : `未復旧の回線があと${total - device.powerActivated}か所` };
  }
  const profile = V100_NODE_PROFILES[device.stageId];
  const total = V100_STAGE_BY_ID[device.stageId].objectiveId.includes("four") ? 4 : 3;
  return {
    progress: `${profile.label} ${device.powerActivated}/${total}基を${profile.verb}`,
    detail: device.powerActivated === total ? "" : `残り${total - device.powerActivated}基`,
  };
}

function normalizeDefenseProgress(value) {
  if (!record(value) || !Object.hasOwn(V100_DEFENSE_OBJECTIVES, value.stageId)
    || !amount(value.elapsedSeconds) || !amount(value.durationSeconds) || value.durationSeconds <= 0
    || value.elapsedSeconds > value.durationSeconds) return null;
  const rescue = Object.hasOwn(value, "rescuedCount") || Object.hasOwn(value, "disposalStopped");
  if (rescue && (value.stageId !== V100_CLINICAL_STAGE || !Number.isInteger(value.rescuedCount)
    || value.rescuedCount < 0 || value.rescuedCount > CLINICAL_RESCUE_COUNT
    || typeof value.disposalStopped !== "boolean" || (!value.disposalStopped && value.rescuedCount > 0))) return null;
  return Object.freeze({ stageId: value.stageId, elapsedSeconds: value.elapsedSeconds, durationSeconds: value.durationSeconds,
    ...(rescue ? { rescuedCount: value.rescuedCount, disposalStopped: value.disposalStopped } : {}) });
}

export function v100DefenseResultText(result) {
  if (result?.stageId === V100_ARCHIVE_STAGE && normalizeArchiveExtraction(result.battleReport?.archiveExtraction)) return null;
  const defense = normalizeDefenseProgress(result?.battleReport?.defenseProgress);
  if (!defense || defense.stageId !== result.stageId) return null;
  if (defense.rescuedCount !== undefined) {
    if (result.won && defense.rescuedCount === CLINICAL_RESCUE_COUNT) {
      return { progress: `${CLINICAL_RESCUE_COUNT}人全員を救出しました。`, detail: "" };
    }
    if (result.won !== false) return null;
    const waiting = CLINICAL_RESCUE_COUNT - defense.rescuedCount;
    return { progress: `救出 ${defense.rescuedCount}/${CLINICAL_RESCUE_COUNT}人`,
      detail: !defense.disposalStopped ? "処分を止められなかった。"
        : waiting > 0 ? `救出を待つ人があと${waiting}人` : "全員の救出が完了した。" };
  }
  if (result.won !== false) return null;
  const profile = V100_DEFENSE_OBJECTIVES[defense.stageId];
  const remaining = Math.ceil(defense.durationSeconds - defense.elapsedSeconds);
  const opened = Math.min(profile.recordCount ?? 0, Math.floor(defense.elapsedSeconds / defense.durationSeconds * (profile.recordCount ?? 0) + 1e-9));
  return {
    progress: profile.recordCount ? `収容室 ${opened}/${profile.recordCount}室を開放`
      : `防衛時間 ${Math.floor(defense.elapsedSeconds)}秒`,
    detail: remaining > 0 ? `防衛完了まであと${remaining}秒` : "最後まで守ったが、作戦目標が残った。",
  };
}

function normalizeEscortProgress(value) {
  if (!record(value) || !Object.hasOwn(V100_MISSION_VEHICLES, value.stageId)
    || !amount(value.progress) || value.progress > 1
    || !amount(value.integrity) || !amount(value.maxIntegrity) || value.maxIntegrity <= 0 || value.integrity > value.maxIntegrity
    || typeof value.failed !== "boolean" || typeof value.completed !== "boolean"
    || (value.failed && value.completed)) return null;
  const gateTimedOut = value.stageId === V100_BRIDGE_STAGE && value.gateTimedOut === true
    && value.failed && value.integrity > 0 && value.progress < 1;
  return Object.freeze({ stageId: value.stageId, progress: value.progress, integrity: value.integrity,
    maxIntegrity: value.maxIntegrity, failed: value.failed, completed: value.completed,
    ...(gateTimedOut ? { gateTimedOut: true } : {}) });
}

export function v100EscortResultText(result) {
  const escort = normalizeEscortProgress(result?.battleReport?.escortProgress);
  if (result?.won !== false || !escort || escort.stageId !== result.stageId) return null;
  const vehicle = V100_MISSION_VEHICLES[escort.stageId];
  const destroyed = escort.failed && escort.integrity === 0;
  if (escort.gateTimedOut) {
    return { outcome: "遮断機が閉じ、搬送車が取り残された。",
      progress: "遮断機まで到達" };
  }
  if (destroyed && escort.progress >= 1) {
    return { outcome: `${vehicle.destinationLabel ?? "出口"}に着いたあと、${vehicle.targetLabel}が破壊された。`,
      progress: vehicle.count === 3 ? "冷蔵車3台が封鎖地点に到着" : "護送距離 100%" };
  }
  return {
    outcome: destroyed ? `${vehicle.targetLabel}が破壊された。` : null,
    progress: escort.progress >= 1 ? `${vehicle.targetLabel}は${vehicle.destinationLabel ?? "目的地"}に到着`
      : `${vehicle.count === 3 ? "冷蔵車列の確保" : "護送"} ${Math.floor(escort.progress * 100)}%まで到達`,
  };
}

function normalizeVehicleHit(value) {
  if (!record(value) || !enemies.has(value.enemyKind) || !amount(value.time) || !amount(value.damage) || value.damage <= 0) return null;
  return Object.freeze({ enemyKind: value.enemyKind, time: value.time, damage: value.damage });
}

export function v100VehicleHitFor({ enemyKind, time, beforeHp, afterHp }) {
  if (!amount(beforeHp) || !amount(afterHp) || afterHp >= beforeHp) return null;
  return normalizeVehicleHit({ enemyKind, time, damage: beforeHp - afterHp });
}

export function v100LastVehicleHitText(result) {
  const hit = normalizeVehicleHit(result?.battleReport?.lastVehicleHit);
  const elapsed = result?.elapsedSeconds;
  if (result?.won !== false || !hit || !amount(elapsed) || hit.time > elapsed || elapsed - hit.time > 5) return null;
  const secondsBeforeEnd = Math.round(elapsed - hit.time);
  const timing = secondsBeforeEnd > 0 ? `（終了${secondsBeforeEnd}秒前）` : "";
  return `${enemies.get(hit.enemyKind).displayName}の攻撃で耐久を${Math.ceil(hit.damage)}失いました${timing}。`;
}

function normalizeBossProgress(value) {
  const boss = V100_BOSS_BY_ID[value?.bossId];
  if (!record(value) || !boss || !["not-encountered", "active", "defeated"].includes(value.state)) return null;
  const base = { bossId: boss.id, displayName: boss.displayName, state: value.state };
  if (value.state === "not-encountered") return Object.freeze({ ...base, hp: null, maxHp: null });
  if (!amount(value.hp) || !amount(value.maxHp) || value.maxHp <= 0 || value.hp > value.maxHp
    || (value.state === "defeated" && value.hp !== 0)) return null;
  return Object.freeze({ ...base, hp: value.hp, maxHp: value.maxHp });
}

// Presentation-only measurements. They never determine victory, stars or CAPS.
export function normalizeV100BattleReport(report) {
  if (!record(report) || !counter(report.wave) || !counter(report.kills) || !Array.isArray(report.units) || report.units.length > V100_UNITS.length) return null;
  const units = V100_UNITS.flatMap(unit => {
    const row = report.units.find(entry => entry?.unitId === unit.id);
    return row && [row.damage, row.damageTaken, row.healing].every(amount)
      ? [Object.freeze({ unitId: unit.id, damage: row.damage, damageTaken: row.damageTaken, healing: row.healing })] : [];
  });
  const bossProgress = normalizeBossProgress(report.bossProgress);
  const lastVehicleHit = normalizeVehicleHit(report.lastVehicleHit);
  const escortProgress = normalizeEscortProgress(report.escortProgress);
  const defenseProgress = normalizeDefenseProgress(report.defenseProgress);
  const deviceProgress = normalizeDeviceProgress(report.deviceProgress);
  const bayEvacuation = normalizeBayEvacuation(report.bayEvacuation);
  const archiveExtraction = normalizeArchiveExtraction(report.archiveExtraction);
  return Object.freeze({ wave: report.wave, kills: report.kills, units: Object.freeze(units), ...(bossProgress ? { bossProgress } : {}), ...(lastVehicleHit ? { lastVehicleHit } : {}), ...(escortProgress ? { escortProgress } : {}), ...(defenseProgress ? { defenseProgress } : {}), ...(deviceProgress ? { deviceProgress } : {}), ...(bayEvacuation ? { bayEvacuation } : {}), ...(archiveExtraction ? { archiveExtraction } : {}) });
}

export function v100BattleReportFor(raw) {
  const stats = raw?.unitStats;
  if (!record(stats) || ![stats.damageByUnit, stats.damageTakenByUnit, stats.healingByUnit].every(record)) return null;
  const units = V100_UNITS.flatMap(unit => {
    const kind = campaignUnitIdToCombatKind(unit.id);
    const maps = [stats.damageByUnit, stats.damageTakenByUnit, stats.healingByUnit];
    if (!maps.some(map => Object.hasOwn(map, kind))) return [];
    const values = maps.map(map => Object.hasOwn(map, kind) ? map[kind] : 0);
    if (!values.every(amount)) return [];
    return [{ unitId: unit.id, damage: values[0], damageTaken: values[1], healing: values[2] }];
  });
  const escortProgress = normalizeEscortProgress({ ...raw.missionRuntime, stageId: raw.stageId });
  const defenseProgress = raw.defenseProgress?.stageId === raw.stageId ? normalizeDefenseProgress(raw.defenseProgress) : null;
  const railEvacuation = raw.stageId === V100_RAIL_EVACUATION_STAGE;
  const deviceMissionType = railEvacuation || raw.stageId === V100_SUPPLY_VALVE_STAGE ? "boss-assault" : "sequential-seal";
  const deviceProgress = raw.missionRuntime?.missionType === deviceMissionType
    ? normalizeDeviceProgress({
      stageId: raw.stageId,
      powerActivated: raw.missionRuntime.powerActivated,
      evacuated: railEvacuation ? raw.missionRuntime.completed === true : undefined,
    }) : null;
  const bayEvacuation = raw.missionRuntime?.missionType === "boss-assault"
    ? normalizeBayEvacuation({ stageId: raw.stageId, evacuatedCount: raw.missionRuntime.evacuatedCount }) : null;
  const archiveExtraction = raw.missionRuntime?.missionType === "timed-defense"
    ? normalizeArchiveExtraction({ stageId: raw.stageId, stopped: raw.missionRuntime.archiveStopped,
      delivered: raw.missionRuntime.archiveDelivered }) : null;
  return normalizeV100BattleReport({ wave: raw.wave, kills: raw.kills, units, bossProgress: raw.bossProgress,
    lastVehicleHit: raw.lastVehicleHit, escortProgress, defenseProgress, deviceProgress, bayEvacuation, archiveExtraction });
}

// A run's measured contribution, not a new grade, currency or permanent record.
// Compare only the last completed win on this same stage. Missing legacy data
// must never turn into a zero-casualty or faster-clear claim.
export function v100BattleMeritsFor(result, previousResult = null) {
  if (!record(result) || result.won !== true || result.objectiveComplete !== true
    || !V100_STAGE_IDS.includes(result.stageId)) return [];
  const previous = record(previousResult) && previousResult.won === true
    && previousResult.objectiveComplete === true && previousResult.stageId === result.stageId
    && typeof previousResult.battleRunId === "string" && previousResult.battleRunId.length > 0
    && typeof result.battleRunId === "string" && result.battleRunId.length > 0
    && previousResult.battleRunId !== result.battleRunId ? previousResult : null;
  const merits = [];
  if (counter(result.unitDeaths) && result.unitDeaths === 0) {
    merits.push({ id: "no-down", title: "戦闘不能なし", detail: previous && counter(previous.unitDeaths) && previous.unitDeaths > 0
      ? `前回${previous.unitDeaths}回 → 今回0回` : "仲間を倒されずに目標達成" });
  } else if (previous && counter(result.unitDeaths) && counter(previous.unitDeaths)
    && result.unitDeaths < previous.unitDeaths) {
    merits.push({ id: "fewer-downs", title: "戦闘不能を減らした", detail: `前回${previous.unitDeaths}回 → 今回${result.unitDeaths}回` });
  }
  if (previous && amount(previous.elapsedSeconds) && previous.elapsedSeconds > 0
    && amount(result.elapsedSeconds) && result.elapsedSeconds > 0
    && previous.elapsedSeconds - result.elapsedSeconds >= 1) {
    merits.push({ id: "faster-clear", title: "前回より速く突破",
      detail: `前回${Math.round(previous.elapsedSeconds)}秒 → 今回${Math.round(result.elapsedSeconds)}秒` });
  }
  const report = normalizeV100BattleReport(result.battleReport);
  for (const [metric, title, suffix] of [["damage", "与ダメージ", "ダメージ"], ["healing", "回復量", "HP"]]) {
    const rows = report?.units ?? [];
    const most = Math.max(0, ...rows.map(unit => unit[metric]));
    if (most < 1) continue;
    const leaders = rows.filter(unit => unit[metric] === most);
    const names = leaders.map(unit => V100_UNITS.find(candidate => candidate.id === unit.unitId).displayName);
    const tied = names.length > 1;
    merits.push({ id: metric, title: `${title}${tied ? "同率1位" : "1位"}　${names.length <= 2 ? names.join("・") : `${names.length}人`}`,
      detail: `${tied ? "各" : ""}${Math.round(most).toLocaleString("ja-JP")}${suffix}${metric === "healing" ? "（自己回復を含む）" : ""}`,
      unitIds: leaders.map(unit => unit.unitId) });
  }
  return merits;
}
