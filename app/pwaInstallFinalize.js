// Complete a verified PWA download in one place.
//
// The same session may reach this after its initial run or after a
// failure-only retry. Keeping commit and UI finalization here prevents the two
// paths from disagreeing about which generation is installed.

export async function finalizePwaDownload({
  final,
  manifest,
  registration,
  refreshStored,
  commitManifest,
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

  // Persistence is best effort, but it still belongs to both normal and retry
  // completion paths. A refused request must not turn a valid commit into a
  // false download failure.
  await persistStorage?.();
  await onCommitted?.(manifest, response);
  return { state: "complete", committed: true, response: response ?? null };
}
