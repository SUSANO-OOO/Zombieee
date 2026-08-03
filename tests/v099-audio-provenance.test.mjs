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
  assert.equal(provenance.generatorVersion, 2);
  assert.equal(provenance.generator, "scripts/build-v099-battle-audio.mjs");
  assert.equal(provenance.candidateId, "v099-pr2-audio-r2");
  assert.equal(provenance.producerApproval, "Gate A pending");
  assert.equal(provenance.ffmpeg.package, "@ffmpeg-installer/ffmpeg@1.1.0");
  assert.match(provenance.ffmpeg.version, /^ffmpeg version N-92722-gf22fcd4483\b/);
  assert.equal(provenance.encoding.preferredSourceOnly, true);
  assert.ok(provenance.assets.every((asset) => asset.source === "project-original"));
  assert.ok(provenance.assets.every((asset) => asset.commercialUse && asset.modification && asset.redistribution));
  assert.ok(provenance.assets.every((asset) => asset.candidateId === provenance.candidateId));
  assert.ok(provenance.assets.every((asset) => asset.producerApproval === "Gate A pending"));
  assert.equal(new Set(provenance.assets.map((asset) => asset.recipeId)).size, 36);
  assert.deepEqual(
    Object.fromEntries(["bgm", "weapons", "melee", "support", "ui"].map((category) => [
      category,
      provenance.assets.filter((asset) => asset.category === category).length,
    ])),
    { bgm: 3, weapons: 19, melee: 6, support: 5, ui: 3 },
  );

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
