// Same-fixture comparison for Issue #133.
//
// This script measures the complete first-install pack. It never creates a
// partial install subset and it never changes the browser's cache. The baseline is read
// from the immutable 0.9.8.1 release tree; the candidate is the checked-out
// code-derived manifest.

import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { PRODUCTION_AUDIO_MANIFEST } from "../app/productionAudio.js";
import {
  distinctDownloadBytes,
  selectPreferredAudioSource,
  summarizeByCategory,
  summarizeByPack,
} from "../app/pwaAssetManifest.js";
import { createAssetDownloadSession } from "../app/pwaDownloadSession.js";

const BASELINE_SHA = "79e139f5b78be4fe4ac389941fbd280b93d29a58";
const FIXTURE = Object.freeze({
  requestWaitMs: 120,
  bandwidthBytesPerSecond: 4_000_000,
  cacheWriteBaseMs: 2,
  cacheWriteBytesPerSecond: 40_000_000,
  concurrency: 3,
  maxAttempts: 1,
});
const SWEEP_CONCURRENCIES = Object.freeze([2, 3, 4]);
const includeMetrics = process.argv.includes("--full");
const includeSweep = process.argv.includes("--sweep");

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, Math.max(0, ms));
    const abort = () => {
      clearTimeout(timer);
      const error = new Error("aborted");
      error.name = "AbortError";
      reject(error);
    };
    signal?.addEventListener("abort", abort, { once: true });
  });
}

function extensionOf(assetPath) {
  return path.extname(assetPath).toLowerCase().replace(/^\./, "") || "none";
}

function summarizeExtensions(assets, pathFor = (asset) => asset.path) {
  const result = {};
  for (const asset of assets) {
    const key = extensionOf(pathFor(asset));
    result[key] ??= { count: 0, bytes: 0 };
    result[key].count += 1;
    result[key].bytes += asset.bytes;
  }
  return result;
}

function duplicateHashSummary(assets) {
  const groups = new Map();
  for (const asset of assets) {
    const group = groups.get(asset.hash) ?? [];
    group.push(asset);
    groups.set(asset.hash, group);
  }
  const duplicates = [...groups.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([hash, group]) => ({
      hash,
      count: group.length,
      bytes: group[0].bytes,
      duplicateBytes: group[0].bytes * (group.length - 1),
      paths: group.map((asset) => asset.path),
    }));
  return {
    groupCount: duplicates.length,
    duplicatePathCount: duplicates.reduce((sum, group) => sum + group.count - 1, 0),
    duplicateBytes: duplicates.reduce((sum, group) => sum + group.duplicateBytes, 0),
    groups: duplicates,
  };
}

function manifestAnalysis(manifest) {
  const assets = manifest.assets ?? [];
  const audioSources = (PRODUCTION_AUDIO_MANIFEST.assets ?? []).flatMap((asset) => asset.sources ?? []);
  const preferredAudio = (PRODUCTION_AUDIO_MANIFEST.assets ?? [])
    .map((asset) => selectPreferredAudioSource(asset.sources))
    .filter(Boolean);
  const pairedAudioIds = new Set(
    (PRODUCTION_AUDIO_MANIFEST.assets ?? [])
      .filter((asset) => (asset.sources ?? []).some((source) => source.type === "audio/mpeg")
        && (asset.sources ?? []).some((source) => source.type === "audio/ogg"))
      .map((asset) => asset.id),
  );
  const selectedPaths = new Set(preferredAudio.map((source) => source.src));
  const manifestAudioPaths = new Set(assets.filter((asset) => asset.category === "audio").map((asset) => asset.path));
  const smallFiles = assets.filter((asset) => asset.bytes < 16 * 1024);
  return {
    version: manifest.version,
    releaseSha: manifest.releaseSha,
    assetCount: assets.length,
    manifestBytes: assets.reduce((sum, asset) => sum + asset.bytes, 0),
    distinctBytes: distinctDownloadBytes(assets),
    byRuntimeExtension: summarizeExtensions(assets),
    byTransportExtension: summarizeExtensions(assets, (asset) => asset.bundlePath ?? asset.sourcePath ?? asset.path),
    byCategory: summarizeByCategory(assets),
    byPack: summarizeByPack(assets),
    duplicateHashes: duplicateHashSummary(assets),
    smallFilesUnder16KiB: {
      count: smallFiles.length,
      bytes: smallFiles.reduce((sum, asset) => sum + asset.bytes, 0),
    },
    audio: {
      cueCount: (PRODUCTION_AUDIO_MANIFEST.assets ?? []).length,
      allSourceCount: audioSources.length,
      allSourceBytes: audioSources.reduce((sum, source) => {
        const asset = assets.find((entry) => entry.path === source.src);
        return sum + (asset?.bytes ?? 0);
      }, 0),
      preferredSourceCount: preferredAudio.length,
      selectedPathCount: [...selectedPaths].filter((sourcePath) => manifestAudioPaths.has(sourcePath)).length,
      pairedCueCount: pairedAudioIds.size,
      duplicatedFormatRequestCount: Math.max(0, audioSources.length - preferredAudio.length),
    },
  };
}

function groupMetrics(metrics) {
  const groups = {};
  for (const metric of metrics) {
    const key = `${metric.category ?? "unknown"}/${extensionOf(metric.transportPath ?? metric.path)}`;
    groups[key] ??= {
      count: 0,
      fetchedBytes: 0,
      requestWaitMs: 0,
      transferMs: 0,
      networkMs: 0,
      verifyMs: 0,
      cacheWriteMs: 0,
      retries: 0,
      failures: 0,
      deduped: 0,
    };
    const group = groups[key];
    group.count += 1;
    group.fetchedBytes += metric.fetchedBytes ?? 0;
    group.requestWaitMs += metric.requestWaitMs ?? 0;
    group.transferMs += metric.transferMs ?? 0;
    group.networkMs += metric.networkMs ?? 0;
    group.verifyMs += metric.verifyMs ?? 0;
    group.cacheWriteMs += metric.cacheWriteMs ?? 0;
    group.retries += Math.max(0, (metric.attempts ?? 0) - 1);
    if (metric.status === "failed") group.failures += 1;
    if (metric.status === "deduped") group.deduped += 1;
  }
  return groups;
}

async function measure(label, assets, { concurrency = FIXTURE.concurrency, maxAttempts = FIXTURE.maxAttempts, failOnce = false } = {}) {
  const bodyHashes = new WeakMap();
  const calls = new Map();
  const bundleBytesByPath = new Map();
  for (const asset of assets) {
    if (asset.bundlePath) bundleBytesByPath.set(
      asset.bundlePath,
      (bundleBytesByPath.get(asset.bundlePath) ?? 0) + asset.bytes,
    );
  }
  const bundlePromises = new Map();
  const store = {
    has: async () => false,
    put: async (asset) => {
      await wait(FIXTURE.cacheWriteBaseMs + (asset.bytes / FIXTURE.cacheWriteBytesPerSecond) * 1000);
    },
  };
  const fetchAsset = async (asset, { signal }) => {
    const attempt = (calls.get(asset.path) ?? 0) + 1;
    calls.set(asset.path, attempt);
    if (failOnce && attempt === 1) {
      await wait(FIXTURE.requestWaitMs, signal);
      return { ok: false, status: 503, requestWaitMs: FIXTURE.requestWaitMs, transferMs: 0 };
    }
    if (asset.bundlePath) {
      let entry = bundlePromises.get(asset.bundlePath);
      if (!entry) {
        const bundleBytes = bundleBytesByPath.get(asset.bundlePath) ?? 0;
        const promise = (async () => {
          const transferMs = (bundleBytes / FIXTURE.bandwidthBytesPerSecond) * 1000;
          await wait(FIXTURE.requestWaitMs + transferMs, signal);
          return {
            body: new Uint8Array(bundleBytes),
            requestWaitMs: FIXTURE.requestWaitMs,
            transferMs,
            networkMs: FIXTURE.requestWaitMs + transferMs,
          };
        })();
        entry = { promise, reported: false };
        bundlePromises.set(asset.bundlePath, entry);
      }
      const bundle = await entry.promise;
      const ownsRequestMetrics = !entry.reported;
      entry.reported = true;
      const offset = Number(asset.bundleOffset);
      const body = bundle.body.slice(offset, offset + asset.bundleBytes);
      bodyHashes.set(body, asset.hash);
      return {
        ok: true,
        status: 200,
        body,
        requestWaitMs: ownsRequestMetrics ? bundle.requestWaitMs : 0,
        transferMs: ownsRequestMetrics ? bundle.transferMs : 0,
        networkMs: ownsRequestMetrics ? bundle.networkMs : 0,
        networkRequestCount: ownsRequestMetrics ? 1 : 0,
      };
    }
    const transferMs = (asset.bytes / FIXTURE.bandwidthBytesPerSecond) * 1000;
    await wait(FIXTURE.requestWaitMs + transferMs, signal);
    const body = new Uint8Array(asset.bytes);
    bodyHashes.set(body, asset.hash);
    return {
      ok: true,
      status: 200,
      body,
      requestWaitMs: FIXTURE.requestWaitMs,
      transferMs,
    };
  };
  const digest = async (body) => {
    // Exercise the real Web Crypto SHA-256 path while keeping the fixture body
    // independent from the release hashes.
    await globalThis.crypto.subtle.digest("SHA-256", body);
    return bodyHashes.get(body);
  };
  const startedAt = Date.now();
  const session = createAssetDownloadSession({
    assets,
    fetchAsset,
    store,
    digest,
    concurrency,
    maxAttempts,
    heartbeatMs: 2000,
  });
  const final = await session.start();
  const elapsedMs = Date.now() - startedAt;
  const metrics = final.metrics ?? [];
  const totalRetries = [...calls.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0);
  return {
    label,
    concurrency,
    assetCount: assets.length,
    distinctBytes: distinctDownloadBytes(assets),
    elapsedMs,
    state: final.state,
    completedCount: final.completedCount,
    completedBytes: final.completedBytes,
    totalFetchedBytes: final.totalFetchedBytes,
    retryFetchedBytes: final.retryFetchedBytes,
    requestCount: final.requestCount,
    retryCount: final.retryCount,
    timeoutCount: final.timeoutCount,
    cacheHitCount: final.cacheHitCount,
    dedupeCount: final.dedupeCount,
    networkMs: final.networkMs,
    requestWaitMs: final.requestWaitMs,
    transferMs: final.transferMs,
    verifyMs: final.verifyMs,
    cacheWriteMs: final.cacheWriteMs,
    failureCount: final.failedCount,
    retriesObservedByFixture: totalRetries,
    maxObservedConcurrency: final.maxObservedConcurrency,
    byCategoryAndExtension: groupMetrics(metrics),
    ...(includeMetrics ? { metrics } : {}),
  };
}

const currentManifest = JSON.parse(await readFile(new URL("../public/asset-manifest.json", import.meta.url), "utf8"));
const baselineManifest = JSON.parse(execFileSync("git", ["show", `${BASELINE_SHA}:public/asset-manifest.json`], { encoding: "utf8" }));
const [baseline, candidate] = await Promise.all([
  measure("0.9.8.1 complete first-install pack", baselineManifest.assets),
  measure("0.9.8.2 complete first-install pack", currentManifest.assets),
]);
const improvementPercent = baseline.elapsedMs > 0
  ? ((baseline.elapsedMs - candidate.elapsedMs) / baseline.elapsedMs) * 100
  : 0;

const retryProbe = await measure("candidate retry probe", currentManifest.assets.slice(0, 3), {
  concurrency: 2,
  maxAttempts: 2,
  failOnce: true,
});

const sweep = includeSweep
  ? await Promise.all(SWEEP_CONCURRENCIES.map((concurrency) => measure(
    `candidate concurrency ${concurrency}`,
    currentManifest.assets,
    { concurrency },
  )))
  : undefined;

console.log(JSON.stringify({
  fixture: FIXTURE,
  baseline: manifestAnalysis(baselineManifest),
  candidate: manifestAnalysis(currentManifest),
  comparison: {
    fullDownloadElapsedMs: {
      baseline: baseline.elapsedMs,
      candidate: candidate.elapsedMs,
    },
    fullDownloadImprovementPercent: Number(improvementPercent.toFixed(2)),
    passesFiftyPercentTarget: improvementPercent >= 50,
    stageStartMetricUsed: false,
  },
  measurements: { baseline, candidate, retryProbe, ...(sweep ? { sweep } : {}) },
  browserAndDeviceFollowUp: {
    serviceWorkerPath: "same-origin sw.js under the document base path; verified by browser QA",
    chromium: "run separately with the full-install browser smoke",
    webkit: "run separately; WebKit is not a physical iPhone",
    physicalIPhoneSafariMemoryAndDecode: "not measurable in this Node fixture; do not report as verified",
  },
}, null, 2));
