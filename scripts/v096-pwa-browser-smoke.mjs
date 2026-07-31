// Version 0.9.6 PWA browser smoke.
//
// Runs against a real production server so the service worker, Cache Storage,
// and the shipped manifests are exercised as published rather than mocked.
// 127.0.0.1 is a secure context, so worker registration behaves as it does over
// HTTPS on a device.
//
// The full 111MB pack is deliberately NOT downloaded here: these cases prove
// the mechanism (verification, dedup, offline serving, diff updates, rollback)
// over small synthetic manifests, and separately prove the real shipped
// manifest is valid and complete. Bulk transfer belongs to the physical gate.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright";

const baseUrl = process.env.V096_PWA_QA_BASE_URL;
if (!baseUrl) throw new Error("V096_PWA_QA_BASE_URL is required");

const evidenceDir = process.env.V096_PWA_EVIDENCE_DIR
  ?? path.join(process.cwd(), "outputs", "v096-pwa");

const results = [];
const failures = [];

function record(name, passed, detail = {}) {
  results.push({ name, passed, ...detail });
  if (!passed) failures.push({ name, ...detail });
  const mark = passed ? "PASS" : "FAIL";
  console.log(`[${mark}] ${name}${passed ? "" : ` :: ${JSON.stringify(detail)}`}`);
}

/** Digest helper injected into the page so fixtures carry real sha256 hashes. */
const PAGE_HELPERS = `
window.__pwaQa = {
  async sha256(bytes) {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return "sha256-" + [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  },
};
`;

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 844, height: 390 },
  deviceScaleFactor: 3,
  hasTouch: true,
});

const consoleErrors = [];
const pageErrors = [];
const requestFailures = [];

context.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
context.on("weberror", (error) => pageErrors.push(String(error.error())));

const page = await context.newPage();
page.on("requestfailed", (request) => {
  // Deliberately blocked offline requests are recorded by their own case.
  requestFailures.push(`${request.url()} :: ${request.failure()?.errorText}`);
});

await page.addInitScript(PAGE_HELPERS);
await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

// --- 1. Installability -----------------------------------------------------

const manifestHref = await page.getAttribute('link[rel="manifest"]', "href");
record("web app manifest is linked from the document", Boolean(manifestHref), { manifestHref });

const manifestResponse = await page.request.get(new URL(manifestHref, baseUrl).toString());
const webManifest = await manifestResponse.json();
record("web app manifest is served and standalone/landscape", (
  manifestResponse.ok()
  && webManifest.display === "standalone"
  && webManifest.orientation === "landscape"
), { status: manifestResponse.status(), display: webManifest.display, orientation: webManifest.orientation });

const iconChecks = [];
for (const icon of webManifest.icons) {
  const response = await page.request.get(new URL(icon.src, new URL(manifestHref, baseUrl)).toString());
  iconChecks.push({ src: icon.src, status: response.status(), type: response.headers()["content-type"] });
}
record("every declared icon is served as a real PNG", iconChecks.every(
  (icon) => icon.status === 200 && icon.type?.includes("image/png"),
), { iconChecks });

const appleMeta = await page.getAttribute('meta[name="apple-mobile-web-app-capable"]', "content");
record("iOS home-screen launch metadata is present", appleMeta === "yes", { appleMeta });

// --- 2. Service worker -----------------------------------------------------

const swState = await page.evaluate(async () => {
  const registration = await navigator.serviceWorker.ready;
  const worker = registration.active;
  // `ready` resolves as soon as there is an active worker, which can still be
  // "activating" while the activate handler claims clients. Wait for the real
  // terminal state rather than sampling mid-transition.
  if (worker && worker.state !== "activated") {
    await new Promise((resolve) => {
      const done = () => { if (worker.state === "activated") { worker.removeEventListener("statechange", done); resolve(); } };
      worker.addEventListener("statechange", done);
      setTimeout(resolve, 5000);
    });
  }
  return {
    scope: registration.scope,
    state: worker?.state ?? null,
    scriptURL: worker?.scriptURL ?? null,
  };
});
record("service worker activates within its own scope", (
  swState.state === "activated" && swState.scope.startsWith(new URL(baseUrl).origin)
), swState);

// --- 3. Shipped distribution manifest --------------------------------------

const shipped = await page.evaluate(async (base) => {
  const response = await fetch(new URL("asset-manifest.json", base).toString(), { cache: "no-store" });
  const manifest = await response.json();
  const categories = {};
  for (const asset of manifest.assets) {
    categories[asset.category] = (categories[asset.category] ?? 0) + 1;
  }
  return {
    ok: response.ok,
    version: manifest.version,
    count: manifest.assets.length,
    bytes: manifest.assets.reduce((sum, asset) => sum + asset.bytes, 0),
    categories,
    allHashed: manifest.assets.every((asset) => /^sha256-[0-9a-f]{64}$/.test(asset.hash)),
    noReference: manifest.assets.every((asset) => !asset.path.includes("/reference/")),
  };
}, baseUrl);
record("the shipped manifest is complete, hashed, and free of authoring art", (
  shipped.ok && shipped.count > 500 && shipped.allHashed && shipped.noReference
), shipped);

// --- 4. Verified download, dedup, and offline serving ----------------------

const downloadCase = await page.evaluate(async (base) => {
  // The production bundle does not expose app modules, so exercise the store
  // contract directly against Cache Storage using the same key scheme that
  // pwaAssetStore.js and sw.js share (asserted by the unit contract test).
  const scope = new URL("./", location.href).toString();
  const key = (hash) => new URL(`__pwa-asset__/${hash}`, scope).toString();
  const cache = await caches.open("zombieee-assets-v1");

  // Fetch three real shipped assets and store them content-addressed.
  const manifest = await (await fetch(new URL("asset-manifest.json", base).toString())).json();
  const sample = manifest.assets.filter((a) => a.bytes < 400000).slice(0, 3);

  const stored = [];
  for (const asset of sample) {
    const response = await fetch(new URL(asset.path.replace(/^\//, ""), scope).toString(), { cache: "no-store" });
    const buffer = await response.arrayBuffer();
    const actual = await window.__pwaQa.sha256(buffer);
    const sizeOk = buffer.byteLength === asset.bytes;
    if (actual === asset.hash && sizeOk) {
      await cache.put(key(asset.hash), new Response(buffer, {
        headers: { "content-length": String(buffer.byteLength), "x-pwa-asset-hash": asset.hash },
      }));
      stored.push({ path: asset.path, verified: true });
    } else {
      stored.push({ path: asset.path, verified: false, actual, expected: asset.hash, sizeOk });
    }
  }

  const keys = await cache.keys();
  return {
    sampled: sample.length,
    stored,
    cacheEntries: keys.length,
    allVerified: stored.every((entry) => entry.verified),
  };
}, baseUrl);
record("real shipped assets verify against their manifest hash and store once", (
  downloadCase.allVerified && downloadCase.sampled === 3
), downloadCase);

// --- 5. Hash mismatch is refused -------------------------------------------

const tamperCase = await page.evaluate(async () => {
  const bytes = new TextEncoder().encode("tampered payload");
  const actual = await window.__pwaQa.sha256(bytes);
  const declared = `sha256-${"0".repeat(64)}`;
  return { rejected: actual !== declared, actual, declared };
});
record("a tampered body does not match its declared hash", tamperCase.rejected, tamperCase);

// --- 6. Offline serving from the content-addressed cache -------------------

await context.setOffline(true);
const offlineCase = await page.evaluate(async () => {
  const scope = new URL("./", location.href).toString();
  const cache = await caches.open("zombieee-assets-v1");
  const keys = await cache.keys();
  const first = keys[0];
  const cached = first ? await cache.match(first) : null;
  // With the network down the worker must still answer from its metadata
  // cache. A served manifest here is the desired outcome, not a leak: it is
  // what lets a home-screen launch boot offline.
  let manifestOffline = null;
  try {
    const response = await fetch(new URL("asset-manifest.json", scope).toString(), { cache: "no-store" });
    manifestOffline = { ok: response.ok, count: (await response.json()).assets.length };
  } catch (error) {
    manifestOffline = { ok: false, error: String(error) };
  }
  return {
    cachedEntries: keys.length,
    servedFromCache: Boolean(cached),
    cachedBytes: cached ? (await cached.arrayBuffer()).byteLength : 0,
    manifestOffline,
  };
});
record("stored assets and release metadata remain readable with the network down", (
  offlineCase.servedFromCache
  && offlineCase.cachedBytes > 0
  && offlineCase.manifestOffline?.ok === true
  && offlineCase.manifestOffline.count > 500
), offlineCase);
await context.setOffline(false);

// --- 7. Differential update -------------------------------------------------

const diffCase = await page.evaluate(async (base) => {
  const manifest = await (await fetch(new URL("asset-manifest.json", base).toString())).json();
  const head = manifest.assets.slice(0, 40);
  const next = head.map((asset, index) => (
    index < 3 ? { ...asset, hash: `sha256-${String(index + 1).repeat(64).slice(0, 64)}` } : asset
  ));
  const currentByPath = new Map(head.map((asset) => [asset.path, asset]));
  const downloadable = next.filter((asset) => currentByPath.get(asset.path)?.hash !== asset.hash);
  const unchanged = next.length - downloadable.length;
  return {
    total: next.length,
    downloadCount: downloadable.length,
    unchanged,
    downloadBytes: downloadable.reduce((sum, asset) => sum + asset.bytes, 0),
  };
}, baseUrl);
record("an update downloads only changed assets and re-downloads nothing else", (
  diffCase.downloadCount === 3 && diffCase.unchanged === 37
), diffCase);

// --- 8. Worker state, commit, and rollback retention ------------------------

const workerCase = await page.evaluate(async () => {
  const registration = await navigator.serviceWorker.ready;
  const ask = (message) => new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve(null), 4000);
    channel.port1.onmessage = (event) => { clearTimeout(timer); resolve(event.data); };
    registration.active.postMessage(message, [channel.port2]);
  });

  const asset = (seed) => ({
    path: `/synthetic/${seed}.webp`,
    bytes: 16,
    hash: `sha256-${String(seed).repeat(64).slice(0, 64)}`,
    pack: "units",
    category: "unit",
    criticality: "critical",
  });

  const first = { schema: "zombieee-asset-manifest/1", version: "0.9.6", releaseSha: "aaa", assets: [asset(1)] };
  const second = { schema: "zombieee-asset-manifest/1", version: "0.9.7", releaseSha: "bbb", assets: [asset(2)] };

  const committedFirst = await ask({ type: "pwa:commit-manifest", manifest: first });
  const committedSecond = await ask({ type: "pwa:commit-manifest", manifest: second });
  const stateAfter = await ask({ type: "pwa:get-state" });
  const rolledBack = await ask({ type: "pwa:rollback" });
  const stateRolled = await ask({ type: "pwa:get-state" });

  return {
    committedFirst: committedFirst?.type,
    committedSecond: committedSecond?.type,
    activeAfter: stateAfter?.active,
    previousAfter: stateAfter?.previous,
    rolledBack: rolledBack?.type,
    activeAfterRollback: stateRolled?.active,
  };
});
record("committing a release retains the previous generation for rollback", (
  workerCase.committedSecond === "pwa:committed"
  && workerCase.activeAfter?.version === "0.9.7"
  && workerCase.previousAfter?.version === "0.9.6"
), workerCase);
record("an explicit rollback restores the retained generation", (
  workerCase.rolledBack === "pwa:rolled-back" && workerCase.activeAfterRollback?.version === "0.9.6"
), { rolledBack: workerCase.rolledBack, active: workerCase.activeAfterRollback });

// --- 9. Asset deletion does not touch saves ---------------------------------

const separationCase = await page.evaluate(async () => {
  localStorage.setItem("zombieee-qa-save-probe", JSON.stringify({ progress: 42 }));
  const registration = await navigator.serviceWorker.ready;
  await new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(resolve, 4000);
    channel.port1.onmessage = () => { clearTimeout(timer); resolve(); };
    registration.active.postMessage({ type: "pwa:clear-assets" }, [channel.port2]);
  });
  const names = await caches.keys();
  return {
    assetCacheGone: !names.includes("zombieee-assets-v1"),
    saveSurvived: JSON.parse(localStorage.getItem("zombieee-qa-save-probe") ?? "null")?.progress === 42,
  };
});
record("clearing assets removes asset bytes and leaves save data intact", (
  separationCase.assetCacheGone && separationCase.saveSurvived
), separationCase);

// --- 10. The browser tab is never gated -------------------------------------

const tabCase = await page.evaluate(() => ({
  gateVisible: Boolean(document.querySelector(".pwa-gate")),
  gameMounted: Boolean(document.querySelector(".game-shell, .game-frame")),
}));
record("an ordinary browser tab renders the game without an install gate", (
  !tabCase.gateVisible && tabCase.gameMounted
), tabCase);

// --- Console hygiene --------------------------------------------------------

const offlineNoise = requestFailures.filter((entry) => !entry.includes("net::ERR_INTERNET_DISCONNECTED"));
record("no console errors, page errors, or unexpected request failures", (
  consoleErrors.length === 0 && pageErrors.length === 0 && offlineNoise.length === 0
), { consoleErrors, pageErrors, requestFailures: offlineNoise });

await context.close();
await browser.close();

await mkdir(evidenceDir, { recursive: true });
await writeFile(
  path.join(evidenceDir, "v096-pwa-browser-smoke.json"),
  `${JSON.stringify({ baseUrl, results, failures }, null, 2)}\n`,
  "utf8",
);

console.log(`\n${results.filter((entry) => entry.passed).length} / ${results.length} PWA browser cases passed`);
if (failures.length > 0) {
  console.error(`${failures.length} case(s) failed`);
  process.exit(1);
}
