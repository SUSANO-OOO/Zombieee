import { CAMPAIGN_STAGE_IDS } from "./campaign.js";

const EMPTY_FACTS = Object.freeze([]);

function isRuntime(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function hasOwn(runtime, key) {
  return Object.prototype.hasOwnProperty.call(runtime, key);
}

function completedMission(runtime) {
  if (runtime === undefined || runtime === null) return true;
  return isRuntime(runtime)
    && runtime.failed !== true
    && runtime.completed === true;
}

function optionalMinimum(runtime, keys, minimum) {
  if (!isRuntime(runtime)) return runtime === undefined || runtime === null;
  for (const key of keys) {
    if (!hasOwn(runtime, key)) continue;
    const value = Number(runtime[key]);
    return Number.isFinite(value) && value >= minimum;
  }
  return true;
}

function freezeFacts(facts) {
  return facts.length > 0 ? Object.freeze(facts) : EMPTY_FACTS;
}

/**
 * Builds immutable, player-facing battle result facts.
 *
 * A supplied mission runtime is authoritative: completion-dependent facts are
 * omitted unless that runtime confirms completion, and optional counters are
 * never allowed to contradict a rescue, objective, power, boss, seal, or return claim.
 */
export function stageResultFacts({
  stageId,
  won = false,
  firstClear = false,
  missionRuntime,
} = {}) {
  if (won !== true) return EMPTY_FACTS;

  if (stageId === CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET) {
    if (firstClear !== true || !completedMission(missionRuntime)) return EMPTY_FACTS;
    if (!optionalMinimum(missionRuntime, ["rescuedCount", "rescueCount"], 5)) return EMPTY_FACTS;
    return freezeFacts(["生存者5名を自動救助"]);
  }

  if (stageId === CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_GATE) {
    if (!completedMission(missionRuntime)) return EMPTY_FACTS;
    if (isRuntime(missionRuntime) && missionRuntime.relayDestroyed === false) return EMPTY_FACTS;
    const facts = ["感染中継点を破壊"];
    if (firstClear === true
      && optionalMinimum(missionRuntime, ["rescuedCount", "rescueCount"], 7)) {
      facts.push("生存者7名を自動救助");
    }
    return freezeFacts(facts);
  }

  if (stageId === CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_PLATFORM) {
    if (!completedMission(missionRuntime)) return EMPTY_FACTS;
    if (isRuntime(missionRuntime) && missionRuntime.enemyBaseDestroyed === false) return EMPTY_FACTS;
    const facts = ["ホームを制圧し、感染拠点を破壊"];
    if (firstClear === true
      && optionalMinimum(missionRuntime, ["rescuedCount", "rescueCount"], 5)) {
      facts.push("生存者5名を救助");
    }
    return freezeFacts(facts);
  }

  if (stageId === CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_TUNNEL) {
    if (missionRuntime === undefined || missionRuntime === null) {
      return freezeFacts([
        "電源を順番に起動（3/3）",
        "改札喰いを撃破し、研究容器を封鎖",
        "45秒の退路を全員で帰還",
        ...(firstClear === true ? ["モンキーが部隊に加入"] : []),
      ]);
    }
    if (!isRuntime(missionRuntime) || missionRuntime.failed === true) return EMPTY_FACTS;

    const powerComplete = Number(missionRuntime.powerActivated) >= 3;
    const containmentComplete = powerComplete
      && missionRuntime.gateEaterDefeated === true
      && missionRuntime.researchContainerContained === true
      && missionRuntime.sealed === true;
    const escapeRemaining = missionRuntime.escapeRemaining;
    const returnedCount = missionRuntime.returnedCount;
    const returnTargetCount = missionRuntime.returnTargetCount;
    const returnTargetIds = Array.isArray(missionRuntime.returnTargetIds)
      ? missionRuntime.returnTargetIds.map(String)
      : [];
    const returnedUnitIds = Array.isArray(missionRuntime.returnedUnitIds)
      ? missionRuntime.returnedUnitIds.map(String)
      : [];
    const allRequiredUnitsReturned = returnTargetIds.length > 0
      ? returnTargetIds.every((id) => returnedUnitIds.includes(id))
      : typeof returnedCount === "number"
        && Number.isFinite(returnedCount)
        && typeof returnTargetCount === "number"
        && Number.isFinite(returnTargetCount)
        && returnTargetCount > 0
        && returnedCount >= returnTargetCount;
    const returnComplete = powerComplete
      && containmentComplete
      && missionRuntime.completed === true
      && typeof escapeRemaining === "number"
      && Number.isFinite(escapeRemaining)
      && escapeRemaining >= 0
      && allRequiredUnitsReturned;
    const facts = [];
    if (powerComplete) facts.push("電源を順番に起動（3/3）");
    if (containmentComplete) facts.push("改札喰いを撃破し、研究容器を封鎖");
    if (returnComplete) facts.push("45秒の退路を全員で帰還");
    if (firstClear === true && returnComplete) facts.push("モンキーが部隊に加入");
    return freezeFacts(facts);
  }

  return EMPTY_FACTS;
}
