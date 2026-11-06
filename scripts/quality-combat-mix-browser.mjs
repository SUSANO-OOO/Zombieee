import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { chromium } from 'playwright';
import { productionBuildIdentity } from './browser-qa-build-identity.mjs';
import { enterV100FromTitle, seedV100BrowserSaveOnce } from './v100-title-qa-entry.mjs';
import { dismissInstallOffer } from './pwa-gate-qa.mjs';
import { createDefaultV100Save, normalizeV100Save, serializeV100Save } from '../app/v100Save.js';
import { V100_STAGE_IDS } from '../app/v100Registry.js';
const out = path.resolve(process.env.QUALITY_MIX_OUT), root = path.resolve(process.env.QUALITY_MIX_BUILD_ROOT);
const url = new URL(process.env.QUALITY_MIX_URL); assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname));
await mkdir(out, { recursive: false });
const build = await productionBuildIdentity(root), snapshot = JSON.parse(await readFile(path.join(root, 'snapshot.json')));
assert.equal(build.combinedSha256, snapshot.combinedSha256);
const report = { build, samples: [], requests: [], errors: [], after: process.env.QUALITY_MIX_AFTER === '1',
 scriptSha256: createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex'),
 scope: 'Controlled fixed-cue audio comparison through the actual production mixer and recording tap, while gameplay is paused. Same authored recordings, gains and request schedule; not natural battle, subjective listening or physical acceptance.' };
const seed = normalizeV100Save({ ...createDefaultV100Save({ settings: { bgmEnabled: false, sfxEnabled: true } }), campaignStarted: true,
 flowState: { phase: 'formation', stageId: V100_STAGE_IDS[0], stageNumber: 1, eventId: null, destination: 'formation', nodeIndex: 0, firstClear: false, finalized: true } });
const browser = await chromium.launch({ headless: true }), context = await browser.newContext({ viewport: { width: 844, height: 340 }, serviceWorkers: 'block' });
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
  const ordinary = ['weapon-rifle-01', 'weapon-gunner-01', 'weapon-suppressed-pistol'];
  const foreground = [{ at: 2, cue: 'voice-babayaga-hurt' }, { at: 4, cue: 'voice-kumaverson-deploy' },
   { at: 6, cue: 'v104-eye-warning' }, { at: 8, cue: 'ability-tky-light-blade-charge' },
   { at: 8.15, cue: 'weapon-pan-hit', options: { dedupeKey: 'manual-ability:comparison:1:counter' } }];
  for (const cue of [...ordinary, ...foreground.map(e => e.cue)]) {
   const h = await qa.play(cue, { volume: 0, cooldownMs: 0 }); if (!h) throw Error('Preload failed: ' + cue); h.stop();
  }
  const tap = qa.createLocalRecordingTap(), chunks = [], recorder = new MediaRecorder(tap.stream, { mimeType: 'audio/webm;codecs=opus' });
  recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  const stopped = new Promise(resolve => recorder.onstop = resolve);
  const started = new Promise(resolve => recorder.onstart = resolve); recorder.start(250); await started;
  const start = performance.now(), requests = [], samples = [], pending = [];
  const request = (cue, options = {}) => { const at = (performance.now() - start) / 1000; pending.push(qa.play(cue, { cooldownMs: 0, ...options }).then(h => requests.push({ cue, at, started: Boolean(h) }))); };
  const timers = [];
  for (let n = 0; n < 55; n++) for (let i = 0; i < ordinary.length; i++) timers.push(setTimeout(() => request(ordinary[i]), 250 + n * 200 + i * 20));
  for (const e of foreground) timers.push(setTimeout(() => request(e.cue, e.options), e.at * 1000));
  const sample = setInterval(() => { const d = qa.getDiagnostics(); samples.push({ at: (performance.now() - start) / 1000, mix: d.combatMix ?? null, gains: d.gainStages, active: d.activeVoices }); }, 50);
  await new Promise(resolve => setTimeout(resolve, 13000));
  clearInterval(sample); timers.forEach(clearTimeout); await Promise.all(pending);
  recorder.stop(); await stopped; tap.release(); qa.stopAll();
  const bytes = new Uint8Array(await new Blob(chunks, { type: recorder.mimeType }).arrayBuffer());
  const decoder = new OfflineAudioContext(2, 1, 48000), decoded = await decoder.decodeAudioData(bytes.buffer.slice(0));
  const channels = Array.from({ length: decoded.numberOfChannels }, (_, i) => Array.from(decoded.getChannelData(i)));
  return { bytes: Array.from(bytes), channels, sampleRate: decoded.sampleRate, duration: decoded.duration, requests, samples, foreground, ordinary, final: qa.getDiagnostics() };
 });
 const { bytes, channels, ...metadata } = data; Object.assign(report, metadata);
 await writeFile(path.join(out, 'mix.webm'), Buffer.from(bytes));
 const count = channels.length, frames = channels[0].length, wav = Buffer.alloc(44 + frames * count * 2);
 wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
 wav.writeUInt16LE(1, 20); wav.writeUInt16LE(count, 22); wav.writeUInt32LE(data.sampleRate, 24); wav.writeUInt32LE(data.sampleRate * count * 2, 28);
 wav.writeUInt16LE(count * 2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
 let peak = 0, clipped = 0;
 for (let f = 0; f < frames; f++) for (let c = 0; c < count; c++) { const v = channels[c][f]; peak = Math.max(peak, Math.abs(v)); if (Math.abs(v) >= 1) clipped++; wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), 44 + (f * count + c) * 2); }
 await writeFile(path.join(out, 'mix.wav'), wav);
 report.audio = { peak, clipped, frames, channels: count, bytes: wav.length, sha256: createHash('sha256').update(wav).digest('hex') };
 assert.equal(createHash('sha256').update(await readFile(path.join(out, 'mix.wav'))).digest('hex'), report.audio.sha256);
 assert.equal(report.requests.length, 170); assert.ok(report.requests.every(r => r.started)); assert.equal(clipped, 0); assert.ok(peak > .01);
 if (report.after) {
  assert.ok(report.samples.some(s => s.mix.foregroundVoices > 0 && s.gains.ordinaryCombat.weapons < .5));
  assert.ok(report.samples.filter(s => s.at > 12).every(s => s.mix.ordinaryTargetGain === 1));
  assert.equal(report.final.combatMix.ordinaryTargetGain, 1);
 }
 assert.deepEqual(report.errors, []); report.status = 'captured-not-listening-accepted';
} catch (e) { report.error = String(e); report.status = 'failed'; throw e; }
finally { await context.close(); await browser.close(); await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); }
console.log(JSON.stringify({ status: report.status, build: build.combinedSha256, requests: report.requests.length, audio: report.audio }));
