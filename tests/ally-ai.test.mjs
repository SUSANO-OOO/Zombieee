import assert from "node:assert/strict";
import test from "node:test";

import { ALLY_AI_INTENTS, decideAllyIntent, destinationWithinRange } from "../app/allyAi.js";
import { createBattleDefinition } from "../app/battleDefinitions.js";
import { CAMPAIGN_STAGES } from "../app/campaign.js";
import { COMBAT_ROLE_RULES, canNormalAttackTarget, combatHitboxesOverlap } from "../app/combatLifecycle.js";
import { LANE_Y, UNIT_CARDS, WORLD_GEOMETRY, advanceZombieX, humanCombatMinX, isCrawlerRouteBlocker } from "../app/gameRules.js";

function advance(unit, intent, speed = 40) {
  if (intent.moveDirection === 0) return { ...unit };
  const remaining = intent.destinationX - unit.x;
  const step = Math.sign(remaining) * Math.min(Math.abs(remaining), speed);
  return { ...unit, x: unit.x + step };
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
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

test("Stage 2 advances to a forward line, falls back for a threat, resumes, and settles without jitter", () => {
  const defenseAnchor = { 0: 305, 1: 325, 2: 345 };
  const forwardAnchor = { 0: 540, 1: 555, 2: 570 };
  const unit = { id: "mobile-defender", x: 325, lane: 1, assignedLane: 1, range: 42, ranged: false };

  const advancing = decideAllyIntent({
    missionType: "timed-defense",
    unit,
    enemies: [],
    defenseAnchor,
    forwardAnchor,
  });
  assert.equal(advancing.intent, ALLY_AI_INTENTS.ADVANCE_DEFENSE_LINE);
  assert.equal(advancing.reason, "front-clear");
  assert.equal(advancing.desiredX, 555);
  assert.equal(advancing.moveDirection, 1);

  const retreating = decideAllyIntent({
    missionType: "timed-defense",
    unit: { ...unit, x: 540 },
    enemies: [{ id: "breach-runner", x: 360, lane: 1, hp: 100 }],
    defenseAnchor,
    forwardAnchor,
    previousIntent: advancing,
  });
  assert.equal(retreating.intent, ALLY_AI_INTENTS.INTERCEPT_ENEMY);
  assert.equal(retreating.targetId, "breach-runner");
  assert.equal(retreating.desiredX, 384);
  assert.equal(retreating.moveDirection, -1);

  const resuming = decideAllyIntent({
    missionType: "timed-defense",
    unit: { ...unit, x: 410 },
    enemies: [],
    defenseAnchor,
    forwardAnchor,
    previousIntent: retreating,
  });
  assert.equal(resuming.intent, ALLY_AI_INTENTS.ADVANCE_DEFENSE_LINE);
  assert.equal(resuming.targetId, null);
  assert.equal(resuming.releaseTarget, true);
  assert.equal(resuming.desiredX, 555);
  assert.equal(resuming.moveDirection, 1);

  const settled = decideAllyIntent({
    missionType: "timed-defense",
    unit: { ...unit, x: 551 },
    enemies: [],
    defenseAnchor,
    forwardAnchor,
    previousIntent: resuming,
    deadband: 8,
  });
  assert.equal(settled.intent, ALLY_AI_INTENTS.HOLD_DEFENSE_LINE);
  assert.equal(settled.desiredX, 555);
  assert.equal(settled.destinationX, 551);
  assert.equal(settled.moveDirection, 0);
  assert.equal(settled.deadbandHeld, true);
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

test("a medic cannot lock an adjacent-lane target that its real attack transaction rejects", () => {
  const intent = decideAllyIntent({
    missionType: "timed-defense",
    unit: {
      id: "medic",
      x: 300,
      lane: 0,
      assignedLane: 0,
      range: 118,
      ranged: true,
      allowAdjacentLaneTargets: false,
    },
    enemies: [{ id: "adjacent", x: 330, lane: 1, hp: 100, priority: 80 }],
    defenseAnchor: { 0: 315, 1: 335, 2: 315 },
    forwardAnchor: { 0: 540, 1: 555, 2: 540 },
    hasLineOfSight: true,
  });

  assert.equal(intent.targetId, null);
  assert.equal(intent.intent, ALLY_AI_INTENTS.ADVANCE_DEFENSE_LINE);
});

test("adjacent-lane ranged pursuit stops inside the real two-dimensional attack radius", () => {
  const target = {
    id: "adjacent-runner",
    x: 500,
    lane: 1,
    hp: 100,
    bodyRadius: 11,
    verticalDistance: 70,
  };
  const intent = decideAllyIntent({
    missionType: "assault",
    unit: {
      id: "gunner",
      x: 300,
      lane: 0,
      assignedLane: 0,
      range: 92,
      ranged: true,
      allowAdjacentLaneTargets: true,
    },
    enemies: [target],
    objective: { x: 875, active: true },
    hasLineOfSight: true,
  });

  assert.equal(intent.targetId, target.id);
  assert.ok(Math.hypot(target.x - intent.desiredX, target.verticalDistance) <= 92 + target.bodyRadius);
  assert.equal(intent.moveDirection, 1);
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

test("a CRAWLER breach threat outranks a retained distant target", () => {
  const intent = decideAllyIntent({
    missionType: "assault",
    unit: { id: "defender", x: 520, lane: 1, assignedLane: 1, range: 30, ranged: false },
    enemies: [
      { id: "retained", x: 720, lane: 1, hp: 100, priority: 80 },
      { id: "breach", x: 145, lane: 1, hp: 100, threatensBase: true, priority: -80 },
    ],
    objective: { x: 875, active: true },
    previousIntent: { targetId: "retained", destinationX: 690, desiredX: 690, moveDirection: 1 },
    localThreatRadius: 120,
  });

  assert.equal(intent.targetId, "breach");
  assert.equal(intent.reason, "crawler-under-attack");
  assert.equal(intent.moveDirection, -1);
});

test("a CRAWLER breach threat outranks an unrelated local contact", () => {
  const intent = decideAllyIntent({
    missionType: "assault",
    unit: { id: "defender", x: 520, lane: 1, assignedLane: 1, range: 30, ranged: false },
    enemies: [
      { id: "local", x: 500, lane: 1, hp: 100 },
      { id: "breach", x: 145, lane: 1, hp: 100, threatensBase: true },
    ],
    objective: { x: 875, active: true },
    localThreatRadius: 120,
  });

  assert.equal(intent.targetId, "breach");
  assert.equal(intent.reason, "crawler-under-attack");
  assert.equal(intent.moveDirection, -1);
});

test("the closest CRAWLER threat outranks another enemy inside the broad danger zone", () => {
  const intent = decideAllyIntent({
    missionType: "assault",
    unit: { id: "defender", x: 520, lane: 1, assignedLane: 1, range: 30, ranged: false },
    enemies: [
      { id: "danger-zone", x: 300, lane: 1, hp: 100, threatensBase: true, baseThreatDistance: 190 },
      { id: "siege", x: 145, lane: 1, hp: 100, threatensBase: true, baseThreatDistance: 35 },
    ],
    objective: { x: 875, active: true },
    localThreatRadius: 120,
  });

  assert.equal(intent.targetId, "siege");
  assert.equal(intent.reason, "crawler-under-attack");
});

test("all campaign stages and melee allies reach a CRAWLER attacker instead of sticking at the muster line", () => {
  const enemy = {
    id: "breach-walker",
    x: WORLD_GEOMETRY.baseX + 25 + 10,
    lane: 1,
    hp: 100,
    bodyRadius: 11,
    threatensBase: true,
  };

  const meleeCards = UNIT_CARDS.filter((card) => card.range <= 64);
  for (const stage of CAMPAIGN_STAGES) for (const card of meleeCards) {
    const definition = createBattleDefinition(stage.id);
    let unit = { id: `${card.kind}-${stage.id}`, x: 520, lane: 1, assignedLane: 1, range: card.range, ranged: false };
    let previousIntent = null;

    for (let tick = 0; tick < 160; tick += 1) {
      const intent = decideAllyIntent({
        missionType: definition.missionType,
        unit,
        enemies: [enemy],
        objective: definition.missionType === "timed-defense" ? null : { x: 875, active: true },
        defenseAnchor: { 0: 315, 1: 335, 2: 315 },
        forwardAnchor: { 0: 540, 1: 555, 2: 540 },
        previousIntent,
      });
      const remaining = intent.destinationX - unit.x;
      const nextX = unit.x + Math.sign(remaining) * Math.min(Math.abs(remaining), card.speed * .25);
      const minX = humanCombatMinX({
        desiredX: intent.destinationX,
        hasEnemyTarget: intent.targetId === enemy.id,
      });
      unit = { ...unit, x: Math.max(minX, nextX) };
      previousIntent = intent;
      if (Math.abs(unit.x - enemy.x) <= unit.range + enemy.bodyRadius) break;
    }

    assert.ok(
      Math.abs(unit.x - enemy.x) <= unit.range + enemy.bodyRadius,
      `${stage.id}/${card.kind} stopped at x=${unit.x} before reaching the CRAWLER attacker`,
    );
  }
});

test("Stage 3 reacquires a surviving enemy on the tick after TAKUYA is defeated", () => {
  const intent = decideAllyIntent({
    missionType: "boss-assault",
    unit: { id: "ally", x: 400, lane: 1, range: 130, ranged: true },
    enemies: [{ id: "surviving-runner", x: 430, lane: 1 }],
    objective: { x: 900, active: true },
    previousIntent: { targetId: "takuya", destinationX: 410, desiredX: 410, moveDirection: 1 },
    takuyaDefeated: true,
  });
  assert.equal(intent.intent, ALLY_AI_INTENTS.HOLD_RANGE);
  assert.equal(intent.targetId, "surviving-runner");
  assert.equal(intent.releaseTarget, true);
  assert.equal(intent.reassess, true);

  const reinforcement = decideAllyIntent({
    missionType: "boss-assault",
    unit: { id: "ally", x: 400, lane: 1, range: 130, ranged: true },
    enemies: [{ id: "later-reinforcement", x: 470, lane: 1 }],
    objective: { x: 900, active: true },
    previousIntent: intent,
    takuyaDefeated: true,
  });
  assert.equal(reinforcement.targetId, "later-reinforcement");
  assert.equal(reinforcement.releaseTarget, true);
});

test("TAKUYA defeat never makes the squad ignore a live CRAWLER breach", () => {
  const intent = decideAllyIntent({
    missionType: "boss-assault",
    unit: { id: "ally", x: 520, lane: 1, assignedLane: 1, range: 30, ranged: false },
    enemies: [
      { id: "late-reinforcement", x: 145, lane: 1, hp: 100, threatensBase: true },
      { id: "remote-straggler", x: 650, lane: 1, hp: 100 },
    ],
    objective: { x: 875, active: true },
    previousIntent: { targetId: "remote-straggler", destinationX: 620, desiredX: 620, moveDirection: 1 },
    takuyaDefeated: true,
  });

  assert.equal(intent.targetId, "late-reinforcement");
  assert.equal(intent.reason, "crawler-under-attack");
  assert.equal(intent.moveDirection, -1);
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

test("a mobile lane transfer stops for real TAKUYA hitbox overlap and selects the same attack target", () => {
  const unit = {
    id: "mobile-transfer",
    side: "human",
    kind: "brawler",
    x: 300,
    y: 255,
    lane: 0,
    assignedLane: 1,
    range: 30,
    bodyRadius: 12,
    ranged: false,
  };
  const takuya = {
    id: "takuya-transition",
    side: "zombie",
    kind: "takuya",
    x: 300,
    y: 285,
    lane: 1,
    hp: 300,
    bodyRadius: 28,
  };

  assert.equal(combatHitboxesOverlap({ left: unit, right: takuya }), true);
  assert.equal(canNormalAttackTarget({ attacker: unit, target: takuya }), true);
  const intent = decideAllyIntent({
    missionType: "assault",
    unit,
    enemies: [takuya],
    objective: { x: 875, active: true },
    laneTransitioning: true,
  });
  assert.equal(intent.targetId, takuya.id);
  assert.equal(intent.attackable, true);
  assert.equal(intent.moveDirection, 0);
});

test("a lane transfer still pursues an urgent CRAWLER threat in its destination lane", () => {
  const intent = decideAllyIntent({
    missionType: "boss-assault",
    unit: { id: "transfer", x: 420, lane: 2, assignedLane: 0, range: 30, ranged: false },
    enemies: [
      { id: "old-lane", x: 430, lane: 2, hp: 100 },
      { id: "top-breach", x: 160, lane: 0, hp: 100, threatensBase: true },
    ],
    objective: { x: 875, active: true },
    previousIntent: { targetId: "old-lane", destinationX: 420, moveDirection: 0 },
    laneTransitioning: true,
  });

  assert.equal(intent.targetId, "top-breach");
  assert.equal(intent.reason, "crawler-under-attack");
  assert.equal(intent.destinationLane, 0);
  assert.equal(intent.moveDirection, -1);
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

test("an attackable or overlapping enemy cannot be ignored because its claim limit is full", () => {
  const unit = { id: "gunner", x: 300, y: LANE_Y[1], lane: 1, range: 145, ranged: true, bodyRadius: 12 };
  const enemy = { id: "claimed", x: 420, y: LANE_Y[1], lane: 1, hp: 100, bodyRadius: 12 };
  const attackable = decideAllyIntent({
    unit,
    enemies: [enemy],
    objective: { x: 875, active: true },
    claims: { claimed: 99 },
  });
  assert.equal(canNormalAttackTarget({
    attacker: { ...unit, side: "human" },
    target: { ...enemy, side: "zombie" },
  }), true);
  assert.equal(attackable.targetId, enemy.id);
  assert.equal(attackable.moveDirection, 0);
  assert.equal(attackable.attackable, true);

  const overlappingEnemy = { ...enemy, id: "overlap", x: 308 };
  const overlap = decideAllyIntent({
    unit,
    enemies: [overlappingEnemy],
    objective: { x: 875, active: true },
    claims: { overlap: 99 },
  });
  assert.equal(combatHitboxesOverlap({
    left: { ...unit, side: "human" },
    right: { ...overlappingEnemy, side: "zombie" },
  }), true);
  assert.equal(overlap.reason, "hitbox-overlap");
  assert.equal(overlap.moveDirection, 0);
  assert.equal(overlap.destinationX, unit.x);
});

test("contact and path blockers outrank retained and high-score remote targets", () => {
  const common = {
    unit: { id: "front", x: 300, y: LANE_Y[1], lane: 1, range: 30, ranged: false, bodyRadius: 12 },
    objective: { x: 875, active: true },
    previousIntent: { targetId: "retained", destinationX: 500, desiredX: 500, moveDirection: 1 },
  };
  const path = decideAllyIntent({
    ...common,
    enemies: [
      { id: "retained", x: 480, y: LANE_Y[1], lane: 1, hp: 100, priority: 100 },
      { id: "blocker", x: 410, y: LANE_Y[1], lane: 1, hp: 100, blocksPath: true, priority: -100 },
    ],
  });
  assert.equal(path.targetId, "blocker");
  assert.equal(path.reason, "path-blocker");
});

test("same-lane Y drift reacquires on the next aligned tick without advancing through the target", () => {
  const enemy = { id: "drift-target", x: 300, y: LANE_Y[1], lane: 1, hp: 100, bodyRadius: 11 };
  const drifted = decideAllyIntent({
    unit: { id: "melee", x: 300, y: LANE_Y[1] - 50, lane: 1, range: 30, ranged: false, bodyRadius: 12 },
    enemies: [enemy],
    objective: { x: 875, active: true },
  });
  assert.equal(drifted.targetId, enemy.id);
  assert.equal(drifted.attackable, false);
  assert.equal(drifted.moveDirection, 0);

  const aligned = decideAllyIntent({
    unit: { id: "melee", x: 300, y: LANE_Y[1], lane: 1, range: 30, ranged: false, bodyRadius: 12 },
    enemies: [enemy],
    objective: { x: 875, active: true },
    previousIntent: drifted,
  });
  assert.equal(aligned.targetId, enemy.id);
  assert.equal(aligned.attackable, true);
  assert.equal(aligned.moveDirection, 0);
});

test("all eleven playable roles keep search and real attack eligibility aligned across all three lanes", () => {
  for (const lane of [0, 1, 2]) for (const card of UNIT_CARDS) {
    const rule = COMBAT_ROLE_RULES[card.kind];
    const role = {
      kind: card.kind,
      range: card.range,
      ranged: rule.attackType === "ranged",
      attackType: rule.attackType,
      allowAdjacentLaneTargets: rule.allowAdjacentLaneTargets,
    };
    const unit = { id: `${card.kind}-${lane}`, side: "human", x: 300, y: LANE_Y[lane], lane, bodyRadius: 12, ...role };
    const enemy = { id: `same-${card.kind}-${lane}`, side: "zombie", x: 320, y: LANE_Y[lane], lane, hp: 100, bodyRadius: 11 };
    const intent = decideAllyIntent({ unit, enemies: [enemy], objective: { x: 875, active: true }, hasLineOfSight: true });
    assert.equal(canNormalAttackTarget({ attacker: unit, target: enemy, hasLineOfSight: true }), true);
    assert.equal(intent.targetId, enemy.id, `${card.kind}/lane-${lane}`);
    assert.equal(intent.moveDirection, 0, `${card.kind}/lane-${lane}`);

    const adjacentLane = lane === 2 ? 1 : lane + 1;
    const adjacent = { ...enemy, id: `adjacent-${card.kind}-${lane}`, lane: adjacentLane, y: LANE_Y[adjacentLane], x: 305 };
    const adjacentIntent = decideAllyIntent({ unit, enemies: [adjacent], objective: { x: 875, active: true }, hasLineOfSight: true });
    const canAttackAdjacent = canNormalAttackTarget({ attacker: unit, target: adjacent, hasLineOfSight: true });
    assert.equal(Boolean(adjacentIntent.targetId), canAttackAdjacent, `${card.kind}/lane-${lane} adjacent consistency`);
  }
});

function simulateStage3Interception(seed, decide = decideAllyIntent) {
  const rolePool = [
    { kind: "brawler", range: 30, ranged: false, allowAdjacentLaneTargets: false },
    { kind: "ranger", range: 145, ranged: true, allowAdjacentLaneTargets: true },
    { kind: "medic", role: "medic", range: 118, ranged: true, allowAdjacentLaneTargets: false },
  ];
  const random = seededRandom(seed);
  const allies = [0, 1, 2].map((lane) => ({
    id: `ally-${seed}-${lane}`,
    side: "human",
    lane,
    x: 250 + Math.floor(random() * 31),
    y: LANE_Y[lane] + Math.floor(random() * 29) - 14,
    bodyRadius: 12,
    hp: 100,
    ...rolePool[(seed + lane) % rolePool.length],
  }));
  let enemies = [0, 1, 2].map((lane) => ({
    id: `enemy-${seed}-${lane}`,
    side: "zombie",
    kind: lane === 1 ? "takuya" : "walker",
    lane,
    x: 540 + Math.floor(random() * 81),
    y: LANE_Y[lane],
    hp: lane === 1 ? 240 : 100,
    bodyRadius: lane === 1 ? 28 : 11,
    combatReady: true,
  }));
  const previous = new Map();
  let passThroughs = 0;
  let ignoredAttackableTicks = 0;
  let reacquiredAfterTakuya = false;

  for (let tick = 0; tick < 120; tick += 1) {
    if (tick === 30) enemies = enemies.filter((enemy) => enemy.kind !== "takuya");
    if (tick === 31) enemies.push({
      id: `reinforcement-${seed}`,
      side: "zombie",
      kind: "runner",
      lane: seed % 3,
      x: 620,
      y: LANE_Y[seed % 3],
      hp: 100,
      bodyRadius: 11,
      combatReady: true,
    });

    const claims = {};
    for (const intent of previous.values()) {
      if (intent?.targetId != null) claims[intent.targetId] = (claims[intent.targetId] ?? 0) + 1;
    }

    for (const ally of allies) {
      const intent = decide({
        missionType: "boss-assault",
        unit: ally,
        enemies,
        objective: { x: 875, active: true },
        claims,
        previousIntent: previous.get(ally.id),
        takuyaDefeated: tick >= 30,
        hasLineOfSight: true,
      });
      previous.set(ally.id, intent);
      const selected = enemies.find((enemy) => enemy.id === intent.targetId);
      const attackableEnemies = enemies.filter((enemy) => canNormalAttackTarget({ attacker: ally, target: enemy, hasLineOfSight: true }));
      if (attackableEnemies.length > 0 && (
        !attackableEnemies.some((enemy) => enemy.id === intent.targetId)
        || intent.moveDirection !== 0
      )) ignoredAttackableTicks += 1;
      const attackable = selected && canNormalAttackTarget({ attacker: ally, target: selected, hasLineOfSight: true });
      if (attackable) {
        assert.equal(intent.moveDirection, 0, `seed ${seed}, tick ${tick}: advanced while selected target was attackable`);
        selected.hp -= ally.kind === "ranger" ? 12 : 8;
      }
      if (tick >= 31 && intent.targetId === `reinforcement-${seed}`) reacquiredAfterTakuya = true;
      ally.x += Math.sign(intent.destinationX - ally.x) * Math.min(Math.abs(intent.destinationX - ally.x), 12);
      ally.y += Math.sign(LANE_Y[ally.lane] - ally.y) * Math.min(Math.abs(LANE_Y[ally.lane] - ally.y), 10);
    }

    enemies = enemies.filter((enemy) => enemy.hp > 0);
    for (const enemy of enemies) {
      const defender = allies.find((ally) => ally.lane === enemy.lane);
      const routeBlocker = allies
        .filter((ally) => isCrawlerRouteBlocker({
          enemyX: enemy.x,
          defenderX: ally.x,
          defenderY: ally.y,
          routeY: LANE_Y[enemy.lane],
          lookAhead: 105,
        }))
        .sort((left, right) => right.x - left.x)[0];
      const beforeX = enemy.x;
      enemy.x = advanceZombieX({
        enemyX: enemy.x,
        speed: 28 + random() * 12,
        seconds: .25,
        targetFloor: routeBlocker?.x ?? null,
      });
      if (beforeX >= defender.x && enemy.x < defender.x) passThroughs += 1;
    }
  }

  return { passThroughs, ignoredAttackableTicks, reacquiredAfterTakuya };
}

test("100 deterministic Stage 3 seeds produce zero AI pass-throughs and reacquire post-TAKUYA reinforcements", () => {
  for (let seed = 1; seed <= 100; seed += 1) {
    const result = simulateStage3Interception(seed);
    assert.equal(result.passThroughs, 0, `seed ${seed}`);
    assert.equal(result.ignoredAttackableTicks, 0, `seed ${seed}: attackable enemy was ignored`);
    assert.equal(result.reacquiredAfterTakuya, true, `seed ${seed}: reinforcement was not reacquired`);
  }

  const ignoreEnemies = ({ unit }) => ({
    targetId: null,
    destinationX: unit.x,
    desiredX: unit.x,
    moveDirection: 0,
  });
  assert.ok(
    simulateStage3Interception(1, ignoreEnemies).ignoredAttackableTicks > 0,
    "the regression simulation must detect disabled target acquisition",
  );
});
