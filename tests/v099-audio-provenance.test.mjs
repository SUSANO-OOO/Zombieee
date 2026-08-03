import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PRODUCTION_AUDIO_MANIFEST } from "../app/productionAudio.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const provenancePath = path.join(root, "reference", "audio", "v099-generated", "provenance.json");

async function sha256(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

test("v0.9.9.0 PR2 provenance matches the manifest's 36 one-source outputs", async () => {
  const provenance = JSON.parse(await readFile(provenancePath, "utf8"));
  assert.equal(provenance.version, "0.9.9.0");
  assert.equal(provenance.designRevision, "v2");
  assert.equal(provenance.physicalAssetCount, 36);
  assert.equal(provenance.assets.length, 36);
  assert.equal(provenance.encoding.preferredSourceOnly, true);
  assert.ok(provenance.assets.every((asset) => asset.source === "project-original"));
  assert.ok(provenance.assets.every((asset) => asset.commercialUse && asset.modification && asset.redistribution));

  const manifestAssets = PRODUCTION_AUDIO_MANIFEST.assets.filter((asset) => asset.sources[0]?.src.startsWith("/audio/v099/"));
  assert.equal(manifestAssets.length, 36);
  const manifestById = new Map(manifestAssets.map((asset) => [asset.id, asset]));
  let totalBytes = 0;
  for (const entry of provenance.assets) {
    const outputPath = path.join(root, entry.output);
    const outputStat = await stat(outputPath);
    assert.equal(outputStat.size, entry.outputBytes, entry.id);
    assert.equal(entry.addedBytes, entry.outputBytes, entry.id);
    assert.equal(await sha256(outputPath), entry.outputSha256, entry.id);
    assert.equal(manifestById.get(entry.id)?.sources.length, 1, entry.id);
    assert.equal(manifestById.get(entry.id)?.sources[0].src, `/${entry.output.replace(/^public\//, "")}`, entry.id);
    totalBytes += outputStat.size;
  }
  assert.equal(totalBytes, provenance.distinctOutputBytes);
});
