import assert from "node:assert/strict";
import test from "node:test";
import {
  CRAWLER_DOOR_PHASES,
  advanceCrawlerDoorRuntime,
  createCrawlerDoorRuntime,
  friendlyCrawlerRevealRect,
} from "../app/crawlerDeployment.js";

function advance(runtime, seconds, context) {
  return advanceCrawlerDoorRuntime(runtime, seconds, context);
}

const FRIENDLY_REVEAL_FIXTURE = Object.freeze({
  side: "human",
  gateEntering: true,
  spawnPortalId: "crawler-door",
  entryRampCleared: false,
  fighterX: 96,
  entryRampX: 148,
  spriteWidth: 60,
  doorX: 96,
  rampFootX: 148,
  musterY: 322,
});

test("friendly CRAWLER reveal rect preserves the production doorway geometry", () => {
  const rect = friendlyCrawlerRevealRect(FRIENDLY_REVEAL_FIXTURE);

  assert.deepEqual(rect, {
    x: 72,
    y: 214,
    w: 57,
    h: 128,
  });
  assert.equal(Object.isFrozen(rect), true);

  const nullRampRect = friendlyCrawlerRevealRect({
    ...FRIENDLY_REVEAL_FIXTURE,
    entryRampX: null,
  });
  assert.deepEqual(nullRampRect, rect, "null entry ramp falls back to the authored ramp foot");
});

test("friendly CRAWLER reveal remains monotonic until the doorway threshold", () => {
  const positions = [96, 98, 100, 103.999];
  const rightEdges = positions.map((fighterX) => {
    const rect = friendlyCrawlerRevealRect({
      ...FRIENDLY_REVEAL_FIXTURE,
      fighterX,
    });
    assert.ok(rect);
    return rect.x + rect.w;
  });

  assert.deepEqual(rightEdges, positions.map((fighterX) => fighterX + 33));
  assert.equal(
    rightEdges.every((right, index) => index === 0 || right > rightEdges[index - 1]),
    true,
  );
  assert.equal(friendlyCrawlerRevealRect({
    ...FRIENDLY_REVEAL_FIXTURE,
    fighterX: FRIENDLY_REVEAL_FIXTURE.doorX + 8,
  }), null, "the production clip releases exactly at doorX + 8");
});

test("friendly CRAWLER reveal honors its minimum opening and ramp cap", () => {
  const minimum = friendlyCrawlerRevealRect({
    ...FRIENDLY_REVEAL_FIXTURE,
    fighterX: 96,
    spriteWidth: 10,
  });
  assert.equal(minimum.x + minimum.w, 121, "doorX + 25 is the minimum reveal edge");

  const capped = friendlyCrawlerRevealRect({
    ...FRIENDLY_REVEAL_FIXTURE,
    fighterX: 103,
    entryRampX: 90,
    spriteWidth: 100,
  });
  assert.equal(capped.x + capped.w, 145, "entryRampX + spriteWidth * .55 caps the reveal");
  assert.ok(capped.w > 0);
});

test("friendly CRAWLER reveal rejects every non-deployment condition", () => {
  const ineligible = [
    { side: "zombie" },
    { gateEntering: false },
    { spawnPortalId: "enemy-portal-1" },
    { entryRampCleared: true },
    { fighterX: FRIENDLY_REVEAL_FIXTURE.doorX + 8 },
  ];

  for (const override of ineligible) {
    assert.equal(
      friendlyCrawlerRevealRect({ ...FRIENDLY_REVEAL_FIXTURE, ...override }),
      null,
      JSON.stringify(override),
    );
  }
});

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
