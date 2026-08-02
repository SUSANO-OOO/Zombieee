// Facts shared by the install gate and its commit finalizer.
//
// A Cache Storage pack is deliberately not considered installed on its own:
// the service worker's active manifest is the pointer that makes the verified
// bytes a durable generation. Keeping the comparison here makes that boundary
// explicit and independently testable.

function assetsOf(manifest) {
  return Array.isArray(manifest?.assets) ? manifest.assets : [];
}

function assetKey(asset) {
  return `${asset?.path ?? ""}\u0000${asset?.hash ?? ""}\u0000${Number(asset?.bytes) || 0}`;
}

/** True only when two complete generations name the exact same public bytes. */
export function manifestsEqual(left, right) {
  if (!left || !right) return false;
  if (left.version !== right.version || left.releaseSha !== right.releaseSha) return false;
  const leftAssets = assetsOf(left);
  const rightAssets = assetsOf(right);
  if (leftAssets.length === 0 || leftAssets.length !== rightAssets.length) return false;
  const rightKeys = new Set(rightAssets.map(assetKey));
  return leftAssets.every((asset) => rightKeys.has(assetKey(asset)));
}

/** Every manifest asset must already have its verified content hash in Cache Storage. */
export function manifestCacheComplete(manifest, storedHashes) {
  const assets = assetsOf(manifest);
  if (assets.length === 0 || !(storedHashes instanceof Set)) return false;
  return assets.every((asset) => typeof asset?.hash === "string" && storedHashes.has(asset.hash));
}

/**
 * Detects the narrow recovery state caused by a failed manifest commit: the
 * complete published pack is present, but the worker still points at no
 * generation or a different one. It intentionally does not infer anything
 * while the published manifest is unavailable, so an offline rollback can use
 * the previously committed active generation normally.
 */
export function assessCommitRecovery({ activeManifest, publishedManifest, storedHashes } = {}) {
  if (!publishedManifest || !manifestCacheComplete(publishedManifest, storedHashes)) {
    return { required: false, reason: "cache-incomplete", manifest: null };
  }
  if (manifestsEqual(activeManifest, publishedManifest)) {
    return { required: false, reason: "active-current", manifest: null };
  }
  return {
    required: true,
    reason: activeManifest ? "active-mismatch" : "active-missing",
    manifest: publishedManifest,
  };
}
