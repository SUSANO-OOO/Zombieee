import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
import { V100_BOSSES, V100_STAGES } from "../app/v100Registry.js";
import { createBattleDefinition } from "../app/battleDefinitions.js";
import { enemyStatsForWave, enemyContentFor, enemyInitialAbilityCooldownFor, enemyBodyRadiusFor, enemyLaneSpeedFor } from "../app/content/enemyCatalog.js";
import { bossPhaseForHp, bossHudSnapshot, bossFinalPhase, bossControlMultiplier, bossSlowMultiplier, bossAbilityPressure, registerV100Twin, resolveV100TwinDefeat, futagoEnraged, bossBattleHudSnapshot, bossRenderKind, v100TwinSeparationSteps } from "../app/bossFoundation.js";
import { motherBroodSummonPlan, beginBossAnomalyAbility } from "../app/bossAnomalies.js";

const source = await readFile("app/AshfallGame.tsx", "utf8");
const ast = ts.createSourceFile("AshfallGame.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const spawn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "spawnEnemy");
assert.ok(spawn, "Test must execute the production spawn function");
const compile = text => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const spawnEnemy = vm.runInNewContext(compile(spawn.getText(ast) + "\nspawnEnemy;"), {
  enemyStatsForWave, enemyContentFor, enemyInitialAbilityCooldownFor,
  registerV100Twin,
  bodyRadiusFor: enemyBodyRadiusFor, enemyLaneSpeedFor,
  WORLD_GEOMETRY: { barricade: { enemySpawnMinX: 900, enemySpawnMaxX: 960 } },
  laneY: lane => 212 + lane * 70,
  createCombatAnimationRuntime: () => ({}), createNavigationRecoveryState: () => ({}),
  createStationAbilityRuntime: () => ({}), createUnitRoleRuntime: () => ({}),
});

for (const boss of V100_BOSSES) test(`${boss.id}: actual production spawn and HUD use fixed V1 values`, () => {
  const definition = createBattleDefinition(V100_STAGES[boss.stageNumber - 1].id, { v100: true });
  const game = { definition, fighters: [], enemyKindsSeen: [], nextId: 1, wave: 99 };
  const fighter = spawnEnemy(game, definition.bossEnemyKind, 1);
  assert.equal(fighter, game.fighters[0]);
  assert.equal(fighter.v100BossId, boss.id);
  assert.equal(fighter.hp, boss.hp); assert.equal(fighter.maxHp, boss.hp);
  assert.equal(fighter.damage, boss.damage); assert.equal(fighter.attackEvery, boss.cadenceSeconds);
  if (boss.id !== "boss-futago") for (const [index, threshold] of boss.phaseThresholds.entries()) {
    fighter.hp = boss.hp * (threshold + .00001);
    assert.equal(bossHudSnapshot(fighter).phase.phase, index + 1);
    fighter.hp = boss.hp * threshold;
    assert.equal(bossHudSnapshot(fighter).phase.phase, index + 2);
  }
  fighter.hp = boss.hp * .35;
  if (["takuya", "kurome"].includes(fighter.kind)) assert.equal(bossFinalPhase(fighter, .5), true);
  const legacy = { definition: { missionConfig: {} }, fighters: [], enemyKindsSeen: [], nextId: 1, wave: 99 };
  const old = spawnEnemy(legacy, definition.bossEnemyKind, 1), expected = enemyStatsForWave(definition.bossEnemyKind, 99);
  assert.equal(old.v100BossId, undefined);
  for (const key of ["hp", "damage", "attackEvery"]) assert.equal(old[key], expected[key]);
});

test("actual control timers and displacement retain the locked resistance without changing legacy actors", () => {
  let stun, knock;
  const visit = node => {
    if (ts.isExpressionStatement(node) && node.getText(ast).startsWith("f.stunned = Math.max(0, f.stunned -")) stun = node.getText(ast);
    if (ts.isIfStatement(node) && node.expression.getText(ast) === "Math.abs(f.knock) > .1") knock = node.getText(ast);
    ts.forEachChild(node, visit);
  };
  visit(ast); assert.ok(stun); assert.ok(knock);
  for (const boss of V100_BOSSES) {
    const multiplier = 1 - boss.resistance / 100;
    const fighter = { side: "zombie", kind: boss.id.slice(5), v100BossId: boss.id, stunned: 1, knock: 10, x: 0 };
    const dt = .1;
    vm.runInNewContext(compile(stun + "\n" + knock), { f: fighter, dt, bossControlMultiplier });
    assert.ok(Math.abs(fighter.stunned - Math.max(0, 1 - dt / multiplier)) < 1e-12);
    assert.ok(Math.abs(fighter.x - 10 * multiplier * dt * 6) < 1e-12);
    assert.ok(Math.abs(bossSlowMultiplier(fighter, .4) - (1 - .6 * multiplier)) < 1e-12);
    assert.equal(bossSlowMultiplier(fighter, 1), 1);
  }
  assert.equal(bossControlMultiplier({ side: "zombie", kind: "takuya" }), 1);
  assert.equal(bossSlowMultiplier({ side: "human", kind: "guardian" }, .4), .4);
  assert.equal(bossPhaseForHp(70, 100, "takuya").phase, 2);
});

test("production FUTAGO spawns two source-bound bodies; first death enrages the survivor and last death resolves once", () => {
  const definition = createBattleDefinition(V100_STAGES[23].id, { v100: true });
  assert.equal(definition.timeline.flatMap(event => event.units).filter(kind => kind === "futago").length, 2);
  for (const firstDead of [0, 1]) {
    const game = { definition, fighters: [], enemyKindsSeen: [], nextId: 1, wave: 4 };
    const pair = [spawnEnemy(game, "futago", 0), spawnEnemy(game, "futago", 2)];
    assert.deepEqual(pair.map(fighter => fighter.maxHp), [3000, 3000]);
    assert.deepEqual(pair.map(bossRenderKind), ["futago-separated-a", "futago-separated-b"]);
    assert.notEqual(pair[0].id, pair[1].id);
    pair[0].hp = 800;
    assert.equal(pair[1].hp, 3000, "damage is independent");
    assert.equal(futagoEnraged(pair[0]), false, "own low HP cannot stand in for the other body's death");
    assert.equal(bossBattleHudSnapshot(game).hp, 3800);
    assert.deepEqual(bossBattleHudSnapshot(game).twins.map(twin => twin.hp), [800, 3000]);
    const dead = pair[firstDead], survivor = pair[1 - firstDead];
    survivor.stationAbility = Object.freeze({ phase: "warning", remainingSeconds: 1.1, targetId: "human-1", split: false });
    dead.hp = 0;
    assert.deepEqual(resolveV100TwinDefeat(game, dead), { complete: false, enragedIds: [survivor.id] });
    assert.equal(survivor.v100TwinEnraged, true);
    assert.equal(survivor.stationAbility.remainingSeconds, 1.1);
    assert.equal(survivor.stationAbility.targetId, "human-1");
    assert.equal(survivor.stationAbility.split, true);
    assert.equal(bossBattleHudSnapshot(game).phase.label, "残存個体・激昂");
    assert.equal(bossAbilityPressure(survivor), 1.12);
    assert.equal(beginBossAnomalyAbility({ boss: survivor, candidates: [{ id: "human-1", side: "human", hp: 100, x: 800, y: survivor.y }] }).runtime.split, true);
    assert.equal(resolveV100TwinDefeat(game, dead).complete, false);
    survivor.hp = 0;
    assert.equal(resolveV100TwinDefeat(game, survivor).complete, true);
    assert.equal(resolveV100TwinDefeat(game, survivor).complete, false, "one source-boss completion even for a simultaneous defeat");
    assert.equal(bossBattleHudSnapshot(game), null);
    assert.equal(bossRenderKind({ kind: "futago", v100TwinPart: dead.v100TwinPart }), `futago-separated-${dead.v100TwinPart}`, "corpse retains individual identity");
  }
});

test("a FUTAGO death before the second gate entry cannot expose the base or skip that body", () => {
  const definition = createBattleDefinition(V100_STAGES[23].id, { v100: true });
  const game = { definition, fighters: [], enemyKindsSeen: [], nextId: 1, wave: 4 };
  const first = spawnEnemy(game, "futago", 0);
  assert.equal(bossBattleHudSnapshot(game).twins[1].arriving, true);
  first.hp = 0;
  assert.equal(resolveV100TwinDefeat(game, first).complete, false);
  game.fighters = [];
  const second = spawnEnemy(game, "futago", 2);
  assert.equal(second.v100TwinPart, "b");
  assert.equal(second.v100TwinEnraged, true);
  assert.equal(second.hp, 3000);
  second.hp = 0;
  assert.equal(resolveV100TwinDefeat(game, second).complete, true);
  assert.equal(futagoEnraged({ hp: 61, maxHp: 100 }), true, "legacy fused HP phase remains unchanged");
});

test("both physical twins separate during frozen special attacks and stop after one dies", () => {
  const definition = createBattleDefinition(V100_STAGES[23].id, { v100: true });
  const game = { definition, fighters: [], enemyKindsSeen: [], nextId: 1, wave: 4 };
  const pair = [spawnEnemy(game, "futago", 1), spawnEnemy(game, "futago", 1)];
  for (const fighter of pair) { fighter.x = 600; fighter.y = 280; fighter.stationAbility = Object.freeze({ phase: "active", remainingSeconds: 2.5, split: false }); }
  for (let tick = 0; tick < 120; tick++) for (const step of v100TwinSeparationSteps(game, 1 / 60)) {
    const fighter = game.fighters.find(f => f.id === step.id);
    assert.ok(Math.abs(step.x - fighter.x) <= .8 + 1e-9, "continuous collision correction, no teleport");
    Object.assign(fighter, step);
  }
  assert.ok(Math.abs(pair[0].x - pair[1].x) >= 92 - 1e-8);
  assert.ok(pair.every(f => f.stationAbility.remainingSeconds === 2.5 && f.hp === 3000));
  pair[0].hp = 0; assert.deepEqual(v100TwinSeparationSteps(game, 1), []);
  pair[0].hp = 3000; pair[0].x = pair[1].x; pair[0].gateEntering = true;
  assert.deepEqual(v100TwinSeparationSteps(game, 1), [], "the hidden gate-entry contract stays intact");
});

test("V1 MOTHER summons four then six C-compatible brood, retaining its per-owner cap", () => {
  const definition = createBattleDefinition(V100_STAGES[10].id, { v100: true });
  const game = { definition, fighters: [], enemyKindsSeen: [], nextId: 1, wave: 1 };
  const mother = spawnEnemy(game, "mother", 1);
  assert.equal(motherBroodSummonPlan({ boss: mother }).length, 4);
  mother.hp = mother.maxHp * .4;
  const plan = motherBroodSummonPlan({ boss: mother });
  assert.equal(plan.length, 6);
  assert.ok(plan.every(entry => ["runner", "spitter", "ooze"].includes(entry.kind)));
  const owned = plan.map((entry, id) => ({ ...entry, id, side: "zombie", hp: 1, summonOwnerId: mother.id, summonSource: "mother-brood" }));
  assert.equal(motherBroodSummonPlan({ boss: mother, candidates: owned }).length, 3);
  assert.equal(motherBroodSummonPlan({ boss: mother, candidates: [...owned, ...owned.slice(0, 3)] }).length, 0);
  assert.equal(motherBroodSummonPlan({ boss: { ...mother, v100BossId: undefined } }).length, 3);
});

test("actual ability recovery increases pressure at fixed HP phases without shortening telegraphs", () => {
  let cooldown;
  const visit = node => {
    if (ts.isExpressionStatement(node) && node.getText(ast).startsWith("f.abilityCooldown = Math.max(0, f.abilityCooldown - dt")) cooldown = node.getText(ast);
    ts.forEachChild(node, visit);
  };
  visit(ast); assert.ok(cooldown);
  for (const boss of V100_BOSSES.filter(boss => boss.id !== "boss-futago")) {
    const fighter = { side: "zombie", kind: boss.id.slice(5), v100BossId: boss.id, hp: boss.hp, maxHp: boss.hp, abilityCooldown: 3, abilityWindup: 1.2 };
    for (const [index, hpRatio] of [1, ...boss.phaseThresholds].entries()) {
      fighter.hp = boss.hp * hpRatio; fighter.abilityCooldown = 3;
      vm.runInNewContext(compile(cooldown), { f: fighter, dt: .1, bossAbilityPressure });
      assert.ok(Math.abs(fighter.abilityCooldown - (3 - .1 * (1 + .12 * index))) < 1e-12);
      assert.equal(fighter.abilityWindup, 1.2);
    }
  }
});
