import assert from "node:assert/strict";
import test from "node:test";

import {
  ENEMY_RUNTIME_SHARD_COUNT,
  validateProductionEnemyRuntimeShards,
} from "../scripts/v0995-enemy-runtime-shards.mjs";

test("production enemy runtime coverage derives six complete candidate-aware shards", () => {
  const result = validateProductionEnemyRuntimeShards();
  assert.equal(ENEMY_RUNTIME_SHARD_COUNT, 6);
  assert.equal(result.shardCount, ENEMY_RUNTIME_SHARD_COUNT);
  assert.equal(result.valid, true, JSON.stringify(result, null, 2));
  assert.equal(result.missing.length, 0);
  assert.equal(result.duplicateCoverage.length, 0);
  assert.equal(result.unknown.length, 0);
  assert.equal(result.unknownReachableKinds.length, 0);
  assert.equal(result.missingBossKinds.length, 0);
  assert.equal(result.runtimeSpriteStateMissing.length, 0);
  assert.deepEqual(new Set(result.shards.flat()), new Set(result.requiredEnemyKinds));
});
