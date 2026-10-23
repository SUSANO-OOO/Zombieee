import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const hash=value=>createHash('sha256').update(value).digest('hex');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',windowsHide:true}).trim();
const product='1c2e0bb1c391747d1d8e776193f37c409e4e56ef';
const runner='scripts/v100-device-runtime-browser.mjs';
const original=fs.readFileSync(runner,'utf8');
assert.equal(hash(original),'454ae22b1d676032f994a96a678752a174a0365ec38a4e3e708410acbfd6be1a');
assert.equal(process.env.V100_DEVICE_RUNTIME_ENGINE,'webkit');
assert.equal(process.env.V100_DEVICE_RUNTIME_VIEWPORT,'1280x720');
assert.equal(process.env.V100_DEVICE_RUNTIME_BENCHMARK_PREPARATION,undefined,'CPU diagnostic leaves host indexing unchanged');
assert.equal(git('status','--porcelain','--','app','public','package.json','package-lock.json',runner,'scripts/v100-normal-tactical-input.mjs'),'','product/driver worktree must be clean');
for(const file of ['app','public','package.json','package-lock.json',runner,'scripts/v100-normal-tactical-input.mjs'])
 assert.equal(git('rev-parse','HEAD:'+file),git('rev-parse',product+':'+file),'unmodified product/driver '+file);
const out=path.resolve(process.env.V100_DEVICE_RUNTIME_OUT);
const generated='scripts/.v100-wk-cpu-diagnostic-generated-r2.mjs';
assert.ok(!fs.existsSync(generated));
const raw={diagnosticOnly:true,acceptance:false,product,head:git('rev-parse','HEAD'),runnerSha256:hash(original),
 scope:'One original 30-second S25 window plus native WebKit ScriptProfiler. Host indexing is observed and left unchanged; sampling overhead and unprepared host mean this is never formal performance acceptance or a like-for-like host timing comparison. Original input, viewport, workload, clock, thresholds and failure remain.',
 sampleTimestampCaution:'Protocol timestamps are retained verbatim; capability probe showed zero/pre-start timestamps. Do not filter or align sample timestamps without validation.',
 trackingStart:null,trackingUpdates:[],trackingComplete:null,commands:[],errors:[],cleanupErrors:[]};
let session,active=false,completePromise,resolveComplete,persisted=false;
const onStart=value=>{raw.trackingStart=value;};
const onUpdate=value=>{raw.trackingUpdates.push(value);};
const onComplete=value=>{raw.trackingComplete=value;resolveComplete(value);};
async function bounded(promise,ms,label){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' exceeded '+ms+'ms')),ms);})]);}finally{clearTimeout(timer);}}
function persist(){
 if(persisted)return;
 fs.writeFileSync(path.join(out,'cpu-profile-raw.json'),JSON.stringify(raw)+'\n',{flag:'wx'});
 persisted=true;
}

// Draft diagnostic functions. Each export is self-contained for page.evaluate.
// No product acceptance is inferred from either the hook or this microbenchmark.
function install({ownerToken}) {
  const key='__V100_WK_UPLOAD_PROBE_DRAFT_R1__';
  if(!['127.0.0.1','localhost','::1','[::1]'].includes(location.hostname))throw Error('Local diagnostic page required');
  if(typeof ownerToken!=='string'||!ownerToken||ownerToken.length>200)throw Error('Explicit bounded ownerToken required');
  if(Object.hasOwn(globalThis,key))throw Error('Upload probe owner already present');
  const prototype=CanvasRenderingContext2D.prototype;
  const descriptor=Object.getOwnPropertyDescriptor(prototype,'putImageData');
  if(typeof descriptor?.value!=='function')throw Error('Original putImageData value descriptor required');
  const original=descriptor.value,contexts=new WeakMap();
  const state={ownerToken,prototype,descriptor,original,wrapped:null,contextSequence:0,
    records:[],sequence:0,maxRecords:12000,overflow:0,observerErrors:[],observerErrorOverflow:0,
    installedAt:performance.now(),stoppedAt:null,restored:false,last:null,benchmarkUsed:false};
  const observerError=error=>{
    let message='Observer metadata failure';try{message=String(error).slice(0,500);}catch{}
    if(state.observerErrors.length<16)state.observerErrors.push(message);else state.observerErrorOverflow++;
  };
  function wrapped(...args) {
    let startedAt=null,succeeded=false,error;
    try{startedAt=performance.now();}catch(metadataError){observerError(metadataError);}
    try {const value=Reflect.apply(original,this,args);succeeded=true;return value;}
    catch(originalError){error=originalError;throw originalError;}
    finally {
      // Metadata runs after the native call. Observer errors must never alter
      // its return value, exception identity or original argument list.
      try {
        const endedAt=performance.now();
        let context=contexts.get(this);
        if(!context){context={id:++state.contextSequence,attributes:this.getContextAttributes?.()??null};contexts.set(this,context);}
        const image=args[0],row={sequence:++state.sequence,contextId:context.id,
          startedAt,endedAt,nativeDurationMs:endedAt-startedAt,succeeded,
          argumentCount:args.length,imageWidth:image?.width??null,imageHeight:image?.height??null,
          imageByteLength:image?.data?.byteLength??null,colorSpace:image?.colorSpace??null,
          canvasWidth:this.canvas?.width??null,canvasHeight:this.canvas?.height??null,
          dx:args[1]??null,dy:args[2]??null,dirtyX:args[3]??null,dirtyY:args[4]??null,
          dirtyWidth:args[5]??null,dirtyHeight:args[6]??null,
          surfaceAttributes:context.attributes,error:succeeded?null:String(error).slice(0,500)};
        if(state.records.length<state.maxRecords)state.records.push(row);else state.overflow++;
        if(succeeded&&args.length===7&&args[1]===0&&args[2]===0&&args[3]===0&&args[4]===0
          &&Number.isSafeInteger(args[5])&&args[5]>0&&Number.isSafeInteger(args[6])&&args[6]>0)
          state.last={context:this,image,args:args.slice(),row};
      }catch(metadataError){observerError(metadataError);}
    }
  }
  state.wrapped=wrapped;
  Object.defineProperty(prototype,'putImageData',{...descriptor,value:wrapped});
  Object.defineProperty(globalThis,key,{value:state,writable:false,enumerable:false,configurable:true});
  return {diagnosticOnly:true,acceptance:false,ownerToken,installedAt:state.installedAt,maxRecords:12000,
    delegate:'Reflect.apply(original, this, originalArguments), synchronously',originalName:original.name};
}

function stop({ownerToken}) {
  const key='__V100_WK_UPLOAD_PROBE_DRAFT_R1__',state=globalThis[key];
  if(!state||state.ownerToken!==ownerToken)throw Error('Foreign or missing upload-probe owner');
  let restorationError=null;
  const current=Object.getOwnPropertyDescriptor(state.prototype,'putImageData');
  if(state.restored){
    if(current?.value!==state.original)restorationError='Original method changed after restoration';
  }else if(current?.value!==state.wrapped||current.writable!==state.descriptor.writable
    ||current.enumerable!==state.descriptor.enumerable||current.configurable!==state.descriptor.configurable){
    restorationError='Foreign replacement detected; it was not overwritten';
  }else {
    try{
      Object.defineProperty(state.prototype,'putImageData',state.descriptor);
      const restored=Object.getOwnPropertyDescriptor(state.prototype,'putImageData');
      state.restored=restored?.value===state.original&&restored.writable===state.descriptor.writable
        &&restored.enumerable===state.descriptor.enumerable&&restored.configurable===state.descriptor.configurable;
      if(!state.restored)restorationError='Original method descriptor was not restored';
    }catch(error){restorationError=String(error).slice(0,500);}
  }
  state.stoppedAt=performance.now();
  return {diagnosticOnly:true,acceptance:false,ownerToken,installedAt:state.installedAt,stoppedAt:state.stoppedAt,
    restored:state.restored,restorationError,totalCalls:state.sequence,maxRecords:state.maxRecords,
    retained:state.records.length,overflow:state.overflow,observerErrors:[...state.observerErrors],
    observerErrorOverflow:state.observerErrorOverflow,records:state.records.map(x=>({...x,
      surfaceAttributes:x.surfaceAttributes?{...x.surfaceAttributes}:null})),last:state.last?{...state.last.row}:null};
}

// Call synchronously in the SAME page.evaluate as stop(), before yielding to a
// new RAF. A diagnostic-only Float32 workspace must already exist before this
// function. It is not proof that the actual product painter's p.sample is used.
function benchmark({ownerToken,workspace}) {
  const key='__V100_WK_UPLOAD_PROBE_DRAFT_R1__',state=globalThis[key];
  if(!state||state.ownerToken!==ownerToken||!state.restored)throw Error('Stopped/restored upload-probe owner required');
  if(Object.getOwnPropertyDescriptor(state.prototype,'putImageData')?.value!==state.original)throw Error('Foreign method after stop');
  if(state.benchmarkUsed)throw Error('One benchmark per captured owner');
  state.benchmarkUsed=true;
  const last=state.last;if(!last)throw Error('No successful original seven-argument upload captured');
  const originalImage=last.image,width=originalImage.width,height=originalImage.height;
  const w=last.args[5],h=last.args[6];
  if(![width,height,w,h].every(x=>Number.isSafeInteger(x)&&x>0)||w>width||h>height)throw Error('Finite contained integer extent required');
  if(width*height*2>65536)throw Error('Diagnostic source-surface pair exceeds unchanged combined pixel cap');
  if(!(workspace instanceof Float32Array)||workspace.length<width*height*4)throw Error('Existing sufficiently sized Float32 workspace required');
  if(workspace.buffer===originalImage.data.buffer)throw Error('Workspace must not overwrite original ImageData');
  if(last.row.surfaceAttributes?.willReadFrequently!==true)throw Error('Expected original source surface hint true');
  const bytes=new Uint8ClampedArray(workspace.buffer,workspace.byteOffset,w*h*4);
  const tight=new ImageData(bytes,w,h,{colorSpace:originalImage.colorSpace??'srgb'});
  if(tight.data.buffer!==workspace.buffer)throw Error('Tight ImageData unexpectedly copied the workspace buffer');
  const make=(cw,ch,hint)=>{
    const canvas=document.createElement('canvas');canvas.width=cw;canvas.height=ch;
    try{const context=canvas.getContext('2d',{willReadFrequently:hint});
      if(!context)throw Error('Diagnostic 2D context unavailable');return {canvas,context};
    }catch(error){canvas.width=0;canvas.height=0;throw error;}
  };
  const sources=[],trials=[];let sink;
  const pack=()=>{for(let y=0;y<h;y++)bytes.set(originalImage.data.subarray(y*width*4,(y*width+w)*4),y*w*4);};
  const compare=(a,b)=>{if(a.length!==b.length)return {equal:false,lengthA:a.length,lengthB:b.length};
    let mismatches=0,maxDelta=0,first=null;for(let i=0;i<a.length;i++)if(a[i]!==b[i]){mismatches++;maxDelta=Math.max(maxDelta,Math.abs(a[i]-b[i]));first??={at:i,a:a[i],b:b[i]};}
    return {equal:mismatches===0,bytes:a.length,mismatches,maxDelta,first};};
  const cropOriginal=()=>{const result=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)result.set(originalImage.data.subarray(y*width*4,(y*width+w)*4),y*w*4);return result;};
  try {
    sources.push(make(width,height,true));sources.push(make(width,height,true));sink=make(w,h,false);
    for(const x of sources)if(x.context.getContextAttributes?.()?.willReadFrequently!==true)throw Error('Source context hint true was not applied');
    // ABBA, repeated 16 groups in each of four blocks: 256 bounded trials.
    // Packing is timed separately and included in B's total. No getImageData,
    // pixel digest, new ArrayBuffer or asynchronous work occurs in the timed region.
    for(let block=0;block<4;block++)for(let group=0;group<16;group++)for(const variant of ['A','B','B','A']){
      const index=variant==='A'?0:1,target=sources[index];
      const resetStartedAt=performance.now();sink.context.clearRect(0,0,w,h);const startedAt=performance.now();
      if(variant==='B')pack();const packedAt=performance.now();
      if(variant==='A')Reflect.apply(state.original,target.context,[originalImage,0,0,0,0,w,h]);
      else Reflect.apply(state.original,target.context,[tight,0,0]);
      const uploadedAt=performance.now();
      sink.context.drawImage(target.canvas,0,0,w,h,0,0,w,h);const endedAt=performance.now();
      trials.push({block,group,variant,resetStartedAt,startedAt,packedAt,uploadedAt,endedAt,
        resetMs:startedAt-resetStartedAt,packMs:packedAt-startedAt,putMs:uploadedAt-packedAt,
        drawImageMs:endedAt-uploadedAt,totalMs:endedAt-startedAt});
    }
    // The following copies/readbacks are AFTER all timing. They are explicit
    // diagnostic allocations; the timed packing path adds no ArrayBuffer.
    pack();const packedComparison=compare(cropOriginal(),bytes);
    const a=sources[0].context.getImageData(0,0,width,height).data;
    const b=sources[1].context.getImageData(0,0,width,height).data;
    const sourceComparison=compare(a,b);
    sink.context.clearRect(0,0,w,h);sink.context.drawImage(sources[0].canvas,0,0,w,h,0,0,w,h);
    const finalA=sink.context.getImageData(0,0,w,h).data;
    sink.context.clearRect(0,0,w,h);sink.context.drawImage(sources[1].canvas,0,0,w,h,0,0,w,h);
    const finalB=sink.context.getImageData(0,0,w,h).data,finalComparison=compare(finalA,finalB);
    return {diagnosticOnly:true,acceptance:false,ownerToken,lastUpload:{...last.row},
      retained:{width,height,pixels:width*height,bytes:originalImage.data.byteLength},active:{width:w,height:h,pixels:w*h},
      retainedToActiveRatio:width*height/(w*h),sourceCanvasCount:2,combinedSourceCanvasPixels:width*height*2,
      sinkCanvas:{width:w,height:h,hint:false,role:'Neutral diagnostic crop sink; no game canvas or clip/filter changed'},
      sourceAttributes:sources.map(x=>x.context.getContextAttributes?.()??null),sinkAttributes:sink.context.getContextAttributes?.()??null,
      workspace:{type:workspace.constructor.name,byteOffset:workspace.byteOffset,byteLength:workspace.byteLength,
        tightByteLength:bytes.byteLength,sameBuffer:tight.data.buffer===workspace.buffer,
        ownership:'Caller supplied diagnostic workspace; actual private painter p.sample is not accessible to the prototype hook'},
      schedule:{blocks:4,groupsPerBlock:16,order:'ABBA',trials:trials.length,warmups:0},trials,
      packedComparison,sourceComparison,finalComparison,
      pixelControlPassed:packedComparison.equal&&sourceComparison.equal&&finalComparison.equal,
      limitation:'One last successful payload only. Native synchronous API time can include allocation/conversion/synchronization; no inference of full-source conversion, GPU/host cause or 33ms acceptance.'};
  } finally {
    for(const x of sources){x.canvas.width=0;x.canvas.height=0;}
    if(sink){sink.canvas.width=0;sink.canvas.height=0;}
    state.last=null;delete globalThis[key];
  }
}

// Use after stop if no benchmark will be attempted (including operation error).
function release({ownerToken}) {
  const key='__V100_WK_UPLOAD_PROBE_DRAFT_R1__',state=globalThis[key];
  if(!state)return {released:true,alreadyMissing:true};
  if(state.ownerToken!==ownerToken)throw Error('Foreign upload-probe release owner');
  if(!state.restored||Object.getOwnPropertyDescriptor(state.prototype,'putImageData')?.value!==state.original)
    throw Error('Unrestored/foreign hook cannot be silently released');
  state.last=null;delete globalThis[key];return {released:true};
}

const uploadOwner='wk-upload-'+raw.head;let uploadPage=null,uploadProbeFinished=false;
const finishUploadProbe=new Function('arg',`const stop=${stop.toString()},benchmark=${benchmark.toString()},release=${release.toString()};const result={stop:null,micro:null,error:null,release:null};try{result.stop=stop(arg);if(!result.stop.restored)throw Error(result.stop.restorationError);const last=result.stop.last;if(!last)throw Error('Missing original seven-argument upload');const workspace=new Float32Array(last.imageWidth*last.imageHeight*4);result.diagnosticWorkspaceBytes=workspace.byteLength;result.micro=benchmark({...arg,workspace});}catch(error){result.error={error:String(error),stack:error.stack};}finally{try{result.release=release(arg);}catch(error){result.release={error:String(error)};}}return result;`);
async function finishUpload(windowBounds=null){if(!uploadPage||uploadProbeFinished)return;const result=await uploadPage.evaluate(finishUploadProbe,{ownerToken:uploadOwner});uploadProbeFinished=true;fs.writeFileSync(path.join(out,'upload-probe.json'),JSON.stringify({at:new Date().toISOString(),diagnosticOnly:true,acceptance:false,windowBounds,diagnosticWorkspace:'One new buffer outside the recorded window; not actual private painter p.sample',result})+'\n',{flag:'wx'});assert.equal(result.error,null,'micro diagnostic failed');assert.equal(result.stop?.restored,true);assert.equal(result.stop?.overflow,0);assert.deepEqual(result.stop?.observerErrors,[]);assert.equal(result.stop?.observerErrorOverflow,0);assert.equal(result.micro?.pixelControlPassed,true);assert.equal(result.release?.released,true);}

const hook={
 async begin(page){
  assert.equal(session,undefined);uploadPage=page;await page.evaluate(install,{ownerToken:uploadOwner});
  const impl=page._connection.toImpl(page);assert.equal(impl.delegate.constructor.name,'WKPage');
  session=impl.delegate._session;assert.equal(session.isDisposed(),false);
  completePromise=new Promise(resolve=>{resolveComplete=resolve;});
  session.on('ScriptProfiler.trackingStart',onStart);session.on('ScriptProfiler.trackingUpdate',onUpdate);session.on('ScriptProfiler.trackingComplete',onComplete);
  raw.bridge={delegate:impl.delegate.constructor.name,sessionId:session.sessionId};
  raw.nodeBeforeStart=performance.now();
  const result=await bounded(session.send('ScriptProfiler.startTracking',{includeSamples:true}),10000,'startTracking');
  active=true;raw.nodeAfterStart=performance.now();raw.commands.push({method:'ScriptProfiler.startTracking',params:{includeSamples:true},result});
 },
 async end(windowBounds=null){
  if(!active)return;
  raw.nodeBeforeStop=performance.now();
  const result=await bounded(session.send('ScriptProfiler.stopTracking'),10000,'stopTracking');active=false;
  raw.commands.push({method:'ScriptProfiler.stopTracking',result});
  await bounded(completePromise,10000,'trackingComplete');raw.nodeAfterComplete=performance.now();
  assert.ok(raw.trackingComplete?.samples?.stackTraces?.length>0,'native CPU samples required');persist();await finishUpload(windowBounds);
 },
 async close(){
  if(uploadPage&&!uploadProbeFinished&&!active)try{await finishUpload();}catch(error){raw.cleanupErrors.push(String(error));}
  if(active)try{await hook.end();}catch(error){raw.cleanupErrors.push(String(error));}
  if(session){session.off('ScriptProfiler.trackingStart',onStart);session.off('ScriptProfiler.trackingUpdate',onUpdate);session.off('ScriptProfiler.trackingComplete',onComplete);}
  if(session&&!persisted)persist();
 }
};
globalThis.__V100_WK_CPU_DIAGNOSTIC__=hook;
function replaceOnce(source,from,to){assert.equal(source.split(from).length,2,from);return source.replace(from,to);}
let instrumented=replaceOnce(original,'      const measurement = await beginMeasurement(page);','      await globalThis.__V100_WK_CPU_DIAGNOSTIC__.begin(page);\n      const measurement = await beginMeasurement(page);');
instrumented=replaceOnce(instrumented,'      const raf = await endMeasurement(page);','      const raf = await endMeasurement(page);\n      await globalThis.__V100_WK_CPU_DIAGNOSTIC__.end({startedAt:measurement.startedAt,endedAt:raf.endedAt});');
instrumented=replaceOnce(instrumented,'      await context.close();','      await globalThis.__V100_WK_CPU_DIAGNOSTIC__.close();\n      await context.close();');
instrumented=replaceOnce(instrumented,'  results: [],','  results: [],\n  scriptProfiler: {diagnosticOnly:true,acceptance:false,reason:"Native CPU sampling overhead; original gates retained as observations only"},');
instrumented=replaceOnce(instrumented,'await mkdir(path.dirname(evidenceDir)',
 'report.measurement.representative=false;report.measurement.diagnosticOnly=true;\nawait mkdir(path.dirname(evidenceDir)');
fs.writeFileSync(generated,instrumented,{flag:'wx'});
try{
 await import(pathToFileURL(path.resolve(generated)).href);
}catch(error){raw.errors.push({error:String(error),stack:error.stack});throw error;}
finally{
 await hook.close();
 if(fs.existsSync(out)){
  fs.writeFileSync(path.join(out,'instrumented-driver.mjs'),instrumented,{flag:'wx'});
  fs.cpSync('dist/client/assets',path.join(out,'built-client-assets'),{recursive:true,errorOnExist:true,force:false});
  fs.writeFileSync(path.join(out,'cpu-profile-ownership.json'),JSON.stringify({diagnosticOnly:true,acceptance:false,product,head:raw.head,productTrees:Object.fromEntries(['app','public','package.json','package-lock.json'].map(f=>[f,git('rev-parse','HEAD:'+f)])),originalRunnerSha256:hash(original),instrumentedRunnerSha256:hash(instrumented),profile:fs.existsSync(path.join(out,'cpu-profile-raw.json'))?{bytes:fs.statSync(path.join(out,'cpu-profile-raw.json')).size,sha256:hash(fs.readFileSync(path.join(out,'cpu-profile-raw.json')))}:null,errors:raw.errors,cleanupErrors:raw.cleanupErrors},null,2)+'\n',{flag:'wx'});
 }
 assert.equal(hash(fs.readFileSync(generated)),hash(instrumented));fs.unlinkSync(generated);
 delete globalThis.__V100_WK_CPU_DIAGNOSTIC__;
}
