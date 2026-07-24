import assert from "node:assert/strict";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

import { CAMPAIGN_STAGES } from "../app/campaign.js";
import { PRODUCTION_VISUALS } from "../app/productionVisuals.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = path.join(root, "public", "art", "v080", "stages");
const sourceRoot = path.join(root, "assets", "source", "v080", "stages");
const expansionStages = CAMPAIGN_STAGES.slice(6);

test("Version 0.8.0 ships ten distinct 1600x900 stage variants from four source masters", async () => {
  const stagePaths = expansionStages.map(({ id }) => PRODUCTION_VISUALS.stages[id]);
  assert.equal(stagePaths.length, 10);
  assert.equal(new Set(stagePaths).size, 10);
  assert.equal(stagePaths.every((assetPath) => assetPath.startsWith("/art/v080/stages/")), true);

  let totalBytes = 0;
  for (const assetPath of stagePaths) {
    const physicalPath = path.join(root, "public", assetPath.slice(1));
    const info = await stat(physicalPath);
    const metadata = await sharp(physicalPath).metadata();
    assert.deepEqual([metadata.width, metadata.height, metadata.format], [1600, 900, "webp"], assetPath);
    assert.ok(info.size > 80_000 && info.size < 300_000, assetPath);
    totalBytes += info.size;
  }
  assert.ok(totalBytes < 2_500_000, `stage art payload is ${totalBytes} bytes`);

  const masterNames = (await readdir(sourceRoot)).filter((name) => name.endsWith("-master.png")).sort();
  assert.deepEqual(masterNames, [
    "hospital-master.png",
    "logistics-master.png",
    "research-master.png",
    "t-plan-master.png",
  ]);
  assert.equal((await readdir(outputRoot)).some((name) => name === "masters"), false);
});
