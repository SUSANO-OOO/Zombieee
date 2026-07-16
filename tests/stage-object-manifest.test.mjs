import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  STAGE_OBJECT_DEPTH_BANDS,
  STAGE_OBJECT_MANIFEST,
  stageObjectsFor,
  stageObjectStageIds,
} from "../app/stageObjectManifest.js";
import { alphaBounds, decodeRgbaPng, hasTransparentPerimeter, decodeWebpDimensions } from "./image-asset-helpers.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function publicFile(assetPath) {
  return path.join(ROOT, "public", assetPath.replace(/^\//, ""));
}

test("all three campaign stages expose audited dynamic overlay variants and complete production inventories", async () => {
  assert.deepEqual(stageObjectStageIds, [
    "stage-nishijin-shopping-street",
    "stage-sawara-ward-office",
    "stage-nishijin-defense-line-takuya",
  ]);
  const ids = new Set();
  for (const stageId of stageObjectStageIds) {
    const stage = STAGE_OBJECT_MANIFEST[stageId];
    assert.ok(stage.objects.length >= 7, `${stageId} overlay count`);
    assert.equal(stage.staticTreatment, "authored-in-production-background");
    assert.ok(stage.productionInventory.length >= 22, `${stageId} production inventory count`);
    assert.equal(new Set(stage.productionInventory.map((item) => item.id)).size, stage.productionInventory.length);
    for (const item of stage.productionInventory) {
      assert.ok(item.label.length > 0);
      assert.match(item.treatment, /production-background|dynamic-production-overlay/);
      assert.ok(item.evidence.length > 0);
    }
    const background = decodeWebpDimensions(await readFile(publicFile(stage.backgroundPath)));
    assert.deepEqual({ width: background.width, height: background.height }, { width: 1600, height: 900 });
    for (const object of stage.objects) {
      assert.equal(object.stageId, stageId);
      assert.equal(ids.has(object.id), false, `duplicate overlay id: ${object.id}`);
      ids.add(object.id);
      assert.equal(object.productionTreatment, "generated-transparent-overlay-v1");
      assert.match(object.path, /^\/art\/v060\/stage-objects\/.+-v1\.png$/);
      assert.ok(object.placement.width > 0);
      const decoded = decodeRgbaPng(await readFile(publicFile(object.path)));
      assert.ok(alphaBounds(decoded), `${object.id} has visible RGBA content`);
      assert.equal(hasTransparentPerimeter(decoded, { x: 0, y: 0, w: decoded.width, h: decoded.height }, 12), true, `${object.id} transparent gutter`);
    }
  }
  assert.equal(ids.size, 25);
});

test("stageObjectsFor returns one default per mutable slot and exact requested states", () => {
  for (const stageId of stageObjectStageIds) {
    const defaults = stageObjectsFor(stageId);
    assert.ok(defaults.length > 0);
    assert.equal(new Set(defaults.map((entry) => entry.slot)).size, defaults.length, `${stageId} default slot collision`);
    for (const object of STAGE_OBJECT_MANIFEST[stageId].objects) {
      assert.deepEqual(stageObjectsFor(stageId, object.state), [object]);
    }
    const mutablePair = Object.values(Object.groupBy(STAGE_OBJECT_MANIFEST[stageId].objects, (entry) => entry.slot))
      .find((entries) => entries.length >= 2)
      .slice(0, 2);
    assert.deepEqual(stageObjectsFor(stageId, mutablePair.map((entry) => entry.state)), [mutablePair[1]], "later state wins within one mutable slot");
  }
  assert.throws(() => stageObjectsFor("missing-stage"), RangeError);
});

test("required mutable production slots preserve the runtime gate and align objective overlays to its shared target", () => {
  const slotsFor = (stageId) => new Set(STAGE_OBJECT_MANIFEST[stageId].objects.map((entry) => entry.slot));
  assert.deepEqual(slotsFor("stage-nishijin-shopping-street"), new Set(["static-dressing", "wire-trap", "arcade-sign", "fire-shutter", "infection-node"]));
  assert.deepEqual(slotsFor("stage-sawara-ward-office"), new Set(["static-dressing", "rescue-van", "rubble", "upper-window", "lunch-crate"]));
  assert.deepEqual(slotsFor("stage-nishijin-defense-line-takuya"), new Set(["static-dressing", "transmitter", "spawn-marker", "infection-nest"]));

  const baseOverlays = stageObjectStageIds.flatMap((stageId) => STAGE_OBJECT_MANIFEST[stageId].objects)
    .filter((entry) => entry.replacesRuntimeSprite === "/infected-checkpoint-v1.png");
  assert.equal(baseOverlays.length, 0, "the runtime checkpoint remains visible behind objective-state overlays");

  const objectiveOverlays = stageObjectStageIds.flatMap((stageId) => STAGE_OBJECT_MANIFEST[stageId].objects)
    .filter((entry) => entry.slot === "infection-node" || entry.slot === "infection-nest");
  assert.equal(objectiveOverlays.length, 6);
  for (const overlay of objectiveOverlays) {
    assert.equal(overlay.placement.x, 850);
    assert.equal(overlay.interactionX, 875);
    assert.equal(overlay.replacesRuntimeSprite, null);
    const halfWidth = overlay.placement.width / 2;
    assert.ok(overlay.interactionX >= overlay.placement.x - halfWidth && overlay.interactionX <= overlay.placement.x + halfWidth, `${overlay.id} target remains inside its graphic`);
    if (overlay.collision) assert.deepEqual(overlay.collision.lanes, [0, 1, 2], `${overlay.id} protects every physical route`);
  }
});

test("stage objects declare rear, objective, or foreground depth intent", () => {
  assert.deepEqual(STAGE_OBJECT_DEPTH_BANDS, ["rear-scenery", "objective", "foreground-prop"]);
  const rearIds = new Set([
    "nishijin-static-dressing",
    "nishijin-sign-intact",
    "nishijin-fire-shutter-closed",
    "nishijin-fire-shutter-open",
    "sawara-static-dressing",
    "sawara-rescue-van-blocked",
    "sawara-rescue-van-ready",
    "sawara-shooting-window-lit",
    "defense-static-dressing",
  ]);
  const objectiveIds = new Set([
    "nishijin-infection-node-active",
    "nishijin-infection-node-destroyed",
    "defense-transmitter-active",
    "defense-transmitter-damaged",
    "defense-infection-nest-dormant",
    "defense-infection-nest-exposed",
    "defense-infection-nest-damaged",
    "defense-infection-nest-destroyed",
  ]);
  const foregroundIds = new Set([
    "nishijin-wire-trap-intact",
    "nishijin-wire-trap-sprung",
    "nishijin-sign-fallen",
    "sawara-rubble-blocking",
    "sawara-rubble-cleared",
    "sawara-lunch-crate-sealed",
    "sawara-lunch-crate-open",
    "defense-spawn-marker",
  ]);
  const objects = stageObjectStageIds.flatMap((stageId) => STAGE_OBJECT_MANIFEST[stageId].objects);
  assert.deepEqual(new Set(objects.filter(({ depthBand }) => depthBand === "rear-scenery").map(({ id }) => id)), rearIds);
  assert.deepEqual(new Set(objects.filter(({ depthBand }) => depthBand === "objective").map(({ id }) => id)), objectiveIds);
  assert.deepEqual(new Set(objects.filter(({ depthBand }) => depthBand === "foreground-prop").map(({ id }) => id)), foregroundIds);
  assert.equal(rearIds.size + objectiveIds.size + foregroundIds.size, objects.length);

  for (const object of objects) {
    if (objectiveIds.has(object.id)) {
      assert.equal(object.laneCorridorPolicy, "battlefield-objective", `${object.id} corridor policy`);
      continue;
    }
    if (foregroundIds.has(object.id)) {
      assert.equal(object.laneCorridorPolicy, "overlays-walkable-lanes", `${object.id} corridor policy`);
      continue;
    }
    assert.equal(object.depthBand, "rear-scenery", `${object.id} depth band`);
    assert.equal(object.laneCorridorPolicy, "outside-walkable-lanes", `${object.id} corridor policy`);
    if (object.stageId !== "stage-nishijin-defense-line-takuya") {
      assert.ok(object.placement.y <= 184, `${object.id} bottom stays above compact top lane at y=188`);
      assert.ok(object.placement.width <= 300, `${object.id} rear scenery width`);
      assert.equal(object.collision, null, `${object.id} cannot leave an invisible supply exclusion in a battle lane`);
    }
  }
});

test("every visible collision declares exactly the physical lanes excluded from supply placement", () => {
  const collidable = stageObjectStageIds
    .flatMap((stageId) => STAGE_OBJECT_MANIFEST[stageId].objects)
    .filter((object) => object.collision);
  assert.ok(collidable.length > 0);
  for (const object of collidable) {
    const expectedLanes = object.interactionX === 875 ? [0, 1, 2] : [2];
    assert.deepEqual(object.collision.lanes, expectedLanes, `${object.id} collision lanes`);
    assert.ok(object.collision.width > 0, `${object.id} collision width`);
    assert.ok(object.collision.height > 0, `${object.id} collision height`);
  }
});
