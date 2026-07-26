const SURVIVAL_MAX_SAFE_WAVE = 1_000_000;

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function clampInteger(value, minimum, maximum, fallback = minimum) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.floor(numeric)));
}

function uniqueStrings(value, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter((entry) => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean))]
    .slice(0, maximum);
}

function normalizedTimestamp(value, fallback = "") {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return fallback;
  return new Date(value).toISOString();
}

function normalizedId(value, label) {
  const id = typeof value === "string" ? value.trim() : "";
  if (!id) throw new TypeError(`${label} requires a stable ID`);
  return id.slice(0, 160);
}

function fnv1a32(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function normalizeEquipmentSnapshot(value) {
  const source = isRecord(value) ? value : {};
  const personalSource = isRecord(source.personalEquipmentByUnit)
    ? source.personalEquipmentByUnit
    : {};
  const personalEquipmentByUnit = Object.fromEntries(Object.entries(personalSource)
    .filter(([unitId]) => typeof unitId === "string" && unitId.trim())
    .map(([unitId, equipmentIds]) => [unitId.trim(), uniqueStrings(equipmentIds, 2)]));
  return {
    personalEquipmentByUnit,
    tacticalEquipmentIds: uniqueStrings(source.tacticalEquipmentIds, 2),
  };
}

function normalizeFormationSnapshot(value) {
  const source = isRecord(value) ? value : {};
  const equipment = normalizeEquipmentSnapshot(source);
  return {
    presetId: typeof source.presetId === "string" ? source.presetId.trim() : "",
    unitIds: uniqueStrings(source.unitIds, 7),
    ...equipment,
  };
}

function normalizeStatRecord(value) {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value)
    .filter(([unitId]) => typeof unitId === "string" && unitId.trim())
    .map(([unitId, amount]) => [
      unitId.trim(),
      clampInteger(amount, 0, Number.MAX_SAFE_INTEGER, 0),
    ])
    .filter(([, amount]) => amount > 0));
}

function addStatRecords(left, right) {
  const result = { ...normalizeStatRecord(left) };
  for (const [unitId, amount] of Object.entries(normalizeStatRecord(right))) {
    result[unitId] = Math.min(Number.MAX_SAFE_INTEGER, (result[unitId] ?? 0) + amount);
  }
  return result;
}

function normalizeRunStats(value) {
  const source = isRecord(value) ? value : {};
  return {
    kills: clampInteger(source.kills, 0, Number.MAX_SAFE_INTEGER, 0),
    bossKills: clampInteger(source.bossKills, 0, Number.MAX_SAFE_INTEGER, 0),
    damageByUnit: normalizeStatRecord(source.damageByUnit),
    damageTakenByUnit: normalizeStatRecord(source.damageTakenByUnit),
    healingByUnit: normalizeStatRecord(source.healingByUnit),
  };
}

function normalizeReward(value) {
  const source = isRecord(value) ? value : {};
  return {
    caps: clampInteger(source.caps, 0, Number.MAX_SAFE_INTEGER, 0),
    equipmentIds: uniqueStrings(source.equipmentIds),
  };
}

function addRewards(left, right) {
  const a = normalizeReward(left);
  const b = normalizeReward(right);
  return {
    caps: Math.min(Number.MAX_SAFE_INTEGER, a.caps + b.caps),
    equipmentIds: [...a.equipmentIds, ...b.equipmentIds],
  };
}

function normalizeUpgradeStacks(value) {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value)
    .filter(([upgradeId]) => SURVIVAL_UPGRADE_BY_ID[upgradeId])
    .map(([upgradeId, stacks]) => [
      upgradeId,
      clampInteger(stacks, 0, 999, 0),
    ])
    .filter(([, stacks]) => stacks > 0));
}

function checkpointRewardId(runId, checkpointWave) {
  return `survival:${runId}:checkpoint:${checkpointWave}`;
}

function partialRewardId(runId, lastCompletedWave) {
  return `survival:${runId}:partial:${lastCompletedWave}`;
}

export const SURVIVAL_PROGRESS_SCHEMA_VERSION = 1;
export const SURVIVAL_RUN_SCHEMA_VERSION = 1;
export const SURVIVAL_BLOCK_WAVES = 5;
export const SURVIVAL_START_SKIP_WAVES = 10;
export const SURVIVAL_SPEED_OPTIONS = deepFreeze([1, 2]);

export const SURVIVAL_RUN_PHASES = deepFreeze({
  WAVE_READY: "wave-ready",
  IN_WAVE: "in-wave",
  UPGRADE_SELECTION: "upgrade-selection",
  ENDED: "ended",
});

export const SURVIVAL_END_REASONS = deepFreeze({
  SQUAD_DEFEATED: "squad-defeated",
  CRAWLER_DESTROYED: "crawler-destroyed",
  WITHDRAWAL: "withdrawal",
});

export const SURVIVAL_UPGRADES = deepFreeze([
  {
    id: "assault-drill",
    displayName: "強襲教範",
    category: "attack",
    effectPerStack: 0.08,
  },
  {
    id: "layered-armor",
    displayName: "積層装甲",
    category: "defense",
    effectPerStack: 0.06,
  },
  {
    id: "field-triage",
    displayName: "野戦救護",
    category: "healing",
    effectPerStack: 0.1,
  },
  {
    id: "range-calibration",
    displayName: "射程較正",
    category: "range",
    effectPerStack: 0.06,
  },
  {
    id: "rapid-redeployment",
    displayName: "即応再出撃",
    category: "redeploy",
    effectPerStack: 0.08,
  },
  {
    id: "crawler-field-repair",
    displayName: "移動拠点応急修理",
    category: "crawler-repair",
    effectPerStack: 0.12,
  },
  {
    id: "boss-breaker",
    displayName: "大型個体破砕",
    category: "boss-damage",
    effectPerStack: 0.1,
  },
]);

export const SURVIVAL_UPGRADE_BY_ID = deepFreeze(Object.fromEntries(
  SURVIVAL_UPGRADES.map((upgrade) => [upgrade.id, upgrade]),
));

const LATE_START_UPGRADE_ORDER = deepFreeze([
  "assault-drill",
  "layered-armor",
  "field-triage",
  "rapid-redeployment",
  "range-calibration",
  "boss-breaker",
]);

export function survivalWaveDescriptor(waveNumber) {
  const wave = clampInteger(waveNumber, 1, SURVIVAL_MAX_SAFE_WAVE, 1);
  const blockNumber = Math.ceil(wave / SURVIVAL_BLOCK_WAVES);
  return {
    waveNumber: wave,
    blockNumber,
    waveInBlock: ((wave - 1) % SURVIVAL_BLOCK_WAVES) + 1,
    isBoss: wave % SURVIVAL_BLOCK_WAVES === 0,
    mapDamageTier: Math.floor((wave - 1) / SURVIVAL_START_SKIP_WAVES),
  };
}

export function survivalUnlockedStartWaves(highestCompletedWave) {
  const highest = clampInteger(highestCompletedWave, 0, SURVIVAL_MAX_SAFE_WAVE, 0);
  const starts = [1];
  for (
    let startWave = SURVIVAL_START_SKIP_WAVES + 1;
    startWave <= highest + 1;
    startWave += SURVIVAL_START_SKIP_WAVES
  ) {
    starts.push(startWave);
  }
  return starts;
}

export function survivalLateStartUpgradeStacks(startWave) {
  const start = clampInteger(startWave, 1, SURVIVAL_MAX_SAFE_WAVE, 1);
  const skippedBosses = Math.floor((start - 1) / SURVIVAL_BLOCK_WAVES);
  const stacks = {};
  for (let index = 0; index < skippedBosses; index += 1) {
    const upgradeId = LATE_START_UPGRADE_ORDER[index % LATE_START_UPGRADE_ORDER.length];
    stacks[upgradeId] = (stacks[upgradeId] ?? 0) + 1;
  }
  return stacks;
}

export function survivalUpgradeChoices(runId, checkpointWave) {
  const stableRunId = normalizedId(runId, "Survival upgrade choice");
  const wave = clampInteger(checkpointWave, SURVIVAL_BLOCK_WAVES, SURVIVAL_MAX_SAFE_WAVE, SURVIVAL_BLOCK_WAVES);
  const seed = fnv1a32(`${stableRunId}:${wave}`);
  const offset = seed % SURVIVAL_UPGRADES.length;
  const step = (Math.floor(seed / SURVIVAL_UPGRADES.length) % (SURVIVAL_UPGRADES.length - 1)) + 1;
  const choices = [];
  for (let index = 0; choices.length < 3; index += 1) {
    const upgradeId = SURVIVAL_UPGRADES[(offset + index * step) % SURVIVAL_UPGRADES.length].id;
    if (!choices.includes(upgradeId)) choices.push(upgradeId);
  }
  return choices;
}

function normalizeCheckpointReward(value, runId) {
  const source = isRecord(value) ? value : {};
  const checkpointWave = clampInteger(
    source.checkpointWave,
    SURVIVAL_BLOCK_WAVES,
    SURVIVAL_MAX_SAFE_WAVE,
    SURVIVAL_BLOCK_WAVES,
  );
  if (checkpointWave % SURVIVAL_BLOCK_WAVES !== 0) return null;
  return {
    rewardId: checkpointRewardId(runId, checkpointWave),
    checkpointWave,
    reward: normalizeReward(source.reward),
  };
}

export function normalizeSurvivalRun(value) {
  const source = isRecord(value) ? value : {};
  const runId = typeof source.runId === "string" ? source.runId.trim().slice(0, 160) : "";
  if (!runId) return null;
  const startWave = clampInteger(source.startWave, 1, SURVIVAL_MAX_SAFE_WAVE, 1);
  const normalizedStartWave = startWave === 1 || startWave % SURVIVAL_START_SKIP_WAVES === 1
    ? startWave
    : 1;
  const lastCompletedWave = clampInteger(
    source.lastCompletedWave,
    normalizedStartWave - 1,
    SURVIVAL_MAX_SAFE_WAVE,
    normalizedStartWave - 1,
  );
  const currentWave = clampInteger(
    source.currentWave,
    lastCompletedWave + 1,
    Math.min(SURVIVAL_MAX_SAFE_WAVE, lastCompletedWave + 1),
    lastCompletedWave + 1,
  );
  const phases = Object.values(SURVIVAL_RUN_PHASES);
  const phase = phases.includes(source.phase)
    ? source.phase
    : SURVIVAL_RUN_PHASES.WAVE_READY;
  const bossEntrancePending = phase === SURVIVAL_RUN_PHASES.IN_WAVE
    && survivalWaveDescriptor(currentWave).isBoss
    && source.bossEntrancePending === true;
  const crawlerMaxHp = clampInteger(source.crawler?.maxHp, 1, Number.MAX_SAFE_INTEGER, 700);
  const checkpointRewards = [];
  const rewardIds = new Set();
  for (const entry of Array.isArray(source.checkpointRewards) ? source.checkpointRewards : []) {
    const normalized = normalizeCheckpointReward(entry, runId);
    if (!normalized || normalized.checkpointWave > lastCompletedWave || rewardIds.has(normalized.rewardId)) continue;
    rewardIds.add(normalized.rewardId);
    checkpointRewards.push(normalized);
  }
  checkpointRewards.sort((a, b) => a.checkpointWave - b.checkpointWave);
  const storedUpgradeChoices = phase === SURVIVAL_RUN_PHASES.UPGRADE_SELECTION
    ? uniqueStrings(source.pendingUpgradeChoices, 3).filter((upgradeId) => SURVIVAL_UPGRADE_BY_ID[upgradeId])
    : [];
  const pendingUpgradeChoices = phase === SURVIVAL_RUN_PHASES.UPGRADE_SELECTION
    && storedUpgradeChoices.length !== 3
    ? survivalUpgradeChoices(runId, lastCompletedWave)
    : storedUpgradeChoices;
  return {
    schemaVersion: SURVIVAL_RUN_SCHEMA_VERSION,
    runId,
    startedAt: normalizedTimestamp(source.startedAt),
    updatedAt: normalizedTimestamp(source.updatedAt),
    phase,
    endReason: Object.values(SURVIVAL_END_REASONS).includes(source.endReason)
      ? source.endReason
      : null,
    startWave: normalizedStartWave,
    currentWave,
    lastCompletedWave,
    speed: bossEntrancePending
      ? 1
      : SURVIVAL_SPEED_OPTIONS.includes(Number(source.speed)) ? Number(source.speed) : 1,
    bossEntrancePending,
    formation: normalizeFormationSnapshot(source.formation),
    crawler: {
      hp: clampInteger(source.crawler?.hp, 0, crawlerMaxHp, crawlerMaxHp),
      maxHp: crawlerMaxHp,
    },
    temporaryUpgradeStacks: normalizeUpgradeStacks(source.temporaryUpgradeStacks),
    pendingUpgradeChoices,
    stats: normalizeRunStats(source.stats),
    checkpointRewards,
    pendingReward: normalizeReward(source.pendingReward),
  };
}

export function createSurvivalRun({
  runId,
  startedAt = new Date().toISOString(),
  startWave = 1,
  unlockedStartWaves = [1],
  formation = {},
  crawlerMaxHp = 700,
} = {}) {
  const stableRunId = normalizedId(runId, "Survival run");
  const requestedStartWave = clampInteger(startWave, 1, SURVIVAL_MAX_SAFE_WAVE, 1);
  const unlocked = (Array.isArray(unlockedStartWaves) ? unlockedStartWaves : [])
    .map(Number)
    .filter((wave) => Number.isInteger(wave) && (wave === 1 || wave % SURVIVAL_START_SKIP_WAVES === 1));
  const allowedStarts = survivalUnlockedStartWaves(
    Math.max(0, ...unlocked.map((wave) => wave - 1)),
  );
  if (!allowedStarts.includes(requestedStartWave)) {
    throw new RangeError(`Survival start wave is not unlocked: ${requestedStartWave}`);
  }
  const maxHp = clampInteger(crawlerMaxHp, 1, Number.MAX_SAFE_INTEGER, 700);
  return {
    schemaVersion: SURVIVAL_RUN_SCHEMA_VERSION,
    runId: stableRunId,
    startedAt: normalizedTimestamp(startedAt, new Date().toISOString()),
    updatedAt: normalizedTimestamp(startedAt, new Date().toISOString()),
    phase: SURVIVAL_RUN_PHASES.WAVE_READY,
    endReason: null,
    startWave: requestedStartWave,
    currentWave: requestedStartWave,
    lastCompletedWave: requestedStartWave - 1,
    speed: 1,
    bossEntrancePending: false,
    formation: normalizeFormationSnapshot(formation),
    crawler: { hp: maxHp, maxHp },
    temporaryUpgradeStacks: survivalLateStartUpgradeStacks(requestedStartWave),
    pendingUpgradeChoices: [],
    stats: normalizeRunStats(null),
    checkpointRewards: [],
    pendingReward: normalizeReward(null),
  };
}

export function beginSurvivalWave(run) {
  const current = normalizeSurvivalRun(run);
  if (!current || current.phase !== SURVIVAL_RUN_PHASES.WAVE_READY) return current;
  const bossEntrancePending = survivalWaveDescriptor(current.currentWave).isBoss;
  return {
    ...current,
    phase: SURVIVAL_RUN_PHASES.IN_WAVE,
    speed: bossEntrancePending ? 1 : current.speed,
    bossEntrancePending,
  };
}

export function completeSurvivalBossEntrance(run) {
  const current = normalizeSurvivalRun(run);
  if (!current || current.phase !== SURVIVAL_RUN_PHASES.IN_WAVE || !current.bossEntrancePending) return current;
  return { ...current, bossEntrancePending: false };
}

export function setSurvivalRunSpeed(run, speed) {
  const current = normalizeSurvivalRun(run);
  const requested = Number(speed);
  if (!current
    || current.phase !== SURVIVAL_RUN_PHASES.IN_WAVE
    || !SURVIVAL_SPEED_OPTIONS.includes(requested)
    || (requested === 2 && current.bossEntrancePending)) {
    return current;
  }
  return current.speed === requested ? current : { ...current, speed: requested };
}

export function completeSurvivalWave(run, {
  kills = 0,
  bossKills,
  damageByUnit = {},
  damageTakenByUnit = {},
  healingByUnit = {},
  crawlerHp,
  reward = {},
} = {}) {
  const current = normalizeSurvivalRun(run);
  if (!current || current.phase !== SURVIVAL_RUN_PHASES.IN_WAVE) return current;
  const descriptor = survivalWaveDescriptor(current.currentWave);
  const waveBossKills = clampInteger(
    bossKills,
    0,
    1,
    descriptor.isBoss ? 1 : 0,
  );
  if (descriptor.isBoss && waveBossKills < 1) return current;
  const stats = {
    kills: Math.min(Number.MAX_SAFE_INTEGER, current.stats.kills + clampInteger(kills, 0, Number.MAX_SAFE_INTEGER, 0)),
    bossKills: Math.min(Number.MAX_SAFE_INTEGER, current.stats.bossKills + waveBossKills),
    damageByUnit: addStatRecords(current.stats.damageByUnit, damageByUnit),
    damageTakenByUnit: addStatRecords(current.stats.damageTakenByUnit, damageTakenByUnit),
    healingByUnit: addStatRecords(current.stats.healingByUnit, healingByUnit),
  };
  const pendingReward = addRewards(current.pendingReward, reward);
  const completed = {
    ...current,
    phase: descriptor.isBoss
      ? SURVIVAL_RUN_PHASES.UPGRADE_SELECTION
      : SURVIVAL_RUN_PHASES.WAVE_READY,
    currentWave: Math.min(SURVIVAL_MAX_SAFE_WAVE, current.currentWave + 1),
    lastCompletedWave: current.currentWave,
    speed: descriptor.isBoss ? 1 : current.speed,
    bossEntrancePending: false,
    crawler: {
      ...current.crawler,
      hp: clampInteger(crawlerHp, 0, current.crawler.maxHp, current.crawler.hp),
    },
    pendingUpgradeChoices: descriptor.isBoss
      ? survivalUpgradeChoices(current.runId, current.currentWave)
      : [],
    stats,
  };
  if (!descriptor.isBoss) return { ...completed, pendingReward };
  return {
    ...completed,
    checkpointRewards: [
      ...current.checkpointRewards,
      {
        rewardId: checkpointRewardId(current.runId, current.currentWave),
        checkpointWave: current.currentWave,
        reward: pendingReward,
      },
    ],
    pendingReward: normalizeReward(null),
  };
}

export function selectSurvivalUpgrade(run, upgradeId) {
  const current = normalizeSurvivalRun(run);
  if (!current
    || current.phase !== SURVIVAL_RUN_PHASES.UPGRADE_SELECTION
    || !current.pendingUpgradeChoices.includes(upgradeId)
    || !SURVIVAL_UPGRADE_BY_ID[upgradeId]) {
    return current;
  }
  const temporaryUpgradeStacks = {
    ...current.temporaryUpgradeStacks,
    [upgradeId]: (current.temporaryUpgradeStacks[upgradeId] ?? 0) + 1,
  };
  const definition = SURVIVAL_UPGRADE_BY_ID[upgradeId];
  const repair = definition.category === "crawler-repair"
    ? Math.max(1, Math.round(current.crawler.maxHp * definition.effectPerStack))
    : 0;
  return {
    ...current,
    phase: SURVIVAL_RUN_PHASES.WAVE_READY,
    pendingUpgradeChoices: [],
    temporaryUpgradeStacks,
    crawler: {
      ...current.crawler,
      hp: Math.min(current.crawler.maxHp, current.crawler.hp + repair),
    },
  };
}

export function createSurvivalCheckpoint(run, savedAt = new Date().toISOString()) {
  const current = normalizeSurvivalRun(run);
  if (!current
    || current.phase === SURVIVAL_RUN_PHASES.IN_WAVE
    || current.phase === SURVIVAL_RUN_PHASES.ENDED
    || current.lastCompletedWave < SURVIVAL_BLOCK_WAVES
    || current.lastCompletedWave % SURVIVAL_BLOCK_WAVES !== 0) {
    return null;
  }
  return {
    checkpointId: `survival:${current.runId}:wave:${current.lastCompletedWave}`,
    checkpointWave: current.lastCompletedWave,
    savedAt: normalizedTimestamp(savedAt, new Date().toISOString()),
    run: current,
  };
}

function normalizeSurvivalCheckpoint(value) {
  const source = isRecord(value) ? value : {};
  const run = normalizeSurvivalRun(source.run);
  if (!run) return null;
  const checkpoint = createSurvivalCheckpoint(run, source.savedAt);
  if (!checkpoint || Number(source.checkpointWave) !== checkpoint.checkpointWave) return null;
  return checkpoint;
}

function normalizeLastResult(value) {
  const source = isRecord(value) ? value : {};
  const runId = typeof source.runId === "string" ? source.runId.trim() : "";
  if (!runId) return null;
  return {
    runId,
    endReason: Object.values(SURVIVAL_END_REASONS).includes(source.endReason)
      ? source.endReason
      : SURVIVAL_END_REASONS.WITHDRAWAL,
    startWave: clampInteger(source.startWave, 1, SURVIVAL_MAX_SAFE_WAVE, 1),
    reachedWave: clampInteger(source.reachedWave, 0, SURVIVAL_MAX_SAFE_WAVE, 0),
    stats: normalizeRunStats(source.stats),
    formation: normalizeFormationSnapshot(source.formation),
    earnedCaps: clampInteger(source.earnedCaps, 0, Number.MAX_SAFE_INTEGER, 0),
    earnedEquipmentIds: uniqueStrings(source.earnedEquipmentIds),
    newHighestWave: source.newHighestWave === true,
    endedAt: normalizedTimestamp(source.endedAt),
  };
}

export function createDefaultSurvivalProgress() {
  return {
    schemaVersion: SURVIVAL_PROGRESS_SCHEMA_VERSION,
    highestWave: 0,
    highestKills: 0,
    highestBossKills: 0,
    totalRuns: 0,
    totalKills: 0,
    totalBossKills: 0,
    unlockedStartWaves: [1],
    processedRunIds: [],
    claimedRewardIds: [],
    activeCheckpoint: null,
    lastResult: null,
  };
}

export function normalizeSurvivalProgress(value) {
  const source = isRecord(value) ? value : {};
  const activeCheckpoint = normalizeSurvivalCheckpoint(source.activeCheckpoint);
  const highestWave = Math.max(
    clampInteger(source.highestWave, 0, SURVIVAL_MAX_SAFE_WAVE, 0),
    activeCheckpoint?.checkpointWave ?? 0,
  );
  return {
    schemaVersion: SURVIVAL_PROGRESS_SCHEMA_VERSION,
    highestWave,
    highestKills: clampInteger(source.highestKills, 0, Number.MAX_SAFE_INTEGER, 0),
    highestBossKills: clampInteger(source.highestBossKills, 0, Number.MAX_SAFE_INTEGER, 0),
    totalRuns: clampInteger(source.totalRuns, 0, Number.MAX_SAFE_INTEGER, 0),
    totalKills: clampInteger(source.totalKills, 0, Number.MAX_SAFE_INTEGER, 0),
    totalBossKills: clampInteger(source.totalBossKills, 0, Number.MAX_SAFE_INTEGER, 0),
    unlockedStartWaves: survivalUnlockedStartWaves(highestWave),
    processedRunIds: uniqueStrings(source.processedRunIds),
    claimedRewardIds: uniqueStrings(source.claimedRewardIds),
    activeCheckpoint,
    lastResult: normalizeLastResult(source.lastResult),
  };
}

export function saveSurvivalCheckpoint(progress, run, savedAt = new Date().toISOString()) {
  const current = normalizeSurvivalProgress(progress);
  const activeCheckpoint = createSurvivalCheckpoint(run, savedAt);
  if (!activeCheckpoint) return current;
  const highestWave = Math.max(current.highestWave, activeCheckpoint.checkpointWave);
  return {
    ...current,
    highestWave,
    unlockedStartWaves: survivalUnlockedStartWaves(highestWave),
    activeCheckpoint,
  };
}

export function resumeSurvivalCheckpoint(progress) {
  const current = normalizeSurvivalProgress(progress);
  return current.activeCheckpoint
    ? normalizeSurvivalRun(current.activeCheckpoint.run)
    : null;
}

export function endSurvivalRun(run, reason, endedAt = new Date().toISOString()) {
  const current = normalizeSurvivalRun(run);
  if (!current || !Object.values(SURVIVAL_END_REASONS).includes(reason)) return current;
  return {
    ...current,
    phase: SURVIVAL_RUN_PHASES.ENDED,
    endReason: reason,
    speed: 1,
    bossEntrancePending: false,
    pendingUpgradeChoices: [],
    updatedAt: normalizedTimestamp(endedAt, new Date().toISOString()),
  };
}

export function settleSurvivalRun(progress, run, { endedAt = new Date().toISOString() } = {}) {
  const current = normalizeSurvivalProgress(progress);
  const endedRun = normalizeSurvivalRun(run);
  if (!endedRun
    || endedRun.phase !== SURVIVAL_RUN_PHASES.ENDED
    || !endedRun.endReason
    || current.processedRunIds.includes(endedRun.runId)) {
    return {
      progress: current,
      payout: { caps: 0, equipmentIds: [], rewardIds: [] },
      duplicate: Boolean(endedRun && current.processedRunIds.includes(endedRun.runId)),
    };
  }
  const rewardEntries = [...endedRun.checkpointRewards];
  const lastCheckpointWave = Math.floor(endedRun.lastCompletedWave / SURVIVAL_BLOCK_WAVES) * SURVIVAL_BLOCK_WAVES;
  if (endedRun.lastCompletedWave > lastCheckpointWave) {
    rewardEntries.push({
      rewardId: partialRewardId(endedRun.runId, endedRun.lastCompletedWave),
      checkpointWave: endedRun.lastCompletedWave,
      reward: endedRun.pendingReward,
    });
  }
  const payable = rewardEntries.filter(({ rewardId }) => !current.claimedRewardIds.includes(rewardId));
  const payout = payable.reduce((total, entry) => addRewards(total, entry.reward), normalizeReward(null));
  const rewardIds = payable.map(({ rewardId }) => rewardId);
  const newHighestWave = endedRun.lastCompletedWave > current.highestWave;
  const highestWave = Math.max(current.highestWave, endedRun.lastCompletedWave);
  const nextProgress = {
    ...current,
    highestWave,
    highestKills: Math.max(current.highestKills, endedRun.stats.kills),
    highestBossKills: Math.max(current.highestBossKills, endedRun.stats.bossKills),
    totalRuns: Math.min(Number.MAX_SAFE_INTEGER, current.totalRuns + 1),
    totalKills: Math.min(Number.MAX_SAFE_INTEGER, current.totalKills + endedRun.stats.kills),
    totalBossKills: Math.min(Number.MAX_SAFE_INTEGER, current.totalBossKills + endedRun.stats.bossKills),
    unlockedStartWaves: survivalUnlockedStartWaves(highestWave),
    processedRunIds: [...current.processedRunIds, endedRun.runId],
    claimedRewardIds: [...new Set([...current.claimedRewardIds, ...rewardIds])],
    activeCheckpoint: current.activeCheckpoint?.run.runId === endedRun.runId
      ? null
      : current.activeCheckpoint,
    lastResult: {
      runId: endedRun.runId,
      endReason: endedRun.endReason,
      startWave: endedRun.startWave,
      reachedWave: endedRun.lastCompletedWave,
      stats: endedRun.stats,
      formation: endedRun.formation,
      earnedCaps: payout.caps,
      earnedEquipmentIds: payout.equipmentIds,
      newHighestWave,
      endedAt: normalizedTimestamp(endedAt, endedRun.updatedAt),
    },
  };
  return {
    progress: nextProgress,
    payout: { ...payout, rewardIds },
    duplicate: false,
  };
}
