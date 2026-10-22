import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {MANUAL_ABILITY_REGISTRY,createManualAbilityRuntime,beginManualAbility,advanceManualAbility} from '../app/manualAbilities.js';
import {RUNTIME_SIMULATION_STEP_SECONDS as STEP} from '../app/renderPerformance.js';
import {SHARDS,VIEWPORTS,LIMITS,planShard} from '../scripts/v177-native-allunit-manifest.mjs';
import {planRangerManualShard,rangerManualEnvelopeReference,assertRangerManualPlan,assertRangerManualCapture,
 RANGER_MANUAL_PHASE,RANGER_MANUAL_GROUP} from '../scripts/v177-native-allunit-ranger-manual-contract.mjs';
import {createNativeRangerManualReader,startNativeRangerManualObservation,stopNativeRangerManualObservation,captureNativeRangerManualCase} from '../scripts/v177-native-allunit-ranger-manual.mjs';
import {beginV177NativeCanvasClip} from '../scripts/v177-native-canvas-clips.mjs';

const manualPlan=()=>SHARDS.flatMap(s=>planRangerManualShard(s.id));

test('manual RAF projection uses the exact five full-snapshot fields without building unused campaign and fighter histories',()=>{
 const text=fs.readFileSync('app/AshfallGame.tsx','utf8'),tree=ts.createSourceFile('App.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),methods=new Map();
 function visit(n){if(ts.isPropertyAssignment(n)&&['getSnapshot','getNativeRangerManualSnapshot'].includes(n.name.getText(tree)))methods.set(n.name.getText(tree),n.initializer);ts.forEachChild(n,visit);}visit(tree);
 const returns=method=>{let result;function walk(n){if(ts.isReturnStatement(n)&&ts.isObjectLiteralExpression(n.expression)&&n.expression.properties.some(p=>p.name?.getText(tree)==='v100SkillContacts'))result=n.expression;ts.forEachChild(n,walk);}walk(method);assert.ok(result);return new Map(result.properties.filter(ts.isPropertyAssignment).map(p=>[p.name.getText(tree),p.initializer.getText(tree).replace(/\s+/g,'')]));};
 const full=returns(methods.get('getSnapshot')),projection=returns(methods.get('getNativeRangerManualSnapshot'));
 assert.deepEqual([...projection.keys()],['time','running','paused','v100SkillContacts','v100ManualMuzzles']);for(const[k,value]of projection)assert.equal(value,full.get(k),k+' changed source');
 assert.ok(!methods.get('getNativeRangerManualSnapshot').getText(tree).includes('sampleAnimationClip'));
});
// Execute the ACTUAL App postdraw block, rather than duplicating its ABI in a
// synthetic descriptor. VM mocks provide already-successful draw inputs only.
const actualAppText=fs.readFileSync('app/AshfallGame.tsx','utf8');
const actualAppAst=ts.createSourceFile('App.tsx',actualAppText,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let actualPostdrawBlock;
(function walk(n){if(ts.isIfStatement(n)&&n.expression.getText(actualAppAst)==="renderKind==='ranger'"
 &&n.thenStatement.getText(actualAppAst).includes('jointRangerManual'))actualPostdrawBlock=n.thenStatement;ts.forEachChild(n,walk);})(actualAppAst);
assert.ok(actualPostdrawBlock,'Actual Ranger postdraw ABI must exist');
const postdrawText=ts.transpileModule('function inspect(){'+actualPostdrawBlock.getText(actualAppAst)+';return audit;}',
 {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const postdrawContext=vm.createContext({MANUAL_ABILITY_REGISTRY});
postdrawContext.v177RenderedWeightedLowerReceipt=()=>postdrawContext.lower;
const inspectPostdraw=vm.runInContext(postdrawText+';inspect',postdrawContext);
function actualManualDescriptor(runtime,paint,sourceAtlas){
 postdrawContext.audit={jointDrawSucceeded:true};postdrawContext.lower=paint.jointWeightedLower;
 postdrawContext.f={id:4,kind:'ranger',side:'human',hp:82,manualAbility:runtime};
 const clockElapsed=runtime.phase==='windup'?.5-runtime.windupRemaining:runtime.abilityElapsed;
 postdrawContext.jointPose={rangerManualJoint:{activationId:runtime.activationId,clockElapsed,
  presentationPhase:runtime.phase==='windup'?'aim':clockElapsed-.5<=.18/3?'recoil':'return'}};
 postdrawContext.jointAtlas={path:sourceAtlas};postdrawContext.options={world:{time:paint.jointPaintedAt}};
 const result=JSON.parse(JSON.stringify(inspectPostdraw()));assert.equal(result.jointRangerManualDrawSucceeded,true);
 return result.jointRangerManual;
}
function fixture(viewport=VIEWPORTS[1],{startAt=10,accumulateClock=false}={}){
 const planned=manualPlan().find(r=>r.viewport.width===viewport.width&&r.viewport.height===viewport.height),row={...planned,samples:[]};
 const stats={speed:38,laneSpeed:62,damage:15,range:138,attackEvery:1.15,hp:82,maxHp:82};
 row.proof={schema:'v177-native-shard-proof/v1',proofId:'2:ranger:4:engage',route:'/v100',battleGeneration:2,owner:'ordinary',phase:'engage',
  fighterId:4,targetId:5,kind:'ranger',side:'human',renderKind:'ranger',v100TwinPart:null,legacyFusedFixture:false,originalActorStats:stats,ownerEvidence:{constructorFixture:true}};
 row.baselineActivationId=0;row.sequenceBaseline=1;row.boundary={simulationTime:startAt};row.release={at:1000,afterTime:startAt};row.recordingStart={startedAt:990};
 row.recordingMetadata={phase:RANGER_MANUAL_PHASE,fixtureGroup:RANGER_MANUAL_GROUP,baselineActivationId:0};
 const target={targetId:5,targetIds:[5],direction:1,x:500,y:285};
 const initial=createManualAbilityRuntime('ranger'),begun=beginManualAbility(initial,target);assert.equal(begun.ok,true);
 const start={ownerId:4,activationId:begun.activationId,kind:'ranger',eventType:'start',at:startAt,attackSequence:0};
 const fighter={...stats,id:4,kind:'ranger',side:'human',renderKind:'ranger',v100TwinPart:null,x:330,y:285,attackSequence:0};
 row.beforeInput={simulationTime:startAt,at:1001,fighter,manualRuntime:initial};
 row.afterInput={simulationTime:startAt,at:1004,phaseG:{manualAbilityReceipts:[start]}};
 let runtime=begun.runtime,impact=null,time=startAt;const receipts=[start],rows=[];
 for(let i=1;i<=240;i++){
  const stepped=advanceManualAbility(runtime,STEP);runtime=stepped.runtime;time=accumulateClock?time+STEP:startAt+i*STEP;
  for(const event of stepped.events){const r={ownerId:4,activationId:event.activationId,kind:event.kind,eventType:event.type,at:time};receipts.push(r);if(event.type==='impact')impact=r;}
  const paint={renderSequence:i+1,renderKind:'ranger',jointDrawSucceeded:true,jointPaintedAt:time,jointAtlasPath:row.binding.atlas.path,
   assetReady:true,renderWidth:60,renderHeight:90,x:330,y:285,poseScaleX:1,poseScaleY:1,jointLowerFrame:0,jointUpperFrame:0,
   requestedState:runtime.phase==='windup'?'wind-up':runtime.phase==='recovery'?'recovery':'idle',actualXDelta:0,renderedWeaponSocket:{x:355,y:259},
   jointWeightedLowerDrawSucceeded:true,jointWeightedLower:{mode:'continuous-weighted-mesh',parts:5,meshVertices:130,meshTriangles:192,coverageSamples:4,degenerate:0,duplicateWithinPart:0},
   jointRangerManualDrawSucceeded:false,jointRangerManual:null};
  if(['windup','recovery'].includes(runtime.phase)){
   paint.jointRangerManualDrawSucceeded=true;paint.jointRangerManual=actualManualDescriptor(runtime,paint,row.binding.atlas.path);
  }
  const contacts=impact&&time-impact.at<.2?[{ownerId:4,kind:'ranger',activationId:begun.activationId,targetId:5,shotIndex:0,hpBefore:1_000_000,hpAfter:999_908,startedAt:impact.at,duration:.2,x:500,y:255,direction:1}]:[];
  const muzzles=impact&&time-impact.at<.1?[{ownerId:4,kind:'ranger',activationId:begun.activationId,shotIndex:0,startedAt:impact.at,x:355,y:259,tx:500,ty:255}]:[];
  rows.push({at:1020+i*1000*STEP,timeOrigin:88+(i%2),simulationTime:time,route:'/v100',visible:true,running:true,paused:false,viewport,
   lookup:{requestedFighterId:4,observedFighterId:4,requestedTargetId:5,observedTargetId:5},battleGeneration:2,historyOverflow:false,
   fighter:structuredClone(fighter),target:{id:5,kind:'walker',side:'zombie',speed:0,laneSpeed:0,damage:0,maxHp:1_000_000,hp:impact?999_908:1_000_000},
   manualRuntime:structuredClone(runtime),phaseG:{manualAbilityReceipts:structuredClone(receipts)},skillContacts:contacts,manualMuzzles:muzzles,
   renders:[paint],latestPaint:paint,renderSequence:paint.renderSequence,renderKind:'ranger'});
 }
 row.sourceRaf={failure:null,overflow:false,historyOverflow:false,rows,pointer:{overflow:false,events:['pointerdown','pointerup','click'].map(type=>({type,isTrusted:true,fighterId:4,kind:'ranger',at:1003}))}};
 return row;
}
test('supplement plans exactly3 viewport rows in the Ranger shard and never alter432 normal rows',()=>{
 const before=SHARDS.flatMap(s=>planShard(s.id)),bytes=JSON.stringify(before),rows=manualPlan();assert.equal(before.length,432);assert.equal(rows.length,3);
 assert.equal(new Set(rows.map(r=>r.shardId)).size,1);assert.deepEqual(rows.map(r=>r.viewport),VIEWPORTS);
 for(const row of rows){assertRangerManualPlan(row);const reference=rangerManualEnvelopeReference(row);assert.equal(reference.phase,'engage');assert.notEqual(row.caseId,reference.caseId);assert.equal(reference.form,'ranger');}
 assert.equal(JSON.stringify(SHARDS.flatMap(s=>planShard(s.id))),bytes);
 assert.throws(()=>planRangerManualShard('forms-13'));assert.throws(()=>assertRangerManualPlan({...rows[0],phase:'engage'}));
});
test('actual original manual state machine supplies.5/.18/92 and all three visual phases in3sizes',()=>{
 for(const viewport of VIEWPORTS){const row=fixture(viewport),r=assertRangerManualCapture(row);assert.equal(r.appliedDamage,MANUAL_ABILITY_REGISTRY.ranger.impactDamage);assert.equal(r.originalSimulationStepSeconds,STEP);assert.equal(r.normalEngageAccepted,false);assert.equal(r.wholeGameAccepted,false);}
});

test('original31-tick windup accepts accumulated clock roundoff and still rejects real timing changes',()=>{
 // Exact start/impact numbers from run39525887343, forms-1, Ranger desktop.
 const row=fixture(VIEWPORTS[0],{startAt:.2833333333333333,accumulateClock:true});
 const receipt=assertRangerManualCapture(row);
 assert.equal(receipt.originalStart.at,.2833333333333333);
 assert.equal(receipt.originalImpact.at,.8000000000000008);
 assert.ok(receipt.originalImpact.at-receipt.originalStart.at-.5>STEP,'Reproduces the original floating-point rejection');
 for(const elapsed of [28*STEP,32*STEP,31*STEP+.000001,30.5*STEP]){
  const changed=structuredClone(row),at=receipt.originalStart.at+elapsed;
  for(const raw of changed.sourceRaf.rows)for(const r of raw.phaseG.manualAbilityReceipts)if(r.eventType==='impact')r.at=at;
  assert.throws(()=>assertRangerManualCapture(changed),/Original .5s windup changed/u);
 }
});

test('the existing fixed-tick set survives31 repeated additions at the de29 clock scale without a wider time window',()=>{
 for(const startAt of [10,16,32,100]){
  const row=fixture(VIEWPORTS[0],{startAt,accumulateClock:true}),receipt=assertRangerManualCapture(row);
  let expected=startAt;for(let tick=0;tick<31;tick++)expected+=STEP;
  assert.equal(receipt.originalImpact.at,expected);
  for(const ticks of [29,30,31])for(const accumulated of [false,true]){
   const changed=structuredClone(row);let at=startAt;
   if(accumulated)for(let tick=0;tick<ticks;tick++)at+=STEP;else at=startAt+ticks*STEP;
   for(const raw of changed.sourceRaf.rows)for(const r of raw.phaseG.manualAbilityReceipts)if(r.eventType==='impact')r.at=at;
   for(const raw of changed.sourceRaf.rows){for(const c of raw.skillContacts)c.startedAt=at;for(const m of raw.manualMuzzles)m.startedAt=at;}
   assert.doesNotThrow(()=>assertRangerManualCapture(changed));
  }
  for(const at of [expected+1e-12,expected-1e-12,startAt+28*STEP,startAt+32*STEP,startAt+30.5*STEP]){
   const changed=structuredClone(row);
   for(const raw of changed.sourceRaf.rows)for(const r of raw.phaseG.manualAbilityReceipts)if(r.eventType==='impact')r.at=at;
   assert.throws(()=>assertRangerManualCapture(changed),/Original .5s windup changed/u);
  }
 }
});
const faults={
 windupRecoveryMustRemainNull:r=>r.sourceRaf.rows[3].latestPaint.jointRangerManual.recoveryRemaining=0,
 recoveryClockMustRemainFinite:r=>r.sourceRaf.rows.find(x=>x.manualRuntime.phase==='recovery').latestPaint.jointRangerManual.recoveryRemaining=null,
 frameBound:r=>r.sourceRaf.rows=Array(4097).fill(r.sourceRaf.rows[0]),
 historyBound:r=>r.sourceRaf.rows[3].renders=Array(129).fill(r.sourceRaf.rows[3].latestPaint),
 earlyFallback:r=>{const p=r.sourceRaf.rows[0].latestPaint;p.jointRangerManualDrawSucceeded=false;p.jointRangerManual=null;},
 syntheticPointer:r=>r.sourceRaf.pointer.events.push({type:'click',isTrusted:false,fighterId:4,kind:'ranger',at:1003}),
 badRecoveryClock:r=>r.sourceRaf.rows.forEach(x=>{if(x.manualRuntime.phase==='cooldown')x.manualRuntime.abilityElapsed=.1;}),
 missingStart:r=>r.afterInput.phaseG.manualAbilityReceipts=[],wrongActivation:r=>r.afterInput.phaseG.manualAbilityReceipts[0].activationId++,
 untrusted:r=>r.sourceRaf.pointer.events[0].isTrusted=false,wrongActor:r=>r.sourceRaf.rows[3].lookup.observedFighterId=44,
 changedStat:r=>r.sourceRaf.rows[3].fighter.speed++,changedHp:r=>r.sourceRaf.rows[3].fighter.hp--,
 clockBack:r=>r.sourceRaf.rows[3].simulationTime=0,rawOverflow:r=>r.sourceRaf.overflow=true,
 missingContact:r=>r.sourceRaf.rows.forEach(x=>x.skillContacts=[]),borrowedContact:r=>r.sourceRaf.rows.forEach(x=>x.skillContacts.forEach(c=>c.ownerId=44)),
 wrongDamage:r=>r.sourceRaf.rows.forEach(x=>x.skillContacts.forEach(c=>c.hpAfter--)),missingMuzzle:r=>r.sourceRaf.rows.forEach(x=>x.manualMuzzles=[]),
 unresolvedMuzzle:r=>r.sourceRaf.rows.forEach(x=>x.manualMuzzles.forEach(m=>m.x=null)),
 noRecoil:r=>r.sourceRaf.rows.forEach(x=>{if(x.latestPaint.jointRangerManual?.presentationPhase==='recoil')x.latestPaint.jointRangerManualDrawSucceeded=false;}),
 missingReturn:r=>r.sourceRaf.rows.forEach(x=>{if(x.latestPaint.jointRangerManual?.presentationPhase==='return')x.latestPaint.jointRangerManualDrawSucceeded=false;}),
 fallbackHole:r=>{const p=r.sourceRaf.rows[3].latestPaint;p.jointRangerManualDrawSucceeded=false;p.jointRangerManual=null;},
 wrongClock:r=>r.sourceRaf.rows[3].latestPaint.jointRangerManual.clockElapsed+=.2,
 wrongAtlas:r=>r.sourceRaf.rows[3].latestPaint.jointRangerManual.sourceAtlas='/borrowed.webp',
 missingWeighted:r=>r.sourceRaf.rows[3].latestPaint.jointWeightedLowerDrawSucceeded=false,
 wrongLower:r=>r.sourceRaf.rows[3].latestPaint.jointWeightedLower.meshVertices=65,
 changedAim:r=>r.sourceRaf.rows[3].latestPaint.jointRangerManual.lockedAim.x++,
 stalePaint:r=>r.sourceRaf.rows[3].latestPaint.jointPaintedAt=0,
 noCooldown:r=>r.sourceRaf.rows=r.sourceRaf.rows.slice(0,36)};
for(const [name,mutate]of Object.entries(faults))test('manual evidence rejects '+name,()=>{const row=fixture();mutate(row);assert.throws(()=>assertRangerManualCapture(row));});

function metadata(){const r=manualPlan()[0];return{form:'ranger',requestedKind:'ranger',preparedRenderKind:'ranger',manualAbilityKind:'ranger',constructorPhase:'engage',owner:r.owner,
 phase:r.phase,fixtureGroup:RANGER_MANUAL_GROUP,fighterId:4,targetId:5,baselineActivationId:0,battleGeneration:2,proofId:'2:ranger:4:engage',caseId:r.caseId,referenceCaseId:r.referenceCaseId,diagnosticOnly:true,controlledOpponent:true,legacyFusedFixture:false};}
test('recorder admits only dedicated actual Ranger manual metadata without a guessed activation',async()=>{
 let admitted=0;const page={locator:()=>({evaluateHandle:async()=>{admitted++;throw Error('fake recorder admission only');}})};
 await beginV177NativeCanvasClip(page,metadata(),{directory:'unused',engine:'webkit',requestedMimeType:'video/webm;codecs=vp8'});assert.equal(admitted,1);
 for(const change of [{form:'medic'},{requestedKind:'medic'},{phase:'engage'},{fixtureGroup:'approach-to-attack'},{fixtureGroup:'authored-form'},
  {manualAbilityKind:'medic'},{baselineActivationId:-1},{activationId:1},{constructorPhase:'attack'},{controlledOpponent:false},{diagnosticOnly:false},{targetId:4},{referenceCaseId:'borrowed'}]){
  const prior=admitted;await assert.rejects(beginV177NativeCanvasClip(page,{...metadata(),...change},{directory:'unused',engine:'webkit'}));assert.equal(admitted,prior);
 }
});
test('raw reader and RAF preserve actual false/absent manual flags, origins and unfiltered new paint history',()=>{
 const raw=fixture().sourceRaf.rows[0],listeners=new Map(),queue=new Map();let next=0,seq=1,clock=1,history=[{...raw.latestPaint,jointRangerManualDrawSucceeded:false,jointRangerManual:null}],current=raw;
 const canvas={getBoundingClientRect:()=>({x:0,y:0,width:844,height:390}),width:844,height:390};
 const doc={visibilityState:'visible',querySelector:()=>canvas,addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:type=>listeners.delete(type)};
 const perf={now:()=>clock,timeOrigin:88},window={};
 const owner={check:refs=>{assert.equal(refs.window,window);assert.equal(refs.document,doc);assert.equal(refs.performance,perf);assert.equal(refs.canvas,canvas);},
  member(refs,member){this.check(refs);return{schema:'v177-native-realm-member/v1',ownerId:'00000000-0000-4000-8000-000000000001',createdAt:0,rawOriginAtCreation:88,sequence:seq++,member};}};
 const qa={getNativeRangerManualSnapshot:()=>({time:current.simulationTime,running:true,paused:false,v100SkillContacts:current.skillContacts,v100ManualMuzzles:current.manualMuzzles}),
  getPhaseGCombatSnapshot:()=>({screen:'battle',stageId:'stage',time:current.simulationTime,battleGeneration:2,fighters:[{id:4,manualAbility:current.manualRuntime}],manualAbilityReceipts:current.phaseG.manualAbilityReceipts,completedAttackImpacts:[]}),
  getEnemyFacingRuntimeAudit:id=>id===4?{fighter:current.fighter,renderHistory:history}:{fighter:current.target},getPerformanceSnapshot:()=>({})};
 window.__ASHFALL_BATTLE_QA__=qa;
 const clonedHistorySizes=[];
 const clone=value=>{if(Array.isArray(value)&&value.some(row=>row?.renderSequence!==undefined))clonedHistorySizes.push(value.length);return structuredClone(value);};
 const context={window,document:doc,performance:perf,location:{pathname:'/v100'},innerWidth:844,innerHeight:390,devicePixelRatio:1,structuredClone:clone,
  proof:fixture().proof,realmOwner:owner,requestAnimationFrame:fn=>{queue.set(++next,fn);return next;},cancelAnimationFrame:id=>queue.delete(id)};
 const reader=vm.runInNewContext('('+createNativeRangerManualReader.toString()+')({proof,realmOwner})',context);context.reader=reader;
 const state=vm.runInNewContext('('+startNativeRangerManualObservation.toString()+')({reader})',context);
 const tick=()=>{const [id,fn]=queue.entries().next().value;queue.delete(id);fn();};tick();assert.equal(state.rows[0].renders[0].jointRangerManualDrawSucceeded,false);
 clock=2;perf.timeOrigin=89;history=[...history,{...history[0],renderSequence:history[0].renderSequence+1,jointRangerManualDrawSucceeded:undefined}];tick();
 assert.equal(state.rows[1].timeOrigin,89);assert.equal(state.rows[1].renders.length,1);assert.equal(state.rows[1].renders[0].jointRangerManualDrawSucceeded,undefined);
 assert.equal(clonedHistorySizes.at(-1),1,'Already retained heavy paint plans must not be cloned again on every RAF');
 assert.equal(state.rows[1].historyWindow.previousSequenceFound,true);
 const receipt=stopNativeRangerManualObservation(state);assert.equal(receipt.rows.length,2);assert.equal(receipt.failure,null);assert.equal(listeners.size,0);assert.equal(queue.size,0);
 const bounded=vm.runInNewContext('('+startNativeRangerManualObservation.toString()+')({reader})',context);bounded.rows.length=4096;tick();
 const overflow=stopNativeRangerManualObservation(bounded);assert.equal(overflow.overflow,true);assert.match(overflow.failure,/4096/u);
 doc.querySelector=()=>({});assert.throws(()=>reader.read());
});
test('driver source retains separate manual plan/results/missing list, strict limits and original controls',()=>{
 const source=fs.readFileSync(new URL('../scripts/v177-native-allunit-browser.mjs',import.meta.url),'utf8'),capture=fs.readFileSync(new URL('../scripts/v177-native-allunit-ranger-manual.mjs',import.meta.url),'utf8');
 assert.match(source,/manualPlan,manualCases:\[\]/u);assert.match(source,/report\.manualUnexecuted/u);assert.match(source,/observed-manual-diagnostic/u);
 assert.match(source,/for\(const planned of rows\)/u);assert.match(capture,/clip\.waitForStart/u);assert.match(capture,/releasePreparedShardClock/u);assert.match(capture,/manualMarkerDispatchStarted/u);
 assert.doesNotMatch(capture,/setManualAbility|restoreManualAbility|advanceManualAbility|setEnemyVfxProofTime|\beval\s*\(|new Function/u);
 assert.equal(LIMITS.caseMs,30000);assert.equal(LIMITS.readinessMs,5000);assert.equal(LIMITS.clipMs,15000);assert.equal(LIMITS.clipStopMs,3000);assert.equal(LIMITS.clipBytes,8*1024*1024);
});

function captureFaultFixture({tapFailure=null,late=false,secondaryCleanup=false}={}){
 const row=fixture();row.sourceRaf=undefined;row.status='starting-manual';row.samples=[];
 const calls={clipFinish:[],observationStop:0,readerDispose:0,ownerDispose:0,observationDispose:0,pause:0},failures=[];
 let sequence=0,reads=0,paused=true;
 const member=name=>({schema:'v177-native-realm-member/v1',ownerId:'00000000-0000-4000-8000-000000000001',createdAt:800,rawOriginAtCreation:88,sequence:++sequence,member:name});
 const initial=fixture().sourceRaf.rows[0],basePaint={...initial.latestPaint,renderSequence:1,jointPaintedAt:10,jointRangerManualDrawSucceeded:false,jointRangerManual:null};
 const raw=()=>{reads++;return {...structuredClone(initial),schema:'v177-native-shard-postpaint/v1',at:1010+reads*10,simulationTime:10,paused,realm:member('sample'),
  manualRuntime:createManualAbilityRuntime('ranger'),phaseG:{screen:'battle',stageId:'stage',time:10,battleGeneration:2,
   fighters:[{id:4,manualAbility:createManualAbilityRuntime('ranger')}],manualAbilityReceipts:[]},renders:[basePaint],latestPaint:basePaint};};
 const ownerHandle={async evaluate(fn){if(fn.name==='readNativeAllUnitRealmOwner')return member('owner-created');
  assert.equal(fn.name,'releasePreparedShardClock');paused=false;return{at:1041,timeOrigin:88,realm:member('release'),beforePaused:true,afterPaused:false,beforeTime:10,afterTime:10};},async dispose(){calls.ownerDispose++;}};
 const readerHandle={async evaluate(){return raw();},async dispose(){calls.readerDispose++;if(secondaryCleanup)throw Error('secondary reader dispose');}};
 const observerHandle={async evaluate(fn){assert.equal(fn.name,'stopNativeRangerManualObservation');calls.observationStop++;return{failure:null,rows:[]};},async dispose(){calls.observationDispose++;}};
 const button={async waitFor(){}};
 const page={isClosed:()=>false,mouse:{async move(){},async down(){},async up(){}},locator:()=>button,async waitForFunction(){},async waitForTimeout(){throw Error('Failed input must never reach sampling');},
  async evaluate(fn){if(String(fn).includes('prepareV177ContinuousActorProof'))return row.proof;calls.pause++;if(secondaryCleanup)throw Error('secondary pause');},
  async evaluateHandle(fn){if(fn.name==='createNativeAllUnitRealmOwner')return ownerHandle;if(fn.name==='createNativeRangerManualReader')return readerHandle;
   assert.equal(fn.name,'startNativeRangerManualObservation');member('raf-start');return observerHandle;}};
 const begin=async()=>{member('recorder-create');return{async waitForStart(){return{startedAt:1020,timeOrigin:88,realm:member('recorder-start')};},
  async finish({completed}){calls.clipFinish.push(completed);return{status:'invalid',completed,bytes:3,sha256:'a'.repeat(64),errors:['Sampling window interrupted'],originalBytesRetained:true};}};};
 const tap=async()=>{if(tapFailure)throw tapFailure;if(late)row.deadlineExpired=true;return true;};
 return{row,page,calls,failures,deps:{out:'unused-fake-output',begin,tap,onFailure:error=>failures.push(error)}};
}
test('capture keeps original native input Error identity and partial bytes through secondary cleanup failures',async()=>{
 const original=new Error('original native pointer failure'),f=captureFaultFixture({tapFailure:original,secondaryCleanup:true});
 await assert.rejects(captureNativeRangerManualCase(f.page,f.row,f.deps),e=>e===original);
 assert.deepEqual(f.failures,[original]);assert.deepEqual(f.calls.clipFinish,[false]);assert.equal(f.row.interruptedClip.originalBytesRetained,true);
 assert.equal(f.calls.observationStop,1);assert.equal(f.calls.observationDispose,1);assert.equal(f.calls.readerDispose,1);assert.equal(f.calls.ownerDispose,1);
 assert.equal(f.row.cleanupErrors.length,2);assert.equal(f.row.manualReceipt,undefined);assert.notEqual(f.row.status,'observed-manual-diagnostic');
});
test('late native input resolution cannot promote an expired manual row and still retains interrupted clip',async()=>{
 const f=captureFaultFixture({late:true});await assert.rejects(captureNativeRangerManualCase(f.page,f.row,f.deps),/Late manual capture/u);
 assert.equal(f.row.deadlineExpired,true);assert.deepEqual(f.calls.clipFinish,[false]);assert.equal(f.row.interruptedClip.originalBytesRetained,true);assert.equal(f.row.manualReceipt,undefined);
});
test('missing actual input/start never becomes manual or normal success',async()=>{
 const f=captureFaultFixture({});await assert.rejects(captureNativeRangerManualCase(f.page,f.row,f.deps),/Actual same-activation original start receipt/u);
 assert.deepEqual(f.calls.clipFinish,[false]);assert.equal(f.row.manualReceipt,undefined);assert.notEqual(f.row.status,'observed-manual-diagnostic');
});

test('actual driver finalizer fails all missing/failed manual rows and never fills missing normal cases',()=>{
 const source=fs.readFileSync(new URL('../scripts/v177-native-allunit-browser.mjs',import.meta.url),'utf8');
 const from=source.indexOf('    report.unexecuted=plan.filter('),to=source.indexOf('    await persist();',from);assert.ok(from>=0&&to>from);const actual=source.slice(from,to);
 const manual=manualPlan(),plan=planShard(manual[0].shardId),base=()=>({errors:[],contexts:[{cleanup:'completed'}],cases:plan.map(p=>({...p,status:'observed-diagnostic'})),manualCases:[],outcomeCases:[]});
 const run=report=>{vm.runInNewContext(actual,{report,plan,manualPlan:manual,outcomePlan:[]});return report;};
 const missing=run(base());assert.equal(missing.status,'failed');assert.equal(missing.manualUnexecuted.length,3);assert.equal(missing.unexecuted.length,0);
 const complete=base();complete.manualCases=manual.map(p=>({...p,status:'observed-manual-diagnostic'}));assert.equal(run(complete).status,'completed-diagnostic');
 const failed=base();failed.manualCases=manual.map(p=>({...p,status:'failed'}));assert.equal(run(failed).status,'failed');
 const normalMissing=base();normalMissing.cases.pop();normalMissing.manualCases=manual.map(p=>({...p,status:'observed-manual-diagnostic'}));assert.equal(run(normalMissing).status,'failed');assert.equal(normalMissing.unexecuted.length,1);
});

test('actual App postdraw AST supplies null outside recovery and raw finite remaining during recovery',()=>{
 const row=fixture(),windup=row.sourceRaf.rows.find(r=>r.manualRuntime.phase==='windup'),recovery=row.sourceRaf.rows.find(r=>r.manualRuntime.phase==='recovery');
 assert.equal(windup.latestPaint.jointRangerManual.recoveryRemaining,null);
 assert.equal(recovery.latestPaint.jointRangerManual.recoveryRemaining,recovery.manualRuntime.windupRemaining);
 assert.ok(Number.isFinite(recovery.latestPaint.jointRangerManual.recoveryRemaining));
 assert.doesNotThrow(()=>assertRangerManualCapture(row));
});
