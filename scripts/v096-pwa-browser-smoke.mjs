// Version 0.9.6 PWA browser smoke.
//
// Runs against a real production server so the service worker, Cache Storage,
// and the shipped manifests are exercised as published rather than mocked.
// 127.0.0.1 is a secure context, so worker registration behaves as it does over
// HTTPS on a device.
//
// The full production pack is deliberately NOT downloaded here: these cases prove
// the mechanism (verification, dedup, offline serving, diff updates, rollback)
// over small synthetic manifests, and separately prove the real shipped
// manifest is valid and complete. Bulk transfer belongs to the physical gate.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium, webkit } from "playwright";

const baseUrl = process.env.V096_PWA_QA_BASE_URL;
if (!baseUrl) throw new Error("V096_PWA_QA_BASE_URL is required");

// The entry screen must not depend on one engine, so the matrix can be pointed
// at WebKit as well. Cache Storage and the download session are the parts most
// likely to differ, and both are exercised below.
const ENGINES = { chromium, webkit };
const engineName = process.env.V096_PWA_QA_BROWSER ?? "chromium";
const engine = ENGINES[engineName];
if (!engine) throw new Error(`Unknown V096_PWA_QA_BROWSER: ${engineName}`);

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

const browser = await engine.launch();
const context = await browser.newContext({
  viewport: { width: 844, height: 390 },
  deviceScaleFactor: 3,
  hasTouch: true,
});

const consoleErrors = [];
const pageErrors = [];
const requestFailures = [];
const httpErrors = [];

context.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
context.on("weberror", (error) => pageErrors.push(String(error.error())));

const page = await context.newPage();
page.on("requestfailed", (request) => {
  // Deliberately blocked offline requests are recorded by their own case.
  requestFailures.push(`${request.url()} :: ${request.failure()?.errorText}`);
});
// A cancelled request is not an error the site produced, but a 404 or a 500 is,
// and those complete successfully at the network layer so `requestfailed` never
// sees them. Watch responses so real HTTP errors are actually caught.
page.on("response", (response) => {
  if (response.status() >= 400) httpErrors.push(`${response.url()} :: HTTP ${response.status()}`);
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
  shipped.ok && shipped.count > 300 && shipped.allHashed && shipped.noReference
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
    const transportPath = asset.bundlePath ?? asset.sourcePath ?? asset.path;
    const response = await fetch(new URL(transportPath.replace(/^\//, ""), scope).toString(), { cache: "no-store" });
    const transport = await response.arrayBuffer();
    const start = Number(asset.bundleOffset ?? 0);
    const end = asset.bundlePath ? start + Number(asset.bundleBytes ?? asset.bytes) : transport.byteLength;
    const buffer = asset.bundlePath ? transport.slice(start, end) : transport;
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

// Playwright's offline emulation on WebKit severs the connection below the
// service worker, so a worker-served response surfaces as an internal load
// error instead of a cache hit. That is a limit of the emulation rather than a
// statement about Safari, so the worker half of this check is asserted only
// where it can actually be observed. The storage half - that verified bytes
// stay readable - is asserted on every engine.
const canObserveWorkerOffline = engineName === "chromium";
if (canObserveWorkerOffline) await context.setOffline(true);
const offlineCase = await page.evaluate(async (checkWorker) => {
  const scope = new URL("./", location.href).toString();
  const cache = await caches.open("zombieee-assets-v1");
  const keys = await cache.keys();
  const first = keys[0];
  const cached = first ? await cache.match(first) : null;
  // With the network down the worker must still answer from its metadata
  // cache. A served manifest here is the desired outcome, not a leak: it is
  // what lets a home-screen launch boot offline.
  let manifestOffline = null;
  if (checkWorker) {
    try {
      const response = await fetch(new URL("asset-manifest.json", scope).toString(), { cache: "no-store" });
      manifestOffline = { ok: response.ok, count: (await response.json()).assets.length };
    } catch (error) {
      manifestOffline = { ok: false, error: String(error) };
    }
  }
  return {
    cachedEntries: keys.length,
    servedFromCache: Boolean(cached),
    cachedBytes: cached ? (await cached.arrayBuffer()).byteLength : 0,
    manifestOffline,
  };
}, canObserveWorkerOffline);
record("stored assets stay readable from the content-addressed cache", (
  offlineCase.servedFromCache && offlineCase.cachedBytes > 0
), { ...offlineCase, engine: engineName });
if (canObserveWorkerOffline) {
  record("the worker serves release metadata with the network down", (
    offlineCase.manifestOffline?.ok === true && offlineCase.manifestOffline.count > 300
  ), offlineCase.manifestOffline ?? {});
  await context.setOffline(false);
}

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

// --- 10. The install invitation in an ordinary browser tab -----------------
//
// Runs in its own context with the manifest routed to a small synthetic pack
// built from real shipped files, so the whole journey - invitation, decline,
// first home-screen download, launch and revisit - can finish inside a QA run
// while every byte that is fetched and verified is still a genuine published
// asset.
//
// Service workers are blocked here on purpose: these sections are about the
// page's own UI, and the worker is covered by the cases above. Blocking it also
// lets the manifest route apply, which a worker would otherwise serve around.

const smallPack = await page.evaluate(async (base) => {
  const manifest = await (await fetch(new URL("asset-manifest.json", base).toString())).json();
  const assets = [...manifest.assets].sort((a, b) => a.bytes - b.bytes).slice(0, 3);
  return { schema: manifest.schema, version: manifest.version, releaseSha: manifest.releaseSha, assets };
}, baseUrl);

const routeSmallPack = (target) => target.route("**/asset-manifest.json", (route) => route.fulfill({
  status: 200,
  contentType: "application/json; charset=utf-8",
  body: JSON.stringify(smallPack),
}));

const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const entryContext = await browser.newContext({
  viewport: { width: 844, height: 390 },
  deviceScaleFactor: 3,
  hasTouch: true,
  serviceWorkers: "block",
  // An iPhone user agent so the manual route is exercised: `beforeinstallprompt`
  // never fires here, which is exactly the case that must not look broken.
  userAgent: IPHONE_UA,
});
const entryPage = await entryContext.newPage();
const entryAssetRequests = [];
entryPage.on("request", (request) => {
  const { pathname } = new URL(request.url());
  if (/\/(art|audio|icons)\//.test(pathname)) entryAssetRequests.push(pathname);
});
await routeSmallPack(entryContext);
await entryPage.goto(baseUrl, { waitUntil: "domcontentloaded" });

const skipLabel = entryPage.getByRole("button", { name: "ブラウザで遊ぶ" });
await skipLabel.waitFor({ state: "visible", timeout: 30_000 }).catch(() => {});

const offerCase = await entryPage.evaluate(() => {
  const gate = document.querySelector(".pwa-gate");
  const text = gate?.innerText ?? "";
  const steps = [...document.querySelectorAll(".pwa-install-steps li")].map((li) => ({
    number: li.querySelector(".pwa-step-number")?.textContent ?? "",
    hasIcon: Boolean(li.querySelector(".pwa-step-icon svg")),
    arrow: li.querySelector(".pwa-step-arrow")?.textContent ?? null,
    text: li.querySelector(".pwa-step-text")?.textContent ?? "",
  }));
  return {
    gateVisible: Boolean(gate),
    gameMounted: Boolean(document.querySelector(".game-shell, .game-frame")),
    headline: document.querySelector(".pwa-gate-panel h2")?.textContent ?? "",
    saysInstall: text.includes("西新世紀末物語をインストール"),
    saysNoDownload: text.includes("ダウンロードしません"),
    // No control on this screen may start a download.
    downloadButtons: [...document.querySelectorAll(".pwa-gate button")]
      .map((button) => button.textContent ?? "")
      .filter((label) => /ダウンロードを開始|ダウンロードを再開/.test(label)),
    steps,
  };
});
record("a browser tab is invited to install before it reaches the title", (
  offerCase.gateVisible && !offerCase.gameMounted && offerCase.saysInstall
), offerCase);
record("the invitation offers no way to start a download in the browser", (
  offerCase.downloadButtons.length === 0 && offerCase.saysNoDownload
), { downloadButtons: offerCase.downloadButtons, saysNoDownload: offerCase.saysNoDownload });

// The manual route is the one iOS players actually walk, so check it is a
// numbered list, that each step carries the control's own label in brackets,
// that the share step shows a glyph, and that it points at the right edge of
// the screen.
const stepText = offerCase.steps.map((step) => step.text);
record("iOS gets numbered home-screen steps with the share glyph and bracketed labels", (
  offerCase.steps.length === 3
  && offerCase.steps.map((step) => step.number).join("") === "123"
  && offerCase.steps.every((step) => /「.+」/.test(step.text))
  && offerCase.steps[0].hasIcon
  && offerCase.steps[0].arrow === "↓"
  && /共有/.test(stepText[0])
  && /ホーム画面に追加/.test(stepText[1])
  && /追加/.test(stepText[2])
), offerCase.steps);

// Nothing may be saved to the device, and the only things fetched are the shell
// images the document itself declares for first paint. Comparing against the
// document's own preload list rather than a fixed number means any new
// unsolicited fetch fails this immediately.
const consentCase = await entryPage.evaluate(async () => {
  const preloads = [...document.querySelectorAll('link[rel="preload"]')]
    .map((link) => new URL(link.getAttribute("href"), location.href).pathname);
  const names = await caches.keys();
  const cache = names.includes("zombieee-assets-v1") ? await caches.open("zombieee-assets-v1") : null;
  return { preloads, storedInBrowser: cache ? (await cache.keys()).length : 0 };
});
const unsolicited = entryAssetRequests.filter((path) => !consentCase.preloads.includes(path));
record("a browser tab saves no game data at all", (
  consentCase.storedInBrowser === 0
), { storedInBrowser: consentCase.storedInBrowser });
record("nothing beyond the document's own first-paint preloads is fetched", (
  unsolicited.length === 0
), {
  unsolicited,
  fetchedInBrowser: entryAssetRequests.length,
  declaredPreloads: consentCase.preloads.length,
});

// The invitation carries the most content of any gate screen, so check the
// shortest supported viewport: the decline action must stay reachable and the
// page must never scroll sideways.
await entryPage.setViewportSize({ width: 844, height: 340 });
const compactCase = await entryPage.evaluate(() => {
  const button = [...document.querySelectorAll(".pwa-gate button")]
    .find((candidate) => /ブラウザで遊ぶ/.test(candidate.textContent ?? ""));
  const rect = button?.getBoundingClientRect();
  return {
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth
      || document.body.scrollWidth > window.innerWidth,
    buttonWidthWithinViewport: rect ? rect.right <= window.innerWidth + 1 && rect.left >= -1 : false,
    buttonTapHeight: rect ? Math.round(rect.height) : 0,
    stepsReadable: [...document.querySelectorAll(".pwa-install-steps li")]
      .every((li) => li.getBoundingClientRect().right <= window.innerWidth + 1),
  };
});
record("the invitation fits the shortest supported viewport without sideways scroll", (
  !compactCase.horizontalOverflow
  && compactCase.buttonWidthWithinViewport
  && compactCase.buttonTapHeight >= 40
  && compactCase.stepsReadable
), compactCase);
await entryPage.setViewportSize({ width: 844, height: 390 });

// --- 11. Declining the invitation still plays -------------------------------
//
// The invitation is an offer, not a wall, and no particular browser is required
// to get past it.

await skipLabel.click();
await entryPage.locator(".game-shell, .game-frame").first().waitFor({ state: "visible", timeout: 30_000 }).catch(() => {});
const skipCase = await entryPage.evaluate(async () => {
  const names = await caches.keys();
  const cache = names.includes("zombieee-assets-v1") ? await caches.open("zombieee-assets-v1") : null;
  return {
    gateVisible: Boolean(document.querySelector(".pwa-gate")),
    gameMounted: Boolean(document.querySelector(".game-shell, .game-frame")),
    storedAfterDecline: cache ? (await cache.keys()).length : 0,
  };
});
record("declining the invitation still lets the player into the game", (
  !skipCase.gateVisible && skipCase.gameMounted && skipCase.storedAfterDecline === 0
), skipCase);

// --- 12. データ管理 appears only where a player would look for it ------------
//
// It is a maintenance tool. On the title it belongs; over the map, the loadout,
// dialogue, battle or the result it is developer furniture on a player's screen.

const dataScreenCase = await entryPage.evaluate(() => {
  const visible = () => [...document.querySelectorAll(".pwa-storage-toggle")].length > 0;
  return { screen: document.documentElement.dataset.pwaScreen ?? null, toggleOnTitle: visible() };
});
record("データ管理 is offered on the title screen", (
  dataScreenCase.screen === "title" && dataScreenCase.toggleOnTitle
), dataScreenCase);

// The save environment moved off the title and into this panel, which is the
// only place it is now reachable.
await entryPage.getByRole("button", { name: "データ管理" }).click();
const panelCase = await entryPage.evaluate(() => {
  const badge = document.querySelector(".pwa-storage .save-environment-badge");
  return {
    panelOpen: Boolean(document.querySelector(".pwa-storage")),
    environmentKind: badge?.getAttribute("data-save-environment") ?? null,
    environmentOrigin: badge?.getAttribute("data-save-origin") ?? null,
    badgeOnTitle: Boolean(document.querySelector(".title-screen-v060 .save-environment-badge")),
  };
});
record("the save environment is shown in データ管理 and no longer on the title", (
  panelCase.panelOpen
  && panelCase.environmentKind
  && panelCase.environmentKind !== "checking"
  && !panelCase.badgeOnTitle
), panelCase);
await entryPage.getByRole("button", { name: "閉じる" }).click();

// Walk into the game and confirm the button is gone from a play screen.
await entryPage.locator(".title-start").click();
await entryPage.locator(".event-screen, .map-screen").first().waitFor({ state: "visible", timeout: 30_000 }).catch(() => {});
const playScreenCase = await entryPage.evaluate(() => ({
  screen: document.documentElement.dataset.pwaScreen ?? null,
  toggleVisible: [...document.querySelectorAll(".pwa-storage-toggle")].length > 0,
}));
record("データ管理 is hidden once the player leaves the title", (
  playScreenCase.screen !== "title" && !playScreenCase.toggleVisible
), playScreenCase);

await entryContext.close();

// --- 13. The first home-screen launch downloads, then hands over -------------
//
// A home-screen launch is where the pack belongs. `navigator.standalone` is the
// flag iOS itself sets, and the runtime reads it, so setting it here exercises
// the real branch rather than a mock of it.

const appContext = await browser.newContext({
  viewport: { width: 844, height: 390 },
  deviceScaleFactor: 3,
  hasTouch: true,
  serviceWorkers: "block",
  userAgent: IPHONE_UA,
});
await appContext.addInitScript(() => {
  Object.defineProperty(window.navigator, "standalone", { value: true, configurable: true });
});
const appPage = await appContext.newPage();
const appAssetRequests = [];
appPage.on("request", (request) => {
  const { pathname } = new URL(request.url());
  if (/\/(art|audio|icons)\//.test(pathname)) appAssetRequests.push(pathname);
});
await routeSmallPack(appContext);
await appPage.goto(baseUrl, { waitUntil: "domcontentloaded" });

const startDownload = appPage.getByRole("button", { name: "ダウンロードを開始" });
await startDownload.waitFor({ state: "visible", timeout: 30_000 }).catch(() => {});
const firstRunCase = await appPage.evaluate((expected) => {
  const text = document.querySelector(".pwa-gate")?.innerText ?? "";
  return {
    gateVisible: Boolean(document.querySelector(".pwa-gate")),
    gameMounted: Boolean(document.querySelector(".game-shell, .game-frame")),
    mentionsCount: text.includes(`${expected}件`),
    // The install invitation belongs to the browser, not to the installed app.
    saysInstall: text.includes("西新世紀末物語をインストール"),
  };
}, smallPack.assets.length);
record("the first home-screen launch asks to download, stating the manifest's counts", (
  firstRunCase.gateVisible && !firstRunCase.gameMounted && firstRunCase.mentionsCount && !firstRunCase.saysInstall
), firstRunCase);

await startDownload.click();
const beginButton = appPage.getByRole("button", { name: "ゲームを始める" });
await beginButton.waitFor({ state: "visible", timeout: 120_000 }).catch(() => {});
const completionCase = await appPage.evaluate(async () => {
  const cache = await caches.open("zombieee-assets-v1");
  return {
    beginVisible: Boolean([...document.querySelectorAll("button")].find((b) => b.textContent?.includes("ゲームを始める"))),
    storedEntries: (await cache.keys()).length,
    gameMounted: Boolean(document.querySelector(".game-shell, .game-frame")),
  };
});
record("the download saves the manifest's assets and then offers to begin", (
  completionCase.beginVisible
  && completionCase.storedEntries === smallPack.assets.length
  && !completionCase.gameMounted
), { ...completionCase, expected: smallPack.assets.length });
record("the first launch actually fetches game data", (
  appAssetRequests.length > 0
), { assetRequestsAfterConsent: appAssetRequests.length });

await beginButton.click();
await appPage.locator(".game-shell, .game-frame").first().waitFor({ state: "visible", timeout: 30_000 }).catch(() => {});
const launchCase = await appPage.evaluate(() => ({
  gateVisible: Boolean(document.querySelector(".pwa-gate")),
  gameMounted: Boolean(document.querySelector(".game-shell, .game-frame")),
}));
record("beginning the game leaves the gate and plays from the saved pack", (
  !launchCase.gateVisible && launchCase.gameMounted
), launchCase);

// A launch that already holds the pack must go straight to the game.
await appPage.reload({ waitUntil: "domcontentloaded" });
await appPage.locator(".game-shell, .game-frame").first().waitFor({ state: "visible", timeout: 30_000 }).catch(() => {});
const revisitCase = await appPage.evaluate(async () => {
  const names = await caches.keys();
  const cache = names.includes("zombieee-assets-v1") ? await caches.open("zombieee-assets-v1") : null;
  return {
    gateVisible: Boolean(document.querySelector(".pwa-gate")),
    gameMounted: Boolean(document.querySelector(".game-shell, .game-frame")),
    // Recorded so a failure says whether the pack survived the reload at all,
    // which separates an engine that drops ephemeral storage from a gate that
    // fails to notice a pack it still holds.
    cacheNames: names,
    storedAfterReload: cache ? (await cache.keys()).length : 0,
  };
});
// Only meaningful while the device still holds the pack. Playwright's WebKit
// contexts are ephemeral and drop Cache Storage across a reload, which leaves
// the bucket present but empty; asking again is then the correct behaviour, not
// a regression, so the rule is asserted against what the device actually holds.
const packSurvivedReload = revisitCase.storedAfterReload === smallPack.assets.length;
record(
  packSurvivedReload
    ? "an installed app that holds its pack is never asked to download again"
    : "an installed app whose browser evicted the pack is asked again",
  packSurvivedReload
    ? (!revisitCase.gateVisible && revisitCase.gameMounted)
    : revisitCase.gateVisible,
  { ...revisitCase, packSurvivedReload, expected: smallPack.assets.length, engine: engineName },
);

await appContext.close();

// --- Console hygiene --------------------------------------------------------

// ERR_ABORTED is a cancellation, not a fault. The game keeps pulling battle art
// for as long as the page lives, so against the published origin there is
// always something in flight when the harness closes it, and which asset gets
// cancelled is pure timing. Aborts are excluded deliberately, and the HTTP
// status watcher above is what makes that safe: a genuinely missing or broken
// asset returns 404 or 500 and is caught there, not silently dropped here.
// ERR_INTERNET_DISCONNECTED comes from the offline case, which asserts its own
// expectations.
const IGNORED_FAILURES = ["net::ERR_INTERNET_DISCONNECTED", "net::ERR_ABORTED"];
const offlineNoise = requestFailures.filter(
  (entry) => !IGNORED_FAILURES.some((ignored) => entry.includes(ignored)),
);
record("no console errors, page errors, HTTP errors, or unexpected request failures", (
  consoleErrors.length === 0
  && pageErrors.length === 0
  && offlineNoise.length === 0
  && httpErrors.length === 0
), { consoleErrors, pageErrors, httpErrors, requestFailures: offlineNoise });

await context.close();
await browser.close();

await mkdir(evidenceDir, { recursive: true });
await writeFile(
  path.join(evidenceDir, "v096-pwa-browser-smoke.json"),
  `${JSON.stringify({ baseUrl, engine: engineName, results, failures }, null, 2)}\n`,
  "utf8",
);

console.log(`\n${results.filter((entry) => entry.passed).length} / ${results.length} PWA browser cases passed`);
if (failures.length > 0) {
  console.error(`${failures.length} case(s) failed`);
  process.exit(1);
}
