import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceV100StageBattle,
  createV100StageBattle,
  v100BattleRuntimeContract,
  v100StageBattleResult,
} from "../app/v100BattleRuntime.js";

test("assault and objective state transitions become a real V1 battle result", () => {
  let result = createV100StageBattle({ stageId: "stage-nishijin-shopping-street" });
  assert.equal(result.ok, true);
  let state = result.state;
  assert.equal(state.objectiveState, "intact");
  for (let index = 0; index < state.targetCount; index += 1) state = advanceV100StageBattle(state, { type: "objective-hit" }).state;
  assert.equal(state.objectiveState, "destroyed");
  assert.equal(v100StageBattleResult(state).won, true);
});

test("timed defense, escort, power, and boss states cannot skip their objective", () => {
  let timed = createV100StageBattle({ stageId: "stage-sawara-ward-office" }).state;
  assert.equal(advanceV100StageBattle(timed, { type: "resolve" }).reason, "objective-incomplete");
  timed = advanceV100StageBattle(timed, { type: "tick", seconds: 90 }).state;
  assert.equal(timed.objectiveState, "success");

  let escort = createV100StageBattle({ stageId: "stage-nishijin-station-tunnel-seal" }).state;
  escort = advanceV100StageBattle(escort, { type: "escort-progress" }).state;
  assert.equal(escort.objectiveState, "damaged");

  let power = createV100StageBattle({ stageId: "stage-university-hospital-approach" }).state;
  assert.equal(power.missionType, "timed-defense");
  power = createV100StageBattle({ stageId: "stage-hospital-evacuation-route" }).state;
  assert.equal(power.objectiveState, "off");
  for (let index = 0; index < power.missionObjects.length; index += 1) {
    power = advanceV100StageBattle(power, { type: "power-node", index }).state;
    power = advanceV100StageBattle(power, { type: "power-node", index }).state;
  }
  assert.equal(power.objectiveState, "on");
  assert.equal(v100StageBattleResult(power).won, true);
  let seal = createV100StageBattle({ stageId: "stage-t-plan-central-seal" }).state;
  assert.equal(seal.objectiveState, "off");
  for (let index = 0; index < seal.missionObjects.length; index += 1) {
    seal = advanceV100StageBattle(seal, { type: "seal-node", index }).state;
    seal = advanceV100StageBattle(seal, { type: "seal-node", index }).state;
  }
  assert.equal(seal.objectiveState, "on");
  let boss = createV100StageBattle({ stageId: "stage-nishijin-defense-line-takuya" }).state;
  boss = advanceV100StageBattle(boss, { type: "boss-entrance" }).state;
  assert.equal(boss.boss.state, "telegraph");
  assert.equal(boss.boss.musicActive, true);
  boss = advanceV100StageBattle(boss, { type: "boss-hit", amount: boss.boss.maxHp }).state;
  assert.equal(boss.boss.state, "death");
  assert.equal(boss.boss.musicActive, false);
  assert.equal(advanceV100StageBattle(boss, { type: "resolve" }).reason, "objective-incomplete");
  boss = advanceV100StageBattle(boss, { type: "boss-defeat" }).state;
  assert.equal(v100StageBattleResult(boss).bossDefeated, true);
});

test("V1 battle runtime keeps the locked ownership boundary", () => {
  assert.deepEqual(v100BattleRuntimeContract(), {
    objectiveStateOwner: "v100-battle-runtime",
    bossMusicOwnerUntilDeath: "music-v099-boss",
    vehicleExcludedFromPlayableActiveCount: true,
    timedDefenseDurationSource: "locked-stage-row",
  });
});
