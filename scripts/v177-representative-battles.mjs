import assert from 'node:assert/strict';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { serializeV100Save } from '../app/v100Save.js';
import { createV177RepresentativeBudget } from './v177-representative-budget.mjs';
import { normalTacticalInput } from './v100-normal-tactical-input.mjs';
import { enterV100FromTitle, seedV100BrowserSaveOnce } from './v100-title-qa-entry.mjs';
import { dismissInstallOffer } from './pwa-gate-qa.mjs';
import { pwaBrowserType } from './pwa-browser-runtime.mjs';
import { productionBuildIdentity } from './browser-qa-build-identity.mjs';
import { installRequestFailureAudit } from './browser-request-failure-audit.mjs';
import { startNativeCanvasClip, finishNativeCanvasClip } from './v177-native-canvas-clips.mjs';
import { installNormalFrameObserver,createNormalFrameCapture,finishNormalFrameCapture } from './v177-normal-frame-observation.mjs';

export const V177_REPRESENTATIVE_WINDOW_MS = 120_000;
export function assertRepresentativeBattleObservation(row) {
  assert.ok([14, 25, 30].includes(row.number));
  const expected = createV177RepresentativeBudget(row.number);
  assert.deepEqual(row.budget, expected.budget, 'retain the actual minimum purchasing budget');
  assert.deepEqual(row.errors, []);
  assert.deepEqual(row.requestAudit?.unexpectedFailures, []);
  for (const key of ['captureError', 'saveCaptureError', 'videoCaptureError']) assert.equal(row[key], undefined, key);
  assert.equal(row.budget.stageNumber, row.number);
  assert.equal(row.budget.earnedCampaignAcceptance, false);
  assert.equal(row.budget.difficultyAcceptance, false);
  assert.equal(row.openingSave.flowState.stageId, row.budget.stageId);
  for (const key of ['caps', 'formationSlots', 'unitLevels', 'ownedUnitIds', 'completedStageIds', 'vehicle']) assert.deepEqual(row.openingSave[key], expected.save[key], key);
  assert.equal(row.finalSave.caps, row.openingSave.caps, 'no CAPS or reward injection during observation');
  assert.deepEqual(row.finalSave.completedStageIds, row.openingSave.completedStageIds);
  assert.ok(row.inputs.some(input => input.action === 'deploy'), 'observe actual ordinary deployment');
  assert.ok(row.snapshots.some(snapshot => snapshot.humans > 0 && snapshot.enemies > 0));
  assert.equal(row.nativeClip.status, 'recorded');
  assert.deepEqual(row.nativeClip.errors, []);
  assert.ok(row.nativeClip.bytes > 0 && row.nativeClip.bytes <= 8 * 1024 * 1024);
  assert.equal(row.nativeClip.originalSpeedAccepted, false, 'PTS/full decode review is still required');
  assert.ok(row.videoBytes > 0);
  assert.ok(['observed-window', 'won', 'lost'].includes(row.outcome));
  if (row.outcome === 'observed-window') {
    assert.ok(row.wallElapsedMs >= V177_REPRESENTATIVE_WINDOW_MS);
    assert.equal(row.finalSave.pendingResult, null, 'do not force a result at the observation boundary');
  } else {
    const result = row.finalSave.pendingResult ?? row.finalSave.lastResult;
    assert.equal(result.battleRunId, `v100:${row.budget.stageId}:${row.openingSave.revision}`);
    assert.equal(result.won, row.outcome === 'won');
  }
  return { observationStatus: row.outcome, earnedCampaignAcceptance: false, balanceAcceptance: false,
    originalSpeedAccepted: false, releaseAcceptance: false };
}

async function main() {
  assert.notEqual(process.platform, 'win32', 'representative game/browser/audio observation is hosted-only');
  const engine = process.env.V100_NORMAL_PLAY_ENGINE;
  assert.ok(['chromium', 'webkit'].includes(engine));
  if (engine === 'webkit') assert.equal(process.platform, 'darwin');
  const origin = new URL(process.env.V100_CAMPAIGN_QA_BASE_URL);
  assert.ok(['localhost', '127.0.0.1'].includes(origin.hostname));
  const out = path.resolve(process.env.V100_NORMAL_PLAY_EVIDENCE_DIR, 'representative-battles');
  await mkdir(out, { recursive: false });
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const report = { head, engine, build: await productionBuildIdentity(), viewport: { width: 844, height: 340 },
    scope: 'Independent S14/S25/S30 battles with minimum one-star production purchasing budgets. Prefix wins are synthetic. Real UI, native time and actual battle outcomes; no AI-win prerequisite, earned-chain or difficulty acceptance. Full-page video is not an accepted speed clock; the first native canvas clip retains the existing 15s/8MiB recorder contract.',
    cases: [], status: 'running' };
  const browser = await (await pwaBrowserType(engine)).launch({ headless: true });
  try {
    for (const number of [14, 25, 30]) {
      const fixture = createV177RepresentativeBudget(number);
      const row = { number, budget: fixture.budget, inputs: [], samples: [], snapshots: [], errors: [], status: 'running' };
      report.cases.push(row);
      const context = await browser.newContext({ viewport: report.viewport, isMobile: true, hasTouch: true,
        recordVideo: { dir: path.join(out, 'videos'), size: report.viewport } });
      const page = await context.newPage(), video = page.video();
      const requests = installRequestFailureAudit(page); row.requestAudit = requests.report;
      let clip,frameCapture;
      const frameOwner=`${head}:representative:${number}`;
      const saveAt = () => page.evaluate(() => JSON.parse(localStorage.getItem('nishijin-campaign-v100')));
      const phaseAt = () => page.locator('.v100-shell').getAttribute('data-v100-phase');
      const persist = () => writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
      page.on('pageerror', error => row.errors.push(String(error)));
      page.on('console', message => { if (message.type() === 'error') row.errors.push(message.text()); });
      page.on('response', response => { if (response.status() >= 400) row.errors.push(`${response.status()}: ${response.url()}`); });
      async function finishClip(completed) {
        const handle = clip; clip = null;
        const receipt = await handle.evaluate(finishNativeCanvasClip, { completed });
        await handle.dispose();
        const { videoBase64, ...details } = receipt;
        const bytes = Buffer.from(videoBase64, 'base64');
        assert.ok(bytes.length <= 8 * 1024 * 1024);
        const extension = details.mimeType.startsWith('video/mp4') ? 'mp4' : details.mimeType.startsWith('video/webm') ? 'webm' : null;
        assert.ok(extension);
        const file = path.join(out, `s${number}-native-opening.${extension}`);
        await writeFile(file, bytes, { flag: 'wx' });
        row.nativeClip = { ...details, file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
        await writeFile(path.join(out, `s${number}-native-opening.json`), JSON.stringify(row.nativeClip, null, 2) + '\n', { flag: 'wx' });
      }
      try {
        await page.addInitScript(installNormalFrameObserver);
        await page.addInitScript(seedV100BrowserSaveOnce, serializeV100Save(fixture.save));
        await page.goto(origin.href);
        await dismissInstallOffer(page, { timeout: 15000, readySelector: '.v100-start-screen', waitForFictionDismissal: true });
        await enterV100FromTitle(page, { timeout: 15000 });
        await page.waitForFunction(() => document.querySelector('.v100-formation-panel') && !document.querySelector('.v100-shell[aria-busy="true"]') && [...document.images].every(image => image.complete && image.naturalWidth > 0));
        const before = await saveAt();
        for (const key of ['caps', 'formationSlots', 'unitLevels', 'ownedUnitIds', 'completedStageIds']) assert.deepEqual(before[key], fixture.save[key], key);
        await page.screenshot({ path: path.join(out, `s${number}-formation.png`) });
        await page.getByRole('button', { name: '戦闘へ', exact: true }).click({ timeout: 500 });
        await page.waitForFunction(() => globalThis.__ASHFALL_BATTLE_QA__?.getSnapshot?.()?.running === true);
        frameCapture=await createNormalFrameCapture({directory:out,label:`s${number}`,owner:frameOwner});
        const opening=await page.evaluate(owner=>({save:JSON.parse(localStorage.getItem('nishijin-campaign-v100')),
          frames:globalThis.__V177_READ_NORMAL_FRAMES__?.(owner,'start')??null}),frameOwner);
        row.openingSave=opening.save;await frameCapture.record(opening.frames);
        clip = await page.locator('.game-shell canvas').evaluateHandle(startNativeCanvasClip, { engine, metadata: {
          fixtureGroup: 'representative-normal-budget', stageNumber: number, phase: 'opening', form: 'whole-battle' } });
        const started = Date.now(); let lastSnapshotTime = -Infinity;
        while (Date.now() - started < V177_REPRESENTATIVE_WINDOW_MS) {
          const phase = await phaseAt();
          if (phase === 'result') break;
          assert.equal(phase, 'battle');
          await normalTacticalInput(page, row, { frameOwner,observeFrameChunk:chunk=>frameCapture.record(chunk),observeSnapshot(snapshot) {
            if (!snapshot || snapshot.time - lastSnapshotTime < 2) return;
            lastSnapshotTime = snapshot.time;
            row.snapshots.push({ time: snapshot.time, baseHp: snapshot.baseHp, command: snapshot.energy,
              humans: snapshot.fighters.filter(fighter => fighter.side === 'human' && fighter.hp > 0).length,
              enemies: snapshot.fighters.filter(fighter => fighter.side === 'zombie' && fighter.hp > 0).length,
              fighters: snapshot.fighters });
          } });
          if (clip && Date.now() - started >= 10_000) await finishClip(true);
          assert.deepEqual(row.errors, []); assert.deepEqual(requests.report.unexpectedFailures, []);
          await page.waitForTimeout(300);
        }
        row.wallElapsedMs = Date.now() - started;
        if (await phaseAt() === 'result') await page.waitForFunction(() => !document.querySelector('.v100-shell[aria-busy="true"]') && document.documentElement.dataset.pwaSaveMutationPending === 'false');
        const end = await page.evaluate(owner => ({ phase: document.querySelector('.v100-shell')?.dataset.v100Phase, save: JSON.parse(localStorage.getItem('nishijin-campaign-v100')),
          frames:globalThis.__V177_READ_NORMAL_FRAMES__?.(owner,'stop')??null }),frameOwner);
        await frameCapture.record(end.frames);row.framePerformance=await frameCapture.finish();
        row.finalSave = end.save;
        if (end.phase === 'result') row.outcome = (row.finalSave.pendingResult ?? row.finalSave.lastResult)?.won ? 'won' : 'lost';
        else row.outcome = 'observed-window';
        if (clip) await finishClip(false);
        await page.screenshot({ path: path.join(out, `s${number}-observation-end.png`) });
      } catch (error) { row.status = 'failed'; row.error = String(error); await page.screenshot({ path: path.join(out, `s${number}-failure.png`) }).catch(() => {}); }
      finally {
        row.framePerformance??=await finishNormalFrameCapture(page,frameCapture,frameOwner).catch(error=>({status:'incomplete',error:String(error),performanceAcceptance:false}));
        if (clip) await finishClip(false).catch(error => { row.captureError = String(error); row.status = 'failed'; });
        try { row.finalSave ??= await saveAt(); await context.storageState({ path: path.join(out, `s${number}-browser-storage.json`), indexedDB: true }); }
        catch (error) { row.saveCaptureError = String(error); row.status = 'failed'; }
        try { await requests.closeContext(context); row.video = await video.path(); row.videoBytes = (await stat(row.video)).size; }
        catch (error) { row.videoCaptureError = String(error); row.status = 'failed'; }
        if (row.status !== 'failed') {
          try { row.acceptance = assertRepresentativeBattleObservation(row); row.status = 'observed'; }
          catch (error) { row.status = 'failed'; row.error = String(error); }
        }
        await persist();
      }
    }
  } finally { await browser.close(); }
  report.status = report.cases.length === 3 && report.cases.every(row => row.status === 'observed') ? 'observed' : 'failed';
  await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ head, engine, status: report.status, outcomes: report.cases.map(row => ({ number: row.number, outcome: row.outcome, status: row.status })) }));
  if (report.status === 'failed') process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
