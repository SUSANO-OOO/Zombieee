import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  SPRITE_DIRECTIONS,
  SPRITE_STATES,
  V100_SPRITE_MANIFEST,
  V100_SPRITE_PROVENANCE,
  v100SpriteFrameFor,
} from "../app/spriteManifest.js";
import { alphaBounds, decodeRgbaPng, hasTransparentPerimeter } from "./image-asset-helpers.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicFile = (assetPath) => path.join(ROOT, "public", assetPath.replace(/^\//u, ""));

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

test("Paisen V1 runtime atlas has seven audited states in both directions", async () => {
  const entry = V100_SPRITE_MANIFEST.paisen;
  const bytes = await readFile(publicFile(entry.path));
  const decoded = decodeRgbaPng(bytes);
  assert.deepEqual({ width: decoded.width, height: decoded.height }, { width: 2758, height: 1514 });
  assert.equal(sha256(bytes), V100_SPRITE_PROVENANCE.atlasSha256);
  assert.deepEqual(entry.states, SPRITE_STATES);
  assert.deepEqual(entry.directions, SPRITE_DIRECTIONS);

  const frameHashes = new Map();
  for (const direction of SPRITE_DIRECTIONS) {
    for (const state of SPRITE_STATES) {
      const frame = v100SpriteFrameFor("paisen", state, direction);
      assert.equal(frame.path, entry.path);
      assert.deepEqual(alphaBounds(decoded, frame.sourceRect), frame.contentRect, `${state}/${direction} alpha audit`);
      assert.equal(hasTransparentPerimeter(decoded, frame.sourceRect, 16), true, `${state}/${direction} gutter`);
      const framePng = await sharp(bytes).extract({
        left: frame.sourceRect.x,
        top: frame.sourceRect.y,
        width: frame.sourceRect.w,
        height: frame.sourceRect.h,
      }).png().toBuffer();
      frameHashes.set(`${state}/${direction}`, sha256(framePng));
    }
  }
  assert.notEqual(frameHashes.get("hit/right"), frameHashes.get("death/right"));
  assert.notEqual(frameHashes.get("hit/left"), frameHashes.get("death/left"));
  assert.equal(v100SpriteFrameFor("paisen", "death", "right").derivedFrom, "hit");
  assert.equal(v100SpriteFrameFor("paisen", "death", "left").derivedFrom, "hit");
});

test("Paisen provenance names only the approved identity and legacy derivative sources", async () => {
  const identity = await readFile(publicFile(V100_SPRITE_PROVENANCE.identitySourcePath));
  const sourceBattle = await readFile(publicFile(V100_SPRITE_PROVENANCE.sourceBattleDerivativePath));
  assert.equal(sha256(identity), V100_SPRITE_PROVENANCE.identitySourceSha256);
  assert.equal(sha256(sourceBattle), V100_SPRITE_PROVENANCE.sourceBattleDerivativeSha256);
  assert.equal(V100_SPRITE_PROVENANCE.generator, "v100-paisen-atlas-r1");
});
