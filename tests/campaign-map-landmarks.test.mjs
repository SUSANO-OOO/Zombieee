import assert from "node:assert/strict";
import test from "node:test";

import { CAMPAIGN_REGIONS, CAMPAIGN_STAGES } from "../app/campaign.js";
import {
  MAP_LANDMARKS_BY_REGION,
  NEUTRAL_MAP_REGION_IDS,
  resolveMapLandmarks,
} from "../app/campaignMapLandmarks.js";

test("every campaign region has exactly one explicit or neutral landmark contract", () => {
  const regionIds = CAMPAIGN_REGIONS.map(({ id }) => id);
  const stageRegionIds = [...new Set(CAMPAIGN_STAGES.map(({ regionId }) => regionId))];
  assert.deepEqual(stageRegionIds.sort(), regionIds.sort());

  for (const regionId of regionIds) {
    const explicit = Object.hasOwn(MAP_LANDMARKS_BY_REGION, regionId);
    const neutral = NEUTRAL_MAP_REGION_IDS.includes(regionId);
    assert.equal(Number(explicit) + Number(neutral), 1, `${regionId} must be explicit or neutral exactly once`);
    const resolved = resolveMapLandmarks(regionId);
    assert.equal(resolved.missing, false);
    assert.equal(resolved.source, explicit ? "explicit" : "neutral");
  }
});

test("bay landmarks are explicit and never borrow Nishijin labels", () => {
  const resolved = resolveMapLandmarks("region-bay-quarantine");
  assert.equal(resolved.source, "explicit");
  assert.deepEqual(resolved.landmarks, [
    { className: "tower", label: "湾岸タワー", status: "非常回廊封鎖" },
    { className: "shelter", label: "市民資料館", status: "搬送路確保中" },
    { className: "coast", label: "海浜連絡橋", status: "高潮警戒" },
    { className: "shoreline", label: "河口防潮門", status: "最終封鎖対象" },
  ]);
  assert.equal(resolved.landmarks.some(({ label }) => label.includes("西新")), false);
});

test("unknown regions fail visible without displaying another region's landmarks", () => {
  const resolved = resolveMapLandmarks("region-not-in-campaign");
  assert.deepEqual(resolved.landmarks, []);
  assert.equal(resolved.source, "missing");
  assert.equal(resolved.missing, true);
});
