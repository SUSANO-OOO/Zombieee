import { V100_BOSS_BY_ID, V100_STAGE_BY_ID, V100_VEHICLE } from "./v100Registry.js";
import { v100StageRuntimeFor } from "./v100StageRuntime.js";

const TIMED_DURATION_SECONDS = Object.freeze({
  "stage-sawara-ward-office": 90,
  "stage-university-hospital-approach": 85,
  "stage-civic-archive-route": 95,
  "stage-mugarian-clinical-trial-wing": 100,
});

function clone(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function missionTargetCount(stage) {
  if (stage.number === 29) return 2;
  if (stage.missionType === "assault") return stage.objectiveId.includes("base") ? 4 : 3;
  if (stage.missionType === "escort") return 3;
  if (stage.missionType === "timed-defense") return 3;
  if (stage.missionType === "power" || stage.missionType === "seal") return stage.number === 28 ? 4 : 3;
  return 1;
}

function initialMissionObjects(stage, runtime) {
  const states = runtime?.objective.states ?? [];
  if (stage.missionType === "power" || stage.missionType === "seal") {
    const count = missionTargetCount(stage);
    return Array.from({ length: count }, (_, index) => ({
      id: `${stage.id}:node:${index + 1}`,
      state: states.includes("off") ? "off" : states[0] ?? "off",
      index,
    }));
  }
  return [{
    id: `${stage.id}:objective`,
    state: states[0] ?? "intact",
    index: 0,
  }];
}

function bossForStage(stage) {
  return Object.values(V100_BOSS_BY_ID).find((boss) => boss.stageNumber === stage.number) ?? null;
}

function initialBoss(stage, runtime) {
  const boss = bossForStage(stage);
  if (!boss) return null;
  return {
    id: boss.id,
    hp: boss.hp,
    maxHp: boss.hp,
    state: runtime.objective.states.includes("entrance") ? "entrance" : "phase",
    phaseIndex: 0,
    defeated: false,
    musicOwner: "music-v099-boss",
    musicActive: true,
  };
}

function stageProgress(state) {
  if (state.missionType === "power" || state.missionType === "seal") {
    return state.missionObjects.filter((object) => object.state === "on").length;
  }
  return state.progress;
}

function objectiveComplete(state) {
  if (state.vehicleHp <= 0) return false;
  if (state.missionType === "boss") return state.boss?.defeated === true;
  if (state.missionType === "power" || state.missionType === "seal") return stageProgress(state) >= state.targetCount;
  return state.progress >= state.targetCount;
}

function objectiveState(state) {
  const states = state.objectiveStates;
  if (state.missionType === "boss") return state.boss?.state ?? states[0];
  if (state.missionType === "power" || state.missionType === "seal") {
    if (state.missionObjects.every((object) => object.state === "on")) return "on";
    if (state.missionObjects.some((object) => object.state === "connection")) return "connection";
    if (state.missionObjects.some((object) => object.state === "engaged")) return "engaged";
    if (state.missionObjects.some((object) => object.state === "disconnection")) return "disconnection";
    return "off";
  }
  if (state.missionType === "escort") {
    if (state.progress >= state.targetCount) return "destroyed";
    if (state.progress >= state.targetCount - 1) return "critical";
    if (state.progress > 0) return "damaged";
    return "moving";
  }
  if (state.missionType === "timed-defense") {
    if (objectiveComplete(state)) return "success";
    if (state.progress >= state.targetCount - 1) return "impact";
    if (state.progress > 0) return "incoming";
    return "perimeter";
  }
  if (objectiveComplete(state)) return "destroyed";
  if (state.progress >= state.targetCount - 1) return "critical";
  if (state.progress > 0) return "damaged";
  return "intact";
}

function withDerivedState(state, patch = {}) {
  const next = { ...state, ...patch };
  next.objectiveState = objectiveState(next);
  next.objectiveComplete = objectiveComplete(next);
  next.missionProgress = stageProgress(next);
  return Object.freeze(next);
}

export function createV100StageBattle({ stageId, vehicleMaxHp = V100_VEHICLE.baseHp, now = 0 } = {}) {
  const stage = V100_STAGE_BY_ID[stageId];
  if (!stage) return { ok: false, reason: "unknown-stage" };
  const runtime = v100StageRuntimeFor(stageId);
  const safeMaxHp = Math.max(1, Number(vehicleMaxHp) || V100_VEHICLE.baseHp);
  const state = {
    stageId,
    stageNumber: stage.number,
    displayName: stage.displayName,
    missionType: stage.missionType,
    objectiveId: stage.objectiveId,
    objectiveStates: [...(runtime?.objective.states ?? [])],
    objectiveState: runtime?.objective.states?.[0] ?? "intact",
    objectiveComplete: false,
    missionProgress: 0,
    progress: 0,
    targetCount: missionTargetCount(stage),
    timedDurationSeconds: TIMED_DURATION_SECONDS[stageId] ?? null,
    elapsedSeconds: 0,
    vehicleHp: safeMaxHp,
    vehicleMaxHp: safeMaxHp,
    enemyPack: stage.enemyPack,
    waveIndex: 0,
    wavesCompleted: 0,
    missionObjects: initialMissionObjects(stage, runtime),
    boss: initialBoss(stage, runtime),
    audio: runtime?.audio ?? null,
    eventLog: [],
    now: Math.max(0, Number(now) || 0),
  };
  return { ok: true, state: withDerivedState(state) };
}

function appendLog(state, action, detail = {}) {
  return [...state.eventLog, { action, at: state.now, ...detail }].slice(-50);
}

function advancePowerNode(state, index) {
  if (!Number.isInteger(index) || index < 0 || index >= state.missionObjects.length) return null;
  const objects = state.missionObjects.map((object, objectIndex) => objectIndex === index
    ? { ...object, state: object.state === "on" ? "on" : object.state === "engaged" ? "connection" : "engaged" }
    : object);
  const fullyConnected = objects.every((object) => object.state === "connection" || object.state === "on");
  return objects.map((object) => object.state === "connection" && fullyConnected ? { ...object, state: "on" } : object);
}

export function advanceV100StageBattle(currentState, action = {}) {
  if (!currentState || typeof currentState !== "object") return { accepted: false, reason: "battle-state-required", state: currentState };
  const state = clone(currentState);
  const type = typeof action.type === "string" ? action.type : "";
  const time = Math.max(state.now, Number(action.now) || state.now);
  state.now = time;
  if (state.vehicleHp <= 0 && type !== "reset") return { accepted: false, reason: "vehicle-destroyed", state: Object.freeze(state) };

  if (type === "tick") {
    const seconds = Math.max(0, Number(action.seconds) || 0);
    state.elapsedSeconds += seconds;
    if (state.missionType === "timed-defense" && state.elapsedSeconds >= state.timedDurationSeconds) state.progress = state.targetCount;
    state.eventLog = appendLog(state, type, { seconds });
    return { accepted: true, state: withDerivedState(state) };
  }
  if (type === "vehicle-damage") {
    state.vehicleHp = Math.max(0, state.vehicleHp - Math.max(0, Number(action.amount) || 0));
    state.eventLog = appendLog(state, type, { amount: Math.max(0, Number(action.amount) || 0) });
    return { accepted: true, state: withDerivedState(state) };
  }
  if (type === "objective-hit" || type === "escort-progress" || type === "wave-clear") {
    state.progress = Math.min(state.targetCount, state.progress + 1);
    state.wavesCompleted += 1;
    state.waveIndex += 1;
    state.eventLog = appendLog(state, type, { progress: state.progress });
    return { accepted: true, state: withDerivedState(state) };
  }
  if (type === "power-node" || type === "seal-node") {
    const missionObjects = advancePowerNode(state, Number(action.index));
    if (!missionObjects) return { accepted: false, reason: "unknown-node", state: Object.freeze(state) };
    state.missionObjects = missionObjects;
    state.eventLog = appendLog(state, type, { index: Number(action.index) });
    return { accepted: true, state: withDerivedState(state) };
  }
  if (type === "boss-entrance") {
    if (!state.boss) return { accepted: false, reason: "not-boss-stage", state: Object.freeze(state) };
    state.boss.state = state.boss.state === "entrance" ? "telegraph" : state.boss.state;
    state.eventLog = appendLog(state, type);
    return { accepted: true, state: withDerivedState(state) };
  }
  if (type === "boss-hit") {
    if (!state.boss || state.boss.defeated) return { accepted: false, reason: "boss-not-active", state: Object.freeze(state) };
    const damage = Math.max(0, Number(action.amount) || 0);
    state.boss.hp = Math.max(0, state.boss.hp - damage);
    state.boss.state = state.boss.hp <= 0 ? "death" : state.boss.hp < state.boss.maxHp * 0.5 ? "phase" : "hit";
    if (state.boss.hp <= 0) state.boss.musicActive = false;
    state.eventLog = appendLog(state, type, { amount: damage, hp: state.boss.hp });
    return { accepted: true, state: withDerivedState(state) };
  }
  if (type === "boss-defeat") {
    if (!state.boss || state.boss.hp > 0 || state.boss.defeated) return { accepted: false, reason: "boss-death-required", state: Object.freeze(state) };
    state.boss.defeated = true;
    state.boss.state = "defeat";
    state.eventLog = appendLog(state, type);
    return { accepted: true, state: withDerivedState(state) };
  }
  if (type === "resolve") {
    if (!objectiveComplete(state)) return { accepted: false, reason: "objective-incomplete", state: Object.freeze(state) };
    state.eventLog = appendLog(state, type);
    return { accepted: true, state: withDerivedState(state) };
  }
  return { accepted: false, reason: "unknown-action", state: Object.freeze(state) };
}

export function v100StageBattleResult(state) {
  if (!state || typeof state !== "object") return null;
  return Object.freeze({
    stageId: state.stageId,
    stageNumber: state.stageNumber,
    won: state.objectiveComplete === true && state.vehicleHp > 0,
    objectiveComplete: state.objectiveComplete === true,
    bossDefeated: state.boss?.defeated === true,
    vehicleHp: state.vehicleHp,
    vehicleMaxHp: state.vehicleMaxHp,
    elapsedSeconds: state.elapsedSeconds,
    wavesCompleted: state.wavesCompleted,
  });
}

export function v100BattleRuntimeContract() {
  return Object.freeze({
    objectiveStateOwner: "v100-battle-runtime",
    bossMusicOwnerUntilDeath: "music-v099-boss",
    vehicleExcludedFromPlayableActiveCount: true,
    timedDefenseDurationSource: "locked-stage-row",
  });
}
