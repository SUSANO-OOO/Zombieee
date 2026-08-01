// Same-fixture comparison for Issue #133.
//
// It deliberately measures the old 0.9.8.1 full-pack gate from the immutable
// public release manifest and the candidate's code-derived first-play pack.
// The fixture is deterministic and records per-asset network/verify/cache
// timings through the production download session.

import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

import { assetsForInstall } from "../app/pwaPlayablePack.js";
import { distinctDownloadBytes } from "../app/pwaAssetManifest.js";
import { createAssetDownloadSession } from "../app/pwaDownloadSession.js";

const BASELINE_SHA = "79e139f5b78be4fe4ac389941fbd280b93d29a58";
const FIXTURE = Object.freeze({
  latencyMs: 120,
  bandwidthBytesPerSecond: 4_000_000,
  concurrency: 3,
  maxAttempts: 1,
});

const includeMetrics = process.argv.includes("--full");

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    const abort = () => {
      clearTimeout(timer);
      const error = new Error("aborted");
      error.name = "AbortError";
      reject(error);
    };
    signal?.addEventListener("abort", abort, { once: true });
  });
}

function groupMetrics(metrics) {
  const groups = {};
  for (const metric of metrics) {
    const key = `${metric.category ?? "unknown"}/${metric.installTier ?? "unknown"}`;
    groups[key] ??= { count: 0, fetchedBytes: 0, networkMs: 0, verifyMs: 0, cacheWriteMs: 0, failures: 0 };
    const group = groups[key];
    group.count += 1;
    group.fetchedBytes += metric.fetchedBytes ?? 0;
    group.networkMs += metric.networkMs ?? 0;
    group.verifyMs += metric.verifyMs ?? 0;
    group.cacheWriteMs += metric.cacheWriteMs ?? 0;
    if (metric.status === "failed") group.failures += 1;
  }
  return groups;
}

async function measure(label, assets) {
  const bodyHashes = new WeakMap();
  const store = {
    has: async () => false,
    put: async () => {},
  };
  const fetchAsset = async (asset, { signal }) => {
    const transferMs = FIXTURE.latencyMs + (asset.bytes / FIXTURE.bandwidthBytesPerSecond) * 1000;
    await wait(transferMs, signal);
    const body = new Uint8Array(asset.bytes);
    bodyHashes.set(body, asset.hash);
    return { ok: true, status: 200, body };
  };
  const digest = async (body) => bodyHashes.get(body);
  const startedAt = Date.now();
  const session = createAssetDownloadSession({
    assets,
    fetchAsset,
    store,
    digest,
    concurrency: FIXTURE.concurrency,
    maxAttempts: FIXTURE.maxAttempts,
    heartbeatMs: 2000,
  });
  const final = await session.start();
  const elapsedMs = Date.now() - startedAt;
  const metrics = final.metrics ?? [];
  const largest = [...assets].sort((left, right) => right.bytes - left.bytes)[0] ?? null;
  return {
    label,
    assetCount: assets.length,
    distinctBytes: distinctDownloadBytes(assets),
    elapsedMs,
    state: final.state,
    completedCount: final.completedCount,
    completedBytes: final.completedBytes,
    totalFetchedBytes: final.totalFetchedBytes,
    retryFetchedBytes: final.retryFetchedBytes,
    failureCount: final.failedCount,
    maxObservedConcurrency: final.maxObservedConcurrency,
    maxAssetBytes: largest?.bytes ?? 0,
    maxAssetPath: largest?.path ?? null,
    byCategoryAndTier: groupMetrics(metrics),
    ...(includeMetrics ? { metrics } : {}),
  };
}

const currentManifest = JSON.parse(await readFile(new URL("../public/asset-manifest.json", import.meta.url), "utf8"));
const baselineManifest = JSON.parse(execFileSync("git", ["show", `${BASELINE_SHA}:public/asset-manifest.json`], { encoding: "utf8" }));
const firstPlayAssets = assetsForInstall(currentManifest, { firstPlayOnly: true });
const [baseline, candidate] = await Promise.all([
  measure("0.9.8.1 full-pack gate", baselineManifest.assets),
  measure("0.9.8.2 first-play gate", firstPlayAssets),
]);

const improvementPercent = baseline.elapsedMs > 0
  ? ((baseline.elapsedMs - candidate.elapsedMs) / baseline.elapsedMs) * 100
  : 0;

console.log(JSON.stringify({
  fixture: FIXTURE,
  baselineManifest: {
    version: baselineManifest.version,
    releaseSha: BASELINE_SHA,
    assetCount: baselineManifest.assets.length,
    distinctBytes: distinctDownloadBytes(baselineManifest.assets),
  },
  candidateManifest: {
    version: currentManifest.version,
    assetCount: currentManifest.assets.length,
    firstPlayAssetCount: firstPlayAssets.length,
    firstPlayDistinctBytes: distinctDownloadBytes(firstPlayAssets),
  },
  comparison: {
    baselineStage1StartMs: baseline.elapsedMs,
    candidateStage1StartMs: candidate.elapsedMs,
    stage1StartImprovementPercent: Number(improvementPercent.toFixed(2)),
    passesSixtyPercentGate: improvementPercent >= 60,
  },
  baseline,
  candidate,
}, null, 2));
