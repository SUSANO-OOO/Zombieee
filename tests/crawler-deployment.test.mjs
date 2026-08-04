import assert from "node:assert/strict";
import test from "node:test";
import {
  CRAWLER_DEPLOYMENT_CHECKPOINTS,
  CRAWLER_DEPLOYMENT_UNIT_FAMILIES,
  CRAWLER_DOOR_PHASES,
  advanceCrawlerDoorRuntime,
  crawlerDeploymentCheckpoint,
  crawlerDeploymentRenderPlan,
  crawlerDeploymentUnitFamily,
  createCrawlerDoorRuntime,
} from "../app/crawlerDeployment.js";

function advance(runtime, seconds, context) {
  return advanceCrawlerDoorRuntime(runtime, seconds, context);
}

const FRIENDLY_DEPLOYMENT_FIXTURE = Object.freeze({
  side: "human",
  gateEntering: true,
  spawnPortalId: "crawler-door",
  entryRampCleared: false,
  unitKind: "scout",
  progress: 0,
});

test("the seven required deployment families resolve from production unit kinds", () => {
  const representatives = Object.freeze({
    scout: CRAWLER_DEPLOYMENT_UNIT_FAMILIES.HACHI,
    ranger: CRAWLER_DEPLOYMENT_UNIT_FAMILIES.MIZUCHI,
    brawler: CRAWLER_DEPLOYMENT_UNIT_FAMILIES.PAISEN,
    "crazy-king": CRAWLER_DEPLOYMENT_UNIT_FAMILIES.CRAZY_KING,
    "mayo-chan": CRAWLER_DEPLOYMENT_UNIT_FAMILIES.MAYO_CHAN,
    brute: CRAWLER_DEPLOYMENT_UNIT_FAMILIES.TATARA,
    medic: CRAWLER_DEPLOYMENT_UNIT_FAMILIES.STANDARD_HUMAN,
  });

  assert.equal(new Set(Object.values(representatives)).size, 7);
  for (const [unitKind, expectedFamily] of Object.entries(representatives)) {
    assert.equal(crawlerDeploymentUnitFamily(unitKind), expectedFamily);
  }
  assert.equal(crawlerDeploymentUnitFamily("walker"), null);
  assert.equal(crawlerDeploymentUnitFamily(null), null);
});

test("all human production kinds resolve without treating enemies as standard humans", () => {
  const standardHumanKinds = [
    "medic",
    "gunner",
    "guardian",
    "engineer",
    "kumaverson",
    "babayaga",
    "zakimiya",
    "tky",
    "mrs-chiha",
    "miyamoto-musashi",
  ];
  for (const kind of standardHumanKinds) {
    assert.equal(crawlerDeploymentUnitFamily(kind), CRAWLER_DEPLOYMENT_UNIT_FAMILIES.STANDARD_HUMAN);
  }
  for (const kind of ["walker", "runner", "takuya", "unknown"]) {
    assert.equal(crawlerDeploymentUnitFamily(kind), null);
  }
});

test("six deployment checkpoints use a single alpha-1 draw and authored z-order for every family", () => {
  const representatives = ["scout", "ranger", "brawler", "crazy-king", "mayo-chan", "brute", "medic"];
  assert.deepEqual(
    CRAWLER_DEPLOYMENT_CHECKPOINTS.map(({ id }) => id),
    ["fully-inside", "first-visible", "quarter", "half", "three-quarters", "fully-outside"],
  );
  assert.deepEqual(
    CRAWLER_DEPLOYMENT_CHECKPOINTS.map(({ progress }) => progress),
    [0, .08, .25, .5, .75, 1],
  );

  for (const unitKind of representatives) {
    for (const checkpoint of CRAWLER_DEPLOYMENT_CHECKPOINTS) {
      const plan = crawlerDeploymentRenderPlan({
        ...FRIENDLY_DEPLOYMENT_FIXTURE,
        unitKind,
        progress: checkpoint.progress,
        entryRampCleared: checkpoint.id === "fully-outside",
      });
      assert.equal(plan.active, true, `${unitKind}/${checkpoint.id}`);
      assert.equal(plan.family, crawlerDeploymentUnitFamily(unitKind), `${unitKind}/${checkpoint.id}`);
      assert.equal(plan.checkpoint, checkpoint.id, `${unitKind}/${checkpoint.id}`);
      assert.equal(plan.alpha, 1, `${unitKind}/${checkpoint.id}`);
      assert.equal(plan.unitDrawCount, 1, `${unitKind}/${checkpoint.id}`);
      assert.equal(plan.clipMode, "none", `${unitKind}/${checkpoint.id}`);
      assert.equal(Object.isFrozen(plan), true);
      assert.equal(Object.isFrozen(plan.drawOrder), true);

      if (checkpoint.id === "fully-outside") {
        assert.equal(plan.unitPass, "after-foreground-mask");
        assert.equal(plan.foregroundMaskPass, "before-unit");
        assert.deepEqual(plan.drawOrder, [
          "crawler-base",
          "crawler-interior",
          "crawler-foreground-mask",
          "unit",
        ]);
      } else {
        assert.equal(plan.unitPass, "before-foreground-mask");
        assert.equal(plan.foregroundMaskPass, "after-unit");
        assert.deepEqual(plan.drawOrder, [
          "crawler-base",
          "crawler-interior",
          "unit",
          "crawler-foreground-mask",
        ]);
      }
    }
  }
});

test("deployment checkpoint resolver clamps malformed progress without creating reveal geometry", () => {
  assert.equal(crawlerDeploymentCheckpoint(-1), "fully-inside");
  assert.equal(crawlerDeploymentCheckpoint(0), "fully-inside");
  assert.equal(crawlerDeploymentCheckpoint(.001), "first-visible");
  assert.equal(crawlerDeploymentCheckpoint(.25), "quarter");
  assert.equal(crawlerDeploymentCheckpoint(.5), "half");
  assert.equal(crawlerDeploymentCheckpoint(.75), "three-quarters");
  assert.equal(crawlerDeploymentCheckpoint(1), "fully-outside");
  assert.equal(crawlerDeploymentCheckpoint(2), "fully-outside");

  const plan = crawlerDeploymentRenderPlan(FRIENDLY_DEPLOYMENT_FIXTURE);
  assert.equal("x" in plan, false);
  assert.equal("y" in plan, false);
  assert.equal("w" in plan, false);
  assert.equal("h" in plan, false);
  assert.equal("revealRect" in plan, false);
});

test("only the friendly CRAWLER transaction opts into the deployment render plan", () => {
  const ineligible = [
    { side: "zombie" },
    { gateEntering: false },
    { spawnPortalId: "enemy-portal-1" },
  ];

  for (const override of ineligible) {
    const plan = crawlerDeploymentRenderPlan({ ...FRIENDLY_DEPLOYMENT_FIXTURE, ...override });
    assert.equal(plan.active, false, JSON.stringify(override));
    assert.equal("clipMode" in plan, false, JSON.stringify(override));
    assert.equal(Object.isFrozen(plan), true);
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
