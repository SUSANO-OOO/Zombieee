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

test("the service worker holds no root-absolute path the Pages build would rewrite", () => {
  // scripts/build-github-pages.mjs rewrites every `/foo` reference to
  // `/Zombieee/foo` inside shipped .js files, and sw.js is one of them. A
  // root-absolute literal here would be edited at publish time without anyone
  // noticing, so every path must be derived from the registration scope.
  // A bare "/" is a path separator for split and join, never a rewrite target:
  // the build only substitutes `/name` and `/name/` references.
  const literals = [...serviceWorkerSource.matchAll(/"(\/[^"\s]*)"/g)]
    .map((match) => match[1])
    .filter((literal) => literal !== "/");
  assert.deepEqual(
    literals,
    [],
    `sw.js must not contain root-absolute string literals: ${literals.join(", ")}`,
  );
  assert.match(serviceWorkerSource, /new URL\("asset-manifest\.json", scopeUrl\)\.pathname/);
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

test("the service worker verifies the digest, not just the size, before storing", () => {
  // The asset cache is content-addressed and served cache-first forever, so a
  // same-length corrupted body accepted here would be pinned under a hash it
  // does not match, with no repair path on the device.
  const storeAsset = serviceWorkerSource.slice(
    serviceWorkerSource.indexOf("async function storeAsset"),
    serviceWorkerSource.indexOf("async function respondForAsset"),
  );
  assert.match(storeAsset, /byteLength !== asset\.bytes/, "size must still be checked");
  assert.match(storeAsset, /await sha256\(buffer\) !== asset\.hash/, "the digest must be checked");
  assert.ok(
    storeAsset.indexOf("sha256(buffer)") < storeAsset.indexOf("cache.put"),
    "the digest must be verified before anything is written",
  );
});

test("committing a manifest warms the shell so a first install can boot offline", () => {
  // Without this the shell cache is only ever filled by a navigation that
  // happens after a commit. On a first install the only navigation happens
  // before it, so a fully downloaded app taken offline would fail to start.
  assert.match(serviceWorkerSource, /async function warmShell\(generation\)/);
  const commitCase = serviceWorkerSource.slice(
    serviceWorkerSource.indexOf('case "pwa:commit-manifest"'),
    serviceWorkerSource.indexOf('case "pwa:rollback"'),
  );
  assert.match(commitCase, /await warmShell\(/, "commit must warm the shell");
  // Warming reaches the network. The page is told its install succeeded first,
  // so a slow prefetch cannot time out the commit reply it is waiting on.
  assert.ok(
    commitCase.indexOf("reply(event") < commitCase.indexOf("warmShell("),
    "the commit must be acknowledged before the shell is warmed",
  );
});

test("the reported state carries the installed asset list, not a summary", () => {
  // The page plans repairs and diffs updates from the installed manifest.
  // Summarising it to version and SHA would make every update look like a full
  // reinstall, and would break the install plan outright.
  const getState = serviceWorkerSource.slice(
    serviceWorkerSource.indexOf('case "pwa:get-state"'),
    serviceWorkerSource.indexOf('case "pwa:commit-manifest"'),
  );
  assert.match(getState, /active: state\.active \?\? null/);
  assert.match(getState, /previous: state\.previous \?\? null/);
  assert.doesNotMatch(
    getState,
    /active: state\.active \? \{ version/,
    "the installed manifest must not be reduced to version and releaseSha",
  );
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
