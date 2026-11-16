// Read the cache at the user action boundary, after the entry/gift/worker waits.
// A boot-time cache read can miss fonts stored while those waits are in progress.
export function candidateDownloadProgressWindow(downloadable, storedHashesAtStart) {
  if (!Array.isArray(downloadable) || !(storedHashesAtStart instanceof Set)) {
    throw new TypeError("An exact candidate plan and action-time cache snapshot are required.");
  }
  for (const asset of downloadable) {
    if (!asset || typeof asset.hash !== "string" || !asset.hash) throw new TypeError("Missing candidate content hash.");
  }
  return Object.freeze({
    minimum: downloadable.filter((asset) => !storedHashesAtStart.has(asset.hash)).length,
    maximum: downloadable.length,
  });
}

export function matchesCandidateDownloadProgress(total, window) {
  return Number.isInteger(total) && total >= window.minimum && total <= window.maximum;
}
