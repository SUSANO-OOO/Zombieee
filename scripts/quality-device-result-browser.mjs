import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium, webkit } from 'playwright';
import { normalizeV100Save, serializeV100Save } from '../app/v100Save.js';
import { v100BattleReportFor, v100DeviceResultText } from '../app/v100BattleReport.js';
import { seedV100BrowserSaveOnce, enterV100FromTitle } from './v100-title-qa-entry.mjs';
import { dismissInstallOffer } from './pwa-gate-qa.mjs';
import { productionBuildIdentity } from './browser-qa-build-identity.mjs';
import { createNormalBrowserDeadline, normalCleanupWithin } from './v177-normal-browser-deadline.mjs';

const out = path.resolve(process.env.QUALITY_DEVICE_RESULT_OUT);
const url = new URL(process.env.QUALITY_DEVICE_RESULT_URL);
assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
const engine = process.env.QUALITY_DEVICE_RESULT_ENGINE ?? 'chromium';
assert.ok(['chromium', 'webkit'].includes(engine));
const before = process.env.QUALITY_DEVICE_RESULT_BEFORE === '1';
const sourcePath = 'output/quality-20261028/mission-current-s09-webkit-r1/report.json';
const source = await fs.readFile(sourcePath), observed = JSON.parse(source).cases[0];
assert.equal(observed.number, 9); assert.equal(observed.outcome, 'lost');
assert.equal(observed.snapshots.at(-1).mission.powerActivated, 3);
await fs.mkdir(out, { recursive: false });
await fs.writeFile(path.join(out, 'harness.mjs'), await fs.readFile(new URL(import.meta.url)));
const specs = before ? [{ name: 'observed-phone', width: 844, height: 340 }] : [
  { name: 'observed-phone', width: 844, height: 340, count: 3 },
  { name: 'observed-desktop', width: 1280, height: 720, count: 3 },
  { name: 'partial', width: 844, height: 340, count: 2 },
  { name: 'shutdown', width: 844, height: 340, count: 3, stageId: 'stage-national-dispersal-network', number: 28 },
  { name: 'legacy', width: 844, height: 340 },
];
const report = { engine, before, build: await productionBuildIdentity(process.env.QUALITY_DEVICE_RESULT_ROOT),
  source: { path: sourcePath, sha256: createHash('sha256').update(source).digest('hex') },
  scope: 'Prepared result display and reload only, no additional battle. The original S09 defeat save lacks device counts; observed rows reconstruct the three activated devices from its last pre-result snapshot. Partial/shutdown rows are synthetic display boundaries. Legacy row preserves the missing measurement. No claim of a newly saved live battle or physical/human acceptance.', cases: [], errors: [] };
const browser = await ({ chromium, webkit }[engine]).launch({ headless: true });
try {
  for (const spec of specs) {
    let seed = structuredClone(observed.finalSave);
    const result = seed.pendingResult ?? seed.lastResult;
    if (spec.stageId) {
      result.stageId = spec.stageId; result.stageNumber = spec.number;
      result.battleRunId = result.resultId = 'prepared-device-' + spec.name;
      seed.flowState = { ...seed.flowState, stageId: spec.stageId, stageNumber: spec.number };
    }
    if (spec.count !== undefined) {
      const measured = v100BattleReportFor({ stageId: result.stageId, wave: result.battleReport.wave, kills: result.battleReport.kills,
        unitStats: { damageByUnit: {}, damageTakenByUnit: {}, healingByUnit: {} },
        missionRuntime: { ...observed.snapshots.at(-1).mission, powerActivated: spec.count } });
      result.battleReport.deviceProgress = measured.deviceProgress;
    }
    seed = normalizeV100Save(seed);
    const context = await browser.newContext({ viewport: { width: spec.width, height: spec.height }, hasTouch: true, serviceWorkers: 'block' });
    const rawPage = await context.newPage(), page = createNormalBrowserDeadline().wrap(rawPage);
    page.setDefaultTimeout(15000); page.on('pageerror', error => report.errors.push(String(error)));
    const row = { ...spec, status: 'running' }; report.cases.push(row);
    try {
      const enter = async () => {
        await dismissInstallOffer(page, { timeout: 25000, readySelector: '.v100-start-screen', waitForFictionDismissal: true });
        await enterV100FromTitle(page); await page.locator('.v100-result-panel').waitFor();
        await page.waitForFunction(() => document.querySelector('#v100-campaign')?.getAttribute('aria-busy') === 'false');
      };
      await context.addInitScript(seedV100BrowserSaveOnce, serializeV100Save(seed));
      await page.goto(url.href); await enter();
      const saved = () => page.evaluate(() => localStorage.getItem('nishijin-campaign-v100'));
      const initial = await saved(), progress = page.locator('.v100-defeat-progress');
      row.text = await progress.innerText();
      const expected = before ? null : v100DeviceResultText(result);
      if (expected) { assert.ok(row.text.includes(expected.progress)); assert.ok(row.text.includes(expected.detail)); }
      else { assert.ok(row.text.includes('第5波まで到達')); assert.doesNotMatch(row.text, /基を起動|基を停止|基を作動/); }
      for (const locator of [progress, ...await page.locator('.v100-result-actions button').all()]) {
        const box = await locator.boundingBox();
        assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= spec.width + 1 && box.y + box.height <= spec.height + 1);
        assert.ok(await locator.evaluate(el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); }));
      }
      await page.screenshot({ path: path.join(out, spec.name + '.png') }); assert.equal(await saved(), initial);
      await page.reload(); await enter(); assert.equal(await saved(), initial); assert.equal(await progress.innerText(), row.text);
      row.saveBytesUnchanged = true; row.status = 'passed';
    } catch (error) { row.status = 'failed'; row.error = String(error); throw error; }
    finally { await normalCleanupWithin(() => context.close(), 'context.close'); }
  }
  assert.deepEqual(report.errors, []); report.status = 'passed';
} catch (error) { report.status = 'failed'; report.error = String(error); process.exitCode = 1; }
finally { await normalCleanupWithin(() => browser.close(), 'browser.close'); await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); }
console.log(JSON.stringify({ status: report.status, engine, cases: report.cases.length, error: report.error }));
