import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  MANUAL_ABILITY_REGISTRY,
  advanceManualAbility,
  beginManualAbility,
  canActivateManualAbility,
  createManualAbilityRuntime,
  gunnerSuppressionVfxRounds,
  layoutManualAbilityIcons,
  manualAbilityCheckpointCooldown,
  manualAbilityLocksNormalAction,
  mayoAbilityHpStep,
  restoreManualAbilityCooldown,
  selectManualAbilityTarget,
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
  for (const [kind, definition] of Object.entries(MANUAL_ABILITY_REGISTRY)) {
    assert.equal(definition.runtimeStatus, "integrated", `${kind} is runtime-integrated`);
    assert.ok(definition.cooldownSeconds > 0, `${kind} has a positive cooldown`);
    assert.ok(definition.windupSeconds > 0, `${kind} has an authored windup`);
  }
});

test("the existing eleven units use deterministic ability-specific auto targeting and ready gates", () => {
  const kinds = [
    "brawler",
    "scout",
    "ranger",
    "medic",
    "brute",
    "crazy-king",
    "kumaverson",
    "babayaga",
    "gunner",
    "guardian",
    "engineer",
  ];
  for (const [index, kind] of kinds.entries()) {
    const fighter = {
      ...owner(100 + index, kind),
      lane: 1,
      maxHp: 100,
      speed: 20,
      aiMoveDirection: 1,
      engineerTrapReady: false,
    };
    const wounded = {
      ...owner(700, "scout"),
      lane: 1,
      maxHp: 100,
      hp: 22,
      x: 245,
      y: 280,
    };
    const fast = {
      ...enemy("fast", 310, 280, 75),
      kind: "runner",
      speed: 55,
      maxHp: 75,
    };
    const special = {
      ...enemy("special", 350, 288, 180),
      kind: "spitter",
      speed: 12,
      maxHp: 180,
    };
    const boss = {
      ...enemy("boss", 375, 280, 600),
      kind: "takuya",
      isBoss: true,
      speed: 8,
      maxHp: 600,
    };
    const fighters = kind === "medic"
      ? [fighter, wounded]
      : [fighter, fast, special, boss];
    const selected = selectManualAbilityTarget({ owner: fighter, fighters });
    assert.ok(selected, `${kind} receives an automatic valid target`);
    assert.deepEqual(
      selectManualAbilityTarget({ owner: fighter, fighters: [...fighters].reverse() }),
      selected,
      `${kind} target selection is order-independent`,
    );
    assert.equal(canActivateManualAbility({ fighter, fighters }), true, `${kind} shows ready only with a valid target`);
  }

  const nao = { ...owner(900, "medic"), lane: 1, maxHp: 100 };
  const healthy = { ...owner(901, "scout"), lane: 1, x: 230, maxHp: 100, hp: 100 };
  assert.equal(selectManualAbilityTarget({ owner: nao, fighters: [nao, healthy] }), null);
  assert.equal(canActivateManualAbility({ fighter: nao, fighters: [nao, healthy] }), false);
});

test("sustained manual abilities emit exactly one start and end then cool down", () => {
  for (const kind of ["crazy-king", "kumaverson", "guardian"]) {
    const fighter = { ...owner(950, kind), lane: 1, maxHp: 100, aiMoveDirection: 1 };
    const target = selectManualAbilityTarget({ owner: fighter, fighters: [fighter, enemy("threat", 285)] });
    const started = beginManualAbility(fighter.manualAbility, target);
    const active = advanceManualAbility(started.runtime, MANUAL_ABILITY_REGISTRY[kind].windupSeconds);
    assert.equal(active.runtime.phase, "active", kind);
    assert.deepEqual(active.events.map(({ type }) => type), ["active-start"], kind);
    const recovering = advanceManualAbility(active.runtime, MANUAL_ABILITY_REGISTRY[kind].activeSeconds);
    assert.equal(recovering.runtime.phase, "recovery", kind);
    assert.deepEqual(recovering.events.map(({ type }) => type), ["active-end"], kind);
    const cooldown = advanceManualAbility(
      recovering.runtime,
      MANUAL_ABILITY_REGISTRY[kind].recoverySeconds,
    );
    assert.equal(cooldown.runtime.phase, "cooldown", kind);
    assert.deepEqual(cooldown.events, [], kind);
    assert.deepEqual(advanceManualAbility(cooldown.runtime, 0).events, [], kind);

    const oversized = advanceManualAbility(started.runtime, 100);
    assert.equal(oversized.runtime.phase, "ready", kind);
    assert.deepEqual(oversized.events.map(({ type }) => type), ["active-start", "active-end"], kind);
  }
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
  assert.equal(first.manualAbility.phase, "recovery");
  assert.equal(second.manualAbility.phase, "ready");

  const paused = advanceManualAbility(first.manualAbility, 0);
  assert.equal(paused.runtime.windupRemaining, first.manualAbility.windupRemaining);
  const recovered = advanceManualAbility(first.manualAbility, MANUAL_ABILITY_REGISTRY.zakimiya.recoverySeconds);
  assert.equal(recovered.runtime.phase, "cooldown");
  const cooling = advanceManualAbility(recovered.runtime, 2);
  assert.ok(cooling.runtime.cooldownRemaining < recovered.runtime.cooldownRemaining);
  assert.equal(advanceManualAbility(cooling.runtime, 20).runtime.phase, "ready");
});

test("Raider suppression emits five ordered impact receipts before cooldown", () => {
  const target = {
    targetIds: ["runner", "walker"],
    x: 360,
    y: 280,
    direction: 1,
  };
  const started = beginManualAbility(createManualAbilityRuntime("gunner"), target);
  assert.equal(started.ok, true);
  const first = advanceManualAbility(started.runtime, .24);
  assert.deepEqual(first.events.map(({ type, salvoIndex }) => [type, salvoIndex]), [
    ["muzzle", 0],
    ["impact", 0],
  ]);
  assert.equal(first.runtime.phase, "windup");
  const second = advanceManualAbility(first.runtime, .08);
  assert.deepEqual(second.events.map(({ type, salvoIndex }) => [type, salvoIndex]), [
    ["muzzle", 1],
    ["impact", 1],
  ]);
  const final = advanceManualAbility(second.runtime, .23);
  assert.deepEqual(final.events.map(({ type, salvoIndex }) => [type, salvoIndex]), [
    ["muzzle", 2],
    ["impact", 2],
    ["muzzle", 3],
    ["impact", 3],
    ["muzzle", 4],
    ["impact", 4],
  ]);
  assert.equal(final.events.at(-1).finalRound, true);
  assert.equal(final.runtime.phase, "recovery");
  assert.equal(
    Number(final.events.at(-1).timelineAt.toFixed(3)),
    .531,
  );
  const cooldown = advanceManualAbility(final.runtime, MANUAL_ABILITY_REGISTRY.gunner.recoverySeconds);
  assert.equal(cooldown.runtime.phase, "cooldown");
});

test("Raider suppression VFX stays hidden through aim then follows each muzzle and impact", () => {
  const definition = MANUAL_ABILITY_REGISTRY.gunner;
  const beforeAim = gunnerSuppressionVfxRounds(definition.aimSeconds - Number.EPSILON);
  assert.equal(beforeAim.filter(({ visible }) => visible).length, 0);

  const firstMuzzle = gunnerSuppressionVfxRounds(definition.aimSeconds);
  assert.equal(firstMuzzle[0].visible, true);
  assert.equal(firstMuzzle[0].travelProgress, 0);
  assert.equal(firstMuzzle.slice(1).filter(({ visible }) => visible).length, 0);

  const firstImpact = gunnerSuppressionVfxRounds(
    definition.aimSeconds + definition.projectileTravelSeconds,
  );
  assert.ok(Math.abs(firstImpact[0].travelProgress - 1) < 1e-9);
  assert.equal(firstImpact[0].impactAge, 0);

  const finalMuzzleAt = definition.aimSeconds
    + definition.burstIntervalSeconds * (definition.burstCount - 1);
  const finalMuzzle = gunnerSuppressionVfxRounds(finalMuzzleAt);
  assert.equal(finalMuzzle.at(-1).visible, true);
  assert.equal(finalMuzzle.at(-1).travelProgress, 0);
});

test("all five reviewed specials expose a real locked recovery phase before normal action resumes", () => {
  const expectedAfterRecovery = {
    scout: "cooldown",
    gunner: "cooldown",
    "crazy-king": "cooldown",
    tky: "cooldown",
    "mayo-chan": "feral",
  };
  for (const kind of Object.keys(expectedAfterRecovery)) {
    const definition = MANUAL_ABILITY_REGISTRY[kind];
    const target = kind === "gunner"
      ? { targetIds: ["target"], targetId: "target", x: 320, y: 280, direction: 1 }
      : { targetId: "target", targetIds: ["target"], x: 320, y: 280, direction: 1 };
    const started = beginManualAbility(createManualAbilityRuntime(kind), target);
    const afterWindup = advanceManualAbility(started.runtime, definition.windupSeconds);
    const recovering = kind === "crazy-king"
      ? advanceManualAbility(afterWindup.runtime, definition.activeSeconds)
      : afterWindup;
    assert.equal(recovering.runtime.phase, "recovery", kind);
    assert.equal(manualAbilityLocksNormalAction(recovering.runtime), true, kind);
    assert.equal(
      Number(recovering.runtime.abilityElapsed.toFixed(3)),
      Number((
        definition.windupSeconds
        + (kind === "crazy-king" ? definition.activeSeconds : 0)
      ).toFixed(3)),
      kind,
    );
    const halfway = advanceManualAbility(recovering.runtime, definition.recoverySeconds / 2);
    assert.equal(halfway.runtime.phase, "recovery", kind);
    const finished = advanceManualAbility(halfway.runtime, definition.recoverySeconds / 2 + 1e-9);
    assert.equal(finished.runtime.phase, expectedAfterRecovery[kind], kind);
  }
});

test("checkpoint debt conservatively preserves every non-ready manual ability phase", () => {
  const brawler = createManualAbilityRuntime("brawler");
  const started = beginManualAbility(brawler, { targetId: "target", x: 260, y: 280 });
  const windupDebt = manualAbilityCheckpointCooldown(started.runtime);
  assert.equal(
    windupDebt,
    MANUAL_ABILITY_REGISTRY.brawler.windupSeconds
      + MANUAL_ABILITY_REGISTRY.brawler.recoverySeconds
      + MANUAL_ABILITY_REGISTRY.brawler.cooldownSeconds,
  );
  const recovering = advanceManualAbility(started.runtime, MANUAL_ABILITY_REGISTRY.brawler.windupSeconds);
  assert.equal(
    manualAbilityCheckpointCooldown(recovering.runtime),
    MANUAL_ABILITY_REGISTRY.brawler.recoverySeconds
      + MANUAL_ABILITY_REGISTRY.brawler.cooldownSeconds,
  );
  const restored = restoreManualAbilityCooldown("brawler", windupDebt);
  assert.equal(restored.phase, "cooldown");
  assert.equal(restored.cooldownRemaining, windupDebt);
  assert.equal(manualAbilityCheckpointCooldown(createManualAbilityRuntime("brawler")), 0);
  for (const kind of Object.keys(MANUAL_ABILITY_REGISTRY)) {
    const restoredKind = restoreManualAbilityCooldown(kind, .1);
    assert.equal(advanceManualAbility(restoredKind, .2).runtime.phase, "ready", kind);
  }

  const sustained = beginManualAbility(
    createManualAbilityRuntime("guardian"),
    { targetId: "target", x: 260, y: 280 },
  );
  assert.equal(
    manualAbilityCheckpointCooldown(sustained.runtime),
    MANUAL_ABILITY_REGISTRY.guardian.windupSeconds
      + MANUAL_ABILITY_REGISTRY.guardian.recoverySeconds
      + MANUAL_ABILITY_REGISTRY.guardian.activeSeconds
      + MANUAL_ABILITY_REGISTRY.guardian.cooldownSeconds,
  );

  const mayo = beginManualAbility(
    createManualAbilityRuntime("mayo-chan"),
    { targetId: "target", x: 260, y: 280 },
  );
  assert.equal(
    manualAbilityCheckpointCooldown(mayo.runtime),
    MANUAL_ABILITY_REGISTRY["mayo-chan"].windupSeconds
      + MANUAL_ABILITY_REGISTRY["mayo-chan"].recoverySeconds
      + MANUAL_ABILITY_REGISTRY["mayo-chan"].activeSeconds
      + MANUAL_ABILITY_REGISTRY["mayo-chan"].cooldownSeconds,
  );

  const mrsChiha = beginManualAbility(
    createManualAbilityRuntime("mrs-chiha"),
    { points: Array.from({ length: 4 }, (_, index) => ({ targetId: index, x: 260 + index, y: 280 })) },
  );
  assert.equal(
    manualAbilityCheckpointCooldown(mrsChiha.runtime),
    MANUAL_ABILITY_REGISTRY["mrs-chiha"].windupSeconds
      + MANUAL_ABILITY_REGISTRY["mrs-chiha"].salvoIntervalSeconds
        * (MANUAL_ABILITY_REGISTRY["mrs-chiha"].salvoCount - 1)
      + MANUAL_ABILITY_REGISTRY["mrs-chiha"].projectileTravelSeconds
      + MANUAL_ABILITY_REGISTRY["mrs-chiha"].recoverySeconds
      + MANUAL_ABILITY_REGISTRY["mrs-chiha"].cooldownSeconds,
  );
});

test("Musashi fallback recognizes every Version 0.9.0 boss before a closer normal enemy", () => {
  const musashi = owner(70, "miyamoto-musashi");
  for (const kind of ["kurome", "mother", "ooguchi", "gairen", "futago"]) {
    const selected = selectMusashiAbilityTarget({
      owner: musashi,
      fighters: [
        musashi,
        enemy("near-walker", 230),
        { ...enemy(`boss-${kind}`, 330, 280, 500), kind },
      ],
    });
    assert.equal(selected.targetId, `boss-${kind}`, kind);
    assert.equal(selected.isBoss, true, kind);
  }
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
  assert.equal(counter.runtime.phase, "recovery");
  assert.equal(counter.runtime.windupRemaining, MANUAL_ABILITY_REGISTRY["miyamoto-musashi"].recoverySeconds);
  assert.equal(triggerMusashiCounter(counter.runtime).ok, false, "one activation cannot counter twice");
  const counterRecovered = advanceManualAbility(
    counter.runtime,
    MANUAL_ABILITY_REGISTRY["miyamoto-musashi"].recoverySeconds,
  );
  assert.equal(counterRecovered.runtime.phase, "cooldown");

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
  assert.equal(fallback.runtime.phase, "recovery");
  const fallbackRecovered = advanceManualAbility(
    fallback.runtime,
    MANUAL_ABILITY_REGISTRY["miyamoto-musashi"].recoverySeconds,
  );
  assert.equal(fallbackRecovered.runtime.phase, "cooldown");
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
  assert.equal(step.runtime.phase, "recovery");
  assert.deepEqual(step.events, []);
  step = advanceManualAbility(step.runtime, MANUAL_ABILITY_REGISTRY["mayo-chan"].recoverySeconds);
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
    assert.ok(icon.y <= icon.anchorY + 18, "ready icon stays in its owner's overhead band");
    assert.ok(Math.abs(icon.x + icon.hitSize / 2 - icon.anchorX) <= 230, "ready icon stays near its owner");
  }
});

test("seven ready icons sharing a top-edge HP anchor remain independently tappable in a local crown", () => {
  const fighters = Array.from({ length: 7 }, (_, index) => ({
    id: index + 1,
    kind: "zakimiya",
    screenX: 440,
    screenY: 86,
  }));
  const icons = layoutManualAbilityIcons({
    fighters,
    obstacles: [{ x: 0, y: 0, width: 844, height: 54 }],
    displayWidth: 844,
    displayHeight: 340,
    safeInsets: { top: 6, right: 50, bottom: 27, left: 50 },
  });
  assert.equal(icons.length, 7);
  assert.equal(new Set(icons.map(({ x, y }) => `${x}:${y}`)).size, 7);
  for (let leftIndex = 0; leftIndex < icons.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < icons.length; rightIndex += 1) {
      const left = icons[leftIndex];
      const right = icons[rightIndex];
      assert.ok(
        left.x + left.hitSize + 2 <= right.x
          || right.x + right.hitSize + 2 <= left.x
          || left.y + left.hitSize + 2 <= right.y
          || right.y + right.hitSize + 2 <= left.y,
        `ready controls ${left.fighterId} and ${right.fighterId} must not overlap`,
      );
    }
  }
  assert.ok(icons.every((icon) => Math.abs(icon.x + icon.hitSize / 2 - icon.anchorX) <= 69));
  assert.ok(icons.every((icon) => icon.y <= icon.anchorY + 18));
});

test("runtime renders only ready buttons and never a cooldown ring or number above a unit", async () => {
  const source = await readFile(new URL("../app/AshfallGame.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(source, /hud\.manualAbilityIcons\.map/);
  assert.match(source, /canActivateManualAbility/);
  assert.match(source, /onPointerDown=\{\(event\) => event\.stopPropagation\(\)\}/);
  assert.doesNotMatch(css, /\.manual-ability-(?:cooldown|ring|countdown)/);
  assert.doesNotMatch(css, /\.manual-ability-ready > i/);
  assert.doesNotMatch(source, /pointer(?:Length|Angle)/);
  assert.doesNotMatch(source, /manualAbilityIcons[\s\S]{0,800}cooldownRemaining/);
  assert.match(source, /manualAbilityLocksNormalAction\(f\.manualAbility\)[\s\S]{0,220}f\.aiMoveDirection = 0;[\s\S]{0,40}continue;/);
  assert.match(source, /manualAbilityActive[\s\S]{0,900}sampleAnimationClip\(f\.kind, "special", manualAbilityElapsed\)/);
});

test("all sixteen ready icons map to distinct authored silhouettes", async () => {
  const iconFiles = {
    brawler: "paisen-kiai-combo-ready-r1.svg",
    scout: "hachi-intercept-dash-ready-r1.svg",
    ranger: "mizuchi-precision-ready-r1.svg",
    medic: "nao-emergency-treatment-ready-r1.svg",
    brute: "tatara-ground-break-ready-r1.svg",
    "crazy-king": "crazy-king-overdrive-ready-r1.svg",
    kumaverson: "kumaverson-pan-stand-ready-r1.svg",
    babayaga: "babayaga-weakness-audit-ready-r1.svg",
    gunner: "raider-suppression-ready-r1.svg",
    guardian: "gantetsu-shield-deploy-ready-r1.svg",
    engineer: "monkey-binding-trap-ready-r1.svg",
    zakimiya: "zakimiya-fire-whiskey-ready-r1.svg",
    tky: "tky-light-blade-ready-r1.svg",
    "mrs-chiha": "mrs-chiha-full-salvo-ready-r1.svg",
    "miyamoto-musashi": "miyamoto-musashi-muku-ready-r1.svg",
    "mayo-chan": "mayo-chan-feral-ready-r1.svg",
  };
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const iconSources = await Promise.all(Object.entries(iconFiles).map(async ([kind, file]) => {
    assert.match(css, new RegExp(`ability-${kind.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^}]*${file}`));
    const source = await readFile(new URL(`../public/art/v090/characters/abilities/${file}`, import.meta.url), "utf8");
    assert.match(source, /viewBox="0 0 96 96"/);
    assert.match(source, /<title id="title">[^<]+ ready<\/title>/);
    return source.replace(/\s+/g, " ");
  }));
  assert.equal(new Set(iconSources).size, 16, "no unit reuses another unit's icon artwork");
});

test("existing eleven abilities connect unique combat mechanics, canvas VFX, and weapon audio", async () => {
  const source = await readFile(new URL("../app/AshfallGame.tsx", import.meta.url), "utf8");
  for (const kind of [
    "brawler",
    "scout",
    "ranger",
    "medic",
    "brute",
    "crazy-king",
    "kumaverson",
    "babayaga",
    "gunner",
    "guardian",
    "engineer",
  ]) {
    assert.match(source, new RegExp(`effect\\.kind === "${kind.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`), `${kind} has dedicated VFX`);
  }
  assert.match(source, /event\.kind === "brawler"[\s\S]{0,1600}definition\.hitCount/);
  assert.match(source, /event\.kind === "brawler"[\s\S]{0,2200}finalKnockbackRadius/);
  assert.match(source, /event\.kind === "scout"[\s\S]{0,1800}definition\.stunSeconds/);
  assert.match(source, /event\.kind === "ranger"[\s\S]{0,1900}penetrationMultiplier/);
  assert.match(source, /event\.kind === "medic"[\s\S]{0,1900}protectionSeconds/);
  assert.match(source, /event\.kind === "brute"[\s\S]{0,3000}manual-structure:enemy-base/);
  assert.match(source, /manualDamageMultiplier[\s\S]{0,260}crazy-king/);
  assert.match(source, /event\.kind === "babayaga"[\s\S]{0,1200}markSeconds/);
  assert.match(source, /event\.kind === "gunner"[\s\S]{0,1600}suppressionSeconds/);
  assert.match(source, /activeGuardian[\s\S]{0,900}allyDamageTakenMultiplier/);
  assert.match(source, /engineerTrapManual[\s\S]{0,1800}trappedTargets[\s\S]{0,1000}slowSeconds/);
  assert.match(source, /playProductionCue\(weaponCueForUnit\(owner\.kind\)/);
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
