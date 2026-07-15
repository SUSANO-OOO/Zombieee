import assert from "node:assert/strict";
import test from "node:test";

import { battleOutcomeFor, createBattleDefinition } from "../app/battleDefinitions.js";
import { CAMPAIGN_STAGE_IDS } from "../app/campaign.js";
import { CONVOY_CAPACITY, advanceConvoyEvacuation } from "../app/gameRules.js";
import { getTriggeredBattleStoryEventIds } from "../app/storyFlow.js";

test("Sawara convoy progress is durable gameplay state influenced by escort strength and Crawler safety", () => {
  const strongEscort = advanceConvoyEvacuation({
    progress: 0,
    civiliansEvacuated: 0,
    dt: 30,
    humanCount: 4,
    baseHp: 100,
    baseMaxHp: 100,
  });
  const weakEscort = advanceConvoyEvacuation({
    progress: 0,
    civiliansEvacuated: 0,
    dt: 30,
    humanCount: 0,
    baseHp: 20,
    baseMaxHp: 100,
  });
  assert.ok(strongEscort.progress > weakEscort.progress);
  assert.ok(strongEscort.civiliansEvacuated > weakEscort.civiliansEvacuated);

  const paused = advanceConvoyEvacuation({ ...strongEscort, dt: 0, humanCount: 4, baseHp: 100, baseMaxHp: 100 });
  assert.deepEqual(paused, strongEscort);
});

test("successful timed defense completes the convoy once without losing evacuated count", () => {
  const completed = advanceConvoyEvacuation({
    progress: 0.73,
    civiliansEvacuated: 17,
    dt: 0,
    humanCount: 1,
    baseHp: 1,
    baseMaxHp: 100,
    missionComplete: true,
  });
  assert.deepEqual(completed, { progress: 1, civiliansEvacuated: CONVOY_CAPACITY });
});

test("a failed timed defense never completes the convoy or dispatches the success scene", () => {
  const definition = createBattleDefinition(CAMPAIGN_STAGE_IDS.SAWARA_WARD_OFFICE);
  const losingState = {
    time: definition.defenseEndAt,
    baseHp: definition.baseMaxHp * 0.009,
    baseMaxHp: definition.baseMaxHp,
    barricadeHp: 1,
  };
  const outcome = battleOutcomeFor(definition, losingState);
  assert.equal(outcome, "lost");
  const convoy = advanceConvoyEvacuation({
    progress: 0.999,
    civiliansEvacuated: CONVOY_CAPACITY - 1,
    dt: 10,
    humanCount: 9,
    baseHp: losingState.baseHp,
    baseMaxHp: losingState.baseMaxHp,
    missionComplete: outcome === "won",
  });
  assert.ok(convoy.progress < 1);
  assert.equal(convoy.civiliansEvacuated, CONVOY_CAPACITY - 1);
  const events = getTriggeredBattleStoryEventIds({
    stageId: CAMPAIGN_STAGE_IDS.SAWARA_WARD_OFFICE,
    snapshot: {
      battleStarted: true,
      elapsedSeconds: 180,
      convoyProgress: convoy.progress,
      convoyEvacuated: convoy.progress >= 1,
      outcome,
    },
  });
  assert.equal(events.includes("stage-sawara-battle-success"), false);
});

test("a successful timed defense reaches 24 of 24 and dispatches the success scene", () => {
  const definition = createBattleDefinition(CAMPAIGN_STAGE_IDS.SAWARA_WARD_OFFICE);
  const winningState = {
    time: definition.defenseEndAt,
    baseHp: definition.baseMaxHp * definition.starThresholds[1],
    baseMaxHp: definition.baseMaxHp,
    barricadeHp: 1,
  };
  const outcome = battleOutcomeFor(definition, winningState);
  assert.equal(outcome, "won");
  const convoy = advanceConvoyEvacuation({
    progress: 0.8,
    civiliansEvacuated: 19,
    dt: 0,
    humanCount: 1,
    baseHp: winningState.baseHp,
    baseMaxHp: winningState.baseMaxHp,
    missionComplete: outcome === "won",
  });
  assert.deepEqual(convoy, { progress: 1, civiliansEvacuated: CONVOY_CAPACITY });
  const events = getTriggeredBattleStoryEventIds({
    stageId: CAMPAIGN_STAGE_IDS.SAWARA_WARD_OFFICE,
    snapshot: {
      battleStarted: true,
      elapsedSeconds: 180,
      convoyProgress: convoy.progress,
      convoyEvacuated: true,
      outcome,
    },
  });
  assert.equal(events.includes("stage-sawara-battle-success"), true);
});
