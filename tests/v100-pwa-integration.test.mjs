import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import {
  validateAssetManifest,
} from "../app/pwaAssetManifest.js";
import { v100RuntimeAssetPathList } from "../app/v100RuntimeAssetManifest.js";

const root = process.cwd();

test("V1 gameplay route is behind the durable PWA gate", async () => {
  const [page, campaign] = await Promise.all([
    readFile(path.join(root, "app/v100/page.tsx"), "utf8"),
    readFile(path.join(root, "app/V100Campaign.tsx"), "utf8"),
  ]);
  assert.match(page, /<PwaGate>\s*<V100Campaign \/>\s*<\/PwaGate>/u);
  assert.match(campaign, /data\.pwaScreen|dataset\.pwaScreen/u);
  assert.match(campaign, /pwaBattleActive = String\(battleActive\)/u);
  assert.match(campaign, /pwaResultSaving = String\(resultSaving\)/u);
});

test("the published PWA manifest includes every V1 runtime path as a critical asset", async () => {
  const manifest = JSON.parse(await readFile(path.join(root, "public/asset-manifest.json"), "utf8"));
  const validation = validateAssetManifest(manifest);
  assert.equal(validation.valid, true, validation.errors.join("; "));

  const byPath = new Map(manifest.assets.map((asset) => [asset.path, asset]));
  for (const assetPath of v100RuntimeAssetPathList()) {
    const asset = byPath.get(assetPath);
    assert.ok(asset, `missing V1 PWA asset ${assetPath}`);
    assert.equal(asset.criticality, "critical", `${assetPath} must block an incomplete V1 generation`);
    if (assetPath.endsWith(".png")) {
      assert.match(asset.sourcePath ?? "", /^\/pwa-optimized\/art\/v100\/.+\.webp$/u);
    }
    assert.doesNotMatch(assetPath, /(?:private|identity-master)[^/]*photo|photo[^/]*(?:private|identity-master)|identity-master/u);
  }
});

test("V1 PWA asset registration remains project-local and does not expose private source photos", async () => {
  const [generator, manifest] = await Promise.all([
    readFile(path.join(root, "scripts/build-asset-manifest.mjs"), "utf8"),
    readFile(path.join(root, "public/asset-manifest.json"), "utf8"),
  ]);
  assert.match(generator, /V100_RUNTIME_ASSET_MANIFEST/u);
  assert.doesNotMatch(generator, /private.*photo|photo.*private/u);
  assert.doesNotMatch(manifest, /private.*photo|photo.*private|C:\\\\Users|\/Users\//iu);
});
