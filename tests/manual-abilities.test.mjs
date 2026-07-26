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
  manualAbilityLocksNormalAction,
  mayoAbilityHpStep,
  selectMayoAbilityTarget,
  selectMrsChihaAbilityTarget,
  selectMusashiAbilityTarget,
  selectTkyAbilityTarget,
  selectZakimiyaAbilityTarget,
  triggerMusashiCounter,
} from "../app/manualAbilities.js";
import {
  advanceMayoRetreat,
  createMayoRetreatRuntime,
  mayoRetreatBlocksDamage,
  mayoRetreatSpriteState,
} from "../app/mayoLifecycle.js";

const owner = (id = 1, kind = "zakimiya") => ({
  id,
  side: "human",
  kind,
  x: 200,
  y: 280,
  hp: 105,
  combatReady: true,
  gateEntering: false,
  manualAbility: createManualAbilityRuntime(kind),
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

test("TKY locks his activation direction and hits only the authored forward band", () => {
  const tky = { ...owner(30, "tky"), aiMoveDirection: 1 };
  const fighters = [
    tky,
    enemy("front-near", 260, 250),
    enemy("front-edge", 390, 345),
    enemy("behind", 145, 280),
    enemy("outside-height", 310, 380),
  ];
  const selected = selectTkyAbilityTarget({ owner: tky, fighters });
  assert.deepEqual(selected.targetIds, ["front-edge", "front-near"]);
  assert.equal(selected.direction, 1);
  assert.deepEqual(selectTkyAbilityTarget({ owner: tky, fighters: [...fighters].reverse() }), selected);

  const started = beginManualAbility(tky.manualAbility, selected);
  tky.aiMoveDirection = -1;
  const impact = advanceManualAbility(started.runtime, MANUAL_ABILITY_REGISTRY.tky.windupSeconds);
  assert.equal(impact.events.length, 1);
  assert.equal(impact.events[0].target.direction, 1, "activation direction does not flip during windup");
});

test("Mrs. Chiha chooses four deterministic enemy impact points and resolves them as a timed salvo", () => {
  const mrs = owner(40, "mrs-chiha");
  const friendly = { ...owner(41, "tky"), x: 360, y: 280, hp: 999 };
  const fighters = [
    mrs,
    friendly,
    enemy("cluster-a", 330, 250, 80),
    enemy("cluster-b", 350, 270, 70),
    enemy("upper", 430, 190, 90),
    enemy("lower", 420, 355, 60),
  ];
  const selected = selectMrsChihaAbilityTarget({ owner: mrs, fighters });
  assert.equal(selected.points.length, 4);
  assert.equal(selected.points.some(({ targetId }) => targetId === friendly.id), false);
  assert.deepEqual(selectMrsChihaAbilityTarget({ owner: mrs, fighters: [...fighters].reverse() }), selected);

  let step = advanceManualAbility(
    beginManualAbility(mrs.manualAbility, selected).runtime,
    MANUAL_ABILITY_REGISTRY["mrs-chiha"].windupSeconds,
  );
  assert.equal(step.events.length, 1);
  assert.equal(step.events[0].type, "launch");
  assert.equal(step.events[0].salvoIndex, 0);
  assert.equal(step.runtime.phase, "salvo");
  step = advanceManualAbility(step.runtime, MANUAL_ABILITY_REGISTRY["mrs-chiha"].projectileTravelSeconds);
  assert.equal(step.events[0].type, "impact");
  assert.equal(step.events[0].salvoIndex, 0);
  for (let expected = 1; expected < 4; expected += 1) {
    step = advanceManualAbility(
      step.runtime,
      MANUAL_ABILITY_REGISTRY["mrs-chiha"].salvoIntervalSeconds
        - MANUAL_ABILITY_REGISTRY["mrs-chiha"].projectileTravelSeconds,
    );
    assert.equal(step.events.length, 1);
    assert.equal(step.events[0].type, "launch");
    assert.equal(step.events[0].salvoIndex, expected);
    step = advanceManualAbility(step.runtime, MANUAL_ABILITY_REGISTRY["mrs-chiha"].projectileTravelSeconds);
    assert.equal(step.events.length, 1);
    assert.equal(step.events[0].type, "impact");
    assert.equal(step.events[0].salvoIndex, expected);
    assert.equal(step.events[0].finalRound, expected === 3);
  }
  assert.equal(step.runtime.phase, "recovery");
  assert.equal(manualAbilityLocksNormalAction(step.runtime), true);
  step = advanceManualAbility(step.runtime, MANUAL_ABILITY_REGISTRY["mrs-chiha"].recoverySeconds);
  assert.equal(step.runtime.phase, "cooldown");
});

test("Mrs. Chiha salvo timeline is deterministic and cannot skip launches or impacts with an oversized step", () => {
  const mrs = owner(42, "mrs-chiha");
  const selected = selectMrsChihaAbilityTarget({
    owner: mrs,
    fighters: [mrs, enemy("a", 320), enemy("b", 380), enemy("c", 440), enemy("d", 500)],
  });
  const started = beginManualAbility(mrs.manualAbility, selected);
  const settled = advanceManualAbility(started.runtime, 3);
  assert.deepEqual(
    settled.events.map(({ type, salvoIndex, timelineAt }) => [type, salvoIndex, Number(timelineAt.toFixed(2))]),
    [
      ["launch", 0, 1.05],
      ["impact", 0, 1.23],
      ["launch", 1, 1.27],
      ["impact", 1, 1.45],
      ["launch", 2, 1.49],
      ["impact", 2, 1.67],
      ["launch", 3, 1.71],
      ["impact", 3, 1.89],
    ],
  );
  assert.equal(settled.runtime.phase, "cooldown");
  assert.equal(Number(settled.runtime.cooldownRemaining.toFixed(2)), 18.19);
});

test("windup, salvo, recovery, and guard lock normal movement and attacks until cooldown begins", () => {
  for (const kind of ["tky", "mrs-chiha", "miyamoto-musashi"]) {
    assert.equal(manualAbilityLocksNormalAction({ phase: "windup", kind }), true, kind);
  }
  assert.equal(manualAbilityLocksNormalAction({ phase: "salvo", kind: "mrs-chiha" }), true);
  assert.equal(manualAbilityLocksNormalAction({ phase: "recovery", kind: "mrs-chiha" }), true);
  assert.equal(manualAbilityLocksNormalAction({ phase: "guard", kind: "miyamoto-musashi" }), true);
  assert.equal(manualAbilityLocksNormalAction({ phase: "cooldown" }), false);
  assert.equal(manualAbilityLocksNormalAction({ phase: "ready" }), false);
  assert.equal(manualAbilityLocksNormalAction(null), false);
});

test("Miyamoto Musashi prioritizes a boss, counters one melee hit, and falls back if untouched", () => {
  const musashi = owner(50, "miyamoto-musashi");
  const boss = { ...enemy("boss", 320), kind: "takuya", isBoss: true };
  const selected = selectMusashiAbilityTarget({
    owner: musashi,
    fighters: [musashi, enemy("near", 245), boss],
  });
  assert.equal(selected.targetId, "boss");
  assert.equal(selected.isBoss, true);

  const guard = advanceManualAbility(
    beginManualAbility(musashi.manualAbility, selected).runtime,
    MANUAL_ABILITY_REGISTRY["miyamoto-musashi"].windupSeconds,
  );
  assert.equal(guard.runtime.phase, "guard");
  assert.equal(guard.events[0].type, "guard-start");
  const counter = triggerMusashiCounter(guard.runtime);
  assert.equal(counter.ok, true);
  assert.equal(counter.event.mode, "counter");
  assert.equal(counter.runtime.phase, "cooldown");
  assert.equal(triggerMusashiCounter(counter.runtime).ok, false, "one activation cannot counter twice");

  const fallbackGuard = advanceManualAbility(
    beginManualAbility(createManualAbilityRuntime("miyamoto-musashi"), selected).runtime,
    MANUAL_ABILITY_REGISTRY["miyamoto-musashi"].windupSeconds,
  );
  const fallback = advanceManualAbility(
    fallbackGuard.runtime,
    MANUAL_ABILITY_REGISTRY["miyamoto-musashi"].guardSeconds,
  );
  assert.equal(fallback.events.length, 1);
  assert.equal(fallback.events[0].mode, "fallback");
  assert.equal(fallback.runtime.phase, "cooldown");
});

test("Mayo-chan deterministically prioritizes small fast infected and every deployment owns its own feral timer", () => {
  const first = owner(61, "mayo-chan");
  const second = owner(62, "mayo-chan");
  const runner = { ...enemy("runner", 380), kind: "runner" };
  const boss = { ...enemy("boss", 245), kind: "takuya", isBoss: true };
  const selected = selectMayoAbilityTarget({ owner: first, fighters: [first, second, boss, runner] });
  assert.equal(selected.targetId, "runner");
  assert.deepEqual(
    selectMayoAbilityTarget({ owner: first, fighters: [runner, boss, second, first] }),
    selected,
  );

  const started = beginManualAbility(first.manualAbility, selected);
  first.manualAbility = started.runtime;
  assert.equal(first.manualAbility.phase, "windup");
  assert.equal(second.manualAbility.phase, "ready");

  let step = advanceManualAbility(first.manualAbility, MANUAL_ABILITY_REGISTRY["mayo-chan"].windupSeconds);
  assert.equal(step.runtime.phase, "feral");
  assert.deepEqual(step.events.map(({ type }) => type), ["feral-start"]);
  step = advanceManualAbility(step.runtime, MANUAL_ABILITY_REGISTRY["mayo-chan"].activeSeconds);
  assert.equal(step.runtime.phase, "retreat");
  assert.deepEqual(step.events.map(({ type }) => type), ["retreat"]);
  assert.deepEqual(advanceManualAbility(step.runtime, 30).events, [], "retreat cannot emit twice");
  assert.equal(second.manualAbility.phase, "ready");
});

test("feral HP drain stops at the safety floor and requests retreat without reaching zero", () => {
  const beforeFloor = mayoAbilityHpStep({ hp: 64, maxHp: 64, seconds: 1 });
  assert.equal(beforeFloor.hp, 57);
  assert.equal(beforeFloor.forceRetreat, false);
  const floor = mayoAbilityHpStep({ hp: 14, maxHp: 64, seconds: 1 });
  assert.equal(floor.hp, 12.8);
  assert.equal(floor.safeHp, 12.8);
  assert.equal(floor.forceRetreat, true);
  assert.ok(floor.hp > 0);
});

test("Mayo-chan falls, rises, and runs to the moving base without creating a death lifecycle", () => {
  let runtime = createMayoRetreatRuntime({ reason: "injury" });
  assert.equal(mayoRetreatSpriteState(runtime), "death");
  let step = advanceMayoRetreat(runtime, .34, { x: 400, baseX: 100 });
  runtime = step.runtime;
  assert.equal(runtime.phase, "rise");
  assert.equal(mayoRetreatSpriteState(runtime), "hit");
  step = advanceMayoRetreat(runtime, .22, { x: step.x, baseX: 100 });
  runtime = step.runtime;
  assert.equal(runtime.phase, "run");
  assert.equal(mayoRetreatSpriteState(runtime), "move");
  step = advanceMayoRetreat(runtime, 2, { x: step.x, baseX: 100 });
  assert.equal(step.runtime.complete, true);
  assert.equal(step.x, 100);
});

test("Mayo retreat remains damage-immune through hazards and boss area hits until base arrival", () => {
  let runtime = createMayoRetreatRuntime({ reason: "injury" });
  let x = 440;
  let hp = 1;
  for (const incomingDamage of [12, 34, 28, 80]) {
    if (!mayoRetreatBlocksDamage(runtime)) hp = Math.max(0, hp - incomingDamage);
    const step = advanceMayoRetreat(runtime, .5, { x, baseX: 100 });
    runtime = step.runtime;
    x = step.x;
    assert.equal(hp, 1);
  }
  const completion = advanceMayoRetreat(runtime, 3, { x, baseX: 100 });
  assert.equal(completion.runtime.complete, true);
  assert.equal(completion.x, 100);
  assert.equal(hp, 1);
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
  assert.match(source, /manualAbilityLocksNormalAction\(f\.manualAbility\)[\s\S]{0,220}f\.aiMoveDirection = 0;[\s\S]{0,40}continue;/);
  assert.match(source, /manualAbilityActive[\s\S]{0,900}sampleAnimationClip\(f\.kind, "special", manualAbilityElapsed\)/);
});

test("Mayo-chan incapacitation branches to injury retreat before corpse, infection, zombie, or burning lifecycles", async () => {
  const source = await readFile(new URL("../app/AshfallGame.tsx", import.meta.url), "utf8");
  const deathResolution = source.slice(
    source.indexOf("const dead = g.fighters.filter"),
    source.indexOf("const beforeFireStates"),
  );
  assert.match(deathResolution, /fighter\.kind === "mayo-chan"/);
  assert.match(deathResolution, /beginMayoRetreat\(g, fighter, "injury"\)/);
  assert.ok(
    deathResolution.indexOf('fighter.kind === "mayo-chan"') < deathResolution.indexOf("beginAllyDeath"),
    "Mayo retreat must resolve before the generic ally corpse path",
  );
  assert.match(source, /fighter\.mayoRetreat\?\.complete !== true/);
  assert.match(source, /mayo-chan-feral/);
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
