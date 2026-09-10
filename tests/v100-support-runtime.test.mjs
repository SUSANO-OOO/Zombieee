import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultV100Save } from "../app/v100Save.js";
import { V100_SUPPORTS, V100_STAGE_IDS } from "../app/v100Registry.js";
import { v100ProductionSessionFor, v100SupportSupplyFor } from "../app/v100BattleAdapter.js";
import {
  LANE_Y, AIRSTRIKE_DEF, CRAWLER_BARRAGE_DEF,
  battlefieldSupplyDefinition, resolveBattlefieldSupplyPlacement,
  beginBattlefieldSupplyCooldown, advanceBattlefieldSupplyCooldowns,
  advanceBattlefieldSupply, requestDrumDetonation, resolveDrumDetonation, advanceAreaEffects,
  createEmergencySupportRuntime, requestAirstrike, advanceEmergencySupportRuntime, resolveAirstrikeImpact,
  createCrawlerAbilityRuntime, requestCrawlerBarrage, advanceCrawlerAbilityRuntime, resolveCrawlerBarrage,
} from "../app/gameRules.js";

const stageId = V100_STAGE_IDS[0];
const session = save => v100ProductionSessionFor({ save, stageId, resultId: "support-audit" });
const placement = (id, extra = {}) => resolveBattlefieldSupplyPlacement({ running: true, paused: false, over: false,
  scrap: 120, supplyKind: v100SupportSupplyFor(id) ?? "pod", v100SupportId: id,
  lane: 1, x: 500, y: LANE_Y[1], nextId: 20, nextAreaEffectId: 30, ...extra });
const air = (runtime, extra = {}) => requestAirstrike({ running: true, paused: false, over: false,
  supportGauge: 100, lane: 1, x: 500, runtime, ...extra });
const barrage = (runtime, extra = {}) => requestCrawlerBarrage({ running: true, paused: false, over: false,
  supportGauge: 100, runtime, ...extra });
const enemy = { id: 1, side: "zombie", kind: "walker", lane: 1, x: 500, y: LANE_Y[1], hp: 300, maxHp: 300 };
const friend = { ...enemy, id: 2, side: "human", hp: 20 };

test("the V1 session carries only a recognized owned support; empty equipment never becomes pod", () => {
  const fresh = createDefaultV100Save();
  for (const id of [null, "pod", "invalid", "support-healing"]) {
    const actual = session({ ...fresh, equippedSupportId: id });
    assert.equal(actual.equippedSupportId, null); assert.equal(actual.selectedSupply, null);
  }
  for (const support of V100_SUPPORTS) {
    const actual = session({ ...fresh, ownedSupportIds: [support.id], equippedSupportId: support.id });
    assert.equal(actual.equippedSupportId, support.id);
    assert.equal(actual.selectedSupply, support.id === "support-healing" ? "medical" : "drum");
  }
});

test("null, unknown and wrong-kind support requests cannot debit or create an object", () => {
  for (const id of [null, "pod", "toString", "support-healing", "support-explosive-drum", "support-incendiary-drum"]) {
    const result = placement(id, { supplyKind: "pod" });
    assert.equal(result.ok, false); assert.equal(result.scrap, 120); assert.deepEqual(result.supplies, []);
    assert.equal(result.nextId, 20); assert.equal(result.nextAreaEffectId, 30);
  }
});

for (const [id, cost, cooldown] of [["support-healing", 50, 25], ["support-explosive-drum", 40, 20], ["support-incendiary-drum", 55, 28]]) {
  test(`${id} binds real debit and cooldown, rejecting duplicate, unaffordable and paused actions`, () => {
    const kind = v100SupportSupplyFor(id), accepted = placement(id);
    assert.equal(accepted.ok, true); assert.equal(accepted.scrap, 120 - cost);
    assert.equal(accepted.supplies[0].v100SupportId, id);
    const started = beginBattlefieldSupplyCooldown({}, kind, id);
    assert.equal(started[kind], cooldown);
    assert.equal(advanceBattlefieldSupplyCooldowns(started, cooldown - 0.25)[kind], 0.25);
    assert.equal(advanceBattlefieldSupplyCooldowns(started, cooldown)[kind], 0);
    for (const extra of [{ cooldown: started[kind] }, { scrap: cost - 1 }, { scrap: NaN }, { paused: true }, { running: false }, { over: true }, { x: -100 }]) {
      const rejected = placement(id, extra);
      assert.equal(rejected.ok, false); assert.equal(rejected.scrap, extra.scrap ?? 120); assert.deepEqual(rejected.supplies, []);
    }
    const duplicate = placement(id, { supplies: accepted.supplies, cooldown: started[kind], scrap: accepted.scrap });
    assert.equal(duplicate.ok, false); assert.equal(duplicate.scrap, accepted.scrap); assert.equal(duplicate.supplies.length, 1);
  });
}

test("canonical healing actually heals allies without damaging enemies", () => {
  const placed = placement("support-healing");
  const step = advanceAreaEffects({ areaEffects: placed.areaEffects, fighters: [friend, enemy], seconds: 1 });
  assert.equal(step.fighters[0].hp, 38); assert.equal(step.fighters[1].hp, 300);
});

for (const id of ["support-explosive-drum", "support-incendiary-drum"]) {
  test(`${id} preserves identity through drop and one-shot detonation with its own fire behavior`, () => {
    let supply = placement(id).supplies[0];
    supply = advanceBattlefieldSupply(supply, 10); supply = advanceBattlefieldSupply(supply, 10);
    assert.equal(supply.phase, "active"); assert.equal(supply.v100SupportId, id);
    supply = requestDrumDetonation(supply).supply;
    const result = resolveDrumDetonation({ supply, fighters: [enemy, friend], nextAreaEffectId: 30 });
    assert.equal(result.triggered, true); assert.equal(result.fighters[0].hp, 182); assert.equal(result.fighters[1].hp, 20);
    assert.equal(result.supply.v100SupportId, id);
    assert.equal(result.areaEffects.length, id === "support-incendiary-drum" ? 1 : 0);
    if (result.areaEffects.length) {
      const step = advanceAreaEffects({ areaEffects: result.areaEffects, fighters: result.fighters, seconds: 1 });
      assert.equal(step.fighters[0].hp, 167); assert.equal(step.fighters[0].slowMultiplier, 0.8);
    }
    assert.equal(resolveDrumDetonation({ supply: result.supply, fighters: result.fighters }).triggered, false);
  });
}

test("V1 airstrike spends85 once and retains its50-second reuse timer through actual impact and stow", () => {
  const idle = createEmergencySupportRuntime(true);
  for (const extra of [{ supportGauge: 84 }, { supportGauge: NaN }, { paused: true }, { over: true }]) {
    const denied = air(idle, extra); assert.equal(denied.ok, false); assert.strictEqual(denied.runtime, idle);
    assert.equal(denied.supportGauge, extra.supportGauge ?? 100);
  }
  const accepted = air(idle); assert.equal(accepted.supportGauge, 15); assert.equal(accepted.runtime.cooldownRemaining, 50);
  assert.equal(air(accepted.runtime).ok, false);
  let step = advanceEmergencySupportRuntime(accepted.runtime, 1.75);
  assert.equal(step.runtime.phase, "impact");
  const impact = resolveAirstrikeImpact({ runtime: step.runtime, fighters: [enemy, friend] });
  assert.equal(impact.fighters[0].hp, 155); assert.equal(impact.fighters[1].hp, 20);
  assert.equal(resolveAirstrikeImpact({ runtime: impact.runtime, fighters: impact.fighters }).triggered, false);
  step = advanceEmergencySupportRuntime(impact.runtime, 1);
  assert.equal(step.runtime.phase, "idle"); assert.equal(step.runtime.cooldownRemaining, 47.25);
  assert.equal(air(step.runtime).ok, false);
  const nearly = advanceEmergencySupportRuntime(step.runtime, 47).runtime;
  assert.equal(air(nearly).ok, false); assert.equal(nearly.cooldownRemaining, 0.25);
  const ready = advanceEmergencySupportRuntime(nearly, 0.25).runtime;
  assert.equal(air(ready).ok, true); assert.equal(ready.v100, true);
  const stalled = advanceEmergencySupportRuntime(accepted.runtime, 99).runtime;
  assert.equal(stalled.phase, "impact"); assert.equal(air(stalled).ok, false);
});

test("V1 barrage spends70 once, hits once, and reloads for38s using the existing lifecycle", () => {
  const ready = createCrawlerAbilityRuntime(1, true);
  for (const extra of [{ supportGauge: 69 }, { supportGauge: NaN }, { paused: true }, { over: true }, { running: false }]) {
    const denied = barrage(ready, extra); assert.equal(denied.ok, false); assert.strictEqual(denied.runtime, ready);
    assert.equal(denied.supportGauge, extra.supportGauge ?? 100);
  }
  const accepted = barrage(ready); assert.equal(accepted.supportGauge, 30); assert.equal(barrage(accepted.runtime).ok, false);
  const firing = advanceCrawlerAbilityRuntime(accepted.runtime, 99).runtime; assert.equal(firing.phase, "firing");
  const hit = resolveCrawlerBarrage({ runtime: firing, fighters: [enemy, friend] });
  assert.equal(hit.fighters[0].hp, 248); assert.equal(hit.fighters[1].hp, 20);
  assert.equal(resolveCrawlerBarrage({ runtime: hit.runtime, fighters: hit.fighters }).triggered, false);
  const recovering = advanceCrawlerAbilityRuntime(hit.runtime, CRAWLER_BARRAGE_DEF.fireSeconds).runtime;
  const cooldown = advanceCrawlerAbilityRuntime(recovering, CRAWLER_BARRAGE_DEF.recoverSeconds).runtime;
  assert.equal(cooldown.cooldownRemaining, 38); assert.equal(cooldown.v100, true);
  assert.equal(barrage(advanceCrawlerAbilityRuntime(cooldown, 37.75).runtime).ok, false);
  assert.equal(barrage(advanceCrawlerAbilityRuntime(cooldown, 38).runtime).ok, true);
});

test("legacy supports and vehicle runtime values remain unchanged", () => {
  assert.equal(battlefieldSupplyDefinition("pod").cost, 50);
  assert.equal(battlefieldSupplyDefinition("medical").cost, 35);
  assert.equal(beginBattlefieldSupplyCooldown({}, "medical").medical, 18);
  assert.equal(beginBattlefieldSupplyCooldown({}, "drum").drum, 12);
  assert.equal(air(createEmergencySupportRuntime()).supportGauge, 100 - AIRSTRIKE_DEF.gaugeCost);
  assert.equal(barrage(createCrawlerAbilityRuntime(1)).supportGauge, 100);
  assert.equal(createCrawlerAbilityRuntime(0).cooldownRemaining, 36);
});
