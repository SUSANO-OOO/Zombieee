import assert from "node:assert/strict";
import test from "node:test";

import { ALLY_AI_INTENTS, decideAllyIntent, destinationWithinRange } from "../app/allyAi.js";

function advance(unit, intent, speed = 40) {
  if (intent.moveDirection === 0) return { ...unit };
  const remaining = intent.destinationX - unit.x;
  const step = Math.sign(remaining) * Math.min(Math.abs(remaining), speed);
  return { ...unit, x: unit.x + step };
}

test("timed defense returns to its lane anchor and never advances into an empty enemy side", () => {
  let unit = { id: "defender", x: 520, lane: 1, range: 42, ranged: false };
  let previousIntent = null;
  for (let tick = 0; tick < 12; tick += 1) {
    const intent = decideAllyIntent({
      missionType: "timed-defense",
      unit,
      enemies: [],
      defenseAnchor: { 1: 310 },
      previousIntent,
    });
    assert.ok(intent.destinationX <= unit.x);
    unit = advance(unit, intent, 30);
    previousIntent = intent;
  }
  const settled = decideAllyIntent({
    missionType: "timed-defense",
    unit,
    enemies: [],
    defenseAnchor: { 1: 310 },
    previousIntent,
  });
  assert.equal(settled.intent, ALLY_AI_INTENTS.HOLD_DEFENSE);
  assert.ok(Math.abs(unit.x - 310) <= 8);
});

test("an assault melee unit advances monotonically to contact when no enemies exist", () => {
  let unit = { id: "melee", x: 100, lane: 1, range: 42, ranged: false, contactRange: 24 };
  let previousIntent = null;
  const positions = [unit.x];
  for (let tick = 0; tick < 30; tick += 1) {
    const intent = decideAllyIntent({
      missionType: "assault",
      unit,
      objective: { x: 900, active: true },
      previousIntent,
    });
    unit = advance(unit, intent, 45);
    positions.push(unit.x);
    previousIntent = intent;
    if (intent.intent === ALLY_AI_INTENTS.ATTACK_OBJECTIVE) break;
  }
  assert.ok(positions.every((position, index) => index === 0 || position >= positions[index - 1]));
  assert.equal(unit.x, 876);
  const finalIntent = decideAllyIntent({
    missionType: "assault",
    unit,
    objective: { x: 900, active: true },
    previousIntent,
  });
  assert.equal(finalIntent.intent, ALLY_AI_INTENTS.ATTACK_OBJECTIVE);
});

test("a ranged unit stops at effective range from an enemy or objective", () => {
  assert.equal(destinationWithinRange({ fromX: 100, targetX: 900, attackRange: 180, ranged: true, rangePadding: 10 }), 730);
  assert.equal(destinationWithinRange({ fromX: 800, targetX: 900, attackRange: 180, ranged: true, rangePadding: 10 }), 800);
  const objectiveIntent = decideAllyIntent({
    missionType: "boss-assault",
    unit: { id: "marksman", x: 730, lane: 2, range: 180, ranged: true },
    objective: { x: 900, active: true },
  });
  assert.equal(objectiveIntent.intent, ALLY_AI_INTENTS.ATTACK_OBJECTIVE);
  assert.equal(objectiveIntent.moveDirection, 0);

  const enemyIntent = decideAllyIntent({
    missionType: "assault",
    unit: { id: "marksman", x: 430, lane: 2, range: 180, ranged: true },
    enemies: [{ id: "special", x: 600, lane: 2, priority: 10 }],
    objective: { x: 900, active: true },
  });
  assert.equal(enemyIntent.intent, ALLY_AI_INTENTS.HOLD_RANGE);
  assert.equal(enemyIntent.targetId, "special");
});

test("melee allies ignore adjacent-lane pseudo-contact while ranged allies may acquire it", () => {
  const adjacentEnemy = { id: "adjacent", x: 302, lane: 1, hp: 100, priority: 50 };
  const melee = decideAllyIntent({
    missionType: "assault",
    unit: { id: "kuma", x: 300, lane: 0, range: 31, ranged: false },
    enemies: [adjacentEnemy],
    objective: { x: 850, active: true },
  });
  assert.equal(melee.targetId, null);
  assert.equal(melee.intent, ALLY_AI_INTENTS.ADVANCE_OBJECTIVE);

  const ranged = decideAllyIntent({
    missionType: "assault",
    unit: { id: "baba", x: 300, lane: 0, range: 158, ranged: true },
    enemies: [adjacentEnemy],
    objective: { x: 850, active: true },
    hasLineOfSight: true,
  });
  assert.equal(ranged.targetId, adjacentEnemy.id);
  assert.equal(ranged.intent, ALLY_AI_INTENTS.HOLD_RANGE);
});

test("ranged allies reject an occluded adjacent-lane target and keep advancing", () => {
  const adjacentEnemy = { id: "occluded", x: 320, lane: 1, hp: 100, priority: 80 };
  const blocked = decideAllyIntent({
    missionType: "assault",
    unit: { id: "baba", x: 300, lane: 0, range: 158, ranged: true },
    enemies: [adjacentEnemy],
    objective: { x: 850, active: true },
    previousIntent: { targetId: adjacentEnemy.id, destinationX: 300, desiredX: 300, moveDirection: 0 },
    hasLineOfSight: false,
  });
  assert.equal(blocked.targetId, null);
  assert.equal(blocked.intent, ALLY_AI_INTENTS.ADVANCE_OBJECTIVE);
  assert.equal(blocked.moveDirection, 1);
  assert.equal(blocked.releaseTarget, true);
});

test("melee contact wins over a distant priority target while a ranged specialist keeps priority", () => {
  const walker = { id: "walker", x: 315, lane: 1, hp: 100, priority: 0 };
  const special = { id: "special", x: 420, lane: 1, hp: 100, priority: 48 };
  const melee = decideAllyIntent({
    missionType: "assault",
    unit: { id: "kuma", x: 300, lane: 1, range: 31, ranged: false },
    enemies: [special, walker],
    objective: { x: 850, active: true },
  });
  assert.equal(melee.targetId, walker.id);

  const ranged = decideAllyIntent({
    missionType: "assault",
    unit: { id: "baba", x: 300, lane: 1, range: 158, ranged: true },
    enemies: [walker, special],
    objective: { x: 850, active: true },
  });
  assert.equal(ranged.targetId, special.id);
});

test("claim limits keep surplus allies on the objective instead of pulling everyone to one far enemy", () => {
  const common = {
    missionType: "assault",
    unit: { id: "third", x: 120, lane: 1, range: 42, ranged: false },
    enemies: [{ id: "straggler", x: 700, lane: 1 }],
    objective: { x: 900, active: true },
    maxPursuersPerEnemy: 2,
    localThreatRadius: 120,
  };
  const available = decideAllyIntent({ ...common, claims: { straggler: 1 } });
  assert.equal(available.intent, ALLY_AI_INTENTS.INTERCEPT_ENEMY);
  assert.equal(available.targetId, "straggler");
  assert.equal(available.claimGranted, true);

  const full = decideAllyIntent({ ...common, claims: { straggler: 2 } });
  assert.equal(full.intent, ALLY_AI_INTENTS.ADVANCE_OBJECTIVE);
  assert.equal(full.targetId, null);
  assert.equal(full.reason, "objective-after-claim-limit");
});

test("TAKUYA defeat releases stale targets and forces a fresh infection-base objective decision", () => {
  const intent = decideAllyIntent({
    missionType: "boss-assault",
    unit: { id: "ally", x: 400, lane: 1, range: 130, ranged: true },
    enemies: [{ id: "stale-runner", x: 430, lane: 1 }],
    objective: { x: 900, active: true },
    previousIntent: { targetId: "stale-runner", destinationX: 410, desiredX: 410, moveDirection: 1 },
    takuyaDefeated: true,
  });
  assert.equal(intent.intent, ALLY_AI_INTENTS.ADVANCE_OBJECTIVE);
  assert.equal(intent.reason, "takuya-defeated-objective");
  assert.equal(intent.targetId, null);
  assert.equal(intent.releaseTarget, true);
  assert.equal(intent.reassess, true);
});

test("deadband absorbs small target jitter instead of reversing direction every tick", () => {
  const previousIntent = {
    targetId: "walker",
    destinationX: 505,
    desiredX: 505,
    moveDirection: 1,
  };
  const intent = decideAllyIntent({
    missionType: "assault",
    unit: { id: "ally", x: 500, lane: 1, range: 24, ranged: false, contactRange: 24 },
    enemies: [{ id: "walker", x: 520, lane: 1 }],
    previousIntent,
    deadband: 8,
  });
  assert.equal(intent.targetId, "walker");
  assert.equal(intent.moveDirection, 0);
  assert.equal(intent.deadbandHeld, true);
});

test("a lost previous target is released and the ally resumes its objective", () => {
  const intent = decideAllyIntent({
    missionType: "assault",
    unit: { id: "ally", x: 300, lane: 0, range: 42, ranged: false },
    enemies: [],
    objective: { x: 900, active: true },
    previousIntent: { targetId: "gone", destinationX: 450, moveDirection: 1 },
  });
  assert.equal(intent.intent, ALLY_AI_INTENTS.ADVANCE_OBJECTIVE);
  assert.equal(intent.releaseTarget, true);
  assert.equal(intent.reason, "objective-no-enemy");
});

test("Stage 1 assault advances on X while returning to the assigned lane", () => {
  const intent = decideAllyIntent({
    missionType: "assault",
    unit: { id: "assault-lower-spawn", x: 100, lane: 2, assignedLane: 0, range: 42, ranged: false },
    objective: { x: 900, active: true },
  });
  assert.equal(intent.intent, ALLY_AI_INTENTS.ADVANCE_OBJECTIVE);
  assert.equal(intent.moveDirection, 1);
  assert.equal(intent.assignedLane, 0);
  assert.equal(intent.destinationLane, 0);
});

test("Stage 2 defense uses the assigned lane's X anchor and returns to that lane", () => {
  const intent = decideAllyIntent({
    missionType: "timed-defense",
    unit: { id: "defender", x: 520, lane: 2, assignedLane: 0, range: 42, ranged: false },
    enemies: [],
    defenseAnchor: { 0: 305, 1: 325, 2: 345 },
  });
  assert.equal(intent.intent, ALLY_AI_INTENTS.RETURN_TO_DEFENSE);
  assert.equal(intent.desiredX, 305);
  assert.equal(intent.assignedLane, 0);
  assert.equal(intent.destinationLane, 0);
});

test("an in-progress lane reassignment releases the old-lane target until the assigned lane is reached", () => {
  const intent = decideAllyIntent({
    missionType: "timed-defense",
    unit: { id: "transfer", x: 360, lane: 2, assignedLane: 0, range: 42, ranged: false },
    enemies: [{ id: "old-lane", x: 370, lane: 2, hp: 100 }],
    defenseAnchor: { 0: 305, 1: 325, 2: 345 },
    previousIntent: { targetId: "old-lane", destinationX: 360, moveDirection: 0 },
    laneTransitioning: true,
  });
  assert.equal(intent.targetId, null);
  assert.equal(intent.releaseTarget, true);
  assert.equal(intent.intent, ALLY_AI_INTENTS.RETURN_TO_DEFENSE);
  assert.equal(intent.destinationLane, 0);
});

test("a visible adjacent target temporarily owns destination lane, then loss returns the assignment", () => {
  const enemy = { id: "runner", x: 400, lane: 1, hp: 100 };
  const engaged = decideAllyIntent({
    missionType: "timed-defense",
    unit: { id: "ranged", x: 300, lane: 0, assignedLane: 0, range: 158, ranged: true },
    enemies: [enemy],
    defenseAnchor: { 0: 305, 1: 325, 2: 345 },
    hasLineOfSight: true,
  });
  assert.equal(engaged.targetId, enemy.id);
  assert.equal(engaged.destinationLane, 1);

  const released = decideAllyIntent({
    missionType: "timed-defense",
    unit: { id: "ranged", x: 300, lane: 0, assignedLane: 0, range: 158, ranged: true },
    enemies: [],
    defenseAnchor: { 0: 305, 1: 325, 2: 345 },
    previousIntent: engaged,
  });
  assert.equal(released.targetId, null);
  assert.equal(released.releaseTarget, true);
  assert.equal(released.destinationLane, 0);
});

test("assigned lane never makes adjacent-lane pseudo-contact legal for melee", () => {
  const intent = decideAllyIntent({
    missionType: "assault",
    unit: { id: "melee", x: 300, lane: 2, assignedLane: 1, range: 42, ranged: false },
    enemies: [{ id: "adjacent", x: 305, lane: 1, hp: 100 }],
    objective: { x: 850, active: true },
  });
  assert.equal(intent.targetId, null);
  assert.equal(intent.destinationLane, 1);
  assert.equal(intent.intent, ALLY_AI_INTENTS.ADVANCE_OBJECTIVE);
});
