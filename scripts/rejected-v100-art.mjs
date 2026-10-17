import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

// Preserve the rejection evidence without retaining reusable rejected images.
export const REJECTED_V100_ART = JSON.parse(await readFile(new URL('../assets/source/v100/takuya/takuya-vest-v2.provenance.json', import.meta.url), 'utf8'));
assert.equal(REJECTED_V100_ART.reuseAllowed, false);
const rejectedPaths = new Set([
  ...Object.values(REJECTED_V100_ART.sources),
  ...Object.values(REJECTED_V100_ART.outputSha256).map(row => row.path),
]);
const rejectedHashes = new Set([
  ...Object.values(REJECTED_V100_ART.sourceSha256),
  ...Object.values(REJECTED_V100_ART.outputSha256).map(row => row.sha256),
]);

export function assertV100ArtAllowed(assetPath, hash) {
  const normalized = assetPath.replaceAll('\\', '/').replace(/^\//u, '');
  assert.ok(!rejectedPaths.has(normalized) && !rejectedPaths.has(`public/${normalized}`), `Rejected producer art: ${assetPath}`);
  if (hash) assert.ok(!rejectedHashes.has(hash.replace(/^sha256-/u, '')), `Rejected producer art bytes: ${assetPath}`);
}

export async function readV100ArtReference(assetPath) {
  assertV100ArtAllowed(assetPath);
  const bytes = await readFile(assetPath);
  assertV100ArtAllowed(assetPath, createHash('sha256').update(bytes).digest('hex'));
  return bytes;
}
