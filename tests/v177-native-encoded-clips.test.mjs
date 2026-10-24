import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {nativeEncodedTimeline,assertNativeEncodedBytes,NATIVE_ENCODED_LIMITS} from '../scripts/v177-native-encoded-clips.mjs';
import {auditNativeEncodedReport} from '../scripts/v177-native-encoded-clips.mjs';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {execFileSync} from 'node:child_process';import ffmpeg from '@ffmpeg-installer/ffmpeg';
const crc=(pts,dts=pts)=>'#tb 0: 1/1000\n#media_type 0: video\n#codec_id 0: vp8\n'+pts.map((p,i)=>`0, ${dts[i]}, ${p}, 1, 100, 0x00000000`).join('\n')+'\n';
test('the original native coverage limits accept 250ms exactly and reject a one-millisecond excess',()=>{
 assert.deepEqual(NATIVE_ENCODED_LIMITS,{maxBytes:8388608,maxGapMs:250,maxHeadMs:250,maxTailMs:250});
 assert.deepEqual(nativeEncodedTimeline(crc([0,250,500]),750).failures,[]);
 assert.ok(nativeEncodedTimeline(crc([0,251,500]),750).failures.includes('encoded-video-gap-over-250ms'));
 assert.ok(nativeEncodedTimeline(crc([251,300,500]),500).failures.includes('encoded-head-uncovered-over-250ms'));
 assert.ok(nativeEncodedTimeline(crc([0,250,500]),751).failures.includes('encoded-tail-uncovered-over-250ms'));
});
test('native packet clocks stay strict and a poster frame or invalid clock cannot prove motion',()=>{
 assert.ok(nativeEncodedTimeline(crc([0,0,20]),20).failures.includes('non-increasing-encoded-pts'));
 assert.ok(nativeEncodedTimeline(crc([0,10,20],[0,0,20]),20).failures.includes('non-increasing-encoded-dts'));
 assert.throws(()=>nativeEncodedTimeline(crc([0]),1000),/poster frame/u);
 assert.throws(()=>nativeEncodedTimeline(crc([0,10]).replace('1/1000','1/0'),10),/timebase/u);
 assert.throws(()=>nativeEncodedTimeline(crc([0,10]),NaN),/recording window/u);
 assert.throws(()=>nativeEncodedTimeline(crc([0,10])+'#tb 1: 1/1000\n#media_type 1: audio\n',10),/video-only/u);
});
test('end coverage uses the original capture span and retains a real leading offset',()=>{
 const result=nativeEncodedTimeline(crc([100,200,300]),450);
 assert.equal(result.coverage.headUncoveredMs,100);assert.equal(result.coverage.tailUncoveredMs,250);
 assert.deepEqual(result.failures,[]);
 assert.ok(nativeEncodedTimeline(crc([100,200,300]),451).failures.includes('encoded-tail-uncovered-over-250ms'));
});
test('encoded verification binds immutable bytes and the original stop-request boundary rather than a late stop event',()=>{
 const bytes=Buffer.from('native byte owner'),sha=createHash('sha256').update(bytes).digest('hex');
 const clip={status:'recorded',completed:true,bytes:bytes.length,sha256:sha,startedAt:100,stopRequestedAt:600,stoppedAt:900,captureWindowMs:500,errors:[]};
 assertNativeEncodedBytes(bytes,clip);
 assert.throws(()=>assertNativeEncodedBytes(Buffer.from('changed byte owner'),clip));
 assert.throws(()=>assertNativeEncodedBytes(bytes,{...clip,captureWindowMs:800}),/stop-request/u);
 assert.throws(()=>assertNativeEncodedBytes(bytes,{...clip,completed:false}),/complete/u);
 assert.throws(()=>assertNativeEncodedBytes(bytes,{...clip,bytes:8388609}),/8MiB/u);
});

test('the real demux/decode path binds a synthetic codec fixture and leaves its source report and acceptance flags intact',async()=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'v177-encoded-fixture-')),file=path.join(directory,'synthetic-only.webm');
 execFileSync(ffmpeg.path,['-hide_banner','-v','error','-f','lavfi','-i','color=c=blue:s=16x16:r=20','-frames:v','12','-c:v','libvpx',file],{windowsHide:true,stdio:['ignore','pipe','pipe']});
 const bytes=await readFile(file),caseId='forms-2:brute:attack:1280x720';
 const clip={file,status:'recorded',completed:true,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),
  startedAt:100,stopRequestedAt:700,stoppedAt:900,captureWindowMs:600,errors:[],encodedPtsVerified:false,originalSpeedAccepted:false,metadata:{caseId}};
 const reportFile=path.join(directory,'report.json'),original=JSON.stringify({head:process.env.V177_EXPECTED_HEAD_SHA??'a'.repeat(40),scope:'Synthetic codec fixture only; no game was loaded',cases:[{caseId,nativeClip:clip}]});
 await writeFile(reportFile,original);const audit=await auditNativeEncodedReport(reportFile);
 assert.equal(audit.summary.passed,1);assert.equal(audit.summary.failed,0);assert.equal(audit.results[0].decode.frames,12);
 assert.equal(await readFile(reportFile,'utf8'),original);assert.equal(audit.originalSpeedAccepted,false);assert.equal(audit.wholeGameAccepted,false);
 assert.equal(clip.encodedPtsVerified,false);
});
