import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import sharp from "sharp";

import { V090_UNIT_VISUAL_PROFILES } from "../app/visualProfiles.js";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname.slice(1));
const LEDGER_PATH = path.join(ROOT, "docs", "ASSET_APPROVALS_0.9.0.json");

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(target) : [target];
  }));
  return nested.flat();
}

function repositoryPath(absolute) {
  return path.relative(ROOT, absolute).split(path.sep).join("/");
}

test("Version 0.9.0 visual approval ledger covers every active file and exact byte revision", async () => {
  const ledger = JSON.parse(await readFile(LEDGER_PATH, "utf8"));
  assert.equal(ledger.schemaVersion, 1);
  assert.equal(ledger.version, "0.9.0");
  assert.equal(ledger.status, "active-partial");
  assert.deepEqual(ledger.scope, ["assets/source/v090/", "public/art/v090/"]);
  assert.equal(ledger.rightsProvenance.thirdPartyDownloadedVisuals, false);
  assert.match(ledger.rightsProvenance.publicRedistribution, /producer directly authorized/i);
  assert.match(ledger.rightsProvenance.identityIsolation, /no other character/i);
  assert.equal(ledger.rightsProvenance.producerProvidedInputs.length, 1);
  assert.equal(
    ledger.rightsProvenance.producerProvidedInputs[0].messageReference,
    "producer-message-2026-07-26-image-1",
  );

  const activeFiles = [
    ...await filesBelow(path.join(ROOT, "assets", "source", "v090")),
    ...await filesBelow(path.join(ROOT, "public", "art", "v090")),
  ].map(repositoryPath).sort();
  const records = ledger.assets;
  assert.equal(records.length, 8);
  assert.equal(new Set(records.map(({ assetId }) => assetId)).size, records.length);
  assert.equal(new Set(records.map(({ path: assetPath }) => assetPath)).size, records.length);
  assert.deepEqual(records.map(({ path: assetPath }) => assetPath).sort(), activeFiles);

  for (const record of records) {
    assert.equal(record.status, "approved");
    const data = await readFile(path.join(ROOT, record.path));
    assert.equal(createHash("sha256").update(data).digest("hex"), record.sha256, record.path);
    assert.equal(data.length, record.bytes, record.path);
    const metadata = await sharp(data).metadata();
    assert.equal(metadata.width, record.width, record.path);
    assert.equal(metadata.height, record.height, record.path);
  }
});

test("Zakimiya derivatives resolve only to the producer master and the build fails closed on source revision", async () => {
  const ledger = JSON.parse(await readFile(LEDGER_PATH, "utf8"));
  const records = new Map(ledger.assets.map((record) => [record.assetId, record]));
  const masterId = "V090-ZAKIMIYA-IDENTITY@r1";
  const reachesMaster = (assetId, visited = new Set()) => {
    if (assetId === masterId) return true;
    if (visited.has(assetId)) return false;
    visited.add(assetId);
    const record = records.get(assetId);
    return Boolean(record?.sourceAssetIds?.length)
      && record.sourceAssetIds.every((sourceId) => records.has(sourceId))
      && record.sourceAssetIds.some((sourceId) => reachesMaster(sourceId, visited));
  };
  for (const record of ledger.assets) {
    assert.equal(record.assetId === masterId || reachesMaster(record.assetId), true, record.assetId);
  }

  const master = await readFile(path.join(ROOT, records.get(masterId).path));
  const reference = await readFile(path.join(ROOT, records.get("V090-ZAKIMIYA-REFERENCE@r1").path));
  assert.deepEqual(reference, master);

  const profile = V090_UNIT_VISUAL_PROFILES.zakimiya;
  const runtimePaths = [
    profile.identityMaster.path,
    profile.eventPortrait.path,
    profile.formationCard.path,
    profile.personnelCard.path,
    profile.battleSprite.path,
  ].map((assetPath) => `public${assetPath}`);
  const registeredPaths = new Set(ledger.assets.map(({ path: assetPath }) => assetPath));
  for (const runtimePath of runtimePaths) assert.equal(registeredPaths.has(runtimePath), true, runtimePath);

  const buildScript = await readFile(path.join(ROOT, "scripts", "build-v090-zakimiya-assets.mjs"), "utf8");
  for (const record of ledger.assets.filter(({ kind }) => (
    kind === "producer-identity-master" || kind === "openai-generated-identity-derivative"
  ))) {
    assert.match(buildScript, new RegExp(record.sha256));
  }
});
