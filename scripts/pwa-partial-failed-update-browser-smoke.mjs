// Persistent partial-failed existing-PWA recovery smoke.
//
// The old generation is first installed completely. Its content-addressed
// cache is then reduced, in-place, to 156 exact shared content hashes while
// the old manifest, Service Worker registration, browser
// profile, and save remain untouched. The candidate must recover that same
// profile through a failed audio transport, close/relaunch, a real >30 second
// no-progress stall, and a real >30 second continuously progressing transfer.

import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { CAMPAIGN_STAGES, createDefaultCampaignSave, serializeCampaignSave } from "../app/campaign.js";
import { RELEASE_VERSION } from "../app/releaseIdentity.js";
import { chromium, webkit } from "playwright";

const oldRootInput = process.env.PWA_PARTIAL_UPDATE_OLD_ROOT;
const candidateRootInput = process.env.PWA_PARTIAL_UPDATE_CANDIDATE_ROOT;
const oldRoot = path.resolve(oldRootInput ?? "");
const candidateRoot = path.resolve(candidateRootInput ?? "");
const browserName = process.env.PWA_PARTIAL_UPDATE_BROWSER ?? "chromium";
const oldVersionOverride = process.env.PWA_PARTIAL_UPDATE_OLD_VERSION?.trim() || null;
const stallDurationMs = Number(process.env.PWA_PARTIAL_UPDATE_STALL_MS ?? 31_500);
const slowDurationMs = Number(process.env.PWA_PARTIAL_UPDATE_SLOW_MS ?? 31_500);
const evidenceDir = path.resolve(
  process.env.PWA_PARTIAL_UPDATE_EVIDENCE_DIR
    ?? path.join(process.cwd(), "outputs", "pwa-partial-failed-update"),
);
const browserType = { chromium, webkit }[browserName];
const basePath = "/Zombieee";
const scopePath = `${basePath}/`;
const bundlePathname = `${basePath}/pwa-bundles/audio-v1.bin`;
const saveKey = "nishijin-campaign-v1";

if (!oldRootInput || !candidateRootInput) {
  throw new Error("PWA_PARTIAL_UPDATE_OLD_ROOT and PWA_PARTIAL_UPDATE_CANDIDATE_ROOT are required");
}
if (!browserType) throw new Error(`Unknown browser: ${browserName}`);
if (!(stallDurationMs > 30_000) || !(slowDurationMs > 30_000)) {
  throw new Error("stall and slow durations must both exceed the production 30 second boundary");
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
const diagnostics = { consoleErrors: [], pageErrors: [], httpErrors: [], requestFailures: [] };
const audioRequests = [];
const candidateTransportRequests = [];

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

function staticTarget(root, pathname) {
  const relative = pathname.slice(basePath.length).replace(/^\/+/, "") || "index.html";
  const rootAbsolute = path.resolve(root);
  const target = path.resolve(rootAbsolute, relative);
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
    if (path.extname(target)) return { status: 404, body: Buffer.from("Not found"), type: "text/plain; charset=utf-8" };
    target = path.join(root, "index.html");
    targetStats = await stat(target).catch(() => null);
  }
  if (!targetStats) return { status: 404, body: Buffer.from("Not found"), type: "text/plain; charset=utf-8" };
  let body = await readFile(target);
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
let audioMode = "normal";
let audioModeRequestIndex = 0;

function setAudioMode(next) {
  audioMode = next;
  audioModeRequestIndex = 0;
}

function writeHeaders(response, status, length) {
  response.writeHead(status, {
    "content-type": "application/octet-stream",
    "content-length": String(length),
    "cache-control": "no-cache",
  });
}

function serveSlow(response, body, requestRecord) {
  const chunkCount = 32;
  const chunkBytes = Math.ceil(body.byteLength / chunkCount);
  const intervalMs = Math.ceil(slowDurationMs / Math.max(1, chunkCount - 1));
  let offset = 0;
  const startedAt = Date.now();
  const send = () => {
    if (response.destroyed || response.writableEnded) return;
    const end = Math.min(body.byteLength, offset + chunkBytes);
    response.write(body.subarray(offset, end));
    requestRecord.progress.push({ atMs: Date.now() - startedAt, bytes: end });
    offset = end;
    if (offset >= body.byteLength) {
      requestRecord.completed = true;
      requestRecord.durationMs = Date.now() - startedAt;
      response.end();
      return;
    }
    setTimeout(send, intervalMs);
  };
  send();
}

function serveStall(response, body, requestRecord) {
  const startedAt = Date.now();
  const firstChunk = Math.min(65_536, body.byteLength);
  response.write(body.subarray(0, firstChunk));
  requestRecord.progress.push({ atMs: 0, bytes: firstChunk });
  const timer = setTimeout(() => {
    if (!response.destroyed && !response.writableEnded) response.end(body.subarray(firstChunk));
  }, stallDurationMs + 5_000);
  response.on("close", () => {
    clearTimeout(timer);
    requestRecord.aborted = !requestRecord.completed;
    requestRecord.durationMs = Date.now() - startedAt;
  });
}

async function serveCandidateAudio(response) {
  const body = await readFile(staticTarget(candidateRoot, bundlePathname));
  const requestRecord = {
    mode: audioMode,
    index: ++audioModeRequestIndex,
    startedAt: Date.now(),
    progress: [],
    completed: false,
    aborted: false,
    durationMs: null,
  };
  audioRequests.push(requestRecord);

  if (audioMode === "incident" && requestRecord.index <= 3) {
    const failureBody = Buffer.from("Synthetic audio transport failure");
    writeHeaders(response, 503, failureBody.byteLength);
    requestRecord.completed = true;
    requestRecord.durationMs = Date.now() - requestRecord.startedAt;
    response.end(failureBody);
    return;
  }
  writeHeaders(response, 200, body.byteLength);
  if (audioMode === "incident") {
    // The fourth request remains in flight until the UI cancels it. That leaves
    // exactly one failed concurrency group visible, matching the incident state.
    response.on("close", () => {
      requestRecord.aborted = true;
      requestRecord.durationMs = Date.now() - requestRecord.startedAt;
    });
    return;
  }
  if (audioMode === "recovery" && requestRecord.index === 1) {
    serveStall(response, body, requestRecord);
    return;
  }
  if (audioMode === "recovery" && requestRecord.index === 2) {
    serveSlow(response, body, requestRecord);
    return;
  }
  requestRecord.completed = true;
  requestRecord.durationMs = Date.now() - requestRecord.startedAt;
  response.end(body);
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
    if (!url.pathname.startsWith(basePath) || (url.pathname !== basePath && !url.pathname.startsWith(scopePath))) {
      response.writeHead(404).end("Not found");
      return;
    }
    if (
      currentLabel === "candidate"
      && (/\/(?:art|audio|icons|pwa-bundles)\//.test(url.pathname)
        || /\/(?:explosive-drum|medical-supply-station|tactical-drop-pod)-v1/.test(url.pathname))
    ) {
      candidateTransportRequests.push({ pathname: url.pathname, audioMode, at: Date.now() });
    }
    if (currentLabel === "candidate" && url.pathname === bundlePathname && audioMode !== "normal") {
      await serveCandidateAudio(response);
      return;
    }
    const root = currentLabel === "candidate" ? candidateRoot : oldRoot;
    const served = await serveFile(root, url.pathname, currentLabel);
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

await stat(path.join(oldRoot, "index.html"));
await stat(path.join(candidateRoot, "index.html"));
const oldManifest = await readManifest(oldRoot);
const candidateManifest = await readManifest(candidateRoot);
// The base site is built from the live PR base SHA, so its immutable manifest
// is the version authority. An explicit override remains available for a
// deliberately pinned fixture, but CI must not carry a stale release literal
// into the next hotfix.
const oldVersion = oldVersionOverride ?? oldManifest.version;
record("old and candidate roots have the fixed 416-asset release contract", (
  oldManifest.version === oldVersion
  && candidateManifest.version === RELEASE_VERSION
  && oldManifest.assets.length === 416
  && candidateManifest.assets.length === 416
), {
  oldVersion: oldManifest.version,
  candidateVersion: candidateManifest.version,
  oldAssets: oldManifest.assets.length,
  candidateAssets: candidateManifest.assets.length,
});

const oldHashes = new Set(oldManifest.assets.map((asset) => asset.hash));
const candidateHashes = new Set(candidateManifest.assets.map((asset) => asset.hash));
const candidateNewHashAssets = candidateManifest.assets.filter((asset) => !oldHashes.has(asset.hash));
const candidateNewHashes = new Set(candidateNewHashAssets.map((asset) => asset.hash));
const candidateNewTransportPaths = new Set(
  candidateNewHashAssets.map((asset) => `${basePath}${asset.sourcePath ?? asset.path}`.replace(/\/+/g, "/")),
);
const retainedOldAssets = [...oldManifest.assets]
  .sort((left, right) => left.path.localeCompare(right.path))
  .filter((asset) => candidateHashes.has(asset.hash))
  .slice(0, 156);
const retainedHashes = new Set(retainedOldAssets.map((asset) => asset.hash));
const retainedCandidateAssets = candidateManifest.assets.filter((asset) => retainedHashes.has(asset.hash));
record("the candidate declares an exact non-empty hash delta instead of a stale same-pack assumption", (
  oldHashes.size === 414
  && candidateHashes.size === 414
  && candidateNewHashes.size > 0
  && candidateNewHashAssets.length === candidateNewHashes.size
  && retainedHashes.size === 156
  && retainedCandidateAssets.length === 156
), {
  oldDistinctHashes: oldHashes.size,
  candidateDistinctHashes: candidateHashes.size,
  changedHashes: candidateNewHashes.size,
  changedLogicalAssets: candidateNewHashAssets.length,
  changedBytes: candidateNewHashAssets.reduce((sum, asset) => sum + asset.bytes, 0),
  retainedSharedHashes: retainedHashes.size,
});

const save = createDefaultCampaignSave();
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
save.settings = { ...save.settings, bgmVolume: 0.42, sfxVolume: 0.37, graphicsQuality: "power-save" };
save.readStoryEventIds = ["story-prologue-v070", "story-stage1-intro-v070"];
save.updatedAt = "2026-08-10T00:00:00.000Z";
const saveFixture = serializeCampaignSave(save);
const saveFixtureHash = sha256(saveFixture);

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}${scopePath}`;

function attachDiagnostics(page) {
  page.on("console", (message) => {
    if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(String(error)));
  page.on("response", (response) => {
    if (response.status() >= 400 && response.status() !== 503) {
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
  attachDiagnostics(page);
  return { context, page };
}

async function workerState(page) {
  return page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    const ask = (message) => new Promise((resolve) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => resolve(null), 5_000);
      channel.port1.onmessage = (event) => { clearTimeout(timer); resolve(event.data); };
      registration.active?.postMessage(message, [channel.port2]);
    });
    return {
      scope: registration.scope,
      activeWorkerState: registration.active?.state ?? null,
      waiting: Boolean(registration.waiting),
      state: await ask({ type: "pwa:get-state" }),
    };
  });
}

async function waitForActiveVersion(page, version, timeoutMs = 180_000) {
  const startedAt = Date.now();
  let observed = null;
  while (Date.now() - startedAt < timeoutMs) {
    observed = await workerState(page);
    if (observed?.state?.active?.version === version) return observed;
    await page.waitForTimeout(250);
  }
  return observed;
}

async function cacheState(page, manifest = candidateManifest) {
  return page.evaluate(async ({ expected, retainedPaths }) => {
    const cache = await caches.open("zombieee-assets-v1");
    const keys = await cache.keys();
    const hashes = new Set(keys.map((request) => new URL(request.url).pathname.split("/").pop()));
    return {
      assetEntries: keys.filter((request) => new URL(request.url).pathname.includes("/__pwa-asset__/")).length,
      logicalSatisfied: expected.filter((asset) => hashes.has(asset.hash)).length,
      retainedSatisfied: retainedPaths.filter((asset) => hashes.has(asset.hash)).length,
    };
  }, { expected: manifest.assets, retainedPaths: retainedCandidateAssets });
}

async function cacheHashes(page) {
  return page.evaluate(async () => {
    const cache = await caches.open("zombieee-assets-v1");
    return (await cache.keys()).map((request) => new URL(request.url).pathname.split("/").pop());
  });
}

async function currentSave(page) {
  return page.evaluate((key) => localStorage.getItem(key), saveKey);
}

async function waitForAudioRequests(mode, count, timeoutMs = 120_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const matching = audioRequests.filter((request) => request.mode === mode);
    if (matching.length >= count) return matching;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return audioRequests.filter((request) => request.mode === mode);
}

let context = null;
let page = null;
const userDataDir = await mkdtemp(path.join(os.tmpdir(), "zombieee-pwa-partial-update-"));

try {
  ({ context, page } = await openPersistent(userDataDir));
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "ダウンロードを開始" }).click();
  await page.getByRole("button", { name: "ゲームを始める" }).waitFor({ state: "visible", timeout: 300_000 });
  const oldWorker = await waitForActiveVersion(page, oldVersion, 30_000);
  record("the same profile first owns a complete committed old generation", (
    oldWorker?.state?.active?.version === oldVersion
    && (await cacheState(page, oldManifest)).logicalSatisfied === 416
  ), { oldActiveVersion: oldWorker?.state?.active?.version, cache: await cacheState(page, oldManifest) });

  const partial = await page.evaluate(async (retainedHashList) => {
    const retained = new Set(retainedHashList);
    const cache = await caches.open("zombieee-assets-v1");
    for (const request of await cache.keys()) {
      const hash = new URL(request.url).pathname.split("/").pop();
      if (!retained.has(hash)) await cache.delete(request);
    }
    const remaining = await cache.keys();
    return { retainedHashes: retained.size, cacheEntries: remaining.length };
  }, [...retainedHashes]);
  const partialCache = await cacheState(page, oldManifest);
  const partialWorker = await workerState(page);
  const oldSaveRaw = await currentSave(page);
  record("the incident fixture is an old active generation with exactly 156/416 assets and the same raw save", (
    partial.retainedHashes === 156
    && partialCache.logicalSatisfied === 156
    && partialWorker.state?.active?.version === oldVersion
    && sha256(oldSaveRaw ?? "") === saveFixtureHash
  ), { partial, partialCache, activeVersion: partialWorker.state?.active?.version, saveHash: sha256(oldSaveRaw ?? "") });

  await context.close();
  context = null;
  currentLabel = "candidate";
  setAudioMode("incident");

  ({ context, page } = await openPersistent(userDataDir));
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  const candidateManifestFromPage = await page.evaluate(async () => (
    await (await fetch(new URL("asset-manifest.json", location.href), { cache: "no-store" })).json()
  ));
  record(`the same profile sees ${RELEASE_VERSION} without uninstall, storage clear, or profile replacement`, (
    candidateManifestFromPage.version === RELEASE_VERSION
    && (await cacheState(page)).logicalSatisfied === 156
    && (await currentSave(page)) === oldSaveRaw
  ), { candidateVersion: candidateManifestFromPage.version, userDataDir, cache: await cacheState(page) });

  const waiting = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    try { await registration.update(); } catch { /* state is evidence */ }
    const startedAt = Date.now();
    while (!registration.waiting && Date.now() - startedAt < 15_000) await new Promise((resolve) => setTimeout(resolve, 250));
    return Boolean(registration.waiting);
  });
  record(`${RELEASE_VERSION} has a real waiting worker before the partial update`, waiting === true, { waiting });

  const repairButton = page.getByRole("button", { name: "不足分だけ再取得" });
  await repairButton.waitFor({ state: "visible", timeout: 60_000 });
  await repairButton.click();
  await page.getByText("失敗 3件", { exact: true }).waitFor({ state: "visible", timeout: 30_000 });
  const incidentRequests = await waitForAudioRequests("incident", 4, 30_000);
  const incidentProgress = await page.locator(".pwa-progress-line").textContent();
  const incidentCategory = await page.getByText("音声を取得中", { exact: true }).count();
  const failureCounter = await page.getByText("失敗 3件", { exact: true }).count();
  const incidentChangedRequests = candidateTransportRequests
    .filter(({ pathname }) => candidateNewTransportPaths.has(pathname))
    .map(({ pathname }) => pathname);
  record("the physical incident class fetches the exact release delta before exposing three failed pending requests and one held request", (
    partialCache.logicalSatisfied === 156
    && new Set(incidentChangedRequests).size === candidateNewTransportPaths.size
    && incidentChangedRequests.length === candidateNewTransportPaths.size
    && new RegExp(`^${candidateNewHashAssets.length} \\/ 260件`).test(incidentProgress ?? "")
    && incidentCategory === 1
    && failureCounter === 1
    && incidentRequests.length === 4
    && incidentRequests.slice(0, 3).every((request) => request.completed)
    && !incidentRequests[3].completed
  ), {
    startingLogicalAssets: partialCache.logicalSatisfied,
    exactReleaseDelta: [...candidateNewTransportPaths],
    incidentChangedRequests,
    incidentProgress,
    incidentCategory,
    failureCounter,
    requests: incidentRequests.map(({ mode, index, completed }) => ({ mode, index, completed })),
  });

  await page.getByRole("button", { name: "中断" }).click();
  await page.getByRole("heading", { name: "ダウンロードを中断しました" }).waitFor({ state: "visible", timeout: 15_000 });
  const cancelledCache = await cacheState(page);
  const hashesBeforeRecovery = new Set(await cacheHashes(page));
  const successfulBeforeRecoveryAssets = candidateManifest.assets.filter((asset) => hashesBeforeRecovery.has(asset.hash));
  const successfulBeforeRecoveryPaths = new Set(
    successfulBeforeRecoveryAssets.map((asset) => `${basePath}${asset.sourcePath ?? asset.path}`.replace(/\/+/g, "/")),
  );
  const cancelledWorker = await workerState(page);
  record("cancel preserves the old assets plus newly successful assets, old manifest, and save", (
    cancelledCache.logicalSatisfied >= 156
    && cancelledWorker.state?.active?.version === oldVersion
    && (await currentSave(page)) === oldSaveRaw
  ), { startingLogicalAssets: partialCache.logicalSatisfied, cancelledCache, activeVersion: cancelledWorker.state?.active?.version });

  await context.close();
  context = null;
  setAudioMode("recovery");
  ({ context, page } = await openPersistent(userDataDir));
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  const relaunchedBefore = await workerState(page);
  record("close/relaunch retains the partial cache, old active manifest, and exact raw save", (
    relaunchedBefore.state?.active?.version === oldVersion
    && (await cacheState(page)).logicalSatisfied === cancelledCache.logicalSatisfied
    && (await currentSave(page)) === oldSaveRaw
  ), { activeVersion: relaunchedBefore.state?.active?.version, cache: await cacheState(page) });

  const recoveryTransportStart = candidateTransportRequests.length;
  await page.getByRole("button", { name: "不足分だけ再取得" }).click();
  const recoveryRequests = await waitForAudioRequests("recovery", 2, 90_000);
  record("a real no-progress interval over 30 seconds aborts one shared bundle transport and starts one retry", (
    recoveryRequests.length >= 2
    && recoveryRequests[0].aborted
    && recoveryRequests[0].durationMs >= 30_000
  ), { first: recoveryRequests[0] });

  const pause = page.getByRole("button", { name: "一時停止" });
  await pause.waitFor({ state: "visible", timeout: 15_000 });
  await pause.click();
  await page.getByRole("button", { name: "再開" }).waitFor({ state: "visible", timeout: 5_000 });
  const requestCountWhilePaused = audioRequests.filter((request) => request.mode === "recovery").length;
  await page.waitForTimeout(750);
  await page.getByRole("button", { name: "再開" }).click();
  record("pause/resume changes session state without multiplying the shared bundle request", (
    requestCountWhilePaused === 2
    && audioRequests.filter((request) => request.mode === "recovery").length === 2
  ), { requestCountWhilePaused });

  const updatedWorker = await waitForActiveVersion(page, RELEASE_VERSION, 180_000);
  const finalCache = await cacheState(page);
  const finalSaveRaw = await currentSave(page);
  const completedRecoveryRequests = audioRequests.filter((request) => request.mode === "recovery");
  const slow = completedRecoveryRequests[1];
  record("the actual audio-v1.bin retry progresses for over 30 seconds and completes as one shared request", (
    completedRecoveryRequests.length === 2
    && slow?.completed
    && slow.durationMs > 30_000
    && slow.progress.length >= 30
    && slow.progress.every((entry, index, entries) => index === 0 || entry.bytes > entries[index - 1].bytes)
  ), { requestCount: completedRecoveryRequests.length, slowDurationMs: slow?.durationMs, progressEvents: slow?.progress.length });
  record(`partial recovery reaches 416/416, failed 0, commits ${RELEASE_VERSION}, and preserves raw save bytes`, (
    finalCache.logicalSatisfied === 416
    && finalCache.assetEntries === 414
    && updatedWorker?.state?.active?.version === RELEASE_VERSION
    && updatedWorker.activeWorkerState === "activated"
    && finalSaveRaw === oldSaveRaw
  ), { finalCache, activeVersion: updatedWorker?.state?.active?.version, savePreserved: finalSaveRaw === oldSaveRaw });

  const recoveryAssetRequests = candidateTransportRequests
    .slice(recoveryTransportStart)
    .map((request) => request.pathname);
  record("recovery fetches only failed or pending content, never re-fetches any successful asset, and does not fetch the bundle per slice", (
    recoveryAssetRequests.filter((pathname) => successfulBeforeRecoveryPaths.has(pathname)).length === 0
    && recoveryAssetRequests.filter((pathname) => pathname === bundlePathname).length === 2
  ), {
    successfulBeforeRecoveryHashes: hashesBeforeRecovery.size,
    successfulBeforeRecoveryLogicalAssets: successfulBeforeRecoveryAssets.length,
    recoveryAssetRequests,
    successfulRefetches: recoveryAssetRequests.filter((pathname) => successfulBeforeRecoveryPaths.has(pathname)),
  });

  await context.close();
  context = null;
  ({ context, page } = await openPersistent(userDataDir));
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.locator(".game-shell, .game-frame").first().waitFor({ state: "visible", timeout: 60_000 });
  const committedRelaunch = await workerState(page);
  record(`relaunch keeps the committed ${RELEASE_VERSION} generation and save`, (
    committedRelaunch.state?.active?.version === RELEASE_VERSION
    && (await currentSave(page)) === oldSaveRaw
  ), { activeVersion: committedRelaunch.state?.active?.version });

  if (browserName === "chromium") {
    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.locator(".game-shell, .game-frame").first().waitFor({ state: "visible", timeout: 60_000 });
    record("offline relaunch uses the committed generation without changing the save", (
      (await workerState(page)).state?.active?.version === RELEASE_VERSION
      && (await currentSave(page)) === oldSaveRaw
    ));
    await context.setOffline(false);
  }

  const rollback = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return new Promise((resolve) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => resolve(null), 10_000);
      channel.port1.onmessage = (event) => { clearTimeout(timer); resolve(event.data); };
      registration.active?.postMessage({ type: "pwa:rollback" }, [channel.port2]);
    });
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1_000);
  record("rollback restores the old generation without changing the save", (
    rollback?.type === "pwa:rolled-back"
    && (await workerState(page)).state?.active?.version === oldVersion
    && (await currentSave(page)) === oldSaveRaw
  ), { rollback });
} catch (error) {
  record("partial-failed update flow completes without an unhandled harness error", false, {
    error: String(error?.stack ?? error),
  });
} finally {
  if (context) await context.close().catch(() => {});
  await new Promise((resolve) => server.close(resolve));
  const unexpectedRequestFailures = diagnostics.requestFailures.filter((failure) => (
    !failure.includes("ERR_ABORTED")
    && !failure.includes("NS_BINDING_ABORTED")
    && !failure.includes("Load request cancelled")
    && !failure.includes("ERR_INTERNET_DISCONNECTED")
  ));
  const expectedInjectedConsoleErrors = diagnostics.consoleErrors.filter((message) => (
    message === "Failed to load resource: the server responded with a status of 503 (Service Unavailable)"
  ));
  const unexpectedConsoleErrors = diagnostics.consoleErrors.filter((message) => (
    message !== "Failed to load resource: the server responded with a status of 503 (Service Unavailable)"
  ));
  record("browser diagnostics contain no console/page/unexpected HTTP/request failure", (
    expectedInjectedConsoleErrors.length === 3
    && unexpectedConsoleErrors.length === 0
    && diagnostics.pageErrors.length === 0
    && diagnostics.httpErrors.length === 0
    && unexpectedRequestFailures.length === 0
  ), { ...diagnostics, expectedInjectedConsoleErrors: expectedInjectedConsoleErrors.length, consoleErrors: unexpectedConsoleErrors, requestFailures: unexpectedRequestFailures });
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(path.join(evidenceDir, `pwa-partial-failed-update-${browserName}.json`), `${JSON.stringify({
    browser: browserName,
    baseUrl,
    oldRoot,
    candidateRoot,
    oldManifest: { version: oldManifest.version, releaseSha: oldManifest.releaseSha, assets: oldManifest.assets.length },
    candidateManifest: { version: candidateManifest.version, releaseSha: candidateManifest.releaseSha, assets: candidateManifest.assets.length },
    persistentProfile: userDataDir,
    fixture: { logicalSatisfied: 156, total: 416, saveSha256: saveFixtureHash },
    transport: { stallDurationMs, slowDurationMs, audioRequests },
    results,
    failures,
  }, null, 2)}\n`, "utf8");
}

console.log(`\n${results.filter((result) => result.passed).length} / ${results.length} partial-failed PWA cases passed`);
if (failures.length > 0) process.exitCode = 1;
