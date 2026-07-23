import {
  CAMPAIGN_FORMATION_MAX_SLOTS,
  CAMPAIGN_STAGE_BY_ID,
  CAMPAIGN_STAGE_IDS,
  CAMPAIGN_STAGES,
} from "./campaign.js";
import {
  BARRICADE_MAX_HP,
  COMMAND_INITIAL,
  COMMAND_MAX,
  COMMAND_REGEN,
  PREP_SECONDS,
  UNIT_CARDS,
  enemySpawnInterval,
  structureDamageMultiplier,
} from "./gameRules.js";
import {
  ENEMY_CONTENT_BY_ID,
  enemyBalanceStatsForWave as contentEnemyBalanceStatsForWave,
} from "./content/enemyCatalog.js";
import { UNIT_ROLE_TUNING } from "./unitRoleMechanics.js";
import {
  STATION_MISSION_TYPES,
  advanceStationMissionRuntime,
  createStationMissionRuntime,
  stationMissionOutcome,
} from "./stationStageMechanics.js";

const freeze = (value) => Object.freeze(value);
const UNIT_BY_KIND = freeze(Object.fromEntries(UNIT_CARDS.map((card) => [card.kind, card])));
const LANE_COUNT = 3;
const SIMULATION_STEP_SECONDS = 1;
const ENEMY_APPROACH_DISTANCE = 520;
const CONTACT_PROGRESS = 0.58;
const OBJECTIVE_DANGER_PROGRESS = 0.82;
const STRUCTURE_DAMAGE_START_DELAY = 0;

// Compatibility projection for existing balance callers. Runtime and simulation
// now consume the same canonical enemy records.
export const STAGE_BALANCE_ENEMY_PROFILES = ENEMY_CONTENT_BY_ID;

const ALL_STAGE_FORMATIONS = freeze({
  early: freeze(["scout", "ranger", "brawler", "medic", "kumaverson", "babayaga"]),
  middle: freeze(["scout", "ranger", "brute", "brawler", "medic", "crazy-king", "kumaverson"]),
  late: freeze(["scout", "ranger", "brute", "brawler", "gunner", "medic", "babayaga"]),
});

/**
 * Three successful, deliberately non-identical formations for each P4 stage.
 * Their empty intersection is checked by the test suite; no character is a
 * hidden mandatory pick.
 */
export const P4_BALANCE_FORMATIONS = freeze({
  [CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_GATE]: freeze([
    freeze(["scout", "ranger", "brute", "brawler", "medic"]),
    freeze(["gunner", "crazy-king", "kumaverson", "babayaga", "scout"]),
    freeze(["ranger", "brute", "medic", "gunner", "crazy-king", "kumaverson", "babayaga"]),
  ]),
  [CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_PLATFORM]: freeze([
    freeze(["guardian", "ranger", "gunner", "medic", "scout"]),
    freeze(["brute", "crazy-king", "brawler", "kumaverson", "babayaga"]),
    freeze(["guardian", "brute", "ranger", "babayaga", "scout", "crazy-king"]),
  ]),
  [CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_TUNNEL]: freeze([
    freeze(["guardian", "ranger", "gunner", "medic", "scout"]),
    freeze(["brute", "crazy-king", "brawler", "kumaverson", "babayaga"]),
    freeze(["guardian", "brute", "ranger", "babayaga", "scout", "crazy-king"]),
  ]),
});

export const STAGE_BALANCE_REFERENCE_FORMATIONS = freeze({
  [CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET]: ALL_STAGE_FORMATIONS.early,
  [CAMPAIGN_STAGE_IDS.SAWARA_WARD_OFFICE]: ALL_STAGE_FORMATIONS.middle,
  [CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE]: ALL_STAGE_FORMATIONS.late,
  ...Object.fromEntries(Object.entries(P4_BALANCE_FORMATIONS).map(([stageId, formations]) => (
    [stageId, formations[0]]
  ))),
});

function hashSeed(value) {
  const text = String(value ?? "stage-balance");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let state = hashSeed(seed) || 0x9e3779b9;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function normalizeFormation(formation) {
  if (!Array.isArray(formation) || formation.length < 1) {
    throw new RangeError("Formation must contain at least one unit");
  }
  if (formation.length > CAMPAIGN_FORMATION_MAX_SLOTS) {
    throw new RangeError(`Formation exceeds ${CAMPAIGN_FORMATION_MAX_SLOTS} slots`);
  }
  const normalized = formation.map((kind) => String(kind));
  if (new Set(normalized).size !== normalized.length) {
    throw new RangeError("Formation cannot contain duplicate unit kinds");
  }
  for (const kind of normalized) {
    if (!UNIT_BY_KIND[kind]) throw new RangeError(`Unknown unit kind: ${kind}`);
  }
  return normalized;
}

function resolveStage(stageId) {
  const stage = typeof stageId === "number"
    ? CAMPAIGN_STAGES.find((candidate) => candidate.stageNumber === stageId)
    : CAMPAIGN_STAGE_BY_ID[stageId];
  if (!stage) throw new RangeError(`Unknown campaign stage: ${String(stageId)}`);
  return stage;
}

function unitsForWave(wave) {
  if (Array.isArray(wave.units)) {
    return wave.units.map(([kind, lane]) => ({ kind, lane }));
  }
  return (wave.groups ?? []).flatMap((group) => (
    Array.from({ length: group.count }, (_, index) => ({
      kind: group.kind,
      lane: group.lanes[index % group.lanes.length],
    }))
  ));
}

function enemyStatsForWave(kind, waveNumber) {
  return contentEnemyBalanceStatsForWave(kind, waveNumber);
}

export function stageBalanceWaveFacts(stageId) {
  const stage = resolveStage(stageId);
  const waves = stage.waves.map((wave, index) => {
    const units = unitsForWave(wave);
    return freeze({
      id: wave.id,
      waveNumber: wave.waveNumber ?? index + 1,
      atSeconds: PREP_SECONDS + wave.atSeconds,
      unitCount: units.length,
      enemyKinds: freeze([...new Set(units.map(({ kind }) => kind))].sort()),
      lanes: freeze([...new Set(units.map(({ lane }) => lane))].sort()),
    });
  });
  return freeze({
    stageId: stage.id,
    stageNumber: stage.stageNumber,
    missionType: stage.missionType,
    waveCount: waves.length,
    enemyCount: waves.reduce((total, wave) => total + wave.unitCount, 0),
    enemyKinds: freeze([...new Set(waves.flatMap((wave) => wave.enemyKinds))].sort()),
    firstWaveAtSeconds: waves[0]?.atSeconds ?? null,
    lastWaveAtSeconds: waves.at(-1)?.atSeconds ?? null,
    waves: freeze(waves),
  });
}

function roleCounterMultiplier(kind, enemyKind, laneEnemyCount, enabled) {
  if (!enabled) return 1;
  if (kind === "scout" && ["runner", "shade", "sprinter"].includes(enemyKind)) return 1.65;
  if (kind === "ranger" && ["spitter", "ooze", "grappler", "takuya", "gate-eater"].includes(enemyKind)) return 1.42;
  if (kind === "brute") {
    if (enemyKind === "gate-eater") return UNIT_ROLE_TUNING.tatara.armoredMultiplier;
    if (["crusher", "abomination", "takuya"].includes(enemyKind)) return UNIT_ROLE_TUNING.tatara.heavyMultiplier;
  }
  if (kind === "gunner") {
    const penetration = Math.min(UNIT_ROLE_TUNING.raider.penetrationLimit, Math.max(1, laneEnemyCount));
    return (0.82 + Math.min(0.48, (penetration - 1) * 0.12))
      * (["runner", "sprinter"].includes(enemyKind) ? 1.12 : 1);
  }
  if (kind === "crazy-king") {
    const crowded = laneEnemyCount >= 3;
    const momentum = 1 / UNIT_ROLE_TUNING.crazyKing.tiers[2].cadenceMultiplier;
    return crowded ? Math.min(1.55, momentum * 1.28) : 1.06;
  }
  if (kind === "kumaverson" && ["crusher", "abomination", "grappler", "gate-eater"].includes(enemyKind)) return 1.24;
  if (kind === "babayaga" && enemyKind !== "walker") return 1.4;
  if (kind === "guardian" && ["grappler", "sprinter", "gate-eater"].includes(enemyKind)) return 1.16;
  if (kind === "engineer" && ["runner", "sprinter", "ooze"].includes(enemyKind)) return 1.52;
  if (kind === "brawler") return 1.06;
  return 1;
}

function defensiveMultiplier(activeUnits, roleCounters) {
  if (!roleCounters) return 1;
  const kinds = new Set(activeUnits.map(({ kind }) => kind));
  let multiplier = 1;
  if (kinds.has("medic")) multiplier *= 1 - UNIT_ROLE_TUNING.nao.damageReduction * 0.72;
  if (kinds.has("guardian")) multiplier *= 1 - UNIT_ROLE_TUNING.gantetsu.interceptRatio * 0.58;
  if (kinds.has("kumaverson")) multiplier *= 0.88;
  if (kinds.has("engineer")) multiplier *= 0.92;
  return multiplier;
}

function healingPerSecond(activeUnits, roleCounters) {
  if (!roleCounters) return 0;
  const naoCount = activeUnits.filter(({ kind }) => kind === "medic").length;
  return naoCount * UNIT_ROLE_TUNING.nao.baseHealing * 0.3;
}

function missionTimeLimit(stage, facts) {
  if (stage.missionType === "timed-defense") {
    return PREP_SECONDS + stage.objectiveConfig.durationSeconds;
  }
  if (stage.missionType === STATION_MISSION_TYPES.ESCORT) {
    return Math.max(240, facts.lastWaveAtSeconds + 70);
  }
  if (stage.missionType === STATION_MISSION_TYPES.SEQUENTIAL_SEAL) {
    return Math.max(300, facts.lastWaveAtSeconds + stage.objectiveConfig.escapeSeconds + 70);
  }
  return Math.max(220, facts.lastWaveAtSeconds + 90);
}

function laneThreatScore(enemies, lane) {
  return enemies
    .filter((enemy) => enemy.lane === lane && enemy.hp > 0)
    .reduce((total, enemy) => (
      total + enemy.hp * (0.68 + enemy.progress * 0.72) * enemy.stats.abilityPressure
    ), 0);
}

function chooseLaneForUnit({ unit, enemies, assignedPerLane, random, roleCounters }) {
  let bestLane = 0;
  let bestScore = -Infinity;
  for (let lane = 0; lane < LANE_COUNT; lane += 1) {
    const candidates = enemies.filter((enemy) => enemy.lane === lane && enemy.hp > 0);
    const specialization = candidates.length === 0
      ? 1
      : Math.max(...candidates.map((enemy) => (
        roleCounterMultiplier(unit.kind, enemy.kind, candidates.length, roleCounters)
      )));
    const score = laneThreatScore(enemies, lane)
      * specialization
      / (1 + assignedPerLane[lane] * 0.62)
      + random() * 0.0001;
    if (score > bestScore) {
      bestScore = score;
      bestLane = lane;
    }
  }
  return bestLane;
}

function chooseEnemyForUnit(unit, lane, enemies, roleCounters) {
  const laneEnemies = enemies.filter((enemy) => enemy.lane === lane && enemy.hp > 0);
  return laneEnemies
    .map((enemy) => ({
      enemy,
      score: enemy.progress * 380
        + enemy.stats.abilityPressure * 70
        + roleCounterMultiplier(unit.kind, enemy.kind, laneEnemies.length, roleCounters) * 45
        + (enemy.kind === "gate-eater" || enemy.kind === "takuya" ? 35 : 0),
    }))
    .sort((first, second) => second.score - first.score || first.enemy.id.localeCompare(second.enemy.id))[0]?.enemy ?? null;
}

function objectiveDamageForEnemy(enemy) {
  const breachUrgency = 0.38 + Math.min(0.38, Math.max(0, enemy.progress - 1) * 0.12);
  return enemy.stats.dps * enemy.stats.abilityPressure * breachUrgency;
}

function deploymentOrder(formation, random) {
  return [...formation]
    .map((kind) => ({ kind, tie: random() }))
    .sort((first, second) => (
      UNIT_BY_KIND[first.kind].cost - UNIT_BY_KIND[second.kind].cost
      || first.tie - second.tie
      || first.kind.localeCompare(second.kind)
    ))
    .map(({ kind }) => kind);
}

function publicEnemy(enemy) {
  return freeze({
    id: enemy.id,
    kind: enemy.kind,
    lane: enemy.lane,
    waveNumber: enemy.waveNumber,
    hp: Math.max(0, Number(enemy.hp.toFixed(3))),
    progress: Number(enemy.progress.toFixed(4)),
  });
}

/**
 * A deterministic coarse combat simulation for balance gates. It does not
 * duplicate rendering or animation. Instead it projects canonical campaign
 * waves through the live command economy, unit stats, role counters, lane
 * pressure, Crawler HP and the shared station objective state machines.
 */
export function simulateStageBalance({
  stageId,
  formation,
  seed = "stage-balance-v070",
  roleCounters = true,
} = {}) {
  const stage = resolveStage(stageId);
  const normalizedFormation = normalizeFormation(formation);
  const facts = stageBalanceWaveFacts(stage.id);
  const random = seededRandom(`${seed}:${stage.id}:${normalizedFormation.join(",")}`);
  const order = deploymentOrder(normalizedFormation, random);
  const deploymentQueue = [...order];
  const activeUnits = [];
  const deploymentLog = [];
  const enemies = [];
  const defeatedKinds = new Set();
  const spawnedKinds = new Set();
  const spawnedWaveIds = new Set();
  const maxTime = missionTimeLimit(stage, facts);
  const structureStartAt = (facts.lastWaveAtSeconds ?? 0) + STRUCTURE_DAMAGE_START_DELAY;
  let command = COMMAND_INITIAL;
  let commandSpent = 0;
  let baseHp = stage.baseHp;
  let structureHp = BARRICADE_MAX_HP;
  let squadHp = 0;
  let squadMaxHp = 0;
  let totalObjectiveDamage = 0;
  let totalEnemyWork = 0;
  let totalUnitDamage = 0;
  let currentTime = 0;
  let outcome = null;
  let nextWaveIndex = 0;
  let stageMission = createStationMissionRuntime(stage.missionType, stage.objectiveConfig);
  let gateEaterSeen = false;
  let gateEaterDefeated = false;
  let gateEaterContained = false;
  let researchContainerExposed = false;
  let researchContainerContained = false;
  let stoppedBy = "time-limit";

  const normalizedWaves = stage.waves.map((wave, index) => freeze({
    ...wave,
    waveNumber: wave.waveNumber ?? index + 1,
    atSeconds: PREP_SECONDS + wave.atSeconds,
    units: freeze(unitsForWave(wave)),
  }));

  while (currentTime <= maxTime && outcome === null) {
    command = Math.min(COMMAND_MAX, command + (currentTime === 0 ? 0 : COMMAND_REGEN * SIMULATION_STEP_SECONDS));

    if (deploymentQueue.length > 0 && activeUnits.length < CAMPAIGN_FORMATION_MAX_SLOTS) {
      const affordableIndex = deploymentQueue.findIndex((kind) => UNIT_BY_KIND[kind].cost <= command);
      if (affordableIndex >= 0) {
        const [kind] = deploymentQueue.splice(affordableIndex, 1);
        const card = UNIT_BY_KIND[kind];
        command -= card.cost;
        commandSpent += card.cost;
        squadHp += card.hp;
        squadMaxHp += card.hp;
        activeUnits.push(freeze({ ...card, deployedAt: currentTime }));
        deploymentLog.push(freeze({
          kind,
          atSeconds: currentTime,
          cost: card.cost,
          commandAfter: Number(command.toFixed(3)),
        }));
      }
    }

    while (nextWaveIndex < normalizedWaves.length
      && normalizedWaves[nextWaveIndex].atSeconds <= currentTime + 0.0001) {
      const wave = normalizedWaves[nextWaveIndex];
      spawnedWaveIds.add(wave.id);
      wave.units.forEach(({ kind, lane }, unitIndex) => {
        const stats = enemyStatsForWave(kind, wave.waveNumber);
        const spawnSpacing = enemySpawnInterval({ kind, lane, order: unitIndex });
        const spawnWorkMultiplier = 1 + spawnSpacing * 0.035;
        const hp = stats.hp * spawnWorkMultiplier;
        enemies.push({
          id: `${wave.id}:${unitIndex}`,
          kind,
          lane,
          waveNumber: wave.waveNumber,
          hp,
          maxHp: hp,
          progress: 0,
          stats,
          contained: false,
        });
        totalEnemyWork += hp;
        spawnedKinds.add(kind);
        if (kind === "gate-eater") {
          gateEaterSeen = true;
        }
      });
      nextWaveIndex += 1;
    }

    const livingEnemies = enemies.filter((enemy) => enemy.hp > 0 && enemy.contained !== true);
    const readiness = squadMaxHp <= 0 ? 0 : Math.max(0.34, Math.min(1, squadHp / squadMaxHp));
    const assignedPerLane = [0, 0, 0];
    const attackAssignments = activeUnits.map((unit) => {
      const lane = chooseLaneForUnit({
        unit,
        enemies: livingEnemies,
        assignedPerLane,
        random,
        roleCounters,
      });
      assignedPerLane[lane] += 1;
      return { unit, lane };
    });

    for (const { unit, lane } of attackAssignments) {
      const target = chooseEnemyForUnit(unit, lane, livingEnemies, roleCounters);
      if (!target || target.contained === true) continue;
      const laneEnemyCount = livingEnemies.filter((enemy) => enemy.lane === lane && enemy.hp > 0).length;
      const counter = roleCounterMultiplier(unit.kind, target.kind, laneEnemyCount, roleCounters);
      const engagement = unit.range >= 100 ? 1 : unit.range >= 60 ? 0.92 : 0.8;
      const seedVariance = 0.97 + random() * 0.06;
      const damage = unit.damage / unit.attackEvery
        * counter
        * engagement
        * readiness
        * seedVariance
        * SIMULATION_STEP_SECONDS;
      if (target.kind === "gate-eater") {
        const applied = Math.min(target.hp, damage);
        target.hp -= applied;
        totalUnitDamage += applied;
        if (target.hp <= target.maxHp * 0.72 && stageMission.powerActivated >= 2) {
          researchContainerExposed = true;
        }
        if (target.hp <= 0) {
          defeatedKinds.add(target.kind);
          gateEaterDefeated = true;
          gateEaterContained = true;
          researchContainerExposed = true;
          researchContainerContained = true;
        }
        continue;
      }
      const applied = Math.min(target.hp, damage);
      target.hp -= applied;
      totalUnitDamage += applied;
      if (target.hp <= 0) {
        defeatedKinds.add(target.kind);
      }
    }

    const activeEnemies = enemies.filter((enemy) => enemy.hp > 0 && enemy.contained !== true);
    for (const enemy of activeEnemies) {
      const laneDefenders = assignedPerLane[enemy.lane];
      const control = laneDefenders > 0 ? Math.min(0.38, laneDefenders * 0.09) : 0;
      enemy.progress += enemy.stats.speed
        / ENEMY_APPROACH_DISTANCE
        * enemy.stats.abilityPressure
        * (1 - control)
        * SIMULATION_STEP_SECONDS;
    }

    const contactDamage = activeEnemies
      .filter((enemy) => enemy.progress >= CONTACT_PROGRESS && enemy.progress < 1)
      .reduce((total, enemy) => total + enemy.stats.dps * enemy.stats.abilityPressure * 0.09, 0)
      * defensiveMultiplier(activeUnits, roleCounters);
    const healing = healingPerSecond(activeUnits, roleCounters);
    squadHp = Math.max(0, Math.min(squadMaxHp, squadHp - contactDamage + healing));

    const breachedEnemies = activeEnemies.filter((enemy) => enemy.progress >= 1);
    const objectiveDamage = breachedEnemies.reduce((total, enemy) => (
      total + objectiveDamageForEnemy(enemy)
    ), 0) * SIMULATION_STEP_SECONDS;
    baseHp = Math.max(0, baseHp - objectiveDamage);
    totalObjectiveDamage += objectiveDamage;

    if (
      ["assault", "boss-assault"].includes(stage.missionType)
      && currentTime >= structureStartAt
      && nextWaveIndex >= normalizedWaves.length
      && activeEnemies.length === 0
      && (stage.missionType !== "boss-assault" || defeatedKinds.has("takuya"))
    ) {
      const structureDamage = activeUnits.reduce((total, unit) => (
        total + unit.damage / unit.attackEvery * structureDamageMultiplier(unit.kind)
      ), 0) * readiness * 0.72 * SIMULATION_STEP_SECONDS;
      structureHp = Math.max(0, structureHp - structureDamage);
    }

    if (stage.missionType === STATION_MISSION_TYPES.ESCORT) {
      const nearbyThreats = activeEnemies.filter((enemy) => enemy.progress >= OBJECTIVE_DANGER_PROGRESS).length;
      const contaminated = activeEnemies.some((enemy) => (
        enemy.kind === "ooze" && enemy.progress >= CONTACT_PROGRESS
      ));
      stageMission = advanceStationMissionRuntime({
        runtime: stageMission,
        missionType: stage.missionType,
        config: stage.objectiveConfig,
        seconds: SIMULATION_STEP_SECONDS,
        battleElapsedSeconds: currentTime,
        humanCount: activeUnits.length,
        baseHp,
        escortCount: activeUnits.length,
        nearbyThreats,
        contaminated,
      });
      const missionOutcome = stationMissionOutcome({ runtime: stageMission, baseHp });
      outcome = missionOutcome === "lost"
        ? "lost"
        : missionOutcome === "won"
          && nextWaveIndex >= normalizedWaves.length
          && activeEnemies.length === 0
          ? "won"
          : null;
    } else if (stage.missionType === STATION_MISSION_TYPES.SEQUENTIAL_SEAL) {
      const powerLane = stage.objectiveConfig.powerLanes[Math.min(2, stageMission.powerActivated)] ?? 1;
      const powerLaneThreats = activeEnemies.filter((enemy) => (
        enemy.lane === powerLane && enemy.progress >= CONTACT_PROGRESS
      )).length;
      const escapeRouteThreats = activeEnemies.filter((enemy) => enemy.progress >= OBJECTIVE_DANGER_PROGRESS).length;
      const returnTargetCount = stageMission.returnTargetCount ?? activeUnits.length;
      const returnedCount = stageMission.sealed && escapeRouteThreats === 0
        ? activeUnits.length
        : 0;
      stageMission = advanceStationMissionRuntime({
        runtime: stageMission,
        missionType: stage.missionType,
        config: stage.objectiveConfig,
        seconds: SIMULATION_STEP_SECONDS,
        battleElapsedSeconds: currentTime,
        humanCount: activeUnits.length,
        baseHp,
        powerOperatorCount: powerLaneThreats === 0 && activeUnits.length > 0 ? 1 : 0,
        powerLaneThreats,
        gateEaterSeen,
        gateEaterDefeated,
        gateEaterContained,
        researchContainerExposed,
        researchContainerContained,
        returnedCount,
        returnTargetCount,
        escapeRouteThreats,
        wavesResolved: nextWaveIndex >= normalizedWaves.length && activeEnemies.length === 0,
      });
      const missionOutcome = stationMissionOutcome({ runtime: stageMission, baseHp });
      outcome = missionOutcome === "lost"
        ? "lost"
        : missionOutcome === "won"
          && nextWaveIndex >= normalizedWaves.length
          && activeEnemies.length === 0
          ? "won"
          : null;
    } else if (baseHp <= 0) {
      outcome = "lost";
      stoppedBy = "crawler-destroyed";
    } else if (stage.missionType === "timed-defense"
      && currentTime >= PREP_SECONDS + stage.objectiveConfig.durationSeconds) {
      outcome = baseHp / stage.baseHp >= (stage.starThresholds[1] ?? 0) ? "won" : "lost";
      stoppedBy = "defense-timer";
    } else if (["assault", "boss-assault"].includes(stage.missionType) && structureHp <= 0) {
      outcome = "won";
      stoppedBy = "objective-destroyed";
    }

    if (outcome !== null) break;
    currentTime += SIMULATION_STEP_SECONDS;
  }

  if (outcome === null) {
    outcome = "lost";
    stoppedBy = "time-limit";
  } else if (stageMission.completed) {
    stoppedBy = stage.missionType === STATION_MISSION_TYPES.ESCORT
      ? "escort-complete"
      : "return-complete";
  } else if (stageMission.failed) {
    stoppedBy = "station-objective-failed";
  }

  const remainingEnemies = enemies
    .filter((enemy) => enemy.hp > 0 && enemy.contained !== true)
    .map(publicEnemy);
  return freeze({
    stageId: stage.id,
    stageNumber: stage.stageNumber,
    missionType: stage.missionType,
    seed: String(seed),
    formation: freeze([...normalizedFormation]),
    slotCount: normalizedFormation.length,
    roleCounters,
    outcome,
    stoppedBy,
    elapsedSeconds: currentTime,
    baseHp: Number(baseHp.toFixed(3)),
    baseHpRatio: Number((baseHp / stage.baseHp).toFixed(4)),
    structureHp: Number(structureHp.toFixed(3)),
    command: freeze({
      initial: COMMAND_INITIAL,
      maximum: COMMAND_MAX,
      regenPerSecond: COMMAND_REGEN,
      spent: commandSpent,
      remaining: Number(command.toFixed(3)),
      deployments: freeze(deploymentLog),
    }),
    waves: freeze({
      scheduled: normalizedWaves.length,
      spawned: spawnedWaveIds.size,
      scheduledEnemyCount: facts.enemyCount,
      spawnedKinds: freeze([...spawnedKinds].sort()),
      defeatedKinds: freeze([...defeatedKinds].sort()),
      totalEnemyWork: Number(totalEnemyWork.toFixed(3)),
      totalUnitDamage: Number(totalUnitDamage.toFixed(3)),
      remainingEnemies: freeze(remainingEnemies),
    }),
    pressure: freeze({
      objectiveDamage: Number(totalObjectiveDamage.toFixed(3)),
      squadHp: Number(squadHp.toFixed(3)),
      squadMaxHp,
      squadReadiness: squadMaxHp <= 0 ? 0 : Number((squadHp / squadMaxHp).toFixed(4)),
    }),
    stationMission: stageMission,
  });
}

export function formationIntersection(formations) {
  if (!Array.isArray(formations) || formations.length === 0) return freeze([]);
  const [first, ...rest] = formations;
  return freeze(first.filter((kind) => rest.every((formation) => formation.includes(kind))));
}
