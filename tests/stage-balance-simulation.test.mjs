import assert from "node:assert/strict";
import test from "node:test";
import {
  CAMPAIGN_FORMATION_MAX_SLOTS,
  CAMPAIGN_STAGE_IDS,
  CAMPAIGN_STAGES,
} from "../app/campaign.js";
import {
  COMMAND_INITIAL,
  COMMAND_MAX,
  COMMAND_REGEN,
} from "../app/gameRules.js";
import {
  P4_BALANCE_FORMATIONS,
  STAGE_BALANCE_REFERENCE_FORMATIONS,
  formationIntersection,
  simulateStageBalance,
  stageBalanceWaveFacts,
} from "../app/stageBalanceSimulation.js";

test("balance facts are derived from all six canonical wave schedules", () => {
  assert.equal(CAMPAIGN_STAGES.length, 6);
  for (const stage of CAMPAIGN_STAGES) {
    const facts = stageBalanceWaveFacts(stage.id);
    const expectedEnemyCount = stage.waves.reduce((total, wave) => (
      total + (wave.units?.length ?? wave.groups.reduce((sum, group) => sum + group.count, 0))
    ), 0);
    assert.equal(facts.waveCount, stage.waves.length, stage.id);
    assert.equal(facts.enemyCount, expectedEnemyCount, stage.id);
    assert.equal(facts.firstWaveAtSeconds, stage.waves[0].atSeconds + 5, stage.id);
    assert.equal(facts.lastWaveAtSeconds, stage.waves.at(-1).atSeconds + 5, stage.id);
    assert.deepEqual(
      facts.waves.map(({ atSeconds }) => atSeconds),
      stage.waves.map(({ atSeconds }) => atSeconds + 5),
      stage.id,
    );
  }
});

test("reference simulations use the seven-slot limit and current COMMAND economy", () => {
  for (const stage of CAMPAIGN_STAGES) {
    const formation = STAGE_BALANCE_REFERENCE_FORMATIONS[stage.id];
    const result = simulateStageBalance({ stageId: stage.id, formation, seed: "economy-proof" });
    assert.ok(result.slotCount >= 1 && result.slotCount <= CAMPAIGN_FORMATION_MAX_SLOTS, stage.id);
    assert.equal(result.command.initial, COMMAND_INITIAL);
    assert.equal(result.command.maximum, COMMAND_MAX);
    assert.equal(result.command.regenPerSecond, COMMAND_REGEN);
    assert.equal(result.command.deployments.length, formation.length, stage.id);
    assert.ok(result.command.deployments.every(({ commandAfter }) => commandAfter >= 0 && commandAfter <= COMMAND_MAX));
    assert.equal(
      result.command.spent,
      result.command.deployments.reduce((sum, deployment) => sum + deployment.cost, 0),
      stage.id,
    );
  }
});

test("Stage 1-3 clear with seven-slot-era formations and exercise every scheduled wave", () => {
  for (const stage of CAMPAIGN_STAGES.slice(0, 3)) {
    const result = simulateStageBalance({
      stageId: stage.id,
      formation: STAGE_BALANCE_REFERENCE_FORMATIONS[stage.id],
      seed: `early-${stage.stageNumber}`,
    });
    assert.equal(result.outcome, "won", `${stage.id}: ${JSON.stringify(result)}`);
    assert.ok(result.baseHp > 0, stage.id);
    assert.equal(result.waves.spawned, result.waves.scheduled, stage.id);
    assert.ok(result.waves.totalUnitDamage > 0, stage.id);
    assert.ok(result.waves.totalEnemyWork > 0, stage.id);
  }
});

test("Stage 4-6 each have three successful formations with no mandatory unit", () => {
  for (const stage of CAMPAIGN_STAGES.slice(3)) {
    const formations = P4_BALANCE_FORMATIONS[stage.id];
    assert.equal(formations.length >= 3, true, stage.id);
    assert.deepEqual(formationIntersection(formations), [], `${stage.id} has a hidden mandatory pick`);
    for (const [index, formation] of formations.entries()) {
      const result = simulateStageBalance({
        stageId: stage.id,
        formation,
        seed: `p4-${stage.stageNumber}-${index}`,
      });
      assert.equal(result.outcome, "won", `${stage.id}/${index}: ${JSON.stringify(result)}`);
      assert.ok(result.baseHp > 0, `${stage.id}/${index}`);
      assert.ok(result.slotCount <= CAMPAIGN_FORMATION_MAX_SLOTS, `${stage.id}/${index}`);
      assert.equal(result.waves.spawned, result.waves.scheduled, `${stage.id}/${index}`);
      if (stage.id === CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_TUNNEL) {
        assert.equal(result.stationMission.gateEaterContained, true, `${stage.id}/${index}`);
        assert.equal(result.stationMission.researchContainerContained, true, `${stage.id}/${index}`);
        assert.equal(result.stationMission.sealed, true, `${stage.id}/${index}`);
        assert.equal(result.stationMission.completed, true, `${stage.id}/${index}`);
        assert.equal(result.waves.defeatedKinds.includes("gate-eater"), false, `${stage.id}/${index}`);
      }
    }
  }
});

test("station wins are produced by the shared escort and sequential-seal state machines", () => {
  const escort = simulateStageBalance({
    stageId: CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_PLATFORM,
    formation: P4_BALANCE_FORMATIONS[CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_PLATFORM][0],
    seed: "escort-state-machine",
  });
  assert.equal(escort.stationMission.missionType, "escort");
  assert.equal(escort.stationMission.completed, true);
  assert.equal(escort.stationMission.progress, 1);
  assert.equal(escort.stoppedBy, "escort-complete");

  const seal = simulateStageBalance({
    stageId: CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_TUNNEL,
    formation: P4_BALANCE_FORMATIONS[CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_TUNNEL][0],
    seed: "seal-state-machine",
  });
  assert.equal(seal.stationMission.missionType, "sequential-seal");
  assert.equal(seal.stationMission.powerActivated, 3);
  assert.equal(seal.stationMission.gateEaterSeen, true);
  assert.equal(seal.stationMission.gateEaterContained, true);
  assert.equal(seal.stationMission.researchContainerExposed, true);
  assert.equal(seal.stationMission.researchContainerContained, true);
  assert.equal(seal.stationMission.sealed, true);
  assert.equal(seal.stationMission.returnTargetCount, seal.command.deployments.length);
  assert.equal(seal.stationMission.returnedCount, seal.stationMission.returnTargetCount);
  assert.ok(seal.stationMission.escapeRemaining > 0);
  assert.ok(seal.stationMission.escapeRemaining <= 45);
  assert.equal(seal.stationMission.completed, true);
  assert.equal(seal.stoppedBy, "return-complete");
  assert.equal(seal.waves.defeatedKinds.includes("gate-eater"), false);
});

test("underfilled squads lose because unresolved wave pressure reaches the objective", () => {
  for (const stageId of [
    CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET,
    CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_PLATFORM,
    CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_TUNNEL,
  ]) {
    const result = simulateStageBalance({
      stageId,
      formation: ["medic"],
      seed: `underfilled-${stageId}`,
    });
    assert.equal(result.outcome, "lost", `${stageId}: ${JSON.stringify(result)}`);
    assert.ok(
      result.pressure.objectiveDamage > 0 || result.stationMission.failed === true,
      stageId,
    );
    assert.ok(result.waves.remainingEnemies.length > 0 || result.baseHp === 0, stageId);
  }
});

test("role counters materially improve matched formations rather than acting as a constant pass flag", () => {
  const stageId = CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_TUNNEL;
  const formation = ["guardian", "ranger", "gunner", "medic", "scout"];
  const matched = simulateStageBalance({
    stageId,
    formation,
    seed: "counter-proof",
    roleCounters: true,
  });
  const neutral = simulateStageBalance({
    stageId,
    formation,
    seed: "counter-proof",
    roleCounters: false,
  });
  assert.ok(
    matched.elapsedSeconds < neutral.elapsedSeconds
      || matched.baseHp > neutral.baseHp
      || (matched.outcome === "won" && neutral.outcome === "lost"),
    JSON.stringify({ matched, neutral }),
  );
});

test("the same seed is exactly repeatable", () => {
  const options = {
    stageId: CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE,
    formation: STAGE_BALANCE_REFERENCE_FORMATIONS[CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE],
    seed: "repeatable-seed",
  };
  assert.deepEqual(simulateStageBalance(options), simulateStageBalance(options));
});

test("invalid or oversized formations are rejected", () => {
  assert.throws(
    () => simulateStageBalance({
      stageId: CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET,
      formation: [],
    }),
    /at least one/,
  );
  assert.throws(
    () => simulateStageBalance({
      stageId: CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET,
      formation: ["scout", "scout"],
    }),
    /duplicate/,
  );
  assert.throws(
    () => simulateStageBalance({
      stageId: CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET,
      formation: ["scout", "ranger", "brute", "brawler", "gunner", "medic", "crazy-king", "kumaverson"],
    }),
    /exceeds 7 slots/,
  );
});
