import test from "node:test";
import assert from "node:assert/strict";
import { advanceCommand, UNIT_CARDS } from "../app/gameRules.js";
import { v100ProductionSessionFor } from "../app/v100BattleAdapter.js";
import { armCommandRecovery, commandDeploymentWait, createCommandRecoveryRuntime, advanceCommandRecovery, commandRecoveryWorldActionPending } from "../app/commandRecovery.js";
const eligible = patch => ({ runtime: armCommandRecovery(createCommandRecoveryRuntime()), command: 0, seconds: 1, baseRate: 3, mode: "campaign",
  activeHumans: 0, queued: 0, enemies: 1, supportReady: false, playerAttackPending: false, cards: [{ cost: 62, cooldown: 0 }], ...patch });
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, a + " differs from " + b);

test("normal campaign and outbreak sessions require explicit mode; result IDs confer no entitlement", () => {
  for (const battleMode of ["campaign", "outbreak", null, undefined, "survival", "unknown"]) {
    const session = v100ProductionSessionFor({ save: {}, stageId: "S01", resultId: "v100:S01:not-a-mode", battleMode });
    assert.equal(session.battleMode, ["campaign", "outbreak"].includes(battleMode) ? battleMode : null);
  }
});
function run(input, duration, dt = 1 / 60) {
  let current = input, elapsed = 0;
  while (elapsed < duration - 1e-9) { const step = Math.min(dt, duration - elapsed), r = advanceCommandRecovery({ ...current, seconds: step,
    cards: input.cards.map(c => ({ ...c, cooldown: Math.max(0, c.cooldown - elapsed) })) }); current = { ...current, command: r.command, runtime: r.runtime }; elapsed += step; }
  return current;
}

test("Kuma and Musashi can fund the first replacement in eight simulation seconds after a qualifying wipe", () => {
  for (const cost of [62, 72]) {
    const end = run(eligible({ cards: [{ cost, cooldown: 0 }] }), 8);
    close(end.command, cost); assert.equal(end.runtime.active, false); assert.equal(end.runtime.used, true);
    close(end.runtime.additionalCommand, cost - 24);
  }
  const hachi = run(eligible({ cards: [{ cost: 25, cooldown: 0 }] }), 8);
  close(hachi.command, 25); close(hachi.runtime.additionalCommand, 1);
});

test("a 17-second Kuma redeployment remains 17 seconds, not eight, with only the necessary extra command", () => {
  const r = run(eligible({ cards: [{ cost: 62, cooldown: 17 }] }), 17);
  close(r.command, 62); close(r.runtime.additionalCommand, 11);
  const first = advanceCommandRecovery(eligible({ cards: [{ cost: 62, cooldown: 17 }] }));
  close(commandDeploymentWait({ command: first.command, cost: 62, cooldown: 16, recovery: first.runtime }), 16);
});

test("Mayo's 42-second withdrawal cooldown is not accelerated or supplied extra reserves", () => {
  const r = run(eligible({ cards: [{ cost: 46, cooldown: 42 }] }), 42);
  close(r.command, 126); close(r.runtime.additionalCommand, 0); assert.equal(r.runtime.used, false);
  const mixed = run(eligible({ cards: [{ cost: 46, cooldown: 42 }, { cost: 62, cooldown: 0 }] }), 8);
  close(mixed.command, 62); close(mixed.runtime.additionalCommand, 38); assert.equal(mixed.runtime.used, true);
  assert.equal(commandDeploymentWait({ command: mixed.command, cost: 46, cooldown: 34, recovery: mixed.runtime }), 34);
});

test("all actual human weapons and crawler attacks defer recovery after their shooter is gone; enemy shots do not", () => {
  for (const weapon of [...UNIT_CARDS.map(card => card.kind), "crawler"]) {
    assert.equal(commandRecoveryWorldActionPending({ pendingWeaponHits: [{ weapon, sourceId: 999999 }] }), true);
  }
  assert.equal(commandRecoveryWorldActionPending({ pendingWeaponHits: [{ weapon: "spitter" }] }), false);
  assert.equal(commandRecoveryWorldActionPending({ pendingWeaponHits: [{ weapon: "babayaga", attackObservation: { sourceSide: "zombie" } }] }), false);
  assert.equal(commandRecoveryWorldActionPending({ pendingWeaponHits: [{ weapon: "spitter", attackObservation: { sourceSide: "human" } }] }), true);
});

test("free incendiary drum inputs and falling or detonating drums defer recovery; ordinary inert drums do not", () => {
  for (const phase of ["dropping", "active", "detonating"]) {
    assert.equal(commandRecoveryWorldActionPending({ battlefieldObjects: [{ kind: "drum", v100SupportId: "support-incendiary-drum", phase }] }), true);
    assert.equal(commandRecoveryWorldActionPending({ battlefieldObjects: [{ kind: "drum", v100SupportId: "support-explosive-drum", phase }] }), false);
  }
  for (const phase of ["expired", "destroying"]) assert.equal(commandRecoveryWorldActionPending({ battlefieldObjects: [{ kind: "drum", v100SupportId: "support-incendiary-drum", phase }] }), false);
  assert.equal(commandRecoveryWorldActionPending({ battlefieldObjects: [{ kind: "drum", v100SupportId: "support-incendiary-drum", phase: "active", detonationTriggered: true }] }), false);
});

test("active player fire, deployed support and fist waves resolve before recovery; zero-damage presentation fire does not", () => {
  const burn = { kind: "burn", phase: "active", remaining: 3, amountPerSecond: 5, sourceSupplyId: 1 };
  for (const input of [{ areaEffects: [burn] }, { areaEffects: [{ ...burn, sourceSupplyId: -100, sourceUnitKind: "zakimiya" }] }, { fistWaves: { pending: 1 } }, { fistWaves: { waves: [{}] } }, { airstrikePhase: "approaching" }, { crawlerPhase: "firing" }]) assert.equal(commandRecoveryWorldActionPending(input), true);
  for (const input of [{}, { areaEffects: [{ ...burn, amountPerSecond: 0 }] }, { areaEffects: [{ ...burn, remaining: 0 }] }, { areaEffects: [{ ...burn, sourceSupplyId: -1 }] }, { crawlerPhase: "ready" }]) assert.equal(commandRecoveryWorldActionPending(input), false);
});

test("outbreak, survival, legacy, absent mode and unknown modes keep their exact regeneration contract", () => {
  for (const mode of ["outbreak", "survival", "legacy", null, undefined, "unknown"]) for (const baseRate of [3, 3.5, 3.65]) {
    const r = advanceCommandRecovery(eligible({ mode, baseRate, seconds: 7.3 }));
    assert.equal(r.command, advanceCommand(0, 7.3, baseRate)); assert.equal(r.runtime.active, false); assert.equal(r.runtime.additionalCommand, 0);
  }
});

test("opening, paid queue, living entrants, spare support, active attacks and empty waves cannot qualify", () => {
  for (const patch of [{ runtime: createCommandRecoveryRuntime() }, { activeHumans: 1 }, { queued: 1 }, { enemies: 0 }, { supportReady: true }, { playerAttackPending: true }]) {
    const r = advanceCommandRecovery(eligible(patch)); assert.equal(r.command, 3); assert.equal(r.runtime.active, false);
  }
});

test("a final projectile defers recovery, while a surviving entrant cancels the collapse episode", () => {
  const flying = advanceCommandRecovery(eligible({ playerAttackPending: true }));
  assert.equal(flying.runtime.armed, true); assert.equal(flying.runtime.used, false);
  const clear = advanceCommandRecovery(eligible({ runtime: flying.runtime, command: flying.command }));
  assert.equal(clear.runtime.active, true); assert.equal(clear.runtime.used, true);
  const entrant = advanceCommandRecovery(eligible({ activeHumans: 1 }));
  assert.equal(entrant.runtime.armed, false);
  const laterWithdrawal = advanceCommandRecovery(eligible({ runtime: entrant.runtime }));
  assert.equal(laterWithdrawal.runtime.active, false); assert.equal(laterWithdrawal.runtime.used, false);
});

test("empty or invalid rosters cannot receive reserves, and already affordable units need none", () => {
  for (const cards of [[], [{ cost: 0, cooldown: 0 }], [{ cost: Infinity, cooldown: 0 }], [{ cost: 62, cooldown: NaN }], [{ cost: 151, cooldown: 0 }]]) {
    const r = advanceCommandRecovery(eligible({ cards })); assert.equal(r.command, 3); assert.equal(r.runtime.used, false);
  }
  assert.equal(advanceCommandRecovery(eligible({ command: 62 })).command, 65);
});

test("a cheaper member limits the recovery even when expensive members occupy repeated slots", () => {
  const r = run(eligible({ cards: [{ cost: 72, cooldown: 0 }, { cost: 25, cooldown: 8 }, { cost: 72, cooldown: 0 }] }), 8);
  close(r.command, 25); close(r.runtime.additionalCommand, 1);
});

test("large steps split at the first affordable member and never grant accelerated surplus", () => {
  for (const duration of [8, 9, 20, 60]) {
    const single = advanceCommandRecovery(eligible({ seconds: duration }));
    const partitioned = run(eligible(), duration, .17);
    close(single.command, partitioned.command); close(single.runtime.additionalCommand, partitioned.runtime.additionalCommand);
    close(single.runtime.additionalCommand, 38); assert.ok(single.command <= 150);
  }
});

test("one battle cannot farm another recovery from repeated defeats", () => {
  const first = run(eligible(), 8), rearmed = armCommandRecovery(first.runtime);
  assert.equal(rearmed, first.runtime);
  const again = advanceCommandRecovery(eligible({ runtime: rearmed, command: 0, seconds: 8 }));
  assert.equal(again.command, 24); close(again.runtime.additionalCommand, 38);
});

test("an arriving unit or support interrupts the boost without refunding its one-use entitlement", () => {
  const start = advanceCommandRecovery(eligible());
  for (const patch of [{ activeHumans: 1 }, { queued: 1 }, { supportReady: true }, { playerAttackPending: true }]) {
    const r = advanceCommandRecovery(eligible({ runtime: start.runtime, command: start.command, ...patch }));
    close(r.command, start.command + 3); assert.equal(r.runtime.active, false); assert.equal(r.runtime.used, true);
  }
});

test("zero seconds cannot consume recovery and inputs stay immutable", () => {
  const input = eligible({ seconds: 0 }), before = structuredClone(input);
  const r = advanceCommandRecovery(input); assert.equal(r.runtime, input.runtime); assert.deepEqual(input, before);
});

test("readiness quotes accelerated command only to its cap and respects the longest cooldown", () => {
  const recovery = advanceCommandRecovery(eligible({ seconds: .5 })).runtime;
  close(commandDeploymentWait({ command: 3.875, cost: 62, recovery }), 7.5);
  close(commandDeploymentWait({ command: 3.875, cost: 72, recovery }), 7.5 + 10 / 3);
  assert.equal(commandDeploymentWait({ command: 62, cost: 62, cooldown: 17, recovery }), 17);
  assert.equal(commandDeploymentWait({ command: 70, cost: 25, cooldown: 0 }), 0);
});
