import {
  V100_BOSSES,
  V100_FORMATION_MAX_SLOTS,
  V100_STAGE_BY_ID,
  V100_STAGE_IDS,
  V100_SUPPORTS,
  V100_UNIT_BY_ID,
  V100_VEHICLE,
  v100LevelCapForStage,
  v100StageReward,
  v100StarsForVehicle,
} from "./v100Registry.js";
import { applyV100SaveMutation, normalizeV100Save } from "./v100Save.js";
import { applyV100LevelUpgrade, v100UnitLevelFor } from "./v100Progression.js";
import { v100EquipmentFor, v100EquipmentQuantityCap, normalizeV100Equipment } from "./v100Equipment.js";
import { equipmentEnhancementCost, EQUIPMENT_MAX_ENHANCEMENT } from "./equipment.js";
import { v100DiscoveredBosses } from "./v100BossProgress.js";
import { v100OutbreakEncounters, v100OutbreakRunIdValid } from "./v100Outbreak.js";

export function beginV100Outbreak(save, bossId, { runId, now } = {}) {
  const current = normalizeV100Save(save);
  if (!v100OutbreakEncounters(current).some(boss => boss.id === bossId)) return { applied: false, reason: "boss-undiscovered", save: current };
  if (current.flowState.phase !== "map" || current.pendingResult || current.outbreak.active || current.survival.view !== "hub") return { applied: false, reason: "activity-active", save: current };
  if (!current.formationSlots.some(Boolean)) return { applied: false, reason: "formation-empty", save: current };
  const start = `v100:outbreak:${bossId}:start:${runId}`;
  if (!v100OutbreakRunIdValid(runId) || current.receipts.includes(start)) return { applied: false, reason: "invalid-mode-run", save: current };
  return applyV100SaveMutation(current, next => ({ ...next, receipts: [...next.receipts, start],
    outbreak: { ...next.outbreak, active: { bossId, runId }, view: "battle" },
  }), { now });
}

/** @param {object} save @param {{runId?: string, restartRunId?: string | null, now?: string | number}} options */
export function leaveV100Outbreak(save, { runId, restartRunId = null, now } = {}) {
  const current = normalizeV100Save(save), active = current.outbreak.active;
  if (!active || active.runId !== runId) return { applied: false, reason: "invalid-mode-run", save: current };
  const restart = restartRunId !== null;
  const start = `v100:outbreak:${active.bossId}:start:${restartRunId}`;
  if (restart && (!v100OutbreakRunIdValid(restartRunId) || current.receipts.includes(start))) return { applied: false, reason: "invalid-mode-run", save: current };
  return applyV100SaveMutation(current, next => ({ ...next,
    receipts: [...next.receipts, `v100:outbreak:${active.bossId}:cancel:${runId}`, ...(restart ? [start] : [])],
    outbreak: { ...next.outbreak, active: restart ? { bossId: active.bossId, runId: restartRunId } : null, view: restart ? "battle" : "hub" },
  }), { now });
}

export function dismissV100OutbreakResult(save, { now } = {}) {
  const current = normalizeV100Save(save);
  if (current.outbreak.active || current.outbreak.view !== "result") return { applied: false, reason: "activity-active", save: current };
  return applyV100SaveMutation(current, next => ({ ...next, outbreak: { ...next.outbreak, view: "hub" } }), { now });
}

export function settleV100Outbreak(save, result, { now } = {}) {
  const current = normalizeV100Save(save), active = current.outbreak.active;
  const boss = active && v100OutbreakEncounters(current).find(entry => entry.id === active.bossId);
  if (!boss || result?.resultId !== active.runId || result.stageId !== boss.stageId) return { applied: false, reason: "invalid-mode-run", save: current };
  if (typeof result.won !== "boolean" || !Number.isFinite(result.baseHp) || result.baseHp < 0
    || result.baseMaxHp !== current.vehicle.maxHp || result.baseHp > result.baseMaxHp
    || !Number.isFinite(result.time) || result.time < 0 || !Number.isFinite(result.unitsLost) || result.unitsLost < 0
    || (result.won && (result.baseHp <= 0 || result.bossDefeated !== true))) return { applied: false, reason: "invalid-result", save: current };
  const receipt = `v100:outbreak:${boss.id}:result:${active.runId}`;
  if (current.receipts.includes(receipt)) return { applied: false, duplicate: true, reason: "invalid-mode-run", save: current };
  const firstReceipt = `v100:outbreak:${boss.id}:first-clear`;
  const first = result.won && !current.receipts.includes(firstReceipt);
  const item = boss.rewardEquipment;
  const quantity = item ? current.equipment.inventory[item.id] ?? 0 : 0;
  const grantedQuantity = first && item && quantity < v100EquipmentQuantityCap(item.id) ? 1 : 0;
  const rewardCaps = result.won ? boss.rewardCaps : 0;
  return applyV100SaveMutation(current, next => ({ ...next, caps: next.caps + rewardCaps,
    receipts: [...next.receipts, receipt, ...(first ? [firstReceipt] : [])],
    equipment: grantedQuantity ? { ...next.equipment, inventory: { ...next.equipment.inventory, [item.id]: quantity + 1 } } : next.equipment,
    bosses: result.won ? { ...next.bosses, defeatCounts: { ...next.bosses.defeatCounts, [boss.id]: next.bosses.defeatCounts[boss.id] + 1 } } : next.bosses,
    outbreak: { ...next.outbreak, active: null, view: "result",
      clearCounts: result.won ? { ...next.outbreak.clearCounts, [boss.id]: (next.outbreak.clearCounts[boss.id] ?? 0) + 1 } : next.outbreak.clearCounts,
      lastResult: { bossId: boss.id, runId: active.runId, won: result.won, vehicleHp: result.baseHp, vehicleMaxHp: result.baseMaxHp,
        elapsedSeconds: result.time, unitDeaths: result.unitsLost, rewardCaps, grantedQuantity, grantedEquipmentId: grantedQuantity ? item.id : null,
        finishedAt: new Date(now ?? Date.now()).toISOString() },
    },
  }), { now });
}

export function purchaseV100Equipment(save, equipmentId, { expectedQuantity, now } = {}) {
  const current = normalizeV100Save(save);
  const item = v100EquipmentFor(equipmentId);
  if (!item || item.source !== "supply-shop") return { applied: false, reason: "equipment-unavailable", save: current };
  const quantity = current.equipment.inventory[equipmentId] ?? 0;
  if (quantity !== expectedQuantity) return { applied: false, reason: "stale-equipment", save: current };
  if (quantity >= v100EquipmentQuantityCap(equipmentId)) return { applied: false, reason: "equipment-cap", save: current };
  const receipt = `v100:equipment:${equipmentId}:purchase:${quantity + 1}`;
  if (current.receipts.includes(receipt)) return { applied: false, duplicate: true, reason: "stale-equipment", save: current };
  if (current.caps < item.purchaseCaps) return { applied: false, reason: "insufficient-caps", save: current };
  return applyV100SaveMutation(current, next => ({ ...next, caps: next.caps - item.purchaseCaps,
    equipment: { ...next.equipment, inventory: { ...next.equipment.inventory, [equipmentId]: quantity + 1 } },
    receipts: [...next.receipts, receipt],
  }), { now });
}

export function upgradeV100Equipment(save, equipmentId, { expectedLevel, now } = {}) {
  const current = normalizeV100Save(save);
  if (!v100EquipmentFor(equipmentId) || !current.equipment.inventory[equipmentId]) return { applied: false, reason: "equipment-not-owned", save: current };
  const level = current.equipment.enhancementLevels[equipmentId] ?? 0;
  if (level !== expectedLevel) return { applied: false, reason: "stale-equipment", save: current };
  if (level >= EQUIPMENT_MAX_ENHANCEMENT) return { applied: false, reason: "upgrade-cap", save: current };
  const receipt = `v100:equipment:${equipmentId}:upgrade:${level + 1}`;
  if (current.receipts.includes(receipt)) return { applied: false, duplicate: true, reason: "stale-equipment", save: current };
  const cost = equipmentEnhancementCost(equipmentId, level);
  if (current.caps < cost) return { applied: false, reason: "insufficient-caps", save: current };
  return applyV100SaveMutation(current, next => ({ ...next, caps: next.caps - cost,
    equipment: { ...next.equipment, enhancementLevels: { ...next.equipment.enhancementLevels, [equipmentId]: level + 1 } },
    receipts: [...next.receipts, receipt],
  }), { now });
}

/**
 * @param {object} save
 * @param {{ unitId?: string | null, slot?: number, equipmentId?: string | null, now?: string | number }} options
 */
export function equipV100Equipment(save, { unitId = null, slot, equipmentId = null, now } = {}) {
  const current = normalizeV100Save(save);
  const fail = reason => ({ applied: false, reason, save: current });
  if (!Number.isInteger(slot) || slot < 0 || slot > 1) return fail("invalid-equipment-slot");
  if (unitId !== null && !current.ownedUnitIds.includes(unitId)) return fail("unit-not-owned");
  const item = equipmentId === null ? null : v100EquipmentFor(equipmentId);
  if (equipmentId !== null && (!item || !current.equipment.inventory[equipmentId])) return fail("equipment-not-owned");
  if (item && item.slotType !== (unitId === null ? "tactical" : "personal")) return fail("invalid-equipment-slot");
  const equipment = structuredClone(current.equipment);
  const slots = unitId === null ? equipment.tacticalIds : equipment.personalByUnit[unitId] ?? [null, null];
  if (slots[slot] === equipmentId) return { applied: false, unchanged: true, save: current };
  slots[slot] = equipmentId;
  if (unitId !== null) equipment.personalByUnit[unitId] = slots;
  // Reject excess allocation, rather than silently moving another character's item.
  const allocated = [...Object.values(equipment.personalByUnit).flat(), ...equipment.tacticalIds];
  if (equipmentId && (slots.filter(id => id === equipmentId).length > 1
    || allocated.filter(id => id === equipmentId).length > equipment.inventory[equipmentId])) return fail("equipment-in-use");
  return applyV100SaveMutation(current, next => ({ ...next, equipment: normalizeV100Equipment(equipment, next.ownedUnitIds) }), { now });
}

function unique(value) {
  return [...new Set(Array.isArray(value) ? value.filter((entry) => typeof entry === "string" && entry.length > 0) : [])];
}

function integer(value, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(minimum, Math.min(maximum, Math.floor(numeric))) : minimum;
}

function stageNumberFor(stageId) {
  return V100_STAGE_BY_ID[stageId]?.number ?? 0;
}

function appendReceipt(receipts, receipt) {
  return receipts.includes(receipt) ? receipts : [...receipts, receipt];
}

function payloadForStage(stageNumber, next) {
  const stage = V100_STAGE_IDS[stageNumber - 1] ? V100_STAGE_BY_ID[V100_STAGE_IDS[stageNumber - 1]] : null;
  const payload = stage?.firstClearPayload ?? [];
  const updated = { ...next };
  for (const item of payload) {
    if (item.startsWith("unit-")) {
      const unit = V100_UNIT_BY_ID[item];
      if (unit && !updated.registeredUnitIds.includes(unit.id)) updated.registeredUnitIds = [...updated.registeredUnitIds, unit.id];
    } else if (item.startsWith("support-")) {
      updated.supportPurchaseUnlockedIds = unique([...(updated.supportPurchaseUnlockedIds ?? []), item]);
    } else if (item.startsWith("level-cap-")) {
      updated.levelCap = Math.max(updated.levelCap, integer(item.slice("level-cap-".length), 5, 30));
    }
  }
  return updated;
}

function bossPayloadForStage(stageNumber) {
  return V100_BOSSES.find((boss) => boss.stageNumber === stageNumber) ?? null;
}

export function createV100BattleResult({
  stageId,
  battleRunId,
  won = false,
  vehicleHp = 0,
  vehicleMaxHp = V100_VEHICLE.baseHp,
  objectiveComplete = false,
  bossDefeated = false,
  elapsedSeconds = 0,
  unitDeaths = 0,
} = {}) {
  const stageNumber = stageNumberFor(stageId);
  if (!stageNumber) return { ok: false, reason: "unknown-stage" };
  const boss = bossPayloadForStage(stageNumber);
  if (boss && won === true && bossDefeated !== true) return { ok: false, reason: "boss-not-defeated" };
  const validVictory = won === true && objectiveComplete === true && Number(vehicleHp) > 0;
  return Object.freeze({
    resultId: typeof battleRunId === "string" && battleRunId.length > 0 ? battleRunId : `v100:run:${stageNumber}:${Date.now()}`,
    battleRunId: battleRunId ?? null,
    stageId,
    stageNumber,
    won: validVictory,
    objectiveComplete: objectiveComplete === true,
    bossDefeated: bossDefeated === true,
    vehicleHp: Math.max(0, Number(vehicleHp) || 0),
    vehicleMaxHp: Math.max(1, Number(vehicleMaxHp) || V100_VEHICLE.baseHp),
    stars: v100StarsForVehicle({ won: validVictory, vehicleHp, vehicleMaxHp }),
    elapsedSeconds: Math.max(0, Number(elapsedSeconds) || 0),
    unitDeaths: Math.max(0, integer(unitDeaths)),
  });
}

function storyResultIdentity(result) {
  const stage = V100_STAGE_IDS.includes(result?.stageId) ? V100_STAGE_BY_ID[result.stageId] : null;
  const runId = result?.battleRunId;
  if (!stage || result.stageNumber !== stage.number || typeof runId !== "string"
    || runId.length === 0 || runId.length > 256 || runId.trim() !== runId || /[\u0000-\u001f]/.test(runId)
    || (result.resultId !== undefined && result.resultId !== runId)) return null;
  return { stage, runId, receipt: `v100:s${String(stage.number).padStart(2, "0")}:result:${runId}` };
}

function isSettledStoryResult(save, identity) {
  if (!identity) return false;
  const stagePrefix = `v100:s${String(identity.stage.number).padStart(2, "0")}`;
  // Pre-fix draft saves retain the latest finalized run and explicit replay IDs.
  // Earlier unrecorded first-run IDs cannot be reconstructed from a stage receipt.
  return save.receipts.includes(identity.receipt)
    || save.receipts.includes(`${stagePrefix}:replay:${identity.runId}`)
    || (save.lastResult?.won === true && typeof save.lastResult.finalizedAt === "string"
      && save.lastResult.stageId === identity.stage.id && save.lastResult.battleRunId === identity.runId);
}

function isValidStoryVictory(result, identity) {
  return Boolean(identity && result.won === true && result.objectiveComplete === true
    && Number.isFinite(result.vehicleHp) && result.vehicleHp > 0
    && Number.isFinite(result.vehicleMaxHp) && result.vehicleMaxHp >= result.vehicleHp
    && result.stars === v100StarsForVehicle({ won: true, vehicleHp: result.vehicleHp, vehicleMaxHp: result.vehicleMaxHp })
    && (!bossPayloadForStage(identity.stage.number) || result.bossDefeated === true));
}

function sameStoryResult(left, right) {
  return ["stageId", "stageNumber", "battleRunId", "won", "objectiveComplete", "bossDefeated", "vehicleHp", "vehicleMaxHp", "stars", "elapsedSeconds", "unitDeaths"]
    .every(key => left?.[key] === right?.[key]);
}

export function recordV100PendingResult(save, result, { now } = {}) {
  const current = normalizeV100Save(save);
  const identity = storyResultIdentity(result);
  if (!identity || !isValidStoryVictory(result, identity)) return { applied: false, reason: "invalid-result", save: current };
  if (isSettledStoryResult(current, identity)) return { applied: false, duplicate: true, reason: "duplicate-result", save: current };
  if (current.pendingResult) return { applied: false, reason: "pending-result-exists", save: current };
  return applyV100SaveMutation(current, (next) => ({ ...next, pendingResult: { ...result } }), { now });
}

export function finalizeV100PendingResult(save, { result = null, now } = {}) {
  const current = normalizeV100Save(save);
  const pending = current.pendingResult;
  if (!pending) return { applied: false, reason: "pending-result-missing", save: current };
  const identity = storyResultIdentity(pending);
  if (!identity || !isValidStoryVictory(pending, identity)) return { applied: false, reason: "invalid-result", save: current };
  if (result !== null && (!storyResultIdentity(result) || !sameStoryResult(result, pending))) return { applied: false, reason: "pending-result-mismatch", save: current };
  if (isSettledStoryResult(current, identity)) return { applied: false, duplicate: true, reason: "duplicate-result", save: current };
  const stage = identity.stage;
  if (!stage || !current.availableStageIds.includes(stage.id)) return { applied: false, reason: "stage-locked", save: current };
  const stageNumber = stage.number;
  const firstClear = !current.completedStageIds.includes(stage.id);
  const priorStars = integer(current.bestStars[stage.id], 0, 3);
  const stars = Math.max(priorStars, integer(pending.stars, 0, 3));
  let reward = 0;
  let receipts = appendReceipt([...current.receipts], identity.receipt);
  if (firstClear) {
    const firstReceipt = stage.receipts.firstClear;
    if (!receipts.includes(firstReceipt)) {
      reward += v100StageReward(stageNumber, "first-clear");
      receipts = appendReceipt(receipts, firstReceipt);
    }
  } else if (typeof pending.battleRunId === "string" && pending.battleRunId.length > 0) {
    const replayReceipt = `v100:s${String(stageNumber).padStart(2, "0")}:replay:${pending.battleRunId}`;
    if (!receipts.includes(replayReceipt)) {
      reward += v100StageReward(stageNumber, "replay");
      receipts = appendReceipt(receipts, replayReceipt);
    }
  }
  if (stars >= 2 && priorStars < 2) {
    reward += v100StageReward(stageNumber, "star:2");
    receipts = appendReceipt(receipts, stage.receipts.star2);
  }
  if (stars >= 3 && priorStars < 3) {
    reward += v100StageReward(stageNumber, "star:3");
    receipts = appendReceipt(receipts, stage.receipts.star3);
  }
  const nextStage = V100_STAGE_IDS[stageNumber];
  const boss = bossPayloadForStage(stageNumber);
  return applyV100SaveMutation(current, (next) => {
    let updated = {
      ...next,
      caps: next.caps + reward,
      completedStageIds: firstClear ? [...next.completedStageIds, stage.id] : [...next.completedStageIds],
      bestStars: { ...next.bestStars, [stage.id]: stars },
      availableStageIds: nextStage && firstClear ? [...new Set([...next.availableStageIds, nextStage])] : [...next.availableStageIds],
      levelCap: Math.max(next.levelCap, v100LevelCapForStage(stageNumber)),
      receipts,
      pendingResult: null,
      lastResult: { ...pending, firstClear, rewardCaps: reward, finalizedAt: new Date(now ?? Date.now()).toISOString() },
    };
    updated = payloadForStage(stageNumber, updated);
    if (boss && pending.bossDefeated === true) {
      const defeatReceipt = boss.firstDefeatReceipt;
      if (!updated.receipts.includes(defeatReceipt)) {
        updated.receipts = [...updated.receipts, defeatReceipt];
        updated.bosses = {
          ...updated.bosses,
          discoveredIds: [...new Set([...updated.bosses.discoveredIds, boss.id])],
          compendiumIds: [...new Set([...updated.bosses.compendiumIds, boss.compendiumId])],
          outbreakIds: [...new Set([...updated.bosses.outbreakIds, boss.outbreakId])],
          survivalIds: [...new Set([...updated.bosses.survivalIds, boss.survivalId])],
          storyReplayStageNumbers: [...new Set([...updated.bosses.storyReplayStageNumbers, stageNumber])],
        };
      }
      updated.bosses = {
        ...updated.bosses,
        defeatCounts: { ...updated.bosses.defeatCounts, [boss.id]: integer(updated.bosses.defeatCounts[boss.id]) + 1 },
      };
    }
    if (stageNumber === 30 && firstClear) updated.postGameAvailable = true;
    return updated;
  }, { now });
}

export function purchaseV100Unit(save, unitId, { now } = {}) {
  const current = normalizeV100Save(save);
  const unit = V100_UNIT_BY_ID[unitId];
  if (!unit) return { applied: false, reason: "unknown-unit", save: current };
  if (!current.registeredUnitIds.includes(unitId)) return { applied: false, reason: "not-registered", save: current };
  if (current.ownedUnitIds.includes(unitId)) return { applied: false, duplicate: true, reason: "already-owned", save: current };
  const receipt = `v100:unit:${unitId}:purchase`;
  if (current.receipts.includes(receipt)) return { applied: false, duplicate: true, reason: "duplicate-receipt", save: current };
  if (current.caps < unit.registrationCostCaps) return { applied: false, reason: "insufficient-caps", save: current };
  return applyV100SaveMutation(current, (next) => ({
    ...next,
    caps: next.caps - unit.registrationCostCaps,
    ownedUnitIds: [...next.ownedUnitIds, unitId],
    receipts: [...next.receipts, receipt],
  }), { now });
}

/**
 * @param {unknown} save
 * @param {string} unitId
 * @param {{expectedLevel?: number | null, now?: string}} [options]
 */
export function upgradeV100Unit(save, unitId, { expectedLevel = null, now } = {}) {
  const current = normalizeV100Save(save);
  if (!V100_UNIT_BY_ID[unitId] || !current.ownedUnitIds.includes(unitId)) return { applied: false, reason: "unit-not-owned", save: current };
  if (expectedLevel !== null && v100UnitLevelFor(current.unitLevels, unitId) !== expectedLevel) return { applied: false, reason: "stale-level", save: current };
  const upgrade = applyV100LevelUpgrade({
    levels: current.unitLevels, unitId, caps: current.caps, receiptIds: current.receipts,
    clearedStageNumber: Math.max(0, ...current.completedStageIds.map(stageNumberFor)),
  });
  if (!upgrade.applied) return { applied: false, duplicate: upgrade.duplicate === true, reason: upgrade.reason, save: current };
  return applyV100SaveMutation(current, (next) => ({
    ...next, caps: upgrade.capsAfter, unitLevels: { ...upgrade.levels },
    receipts: [...next.receipts, upgrade.receipt],
  }), { now });
}

export function purchaseV100Support(save, supportId, { now } = {}) {
  const current = normalizeV100Save(save);
  const support = V100_SUPPORTS.find((entry) => entry.id === supportId);
  if (!support) return { applied: false, reason: "unknown-support", save: current };
  if (!current.supportPurchaseUnlockedIds?.includes(supportId)) return { applied: false, reason: "not-unlocked", save: current };
  if (current.ownedSupportIds.includes(supportId)) return { applied: false, duplicate: true, reason: "already-owned", save: current };
  const receipt = `v100:support:${supportId}:purchase`;
  if (current.receipts.includes(receipt)) return { applied: false, duplicate: true, reason: "duplicate-receipt", save: current };
  if (current.caps < support.unlockCostCaps) return { applied: false, reason: "insufficient-caps", save: current };
  return applyV100SaveMutation(current, (next) => ({
    ...next,
    caps: next.caps - support.unlockCostCaps,
    ownedSupportIds: [...next.ownedSupportIds, supportId],
    receipts: [...next.receipts, receipt],
  }), { now });
}

export function equipV100Support(save, supportId, { now } = {}) {
  const current = normalizeV100Save(save);
  if (supportId !== null && !current.ownedSupportIds.includes(supportId)) return { applied: false, reason: "support-not-owned", save: current };
  if (supportId !== null && !V100_SUPPORTS.some((support) => support.id === supportId)) return { applied: false, reason: "unknown-support", save: current };
  if (current.equippedSupportId === supportId) return { applied: false, unchanged: true, save: current };
  return applyV100SaveMutation(current, (next) => ({ ...next, equippedSupportId: supportId }), { now });
}

export function upgradeV100Vehicle(save, { now } = {}) {
  const current = normalizeV100Save(save);
  const level = integer(current.vehicle.upgradeLevel, 0, V100_VEHICLE.maxUpgradeLevel);
  if (level >= V100_VEHICLE.maxUpgradeLevel) return { applied: false, reason: "upgrade-cap", save: current };
  const cost = V100_VEHICLE.upgradeCosts[level];
  const receipt = `v100:vehicle:upgrade:${level + 1}`;
  if (current.receipts.includes(receipt) || current.vehicle.upgradeReceipts.includes(receipt)) return { applied: false, duplicate: true, reason: "duplicate-receipt", save: current };
  if (current.caps < cost) return { applied: false, reason: "insufficient-caps", save: current };
  return applyV100SaveMutation(current, (next) => ({
    ...next,
    caps: next.caps - cost,
    vehicle: {
      ...next.vehicle,
      upgradeLevel: level + 1,
      maxHp: V100_VEHICLE.baseHp + (level + 1) * V100_VEHICLE.hpPerUpgrade,
      upgradeReceipts: [...next.vehicle.upgradeReceipts, receipt],
    },
    receipts: [...next.receipts, receipt],
  }), { now });
}

export function createV100BattleState({ resource = 150, now = 0 } = {}) {
  return {
    resource: Math.max(0, Number(resource) || 0),
    activeReservations: [],
    cooldowns: {},
    receipts: [],
    now: Math.max(0, Number(now) || 0),
  };
}

function activeReservationCount(state) {
  return state.activeReservations.filter((entry) => entry.releasedAt === null).length;
}

export function reserveV100FormationSlot(save, battleState, { unitId, cost = 0, cooldownSeconds = 0, reservationId, now } = {}) {
  const current = normalizeV100Save(save);
  const state = battleState && typeof battleState === "object" ? battleState : createV100BattleState();
  const unit = V100_UNIT_BY_ID[unitId];
  if (!unit || !current.ownedUnitIds.includes(unitId)) return { accepted: false, reason: "unit-not-owned", save: current, battleState: state };
  if (activeReservationCount(state) >= V100_FORMATION_MAX_SLOTS) return { accepted: false, reason: "formation-full", save: current, battleState: state };
  const safeCost = Math.max(0, Number(cost) || 0);
  if (state.resource < safeCost) return { accepted: false, reason: "insufficient-battle-resource", save: current, battleState: state };
  const key = `${unitId}:${Math.max(0, Number(now) || state.now)}`;
  const id = typeof reservationId === "string" && reservationId.length > 0 ? reservationId : `v100:deploy:${key}:${state.activeReservations.length}`;
  if (state.receipts.includes(id)) return { accepted: false, duplicate: true, reason: "duplicate-receipt", save: current, battleState: state };
  const cooldownUntil = Number(state.cooldowns[unitId] ?? 0);
  const time = Math.max(0, Number(now) || state.now);
  if (cooldownUntil > time) return { accepted: false, reason: "cooldown", save: current, battleState: state };
  const reservation = { reservationId: id, unitId, acceptedAt: time, releasedAt: null };
  return {
    accepted: true,
    reservation,
    save: current,
    battleState: {
      ...state,
      resource: state.resource - safeCost,
      now: time,
      activeReservations: [...state.activeReservations, reservation],
      cooldowns: { ...state.cooldowns, [unitId]: time + Math.max(0, Number(cooldownSeconds) || 0) },
      receipts: [...state.receipts, id],
    },
  };
}

export function releaseV100FormationSlot(battleState, reservationId, { now } = {}) {
  const state = battleState && typeof battleState === "object" ? battleState : createV100BattleState();
  const index = state.activeReservations.findIndex((entry) => entry.reservationId === reservationId);
  if (index < 0) return { released: false, reason: "unknown-reservation", battleState: state };
  if (state.activeReservations[index].releasedAt !== null) return { released: false, duplicate: true, reason: "already-released", battleState: state };
  const nextReservations = state.activeReservations.slice();
  nextReservations[index] = { ...nextReservations[index], releasedAt: Math.max(0, Number(now) || state.now) };
  return { released: true, battleState: { ...state, activeReservations: nextReservations } };
}

export function v100BossVisibleInOtherModes(save, bossId) {
  const current = normalizeV100Save(save);
  return v100DiscoveredBosses(current.receipts).some(boss => boss.id === bossId);
}

export function v100CampaignReachability(save) {
  const current = normalizeV100Save(save);
  return V100_STAGE_IDS.map((stageId, index) => ({
    stageId,
    stageNumber: index + 1,
    reachable: current.availableStageIds.includes(stageId),
    completed: current.completedStageIds.includes(stageId),
    blockedBy: index === 0 ? null : V100_STAGE_IDS[index - 1],
  }));
}

export function v100TransactionContract() {
  return Object.freeze({
    formationMaxSlots: V100_FORMATION_MAX_SLOTS,
    duplicateCharacterIdsAllowed: true,
    activeCountExcludes: ["vehicle", "npc", "escort", "mission-object", "support", "enemy"],
    bossCountSource: "exact-first-defeat-receipt",
    rewardSource: "pending-result-finalize",
  });
}
