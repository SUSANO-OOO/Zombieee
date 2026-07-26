import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  MANUAL_ABILITY_REGISTRY,
  advanceManualAbility,
  beginManualAbility,
  canActivateManualAbility,
  createManualAbilityRuntime,
  layoutManualAbilityIcons,
  selectZakimiyaAbilityTarget,
} from "../app/manualAbilities.js";

const owner = (id = 1) => ({
  id,
  side: "human",
  kind: "zakimiya",
  x: 200,
  y: 280,
  hp: 105,
  combatReady: true,
  gateEntering: false,
  manualAbility: createManualAbilityRuntime("zakimiya"),
});

const enemy = (id, x, y = 280, hp = 100) => ({
  id,
  side: "zombie",
  kind: "walker",
  x,
  y,
  lane: 1,
  hp,
  combatReady: true,
  contained: false,
});

test("all sixteen canonical manual abilities retain exact player-facing names", () => {
  assert.equal(Object.keys(MANUAL_ABILITY_REGISTRY).length, 16);
  assert.equal(MANUAL_ABILITY_REGISTRY.tky.displayName, "光刃解放");
  assert.equal(MANUAL_ABILITY_REGISTRY.zakimiya.displayName, "火酒投擲");
  assert.equal(MANUAL_ABILITY_REGISTRY["mayo-chan"].displayName, "凶暴マヨ");
  assert.equal(
    new Set(Object.values(MANUAL_ABILITY_REGISTRY).map(({ iconMotif }) => iconMotif)).size,
    16,
  );
});

test("Zakimiya targets the densest valid group instead of wasting the throw on the nearest lone enemy", () => {
  const zakimiya = owner();
  const fighters = [
    zakimiya,
    enemy("near-lone", 238),
    enemy("cluster-a", 380, 276),
    enemy("cluster-b", 404, 284),
    enemy("cluster-c", 422, 279),
  ];
  const selected = selectZakimiyaAbilityTarget({ owner: zakimiya, fighters });
  assert.equal(selected.hitCount, 3);
  assert.notEqual(selected.targetId, "near-lone");
  assert.deepEqual(
    selectZakimiyaAbilityTarget({ owner: zakimiya, fighters: [...fighters].reverse() }),
    selected,
  );
});

test("no valid target means no ready icon contract", () => {
  const zakimiya = owner();
  assert.equal(canActivateManualAbility({ fighter: zakimiya, fighters: [zakimiya] }), false);
  assert.equal(selectZakimiyaAbilityTarget({ owner: zakimiya, fighters: [enemy("far", 700)] }), null);
});

test("duplicate deployments own independent activation and cooldown state", () => {
  const first = owner(11);
  const second = owner(12);
  const target = selectZakimiyaAbilityTarget({ owner: first, fighters: [first, second, enemy(20, 330)] });
  const activation = beginManualAbility(first.manualAbility, target);
  first.manualAbility = activation.runtime;
  assert.equal(first.manualAbility.phase, "windup");
  assert.equal(second.manualAbility.phase, "ready");

  const impact = advanceManualAbility(first.manualAbility, MANUAL_ABILITY_REGISTRY.zakimiya.windupSeconds);
  first.manualAbility = impact.runtime;
  assert.equal(impact.events.length, 1);
  assert.equal(first.manualAbility.phase, "cooldown");
  assert.equal(second.manualAbility.phase, "ready");

  const paused = advanceManualAbility(first.manualAbility, 0);
  assert.equal(paused.runtime.cooldownRemaining, first.manualAbility.cooldownRemaining);
  const cooling = advanceManualAbility(first.manualAbility, 2);
  assert.ok(cooling.runtime.cooldownRemaining < first.manualAbility.cooldownRemaining);
  assert.equal(advanceManualAbility(cooling.runtime, 20).runtime.phase, "ready");
});

test("one activation emits one impact receipt even with oversized time steps", () => {
  const zakimiya = owner();
  const target = selectZakimiyaAbilityTarget({ owner: zakimiya, fighters: [zakimiya, enemy(2, 330)] });
  const started = beginManualAbility(zakimiya.manualAbility, target);
  const first = advanceManualAbility(started.runtime, 30);
  const second = advanceManualAbility(first.runtime, 30);
  assert.equal(first.events.length, 1);
  assert.equal(first.events[0].activationId, 1);
  assert.deepEqual(second.events, []);
  assert.equal(second.runtime.phase, "ready");
});

test("screen-space ready icons clamp to safe areas and avoid HUD, bodies, and each other deterministically", () => {
  const fighters = [
    { id: 9, kind: "zakimiya", screenX: 440, screenY: 86 },
    { id: 4, kind: "zakimiya", screenX: 440, screenY: 86 },
  ];
  const obstacles = [
    { x: 0, y: 0, width: 844, height: 54 },
    { x: 405, y: 54, width: 70, height: 64 },
    { x: 600, y: 70, width: 220, height: 46 },
  ];
  const first = layoutManualAbilityIcons({
    fighters,
    obstacles,
    displayWidth: 844,
    displayHeight: 340,
    safeInsets: { top: 6, right: 50, bottom: 27, left: 50 },
  });
  const second = layoutManualAbilityIcons({
    fighters: [...fighters].reverse(),
    obstacles,
    displayWidth: 844,
    displayHeight: 340,
    safeInsets: { top: 6, right: 50, bottom: 27, left: 50 },
  });
  assert.deepEqual(second, first);
  assert.equal(first.length, 2);
  assert.notDeepEqual([first[0].x, first[0].y], [first[1].x, first[1].y]);
  for (const icon of first) {
    assert.ok(icon.x >= 50 && icon.x + icon.hitSize <= 794);
    assert.ok(icon.y >= 6 && icon.y + icon.hitSize <= 313);
    assert.equal(icon.anchorX, 440);
    assert.equal(icon.anchorY, 86);
  }
});

test("runtime renders only ready buttons and never a cooldown ring or number above a unit", async () => {
  const source = await readFile(new URL("../app/AshfallGame.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(source, /hud\.manualAbilityIcons\.map/);
  assert.match(source, /canActivateManualAbility/);
  assert.match(source, /onPointerDown=\{\(event\) => event\.stopPropagation\(\)\}/);
  assert.doesNotMatch(css, /\.manual-ability-(?:cooldown|ring|countdown)/);
  assert.doesNotMatch(source, /manualAbilityIcons[\s\S]{0,800}cooldownRemaining/);
});

test("support placement owns input until it is cancelled or completed", async () => {
  const source = await readFile(new URL("../app/AshfallGame.tsx", import.meta.url), "utf8");
  const activation = source.slice(
    source.indexOf("const activateManualAbility"),
    source.indexOf("const stopSfx"),
  );
  assert.match(activation, /g\.over \|\| selectedActionRef\.current/);
  assert.doesNotMatch(activation, /chooseAction\(null\)/);
  assert.match(source, /g\.running && !g\.paused && !g\.over && !selectedActionRef\.current/);
  assert.match(source, /screen === "battle" && !selectedAction && hud\.manualAbilityIcons\.map/);
});
