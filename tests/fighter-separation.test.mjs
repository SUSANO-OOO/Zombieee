import assert from "node:assert/strict";
import test from "node:test";

import { sameSideSeparationStep } from "../app/fighterSeparation.js";

test("same-side bodies separate across their full radii instead of vertically stacking", () => {
  const step = sameSideSeparationStep({
    id: 3,
    side: "human",
    x: 300,
    y: 282,
    bodyRadius: 18,
    otherX: 330,
    otherY: 282,
    otherBodyRadius: 18,
  });
  assert.equal(step.separated, true, "30px gap is still overlap for two 18px bodies");
  assert.ok(Math.hypot(step.dx, step.dy) > 0);
  assert.deepEqual(sameSideSeparationStep({
    id: 3,
    side: "human",
    x: 300,
    y: 282,
    bodyRadius: 18,
    otherX: 338,
    otherY: 282,
    otherBodyRadius: 18,
  }), { dx: 0, dy: 0, separated: false });
});

test("enemy queues fan out inside the floor and yield longitudinally at an edge", () => {
  const fan = sameSideSeparationStep({
    id: 5,
    side: "zombie",
    x: 300,
    y: 282,
    bodyRadius: 20,
    otherX: 300,
    otherY: 282,
    otherBodyRadius: 20,
    laneMinY: 212,
    laneMaxY: 352,
  });
  assert.equal(fan.separated, true);
  assert.notEqual(fan.dy, 0);

  const edge = sameSideSeparationStep({
    id: 5,
    side: "zombie",
    x: 320,
    y: 351,
    bodyRadius: 20,
    otherX: 300,
    otherY: 351,
    otherBodyRadius: 20,
    laneMinY: 212,
    laneMaxY: 352,
  });
  assert.equal(edge.dy, 0);
  assert.ok(edge.dx > 0);
});
