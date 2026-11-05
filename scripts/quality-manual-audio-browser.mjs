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
import { MANUAL_ABILITY_REGISTRY } from '../app/manualAbilities.js';
import { V099_MANUAL_ABILITY_AUDIO_CONTRACTS } from '../app/battleAudioContracts.js';

const kinds = (process.env.QUALITY_MANUAL_KINDS ?? 'engineer,medic,ranger,babayaga,gunner,mrs-chiha,brute,miyamoto-musashi').split(',');
const musashiCounter = process.env.QUALITY_MANUAL_MUSASHI_COUNTER === '1';
const supported = new Set(Object.keys(V099_MANUAL_ABILITY_AUDIO_CONTRACTS));
assert.ok(kinds.every(k => supported.has(k)));
const url = new URL(process.env.QUALITY_MANUAL_URL);
assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname));
const out = path.resolve(process.env.QUALITY_MANUAL_OUT);
await mkdir(out, { recursive: false });
const script = await readFile(new URL(import.meta.url));
await writeFile(path.join(out, 'harness.mjs'), script);
const report = { build: await productionBuildIdentity(path.resolve(process.env.QUALITY_MANUAL_BUILD_ROOT)),
  after: process.env.QUALITY_MANUAL_AFTER === '1', scriptSha256: createHash('sha256').update(script).digest('hex'),
  scope: 'Prepared S23 save and existing stationary manual-ability fixtures; actual buttons, ordinary simulation, production mixer and 30fps canvas/audio tap. Not normal progression, subjective hearing or physical acceptance.', cases: [], errors: [] };
const save = normalizeV100Save({ ...createDefaultV100Save({ settings: { bgmEnabled: false, sfxEnabled: true } }),
  campaignStarted: true, availableStageIds: V100_STAGE_IDS, completedStageIds: V100_STAGE_IDS.slice(0, 22),
  flowState: { phase: 'formation', stageId: V100_STAGE_IDS[22], stageNumber: 23, eventId: null, destination: 'formation', nodeIndex: 0, firstClear: false, finalized: true } });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 844, height: 340 }, hasTouch: true, serviceWorkers: 'block' });
try {
  await context.addInitScript(seedV100BrowserSaveOnce, serializeV100Save(save));
  const page = await context.newPage(); page.setDefaultTimeout(25000);
  page.on('pageerror', e => report.errors.push(String(e)));
  await page.goto(url.href, { waitUntil: 'domcontentloaded' });
  await dismissInstallOffer(page, { timeout: 25000, readySelector: '.v100-start-screen', waitForFictionDismissal: true });
  await enterV100FromTitle(page);
  await page.getByRole('button', { name: '戦闘へ', exact: true }).click();
  await page.waitForFunction(() => window.__ASHFALL_BATTLE_QA__?.getSnapshot().running
    && window.__ASHFALL_AUDIO_QA__?.getDiagnostics().contextState === 'running');
  for (const kind of kinds) {
    const row = { kind }; report.cases.push(row);
    await page.evaluate(k => window.__ASHFALL_BATTLE_QA__.ensureUnitRenderProofAsset(k), kind);
    row.fixture = await page.evaluate(k => window.__ASHFALL_BATTLE_QA__.prepareManualAbilityProof(k), kind);
    const ownerId = row.fixture.ownerIds[0];
    const button = page.locator(`.manual-ability-ready[data-fighter-id="${ownerId}"]`);
    await button.waitFor({ state: 'visible' });
    await page.evaluate(async id => {
      const qa = window.__ASHFALL_AUDIO_QA__, bridge = window.__ASHFALL_BATTLE_QA__;
      qa.resetCueRequests();
      const tap = qa.createLocalRecordingTap(), video = document.querySelector('canvas').captureStream(30);
      const recorder = new MediaRecorder(new MediaStream([...video.getVideoTracks(), ...tap.stream.getAudioTracks()]), { mimeType: 'video/webm;codecs=vp8,opus' });
      const r = { tap, video, recorder, chunks: [], samples: [], cues: new Map(), active: true, id, error: null };
      recorder.ondataavailable = e => { if (e.data.size) r.chunks.push(e.data); };
      recorder.onerror = e => { r.error = String(e.error); };
      r.done = new Promise(resolve => { recorder.onstop = resolve; });
      const started = new Promise(resolve => { recorder.onstart = resolve; });
      function sample() {
        if (!r.active) return;
        const s = bridge.getSnapshot();
        r.samples.push({ at: performance.now(), time: s.time, fighters: s.fighters.map(f => ({ id: f.id, side: f.side, kind: f.kind, hp: f.hp, manualAbility: f.manualAbility,
          engineerTrapReady: f.engineerTrapReady, engineerTrapManual: f.engineerTrapManual })),
          support: s.v100SupportEffects, advanced: s.v100AdvancedAbilityEffects, muzzles: s.v100ManualMuzzles, receipts: s.manualAbilityReceipts });
        for (const cue of qa.getCueRequests()) {
          const key = JSON.stringify(cue);
          if (!r.cues.has(key)) r.cues.set(key, { ...cue, observedAtSimulationTime: s.time });
        }
        requestAnimationFrame(sample);
      }
      window.__MANUAL_AUDIO_RECORDING__ = r; recorder.start(250); await started; sample();
    }, ownerId);
    await button.click();
    if (kind === 'miyamoto-musashi' && musashiCounter) {
      await page.waitForFunction(id => window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters
        .find(f => f.id === id)?.manualAbility?.phase === 'guard', ownerId);
      row.counterProof = await page.evaluate(id => {
        const bridge = window.__ASHFALL_BATTLE_QA__;
        const before = bridge.getSnapshot();
        const owner = before.fighters.find(f => f.id === id);
        const targetId = owner.manualAbility.target.targetId;
        const hp = s => s.fighters.find(f => f.id === targetId).hp;
        const first = bridge.applyHumanDamage(id, 35);
        const afterFirst = bridge.getSnapshot();
        const second = bridge.applyHumanDamage(id, 35);
        const afterSecond = bridge.getSnapshot();
        return { scope: 'Two diagnostic melee damage calls during guard; not natural enemy attacks',
          first, second, targetHpBefore: hp(before), targetHpAfterFirst: hp(afterFirst),
          targetHpAfterSecond: hp(afterSecond), at: before.time };
      }, ownerId);
      assert.equal(row.counterProof.first.preventedDamage, 35);
      assert.equal(row.counterProof.first.beforeHp, row.counterProof.first.afterHp);
      assert.ok(row.counterProof.targetHpAfterFirst < row.counterProof.targetHpBefore);
      assert.equal(row.counterProof.targetHpAfterSecond, row.counterProof.targetHpAfterFirst);
      assert.ok(row.counterProof.second.afterHp < row.counterProof.second.beforeHp);
    }
    // Include authored guard/active time so delayed strikes and Mayo's retreat are observed.
    const definition = MANUAL_ABILITY_REGISTRY[kind];
    const seconds = Math.max(kind === 'mrs-chiha' ? 4 : 3,
      definition.windupSeconds + (definition.guardSeconds ?? definition.activeSeconds ?? 0) + definition.recoverySeconds + 1);
    await page.waitForTimeout(seconds * 1000);
    const data = await page.evaluate(async () => {
      const r = window.__MANUAL_AUDIO_RECORDING__; r.active = false; r.recorder.stop();
      await Promise.race([r.done, new Promise((_, reject) => setTimeout(() => reject(Error('recording stop timeout')), 5000))]);
      const bytes = Array.from(new Uint8Array(await new Blob(r.chunks, { type: r.recorder.mimeType }).arrayBuffer()));
      r.tap.release(); r.video.getTracks().forEach(t => t.stop());
      return { bytes, samples: r.samples, cues: [...r.cues.values()], error: r.error, diagnostics: window.__ASHFALL_AUDIO_QA__.getDiagnostics() };
    });
    const { bytes, ...rest } = data; Object.assign(row, rest);
    const buffer = Buffer.from(bytes), file = path.join(out, kind + '.webm');
    await writeFile(file, buffer); assert.ok((await readFile(file)).equals(buffer));
    row.recording = { file, bytes: buffer.length, sha256: createHash('sha256').update(buffer).digest('hex') };
    const own = row.cues.filter(c => String(c.ownerId) === String(ownerId));
    const contract = V099_MANUAL_ABILITY_AUDIO_CONTRACTS[kind];
    const keys = kind === 'miyamoto-musashi' ? [musashiCounter ? 'counter' : 'fallbackCross'] : Object.keys(contract.timeline);
    row.counts = Object.fromEntries(keys.map(key => [key, own.filter(c => c.cueId === contract.timeline[key]).length]));
    for (const key of keys) assert.ok(row.counts[key] > 0, kind + ':' + key + ' reaches actual audio request');
    if (kind === 'miyamoto-musashi' && musashiCounter) {
      assert.equal(row.counts.counter, 1);
      assert.equal(own.filter(c => c.cueId === contract.timeline.fallbackCross).length, 0);
    }
    if (kind === 'gunner') {
      assert.equal(row.counts.muzzle, MANUAL_ABILITY_REGISTRY.gunner.burstCount);
      assert.equal(row.counts.impact, MANUAL_ABILITY_REGISTRY.gunner.burstCount);
      const shots = own.filter(c => c.cueId === contract.timeline.muzzle);
      const hits = own.filter(c => c.cueId === contract.timeline.impact);
      row.salvoGaps = shots.map((shot, i) => hits[i].observedAtSimulationTime - shot.observedAtSimulationTime);
      assert.ok(row.salvoGaps.every(gap => gap > 0 && gap < .2));
    }
    if (kind === 'engineer') {
      assert.equal(row.counts.spring, 1);
      const sprung = row.samples.flatMap(s => s.support).find(e => e.eventType === 'trap-sprung');
      assert.ok(sprung, 'trap actually caught a target');
      row.springOffset = own.find(c => c.cueId === contract.timeline.spring).observedAtSimulationTime - sprung.startedAt;
      if (report.after) assert.ok(row.springOffset >= -1e-8 && row.springOffset <= .04, 'spring follows the actual trap trigger');
      else assert.ok(row.springOffset < -.1, 'baseline spring precedes the trap trigger');
    }
    assert.equal(row.error, null); assert.equal(row.diagnostics.cache.failed, 0);
    row.status = 'passed';
  }
  assert.deepEqual(report.errors, []); report.status = 'passed';
} catch (e) { report.status = 'failed'; report.failure = String(e); throw e; }
finally { await context.close(); await browser.close(); await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); }
console.log(JSON.stringify({ status: report.status, cases: report.cases.map(r => ({ kind: r.kind, counts: r.counts, springOffset: r.springOffset, salvoGaps: r.salvoGaps })) }));
