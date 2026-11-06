import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { productionBuildIdentity } from './browser-qa-build-identity.mjs';
import { seedV100BrowserSaveOnce, enterV100FromTitle } from './v100-title-qa-entry.mjs';
import { dismissInstallOffer } from './pwa-gate-qa.mjs';
import { normalizeV100Save, serializeV100Save } from '../app/v100Save.js';
import { normalTacticalInput } from './v100-normal-tactical-input.mjs';

const base = new URL(process.env.QUALITY_BOSS_MIX_URL);
assert.ok(['127.0.0.1', 'localhost'].includes(base.hostname));
const out = path.resolve(process.env.QUALITY_BOSS_MIX_OUT);
await mkdir(out, { recursive: false });
const sourceFile = 'output/quality-20261028/f70-normal-report.json', sourceBytes = await readFile(sourceFile);
const source = JSON.parse(sourceBytes), original = source.stages.find(s => s.number === 3).openingSave;
const seed = normalizeV100Save({ ...original, flowState: { ...original.flowState, phase: 'formation', destination: 'formation' } });
const protectedKeys = ['caps','ownedUnitIds','registeredUnitIds','unitLevels','equipment','vehicle','formationSlots','completedStageIds','bestStars'];
for (const key of protectedKeys) assert.deepEqual(seed[key], original[key], key);
const report = { number: 3, build: await productionBuildIdentity(path.resolve(process.env.QUALITY_BOSS_MIX_BUILD_ROOT)),
  source: { file: sourceFile, sha256: createHash('sha256').update(sourceBytes).digest('hex'), head: source.provenance.head },
  scope: 'One bounded replay of the archived S03 opening save. Only the menu flow is set to formation; resources, levels and formation are preserved. Ordinary trusted UI, native simulation and production mixer; no actor/time/outcome injection. 15fps recording is for sound context, not formal motion/performance or physical/listening acceptance.',
  inputs: [], samples: [], audioSamples: [], cues: [], errors: [], windowMs: 150000 };
await writeFile(path.join(out, 'seed.json'), JSON.stringify(seed, null, 2));
await writeFile(path.join(out, 'harness.mjs'), await readFile(new URL(import.meta.url)));
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 844, height: 340 }, hasTouch: true, serviceWorkers: 'block' });
try {
  await context.addInitScript(seedV100BrowserSaveOnce, serializeV100Save(seed));
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', e => report.errors.push(String(e)));
  await page.goto(base.href, { waitUntil: 'domcontentloaded' });
  await dismissInstallOffer(page, { timeout: 25000, readySelector: '.v100-start-screen', waitForFictionDismissal: true });
  await enterV100FromTitle(page);
  await page.getByRole('button', { name: '戦闘へ', exact: true }).click();
  await page.waitForFunction(() => window.__ASHFALL_BATTLE_QA__?.getSnapshot().running
    && window.__ASHFALL_AUDIO_QA__?.getDiagnostics().contextState === 'running');
  await page.evaluate(async () => {
    const qa = window.__ASHFALL_AUDIO_QA__, snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot;
    const tap = qa.createLocalRecordingTap(), video = document.querySelector('canvas').captureStream(15);
    const recorder = new MediaRecorder(new MediaStream([...video.getVideoTracks(), ...tap.stream.getAudioTracks()]), { mimeType: 'video/webm;codecs=vp8,opus' });
    const state = { qa, snapshot, tap, video, recorder, chunks: [], samples: [], cues: new Map(), error: null, startedAt: performance.now() };
    recorder.ondataavailable = e => { if (e.data.size) state.chunks.push(e.data); };
    recorder.onerror = e => { state.error = String(e.error); };
    state.done = new Promise(resolve => { recorder.onstop = resolve; });
    const started = new Promise(resolve => { recorder.onstart = resolve; });
    function sample() {
      const s = snapshot(), audio = qa.getDiagnostics();
      state.samples.push({ at: performance.now(), time: s.time, running: s.running, over: s.over, baseHp: s.baseHp,
        boss: s.fighters.filter(f => f.kind === 'takuya').map(f => ({ id: f.id, hp: f.hp, maxHp: f.maxHp })),
        humans: s.fighters.filter(f => f.side === 'human' && f.hp > 0).map(f => ({ id: f.id, kind: f.kind })),
        enemyCount: s.fighters.filter(f => f.side === 'zombie' && f.hp > 0).length,
        mix: audio.combatMix, gains: audio.gainStages, context: audio.contextState });
      for (const cue of qa.getCueRequests()) {
        const key = JSON.stringify(cue);
        if (!state.cues.has(key)) state.cues.set(key, { ...cue, observedTime: s.time });
      }
    }
    state.sample = sample; window.__BOSS_MIX_RECORDING__ = state;
    recorder.start(1000); await started; sample(); state.timer = setInterval(sample, 100);
  });
  const started = Date.now(); let bossCaptured = false;
  while (Date.now() - started < report.windowMs) {
    const state = await page.evaluate(() => {
      const phase = document.querySelector('.v100-shell')?.dataset.v100Phase;
      const s = window.__BOSS_MIX_RECORDING__.snapshot();
      return { phase, boss: s.fighters.some(f => f.kind === 'takuya' && f.hp > 0) };
    });
    if (state.phase === 'result') break;
    assert.equal(state.phase, 'battle');
    if (state.boss && !bossCaptured) {
      bossCaptured = true; await page.screenshot({ path: path.join(out, 'boss.png') });
    }
    await normalTacticalInput(page, report);
    assert.deepEqual(report.errors, []);
    await page.waitForTimeout(200);
  }
  report.wallElapsedMs = Date.now() - started;
  report.finalSave = await page.evaluate(() => JSON.parse(localStorage.getItem('nishijin-campaign-v100')));
  await page.screenshot({ path: path.join(out, 'end.png') });
  const data = await page.evaluate(async () => {
    const r = window.__BOSS_MIX_RECORDING__; clearInterval(r.timer); r.sample(); r.recorder.stop();
    await Promise.race([r.done, new Promise((_, reject) => setTimeout(() => reject(Error('recording stop timeout')), 5000))]);
    const bytes = Array.from(new Uint8Array(await new Blob(r.chunks, { type: r.recorder.mimeType }).arrayBuffer()));
    return { bytes, audioSamples: r.samples, cues: [...r.cues.values()], error: r.error, diagnostics: r.qa.getDiagnostics() };
  });
  const { bytes, ...rest } = data; Object.assign(report, rest);
  const buffer = Buffer.from(bytes); await writeFile(path.join(out, 'battle.webm'), buffer);
  assert.ok((await readFile(path.join(out, 'battle.webm'))).equals(buffer));
  report.recording = { bytes: buffer.length, sha256: createHash('sha256').update(buffer).digest('hex') };
  // Preserve original bytes before cleanup; a teardown failure must not erase a completed capture.
  await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  report.cleanupError = await page.evaluate(() => {
    const r = window.__BOSS_MIX_RECORDING__;
    try { r.tap.release(); return null; }
    catch (error) { return String(error); }
    finally { r.video.getTracks().forEach(t => t.stop()); }
  });
  assert.equal(report.cleanupError, null, 'recording cleanup must succeed; original bytes are retained on failure');
  report.bossSamples = report.audioSamples.filter(s => s.boss.some(b => b.hp > 0));
  report.mixedBossSamples = report.bossSamples.filter(s => s.humans.length >= 2 && s.enemyCount >= 2);
  report.foregroundBossSamples = report.mixedBossSamples.filter(s => s.mix?.foregroundVoices > 0 && s.mix.ordinaryTargetGain === .45).length;
  report.normalBossSamples = report.mixedBossSamples.filter(s => s.mix?.ordinaryTargetGain === 1).length;
  report.cueCounts = Object.fromEntries([...new Set(report.cues.map(c => c.cueId))].map(id => [id, report.cues.filter(c => c.cueId === id).length]));
  report.bossReached = bossCaptured;
  assert.equal(report.error, null); assert.deepEqual(report.errors, []); assert.ok(buffer.length > 10000);
  report.status = report.mixedBossSamples.length && report.foregroundBossSamples && report.normalBossSamples
    ? 'observed-boss-mix-not-listening-accepted' : 'observed-incomplete-boss-mix';
} catch (e) { report.status = 'failed'; report.failure = String(e); throw e; }
finally {
  try { await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); }
  finally { try { await context.close(); } finally { await browser.close(); } }
}
console.log(JSON.stringify({ status: report.status, seconds: report.wallElapsedMs / 1000, bossReached: report.bossReached,
  mixed: report.mixedBossSamples?.length, foreground: report.foregroundBossSamples, normal: report.normalBossSamples, recording: report.recording }));
