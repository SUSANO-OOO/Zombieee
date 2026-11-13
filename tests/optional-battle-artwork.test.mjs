import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {optionalBattleArtworkJobs} from '../app/optionalBattleArtwork.js';
import {runAssetLoadSession,OPTIONAL_ASSET_LOAD_DEADLINE_MS} from '../app/assetLoadSession.js';
import {loadImageWithTimeout} from '../app/boundedImageLoader.js';

const source=fs.readFileSync('app/AshfallGame.tsx','utf8');
const tree=ts.createSourceFile('AshfallGame.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const callbacks=[];
function visit(node){
  if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==='then'){
    const call=node.expression.expression;
    if(ts.isCallExpression(call)&&call.expression.getText(tree)==='runAssetLoadSession'
      &&call.arguments[0]?.getText(tree).includes('jobs: criticalJobs'))callbacks.push(node.arguments[0]);
  }
  ts.forEachChild(node,visit);
}
visit(tree);assert.equal(callbacks.length,1);
const callback=ts.transpileModule('('+callbacks[0].getText(tree)+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const object={id:'new-finale',path:'/optional.webp',category:'stage-object',optional:true};
const requiredReady={status:'ready',failures:[],completed:81,total:81,elapsedMs:10,deadlineReached:false};
function productionCompletion(optionalJobs){
  const state={ready:false,error:false,view:null,optional:null,critical:[],optionalHistory:{current:[]}};
  const context={current:()=>true,window:{clearTimeout(){}},slowTimer:null,
    assetPendingPathsRef:{current:new Set()},assetFailedPathsRef:{current:new Set()},recordSession:value=>state.critical.push(value),
    generation:7,sessionReason:'selection-change',sessionStartedAt:0,activePhaseTerminal:false,
    document:{documentElement:{dataset:{}}},finiteEnemyRuntimeQa:false,finiteVisualIntegrityQa:false,finiteHudRuntimeQa:false,
    qaMode:false,qaScenario:null,activeOperationId:'stage-6',spriteRefs:{current:{}},stageObjectRefs:{current:{}},backgroundCacheRef:{current:{}},
    setAssetsReady:value=>{state.ready=value;},setAssetError:value=>{state.error=value;},setAssetReadiness:value=>{state.view=value;},
    optionalJobs,optionalController:new AbortController(),OPTIONAL_ASSET_LOAD_DEADLINE_MS,
    optionalAssetSessionHistoryRef:state.optionalHistory,
    runAssetLoadSession:options=>{state.optional=runAssetLoadSession(options);return state.optional;}};
  return {state,complete:vm.runInNewContext(callback,context)};
}

test('actual production completion enables deployment before a delayed optional decode; its failure never changes critical readiness',async()=>{
  let rejectLoad;
  const published=[];
  const jobs=optionalBattleArtworkJobs({objects:[object],isCurrent:()=>true,onReady:(...args)=>published.push(args),
    load:()=>new Promise((_,reject)=>{rejectLoad=reject;})});
  const {state,complete}=productionCompletion(jobs);
  await complete(requiredReady);
  assert.equal(state.ready,true);assert.equal(state.error,false);assert.equal(state.view.state,'ready');
  assert.equal(state.view.total,81);assert.equal(state.critical.length,1);
  rejectLoad(Object.assign(new Error('decode failed'),{name:'ImageDecodeError'}));
  const result=await state.optional;await Promise.resolve();
  assert.equal(result.status,'error');assert.equal(result.failures[0].reason,'decode');
  assert.equal(published.length,0);assert.equal(state.ready,true);assert.equal(state.view.state,'ready');
  assert.equal(state.critical.length,1);assert.equal(state.optionalHistory.current[0].status,'error');
});

test('actual production completion still blocks a failed required image and never starts optional work',async()=>{
  const {state,complete}=productionCompletion([{...object,run:()=>assert.fail('Optional work started after required failure')}]);
  await complete({...requiredReady,status:'error',failures:[{path:'/required.webp',category:'unit',reason:'decode'}]});
  assert.equal(state.ready,false);assert.equal(state.error,true);assert.equal(state.view.state,'error');
  assert.equal(state.view.failureReason,'decode');assert.equal(state.optional,null);
});

test('a real bounded decoder resolving after rejection cannot publish optional art into the renderer',async()=>{
  let finishDecode;
  class ImageFixture{
    naturalWidth=1536;naturalHeight=1024;complete=true;
    set src(value){this.source=value;queueMicrotask(()=>this.onload?.());}
    removeAttribute(){}
    decode(){return new Promise(resolve=>{finishDecode=resolve;});}
  }
  const published=[];
  const jobs=optionalBattleArtworkJobs({objects:[object],isCurrent:()=>true,onReady:(...args)=>published.push(args),
    load:(entry,onReady,signal)=>loadImageWithTimeout({src:entry.path,onReady,signal,requireDecode:true,decodeTimeoutMs:10,
      createImage:()=>new ImageFixture()})});
  const result=await runAssetLoadSession({jobs,concurrency:1});assert.equal(result.status,'error');
  finishDecode();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(published.length,0);
});

test('cancelled or obsolete selections cannot adopt successful optional images; ordinary objects are never optional jobs',async()=>{
  for(const mode of ['cancelled','obsolete']){
    const controller=new AbortController(),published=[];let finishLoad;
    const jobs=optionalBattleArtworkJobs({objects:[object,{...object,id:'required',optional:false}],
      isCurrent:()=>mode!=='obsolete',onReady:(...args)=>published.push(args),
      load:(_object,ready)=>new Promise(resolve=>{finishLoad=()=>{ready({complete:true});resolve();};})});
    assert.equal(jobs.length,1);const running=jobs[0].run(controller.signal);
    if(mode==='cancelled')controller.abort();finishLoad();await running;assert.equal(published.length,0);
  }
});
