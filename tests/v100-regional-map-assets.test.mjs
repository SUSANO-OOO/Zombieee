import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { V100_STAGES } from "../app/v100Registry.js";
import { v100RegionalMapForChapter, v100RegionalMapPaths, v100RegionalMapPoints } from "../app/v100RegionalMap.js";
import { v100RegionalMapDisclosure } from "../app/v100RegionalMap.js";
import { createDefaultV100Save } from "../app/v100Save.js";

const root = process.cwd();
const publicRoot = path.join(root, "public");
const manifest = JSON.parse(await readFile(path.join(publicRoot, "asset-manifest.json"), "utf8"));

test("regional campaign maps are complete, correctly placed, and available in the offline campaign pack", async () => {
  const paths = new Set(manifest.assets.map((asset) => asset.path));
  const registeredMaps = v100RegionalMapPaths();
  const chapters = [
    { id: "chapter-1", start: 1, end: 6 },
    { id: "chapter-2", start: 7, end: 12 },
    { id: "chapter-3", start: 13, end: 20 },
    { id: "chapter-4", start: 21, end: 25 },
    { id: "chapter-5", start: 26, end: 29 },
    { id: "chapter-final", start: 30, end: 30 },
  ];

  for (const chapter of chapters) {
    const region = v100RegionalMapForChapter(chapter.id);
    const stages = V100_STAGES.filter((stage) => stage.number >= chapter.start && stage.number <= chapter.end);
    const points = v100RegionalMapPoints(chapter.id, stages.length);
    assert.equal(registeredMaps[chapter.id], region.assetPath, `${chapter.id} has one stable regional map`);
    assert.equal(points.length, stages.length, `${chapter.id} has a pin for every stable stage`);
    assert.ok(points.every(([x, y]) => x >= 0 && x <= 100 && y >= 0 && y <= 100), `${chapter.id} pin coordinates stay on the map`);

    const asset = manifest.assets.find((entry) => entry.path === region.assetPath);
    assert.ok(asset && paths.has(region.assetPath), `${region.assetPath} is in the offline pack`);
    assert.deepEqual(
      { pack: asset.pack, category: asset.category, criticality: asset.criticality },
      { pack: "campaign-core", category: "background", criticality: "critical" },
    );
    const bytes = await readFile(path.join(publicRoot, region.assetPath.slice(1)));
    assert.equal(asset.bytes, bytes.byteLength, `${region.assetPath} byte count matches`);
    assert.equal(asset.hash, `sha256-${createHash("sha256").update(bytes).digest("hex")}`, `${region.assetPath} hash matches`);
  }
});

test("regional map labels reveal area and endpoint purpose only after the matching story access", () => {
  const chapter = { id: "chapter-4", start: 21, end: 25 };
  const stages = V100_STAGES.filter(stage => stage.number >= chapter.start && stage.number <= chapter.end);
  const region = v100RegionalMapForChapter(chapter.id);
  const freshSave = createDefaultV100Save({ playerName: "disclosure regression" });

  const untouched = v100RegionalMapDisclosure(region, stages.map(stage => stage.id), freshSave);
  assert.equal(untouched.regionLabel, "未到達区域");
  assert.equal(untouched.subregionLabel, "未到達区域");
  assert.ok(!untouched.regionLabel.includes(region.region));
  assert.ok(!untouched.subregionLabel.includes(region.subregion));

  const enteredSave = { ...freshSave, availableStageIds: [...freshSave.availableStageIds, stages[0].id] };
  const entered = v100RegionalMapDisclosure(region, stages.map(stage => stage.id), enteredSave);
  assert.equal(entered.regionLabel, region.region);
  assert.equal(entered.subregionLabel, "区域内を調査中");
  assert.ok(!entered.subregionLabel.includes(region.subregion));

  const endpointSave = { ...enteredSave, availableStageIds: [...enteredSave.availableStageIds, stages.at(-1).id] };
  const endpointKnown = v100RegionalMapDisclosure(region, stages.map(stage => stage.id), endpointSave);
  assert.equal(endpointKnown.subregionLabel, region.subregion);
});
