import { productionEnemyRuntimeContract } from "../app/productionEnemyRuntime.js";

export const ENEMY_RUNTIME_SHARD_COUNT = 6;

function partition(values, shardCount) {
  const result = [];
  let offset = 0;
  const baseSize = Math.floor(values.length / shardCount);
  const remainder = values.length % shardCount;
  for (let index = 0; index < shardCount; index += 1) {
    const size = baseSize + (index < remainder ? 1 : 0);
    result.push(values.slice(offset, offset + size));
    offset += size;
  }
  return result;
}

function spriteStateMissing(requirement) {
  if (requirement.error || !requirement.sheet || requirement.states.length === 0) return true;
  return requirement.states.some(({ left, right }) => (
    !left?.path || !right?.path
    || !left?.sourceRect || !right?.sourceRect
    || ![left.sourceRect.x, left.sourceRect.y, left.sourceRect.w, left.sourceRect.h,
      right.sourceRect.x, right.sourceRect.y, right.sourceRect.w, right.sourceRect.h].every(Number.isFinite)
  ));
}

export function productionEnemyRuntimeShards({ shardCount = ENEMY_RUNTIME_SHARD_COUNT } = {}) {
  const contract = productionEnemyRuntimeContract();
  return {
    contract,
    shards: partition(contract.requiredEnemyKinds, shardCount),
  };
}

export function validateProductionEnemyRuntimeShards({ shardCount = ENEMY_RUNTIME_SHARD_COUNT } = {}) {
  const { contract, shards } = productionEnemyRuntimeShards({ shardCount });
  const requiredSet = new Set(contract.requiredEnemyKinds);
  const flattened = shards.flat();
  const occurrences = new Map();
  for (const kind of flattened) occurrences.set(kind, (occurrences.get(kind) ?? 0) + 1);
  const missing = contract.requiredEnemyKinds.filter((kind) => !occurrences.has(kind));
  const duplicateCoverage = [...occurrences.entries()]
    .filter(([, count]) => count > 1)
    .map(([kind, count]) => ({ kind, count }));
  const unknown = flattened.filter((kind) => !requiredSet.has(kind));
  const runtimeSpriteStateMissing = contract.spriteRequirements
    .filter(spriteStateMissing)
    .map(({ kind, error }) => ({ kind, error }));
  const valid = (
    shards.length === shardCount
    && contract.requiredEnemyKinds.length > 0
    && contract.unknownReachableKinds.length === 0
    && contract.missingBossKinds.length === 0
    && missing.length === 0
    && duplicateCoverage.length === 0
    && unknown.length === 0
    && runtimeSpriteStateMissing.length === 0
  );
  return {
    valid,
    shardCount,
    requiredEnemyKinds: contract.requiredEnemyKinds,
    shards,
    missing,
    duplicateCoverage,
    unknown,
    unknownReachableKinds: contract.unknownReachableKinds,
    missingBossKinds: contract.missingBossKinds,
    runtimeSpriteStateMissing,
    unreachableRegisteredKinds: contract.unreachableRegisteredKinds,
  };
}

if (process.argv.includes("--check")) {
  const result = validateProductionEnemyRuntimeShards();
  console.log(JSON.stringify(result, null, 2));
  if (!result.valid) process.exitCode = 1;
}

const shardIndexArg = process.argv.indexOf("--shard");
if (shardIndexArg >= 0) {
  const shardName = process.argv[shardIndexArg + 1] ?? "";
  const shardIndex = Number.parseInt(shardName, 10) - 1;
  const result = validateProductionEnemyRuntimeShards();
  if (!result.valid) throw new Error(`Invalid production enemy runtime shard contract: ${JSON.stringify(result)}`);
  if (!Number.isInteger(shardIndex) || shardIndex < 0 || shardIndex >= result.shards.length) {
    throw new RangeError(`Unknown enemy runtime shard: ${shardName}`);
  }
  process.stdout.write(result.shards[shardIndex].join(" "));
}
