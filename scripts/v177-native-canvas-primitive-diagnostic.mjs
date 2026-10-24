import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

export function sampleCanvasPrimitives({mode,count=60}) {
  return new Promise(resolve=>{
    const rows=[],startedAt=performance.now(),timeOrigin=performance.timeOrigin;
    let raf=null,timer=null,deadlineAt=null,done=false,previous=null,main=null,source=null,mainContext=null,sourceContext=null,data=null;
    const finish=(status,error=null)=>{if(done)return;done=true;if(raf!==null)cancelAnimationFrame(raf);clearTimeout(timer);
      const finishedAt=performance.now();if(status==='completed'&&deadlineAt!==null&&finishedAt>deadlineAt){status='deadline';error='Original diagnostic 15s native deadline exceeded';}
      resolve({mode,count,status,error,startedAt,finishedAt,deadlineAt,timeOrigin,visible:document.visibilityState,
        mainAttributes:mainContext?.getContextAttributes?.()??null,sourceAttributes:sourceContext?.getContextAttributes?.()??null,
        sourceType:source?.constructor?.name??null,rows});};
    try{
      if(mode!=='empty-raf'){
        main=document.createElement('canvas');main.width=844;main.height=340;document.body.append(main);
        mainContext=main.getContext('2d',{alpha:false,desynchronized:true});
        if(!mainContext)throw Error('Main Canvas2D unavailable');
        if(mode==='offscreen-image-data'){
          if(typeof OffscreenCanvas!=='function'){finish('unsupported','OffscreenCanvas unavailable');return;}
          source=new OffscreenCanvas(45,45);
        }else{source=document.createElement('canvas');source.width=45;source.height=45;}
        sourceContext=source.getContext('2d',{willReadFrequently:true});
        if(!sourceContext){finish('unsupported','Source Canvas2D unavailable');return;}
        data=sourceContext.createImageData(45,45);
        for(let i=0;i<data.data.length;i+=4){data.data[i]=73;data.data[i+1]=126;data.data[i+2]=161;data.data[i+3]=255;}
      }
      deadlineAt=performance.now()+15000;timer=setTimeout(()=>finish('deadline','Original diagnostic 15s observation bound'),15000);
      const step=timestamp=>{
        if(done)return;
        const entryAt=performance.now(),row={sequence:rows.length+1,rafTimestamp:timestamp,entryAt,
          intervalMs:previous===null?null:timestamp-previous,putStartedAt:null,putFinishedAt:null,drawFinishedAt:null,exitAt:null};
        previous=timestamp;
        try{
          if(sourceContext){
            data.data[0]=row.sequence%256;
            row.putStartedAt=performance.now();sourceContext.putImageData(data,0,0,0,0,45,45);row.putFinishedAt=performance.now();
            mainContext.fillStyle='#15232e';mainContext.fillRect(0,0,844,340);
            mainContext.drawImage(source,360+(row.sequence%20),180,45,45);row.drawFinishedAt=performance.now();
          }
          row.exitAt=performance.now();rows.push(row);
          if(rows.length===count)finish('completed');else raf=requestAnimationFrame(step);
        }catch(error){row.exitAt=performance.now();rows.push(row);finish('failed',String(error));}
      };
      raf=requestAnimationFrame(step);
    }catch(error){finish('failed',String(error));}
  });
}

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',windowsHide:true}).trim();
export const metrics=rows=>{const summarize=values=>{const v=values.filter(Number.isFinite).sort((a,b)=>a-b);return{count:v.length,
  p50Ms:v[Math.max(0,Math.ceil(v.length*.5)-1)]??null,p95Ms:v[Math.max(0,Math.ceil(v.length*.95)-1)]??null,maxMs:v.at(-1)??null};};
  const durations=(start,end)=>rows.filter(r=>Number.isFinite(r[start])&&Number.isFinite(r[end])&&r[end]>=r[start]).map(r=>r[end]-r[start]);
  return{raf:summarize(rows.map(r=>r.intervalMs)),callback:summarize(durations('entryAt','exitAt')),
    put:summarize(durations('putStartedAt','putFinishedAt')),draw:summarize(durations('putFinishedAt','drawFinishedAt'))};};
export async function within(task,label,ms=30000){let timer;try{return await Promise.race([Promise.resolve().then(task),
  new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' exceeded original diagnostic '+ms+'ms bound')),ms);})]);}finally{clearTimeout(timer);}}

async function main(){
  const local=process.argv.includes('--local-edge'),verify=process.argv.includes('--verify-only');
  const out=path.resolve(process.env.V177_PRIMITIVE_OUT??'output/playwright/native-canvas-primitive-r1');
  fs.mkdirSync(out,{recursive:true});
  const head=git('rev-parse','HEAD'),productHead='d62d67615fb1d5e551528cde2a384cdae2018ef8';
  const report={schema:'native-canvas-primitive-diagnostic/v1',head,productHead,at:new Date().toISOString(),platform:process.platform,arch:process.arch,
    scriptSha256:sha(fs.readFileSync(new URL(import.meta.url))),scope:{productAcceptance:false,normalAcceptance:false,formal33msAcceptance:false,
      noGameOrSaveOrInput:true,noProductChange:true,sixtyNativeSamples:true,original33msReferenceUnchanged:true,published:false},cases:[],status:'running'};
  if(!local&&!verify){assert.equal(process.platform,'darwin');assert.equal(process.arch,'x64');assert.equal(head,process.env.EXPECTED_HEAD);
    for(const dir of ['app','public','assets'])assert.equal(git('rev-parse',head+':'+dir),git('rev-parse',productHead+':'+dir));
    for(const file of ['package.json','package-lock.json','scripts/pwa-native-runtime/package.json','scripts/pwa-native-runtime/package-lock.json'])
      assert.equal(git('rev-parse',head+':'+file),git('rev-parse',productHead+':'+file));}
  const persist=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  persist();
  if(verify){report.status='verified-only';persist();return;}
  let failed=false;
  try{for(const runtime of local?['local-edge']:['root','native']){
    const modulePath=runtime==='native'?'scripts/pwa-native-runtime/node_modules/playwright/index.mjs':'node_modules/playwright/index.mjs';
    const pkg=JSON.parse(fs.readFileSync(path.resolve(path.dirname(modulePath),'package.json'))),library=await import(pathToFileURL(path.resolve(modulePath)).href);
    assert.equal(pkg.version,runtime==='native'?'1.63.0':'1.56.1');
    const browserType=runtime==='local-edge'?library.chromium:library.webkit;let binding=null;
    if(!local){
      const manifestFile=path.resolve(path.dirname(modulePath),'..','playwright-core','browsers.json'),manifestBytes=fs.readFileSync(manifestFile);
      const definition=JSON.parse(manifestBytes).browsers.find(r=>r.name==='webkit'),revision=runtime==='native'?'2359':'2215',version=runtime==='native'?'26.6':'26.0';
      assert.equal(definition.revision,revision);assert.equal(definition.browserVersion,version);
      const executable=fs.realpathSync(browserType.executablePath());assert.ok(executable.split(path.sep).includes('webkit-'+revision));
      binding={revision,version,executable,manifestSha256:sha(manifestBytes)};
    }
    let browser,stopRuntime=false;
    try{browser=await within(()=>browserType.launch({headless:true,...(local?{channel:'msedge'}:{})}),'browser launch');}
    catch(error){report.status='failed';report.launchFailure={runtime,error:String(error)};persist();throw error;}
    try{
      if(binding)assert.equal(browser.version(),binding.version);
      for(const mode of ['empty-raf','html-image-data','offscreen-image-data']){
        const row={runtime,packageVersion:pkg.version,browserVersion:browser.version(),binding,mode,errors:[],status:'running'};report.cases.push(row);persist();
        let context,page;
        try{
          context=await within(()=>browser.newContext({viewport:{width:844,height:340},isMobile:true,hasTouch:true}),'context setup');
          page=await within(()=>context.newPage(),'page setup');
          page.on('pageerror',error=>row.errors.push(String(error)));page.on('console',message=>{if(message.type()==='error')row.errors.push(message.text());});
          await within(()=>page.setContent('<!doctype html><meta charset="utf-8"><title>Native canvas primitive diagnostic</title><body style="margin:0;background:#15232e"></body>'),'page content');
          row.raw=await within(()=>page.evaluate(sampleCanvasPrimitives,{mode,count:60}),'native observation');
          row.metrics=metrics(row.raw.rows);row.status=row.raw.status;
          if(row.status==='completed'){
            assert.equal(row.raw.rows.length,60);assert.equal(row.raw.visible,'visible');
            for(let i=0;i<row.raw.rows.length;i++){const sample=row.raw.rows[i];assert.equal(sample.sequence,i+1);assert.ok(sample.entryAt<=sample.exitAt);
              if(i)assert.ok(sample.rafTimestamp>row.raw.rows[i-1].rafTimestamp);}
          }else if(row.status!=='unsupported')failed=true;
          assert.deepEqual(row.errors,[]);
        }catch(error){row.status='failed';row.error=String(error);failed=true;}
        finally{persist();row.cleanup={owner:context?'owned-context':'context-not-returned',startedAt:new Date().toISOString(),completedAt:null,error:null};persist();
          try{if(context)await within(()=>context.close(),'context cleanup');row.cleanup.completedAt=new Date().toISOString();}
          catch(error){row.cleanup.error=String(error);row.status='failed';failed=true;stopRuntime=true;}persist();}
        if(stopRuntime)break;
      }
    }finally{report.runtimeCleanup??=[];const cleanup={runtime,startedAt:new Date().toISOString(),completedAt:null,error:null};report.runtimeCleanup.push(cleanup);persist();
      try{await within(()=>browser.close(),'browser cleanup');cleanup.completedAt=new Date().toISOString();}
      catch(error){cleanup.error=String(error);failed=true;stopRuntime=true;}persist();}
    if(stopRuntime)break;
  }}catch(error){report.fatalError=String(error);failed=true;persist();}
  report.status=failed?'failed':'observed';persist();console.log(JSON.stringify({head,status:report.status,cases:report.cases.map(({runtime,mode,status,metrics})=>({runtime,mode,status,metrics}))}));
  if(failed)process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await main();
