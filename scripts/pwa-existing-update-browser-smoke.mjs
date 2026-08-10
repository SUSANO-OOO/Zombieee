// Persistent existing-PWA update smoke.
//
// This is deliberately a two-release, same-origin test. The server switches
// between two already-built static roots; Playwright keeps one persistent
// profile so Service Worker registration, Cache Storage, IndexedDB, and
// localStorage survive the switch exactly as they do for an installed app.
// The candidate worker gets a harmless QA-only comment appended to its bytes so
// a real waiting-worker transition is observable without changing production
// public/sw.js.

import { createServer } from "node:http";
import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createDefaultCampaignSave, serializeCampaignSave } from "../app/campaign.js";
import { chromium, webkit } from "playwright";

const oldRootInput = process.env.PWA_EXISTING_UPDATE_OLD_ROOT;
const candidateRootInput = process.env.PWA_EXISTING_UPDATE_CANDIDATE_ROOT;
const oldRoot = path.resolve(oldRootInput ?? "");
const candidateRoot = path.resolve(candidateRootInput ?? "");
const browserName = process.env.PWA_EXISTING_UPDATE_BROWSER ?? "chromium";
const evidenceDir = path.resolve(
  process.env.PWA_EXISTING_UPDATE_EVIDENCE_DIR ?? path.join(process.cwd(), "outputs", "pwa-existing-update"),
);
const basePath = "/Zombieee";
const saveKey = "nishijin-campaign-v1";
const scopePath = `${basePath}/`;
const browserType = { chromium, webkit }[browserName];

if (!oldRootInput || !candidateRootInput) throw new Error("PWA_EXISTING_UPDATE_OLD_ROOT and PWA_EXISTING_UPDATE_CANDIDATE_ROOT are required");
if (!browserType) throw new Error(`Unknown browser: ${browserName}`);

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ogg": "audio/ogg",
  ".mp3": "audio/mpeg",
  ".bin": "application/octet-stream",
};

const results = [];
const failures = [];
const diagnostics = {
  consoleErrors: [],
  pageErrors: [],
  httpErrors: [],
  requestFailures: [],
};

function record(name, passed, detail = {}) {
  results.push({ name, passed, ...detail });
  if (!passed) failures.push({ name, ...detail });
  console.log(`[${passed ? "PASS" : "FAIL"}] ${name}${passed ? "" : ` :: ${JSON.stringify(detail)}`}`);
}

async function readManifest(root) {
  return JSON.parse(await readFile(path.join(root, "asset-manifest.json"), "utf8"));
}

function ensureRoot(root) {
  return stat(path.join(root, "index.html"));
}

function rootForLabel(label) {
  return label === "candidate" ? candidateRoot : oldRoot;
}

function staticTarget(root, pathname) {
  const relative = pathname.slice(basePath.length).replace(/^\/+/, "") || "index.html";
  const rootAbsolute = path.resolve(root);
  let target = path.resolve(rootAbsolute, relative);
  if (!target.startsWith(`${rootAbsolute}${path.sep}`) && target !== rootAbsolute) return null;
  return target;
}

async function serveFile(root, pathname, label) {
  let target = staticTarget(root, pathname);
  if (!target) return { status: 400, body: Buffer.from("Invalid path"), type: "text/plain; charset=utf-8" };
  let targetStats = await stat(target).catch(() => null);
  if (targetStats?.isDirectory()) {
    target = path.join(target, "index.html");
    targetStats = await stat(target).catch(() => null);
  }
  if (!targetStats) {
    if (path.extname(target)) {
      return { status: 404, body: Buffer.from("Not found"), type: "text/plain; charset=utf-8" };
    }
    target = path.join(root, "index.html");
    targetStats = await stat(target).catch(() => null);
  }
  if (!targetStats) return { status: 404, body: Buffer.from("Not found"), type: "text/plain; charset=utf-8" };

  let body = await readFile(target);
  // Test-only byte marker: same worker behavior, different script bytes, so
  // registration.update() must produce a real waiting worker on the switch.
  if (label === "candidate" && pathname === `${basePath}/sw.js`) {
    body = Buffer.concat([body, Buffer.from("\n// QA waiting-worker marker; no production behavior\n")]);
  }
  return {
    status: 200,
    body,
    type: CONTENT_TYPES[path.extname(target).toLowerCase()] ?? "application/octet-stream",
  };
}

let currentLabel = "old";
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
    if (url.pathname === "/__qa/switch") {
      const next = url.searchParams.get("root");
      if (!['old', 'candidate'].includes(next)) {
        response.writeHead(400, { "content-type": "application/json" });
        response.end(JSON.stringify({ ok: false, reason: "root must be old or candidate" }));
        return;
      }
      currentLabel = next;
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: true, currentLabel }));
      return;
    }
    if (!url.pathname.startsWith(basePath) || (url.pathname !== basePath && !url.pathname.startsWith(scopePath))) {
      response.writeHead(404).end("Not found");
      return;
    }
    const served = await serveFile(rootForLabel(currentLabel), url.pathname, currentLabel);
    response.writeHead(served.status, {
      "content-type": served.type,
      "content-length": String(served.body.byteLength),
      "cache-control": "no-cache",
    });
    response.end(served.body);
  } catch (error) {
    response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    response.end(String(error?.message ?? error));
  }
});

await ensureRoot(oldRoot);
await ensureRoot(candidateRoot);
const oldManifest = await readManifest(oldRoot);
const candidateManifest = await readManifest(candidateRoot);
record("old and candidate static roots are complete", (
  oldManifest.version === "0.9.9.1"
  && candidateManifest.version === "0.9.9.2"
  && oldManifest.assets?.length === 416
  && candidateManifest.assets?.length === 416
), {
  oldVersion: oldManifest.version,
  candidateVersion: candidateManifest.version,
  oldAssets: oldManifest.assets?.length,
  candidateAssets: candidateManifest.assets?.length,
});

const oldDistinctHashes = new Set(oldManifest.assets.map((asset) => asset.hash));
const candidateDistinctHashes = new Set(candidateManifest.assets.map((asset) => asset.hash));
record("candidate keeps the complete asset set and unchanged game hashes", (
  candidateManifest.assets.length === 416
  && candidateDistinctHashes.size === oldDistinctHashes.size
  && [...candidateDistinctHashes].every((hash) => oldDistinctHashes.has(hash))
), {
  oldDistinctHashes: oldDistinctHashes.size,
  candidateDistinctHashes: candidateDistinctHashes.size,
  oldBytes: oldManifest.assets.reduce((sum, asset) => sum + asset.bytes, 0),
  candidateBytes: candidateManifest.assets.reduce((sum, asset) => sum + asset.bytes, 0),
});

const save = createDefaultCampaignSave();
save.caps = 777;
save.supplies = 777;
save.updatedAt = "2026-08-10T00:00:00.000Z";
save.settings = { ...save.settings, bgmVolume: 0.42, sfxVolume: 0.37, graphicsQuality: "power-save" };
const saveFixture = serializeCampaignSave(save);

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}${basePath}/`;

function attachPageDiagnostics(page) {
  page.on("console", (message) => {
    if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(String(error)));
  page.on("response", (response) => {
    if (response.status() >= 400 && !response.url().includes("__qa/")) {
      diagnostics.httpErrors.push(`${response.url()} :: HTTP ${response.status()}`);
    }
  });
  page.on("requestfailed", (request) => {
    diagnostics.requestFailures.push(`${request.url()} :: ${request.failure()?.errorText ?? "unknown"}`);
  });
}

async function openPersistent(userDataDir) {
  const context = await browserType.launchPersistentContext(userDataDir, {
    headless: true,
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 3,
    hasTouch: true,
  });
  await context.addInitScript(({ key, raw }) => {
    Object.defineProperty(window.navigator, "standalone", { value: true, configurable: true });
    if (!window.localStorage.getItem(key)) window.localStorage.setItem(key, raw);
  }, { key: saveKey, raw: saveFixture });
  const page = await context.newPage();
  attachPageDiagnostics(page);
  return { context, page };
}

async function getWorkerState(page) {
  return page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    const ask = (message) => new Promise((resolve) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => resolve(null), 5000);
      channel.port1.onmessage = (event) => { clearTimeout(timer); resolve(event.data); };
      if (!registration.active) {
        clearTimeout(timer);
        resolve(null);
        return;
      }
      registration.active.postMessage(message, [channel.port2]);
    });
    return {
      scope: registration.scope,
      activeState: await ask({ type: "pwa:get-state" }),
      activeScriptURL: registration.active?.scriptURL ?? null,
      activeWorkerState: registration.active?.state ?? null,
      waitingScriptURL: registration.waiting?.scriptURL ?? null,
      waitingWorkerState: registration.waiting?.state ?? null,
    };
  });
}

async function waitForActiveVersion(page, version, timeoutMs = 120_000) {
  const started = Date.now();
  let state = null;
  while (Date.now() - started < timeoutMs) {
    state = await getWorkerState(page);
    if (state?.activeState?.active?.version === version) return state;
    await page.waitForTimeout(250);
  }
  return state;
}

async function manifestFromPage(page) {
  return page.evaluate(async () => {
    const response = await fetch(new URL("asset-manifest.json", location.href), { cache: "no-store" });
    return { ok: response.ok, status: response.status, manifest: await response.json() };
  });
}

async function cacheState(page) {
  return page.evaluate(async () => {
    const cache = await caches.open("zombieee-assets-v1");
    const keys = await cache.keys();
    return {
      assetEntries: keys.filter((request) => new URL(request.url).pathname.includes("/__pwa-asset__/" )).length,
      allEntries: keys.length,
    };
  });
}

async function saveState(page) {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    let parsed = null;
    try { parsed = raw ? JSON.parse(raw) : null; } catch { /* evidence reports raw absence only */ }
    return {
      raw,
      revision: parsed?.revision ?? null,
      caps: parsed?.caps ?? null,
      bgmVolume: parsed?.settings?.bgmVolume ?? null,
      sfxVolume: parsed?.settings?.sfxVolume ?? null,
    };
  }, saveKey);
}

async function clickAndWait(page, locator, timeoutMs = 300_000) {
  await locator.waitFor({ state: "visible", timeout: timeoutMs });
  await locator.click();
}

let context = null;
let page = null;
const userDataDir = await mkdtemp(path.join(os.tmpdir(), "zombieee-pwa-update-"));

try {
  ({ context, page } = await openPersistent(userDataDir));
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  const oldPageManifest = await manifestFromPage(page);
  record("existing profile initially loads the 0.9.9.1 manifest", (
    oldPageManifest.ok && oldPageManifest.status === 200 && oldPageManifest.manifest.version === oldManifest.version
  ), oldPageManifest);

  await clickAndWait(page, page.getByRole("button", { name: "ダウンロードを開始" }));
  await page.getByRole("button", { name: "ゲームを始める" }).waitFor({ state: "visible", timeout: 300_000 });
  const oldInstalled = await page.evaluate(async () => {
    const manifest = await (await fetch(new URL("asset-manifest.json", location.href), { cache: "no-store" })).json();
    const cache = await caches.open("zombieee-assets-v1");
    const keys = await cache.keys();
    return {
      version: manifest.version,
      assetCount: manifest.assets.length,
      distinctHashCount: new Set(manifest.assets.map((asset) => asset.hash)).size,
      assetCacheEntries: keys.filter((request) => new URL(request.url).pathname.includes("/__pwa-asset__/" )).length,
    };
  });
  record("the existing installed app completes the full old release pack", (
    oldInstalled.version === "0.9.9.1"
    && oldInstalled.assetCount === 416
    && oldInstalled.assetCacheEntries === oldInstalled.distinctHashCount
  ), oldInstalled);

  await page.getByRole("button", { name: "ゲームを始める" }).click();
  await page.locator(".game-shell, .game-frame").first().waitFor({ state: "visible", timeout: 60_000 });
  await page.waitForTimeout(500);
  const oldSave = await saveState(page);
  const oldWorker = await getWorkerState(page);
  record("the old installed profile has an active worker, correct scope, and a real save", (
    oldWorker.scope === `${new URL(baseUrl).origin}${scopePath}`
    && oldWorker.activeWorkerState === "activated"
    && oldWorker.activeState?.active?.version === "0.9.9.1"
    && typeof oldSave.raw === "string"
    && oldSave.raw.length > 0
  ), { oldWorker, oldSave: { ...oldSave, raw: oldSave.raw ? "present" : "missing" } });

  await context.close();
  context = null;
  const switched = await fetch(`http://127.0.0.1:${address.port}/__qa/switch?root=candidate`).then((response) => response.json());
  record("the same-origin server switches to the 0.9.9.2 candidate", switched.ok === true && switched.currentLabel === "candidate", switched);

  ({ context, page } = await openPersistent(userDataDir));
  const candidateAssetRequests = [];
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (/\/(?:art|audio|pwa-bundles)\//.test(pathname)) candidateAssetRequests.push(pathname);
  });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  const candidatePageManifest = await manifestFromPage(page);
  record("the existing profile sees the 0.9.9.2 manifest without reinstalling", (
    candidatePageManifest.ok
    && candidatePageManifest.status === 200
    && candidatePageManifest.manifest.version === "0.9.9.2"
    && candidatePageManifest.manifest.releaseSha === candidateManifest.releaseSha
  ), {
    version: candidatePageManifest.manifest.version,
    releaseSha: candidatePageManifest.manifest.releaseSha,
  });

  const waitingWorker = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    try { await registration.update(); } catch { /* the registration state below is evidence */ }
    const started = Date.now();
    while (!registration.waiting && Date.now() - started < 15_000) await new Promise((resolve) => setTimeout(resolve, 250));
    return {
      scope: registration.scope,
      waiting: Boolean(registration.waiting),
      waitingScriptURL: registration.waiting?.scriptURL ?? null,
      activeScriptURL: registration.active?.scriptURL ?? null,
    };
  });
  record("the candidate update produces a waiting worker at the same scope", (
    waitingWorker.waiting
    && waitingWorker.scope === `${new URL(baseUrl).origin}${scopePath}`
  ), waitingWorker);

  const updateButton = page.getByRole("button", { name: "更新をダウンロード" });
  const commitOnlyButton = page.getByRole("button", { name: "保存済みデータを反映" });
  const updateButtonCount = await updateButton.count();
  const commitOnlyButtonCount = await commitOnlyButton.count();
  record("the existing app exposes the safe update or commit-only control", (
    updateButtonCount === 1 || commitOnlyButtonCount === 1
  ), {
    updateButtonCount,
    commitOnlyButtonCount,
    commitOnly: commitOnlyButtonCount === 1,
  });
  const updateControl = updateButtonCount === 1 ? updateButton : commitOnlyButton;
  await updateControl.waitFor({ state: "visible", timeout: 120_000 });
  const updateAssetStart = candidateAssetRequests.length;
  await updateControl.click();
  const updatedWorker = await waitForActiveVersion(page, "0.9.9.2", 120_000);
  const candidateSave = await saveState(page);
  const candidateCache = await cacheState(page);
  record("the update commits 0.9.9.2 and activates the waiting worker", (
    updatedWorker?.activeState?.active?.version === "0.9.9.2"
    && updatedWorker.activeWorkerState === "activated"
    && updatedWorker.scope === `${new URL(baseUrl).origin}${scopePath}`
  ), updatedWorker);
  record("the update reuses the complete pack and preserves the save", (
    candidateCache.assetEntries === oldInstalled.distinctHashCount
    && candidateSave.raw === oldSave.raw
    && candidateSave.caps === oldSave.caps
    && candidateSave.bgmVolume === oldSave.bgmVolume
    && candidateSave.sfxVolume === oldSave.sfxVolume
  ), {
    candidateCache,
    oldAssetEntries: oldInstalled.assetCacheEntries,
    candidateAssetRequestsAfterClick: candidateAssetRequests.slice(updateAssetStart),
    savePreserved: candidateSave.raw === oldSave.raw,
  });
  record("the update does not re-fetch unchanged game assets", candidateAssetRequests.slice(updateAssetStart).length === 0, {
    requests: candidateAssetRequests.slice(updateAssetStart),
  });

  await context.close();
  context = null;
  ({ context, page } = await openPersistent(userDataDir));
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.locator(".game-shell, .game-frame").first().waitFor({ state: "visible", timeout: 60_000 });
  const relaunchedWorker = await getWorkerState(page);
  const relaunchedSave = await saveState(page);
  const relaunchedManifest = await manifestFromPage(page);
  record("a relaunch keeps the committed 0.9.9.2 generation and save", (
    relaunchedWorker.activeState?.active?.version === "0.9.9.2"
    && relaunchedManifest.manifest.version === "0.9.9.2"
    && relaunchedSave.raw === oldSave.raw
  ), { relaunchedWorker, savePreserved: relaunchedSave.raw === oldSave.raw });

  if (browserName === "chromium") {
    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.locator(".game-shell, .game-frame").first().waitFor({ state: "visible", timeout: 60_000 });
    const offlineWorker = await getWorkerState(page);
    const offlineSave = await saveState(page);
    record("Chromium offline relaunch serves the committed pack and preserves save", (
      offlineWorker.activeState?.active?.version === "0.9.9.2"
      && offlineSave.raw === oldSave.raw
    ), { offlineWorker, savePreserved: offlineSave.raw === oldSave.raw });
    await context.setOffline(false);
  } else {
    const storage = await cacheState(page);
    record("WebKit persistent update storage is retained (offline worker navigation is capability-limited)", (
      storage.assetEntries === oldInstalled.distinctHashCount
    ), { storage, capabilityLimit: "Headless WebKit offline emulation is not used as physical Safari evidence." });
  }

  const rollback = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return new Promise((resolve) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => resolve(null), 10_000);
      channel.port1.onmessage = (event) => { clearTimeout(timer); resolve(event.data); };
      registration.active.postMessage({ type: "pwa:rollback" }, [channel.port2]);
    });
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  // Rollback intentionally leaves the candidate metadata pending. The gate
  // may therefore be visible until the player explicitly re-commits or waits
  // for a matching publication; the invariant here is the restored worker
  // generation and preserved save, not an unsafe automatic game mount.
  await page.waitForTimeout(1_000);
  const rolledBackWorker = await getWorkerState(page);
  const rolledBackSave = await saveState(page);
  record("rollback restores the old generation without changing the save", (
    rollback?.type === "pwa:rolled-back"
    && rolledBackWorker.activeState?.active?.version === "0.9.9.1"
    && rolledBackSave.raw === oldSave.raw
  ), { rollback, rolledBackWorker, savePreserved: rolledBackSave.raw === oldSave.raw });
} catch (error) {
  record("persistent existing-PWA update flow completed without an unhandled harness error", false, {
    error: String(error?.stack ?? error),
  });
} finally {
  if (context) await context.close().catch(() => {});
  await new Promise((resolve) => server.close(resolve));
  const ignoredRequestFailures = ["ERR_ABORTED", "ERR_INTERNET_DISCONNECTED"];
  const unexpectedRequestFailures = diagnostics.requestFailures.filter(
    (failure) => !ignoredRequestFailures.some((ignored) => failure.includes(ignored)),
  );
  record("browser update flow has no console/page/HTTP/unexpected request failures", (
    diagnostics.consoleErrors.length === 0
    && diagnostics.pageErrors.length === 0
    && diagnostics.httpErrors.length === 0
    && unexpectedRequestFailures.length === 0
  ), {
    consoleErrors: diagnostics.consoleErrors,
    pageErrors: diagnostics.pageErrors,
    httpErrors: diagnostics.httpErrors,
    requestFailures: unexpectedRequestFailures,
  });
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(
    path.join(evidenceDir, `pwa-existing-update-${browserName}.json`),
    `${JSON.stringify({
      baseUrl,
      browser: browserName,
      oldRoot,
      candidateRoot,
      oldManifest: { version: oldManifest.version, releaseSha: oldManifest.releaseSha, assets: oldManifest.assets.length },
      candidateManifest: { version: candidateManifest.version, releaseSha: candidateManifest.releaseSha, assets: candidateManifest.assets.length },
      qaOnlyWaitingWorkerMarker: true,
      userDataDir,
      results,
      failures,
    }, null, 2)}\n`,
    "utf8",
  );
}

console.log(`\n${results.filter((result) => result.passed).length} / ${results.length} persistent PWA update cases passed`);
if (failures.length > 0) process.exitCode = 1;
