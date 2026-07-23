import assert from "node:assert/strict";
import test from "node:test";
import {
  CRAWLER_DOOR_PHASES,
  advanceCrawlerDoorRuntime,
  createCrawlerDoorRuntime,
} from "../app/crawlerDeployment.js";

function advance(runtime, seconds, context) {
  return advanceCrawlerDoorRuntime(runtime, seconds, context);
}

test("CRAWLER stays closed at rest and does not launch before the physical door is open", () => {
  let runtime = createCrawlerDoorRuntime();
  assert.deepEqual(
    { phase: runtime.phase, doorProgress: runtime.doorProgress },
    { phase: CRAWLER_DOOR_PHASES.CLOSED, doorProgress: 0 },
  );

  let step = advance(runtime, 0.01, { queuedUnits: 1 });
  runtime = step.runtime;
  assert.equal(runtime.phase, CRAWLER_DOOR_PHASES.WARNING);
  assert.deepEqual(step.events, ["warning"]);

  step = advance(runtime, 0.2, { queuedUnits: 1 });
  runtime = step.runtime;
  assert.equal(runtime.phase, CRAWLER_DOOR_PHASES.WARNING);
  assert.equal(step.events.includes("launch"), false);

  step = advance(runtime, 0.03, { queuedUnits: 1 });
  runtime = step.runtime;
  assert.equal(runtime.phase, CRAWLER_DOOR_PHASES.OPENING);
  assert.equal(step.events.includes("launch"), false);

  step = advance(runtime, 0.2, { queuedUnits: 1 });
  runtime = step.runtime;
  assert.equal(runtime.phase, CRAWLER_DOOR_PHASES.OPENING);
  assert.ok(runtime.doorProgress > 0 && runtime.doorProgress < 1);
  assert.equal(step.events.includes("launch"), false);

  step = advance(runtime, 0.2, { queuedUnits: 1 });
  runtime = step.runtime;
  assert.equal(runtime.phase, CRAWLER_DOOR_PHASES.OPEN);
  assert.equal(runtime.doorProgress, 1);
  assert.equal(step.events.includes("launch"), false);

  step = advance(runtime, 0.01, { queuedUnits: 1, doorwayOccupied: false });
  assert.deepEqual(step.events, ["launch"]);
});

test("CRAWLER holds the ramp open while a unit exits and closes after the doorway clears", () => {
  let runtime = {
    ...createCrawlerDoorRuntime(),
    phase: CRAWLER_DOOR_PHASES.OPEN,
    doorProgress: 1,
  };

  let step = advance(runtime, 1, { queuedUnits: 0, doorwayOccupied: true });
  runtime = step.runtime;
  assert.equal(runtime.phase, CRAWLER_DOOR_PHASES.OPEN);
  assert.equal(runtime.doorProgress, 1);

  step = advance(runtime, 0.19, { queuedUnits: 0, doorwayOccupied: false });
  runtime = step.runtime;
  assert.equal(runtime.phase, CRAWLER_DOOR_PHASES.CLOSING);
  assert.deepEqual(step.events, ["closing"]);

  step = advance(runtime, 0.18, { queuedUnits: 0, doorwayOccupied: false });
  runtime = step.runtime;
  assert.equal(runtime.phase, CRAWLER_DOOR_PHASES.CLOSING);
  assert.ok(runtime.doorProgress > 0 && runtime.doorProgress < 1);

  step = advance(runtime, 0.2, { queuedUnits: 0, doorwayOccupied: false });
  assert.equal(step.runtime.phase, CRAWLER_DOOR_PHASES.CLOSED);
  assert.equal(step.runtime.doorProgress, 0);
  assert.deepEqual(step.events, ["closed"]);
});

test("a queued reinforcement reverses a closing door instead of spawning through it", () => {
  const step = advance({
    ...createCrawlerDoorRuntime(),
    phase: CRAWLER_DOOR_PHASES.CLOSING,
    elapsed: 0.17,
    doorProgress: 0.5,
  }, 0.01, { queuedUnits: 1, doorwayOccupied: false });

  assert.equal(step.runtime.phase, CRAWLER_DOOR_PHASES.OPENING);
  assert.ok(step.runtime.doorProgress > 0 && step.runtime.doorProgress < 1);
  assert.deepEqual(step.events, ["reopening"]);
  assert.equal(step.events.includes("launch"), false);
});
