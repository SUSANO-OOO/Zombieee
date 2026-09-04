import { normalizeV100Save, applyV100SaveMutation } from './v100Save.js';
import { createSurvivalRun, normalizeSurvivalRun, selectSurvivalUpgrade, SURVIVAL_RUN_PHASES } from './survival.js';
import { selectSurvivalBossKind, survivalWaveReward } from './survivalBattleRuntime.js';
import { v100EquipmentSnapshot, v100EquipmentQuantityCap } from './v100Equipment.js';
import { v100SurvivalRunIdValid, v100SurvivalBossPool, v100SurvivalBossForKind, v100SurvivalReceipt } from './v100Survival.js';

const reject = (save, reason = 'invalid-mode-run') => ({ applied: false, reason, save });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sumCaps = (first, last) => last < first ? 0 : (last - first + 1) * (8 + 3 * (first + last) / 2);
function sameRun(active, incoming) {
  if (!active || !incoming || incoming.modePolicy !== 'v100') return false;
  return ['runId', 'startWave', 'startedAt', 'formation', 'bossPool'].every(key => same(active[key], incoming[key]))
    && active.crawler.maxHp === incoming.crawler.maxHp;
}
function observedRunValid(run) {
  return run && ['startWave', 'currentWave', 'lastCompletedWave', 'reachedWave'].every(key => Number.isSafeInteger(run[key]) && run[key] >= 0)
    && Number.isFinite(run.crawler?.hp) && run.crawler.hp >= 0 && run.crawler.hp <= run.crawler.maxHp
    && ['kills', 'bossKills', 'battleSeconds'].every(key => Number.isFinite(run.stats?.[key]) && run.stats[key] >= 0);
}

/** @param {object} save @param {{runId?: string, startWave?: number, now?: string | number}} options */
export function beginV100Survival(save, { runId, startWave = 1, now } = {}) {
  const current = normalizeV100Save(save), bossPool = v100SurvivalBossPool(current.receipts);
  if (!bossPool.length) return reject(current, 'boss-undiscovered');
  if (current.flowState.phase !== 'map' || current.pendingResult || current.outbreak.view !== 'hub' || current.survival.view !== 'hub') return reject(current, 'activity-active');
  const receipt = v100SurvivalReceipt(runId, 'start');
  if (!v100SurvivalRunIdValid(runId) || current.receipts.includes(receipt)) return reject(current);
  const highestStart = Math.floor(current.survival.highestCompletedWave / 10) * 10 + 1;
  if (!Number.isInteger(startWave) || startWave < 1 || startWave % 10 !== 1 || startWave > highestStart) return reject(current);
  const unitIds = current.formationSlots.filter(Boolean);
  if (!unitIds.length) return reject(current, 'formation-empty');
  const run = createSurvivalRun({ runId, modePolicy: 'v100', startedAt: new Date(now ?? Date.now()).toISOString(), startWave,
    unlockedStartWaves: [1, highestStart], bossPool, crawlerMaxHp: current.vehicle.maxHp,
    formation: { presetId: 'v100-active', unitIds, unitLevelsByUnit: { ...current.unitLevels }, ...v100EquipmentSnapshot(current) } });
  return applyV100SaveMutation(current, next => ({ ...next, receipts: [...next.receipts, receipt],
    survival: { ...next.survival, active: { run, equippedSupportId: next.equippedSupportId }, view: 'battle' } }), { now });
}

export function checkpointV100Survival(save, rawRun, { now } = {}) {
  const current = normalizeV100Save(save), prior = current.survival.active?.run, incoming = normalizeSurvivalRun(rawRun);
  if (!observedRunValid(rawRun) || !sameRun(prior, rawRun) || prior.phase !== SURVIVAL_RUN_PHASES.WAVE_READY
    || incoming.phase !== SURVIVAL_RUN_PHASES.UPGRADE_SELECTION || incoming.crawler.hp <= 0
    || incoming.lastCompletedWave !== prior.lastCompletedWave + 5) return reject(current);
  const completed = incoming.lastCompletedWave;
  const kind = selectSurvivalBossKind({ waveNumber: completed, bossPool: prior.bossPool, lastBossKind: prior.lastBossKind, strictBossPool: true });
  const boss = v100SurvivalBossForKind(current.receipts, kind);
  const receipt = v100SurvivalReceipt(prior.runId, `checkpoint:${completed}`);
  if (!boss || incoming.lastBossKind !== kind || current.receipts.includes(receipt)
    || incoming.stats.bossKills !== prior.stats.bossKills + 1
    || (incoming.stats.enemyDefeatsByKind[kind] ?? 0) <= (prior.stats.enemyDefeatsByKind[kind] ?? 0)) return reject(current, 'invalid-result');
  const bossReward = survivalWaveReward(completed);
  const caps = sumCaps(prior.lastCompletedWave + 1, completed) + 25;
  const reward = { caps, equipmentGrants: bossReward.equipmentGrants };
  const run = normalizeSurvivalRun({ ...incoming, manualAbilityCooldownsByKind: {},
    checkpointRewards: [...prior.checkpointRewards, { checkpointWave: completed, reward }], pendingReward: {} });
  const inventory = { ...current.equipment.inventory };
  for (const grant of reward.equipmentGrants) inventory[grant.equipmentId] = Math.min(v100EquipmentQuantityCap(grant.equipmentId), (inventory[grant.equipmentId] ?? 0) + grant.quantity);
  return applyV100SaveMutation(current, next => ({ ...next, caps: next.caps + caps,
    receipts: [...next.receipts, receipt, v100SurvivalReceipt(prior.runId, `checkpoint:${completed}:boss:${boss.id}`)],
    equipment: { ...next.equipment, inventory },
    bosses: { ...next.bosses, defeatCounts: { ...next.bosses.defeatCounts, [boss.id]: next.bosses.defeatCounts[boss.id] + 1 } },
    survival: { ...next.survival, active: { ...next.survival.active, run },
      highestCompletedWave: Math.max(next.survival.highestCompletedWave, completed), highestReachedWave: Math.max(next.survival.highestReachedWave, incoming.reachedWave) },
  }), { now });
}

export function selectV100SurvivalUpgrade(save, runId, upgradeId, { now } = {}) {
  const current = normalizeV100Save(save), prior = current.survival.active?.run;
  if (!prior || prior.runId !== runId || prior.phase !== SURVIVAL_RUN_PHASES.UPGRADE_SELECTION || !prior.pendingUpgradeChoices.includes(upgradeId)) return reject(current);
  const receipt = v100SurvivalReceipt(runId, `upgrade:${prior.lastCompletedWave}`);
  if (current.receipts.includes(receipt)) return reject(current);
  const run = selectSurvivalUpgrade(prior, upgradeId);
  if (run.phase !== SURVIVAL_RUN_PHASES.WAVE_READY) return reject(current);
  return applyV100SaveMutation(current, next => ({ ...next, receipts: [...next.receipts, receipt],
    survival: { ...next.survival, active: { ...next.survival.active, run } } }), { now });
}

export function settleV100Survival(save, rawRun, { now } = {}) {
  const current = normalizeV100Save(save), prior = current.survival.active?.run, incoming = normalizeSurvivalRun(rawRun);
  if (!observedRunValid(rawRun) || !sameRun(prior, rawRun) || incoming.phase !== SURVIVAL_RUN_PHASES.ENDED || !incoming.endReason
    || incoming.lastCompletedWave < prior.lastCompletedWave || incoming.lastCompletedWave > prior.lastCompletedWave + 4) return reject(current);
  const receipt = v100SurvivalReceipt(prior.runId, 'result');
  if (current.receipts.includes(receipt)) return reject(current);
  const finalCaps = sumCaps(prior.lastCompletedWave + 1, incoming.lastCompletedWave);
  const totalCaps = prior.checkpointRewards.reduce((sum, entry) => sum + entry.reward.caps, 0) + finalCaps;
  return applyV100SaveMutation(current, next => ({ ...next, caps: next.caps + finalCaps, receipts: [...next.receipts, receipt],
    survival: { ...next.survival, active: null, view: 'result', totalRuns: next.survival.totalRuns + 1,
      highestCompletedWave: Math.max(next.survival.highestCompletedWave, incoming.lastCompletedWave),
      highestReachedWave: Math.max(next.survival.highestReachedWave, incoming.reachedWave),
      lastResult: { runId: prior.runId, endReason: incoming.endReason, reachedWave: incoming.reachedWave, completedWave: incoming.lastCompletedWave,
        kills: incoming.stats.kills, clearedBosses: prior.checkpointRewards.length, elapsedSeconds: incoming.stats.battleSeconds,
        totalCaps, finalCaps, finishedAt: new Date(now ?? Date.now()).toISOString() } },
  }), { now });
}

export function dismissV100SurvivalResult(save, { now } = {}) {
  const current = normalizeV100Save(save);
  if (current.survival.view !== 'result' || current.survival.active) return reject(current);
  return applyV100SaveMutation(current, next => ({ ...next, survival: { ...next.survival, view: 'hub' } }), { now });
}
