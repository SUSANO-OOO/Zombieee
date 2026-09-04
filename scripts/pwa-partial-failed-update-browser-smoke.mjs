import { legacyQaUrl } from "./legacy-qa-url.mjs";
// Persistent partial-failed existing-PWA recovery smoke.
//
// The old generation is first installed completely. Its content-addressed
// cache is then reduced, in-place, to the exact shared content hashes derived
// from the base/candidate manifests while
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
import { diffAssetManifests, validateAssetManifest } from "../app/pwaAssetManifest.js";
import { RELEASE_VERSION } from "../app/releaseIdentity.js";
import { V100_INITIAL_UNIT_IDS, V100_LEGACY_GIFT } from "../app/v100Registry.js";
import { V100_PRIMARY_STORAGE_KEY } from "../app/v100Save.js";
import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";
import { chromium, webkit } from "playwright";

const oldRootInput = process.env.PWA_PARTIAL_UPDATE_OLD_ROOT;
const candidateRootInput = process.env.PWA_PARTIAL_UPDATE_CANDIDATE_ROOT;
const oldRoot = path.resolve(oldRootInput ?? "");
const candidateRoot = path.resolve(candidateRootInput ?? "");
const browserName = process.env.PWA_PARTIAL_UPDATE_BROWSER ?? "chromium";
const oldVersionOverride = process.env.PWA_PARTIAL_UPDATE_OLD_VERSION?.trim() || null;
const expectedCandidateReleaseSha = process.env.PWA_PARTIAL_UPDATE_EXPECTED_CANDIDATE_SHA?.trim();
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
const v100SaveKey = V100_PRIMARY_STORAGE_KEY;
const commitLogKey = "__qa_pwa_commit_messages__";

if (!oldRootInput || !candidateRootInput) {
  throw new Error("PWA_PARTIAL_UPDATE_OLD_ROOT and PWA_PARTIAL_UPDATE_CANDIDATE_ROOT are required");
}
if (!browserType) throw new Error(`Unknown browser: ${browserName}`);
if (!/^[0-9a-f]{40}$/u.test(expectedCandidateReleaseSha ?? "")) {
  throw new Error("PWA_PARTIAL_UPDATE_EXPECTED_CANDIDATE_SHA must be the exact 40-character candidate HEAD");
}
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
const diagnostics = {
  consoleErrors: [],
  pageErrors: [],
  httpErrors: [],
  requestFailures: [],
  teardown: [],
};
const audioRequests = [];
const candidateTransportRequests = [];
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

function transportPathFor(asset) {
  return `${basePath}${asset.bundlePath ?? asset.sourcePath ?? asset.path}`.replace(/\/+/g, "/");
}

function logicalPathFor(asset) {
  return `${basePath}${asset.path}`.replace(/\/+/g, "/");
}

/**
 * Compare the exact base and candidate manifests by logical path and content
 * hash. Counts are deliberately absent from this planner: the fixture must
 * continue to describe the candidate it was given rather than a remembered
 * release size.
 */
function compareManifestPathHashes(baseManifest, candidateManifest) {
  const baseByPath = new Map(baseManifest.assets.map((asset) => [asset.path, asset]));
  const candidateByPath = new Map(candidateManifest.assets.map((asset) => [asset.path, asset]));
  const unchanged = [];
  const changed = [];
  const missingNew = [];
  const removed = [];

  for (const asset of [...candidateManifest.assets].sort((left, right) => left.path.localeCompare(right.path))) {
    const base = baseByPath.get(asset.path);
    if (!base) {
      missingNew.push(asset);
    } else if (base.hash === asset.hash) {
      unchanged.push(asset);
    } else {
      changed.push(asset);
    }
  }
  for (const asset of [...baseManifest.assets].sort((left, right) => left.path.localeCompare(right.path))) {
    if (!candidateByPath.has(asset.path)) removed.push(asset);
  }

  return { baseByPath, candidateByPath, unchanged, changed, missingNew, removed };
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
  // Keep each write below the normal HTTP high-water mark so the hosted
  // browser receives a real sequence of readable stream chunks. The transfer
  // still lasts beyond the production 30 second no-progress boundary, but a
  // single multi-hundred-KB write must not turn the remainder into an opaque
  // buffered response in WebKit/Chromium.
  const chunkBytes = Math.min(64 * 1024, Math.max(1, body.byteLength));
  const chunkCount = Math.max(2, Math.ceil(body.byteLength / chunkBytes));
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
const oldValidation = validateAssetManifest(oldManifest);
const candidateValidation = validateAssetManifest(candidateManifest);
const manifestDelta = compareManifestPathHashes(oldManifest, candidateManifest);
record("the exact base and candidate manifests are valid and compared by path plus content hash", (
  oldValidation.valid
  && candidateValidation.valid
  && oldManifest.version === oldVersion
  && candidateManifest.version === RELEASE_VERSION
  && candidateManifest.releaseSha === expectedCandidateReleaseSha
  && manifestDelta.unchanged.every((asset) => manifestDelta.baseByPath.get(asset.path)?.hash === asset.hash)
  && manifestDelta.changed.every((asset) => manifestDelta.baseByPath.get(asset.path)?.hash !== asset.hash)
  && manifestDelta.missingNew.every((asset) => !manifestDelta.baseByPath.has(asset.path))
  && manifestDelta.removed.every((asset) => !manifestDelta.candidateByPath.has(asset.path))
), {
  oldVersion: oldManifest.version,
  candidateVersion: candidateManifest.version,
  candidateReleaseSha: candidateManifest.releaseSha,
  oldAssets: oldManifest.assets.length,
  candidateAssets: candidateManifest.assets.length,
  baseValidationErrors: oldValidation.errors,
  candidateValidationErrors: candidateValidation.errors,
  unchanged: manifestDelta.unchanged.length,
  changed: manifestDelta.changed.length,
  missingNew: manifestDelta.missingNew.length,
  removed: manifestDelta.removed.length,
});

const oldHashes = new Set(oldManifest.assets.map((asset) => asset.hash));
const candidateHashes = new Set(candidateManifest.assets.map((asset) => asset.hash));
const candidateMissingNewAssets = manifestDelta.missingNew;
const candidateMissingNewHashes = new Set(candidateMissingNewAssets.map((asset) => asset.hash));
const candidateReleaseDeltaAssets = [...manifestDelta.changed, ...manifestDelta.missingNew];
// The incident starts from a deterministic partial cache. The retained hash
// subset is selected from the exact shared hash set by a stable stride, rather
// than by a remembered asset count; a new candidate therefore gets a valid
// partial fixture even when its manifest cardinality changes.
const sharedHashCandidates = [...new Set([...oldManifest.assets]
  .sort((left, right) => left.path.localeCompare(right.path))
  .filter((asset) => candidateHashes.has(asset.hash))
  .map((asset) => asset.hash))];
const retainedHashStride = 3;
const retainedHashes = new Set(sharedHashCandidates.filter((_, index) => index % retainedHashStride === 0));
const retainedOldAssets = oldManifest.assets.filter((asset) => retainedHashes.has(asset.hash));
const retainedCandidateAssets = candidateManifest.assets.filter((asset) => retainedHashes.has(asset.hash));
const retainedOldLogicalCount = retainedOldAssets.length;
const retainedCandidateLogicalCount = retainedCandidateAssets.length;
const candidateUpdatePlan = diffAssetManifests(oldManifest, candidateManifest, { retainedHashes });
const candidateDownloadableAssets = candidateUpdatePlan.downloadable;
const candidateDownloadTransportPaths = new Set(candidateDownloadableAssets.map(transportPathFor));
// AudioMixer intentionally consumes the logical audio source URL for runtime
// playback even when the update manifest stores that same asset in the shared
// audio bundle. Keep those source reads separate from PWA update transport:
// update downloads remain candidate-derived bundle/source paths, while an
// unknown runtime path still fails the incident contract below.
const candidateBundledAudioSourcePaths = new Set(candidateManifest.assets
  .filter((asset) => asset.bundlePath && asset.path.startsWith("/audio/"))
  .map(logicalPathFor));
const unchangedStoredAssets = manifestDelta.unchanged.filter((asset) => retainedHashes.has(asset.hash));
const unchangedMissingAssets = manifestDelta.unchanged.filter((asset) => !retainedHashes.has(asset.hash));
const allowedDownloadPaths = new Set([
  ...candidateUpdatePlan.changed,
  ...candidateUpdatePlan.added,
  ...candidateUpdatePlan.missing,
].map((asset) => asset.path));
record("the candidate update plan derives changed, missing/new, removed, and retained sets without a release-size literal", (
  oldHashes.size > 0
  && candidateHashes.size > 0
  && candidateReleaseDeltaAssets.length > 0
  && candidateMissingNewAssets.length === manifestDelta.missingNew.length
  && retainedHashes.size > 0
  && retainedHashes.size < sharedHashCandidates.length
  && retainedOldLogicalCount >= retainedHashes.size
  && retainedCandidateLogicalCount >= retainedHashes.size
  && candidateDownloadableAssets.every((asset) => allowedDownloadPaths.has(asset.path))
  && candidateDownloadableAssets.every((asset) => !unchangedStoredAssets.some((unchanged) => unchanged.path === asset.path))
  && candidateUpdatePlan.unchanged.every((asset) => retainedHashes.has(asset.hash))
), {
  oldDistinctHashes: oldHashes.size,
  candidateDistinctHashes: candidateHashes.size,
  manifestChanged: manifestDelta.changed.length,
  manifestMissingNew: manifestDelta.missingNew.length,
  manifestRemoved: manifestDelta.removed.length,
  unchangedStored: unchangedStoredAssets.length,
  unchangedMissing: unchangedMissingAssets.length,
  changedHashes: candidateMissingNewHashes.size,
  changedLogicalAssets: candidateReleaseDeltaAssets.length,
  changedBytes: candidateReleaseDeltaAssets.reduce((sum, asset) => sum + asset.bytes, 0),
  retainedSharedHashes: retainedHashes.size,
  downloadTargets: candidateDownloadableAssets.length,
  downloadTargetBytes: candidateUpdatePlan.downloadBytes,
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
save.settings = {
  ...save.settings,
  bgmEnabled: false,
  sfxEnabled: false,
  bgmVolume: 0.42,
  sfxVolume: 0.37,
  graphicsQuality: "power-save",
};
save.readStoryEventIds = ["story-prologue-v070", "story-stage1-intro-v070"];
save.updatedAt = "2026-08-10T00:00:00.000Z";
const saveFixture = serializeCampaignSave(save);
const saveFixtureHash = sha256(saveFixture);

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}${scopePath}`;

function attachDiagnostics(page) {
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
    if (response.status() >= 400 && response.status() !== 503) {
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
  await context.addInitScript(({ key, raw, commitKey, legacyKeys }) => {
    Object.defineProperty(window.navigator, "standalone", { value: true, configurable: true });
    if (!window.localStorage.getItem(key)) window.localStorage.setItem(key, raw);
    window.__PWA_PARTIAL_LEGACY_WRITES__ = [];
    for (const method of ["setItem", "removeItem", "clear"]) {
      const native = Storage.prototype[method];
      Storage.prototype[method] = function (...args) {
        if (this === localStorage && (method === "clear" || legacyKeys.includes(String(args[0])))) {
          window.__PWA_PARTIAL_LEGACY_WRITES__.push({ store: "local", method, key: args[0] ?? null });
        }
        return native.apply(this, args);
      };
    }
    for (const method of ["put", "add", "delete", "clear"]) {
      const native = IDBObjectStore.prototype[method];
      IDBObjectStore.prototype[method] = function (...args) {
        if (this.transaction.db.name === "nishijin-campaign-backup") {
          window.__PWA_PARTIAL_LEGACY_WRITES__.push({ store: "indexed", method });
        }
        return native.apply(this, args);
      };
    }
    try {
      const prototype = window.ServiceWorker?.prototype;
      const original = prototype?.postMessage;
      if (typeof original === "function" && !original.__qaPwaCommitWrapper) {
        const wrapped = function qaPwaCommitMessage(message, ...args) {
          const result = original.call(this, message, ...args);
          if (message?.type === "pwa:commit-manifest") {
            const entries = JSON.parse(window.localStorage.getItem(commitKey) ?? "[]");
            entries.push({
              version: message.manifest?.version ?? null,
              releaseSha: message.manifest?.releaseSha ?? null,
              at: Date.now(),
            });
            window.localStorage.setItem(commitKey, JSON.stringify(entries));
          }
          return result;
        };
        Object.defineProperty(wrapped, "__qaPwaCommitWrapper", { value: true });
        prototype.postMessage = wrapped;
      }
    } catch {
      // Some engines expose a non-configurable worker prototype. The product
      // flow remains authoritative; this only adds commit-count evidence.
    }
  }, {
    key: saveKey,
    raw: saveFixture,
    commitKey: commitLogKey,
    legacyKeys: [saveKey, `${saveKey}::last-known-good`, `${saveKey}::pre-migration`],
  });
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

function activeMatchesManifest(active, manifest, version = manifest.version) {
  return active?.version === version && active?.releaseSha === manifest.releaseSha;
}

async function waitForActiveGeneration(page, manifest, { version = manifest.version, timeoutMs = 180_000 } = {}) {
  const startedAt = Date.now();
  let observed = null;
  while (Date.now() - startedAt < timeoutMs) {
    observed = await workerState(page);
    if (activeMatchesManifest(observed?.state?.active, manifest, version)) return observed;
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
      legacyWrites: [...(window.__PWA_PARTIAL_LEGACY_WRITES__ ?? [])],
    };
  }, { key: v100SaveKey, oldKey: saveKey });
}

async function waitForV100Ready(page) {
  await page.waitForFunction(() => (
    document.querySelector(".v100-shell")
    && document.documentElement.dataset.pwaSaveMutationPending === "false"
  ), null, { timeout: 60_000 });
}

async function closeContext(label) {
  if (!context) return;
  diagnosticPhase = label;
  teardown = true;
  await context.close();
  context = null;
  teardown = false;
}

async function commitMessages(page) {
  return page.evaluate((key) => {
    try {
      const entries = JSON.parse(localStorage.getItem(key) ?? "[]");
      return Array.isArray(entries) ? entries : [];
    } catch {
      return [];
    }
  }, commitLogKey);
}

async function commitCountFor(page, manifest) {
  const entries = await commitMessages(page);
  return entries.filter((entry) => (
    entry.version === manifest.version && entry.releaseSha === manifest.releaseSha
  )).length;
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
  diagnosticPhase = "old-install-entry";
  await page.goto(legacyQaUrl(baseUrl), { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "ダウンロードを開始" }).click();
  await page.getByRole("button", { name: "ゲームを始める" }).waitFor({ state: "visible", timeout: 300_000 });
  const oldWorker = await waitForActiveGeneration(page, oldManifest, { version: oldVersion, timeoutMs: 30_000 });
  const oldCache = await cacheState(page, oldManifest);
  const oldCommitCount = await commitCountFor(page, oldManifest);
  record("the same profile first owns a complete committed old generation", (
    activeMatchesManifest(oldWorker?.state?.active, oldManifest, oldVersion)
    && oldCache.logicalSatisfied === oldManifest.assets.length
    && oldCache.assetEntries === oldHashes.size
    && oldCommitCount === 1
  ), { oldActiveVersion: oldWorker?.state?.active?.version, cache: oldCache, oldCommitCount });

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
  record("the incident fixture retains the derived shared hashes in the old active generation and the same raw save", (
    partial.retainedHashes === retainedHashes.size
    && partialCache.logicalSatisfied === retainedOldLogicalCount
    && activeMatchesManifest(partialWorker.state?.active, oldManifest, oldVersion)
    && sha256(oldSaveRaw ?? "") === saveFixtureHash
  ), {
    partial,
    partialCache,
    retainedSharedHashes: retainedHashes.size,
    retainedOldLogicalCount,
    activeVersion: partialWorker.state?.active?.version,
    saveHash: sha256(oldSaveRaw ?? ""),
  });

  await closeContext("close-old-partial-fixture");
  currentLabel = "candidate";
  setAudioMode("incident");

  ({ context, page } = await openPersistent(userDataDir));
  diagnosticPhase = "candidate-unqualified-incident-entry";
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  const candidateManifestFromPage = await page.evaluate(async () => (
    await (await fetch(new URL("asset-manifest.json", location.href), { cache: "no-store" })).json()
  ));
  const candidateCacheBefore = await cacheState(page);
  const candidateHashesBeforeRepair = new Set(await cacheHashes(page));
  const candidatePendingDownloadableAssets = candidateDownloadableAssets.filter((asset) => (
    !candidateHashesBeforeRepair.has(asset.hash)
  ));
  const candidatePendingReleaseDeltaAssets = candidateReleaseDeltaAssets.filter((asset) => (
    !candidateHashesBeforeRepair.has(asset.hash)
  ));
  const candidatePendingReleaseDeltaTransportPaths = new Set(
    candidatePendingReleaseDeltaAssets.map(transportPathFor),
  );
  // The waiting worker may finish populating candidate-shell hashes after the
  // page's boot-time React snapshot was taken. Keep the progress assertion
  // candidate-aware without turning that scheduling race into a release-size
  // literal: the UI may start with the observed pending window, but it must
  // never exceed the candidate-derived download plan.
  const candidateProgressTotalMin = candidatePendingDownloadableAssets.length;
  const candidateProgressTotalMax = candidateDownloadableAssets.length;
  record(`the same profile sees ${RELEASE_VERSION} without uninstall, storage clear, or profile replacement`, (
    candidateManifestFromPage.version === candidateManifest.version
    && candidateManifestFromPage.releaseSha === candidateManifest.releaseSha
    && candidateCacheBefore.logicalSatisfied >= retainedCandidateLogicalCount
    && candidateCacheBefore.retainedSatisfied === retainedCandidateLogicalCount
    && (await currentSave(page)) === oldSaveRaw
  ), { candidateVersion: candidateManifestFromPage.version, userDataDir, cache: candidateCacheBefore });

  await waitForV100Ready(page);
  const gift = page.getByRole("dialog", { name: "新しい作戦記録を開始しました", exact: true });
  await gift.waitFor({ state: "visible", timeout: 60_000 });
  const updateNotice = page.getByRole("button", { name: /^(?:更新をダウンロード|不足分だけ再取得)$/u });
  const updateControlsDuringGift = await updateNotice.evaluateAll((controls) => controls.map((control) => {
    const rect = control.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const hit = document.elementFromPoint(centerX, centerY);
    const style = getComputedStyle(control);
    return {
      text: control.textContent?.trim() ?? "",
      disabled: control instanceof HTMLButtonElement ? control.disabled : null,
      visible: rect.width > 0
        && rect.height > 0
        && rect.bottom > 0
        && rect.right > 0
        && rect.top < innerHeight
        && rect.left < innerWidth
        && style.visibility !== "hidden"
        && style.display !== "none",
      hitTest: hit === control || control.contains(hit),
    };
  }));
  const updateDeferredDuringGift = updateControlsDuringGift.every((control) => (
    !control.visible || control.disabled || !control.hitTest
  ));
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
  record("the unqualified V1 incident entry claims one visible legacy gift without importing or writing legacy progression", (
    updateDeferredDuringGift
    && beforeUpdateV100.oldRaw === oldSaveRaw
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
    updateControlsDuringGift,
    oldSavePreserved: beforeUpdateV100.oldRaw === oldSaveRaw,
    mirror: beforeUpdateV100.mirror,
    nativeDatabase: beforeUpdateV100.native?.database ?? null,
    legacyWrites: beforeUpdateV100.legacyWrites,
  });
  await giftConfirmation.click();
  await gift.waitFor({ state: "detached", timeout: 30_000 });
  await waitForV100Ready(page);

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
  record("the partial repair control is exposed only after the one-time gift is acknowledged", (
    await repairButton.isEnabled()
    && await gift.count() === 0
    && (await v100State(page)).raw === beforeUpdateV100.raw
  ));
  const incidentTransportStart = candidateTransportRequests.length;
  await repairButton.click();
  // The held fourth request becomes terminal at the production 30 second
  // no-progress boundary. Keep the observation budget outside that boundary
  // so runner scheduling cannot race the product timeout itself.
  await page.getByText("失敗 3件", { exact: true }).waitFor({
    state: "visible",
    timeout: Math.max(60_000, stallDurationMs + 30_000),
  });
  const incidentRequests = await waitForAudioRequests("incident", 4, 30_000);
  const incidentProgress = await page.locator(".pwa-progress-line").textContent();
  const incidentProgressMatch = /^(\d+) \/ (\d+)件/u.exec(incidentProgress ?? "");
  const incidentProgressCompleted = incidentProgressMatch ? Number(incidentProgressMatch[1]) : null;
  const incidentProgressTotal = incidentProgressMatch ? Number(incidentProgressMatch[2]) : null;
  const incidentCategory = await page.getByText("音声を取得中", { exact: true }).count();
  const failureCounter = await page.getByText("失敗 3件", { exact: true }).count();
  const incidentChangedRequests = candidateTransportRequests
    .filter(({ pathname }) => candidatePendingReleaseDeltaTransportPaths.has(pathname))
    .map(({ pathname }) => pathname);
  const incidentAssetRequests = candidateTransportRequests
    .slice(incidentTransportStart)
    .map(({ pathname }) => pathname);
  const incidentUnchangedStoredRefetches = incidentAssetRequests.filter((pathname) => (
    pathname !== bundlePathname
    && unchangedStoredAssets.some((asset) => transportPathFor(asset) === pathname)
  ));
  const incidentRuntimeAudioSourceRequests = incidentAssetRequests.filter((pathname) => (
    candidateBundledAudioSourcePaths.has(pathname)
  ));
  const incidentUnexpectedRequests = incidentAssetRequests.filter((pathname) => (
    !candidateDownloadTransportPaths.has(pathname)
    && !candidateBundledAudioSourcePaths.has(pathname)
  ));
  const initialIncidentRequests = incidentRequests.filter((request) => request.index <= 4);
  const incidentRetryRequests = incidentRequests.filter((request) => request.index > 4);
  record("the physical incident class fetches the exact release delta before exposing three failed pending requests and one held request", (
    partialCache.logicalSatisfied === retainedOldLogicalCount
    && new Set(incidentChangedRequests).size === candidatePendingReleaseDeltaTransportPaths.size
    && incidentChangedRequests.length === candidatePendingReleaseDeltaTransportPaths.size
    && incidentProgressCompleted !== null
    && incidentProgressTotal >= candidateProgressTotalMin
    && incidentProgressTotal <= candidateProgressTotalMax
    && incidentProgressCompleted >= candidatePendingReleaseDeltaTransportPaths.size
    && incidentProgressCompleted <= incidentProgressTotal
    && incidentCategory === 1
    && failureCounter === 1
    // Preserve the strict initial concurrency contract. A causally separate
    // retry may already exist after the 30 second boundary, but it cannot
    // weaken or replace any member of the exact four-request incident group.
    && initialIncidentRequests.length === 4
    && initialIncidentRequests.slice(0, 3).every((request) => request.completed)
    && !initialIncidentRequests[3].completed
    && incidentRetryRequests.length <= 1
    && incidentRetryRequests.every((request) => !request.completed)
    && incidentRuntimeAudioSourceRequests.every((pathname) => candidateBundledAudioSourcePaths.has(pathname))
    && incidentUnexpectedRequests.length === 0
    && incidentUnchangedStoredRefetches.length === 0
  ), {
    startingLogicalAssets: partialCache.logicalSatisfied,
    exactReleaseDelta: [...candidatePendingReleaseDeltaTransportPaths],
    incidentAssetRequests,
    incidentRuntimeAudioSourceRequests,
    incidentUnexpectedRequests,
    incidentUnchangedStoredRefetches,
    incidentChangedRequests,
    incidentProgress,
    incidentProgressCompleted,
    incidentProgressTotal,
    expectedReleaseDeltaCount: candidatePendingReleaseDeltaTransportPaths.size,
    expectedDownloadableCount: candidatePendingDownloadableAssets.length,
    candidateProgressTotalMin,
    candidateProgressTotalMax,
    candidateDownloadableCount: candidateDownloadableAssets.length,
    incidentCategory,
    failureCounter,
    initialIncidentRequests: initialIncidentRequests.map(({ mode, index, completed }) => ({ mode, index, completed })),
    incidentRetryRequests: incidentRetryRequests.map(({ mode, index, completed }) => ({ mode, index, completed })),
    requests: incidentRequests.map(({ mode, index, completed }) => ({ mode, index, completed })),
  });

  await page.getByRole("button", { name: "中断" }).click();
  await page.getByRole("heading", { name: "ダウンロードを中断しました" }).waitFor({ state: "visible", timeout: 15_000 });
  const cancelledCache = await cacheState(page);
  const hashesBeforeRecovery = new Set(await cacheHashes(page));
  const successfulBeforeRecoveryAssets = candidateManifest.assets.filter((asset) => hashesBeforeRecovery.has(asset.hash));
  const successfulBeforeRecoveryTransportPaths = new Set(successfulBeforeRecoveryAssets.map(transportPathFor));
  const unchangedStoredDirectTransportPaths = new Set(
    unchangedStoredAssets.filter((asset) => !asset.bundlePath).map(transportPathFor),
  );
  const cancelledWorker = await workerState(page);
  const cancelledV100 = await v100State(page);
  record("cancel preserves the old assets plus newly successful assets, old manifest, and save", (
    cancelledCache.logicalSatisfied >= retainedCandidateLogicalCount
    && activeMatchesManifest(cancelledWorker.state?.active, oldManifest, oldVersion)
    && (await currentSave(page)) === oldSaveRaw
    && cancelledV100.raw === beforeUpdateV100.raw
    && cancelledV100.oldRaw === oldSaveRaw
    && cancelledV100.legacyWrites.length === 0
  ), {
    startingLogicalAssets: partialCache.logicalSatisfied,
    retainedSharedHashes: retainedHashes.size,
    retainedCandidateLogicalCount,
    cancelledCache,
    activeVersion: cancelledWorker.state?.active?.version,
    v100SavePreserved: cancelledV100.raw === beforeUpdateV100.raw,
    legacyWrites: cancelledV100.legacyWrites,
  });

  await closeContext("close-cancelled-incident");
  setAudioMode("recovery");
  ({ context, page } = await openPersistent(userDataDir));
  diagnosticPhase = "candidate-unqualified-recovery-entry";
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await waitForV100Ready(page);
  const relaunchedBefore = await workerState(page);
  const relaunchedBeforeV100 = await v100State(page);
  record("close/relaunch retains the partial cache, old active manifest, and exact raw save", (
    activeMatchesManifest(relaunchedBefore.state?.active, oldManifest, oldVersion)
    && (await cacheState(page)).logicalSatisfied === cancelledCache.logicalSatisfied
    && (await currentSave(page)) === oldSaveRaw
    && relaunchedBeforeV100.raw === beforeUpdateV100.raw
    && relaunchedBeforeV100.legacyWrites.length === 0
    && await page.getByRole("dialog", { name: "新しい作戦記録を開始しました", exact: true }).count() === 0
  ), {
    activeVersion: relaunchedBefore.state?.active?.version,
    cache: await cacheState(page),
    v100SavePreserved: relaunchedBeforeV100.raw === beforeUpdateV100.raw,
    legacyWrites: relaunchedBeforeV100.legacyWrites,
  });

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

  const updatedWorker = await waitForActiveGeneration(page, candidateManifest, { timeoutMs: 180_000 });
  const startUpdatedGame = page.getByRole("button", { name: "ゲームを始める", exact: true });
  await startUpdatedGame.waitFor({ state: "visible", timeout: 120_000 });
  await startUpdatedGame.click();
  await waitForV100Ready(page);
  const finalCache = await cacheState(page);
  const finalSaveRaw = await currentSave(page);
  const finalV100 = await v100State(page);
  const completedRecoveryRequests = audioRequests.filter((request) => request.mode === "recovery");
  const slow = completedRecoveryRequests[1];
  record("the actual audio-v1.bin retry progresses for over 30 seconds and completes as one shared request", (
    completedRecoveryRequests.length === 2
    && slow?.completed
    && slow.durationMs > 30_000
    && slow.progress.length >= 30
    && slow.progress.every((entry, index, entries) => index === 0 || entry.bytes > entries[index - 1].bytes)
  ), { requestCount: completedRecoveryRequests.length, slowDurationMs: slow?.durationMs, progressEvents: slow?.progress.length });
  record(`partial recovery reaches the candidate manifest, failed 0, commits ${RELEASE_VERSION}, and preserves raw save bytes`, (
    finalCache.logicalSatisfied === candidateManifest.assets.length
    && finalCache.assetEntries === candidateHashes.size
    && activeMatchesManifest(updatedWorker?.state?.active, candidateManifest)
    && updatedWorker.activeWorkerState === "activated"
    && finalSaveRaw === oldSaveRaw
    && finalV100.raw === beforeUpdateV100.raw
    && finalV100.oldRaw === oldSaveRaw
    && finalV100.legacyWrites.length === 0
    && (await commitCountFor(page, candidateManifest)) === 1
  ), {
    finalCache,
    activeVersion: updatedWorker?.state?.active?.version,
    savePreserved: finalSaveRaw === oldSaveRaw,
    v100SavePreserved: finalV100.raw === beforeUpdateV100.raw,
    legacyWrites: finalV100.legacyWrites,
    candidateCommitCount: await commitCountFor(page, candidateManifest),
  });

  const recoveryAssetRequests = candidateTransportRequests
    .slice(recoveryTransportStart)
    .map((request) => request.pathname);
  const successfulRefetches = recoveryAssetRequests.filter((pathname) => (
    pathname !== bundlePathname && successfulBeforeRecoveryTransportPaths.has(pathname)
  ));
  const unchangedHashRefetches = recoveryAssetRequests.filter((pathname) => (
    pathname !== bundlePathname && unchangedStoredDirectTransportPaths.has(pathname)
  ));
  record("recovery fetches only failed or pending content, never re-fetches any successful asset, and does not fetch the bundle per slice", (
    recoveryAssetRequests.every((pathname) => candidateDownloadTransportPaths.has(pathname))
    && successfulRefetches.length === 0
    && unchangedHashRefetches.length === 0
    && recoveryAssetRequests.filter((pathname) => pathname === bundlePathname).length === 2
  ), {
    successfulBeforeRecoveryHashes: hashesBeforeRecovery.size,
    successfulBeforeRecoveryLogicalAssets: successfulBeforeRecoveryAssets.length,
    recoveryAssetRequests,
    downloadTargetTransportPaths: [...candidateDownloadTransportPaths],
    successfulRefetches,
    unchangedHashRefetches,
  });

  await closeContext("close-candidate-committed");
  ({ context, page } = await openPersistent(userDataDir));
  diagnosticPhase = "candidate-unqualified-committed-relaunch";
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await waitForV100Ready(page);
  await page.locator(".v100-shell").waitFor({ state: "visible", timeout: 60_000 });
  const committedRelaunch = await workerState(page);
  const committedRelaunchV100 = await v100State(page);
  record(`relaunch keeps the committed ${RELEASE_VERSION} generation and save`, (
    activeMatchesManifest(committedRelaunch.state?.active, candidateManifest)
    && (await currentSave(page)) === oldSaveRaw
    && committedRelaunchV100.raw === beforeUpdateV100.raw
    && committedRelaunchV100.oldRaw === oldSaveRaw
    && committedRelaunchV100.legacyWrites.length === 0
    && await page.getByRole("dialog", { name: "新しい作戦記録を開始しました", exact: true }).count() === 0
  ), {
    activeVersion: committedRelaunch.state?.active?.version,
    v100SavePreserved: committedRelaunchV100.raw === beforeUpdateV100.raw,
    legacyWrites: committedRelaunchV100.legacyWrites,
  });

  if (browserName === "chromium") {
    diagnosticPhase = "candidate-offline-relaunch";
    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
    await waitForV100Ready(page);
    await page.locator(".v100-shell").waitFor({ state: "visible", timeout: 60_000 });
    const offlineV100 = await v100State(page);
    record("offline relaunch uses the committed generation without changing the save", (
      activeMatchesManifest((await workerState(page)).state?.active, candidateManifest)
      && (await currentSave(page)) === oldSaveRaw
      && offlineV100.raw === beforeUpdateV100.raw
      && offlineV100.oldRaw === oldSaveRaw
      && offlineV100.legacyWrites.length === 0
    ), {
      v100SavePreserved: offlineV100.raw === beforeUpdateV100.raw,
      legacyWrites: offlineV100.legacyWrites,
    });
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
  diagnosticPhase = "manifest-rollback-reload";
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1_000);
  const rollbackV100 = await v100State(page);
  const commitOnlyButton = page.getByRole("button", { name: "保存済みデータを反映", exact: true });
  await commitOnlyButton.waitFor({ state: "visible", timeout: 60_000 });
  record("rollback restores the old generation without changing the save", (
    rollback?.type === "pwa:rolled-back"
    && activeMatchesManifest((await workerState(page)).state?.active, oldManifest, oldVersion)
    && (await currentSave(page)) === oldSaveRaw
    && rollbackV100.raw === beforeUpdateV100.raw
    && rollbackV100.oldRaw === oldSaveRaw
    && rollbackV100.legacyWrites.length === 0
  ), {
    rollback,
    v100SavePreserved: rollbackV100.raw === beforeUpdateV100.raw,
    legacyWrites: rollbackV100.legacyWrites,
  });
} catch (error) {
  record("partial-failed update flow completes without an unhandled harness error", false, {
    error: String(error?.stack ?? error),
  });
} finally {
  if (context) await closeContext("final-context-close").catch(() => {});
  await new Promise((resolve) => server.close(resolve));
  const unexpectedRequestFailures = diagnostics.requestFailures.filter((failure) => (
    !failure.error.includes("ERR_ABORTED")
    && !failure.error.includes("NS_BINDING_ABORTED")
    && !failure.error.includes("Load request cancelled")
    && !failure.error.includes("ERR_INTERNET_DISCONNECTED")
  ));
  const expectedInjectedConsoleErrors = diagnostics.consoleErrors.filter((entry) => (
    entry.message === "Failed to load resource: the server responded with a status of 503 (Service Unavailable)"
  ));
  const unexpectedConsoleErrors = diagnostics.consoleErrors.filter((entry) => (
    entry.message !== "Failed to load resource: the server responded with a status of 503 (Service Unavailable)"
  ));
  record("browser diagnostics contain no console/page/unexpected HTTP/request failure", (
    expectedInjectedConsoleErrors.length === 3
    && unexpectedConsoleErrors.length === 0
    && diagnostics.pageErrors.length === 0
    && diagnostics.httpErrors.length === 0
    && unexpectedRequestFailures.length === 0
  ), { ...diagnostics, expectedInjectedConsoleErrors: expectedInjectedConsoleErrors.length, consoleErrors: unexpectedConsoleErrors, requestFailures: unexpectedRequestFailures });
  record("context teardown has no late diagnostics", diagnostics.teardown.length === 0, {
    teardown: diagnostics.teardown,
  });
  await mkdir(evidenceDir, { recursive: true });
  const sourceFiles = [
    "scripts/pwa-partial-failed-update-browser-smoke.mjs",
    "app/PwaGate.tsx",
    "app/GameEntry.tsx",
    "app/v100Save.js",
    "app/v100CampaignStorage.js",
  ];
  const sources = [];
  for (const file of sourceFiles) {
    sources.push({ file, sha256: sha256(await readFile(new URL(`../${file}`, import.meta.url))) });
  }
  await writeFile(path.join(evidenceDir, `pwa-partial-failed-update-${browserName}.json`), `${JSON.stringify({
    browser: browserName,
    baseUrl,
    oldRoot,
    candidateRoot,
    oldManifest: { version: oldManifest.version, releaseSha: oldManifest.releaseSha, assets: oldManifest.assets.length },
    candidateManifest: { version: candidateManifest.version, releaseSha: candidateManifest.releaseSha, assets: candidateManifest.assets.length },
    persistentProfile: userDataDir,
    saveFixtureSha256: saveFixtureHash,
    sources,
    build: await productionBuildIdentity(),
    fixture: {
      logicalSatisfied: retainedOldLogicalCount,
      retainedCandidateLogicalCount,
      retainedSharedHashes: retainedHashes.size,
      total: oldManifest.assets.length,
      candidateTotal: candidateManifest.assets.length,
      candidateDownloadTargets: candidateDownloadableAssets.length,
      unchangedStored: unchangedStoredAssets.length,
      unchangedMissing: unchangedMissingAssets.length,
      manifestChanged: manifestDelta.changed.length,
      manifestMissingNew: manifestDelta.missingNew.length,
      manifestRemoved: manifestDelta.removed.length,
      saveSha256: saveFixtureHash,
    },
    transport: { stallDurationMs, slowDurationMs, audioRequests },
    results,
    failures,
  }, null, 2)}\n`, "utf8");
}

console.log(`\n${results.filter((result) => result.passed).length} / ${results.length} partial-failed PWA cases passed`);
if (failures.length > 0) process.exitCode = 1;
