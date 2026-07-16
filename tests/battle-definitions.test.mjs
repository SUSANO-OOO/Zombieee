import assert from "node:assert/strict";
import test from "node:test";
import { CAMPAIGN_STAGE_BY_ID, CAMPAIGN_STAGE_IDS } from "../app/campaign.js";
import { MISSION_EVENTS, PREP_SECONDS } from "../app/gameRules.js";
import { battleOutcomeFor, createBattleDefinition, objectiveForBattle, phaseForBattle } from "../app/battleDefinitions.js";

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
