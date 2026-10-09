export async function settlePublicMapNetwork(page, network) {
  let quietSince = Date.now();
  const deadline = quietSince + 30000;
  while (Date.now() < deadline) {
    const now = Date.now();
    quietSince = Math.max(quietSince, network.lastActivity);
    if (network.pending.size === 0 && now - quietSince >= 500) {
      return { pending: 0, quietMilliseconds: now - quietSince, lastActivity: network.lastActivity };
    }
    await page.waitForTimeout(50);
  }
  throw new Error(`Map network did not settle before intentional reload: ${[...network.pending].map(request => request.url()).join(", ")}`);
}
