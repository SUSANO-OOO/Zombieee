import {
  SURVIVAL_BLOCK_WAVES,
  SURVIVAL_END_REASONS,
  SURVIVAL_RUN_PHASES,
  SURVIVAL_UPGRADE_BY_ID,
  beginSurvivalWave,
  completeSurvivalBossEntrance,
  completeSurvivalWave,
  normalizeSurvivalBossPool,
  normalizeSurvivalRun,
  recordSurvivalRunCombatStats,
  selectSurvivalUpgrade,
  survivalWaveDescriptor,
} from "./survival.js";
import { isBossEnemyKind } from "./bossFoundation.js";

const MAX_SURVIVAL_SPAWNS_PER_WAVE = 32;
const INTERMISSION_SECONDS = 1.5;

function clampInteger(value, minimum, maximum, fallback = minimum) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.floor(numeric)));
}

function finite(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function normalizeMetricRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => typeof key === "string" && key.trim().length > 0)
    .map(([key, amount]) => [
      key.trim(),
      clampInteger(amount, 0, Number.MAX_SAFE_INTEGER, 0),
    ])
    .filter(([, amount]) => amount > 0));
}

function normalizeCombatStats(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    damageByUnit: normalizeMetricRecord(source.damageByUnit),
    damageTakenByUnit: normalizeMetricRecord(source.damageTakenByUnit),
    healingByUnit: normalizeMetricRecord(source.healingByUnit),
    encounteredEnemyKinds: Array.isArray(source.encounteredEnemyKinds)
      ? [...new Set(source.encounteredEnemyKinds
        .filter((kind) => typeof kind === "string")
        .map((kind) => kind.trim())
        .filter(Boolean))]
      : [],
    enemyDefeatsByKind: normalizeMetricRecord(source.enemyDefeatsByKind),
  };
}

function metricDelta(current, start) {
  const currentRecord = normalizeMetricRecord(current);
  const startRecord = normalizeMetricRecord(start);
  return Object.fromEntries(Object.entries(currentRecord)
    .map(([key, amount]) => [key, Math.max(0, amount - (startRecord[key] ?? 0))])
    .filter(([, amount]) => amount > 0));
}

function combatStatsDelta(current, start) {
  const currentStats = normalizeCombatStats(current);
  const startStats = normalizeCombatStats(start);
  const encounteredAtStart = new Set(startStats.encounteredEnemyKinds);
  return {
    damageByUnit: metricDelta(currentStats.damageByUnit, startStats.damageByUnit),
    damageTakenByUnit: metricDelta(currentStats.damageTakenByUnit, startStats.damageTakenByUnit),
    healingByUnit: metricDelta(currentStats.healingByUnit, startStats.healingByUnit),
    encounteredEnemyKinds: currentStats.encounteredEnemyKinds.filter((kind) => !encounteredAtStart.has(kind)),
    enemyDefeatsByKind: metricDelta(currentStats.enemyDefeatsByKind, startStats.enemyDefeatsByKind),
  };
}

export function captureUnfinishedSurvivalCombatStats(runtime, run, {
  totalKills = 0,
  combatStats = null,
  updatedAt = new Date().toISOString(),
} = {}) {
  const currentRun = normalizeSurvivalRun(run);
  if (!currentRun) return null;
  const currentRuntime = normalizeCombatRuntime(runtime, currentRun);
  if (currentRun.phase !== SURVIVAL_RUN_PHASES.IN_WAVE || !currentRuntime.waveQueued) return currentRun;
  const delta = combatStatsDelta(combatStats, currentRuntime.waveCombatStatsStart);
  const bossKills = Object.entries(delta.enemyDefeatsByKind)
    .filter(([kind]) => isBossEnemyKind(kind))
    .reduce((total, [, count]) => total + count, 0);
  return recordSurvivalRunCombatStats(currentRun, {
    ...delta,
    kills: Math.max(
      0,
      clampInteger(totalKills, 0, Number.MAX_SAFE_INTEGER, 0) - currentRuntime.waveKillsStart,
    ),
    bossKills,
    battleSeconds: currentRuntime.waveActiveSeconds,
    updatedAt,
  });
}

export const SURVIVAL_DEFENSE_FRONT = deepFreeze({
  frontlineX: 646,
  rangedX: 604,
  supportX: 568,
  pursuitLimitX: 720,
  emergencyDefenseX: 430,
});

export function survivalDefenseDestination({
  aiProfile = "frontline",
  desiredX,
  emergencyDefense = false,
  activeThreatX = null,
} = {}) {
  const profileAnchor = aiProfile === "support" || aiProfile === "engineer"
    ? SURVIVAL_DEFENSE_FRONT.supportX
    : aiProfile === "marksman" || aiProfile === "suppression"
      ? SURVIVAL_DEFENSE_FRONT.rangedX
      : SURVIVAL_DEFENSE_FRONT.frontlineX;
  if (emergencyDefense) {
    return Math.max(
      SURVIVAL_DEFENSE_FRONT.emergencyDefenseX,
      Math.min(profileAnchor, finite(activeThreatX, profileAnchor)),
    );
  }
  return Math.max(
    SURVIVAL_DEFENSE_FRONT.emergencyDefenseX,
    Math.min(
      SURVIVAL_DEFENSE_FRONT.pursuitLimitX,
      finite(desiredX, profileAnchor),
    ),
  );
}

export const SURVIVAL_NORMAL_ENEMY_KINDS = deepFreeze([
  "walker",
  "runner",
  "spitter",
  "grappler",
  "ooze",
  "sprinter",
  "crusher",
  "shade",
  "abomination",
]);

export function selectSurvivalBossKind({
  waveNumber,
  bossPool,
  lastBossKind = null,
} = {}) {
  const descriptor = survivalWaveDescriptor(waveNumber);
  if (!descriptor.isBoss) return null;
  const pool = normalizeSurvivalBossPool(bossPool);
  let index = (descriptor.blockNumber - 1) % pool.length;
  if (pool.length > 1 && pool[index] === lastBossKind) {
    index = (index + 1) % pool.length;
  }
  return pool[index];
}

export function survivalWaveSpawnPlan(waveNumber, {
  bossPool,
  lastBossKind = null,
} = {}) {
  const descriptor = survivalWaveDescriptor(waveNumber);
  const unlockedKinds = Math.min(
    SURVIVAL_NORMAL_ENEMY_KINDS.length,
    2 + Math.floor((descriptor.waveNumber - 1) / 2),
  );
  const normalCount = Math.min(
    MAX_SURVIVAL_SPAWNS_PER_WAVE - (descriptor.isBoss ? 1 : 0),
    4 + Math.floor(descriptor.waveNumber * 1.35),
  );
  const units = Array.from({ length: normalCount }, (_, index) => (
    SURVIVAL_NORMAL_ENEMY_KINDS[
      (descriptor.waveNumber * 5 + descriptor.blockNumber * 3 + index * 7) % unlockedKinds
    ]
  ));
  const bossKind = selectSurvivalBossKind({
    waveNumber: descriptor.waveNumber,
    bossPool,
    lastBossKind,
  });
  if (descriptor.isBoss) {
    units.splice(Math.min(2, units.length), 0, bossKind);
  }
  return deepFreeze({
    wave: descriptor.waveNumber,
    descriptor,
    units,
    bossKind,
  });
}

export function survivalWaveReward(waveNumber) {
  const descriptor = survivalWaveDescriptor(waveNumber);
  const caps = 8 + descriptor.waveNumber * 3 + (descriptor.isBoss ? 25 : 0);
  const equipmentGrants = descriptor.isBoss
    ? [{
      equipmentId: descriptor.blockNumber % 2 === 0
        ? "survival-reinforced-plate"
        : "survival-field-kit",
      quantity: 1,
    }]
    : [];
  return { caps, equipmentGrants };
}

export function survivalUpgradeEffects(run) {
  const current = normalizeSurvivalRun(run);
  const stacks = current?.temporaryUpgradeStacks ?? {};
  const effect = (upgradeId) => (
    (stacks[upgradeId] ?? 0) * (SURVIVAL_UPGRADE_BY_ID[upgradeId]?.effectPerStack ?? 0)
  );
  return {
    attackMultiplier: 1 + effect("assault-drill"),
    defenseMultiplier: Math.max(.2, 1 - effect("layered-armor")),
    healingMultiplier: 1 + effect("field-triage"),
    rangeMultiplier: 1 + effect("range-calibration"),
    redeployMultiplier: Math.max(.25, 1 - effect("rapid-redeployment")),
    bossDamageMultiplier: 1 + effect("boss-breaker"),
  };
}

export function createSurvivalCombatRuntime(run) {
  const current = normalizeSurvivalRun(run);
  if (!current) throw new TypeError("A valid Survival run is required");
  return {
    runId: current.runId,
    wave: current.currentWave,
    waveQueued: false,
    intermissionRemaining: current.phase === SURVIVAL_RUN_PHASES.WAVE_READY
      ? INTERMISSION_SECONDS
      : 0,
    waveKillsStart: current.stats.kills,
    waveCombatStatsStart: normalizeCombatStats(null),
    waveActiveSeconds: 0,
    hadLivingHuman: false,
    noHumanSeconds: 0,
  };
}

function normalizeCombatRuntime(value, run) {
  const current = value && typeof value === "object" ? value : {};
  return {
    runId: run.runId,
    wave: run.currentWave,
    waveQueued: current.wave === run.currentWave && current.waveQueued === true,
    intermissionRemaining: Math.max(0, finite(
      current.intermissionRemaining,
      run.phase === SURVIVAL_RUN_PHASES.WAVE_READY ? INTERMISSION_SECONDS : 0,
    )),
    waveKillsStart: clampInteger(current.waveKillsStart, 0, Number.MAX_SAFE_INTEGER, run.stats.kills),
    waveCombatStatsStart: normalizeCombatStats(current.waveCombatStatsStart),
    waveActiveSeconds: Math.max(0, finite(current.waveActiveSeconds, 0)),
    hadLivingHuman: current.hadLivingHuman === true,
    noHumanSeconds: Math.max(0, finite(current.noHumanSeconds, 0)),
  };
}

export function advanceSurvivalCombat(runtime, run, {
  seconds = 0,
  activeEnemyCount = 0,
  pendingSpawnCount = 0,
  totalKills = 0,
  crawlerHp,
  bossCombatReady = false,
  livingHumanCount = 0,
  queuedHumanCount = 0,
  combatStats = null,
} = {}) {
  const currentRun = normalizeSurvivalRun(run);
  if (!currentRun) return { run: null, runtime: null, events: [] };
  let nextRun = currentRun;
  let nextRuntime = normalizeCombatRuntime(runtime, currentRun);
  const events = [];
  const elapsed = Math.max(0, finite(seconds, 0));
  const livingHumans = clampInteger(livingHumanCount, 0, Number.MAX_SAFE_INTEGER, 0);
  const queuedHumans = clampInteger(queuedHumanCount, 0, Number.MAX_SAFE_INTEGER, 0);
  if (livingHumans > 0 || queuedHumans > 0) {
    nextRuntime.hadLivingHuman = true;
    nextRuntime.noHumanSeconds = 0;
  } else if (nextRuntime.hadLivingHuman && currentRun.phase === SURVIVAL_RUN_PHASES.IN_WAVE) {
    nextRuntime.noHumanSeconds += elapsed;
  }
  if (currentRun.phase === SURVIVAL_RUN_PHASES.IN_WAVE && nextRuntime.waveQueued) {
    nextRuntime.waveActiveSeconds = Math.min(
      Number.MAX_SAFE_INTEGER,
      nextRuntime.waveActiveSeconds + elapsed,
    );
  }

  const terminalReason = survivalCombatEndReason(nextRuntime, currentRun, { crawlerHp });
  if (terminalReason) {
    return {
      run: nextRun,
      runtime: nextRuntime,
      events,
      terminalReason,
    };
  }

  if (currentRun.phase === SURVIVAL_RUN_PHASES.WAVE_READY) {
    nextRuntime.intermissionRemaining = Math.max(0, nextRuntime.intermissionRemaining - elapsed);
    if (nextRuntime.intermissionRemaining <= 0) {
      nextRun = beginSurvivalWave(currentRun);
      const plan = survivalWaveSpawnPlan(nextRun.currentWave, {
        bossPool: nextRun.bossPool,
        lastBossKind: nextRun.lastBossKind,
      });
      if (plan.bossKind) nextRun = { ...nextRun, lastBossKind: plan.bossKind };
      nextRuntime = {
        ...nextRuntime,
        wave: nextRun.currentWave,
        waveQueued: true,
        waveKillsStart: clampInteger(totalKills, 0, Number.MAX_SAFE_INTEGER, currentRun.stats.kills),
        waveCombatStatsStart: normalizeCombatStats(combatStats),
        waveActiveSeconds: 0,
      };
      events.push({ type: "queue-wave", plan });
      if (plan.bossKind) events.push({ type: "boss-warning", bossKind: plan.bossKind });
    }
    return { run: nextRun, runtime: nextRuntime, events, terminalReason: null };
  }

  if (currentRun.phase !== SURVIVAL_RUN_PHASES.IN_WAVE) {
    return { run: nextRun, runtime: nextRuntime, events, terminalReason: null };
  }

  if (currentRun.bossEntrancePending && bossCombatReady) {
    nextRun = completeSurvivalBossEntrance(currentRun);
    events.push({ type: "boss-combat-ready" });
  }

  if (
    nextRuntime.waveQueued
    && clampInteger(activeEnemyCount, 0, Number.MAX_SAFE_INTEGER, 0) === 0
    && clampInteger(pendingSpawnCount, 0, Number.MAX_SAFE_INTEGER, 0) === 0
  ) {
    const descriptor = survivalWaveDescriptor(nextRun.currentWave);
    const waveKills = Math.max(
      descriptor.isBoss ? 1 : 0,
      clampInteger(totalKills, 0, Number.MAX_SAFE_INTEGER, 0) - nextRuntime.waveKillsStart,
    );
    nextRun = completeSurvivalWave(nextRun, {
      kills: waveKills,
      bossKills: descriptor.isBoss ? 1 : 0,
      battleSeconds: nextRuntime.waveActiveSeconds,
      ...combatStatsDelta(combatStats, nextRuntime.waveCombatStatsStart),
      crawlerHp,
      reward: survivalWaveReward(nextRun.currentWave),
    });
    nextRuntime = {
      ...nextRuntime,
      wave: nextRun.currentWave,
      waveQueued: false,
      intermissionRemaining: INTERMISSION_SECONDS,
      waveKillsStart: clampInteger(totalKills, 0, Number.MAX_SAFE_INTEGER, 0),
      waveCombatStatsStart: normalizeCombatStats(combatStats),
      waveActiveSeconds: 0,
    };
    events.push({
      type: descriptor.isBoss ? "checkpoint" : "wave-complete",
      completedWave: nextRun.lastCompletedWave,
    });
    if (nextRun.phase === SURVIVAL_RUN_PHASES.UPGRADE_SELECTION) {
      events.push({
        type: "upgrade-selection",
        choices: [...nextRun.pendingUpgradeChoices],
      });
    }
  }
  return { run: nextRun, runtime: nextRuntime, events, terminalReason: null };
}

export function chooseSurvivalCombatUpgrade(runtime, run, upgradeId) {
  const currentRun = normalizeSurvivalRun(run);
  if (!currentRun) return { run: null, runtime: null, selected: false };
  const nextRun = selectSurvivalUpgrade(currentRun, upgradeId);
  const selected = nextRun !== currentRun
    && nextRun.phase === SURVIVAL_RUN_PHASES.WAVE_READY
    && Object.hasOwn(SURVIVAL_UPGRADE_BY_ID, upgradeId);
  return {
    run: nextRun,
    runtime: selected
      ? {
        ...normalizeCombatRuntime(runtime, nextRun),
        wave: nextRun.currentWave,
        waveQueued: false,
        intermissionRemaining: INTERMISSION_SECONDS,
      }
      : normalizeCombatRuntime(runtime, currentRun),
    selected,
  };
}

export function survivalCombatEndReason(runtime, run, {
  crawlerHp,
  squadDefeatGraceSeconds = 3,
} = {}) {
  const currentRun = normalizeSurvivalRun(run);
  if (!currentRun || currentRun.phase === SURVIVAL_RUN_PHASES.ENDED) return null;
  if (finite(crawlerHp, currentRun.crawler.hp) <= 0) return SURVIVAL_END_REASONS.CRAWLER_DESTROYED;
  const currentRuntime = normalizeCombatRuntime(runtime, currentRun);
  if (
    currentRuntime.hadLivingHuman
    && currentRuntime.noHumanSeconds >= Math.max(0, finite(squadDefeatGraceSeconds, 3))
  ) {
    return SURVIVAL_END_REASONS.SQUAD_DEFEATED;
  }
  return null;
}

export function survivalHudSnapshot(run, {
  bossKind = null,
  bossHp = 0,
  bossMaxHp = 0,
} = {}) {
  const current = normalizeSurvivalRun(run);
  if (!current) return null;
  const nextBossWave = Math.ceil(current.currentWave / SURVIVAL_BLOCK_WAVES) * SURVIVAL_BLOCK_WAVES;
  return {
    runId: current.runId,
    phase: current.phase,
    wave: current.currentWave,
    lastCompletedWave: current.lastCompletedWave,
    bossKills: current.stats.bossKills,
    nextBossWave,
    speed: current.speed,
    speedLocked: current.bossEntrancePending,
    crawlerHp: current.crawler.hp,
    crawlerMaxHp: current.crawler.maxHp,
    bossKind,
    bossHp: Math.max(0, finite(bossHp, 0)),
    bossMaxHp: Math.max(0, finite(bossMaxHp, 0)),
    pendingUpgradeChoices: [...current.pendingUpgradeChoices],
    upgradeStacks: { ...current.temporaryUpgradeStacks },
  };
}
