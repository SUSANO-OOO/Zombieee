import { V100_STAGE_IDS, v100StageReward } from "./v100Registry.js";
import { v100DiscoveredBosses } from "./v100BossProgress.js";
import { v100EquipmentFor } from "./v100Equipment.js";

const REWARD_BY_BOSS = new Map([
  ["boss-takuya", "boss-muscle-fiber"], ["boss-gate-eater", "boss-rail-spine"],
  ["boss-mother", "boss-ossified-core"], ["boss-ooguchi", "boss-muscle-fiber"],
  ["boss-kurome", "boss-resonance-gland"], ["boss-gairen", "boss-rail-spine"],
  ["boss-futago", "boss-mimic-larynx"], ["boss-mugarian-president-mutated", "boss-mimic-larynx"],
  ["boss-takuya-omega", "boss-muscle-fiber"],
]);
const count = value => Number.isFinite(Number(value)) ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(Number(value)))) : 0;
export const v100OutbreakRunIdValid = id => typeof id === "string" && id.length > 0 && id.length <= 160 && id.trim() === id && !/[\u0000-\u001f]/.test(id);

export function v100OutbreakEncounters(save) {
  return v100DiscoveredBosses(save?.receipts).map(boss => ({
    ...boss, stageId: V100_STAGE_IDS[boss.stageNumber - 1],
    rewardCaps: v100StageReward(boss.stageNumber, "replay"),
    rewardEquipment: v100EquipmentFor(REWARD_BY_BOSS.get(boss.id)),
  }));
}

export function normalizeV100OutbreakProgress(raw, receipts) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const bosses = v100DiscoveredBosses(receipts), ids = new Set(bosses.map(boss => boss.id));
  const committed = new Set(Array.isArray(receipts) ? receipts : []);
  const active = ids.has(source.active?.bossId) && v100OutbreakRunIdValid(source.active?.runId)
    && committed.has(`v100:outbreak:${source.active.bossId}:start:${source.active.runId}`)
    && !committed.has(`v100:outbreak:${source.active.bossId}:result:${source.active.runId}`)
    && !committed.has(`v100:outbreak:${source.active.bossId}:cancel:${source.active.runId}`)
    ? { bossId: source.active.bossId, runId: source.active.runId } : null;
  const prior = source.lastResult;
  const lastResult = ids.has(prior?.bossId) && v100OutbreakRunIdValid(prior?.runId)
    && committed.has(`v100:outbreak:${prior.bossId}:result:${prior.runId}`) ? {
      bossId: prior.bossId, runId: prior.runId, won: prior.won === true,
      vehicleHp: count(prior.vehicleHp), vehicleMaxHp: count(prior.vehicleMaxHp), elapsedSeconds: count(prior.elapsedSeconds), unitDeaths: count(prior.unitDeaths),
      rewardCaps: count(prior.rewardCaps), grantedEquipmentId: v100EquipmentFor(prior.grantedEquipmentId)?.id ?? null,
      grantedQuantity: prior.grantedQuantity === 1 ? 1 : 0, finishedAt: typeof prior.finishedAt === "string" ? prior.finishedAt : "",
    } : null;
  return {
    active, lastResult, view: active ? "battle" : source.view === "result" && lastResult ? "result" : "hub",
    clearCounts: Object.fromEntries(bosses.filter(boss => committed.has(`v100:outbreak:${boss.id}:first-clear`))
      .map(boss => [boss.id, Math.max(1, count(source.clearCounts?.[boss.id]))])),
  };
}
