// HTTP paths retain their recorded multiplicity. The updater consumes manifest
// transport paths; AudioMixer can separately read known bundled logical sources.
export function partitionPwaUpdateTransportPaths(paths, downloadTransportPaths, bundledAudioSourcePaths) {
  const result = { repair: [], runtimeAudio: [], unexpected: [] };
  for (const pathname of paths) {
    if (downloadTransportPaths.has(pathname)) result.repair.push(pathname);
    else if (bundledAudioSourcePaths.has(pathname)) result.runtimeAudio.push(pathname);
    else result.unexpected.push(pathname);
  }
  return result;
}

// A content-addressed update can satisfy several manifest paths with one
// verified download. Account for that sharing without forgiving a missing
// hash or a second request for already-downloaded content through an alias.
export function inspectPwaContentTransportCoverage(paths, expected, { repeatablePaths = new Set() } = {}) {
  const keysByPath = new Map(), expectedKeys = new Set();
  for (const { pathname, contentKey } of expected) {
    if (!pathname || !contentKey || (keysByPath.has(pathname) && keysByPath.get(pathname) !== contentKey)) {
      throw new TypeError('Ambiguous or missing PWA transport content identity');
    }
    keysByPath.set(pathname, contentKey);
    expectedKeys.add(contentKey);
  }
  const observed = new Set(), duplicate = [], unexpected = [];
  for (const pathname of paths) {
    const key = keysByPath.get(pathname);
    if (!key) unexpected.push(pathname);
    else if (observed.has(key) && !repeatablePaths.has(pathname)) duplicate.push({ pathname, contentKey: key });
    else observed.add(key);
  }
  const missing = [...expectedKeys].filter(key => !observed.has(key));
  return { ok: !missing.length && !duplicate.length && !unexpected.length,
    expected: expectedKeys.size, observed: observed.size, missing, duplicate, unexpected };
}

export function inspectPwaRecoveryBundles(bundleAssets, cachedHashes, incidentRequests, recoveryRequests, stalledPath) {
  const hashesByPath = new Map();
  for (const { pathname, hash } of bundleAssets) {
    if (!hashesByPath.has(pathname)) hashesByPath.set(pathname, new Set());
    hashesByPath.get(pathname).add(hash);
  }

  const repeatablePaths = new Set([stalledPath]);
  const pendingPaths = new Set();
  const fullyCachedPaths = new Set();
  const invalid = [];
  const details = [];
  for (const [pathname, hashes] of hashesByPath) {
    const pending = [...hashes].filter(hash => !cachedHashes.has(hash)).length;
    const incident = incidentRequests.filter(request => request === pathname).length;
    const recovery = recoveryRequests.filter(request => request === pathname).length;
    const row = { pathname, total: hashes.size, pending, incident, recovery };
    details.push(row);

    if (pending > 0) pendingPaths.add(pathname);
    else fullyCachedPaths.add(pathname);
    if (recovery === 0) continue;
    const expectedAttempts = pathname === stalledPath ? 2 : 1;
    if (pending === 0 || recovery !== expectedAttempts || (pathname !== stalledPath && incident > 1)) {
      invalid.push(row);
    } else if (incident === 1) {
      repeatablePaths.add(pathname);
    }
  }
  return { repeatablePaths, pendingPaths, fullyCachedPaths, invalid, details };
}
