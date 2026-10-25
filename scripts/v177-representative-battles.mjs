import assert from 'node:assert/strict';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
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
import {createNormalBrowserDeadline,normalCleanupWithin,normalPlayChildCompletion,normalProtocolTimeoutReceipt} from './v177-normal-browser-deadline.mjs';

export const V177_REPRESENTATIVE_WINDOW_MS = 120_000;
// The production shell persists across battle/result. Read it atomically in
// the page's existing world; no locator polling or implicit reattachment wait.
export function readRepresentativeBattlePhase(){
  const shells=document.querySelectorAll('.v100-shell');
  if(shells.length!==1)throw new Error('Expected one production campaign shell');
  const phase=shells[0].getAttribute('data-v100-phase');
  if(phase!=='battle'&&phase!=='result')throw new Error('Unexpected representative battle phase: '+phase);
  return phase;
}
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
    assert.equal(row.finalBattle?.stageId,row.budget.stageId,'The final live battle must retain the original stage');
    assert.equal(row.finalBattle.running,true,'A stopped battle cannot satisfy the bounded live window');
    assert.equal(row.finalBattle.over,false,'An ended battle must reach its real result instead of timing out green');
    assert.ok(Number.isFinite(row.finalBattle.baseHp)&&row.finalBattle.baseHp>0,'A destroyed vehicle requires the actual defeat result');
  } else {
    const result = row.finalSave.pendingResult ?? row.finalSave.lastResult;
    assert.equal(result.battleRunId, `v100:${row.budget.stageId}:${row.openingSave.revision}`);
    assert.equal(result.won, row.outcome === 'won');
  }
  return { observationStatus: row.outcome, earnedCampaignAcceptance: false, balanceAcceptance: false,
    originalSpeedAccepted: false, releaseAcceptance: false };
}

// Bounded passive evidence uses the same snapshot read that guides the input.
// These IDs are actual observed humans; no input request is a spawn receipt.
export function recordS25DeploymentObservation(row,snapshot) {
  if(!snapshot)return;
  if(row.number!==25||!snapshot.s25DeploymentObservation)throw new Error('Missing S25 control observation');
  if(!Number.isFinite(snapshot.time)||snapshot.s25DeploymentObservation.simulationTime!==snapshot.time)throw new Error('S25 observation clock mismatch');
  const observations=row.s25DeploymentObservations??=[];
  if(observations.length>=512)throw new Error('S25 control observation bound exceeded');
  observations.push(snapshot.s25DeploymentObservation);
  const actors=row.s25ObservedHumans??=[];
  for(const actor of snapshot.fighters.filter(f=>f.side==='human'&&f.hp>0)){
    if(!Number.isInteger(actor.id)||actor.id<=0||typeof actor.kind!=='string')throw new Error('Invalid actual S25 human ID');
    const previous=actors.find(previous=>previous.id===actor.id);
    if(previous&&previous.kind!==actor.kind)throw new Error('S25 human ID changed kind');
    if(!previous){
    if(actors.length>=512)throw new Error('S25 actual human ID bound exceeded');
    actors.push({id:actor.id,kind:actor.kind,firstObservedAt:snapshot.time,hp:actor.hp,maxHp:actor.maxHp,x:actor.x,y:actor.y,combatReady:actor.combatReady});
    }
  }
}

async function main() {
  const engine = process.env.V100_NORMAL_PLAY_ENGINE;
  assert.ok(['chromium', 'webkit'].includes(engine));
  if (engine === 'webkit') assert.equal(process.platform, 'darwin');
  const origin = new URL(process.env.V100_CAMPAIGN_QA_BASE_URL);
  assert.ok(['localhost', '127.0.0.1'].includes(origin.hostname));
  const mode=process.env.V177_REPRESENTATIVE_INPUT_CASE;
  assert.ok(mode===undefined||mode==='s25-fire-before-repeat-medic','unknown comparison mode');
  const s25FireComparison=mode==='s25-fire-before-repeat-medic';
  const s25Observe=process.env.V177_S25_DEPLOY_OBSERVATION==='1';
  if(s25FireComparison){assert.equal(engine,'chromium');assert.equal(s25Observe,true);}
  const out = path.resolve(process.env.V100_NORMAL_PLAY_EVIDENCE_DIR, s25FireComparison?'s25-fire-input-comparison':'representative-battles');
  await mkdir(out, { recursive: false });
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const report = { head, engine, build: await productionBuildIdentity(), viewport: { width: 844, height: 340 },
    scope: 'One failed S14 replay only; no full normal-route acceptance. Independent S14/S25/S30 battles with minimum one-star production purchasing budgets. Prefix wins are synthetic. Real UI, native time and actual battle outcomes; no AI-win prerequisite, earned-chain or difficulty acceptance. Full-page video is not an accepted speed clock; the first native canvas clip retains the existing 15s/8MiB recorder contract.',
    cases: [], status: 'running' };
  if(s25FireComparison)report.scope='One opt-in S25 input-order comparison against the preserved same-save baseline. Original stats, budget, native clock, ordinary trusted UI and technical gates; no win prerequisite, causal difficulty, original-speed or whole-game acceptance.';
  let baseline;
  if(s25FireComparison){
    const file=path.resolve(process.env.V100_NORMAL_PLAY_EVIDENCE_DIR,'representative-battles/report.json'),bytes=await readFile(file),original=JSON.parse(bytes);
    assert.equal(original.head,head);assert.equal(original.engine,engine);assert.equal(original.status,'observed');
    assert.deepEqual(original.build,report.build);
    baseline=original.cases.find(row=>row.number===25);assert.equal(baseline?.status,'observed');
    report.baseline={file,sha256:createHash('sha256').update(bytes).digest('hex'),number:25,outcome:baseline.outcome};
  }
  const browser = await (await pwaBrowserType(engine)).launch({ headless: true });
  let outerFailure=null;
  try {
    for (const number of (s25FireComparison?[25]:[14])) {
      const fixture = createV177RepresentativeBudget(number);
      const row = { number, budget: fixture.budget, inputs: [], samples: [], snapshots: [], errors: [], status: 'running' };
      if(s25Observe&&number===25){
        row.inputComparison={profile:s25FireComparison?'s25-fire-before-repeat-medic':'original-baseline',sameSeed:true,
          causalDifficultyAcceptance:false,allThirtyWinRequirement:false,originalSpeedAccepted:false};
        row.fixtureSeedSha256=createHash('sha256').update(serializeV100Save(fixture.save)).digest('hex');
        if(s25FireComparison)assert.equal(row.fixtureSeedSha256,baseline.fixtureSeedSha256,'identical original serialized save');
      }
      report.cases.push(row);
      await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
      let context,requests,contextClose;
      const closeOwnedContext=()=>contextClose??=(requests?requests.closeContext(context):context.close());
      const rpc=createNormalBrowserDeadline({onTimeout:()=>context?normalCleanupWithin(closeOwnedContext,'timed-out representative context'):undefined});
      context = await rpc.run(()=>browser.newContext({ viewport: report.viewport, isMobile: true, hasTouch: true,
        recordVideo: { dir: path.join(out, 'videos'), size: report.viewport } }),'browser.newContext');
      const rawPage=await rpc.run(()=>context.newPage(),'context.newPage'),page=rpc.wrap(rawPage),video=page.video();
      requests = installRequestFailureAudit(page); row.requestAudit = requests.report;
      let clip,frameCapture;
      const frameOwner=`${head}:representative:${number}`;
      const saveAt = () => page.evaluate(() => JSON.parse(localStorage.getItem('nishijin-campaign-v100')));
      const phaseAt = () => page.evaluate(readRepresentativeBattlePhase);
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
         if(s25FireComparison){
           const {updatedAt:baselineUpdatedAt,...baselineOpening}=baseline.openingSave;
           const {updatedAt:comparisonUpdatedAt,...comparisonOpening}=row.openingSave;
           assert.deepEqual(comparisonOpening,baselineOpening,'same actual opening save except its production wall timestamp');
           row.inputComparison.openingSaveMatch={equalExcept:['updatedAt'],baselineUpdatedAt,comparisonUpdatedAt};
         }
        clip = await page.locator('.game-shell canvas').evaluateHandle(startNativeCanvasClip, { engine, metadata: {
          fixtureGroup: 'representative-normal-budget', stageNumber: number, phase: 'opening', form: 'whole-battle' } });
        const started = Date.now(); let lastSnapshotTime = -Infinity;
        while (Date.now() - started < V177_REPRESENTATIVE_WINDOW_MS) {
          const phase = await phaseAt();
          if (phase === 'result') break;
          assert.equal(phase, 'battle');
          await normalTacticalInput(page, row, { frameOwner,s25DeploymentObservation:s25Observe&&number===25,s25FireComparison,observeFrameChunk:chunk=>frameCapture.record(chunk),observeSnapshot(snapshot) {
            if(s25Observe&&number===25)recordS25DeploymentObservation(row,snapshot);
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
        const end = await page.evaluate(owner => {
          const phase=document.querySelector('.v100-shell')?.dataset.v100Phase;
          if(phase!=='battle'&&phase!=='result')throw new Error('Missing actual final representative phase');
          const live=phase==='battle'?window.__ASHFALL_BATTLE_QA__?.getSnapshot?.():null;
          return{phase,save:JSON.parse(localStorage.getItem('nishijin-campaign-v100')),
            finalBattle:live?{stageId:live.stageId,running:live.running,over:live.over,baseHp:live.baseHp}:null,
            frames:globalThis.__V177_READ_NORMAL_FRAMES__?.(owner,'stop')??null};
        },frameOwner);
        await frameCapture.record(end.frames);row.framePerformance=await frameCapture.finish();
        row.finalSave = end.save;
        row.finalBattle=end.finalBattle;
        if (end.phase === 'result') row.outcome = (row.finalSave.pendingResult ?? row.finalSave.lastResult)?.won ? 'won' : 'lost';
        else row.outcome = 'observed-window';
        if (clip) await finishClip(false);
        await page.screenshot({ path: path.join(out, `s${number}-observation-end.png`) });
      } catch (error) { row.status = 'failed'; row.error = String(rpc.failure??error); await normalCleanupWithin(()=>rawPage.screenshot({ path: path.join(out, `s${number}-failure.png`) }),'representative failure screenshot',{timeoutMs:30_000}).catch(() => {}); }
      finally {
        if(rpc.failure)row.operationTimeout=normalProtocolTimeoutReceipt(rpc.failure);
        row.framePerformance??=await finishNormalFrameCapture(rawPage,frameCapture,frameOwner).catch(error=>({status:'incomplete',error:String(error),performanceAcceptance:false}));
        if (clip) await finishClip(false).catch(error => { row.captureError = String(error); row.status = 'failed'; });
        try { row.finalSave ??= await normalCleanupWithin(()=>rawPage.evaluate(()=>JSON.parse(localStorage.getItem('nishijin-campaign-v100'))),'representative final save',{timeoutMs:30_000}); await normalCleanupWithin(()=>context.storageState({ path: path.join(out, `s${number}-browser-storage.json`), indexedDB: true }),'representative storage',{timeoutMs:30_000}); }
        catch (error) { row.saveCaptureError = String(error); row.status = 'failed'; }
        try { await normalCleanupWithin(closeOwnedContext,'representative context'); row.video = await normalCleanupWithin(()=>video.path(),'representative video'); row.videoBytes = (await stat(row.video)).size; }
        catch (error) { row.videoCaptureError = String(error); row.status = 'failed'; }
        if (row.status !== 'failed') {
          try {
            if(s25Observe&&number===25)assert.ok(row.s25DeploymentObservations?.length>0,'retain actual card state and cooldown observations');
            if(s25FireComparison)for(const kind of ['gunner','brute','zakimiya']){
              assert.ok(row.inputs.some(input=>input.action==='deploy'&&input.kind===kind),'retain the actual UI request '+kind);
              assert.ok(row.s25ObservedHumans.some(actor=>actor.kind===kind),'comparison not exercised: no actual human ID '+kind);
            }
            row.acceptance = assertRepresentativeBattleObservation(row); row.status = 'observed';
          }
          catch (error) { row.status = 'failed'; row.error = String(error); }
        }
        await persist();
      }
    }
  } catch(error){outerFailure=error;report.error=String(error);}
  finally { try{await normalCleanupWithin(()=>browser.close(),'representative browser');}catch(error){outerFailure??=error;report.browserCloseError=String(error);report.error??=String(error);} }
  report.status = !outerFailure&&report.cases.length === 1 && report.cases.every(row => row.status === 'observed') ? 'observed' : 'failed';
  await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ head, engine, status: report.status, outcomes: report.cases.map(row => ({ number: row.number, outcome: row.outcome, status: row.status })) }));
  normalPlayChildCompletion(report);
  if (report.status === 'failed') process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
