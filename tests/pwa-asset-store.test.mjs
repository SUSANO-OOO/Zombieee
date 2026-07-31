import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ASSET_CACHE_NAME,
  ASSET_KEY_PREFIX,
  META_CACHE_NAME,
  SHELL_CACHE_PREFIX,
  assetCacheKey,
  contentTypeFor,
  createAssetStore,
  detectEviction,
  estimateStorage,
  resolveAssetUrl,
} from "../app/pwaAssetStore.js";

const serviceWorkerSource = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");

const hashOf = (seed) => `sha256-${String(seed).repeat(64).slice(0, 64)}`;
const asset = (path, seed, bytes = 4) => ({
  path, bytes, hash: hashOf(seed), pack: "units", category: "unit", criticality: "critical",
});

// --- Minimal Cache Storage double ----------------------------------------

function createCacheStorage() {
  const buckets = new Map();
  const bucket = (name) => {
    if (!buckets.has(name)) buckets.set(name, new Map());
    return buckets.get(name);
  };
  return {
    buckets,
    async open(name) {
      const entries = bucket(name);
      // The real Cache API accepts either a URL string or a Request.
      const keyOf = (key) => String(key?.url ?? key);
      return {
        async match(key) {
          const stored = entries.get(keyOf(key));
          return stored ? stored.clone() : undefined;
        },
        async put(key, response) { entries.set(keyOf(key), response); },
        async keys() { return [...entries.keys()].map((url) => ({ url })); },
        async delete(key) { return entries.delete(keyOf(key)); },
      };
    },
    async delete(name) { return buckets.delete(name); },
    async keys() { return [...buckets.keys()]; },
  };
}

const SCOPE = "https://example.test/Zombieee/";

// --- Contract with the service worker ------------------------------------

test("the service worker and the page agree on every cache name", () => {
  // The page writes what the worker reads. A silent rename here would mean the
  // worker serving from an empty bucket while the download reports success.
  assert.ok(
    serviceWorkerSource.includes(`const ASSET_CACHE = "${ASSET_CACHE_NAME}"`),
    "sw.js asset cache name drifted from pwaAssetStore.js",
  );
  assert.ok(
    serviceWorkerSource.includes(`const META_CACHE = "${META_CACHE_NAME}"`),
    "sw.js meta cache name drifted from pwaAssetStore.js",
  );
  assert.ok(
    serviceWorkerSource.includes(`const SHELL_PREFIX = "${SHELL_CACHE_PREFIX}"`),
    "sw.js shell cache prefix drifted from pwaAssetStore.js",
  );
  assert.ok(
    serviceWorkerSource.includes(`const ASSET_KEY_PREFIX = "${ASSET_KEY_PREFIX}"`),
    "sw.js asset key prefix drifted from pwaAssetStore.js",
  );
});

test("the service worker never calls skipWaiting outside an explicit message", () => {
  // Count call sites, not prose: the header comment discusses skipWaiting.
  const callSites = [...serviceWorkerSource.matchAll(/skipWaiting\s*\(/g)];
  assert.equal(callSites.length, 1, "skipWaiting must be called from exactly one place");

  const activateCaseAt = serviceWorkerSource.indexOf('case "pwa:activate-now"');
  assert.ok(activateCaseAt > 0, "the activate-now message handler must exist");
  assert.ok(
    serviceWorkerSource.indexOf("skipWaiting(") > activateCaseAt,
    "the only skipWaiting call must sit inside the explicit activate-now message",
  );

  // The install and activate handlers must not reach for it.
  const installHandler = serviceWorkerSource.slice(
    serviceWorkerSource.indexOf('addEventListener("install"'),
    serviceWorkerSource.indexOf('addEventListener("fetch"'),
  );
  assert.doesNotMatch(installHandler, /skipWaiting\s*\(/, "install and activate must not skip waiting");
});

test("the service worker restricts itself to its own scope", () => {
  assert.match(serviceWorkerSource, /url\.origin !== scopeUrl\.origin/);
  assert.match(serviceWorkerSource, /url\.pathname\.startsWith\(scopeUrl\.pathname\)/);
});

test("the service worker refuses to cache HTML as an asset", () => {
  assert.match(serviceWorkerSource, /isHtmlResponse/);
  assert.match(serviceWorkerSource, /if \(isHtmlResponse\(response\)\) return false;/);
});

test("the service worker retains a rollback generation when collecting caches", () => {
  assert.match(serviceWorkerSource, /\[state\.active, state\.previous\]\.filter\(Boolean\)/);
});

// --- Key derivation -------------------------------------------------------

test("asset keys are content-addressed and scope-relative", () => {
  assert.equal(
    assetCacheKey(hashOf(1), SCOPE),
    `https://example.test/Zombieee/${ASSET_KEY_PREFIX}/${hashOf(1)}`,
  );
});

test("manifest paths resolve against the base path the app is served from", () => {
  assert.equal(resolveAssetUrl("/art/x.webp", SCOPE), "https://example.test/Zombieee/art/x.webp");
  assert.equal(resolveAssetUrl("/art/x.webp", "https://example.test/"), "https://example.test/art/x.webp");
  // A root-absolute manifest path must not escape the base path.
  assert.equal(resolveAssetUrl("//other.test/x.webp", SCOPE), "https://example.test/Zombieee/other.test/x.webp");
});

test("content types cover every shipped asset extension", () => {
  assert.equal(contentTypeFor("/a.webp"), "image/webp");
  assert.equal(contentTypeFor("/a.png"), "image/png");
  assert.equal(contentTypeFor("/a.svg"), "image/svg+xml");
  assert.equal(contentTypeFor("/a.ogg"), "audio/ogg");
  assert.equal(contentTypeFor("/a.mp3"), "audio/mpeg");
  assert.equal(contentTypeFor("/a.wav"), "audio/wav");
  assert.equal(contentTypeFor("/a.unknown"), "application/octet-stream");
});

// --- Store behaviour ------------------------------------------------------

test("stored assets are addressed by hash, so one copy backs every path", async () => {
  const cacheStorage = createCacheStorage();
  const store = createAssetStore({ caches: cacheStorage, scope: SCOPE });

  const first = asset("/a.webp", 7);
  const second = asset("/b.webp", 7);

  assert.equal(await store.has(first), false);
  await store.put(first, new Uint8Array([1, 2, 3, 4]));
  assert.equal(await store.has(first), true);
  assert.equal(await store.has(second), true, "a shared hash is already satisfied");

  assert.equal(cacheStorage.buckets.get(ASSET_CACHE_NAME).size, 1);
});

test("stored hashes map back onto the manifest paths they satisfy", async () => {
  const store = createAssetStore({ caches: createCacheStorage(), scope: SCOPE });
  const manifest = { assets: [asset("/a.webp", 1), asset("/b.webp", 2), asset("/c.webp", 3)] };

  await store.put(manifest.assets[0], new Uint8Array([1, 2, 3, 4]));
  await store.put(manifest.assets[2], new Uint8Array([9, 9, 9, 9]));

  const byPath = await store.storedHashesByPath(manifest);
  assert.deepEqual([...byPath.keys()].sort(), ["/a.webp", "/c.webp"]);
  assert.equal(byPath.get("/a.webp"), hashOf(1));
});

test("usage accounting reports the bytes actually held", async () => {
  const store = createAssetStore({ caches: createCacheStorage(), scope: SCOPE });
  await store.put(asset("/a.webp", 1, 4), new Uint8Array([1, 2, 3, 4]));
  await store.put(asset("/b.webp", 2, 2), new Uint8Array([1, 2]));
  assert.equal(await store.usageBytes(), 6);
});

test("clearing assets empties the asset cache and nothing else", async () => {
  const cacheStorage = createCacheStorage();
  const store = createAssetStore({ caches: cacheStorage, scope: SCOPE });
  await store.put(asset("/a.webp", 1), new Uint8Array([1, 2, 3, 4]));

  // Stand in for save data, which lives outside the asset cache entirely.
  const saves = await cacheStorage.open("zombieee-saves-should-survive");
  await saves.put("save-1", new Response("{}"));

  await store.clearAssets();

  assert.equal(cacheStorage.buckets.has(ASSET_CACHE_NAME), false);
  assert.equal(cacheStorage.buckets.get("zombieee-saves-should-survive").size, 1);
});

// --- Eviction -------------------------------------------------------------

test("OS cache eviction is detected and only the missing bytes are re-fetched", () => {
  const manifest = { assets: [asset("/a.webp", 1), asset("/b.webp", 2), asset("/c.webp", 3)] };

  const intact = detectEviction({ manifest, storedHashes: new Set([hashOf(1), hashOf(2), hashOf(3)]) });
  assert.equal(intact.evicted, false);
  assert.equal(intact.missingCount, 0);

  const evicted = detectEviction({ manifest, storedHashes: new Set([hashOf(1)]) });
  assert.equal(evicted.evicted, true);
  assert.equal(evicted.missingCount, 2);
  assert.equal(evicted.missingBytes, 8);
  assert.deepEqual(evicted.missingPaths, ["/b.webp", "/c.webp"]);
});

test("a storage estimate is reported when available and omitted when not", async () => {
  assert.deepEqual(
    await estimateStorage({ storage: { estimate: async () => ({ quota: 1000, usage: 400 }) } }),
    { quota: 1000, usage: 400, available: 600 },
  );
  assert.equal(await estimateStorage({}), null);
  assert.equal(await estimateStorage({ storage: { estimate: async () => ({ quota: 0 }) } }), null);
  assert.equal(
    await estimateStorage({ storage: { estimate: async () => { throw new Error("denied"); } } }),
    null,
  );
});
