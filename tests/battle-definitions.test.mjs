import assert from "node:assert/strict";
import test from "node:test";
import { CAMPAIGN_STAGE_BY_ID, CAMPAIGN_STAGE_IDS } from "../app/campaign.js";
import { MISSION_EVENTS, PREP_SECONDS } from "../app/gameRules.js";
import { battleOutcomeFor, createBattleDefinition, objectiveForBattle, phaseForBattle } from "../app/battleDefinitions.js";
import { stationSpatialSnapshot } from "../app/stationSpatialMechanics.js";
import { STATION_MISSION_TYPES, createStationMissionRuntime } from "../app/stationStageMechanics.js";

const STAGE_4 = CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_GATE;
const STAGE_5 = CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_PLATFORM;
const STAGE_6 = CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_TUNNEL;

test("the TAKUYA stage preserves the complete 0.5.0 timeline and phase boundaries", () => {
  const definition = createBattleDefinition(CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE);
  assert.deepEqual(definition.timeline, MISSION_EVENTS);
  assert.equal(definition.timeline.length, CAMPAIGN_STAGE_BY_ID[CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE].waves.length);
  assert.equal(phaseForBattle(definition, 59.999), 1);
  assert.equal(phaseForBattle(definition, 60), 2);
  assert.equal(phaseForBattle(definition, 147.999), 2);
  assert.equal(phaseForBattle(definition, 148), 3);
  assert.equal(definition.baseMaxHp, 520);
  assert.equal(definition.bossUnlocksEnemyBase, true);
});

test("stage 1 begins with a targetable shared enemy base", () => {
  const definition = createBattleDefinition(CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET);
  assert.equal(definition.startsEnemyBaseVulnerable, true);
  assert.equal(definition.enemyBaseMode, "target");
  assert.equal(battleOutcomeFor(definition, { baseHp: 100, barricadeHp: 0, time: 20 }), "won");
  assert.equal(battleOutcomeFor(definition, { baseHp: 10, baseMaxHp: 1000, barricadeHp: 0, time: 20 }), "won");
  assert.equal(battleOutcomeFor(definition, { baseHp: 9, baseMaxHp: 1000, barricadeHp: 1, time: 20 }), null);
  assert.equal(battleOutcomeFor(definition, { baseHp: 9, baseMaxHp: 1000, barricadeHp: 0, time: 20 }), "lost");
  assert.equal(battleOutcomeFor(definition, { baseHp: 0, barricadeHp: 0, time: 20 }), "lost");
});

test("stage 2 survives a full 180 seconds after deployment and does not target scenery", () => {
  const definition = createBattleDefinition(CAMPAIGN_STAGE_IDS.SAWARA_WARD_OFFICE);
  assert.equal(definition.defenseEndAt, PREP_SECONDS + 180);
  assert.equal(definition.enemyBaseMode, "scenery");
  assert.equal(battleOutcomeFor(definition, { baseHp: 100, barricadeHp: 0, time: definition.defenseEndAt - .001 }), null);
  assert.equal(battleOutcomeFor(definition, { baseHp: 100, barricadeHp: 0, time: definition.defenseEndAt }), "won");
  assert.equal(battleOutcomeFor(definition, { baseHp: 9, baseMaxHp: 1000, barricadeHp: 0, time: definition.defenseEndAt - .001 }), null);
  assert.equal(battleOutcomeFor(definition, { baseHp: 9, baseMaxHp: 1000, barricadeHp: 0, time: definition.defenseEndAt }), "lost");
  assert.match(objectiveForBattle(definition, { time: PREP_SECONDS, phase: 1, barricadeVulnerable: false }), /180秒/);
});

test("stage 3 cannot report victory until TAKUYA is defeated and the infection base is vulnerable", () => {
  const definition = createBattleDefinition(CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE);
  const destroyedBase = { baseHp: definition.baseMaxHp, barricadeHp: 0, time: 200 };

  assert.equal(battleOutcomeFor(definition, destroyedBase), null);
  assert.equal(battleOutcomeFor(definition, {
    ...destroyedBase,
    bossDefeated: false,
    barricadeVulnerable: true,
  }), null);
  assert.equal(battleOutcomeFor(definition, {
    ...destroyedBase,
    bossDefeated: true,
    barricadeVulnerable: false,
  }), null);
  assert.equal(battleOutcomeFor(definition, {
    ...destroyedBase,
    bossDefeated: true,
    barricadeVulnerable: true,
  }), "won");
  assert.equal(battleOutcomeFor(definition, {
    ...destroyedBase,
    baseHp: 0,
    bossDefeated: true,
    barricadeVulnerable: true,
  }), "lost");
});

test("stage 4 destroys the relay, rescues seven survivors, and keeps an assault outcome", () => {
  const definition = createBattleDefinition(STAGE_4);
  assert.equal(definition.missionType, "assault");
  assert.equal(definition.enemyBaseMode, "target");
  assert.equal(definition.startsEnemyBaseVulnerable, true);
  assert.equal(definition.rescueCount, 7);
  assert.deepEqual(definition.missionConfig, {
    target: "infected-relay",
    rescueCount: 7,
    rescueMode: "automatic-on-objective-destroyed",
  });
  assert.match(objectiveForBattle(definition, {
    time: PREP_SECONDS,
    phase: 1,
    barricadeVulnerable: true,
  }), /感染中継点/);
  assert.equal(battleOutcomeFor(definition, {
    baseHp: definition.baseMaxHp,
    barricadeHp: 1,
    time: 100,
  }), null);
  assert.equal(battleOutcomeFor(definition, {
    baseHp: definition.baseMaxHp,
    barricadeHp: 0,
    time: 100,
  }), "won");
});

test("stage 5 uses the real cart runtime instead of a scenery or elapsed-time shortcut", () => {
  const definition = createBattleDefinition(STAGE_5);
  const active = createStationMissionRuntime(STATION_MISSION_TYPES.ESCORT, definition.missionConfig);
  const complete = { ...active, progress: 1, completed: true };
  const failed = { ...active, integrity: 0, failed: true };

  assert.equal(definition.missionType, STATION_MISSION_TYPES.ESCORT);
  assert.equal(definition.enemyBaseMode, "scenery");
  assert.equal(definition.startsEnemyBaseVulnerable, false);
  assert.equal(definition.rescueCount, 5);
  assert.equal(definition.missionConfig.durationSeconds, 135);
  assert.equal(definition.missionConfig.maxIntegrity, 500);
  assert.equal(definition.missionConfig.repairSeconds, 20);
  assert.match(objectiveForBattle(definition, { stageMission: active }), /保守台車.*0%/);
  assert.equal(battleOutcomeFor(definition, {
    baseHp: definition.baseMaxHp,
    stageMission: active,
    time: Number.MAX_SAFE_INTEGER,
  }), null);
  assert.equal(battleOutcomeFor(definition, {
    baseHp: definition.baseMaxHp,
    stageMission: complete,
    wavesResolved: true,
  }), "won");
  assert.equal(battleOutcomeFor(definition, {
    baseHp: definition.baseMaxHp,
    stageMission: failed,
  }), "lost");
});

test("stage 6 requires power 1-2-3, Gate Eater containment, sealing, and the 45-second return", () => {
  const definition = createBattleDefinition(STAGE_6);
  const initial = createStationMissionRuntime(STATION_MISSION_TYPES.SEQUENTIAL_SEAL, definition.missionConfig);
  const gateEaterContained = {
    ...initial,
    gateEaterSeen: true,
    gateEaterContained: true,
    researchContainerExposed: true,
    researchContainerContained: false,
  };
  const returned = {
    ...gateEaterContained,
    powerActivated: 3,
    researchContainerContained: true,
    sealed: true,
    escapeRemaining: 0,
    returnTargetCount: 3,
    returnedCount: 3,
    completed: true,
  };

  assert.equal(definition.missionType, STATION_MISSION_TYPES.SEQUENTIAL_SEAL);
  assert.equal(definition.enemyBaseMode, "scenery");
  assert.deepEqual(definition.missionConfig.targetsInOrder, [
    "power-1",
    "power-2",
    "power-3",
    "gate-eater",
    "research-container",
    "seal-door",
    "return-route",
  ]);
  assert.equal(definition.missionConfig.escapeSeconds, 45);
  assert.equal(phaseForBattle(definition, 61.999), 1);
  assert.equal(phaseForBattle(definition, 62), 2);
  assert.equal(phaseForBattle(definition, 119.999), 2);
  assert.equal(phaseForBattle(definition, 120), 3);
  assert.match(objectiveForBattle(definition, { stageMission: initial }), /電源1/);
  assert.equal(battleOutcomeFor(definition, {
    baseHp: definition.baseMaxHp,
    stageMission: gateEaterContained,
  }), null);
  assert.equal(battleOutcomeFor(definition, {
    baseHp: definition.baseMaxHp,
    stageMission: returned,
    wavesResolved: true,
  }), "won");
  assert.equal(battleOutcomeFor(definition, {
    baseHp: 0,
    stageMission: returned,
    wavesResolved: true,
  }), "lost");
});

test("station victory waits until every wave, pending spawn, and living unsealed enemy is resolved", () => {
  const definition = createBattleDefinition(STAGE_5);
  const complete = {
    ...createStationMissionRuntime(STATION_MISSION_TYPES.ESCORT, definition.missionConfig),
    progress: 1,
    completed: true,
  };

  assert.equal(battleOutcomeFor(definition, {
    baseHp: definition.baseMaxHp,
    stageMission: complete,
  }), null, "omitting the wave-resolution proof must fail safe");
  assert.equal(battleOutcomeFor(definition, {
    baseHp: definition.baseMaxHp,
    stageMission: complete,
    wavesResolved: false,
  }), null, "an unissued wave, pending spawn, or living enemy must block victory");
  assert.equal(battleOutcomeFor(definition, {
    baseHp: definition.baseMaxHp,
    stageMission: complete,
    wavesResolved: true,
  }), "won");

  const unresolved = stationSpatialSnapshot({
    missionType: definition.missionType,
    missionRuntime: complete,
    eventIndex: definition.timeline.length,
    timelineLength: definition.timeline.length,
    pendingSpawnCount: 0,
    fighters: [{ side: "zombie", kind: "walker", hp: 1, combatReady: false, contained: true }],
  });
  assert.equal(unresolved.wavesResolved, false);
  assert.equal(battleOutcomeFor(definition, {
    baseHp: definition.baseMaxHp,
    stageMission: complete,
    wavesResolved: unresolved.wavesResolved,
  }), null);
});
