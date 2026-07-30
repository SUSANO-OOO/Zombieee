import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const RELEASE_SHA = "f2633c538756385f13d166d3adbcdd39b3a08b21";
const UNIT_KINDS = [
  "scout",
  "ranger",
  "brute",
  "brawler",
  "gunner",
  "medic",
  "crazy-king",
  "kumaverson",
  "babayaga",
  "guardian",
  "engineer",
  "zakimiya",
  "tky",
  "mrs-chiha",
  "miyamoto-musashi",
  "mayo-chan",
];
const BASE = new URL("../docs/qa/v095/baseline/", import.meta.url);

async function json(name) {
  return JSON.parse(await readFile(new URL(name, BASE), "utf8"));
}

test("Version 0.9.0 performance baseline is fixed to the release SHA", async () => {
  const performance = await json("v090-performance-baseline.json");
  assert.equal(performance.baselineReleaseSha, RELEASE_SHA);
  assert.equal(performance.durationMs, 900_000);
  assert.equal(performance.battleCoveragePercent, 100);
  assert.equal(performance.frameSamplesDropped, 0);
  assert.equal(performance.longTasksOver100Ms, 0);
  assert.equal(performance.rafStallsOver100Ms, 0);
  assert.equal(performance.gatePassed, true);
  assert.equal(performance.physicalSmartphoneHeatVerified, false);
  assert.deepEqual(performance.diagnostics, {
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
    httpErrors: [],
  });
});

test("all 16 canonical units have six continuous visual baseline frames", async () => {
  const visual = await json("v090-16-unit-visual-baseline.json");
  assert.equal(visual.baselineReleaseSha, RELEASE_SHA);
  assert.equal(visual.measuredFromIntegrationSha, "76b9168d03109fbb473df7632f0f201d9612f13d");
  assert.equal(visual.unitCount, 16);
  assert.equal(visual.framesPerUnit, 6);
  assert.equal(visual.totalFrames, 96);
  assert.equal(visual.groundingPassed, true);
  assert.deepEqual(visual.units.map(({ unitKind }) => unitKind), UNIT_KINDS);
  assert.deepEqual(visual.firstDamageMissingUnits, ["scout"]);
  assert.equal(visual.firstDamageObservedCount, 15);
  assert.equal(visual.continuousAttackProbeFrameTimingMs.samples, 48);
  assert.ok(visual.continuousAttackProbeFrameTimingMs.minimum > 0);
  assert.ok(visual.continuousAttackProbeFrameTimingMs.maximum < 50);
  assert.deepEqual(visual.diagnostics, {
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
    httpErrors: [],
  });
  for (const unit of visual.units) {
    assert.deepEqual(unit.frames.map(({ phase }) => phase), visual.phases);
  }
  await access(new URL("v090-16-unit-continuous-frame-baseline.png", BASE));
});

test("save baseline is explicit about covered and deferred origin cases", async () => {
  const save = await json("v090-save-migration-baseline.json");
  assert.equal(save.baselineReleaseSha, RELEASE_SHA);
  assert.equal(save.totalScenarios, 44);
  assert.equal(save.passed, 44);
  assert.equal(save.failed, 0);
  assert.ok(save.notYetCovered.includes("Version 0.9.0 origin-by-origin transfer"));
  assert.ok(save.notYetCovered.includes("Version 0.9.5 schema migration"));
});
