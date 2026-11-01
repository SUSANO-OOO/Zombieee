import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { webkit } from 'playwright';
import { productionBuildIdentity } from './browser-qa-build-identity.mjs';
import { enterV100FromTitle, seedV100BrowserSaveOnce } from './v100-title-qa-entry.mjs';
import { dismissInstallOffer } from './pwa-gate-qa.mjs';
import { createDefaultV100Save, normalizeV100Save, serializeV100Save } from '../app/v100Save.js';
import { V100_STAGE_IDS } from '../app/v100Registry.js';
const out = path.resolve(process.env.QUALITY_SAW_OUT), root = path.resolve(process.env.QUALITY_SAW_BUILD_ROOT);
const url = new URL(process.env.QUALITY_SAW_URL); assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname));
await mkdir(out, { recursive: false });
const build = await productionBuildIdentity(root), snapshot = JSON.parse(await readFile(path.join(root, 'snapshot.json')));
assert.equal(build.combinedSha256, snapshot.combinedSha256);
const report = { build, samples: [], requests: [], errors: [], after: process.env.QUALITY_SAW_AFTER === '1',
 scriptSha256: createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex'),
 scope: 'Controlled fixed-cue audio comparison through the actual production mixer without a recording tap, while gameplay is paused. Same cue schedule and authored gains, before/after sound sources; not natural battle, subjective listening or physical acceptance.' };
const seed = normalizeV100Save({ ...createDefaultV100Save({ settings: { bgmEnabled: false, sfxEnabled: true } }), campaignStarted: true,
 flowState: { phase: 'formation', stageId: V100_STAGE_IDS[0], stageNumber: 1, eventId: null, destination: 'formation', nodeIndex: 0, firstClear: false, finalized: true } });
const browser = await webkit.launch({ headless: true }), context = await browser.newContext({ viewport: { width: 844, height: 340 }, serviceWorkers: 'block' });
await context.addInitScript(seedV100BrowserSaveOnce, serializeV100Save(seed));
const page = await context.newPage(); page.on('pageerror', e => report.errors.push(String(e)));
try {
 await page.goto(url.href, { waitUntil: 'domcontentloaded' });
 await dismissInstallOffer(page, { timeout: 30000, readySelector: '.v100-start-screen', waitForFictionDismissal: true });
 await enterV100FromTitle(page); await page.getByRole('button', { name: '戦闘へ', exact: true }).click();
 await page.waitForFunction(() => window.__ASHFALL_AUDIO_QA__?.getDiagnostics().contextState === 'running');
 await page.getByRole('button', { name: '一時停止', exact: true }).click();
 const data = await page.evaluate(async () => {
  const qa = window.__ASHFALL_AUDIO_QA__; qa.stopAll();
  const ordinary = ['weapon-chainsaw-start','weapon-chainsaw-idle-loop','weapon-chainsaw-attack','weapon-chainsaw-flesh-hit','weapon-chainsaw-hard-hit','weapon-chainsaw-stop','ability-crazy-king-overdrive-activate','ability-crazy-king-overdrive-active'];
  const foreground = [{at:11,cue:'voice-crazy-king-deploy'},{at:12,cue:'v104-eye-warning'},{at:12.3,cue:'weapon-suppressed-pistol'}];
  for (const cue of [...ordinary, ...foreground.map(e => e.cue)]) {
   const h = await qa.play(cue, { volume: 0, cooldownMs: 0 }); if (!h) throw Error('Preload failed: ' + cue); h.stop();
  }
  const start = performance.now(), requests = [], samples = [], pending = [];
  const request = (cue, options = {}) => { const at = (performance.now() - start) / 1000; pending.push(qa.play(cue, { cooldownMs: 0, ...options }).then(h => requests.push({ cue, at, started: Boolean(h) }))); };
  let loop=null;
  for (const cue of ordinary) {
   const at=(performance.now()-start)/1000;
   const h=await qa.play(cue,{cooldownMs:0});requests.push({cue,at,started:Boolean(h)});
   if(cue==='weapon-chainsaw-idle-loop')loop=h;
   await new Promise(resolve=>setTimeout(resolve,cue==='weapon-chainsaw-idle-loop'?2500:900));
   if(cue==='weapon-chainsaw-stop'){loop?.stop();loop=null;}
  }
  for(const e of foreground){const h=await qa.play(e.cue,{cooldownMs:0});requests.push({cue:e.cue,at:(performance.now()-start)/1000,started:Boolean(h)});await new Promise(resolve=>setTimeout(resolve,300));}
  for(let i=0;i<3;i++){request('weapon-chainsaw-attack');request('weapon-chainsaw-hard-hit');await new Promise(resolve=>setTimeout(resolve,450));}
  await Promise.all(pending);await new Promise(resolve=>setTimeout(resolve,1800));
  qa.stopAll();await new Promise(resolve=>setTimeout(resolve,500));
  samples.push(qa.getDiagnostics());
  return {requests,samples,final:qa.getDiagnostics()};
 });
 Object.assign(report,data);assert.equal(report.requests.length,17);assert.ok(report.requests.every(r=>r.started));assert.equal(report.final.activeVoices,0);
 assert.deepEqual(report.errors, []); report.status = 'decoded-and-played-not-listening-accepted';
} catch (e) { report.error = String(e); report.status = 'failed'; throw e; }
finally { await context.close(); await browser.close(); await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); }
console.log(JSON.stringify({ status: report.status, build: build.combinedSha256, requests: report.requests.length, activeAfterStop:report.final.activeVoices }));
