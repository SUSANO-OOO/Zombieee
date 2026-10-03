import { normalizeSurvivalRun, SURVIVAL_RUN_PHASES } from './survival.js';
import { v100DiscoveredBosses } from './v100BossProgress.js';
import { V100_BATTLE_ADAPTER, v100FormationCombatKinds, v100SupportSupplyFor } from './v100BattleAdapter.js';
import { V100_STAGE_IDS, V100_UNITS, v100SupportFor } from './v100Registry.js';
import { v100EquipmentFor, v100OpeningSupportGauge } from './v100Equipment.js';
import { SURVIVAL_NORMAL_ENEMY_KINDS } from './survivalBattleRuntime.js';

const kinds = V100_BATTLE_ADAPTER.BOSS_KIND_BY_V100_ID;
const number = value => Number.isFinite(Number(value)) ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(Number(value)))) : 0;
const wave = value => Math.min(1_000_000, number(value));
export const v100SurvivalRunIdValid = id => typeof id === 'string' && id.length > 0 && id.length <= 160 && id.trim() === id && !/[\u0000-\u001f]/.test(id);
export const v100SurvivalBossPool = receipts => v100DiscoveredBosses(receipts).map(boss => kinds[boss.id]);
export const v100SurvivalBossForKind = (receipts, kind) => v100DiscoveredBosses(receipts).find(boss => kinds[boss.id] === kind) ?? null;
export const v100SurvivalReceipt = (runId, suffix) => `v100:survival:${runId}:${suffix}`;

function validSnapshot(run, receipts, ownedUnitIds) {
  if (!run || run.modePolicy !== 'v100' || !v100SurvivalRunIdValid(run.runId)) return false;
  const pool = v100SurvivalBossPool(receipts), owned = new Set(ownedUnitIds);
  if (!run.bossPool.length || run.bossPool.some(kind => !pool.includes(kind))) return false;
  if (!run.formation.unitIds.length || run.formation.unitIds.some(id => !owned.has(id) || !V100_UNITS.some(unit => unit.id === id))) return false;
  if (![680, 760, 840, 920, 1000, 1080].includes(run.crawler.maxHp)) return false;
  const gear = [...run.formation.tacticalEquipmentIds, ...Object.values(run.formation.personalEquipmentByUnit).flat()].filter(Boolean);
  return gear.every(id => v100EquipmentFor(id));
}

export function normalizeV100SurvivalProgress(raw, receipts, ownedUnitIds) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const committed = new Set(receipts), run = normalizeSurvivalRun(source.active?.run);
  const hasStart = run && committed.has(v100SurvivalReceipt(run.runId, 'start'));
  const finalized = run && committed.has(v100SurvivalReceipt(run.runId, 'result'));
  const hasCheckpoint = run && (run.lastCompletedWave === run.startWave - 1
    || committed.has(v100SurvivalReceipt(run.runId, `checkpoint:${run.lastCompletedWave}`)));
  const active = validSnapshot(run, receipts, ownedUnitIds) && hasStart && !finalized && hasCheckpoint
    && [SURVIVAL_RUN_PHASES.WAVE_READY, SURVIVAL_RUN_PHASES.UPGRADE_SELECTION].includes(run.phase)
    ? { run, equippedSupportId: v100SupportFor(source.active.equippedSupportId)?.id ?? null,
      initialSupportGauge: v100OpeningSupportGauge(run.formation) } : null;
  const prior = source.lastResult;
  const lastResult = v100SurvivalRunIdValid(prior?.runId) && committed.has(v100SurvivalReceipt(prior.runId, 'result'))
    ? { runId: prior.runId, endReason: String(prior.endReason ?? ''), reachedWave: wave(prior.reachedWave), completedWave: wave(prior.completedWave),
      kills: number(prior.kills), clearedBosses: number(prior.clearedBosses), elapsedSeconds: number(prior.elapsedSeconds),
      totalCaps: number(prior.totalCaps), finalCaps: number(prior.finalCaps), finishedAt: String(prior.finishedAt ?? '') } : null;
  return { active, lastResult, view: active ? 'battle' : source.view === 'result' && lastResult ? 'result' : 'hub',
    highestCompletedWave: wave(source.highestCompletedWave), highestReachedWave: wave(source.highestReachedWave), totalRuns: number(source.totalRuns),
    clearCounts: Object.fromEntries(v100DiscoveredBosses(receipts).map(boss => [boss.id,
      [...committed].filter(receipt => typeof receipt === 'string' && receipt.startsWith('v100:survival:') && receipt.endsWith(`:boss:${boss.id}`)).length])),
  };
}

export function v100SurvivalSession(active, settings) {
  const run = active.run;
  return { stageId: V100_STAGE_IDS[0], resultId: run.runId, displayName: '防衛継続作戦',
    formationKinds: v100FormationCombatKinds(run.formation.unitIds), enemyKinds: [...SURVIVAL_NORMAL_ENEMY_KINDS, ...run.bossPool],
    selectedSupply: v100SupportSupplyFor(active.equippedSupportId), equippedSupportId: active.equippedSupportId,
    unitLevels: { ...run.formation.unitLevelsByUnit }, vehicleMaxHp: run.crawler.maxHp,
    equipmentSnapshot: run.formation, initialSupportGauge: active.initialSupportGauge, settings, survivalRun: run };
}
