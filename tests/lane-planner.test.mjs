import assert from "node:assert/strict";
import test from "node:test";

import { LANE_Y, MOBILE_LANDSCAPE_LANE_Y } from "../app/gameRules.js";
import {
  advanceTowardLane,
  chooseCommittedEnemyLane,
  chooseHumanDeploymentLane,
  laneForCenters,
  planHumanLaneAssignments,
} from "../app/lanePlanner.js";

function lanesById(plan) {
  return Object.fromEntries(plan.assignments.map(({ id, lane }) => [id, lane]));
}

test("initial deployment balances six survivors in stable center-top-bottom order", () => {
  const shuffled = [6, 2, 5, 1, 4, 3].map((id) => ({ id, lane: 2, y: LANE_Y[2], laneSpeed: 60 }));
  const plan = planHumanLaneAssignments({ units: shuffled });

  assert.deepEqual(lanesById(plan), { 1: 1, 2: 0, 3: 2, 4: 1, 5: 0, 6: 2 });
  assert.equal(plan.moves.length, 0);
  assert.equal(chooseHumanDeploymentLane({ laneCounts: [2, 1, 1] }), 1);
});

test("initial ID-to-lane assignment does not depend on input array order", () => {
  const ascending = [1, 2, 3, 4, 5, 6].map((id) => ({ id }));
  const descending = ascending.slice().reverse();
  assert.deepEqual(
    lanesById(planHumanLaneAssignments({ units: ascending })),
    lanesById(planHumanLaneAssignments({ units: descending })),
  );
});

test("a due squad plan makes at most one pressure-improving reassignment", () => {
  const plan = planHumanLaneAssignments({
    units: [
      { id: 1, assignedLane: 0, lane: 0, y: LANE_Y[0], laneSpeed: 70 },
      { id: 2, assignedLane: 0, lane: 0, y: LANE_Y[0], laneSpeed: 70 },
      { id: 3, assignedLane: 1, lane: 1, y: LANE_Y[1], laneSpeed: 70 },
      { id: 4, assignedLane: 2, lane: 2, y: LANE_Y[2], laneSpeed: 70 },
    ],
    laneThreats: [{ lane: 2, threatened: true, critical: 3, total: 3 }],
    now: 5,
  });

  assert.equal(plan.moves.length, 1);
  assert.deepEqual(plan.moves[0], {
    id: 1,
    fromLane: 0,
    toLane: 2,
    nextLaneDecisionAt: 7.35,
  });
  assert.deepEqual(plan.deficitBefore, [0, 2, 0, 2]);
  assert.deepEqual(plan.deficitAfter, [0, 1, 0, 1]);
});

test("a threatened donor lane is not emptied while a clear donor may send its last survivor", () => {
  const protectedPlan = planHumanLaneAssignments({
    units: [
      { id: 1, assignedLane: 0 },
      { id: 2, assignedLane: 1 },
      { id: 3, assignedLane: 1 },
    ],
    laneThreats: [
      { lane: 0, threatened: true, total: 1 },
      { lane: 2, threatened: true, critical: 2, total: 2 },
    ],
  });
  assert.equal(protectedPlan.moves.length, 1);
  assert.equal(protectedPlan.moves[0].id, 2);
  assert.equal(lanesById(protectedPlan)[1], 0);

  const clearDonorPlan = planHumanLaneAssignments({
    units: [
      { id: 1, assignedLane: 0 },
      { id: 2, assignedLane: 1 },
    ],
    laneThreats: [{ lane: 2, threatened: true, critical: 1, total: 1 }],
  });
  assert.deepEqual(clearDonorPlan.moves.map(({ id, fromLane, toLane }) => ({ id, fromLane, toLane })), [
    { id: 1, fromLane: 0, toLane: 2 },
  ]);
});

test("engagement, per-unit cooldown, squad cadence, and equal pressure preserve assignments", () => {
  const units = [
    { id: 1, assignedLane: 0, targetId: 91, nextLaneDecisionAt: 0 },
    { id: 2, assignedLane: 1, nextLaneDecisionAt: 10 },
    { id: 3, assignedLane: 2, nextLaneDecisionAt: 10 },
  ];
  const criticalTop = [{ lane: 0, threatened: true, critical: 2, total: 2 }];
  const cooldown = planHumanLaneAssignments({ units, laneThreats: criticalTop, now: 5 });
  assert.equal(cooldown.changed, false);

  const cadence = planHumanLaneAssignments({
    units: units.map((unit) => ({ ...unit, targetId: null, nextLaneDecisionAt: 0 })),
    laneThreats: criticalTop,
    now: 5,
    nextPlanAt: 6,
  });
  assert.equal(cadence.changed, false);
  assert.equal(cadence.nextPlanAt, 6);

  const equal = planHumanLaneAssignments({
    units: units.map((unit) => ({ ...unit, targetId: null, nextLaneDecisionAt: 0 })),
    laneThreats: [1, 1, 1],
    now: 5,
  });
  assert.equal(equal.changed, false);
  assert.deepEqual(lanesById(equal), { 1: 0, 2: 1, 3: 2 });
});

test("Y movement reaches assignments in standard and 844x390 lane layouts", () => {
  const standardStep = advanceTowardLane({
    y: LANE_Y[2],
    currentLane: 2,
    destinationLane: 0,
    laneCenters: LANE_Y,
    laneSpeed: 70,
    seconds: 1,
  });
  assert.deepEqual(standardStep, {
    y: LANE_Y[1],
    lane: 1,
    destinationLane: 0,
    moveDirection: -1,
    reached: false,
  });
  const standardSettled = advanceTowardLane({
    y: standardStep.y,
    currentLane: standardStep.lane,
    destinationLane: 0,
    laneCenters: LANE_Y,
    laneSpeed: 70,
    seconds: 1,
  });
  assert.equal(standardSettled.y, LANE_Y[0]);
  assert.equal(standardSettled.lane, 0);
  assert.equal(standardSettled.reached, true);

  const compact = advanceTowardLane({
    y: MOBILE_LANDSCAPE_LANE_Y[2],
    currentLane: 2,
    destinationLane: 1,
    laneCenters: MOBILE_LANDSCAPE_LANE_Y,
    laneSpeed: 45,
    seconds: 1,
  });
  assert.equal(compact.y, MOBILE_LANDSCAPE_LANE_Y[1]);
  assert.equal(compact.lane, 1);
  assert.equal(compact.reached, true);
});

test("physical lane hysteresis absorbs Y-boundary jitter", () => {
  assert.equal(laneForCenters({ y: 249, laneCenters: LANE_Y, currentLane: 0, hysteresis: 5 }), 0);
  assert.equal(laneForCenters({ y: 250, laneCenters: LANE_Y, currentLane: 0, hysteresis: 5 }), 1);
  assert.equal(laneForCenters({ y: 245, laneCenters: LANE_Y, currentLane: 1, hysteresis: 5 }), 1);
});

test("enemy route commits only when idle, past the gate, settled, and off cooldown", () => {
  const common = {
    currentLane: 1,
    physicalLane: 1,
    x: 600,
    y: LANE_Y[1],
    laneCenters: LANE_Y,
    routeCosts: [1, 10, 8],
    now: 5,
  };
  const switched = chooseCommittedEnemyLane(common);
  assert.equal(switched.committedLane, 0);
  assert.equal(switched.changed, true);
  assert.equal(switched.reason, "lower-cost-route");
  assert.equal(switched.nextLaneDecisionAt, 5.8);

  assert.equal(chooseCommittedEnemyLane({ ...common, x: 520 }).reason, "before-route-gate");
  assert.equal(chooseCommittedEnemyLane({ ...common, targetId: 9 }).reason, "engaged");
  assert.equal(chooseCommittedEnemyLane({ ...common, nextLaneDecisionAt: 6 }).reason, "cooldown");
  assert.equal(chooseCommittedEnemyLane({ ...common, physicalLane: 0 }).reason, "lane-transition");
});

test("enemy route hysteresis retains ties and a new route cannot ping-pong mid-transition", () => {
  const tied = chooseCommittedEnemyLane({
    currentLane: 1,
    physicalLane: 1,
    x: 600,
    y: LANE_Y[1],
    routeCosts: [4, 5, 9],
    switchMargin: 1,
    now: 2,
  });
  assert.equal(tied.changed, false);
  assert.equal(tied.committedLane, 1);
  assert.equal(tied.reason, "retain-route");

  const transition = chooseCommittedEnemyLane({
    currentLane: 0,
    physicalLane: 1,
    x: 600,
    y: LANE_Y[1],
    routeCosts: [10, 8, 0],
    now: 20,
    nextLaneDecisionAt: 0,
  });
  assert.equal(transition.changed, false);
  assert.equal(transition.committedLane, 0);
  assert.equal(transition.reason, "lane-transition");
});
