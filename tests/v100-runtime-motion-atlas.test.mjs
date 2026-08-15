import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { V100_RUNTIME_ASSET_MANIFEST, validateV100RuntimeAssetManifest } from "../app/v100RuntimeAssetManifest.js";
import {
  v100RuntimeSpriteFrameFor,
  v100RuntimeSpriteStatesFor,
} from "../app/v100RuntimeSprites.js";
import { alphaBounds, decodeRgbaPng, hasTransparentPerimeter } from "./image-asset-helpers.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CELL_WIDTH = 1280;
const CELL_HEIGHT = 512;
const ATLAS_HEIGHT = CELL_HEIGHT * 2;

const MOTION_ATLASES = Object.freeze([
  {
    kind: "boss-mugarian-president-mutated",
    group: "bosses",
    key: "boss-mugarian-president-mutated",
    frameDirectory: "assets/source/v100/runtime/motion/mugarian-president-mutated",
    states: ["entrance", "idle", "move", "attack", "hit", "phase", "death", "defeat"],
    columns: 8,
    policy: /hooked staff and oversized arm silhouette/u,
  },
  {
    kind: "boss-takuya-omega",
    group: "bosses",
    key: "boss-takuya-omega",
    frameDirectory: "assets/source/v100/runtime/motion/takuya-omega",
    states: ["entrance", "idle", "move", "attack", "hit", "phase", "death", "defeat"],
    columns: 8,
    policy: /oversized serrated greatsword.*same blade length and width/u,
  },
  {
    kind: "red-panther-knife",
    group: "redPanther",
    key: "knife",
    frameDirectory: "assets/source/v100/runtime/motion/red-panther-knife",
    states: ["idle", "move", "attack", "hit", "death"],
    columns: 5,
    policy: /serrated combat knife.*same blade length/u,
  },
  {
    kind: "red-panther-shield",
    group: "redPanther",
    key: "shield",
    frameDirectory: "assets/source/v100/runtime/motion/red-panther-shield",
    states: ["idle", "move", "attack", "hit", "death"],
    columns: 5,
    policy: /riot shield.*full body-covering rectangle/u,
  },
  {
    kind: "red-panther-smg",
    group: "redPanther",
    key: "smg",
    frameDirectory: "assets/source/v100/runtime/motion/red-panther-smg",
    states: ["idle", "move", "attack", "hit", "death"],
    columns: 5,
    policy: /suppressed SMG.*same silhouette/u,
  },
  {
    kind: "red-panther-commander",
    group: "redPanther",
    key: "commander",
    frameDirectory: "assets/source/v100/runtime/motion/red-panther-commander",
    states: ["idle", "move", "attack", "hit", "death"],
    columns: 5,
    policy: /compact sidearm.*same silhouette/u,
  },
]);

const publicFile = (assetPath) => path.join(ROOT, "public", assetPath.replace(/^\//u, ""));
const sourceFile = (relativePath) => path.join(ROOT, relativePath.replaceAll("/", path.sep));

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function rawCell(bytes, x, y) {
  return sharp(bytes)
    .extract({ left: x, top: y, width: CELL_WIDTH, height: CELL_HEIGHT })
    .raw()
    .toBuffer();
}

function localAlphaBounds(decoded, rect) {
  const bounds = alphaBounds(decoded, rect);
  return bounds && { x: bounds.x - rect.x, y: bounds.y - rect.y, w: bounds.w, h: bounds.h };
}

test("V1 runtime manifest exposes the complete Stage 21-30 and motion asset contract", () => {
  const validation = validateV100RuntimeAssetManifest();
  assert.equal(validation.ok, true, validation.errors.join(", "));
  assert.equal(Object.keys(V100_RUNTIME_ASSET_MANIFEST.bosses).length, 2);
  assert.equal(Object.keys(V100_RUNTIME_ASSET_MANIFEST.redPanther).length, 4);
  assert.equal(Object.keys(V100_RUNTIME_ASSET_MANIFEST.stages).length, 10);
});

test("custom runtime atlases preserve large authored cells, exact left/right pairing, and alpha gutters", async () => {
  const provenance = JSON.parse(await readFile(sourceFile("assets/source/v100/runtime/v100-runtime-assets-provenance.json"), "utf8"));
  assert.equal(provenance.draftGuideTexturesRemoved, true);

  for (const motion of MOTION_ATLASES) {
    const assetPath = V100_RUNTIME_ASSET_MANIFEST[motion.group][motion.key];
    const bytes = await readFile(publicFile(assetPath));
    const decoded = decodeRgbaPng(bytes);
    const expectedOutput = provenance.outputs[`/public${assetPath}`];
    assert.ok(expectedOutput, `${motion.kind} provenance output`);
    assert.deepEqual({ width: decoded.width, height: decoded.height }, {
      width: motion.columns * CELL_WIDTH,
      height: ATLAS_HEIGHT,
    }, `${motion.kind} atlas dimensions`);
    assert.equal(decoded.colorType, 6, `${motion.kind} RGBA output`);
    assert.equal(expectedOutput.width, decoded.width);
    assert.equal(expectedOutput.height, decoded.height);
    assert.equal(expectedOutput.channels, 4);
    assert.equal(expectedOutput.hasAlpha, true);
    assert.equal(expectedOutput.sha256, sha256(bytes), `${motion.kind} provenance hash`);
    assert.equal(expectedOutput.sourceDirection, "left-authored");
    assert.deepEqual(expectedOutput.directionRows, { right: "derived-horizontal-flip", left: "authored" });
    assert.match(expectedOutput.weaponScalePolicy, motion.policy);
    assert.equal(expectedOutput.semanticStates.length, motion.states.length);
    assert.deepEqual(expectedOutput.sources.slice(0, motion.states.length), motion.states.map((state) => `${motion.frameDirectory}/${state}-left-authored-v1.png`));
    assert.equal(expectedOutput.sources.at(-1), expectedOutput.identityMaster);

    const contentSizes = [];
    for (let stateIndex = 0; stateIndex < motion.states.length; stateIndex += 1) {
      const state = motion.states[stateIndex];
      const right = v100RuntimeSpriteFrameFor(motion.kind, state, "right");
      const left = v100RuntimeSpriteFrameFor(motion.kind, state, "left");
      assert.deepEqual(right.sourceRect, { x: stateIndex * CELL_WIDTH, y: 0, w: CELL_WIDTH, h: CELL_HEIGHT });
      assert.deepEqual(left.sourceRect, { x: stateIndex * CELL_WIDTH, y: CELL_HEIGHT, w: CELL_WIDTH, h: CELL_HEIGHT });
      const rightBounds = localAlphaBounds(decoded, right.sourceRect);
      const leftBounds = localAlphaBounds(decoded, left.sourceRect);
      assert.equal(rightBounds.w, leftBounds.w, `${motion.kind}/${state} mirrored width`);
      assert.equal(rightBounds.h, leftBounds.h, `${motion.kind}/${state} mirrored height`);
      assert.equal(rightBounds.y, leftBounds.y, `${motion.kind}/${state} mirrored vertical placement`);
      assert.equal(rightBounds.x + leftBounds.x + rightBounds.w, CELL_WIDTH, `${motion.kind}/${state} mirrored horizontal placement`);
      assert.equal(hasTransparentPerimeter(decoded, right.sourceRect, 8), true, `${motion.kind}/${state}/right gutter`);
      assert.equal(hasTransparentPerimeter(decoded, left.sourceRect, 8), true, `${motion.kind}/${state}/left gutter`);
      const rightRaw = await rawCell(bytes, right.sourceRect.x, right.sourceRect.y);
      const leftRaw = await rawCell(bytes, left.sourceRect.x, left.sourceRect.y);
      const flippedRight = await sharp(rightRaw, { raw: { width: CELL_WIDTH, height: CELL_HEIGHT, channels: 4 } }).flop().raw().toBuffer();
      assert.deepEqual(flippedRight, leftRaw, `${motion.kind}/${state} right row is only a horizontal flip`);
      const bounds = localAlphaBounds(decoded, left.sourceRect);
      contentSizes.push({ state, w: bounds.w, h: bounds.h });
    }
    if (motion.kind === "boss-takuya-omega") {
      const idle = contentSizes.find(({ state }) => state === "idle");
      const attack = contentSizes.find(({ state }) => state === "attack");
      const death = contentSizes.find(({ state }) => state === "death");
      assert.ok(idle && attack && death);
      assert.ok(attack.w >= idle.w, `Omega greatsword attack must retain or exceed idle width: ${JSON.stringify(contentSizes)}`);
      assert.ok(death.w >= idle.w, `Omega greatsword death must retain or exceed idle width: ${JSON.stringify(contentSizes)}`);
    }
  }
});

test("runtime sprite lookup exposes every required motion in both directions", () => {
  for (const motion of MOTION_ATLASES) {
    assert.deepEqual(v100RuntimeSpriteStatesFor(motion.kind), motion.states);
    for (const state of motion.states) {
      for (const direction of ["left", "right"]) {
        const frame = v100RuntimeSpriteFrameFor(motion.kind, state, direction);
        assert.equal(frame.direction, direction);
        assert.equal(frame.authoredCell.w, CELL_WIDTH);
        assert.equal(frame.authoredCell.h, CELL_HEIGHT);
      }
    }
  }
});
