import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readdir,rm,rmdir,readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {auditCorrectionEncodedClip,startCorrectionRecording,assertCorrectionCaseDeadline,canContinueCompletedCorrection,assertMayoCorrectionRetreat,
  correctionCaseSelection,withCorrectionCaseContext,completeCorrectionCase} from '../scripts/v105-five-corrections-capture.mjs';
import {correctionCases,correctionCapturePart,correctionCaptureFolder} from '../scripts/v105-five-corrections-cases.mjs';
import {load as yaml} from 'js-yaml';

test('four bounded capture jobs partition every original correction exactly once without extending deadlines',async()=>{
  const workflow=yaml(await readFile('.github/workflows/five-corrections-capture.yml','utf8'));
  const rows=workflow.jobs.capture.strategy.matrix.include;
  const ids=rows.flatMap(({scope,part,name})=>{
    assert.equal(correctionCaptureFolder(scope,part),name);
    return correctionCapturePart(scope,part).map(r=>scope+':'+r.kind+':'+r.mode);
  });
  const original=['desktop','mobile390','mobile340'].flatMap(scope=>correctionCases(scope).map(r=>scope+':'+r.kind+':'+r.mode));
  assert.equal(ids.length,56);assert.equal(new Set(ids).size,56);assert.deepEqual(ids.sort(),original.sort());
  assert.equal(rows.length,4);assert.equal(workflow.jobs.capture['timeout-minutes'],15);
  assert.equal(workflow.jobs.capture.strategy['fail-fast'],false);
  assert.match(workflow.jobs.result.steps[0].run,/success/);
  assert.equal(correctionCapturePart('desktop','1').length,21);assert.equal(correctionCapturePart('desktop','2').length,21);
  for(const [scope,part]of [['desktop','3'],['mobile390','1'],['../elsewhere','all']])
    assert.throws(()=>correctionCapturePart(scope,part));
  const selected=await correctionCaseSelection('desktop',{event:{},part:'2',select:()=>({mode:'full'})});
  assert.equal(selected.part,'2');assert.deepEqual(selected.plan,correctionCapturePart('desktop','2'));
});

test('owned game cleanup precedes synchronous decode and is still performed only once',async()=>{
  const events=[],page={on(){},setDefaultTimeout(){},isClosed:()=>false};
  const browser={newContext:async()=>({newPage:async()=>page})};
  await withCorrectionCaseContext(browser,{},async(_page,close)=>{
    events.push('saved-original');await close();events.push('decode-original');
  },{audit:()=>({report:{unexpectedFailures:[]}}),deadline:async action=>action(),closeContext:async()=>{events.push('close');}});
  assert.deepEqual(events,['saved-original','close','decode-original']);
});

test('a last-fixture error delivered during cleanup cannot become a reusable recorded success',()=>{
  const row={status:'verified-awaiting-owned-cleanup',context:{completed:true,pageClosedBeforeCleanup:false}};
  completeCorrectionCase(row,1,{fatalErrors:0,now:100});assert.equal(row.status,'recorded');
  for(const [change,fatalErrors]of [[{},1],[{context:{completed:false,pageClosedBeforeCleanup:false}},0],
    [{context:{completed:true,pageClosedBeforeCleanup:true}},0],[{deadlineExpired:true},0]]){
    const bad={...row,status:'verified-awaiting-owned-cleanup',...change};
    assert.throws(()=>completeCorrectionCase(bad,1,{fatalErrors,now:100}));assert.notEqual(bad.status,'recorded');
  }
});

test('correction reuse keeps original owners and reruns all failed and affected names; unknown source stays full',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'v105-retained-'));
  const file='docs/qa/v105/five-corrections-6a-evidence.json',original=JSON.parse(await readFile(file,'utf8'));
  await mkdir(path.join(root,'scripts'));await mkdir(path.join(root,'docs/qa/v105'),{recursive:true});
  const store=async inventory=>{const bytes=JSON.stringify(inventory);await writeFile(path.join(root,file),bytes);
    await writeFile(path.join(root,'scripts/v177-native-allunit-recovery.json'),JSON.stringify({fiveCorrections:{file,
      sha256:createHash('sha256').update(bytes).digest('hex'),head:original.head,runId:original.runId}}));};
  const options={root,event:{},select:()=>({mode:'remaining'})};
  try{
    const prior=JSON.parse(execFileSync('git',['show','4c68dbfd03fe5e639b33c95f612824ab459c74d4:'+file],{encoding:'utf8',windowsHide:true}));
    await store(prior);const unfinished=await correctionCaseSelection('desktop',options);
    assert.equal(unfinished.plan.length,1);assert.equal(unfinished.retained.length,41);assert.equal(unfinished.plan[0].kind,'ranger');
    const missingPending=structuredClone(prior);missingPending.pending.pop();await store(missingPending);
    await assert.rejects(correctionCaseSelection('desktop',options),'An old unfinished case cannot be dropped');
    await store(original);const d=await correctionCaseSelection('desktop',options);
    assert.equal(d.plan.length,0);assert.equal(d.retained.length,42);assert.equal(d.source.head,original.head);
    const completed=d.retained.find(r=>r.caseId==='desktop:ranger:manual');
    assert.equal(completed.head,'4c68dbfd03fe5e639b33c95f612824ab459c74d4');assert.equal(completed.runId,'40210584508');
    const omega=d.retained.find(r=>r.caseId==='desktop:takuya-omega:enemy');
    assert.equal(omega.head,'45e46b90be77cd349670157974646dcc7f16b1cd');assert.equal(omega.runId,'40134504325');
    assert.equal(d.retained.filter(r=>r.head===original.head).length,28,'Old shared-context successes keep their original owners');
    for(const scope of ['mobile390','mobile340']){const s=await correctionCaseSelection(scope,options);assert.equal(s.plan.length,0);assert.equal(s.retained.length,7);}
    assert.equal((await correctionCaseSelection('desktop',{...options,select:()=>({mode:'full'})})).plan.length,42);
    for(const mutate of [i=>i.retained.pop(),i=>i.retained.push(i.retained[0]),i=>{i.retained[0].driftMs=120.001;},
      i=>{i.retained[0].maxGapMs=250.001;},i=>{i.retained[0].head='f'.repeat(40);},
      i=>{i.retained[0].fullAvDecode.requiredMixerAudioStream=false;},i=>{i.retained[0].caseElapsedMs=30000;},
      i=>{i.retained[0].encodedPtsVerified=false;},i=>{i.retained[0].originalStatus='failed';},
      i=>{i.retained[0].reportSha256='f'.repeat(64);},i=>{i.retained[0].artifactId=i.reports[1].artifactId;},
      i=>{i.reports[0].scope='mobile340';},i=>i.reports.push(i.reports.at(-1)),
      i=>{i.retained.at(-1).runId=original.runId;},i=>{i.retained.at(-1).reportSha256=i.reports[0].reportSha256;},
      i=>{i.retained.at(-1).originalStatus='failed';},i=>{i.retained.at(-1).maxGapMs=250.001;}]){
      const bad=structuredClone(original);mutate(bad);await store(bad);await assert.rejects(correctionCaseSelection('desktop',options));
    }
    await store(original);await writeFile(path.join(root,file),'{}');await assert.rejects(correctionCaseSelection('desktop',options));
  }finally{assert.equal(path.dirname(root),path.resolve(os.tmpdir()));await rm(root,{recursive:true,force:true});}
});

test('independent correction fixtures close every page and retain earlier product errors and cleanup failures',async()=>{
  const events=[],fatals=[],receipts=[];let count=0,failCleanup=false;
  const browser={newContext:async()=>{
    const id=++count,handlers={},page={on:(name,fn)=>{handlers[name]=fn;},setDefaultTimeout:ms=>assert.equal(ms,30000),isClosed:()=>false};
    return{id,newPage:async()=>page,handlers};}};
  const deps={onFatal:e=>fatals.push(e),onRequests:r=>receipts.push(r),audit:()=>({report:{unexpectedFailures:[]}}),
    closeContext:async context=>{events.push('close-'+context.id);if(failCleanup)throw Error('close failed');},
    deadline:async(action,_close,options)=>{assert.equal(typeof options.onDeadline,'function');return action();}};
  for(let n=1;n<=2;n++)await withCorrectionCaseContext(browser,{},async()=>{events.push('work-'+n);},deps);
  assert.deepEqual(events,['work-1','close-1','work-2','close-2']);assert.equal(receipts.length,2);
  assert.ok(receipts.every(r=>r.completed&&r.pageClosedBeforeCleanup===false));
  await assert.rejects(withCorrectionCaseContext(browser,{},async()=>{throw Error('original capture failed');},deps),/original capture failed/);
  failCleanup=true;const primary=Error('primary page failure');
  await assert.rejects(withCorrectionCaseContext(browser,{},async()=>{throw primary;},deps),e=>e===primary&&e.cleanupError.includes('close failed'));
  assert.equal(fatals.length,1);assert.equal(events.filter(e=>e==='close-4').length,1,'Close never runs twice on the same native owner');
});

test('a context created after its original deadline is closed without starting a page or capture',async()=>{
  let resolve,closed=0,pages=0,captures=0;const pending=new Promise(r=>{resolve=r;});
  const browser={newContext:()=>pending};
  const result=withCorrectionCaseContext(browser,{},async()=>{captures++;},{
    deadline:async(action,_close,{onDeadline})=>{void action().catch(()=>{});const error=Error('deadline');onDeadline(error);throw error;},
    closeContext:async()=>{closed++;}});
  await assert.rejects(result,/deadline/);
  resolve({newPage:async()=>{pages++;}});await new Promise(r=>setImmediate(r));
  assert.equal(closed,1);assert.equal(pages,0);assert.equal(captures,0);
});

test('Mayo AV cannot pass a clipped run or omit its actual current-model fall, rise and completed exit',()=>{
  const atlas='/current-feral.webp',capture={rows:['fall','rise','run'].map((phase,renderSequence)=>({fighters:[{id:7,mayoRetreat:{phase},
    draw:{renderSequence,jointDrawSucceeded:true,renderKind:'mayo-chan-feral',jointAtlasPath:atlas,
      mayoRetreatAtPaint:{phase,phaseElapsed:.02,renderKind:'mayo-chan-feral'},jointMayoRetreat:{phase,elapsed:.02,sourceAtlas:atlas}}}]})),
    final:{fighters:[],retreatCompletions:[{ownerId:7,mode:'ability',x:146,baseX:146}]}};
  assert.deepEqual(assertMayoCorrectionRetreat(capture,[7]),{phases:['fall','rise','run'],completedOwnerIds:[7]});
  const betweenPaints=structuredClone(capture.rows[0]);betweenPaints.fighters[0].mayoRetreat.phase='rise';
  const separateClocks=structuredClone(capture);separateClocks.rows.splice(1,0,betweenPaints);
  assert.deepEqual(assertMayoCorrectionRetreat(separateClocks,[7]),{phases:['fall','rise','run'],completedOwnerIds:[7]},'A simulation-only callback cannot invent a new paint or reject the last real one');
  for(const mutate of [c=>c.rows.splice(1,1),c=>{c.rows[0].fighters[0].draw.jointDrawSucceeded=false;},
    c=>{c.rows[1].fighters[0].draw.jointMayoRetreat.sourceAtlas='/old.webp';},
    c=>c.final.fighters.push({id:7}),c=>{c.final.retreatCompletions=[];}]){
    const bad=structuredClone(capture);mutate(bad);assert.throws(()=>assertMayoCorrectionRetreat(bad,[7]));
  }
});

const crc=pts=>'#tb 0: 1/1000\n#media_type 0: video\n#codec_id 0: vp8\n'+pts.map(p=>`0, ${p}, ${p}, 1, 100, 0x12345678`).join('\n')+'\n';
test('native decode cannot turn a CPU-blocked or already expired30s case into success',()=>{
  const before={};assertCorrectionCaseDeadline(before,10,30009);assert.equal(before.caseElapsedMs,29999);
  for(const [row,now]of [[{},30010],[{},35010],[{deadlineExpired:true},100]]){
    assert.throws(()=>assertCorrectionCaseDeadline(row,10,now),/30s/);assert.equal(row.deadlineExpired,true);
    assert.equal(canContinueCompletedCorrection({...row,file:'original.mp4',bytes:100,capture:{failed:null,startAt:1,stopAt:3001}},
      {pageClosed:false,fatalErrors:0,errorsBefore:0,errorsAfter:1}),false,'Expired owner must stop for context cleanup');
  }
});
test('original AV acceptance rejects native gaps, regressing timestamps, missing audio and incomplete decoding',async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'v105-original-av-'));
  try{
    const cases=[{pts:[0,100,200,300],frames:4,ok:true},
      {pts:[0,100,501,600],frames:4,ok:false},
      {pts:[0,100,100,300],frames:4,ok:false},
      {pts:[0,100,200,300],frames:4,audioError:true,ok:false},
      {pts:[0,100,200,300],frames:3,ok:false}];
    for(const [i,c]of cases.entries()){
      const calls=[],execute=(_binary,args)=>{
        calls.push(args);const demux=args.includes('framecrc');
        return{status:c.audioError&&!demux?1:0,stderr:c.audioError&&!demux?'mandatory audio stream missing':'',
          stdout:demux?crc(c.pts):`frame=${c.frames}\nprogress=end\n`};
      };
      const result=await auditCorrectionEncodedClip(path.join(directory,`${i}.webm`),{bytes:100,startAt:10,stopAt:310},{execute,ffmpegPath:'unused'});
      assert.equal(result.encodedPtsVerified,c.ok);assert.equal(result.thresholdRelaxed,false);assert.equal(result.retimed,false);assert.equal(result.reencoded,false);
      assert.deepEqual(calls[0].slice(calls[0].indexOf('-c'),calls[0].indexOf('-c')+2),['-c','copy']);
      assert.ok(calls[1].includes('0:a:0'),'Original mixer audio is mandatory');assert.ok(!calls[1].includes('0:a:0?'));
      if(c.ok)assert.equal(result.decode.videoFrames,4);else assert.ok(result.failures.length);
    }
  }finally{for(const file of await readdir(directory))await rm(path.join(directory,file));await rmdir(directory);}
});

test('mobile native MP4 preference preserves the original stream request, bitrate and single unfragmented recorder',async()=>{
  for(const [preferMp4,supported,expected]of [[false,['video/mp4','video/webm;codecs=vp8,opus'],'video/webm;codecs=vp8,opus'],
    [true,['video/mp4','video/webm;codecs=vp8,opus'],'video/mp4'],[true,['video/webm;codecs=vp8,opus'],'video/webm;codecs=vp8,opus']]){
    const ctx={ids:[1],durationMs:3000,preferMp4,requestedHz:null,options:null,startArguments:null};
    const stream={addTrack(){},getVideoTracks:()=>[{getSettings:()=>({width:844,height:340})}],getAudioTracks:()=>[{}],getTracks:()=>[]};
    const tap={stream:{getAudioTracks:()=>[{}]},release(){}};
    ctx.window={__ASHFALL_BATTLE_QA__:{getV105CorrectionAudit:()=>({fighters:[]})},__ASHFALL_AUDIO_QA__:{unlock:async()=>{},createLocalRecordingTap:()=>tap}};
    ctx.document={querySelector:()=>({captureStream:hz=>{ctx.requestedHz=hz;return stream;}})};
    ctx.performance={now:()=>100,timeOrigin:1};const callbacks=[];
    ctx.requestAnimationFrame=fn=>{callbacks.push(fn);return 1;};ctx.setTimeout=()=>1;ctx.clearTimeout=()=>{};
    const cpu={sequence:7,rafTimestamp:90,entryAt:91,exitAt:95};
    ctx.window.__ASHFALL_RUNTIME_PERFORMANCE__={frameCpuTimings:[cpu]};
    ctx.MediaRecorder=class {static isTypeSupported(type){return supported.includes(type);}constructor(_stream,options){ctx.options=options;}start(...args){ctx.startArguments=args;this.onstart();}};
    const result=await vm.runInNewContext(`(${startCorrectionRecording.toString()})({ids,durationMs,preferMp4})`,ctx);
    assert.equal(result.mime,expected);assert.equal(ctx.requestedHz,60);assert.equal(ctx.startArguments.length,0);
    assert.equal(ctx.options.videoBitsPerSecond,5000000);assert.equal(ctx.options.audioBitsPerSecond,128000);
    assert.equal(ctx.window.__V105_RECORDING__.state.audioTracks,1);
    callbacks.shift()(100);cpu.sequence=8;cpu.exitAt=105;
    const observed=ctx.window.__V105_RECORDING__.state.rows[0];
    assert.deepEqual(Array.from(observed.frameCpu),[7,90,91,null,null,null,95,null]);
    assert.equal(observed.at,100);assert.equal(observed.enteredAt,100);assert.equal(observed.observedAt,100);
  }
});
