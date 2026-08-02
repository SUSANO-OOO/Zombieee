// Complete a verified PWA download in one place.
//
// The same session may reach this after its initial run or after a
// failure-only retry. Keeping commit and UI finalization here prevents the two
// paths from disagreeing about which generation is installed.

import { manifestCacheComplete, manifestsEqual } from "./pwaManifestCommit.js";

async function commitVerifiedManifest({
  manifest,
  registration,
  commitManifest,
  readActiveState,
  persistStorage,
  onCommitFailed,
  onCommitted,
} = {}) {
  // Cache Storage alone is not an install. The worker's active generation is
  // the durable pointer that makes an offline relaunch resolve those verified
  // hashes, so an unavailable worker is a commit failure just like a missing
  // acknowledgement.
  const response = registration
    ? await commitManifest?.(registration, manifest)
    : null;
  if (!registration || response?.type !== "pwa:committed") {
    await onCommitFailed?.(response);
    return { state: "commit-failed", committed: false, response: response ?? null };
  }

  // An acknowledgement alone is not enough: a stale worker or an interrupted
  // state write can reply successfully without making the candidate active.
  // Re-read the worker state and require the complete generation identity.
  let activeState = null;
  try {
    activeState = await readActiveState?.(registration);
  } catch {
    activeState = null;
  }
  if (!manifestsEqual(activeState?.active, manifest)) {
    const failed = { ...response, type: "pwa:commit-failed", reason: "active-mismatch" };
    await onCommitFailed?.(failed);
    return { state: "commit-failed", committed: false, response: failed };
  }

  // Persistence is best effort, but it still belongs to both normal and retry
  // completion paths. A refused request must not turn a valid commit into a
  // false download failure.
  await persistStorage?.();
  await onCommitted?.(manifest, response, activeState);
  return { state: "complete", committed: true, response, activeState };
}

export async function finalizePwaDownload({
  final,
  manifest,
  registration,
  refreshStored,
  commitManifest,
  readActiveState,
  persistStorage,
  onIncomplete,
  onCommitFailed,
  onCommitted,
} = {}) {
  await refreshStored?.();

  if (final?.state !== "complete") {
    await onIncomplete?.(final);
    return { state: final?.state ?? "failed", committed: false };
  }

  return commitVerifiedManifest({
    manifest,
    registration,
    commitManifest,
    readActiveState,
    persistStorage,
    onCommitFailed,
    onCommitted,
  });
}

/**
 * Completes only the missing generation-pointer write after a reload. It never
 * creates a download session, touches an asset body, or writes Cache Storage;
 * it first proves the already saved pack is still complete.
 */
export async function recoverVerifiedPwaManifest({
  manifest,
  storedHashes,
  refreshStored,
  registration,
  commitManifest,
  readActiveState,
  persistStorage,
  onIncomplete,
  onCommitFailed,
  onCommitted,
} = {}) {
  const refreshed = await refreshStored?.();
  const hashes = refreshed instanceof Set ? refreshed : storedHashes;
  if (!manifestCacheComplete(manifest, hashes)) {
    const incomplete = { state: "failed", reason: "cache-incomplete" };
    await onIncomplete?.(incomplete);
    return { state: "failed", committed: false, reason: incomplete.reason };
  }
  return commitVerifiedManifest({
    manifest,
    registration,
    commitManifest,
    readActiveState,
    persistStorage,
    onCommitFailed,
    onCommitted,
  });
}
