import { legacyQaUrl } from "./legacy-qa-url.mjs";
// Persistent existing-PWA update smoke.
//
// This is deliberately a two-release, same-origin test. The server switches
// between two already-built static roots; Playwright keeps one persistent
// profile so Service Worker registration, Cache Storage, IndexedDB, and
// localStorage survive the switch exactly as they do for an installed app.
// The candidate worker gets a harmless QA-only comment appended to its bytes so
// a real waiting-worker transition is observable without changing production
// public/sw.js.

import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { CAMPAIGN_STAGES, createDefaultCampaignSave, serializeCampaignSave } from "../app/campaign.js";
import { RELEASE_VERSION } from "../app/releaseIdentity.js";
import { V100_INITIAL_UNIT_IDS, V100_LEGACY_GIFT } from "../app/v100Registry.js";
import { V100_PRIMARY_STORAGE_KEY } from "../app/v100Save.js";
import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";
import { chromium, webkit } from "playwright";

const oldRootInput = process.env.PWA_EXISTING_UPDATE_OLD_ROOT;
const candidateRootInput = process.env.PWA_EXISTING_UPDATE_CANDIDATE_ROOT;
const oldRoot = path.resolve(oldRootInput ?? "");
const candidateRoot = path.resolve(candidateRootInput ?? "");
const browserName = process.env.PWA_EXISTING_UPDATE_BROWSER ?? "chromium";
const oldVersion = process.env.PWA_EXISTING_UPDATE_OLD_VERSION ?? "0.9.9.5";
const expectedOldReleaseSha = process.env.PWA_EXISTING_UPDATE_EXPECTED_OLD_SHA
  ?? "55d796cc577d1d9f903a4d2c6b4382196511db27";
const expectedCandidateReleaseSha = process.env.PWA_EXISTING_UPDATE_EXPECTED_CANDIDATE_SHA?.trim();
const evidenceDir = path.resolve(
  process.env.PWA_EXISTING_UPDATE_EVIDENCE_DIR ?? path.join(process.cwd(), "outputs", "pwa-existing-update"),
);
const basePath = "/Zombieee";
const saveKey = "nishijin-campaign-v1";
const v100SaveKey = V100_PRIMARY_STORAGE_KEY;
const scopePath = `${basePath}/`;
const browserType = { chromium, webkit }[browserName];

if (!oldRootInput || !candidateRootInput) throw new Error("PWA_EXISTING_UPDATE_OLD_ROOT and PWA_EXISTING_UPDATE_CANDIDATE_ROOT are required");
if (!browserType) throw new Error(`Unknown browser: ${browserName}`);
if (!/^[0-9a-f]{40}$/u.test(expectedCandidateReleaseSha ?? "")) {
  throw new Error("PWA_EXISTING_UPDATE_EXPECTED_CANDIDATE_SHA must be the exact 40-character candidate HEAD");
}

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
  teardown: [],
};
const images = [];
let diagnosticPhase = "setup";
let teardown = false;

function record(name, passed, detail = {}) {
  results.push({ name, passed, ...detail });
  if (!passed) failures.push({ name, ...detail });
  console.log(`[${passed ? "PASS" : "FAIL"}] ${name}${passed ? "" : ` :: ${JSON.stringify(detail)}`}`);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
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
const candidateNetworkAssetRequests = [];
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
    if (currentLabel === "candidate" && /\/(?:art|audio|pwa-bundles)\//.test(url.pathname)) {
      candidateNetworkAssetRequests.push(url.pathname);
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
  oldManifest.version === oldVersion
  && oldManifest.releaseSha === expectedOldReleaseSha
  && candidateManifest.version === RELEASE_VERSION
  && candidateManifest.releaseSha === expectedCandidateReleaseSha
  && oldManifest.assets?.length === 415
  && candidateManifest.assets?.length === 459
), {
  oldVersion: oldManifest.version,
  candidateVersion: candidateManifest.version,
  oldAssets: oldManifest.assets?.length,
  candidateAssets: candidateManifest.assets?.length,
});

const oldDistinctHashes = new Set(oldManifest.assets.map((asset) => asset.hash));
const candidateDistinctHashes = new Set(candidateManifest.assets.map((asset) => asset.hash));
const candidateByPath = new Map(candidateManifest.assets.map((asset) => [asset.path, asset]));
const unchangedOldAssets = oldManifest.assets.filter((asset) => {
  const candidate = candidateByPath.get(asset.path);
  return candidate
    && candidate.hash === asset.hash
    && candidate.bytes === asset.bytes
    && (candidate.sourcePath ?? null) === (asset.sourcePath ?? null)
    && (candidate.bundlePath ?? null) === (asset.bundlePath ?? null);
});
const candidateNewHashAssets = candidateManifest.assets.filter((asset) => !oldDistinctHashes.has(asset.hash));
const candidateNewHashes = new Set(candidateNewHashAssets.map((asset) => asset.hash));
const retainedCacheEntryCount = new Set([...oldDistinctHashes, ...candidateDistinctHashes]).size;
const candidateExpectedNetworkPaths = new Set(candidateNewHashAssets.map((asset) => (
  `${basePath}${asset.bundlePath ?? asset.sourcePath ?? asset.path}`
)));
record("candidate keeps the complete asset set and declares an exact hash delta", (
  oldDistinctHashes.size === 413
  && candidateDistinctHashes.size === 457
  && unchangedOldAssets.length === oldManifest.assets.length
  && candidateManifest.assets.length === 459
  && candidateNewHashAssets.length === 44
  && candidateNewHashAssets.reduce((sum, asset) => sum + asset.bytes, 0) === 14_821_106
  && candidateNewHashAssets.length === candidateNewHashes.size
  && candidateExpectedNetworkPaths.size === candidateNewHashes.size
), {
  oldDistinctHashes: oldDistinctHashes.size,
  candidateDistinctHashes: candidateDistinctHashes.size,
  changedHashes: candidateNewHashes.size,
  changedLogicalAssets: candidateNewHashAssets.length,
  changedBytes: candidateNewHashAssets.reduce((sum, asset) => sum + asset.bytes, 0),
  expectedNetworkPaths: [...candidateExpectedNetworkPaths].sort(),
  oldBytes: oldManifest.assets.reduce((sum, asset) => sum + asset.bytes, 0),
  candidateBytes: candidateManifest.assets.reduce((sum, asset) => sum + asset.bytes, 0),
});

const save = createDefaultCampaignSave();
save.campaignStarted = true;
save.caps = 777;
save.supplies = 654;
save.completedStageIds = CAMPAIGN_STAGES.slice(0, 2).map((stage) => stage.id);
save.bestStarsByStage = {
  [CAMPAIGN_STAGES[0].id]: 3,
  [CAMPAIGN_STAGES[1].id]: 2,
};
save.unlockedStageIds = CAMPAIGN_STAGES.slice(0, 3).map((stage) => stage.id);
save.formationPresets = save.formationPresets.map((preset, index) => (
  index === 0 ? { ...preset, unitIds: ["unit-paisen", "unit-hachi", "unit-nao"] } : preset
));
save.readStoryEventIds = ["story-prologue-v070", "story-stage1-intro-v070"];
save.updatedAt = "2026-08-10T00:00:00.000Z";
save.settings = {
  ...save.settings,
  bgmEnabled: false,
  sfxEnabled: false,
  bgmVolume: 0.42,
  sfxVolume: 0.37,
  graphicsQuality: "power-save",
};
const saveFixture = serializeCampaignSave(save);
const saveFixtureHash = sha256(saveFixture);

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}${basePath}/`;

function attachPageDiagnostics(page) {
  page.on("console", (message) => {
    if (message.type() === "error") {
      const entry = { phase: diagnosticPhase, message: message.text() };
      (teardown ? diagnostics.teardown : diagnostics.consoleErrors).push(entry);
    }
  });
  page.on("pageerror", (error) => {
    const entry = { phase: diagnosticPhase, error: String(error) };
    (teardown ? diagnostics.teardown : diagnostics.pageErrors).push(entry);
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && !response.url().includes("__qa/")) {
      const entry = { phase: diagnosticPhase, url: response.url(), status: response.status() };
      (teardown ? diagnostics.teardown : diagnostics.httpErrors).push(entry);
    }
  });
  page.on("requestfailed", (request) => {
    const entry = {
      phase: diagnosticPhase,
      url: request.url(),
      error: request.failure()?.errorText ?? "unknown",
    };
    (teardown ? diagnostics.teardown : diagnostics.requestFailures).push(entry);
  });
}

async function openPersistent(userDataDir) {
  const context = await browserType.launchPersistentContext(userDataDir, {
    headless: true,
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 3,
    hasTouch: true,
  });
  await context.addInitScript(({ key, raw, legacyKeys }) => {
    Object.defineProperty(window.navigator, "standalone", { value: true, configurable: true });
    if (!window.localStorage.getItem(key)) window.localStorage.setItem(key, raw);
    window.__PWA_EXISTING_LEGACY_WRITES__ = [];
    for (const method of ["setItem", "removeItem", "clear"]) {
      const native = Storage.prototype[method];
      Storage.prototype[method] = function (...args) {
        if (this === localStorage && (method === "clear" || legacyKeys.includes(String(args[0])))) {
          window.__PWA_EXISTING_LEGACY_WRITES__.push({ store: "local", method, key: args[0] ?? null });
        }
        return native.apply(this, args);
      };
    }
    for (const method of ["put", "add", "delete", "clear"]) {
      const native = IDBObjectStore.prototype[method];
      IDBObjectStore.prototype[method] = function (...args) {
        if (this.transaction.db.name === "nishijin-campaign-backup") {
          window.__PWA_EXISTING_LEGACY_WRITES__.push({ store: "indexed", method });
        }
        return native.apply(this, args);
      };
    }
  }, {
    key: saveKey,
    raw: saveFixture,
    legacyKeys: [saveKey, `${saveKey}::last-known-good`, `${saveKey}::pre-migration`],
  });
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
    if (state?.activeState?.active?.version === version && state.activeWorkerState === "activated") return state;
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
  return page.evaluate(async (assets) => {
    const cache = await caches.open("zombieee-assets-v1");
    const keys = await cache.keys();
    const hashes = new Set(keys
      .filter((request) => new URL(request.url).pathname.includes("/__pwa-asset__/"))
      .map((request) => new URL(request.url).pathname.split("/").pop()));
    return {
      assetEntries: hashes.size,
      logicalSatisfied: assets.filter((asset) => hashes.has(asset.hash)).length,
      allEntries: keys.length,
    };
  }, candidateManifest.assets);
}

function workerSummary(state) {
  return {
    scope: state?.scope ?? null,
    activeScriptURL: state?.activeScriptURL ?? null,
    activeWorkerState: state?.activeWorkerState ?? null,
    waitingScriptURL: state?.waitingScriptURL ?? null,
    waitingWorkerState: state?.waitingWorkerState ?? null,
    active: state?.activeState?.active ? {
      version: state.activeState.active.version,
      releaseSha: state.activeState.active.releaseSha,
      assets: state.activeState.active.assets?.length ?? null,
    } : null,
    previous: state?.activeState?.previous ? {
      version: state.activeState.previous.version,
      releaseSha: state.activeState.previous.releaseSha,
      assets: state.activeState.previous.assets?.length ?? null,
    } : null,
  };
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

async function v100State(page) {
  return page.evaluate(async ({ key, oldKey }) => {
    const raw = localStorage.getItem(key);
    const mirror = raw ? JSON.parse(raw) : null;
    const native = await new Promise((resolve, reject) => {
      const request = indexedDB.open(key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction("saves", "readonly");
        const get = transaction.objectStore("saves").get("current");
        let record = null;
        get.onsuccess = () => { record = get.result ?? null; };
        transaction.oncomplete = () => {
          db.close();
          resolve({ database: db.name, record });
        };
        transaction.onabort = () => reject(transaction.error);
      };
    });
    return {
      raw,
      mirror,
      native,
      oldRaw: localStorage.getItem(oldKey),
      legacyWrites: [...(window.__PWA_EXISTING_LEGACY_WRITES__ ?? [])],
    };
  }, { key: v100SaveKey, oldKey: saveKey });
}

async function waitForV100Ready(page) {
  await page.waitForFunction(() => (
    document.querySelector(".v100-shell")
    && document.documentElement.dataset.pwaSaveMutationPending === "false"
  ), null, { timeout: 60_000 });
}

async function screenshot(page, label) {
  const file = path.join(evidenceDir, `${browserName}-${label}.png`);
  const bytes = await page.screenshot({ path: file, animations: "disabled" });
  images.push({
    file,
    sha256: sha256(bytes),
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  });
}

async function closeContext(label) {
  if (!context) return;
  diagnosticPhase = label;
  teardown = true;
  await context.close();
  context = null;
  teardown = false;
}

async function clickAndWait(page, locator, timeoutMs = 300_000) {
  await locator.waitFor({ state: "visible", timeout: timeoutMs });
  await locator.click();
}

let context = null;
let page = null;
const userDataDir = await mkdtemp(path.join(os.tmpdir(), "zombieee-pwa-update-"));
await mkdir(evidenceDir, { recursive: true });

try {
  ({ context, page } = await openPersistent(userDataDir));
  diagnosticPhase = "old-install-entry";
  await page.goto(legacyQaUrl(baseUrl), { waitUntil: "domcontentloaded" });
  const oldPageManifest = await manifestFromPage(page);
  record(`existing profile initially loads the ${oldVersion} manifest`, (
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
    oldInstalled.version === oldVersion
    && oldInstalled.assetCount === oldManifest.assets.length
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
    && oldWorker.activeState?.active?.version === oldVersion
    && typeof oldSave.raw === "string"
    && oldSave.raw.length > 0
    && sha256(oldSave.raw) === saveFixtureHash
  ), { oldWorker, oldSave: { ...oldSave, raw: oldSave.raw ? "present" : "missing", sha256: sha256(oldSave.raw ?? "") } });
  await screenshot(page, "old-installed");

  await closeContext("close-old-installed");
  const switched = await fetch(`http://127.0.0.1:${address.port}/__qa/switch?root=candidate`).then((response) => response.json());
  record(`the same-origin server switches to the ${RELEASE_VERSION} candidate`, switched.ok === true && switched.currentLabel === "candidate", switched);

  ({ context, page } = await openPersistent(userDataDir));
  const candidateAssetRequests = [];
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (/\/(?:art|audio|pwa-bundles)\//.test(pathname)) candidateAssetRequests.push(pathname);
  });
  diagnosticPhase = "candidate-unqualified-entry";
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  const candidatePageManifest = await manifestFromPage(page);
  record(`the existing profile sees the ${RELEASE_VERSION} manifest without reinstalling`, (
    candidatePageManifest.ok
    && candidatePageManifest.status === 200
    && candidatePageManifest.manifest.version === RELEASE_VERSION
    && candidatePageManifest.manifest.releaseSha === candidateManifest.releaseSha
  ), {
    version: candidatePageManifest.manifest.version,
    releaseSha: candidatePageManifest.manifest.releaseSha,
  });

  await waitForV100Ready(page);
  const gift = page.getByRole("dialog", { name: "新しい作戦記録を開始しました", exact: true });
  await gift.waitFor({ state: "visible", timeout: 60_000 });
  const updateButton = page.getByRole("button", { name: "更新をダウンロード", exact: true });
  const updateDeferredDuringGift = await updateButton.count() === 0;
  const giftConfirmation = gift.getByRole("button", { name: "確認する", exact: true });
  await page.waitForFunction(() => {
    const button = [...document.querySelectorAll("button")].find((entry) => entry.textContent?.trim() === "確認する");
    return button instanceof HTMLButtonElement && !button.disabled;
  }, null, { timeout: 60_000 });
  const beforeUpdateV100 = await v100State(page);
  const nativeBeforeUpdate = beforeUpdateV100.native?.record?.serialized
    ? JSON.parse(beforeUpdateV100.native.record.serialized)
    : null;
  const expectedInitialUnits = [...V100_INITIAL_UNIT_IDS].sort();
  record("the unqualified V1 root claims one visible legacy gift without importing legacy progression", (
    updateDeferredDuringGift
    && beforeUpdateV100.oldRaw === oldSave.raw
    && beforeUpdateV100.mirror?.caps === V100_LEGACY_GIFT.amountCaps
    && beforeUpdateV100.mirror?.campaignStarted === false
    && beforeUpdateV100.mirror?.completedStageIds?.length === 0
    && beforeUpdateV100.mirror?.ownedUnitIds?.slice().sort().join("|") === expectedInitialUnits.join("|")
    && beforeUpdateV100.mirror?.settings?.bgmEnabled === false
    && beforeUpdateV100.mirror?.settings?.sfxEnabled === false
    && beforeUpdateV100.mirror?.settings?.bgmVolume === 0.42
    && beforeUpdateV100.mirror?.settings?.sfxVolume === 0.37
    && beforeUpdateV100.mirror?.settings?.graphicsQuality === "power-save"
    && beforeUpdateV100.mirror?.receipts?.filter((id) => id === V100_LEGACY_GIFT.entitlementReceipt).length === 1
    && beforeUpdateV100.mirror?.receipts?.filter((id) => id === V100_LEGACY_GIFT.popupReceipt).length === 1
    && beforeUpdateV100.mirror?.legacy?.popupAcknowledged === true
    && beforeUpdateV100.native?.database === v100SaveKey
    && JSON.stringify(nativeBeforeUpdate) === JSON.stringify(beforeUpdateV100.mirror)
    && beforeUpdateV100.legacyWrites.length === 0
  ), {
    updateDeferredDuringGift,
    oldSavePreserved: beforeUpdateV100.oldRaw === oldSave.raw,
    mirror: beforeUpdateV100.mirror,
    nativeDatabase: beforeUpdateV100.native?.database ?? null,
    legacyWrites: beforeUpdateV100.legacyWrites,
  });
  await screenshot(page, "v1-gift-before-update");
  await giftConfirmation.click();
  await gift.waitFor({ state: "detached", timeout: 30_000 });
  await waitForV100Ready(page);
  await updateButton.waitFor({ state: "visible", timeout: 60_000 });

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

  const commitOnlyButton = page.getByRole("button", { name: "保存済みデータを反映", exact: true });
  const updateButtonCount = await updateButton.count();
  const commitOnlyButtonCount = await commitOnlyButton.count();
  const updateEnabledAfterGift = updateButtonCount === 1 && await updateButton.isEnabled();
  record("the existing app exposes the safe enabled update control after gift acknowledgement", (
    updateButtonCount === 1 && commitOnlyButtonCount === 0 && updateEnabledAfterGift
  ), {
    updateButtonCount,
    commitOnlyButtonCount,
    updateEnabledAfterGift,
  });
  const updateControl = updateButton;
  await updateControl.waitFor({ state: "visible", timeout: 120_000 });
  await screenshot(page, "v1-update-ready");
  const updateAssetStart = candidateAssetRequests.length;
  const updateNetworkAssetStart = candidateNetworkAssetRequests.length;
  await updateControl.click();
  diagnosticPhase = "candidate-update-download";
  const updatedWorker = await waitForActiveVersion(page, RELEASE_VERSION, 120_000);
  const startUpdatedGame = page.getByRole("button", { name: "ゲームを始める", exact: true });
  await startUpdatedGame.waitFor({ state: "visible", timeout: 120_000 });
  await screenshot(page, "v1-update-complete");
  await startUpdatedGame.click();
  await waitForV100Ready(page);
  const candidateLegacySave = await saveState(page);
  const candidateV100 = await v100State(page);
  const candidateCache = await cacheState(page);
  const candidateNetworkRequestsAfterClick = candidateNetworkAssetRequests.slice(updateNetworkAssetStart);
  const candidateNetworkRequestSet = new Set(candidateNetworkRequestsAfterClick);
  const unexpectedCandidateNetworkRequests = [...candidateNetworkRequestSet]
    .filter((pathname) => !candidateExpectedNetworkPaths.has(pathname));
  const missingCandidateNetworkRequests = [...candidateExpectedNetworkPaths]
    .filter((pathname) => !candidateNetworkRequestSet.has(pathname));
  record(`the update commits ${RELEASE_VERSION} and activates the waiting worker`, (
    updatedWorker?.activeState?.active?.version === RELEASE_VERSION
    && updatedWorker.activeWorkerState === "activated"
    && updatedWorker.scope === `${new URL(baseUrl).origin}${scopePath}`
    && updatedWorker.activeState?.previous?.version === oldVersion
  ), workerSummary(updatedWorker));
  record("the update reuses the complete pack and preserves both save owners", (
    candidateCache.assetEntries === retainedCacheEntryCount
    && candidateCache.logicalSatisfied === candidateManifest.assets.length
    && candidateLegacySave.raw === oldSave.raw
    && candidateV100.raw === beforeUpdateV100.raw
    && candidateV100.oldRaw === oldSave.raw
    && candidateV100.legacyWrites.length === 0
  ), {
    candidateCache,
    oldAssetEntries: oldInstalled.assetCacheEntries,
    expectedRetainedAssetEntries: retainedCacheEntryCount,
    candidateAssetRequestsAfterClick: candidateAssetRequests.slice(updateAssetStart),
    candidateNetworkRequestsAfterClick,
    legacySavePreserved: candidateLegacySave.raw === oldSave.raw,
    v100SavePreserved: candidateV100.raw === beforeUpdateV100.raw,
    legacyWrites: candidateV100.legacyWrites,
  });
  record("the update fetches every changed hash exactly through its preferred source and no unchanged hash", (
    unexpectedCandidateNetworkRequests.length === 0
    && missingCandidateNetworkRequests.length === 0
    && candidateNetworkRequestsAfterClick.length === candidateExpectedNetworkPaths.size
  ), {
    expected: [...candidateExpectedNetworkPaths].sort(),
    actual: candidateNetworkRequestsAfterClick,
    unexpected: unexpectedCandidateNetworkRequests,
    missing: missingCandidateNetworkRequests,
  });
  await screenshot(page, "v1-update-committed");

  await closeContext("close-candidate-committed");
  ({ context, page } = await openPersistent(userDataDir));
  diagnosticPhase = "candidate-relaunch";
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await waitForV100Ready(page);
  await page.locator(".v100-shell").waitFor({ state: "visible", timeout: 60_000 });
  const relaunchedWorker = await getWorkerState(page);
  const relaunchedSave = await saveState(page);
  const relaunchedV100 = await v100State(page);
  const relaunchedManifest = await manifestFromPage(page);
  record(`an unqualified relaunch keeps the committed ${RELEASE_VERSION} generation and both saves`, (
    relaunchedWorker.activeState?.active?.version === RELEASE_VERSION
    && relaunchedManifest.manifest.version === RELEASE_VERSION
    && relaunchedSave.raw === oldSave.raw
    && relaunchedV100.raw === beforeUpdateV100.raw
    && relaunchedV100.legacyWrites.length === 0
    && await page.getByRole("dialog", { name: "新しい作戦記録を開始しました", exact: true }).count() === 0
  ), {
    relaunchedWorker: workerSummary(relaunchedWorker),
    legacySavePreserved: relaunchedSave.raw === oldSave.raw,
    v100SavePreserved: relaunchedV100.raw === beforeUpdateV100.raw,
    legacyWrites: relaunchedV100.legacyWrites,
  });

  if (browserName === "chromium") {
    diagnosticPhase = "candidate-offline-relaunch";
    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
    await waitForV100Ready(page);
    await page.locator(".v100-shell").waitFor({ state: "visible", timeout: 60_000 });
    const offlineWorker = await getWorkerState(page);
    const offlineSave = await saveState(page);
    const offlineV100 = await v100State(page);
    record("Chromium offline relaunch serves the committed V1 pack and preserves both saves", (
      offlineWorker.activeState?.active?.version === RELEASE_VERSION
      && offlineSave.raw === oldSave.raw
      && offlineV100.raw === beforeUpdateV100.raw
      && offlineV100.legacyWrites.length === 0
    ), {
      offlineWorker: workerSummary(offlineWorker),
      legacySavePreserved: offlineSave.raw === oldSave.raw,
      v100SavePreserved: offlineV100.raw === beforeUpdateV100.raw,
      legacyWrites: offlineV100.legacyWrites,
    });
    await screenshot(page, "v1-offline-relaunch");
    await context.setOffline(false);
  } else {
    const storage = await cacheState(page);
    record("WebKit persistent update storage is retained (offline worker navigation is capability-limited)", (
      storage.assetEntries === retainedCacheEntryCount
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
  diagnosticPhase = "manifest-rollback-reload";
  await page.reload({ waitUntil: "domcontentloaded" });
  // Rollback intentionally leaves the candidate metadata pending. The gate
  // may therefore be visible until the player explicitly re-commits or waits
  // for a matching publication; the invariant here is the restored worker
  // generation and preserved save, not an unsafe automatic game mount.
  await page.waitForTimeout(1_000);
  const rolledBackWorker = await getWorkerState(page);
  const rolledBackSave = await saveState(page);
  await page.getByRole("button", { name: "保存済みデータを反映", exact: true }).waitFor({ state: "visible", timeout: 60_000 });
  const rolledBackV100 = await v100State(page);
  record("rollback restores the old generation without changing either save", (
    rollback?.type === "pwa:rolled-back"
    && rolledBackWorker.activeState?.active?.version === oldVersion
    && rolledBackSave.raw === oldSave.raw
    && rolledBackV100.raw === beforeUpdateV100.raw
    && rolledBackV100.legacyWrites.length === 0
  ), {
    rollback,
    rolledBackWorker: workerSummary(rolledBackWorker),
    legacySavePreserved: rolledBackSave.raw === oldSave.raw,
    v100SavePreserved: rolledBackV100.raw === beforeUpdateV100.raw,
    legacyWrites: rolledBackV100.legacyWrites,
  });
  await screenshot(page, "rollback-commit-required");
} catch (error) {
  await screenshot(page, "failure").catch(() => {});
  record("persistent existing-PWA update flow completed without an unhandled harness error", false, {
    error: String(error?.stack ?? error),
  });
} finally {
  if (context) await closeContext("final-context-close").catch(() => {});
  await new Promise((resolve) => server.close(resolve));
  record("browser update flow has no runtime console/page/HTTP/request failures", (
    diagnostics.consoleErrors.length === 0
    && diagnostics.pageErrors.length === 0
    && diagnostics.httpErrors.length === 0
    && diagnostics.requestFailures.length === 0
  ), {
    consoleErrors: diagnostics.consoleErrors,
    pageErrors: diagnostics.pageErrors,
    httpErrors: diagnostics.httpErrors,
    requestFailures: diagnostics.requestFailures,
  });
  record("context teardown has no late diagnostics", diagnostics.teardown.length === 0, {
    teardown: diagnostics.teardown,
  });
  await mkdir(evidenceDir, { recursive: true });
  const sourceFiles = [
    "scripts/pwa-existing-update-browser-smoke.mjs",
    "app/PwaGate.tsx",
    "app/GameEntry.tsx",
    "app/v100Save.js",
    "app/v100CampaignStorage.js",
  ];
  const sources = [];
  for (const file of sourceFiles) {
    sources.push({ file, sha256: sha256(await readFile(new URL(`../${file}`, import.meta.url))) });
  }
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
      sourceBoundary: {
        oldRoot: "immutable-tag-source local rebuild; published Pages artifact expired; not byte-identical published shell",
        candidateRoot: "exact local static candidate",
      },
      userDataDir,
      saveFixtureSha256: saveFixtureHash,
      sources,
      build: await productionBuildIdentity(),
      images,
      diagnostics,
      results,
      failures,
    }, null, 2)}\n`,
    "utf8",
  );
}

console.log(`\n${results.filter((result) => result.passed).length} / ${results.length} persistent PWA update cases passed`);
if (failures.length > 0) process.exitCode = 1;
