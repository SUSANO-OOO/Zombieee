import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {nativeAacProbeCases,runNativeAacProbe} from '../scripts/v177-native-aac-probe.mjs';

const driver=fs.readFileSync('scripts/v177-native-aac-browser.mjs','utf8'),
  probe=fs.readFileSync('scripts/v177-native-aac-probe.mjs','utf8'),
  ast=ts.createSourceFile('driver.mjs',driver,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),
  probeAst=ts.createSourceFile('probe.mjs',probe,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
function find(tree,predicate){const rows=[];const visit=node=>{if(predicate(node))rows.push(node);ts.forEachChild(node,visit);};visit(tree);assert.equal(rows.length,1);return rows[0];}
function make(name,bindings){const fn=find(ast,node=>ts.isFunctionDeclaration(node)&&node.name?.text===name);
  return new Function(...Object.keys(bindings),'return '+fn.getText(ast).replace(/^export /u,''))(...Object.values(bindings));}
function clock(){let now=0,next=0;const timers=new Map();return{timers,now:()=>now,
  setTimeout(fn,ms){const id=++next;timers.set(id,{at:now+ms,fn});return id;},clearTimeout(id){timers.delete(id);},
  advance(value){now=value;for(const [id,timer]of timers)if(timer.at<=now){timers.delete(id);timer.fn();}}};}
const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};

test('the actual native transport recorder bounds original events and preserves clock/readiness without reading a detached buffer',()=>{
  const fn=find(probeAst,node=>ts.isVariableDeclaration(node)&&node.name.getText(probeAst)==='recordTransport').initializer;
  const state={transportCapacity:1024,transportEvents:[],transportEventOverflow:0},source={readyState:'open',duration:NaN},
    buffer={updating:true,buffered:{length:1,start:()=>0,end:()=>.064}},audio={readyState:1,currentTime:0,duration:NaN,paused:true,buffered:buffer.buffered};
  let now=10;const bindings={state,performance:{now:()=>now++},source,buffer,audio,pending:[new Uint8Array(3)],startAt:null};
  const record=new Function(...Object.keys(bindings),'return '+fn.getText(probeAst))(...Object.values(bindings));
  record('append-call',{bytes:3});assert.deepEqual(state.transportEvents[0].sourceBuffered,[[0,.064]]);
  assert.equal(state.transportEvents[0].sourceDuration,'NaN');assert.equal(state.transportEvents[0].ms,null);
  source.readyState='closed';Object.defineProperty(buffer,'buffered',{get(){throw Error('Detached buffer must not be read');}});
  record('sourceclose');assert.equal(state.transportEvents[1].sourceBuffered,null);
  for(let i=2;i<1027;i++)record('updateend');assert.equal(state.transportEvents.length,1024);assert.equal(state.transportEventOverflow,3);
  assert.equal(state.transportEvents[0].event,'append-call');assert.equal(state.transportEvents[0].bytes,3);
});

test('the actual Promise observer adds no RAF polling and expires at the unchanged15s limit',async()=>{
  const c=clock(),events=[],context={__v177RecordTransport:(event,details)=>events.push({event,...details}),__v177ProbePromise:new Promise(()=>{})},
    page={evaluate:fn=>vm.runInNewContext('('+fn.toString()+')()',context)},wait=make('waitNativeAacPromise',{setTimeout:c.setTimeout,clearTimeout:c.clearTimeout});
  const pending=wait(page);let settled=false;void pending.then(()=>{settled=true;},()=>{settled=true;});await flush();
  assert.deepEqual(events,[{event:'driver-completion-wait-start',method:'promise'}]);assert.equal(c.timers.size,1);
  assert.equal([...c.timers.values()][0].at,15000);c.advance(14999);await flush();assert.equal(settled,false);
  c.advance(15000);await assert.rejects(pending,/15000ms/);assert.equal(c.timers.size,0);
  context.__v177ProbePromise=Promise.resolve('original result');assert.equal(await wait(page),'original result');assert.equal(c.timers.size,0);
});

test('the actual partial reader keeps a pending original state and its secondary timeout is1s',async()=>{
  const c=clock(),read=make('readNativeAacPartial',{setTimeout:c.setTimeout,clearTimeout:c.clearTimeout}),state={status:'starting',packets:[{timestamp:0,data:[1,2]}]};
  const result=await read({evaluate:fn=>vm.runInNewContext('('+fn.toString()+')()',{__v177NativeAacState:state})});assert.equal(result,state);
  const pending=read({evaluate:()=>new Promise(()=>{})});void pending.catch(()=>{});assert.equal([...c.timers.values()][0].at,1000);
  c.advance(1000);await assert.rejects(pending,/1000ms/);assert.equal(c.timers.size,0);
});

async function executeActualCases({lateWeapon=false,cleanupFault=null,outerFinally=false}={}){
  const loop=find(ast,node=>ts.isForOfStatement(node)&&node.expression.getText(ast)==='nativeAacProbeCases()');
  const outer=find(ast,node=>ts.isTryStatement(node)&&node.tryBlock.statements.some(s=>ts.isForOfStatement(s)&&s.expression.getText(ast)==='nativeAacProbeCases()'));
  const report={cases:[],errors:[]},saved=new Map(),events=[],summaries=[],c=clock();let launched=0;
  const selected=nativeAacProbeCases().filter(s=>lateWeapon?s.variant==='observer-control'&&s.mix==='bgm-se':cleanupFault?s.variant==='observer-control'&&s.mix==='bgm':true);
  const unsupported={status:'unsupported-encoder',packets:[],configurations:[],referencePcm:[],backgroundPcm:[],errors:[],realtimeAudioContexts:0};
  function browser(id){return{version:()=>`inert-${id}`,async close(){events.push({kind:'browser-close',id});if(cleanupFault==='browser'&&id===1)return new Promise(()=>{});},async newContext(){
    if(!lateWeapon&&id===1&&cleanupFault!=='context')throw Error('Injected fresh context acquisition failure');
    const native={__v177ProbeResult:lateWeapon?null:unsupported,__v177NativeAacState:{status:'starting',packets:[]},__v177ProbePromise:new Promise(()=>{})};
    const context={async route(){},async addInitScript(){},async close(){events.push({kind:'context-close',id});if(cleanupFault==='context'&&id===1)return new Promise(()=>{});},async newPage(){if(cleanupFault==='context'&&id===1)throw Error('Injected original fresh newPage failure');return page;}};
    const page={on(){},async goto(){},async addInitScript(){},async waitForFunction(_fn,_arg,options){assert.equal(options.timeout,15000);},
      evaluate(fn,arg){if(arg?.implementation)return Promise.resolve();return vm.runInNewContext('('+fn.toString()+')()',native);},
      getByRole(_role,{name}){return{async click(options){events.push({kind:'click',id,name,options,at:c.now()});}};},
      async waitForTimeout(ms){assert.equal(ms,1000);c.advance(15000);await flush();}};
    return context;
  }};}
  const browserType={async launch(){const id=++launched;events.push({kind:'browser-launch',id});return browser(id);}},
    bindings={browser:browser(0),browserType,nativeAacProbeCases:()=>selected,report,origin:new URL('http://127.0.0.1/'),engine:'webkit',out:'inert',
      sourceUrls:[],muxerSource:'inert',runNativeAacProbe,assert,Buffer,Date:class extends Date{static now(){return c.now();}},
      installRequestFailureAudit:()=>({report:{unexpectedFailures:[]},closeContext:context=>context.close()}),
      async file(name,bytes){assert.equal(saved.has(name),false);saved.set(name,Buffer.from(bytes));return{file:name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};},
      writeFile:async(_file,text)=>{summaries.push(JSON.parse(text));},waitNativeAacPromise:make('waitNativeAacPromise',{setTimeout:c.setTimeout,clearTimeout:c.clearTimeout}),
      closeNativeAacOwnedResource:make('closeNativeAacOwnedResource',{setTimeout:c.setTimeout,clearTimeout:c.clearTimeout}),
      readNativeAacPartial:make('readNativeAacPartial',{setTimeout:c.setTimeout,clearTimeout:c.clearTimeout})};
  const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
  let settled=false;const task=new AsyncFunction(...Object.keys(bindings),(outerFinally?outer:loop).getText(ast))(...Object.values(bindings)).then(()=>{settled=true;});
  if(cleanupFault){for(let attempt=0;attempt<4&&!settled;attempt++){for(let i=0;i<200;i++)await Promise.resolve();if(settled)break;
    assert.equal(c.timers.size,1,'pending owned cleanup must have one deadline');const next=[...c.timers.values()][0];assert.equal(next.at-c.now(),2000);c.advance(next.at);}}
  await task;return{report,saved,events,launched,summaries,timers:c.timers};
}

test('the actual driver retains the old8 controls and gives all4 added cases separate browser ownership even on acquisition failure',async()=>{
  const {report,events,launched}=await executeActualCases();assert.equal(report.cases.length,12);assert.equal(launched,4);
  assert.ok(report.cases.slice(0,8).every(r=>r.completion==='raf-default'&&!r.freshBrowser));
  assert.ok(report.cases.slice(8).every(r=>r.completion==='promise'&&r.freshBrowser&&!r.coldHardwareVerified));
  assert.ok(report.cases.filter((_,i)=>i!==8).every(r=>r.feasibility==='unsupported'&&!r.failure));
  assert.match(report.cases[8].failure,/context acquisition failure/);assert.equal(report.cases[8].feasibility,'failed');
  assert.deepEqual(events.filter(e=>e.kind==='browser-close').map(e=>e.id),[1,2,3,4]);
  assert.equal(events.filter(e=>e.kind==='browser-close'&&e.id===0).length,0,'shared browser remains owned by the outer original finally');
  assert.equal(report.cases[8].browserCleanup,'completed');
});

test('the actual added-case driver cannot fire a late rifle after its observation deadline and retains the original partial state',async()=>{
  const {report,events,saved,timers}=await executeActualCases({lateWeapon:true});assert.equal(report.cases.length,1);
  const row=report.cases[0];assert.equal(row.feasibility,'failed');assert.match(row.failure,/Expired native AAC observation/);
  assert.equal(events.filter(e=>e.kind==='click'&&e.name==='Fire existing rifle effect').length,0);
  assert.ok(saved.has('ManagedMediaSource-observer-control-bgm-se-partial-raw.json'));
  assert.deepEqual(JSON.parse(saved.get('ManagedMediaSource-observer-control-bgm-se-partial-raw.json')),{status:'starting',packets:[]});
  assert.equal(row.browserCleanup,'completed');assert.equal(timers.size,0);
});

test('the actual outer finally persists the original failure and releases the shared owner after either added cleanup stays pending',async t=>{
  for(const cleanupFault of ['context','browser'])await t.test(cleanupFault,async()=>{
    const {report,events,summaries,timers}=await executeActualCases({cleanupFault,outerFinally:true}),row=report.cases[0];
    assert.equal(report.cases.length,1);assert.equal(row.feasibility,'failed');
    assert.match(row.failure,cleanupFault==='context'?/original fresh newPage failure/:/fresh context acquisition failure/);
    assert.match(cleanupFault==='context'?row.cleanupFailure:row.browserCleanupFailure,/cleanup exceeded2000ms/);
    assert.deepEqual(events.filter(e=>e.kind==='browser-close').map(e=>e.id),[1,0]);
    assert.equal(summaries.at(-1).cases[0].failure,row.failure);assert.equal(summaries.at(-1).cases[0].feasibility,'failed');
    assert.equal(timers.size,0);
  });
});
