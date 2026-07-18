const freeze = (value) => Object.freeze(value);

export const STATION_MISSION_TYPES = freeze({
  ESCORT: "escort",
  SEQUENTIAL_SEAL: "sequential-seal",
});

export const STATION_MISSION_TUNING = freeze({
  escort: freeze({
    durationSeconds: 135,
    maxIntegrity: 500,
    threatDamagePerSecond: 6,
    contaminationDamagePerSecond: 10,
    repairSeconds: 20,
    startX: 258,
    endX: 776,
  }),
  seal: freeze({
    powerCount: 3,
    powerHoldSeconds: 6,
    powerReadyAtSeconds: freeze([24, 62, 104]),
    powerLanes: freeze([0, 2, 1]),
    escapeSeconds: 45,
    returnSpeedMultiplier: 1.8,
  }),
});

function finiteNonNegative(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : fallback;
}

function positive(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, finiteNonNegative(value)));
}

function stableIds(values) {
  if (!Array.isArray(values)) return freeze([]);
  return freeze([...new Set(values
    .filter((value) => value !== null && value !== undefined)
    .map((value) => String(value)))].sort());
}

function escortConfig(config = {}) {
  return freeze({
    ...STATION_MISSION_TUNING.escort,
    durationSeconds: positive(config.durationSeconds, STATION_MISSION_TUNING.escort.durationSeconds),
    maxIntegrity: positive(config.maxIntegrity, STATION_MISSION_TUNING.escort.maxIntegrity),
    repairSeconds: positive(config.repairSeconds, STATION_MISSION_TUNING.escort.repairSeconds),
    startX: finiteNonNegative(config.startX, STATION_MISSION_TUNING.escort.startX),
    endX: finiteNonNegative(config.endX, STATION_MISSION_TUNING.escort.endX),
  });
}

function sealConfig(config = {}) {
  const readyAt = Array.isArray(config.powerReadyAtSeconds) && config.powerReadyAtSeconds.length === 3
    ? config.powerReadyAtSeconds.map((value, index) => finiteNonNegative(value, STATION_MISSION_TUNING.seal.powerReadyAtSeconds[index]))
    : [...STATION_MISSION_TUNING.seal.powerReadyAtSeconds];
  const lanes = Array.isArray(config.powerLanes) && config.powerLanes.length === 3
    ? config.powerLanes.map((lane, index) => [0, 1, 2].includes(lane) ? lane : STATION_MISSION_TUNING.seal.powerLanes[index])
    : [...STATION_MISSION_TUNING.seal.powerLanes];
  const powerXs = Array.isArray(config.powerXs) && config.powerXs.length === 3
    ? config.powerXs.map((value, index) => finiteNonNegative(value, [410, 584, 744][index]))
    : [410, 584, 744];
  return freeze({
    ...STATION_MISSION_TUNING.seal,
    powerHoldSeconds: positive(config.powerHoldSeconds, STATION_MISSION_TUNING.seal.powerHoldSeconds),
    powerReadyAtSeconds: freeze(readyAt),
    powerLanes: freeze(lanes),
    powerXs: freeze(powerXs),
    powerRadiusX: positive(config.powerRadiusX, 84),
    powerRadiusY: positive(config.powerRadiusY, 42),
    escapeSeconds: positive(config.escapeSeconds, STATION_MISSION_TUNING.seal.escapeSeconds),
    returnSpeedMultiplier: positive(
      config.returnSpeedMultiplier,
      STATION_MISSION_TUNING.seal.returnSpeedMultiplier,
    ),
  });
}

export function createStationMissionRuntime(missionType, config = {}) {
  if (missionType === STATION_MISSION_TYPES.ESCORT) {
    const resolved = escortConfig(config);
    return freeze({
      missionType,
      progress: 0,
      integrity: resolved.maxIntegrity,
      maxIntegrity: resolved.maxIntegrity,
      repairRemaining: 0,
      contaminated: false,
      stalled: false,
      completed: false,
      failed: false,
      transitions: freeze([]),
    });
  }
  if (missionType === STATION_MISSION_TYPES.SEQUENTIAL_SEAL) {
    return freeze({
      missionType,
      powerActivated: 0,
      powerHold: 0,
      gateEaterSeen: false,
      gateEaterContained: false,
      researchContainerExposed: false,
      researchContainerContained: false,
      sealed: false,
      escapeRemaining: null,
      returnTargetCount: null,
      returnTargetIds: null,
      returnedUnitIds: freeze([]),
      returnedCount: 0,
      completed: false,
      failed: false,
      transitions: freeze([]),
    });
  }
  return freeze({
    missionType,
    completed: false,
    failed: false,
    transitions: freeze([]),
  });
}

export function escortCartX(runtime, config = {}) {
  const resolved = escortConfig(config);
  return resolved.startX + (resolved.endX - resolved.startX) * clamp01(runtime?.progress);
}

export function currentPowerNode(runtime, config = {}) {
  const resolved = sealConfig(config);
  const activated = Math.max(0, Math.min(resolved.powerCount, Math.trunc(Number(runtime?.powerActivated) || 0)));
  if (activated >= resolved.powerCount) return null;
  return freeze({
    index: activated,
    number: activated + 1,
    lane: resolved.powerLanes[activated],
    x: resolved.powerXs[activated],
    radiusX: resolved.powerRadiusX,
    radiusY: resolved.powerRadiusY,
    readyAtSeconds: resolved.powerReadyAtSeconds[activated],
  });
}

export function stationHumanMoveSpeed({
  baseSpeed = 0,
  slowMultiplier = 1,
  runtime,
  missionType = runtime?.missionType,
  config = {},
} = {}) {
  const speed = finiteNonNegative(baseSpeed)
    * Math.min(1, finiteNonNegative(slowMultiplier, 1));
  if (missionType !== STATION_MISSION_TYPES.SEQUENTIAL_SEAL
    || runtime?.sealed !== true
    || runtime?.completed === true) {
    return speed;
  }
  return speed * sealConfig(config).returnSpeedMultiplier;
}

function appendTransition(runtime, transition) {
  if (!transition) return runtime.transitions ?? freeze([]);
  return freeze([...(runtime.transitions ?? []), transition]);
}

export function advanceStationMissionRuntime({
  runtime,
  missionType = runtime?.missionType,
  config = {},
  seconds = 0,
  battleElapsedSeconds = 0,
  humanCount = 0,
  baseHp = 1,
  escortCount = 0,
  nearbyThreats = 0,
  contaminated = false,
  powerOperatorCount = 0,
  powerLaneThreats = 0,
  gateEaterSeen = false,
  gateEaterContained = false,
  researchContainerExposed = false,
  researchContainerContained = false,
  returnedCount = 0,
  returnTargetCount = 0,
  activeUnitIds = [],
  returnedUnitIds = [],
  escapeRouteThreats = 0,
  wavesResolved = false,
} = {}) {
  const current = runtime?.missionType === missionType
    ? runtime
    : createStationMissionRuntime(missionType, config);
  const dt = finiteNonNegative(seconds);
  const humans = Math.max(0, Math.trunc(Number(humanCount) || 0));
  const crawlerDestroyed = Number(baseHp) <= 0;

  if (missionType === STATION_MISSION_TYPES.ESCORT) {
    const resolved = escortConfig(config);
    const escorts = Math.max(0, Math.trunc(Number(escortCount) || 0));
    const threats = Math.max(0, Math.trunc(Number(nearbyThreats) || 0));
    const contaminationActive = contaminated === true;
    let repairRemaining = finiteNonNegative(current.repairRemaining);
    let transition = null;
    if (contaminationActive && current.contaminated !== true) {
      repairRemaining = Math.max(repairRemaining, resolved.repairSeconds);
      transition = "escort-contaminated";
    } else if (!contaminationActive) {
      repairRemaining = Math.max(0, repairRemaining - dt);
    }
    const stalled = escorts === 0 || threats > 0 || contaminationActive || repairRemaining > 0;
    const escortReadiness = Math.min(1, .58 + Math.min(3, escorts) * .14);
    const progress = current.completed
      ? 1
      : Math.min(1, clamp01(current.progress) + (stalled ? 0 : dt * escortReadiness / resolved.durationSeconds));
    const damage = dt * (
      threats * resolved.threatDamagePerSecond
      + (contaminationActive ? resolved.contaminationDamagePerSecond : 0)
    );
    const integrity = Math.max(0, Math.min(resolved.maxIntegrity, finiteNonNegative(current.integrity, resolved.maxIntegrity) - damage));
    const completed = progress >= 1 && integrity > 0 && !crawlerDestroyed;
    // A temporarily empty field is not defeat: formation cards can redeploy
    // after a unit is incapacitated. The escort simply remains stalled until
    // another eligible unit reaches it.
    const failed = current.failed === true || integrity <= 0 || crawlerDestroyed;
    if (completed && current.completed !== true) transition = "escort-complete";
    else if (failed && current.failed !== true) {
      transition = integrity <= 0
        ? "escort-destroyed"
        : crawlerDestroyed
          ? "crawler-destroyed"
          : "squad-eliminated";
    }
    return freeze({
      missionType,
      progress,
      integrity,
      maxIntegrity: resolved.maxIntegrity,
      repairRemaining,
      contaminated: contaminationActive,
      stalled,
      completed,
      failed,
      transitions: appendTransition(current, transition),
    });
  }

  if (missionType === STATION_MISSION_TYPES.SEQUENTIAL_SEAL) {
    const resolved = sealConfig(config);
    const seen = current.gateEaterSeen === true || gateEaterSeen === true || gateEaterContained === true;
    const gateContained = current.gateEaterContained === true || gateEaterContained === true;
    const researchExposed = current.researchContainerExposed === true
      || researchContainerExposed === true
      || researchContainerContained === true;
    const researchContained = current.researchContainerContained === true
      || researchContainerContained === true;
    const operators = Math.max(0, Math.trunc(Number(powerOperatorCount) || 0));
    let powerActivated = Math.max(0, Math.min(resolved.powerCount, Math.trunc(Number(current.powerActivated) || 0)));
    let powerHold = finiteNonNegative(current.powerHold);
    let transition = null;
    const node = currentPowerNode({ powerActivated }, resolved);
    const canHold = node
      && finiteNonNegative(battleElapsedSeconds) >= node.readyAtSeconds
      && operators > 0
      && Math.max(0, Math.trunc(Number(powerLaneThreats) || 0)) === 0;
    powerHold = canHold ? powerHold + dt : Math.max(0, powerHold - dt * .5);
    if (node && powerHold >= resolved.powerHoldSeconds) {
      powerActivated += 1;
      powerHold = 0;
      transition = `power-${powerActivated}-activated`;
    }

    const containmentReady = powerActivated >= resolved.powerCount
      && gateContained
      && researchContained;
    const sealed = current.sealed === true
      || (containmentReady && wavesResolved === true);
    let escapeRemaining = current.escapeRemaining === null || current.escapeRemaining === undefined
      ? null
      : finiteNonNegative(current.escapeRemaining);
    let stableReturnTarget = current.returnTargetCount === null || current.returnTargetCount === undefined
      ? null
      : Math.max(0, Math.trunc(Number(current.returnTargetCount) || 0));
    let stableReturnTargetIds = Array.isArray(current.returnTargetIds)
      ? stableIds(current.returnTargetIds)
      : null;
    const activeIds = stableIds(activeUnitIds);
    const returnedIds = stableIds(returnedUnitIds);
    const returned = Math.max(0, Math.trunc(Number(returnedCount) || 0));
    if (sealed && current.sealed !== true) {
      escapeRemaining = resolved.escapeSeconds;
      const requestedTarget = Math.max(0, Math.trunc(Number(returnTargetCount) || 0));
      stableReturnTargetIds = activeIds.length > 0 ? activeIds : null;
      stableReturnTarget = stableReturnTargetIds?.length
        ?? (requestedTarget > 0 ? requestedTarget : humans);
      transition = "return-window-open";
    } else if (sealed && escapeRemaining !== null && current.completed !== true) {
      escapeRemaining = Math.max(0, escapeRemaining - dt);
    }
    const identityTracked = Array.isArray(stableReturnTargetIds) && stableReturnTargetIds.length > 0;
    const missingRequiredUnit = identityTracked
      && stableReturnTargetIds.some((id) => !activeIds.includes(id));
    const allReturned = identityTracked
      ? stableReturnTargetIds.every((id) => returnedIds.includes(id))
      : stableReturnTarget !== null
        && stableReturnTarget > 0
        && returned >= stableReturnTarget;
    const routeClear = Math.max(0, Math.trunc(Number(escapeRouteThreats) || 0)) === 0;
    const completionAchieved = sealed
      && allReturned
      && routeClear
      && !crawlerDestroyed
      && !missingRequiredUnit;
    const completed = current.completed === true || completionAchieved;
    const timedOut = sealed && escapeRemaining === 0 && !completed;
    const failed = current.failed === true
      || crawlerDestroyed
      || (!completed && missingRequiredUnit)
      || timedOut;
    if (completed && current.completed !== true) transition = "return-complete";
    else if (failed && current.failed !== true) {
      transition = crawlerDestroyed
        ? "crawler-destroyed"
        : missingRequiredUnit
          ? "return-unit-lost"
          : "return-timeout";
    }
    return freeze({
      missionType,
      powerActivated,
      powerHold,
      gateEaterSeen: seen,
      gateEaterContained: gateContained,
      researchContainerExposed: researchExposed,
      researchContainerContained: researchContained,
      sealed,
      escapeRemaining,
      returnTargetCount: stableReturnTarget,
      returnTargetIds: stableReturnTargetIds,
      returnedUnitIds: returnedIds,
      returnedCount: returned,
      completed,
      failed,
      transitions: appendTransition(current, transition),
    });
  }

  return freeze({
    ...current,
    failed: current.failed === true || crawlerDestroyed,
  });
}

export function stationMissionOutcome({ runtime, baseHp = 1 } = {}) {
  if (Number(baseHp) <= 0 || runtime?.failed === true) return "lost";
  if (runtime?.completed === true) return "won";
  return null;
}

export function stationMissionObjective(runtime, config = {}) {
  if (runtime?.missionType === STATION_MISSION_TYPES.ESCORT) {
    if (runtime.failed) return "保守台車を防衛できなかった";
    if (runtime.completed) return "保守台車と生存者を出口へ護送完了";
    if (runtime.contaminated) return "漏泥の床汚染を排除";
    if (runtime.repairRemaining > 0) return `保守台車を復旧中 ${Math.ceil(runtime.repairRemaining)}秒`;
    if (runtime.stalled) return "保守台車の周囲を確保";
    return `保守台車を護衛 ${Math.floor(clamp01(runtime.progress) * 100)}%`;
  }
  if (runtime?.missionType === STATION_MISSION_TYPES.SEQUENTIAL_SEAL) {
    const resolved = sealConfig(config);
    if (runtime.failed) return "感染流出路の封鎖に失敗";
    if (runtime.completed) return "全員帰還";
    if (runtime.sealed) {
      const returned = Math.max(0, Math.trunc(Number(runtime.returnedCount) || 0));
      const target = Math.max(0, Math.trunc(Number(runtime.returnTargetCount) || 0));
      return `退路へ全員帰還 ${returned}/${target} ${Math.ceil(finiteNonNegative(runtime.escapeRemaining))}秒`;
    }
    if (runtime.powerActivated < resolved.powerCount) {
      const node = currentPowerNode(runtime, resolved);
      const percent = Math.min(99, Math.floor(finiteNonNegative(runtime.powerHold) / resolved.powerHoldSeconds * 100));
      return `電源${node?.number ?? runtime.powerActivated + 1}を起動 ${percent}%`;
    }
    if (!runtime.gateEaterContained) return "改札喰いを封鎖扉の向こうへ押し込め";
    if (!runtime.researchContainerExposed) return "研究容器を露出させろ";
    if (!runtime.researchContainerContained) return "研究容器を封鎖扉の向こうへ押し込め";
    if (!runtime.sealed) return "残存感染体を排除し退路を確保";
    return "退路へ全員帰還";
  }
  return "";
}
