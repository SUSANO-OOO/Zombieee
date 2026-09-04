// Preserve a real already-installed public profile across the V1 publication.
//
// prepare: while official Pages still serves 0.9.9.5, create one fresh named
// persistent profile, seed a valid played legacy save before the first origin
// load, install every published asset, and seal an immutable companion record.
// verify: after the approved V1 publication, reopen that exact profile and
// prove the real published gift/update/offline/rollback-recovery path.

import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { CAMPAIGN_STAGES, createDefaultCampaignSave, serializeCampaignSave } from "../app/campaign.js";
import { V100_INITIAL_UNIT_IDS, V100_LEGACY_GIFT } from "../app/v100Registry.js";
import { V100_PRIMARY_STORAGE_KEY } from "../app/v100Save.js";
import { chromium, webkit } from "playwright";

const mode = process.env.PWA_OFFICIAL_PROFILE_MODE ?? "prepare";
const browserName = process.env.PWA_OFFICIAL_PROFILE_BROWSER ?? "chromium";
const browserType = { chromium, webkit }[browserName];
const officialUrl = new URL(process.env.PWA_OFFICIAL_PROFILE_URL ?? "https://susano-ooo.github.io/Zombieee/");
const profileInput = process.env.PWA_OFFICIAL_PROFILE_DIR;
const evidenceInput = process.env.PWA_OFFICIAL_PROFILE_EVIDENCE_DIR;
const profileDir = path.resolve(profileInput ?? "");
const evidenceDir = path.resolve(evidenceInput ?? "");
const contractPath = path.resolve(process.env.PWA_OFFICIAL_PROFILE_CONTRACT ?? `${profileDir}.contract.json`);
const oldVersion = "0.9.9.5";
const oldReleaseSha = "55d796cc577d1d9f903a4d2c6b4382196511db27";
const oldRequestId = "v0.9.9.5-55d796c-20260814T0011Z";
const oldIssue = "165";
const candidateVersion = process.env.PWA_OFFICIAL_PROFILE_EXPECTED_VERSION ?? "1.0.0";
const candidateReleaseSha = process.env.PWA_OFFICIAL_PROFILE_EXPECTED_SHA?.trim() ?? "";
const candidateRequestId = process.env.PWA_OFFICIAL_PROFILE_EXPECTED_REQUEST_ID?.trim() ?? "";
const candidateIssue = process.env.PWA_OFFICIAL_PROFILE_EXPECTED_ISSUE?.trim() ?? "";
const legacySaveKey = "nishijin-campaign-v1";
const v100SaveKey = V100_PRIMARY_STORAGE_KEY;

if (!['prepare', 'verify'].includes(mode)) throw new Error("PWA_OFFICIAL_PROFILE_MODE must be prepare or verify");
if (!browserType) throw new Error(`Unknown browser: ${browserName}`);
if (!profileInput || !evidenceInput) throw new Error("PWA_OFFICIAL_PROFILE_DIR and PWA_OFFICIAL_PROFILE_EVIDENCE_DIR are required");
if (officialUrl.protocol !== "https:" || officialUrl.pathname !== "/Zombieee/") {
  throw new Error("PWA_OFFICIAL_PROFILE_URL must be the exact official HTTPS root ending /Zombieee/");
}
// WebKit/Chromium CacheStorage backends add several hashed directories below
// userDataDir. On Windows an already-long worktree path can make Cache.open()
// fail with an internal error even though page navigation succeeds. Keep the
// retained profile at a short named workspace path and fail before first load;
// otherwise the irreplaceable public-old baseline would be contaminated.
if (process.platform === "win32" && profileDir.length > 96) {
  throw new Error(`Windows persistent profile path must be 96 characters or shorter (actual ${profileDir.length})`);
}
if (mode === "verify" && (
  !/^[0-9a-f]{40}$/u.test(candidateReleaseSha)
  || !candidateRequestId
  || !/^\d+$/u.test(candidateIssue)
)) {
  throw new Error("verify requires exact candidate SHA, request ID, and numeric Issue");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function directoryEntries(target) {
  return readdir(target).catch((error) => error?.code === "ENOENT" ? [] : Promise.reject(error));
}

if ((await directoryEntries(evidenceDir)).length > 0) throw new Error(`Evidence directory must be new or empty: ${evidenceDir}`);
if (mode === "prepare") {
  if ((await directoryEntries(profileDir)).length > 0) throw new Error(`Prepare refuses a nonempty profile: ${profileDir}`);
  if (await stat(contractPath).catch(() => null)) throw new Error(`Prepare refuses an existing contract: ${contractPath}`);
} else {
  if ((await directoryEntries(profileDir)).length === 0) throw new Error(`Verify requires the retained nonempty profile: ${profileDir}`);
  await stat(contractPath);
}
await mkdir(path.dirname(profileDir), { recursive: true });
await mkdir(evidenceDir, { recursive: true });

const legacySave = createDefaultCampaignSave();
legacySave.campaignStarted = true;
legacySave.caps = 777;
legacySave.supplies = 654;
legacySave.completedStageIds = CAMPAIGN_STAGES.slice(0, 2).map((stage) => stage.id);
legacySave.bestStarsByStage = {
  [CAMPAIGN_STAGES[0].id]: 3,
  [CAMPAIGN_STAGES[1].id]: 2,
};
legacySave.unlockedStageIds = CAMPAIGN_STAGES.slice(0, 3).map((stage) => stage.id);
legacySave.formationPresets = legacySave.formationPresets.map((preset, index) => (
  index === 0 ? { ...preset, unitIds: ["unit-paisen", "unit-hachi", "unit-nao"] } : preset
));
legacySave.readStoryEventIds = ["story-prologue-v070", "story-stage1-intro-v070"];
legacySave.updatedAt = "2026-08-10T00:00:00.000Z";
legacySave.settings = {
  ...legacySave.settings,
  bgmEnabled: false,
  sfxEnabled: false,
  bgmVolume: 0.42,
  sfxVolume: 0.37,
  graphicsQuality: "power-save",
};
const legacySaveRaw = serializeCampaignSave(legacySave);
const legacySaveSha256 = sha256(legacySaveRaw);

const results = [];
const failures = [];
const images = [];
const diagnostics = { consoleErrors: [], pageErrors: [], httpErrors: [], requestFailures: [], teardown: [] };
let phase = "setup";
let teardown = false;
let context = null;

function record(name, passed, detail = {}) {
  const entry = { name, passed, ...detail };
  results.push(entry);
  if (!passed) failures.push({ name, ...detail });
  console.log(`[${passed ? "PASS" : "FAIL"}] ${name}${passed ? "" : ` :: ${JSON.stringify(detail)}`}`);
}

function attachDiagnostics(page) {
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    (teardown ? diagnostics.teardown : diagnostics.consoleErrors).push({ phase, message: message.text() });
  });
  page.on("pageerror", (error) => {
    (teardown ? diagnostics.teardown : diagnostics.pageErrors).push({ phase, error: String(error) });
  });
  page.on("response", (response) => {
    if (response.status() < 400) return;
    (teardown ? diagnostics.teardown : diagnostics.httpErrors).push({ phase, url: response.url(), status: response.status() });
  });
  page.on("requestfailed", (request) => {
    (teardown ? diagnostics.teardown : diagnostics.requestFailures).push({
      phase,
      url: request.url(),
      error: request.failure()?.errorText ?? "unknown",
    });
  });
}

async function openProfile({ seed }) {
  const opened = await browserType.launchPersistentContext(profileDir, {
    headless: true,
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 3,
    hasTouch: true,
  });
  await opened.addInitScript(({ seed, key, raw, legacyKeys }) => {
    Object.defineProperty(window.navigator, "standalone", { value: true, configurable: true });
    if (seed && !window.localStorage.getItem(key)) window.localStorage.setItem(key, raw);
    window.__PWA_OFFICIAL_LEGACY_WRITES__ = [];
    for (const method of ["setItem", "removeItem", "clear"]) {
      const native = Storage.prototype[method];
      Storage.prototype[method] = function (...args) {
        if (this === localStorage && (method === "clear" || legacyKeys.includes(String(args[0])))) {
          window.__PWA_OFFICIAL_LEGACY_WRITES__.push({ store: "local", method, key: args[0] ?? null });
        }
        return native.apply(this, args);
      };
    }
    for (const method of ["put", "add", "delete", "clear"]) {
      const native = IDBObjectStore.prototype[method];
      IDBObjectStore.prototype[method] = function (...args) {
        if (this.transaction.db.name === "nishijin-campaign-backup") {
          window.__PWA_OFFICIAL_LEGACY_WRITES__.push({ store: "indexed", method });
        }
        return native.apply(this, args);
      };
    }
  }, {
    seed,
    key: legacySaveKey,
    raw: legacySaveRaw,
    legacyKeys: [legacySaveKey, `${legacySaveKey}::last-known-good`, `${legacySaveKey}::pre-migration`],
  });
  const page = opened.pages()[0] ?? await opened.newPage();
  attachDiagnostics(page);
  return { context: opened, page };
}

async function closeProfile(label) {
  if (!context) return;
  phase = label;
  teardown = true;
  await context.close();
  context = null;
  teardown = false;
}

async function screenshot(page, label) {
  const file = path.join(evidenceDir, `${mode}-${browserName}-${label}.png`);
  const bytes = await page.screenshot({ path: file, animations: "disabled" });
  images.push({
    file: path.basename(file),
    sha256: sha256(bytes),
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  });
}

function metaValue(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(`<meta\\s+name=["']${escaped}["']\\s+content=["']([^"']*)["']`, "iu").exec(html)?.[1] ?? null;
}

async function readPublishedIdentity(openedContext) {
  const nonce = `official-profile-${Date.now()}`;
  const headers = { "cache-control": "no-cache", pragma: "no-cache" };
  const [htmlResponse, manifestResponse] = await Promise.all([
    openedContext.request.get(`${officialUrl.toString()}?${nonce}`, { headers }),
    openedContext.request.get(new URL(`asset-manifest.json?${nonce}`, officialUrl).toString(), { headers }),
  ]);
  const htmlBytes = await htmlResponse.body();
  const manifestBytes = await manifestResponse.body();
  const html = htmlBytes.toString("utf8");
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  return {
    htmlStatus: htmlResponse.status(),
    manifestStatus: manifestResponse.status(),
    htmlBytes: htmlBytes.byteLength,
    htmlSha256: sha256(htmlBytes),
    manifestBytes: manifestBytes.byteLength,
    manifestSha256: sha256(manifestBytes),
    version: metaValue(html, "github-pages-version"),
    releaseSha: metaValue(html, "github-pages-release"),
    requestId: metaValue(html, "github-pages-request-id"),
    issue: metaValue(html, "github-pages-issue"),
    base: metaValue(html, "github-pages-base"),
    manifest,
  };
}

async function getWorkerState(page) {
  return page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    const ask = (message) => new Promise((resolve) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => resolve(null), 5000);
      channel.port1.onmessage = (event) => { clearTimeout(timer); resolve(event.data ?? null); };
      const worker = registration.active ?? registration.waiting ?? registration.installing;
      if (!worker) { clearTimeout(timer); resolve(null); return; }
      worker.postMessage(message, [channel.port2]);
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

function workerSummary(state) {
  const summarize = (manifest) => manifest ? {
    version: manifest.version,
    releaseSha: manifest.releaseSha,
    assets: manifest.assets?.length ?? null,
  } : null;
  return {
    scope: state?.scope ?? null,
    activeScriptURL: state?.activeScriptURL ?? null,
    activeWorkerState: state?.activeWorkerState ?? null,
    waitingScriptURL: state?.waitingScriptURL ?? null,
    waitingWorkerState: state?.waitingWorkerState ?? null,
    active: summarize(state?.activeState?.active),
    previous: summarize(state?.activeState?.previous),
    storedHashes: state?.activeState?.storedHashes?.length ?? null,
  };
}

async function waitForActiveVersion(page, version, timeoutMs = 180_000) {
  const started = Date.now();
  let state = null;
  while (Date.now() - started < timeoutMs) {
    state = await getWorkerState(page);
    if (state?.activeState?.active?.version === version && state.activeWorkerState === "activated") return state;
    await page.waitForTimeout(250);
  }
  return state;
}

async function cacheState(page, manifest) {
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
  }, manifest.assets);
}

async function legacyState(page) {
  return page.evaluate((key) => ({
    raw: localStorage.getItem(key),
    legacyWrites: [...(window.__PWA_OFFICIAL_LEGACY_WRITES__ ?? [])],
  }), legacySaveKey);
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
        transaction.oncomplete = () => { db.close(); resolve({ database: db.name, record }); };
        transaction.onabort = () => reject(transaction.error);
      };
    });
    return {
      raw,
      mirror,
      native,
      oldRaw: localStorage.getItem(oldKey),
      legacyWrites: [...(window.__PWA_OFFICIAL_LEGACY_WRITES__ ?? [])],
    };
  }, { key: v100SaveKey, oldKey: legacySaveKey });
}

async function waitForV100Ready(page) {
  await page.waitForFunction(() => (
    document.querySelector(".v100-shell")
    && document.documentElement.dataset.pwaSaveMutationPending === "false"
  ), null, { timeout: 90_000 });
}

async function waitForGame(page) {
  await page.locator(".game-shell, .game-frame").first().waitFor({ state: "visible", timeout: 90_000 });
}

async function prepare() {
  let page;
  ({ context, page } = await openProfile({ seed: true }));
  phase = "prepare-live-entry";
  await page.goto(officialUrl.toString(), { waitUntil: "domcontentloaded", timeout: 90_000 });
  const published = await readPublishedIdentity(context);
  record("official Pages is the exact released 0.9.9.5 identity", (
    published.htmlStatus === 200
    && published.manifestStatus === 200
    && published.version === oldVersion
    && published.releaseSha === oldReleaseSha
    && published.requestId === oldRequestId
    && published.issue === oldIssue
    && published.base === "/Zombieee/"
    && published.manifest.version === oldVersion
    && published.manifest.releaseSha === oldReleaseSha
    && published.manifest.assets?.length === 415
    && new Set(published.manifest.assets.map((asset) => asset.hash)).size === 413
  ), { ...published, manifest: { version: published.manifest.version, releaseSha: published.manifest.releaseSha, assets: published.manifest.assets?.length } });

  const startDownload = page.getByRole("button", { name: "ダウンロードを開始", exact: true });
  await startDownload.waitFor({ state: "visible", timeout: 90_000 });
  await screenshot(page, "published-old-download-ready");
  await startDownload.click();
  const startGame = page.getByRole("button", { name: "ゲームを始める", exact: true });
  await startGame.waitFor({ state: "visible", timeout: 420_000 });
  const cache = await cacheState(page, published.manifest);
  const worker = await getWorkerState(page);
  const beforeGameSave = await legacyState(page);
  record("official old pack is completely installed into the named profile", (
    cache.assetEntries === 413
    && cache.logicalSatisfied === 415
    && worker.scope === officialUrl.toString()
    && worker.activeWorkerState === "activated"
    && worker.activeState?.active?.version === oldVersion
    && worker.activeState?.active?.releaseSha === oldReleaseSha
    && beforeGameSave.raw === legacySaveRaw
  ), {
    cache,
    worker: workerSummary(worker),
    legacySaveSha256: sha256(beforeGameSave.raw ?? ""),
    legacyWrites: beforeGameSave.legacyWrites,
  });
  await screenshot(page, "published-old-download-complete");
  await startGame.click();
  await waitForGame(page);
  await screenshot(page, "published-old-installed");
  await closeProfile("prepare-first-close");

  ({ context, page } = await openProfile({ seed: false }));
  phase = "prepare-persistent-reopen";
  await page.goto(officialUrl.toString(), { waitUntil: "domcontentloaded", timeout: 90_000 });
  await waitForGame(page);
  const reopenedCache = await cacheState(page, published.manifest);
  const reopenedWorker = await getWorkerState(page);
  const reopenedSave = await legacyState(page);
  record("official old profile survives a real browser-context reopen", (
    reopenedCache.assetEntries === 413
    && reopenedCache.logicalSatisfied === 415
    && reopenedWorker.activeState?.active?.version === oldVersion
    && reopenedWorker.activeState?.active?.releaseSha === oldReleaseSha
    && reopenedSave.raw === legacySaveRaw
  ), {
    cache: reopenedCache,
    worker: workerSummary(reopenedWorker),
    legacySaveSha256: sha256(reopenedSave.raw ?? ""),
    legacyWrites: reopenedSave.legacyWrites,
  });
  await screenshot(page, "published-old-reopened");

  return {
    profileId: randomUUID(),
    preparedAt: new Date().toISOString(),
    officialUrl: officialUrl.toString(),
    browser: browserName,
    oldIdentity: {
      version: published.version,
      releaseSha: published.releaseSha,
      requestId: published.requestId,
      issue: published.issue,
      htmlBytes: published.htmlBytes,
      htmlSha256: published.htmlSha256,
      manifestBytes: published.manifestBytes,
      manifestSha256: published.manifestSha256,
      assetCount: published.manifest.assets.length,
      distinctHashCount: new Set(published.manifest.assets.map((asset) => asset.hash)).size,
      totalBytes: published.manifest.assets.reduce((sum, asset) => sum + Number(asset.bytes ?? 0), 0),
    },
    oldManifest: published.manifest,
    legacySaveSha256,
  };
}

async function verify(contract) {
  let page;
  ({ context, page } = await openProfile({ seed: false }));
  const candidateRequests = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin === officialUrl.origin && /\/(?:art|audio|pwa-bundles)\//u.test(url.pathname)) {
      candidateRequests.push(url.pathname);
    }
  });
  phase = "verify-published-candidate-entry";
  await page.goto(officialUrl.toString(), { waitUntil: "domcontentloaded", timeout: 90_000 });
  const published = await readPublishedIdentity(context);
  record("official Pages is the exact approved V1 release identity", (
    published.htmlStatus === 200
    && published.manifestStatus === 200
    && published.version === candidateVersion
    && published.releaseSha === candidateReleaseSha
    && published.requestId === candidateRequestId
    && published.issue === candidateIssue
    && published.base === "/Zombieee/"
    && published.manifest.version === candidateVersion
    && published.manifest.releaseSha === candidateReleaseSha
  ), { ...published, manifest: { version: published.manifest.version, releaseSha: published.manifest.releaseSha, assets: published.manifest.assets?.length } });

  const oldManifest = contract.oldManifest;
  const oldHashes = new Set(oldManifest.assets.map((asset) => asset.hash));
  const candidateHashes = new Set(published.manifest.assets.map((asset) => asset.hash));
  const candidateByPath = new Map(published.manifest.assets.map((asset) => [asset.path, asset]));
  const unchanged = oldManifest.assets.filter((asset) => {
    const next = candidateByPath.get(asset.path);
    return next && next.hash === asset.hash && next.bytes === asset.bytes
      && (next.sourcePath ?? null) === (asset.sourcePath ?? null)
      && (next.bundlePath ?? null) === (asset.bundlePath ?? null);
  });
  const newAssets = published.manifest.assets.filter((asset) => !oldHashes.has(asset.hash));
  const expectedPaths = new Set(newAssets.map((asset) => `/Zombieee${asset.bundlePath ?? asset.sourcePath ?? asset.path}`));
  record("published V1 declares the locked 415-to-459 update delta", (
    oldManifest.assets.length === 415
    && oldHashes.size === 413
    && published.manifest.assets.length === 459
    && candidateHashes.size === 457
    && unchanged.length === 415
    && newAssets.length === 44
    && newAssets.reduce((sum, asset) => sum + asset.bytes, 0) === 14_821_106
    && expectedPaths.size === 44
  ), {
    oldAssets: oldManifest.assets.length,
    oldHashes: oldHashes.size,
    candidateAssets: published.manifest.assets.length,
    candidateHashes: candidateHashes.size,
    unchanged: unchanged.length,
    newAssets: newAssets.length,
    newBytes: newAssets.reduce((sum, asset) => sum + asset.bytes, 0),
  });

  await waitForV100Ready(page);
  const gift = page.getByRole("dialog", { name: "新しい作戦記録を開始しました", exact: true });
  await gift.waitFor({ state: "visible", timeout: 90_000 });
  const updateButton = page.getByRole("button", { name: "更新をダウンロード", exact: true });
  const updateDeferredDuringGift = await updateButton.count() === 0;
  const confirmGift = gift.getByRole("button", { name: "確認する", exact: true });
  await page.waitForFunction(() => {
    const button = [...document.querySelectorAll("button")].find((entry) => entry.textContent?.trim() === "確認する");
    return button instanceof HTMLButtonElement && !button.disabled;
  }, null, { timeout: 90_000 });
  const beforeUpdate = await v100State(page);
  const nativeBefore = beforeUpdate.native?.record?.serialized ? JSON.parse(beforeUpdate.native.record.serialized) : null;
  record("published V1 claims one visible gift without importing or writing legacy progress", (
    updateDeferredDuringGift
    && beforeUpdate.oldRaw === legacySaveRaw
    && beforeUpdate.mirror?.caps === V100_LEGACY_GIFT.amountCaps
    && beforeUpdate.mirror?.campaignStarted === false
    && beforeUpdate.mirror?.completedStageIds?.length === 0
    && beforeUpdate.mirror?.ownedUnitIds?.slice().sort().join("|") === [...V100_INITIAL_UNIT_IDS].sort().join("|")
    && beforeUpdate.mirror?.settings?.bgmEnabled === false
    && beforeUpdate.mirror?.settings?.sfxEnabled === false
    && beforeUpdate.mirror?.settings?.bgmVolume === 0.42
    && beforeUpdate.mirror?.settings?.sfxVolume === 0.37
    && beforeUpdate.mirror?.settings?.graphicsQuality === "power-save"
    && beforeUpdate.mirror?.receipts?.filter((id) => id === V100_LEGACY_GIFT.entitlementReceipt).length === 1
    && beforeUpdate.mirror?.receipts?.filter((id) => id === V100_LEGACY_GIFT.popupReceipt).length === 1
    && beforeUpdate.mirror?.legacy?.popupAcknowledged === true
    && JSON.stringify(nativeBefore) === JSON.stringify(beforeUpdate.mirror)
    && beforeUpdate.legacyWrites.length === 0
  ), { updateDeferredDuringGift, mirror: beforeUpdate.mirror, legacyWrites: beforeUpdate.legacyWrites });
  await screenshot(page, "published-v1-gift");
  await confirmGift.click();
  await gift.waitFor({ state: "detached", timeout: 30_000 });
  await waitForV100Ready(page);
  await updateButton.waitFor({ state: "visible", timeout: 90_000 });
  const waiting = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    try { await registration.update(); } catch { /* state readback below owns the result */ }
    const started = Date.now();
    while (!registration.waiting && Date.now() - started < 15_000) await new Promise((resolve) => setTimeout(resolve, 250));
    return { scope: registration.scope, waiting: Boolean(registration.waiting), state: registration.waiting?.state ?? null };
  });
  record("published candidate has a real waiting worker and safe enabled update control", (
    waiting.waiting && waiting.scope === officialUrl.toString() && await updateButton.isEnabled()
  ), waiting);
  await screenshot(page, "published-v1-update-ready");

  const requestStart = candidateRequests.length;
  await updateButton.click();
  phase = "verify-published-update-download";
  const active = await waitForActiveVersion(page, candidateVersion);
  const startGame = page.getByRole("button", { name: "ゲームを始める", exact: true });
  await startGame.waitFor({ state: "visible", timeout: 180_000 });
  await screenshot(page, "published-v1-update-complete");
  await startGame.click();
  await waitForV100Ready(page);
  const updatedCache = await cacheState(page, published.manifest);
  const afterUpdate = await v100State(page);
  const actualPaths = candidateRequests.slice(requestStart);
  const actualPathSet = new Set(actualPaths);
  const unexpected = [...actualPathSet].filter((item) => !expectedPaths.has(item));
  const missing = [...expectedPaths].filter((item) => !actualPathSet.has(item));
  record("published V1 commits the activated generation and preserves both save owners", (
    active?.activeWorkerState === "activated"
    && active?.activeState?.active?.version === candidateVersion
    && active?.activeState?.active?.releaseSha === candidateReleaseSha
    && active?.activeState?.previous?.version === oldVersion
    && updatedCache.assetEntries === new Set([...oldHashes, ...candidateHashes]).size
    && updatedCache.logicalSatisfied === 459
    && afterUpdate.oldRaw === legacySaveRaw
    && afterUpdate.raw === beforeUpdate.raw
    && afterUpdate.legacyWrites.length === 0
  ), {
    worker: workerSummary(active),
    cache: updatedCache,
    oldSavePreserved: afterUpdate.oldRaw === legacySaveRaw,
    v100SavePreserved: afterUpdate.raw === beforeUpdate.raw,
    legacyWrites: afterUpdate.legacyWrites,
  });
  record("published update fetches exactly the 44 preferred new transport paths", (
    actualPaths.length === 44 && actualPathSet.size === 44 && unexpected.length === 0 && missing.length === 0
  ), { expected: [...expectedPaths].sort(), actual: actualPaths, unexpected, missing });
  await screenshot(page, "published-v1-committed");
  await closeProfile("verify-committed-close");

  ({ context, page } = await openProfile({ seed: false }));
  phase = "verify-published-reopen";
  await page.goto(officialUrl.toString(), { waitUntil: "domcontentloaded", timeout: 90_000 });
  await waitForV100Ready(page);
  const reopenedWorker = await getWorkerState(page);
  const reopened = await v100State(page);
  record("published V1 survives browser-context reopen with no duplicate gift", (
    reopenedWorker.activeState?.active?.releaseSha === candidateReleaseSha
    && reopened.oldRaw === legacySaveRaw
    && reopened.raw === beforeUpdate.raw
    && reopened.legacyWrites.length === 0
    && await page.getByRole("dialog", { name: "新しい作戦記録を開始しました", exact: true }).count() === 0
  ), { worker: workerSummary(reopenedWorker), legacyWrites: reopened.legacyWrites });

  await context.setOffline(true);
  phase = "verify-published-offline-reopen";
  await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
  await waitForV100Ready(page);
  const offlineWorker = await getWorkerState(page);
  const offline = await v100State(page);
  record("published V1 performs an actual offline root relaunch", (
    offlineWorker.activeState?.active?.releaseSha === candidateReleaseSha
    && offline.oldRaw === legacySaveRaw
    && offline.raw === beforeUpdate.raw
    && offline.legacyWrites.length === 0
  ), { worker: workerSummary(offlineWorker), legacyWrites: offline.legacyWrites });
  await screenshot(page, "published-v1-offline");
  await context.setOffline(false);

  const rollback = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return new Promise((resolve) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => resolve(null), 10_000);
      channel.port1.onmessage = (event) => { clearTimeout(timer); resolve(event.data ?? null); };
      registration.active.postMessage({ type: "pwa:rollback" }, [channel.port2]);
    });
  });
  phase = "verify-published-rollback";
  await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
  const recommit = page.getByRole("button", { name: "保存済みデータを反映", exact: true });
  await recommit.waitFor({ state: "visible", timeout: 90_000 });
  const rolledBackWorker = await getWorkerState(page);
  const rolledBackLegacy = await legacyState(page);
  const rolledBackV100Raw = await page.evaluate((key) => localStorage.getItem(key), v100SaveKey);
  record("published rollback restores the old generation without changing either save", (
    rollback?.type === "pwa:rolled-back"
    && rolledBackWorker.activeState?.active?.version === oldVersion
    && rolledBackLegacy.raw === legacySaveRaw
    && rolledBackV100Raw === beforeUpdate.raw
  ), { rollback, worker: workerSummary(rolledBackWorker), legacyWrites: rolledBackLegacy.legacyWrites });
  await screenshot(page, "published-rollback-commit-required");

  await recommit.click();
  const recoveredWorker = await waitForActiveVersion(page, candidateVersion);
  const recoveredStart = page.getByRole("button", { name: "ゲームを始める", exact: true });
  await recoveredStart.waitFor({ state: "visible", timeout: 90_000 });
  await recoveredStart.click();
  await waitForV100Ready(page);
  const recovered = await v100State(page);
  record("published rollback recovery returns the retained profile to V1", (
    recoveredWorker?.activeState?.active?.releaseSha === candidateReleaseSha
    && recovered.oldRaw === legacySaveRaw
    && recovered.raw === beforeUpdate.raw
    && recovered.legacyWrites.length === 0
  ), { worker: workerSummary(recoveredWorker), legacyWrites: recovered.legacyWrites });
  await screenshot(page, "published-v1-recovered");
  return { publishedIdentity: published };
}

let contract = null;
let modeResult = null;
try {
  if (mode === "prepare") {
    contract = await prepare();
  } else {
    contract = JSON.parse(await readFile(contractPath, "utf8"));
    record("retained profile contract matches the official old baseline", (
      contract.officialUrl === officialUrl.toString()
      && contract.browser === browserName
      && contract.oldIdentity?.version === oldVersion
      && contract.oldIdentity?.releaseSha === oldReleaseSha
      && contract.oldIdentity?.requestId === oldRequestId
      && contract.oldIdentity?.issue === oldIssue
      && contract.oldIdentity?.assetCount === 415
      && contract.oldIdentity?.distinctHashCount === 413
      && contract.legacySaveSha256 === legacySaveSha256
    ), { profileId: contract.profileId, oldIdentity: contract.oldIdentity });
    modeResult = await verify(contract);
  }
} catch (error) {
  record(`${mode} official existing-profile flow completes without an unhandled error`, false, {
    error: String(error?.stack ?? error),
  });
} finally {
  if (context) await closeProfile("final-close").catch(() => {});
  record("official profile runtime diagnostics are clean", (
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
  record("official profile teardown diagnostics are clean", diagnostics.teardown.length === 0, {
    teardown: diagnostics.teardown,
  });
}

const sourceFiles = [
  "scripts/pwa-official-existing-profile.mjs",
  "app/PwaGate.tsx",
  "app/GameEntry.tsx",
  "app/v100Save.js",
  "app/v100CampaignStorage.js",
];
const sources = [];
for (const file of sourceFiles) {
  sources.push({ file, sha256: sha256(await readFile(new URL(`../${file}`, import.meta.url))) });
}
const report = {
  mode,
  browser: browserName,
  officialUrl: officialUrl.toString(),
  profileDir,
  contractPath,
  contract: contract ? {
    profileId: contract.profileId,
    preparedAt: contract.preparedAt,
    oldIdentity: contract.oldIdentity,
    legacySaveSha256: contract.legacySaveSha256,
  } : null,
  modeResult: modeResult?.publishedIdentity ? {
    publishedIdentity: {
      version: modeResult.publishedIdentity.version,
      releaseSha: modeResult.publishedIdentity.releaseSha,
      requestId: modeResult.publishedIdentity.requestId,
      issue: modeResult.publishedIdentity.issue,
      htmlBytes: modeResult.publishedIdentity.htmlBytes,
      htmlSha256: modeResult.publishedIdentity.htmlSha256,
      manifestBytes: modeResult.publishedIdentity.manifestBytes,
      manifestSha256: modeResult.publishedIdentity.manifestSha256,
    },
  } : null,
  sources,
  images,
  diagnostics,
  results,
  failures,
};
const reportPath = path.join(evidenceDir, `pwa-official-existing-profile-${mode}-${browserName}.json`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
if (mode === "prepare" && failures.length === 0 && contract) {
  const contractPayload = { ...contract, sourceSha256: sources[0].sha256, prepareReport: path.basename(reportPath) };
  await writeFile(contractPath, `${JSON.stringify(contractPayload, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
}

console.log(`${results.length - failures.length} / ${results.length} official existing-profile cases passed`);
if (failures.length > 0) process.exitCode = 1;
