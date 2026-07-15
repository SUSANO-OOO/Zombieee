import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { PRODUCTION_VISUALS, STORY_BACKGROUND_VISUALS, stageVisualFor } from "../app/productionVisuals.js";

const repoAsset = (publicPath) => new URL(`../public${publicPath}`, import.meta.url);

test("production visual manifest uses dedicated title, command, guide, and three stage images", async () => {
  const paths = [PRODUCTION_VISUALS.title, PRODUCTION_VISUALS.command, PRODUCTION_VISUALS.guide, ...Object.values(PRODUCTION_VISUALS.stages)];
  assert.equal(paths.length, 6);
  assert.equal(new Set(paths).size, paths.length);
  const hashes = [];
  for (const path of paths) {
    assert.match(path, /^\/art\/v060\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\.webp$/);
    const bytes = await readFile(repoAsset(path));
    assert.equal(bytes.subarray(0, 4).toString("ascii"), "RIFF");
    assert.equal(bytes.subarray(8, 12).toString("ascii"), "WEBP");
    assert.ok(bytes.length > 50_000, `${path} must be a production-size image`);
    hashes.push(createHash("sha256").update(bytes).digest("hex"));
  }
  assert.equal(new Set(hashes).size, hashes.length, "the three stages must not reuse a recolored identical image");
});

test("story and battle screens resolve the same location-specific art", () => {
  assert.equal(STORY_BACKGROUND_VISUALS["shopping-street"], stageVisualFor("stage-nishijin-shopping-street"));
  assert.equal(STORY_BACKGROUND_VISUALS["ward-office"], stageVisualFor("stage-sawara-ward-office"));
  assert.equal(STORY_BACKGROUND_VISUALS["defense-line"], stageVisualFor("stage-nishijin-defense-line-takuya"));
  assert.equal(stageVisualFor("unknown-stage"), "/battlefield-v4.png");
});
