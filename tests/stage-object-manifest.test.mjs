import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
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

test("required mutable production slots exist for traps, rescue flow, radio entry, and infection-nest phases", () => {
  const slotsFor = (stageId) => new Set(STAGE_OBJECT_MANIFEST[stageId].objects.map((entry) => entry.slot));
  assert.deepEqual(slotsFor("stage-nishijin-shopping-street"), new Set(["static-dressing", "wire-trap", "arcade-sign", "fire-shutter", "infection-node"]));
  assert.deepEqual(slotsFor("stage-sawara-ward-office"), new Set(["static-dressing", "rescue-van", "rubble", "upper-window", "lunch-crate"]));
  assert.deepEqual(slotsFor("stage-nishijin-defense-line-takuya"), new Set(["static-dressing", "transmitter", "spawn-marker", "infection-nest"]));

  const baseOverlays = stageObjectStageIds.flatMap((stageId) => STAGE_OBJECT_MANIFEST[stageId].objects)
    .filter((entry) => entry.replacesRuntimeSprite === "/infected-checkpoint-v1.png");
  assert.equal(baseOverlays.length, 6);
  for (const overlay of baseOverlays) {
    assert.equal(overlay.placement.x, 850);
    assert.equal(overlay.interactionX, 875);
  }
});
