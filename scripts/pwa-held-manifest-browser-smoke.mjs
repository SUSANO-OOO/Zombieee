// A metadata request that never settles must not hold an installed standalone
// game hostage. Browser APIs are scoped to this isolated fixture; no live save
// or published service worker is modified.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const origin = process.env.V100_CAMPAIGN_QA_BASE_URL;
assert.ok(origin && ['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const url = new URL('v100', origin).toString();
const scope = new URL('./', url).toString();
const out = process.env.PWA_HELD_MANIFEST_EVIDENCE_DIR ?? 'outputs/completion/v100-pwa-held-manifest';
await mkdir(out, { recursive: true });
const hash = `sha256-${'a'.repeat(64)}`;
const browser = await chromium.launch({ headless: true, ...(process.env.PWA_HELD_MANIFEST_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PWA_HELD_MANIFEST_CHROMIUM_EXECUTABLE } : {}) });
const cases = [];

async function runCase(name, { active, releaseAfterMs = 0 }) {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  const record = { name, active, releaseAfterMs, held: 0, errors: [] };
  cases.push(record);
  page.on('pageerror', error => record.errors.push(`page: ${error}`));
  page.on('console', message => { if (message.type() === 'error') record.errors.push(`console: ${message.text()}`); });
  page.on('response', response => { if (response.status() >= 400) record.errors.push(`http: ${response.status()} ${response.url()}`); });
  try {
    await page.goto(url);
    const manifest = { version: '1.0.0', releaseSha: '0'.repeat(40), assets: [{ path: '/held-manifest-fixture.bin', hash, bytes: 1, category: 'core' }] };
    if (active) await page.evaluate(async ({ scope, hash }) => {
      const cache = await caches.open('zombieee-assets-v1');
      await cache.put(new URL(`__pwa-asset__/${hash}`, scope), new Response('x'));
    }, { scope, hash });
    await context.addInitScript(({ scope, manifest, active }) => {
      Object.defineProperty(navigator, 'standalone', { configurable: true, value: true });
      Object.defineProperty(navigator.serviceWorker, 'register', { configurable: true, value: async () => ({
        scope,
        active: { postMessage(_message, ports) { ports[0]?.postMessage({ active: active ? manifest : null, previous: null }); } },
      }) });
    }, { scope, manifest, active });
    await page.route('**/asset-manifest.json', route => {
      record.held += 1;
      if (releaseAfterMs > 0) return new Promise(resolve => setTimeout(resolve, releaseAfterMs)).then(() => route.continue());
      return new Promise(() => {});
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.documentElement.dataset.pwaManifestState === 'loading');
    record.start = await page.evaluate(() => ({ state: document.documentElement.dataset.pwaManifestState, game: Boolean(document.querySelector('.v100-shell')), gate: Boolean(document.querySelector('.pwa-gate')) }));
    await page.waitForTimeout(12_000);
    record.after12s = await page.evaluate(() => ({ state: document.documentElement.dataset.pwaManifestState, game: Boolean(document.querySelector('.v100-shell')), gate: Boolean(document.querySelector('.pwa-gate')) }));
    assert.equal(record.held, 1);
    assert.equal(record.start.game, false);
    assert.deepEqual(record.after12s, active
      ? { state: 'unreachable', game: true, gate: false }
      : { state: 'unreachable', game: false, gate: true });
    if (releaseAfterMs > 0) {
      await page.waitForFunction(() => document.documentElement.dataset.pwaManifestState === 'ready', null, { timeout: 20_000 });
      record.afterResponse = await page.evaluate(() => ({ state: document.documentElement.dataset.pwaManifestState, game: Boolean(document.querySelector('.v100-shell')), gate: Boolean(document.querySelector('.pwa-gate')) }));
      assert.deepEqual(record.afterResponse, { state: 'ready', game: true, gate: false });
    }
    await page.screenshot({ path: `${out}/${name}.png` });
    assert.deepEqual(record.errors, []);
    record.status = 'passed';
  } catch (error) {
    record.status = 'failed'; record.error = String(error?.stack ?? error);
    await page.screenshot({ path: `${out}/${name}-failed.png` }).catch(() => {});
  } finally {
    await context.close();
    await writeFile(`${out}/report.json`, JSON.stringify({ origin, cases }, null, 2));
  }
}

try {
  await runCase('committed-pack-held-metadata', { active: true });
  await runCase('first-install-held-metadata', { active: false });
  await runCase('committed-pack-late-metadata', { active: true, releaseAfterMs: 13_000 });
} finally { await browser.close(); }
console.log(JSON.stringify(cases.map(({ name, status, held, after12s, afterResponse, error }) => ({ name, status, held, after12s, afterResponse, error: error?.slice(0, 300) }))));
if (cases.some(item => item.status !== 'passed')) process.exitCode = 1;
