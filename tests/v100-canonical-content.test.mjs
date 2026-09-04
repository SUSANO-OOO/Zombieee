import assert from "node:assert/strict";
import test from "node:test";

import {
  validateV100CanonicalContent,
} from "../app/v100CanonicalContent.js";
import { V100_STAGE_RUNTIME } from "../app/v100StageRuntime.js";
import { V100_STAGE_IDS, V100_STAGES } from "../app/v100Registry.js";

test("V1 canonical content follows all 30 mounted stages and runtime references", () => {
  const result = validateV100CanonicalContent();
  assert.equal(result.ok, true, result.errors.join(", "));
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.counts.stages, 30);
  assert.equal(result.counts.stageStoryRefs, 90);
  assert.equal(result.counts.reachableEnemyKinds, 29);
  assert.equal(result.missingEnemyKinds.length, 0);
  assert.equal(result.unknownEnemyKinds.length, 0);
});
test("V1 canonical content fails closed for a missing story event and asset", () => {
  const stageId = V100_STAGE_IDS[20];
  const brokenRuntime = structuredClone(V100_STAGE_RUNTIME);
  brokenRuntime[stageId].storyEventIds[0] = "v100:event:missing-fixture";
  brokenRuntime[stageId].requiredAssetPaths = ["/art/v100/fixture-missing.webp"];
  const result = validateV100CanonicalContent({
    stages: V100_STAGES,
    runtimes: brokenRuntime,
    physicalAssetPaths: new Set(),
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("story-event-missing")));
  assert.ok(result.errors.some((error) => error.includes("asset-missing")));
});
