import assert from "node:assert/strict";
import test from "node:test";

import {
  STATION_ENEMY_TUNING,
  advanceKaramitePull,
  advanceKaramiteWindup,
  advanceLeakMudHazards,
  advanceLeakMudWindup,
  advanceLeakMudZone,
  advanceSoukiBurst,
  advanceTicketGateEaterCharge,
  beginKaramiteWindup,
  beginLeakMudWindup,
  beginSoukiBurst,
  beginTicketGateEaterCharge,
  canKaramiteTarget,
  createKaramiteRuntime,
  createLeakMudRuntime,
  createTicketGateEaterRuntime,
  interruptKaramite,
  interruptLeakMud,
  isInsideLeakMudZone,
  karamiteTargetReason,
  resolveKaramiteBind,
  resolveLeakMudZone,
  selectKaramiteTarget,
  ticketGateEaterDamageProfile,
  ticketGateEaterFlankExposed,
  ticketGateSealStatus,
} from "../app/stationEnemyMechanics.js";

test("station enemy tuning is deeply frozen", () => {
  assert.equal(Object.isFrozen(STATION_ENEMY_TUNING), true);
  assert.ok(Object.values(STATION_ENEMY_TUNING).every(Object.isFrozen));
});

test("Karamite begins an explicit windup only for a targetable same-lane enemy in range", () => {
  const attacker = { id: "k", side: "zombie", hp: 100, lane: 1, x: 200 };
  const target = { id: "h", side: "human", hp: 100, lane: 1, x: 72 };
  const started = beginKaramiteWindup({ attacker, target });
  assert.equal(started.ok, true);
  assert.deepEqual(started.runtime, {
    phase: "windup",
    remainingSeconds: STATION_ENEMY_TUNING.karamite.windupSeconds,
    targetId: "h",
    lane: 1,
  });
  assert.equal(Object.isFrozen(started.runtime), true);
  assert.equal(
    canKaramiteTarget({ attacker, target: { ...target, x: 71.999 } }),
    false,
  );
  assert.equal(
    karamiteTargetReason({ attacker, target: { ...target, targetable: false } }),
    "target-unavailable",
  );
  assert.equal(
    karamiteTargetReason({ attacker, target: { ...target, lane: 2 } }),
    "different-lane",
  );
  assert.equal(
    karamiteTargetReason({ attacker, target: { ...target, side: "zombie" } }),
    "same-side",
  );
});

test("Karamite selects a farther same-lane target instead of starving on a nearer cross-lane unit", () => {
  const attacker = { id: "k", side: "zombie", hp: 100, lane: 1, x: 200 };
  const crossLaneNearest = { id: "wrong", side: "human", hp: 100, combatReady: true, lane: 0, x: 195 };
  const sameLaneFarther = { id: "right", side: "human", hp: 100, combatReady: true, lane: 1, x: 100 };
  assert.equal(selectKaramiteTarget({
    attacker,
    candidates: [crossLaneNearest, sameLaneFarther],
  }), sameLaneFarther);
});

test("Karamite cannot bind before the exact windup boundary", () => {
  const attacker = { id: "k", side: "zombie", hp: 100, lane: 1, x: 200 };
  const target = { id: "h", side: "human", hp: 100, lane: 1, x: 100 };
  const started = beginKaramiteWindup({ attacker, target });
  const early = advanceKaramiteWindup(
    started.runtime,
    STATION_ENEMY_TUNING.karamite.windupSeconds - 0.001,
  );
  assert.equal(early.phase, "windup");
  assert.equal(resolveKaramiteBind({ runtime: early, attacker, target }).bound, false);
  const ready = advanceKaramiteWindup(early, 0.001);
  assert.equal(ready.phase, "ready");
  assert.equal(resolveKaramiteBind({ runtime: ready, attacker, target }).bound, true);
});

test("Karamite windup can be countered and rechecks the target at resolution", () => {
  const attacker = { id: "k", side: "zombie", hp: 100, lane: 0, x: 200 };
  const target = { id: "h", side: "human", hp: 100, lane: 0, x: 100 };
  const windup = beginKaramiteWindup({ attacker, target }).runtime;
  assert.deepEqual(interruptKaramite(windup), createKaramiteRuntime());
  const ready = advanceKaramiteWindup(windup, 99);
  assert.equal(
    resolveKaramiteBind({
      runtime: ready,
      attacker,
      target: { ...target, x: 200 - STATION_ENEMY_TUNING.karamite.bindRange - 0.001 },
    }).reason,
    "out-of-range",
  );
  assert.equal(
    resolveKaramiteBind({ runtime: ready, attacker, target: { ...target, id: "other" } }).reason,
    "target-changed",
  );
});

test("Karamite pulls without crossing its stop distance and releases at hold completion", () => {
  const attacker = { id: "k", side: "zombie", hp: 100, lane: 1, x: 200 };
  const target = { id: "h", side: "human", hp: 100, lane: 1, x: 100 };
  const ready = advanceKaramiteWindup(
    beginKaramiteWindup({ attacker, target }).runtime,
    99,
  );
  const bound = resolveKaramiteBind({ runtime: ready, attacker, target }).runtime;
  const partial = advanceKaramitePull({
    runtime: bound,
    attacker,
    target,
    elapsedSeconds: 0.5,
  });
  assert.equal(partial.bound, true);
  assert.equal(partial.pulledDistance, 32);
  assert.equal(partial.target.x, 132);
  const complete = advanceKaramitePull({
    runtime: partial.runtime,
    attacker,
    target: partial.target,
    elapsedSeconds: 99,
  });
  assert.equal(complete.bound, false);
  assert.equal(complete.target.x, 182);
  assert.equal(complete.target.restrained, false);
  assert.deepEqual(complete.runtime, createKaramiteRuntime());
});

test("Karamite pull breaks beyond the inclusive break range and never mutates inputs", () => {
  const attacker = Object.freeze({ id: "k", side: "zombie", hp: 100, lane: 2, x: 200 });
  const atBoundary = Object.freeze({
    id: "h",
    side: "human",
    hp: 100,
    lane: 2,
    x: 200 - STATION_ENEMY_TUNING.karamite.breakRange,
  });
  const runtime = Object.freeze({
    phase: "pulling",
    remainingSeconds: 1,
    targetId: "h",
    lane: 2,
  });
  assert.equal(advanceKaramitePull({ runtime, attacker, target: atBoundary, elapsedSeconds: 0 }).bound, true);
  const beyond = { ...atBoundary, x: atBoundary.x - 0.001 };
  assert.equal(advanceKaramitePull({ runtime, attacker, target: beyond, elapsedSeconds: 1 }).reason, "out-of-range");
  assert.equal(atBoundary.x, 46);
  assert.equal(runtime.remainingSeconds, 1);
});

test("Leak Mud has an interruptible windup and creates a frozen ellipse only when ready", () => {
  const source = { id: "mud", side: "zombie", hp: 80, lane: 1, x: 300, y: 180 };
  const started = beginLeakMudWindup({ source, zoneId: "zone-1" });
  assert.equal(started.ok, true);
  assert.deepEqual(interruptLeakMud(started.runtime), createLeakMudRuntime());
  assert.equal(resolveLeakMudZone(started.runtime).created, false);
  const ready = advanceLeakMudWindup(
    started.runtime,
    STATION_ENEMY_TUNING.leakMud.windupSeconds,
  );
  const resolved = resolveLeakMudZone(ready);
  assert.equal(resolved.created, true);
  assert.equal(Object.isFrozen(resolved.zone), true);
  assert.equal(resolved.zone.radiusX, STATION_ENEMY_TUNING.leakMud.radiusX);
  assert.equal(resolved.zone.radiusY, STATION_ENEMY_TUNING.leakMud.radiusY);
});

test("Leak Mud rejects invalid source, lane, and center values", () => {
  assert.equal(beginLeakMudWindup({}).reason, "source-unavailable");
  assert.equal(beginLeakMudWindup({
    source: { hp: 1, lane: 4, x: 1, y: 1 },
  }).reason, "invalid-lane");
  assert.equal(beginLeakMudWindup({
    source: { hp: 1, lane: 1, x: 1, y: 1 },
    centerY: Number.NaN,
  }).reason, "invalid-center");
});

test("Leak Mud ellipse and lane boundaries are exact", () => {
  const zone = {
    active: true,
    lane: 1,
    centerX: 100,
    centerY: 50,
    radiusX: 20,
    radiusY: 10,
  };
  assert.equal(isInsideLeakMudZone(zone, { lane: 1, x: 120, y: 50 }), true);
  assert.equal(isInsideLeakMudZone(zone, { lane: 1, x: 100, y: 60 }), true);
  assert.equal(isInsideLeakMudZone(zone, { lane: 1, x: 114, y: 57 }), true);
  assert.equal(isInsideLeakMudZone(zone, { lane: 1, x: 120.001, y: 50 }), false);
  assert.equal(isInsideLeakMudZone(zone, { lane: 0, x: 100, y: 50 }), false);
  assert.equal(isInsideLeakMudZone({ ...zone, radiusX: 0 }, { lane: 1, x: 100, y: 50 }), false);
});

test("Leak Mud ticks deterministic damage and slow only on non-enemies inside its lane ellipse", () => {
  const source = { id: "mud", side: "zombie", hp: 80, lane: 1, x: 100, y: 50 };
  const ready = advanceLeakMudWindup(
    beginLeakMudWindup({ source, zoneId: "z" }).runtime,
    99,
  );
  const zone = resolveLeakMudZone(ready).zone;
  const entities = Object.freeze([
    Object.freeze({ id: "b", side: "human", hp: 30, lane: 1, x: 100, y: 50 }),
    Object.freeze({ id: "enemy", side: "zombie", hp: 30, lane: 1, x: 100, y: 50 }),
    Object.freeze({ id: "lane", side: "human", hp: 30, lane: 0, x: 100, y: 50 }),
    Object.freeze({ id: "a", side: "human", hp: 3, lane: 1, x: 100, y: 50 }),
  ]);
  const beforeTick = advanceLeakMudZone({ zone, entities, elapsedSeconds: 0.499 });
  assert.equal(beforeTick.tickCount, 0);
  assert.deepEqual(beforeTick.effects, []);
  const tick = advanceLeakMudZone({
    zone: beforeTick.zone,
    entities,
    elapsedSeconds: 0.001,
  });
  assert.equal(tick.tickCount, 1);
  assert.deepEqual(tick.effects.map(({ targetId }) => targetId), ["a", "b"]);
  assert.deepEqual(tick.effects[0], {
    targetId: "a",
    damage: 4,
    hp: 0,
    speedMultiplier: STATION_ENEMY_TUNING.leakMud.speedMultiplier,
  });
  assert.equal(entities[0].hp, 30);
});

test("Leak Mud consumes only its remaining lifetime and deactivates cleanly", () => {
  const zone = {
    id: "z",
    ownerSide: "zombie",
    lane: 0,
    centerX: 0,
    centerY: 0,
    radiusX: 10,
    radiusY: 10,
    remainingSeconds: 0.75,
    tickAccumulator: 0,
    active: true,
  };
  const result = advanceLeakMudZone({
    zone,
    entities: [{ id: "h", side: "human", hp: 100, lane: 0, x: 0, y: 0 }],
    elapsedSeconds: 99,
  });
  assert.equal(result.tickCount, 1);
  assert.equal(result.effects[0].damage, 4);
  assert.equal(result.zone.remainingSeconds, 0);
  assert.equal(result.zone.tickAccumulator, 0);
  assert.equal(result.zone.active, false);
  assert.equal(zone.remainingSeconds, 0.75);
});

test("Leak Mud frame slow clears after leaving or expiry and keeps only active overlapping zones", () => {
  const human = { id: "h", side: "human", hp: 100, lane: 1, x: 100, y: 50 };
  const active = {
    id: "active",
    ownerSide: "zombie",
    lane: 1,
    centerX: 100,
    centerY: 50,
    radiusX: 30,
    radiusY: 15,
    remainingSeconds: 2,
    tickAccumulator: 0,
    active: true,
  };
  const expiring = {
    ...active,
    id: "expiring",
    remainingSeconds: 0.1,
  };
  const overlapping = advanceLeakMudHazards({
    hazards: [active, expiring],
    entities: [human],
    elapsedSeconds: 0.2,
  });
  assert.deepEqual(overlapping.zones.map(({ id }) => id), ["active"]);
  assert.deepEqual(overlapping.slowEffects, [{
    targetId: "h",
    speedMultiplier: STATION_ENEMY_TUNING.leakMud.speedMultiplier,
  }]);

  const outside = advanceLeakMudHazards({
    hazards: overlapping.zones,
    entities: [{ ...human, x: 200 }],
    elapsedSeconds: 0,
  });
  assert.deepEqual(outside.slowEffects, []);

  const expired = advanceLeakMudHazards({
    hazards: overlapping.zones,
    entities: [human],
    elapsedSeconds: 99,
  });
  assert.deepEqual(expired.zones, []);
  assert.deepEqual(expired.slowEffects, []);
});

test("Souki telegraphs, starts at the exact boundary, and locks its lane", () => {
  const runner = Object.freeze({ id: "s", hp: 50, combatReady: true, lane: 2, x: 500 });
  const started = beginSoukiBurst({ runner });
  const early = advanceSoukiBurst({
    runtime: started.runtime,
    runner: { ...runner, lane: 0 },
    elapsedSeconds: STATION_ENEMY_TUNING.souki.telegraphSeconds - 0.001,
  });
  assert.equal(early.runtime.phase, "telegraph");
  assert.equal(early.runner.x, 500);
  assert.equal(early.runner.lane, 2);
  const exact = advanceSoukiBurst({
    runtime: early.runtime,
    runner: early.runner,
    elapsedSeconds: 0.001,
  });
  assert.equal(exact.burstStarted, true);
  assert.equal(exact.runtime.phase, "burst");
  assert.equal(exact.runner.x, 500);
});

test("Souki burst is fast, has an explicit end and recovery, and never crosses the CRAWLER rear boundary", () => {
  const runner = { id: "s", hp: 50, lane: 1, x: 100 };
  const runtime = beginSoukiBurst({ runner }).runtime;
  const atBoundary = advanceSoukiBurst({
    runtime,
    runner,
    elapsedSeconds: STATION_ENEMY_TUNING.souki.telegraphSeconds + 99,
    crawlerRearBoundaryX: 20,
  });
  assert.equal(atBoundary.burstStarted, true);
  assert.equal(atBoundary.burstEnded, true);
  assert.equal(atBoundary.runner.x, 20);
  assert.equal(atBoundary.runtime.phase, "idle");
  assert.equal(runner.x, 100);

  const fullDurationRunner = { id: "far", hp: 50, lane: 0, x: 1000 };
  const fullDuration = advanceSoukiBurst({
    runtime: beginSoukiBurst({ runner: fullDurationRunner }).runtime,
    runner: fullDurationRunner,
    elapsedSeconds:
      STATION_ENEMY_TUNING.souki.telegraphSeconds
      + STATION_ENEMY_TUNING.souki.burstSeconds,
    crawlerRearBoundaryX: -1000,
  });
  assert.equal(fullDuration.burstEnded, true);
  assert.equal(fullDuration.runtime.phase, "recovery");
  assert.equal(
    fullDuration.runner.x,
    1000 - STATION_ENEMY_TUNING.souki.burstSpeed * STATION_ENEMY_TUNING.souki.burstSeconds,
  );
});

test("Souki rejects unavailable/invalid runners and sanitizes abnormal elapsed time", () => {
  assert.equal(beginSoukiBurst({ runner: { hp: 0, lane: 1, x: 0 } }).reason, "runner-unavailable");
  assert.equal(beginSoukiBurst({ runner: { hp: 1, lane: 9, x: 0 } }).reason, "invalid-lane");
  const runner = { hp: 1, lane: 1, x: 50 };
  const runtime = beginSoukiBurst({ runner }).runtime;
  const unchanged = advanceSoukiBurst({
    runtime,
    runner,
    elapsedSeconds: Number.NaN,
    crawlerRearBoundaryX: Number.NaN,
  });
  assert.equal(unchanged.runtime.phase, "telegraph");
  assert.equal(unchanged.runner.x, 50);
});

test("Ticket Gate Eater charge has explicit windup, start, end, and flank window", () => {
  const boss = { id: "boss", hp: 1000, combatReady: true, lane: 1, x: 500 };
  const runtime = beginTicketGateEaterCharge({ boss, targetX: 300 }).runtime;
  const early = advanceTicketGateEaterCharge({
    runtime,
    boss,
    elapsedSeconds: STATION_ENEMY_TUNING.ticketGateEater.windupSeconds - 0.001,
  });
  assert.equal(early.runtime.phase, "windup");
  assert.equal(early.boss.x, 500);
  const charging = advanceTicketGateEaterCharge({
    runtime: early.runtime,
    boss: early.boss,
    elapsedSeconds: 0.001,
  });
  assert.equal(charging.chargeStarted, true);
  assert.equal(charging.runtime.phase, "charging");
  assert.equal(ticketGateEaterFlankExposed(charging.runtime), false);

  const exposed = advanceTicketGateEaterCharge({
    runtime: charging.runtime,
    boss: charging.boss,
    elapsedSeconds: STATION_ENEMY_TUNING.ticketGateEater.chargeSeconds,
  });
  assert.equal(exposed.chargeEnded, true);
  assert.equal(exposed.flankOpened, true);
  assert.equal(exposed.runtime.phase, "exposed");
  assert.equal(ticketGateEaterFlankExposed(exposed.runtime), true);
  assert.deepEqual(ticketGateEaterDamageProfile({
    runtime: exposed.runtime,
    attackVector: "flank",
  }), {
    flankExposed: true,
    flankHit: true,
    multiplier: STATION_ENEMY_TUNING.ticketGateEater.flankDamageMultiplier,
  });
  assert.equal(ticketGateEaterDamageProfile({
    runtime: exposed.runtime,
    attackVector: "front",
  }).multiplier, 1);
});

test("Ticket Gate Eater charge stops at its target, locks lane, then closes its flank", () => {
  const boss = Object.freeze({ id: "boss", hp: 1000, lane: 2, x: 100 });
  const started = beginTicketGateEaterCharge({ boss, targetX: 130 });
  const exposed = advanceTicketGateEaterCharge({
    runtime: started.runtime,
    boss: { ...boss, lane: 0 },
    elapsedSeconds: STATION_ENEMY_TUNING.ticketGateEater.windupSeconds + 0.2,
  });
  assert.equal(exposed.boss.x, 130);
  assert.equal(exposed.boss.lane, 2);
  assert.equal(exposed.runtime.phase, "exposed");
  const closed = advanceTicketGateEaterCharge({
    runtime: exposed.runtime,
    boss: exposed.boss,
    elapsedSeconds: STATION_ENEMY_TUNING.ticketGateEater.flankExposureSeconds,
  });
  assert.equal(closed.flankClosed, true);
  assert.deepEqual(closed.runtime, createTicketGateEaterRuntime());
  assert.equal(ticketGateEaterFlankExposed(closed.runtime), false);
  assert.equal(boss.x, 100);
});

test("Ticket Gate Eater rejects invalid charge requests", () => {
  assert.equal(beginTicketGateEaterCharge({
    boss: { hp: 0, lane: 1, x: 100 },
    targetX: 0,
  }).reason, "boss-unavailable");
  assert.equal(beginTicketGateEaterCharge({
    boss: { hp: 10, lane: 8, x: 100 },
    targetX: 0,
  }).reason, "invalid-lane");
  assert.equal(beginTicketGateEaterCharge({
    boss: { hp: 10, lane: 1, x: 100 },
    targetX: Number.NaN,
  }).reason, "invalid-target");
  assert.equal(beginTicketGateEaterCharge({
    boss: { hp: 10, lane: 1, x: 100 },
    targetX: 100,
  }).reason, "target-overlap");
});

test("station seal remains blocked below three powers or before boss suppression", () => {
  assert.deepEqual(ticketGateSealStatus({ poweredCount: 2, bossSuppressed: true }), {
    sealed: false,
    reason: "power-incomplete",
    poweredCount: 2,
    requiredPowerCount: 3,
    bossSuppressed: true,
  });
  assert.deepEqual(ticketGateSealStatus({ poweredCount: 3, bossSuppressed: false }), {
    sealed: false,
    reason: "boss-not-suppressed",
    poweredCount: 3,
    requiredPowerCount: 3,
    bossSuppressed: false,
  });
  assert.deepEqual(ticketGateSealStatus({ poweredCount: 3, bossSuppressed: true }), {
    sealed: true,
    reason: null,
    poweredCount: 3,
    requiredPowerCount: 3,
    bossSuppressed: true,
  });
});

test("station seal sanitizes abnormal power counts and requires an exact true suppression flag", () => {
  assert.equal(ticketGateSealStatus({ poweredCount: Number.NaN, bossSuppressed: true }).sealed, false);
  assert.equal(ticketGateSealStatus({ poweredCount: -10, bossSuppressed: true }).poweredCount, 0);
  assert.equal(ticketGateSealStatus({ poweredCount: 2.99, bossSuppressed: true }).sealed, false);
  assert.equal(ticketGateSealStatus({ poweredCount: 3, bossSuppressed: 1 }).sealed, false);
  assert.equal(Object.isFrozen(ticketGateSealStatus({ poweredCount: 3, bossSuppressed: true })), true);
});
