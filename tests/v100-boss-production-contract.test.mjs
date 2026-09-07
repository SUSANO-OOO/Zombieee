import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
import { V100_BOSSES, V100_STAGES } from "../app/v100Registry.js";
import { createBattleDefinition } from "../app/battleDefinitions.js";
import { enemyStatsForWave, enemyContentFor, enemyInitialAbilityCooldownFor, enemyBodyRadiusFor, enemyLaneSpeedFor } from "../app/content/enemyCatalog.js";
import { bossPhaseForHp, bossHudSnapshot, bossFinalPhase, bossControlMultiplier, bossSlowMultiplier } from "../app/bossFoundation.js";

const source = await readFile("app/AshfallGame.tsx", "utf8");
const ast = ts.createSourceFile("AshfallGame.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const spawn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "spawnEnemy");
assert.ok(spawn, "Test must execute the production spawn function");
const compile = text => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const spawnEnemy = vm.runInNewContext(compile(spawn.getText(ast) + "\nspawnEnemy;"), {
  enemyStatsForWave, enemyContentFor, enemyInitialAbilityCooldownFor,
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
