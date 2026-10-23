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
const generated='scripts/.v100-wk-cpu-diagnostic-generated-r1.mjs';
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
const hook={
 async begin(page){
  assert.equal(session,undefined);
  const impl=page._connection.toImpl(page);assert.equal(impl.delegate.constructor.name,'WKPage');
  session=impl.delegate._session;assert.equal(session.isDisposed(),false);
  completePromise=new Promise(resolve=>{resolveComplete=resolve;});
  session.on('ScriptProfiler.trackingStart',onStart);session.on('ScriptProfiler.trackingUpdate',onUpdate);session.on('ScriptProfiler.trackingComplete',onComplete);
  raw.bridge={delegate:impl.delegate.constructor.name,sessionId:session.sessionId};
  raw.nodeBeforeStart=performance.now();
  const result=await bounded(session.send('ScriptProfiler.startTracking',{includeSamples:true}),10000,'startTracking');
  active=true;raw.nodeAfterStart=performance.now();raw.commands.push({method:'ScriptProfiler.startTracking',params:{includeSamples:true},result});
 },
 async end(){
  if(!active)return;
  raw.nodeBeforeStop=performance.now();
  const result=await bounded(session.send('ScriptProfiler.stopTracking'),10000,'stopTracking');active=false;
  raw.commands.push({method:'ScriptProfiler.stopTracking',result});
  await bounded(completePromise,10000,'trackingComplete');raw.nodeAfterComplete=performance.now();
  assert.ok(raw.trackingComplete?.samples?.stackTraces?.length>0,'native CPU samples required');persist();
 },
 async close(){
  if(active)try{await hook.end();}catch(error){raw.cleanupErrors.push(String(error));}
  if(session){session.off('ScriptProfiler.trackingStart',onStart);session.off('ScriptProfiler.trackingUpdate',onUpdate);session.off('ScriptProfiler.trackingComplete',onComplete);}
  if(session&&!persisted)persist();
 }
};
globalThis.__V100_WK_CPU_DIAGNOSTIC__=hook;
function replaceOnce(source,from,to){assert.equal(source.split(from).length,2,from);return source.replace(from,to);}
let instrumented=replaceOnce(original,'      const measurement = await beginMeasurement(page);','      await globalThis.__V100_WK_CPU_DIAGNOSTIC__.begin(page);\n      const measurement = await beginMeasurement(page);');
instrumented=replaceOnce(instrumented,'      const raf = await endMeasurement(page);','      const raf = await endMeasurement(page);\n      await globalThis.__V100_WK_CPU_DIAGNOSTIC__.end();');
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
