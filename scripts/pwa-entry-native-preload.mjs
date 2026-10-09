// Check native preloads against the cache before navigation. A snapshot taken
// after loading the page can already contain the object that preload fetched.
export function verifyEntryNativePreload({ browserRequests, serverRequests, cacheByPhase, hash }) {
  const phases = new Set([...Object.keys(cacheByPhase), ...browserRequests.map(r => r.diagnosticPhase), ...serverRequests.map(r => r.diagnosticPhase)]);
  const rows = [...phases].map(phase => {
    const browser = browserRequests.filter(r => r.diagnosticPhase === phase);
    const server = serverRequests.filter(r => r.diagnosticPhase === phase);
    const before = cacheByPhase[phase];
    const cachedBeforeNavigation = before?.has(hash) ?? null;
    return { phase, cachedBeforeNavigation, browserCount: browser.length, serverCount: server.length,
      valid: Boolean(before) && browser.length <= 1
        && browser.every(r => r.nativeTitlePreload === true
          && ['other', 'media'].includes(r.resourceType) && r.isNavigationRequest === false)
        && server.every(r => r.method === 'GET' && [null, 'no-cors'].includes(r.secFetchMode))
        && server.length === (cachedBeforeNavigation ? 0 : browser.length) };
  });
  return { valid: rows.every(row => row.valid), rows };
}
