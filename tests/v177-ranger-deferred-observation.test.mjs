import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
const normal=fs.readFileSync('scripts/v100-normal-tactical-input.mjs','utf8').replaceAll('\r\n','\n');
const runtime=fs.readFileSync('scripts/v100-device-runtime-browser.mjs','utf8');
const tree=s=>ts.createSourceFile('actual.mjs',s,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
function declaration(source,name){const t=tree(source),n=t.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);assert.ok(n,name);return n.getText(t).replace(/^export /u,'');}
function reader(source){const t=tree(source);let found;const walk=n=>{if(!found&&ts.isCallExpression(n)&&n.expression.getText(t)==='page.evaluate'&&ts.isArrowFunction(n.arguments[0]))found=n.arguments[0];ts.forEachChild(n,walk);};walk(t);assert.ok(found);return found.getText(t);}
const oldNormal=execFileSync('git',['show','4c68dbfd03fe5e639b33c95f612824ab459c74d4:scripts/v100-normal-tactical-input.mjs'],{encoding:'utf8',windowsHide:true});
const oldRuntime=execFileSync('git',['show','4c68dbfd03fe5e639b33c95f612824ab459c74d4:scripts/v100-device-runtime-browser.mjs'],{encoding:'utf8',windowsHide:true});
const clone=x=>JSON.parse(JSON.stringify(x));
function fixture(){
 let clock=100,reads=0;const events=new Map(),frames=new Map();
 const mesh={points:[{x:7,y:9}]},actor={id:1,kind:'ranger',side:'human',hp:100,maxHp:100,x:10,y:20,lane:1,range:180,combatReady:true,
  speed:38,laneSpeed:20,damage:22,attackEvery:1,renderAudit:{weighted:mesh},renderAuditHistory:[{renderSequence:5,jointWeightedLower:mesh}]};
 const snapshot={time:7,running:true,over:false,won:false,baseHp:100,baseMaxHp:100,energy:40,supportGauge:1,airstrike:{phase:'ready'},objective:null,escortMissionObject:null,deployQueue:[],fighters:[actor],rangerRenderObservation:{sequence:5}};
 const performance={now:()=>clock++,timeOrigin:50000},document={visibilityState:'visible'};
 const window={__ASHFALL_BATTLE_QA__:{getSnapshot:()=>{reads++;return snapshot;},getPerformanceSnapshot:()=>({renderFrames:5,rangerDrawBoundary:{sequence:4}})},addEventListener:(k,v)=>events.set(k,v),removeEventListener:(k,v)=>{assert.equal(events.get(k),v);events.delete(k);}};
 const context=vm.createContext({assert,window,document,performance,structuredClone,setTimeout,clearTimeout,
  requestAnimationFrame:fn=>{frames.set(1,fn);return 1;},cancelAnimationFrame:id=>frames.delete(id)});
 vm.runInContext(declaration(runtime,'beginMeasurement')+'\n'+declaration(runtime,'endMeasurement')+'\n'+declaration(runtime,'restoreDeferredRangerObservations')+'\nthis.api={begin:beginMeasurement,end:endMeasurement,restore:restoreDeferredRangerObservations};',context);
 const read=vm.runInContext('('+reader(normal)+')',context),oldRead=vm.runInContext('('+reader(oldNormal)+')',context);
 const page={evaluate:async(fn,arg)=>fn(arg)};
 return{context,window,document,performance,snapshot,mesh,events,frames,page,read,oldRead,get reads(){return reads;},async begin(defer=true){const r=await context.api.begin(page,{deferRangerObservation:defer});window.__V100_DEVICE_RAF__.rangerFirstPaintFence={status:'completed'};return r;}};
}
const options={owner:null,rangerDrawObservation:true,awaitInitialRangerPaint:true,s25DeploymentObservation:false};

test('default-off executes the original browser read and does not create deferred storage or change its output',async()=>{
 const a=fixture(),b=fixture();await a.begin(false);await b.begin(false);
 const expected=await a.oldRead(options),actual=await b.read({...options,deferRangerObservation:false});
 assert.deepEqual(clone(actual),clone(expected));assert.equal(a.reads,1);assert.equal(b.reads,1);
 assert.equal(b.window.__V100_DEVICE_RAF__.rangerDrawObservations,undefined);
 assert.equal(Object.hasOwn(actual,'rangerDrawObservation'),false);
});

test('default-off stop preserves every original clock, counter, visibility and CPU receipt field',async()=>{
 const a=fixture(),b=fixture();await a.begin(false);await b.begin(false);
 const oldEnd=vm.runInContext('('+declaration(oldRuntime,'endMeasurement')+')',a.context);
 const expected=await oldEnd(a.page),actual=await b.context.api.end(b.page);
 assert.deepEqual(clone(actual),clone(expected));
 for(const f of [a,b]){assert.equal(f.frames.size,0);assert.equal(f.events.size,0);assert.equal(f.window.__V100_DEVICE_RAF__.active,false);}
});

test('the actual read clones its same-snapshot receipt and exports it only after original stop and endedAt',async()=>{
 const f=fixture(),start=await f.begin(),small=await f.read({...options,deferRangerObservation:true});
 assert.equal(small.rangerDraws,undefined);assert.deepEqual(clone(small.rangerDrawObservation),{index:0,startedAt:start.startedAt,readAt:101,simulationTime:7});
 const raw=f.window.__V100_DEVICE_RAF__.rangerDrawObservations[0].draws,original=clone(raw);
 assert.equal(f.reads,1);f.mesh.points[0].x=999;
 assert.deepEqual(clone(raw),original,'Later product geometry cannot change the saved read');
 const end=await f.context.api.end(f.page);assert.equal(f.window.__V100_DEVICE_RAF__.active,false);assert.equal(f.frames.size,0);assert.equal(f.events.size,0);
 assert.equal(end.deferredRanger.sameOwner,true);assert.equal(end.deferredRanger.endedAt,end.endedAt);
 const restored=f.context.api.restore([small],end.deferredRanger,{startedAt:start.startedAt,endedAt:end.endedAt});
 assert.deepEqual(clone(restored[0].rangerDraws),original);assert.equal(restored[0].time,small.time);
 assert.equal(restored[0].rangerDraws.readAt,original.readAt);assert.notEqual(original.readAt,end.endedAt);
});

test('a stopped, replaced or foreign original owner and overflow/clone failures never produce a replacement receipt',async()=>{
 for(const change of [s=>s.active=false,s=>s.rangerObservationOwner.state={},s=>s.rangerObservationOwner.window={},s=>s.rangerObservationOwner.document={},s=>s.rangerObservationOwner.performance={},s=>s.rangerObservationOwner.startedAt++,s=>delete s.rangerDrawObservations]){
  const f=fixture();await f.begin();change(f.window.__V100_DEVICE_RAF__);
  await assert.rejects(f.read({...options,deferRangerObservation:true}),/owner|measurement/u);
 }
 const overflow=fixture();await overflow.begin();const state=overflow.window.__V100_DEVICE_RAF__;state.rangerDrawObservations=Array(128).fill({prior:true});
 await assert.rejects(overflow.read({...options,deferRangerObservation:true}),/overflow/u);assert.equal(state.rangerDrawObservations.length,128);assert.equal(state.rangerDrawOverflow,1);
 const failed=fixture();await failed.begin();failed.context.structuredClone=()=>{throw Error('original clone failure');};
 await assert.rejects(failed.read({...options,deferRangerObservation:true}),/original clone failure/u);
 failed.context.structuredClone=structuredClone;
 const partial=await failed.context.api.end(failed.page);assert.equal(partial.deferredRanger.rows.length,0);assert.equal(partial.deferredRanger.sameOwner,true);
});

test('recombination rejects missing/duplicate indices, clocks, overflow, conflicting inline proof and wrong source time',async()=>{
 const f=fixture(),start=await f.begin(),a=await f.read({...options,deferRangerObservation:true}),b=await f.read({...options,deferRangerObservation:true}),end=await f.context.api.end(f.page);
 const bounds={startedAt:start.startedAt,endedAt:end.endedAt};
 assert.equal(f.context.api.restore([a,b],end.deferredRanger,bounds).length,2);
 for(const change of [x=>x.sameOwner=false,x=>x.startedAt++,x=>x.endedAt++,x=>x.overflow=1,x=>x.rows.pop(),x=>x.rows[1].index=0,x=>x.rows[0].draws.readAt=bounds.endedAt+1,x=>x.rows[0].draws.measurementStart.startedAt++,x=>x.rows[0].draws.measurementStart.active=false]){
  const raw=clone(end.deferredRanger);change(raw);assert.throws(()=>f.context.api.restore([clone(a),clone(b)],raw,bounds));
 }
 for(const change of [x=>delete x[0].rangerDrawObservation,x=>x[1].rangerDrawObservation.index=0,x=>x[0].rangerDrawObservation.index=-1,x=>x[0].rangerDraws={},x=>x[0].time++,x=>x[0].rangerDrawObservation.startedAt++,x=>x[0].rangerDrawObservation.readAt++,x=>x[0].rangerDrawObservation.simulationTime++]){
  const samples=[clone(a),clone(b)];change(samples);assert.throws(()=>f.context.api.restore(samples,end.deferredRanger,bounds));
 }
 const substituted=clone(a);substituted.rangerDrawObservation.index=1;
 assert.throws(()=>f.context.api.restore([substituted],end.deferredRanger,bounds),'Another good read at the same simulation time cannot replace the selected read');
});

test('a lost stop response or failing post-stop read retains the first raw boundary without resampling later counters',async()=>{
 for(const fails of [false,'read','clone']){
  const f=fixture();await f.begin();await f.read({...options,deferRangerObservation:true});
  const qa=f.window.__ASHFALL_BATTLE_QA__,original=qa.getPerformanceSnapshot;let reads=0;
  qa.getPerformanceSnapshot=()=>{reads++;if(fails==='read')throw Error('Original stop read failed');return original();};
  if(fails==='clone')f.context.structuredClone=()=>{throw Error('Original stop clone failed');};
  let first;
  if(fails)await assert.rejects(f.context.api.end(f.page),/Original stop (?:read|clone) failed/u);
  else first=await f.context.api.end(f.page);
  const retained=f.window.__V100_DEVICE_RAF__.measurementEnd,at=retained.endedAt;
  for(let i=0;i<100;i++)f.performance.now();
  const partial=await f.context.api.end(f.page);
  assert.equal(partial,retained);if(first)assert.equal(partial,first);
  assert.equal(partial.endedAt,at);assert.equal(partial.deferredRanger.endedAt,at);assert.equal(reads,1);
  assert.equal(partial.deferredRanger.rows.length,1);assert.equal(f.events.size,0);assert.equal(f.frames.size,0);
  if(fails){assert.equal(partial.performanceAfter,null);assert.match(partial.stopError,/Original stop (?:read|clone) failed/u);}
 }
});

test('the original selection, wait, tactical input and validators remain in the same ordering',()=>{
 assert.match(runtime,/Date\.now\(\) - previousSample >= 1000/u);
 assert.match(runtime,/await page\.waitForTimeout\(350\)/u);
 assert.ok(runtime.indexOf('const raf = await endMeasurement(page);')<runtime.indexOf('result.deferredRangerObservation=raf.deferredRanger'));
 assert.ok(runtime.indexOf('result.deferredRangerObservation=raf.deferredRanger')<runtime.indexOf(':rangerPerformanceReceipts(result.measurementSamples'));
 const old=tree(oldNormal),current=tree(normal),list=t=>t.statements.filter(n=>ts.isFunctionDeclaration(n)&&n.name?.text!=='normalTacticalInput').map(n=>n.getText(t));
 assert.deepEqual(list(current),list(old),'Every original native helper remains byte-identical');
 assert.match(normal,/deferRangerObservation=false/u);
 assert.doesNotMatch(normal,/waitForTimeout\(.*deferRanger|requestFrame|setGraphicsQuality/u);
});
