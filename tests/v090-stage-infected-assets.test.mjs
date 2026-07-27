import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import test from "node:test";

import { PRODUCTION_VISUALS } from "../app/productionVisuals.js";
import { SPRITE_MANIFEST } from "../app/spriteManifest.js";
import { V090_INFECTED_DEFINITIONS, V090_INFECTED_KINDS } from "../app/v090Infected.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function json(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

async function sha256(relativePath) {
  return createHash("sha256")
    .update(await readFile(path.join(root, relativePath)))
    .digest("hex");
}

test("six Version 0.9.0 infected assets are reproducible, identity-distinct, and review-gated", async () => {
  const ledger = await json("docs/INFECTED_ASSETS_0.9.0.json");
  assert.equal(ledger.status, "producer-review-required");
  assert.equal(ledger.rightsProvenance.thirdPartyDownloadedVisuals, false);
  assert.deepEqual(ledger.infected.map(({ kind }) => kind), V090_INFECTED_KINDS);
  assert.equal(new Set(ledger.infected.map(({ bodyPlan }) => bodyPlan)).size, 6);

  for (const record of ledger.infected) {
    assert.equal(await sha256(record.source.path), record.source.sha256, `${record.kind} source`);
    assert.equal(await sha256(record.atlas.path), record.atlas.sha256, `${record.kind} atlas`);
    assert.equal(await sha256(record.compendium.path), record.compendium.sha256, `${record.kind} compendium`);
    assert.equal((await readFile(path.join(root, record.atlas.path))).byteLength, record.atlas.bytes);
    assert.equal((await readFile(path.join(root, record.compendium.path))).byteLength, record.compendium.bytes);
    const atlas = await sharp(path.join(root, record.atlas.path)).metadata();
    const compendium = await sharp(path.join(root, record.compendium.path)).metadata();
    assert.deepEqual([atlas.width, atlas.height], record.atlas.dimensions);
    assert.deepEqual([compendium.width, compendium.height], record.compendium.dimensions);
    assert.equal(SPRITE_MANIFEST[record.kind].path, `/${record.atlas.path.replace(/^public\//u, "")}`);
    assert.equal(V090_INFECTED_DEFINITIONS[record.kind].compendiumAsset, `/${record.compendium.path.replace(/^public\//u, "")}`);
  }
});

test("Stage 17-20 backgrounds are immutable production candidates with unique decoded images", async () => {
  const ledger = await json("docs/STAGE_ASSETS_0.9.0.json");
  assert.equal(ledger.status, "production-candidate");
  assert.equal(ledger.rightsProvenance.thirdPartyDownloadedVisuals, false);
  assert.equal(ledger.stages.length, 4);
  assert.equal(new Set(ledger.stages.map(({ sha256 }) => sha256)).size, 4);

  for (const record of ledger.stages) {
    assert.equal(await sha256(record.sourcePath), record.sourceSha256, `${record.stageId} source`);
    assert.equal(await sha256(record.path), record.sha256, `${record.stageId} output`);
    assert.equal((await readFile(path.join(root, record.path))).byteLength, record.bytes);
    const metadata = await sharp(path.join(root, record.path)).metadata();
    assert.equal(metadata.format, "webp");
    assert.deepEqual([metadata.width, metadata.height], record.dimensions);
    assert.equal(PRODUCTION_VISUALS.stages[record.stageId], `/${record.path.replace(/^public\//u, "")}`);
  }

  assert.equal(ledger.missionObjects.length, 1);
  const [powerRig] = ledger.missionObjects;
  assert.equal(powerRig.stageId, "stage-coastal-link-bridge");
  assert.equal(await sha256(powerRig.sourcePath), powerRig.sourceSha256);
  assert.equal(await sha256(powerRig.path), powerRig.sha256);
  assert.equal((await readFile(path.join(root, powerRig.path))).byteLength, powerRig.bytes);
  const metadata = await sharp(path.join(root, powerRig.path)).metadata();
  assert.deepEqual(
    { format: metadata.format, width: metadata.width, height: metadata.height, hasAlpha: metadata.hasAlpha },
    { format: "png", width: 640, height: 320, hasAlpha: true },
  );
  assert.equal(PRODUCTION_VISUALS.missionObjects[powerRig.objectId], `/${powerRig.path.replace(/^public\//u, "")}`);
});
