import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readdir,rm,rmdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {auditCorrectionEncodedClip,startCorrectionRecording,assertCorrectionCaseDeadline,canContinueCompletedCorrection,assertMayoCorrectionRetreat} from '../scripts/v105-five-corrections-capture.mjs';

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
    ctx.performance={now:()=>100,timeOrigin:1};ctx.requestAnimationFrame=()=>1;ctx.setTimeout=()=>1;ctx.clearTimeout=()=>{};
    ctx.MediaRecorder=class {static isTypeSupported(type){return supported.includes(type);}constructor(_stream,options){ctx.options=options;}start(...args){ctx.startArguments=args;this.onstart();}};
    const result=await vm.runInNewContext(`(${startCorrectionRecording.toString()})({ids,durationMs,preferMp4})`,ctx);
    assert.equal(result.mime,expected);assert.equal(ctx.requestedHz,60);assert.equal(ctx.startArguments.length,0);
    assert.equal(ctx.options.videoBitsPerSecond,5000000);assert.equal(ctx.options.audioBitsPerSecond,128000);
    assert.equal(ctx.window.__V105_RECORDING__.state.audioTracks,1);
  }
});
