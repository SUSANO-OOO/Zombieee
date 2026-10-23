import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {planOutcomeShard,nativeOutcomeComplete,nativeOutcomeProgress,assertNativeOutcome,readNativeOutcomeSample} from '../scripts/v177-native-allunit-outcomes.mjs';
import {createNativeAllUnitRealmOwner,readNativeAllUnitRealmOwner} from '../scripts/v177-native-allunit-contract.mjs';
import {v177ControlledOutcomeHit} from '../app/v177ContinuousProof.js';
import {SHARDS} from '../scripts/v177-native-allunit-manifest.mjs';
import {beginV177NativeCanvasClip} from '../scripts/v177-native-canvas-clips.mjs';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {V177_JOINT_ATLASES} from '../app/v177JointPresentation.js';

test('outcome supplements cover every original form/view once, separately from432 normal cases',()=>{
  const plan=SHARDS.flatMap(s=>planOutcomeShard(s.id));
  assert.equal(plan.length,144);assert.equal(new Set(plan.map(p=>p.caseId)).size,144);
  assert.equal(new Set(plan.map(p=>p.form)).size,48);
  for(const row of plan){
    assert.equal(row.phase,'controlled-outcome');assert.equal(row.reference.phase,'engage');
    assert.equal(row.caseId.replace(':controlled-outcome:',':engage:'),row.referenceCaseId);
    assert.equal(row.owner,row.reference.owner);assert.deepEqual(row.binding,row.reference.binding);
    row.reference.preparationDiagnostic=true; // Special owner setup needs a mutable row, not a new identity.
  }
});

test('controlled damage queues the original lifecycle without rewriting actors, HP, form or clocks',()=>{
  const actor={id:1,side:'human',hp:68,maxHp:68,x:330,y:285,kind:'medic'},source={id:2,side:'zombie',x:500,y:285,kind:'walker'};
  const original=structuredClone({actor,source}),hit=v177ControlledOutcomeHit(actor,source);
  assert.equal(hit.remainingSeconds,.08);assert.equal(hit.impactDelaySeconds,.08);assert.equal(hit.damage,6801);
  assert.equal(hit.sourceId,2);assert.equal(hit.targetId,1);assert.equal(hit.applyDamage,true);
  assert.deepEqual({actor,source},original);
  for(const invalid of [{...actor,hp:0},{...actor,id:2},{...actor,side:'zombie'}])
    assert.throws(()=>v177ControlledOutcomeHit(invalid,source),/living original actor/u);
});

function fixture(){
  const row={...planOutcomeShard('forms-4').find(r=>r.form==='mayo-chan'&&r.viewport.height===340),engine:'webkit',samples:[]};
  let sequence=0;const realm=member=>({schema:'v177-native-realm-member/v1',ownerId:'aabbccdd-1234-4000-8000-123456789abc',createdAt:10,rawOriginAtCreation:1000000,sequence:++sequence,member});
  row.realmOwner=realm('owner-created');const rafStart=realm('raf-start'),created=realm('recorder-create'),started=realm('recorder-start');
  const stats={speed:68,laneSpeed:90,damage:20,range:24,attackEvery:.7,maxHp:100};
  const fighter={id:1,renderKind:row.form,hp:100,x:330,...stats};
  row.proof={fighterId:1,targetId:2,battleGeneration:7,originalActorStats:stats,route:'/v100'};
  row.outcome={schema:'v177-controlled-outcome/v1',fighterId:1,targetId:2,battleGeneration:7,form:row.form,hpBefore:100,maxHp:100,
    queuedAt:10,outcome:'retreat',incomingHit:{sourceId:2,targetId:1,damage:10001,remainingSeconds:.08},controlledIncomingDamage:true,manualClockAdvance:false};
  row.recordingMetadata={form:row.form,preparedRenderKind:row.form,phase:row.phase,fighterId:1,targetId:2,battleGeneration:7,proofId:'7:mayo-chan:1:engage',
    caseId:row.caseId,referenceCaseId:row.referenceCaseId,fixtureGroup:'controlled-incoming-outcome',diagnosticOnly:true,controlledIncomingDamage:true,
    manualClockAdvance:false,continuousUntilOutcome:true};
  row.recordingStart={startedAt:100,timeOrigin:1000000,realm:started};
  row.captureStart={realm:realm('sample'),at:101,timeOrigin:1000000,simulationTime:10,paused:true,battleGeneration:7,visible:true,running:true,route:'/v100',body:{fighter,renderHistory:[{
    renderSequence:1,renderKind:row.form,assetReady:true,jointDrawSucceeded:true,jointAtlasPath:V177_JOINT_ATLASES[row.form].path,
  }]}};
  row.sequenceBaseline=1;row.release={realm:realm('release'),at:102,beforeTime:10,afterTime:10,beforePaused:true,afterPaused:false};
  const states=['death','hit','retreat','retreat'];
  for(let i=0;i<4;i++)row.samples.push({realm:realm('sample'),at:110+i*120,timeOrigin:1000000,simulationTime:10.1+i*.12,battleGeneration:7,visible:true,running:true,paused:false,route:'/v100',
    body:{fighter:i===3?null:{...fighter,hp:1,x:330-i*10},corpse:null,renderHistory:[{renderSequence:i+2,renderKind:row.form,assetReady:true,requestedState:states[i],x:330-i*15}],corpseRenderHistory:[]},
    effects:{impacts:[],wounds:[],pools:[]},receipts:i===3?[{eventType:'retreat-complete'}]:[]});
  const bytes=Buffer.from('native bytes await independent decode');
  row.nativeClip={status:'recorded',engine:'webkit',originalSpeedAccepted:false,encodedPtsVerified:false,requestedMimeType:'video/webm;codecs=vp8',
    bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),metadata:row.recordingMetadata,timeOrigin:1000000,startedAt:100,stopRequestedAt:500,
    realm:{created,started,finished:realm('recorder-finish')}};
  row.sourceRaf={timeOrigin:1000000,realm:{started:rafStart,stopped:realm('raf-stop'),failure:null},overflow:false,
    rows:[{at:110,renderSequence:2,renderKind:row.form},{at:230,renderSequence:3,renderKind:row.form}]};
  row.captureEnd={realm:realm('sample'),battleGeneration:7,at:510,timeOrigin:1000000,visible:true,running:true,paused:false,route:'/v100'};return {row,bytes};
}

test('continuous outcome validates original bytes/realm and actual protected retreat without granting visual acceptance',()=>{
  const {row,bytes}=fixture(),result=assertNativeOutcome(row,bytes);
  assert.equal(nativeOutcomeComplete(row),true);assert.equal(result.continuousUntilOutcome,true);
  for(const key of ['naturalIncomingCombatAccepted','originalSpeedAccepted','naturalnessAccepted','all21Accepted'])assert.equal(result[key],false);
});

test('small outcome projections preserve the exact original stop predicate for every prefix of fall, settle and protected retreat',()=>{
 const {row}=fixture();const retreat=row.samples;
 const corpse=Array.from({length:8},(_,i)=>({body:{fighter:i<1?{id:1}:null,corpse:i<1?null:{id:1},
  renderHistory:i<1?[{renderSequence:1,requestedState:'idle'}]:[],
  corpseRenderHistory:i<1?[]:[{renderSequence:i+1,requestedState:i<5?'down':'death',fallProgress:i<5?i/5:1}]},receipts:[]}));
 for(const[outcome,samples]of[['retreat',retreat],['corpse',corpse]])for(let i=0;i<=samples.length;i++){
  const prefix=samples.slice(0,i),original=structuredClone(prefix),projected=prefix.map(nativeOutcomeProgress);
  assert.equal(nativeOutcomeComplete({outcome:{outcome},samples:prefix}),nativeOutcomeComplete({outcome:{outcome},samples:projected}));
  assert.deepEqual(prefix,original);
 }
 const noFall=corpse.map(r=>({...r,body:{...r.body,corpseRenderHistory:r.body.corpseRenderHistory.map(p=>({...p,fallProgress:1}))}}));
 assert.equal(nativeOutcomeComplete({outcome:{outcome:'corpse'},samples:noFall.map(nativeOutcomeProgress)}),false);
});

test('outcome observations reject missing, duplicate, reversed or nonfinite native RAF times',()=>{
  for(const mutate of[r=>{delete r.sourceRaf.rows;},r=>{r.sourceRaf.rows=[];},
    r=>{r.sourceRaf.rows[1].at=110;},r=>{r.sourceRaf.rows[1].at=109;},
    r=>{r.sourceRaf.rows[1].at=NaN;},r=>{r.sourceRaf.rows[1].renderSequence=NaN;},
    r=>{r.sourceRaf.rows[1].renderKind='other';}]){
    const {row,bytes}=fixture();mutate(row);assert.throws(()=>assertNativeOutcome(row,bytes));
  }
});

test('new frame-cost diagnostics cannot succeed with missing, unbounded or reversed actual frame timelines',()=>{
  const {row,bytes}=fixture();row.recordingMetadata.frameCpuTimelineV1=true;
  assert.throws(()=>assertNativeOutcome(row,bytes),/frame cost timing/u);
  const trace={sequence:1,rafTimestamp:102,entryAt:103,simulationFinishedAt:104,drawFinishedAt:105,exitAt:106};
  for(const s of row.samples)s.runtimePerformance={frameCpuTimings:[{...trace},{...trace,sequence:2,entryAt:107,simulationFinishedAt:108,drawFinishedAt:109,exitAt:110}]};
  assert.equal(assertNativeOutcome(row,bytes).continuousUntilOutcome,true);
  for(const invalid of [{...trace,entryAt:NaN},{...trace,drawFinishedAt:102}]){
    const bad=structuredClone(row);bad.samples[0].runtimePerformance.frameCpuTimings=[invalid];
    assert.throws(()=>assertNativeOutcome(bad,bytes));
  }
  const bad=structuredClone(row);bad.samples[0].runtimePerformance.frameCpuTimings=Array.from({length:129},()=>trace);
  assert.throws(()=>assertNativeOutcome(bad,bytes),/bounded/u);
});

test('outcome keeps independent raw clock reads and rejects replaced real browser references',()=>{
  const {row,bytes}=fixture();row.sourceRaf.timeOrigin+=1;
  row.captureStart.timeOrigin+=2;row.samples.forEach((s,i)=>{s.timeOrigin+=3+i;});row.captureEnd.timeOrigin+=8;
  const original=structuredClone(row),result=assertNativeOutcome(row,bytes);
  assert.equal(result.captureRealm.sameRealmVerified,true);assert.deepEqual(row,original);
  for(const change of [r=>{r.samples[1].timeOrigin=NaN;},r=>{r.recordingStart.timeOrigin++;},r=>{r.samples[1].realm.ownerId='eeeeeeee-1234-4000-8000-123456789abc';},
    r=>{r.samples[1].realm.sequence=r.samples[0].realm.sequence;},r=>{r.samples[1].battleGeneration++;}]){
    const invalid=structuredClone(row);change(invalid);assert.throws(()=>assertNativeOutcome(invalid,bytes));
  }
  let rawOrigin=1000000,at=100;
  const window={__ASHFALL_BATTLE_QA__:{getSnapshot:()=>({time:0,running:true,paused:true}),
    getEnemyFacingRuntimeAudit:()=>({fighter:{id:1},renderHistory:[],corpseRenderHistory:[]}),
    getPhaseGCombatSnapshot:()=>({battleGeneration:7,combatGore:{impacts:[],wounds:[],pools:[]},manualAbilityReceipts:[]})}};
  const document={defaultView:window,visibilityState:'visible',querySelector:()=>canvas},canvas={ownerDocument:document,isConnected:true};
  const performance={get timeOrigin(){return rawOrigin++;},now:()=>at++};
  const context=vm.createContext({window,document,performance,location:{pathname:'/v100'},crypto:{randomUUID:()=> 'aabbccdd-1234-4000-8000-123456789abc'}});
  const owner=vm.runInContext('('+createNativeAllUnitRealmOwner.toString()+')',context)();
  const read=vm.runInContext('('+readNativeOutcomeSample.toString()+')',context);
  vm.runInContext('('+readNativeAllUnitRealmOwner.toString()+')',context)(owner);
  const first=read(owner,{fighterId:1}),second=read(owner,{fighterId:1});
  assert.notEqual(first.timeOrigin,second.timeOrigin);assert.equal(first.realm.rawOriginAtCreation,second.realm.rawOriginAtCreation);
  for(const sample of [first,second]){
    const t=sample.readTiming;assert.ok(t.finishedAt>=t.startedAt);assert.equal(t.durationMs,t.finishedAt-t.startedAt);
    assert.equal(t.snapshotMs+t.auditMs+t.combatMs+t.boundaryMs+t.resultMs,t.durationMs);
    assert.equal(sample.simulationTime,0);assert.equal(sample.running,true);assert.equal(sample.paused,true);
  }
  context.performance={...performance};assert.throws(()=>read(owner,{fighterId:1}),/reference mismatch/u);
});

test('intermediate pause, forged owner, missing phase, static retreat or altered raw bytes fail closed',()=>{
  const mutations=[r=>{r.samples[1].paused=true;},r=>{r.samples[1].realm.ownerId='eeeeeeee-1234-4000-8000-123456789abc';},
    r=>{r.samples[1].body.renderHistory[0].requestedState='idle';},r=>{r.samples[3].body.renderHistory[0].x=300;r.samples[2].body.renderHistory[0].x=300;},
    r=>{r.outcome.controlledIncomingDamage=false;},r=>{r.samples[0].body.fighter.speed=100;},r=>{r.samples[2].body.renderHistory[0].renderKind='ranger';},
    r=>{r.captureStart.battleGeneration++;},r=>{r.samples[1].battleGeneration++;},r=>{r.captureEnd.battleGeneration++;}];
  for(const change of mutations){const {row,bytes}=fixture();change(row);assert.throws(()=>assertNativeOutcome(row,bytes));}
  const {row}=fixture();assert.throws(()=>assertNativeOutcome(row,Buffer.from('replaced')));
});

test('a registered death rig cannot silently become a legacy corpse without its original source and joint contacts',()=>{
  const {row,bytes}=fixture();row.form='takuya';row.outcome.form='takuya';row.outcome.outcome='corpse';
  for(const r of row.sourceRaf.rows)r.renderKind='takuya';
  Object.assign(row.captureStart.body.renderHistory[0],{renderKind:'takuya',jointAtlasPath:V177_JOINT_ATLASES.takuya.path,
    sourceRect:{x:0,y:0,w:480,h:448},sourceRow:0,renderWidth:100*480/448,renderHeight:100,poseScaleY:1});
  for(const [i,s]of row.samples.entries()){
    s.body.fighter=null;s.body.corpse={id:1};
    s.body.corpseRenderHistory=[{renderSequence:i+2,renderKind:'takuya',assetReady:true,requestedState:'death',fallProgress:i===0?.5:1}];
    s.body.renderHistory=[];s.effects.wounds=[{lethal:true,targetId:1}];
  }
  assert.throws(()=>assertNativeOutcome(row,bytes),/Original painted joint owner/u);
});

test('controlled incoming footage cannot masquerade as natural incoming combat or omit its explicit fixture binding',async()=>{
  const {row}=fixture(),page={locator:()=>({evaluateHandle:async()=>({})})};
  for(const changed of [{fixtureGroup:'natural-incoming-stun'},{controlledIncomingDamage:false},{manualClockAdvance:true},{proofId:''},
    {preparedRenderKind:'ranger'},{form:'ranger'},{continuousUntilOutcome:false}])
    await assert.rejects(beginV177NativeCanvasClip(page,{...row.recordingMetadata,...changed},{directory:'unused',engine:'webkit'}));
});

test('the actual finalizer never fills missing outcome footage with successful normal observations',()=>{
  const source=readFileSync(new URL('../scripts/v177-native-allunit-browser.mjs',import.meta.url),'utf8');
  const from=source.indexOf('    report.unexecuted=plan.filter('),to=source.indexOf('    await persist();',from),actual=source.slice(from,to);
  const outcomePlan=planOutcomeShard('forms-4'),plan=outcomePlan.map(r=>r.reference);
  const base=()=>({errors:[],contexts:[{cleanup:'completed'}],cases:plan.map(p=>({...p,status:'observed-diagnostic'})),manualCases:[],outcomeCases:[]});
  const run=report=>{vm.runInNewContext(actual,{report,plan,manualPlan:[],outcomePlan});return report;};
  const missing=run(base());assert.equal(missing.status,'failed');assert.equal(missing.outcomeUnexecuted.length,12);assert.equal(missing.unexecuted.length,0);
  const completed=base();completed.outcomeCases=outcomePlan.map(p=>({...p,status:'observed-outcome-diagnostic'}));
  assert.equal(run(completed).status,'completed-diagnostic');
  const failed=base();failed.outcomeCases=outcomePlan.map(p=>({...p,status:'failed'}));assert.equal(run(failed).status,'failed');
  const absentNormal=base();absentNormal.cases.pop();absentNormal.outcomeCases=completed.outcomeCases;
  assert.equal(run(absentNormal).status,'failed');assert.equal(absentNormal.unexecuted.length,1);
});
