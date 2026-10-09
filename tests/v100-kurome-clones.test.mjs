import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
import { V100_STAGES } from "../app/v100Registry.js";
import { createBattleDefinition } from "../app/battleDefinitions.js";
import { enemyStatsForWave, enemyContentFor, enemyInitialAbilityCooldownFor, enemyBodyRadiusFor, enemyLaneSpeedFor } from "../app/content/enemyCatalog.js";
import { enemyRenderedVisualHalfWidth } from "../app/battleSpace.js";
import { clampToWalkable, stageGeometryFor, STAGE_VIEWPORT_IDS } from "../app/stageGeometry.js";
import { registerV100Twin, resolveV100TwinDefeat, bossHudSnapshot, isBossFighter } from "../app/bossFoundation.js";
import { createKuromeTrackingRuntime, V100_KUROME_CLONE_TUNING, isKuromeClone, kuromeCloneSpawnPlan, dissolveOrphanedKuromeClones } from "../app/kuromeBoss.js";

const source = await readFile("app/AshfallGame.tsx", "utf8");
const ast = ts.createSourceFile("AshfallGame.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const compile = text => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const functions = ["spawnEnemy", "spawnKuromePhaseClones"].map(name => {
  const node = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.ok(node, `actual production function ${name}`); return node.getText(ast);
});
const runtime = vm.runInNewContext(compile(functions.join("\n") + "\n({spawnEnemy,spawnKuromePhaseClones});"), {
  enemyStatsForWave, enemyContentFor, enemyInitialAbilityCooldownFor, registerV100Twin,
  bodyRadiusFor: enemyBodyRadiusFor, enemyLaneSpeedFor, kuromeCloneSpawnPlan, V100_KUROME_CLONE_TUNING,
  clampToWalkable, enemyRenderedVisualHalfWidth,
  WORLD_GEOMETRY: { barricade: { enemySpawnMinX: 900, enemySpawnMaxX: 960 } },
  laneY: lane => 212 + lane * 70,
  createCombatAnimationRuntime: () => ({}), createNavigationRecoveryState: () => ({}),
  createStationAbilityRuntime: createKuromeTrackingRuntime, createUnitRoleRuntime: () => ({}),
});
function fixture(viewport = STAGE_VIEWPORT_IDS.STANDARD) {
  const definition = createBattleDefinition(V100_STAGES[16].id, { v100: true });
  const g = { definition, fighters: [], enemyKindsSeen: [], nextId: 1, wave: 4 };
  const geometry = stageGeometryFor(definition.stageId, viewport), lanes = geometry.lanes.map(lane => lane.y);
  const boss = runtime.spawnEnemy(g, "kurome", 1);
  boss.x = 610; boss.y = lanes[1];
  return { g, boss, geometry, lanes };
}

test("actual Kurome production spawn uses fixed phase thresholds, two grounded echoes and no recursive bosses", () => {
  for (const viewport of Object.values(STAGE_VIEWPORT_IDS)) {
    const { g, boss, geometry, lanes } = fixture(viewport);
    assert.equal(runtime.spawnKuromePhaseClones(g, boss, lanes, geometry).length, 0);
    boss.hp = 2870;
    const clones = runtime.spawnKuromePhaseClones(g, boss, lanes, geometry);
    assert.equal(clones.length, 2); assert.equal(boss.v100ClonePhase, 2);
    assert.equal(new Set([boss, ...clones].map(f => f.id)).size, 3);
    for (const clone of clones) {
      assert.equal(clone.hp, 410); assert.equal(clone.damage, 17);
      assert.equal(clone.v100BossId, undefined); assert.equal(clone.summonOwnerId, boss.id);
      assert.equal(isKuromeClone(clone), true); assert.equal(isBossFighter(clone), false);
      assert.equal(bossHudSnapshot(clone), null); assert.equal(clone.combatReady, true);
      assert.equal(clone.stationAbility.phase, "idle"); assert.equal(Object.isFrozen(clone.stationAbility), true);
      assert.ok(Number.isFinite(clone.x) && Number.isFinite(clone.y));
      const expected = clampToWalkable(geometry, { ...clone, bodyRadius: enemyRenderedVisualHalfWidth("kurome") * .7 });
      assert.equal(clone.x, expected.x); assert.equal(clone.y, expected.y);
      assert.equal(kuromeCloneSpawnPlan(clone, g.fighters).clones.length, 0);
    }
    assert.notEqual(clones[0].x, clones[1].x);
    assert.equal(runtime.spawnKuromePhaseClones(g, boss, lanes, geometry).length, 0);
    clones[0].hp = 0;
    assert.equal(runtime.spawnKuromePhaseClones(g, boss, lanes, geometry).length, 0, "no endless respawn within a phase");
    boss.hp = 1435;
    assert.equal(runtime.spawnKuromePhaseClones(g, boss, lanes, geometry).length, 1);
    assert.equal(g.fighters.filter(f => isKuromeClone(f) && f.hp > 0).length, 2);
    assert.equal(runtime.spawnKuromePhaseClones(g, boss, lanes, geometry).length, 0);
    boss.hp = boss.maxHp;
    assert.equal(runtime.spawnKuromePhaseClones(g, boss, lanes, geometry).length, 0);
    assert.equal(boss.v100ClonePhase, 3, "enemy healing cannot reset the two summon triggers");
    g.fighters.filter(isKuromeClone).forEach(clone => { clone.hp = 0; });
    boss.hp = 410;
    assert.equal(runtime.spawnKuromePhaseClones(g, boss, lanes, geometry).length, 0);
    assert.equal(kuromeCloneSpawnPlan({ ...boss, v100BossId: undefined }, []).clones.length, 0);
  }
});

test("burst phase damage is bounded; owner death dissolves only its own live clones", () => {
  const { g, boss, geometry, lanes } = fixture();
  boss.hp = 410;
  const clones = runtime.spawnKuromePhaseClones(g, boss, lanes, geometry);
  assert.equal(clones.length, 2); assert.equal(boss.v100ClonePhase, 3);
  const other = { ...boss, id: 999, hp: 1 }, otherClone = { ...clones[0], id: 1000, summonOwnerId: 999 };
  g.fighters.push(other, otherClone);
  boss.hp = 0; dissolveOrphanedKuromeClones(g.fighters);
  assert.ok(clones.every(f => f.hp === 0 && f.kuromeCloneDissolved));
  assert.equal(otherClone.hp, 410); assert.equal(otherClone.kuromeCloneDissolved, undefined);
});

test("actual defeat consumer records a clone without boss progress, scrap or support payment", () => {
  let consumer;
  const visit = node => {
    if (ts.isIfStatement(node) && node.expression.getText(ast) === 'fighter.side === "zombie"'
      && node.getText(ast).includes("addCombatMetric(g.combatMetrics.enemyDefeatsByKind")) consumer = node.getText(ast);
    ts.forEachChild(node, visit);
  };
  visit(ast); assert.ok(consumer);
  const { g, boss, geometry, lanes } = fixture();
  boss.hp = 2870; const clone = runtime.spawnKuromePhaseClones(g, boss, lanes, geometry)[0];
  Object.assign(g, { kills: 0, combo: 0, maxCombo: 0, scrap: 0, supportGauge: 20, combatMetrics: { enemyDefeatsByKind: {} }, bossDefeatPending: false, barricadeVulnerable: false });
  clone.hp = 0;
  vm.runInNewContext(compile(consumer), { g, fighter: clone, isKuromeClone, resolveV100TwinDefeat,
    SUPPORT_GAUGE_MAX: 100, STATION_MISSION_TYPES: { SEQUENTIAL_SEAL: "sequential-seal" },
    addCombatMetric: (record, key, amount) => { record[key] = (record[key] ?? 0) + amount; },
    scrapReward: () => { throw new Error("clone paid boss scrap"); }, supportGaugeReward: () => { throw new Error("clone paid boss support"); },
  });
  assert.equal(g.bossDefeatPending, false); assert.equal(g.barricadeVulnerable, false);
  assert.equal(g.kills, 1); assert.equal(g.scrap, 0); assert.equal(g.supportGauge, 20);
  assert.deepEqual(g.combatMetrics.enemyDefeatsByKind, { "kurome-clone": 1 });
});
