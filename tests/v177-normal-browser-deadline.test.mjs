import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {createHash} from 'node:crypto';
import {createNormalBrowserDeadline,normalCleanupWithin,runNormalPlayChild,normalProtocolTimeoutReceipt} from '../scripts/v177-normal-browser-deadline.mjs';

const flush=async()=>{for(let i=0;i<24;i++)await Promise.resolve();};
function clock(){
  let now=0,id=0;const pending=new Map();
  return{timers:{setTimeout(fn,ms){const key=++id;pending.set(key,{at:now+ms,fn});return key;},clearTimeout(key){pending.delete(key);}},
    get pending(){return pending.size;},get now(){return now;},async advance(ms){await flush();const target=now+ms;
      for(;;){const next=[...pending.entries()].filter(([,item])=>item.at<=target).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;
        now=next[1].at;pending.delete(next[0]);next[1].fn();await flush();}now=target;await flush();}};
}
function child(){const result=new EventEmitter();result.pid=123;result.signals=[];result.kill=signal=>{result.signals.push(signal);return true;};return result;}

test('protocol guard retains Playwright receivers, context identity, callbacks and native input deadlines',async()=>{
  const time=clock(),context={},arg={owner:'receipt'},callback=()=>42,calls=[];
  const locator={filter(options){assert.equal(this,locator);assert.equal(options.has,proxy.getByRole('button'));return this;},
    count(){assert.equal(this,locator);return Promise.resolve(2);},evaluateAll(fn,value){assert.equal(this,locator);assert.equal(fn,callback);assert.equal(value,arg);return Promise.resolve(42);},
    click(options){assert.equal(this,locator);calls.push(options);return Promise.resolve();}};
  const raw={context(){assert.equal(this,raw);return context;},getByRole(){assert.equal(this,raw);return locator;},
    mouse:{click(x,y,options){assert.equal(this,raw.mouse);calls.push({x,y,options});return Promise.resolve();}}};
  const rpc=createNormalBrowserDeadline({timers:time.timers}),proxy=rpc.wrap(raw);
  assert.equal(proxy.context(),context);assert.equal(proxy.getByRole('button'),proxy.getByRole('button'));
  assert.equal(await proxy.getByRole('button').filter({has:proxy.getByRole('button')}).count(),2);
  assert.equal(await proxy.getByRole('button').evaluateAll(callback,arg),42);
  await proxy.getByRole('button').click({timeout:500});await proxy.getByRole('button').click({timeout:750});
  await proxy.mouse.click(15,20,{button:'left'});
  assert.deepEqual(calls,[{timeout:500},{timeout:750},{x:15,y:20,options:{button:'left'}}]);assert.equal(time.pending,0);
});

for(const stalled of ['evaluate','count','mouse'])test(`stalled ${stalled} latches the first timeout and fences late completion and further input`,async()=>{
  const time=clock();let complete,inputs=0,closed=0,rpc;
  const stuck=()=>new Promise(resolve=>{complete=resolve;});
  const raw={evaluate:stuck,locator:()=>({count:stuck,click(){inputs++;return Promise.resolve();}}),mouse:{click:stuck}};
  rpc=createNormalBrowserDeadline({timeoutMs:15000,timers:time.timers,onTimeout(error){assert.equal(rpc.failure,error);closed++;throw new Error('Secondary context close failure');}});
  const page=rpc.wrap(raw),operation=stalled==='evaluate'?page.evaluate(()=>0):stalled==='count'?page.locator('button').count():page.mouse.click(1,2);
  const rejection=assert.rejects(operation,error=>error===rpc.failure&&error.code==='NORMAL_PLAY_OPERATION_TIMEOUT'&&error.timeoutMs===15000);
  await time.advance(14999);assert.equal(closed,0);await time.advance(1);await rejection;assert.equal(closed,1);
  const first=rpc.failure;complete('late success');await flush();
  assert.throws(()=>page.locator('button').click({timeout:500}),error=>error===first);
  await assert.rejects(rpc.run(()=>{inputs++;},'later raw request'),error=>error===first);
  assert.equal(inputs,0);assert.equal(time.pending,0);
});

test('first protocol timeout retains bounded selector and monotonic timing through late completion',async()=>{
  const time=clock();let complete;
  const locator=()=>({nth:()=>locator(),filter:()=>locator(),evaluateAll:()=>new Promise(resolve=>{complete=resolve;})});
  const rpc=createNormalBrowserDeadline({timers:time.timers,clock:()=>time.now});
  const page=rpc.wrap({locator:()=>locator()});
  const opaque={toJSON(){throw new Error('opaque locator options must not be serialized');}};
  const operation=page.locator('button.unit-card[data-kind="guardian"]').nth(1).filter({has:opaque}).evaluateAll(()=>0);
  const rejection=assert.rejects(operation,error=>error===rpc.failure&&error.timeoutMs===30000);
  await time.advance(29999);assert.equal(rpc.failure,null);await time.advance(1);await rejection;
  const receipt=normalProtocolTimeoutReceipt(rpc.failure),saved=structuredClone(receipt);
  assert.deepEqual(receipt.timing,{clock:'node-performance-now-ms',startedAt:0,timeoutAt:30000,elapsedMs:30000});
  assert.deepEqual(receipt.locator,{chain:[{factory:'locator',value:'button.unit-card[data-kind="guardian"]'},{factory:'nth',index:1},{factory:'filter',detailsOmitted:true}],truncated:false});
  complete('late success');await time.advance(1000);assert.deepEqual(normalProtocolTimeoutReceipt(rpc.failure),saved);
  const otherTime=clock(),other=createNormalBrowserDeadline({timers:otherTime.timers,clock:()=>otherTime.now});
  let long=other.wrap({locator:()=>locator()}).locator('x'.repeat(400));
  for(let i=0;i<12;i++)long=long.nth(i);
  const bounded=assert.rejects(long.evaluateAll(()=>0));await otherTime.advance(30000);await bounded;
  assert.equal(other.failure.locator.chain.length,8);assert.equal(other.failure.locator.truncated,true);
});

test('native failures remain primary and healthy long observation is not given a new total deadline',async()=>{
  const time=clock(),primary=new Error('Original browser error'),rpc=createNormalBrowserDeadline({timers:time.timers});
  await assert.rejects(rpc.run(()=>Promise.reject(primary),'native rejection'),error=>error===primary);
  assert.equal(rpc.failure,null);
  for(let i=0;i<5;i++){assert.equal(await rpc.wrap({count:async()=>i}).count(),i);await time.advance(30000);}
  assert.equal(rpc.failure,null);assert.equal(time.pending,0);
});

test('a failed evaluation identifies its actual callback without reading arguments or instrumenting successful calls',async()=>{
  const time=clock(),rpc=createNormalBrowserDeadline({timers:time.timers,clock:()=>time.now});
  const argument={get secret(){assert.fail('Callback arguments must never be inspected');},toJSON(){assert.fail('Arguments must not be serialized');}};
  function readActualPhase(){return document.querySelector('.v100-shell')?.dataset.v100Phase;}
  const raw={evaluate:()=>new Promise(()=>{})},page=rpc.wrap(raw),operation=page.evaluate(readActualPhase,argument);
  const rejection=assert.rejects(operation,error=>error===rpc.failure);
  await time.advance(29999);assert.equal(rpc.failure,null);await time.advance(1);await rejection;
  const receipt=normalProtocolTimeoutReceipt(rpc.failure),source=Function.prototype.toString.call(readActualPhase);
  assert.deepEqual(receipt.evaluation,{callbackType:'function',name:'readActualPhase',sourceChars:source.length,
    sourceSha256:createHash('sha256').update(source).digest('hex'),sourceStart:source.slice(0,256)});
  assert.equal(receipt.timeoutMs,30000);assert.equal(receipt.timing.elapsedMs,30000);
  const healthy=createNormalBrowserDeadline({timers:time.timers,clock:()=>time.now}),fn=()=>42;
  Object.defineProperty(fn,'name',{get(){assert.fail('No callback metadata on the success path');}});
  assert.equal(await healthy.wrap({evaluate:async()=>42}).evaluate(fn,argument),42);
  assert.equal(healthy.failure,null);assert.equal(time.pending,0);
});

test('cleanup is bounded independently and does not replace the latched protocol failure',async()=>{
  const time=clock(),rpc=createNormalBrowserDeadline({timeoutMs:15000,timers:time.timers});
  const rejection=assert.rejects(rpc.run(()=>new Promise(()=>{}),'first failure'),error=>error===rpc.failure);
  await time.advance(15000);await rejection;const first=rpc.failure;
  const cleanup=assert.rejects(normalCleanupWithin(()=>new Promise(()=>{}),'context',{timers:time.timers}),error=>error.code==='NORMAL_PLAY_CLEANUP_TIMEOUT');
  await time.advance(4999);assert.equal(rpc.failure,first);await time.advance(1);await cleanup;
  assert.equal(rpc.failure,first);assert.equal(time.pending,0);
});

test('child exit supervision starts after terminal evidence and leaves setup/observation clocks unchanged',async()=>{
  const time=clock(),worker=child();let options;
  const operation=runNormalPlayChild('normal.mjs',{env:{EXACT:'kept'},timers:time.timers,spawnProcess(executable,args,input){assert.equal(executable,process.execPath);assert.deepEqual(args,['normal.mjs']);options=input;return worker;}});
  await time.advance(240*60000);assert.equal(time.pending,0);assert.deepEqual(worker.signals,[]);
  assert.deepEqual(options.env,{EXACT:'kept'});assert.equal(options.windowsHide,true);assert.equal(options.stdio[3],'ipc');
  worker.emit('message',{type:'v177-normal-play-complete',status:'passed',error:null});worker.emit('exit',0);
  assert.equal(await operation,0);assert.equal(time.pending,0);
});

for(const lateExit of [true,false])test(`stuck terminal child is failed after bounded exit cleanup (late exit ${lateExit})`,async()=>{
  const time=clock(),worker=child();
  const operation=runNormalPlayChild('normal.mjs',{timers:time.timers,spawnProcess:()=>worker});
  const rejection=assert.rejects(operation,error=>error.message==='Error: original saved browser timeout'&&error.childExitTimeout.code==='NORMAL_PLAY_CHILD_EXIT_TIMEOUT'&&error.childExitTimeout.graceMs===3000);
  worker.emit('message',{type:'v177-normal-play-complete',status:'failed',error:'Error: original saved browser timeout'});
  await time.advance(2999);assert.deepEqual(worker.signals,[]);await time.advance(1);assert.deepEqual(worker.signals,['SIGTERM']);
  if(lateExit)worker.emit('exit',0);
  else{await time.advance(3000);assert.deepEqual(worker.signals,['SIGTERM','SIGKILL']);await time.advance(3000);}
  await rejection;assert.equal(time.pending,0);
});

test('opening setup timeout executes the real report, browser cleanup and completion path before parent reads it',async()=>{
  const source=await readFile('scripts/v100-normal-campaign-playthrough.mjs','utf8'),ast=ts.createSourceFile('normal.mjs',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  const statement=ast.statements.find(node=>ts.isTryStatement(node));assert.ok(statement);
  for(const point of ['newContext','newPage']){
    const time=clock(),report={status:'running',stages:[],errors:[]},saved=[],completions=[];let closed=0,contextClosed=0;
    const context={newPage:()=>new Promise(()=>{}),storageState:async()=>{},close:async()=>{contextClosed++;}};
    const browser={version:()=> 'test-browser',newContext:()=>point==='newContext'?new Promise(()=>{}):Promise.resolve(context),close:async()=>{closed++;}};
    const bindings={report,persist:async()=>{saved.push(structuredClone(report));},pwaBrowserType:async()=>({launch:async()=>browser,executablePath:()=> 'test'}),
      execFileSync:()=> 'a'.repeat(40),process:{platform:'linux',version:'test'},engine:'chromium',restoredStorage:null,out:'inert',path:{join:(...values)=>values.join('/')},
      createNormalBrowserDeadline:options=>createNormalBrowserDeadline({...options,timers:time.timers}),normalCleanupWithin:(fn,label,options)=>normalCleanupWithin(fn,label,{...options,timers:time.timers}),normalProtocolTimeoutReceipt,
      normalPlayChildCompletion:summary=>completions.push(structuredClone(summary)),console:{log(){}},assert};
    const factory=new Function(...Object.keys(bindings),'return (async()=>{let browser,context,requests,rawPage,page,video,contextClose;const closeOwnedContext=()=>contextClose??=(requests?requests.closeContext(context):context.close());const rpc=createNormalBrowserDeadline({onTimeout:()=>context?normalCleanupWithin(closeOwnedContext,"timed-out opening context"):undefined});'+statement.getText(ast)+';return report;})()');
    const operation=factory(...Object.values(bindings));await time.advance(30000);const result=await operation;
    assert.equal(result.status,'failed');assert.equal(result.technicalStatus,'failed');assert.match(result.error,new RegExp(point));
    assert.equal(result.operationTimeout.timeoutMs,30000);assert.equal(closed,1);assert.equal(contextClosed,point==='newPage'?1:0);
    assert.equal(saved[0].status,'running');assert.equal(saved.at(-1).error,result.error);assert.equal(completions[0].error,result.error);
    assert.equal(bindings.process.exitCode,1);assert.equal(time.pending,0);
  }
});
