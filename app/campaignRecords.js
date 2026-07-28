const MAX_RECENT_RESULTS = 24;

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function safeKey(value) {
  const key = typeof value === "string" ? value.trim().slice(0, 160) : "";
  if (!key || key === "prototype" || Object.hasOwn(Object.prototype, key)) return "";
  return key;
}

function clampInteger(value, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return minimum;
  return Math.max(minimum, Math.min(maximum, Math.floor(numeric)));
}

function normalizedTimestamp(value, fallback = "") {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return fallback;
  return new Date(value).toISOString();
}

function uniqueStrings(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(safeKey).filter(Boolean))];
}

function normalizeCountRecord(value) {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value)
    .map(([key, amount]) => [safeKey(key), clampInteger(amount)])
    .filter(([key, amount]) => key && amount > 0)
    .sort(([left], [right]) => left.localeCompare(right)));
}

function addCountRecords(left, right) {
  const total = { ...normalizeCountRecord(left) };
  for (const [key, amount] of Object.entries(normalizeCountRecord(right))) {
    total[key] = Math.min(Number.MAX_SAFE_INTEGER, (total[key] ?? 0) + amount);
  }
  return total;
}

function normalizeEncounterRecord(value) {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).flatMap(([enemyKind, entry]) => {
    const kind = safeKey(enemyKind);
    if (!kind || !isRecord(entry)) return [];
    const firstOperationId = safeKey(entry.firstOperationId);
    const firstEncounteredAt = normalizedTimestamp(entry.firstEncounteredAt);
    const encounterCount = clampInteger(entry.encounterCount);
    if (!firstOperationId || encounterCount < 1) return [];
    return [[kind, {
      firstOperationId,
      firstEncounteredAt,
      encounterCount,
    }]];
  }).sort(([left], [right]) => left.localeCompare(right)));
}

function normalizeUnitStats(value) {
  const source = isRecord(value) ? value : {};
  return {
    damageByUnit: normalizeCountRecord(source.damageByUnit),
    damageTakenByUnit: normalizeCountRecord(source.damageTakenByUnit),
    healingByUnit: normalizeCountRecord(source.healingByUnit),
  };
}

function normalizeRecentResult(value) {
  if (!isRecord(value)) return null;
  const resultId = safeKey(value.resultId);
  const operationId = safeKey(value.operationId);
  if (!resultId || !operationId) return null;
  const category = ["campaign", "survival", "outbreak"].includes(value.category)
    ? value.category
    : "campaign";
  const outcome = ["won", "lost", "withdrawn"].includes(value.outcome)
    ? value.outcome
    : "lost";
  return {
    resultId,
    operationId,
    category,
    outcome,
    battleSeconds: clampInteger(value.battleSeconds),
    kills: clampInteger(value.kills),
    bossKills: clampInteger(value.bossKills),
    unitsLost: clampInteger(value.unitsLost),
    reachedWave: clampInteger(value.reachedWave),
    capsEarned: clampInteger(value.capsEarned),
    completedAt: normalizedTimestamp(value.completedAt),
  };
}

export const CAMPAIGN_RECORDS_SCHEMA_VERSION = 1;

export function createDefaultCampaignRecords() {
  return {
    schemaVersion: CAMPAIGN_RECORDS_SCHEMA_VERSION,
    processedRecordIds: [],
    encountersByEnemy: {},
    defeatCountsByEnemy: {},
    totals: {
      battles: 0,
      victories: 0,
      defeats: 0,
      withdrawals: 0,
      battleSeconds: 0,
      kills: 0,
      bossKills: 0,
      unitsLost: 0,
      capsEarned: 0,
    },
    unitStats: normalizeUnitStats(null),
    recentResults: [],
    lastResult: null,
  };
}

export function normalizeCampaignRecords(value) {
  const source = isRecord(value) ? value : {};
  const totals = isRecord(source.totals) ? source.totals : {};
  const recentResults = Array.isArray(source.recentResults)
    ? source.recentResults.map(normalizeRecentResult).filter(Boolean).slice(-MAX_RECENT_RESULTS)
    : [];
  const lastResult = normalizeRecentResult(source.lastResult) ?? recentResults.at(-1) ?? null;
  return {
    schemaVersion: CAMPAIGN_RECORDS_SCHEMA_VERSION,
    processedRecordIds: uniqueStrings(source.processedRecordIds),
    encountersByEnemy: normalizeEncounterRecord(source.encountersByEnemy),
    defeatCountsByEnemy: normalizeCountRecord(source.defeatCountsByEnemy),
    totals: {
      battles: clampInteger(totals.battles),
      victories: clampInteger(totals.victories),
      defeats: clampInteger(totals.defeats),
      withdrawals: clampInteger(totals.withdrawals),
      battleSeconds: clampInteger(totals.battleSeconds),
      kills: clampInteger(totals.kills),
      bossKills: clampInteger(totals.bossKills),
      unitsLost: clampInteger(totals.unitsLost),
      capsEarned: clampInteger(totals.capsEarned),
    },
    unitStats: normalizeUnitStats(source.unitStats),
    recentResults,
    lastResult,
  };
}

export function recordCampaignOperation(records, input = {}) {
  const current = normalizeCampaignRecords(records);
  const resultId = safeKey(input.resultId);
  const operationId = safeKey(input.operationId);
  if (!resultId || !operationId || current.processedRecordIds.includes(resultId)) return current;
  const category = ["campaign", "survival", "outbreak"].includes(input.category)
    ? input.category
    : "campaign";
  const outcome = input.outcome === "withdrawn"
    ? "withdrawn"
    : input.won === true || input.outcome === "won"
      ? "won"
      : "lost";
  const encounteredEnemyKinds = uniqueStrings(input.encounteredEnemyKinds);
  const enemyDefeatsByKind = normalizeCountRecord(input.enemyDefeatsByKind);
  const completedAt = normalizedTimestamp(input.completedAt);
  const encountersByEnemy = { ...current.encountersByEnemy };
  for (const enemyKind of encounteredEnemyKinds) {
    const previous = encountersByEnemy[enemyKind];
    encountersByEnemy[enemyKind] = previous
      ? {
        ...previous,
        encounterCount: Math.min(Number.MAX_SAFE_INTEGER, previous.encounterCount + 1),
      }
      : {
        firstOperationId: operationId,
        firstEncounteredAt: completedAt,
        encounterCount: 1,
      };
  }
  const result = normalizeRecentResult({
    resultId,
    operationId,
    category,
    outcome,
    battleSeconds: input.battleSeconds,
    kills: input.kills,
    bossKills: input.bossKills,
    unitsLost: input.unitsLost,
    reachedWave: input.reachedWave,
    capsEarned: input.capsEarned,
    completedAt,
  });
  const battleSeconds = clampInteger(input.battleSeconds);
  const kills = clampInteger(input.kills);
  const bossKills = clampInteger(input.bossKills);
  const unitsLost = clampInteger(input.unitsLost);
  const capsEarned = clampInteger(input.capsEarned);
  const unitStats = normalizeUnitStats(input.unitStats);
  return normalizeCampaignRecords({
    ...current,
    processedRecordIds: [...current.processedRecordIds, resultId],
    encountersByEnemy,
    defeatCountsByEnemy: addCountRecords(current.defeatCountsByEnemy, enemyDefeatsByKind),
    totals: {
      battles: Math.min(Number.MAX_SAFE_INTEGER, current.totals.battles + 1),
      victories: Math.min(Number.MAX_SAFE_INTEGER, current.totals.victories + (outcome === "won" ? 1 : 0)),
      defeats: Math.min(Number.MAX_SAFE_INTEGER, current.totals.defeats + (outcome === "lost" ? 1 : 0)),
      withdrawals: Math.min(Number.MAX_SAFE_INTEGER, current.totals.withdrawals + (outcome === "withdrawn" ? 1 : 0)),
      battleSeconds: Math.min(Number.MAX_SAFE_INTEGER, current.totals.battleSeconds + battleSeconds),
      kills: Math.min(Number.MAX_SAFE_INTEGER, current.totals.kills + kills),
      bossKills: Math.min(Number.MAX_SAFE_INTEGER, current.totals.bossKills + bossKills),
      unitsLost: Math.min(Number.MAX_SAFE_INTEGER, current.totals.unitsLost + unitsLost),
      capsEarned: Math.min(Number.MAX_SAFE_INTEGER, current.totals.capsEarned + capsEarned),
    },
    unitStats: {
      damageByUnit: addCountRecords(current.unitStats.damageByUnit, unitStats.damageByUnit),
      damageTakenByUnit: addCountRecords(current.unitStats.damageTakenByUnit, unitStats.damageTakenByUnit),
      healingByUnit: addCountRecords(current.unitStats.healingByUnit, unitStats.healingByUnit),
    },
    recentResults: [...current.recentResults, result].filter(Boolean).slice(-MAX_RECENT_RESULTS),
    lastResult: result,
  });
}
