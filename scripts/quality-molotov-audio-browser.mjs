import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { productionBuildIdentity } from './browser-qa-build-identity.mjs';
import { seedV100BrowserSaveOnce, enterV100FromTitle } from './v100-title-qa-entry.mjs';
import { dismissInstallOffer } from './pwa-gate-qa.mjs';
import { createDefaultV100Save, normalizeV100Save, serializeV100Save } from '../app/v100Save.js';
import { V100_STAGE_IDS } from '../app/v100Registry.js';

const base = new URL(process.env.QUALITY_MOLOTOV_URL);
assert.ok(['127.0.0.1', 'localhost'].includes(base.hostname));
const out = path.resolve(process.env.QUALITY_MOLOTOV_OUT);
await mkdir(out, { recursive: false });
const report = { after: process.env.QUALITY_MOLOTOV_AFTER === '1',
  build: await productionBuildIdentity(path.resolve(process.env.QUALITY_MOLOTOV_BUILD_ROOT)),
  scope: 'Prepared S23 save and existing stationary manual-ability fixture; real ability button, unchanged simulation and production mixer. Canvas/audio tap recording, not normal progression, subjective hearing or physical-device acceptance.', errors: [] };
const script = await readFile(new URL(import.meta.url));
await writeFile(path.join(out, 'harness.mjs'), script);
report.scriptSha256 = createHash('sha256').update(script).digest('hex');
const save = normalizeV100Save({ ...createDefaultV100Save({ settings: { bgmEnabled: false, sfxEnabled: true } }),
  campaignStarted: true, ownedUnitIds: ['unit-zakimiya'], registeredUnitIds: ['unit-zakimiya'], formationSlots: ['unit-zakimiya'],
  availableStageIds: V100_STAGE_IDS, completedStageIds: V100_STAGE_IDS.slice(0, 22),
  flowState: { phase: 'formation', stageId: V100_STAGE_IDS[22], stageNumber: 23, eventId: null, destination: 'formation', nodeIndex: 0, firstClear: false, finalized: true } });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 844, height: 340 }, hasTouch: true, serviceWorkers: 'block' });
try {
  await context.addInitScript(seedV100BrowserSaveOnce, serializeV100Save(save));
  const page = await context.newPage(); page.setDefaultTimeout(25000);
  page.on('pageerror', e => report.errors.push(String(e)));
  await page.goto(base.href, { waitUntil: 'domcontentloaded' });
  await dismissInstallOffer(page, { timeout: 25000, readySelector: '.v100-start-screen', waitForFictionDismissal: true });
  await enterV100FromTitle(page);
  await page.getByRole('button', { name: '戦闘へ', exact: true }).click();
  await page.waitForFunction(() => window.__ASHFALL_BATTLE_QA__?.getSnapshot().running
    && window.__ASHFALL_AUDIO_QA__?.getDiagnostics().contextState === 'running');
  await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.ensureUnitRenderProofAsset('zakimiya'));
  report.fixture = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.prepareManualAbilityProof('zakimiya'));
  const ownerId = report.fixture.ownerIds[0];
  const button = page.locator(`.manual-ability-ready[data-fighter-id="${ownerId}"]`);
  await button.waitFor({ state: 'visible' });
  await page.evaluate(async id => {
    const qa = window.__ASHFALL_AUDIO_QA__, bridge = window.__ASHFALL_BATTLE_QA__;
    qa.resetCueRequests();
    const canvas = document.querySelector('canvas'), tap = qa.createLocalRecordingTap();
    const video = canvas.captureStream(30), stream = new MediaStream([...video.getVideoTracks(), ...tap.stream.getAudioTracks()]);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus' });
    const state = { tap, video, recorder, chunks: [], samples: [], cues: new Map(), active: true, id, error: null };
    recorder.ondataavailable = e => { if (e.data.size) state.chunks.push(e.data); };
    recorder.onerror = e => { state.error = String(e.error); };
    state.done = new Promise(resolve => { recorder.onstop = resolve; });
    const started = new Promise(resolve => { recorder.onstart = resolve; });
    function sample() {
      if (!state.active) return;
      const s = bridge.getSnapshot(), owner = s.fighters.find(f => f.id === id);
      state.samples.push({ at: performance.now(), time: s.time, ability: owner?.manualAbility,
        effects: s.v100AdvancedAbilityEffects, receipts: s.manualAbilityReceipts,
        enemies: s.fighters.filter(f => f.side === 'zombie').map(f => ({ id: f.id, hp: f.hp })) });
      for (const cue of qa.getCueRequests()) {
        const key = JSON.stringify(cue);
        if (!state.cues.has(key)) state.cues.set(key, { ...cue, observedAtSimulationTime: s.time });
      }
      requestAnimationFrame(sample);
    }
    window.__MOLOTOV_RECORDING__ = state;
    recorder.start(250); await started; sample();
  }, ownerId);
  await button.click();
  await page.waitForFunction(() => window.__ASHFALL_AUDIO_QA__.getCueRequests().some(c => c.cueId === 'ability-zakimiya-molotov-burn'));
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(out, 'after-impact.png') });
  const data = await page.evaluate(async () => {
    const r = window.__MOLOTOV_RECORDING__; r.active = false; r.recorder.stop();
    await Promise.race([r.done, new Promise((_, reject) => setTimeout(() => reject(Error('recording stop timeout')), 5000))]);
    const bytes = Array.from(new Uint8Array(await new Blob(r.chunks, { type: r.recorder.mimeType }).arrayBuffer()));
    r.tap.release(); r.video.getTracks().forEach(t => t.stop());
    return { bytes, samples: r.samples, cues: [...r.cues.values()], error: r.error, diagnostics: window.__ASHFALL_AUDIO_QA__.getDiagnostics() };
  });
  const { bytes, ...rest } = data; Object.assign(report, rest);
  const buffer = Buffer.from(bytes); await writeFile(path.join(out, 'battle.webm'), buffer);
  report.recording = { bytes: buffer.length, sha256: createHash('sha256').update(buffer).digest('hex') };
  assert.ok((await readFile(path.join(out, 'battle.webm'))).equals(buffer));
  const abilityCues = report.cues.filter(c => c.ownerId === ownerId && c.cueId.startsWith('ability-zakimiya-molotov-'));
  const cue = suffix => abilityCues.filter(c => c.cueId === 'ability-zakimiya-molotov-' + suffix);
  for (const key of ['throw', 'impact', 'burn']) assert.equal(cue(key).length, 1, key + ' is emitted once');
  report.throwToImpactMs = cue('impact')[0].at - cue('throw')[0].at;
  report.throwToImpactSimulationSeconds = cue('impact')[0].observedAtSimulationTime - cue('throw')[0].observedAtSimulationTime;
  const bottleFrames = report.samples.filter(s => s.effects.some(e => e.type === 'zakimiya-bottle'));
  assert.ok(bottleFrames.length > 0, 'actual bottle flight exists');
  if (report.after) {
    assert.ok(report.throwToImpactSimulationSeconds >= .13 && report.throwToImpactSimulationSeconds <= .2,
      'throw must precede contact by the authored flight time, within one simulation step');
    assert.ok(report.throwToImpactMs > 0);
  } else assert.ok(report.throwToImpactSimulationSeconds <= .04, 'baseline emits throw at contact');
  assert.deepEqual(report.errors, []); assert.equal(report.error, null);
  report.status = 'passed';
} catch (e) { report.status = 'failed'; report.failure = String(e); throw e; }
finally { await context.close(); await browser.close(); await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); }
console.log(JSON.stringify({ status: report.status, gapMs: report.throwToImpactMs, gapSimulation: report.throwToImpactSimulationSeconds, recording: report.recording }));
