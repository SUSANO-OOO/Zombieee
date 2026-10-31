import assert from 'node:assert/strict';
import { mkdir, open, readFile, rename, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { chromium } from 'playwright';
import { createDefaultV100Save, normalizeV100Save, serializeV100Save } from '../app/v100Save.js';
import { V100_STAGE_IDS } from '../app/v100Registry.js';
import { QUALITY_CHARACTER_ATLASES } from '../app/qualityCharacterAtlases.js';
import { enterV100FromTitle, seedV100BrowserSaveOnce } from './v100-title-qa-entry.mjs';
import { dismissInstallOffer } from './pwa-gate-qa.mjs';
import { nativeBattleTap } from './v100-normal-tactical-input.mjs';
import { productionBuildIdentity } from './browser-qa-build-identity.mjs';

const out = path.resolve(process.env.QUALITY_BABA_OUT);
await mkdir(path.dirname(out), { recursive: true });
await mkdir(out);
const runtime = process.env.QUALITY_BABA_RUNTIME;
assert.ok(['production', 'development'].includes(runtime));
const sourceFile = path.resolve(process.env.QUALITY_BABA_SOURCE);
const source = await readFile(sourceFile);
const hash = b => createHash('sha256').update(b).digest('hex');
const viewport = { width: 1280, height: 720 };
const report = { runtime, viewport, source: { file: sourceFile, sha256: hash(source) },
  driverSha256: hash(await readFile(new URL(import.meta.url))),
  build: runtime === 'production' ? await productionBuildIdentity(path.resolve(process.env.QUALITY_BABA_BUILD_ROOT)) : null,
  scope: 'Prepared registered level-1 Baba replays S01 through native deployment and ability controls at ordinary simulation speed. Isolated profile with actual game SFX enabled; master audio duplicated to capture without changing speaker gain, requested native canvas capture 60Hz. No actor/HP/time/result setter. Not natural progression, human original-speed viewing, physical operation or whole-goal acceptance.',
  rows: [], inputs: [], inputPhases: [], moduleResponses: [], errors: [], renderMismatches: [] };
const ids = ['unit-babayaga'];
const seed = normalizeV100Save({ ...createDefaultV100Save({ settings: { bgmEnabled: false, sfxEnabled: true } }),
  campaignStarted: true, ownedUnitIds: ids, registeredUnitIds: ids, formationSlots: ids,
  availableStageIds: V100_STAGE_IDS, completedStageIds: V100_STAGE_IDS.slice(0, 22),
  flowState: { phase: 'formation', stageId: V100_STAGE_IDS[0], stageNumber: 1, eventId: null,
    destination: 'formation', nodeIndex: 0, firstClear: false, finalized: true } });
let browser, context, page, recording = false;
const responseTasks = [];
try {
  await writeFile(path.join(out, 'started.json'), JSON.stringify({ at: new Date().toISOString(), pid: process.pid,
    runtime, source: report.source, driverSha256: report.driverSha256 }, null, 2) + '\n', { flag: 'wx' });
  browser = await chromium.launch({ headless: true });
  context = await browser.newContext({ viewport, hasTouch: true, serviceWorkers: 'block' });
  await context.addInitScript(seedV100BrowserSaveOnce, serializeV100Save(seed));
  await context.addInitScript(()=>{
   const Base=window.AudioContext||window.webkitAudioContext,streams=new Map();window.__QUALITY_AUDIO_STREAMS__=[];
   const connect=AudioNode.prototype.connect;
   AudioNode.prototype.connect=function(destination,...rest){
    const result=connect.call(this,destination,...rest);
    if(destination===this.context.destination){
     let tap=streams.get(this.context);if(!tap){tap=this.context.createMediaStreamDestination();streams.set(this.context,tap);window.__QUALITY_AUDIO_STREAMS__.push(tap.stream);}
     connect.call(this,tap);
    }return result;
   };
   window.AudioContext=class extends Base{};
  });
  page = await context.newPage(); page.setDefaultTimeout(25000);
  page.on('pageerror', e => report.errors.push(String(e)));
  page.on('response', res => {
    const modulePath=new URL(res.url()).pathname;
    if (runtime !== 'development' || !['/app/v177WeaponChoreography.js','/app/qualityBattleHeadCalibrationData.js',
      '/app/qualityCharacterAtlases.js','/app/v177JointPresentation.js','/app/v177RangerFootPlacement.js'].includes(modulePath)) return;
    const observationIndex = responseTasks.length;
    responseTasks.push((async () => {
      const text = await res.text();
      const file = 'served-choreography-' + observationIndex + '.js';
      await writeFile(path.join(out, file), text, { flag: 'wx' });
      report.moduleResponses.push({ modulePath, status: res.status(), sha256: hash(text), file,
        containsCandidateMaster: modulePath==='/app/qualityBattleHeadCalibrationData.js'&&text.includes('babayaga-combat-r4.webp') });
    })().catch(e => report.errors.push('module observation: ' + String(e))));
  });
  await page.goto(process.env.V100_CAMPAIGN_QA_BASE_URL);
  await dismissInstallOffer(page, { timeout: 25000, readySelector: '.v100-start-screen', waitForFictionDismissal: true });
  await enterV100FromTitle(page);
  const offline = page.getByText('オフライン用の設定に失敗しました。通信できる状態ではゲームを続けられます。', { exact: true });
  if (await offline.isVisible()) await offline.locator('..').getByRole('button', { name: '閉じる', exact: true }).click();
  await page.getByRole('button', { name: '戦闘へ', exact: true }).click();
  await page.waitForFunction(() => window.__ASHFALL_BATTLE_QA__?.getSnapshot().running && document.documentElement.dataset.assetLoadState === 'ready');
  await page.screenshot({ path: path.join(out, 'before-deploy.png') });
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas'); if (!canvas) throw Error('No battle canvas');
    const stream = canvas.captureStream(60);
    const audio=window.__QUALITY_AUDIO_STREAMS__?.at(-1);if(!audio?.getAudioTracks().length)throw Error('No actual WebAudio capture');
    for(const track of audio.getAudioTracks())stream.addTrack(track);
    const mimeType = 'video/webm;codecs=vp8,opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) throw Error('No native VP8 recorder');
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6000000 });
    const state = { stream, recorder, chunks: [], started: null, stopped: null, stopRequested: null, errors: [], mimeType,
      width: canvas.width, height: canvas.height, trackSettings: stream.getVideoTracks()[0].getSettings() };
    recorder.ondataavailable = e => { if (e.data.size) state.chunks.push(e.data); };
    recorder.onerror = e => state.errors.push(String(e.error));
    recorder.onstart = () => { state.started = performance.now(); };
    state.done = new Promise(resolve => { recorder.onstop = () => { state.stopped = performance.now(); resolve(); }; });
    window.__qualityBabaRecording = state; recorder.start(1000);
  });
  recording = true;
  const deadline = Date.now() + 45000, seen = new Set(); let lastProgress = 0;
  let deployed = false, ability = false;
  while (Date.now() < deadline) {
    const snapshot = await page.evaluate(() => {
      const s = window.__ASHFALL_BATTLE_QA__?.getSnapshot();
      return s ? { observedAt: performance.now(), time: s.time, running: s.running, fighters: s.fighters.filter(f => f.kind === 'babayaga' && f.side === 'human')
        .map(f => ({ id: f.id, kind: f.kind, hp: f.hp, x: f.x, y: f.y, render: f.renderAudit, manual: f.manualAbility })) } : null;
    });
    if (Date.now() - lastProgress > 5000) {
      lastProgress = Date.now();
      console.log(JSON.stringify({ phase: 'observing', rows: report.rows.length,
        heapUsed: process.memoryUsage().heapUsed, time: snapshot?.time }));
    }
    if (!snapshot || !snapshot.running) break;
    if (snapshot.fighters.length) deployed = true;
    if (!deployed && await nativeBattleTap(page, page.locator('button.unit-card[data-kind="babayaga"]').first(), report.inputPhases))
      report.inputs.push({ time: snapshot.time, action: 'deploy', kind: 'babayaga' });
    for (const f of snapshot.fighters) {
      report.rows.push({ observedAt: snapshot.observedAt, time: snapshot.time, ...f });
      if (f.hp > 0 && f.render?.assetReady) {
        const state = f.render.requestedState; if (state) seen.add(state);
        if (!f.render.jointDrawSucceeded || f.render.jointAtlasPath !== QUALITY_CHARACTER_ATLASES.babayaga.path)
          report.renderMismatches.push({ time: snapshot.time, state, path: f.render.jointAtlasPath,
            jointDrawSucceeded: f.render.jointDrawSucceeded });
        if (!ability && seen.has('active') && await nativeBattleTap(page,
          page.locator(`button[data-fighter-id="${f.id}"][data-ability-kind]`).first(), report.inputPhases)) {
          ability = true; report.inputs.push({ time: snapshot.time, action: 'ability', kind: 'babayaga' });
        }
      }
    }
    await page.waitForTimeout(120);
  }
  report.states = [...seen]; report.abilityInput = ability;
  assert.ok(deployed && seen.has('move') && seen.has('active'), 'Baba must deploy, move and actually attack');
  assert.deepEqual(report.renderMismatches, []);
  report.status = 'captured-not-visual-accepted';
} catch (e) {
  report.status = 'failed'; report.error = String(e); process.exitCode = 1;
} finally {
  if (recording) try {
    const metadata = await page.evaluate(async () => {
      const r = window.__qualityBabaRecording;
      if (r.recorder.state !== 'inactive') { r.stopRequested = performance.now(); r.recorder.stop(); }
      await Promise.race([r.done, new Promise((_, reject) => setTimeout(() => reject(Error('Recorder stop deadline')), 5000))]);
      r.blob = new Blob(r.chunks, { type: r.mimeType });
      r.stream.getTracks().forEach(t => t.stop());
      return { bytes: r.blob.size, mimeType: r.mimeType, started: r.started, stopRequested: r.stopRequested,
        stopped: r.stopped, errors: r.errors, width: r.width, height: r.height, trackSettings: r.trackSettings };
    });
    console.log(JSON.stringify({ phase: 'transferring', bytes: metadata.bytes, heapUsed: process.memoryUsage().heapUsed }));
    const partial = path.join(out, 'battle.webm.partial'), handle = await open(partial, 'wx');
    const digest = createHash('sha256'); let received = 0;
    try {
      for (let offset = 0; offset < metadata.bytes; offset += 1024 * 1024) {
        const base64 = await page.evaluate(async start => {
          const blob = window.__qualityBabaRecording.blob.slice(start, start + 1024 * 1024);
          const url = await new Promise((resolve, reject) => {
            const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
          });
          return url.slice(url.indexOf(',') + 1);
        }, offset);
        const chunk = Buffer.from(base64, 'base64'); await handle.write(chunk);
        digest.update(chunk); received += chunk.length;
      }
    } finally { await handle.close(); }
    assert.equal(received, metadata.bytes);
    await rename(partial, path.join(out, 'battle.webm'));
    await page.evaluate(() => { const r = window.__qualityBabaRecording; r.blob = null; r.chunks.length = 0; });
    report.recording = { ...metadata, requestedHz: 60, sha256: digest.digest('hex') };
    assert.ok(metadata.bytes > 10000); assert.deepEqual(metadata.errors, []);
    assert.equal(hash(await readFile(path.join(out, 'battle.webm'))), report.recording.sha256);
    await page.screenshot({ path: path.join(out, 'after-recording.png') });
  } catch (e) { report.status = 'failed'; report.recordingError = String(e); process.exitCode = 1; }
  await Promise.allSettled(responseTasks);
  if (runtime === 'development' && !report.moduleResponses.some(r => r.containsCandidateMaster)) {
    report.status = 'failed'; report.sourceObservationError = 'Candidate module was not observed'; process.exitCode = 1;
  }
  if (report.errors.length) { report.status = 'failed'; process.exitCode = 1; }
  await context?.close(); await browser?.close();
  await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify({ status: report.status, states: report.states, rows: report.rows.length, recording: report.recording, error: report.error }));
