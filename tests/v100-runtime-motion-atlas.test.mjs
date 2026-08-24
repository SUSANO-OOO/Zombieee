import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { V100_RUNTIME_ASSET_MANIFEST, validateV100RuntimeAssetManifest } from "../app/v100RuntimeAssetManifest.js";
import {
  SPRITE_DIRECTIONS,
  SPRITE_STATES,
  fitSpriteBattleDisplaySize,
  spriteBattleDisplaySizeFor,
  spriteFrameFor,
} from "../app/spriteManifest.js";
import {
  v100RuntimeSpriteFrameFor,
  v100RuntimeSpriteStatesFor,
} from "../app/v100RuntimeSprites.js";
import { alphaBounds, decodeRgbaPng, hasTransparentPerimeter } from "./image-asset-helpers.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CELL_WIDTH = 544;
const CELL_HEIGHT = 512;
const ATLAS_HEIGHT = CELL_HEIGHT * 2;
const APPROVED_DECODED_SURFACE_BYTES = 80_216_064;
const APPROVED_DISPLAY_GEOMETRY_HASH = "93e48efa1692b14a61d2de29641570cd10d2f02149f85d9f89815f68861ff53d";

const MOTION_ATLASES = Object.freeze([
  {
    kind: "boss-mugarian-president-mutated",
    group: "bosses",
    key: "boss-mugarian-president-mutated",
    displayKind: "mugarian-president-mutated",
    frameDirectory: "assets/source/v100/runtime/motion/mugarian-president-mutated",
    states: ["entrance", "idle", "move", "attack", "hit", "phase", "death", "defeat"],
    columns: 8,
    policy: /hooked staff and oversized arm silhouette/u,
    commonScale: 0.33994334277620397,
    approvedVisibleHash: "02a65632ef9731f91a9977e7cd4d58e4ff87999ff6bada097afac85376b39de3",
  },
  {
    kind: "boss-takuya-omega",
    group: "bosses",
    key: "boss-takuya-omega",
    displayKind: "takuya-omega",
    frameDirectory: "assets/source/v100/runtime/motion/takuya-omega",
    states: ["entrance", "idle", "move", "attack", "hit", "phase", "death", "defeat"],
    columns: 8,
    policy: /oversized serrated greatsword.*same blade length and width/u,
    commonScale: 0.3218707015130674,
    approvedVisibleHash: "8c70bd8b2eac413fa2909e1a60ab18db7a40d464f6a0eb234ef757ee6288676f",
  },
  {
    kind: "red-panther-knife",
    group: "redPanther",
    key: "knife",
    displayKind: "red-panther-knife",
    frameDirectory: "assets/source/v100/runtime/motion/red-panther-knife",
    states: ["idle", "move", "attack", "hit", "death"],
    columns: 5,
    policy: /serrated combat knife.*same blade length/u,
    commonScale: 0.33766233766233766,
    approvedVisibleHash: "64306872600104595040f2f8dd1d29f18cd347a8e96964694622e6cede855035",
  },
  {
    kind: "red-panther-shield",
    group: "redPanther",
    key: "shield",
    displayKind: "red-panther-shield",
    frameDirectory: "assets/source/v100/runtime/motion/red-panther-shield",
    states: ["idle", "move", "attack", "hit", "death"],
    columns: 5,
    policy: /riot shield.*full body-covering rectangle/u,
    commonScale: 0.31388329979879276,
    approvedVisibleHash: "4e10e673db28baedde72cc98e38e4c132ad616dde21093310c788a97cbe1aaf7",
  },
  {
    kind: "red-panther-smg",
    group: "redPanther",
    key: "smg",
    displayKind: "red-panther-smg",
    frameDirectory: "assets/source/v100/runtime/motion/red-panther-smg",
    states: ["idle", "move", "attack", "hit", "death"],
    columns: 5,
    policy: /suppressed SMG.*same silhouette/u,
    commonScale: 0.31117021276595747,
    approvedVisibleHash: "8c12fa3dd831b6c5e400e13d4b642b79e5cde37a9a1076c24c2b85f9f182d56b",
  },
  {
    kind: "red-panther-commander",
    group: "redPanther",
    key: "commander",
    displayKind: "red-panther-commander",
    frameDirectory: "assets/source/v100/runtime/motion/red-panther-commander",
    states: ["idle", "move", "attack", "hit", "death"],
    columns: 5,
    policy: /compact sidearm.*same silhouette/u,
    commonScale: 0.30708661417322836,
    approvedVisibleHash: "8756beab8bde3780f72c6957c5155b27a3a5b7cdf4f6151af52ea7d0b0201c10",
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

function approvedVisiblePixelHash(decoded, motion) {
  const hash = createHash("sha256");
  for (let row = 0; row < 2; row += 1) {
    for (let state = 0; state < motion.columns; state += 1) {
      const cell = { x: state * CELL_WIDTH, y: row * CELL_HEIGHT, w: CELL_WIDTH, h: CELL_HEIGHT };
      const bounds = alphaBounds(decoded, cell);
      assert.ok(bounds, `${motion.kind}/${row}/${state} approved bounds`);
      hash.update(`${JSON.stringify({
        row,
        state,
        x: bounds.x - cell.x - CELL_WIDTH / 2,
        y: bounds.y - cell.y,
        w: bounds.w,
        h: bounds.h,
      })}\n`);
      for (let y = 0; y < bounds.h; y += 1) {
        const start = ((bounds.y + y) * decoded.width + bounds.x) * 4;
        hash.update(decoded.data.subarray(start, start + bounds.w * 4));
      }
    }
  }
  return hash.digest("hex");
}

const roundedGeometry = (value) => Number(value.toFixed(9));

function approvedDisplayGeometryHash() {
  const records = [];
  for (const motion of MOTION_ATLASES) {
    for (const state of SPRITE_STATES) {
      for (const direction of SPRITE_DIRECTIONS) {
        const frame = spriteFrameFor(motion.displayKind, state, direction);
        const display = fitSpriteBattleDisplaySize(
          motion.displayKind,
          frame,
          spriteBattleDisplaySizeFor(motion.displayKind),
        );
        const pixelScale = display.w / frame.sourceRect.w;
        records.push({
          kind: motion.displayKind,
          state,
          direction,
          pixelScale: roundedGeometry(pixelScale),
          left: roundedGeometry((frame.contentRect.x - frame.sourceRect.x - frame.sourceRect.w * frame.anchorX) * pixelScale),
          top: roundedGeometry((frame.contentRect.y - frame.sourceRect.y - frame.sourceRect.h * frame.anchorY) * pixelScale),
          width: roundedGeometry(frame.contentRect.w * pixelScale),
          height: roundedGeometry(frame.contentRect.h * pixelScale),
          anchorX: roundedGeometry(frame.anchorX),
          anchorY: roundedGeometry(frame.anchorY),
        });
      }
    }
  }
  assert.equal(records.length, 84);
  return sha256(Buffer.from(JSON.stringify(records)));
}

test("V1 runtime manifest exposes the complete Stage 21-30 and motion asset contract", () => {
  const validation = validateV100RuntimeAssetManifest();
  assert.equal(validation.ok, true, validation.errors.join(", "));
  assert.equal(Object.keys(V100_RUNTIME_ASSET_MANIFEST.bosses).length, 2);
  assert.equal(Object.keys(V100_RUNTIME_ASSET_MANIFEST.redPanther).length, 4);
  assert.equal(Object.keys(V100_RUNTIME_ASSET_MANIFEST.stages).length, 10);
});

test("custom runtime atlases preserve approved centered cells, exact pixels, PWA transport, and alpha gutters", async () => {
  const provenance = JSON.parse(await readFile(sourceFile("assets/source/v100/runtime/v100-runtime-assets-provenance.json"), "utf8"));
  const distribution = JSON.parse(await readFile(sourceFile("public/asset-manifest.json"), "utf8"));
  const distributedByPath = new Map(distribution.assets.map((asset) => [asset.path, asset]));
  assert.equal(provenance.draftGuideTexturesRemoved, true);
  let decodedSurfaceBytes = 0;

  for (const motion of MOTION_ATLASES) {
    const assetPath = V100_RUNTIME_ASSET_MANIFEST[motion.group][motion.key];
    const bytes = await readFile(publicFile(assetPath));
    const decoded = decodeRgbaPng(bytes);
    decodedSurfaceBytes += decoded.width * decoded.height * 4;
    const expectedOutput = provenance.outputs[`/public${assetPath}`];
    const metadataPath = assetPath.replace(/\.png$/u, "-metadata.json");
    const metadata = JSON.parse(await readFile(publicFile(metadataPath), "utf8"));
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
    assert.equal(expectedOutput.metadataPath, `/public${metadataPath}`);
    assert.equal(expectedOutput.commonScale, motion.commonScale);
    assert.deepEqual(expectedOutput.cell, { width: CELL_WIDTH, height: CELL_HEIGHT });
    assert.equal(expectedOutput.noClipping, true);
    assert.equal(expectedOutput.frameMetadata.length, motion.states.length);
    assert.equal(metadata.commonScale, motion.commonScale);
    assert.deepEqual(metadata.cell, { width: CELL_WIDTH, height: CELL_HEIGHT });
    assert.deepEqual(metadata.atlas, { width: decoded.width, height: decoded.height });
    assert.equal(metadata.noClipping, true);
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
      assert.ok(bounds.w <= CELL_WIDTH - 32, `${motion.kind}/${state} approved centered width`);
      contentSizes.push({ state, w: bounds.w, h: bounds.h });
    }
    assert.equal(approvedVisiblePixelHash(decoded, motion), motion.approvedVisibleHash, `${motion.kind} approved visible pixels`);

    const distributed = distributedByPath.get(assetPath);
    assert.ok(distributed?.sourcePath, `${motion.kind} PWA sourcePath`);
    const transport = await readFile(publicFile(distributed.sourcePath));
    const [logicalRaw, transportRaw] = await Promise.all([
      sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
      sharp(transport).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    ]);
    assert.deepEqual(transportRaw.info, logicalRaw.info, `${motion.kind} PWA geometry`);
    for (let offset = 0; offset < logicalRaw.data.length; offset += 4) {
      assert.equal(transportRaw.data[offset + 3], logicalRaw.data[offset + 3], `${motion.kind} PWA alpha ${offset / 4}`);
      if (logicalRaw.data[offset + 3] === 0) continue;
      assert.deepEqual(
        transportRaw.data.subarray(offset, offset + 3),
        logicalRaw.data.subarray(offset, offset + 3),
        `${motion.kind} PWA visible RGB ${offset / 4}`,
      );
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
  assert.equal(decodedSurfaceBytes, APPROVED_DECODED_SURFACE_BYTES);
  assert.equal(approvedDisplayGeometryHash(), APPROVED_DISPLAY_GEOMETRY_HASH);
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
