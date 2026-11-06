import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {runNormalPlayChild} from './v177-normal-browser-deadline.mjs';
import {createV177RepresentativeBudget} from './v177-representative-budget.mjs';

const prepareOnly=process.argv.includes('--prepare-only');
const out=path.resolve(process.env.V100_NORMAL_PLAY_EVIDENCE_DIR??'outputs/s14-native-once');
await mkdir(out,{recursive:true});
const auth=JSON.parse(await readFile('scripts/fixtures/s14-native-once-scope.json','utf8'));
assert.equal(auth.maxObservationSeconds,90);assert.equal(auth.maxObservationWindows,1);assert.equal(auth.featureBase,'38430c30a3a0aefd063d0233c49a87b42920b777');
if(!prepareOnly){assert.equal(process.platform,'darwin');assert.equal(process.arch,'x64');assert.equal(process.env.V100_NORMAL_PLAY_ENGINE,'webkit');assert.equal(process.env.GITHUB_RUN_ATTEMPT,'1');}
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const canonical=bytes=>bytes.toString().replaceAll('\r\n','\n');
const lower=canonical(await readFile('app/v177RangerLowerPaint.js'));
assert.equal(hash(lower),'8e08e78bf9b3f5a9453d7459bb31d259e74e8c8cf7ca9208980d40c54bee72a3');
const original=canonical(await readFile('scripts/v177-representative-battles.mjs'));
assert.equal(hash(original),'c0f508812a4d88e064ea6311bd6d6368cac506b7eb89e8f9a57209e14b2a9336');
const expected=JSON.parse(await readFile('scripts/fixtures/s14-native-once-opening.json','utf8'));
const fixture=createV177RepresentativeBudget(14);
for(const key of ['caps','ownedUnitIds','formationSlots','unitLevels','completedStageIds','vehicle'])assert.deepEqual(fixture.save[key],expected[key],key);
let generated=original;
const replace=(before,after)=>{assert.equal(generated.split(before).length,2,'Exactly one original diagnostic splice');generated=generated.replace(before,after);};
replace('for (const number of (s25FireComparison?[25]:[14, 25, 30])) {','for (const number of [14]) {');
replace('let context,requests,contextClose;','let context,requests,contextClose; let s14Timer=null;');
replace('await page.waitForFunction(() => globalThis.__ASHFALL_BATTLE_QA__?.getSnapshot?.()?.running === true);',`await page.waitForFunction(() => globalThis.__ASHFALL_BATTLE_QA__?.getSnapshot?.()?.running === true);
        const s14StartedAt=Date.now();row.s14DiagnosticWindow={startedAt:s14StartedAt,stopAt:s14StartedAt+90000,maxSeconds:90};
        s14Timer=setTimeout(()=>{row.s14DiagnosticWindow.limitReachedAt=Date.now();void normalCleanupWithin(closeOwnedContext,'S14 90-second stop').catch(error=>{row.s14DiagnosticStopError=String(error);});},90000);`);
replace('row.openingSave=opening.save;await frameCapture.record(opening.frames);',`row.openingSave=opening.save;await frameCapture.record(opening.frames);
         const expectedS14=JSON.parse(await readFile('scripts/fixtures/s14-native-once-opening.json','utf8'));
         const {updatedAt:actualUpdatedAt,...actualOpening}=row.openingSave;
         const {updatedAt:expectedUpdatedAt,...expectedOpening}=expectedS14;
         assert.deepEqual(actualOpening,expectedOpening,'Same failed opening save except production wall timestamp');
         row.s14OpeningMatch={equalExcept:['updatedAt'],actualUpdatedAt,expectedUpdatedAt};`);
replace('while (Date.now() - started < V177_REPRESENTATIVE_WINDOW_MS) {','while (Date.now() < row.s14DiagnosticWindow.stopAt) {');
replace('      finally {\n',`      finally {
        clearTimeout(s14Timer);if(row.s14DiagnosticWindow)row.s14DiagnosticWindow.endedAt=Date.now();
`);
// Original predicates, the 120-second normal qualification window, the
// three-case aggregate and all technical failures remain intact. This partial
// diagnostic is never a substitute for a successful normal-play CI job.
assert.ok(generated.includes('export const V177_REPRESENTATIVE_WINDOW_MS = 120_000;'));
assert.ok(generated.includes('report.cases.length === (s25FireComparison?1:3)'));
const file=prepareOnly?path.join(out,'generated-preview.mjs'):path.resolve('scripts/.v177-s14-native-once.mjs');
await writeFile(file,generated,{flag:'wx'});
execFileSync(process.execPath,['--check',file],{stdio:'pipe',windowsHide:true});
const prepared={prepareOnly,auth,sourceSha256:hash(original),generatedSha256:hash(generated),diagnosticLowerSha256:hash(lower),maxObservationSeconds:90,selectedStages:[14],originalQualificationPredicatesChanged:false,gameStarted:false};
await writeFile(path.join(out,'preflight.json'),JSON.stringify(prepared,null,2)+'\n',{flag:'wx'});
if(prepareOnly){console.log(JSON.stringify(prepared));}
else{
 await writeFile(path.join(out,'attempt-started.json'),JSON.stringify({at:new Date().toISOString(),pid:process.pid,auth},null,2)+'\n',{flag:'wx'});
 const code=await runNormalPlayChild(file);
 const report=JSON.parse(await readFile(path.join(out,'representative-battles/report.json'),'utf8'));
 assert.equal(report.cases.length,1);assert.equal(report.cases[0].number,14);
 const row=report.cases[0],marker='Ranger failed lower-pose inputs: ',message=row.errors.find(error=>error.includes(marker));
 const inputs=message?JSON.parse(message.slice(message.indexOf(marker)+marker.length)):null;
 const summary={status:inputs?'foot-error-reproduced':row.s14DiagnosticWindow?'not-reproduced-in-single-window':'setup-did-not-reach-observation',head:report.head,engine:report.engine,window:row.s14DiagnosticWindow??null,
  originalChildExitCode:code,originalCaseStatus:row.status,originalErrors:row.errors,footInputs:inputs,originalQualificationPredicatesChanged:false,wholeGameAccepted:false,additionalAttemptPermitted:false};
 await writeFile(path.join(out,'diagnostic-summary.json'),JSON.stringify(summary,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify(summary));process.exitCode=code??1;
}
