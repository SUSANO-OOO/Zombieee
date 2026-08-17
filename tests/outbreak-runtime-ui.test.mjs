import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  battleOutcomeFor,
  createBattleDefinition,
  objectiveForBattle,
} from "../app/battleDefinitions.js";
import { OUTBREAK_MISSIONS } from "../app/outbreakMissions.js";
import { stageVisualFor } from "../app/productionVisuals.js";

function outbreakState(overrides = {}) {
  return {
    baseHp: 620,
    baseMaxHp: 620,
    bossDefeated: false,
    fighters: [],
    enemySpawn: { pending: [] },
    eventIndex: 0,
    barricadeHp: 1000,
    barricadeVulnerable: false,
    stageMission: {},
    ...overrides,
  };
}

test("all five outbreak operations build real boss-assault definitions on their authored battlefield", () => {
  for (const mission of OUTBREAK_MISSIONS) {
    const definition = createBattleDefinition(mission.id);
    assert.equal(definition.operationId, mission.id);
    assert.equal(definition.operationCategory, "outbreak");
    assert.equal(definition.stageId, mission.prerequisiteStageId);
    assert.equal(definition.displayName, mission.displayName);
    assert.equal(definition.missionType, "boss-assault");
    assert.equal(definition.enemyBaseMode, "scenery");
    assert.equal(definition.bossUnlocksEnemyBase, false);
    assert.equal(definition.startsEnemyBaseVulnerable, false);
    assert.equal(definition.bossEnemyKind, mission.boss.enemyKind);
    assert.equal(definition.missionConfig.outbreakMissionId, mission.id);
    assert.equal(definition.missionConfig.spawnProfile, "right-edge-outside-boss");
    assert.equal(definition.timeline.length, mission.waves.length);
    assert.equal(definition.timeline.at(-1).units.includes(mission.boss.enemyKind), true);
    assert.equal(stageVisualFor(mission.id), stageVisualFor(mission.prerequisiteStageId));
  }
});

test("outbreak victory requires boss defeat, every wave, pending spawn, and living infected to be resolved", () => {
  const definition = createBattleDefinition(OUTBREAK_MISSIONS[0].id);
  const completeEventIndex = definition.timeline.length;
  assert.equal(battleOutcomeFor(definition, outbreakState()), null);
  assert.equal(battleOutcomeFor(definition, outbreakState({
    bossDefeated: true,
    eventIndex: completeEventIndex - 1,
  })), null);
  assert.equal(battleOutcomeFor(definition, outbreakState({
    bossDefeated: true,
    eventIndex: completeEventIndex,
    enemySpawn: { pending: [{ kind: "runner" }] },
  })), null);
  assert.equal(battleOutcomeFor(definition, outbreakState({
    bossDefeated: true,
    eventIndex: completeEventIndex,
    fighters: [{ side: "zombie", hp: 1, contained: false }],
  })), null);
  assert.equal(battleOutcomeFor(definition, outbreakState({
    bossDefeated: true,
    eventIndex: completeEventIndex,
  })), "won");
  assert.equal(battleOutcomeFor(definition, outbreakState({
    baseHp: 0,
    bossDefeated: true,
    eventIndex: completeEventIndex,
  })), "lost");
  assert.equal(objectiveForBattle(definition, outbreakState()), definition.objective);
  assert.equal(objectiveForBattle(definition, outbreakState({ bossDefeated: true })), "残存感染体を掃討");
});

test("player-facing outbreak route commits one atomic campaign save before publishing rewards", async () => {
  const [game, screens, css] = await Promise.all([
    readFile(new URL("../app/AshfallGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/CampaignScreens.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/campaign.css", import.meta.url), "utf8"),
  ]);
  assert.match(screens, /"outbreak" \| "outbreak-result"/);
  assert.match(screens, /OUTBREAK OPERATIONS[\s\S]*異常発生任務[\s\S]*Survivalのboss抽選へ追加/);
  assert.match(screens, /bossImagePath[\s\S]*初回固有装備[\s\S]*この任務の編成へ/);
  assert.match(game, /const openOutbreak[\s\S]*setScreen\("outbreak"\)/);
  assert.match(game, /const requestBattle[\s\S]*selectedOutbreakMissionId[\s\S]*createBattleResultId\(selectedOutbreakMissionId\)/);
  assert.match(game, /storyFlowState: definitionOptions\.v100[\s\S]*createBattleStoryFlowState\(definition\.stageId\)/);
  assert.ok((game.match(/stageId: g\.definition\.operationId/g)?.length ?? 0) >= 2);
  assert.match(game, /const isOutbreakBoss = g\.definition\.operationCategory === "outbreak"[\s\S]*if \(!isOutbreakBoss\) g\.barricadeVulnerable = true/);
  assert.match(game, /persistOutbreakCampaignSettlement\([\s\S]*persist: async \(candidate: CampaignSave\) => \{[\s\S]*outbreakSettlementPersistenceQaRef\.current\.attempts \+= 1[\s\S]*return persistCampaignSave\(candidate\)/);
  assert.match(game, /if \(!settlement\.committed\)[\s\S]*setPendingOutbreakSettlement\(pending\)[\s\S]*setSavePersistence\("unavailable"\)/);
  assert.match(game, /setCampaignSave\(nextSave\)[\s\S]*setOutbreakResult\([\s\S]*setScreen\("outbreak-result"\)/);
  assert.match(game, /撃破記録、Survival解放、receipt、キャップ、装備数量、last result、revision、integrity/);
  assert.match(css, /\.outbreak-layout \{[^}]*grid-template-columns/);
  assert.match(css, /@media \(max-height:430px\)[\s\S]*\.outbreak-layout/);
  assert.match(css, /@media \(max-width:760px\) and \(orientation:landscape\)[\s\S]*\.outbreak-detail/);
});
