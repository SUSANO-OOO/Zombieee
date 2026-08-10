// Version 0.9.6 PWA update planning and activation gating.
//
// Separated from the service worker so the rules that decide *when* a new
// release may take over are plain, testable functions. Issue #114 section 6
// requires that a new version is announced on a safe screen, that only added
// and changed assets are downloaded, that the payload is verified against the
// release version and release SHA before activation, and that a failed update
// leaves the previous version bootable.

import { diffAssetManifests, isContentHash, validateAssetManifest } from "./pwaAssetManifest.js";

/**
 * Screens where interrupting the player is acceptable. Battle, survival, and
 * any result screen are excluded because activating there would discard an
 * unsaved run.
 */
export const SAFE_ACTIVATION_SCREENS = Object.freeze([
  "title",
  "map",
  "records",
  "personnel",
  "storage",
]);

const safeScreenSet = new Set(SAFE_ACTIVATION_SCREENS);

/**
 * Decides whether a pending release may activate right now.
 *
 * Every blocking condition is reported so the UI can explain the wait instead
 * of silently doing nothing.
 */
export function evaluateActivationSafety({
  screen,
  battleActive = false,
  resultSaving = false,
  saveMutationPending = false,
  downloadActive = false,
} = {}) {
  const blockers = [];
  if (!safeScreenSet.has(screen)) blockers.push("unsafe-screen");
  if (battleActive) blockers.push("battle-active");
  if (resultSaving) blockers.push("result-saving");
  if (saveMutationPending) blockers.push("save-mutation-pending");
  if (downloadActive) blockers.push("download-active");
  return { safe: blockers.length === 0, blockers };
}

/**
 * Compares the installed release with a freshly fetched one.
 *
 * `storedHashes` is what the device actually holds, so an asset already on the
 * device is never counted as a download even if its path changed.
 */
export function evaluateUpdate({
  installedManifest,
  publishedManifest,
  storedHashes,
} = {}) {
  const published = validateAssetManifest(publishedManifest);
  if (!published.valid) {
    return { available: false, reason: "invalid-published-manifest", errors: published.errors };
  }
  if (!installedManifest) {
    return { available: false, reason: "not-installed" };
  }

  const sameRelease = installedManifest.version === publishedManifest.version
    && installedManifest.releaseSha === publishedManifest.releaseSha;
  if (sameRelease) return { available: false, reason: "already-current" };

  const diff = diffAssetManifests(installedManifest, publishedManifest, { retainedHashes: storedHashes });

  return {
    available: true,
    fromVersion: installedManifest.version,
    toVersion: publishedManifest.version,
    releaseSha: publishedManifest.releaseSha,
    downloadCount: diff.downloadCount,
    downloadBytes: diff.downloadBytes,
    unchangedCount: diff.unchanged.length,
    reusedCount: diff.reused.length,
    missingCount: diff.missing.length,
    removedCount: diff.removed.length,
    byCategory: diff.byCategory,
    diff,
  };
}

/**
 * Verifies a downloaded release before it is allowed to become active.
 *
 * The combination of content hash, release version, and release SHA is checked
 * together: a manifest whose assets are all present but whose identity does not
 * match the release being installed is rejected rather than activated.
 */
export function verifyUpdatePayload({
  manifest,
  storedHashes,
  expectedVersion,
  expectedReleaseSha,
} = {}) {
  const errors = [];

  const structural = validateAssetManifest(manifest);
  if (!structural.valid) errors.push(...structural.errors);

  if (expectedVersion !== undefined && manifest?.version !== expectedVersion) {
    errors.push(`version mismatch: expected ${expectedVersion}, manifest declares ${manifest?.version}`);
  }
  if (expectedReleaseSha !== undefined && manifest?.releaseSha !== expectedReleaseSha) {
    errors.push(`release SHA mismatch: expected ${expectedReleaseSha}, manifest declares ${manifest?.releaseSha}`);
  }

  const available = storedHashes instanceof Set ? storedHashes : new Set();
  const missing = [];
  for (const asset of manifest?.assets ?? []) {
    if (!isContentHash(asset?.hash)) continue;
    if (!available.has(asset.hash)) missing.push(asset.path);
  }
  if (missing.length > 0) {
    errors.push(`${missing.length} asset(s) are not present on the device`);
  }

  return {
    verified: errors.length === 0,
    errors,
    missingPaths: missing,
  };
}

/**
 * Chooses what the app should boot when a release is pending or has failed.
 *
 * A failed update must never leave the player without a bootable version, so
 * the previous generation is selected whenever the new one is unverified.
 */
export function selectBootManifest({ active, previous, activeVerified = true } = {}) {
  if (active && activeVerified) return { manifest: active, source: "active" };
  if (previous) return { manifest: previous, source: "rollback" };
  if (active) return { manifest: active, source: "active-unverified" };
  return { manifest: null, source: "none" };
}

/** Player-facing summary for the update prompt. */
export function describeUpdate(evaluation, { formatBytes }) {
  if (!evaluation?.available) return null;
  return {
    headline: `Version ${evaluation.toVersion}を利用できます`,
    downloadLine: `追加データ ${formatBytes(evaluation.downloadBytes)}をダウンロードします`,
    fileLine: `${evaluation.downloadCount}件を更新・${evaluation.unchangedCount}件は再ダウンロードしません`,
    wifiHint: "Wi-Fi接続を推奨します",
  };
}
