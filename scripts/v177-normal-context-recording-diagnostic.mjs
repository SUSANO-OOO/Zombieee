import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';

const [variant,option]=process.argv.slice(2);
assert.ok(['recorded','unrecorded'].includes(variant));
assert.ok(option===undefined||option==='--verify-only');
const verifyOnly=option==='--verify-only';
const productHead='d62d67615fb1d5e551528cde2a384cdae2018ef8';
const originalFile='scripts/v177-representative-battles.mjs';
const expectedSourceSha='597ac94e389904558d752ca5335206597b9e3f302b5d9bddbb53732185e3f196';
const sha=b=>createHash('sha256').update(b).digest('hex');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024}).trim();
const originalBytes=fs.readFileSync(originalFile);assert.equal(sha(originalBytes),expectedSourceSha);
const original=originalBytes.toString('utf8');assert.equal(original.includes('\r'),false);
const replaceOnce=(source,from,to)=>{assert.equal(source.split(from).length,2,'exact single source anchor');return source.replace(from,to);};
const anchors=[
 ['for (const number of (s25FireComparison?[25]:[14, 25, 30])) {','for (const number of [14]) {'],
 ['report.cases.length === (s25FireComparison?1:3)','report.cases.length === 1'],
];
let recorded=original;for(const [from,to]of anchors)recorded=replaceOnce(recorded,from,to);
const recordingProperty="recordVideo: { dir: path.join(out, 'videos'), size: report.viewport }";
const unrecorded=replaceOnce(recorded,recordingProperty,'');
assert.equal(unrecorded,recorded.replace(recordingProperty,''));
const generated=variant==='recorded'?recorded:unrecorded;
for(const token of ['V177_REPRESENTATIVE_WINDOW_MS = 120_000','Date.now() - started >= 10_000','page.waitForTimeout(300)',
 "row.video = await normalCleanupWithin(()=>video.path(),'representative video')",
 'row.videoCaptureError = String(error); row.status = \'failed\'','normalPlayChildCompletion(report)',
 "if (report.status === 'failed') process.exitCode = 1;"]){assert.equal(generated.split(token).length,original.split(token).length);}
assert.equal(generated.slice(0,generated.indexOf('async function main()')),original.slice(0,original.indexOf('async function main()')),'original per-case validator unchanged');
const out=path.resolve(process.env.V177_CONTEXT_RECORDING_OUT??'outputs/native-context-recording-control',variant);
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'generated-source.mjs'),generated,{flag:'wx'});
const ownedRoot=path.resolve('scripts'),temporary=path.resolve(ownedRoot,'.v177-context-recording-control-'+variant+'.mjs');
const supervisor=path.resolve(ownedRoot,'.v177-context-recording-control-'+variant+'-supervisor.mjs');
for(const file of [temporary,supervisor])assert.ok(file.startsWith(ownedRoot+path.sep));
const shim=[
 "import fs from 'node:fs';",
 "import {runNormalPlayChild} from './v177-normal-browser-deadline.mjs';",
 'export async function runBrowserQa(){',
 '  try{const code=await runNormalPlayChild('+JSON.stringify(temporary)+',{env:process.env});process.exitCode=code??1;}',
 '  catch(error){if(error.childExitTimeout)try{fs.writeFileSync('+JSON.stringify(path.join(out,'child-exit-timeout.json'))+',JSON.stringify(error.childExitTimeout,null,2)+"\\n",{flag:"wx"});}catch(persistenceError){error.childExitPersistenceError=String(persistenceError);}throw error;}',
 '}',
 '',
].join('\n');
fs.writeFileSync(path.join(out,'generated-supervisor-shim.mjs'),shim,{flag:'wx'});
const head=git('rev-parse','HEAD');
const manifest={schema:'v177-normal-context-recording-diagnostic/v1',at:new Date().toISOString(),head,productHead,variant,verifyOnly,
 originalSource:{file:originalFile,sha256:expectedSourceSha,bytes:originalBytes.length},generatedSourceSha256:sha(generated),
 commonSelectionChanges:anchors.map(([from,to])=>({from,to})),onlyVariantChange:recordingProperty,
 selectedStages:[14],originalWindowMs:120000,originalObserverAndPolicy:true,originalNativeOpeningRecorder:true,
 originalClocksDeadlinesThresholdsAndValidatorRetained:true,originalVideoCaptureErrorAndExitRetained:true,
 entrypoint:{sameFolderShim:true,generatedShimSha256:sha(shim),unchangedSupervisor:'scripts/v177-normal-browser-deadline.mjs',terminalExitDeadlinesUnchanged:true,childExitTimeoutSidecarRetained:true},
 normalAcceptance:false,formal33msAcceptance:false,originalSpeedAcceptance:false,wholeGameAcceptance:false,causalClaim:false};
const persist=()=>fs.writeFileSync(path.join(out,'diagnostic-manifest.json'),JSON.stringify(manifest,null,2)+'\n');persist();
if(!verifyOnly){
 assert.equal(process.platform,'darwin');assert.equal(process.env.GITHUB_ACTIONS,'true');
 assert.match(process.env.EXPECTED_HEAD??'',/^[a-f0-9]{40}$/u);assert.equal(head,process.env.EXPECTED_HEAD);
 const allowed=['.github/workflows/native-game-capture.yml','scripts/v177-normal-context-recording-diagnostic.mjs'];
 assert.deepEqual(git('diff','--name-only',productHead,head).split('\n').sort(),allowed);
 manifest.identicalProductTrees=Object.fromEntries(['app','public','assets'].map(dir=>{const expected=git('rev-parse',productHead+':'+dir),actual=git('rev-parse',head+':'+dir);assert.equal(actual,expected);return[dir,actual];}));
 for(const file of ['package.json','package-lock.json','scripts/pwa-native-runtime/package.json','scripts/pwa-native-runtime/package-lock.json'])assert.equal(git('rev-parse',head+':'+file),git('rev-parse',productHead+':'+file));
 for(const file of [temporary,supervisor])assert.equal(fs.existsSync(file),false);
 manifest.generatedRuntimeFile=temporary;manifest.generatedSupervisorFile=supervisor;persist();
 let child;
 const owned=new Map();
 try{
  for(const [file,source]of [[temporary,generated],[supervisor,shim]]){fs.writeFileSync(file,source,{flag:'wx'});owned.set(file,sha(source));}
  child=spawnSync(process.execPath,['scripts/run-browser-qa-with-server.mjs',supervisor],{stdio:'inherit',windowsHide:true,
   env:{...process.env,V100_NORMAL_PLAY_ENGINE:'webkit',V100_NORMAL_PLAY_EVIDENCE_DIR:out,V177_REPRESENTATIVE_INPUT_CASE:undefined,V177_S25_DEPLOY_OBSERVATION:undefined}});}
 finally{for(const [file,expected]of owned){assert.equal(sha(fs.readFileSync(file)),expected);fs.unlinkSync(file);}}
 manifest.child={status:child.status,signal:child.signal,error:child.error?String(child.error):null};
 const reportFile=path.join(out,'representative-battles','report.json');
 if(fs.existsSync(reportFile)){const reportBytes=fs.readFileSync(reportFile),report=JSON.parse(reportBytes);manifest.originalReport={file:reportFile,sha256:sha(reportBytes),bytes:reportBytes.length,status:report.status,cases:report.cases.map(r=>({number:r.number,status:r.status,outcome:r.outcome,videoCaptureError:r.videoCaptureError??null,wallElapsedMs:r.wallElapsedMs,framePerformance:r.framePerformance}))};}
 manifest.at=new Date().toISOString();persist();process.exitCode=Number.isInteger(child.status)?child.status:1;
}
console.log(JSON.stringify({variant,verifyOnly,originalSha256:expectedSourceSha,generatedSha256:sha(generated),normalAcceptance:false,childStatus:manifest.child?.status??null}));
