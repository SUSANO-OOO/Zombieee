// Version 0.9.6 PWA service worker.
//
// Design notes for Issue #114 section 7:
//
// - Scope is whatever the registration says, so the same file works at `/`
//   during local development and at `/Zombieee/` on GitHub Pages. Nothing here
//   hard-codes an absolute site path.
// - Game assets live in ONE content-addressed cache keyed by their sha256.
//   Two releases that share an asset therefore share the stored bytes: an
//   unchanged asset is never re-downloaded, and publishing a new release never
//   overwrites the bytes an older release still needs. That is what makes a
//   rollback generation possible at all.
// - The app shell is cached per release generation, so a cached index.html is
//   only ever paired with the JS of the same generation.
// - skipWaiting is never called unconditionally. The page asks for it, and only
//   from a screen where interrupting the player is safe.
// - Old caches are deleted only after a new generation has been verified and
//   committed, and the immediately previous generation is always retained.

const META_CACHE = "zombieee-meta-v1";
const ASSET_CACHE = "zombieee-assets-v1";
const SHELL_PREFIX = "zombieee-shell-";

/** Synthetic, content-addressed key space for game assets. */
const ASSET_KEY_PREFIX = "__pwa-asset__";

const scopeUrl = new URL(self.registration.scope);

/** Resolves a manifest path such as `/art/x.webp` against the registration scope. */
function resolveScoped(assetPath) {
  return new URL(String(assetPath).replace(/^\/+/, ""), scopeUrl).toString();
}

function assetCacheKey(hash) {
  return new URL(`${ASSET_KEY_PREFIX}/${hash}`, scopeUrl).toString();
}

// Derived from the scope rather than written as root-absolute literals. The
// GitHub Pages build rewrites root-absolute references to sit under the base
// path inside every shipped .js file, including this one, so spelling these
// paths out with a leading slash would let the publish step silently edit them.
// Deriving from the scope stays correct at any base path.
const MANIFEST_PATH = new URL("asset-manifest.json", scopeUrl).pathname;
const RELEASE_PATH = new URL("release.json", scopeUrl).pathname;

function shellCacheName(generation) {
  return `${SHELL_PREFIX}${generation}`;
}

function generationOf(manifest) {
  return `${manifest?.version ?? "unknown"}-${manifest?.releaseSha ?? "unknown"}`;
}

// --- Metadata -------------------------------------------------------------
//
// State lives in the metadata cache rather than in a module variable so it
// survives the worker being terminated between events.

const STATE_KEY = new URL(`${ASSET_KEY_PREFIX}/state.json`, scopeUrl).toString();

const DEFAULT_STATE = Object.freeze({
  active: null,
  previous: null,
  pending: null,
});

async function readState() {
  const cache = await caches.open(META_CACHE);
  const stored = await cache.match(STATE_KEY);
  if (!stored) return { ...DEFAULT_STATE };
  try {
    return { ...DEFAULT_STATE, ...(await stored.json()) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

async function writeState(state) {
  const cache = await caches.open(META_CACHE);
  await cache.put(STATE_KEY, new Response(JSON.stringify(state), {
    headers: { "content-type": "application/json" },
  }));
  return state;
}

/** In-worker memo so the hot fetch path does not re-parse the manifest. */
let activeManifestMemo = null;

async function activeManifest() {
  if (activeManifestMemo) return activeManifestMemo;
  const state = await readState();
  activeManifestMemo = state.active ?? null;
  return activeManifestMemo;
}

function invalidateManifestMemo() {
  activeManifestMemo = null;
}

/** path -> hash lookup for the active release. */
let assetIndexMemo = null;
let assetIndexGeneration = null;

async function assetIndex() {
  const manifest = await activeManifest();
  if (!manifest) return null;
  const generation = generationOf(manifest);
  if (assetIndexMemo && assetIndexGeneration === generation) return assetIndexMemo;
  const index = new Map();
  for (const asset of manifest.assets ?? []) index.set(resolveScoped(asset.path), asset);
  assetIndexMemo = index;
  assetIndexGeneration = generation;
  return index;
}

// --- Lifecycle ------------------------------------------------------------

self.addEventListener("install", () => {
  // No skipWaiting: a new worker waits until the page decides it is safe.
  // No precache either; the download session owns every byte so the player
  // always sees an explicit size prompt before anything is fetched.
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    invalidateManifestMemo();
    assetIndexMemo = null;
    // Claim so a first-run page can talk to the worker without a reload.
    await self.clients.claim();
  })());
});

// --- Fetch ----------------------------------------------------------------

function isHtmlResponse(response) {
  const type = response.headers.get("content-type") ?? "";
  return type.includes("text/html");
}

function hex(buffer) {
  let out = "";
  for (const byte of new Uint8Array(buffer)) out += byte.toString(16).padStart(2, "0");
  return out;
}

async function sha256(buffer) {
  return `sha256-${hex(await crypto.subtle.digest("SHA-256", buffer))}`;
}

/**
 * Stores a verified asset body under its content hash. Rejects HTML bodies so a
 * soft-404 page can never be cached as an image or an audio file.
 *
 * Size alone is not enough: the cache is content-addressed and served
 * cache-first forever, so a same-length but corrupted body would be pinned
 * under a hash it does not match with no repair path. The digest is checked
 * before anything is written, exactly as the page-side download session does.
 */
async function storeAsset(asset, response) {
  if (!response.ok || response.status !== 200) return false;
  if (isHtmlResponse(response)) return false;
  const buffer = await response.clone().arrayBuffer();
  if (buffer.byteLength !== asset.bytes) return false;
  if (await sha256(buffer) !== asset.hash) return false;
  const cache = await caches.open(ASSET_CACHE);
  await cache.put(assetCacheKey(asset.hash), new Response(buffer, {
    headers: {
      "content-type": response.headers.get("content-type") ?? "application/octet-stream",
      "content-length": String(buffer.byteLength),
      "x-pwa-asset-hash": asset.hash,
    },
  }));
  return true;
}

async function respondForAsset(request, asset) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(assetCacheKey(asset.hash));
  // Cache-first: a hashed asset is immutable, so a hit is always correct.
  if (cached) return cached;

  try {
    const response = await fetch(request);
    await storeAsset(asset, response);
    return response;
  } catch {
    // Offline and not yet downloaded. A 504 lets the app report a missing
    // asset precisely instead of hanging until a timeout.
    return new Response("Asset not available offline", {
      status: 504,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
}

/** Release metadata must never be served stale, so it is network-first. */
async function respondNetworkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request, { cache: "no-store" });
    if (response.ok && !isHtmlResponse(response)) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

/**
 * Navigation: try the network so a fresh index is preferred, and fall back to
 * the shell of the ACTIVE generation. Falling back within a single generation
 * is what prevents an old index from booting new JS or vice versa.
 */
async function respondForNavigation(request) {
  const state = await readState();
  const generation = state.active ? generationOf(state.active) : null;
  try {
    const response = await fetch(request);
    if (response.ok && generation) {
      const cache = await caches.open(shellCacheName(generation));
      await cache.put(new URL("index.html", scopeUrl).toString(), response.clone());
    }
    return response;
  } catch (error) {
    if (generation) {
      const cache = await caches.open(shellCacheName(generation));
      const cached = await cache.match(new URL("index.html", scopeUrl).toString());
      if (cached) return cached;
    }
    throw error;
  }
}

/**
 * Fetches the shell of a generation up front so the app can boot with no
 * network at all.
 *
 * Without this, the shell cache is only ever filled by a navigation that
 * happens AFTER a manifest has been committed. On a first install the only
 * navigation happens before the commit, so an app that downloaded every byte
 * and was then taken offline would still fail to start. Warming at commit time
 * is what makes "offline relaunch plays what was downloaded" true on the very
 * first run.
 *
 * Best effort by design: a shell that cannot be warmed must never fail the
 * commit, because the assets are already verified and stored.
 */
async function warmShell(generation) {
  const cache = await caches.open(shellCacheName(generation));
  const indexUrl = new URL("index.html", scopeUrl).toString();
  try {
    const response = await fetch(new URL("./", scopeUrl).toString(), { cache: "no-store" });
    if (!response.ok) return { warmed: 0 };
    const html = await response.clone().text();
    await cache.put(indexUrl, response);

    // Cache the hashed build output the shell references, so the boot path is
    // complete offline rather than only partly cached.
    const references = new Set();
    for (const match of html.matchAll(/(?:src|href)="([^"?#]+\.(?:js|mjs|css))["?#]/g)) {
      references.add(new URL(match[1], scopeUrl).toString());
    }
    let warmed = 1;
    for (const reference of references) {
      if (new URL(reference).origin !== scopeUrl.origin) continue;
      try {
        const asset = await fetch(reference, { cache: "no-store" });
        if (asset.ok && asset.status === 200) {
          await cache.put(reference, asset);
          warmed += 1;
        }
      } catch {
        // One missing shell file must not abandon the rest.
      }
    }
    return { warmed };
  } catch {
    return { warmed: 0 };
  }
}

/** Build output (hashed JS/CSS) is immutable, so cache-first within a generation. */
async function respondForShell(request, generation) {
  const cache = await caches.open(shellCacheName(generation));
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.status === 200) await cache.put(request, response.clone());
  return response;
}

const SHELL_EXTENSIONS = /\.(js|mjs|css)$/i;

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Own scope only: never touch a cross-origin or out-of-scope request.
  if (url.origin !== scopeUrl.origin) return;
  if (!url.pathname.startsWith(scopeUrl.pathname)) return;

  if (request.mode === "navigate") {
    event.respondWith(respondForNavigation(request));
    return;
  }

  const withoutQuery = `${url.origin}${url.pathname}`;

  if (url.pathname === MANIFEST_PATH || url.pathname === RELEASE_PATH) {
    event.respondWith(respondNetworkFirst(request, META_CACHE));
    return;
  }

  event.respondWith((async () => {
    const index = await assetIndex();
    const asset = index?.get(withoutQuery);
    if (asset) return respondForAsset(request, asset);

    if (SHELL_EXTENSIONS.test(url.pathname)) {
      const manifest = await activeManifest();
      if (manifest) return respondForShell(request, generationOf(manifest));
    }

    return fetch(request);
  })());
});

// --- Messages -------------------------------------------------------------

async function reply(event, payload) {
  event.source?.postMessage?.(payload);
  const ports = event.ports ?? [];
  for (const port of ports) port.postMessage(payload);
}

/**
 * Retains the active and previous generations and drops everything older,
 * along with any asset bytes no retained generation references.
 */
async function collectGarbage(state) {
  const retained = [state.active, state.previous].filter(Boolean);
  const retainedShells = new Set(retained.map((manifest) => shellCacheName(generationOf(manifest))));

  for (const name of await caches.keys()) {
    if (!name.startsWith(SHELL_PREFIX)) continue;
    if (retainedShells.has(name)) continue;
    await caches.delete(name);
  }

  const retainedHashes = new Set();
  for (const manifest of retained) {
    for (const asset of manifest.assets ?? []) retainedHashes.add(asset.hash);
  }

  const cache = await caches.open(ASSET_CACHE);
  let removed = 0;
  for (const request of await cache.keys()) {
    const key = new URL(request.url);
    const hash = key.pathname.split("/").pop();
    if (!hash || !hash.startsWith("sha256-")) continue;
    if (retainedHashes.has(hash)) continue;
    await cache.delete(request);
    removed += 1;
  }
  return { removedAssets: removed, retainedGenerations: retained.map(generationOf) };
}

async function storedHashes() {
  const cache = await caches.open(ASSET_CACHE);
  const hashes = new Set();
  for (const request of await cache.keys()) {
    const hash = new URL(request.url).pathname.split("/").pop();
    if (hash?.startsWith("sha256-")) hashes.add(hash);
  }
  return hashes;
}

/**
 * Bytes held for the retained generations.
 *
 * Derived from the manifests rather than by reading every cache entry: the pack
 * is over 500 files, and this runs at boot, so opening each stored response
 * just to read its content-length made startup pay hundreds of cache reads.
 * Each hash is counted once, which matches how the download is sized.
 */
function usageBytesFor(state, present) {
  const counted = new Set();
  let bytes = 0;
  for (const manifest of [state.active, state.previous].filter(Boolean)) {
    for (const asset of manifest.assets ?? []) {
      if (!present.has(asset.hash) || counted.has(asset.hash)) continue;
      counted.add(asset.hash);
      bytes += Number(asset.bytes) || 0;
    }
  }
  return bytes;
}

self.addEventListener("message", (event) => {
  const message = event.data;
  if (!message || typeof message.type !== "string") return;

  event.waitUntil((async () => {
    switch (message.type) {
      case "pwa:ping":
        return reply(event, { type: "pwa:pong", scope: scopeUrl.toString() });

      case "pwa:get-state": {
        const state = await readState();
        const present = await storedHashes();
        // The whole manifest, assets included. The page needs the installed
        // asset list to plan a repair and to diff an update; summarising it to
        // version and SHA would make every update look like a full reinstall.
        return reply(event, {
          type: "pwa:state",
          active: state.active ?? null,
          previous: state.previous ?? null,
          activeGeneration: state.active ? generationOf(state.active) : null,
          previousGeneration: state.previous ? generationOf(state.previous) : null,
          storedHashes: [...present],
          usageBytes: usageBytesFor(state, present),
        });
      }

      // Publishes a verified manifest as the active generation, keeping the
      // outgoing one as the rollback generation.
      case "pwa:commit-manifest": {
        const manifest = message.manifest;
        if (!manifest?.assets?.length) return reply(event, { type: "pwa:commit-failed", reason: "invalid-manifest" });
        const state = await readState();
        const next = {
          active: manifest,
          previous: state.active && generationOf(state.active) !== generationOf(manifest)
            ? state.active
            : state.previous,
          pending: null,
        };
        await writeState(next);
        invalidateManifestMemo();
        assetIndexMemo = null;
        // Collecting first is safe: the new generation is already active, so
        // its shell cache name is retained even before anything is in it.
        const collected = await collectGarbage(next);

        // Answer as soon as the generation is committed. Warming the shell
        // reaches the network, and the page must not sit waiting on a prefetch
        // to be told that its install succeeded. waitUntil keeps the worker
        // alive until the warm finishes.
        await reply(event, {
          type: "pwa:committed",
          generation: generationOf(manifest),
          ...collected,
        });
        await warmShell(generationOf(manifest));
        return undefined;
      }

      // Explicit rollback to the retained previous generation.
      case "pwa:rollback": {
        const state = await readState();
        if (!state.previous) return reply(event, { type: "pwa:rollback-failed", reason: "no-previous-generation" });
        await writeState({ active: state.previous, previous: null, pending: null });
        invalidateManifestMemo();
        assetIndexMemo = null;
        return reply(event, { type: "pwa:rolled-back", generation: generationOf(state.previous) });
      }

      // Only ever sent from a safe screen; never called on install.
      case "pwa:activate-now": {
        await self.skipWaiting();
        return reply(event, { type: "pwa:activating" });
      }

      // Drops asset bytes without touching any save data.
      case "pwa:clear-assets": {
        await caches.delete(ASSET_CACHE);
        return reply(event, { type: "pwa:assets-cleared" });
      }

      default:
        return undefined;
    }
  })());
});
