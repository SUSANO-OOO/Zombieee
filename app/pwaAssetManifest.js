// Version 0.9.6 PWA asset manifest.
//
// The manifest is the single contract between the build, the service worker,
// and the in-game download UI. It is derived from the game's own sprite,
// visual, stage-object, and audio manifests, so QA-only, development, and
// unused gallery files never enter the distribution pack.
//
// Every entry carries release version, release SHA, path, byte size, content
// hash, pack, criticality, and category, as required by Issue #114 section 5.

export const ASSET_MANIFEST_SCHEMA = "zombieee-asset-manifest/1";

/** Placeholder replaced with the immutable release SHA by the Pages build. */
export const RELEASE_SHA_PLACEHOLDER = "__ZOMBIEEE_RELEASE_SHA__";

export const ASSET_PACKS = Object.freeze([
  Object.freeze({ id: "app-shell", label: "ゲーム本体", order: 0 }),
  Object.freeze({ id: "campaign-core", label: "ステージ・背景", order: 1 }),
  Object.freeze({ id: "units", label: "ユニット・敵・ボス", order: 2 }),
  Object.freeze({ id: "audio", label: "音声", order: 3 }),
]);

export const ASSET_PACK_IDS = Object.freeze(ASSET_PACKS.map((pack) => pack.id));

/** Player-facing categories used by the download progress UI. */
export const ASSET_CATEGORIES = Object.freeze([
  "app",
  "background",
  "object",
  "unit",
  "enemy",
  "boss",
  "portrait",
  "audio",
]);

export const ASSET_CATEGORY_LABELS = Object.freeze({
  app: "本体",
  background: "背景",
  object: "ステージ構造物",
  unit: "ユニット",
  enemy: "敵",
  boss: "ボス",
  portrait: "立ち絵",
  audio: "音声",
});

/** Audio is additionally split so BGM, SE, and voice can be reported apart. */
export const AUDIO_CHANNELS = Object.freeze(["bgm", "se", "voice"]);

export const AUDIO_CHANNEL_LABELS = Object.freeze({
  bgm: "BGM",
  se: "SE",
  voice: "ボイス",
});

const AUDIO_CHANNEL_BY_MANIFEST_CATEGORY = Object.freeze({
  bgm: "bgm",
  ambience: "se",
  ui: "se",
  weapons: "se",
  melee: "se",
  support: "se",
  humanVoices: "voice",
  monsters: "voice",
});

/** Maps an `audioManifest.js` category onto the player-facing audio channel. */
export function audioChannelFor(manifestCategory) {
  return AUDIO_CHANNEL_BY_MANIFEST_CATEGORY[manifestCategory] ?? "se";
}

const packIdSet = new Set(ASSET_PACK_IDS);
const categorySet = new Set(ASSET_CATEGORIES);
const channelSet = new Set(AUDIO_CHANNELS);

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Distribution paths are repository-local absolute paths. Rejecting protocol,
 * traversal, and query forms here keeps the service worker from ever writing a
 * cross-origin or ambiguous cache entry.
 */
export function isDistributionPath(value) {
  return typeof value === "string"
    && value.startsWith("/")
    && !value.startsWith("//")
    && !value.includes("\\")
    && !value.includes("..")
    && !/[?#]/.test(value);
}

export function isContentHash(value) {
  return typeof value === "string" && /^sha256-[0-9a-f]{64}$/.test(value);
}

function validateAsset(asset, index, errors) {
  const prefix = `assets[${index}]`;
  if (!isRecord(asset)) {
    errors.push(`${prefix} must be an object`);
    return;
  }
  if (!isDistributionPath(asset.path)) errors.push(`${prefix}.path must be a repository-local absolute path`);
  if (!Number.isInteger(asset.bytes) || asset.bytes <= 0) errors.push(`${prefix}.bytes must be a positive integer`);
  if (!isContentHash(asset.hash)) errors.push(`${prefix}.hash must be a sha256-<hex> content hash`);
  if (!packIdSet.has(asset.pack)) errors.push(`${prefix}.pack must be a known pack id`);
  if (!categorySet.has(asset.category)) errors.push(`${prefix}.category must be a known category`);
  if (asset.criticality !== "critical" && asset.criticality !== "optional") {
    errors.push(`${prefix}.criticality must be "critical" or "optional"`);
  }
  if (asset.category === "audio") {
    if (!channelSet.has(asset.audioChannel)) errors.push(`${prefix}.audioChannel must be bgm, se, or voice`);
  } else if (asset.audioChannel !== undefined) {
    errors.push(`${prefix}.audioChannel is only valid on audio assets`);
  }
}

/**
 * Validates a manifest without throwing, so both the build and the running app
 * can reject a malformed or truncated manifest before acting on it.
 */
export function validateAssetManifest(candidate) {
  const errors = [];
  if (!isRecord(candidate)) return { valid: false, errors: ["manifest must be an object"] };
  if (candidate.schema !== ASSET_MANIFEST_SCHEMA) errors.push(`schema must be "${ASSET_MANIFEST_SCHEMA}"`);
  if (typeof candidate.version !== "string" || candidate.version.length === 0) {
    errors.push("version must be a non-empty string");
  }
  if (typeof candidate.releaseSha !== "string" || candidate.releaseSha.length === 0) {
    errors.push("releaseSha must be a non-empty string");
  }
  if (!Array.isArray(candidate.assets) || candidate.assets.length === 0) {
    errors.push("assets must be a non-empty array");
    return { valid: false, errors };
  }
  candidate.assets.forEach((asset, index) => validateAsset(asset, index, errors));

  const seenPaths = new Set();
  for (const asset of candidate.assets) {
    if (!isRecord(asset) || typeof asset.path !== "string") continue;
    if (seenPaths.has(asset.path)) errors.push(`duplicate asset path: ${asset.path}`);
    seenPaths.add(asset.path);
  }

  // A single content hash may legitimately back several paths, but the two
  // records must agree on size or the store cannot deduplicate them safely.
  const bytesByHash = new Map();
  for (const asset of candidate.assets) {
    if (!isRecord(asset) || !isContentHash(asset.hash)) continue;
    const known = bytesByHash.get(asset.hash);
    if (known === undefined) bytesByHash.set(asset.hash, asset.bytes);
    else if (known !== asset.bytes) errors.push(`hash ${asset.hash} maps to conflicting byte sizes`);
  }

  return { valid: errors.length === 0, errors };
}

export function assertAssetManifest(candidate) {
  const { valid, errors } = validateAssetManifest(candidate);
  if (!valid) throw new Error(`Invalid asset manifest: ${errors.join("; ")}`);
  return candidate;
}

/** Stable ordering so a regenerated manifest is byte-identical to a committed one. */
export function sortManifestAssets(assets) {
  return [...assets].sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
}

export function totalBytes(assets) {
  return assets.reduce((sum, asset) => sum + asset.bytes, 0);
}

/**
 * Bytes that must actually travel the network, counting each distinct content
 * hash once. Two paths sharing one hash are downloaded a single time.
 */
export function distinctDownloadBytes(assets) {
  const seen = new Set();
  let bytes = 0;
  for (const asset of assets) {
    if (seen.has(asset.hash)) continue;
    seen.add(asset.hash);
    bytes += asset.bytes;
  }
  return bytes;
}

export function summarizeByCategory(assets) {
  const summary = {};
  for (const asset of assets) {
    const key = asset.category;
    summary[key] ??= { count: 0, bytes: 0 };
    summary[key].count += 1;
    summary[key].bytes += asset.bytes;
  }
  return summary;
}

export function summarizeByAudioChannel(assets) {
  const summary = {};
  for (const asset of assets) {
    if (asset.category !== "audio") continue;
    const key = asset.audioChannel;
    summary[key] ??= { count: 0, bytes: 0 };
    summary[key].count += 1;
    summary[key].bytes += asset.bytes;
  }
  return summary;
}

export function summarizeByPack(assets) {
  const summary = {};
  for (const asset of assets) {
    const key = asset.pack;
    summary[key] ??= { count: 0, bytes: 0 };
    summary[key].count += 1;
    summary[key].bytes += asset.bytes;
  }
  return summary;
}

/**
 * Differential update plan between the installed manifest and a newly published
 * one. Only added and changed paths are downloadable; unchanged paths are never
 * re-fetched, which is the core requirement of Issue #114 section 6.
 *
 * `retainedHashes` lets an already-stored content hash satisfy a new path
 * without any network work, so a renamed-but-identical asset costs zero bytes.
 */
export function diffAssetManifests(currentManifest, nextManifest, { retainedHashes } = {}) {
  const currentAssets = Array.isArray(currentManifest?.assets) ? currentManifest.assets : [];
  const nextAssets = Array.isArray(nextManifest?.assets) ? nextManifest.assets : [];

  const currentByPath = new Map(currentAssets.map((asset) => [asset.path, asset]));
  const nextByPath = new Map(nextAssets.map((asset) => [asset.path, asset]));

  const available = retainedHashes instanceof Set
    ? new Set(retainedHashes)
    : new Set(currentAssets.map((asset) => asset.hash));

  const added = [];
  const changed = [];
  const unchanged = [];
  const reused = [];

  for (const asset of sortManifestAssets(nextAssets)) {
    const previous = currentByPath.get(asset.path);
    if (previous && previous.hash === asset.hash) {
      unchanged.push(asset);
      continue;
    }
    // The bytes are already on the device under another path or an older
    // manifest entry, so this path only needs a local alias, not a download.
    if (available.has(asset.hash)) {
      reused.push(asset);
      continue;
    }
    if (previous) changed.push(asset);
    else added.push(asset);
  }

  const removed = sortManifestAssets(currentAssets.filter((asset) => !nextByPath.has(asset.path)));
  const downloadable = sortManifestAssets([...added, ...changed]);

  return {
    added: sortManifestAssets(added),
    changed: sortManifestAssets(changed),
    unchanged: sortManifestAssets(unchanged),
    reused: sortManifestAssets(reused),
    removed,
    downloadable,
    downloadCount: downloadable.length,
    downloadBytes: distinctDownloadBytes(downloadable),
    byCategory: summarizeByCategory(downloadable),
  };
}

/**
 * Work required to make a device consistent with one manifest, given what the
 * store currently holds. Used for both first install (empty store) and repair
 * of missing, failed, or hash-mismatched assets.
 */
export function planInstall(manifest, { storedHashesByPath, corruptPaths } = {}) {
  const assets = sortManifestAssets(Array.isArray(manifest?.assets) ? manifest.assets : []);
  const stored = storedHashesByPath instanceof Map ? storedHashesByPath : new Map();
  const corrupt = corruptPaths instanceof Set ? corruptPaths : new Set();

  const satisfied = [];
  const missing = [];
  const mismatched = [];

  for (const asset of assets) {
    if (corrupt.has(asset.path)) {
      mismatched.push(asset);
      continue;
    }
    const storedHash = stored.get(asset.path);
    if (storedHash === undefined) missing.push(asset);
    else if (storedHash !== asset.hash) mismatched.push(asset);
    else satisfied.push(asset);
  }

  const pending = sortManifestAssets([...missing, ...mismatched]);
  return {
    satisfied,
    missing,
    mismatched,
    pending,
    complete: pending.length === 0,
    pendingCount: pending.length,
    pendingBytes: distinctDownloadBytes(pending),
    totalCount: assets.length,
    totalBytes: totalBytes(assets),
    byCategory: summarizeByCategory(pending),
  };
}

/** Human-readable size used across the download, update, and storage screens. */
export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0MB";
  const mb = bytes / 1048576;
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)}GB`;
  if (mb >= 100) return `${Math.round(mb)}MB`;
  if (mb >= 1) return `${mb.toFixed(1)}MB`;
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}
