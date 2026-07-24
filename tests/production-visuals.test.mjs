import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import test from "node:test";

import { CAMPAIGN_STAGES } from "../app/campaign.js";
import { PRODUCTION_VISUALS, STORY_BACKGROUND_VISUALS, stageVisualFor } from "../app/productionVisuals.js";
import { V075_VISUAL_PROFILES } from "../app/visualProfiles.js";

const repoAsset = (publicPath) => new URL(`../public${publicPath}`, import.meta.url);
const repoAssetFile = (publicPath) => fileURLToPath(repoAsset(publicPath));

test("production visual manifest uses dedicated title, command, guide, sixteen stages, and three event cuts", async () => {
  const paths = [
    PRODUCTION_VISUALS.title,
    PRODUCTION_VISUALS.command,
    PRODUCTION_VISUALS.guide,
    ...Object.values(PRODUCTION_VISUALS.stages),
    ...Object.values(PRODUCTION_VISUALS.eventCuts),
  ];
  assert.equal(Object.keys(PRODUCTION_VISUALS.stages).length, CAMPAIGN_STAGES.length);
  assert.equal(paths.length, 3 + CAMPAIGN_STAGES.length + 3);
  assert.equal(new Set(paths).size, paths.length);
  const hashes = [];
  for (const path of paths) {
    assert.match(path, /^\/art\/v0(?:60|70|75|80)\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\.webp$/);
    const bytes = await readFile(repoAsset(path));
    assert.equal(bytes.subarray(0, 4).toString("ascii"), "RIFF");
    assert.equal(bytes.subarray(8, 12).toString("ascii"), "WEBP");
    assert.ok(bytes.length > 50_000, `${path} must be a production-size image`);
    hashes.push(createHash("sha256").update(bytes).digest("hex"));
  }
  assert.equal(new Set(hashes).size, hashes.length, "production locations and cuts must not reuse identical image bytes");
});

test("0.7.5 checkpoint identities resolve to purpose-specific production assets", async () => {
  assert.equal(PRODUCTION_VISUALS.guide, V075_VISUAL_PROFILES.ikura.eventPortrait.path);
  assert.equal(V075_VISUAL_PROFILES.ikura.identityLock.length, 5);
  assert.equal(V075_VISUAL_PROFILES.crawler.identityLock.length, 4);
  assert.equal(V075_VISUAL_PROFILES.enemyBase.identityLock.length, 4);

  const paths = [
    V075_VISUAL_PROFILES.ikura.identityMaster.path,
    V075_VISUAL_PROFILES.ikura.eventPortrait.path,
    V075_VISUAL_PROFILES.crawler.identityMaster.path,
    V075_VISUAL_PROFILES.crawler.closed.path,
    V075_VISUAL_PROFILES.crawler.open.path,
    V075_VISUAL_PROFILES.enemyBase.identityMaster.path,
    V075_VISUAL_PROFILES.enemyBase.intact.path,
  ];
  for (const path of paths) {
    const metadata = await sharp(repoAssetFile(path), { failOn: "error" }).metadata();
    assert.ok(metadata.width > 0 && metadata.height > 0, `${path} dimensions`);
  }

  const portrait = await sharp(repoAssetFile(V075_VISUAL_PROFILES.ikura.eventPortrait.path)).metadata();
  assert.deepEqual(
    { format: portrait.format, width: portrait.width, height: portrait.height, hasAlpha: portrait.hasAlpha },
    { format: "webp", width: 512, height: 640, hasAlpha: true },
  );
  const closed = await sharp(repoAssetFile(V075_VISUAL_PROFILES.crawler.closed.path)).metadata();
  const open = await sharp(repoAssetFile(V075_VISUAL_PROFILES.crawler.open.path)).metadata();
  assert.deepEqual(
    { width: closed.width, height: closed.height, hasAlpha: closed.hasAlpha },
    { width: open.width, height: open.height, hasAlpha: open.hasAlpha },
  );
  const enemyBase = await sharp(repoAssetFile(V075_VISUAL_PROFILES.enemyBase.intact.path)).metadata();
  assert.equal(enemyBase.hasAlpha, true);
  assert.ok(enemyBase.height > enemyBase.width, "enemy base preserves the approved slender vertical silhouette");
});

test("story and battle screens resolve the same location-specific art", () => {
  assert.equal(STORY_BACKGROUND_VISUALS["shopping-street"], stageVisualFor("stage-nishijin-shopping-street"));
  assert.equal(STORY_BACKGROUND_VISUALS["ward-office"], stageVisualFor("stage-sawara-ward-office"));
  assert.equal(STORY_BACKGROUND_VISUALS["defense-line"], stageVisualFor("stage-nishijin-defense-line-takuya"));
  assert.equal(STORY_BACKGROUND_VISUALS["station-gate"], stageVisualFor("stage-nishijin-station-gate"));
  assert.equal(STORY_BACKGROUND_VISUALS["station-platform"], stageVisualFor("stage-nishijin-station-platform"));
  assert.equal(STORY_BACKGROUND_VISUALS["station-tunnel"], stageVisualFor("stage-nishijin-station-tunnel-seal"));
  assert.equal(STORY_BACKGROUND_VISUALS["station-gate-rescue-cut"], PRODUCTION_VISUALS.eventCuts["station-gate-rescue-cut"]);
  assert.equal(STORY_BACKGROUND_VISUALS["station-platform-escort-cut"], PRODUCTION_VISUALS.eventCuts["station-platform-escort-cut"]);
  assert.equal(STORY_BACKGROUND_VISUALS["station-tunnel-containment-cut"], PRODUCTION_VISUALS.eventCuts["station-tunnel-containment-cut"]);
  assert.equal(stageVisualFor("unknown-stage"), "/battlefield-v4.png");
});
