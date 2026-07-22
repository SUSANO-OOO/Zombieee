import assert from "node:assert/strict";
import test from "node:test";

import {
  LANE_Y,
  advanceAreaEffects,
  advanceBleedDamage,
  createCrawlerAbilityRuntime,
  createEmergencySupportRuntime,
  resolveAirstrikeImpact,
  resolveBattlefieldSupplyLanding,
  resolveCrawlerBarrage,
  resolveDrumDetonation,
  resolveNewcomerAttackEffects,
} from "../app/gameRules.js";
import {
  createResearchContainerRuntime,
  enforceGateEaterContainmentInvariant,
  resolveContainmentStrike,
} from "../app/stationSpatialMechanics.js";

const FORMER_FLOOR = 504;

function gateEater(overrides = {}) {
  return {
    id: 71,
    side: "zombie",
    kind: "gate-eater",
    lane: 1,
    x: 520,
    y: LANE_Y[1],
    hp: 520,
    maxHp: 1800,
    bodyRadius: 42,
    combatReady: true,
    gateEntering: false,
    contained: false,
    targetId: 12,
    targetObjectId: null,
    bleedRemaining: 0,
    bleedDamagePerSecond: 0,
    ...overrides,
  };
}

function finalize(boss) {
  return enforceGateEaterContainmentInvariant(boss);
}

function assertChannelCanKill(channel, first, next, limit = 100) {
  let boss = finalize(first(gateEater()));
  assert.ok(boss.hp < FORMER_FLOOR && boss.hp > 0, `${channel} must pass below 504 before death`);
  for (let index = 0; boss.hp > 0 && index < limit; index += 1) {
    const before = boss.hp;
    boss = finalize(next(boss));
    assert.ok(boss.hp < before, `${channel} must keep reducing HP`);
  }
  assert.equal(boss.hp, 0, `${channel} must reach zero`);
  assert.equal(boss.combatReady, false, `${channel} must leave a dead boss inactive`);
}

test("every required combat damage channel passes 504 and can kill Gate Eater", () => {
  const strike = (damage) => (boss) => resolveContainmentStrike({
    boss,
    researchContainer: createResearchContainerRuntime({ researchContainerStartX: 708 }),
    attackDamage: damage,
    powerActivated: 3,
    sealDoorX: 867,
  }).boss;

  assertChannelCanKill("melee overkill", strike(20), strike(9999), 1);
  assertChannelCanKill("rapid ranged fire", strike(17), strike(17), 40);

  const airstrike = (boss) => resolveAirstrikeImpact({
    runtime: {
      ...createEmergencySupportRuntime(),
      phase: "impact",
      targetX: boss.x,
      targetLane: boss.lane,
      impactTriggered: false,
    },
    fighters: [boss],
  }).fighters[0];
  assertChannelCanKill("airstrike support", airstrike, airstrike, 5);

  const barrage = (boss) => resolveCrawlerBarrage({
    runtime: { ...createCrawlerAbilityRuntime(1), phase: "firing", damageTriggered: false },
    fighters: [boss],
  }).fighters[0];
  assertChannelCanKill("CRAWLER support barrage", barrage, barrage, 25);

  let podId = 100;
  const podLanding = (boss) => resolveBattlefieldSupplyLanding({
    supply: {
      id: podId++,
      kind: "pod",
      lane: boss.lane,
      x: boss.x,
      y: boss.y,
      phase: "dropping",
      phaseTime: 0,
      hp: 260,
      maxHp: 260,
      blocksEnemies: false,
      targetable: false,
      landingTriggered: false,
      readyToLand: true,
    },
    fighters: [boss],
  }).fighters[0];
  assertChannelCanKill("pod landing area", podLanding, podLanding, 10);

  let drumId = 200;
  const drumBlast = (boss) => resolveDrumDetonation({
    supply: {
      id: drumId++,
      kind: "drum",
      lane: boss.lane,
      x: boss.x,
      y: boss.y,
      phase: "detonating",
      hp: 90,
      maxHp: 90,
      blocksEnemies: false,
      targetable: false,
      detonationTriggered: false,
    },
    fighters: [boss],
  }).fighters[0];
  assertChannelCanKill("drum blast area", drumBlast, drumBlast, 6);

  const burn = (seconds) => (boss) => advanceAreaEffects({
    areaEffects: [{
      id: 301,
      kind: "burn",
      sourceSupplyId: 201,
      lane: boss.lane,
      x: boss.x,
      y: boss.y,
      radius: 88,
      amountPerSecond: 15,
      remaining: 60,
      phase: "active",
      slowMultiplier: .8,
    }],
    fighters: [boss],
    seconds,
  }).fighters[0];
  assertChannelCanKill("burn damage over time", burn(2), burn(60), 1);

  const areaStrike = (damage) => (boss) => {
    const effects = resolveNewcomerAttackEffects({
      unitKind: "crazy-king",
      target: gateEater({ id: 72, hp: 1000 }),
      nearbyTargets: [boss],
      attackDamage: damage,
      areaRadius: 140,
    });
    return effects.secondaryTargets[0];
  };
  assertChannelCanKill("unit area attack", areaStrike(50), areaStrike(9999), 1);

  const bleedCycle = (boss) => {
    const bleeding = resolveNewcomerAttackEffects({
      unitKind: "crazy-king",
      target: boss,
      attackDamage: 1,
    }).target;
    return advanceBleedDamage(bleeding, bleeding.bleedRemaining);
  };
  assertChannelCanKill("bleed damage over time", bleedCycle, bleedCycle, 30);
});
