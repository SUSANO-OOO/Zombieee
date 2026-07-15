export const AUDIO_CATEGORIES = Object.freeze([
  "bgm",
  "ambience",
  "ui",
  "weapons",
  "melee",
  "humanVoices",
  "monsters",
  "support",
]);

export const AUDIO_PRELOAD_MODES = Object.freeze(["scene", "lazy"]);
export const AUDIO_POOL_STRATEGIES = Object.freeze(["random", "round-robin", "shuffle"]);

const categorySet = new Set(AUDIO_CATEGORIES);
const preloadModeSet = new Set(AUDIO_PRELOAD_MODES);
const poolStrategySet = new Set(AUDIO_POOL_STRATEGIES);

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFiniteInRange(value, minimum, maximum) {
  return Number.isFinite(value) && value >= minimum && value <= maximum;
}

function isSafeAssetPath(value) {
  return typeof value === "string"
    && value.startsWith("/")
    && !value.startsWith("//")
    && !value.includes("\\")
    && !value.includes("..")
    && !/[?#]/.test(value);
}

function validateAsset(asset, index, errors) {
  const prefix = `assets[${index}]`;
  if (!isRecord(asset)) {
    errors.push(`${prefix} must be an object`);
    return;
  }
  if (typeof asset.id !== "string" || asset.id.length === 0) errors.push(`${prefix}.id must be a non-empty string`);
  if (!categorySet.has(asset.category)) errors.push(`${prefix}.category must be a supported audio category`);
  if (!Array.isArray(asset.sources) || asset.sources.length === 0) {
    errors.push(`${prefix}.sources must contain at least one repository-local source`);
  } else {
    asset.sources.forEach((source, sourceIndex) => {
      const sourcePrefix = `${prefix}.sources[${sourceIndex}]`;
      if (!isRecord(source)) {
        errors.push(`${sourcePrefix} must be an object`);
        return;
      }
      if (!isSafeAssetPath(source.src)) errors.push(`${sourcePrefix}.src must be a repository-local absolute path`);
      if (source.type !== undefined && (typeof source.type !== "string" || source.type.length === 0)) {
        errors.push(`${sourcePrefix}.type must be a non-empty MIME type when present`);
      }
    });
  }
  if (asset.preload !== undefined && !preloadModeSet.has(asset.preload)) errors.push(`${prefix}.preload is invalid`);
  if (asset.loop !== undefined && typeof asset.loop !== "boolean") errors.push(`${prefix}.loop must be boolean`);
  if (asset.gain !== undefined && !isFiniteInRange(asset.gain, 0, 2)) errors.push(`${prefix}.gain must be between 0 and 2`);
  if (asset.priority !== undefined && !isFiniteInRange(asset.priority, 0, 1000)) errors.push(`${prefix}.priority must be between 0 and 1000`);
  if (asset.cooldownMs !== undefined && !isFiniteInRange(asset.cooldownMs, 0, 60000)) errors.push(`${prefix}.cooldownMs must be between 0 and 60000`);
  if (asset.maxInstances !== undefined && (!Number.isInteger(asset.maxInstances) || asset.maxInstances < 1 || asset.maxInstances > 64)) {
    errors.push(`${prefix}.maxInstances must be an integer between 1 and 64`);
  }
}

function validatePool(pool, index, errors) {
  const prefix = `pools[${index}]`;
  if (!isRecord(pool)) {
    errors.push(`${prefix} must be an object`);
    return;
  }
  if (typeof pool.id !== "string" || pool.id.length === 0) errors.push(`${prefix}.id must be a non-empty string`);
  if (!categorySet.has(pool.category)) errors.push(`${prefix}.category must be a supported audio category`);
  if (!Array.isArray(pool.assetIds) || pool.assetIds.length < 2 || pool.assetIds.some((id) => typeof id !== "string" || id.length === 0)) {
    errors.push(`${prefix}.assetIds must contain at least two asset ids`);
  } else if (new Set(pool.assetIds).size !== pool.assetIds.length) {
    errors.push(`${prefix}.assetIds must not repeat an asset id`);
  }
  if (pool.strategy !== undefined && !poolStrategySet.has(pool.strategy)) errors.push(`${prefix}.strategy is invalid`);
  if (pool.avoidImmediateRepeat !== undefined && typeof pool.avoidImmediateRepeat !== "boolean") {
    errors.push(`${prefix}.avoidImmediateRepeat must be boolean`);
  }
  if (pool.cooldownMs !== undefined && !isFiniteInRange(pool.cooldownMs, 0, 60000)) errors.push(`${prefix}.cooldownMs must be between 0 and 60000`);
  if (pool.priority !== undefined && !isFiniteInRange(pool.priority, 0, 1000)) errors.push(`${prefix}.priority must be between 0 and 1000`);
  if (pool.maxInstances !== undefined && (!Number.isInteger(pool.maxInstances) || pool.maxInstances < 1 || pool.maxInstances > 64)) {
    errors.push(`${prefix}.maxInstances must be an integer between 1 and 64`);
  }
}

function validateAlias(alias, index, errors) {
  const prefix = `aliases[${index}]`;
  if (!isRecord(alias)) {
    errors.push(`${prefix} must be an object`);
    return;
  }
  if (typeof alias.id !== "string" || alias.id.length === 0) errors.push(`${prefix}.id must be a non-empty string`);
  if (typeof alias.targetId !== "string" || alias.targetId.length === 0) errors.push(`${prefix}.targetId must be a non-empty string`);
  if (alias.loop !== undefined && typeof alias.loop !== "boolean") errors.push(`${prefix}.loop must be boolean`);
  if (alias.instanceKey !== undefined && (typeof alias.instanceKey !== "string" || alias.instanceKey.length === 0)) {
    errors.push(`${prefix}.instanceKey must be a non-empty string when present`);
  }
  if (alias.priority !== undefined && !isFiniteInRange(alias.priority, 0, 1000)) errors.push(`${prefix}.priority must be between 0 and 1000`);
  if (alias.cooldownMs !== undefined && !isFiniteInRange(alias.cooldownMs, 0, 60000)) errors.push(`${prefix}.cooldownMs must be between 0 and 60000`);
  if (alias.maxInstances !== undefined && (!Number.isInteger(alias.maxInstances) || alias.maxInstances < 1 || alias.maxInstances > 64)) {
    errors.push(`${prefix}.maxInstances must be an integer between 1 and 64`);
  }
}

function validateScene(scene, index, errors) {
  const prefix = `scenes[${index}]`;
  if (!isRecord(scene)) {
    errors.push(`${prefix} must be an object`);
    return;
  }
  if (typeof scene.id !== "string" || scene.id.length === 0) errors.push(`${prefix}.id must be a non-empty string`);
  if (scene.bgm !== undefined && scene.bgm !== null && (typeof scene.bgm !== "string" || scene.bgm.length === 0)) {
    errors.push(`${prefix}.bgm must be an asset or pool id`);
  }
  if (scene.ambience !== undefined && (!Array.isArray(scene.ambience) || scene.ambience.some((id) => typeof id !== "string" || id.length === 0))) {
    errors.push(`${prefix}.ambience must be an array of asset or pool ids`);
  }
  if (scene.preload !== undefined && (!Array.isArray(scene.preload) || scene.preload.some((id) => typeof id !== "string" || id.length === 0))) {
    errors.push(`${prefix}.preload must be an array of asset or pool ids`);
  }
  if (scene.crossfadeMs !== undefined && !isFiniteInRange(scene.crossfadeMs, 0, 30000)) errors.push(`${prefix}.crossfadeMs must be between 0 and 30000`);
}

function assertUniqueIds(records, kind, errors) {
  const seen = new Set();
  records.forEach((record, index) => {
    if (!isRecord(record) || typeof record.id !== "string" || record.id.length === 0) return;
    if (seen.has(record.id)) errors.push(`${kind}[${index}].id duplicates ${record.id}`);
    seen.add(record.id);
  });
}

export function validateAudioManifest(candidate) {
  const errors = [];
  if (!isRecord(candidate)) return ["manifest must be an object"];
  const assets = Array.isArray(candidate.assets) ? candidate.assets : [];
  const pools = Array.isArray(candidate.pools) ? candidate.pools : [];
  const aliases = Array.isArray(candidate.aliases) ? candidate.aliases : [];
  const scenes = Array.isArray(candidate.scenes) ? candidate.scenes : [];
  if (candidate.assets !== undefined && !Array.isArray(candidate.assets)) errors.push("assets must be an array");
  if (candidate.pools !== undefined && !Array.isArray(candidate.pools)) errors.push("pools must be an array");
  if (candidate.aliases !== undefined && !Array.isArray(candidate.aliases)) errors.push("aliases must be an array");
  if (candidate.scenes !== undefined && !Array.isArray(candidate.scenes)) errors.push("scenes must be an array");
  assets.forEach((asset, index) => validateAsset(asset, index, errors));
  pools.forEach((pool, index) => validatePool(pool, index, errors));
  aliases.forEach((alias, index) => validateAlias(alias, index, errors));
  scenes.forEach((scene, index) => validateScene(scene, index, errors));
  assertUniqueIds(assets, "assets", errors);
  assertUniqueIds(pools, "pools", errors);
  assertUniqueIds(aliases, "aliases", errors);
  assertUniqueIds(scenes, "scenes", errors);

  const assetById = new Map(assets.filter(isRecord).map((asset) => [asset.id, asset]));
  const poolById = new Map(pools.filter(isRecord).map((pool) => [pool.id, pool]));
  const aliasById = new Map(aliases.filter(isRecord).map((alias) => [alias.id, alias]));
  for (const cueId of poolById.keys()) {
    if (assetById.has(cueId)) errors.push(`cue id ${String(cueId)} is shared by an asset and a pool`);
  }
  for (const alias of aliases) {
    if (!isRecord(alias) || typeof alias.id !== "string") continue;
    if (assetById.has(alias.id) || poolById.has(alias.id)) errors.push(`cue id ${String(alias.id)} is shared by an alias and an asset or pool`);
    if (!assetById.has(alias.targetId) && !poolById.has(alias.targetId)) {
      errors.push(`alias ${String(alias.id)} references unknown asset or pool ${String(alias.targetId)}`);
    }
  }
  for (const pool of pools) {
    if (!isRecord(pool) || !Array.isArray(pool.assetIds)) continue;
    for (const assetId of pool.assetIds) {
      const asset = assetById.get(assetId);
      if (!asset) errors.push(`pool ${String(pool.id)} references unknown asset ${String(assetId)}`);
      else if (asset.category !== pool.category) errors.push(`pool ${String(pool.id)} mixes ${String(pool.category)} with ${String(asset.category)}`);
    }
  }
  const cueIds = new Set([...assetById.keys(), ...poolById.keys(), ...aliasById.keys()]);
  const cueFor = (cueId) => {
    const alias = aliasById.get(cueId);
    const targetId = alias?.targetId ?? cueId;
    return assetById.get(targetId) ?? poolById.get(targetId);
  };
  for (const scene of scenes) {
    if (!isRecord(scene)) continue;
    const references = [scene.bgm, ...(scene.ambience ?? []), ...(scene.preload ?? [])].filter(Boolean);
    for (const reference of references) {
      if (!cueIds.has(reference)) errors.push(`scene ${String(scene.id)} references unknown cue ${String(reference)}`);
    }
    if (scene.bgm) {
      const cue = cueFor(scene.bgm);
      if (cue && cue.category !== "bgm") errors.push(`scene ${String(scene.id)} bgm cue must use the bgm category`);
    }
    for (const ambienceId of scene.ambience ?? []) {
      const cue = cueFor(ambienceId);
      if (cue && cue.category !== "ambience") errors.push(`scene ${String(scene.id)} ambience cue must use the ambience category`);
    }
  }
  return errors;
}

function cloneSource(source) {
  return { src: source.src, ...(source.type ? { type: source.type } : {}) };
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

export function createAudioManifest(candidate = {}) {
  const errors = validateAudioManifest(candidate);
  if (errors.length > 0) throw new TypeError(`Invalid audio manifest:\n- ${errors.join("\n- ")}`);
  const assets = (candidate.assets ?? []).map((asset) => ({
    ...asset,
    sources: asset.sources.map(cloneSource),
    preload: asset.preload ?? "lazy",
    loop: asset.loop ?? (asset.category === "bgm" || asset.category === "ambience"),
    gain: asset.gain ?? 1,
    priority: asset.priority ?? 50,
    cooldownMs: asset.cooldownMs ?? 0,
    maxInstances: asset.maxInstances ?? (asset.category === "bgm" ? 1 : 4),
  }));
  const pools = (candidate.pools ?? []).map((pool) => ({
    ...pool,
    assetIds: [...pool.assetIds],
    strategy: pool.strategy ?? "shuffle",
    avoidImmediateRepeat: pool.avoidImmediateRepeat ?? true,
  }));
  const baseCueById = new Map([
    ...assets.map((asset) => [asset.id, asset]),
    ...pools.map((pool) => [pool.id, pool]),
  ]);
  const aliases = (candidate.aliases ?? []).map((alias) => ({
    id: alias.id,
    targetId: alias.targetId,
    category: baseCueById.get(alias.targetId)?.category,
    ...(alias.loop !== undefined ? { loop: alias.loop } : {}),
    ...(alias.instanceKey !== undefined ? { instanceKey: alias.instanceKey } : {}),
    ...(alias.priority !== undefined ? { priority: alias.priority } : {}),
    ...(alias.cooldownMs !== undefined ? { cooldownMs: alias.cooldownMs } : {}),
    ...(alias.maxInstances !== undefined ? { maxInstances: alias.maxInstances } : {}),
  }));
  const scenes = (candidate.scenes ?? []).map((scene) => ({
    ...scene,
    ambience: [...(scene.ambience ?? [])],
    preload: [...(scene.preload ?? [])],
    crossfadeMs: scene.crossfadeMs ?? 800,
  }));
  return deepFreeze({
    version: Number.isInteger(candidate.version) && candidate.version > 0 ? candidate.version : 1,
    assets,
    pools,
    aliases,
    scenes,
    assetById: Object.fromEntries(assets.map((asset) => [asset.id, asset])),
    poolById: Object.fromEntries(pools.map((pool) => [pool.id, pool])),
    aliasById: Object.fromEntries(aliases.map((alias) => [alias.id, alias])),
    sceneById: Object.fromEntries(scenes.map((scene) => [scene.id, scene])),
  });
}

// The production paths are intentionally supplied by the licensed-asset layer.
// Keeping the foundation empty prevents placeholder or unverified URLs becoming truth.
export const EMPTY_AUDIO_MANIFEST = createAudioManifest();
