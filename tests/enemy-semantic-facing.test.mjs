import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  PRODUCTION_ENEMY_SOURCE_FACING,
  V0995_INFECTED_FACING_KINDS,
  combatFacingFromMotion,
  semanticAtlasRowPlan,
} from "../app/enemyFacingContract.js";
import { SPRITE_MANIFEST, spriteFrameFor } from "../app/spriteManifest.js";
import { decodeRgbaPng } from "./image-asset-helpers.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXPECTED_PRODUCTION_ENEMIES = Object.freeze([
  "walker", "runner", "turned", "spitter", "shade", "crusher", "abomination", "takuya",
  "grappler", "ooze", "sprinter", "gate-eater", "kurome", "mother", "ooguchi", "gairen", "futago",
  "resonator", "cagewalker", "spindle", "choir-knot", "pall-manta", "anchor-bloom",
]);

const publicFile = (assetPath) => path.join(ROOT, "public", assetPath.replace(/^\//, ""));

function normalizedAlpha(decoded, frame, normalizedX, normalizedY, radius = 0.045) {
  const sourceX = frame.sourceRect.x + normalizedX * frame.sourceRect.w;
  const sourceY = frame.sourceRect.y + normalizedY * frame.sourceRect.h;
  const radiusX = Math.max(2, Math.round(frame.sourceRect.w * radius));
  const radiusY = Math.max(2, Math.round(frame.sourceRect.h * radius));
  let total = 0;
  let samples = 0;
  for (let y = Math.max(frame.sourceRect.y, Math.floor(sourceY - radiusY)); y < Math.min(frame.sourceRect.y + frame.sourceRect.h, Math.ceil(sourceY + radiusY)); y += 1) {
    for (let x = Math.max(frame.sourceRect.x, Math.floor(sourceX - radiusX)); x < Math.min(frame.sourceRect.x + frame.sourceRect.w, Math.ceil(sourceX + radiusX)); x += 1) {
      total += decoded.data[(y * decoded.width + x) * 4 + 3];
      samples += 1;
    }
  }
  return samples === 0 ? 0 : total / samples / 255;
}

function cellBytes(decoded, row, column) {
  const width = 480;
  const height = 448;
  const result = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const sourceStart = ((row * height + y) * decoded.width + column * width) * 4;
    decoded.data.copy(result, y * width * 4, sourceStart, sourceStart + width * 4);
  }
  return result;
}

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

test("every production enemy and boss owns explicit semantic source-facing metadata", async () => {
  assert.deepEqual(Object.keys(PRODUCTION_ENEMY_SOURCE_FACING), EXPECTED_PRODUCTION_ENEMIES);
  for (const [kind, record] of Object.entries(PRODUCTION_ENEMY_SOURCE_FACING)) {
    assert.ok(SPRITE_MANIFEST[kind], `${kind} production manifest entry`);
    assert.ok(["left", "right", "front-symmetric"].includes(record.sourceFacing), `${kind} source facing`);
    assert.ok(record.sourcePath.length > 0, `${kind} source path`);
    assert.ok(record.family.length > 0, `${kind} source family`);
    assert.doesNotThrow(() => semanticAtlasRowPlan(record.sourceFacing), kind);
    const sourceFile = record.sourcePath.startsWith("/")
      ? publicFile(record.sourcePath)
      : path.join(ROOT, record.sourcePath);
    assert.ok((await readFile(sourceFile)).length > 0, `${kind} source exists`);
  }
  assert.throws(() => semanticAtlasRowPlan(undefined), /Missing or invalid/);
});

test("the six v0995 infected atlases use versioned paths and semantic row ownership", () => {
  for (const kind of V0995_INFECTED_FACING_KINDS) {
    const contract = PRODUCTION_ENEMY_SOURCE_FACING[kind];
    const manifest = SPRITE_MANIFEST[kind];
    assert.equal(manifest.path, `/art/v0995/enemies/${kind}-battle-v2.png`, kind);
    assert.equal(manifest.semanticSourceFacing, contract.sourceFacing, kind);
    assert.deepEqual(semanticAtlasRowPlan(contract.sourceFacing), contract.sourceFacing === "left"
      ? { right: "mirror", left: "source" }
      : { right: "source", left: "mirror" });
  }
});

test("directional infected semantic landmarks mirror into the authored movement row", async () => {
  for (const kind of ["resonator", "cagewalker", "spindle"]) {
    const contract = PRODUCTION_ENEMY_SOURCE_FACING[kind];
    const decoded = decodeRgbaPng(await readFile(publicFile(SPRITE_MANIFEST[kind].path)));
    const leftFrame = spriteFrameFor(kind, "idle", "left");
    const rightFrame = spriteFrameFor(kind, "idle", "right");
    const { x, y, radius } = contract.semanticLandmark;
    const leftLandmark = normalizedAlpha(decoded, leftFrame, x, y, radius);
    const rightMirroredLandmark = normalizedAlpha(decoded, rightFrame, 1 - x, y, radius);
    assert.ok(leftLandmark >= .12, `${kind} left source landmark remains visible`);
    assert.ok(rightMirroredLandmark >= .12, `${kind} right landmark mirrors to the opposite side`);
    assert.ok(Math.abs(leftLandmark - rightMirroredLandmark) <= .035, `${kind} semantic landmark mirrors without row drift`);
  }
});

test("the directional v0995 fix is a semantic row correction, and swapping it back fails", async () => {
  for (const kind of ["resonator", "cagewalker", "spindle"]) {
    const current = decodeRgbaPng(await readFile(publicFile(SPRITE_MANIFEST[kind].path)));
    const prior = decodeRgbaPng(await readFile(publicFile(`/art/v090/enemies/${kind}-battle-v1.png`)));
    for (let column = 0; column < 7; column += 1) {
      assert.equal(digest(cellBytes(current, 0, column)), digest(cellBytes(prior, 1, column)), `${kind}/${column} corrected right row`);
      assert.equal(digest(cellBytes(current, 1, column)), digest(cellBytes(prior, 0, column)), `${kind}/${column} corrected left row`);
      assert.notEqual(digest(cellBytes(current, 0, column)), digest(cellBytes(prior, 0, column)), `${kind}/${column} old swapped row must fail`);
    }
  }
});

test("actual X delta owns locomotion facing while an active attack owns target facing", () => {
  assert.equal(combatFacingFromMotion({ side: "zombie", actualXDelta: -3, aiMoveDirection: 1 }), "left");
  const leftMovementFrame = spriteFrameFor("resonator", "walk-a", "left");
  const wrongRightFrame = spriteFrameFor("resonator", "walk-a", "right");
  assert.equal(leftMovementFrame.sourceRect.y, 448, "leftward movement resolves the authored left row");
  assert.notEqual(leftMovementFrame.sourceRect.y, wrongRightFrame.sourceRect.y, "rightward row is a negative failure for left movement");
  assert.equal(combatFacingFromMotion({ side: "zombie", actualXDelta: 3, aiMoveDirection: -1 }), "right");
  assert.equal(combatFacingFromMotion({
    side: "zombie",
    actualXDelta: -3,
    aiMoveDirection: -1,
    targetDirection: 1,
    attacking: true,
  }), "right");
  assert.equal(combatFacingFromMotion({
    side: "zombie",
    actualXDelta: 0,
    aiMoveDirection: 0,
    entryDirection: -1,
  }), "left");
});

test("runtime wires actual movement into facing without changing advanceZombieX", async () => {
  const source = await readFile(path.join(ROOT, "app", "AshfallGame.tsx"), "utf8");
  assert.match(source, /const actualXDeltaByFighterId = new Map<number, number>\(\)/);
  assert.match(source, /actualXDeltaByFighterId\.set\(f\.id, f\.x - movementStartX\)/);
  assert.match(source, /actualXDelta: actualXDeltaByFighterId\.get\(fighter\.id\) \?\? 0/);
  assert.match(source, /f\.x = advanceZombieX\([^;]+;\s*f\.aiMoveDirection = Math\.sign\(f\.x - movementStartX\)/s);
});
