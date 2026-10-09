import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { regenerateMotionAtlases, MOTION_DEFINITIONS } from "./v100-reviewed-motion-generator.mjs";

const root = path.resolve(import.meta.dirname, "..");
const outputDirectory = path.join(root, "outputs/completion/motion-alpha-regeneration-check");
const expected = {
  "mugarian-president-mutated": "6f38bd9479fa2ab739fedfc383525398185519bebd64befaec271fb3eb3c9e5a",
  "takuya-omega": "16241ef40b809c2258822af01653d3b04cf02c959e835ff2e427a2338d3756c8",
  "red-panther-knife": "7cdc0436c6edd763cc4594268db44c5853b5f35cccd2e3901146ab230b6ca881",
  "red-panther-shield": "5c48ac9a84d89c852e4039f3b58814f0ea70c4907ea9ac8a5e4ffaebd455c475",
  "red-panther-smg": "e53916e676884631618b8e5cff8f53506451299fcec52638b77724ab724cc5c5",
  "red-panther-commander": "b8bd7198dd7b602ae03f20f1cd36340e713cbb06941e673a8b4c33bdf0f2cc19",
};

const records = await regenerateMotionAtlases(outputDirectory);
assert.equal(records.length, MOTION_DEFINITIONS.length);
for (const record of records) {
  const definition = record.definition;
  assert.equal(record.metadata.sha256, expected[definition.name], `${definition.name} regenerated hash differs from reviewed candidate`);
  assert.equal(record.metadata.atlas.width, definition.states.length * 544);
  assert.equal(record.metadata.atlas.height, 1024);
  assert.equal(record.metadata.sources.length, definition.states.length);
  assert.equal(record.metadata.sources.reduce((sum, source) => sum + source.repair.rgbChangesOutsideAllowedMask, 0), 0, `${definition.name} changed source RGB outside repair mask`);
  assert.equal(record.metadata.sources.reduce((sum, source) => sum + source.repair.alphaChangesOutsideAllowedMask, 0), 0, `${definition.name} changed source alpha outside repair mask`);
  for (const frame of record.metadata.frames) {
    assert.equal(frame.clipped, false);
    assert.ok(frame.contentRect.x >= 16 && frame.contentRect.y >= 16);
    assert.ok(frame.contentRect.x + frame.contentRect.width <= 544 - 16);
    assert.ok(frame.contentRect.y + frame.contentRect.height <= 512 - 16);
  }
}
await fs.writeFile(path.join(outputDirectory, "focused-test-result.json"), `${JSON.stringify({ passed: true, outputDirectory, hashes: Object.fromEntries(records.map((record) => [record.definition.name, record.metadata.sha256])) }, null, 2)}\n`);
console.log("v100 reviewed motion regeneration: PASS");
