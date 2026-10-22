import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createReadStream } from 'node:fs';
import { mkdtemp,readFile,readdir,unlink,rmdir,open } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import { installNormalFrameObserver,createNormalFrameCapture,finishNormalFrameCapture } from '../scripts/v177-normal-frame-observation.mjs';
import { normalTacticalInput } from '../scripts/v100-normal-tactical-input.mjs';

const owner='a'.repeat(40)+':normal:stage-01:7';
function surface(){
  let now=0,next=0,renderFrames=0,reads=0;const frames=new Map(),listeners=new Map(),cancelled=[];
  const document={visibilityState:'visible',querySelector:selector=>{assert.equal(selector,'.game-shell canvas');return{width:1688,height:680};}};
  const productListener=()=>{},productFrame=()=>{};listeners.set('blur',new Set([productListener]));frames.set(99999,productFrame);
  const context={document,devicePixelRatio:2,performance:{timeOrigin:100000,now:()=>now},
    __ASHFALL_BATTLE_QA__:Object.freeze({getPerformanceSnapshot(){reads++;return{renderFrames,simulationTicks:renderFrames,graphicsProfile:{renderHz:60}};}}),
    addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},
    removeEventListener(type,fn){listeners.get(type)?.delete(fn);},
    requestAnimationFrame(fn){const id=++next;frames.set(id,fn);return id;},cancelAnimationFrame(id){cancelled.push(id);frames.delete(id);}};
  vm.runInNewContext('('+installNormalFrameObserver.toString()+')()',context);
  return{context,frames,listeners,cancelled,document,productListener,productFrame,
    read(action,selected=owner){return structuredClone(context.__V177_READ_NORMAL_FRAMES__(selected,action));},
    tick(step=16){now+=step;renderFrames++;const item=[...frames.entries()].find(([id])=>id!==99999);assert.ok(item);frames.delete(item[0]);item[1](now);},
    mark(type){for(const fn of listeners.get(type)??[])fn();},get reads(){return reads;}};
}
async function directory(t){
  const dir=await mkdtemp(path.join(tmpdir(),'v177-normal-frames-'));
  // Remove only this test's known flat directory, without recursive deletion.
  t.after(async()=>{for(const name of await readdir(dir))await unlink(path.join(dir,name));await rmdir(dir);});return dir;
}
function rows({slow=false,event=false}={}){
  const page=surface(),result=[page.read('start')];
  for(let i=0;i<320;i++){page.tick(slow&&i%10===0?50:16);if(i===149){if(event)page.mark('blur');result.push(page.read('drain'));}}
  result.push(page.read('stop'));return result;
}
async function captureWithFileOperations(openFile,readStream=createReadStream){
  const source=await readFile('scripts/v177-normal-frame-observation.mjs','utf8'),
    ast=ts.createSourceFile('frames.mjs',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),
    fn=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='createNormalFrameCapture');
  const bindings={assert,path,open:openFile,createHash,createReadStream:readStream};
  return new Function(...Object.keys(bindings),'return '+fn.getText(ast).replace(/^export /u,''))(...Object.values(bindings));
}

test('the actual passive observer owns one RAF and drains exact bounded raw clocks without touching product work',()=>{
  const page=surface(),start=page.read('start');assert.equal(start.sequence,0);assert.equal(start.times.length,0);
  assert.throws(()=>page.read('start'),/restarted/);assert.throws(()=>page.read('drain','other'),/another battle/);
  for(let i=0;i<160;i++)page.tick();const middle=page.read('drain');
  for(let i=0;i<160;i++)page.tick();const stop=page.read('stop');
  assert.equal(middle.times.length,160);assert.equal(stop.times.length,160);assert.equal(middle.times.at(-1),2560);assert.equal(stop.times[0],2576);
  assert.equal(stop.totalCallbacks,320);assert.equal(stop.overflow,0);assert.equal(stop.stopped,true);assert.equal(page.reads,2);
  assert.equal(page.frames.size,1);assert.equal(page.frames.get(99999),page.productFrame);assert.equal(page.listeners.get('blur').size,1);
  assert.ok(page.listeners.get('blur').has(page.productListener));assert.equal(page.read('drain'),null);
  page.read('start','new-owner');assert.throws(()=>page.read('stop'),/another battle/);page.tick();assert.equal(page.read('stop','new-owner').totalCallbacks,1);
});

test('resident RAF storage holds4800 timestamps and reports every omitted callback instead of resetting overflow',()=>{
  const page=surface();page.read('start');for(let i=0;i<4803;i++)page.tick();const first=page.read('drain');
  assert.equal(first.times.length,4800);assert.equal(first.overflow,3);assert.equal(first.totalCallbacks,4803);
  page.tick();const end=page.read('stop');assert.equal(end.times.length,1);assert.equal(end.overflow,3);assert.equal(end.totalCallbacks,4804);
});

test('raw JSONL pins every timestamp and exact cross-chunk quantile while a slow observation keeps the33ms reference',async t=>{
  const dir=await directory(t);
  for(const slow of [false,true]){
    const capture=await createNormalFrameCapture({directory:dir,label:slow?'slow':'normal',owner}),input=rows({slow});
    for(const row of input)await capture.record(row);const result=await capture.finish();
    assert.equal(result.status,'recorded');assert.equal(result.count,320);assert.equal(result.intervalCount,319);assert.equal(result.renderDelta,320);
    const times=input.flatMap(row=>row.times),intervals=times.slice(1).map((at,i)=>at-times[i]).sort((a,b)=>a-b);
    assert.equal(result.p95RafMs,intervals[Math.ceil(intervals.length*.95)-1]);assert.equal(result.p95RafMs,slow?50:16);
    assert.equal(result.p95ReferenceMs,33);assert.equal(result.p95WithinReference,!slow);assert.equal(result.performanceAcceptance,false);
    const raw=await readFile(result.raw.file);assert.equal(raw.length,result.raw.bytes);
    assert.equal(result.raw.verified,true);assert.equal(result.raw.successfulWriteBytes,raw.length);
    assert.equal(createHash('sha256').update(raw).digest('hex'),result.raw.sha256);
    assert.deepEqual(raw.toString().trim().split('\n').map(line=>JSON.parse(line)),JSON.parse(JSON.stringify(input)));
    assert.equal(await capture.finish(),result);await assert.rejects(capture.record(input.at(-1)),/Closed frame/);
  }
});

test('missing stop, sequence/clock corruption, duplicate ticks, hidden work and overflow cannot pass a complete observation',async t=>{
  const dir=await directory(t),cases=[
    ['stop',input=>input.pop()],['owner',input=>{input[1].owner='other';}],
    ['sequence',input=>{input[1].sequence++;}],['clock',input=>{input[1].timeOrigin++;}],
    ['duplicate',input=>{input[2].times[0]=input[1].times.at(-1);}],
    ['overflow',input=>{input[2].overflow=1;input[2].totalCallbacks++;}],
    ['hidden',input=>{input[2].visibilityState='hidden';}],
    ['middle-hidden',input=>{input[1].visibilityState='hidden';}],
    ['negative-timestamp',input=>{input[1].times[0]=-1;}],
    ['oversized-row',input=>{const last=input[2];last.times=Array.from({length:4801},(_,i)=>2400+(i+1)*16);
      last.totalCallbacks=150+4801;last.observedAt=last.times.at(-1);}],
    ['regressed',input=>{input[2].observedAt=-1;}],
  ];
  for(const [label,mutate] of cases){const capture=await createNormalFrameCapture({directory:dir,label,owner}),input=rows();mutate(input);
    for(const row of input)await capture.record(row);const result=await capture.finish();assert.equal(result.status,'incomplete',label);
    assert.equal(result.p95WithinReference,false,label);assert.equal(result.p95RafMs,null,label);assert.equal(result.originalSpeedAccepted,false);}
  const capture=await createNormalFrameCapture({directory:dir,label:'event',owner});for(const row of rows({event:true}))await capture.record(row);
  const result=await capture.finish();assert.equal(result.status,'incomplete');assert.equal(result.visibility.events[0].type,'blur');
});

test('a partial JSONL write keeps the actual prefix hash and automatically fails the observation',async t=>{
  const dir=await directory(t);let writes=0,reads=0;
  const createCapture=await captureWithFileOperations(async(file,flags)=>{
    const handle=await open(file,flags);return{close:()=>handle.close(),async writeFile(bytes){
      if(++writes===2){await handle.writeFile(bytes.subarray(0,17));const error=new Error('Injected partial write ENOSPC');error.code='ENOSPC';throw error;}
      return handle.writeFile(bytes);
    }};
  },file=>{reads++;return createReadStream(file);});
  const capture=await createCapture({directory:dir,label:'partial-write',owner}),input=rows();
  await capture.record(input[0]);await assert.rejects(capture.record(input[1]),/ENOSPC/);
  const [result,again]=await Promise.all([capture.finish(),capture.finish()]);
  assert.equal(result,again);assert.equal(reads,1);assert.equal(result.status,'incomplete');assert.equal(result.p95WithinReference,false);
  assert.ok(result.errors.some(error=>error.includes('ENOSPC')));assert.equal(result.raw.verified,true);
  const raw=await readFile(result.raw.file);assert.equal(raw.length,result.raw.successfulWriteBytes+17);
  assert.equal(result.raw.bytes,raw.length);assert.equal(result.raw.sha256,createHash('sha256').update(raw).digest('hex'));
  assert.equal(raw.subarray(-17).toString(),(JSON.stringify(input[1])+'\n').slice(0,17));
});

test('unreadable retained JSONL reports unverified null pins and cannot pass otherwise complete clocks',async t=>{
  const dir=await directory(t),createCapture=await captureWithFileOperations(async(file,flags)=>{
    const handle=await open(file,flags);return{writeFile:bytes=>handle.writeFile(bytes),async close(){await handle.close();await unlink(file);}};
  });
  const capture=await createCapture({directory:dir,label:'unreadable',owner});for(const row of rows())await capture.record(row);
  const result=await capture.finish();assert.equal(result.status,'incomplete');assert.equal(result.raw.verified,false);
  assert.equal(result.raw.bytes,null);assert.equal(result.raw.sha256,null);assert.equal(result.gates.rawEvidence,false);
  assert.equal(result.p95WithinReference,false);assert.ok(result.errors.some(error=>error.includes('Raw frame evidence read failed')));
});

test('a stalled stop read is bounded, retains partial evidence and cannot replace the original gameplay failure',{timeout:5000},async t=>{
  const dir=await directory(t),capture=await createNormalFrameCapture({directory:dir,label:'stalled',owner}),input=rows();
  await capture.record(input[0]);await capture.record(input[1]);const primary=new Error('Original game failure');
  const result=await finishNormalFrameCapture({evaluate:()=>new Promise(()=>{})},capture,owner);
  assert.equal(result.status,'incomplete');assert.ok(result.errors.some(error=>error.includes('1000ms')));assert.equal(primary.message,'Original game failure');
  assert.ok(result.raw.bytes>0);assert.equal(result.performanceAcceptance,false);
});

test('the actual tactical read keeps the original snapshot and all input policy while timing travels in the same RPC',async()=>{
  const old=execFileSync('git',['show','226ccec9e257d8052ce9ed861f16620d3be4765d:scripts/v100-normal-tactical-input.mjs'],{encoding:'utf8'}).replaceAll('\r\n','\n'),
    current=(await readFile('scripts/v100-normal-tactical-input.mjs','utf8')).replaceAll('\r\n','\n'),marker='  observeSnapshot?.(s);';
  const s25Only="s25FireComparison ? s25FireDeploymentPriorities(s, record.s25ObservedHumans, earlyCampaign&&!bossPrecision ? earlyPriorities : latePriorities) : earlyCampaign&&!bossPrecision ? earlyPriorities : latePriorities";
  assert.equal(current.split(s25Only).length,2,'only the one explicit S25 branch is exempt');
  assert.equal(current.slice(current.indexOf(marker)).replace(s25Only,"earlyCampaign&&!bossPrecision ? earlyPriorities : latePriorities"),old.slice(old.indexOf(marker)),'all baseline tactical policy remains exact');
  const ast=ts.createSourceFile('old.mjs',old,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  const declaration=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='normalTacticalInput');
  const first=declaration.body.statements[0].declarationList.declarations[0].initializer.expression.arguments[0].getText(ast);
  for(let i=0;i<32;i++){
    const state={time:i,running:true,over:true,won:false,baseHp:900-i,baseMaxHp:920,energy:i,supportGauge:i,deployQueue:[{kind:'medic',unused:1}],
      fighters:[{id:i,kind:'ranger',side:'human',hp:40,maxHp:50,x:100+i,y:30,lane:1,range:100,combatReady:true,unused:'kept-out'}]};
    const context={window:{__ASHFALL_BATTLE_QA__:{getSnapshot:()=>state}},owner,frame:{owner,sequence:1,times:[16,32]}};
    context.__V177_READ_NORMAL_FRAMES__=(selected,action)=>{assert.equal(selected,owner);assert.equal(action,'drain');return context.frame;};
    const expected=structuredClone(vm.runInNewContext('('+first+')()',context));let calls=0,observed,chunk,stored=false;
    const page={async evaluate(fn,arg){calls++;context.selected=arg;return vm.runInNewContext('('+fn.toString()+')(selected)',context);}};
    await normalTacticalInput(page,{number:14,inputs:[]},{frameOwner:owner,async observeFrameChunk(value){chunk=structuredClone(value);await Promise.resolve();stored=true;},observeSnapshot(value){assert.equal(stored,true);observed=structuredClone(value);}});
    assert.equal(calls,1);assert.deepEqual(observed,expected);assert.deepEqual(chunk,context.frame);
    await normalTacticalInput(page,{number:14,inputs:[]},{observeSnapshot(value){observed=structuredClone(value);}});assert.deepEqual(observed,expected);
  }
});

test('the actual normal battle finally retains its original failure when observation cleanup also fails',async()=>{
  const source=await readFile('scripts/v100-normal-campaign-playthrough.mjs','utf8'),ast=ts.createSourceFile('normal.mjs',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),
    fn=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='battle'),primary=new Error('Original ordinary battle failure');
  let accepted=false,cleanup=0;const report={stages:[],provenance:{head:'a'.repeat(40)}},rawPage={};
  const bindings={report,rawPage,rpc:{run:async operation=>operation(),check(){}},saveAt:async()=>({revision:7}),persist:async()=>{},page:{locator:()=>({async waitFor({timeout}){assert.equal(timeout,15000);}})},
    phaseAt:async()=>'battle',continueRequested:async()=>{throw primary;},out:'inert',createNormalFrameCapture:async()=>({}),
    finishNormalFrameCapture:async page=>{assert.equal(page,rawPage);cleanup++;throw new Error('Secondary timing cleanup failure');},acceptResult:async()=>{accepted=true;}};
  const body=fn.getText(ast),factory=new Function(...Object.keys(bindings),'return '+body),battle=factory(...Object.values(bindings));
  await assert.rejects(battle({number:1,id:'stage-01'}),error=>error===primary);assert.equal(cleanup,1);assert.equal(accepted,false);
  assert.equal(report.stages[0].framePerformance.status,'incomplete');assert.match(report.stages[0].framePerformance.error,/Secondary/);
});
