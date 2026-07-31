// Version 0.9.6 PWA asset store.
//
// The page performs the downloads so it can show progress and honour pause,
// resume, retry, and cancel; the service worker only serves what the page has
// already verified. Both sides address the same Cache Storage bucket, so these
// constants and the key derivation MUST stay identical to public/sw.js.
// `tests/pwa-service-worker-contract.test.mjs` fails if they drift apart.

export const ASSET_CACHE_NAME = "zombieee-assets-v1";
export const META_CACHE_NAME = "zombieee-meta-v1";
export const SHELL_CACHE_PREFIX = "zombieee-shell-";
export const ASSET_KEY_PREFIX = "__pwa-asset__";

/** Content-addressed cache key for an asset hash, resolved against the scope. */
export function assetCacheKey(hash, scope) {
  return new URL(`${ASSET_KEY_PREFIX}/${hash}`, scope).toString();
}

/**
 * Resolves a manifest path such as `/art/x.webp` against the app's base URL.
 *
 * Manifest paths are stored root-absolute, but the app is served from `/`
 * locally and from `/Zombieee/` on GitHub Pages. Resolving against the scope
 * keeps one manifest correct in both places without any build-time rewriting.
 */
export function resolveAssetUrl(assetPath, scope) {
  return new URL(String(assetPath).replace(/^\/+/, ""), scope).toString();
}

function bodyLength(payload) {
  if (!payload) return 0;
  if (payload instanceof Uint8Array || payload instanceof ArrayBuffer) return payload.byteLength;
  return Number(payload.byteLength ?? 0);
}

/**
 * Creates a Cache Storage backed store for verified assets.
 *
 * @param {object} options
 * @param {CacheStorage} options.caches
 * @param {string} options.scope base URL the app is served from
 */
export function createAssetStore({ caches: cacheStorage, scope }) {
  const openAssets = () => cacheStorage.open(ASSET_CACHE_NAME);

  return {
    scope,

    async has(asset) {
      const cache = await openAssets();
      return Boolean(await cache.match(assetCacheKey(asset.hash, scope)));
    },

    /**
     * Stores verified bytes under their content hash. The caller has already
     * checked size and digest, so nothing unverified reaches the cache.
     */
    async put(asset, body) {
      const cache = await openAssets();
      const buffer = body instanceof Uint8Array ? body.slice().buffer : body;
      await cache.put(assetCacheKey(asset.hash, scope), new Response(buffer, {
        headers: {
          "content-type": contentTypeFor(asset.path),
          "content-length": String(bodyLength(body)),
          "x-pwa-asset-hash": asset.hash,
        },
      }));
    },

    /** Every content hash currently on the device. */
    async storedHashes() {
      const cache = await openAssets();
      const hashes = new Set();
      for (const request of await cache.keys()) {
        const hash = new URL(request.url).pathname.split("/").pop();
        if (hash?.startsWith("sha256-")) hashes.add(hash);
      }
      return hashes;
    },

    /**
     * Maps manifest paths to the hash actually stored for them, which is what
     * the install planner needs to tell missing from mismatched.
     */
    async storedHashesByPath(manifest) {
      const present = await this.storedHashes();
      const byPath = new Map();
      for (const asset of manifest?.assets ?? []) {
        if (present.has(asset.hash)) byPath.set(asset.path, asset.hash);
      }
      return byPath;
    },

    async usageBytes() {
      const cache = await openAssets();
      let bytes = 0;
      for (const request of await cache.keys()) {
        const response = await cache.match(request);
        const length = Number(response?.headers.get("content-length") ?? 0);
        if (Number.isFinite(length)) bytes += length;
      }
      return bytes;
    },

    /** Removes asset bytes only. Save data lives in storage this never touches. */
    async clearAssets() {
      await cacheStorage.delete(ASSET_CACHE_NAME);
    },
  };
}

const CONTENT_TYPES = Object.freeze({
  ".webp": "image/webp",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ogg": "audio/ogg",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".json": "application/json",
});

export function contentTypeFor(assetPath) {
  const match = /\.[a-z0-9]+$/i.exec(String(assetPath));
  return CONTENT_TYPES[match?.[0]?.toLowerCase()] ?? "application/octet-stream";
}

/**
 * Estimates free space so the download prompt can warn before a large install.
 * Returns null when the browser does not expose an estimate; the UI then omits
 * the free-space line rather than inventing a number.
 */
export async function estimateStorage(navigatorRef) {
  try {
    const estimate = await navigatorRef?.storage?.estimate?.();
    if (!estimate) return null;
    const quota = Number(estimate.quota ?? 0);
    const usage = Number(estimate.usage ?? 0);
    if (!Number.isFinite(quota) || quota <= 0) return null;
    return { quota, usage, available: Math.max(0, quota - usage) };
  } catch {
    return null;
  }
}

/**
 * Detects OS-driven cache eviction: the manifest is installed, yet bytes the
 * device is supposed to hold have disappeared. Only the missing entries are
 * re-fetched, never the whole pack.
 */
export function detectEviction({ manifest, storedHashes }) {
  const present = storedHashes instanceof Set ? storedHashes : new Set();
  const missing = (manifest?.assets ?? []).filter((asset) => !present.has(asset.hash));
  return {
    evicted: missing.length > 0,
    missingCount: missing.length,
    missingBytes: missing.reduce((sum, asset) => sum + asset.bytes, 0),
    missingPaths: missing.map((asset) => asset.path),
  };
}
