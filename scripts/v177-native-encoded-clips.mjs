import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import ffmpeg from '@ffmpeg-installer/ffmpeg';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export const NATIVE_ENCODED_LIMITS=Object.freeze({maxBytes:8388608,maxGapMs:250,maxHeadMs:250,maxTailMs:250});

export function nativeEncodedTimeline(framecrc,captureWindowMs){
 assert.ok(Number.isFinite(captureWindowMs)&&captureWindowMs>0,'Original recording window required');
 const lines=framecrc.trim().split(/\r?\n/u),streams=[];
 for(const line of lines){
  const tb=/^#tb (\d+):\s*(\d+)\/(\d+)$/u.exec(line);if(!tb)continue;
  const index=Number(tb[1]),numerator=Number(tb[2]),denominator=Number(tb[3]);
  assert.ok(numerator>0&&denominator>0,'Finite positive native timebase required');
  const type=lines.find(l=>l.startsWith(`#media_type ${index}: `))?.split(': ').at(-1);
  const codec=lines.find(l=>l.startsWith(`#codec_id ${index}: `))?.split(': ').at(-1);
  const packets=lines.filter(l=>new RegExp(`^${index},`,'u').test(l)).map(l=>{
   const fields=l.split(',').map(s=>s.trim()),dts=Number(fields[1]),pts=Number(fields[2]);
   assert.ok(fields.length>=6&&Number.isFinite(dts)&&Number.isFinite(pts),'Native packet clocks required');
   return{dts,pts};
  });
  streams.push({index,type,codec,timebase:[numerator,denominator],packets});
 }
 assert.equal(streams.length,1,'Original canvas capture must remain video-only');
 const video=streams[0];assert.equal(video.type,'video');assert.ok(video.packets.length>1,'A single poster frame is not motion evidence');
 const scale=video.timebase[0]*1000/video.timebase[1],p=video.packets;
 const gaps=p.slice(1).map((r,i)=>({fromPts:p[i].pts,toPts:r.pts,ms:(r.pts-p[i].pts)*scale}));
 const failures=[];
 if(p.some((r,i)=>i>0&&r.pts<=p[i-1].pts))failures.push('non-increasing-encoded-pts');
 if(p.some((r,i)=>i>0&&r.dts<=p[i-1].dts))failures.push('non-increasing-encoded-dts');
 const firstVideoPtsMs=p[0].pts*scale,lastVideoPtsMs=p.at(-1).pts*scale;
 const encodedSpanMs=lastVideoPtsMs-firstVideoPtsMs,headUncoveredMs=Math.max(0,firstVideoPtsMs),tailUncoveredMs=Math.max(0,captureWindowMs-encodedSpanMs);
 const gapsOver250ms=gaps.filter(g=>g.ms>NATIVE_ENCODED_LIMITS.maxGapMs);
 if(gapsOver250ms.length)failures.push('encoded-video-gap-over-250ms');
 if(headUncoveredMs>NATIVE_ENCODED_LIMITS.maxHeadMs)failures.push('encoded-head-uncovered-over-250ms');
 if(tailUncoveredMs>NATIVE_ENCODED_LIMITS.maxTailMs)failures.push('encoded-tail-uncovered-over-250ms');
 return{codec:video.codec,timebase:video.timebase,frames:p.length,maxGapMs:Math.max(...gaps.map(g=>g.ms)),gapsOver250ms,
  coverage:{captureWindowMs,firstVideoPtsMs,lastVideoPtsMs,encodedSpanMs,headUncoveredMs,tailUncoveredMs,
   formula:'max(0, original captureWindowMs - (lastPts-firstPts)*timebase); asynchronous stop-event delivery is excluded'},failures};
}

export function assertNativeEncodedBytes(bytes,clip){
 assert.ok(clip?.status==='recorded'&&clip.completed===true,'Original recorder must complete');
 assert.ok(Number.isSafeInteger(clip.bytes)&&clip.bytes>0&&clip.bytes<=NATIVE_ENCODED_LIMITS.maxBytes,'Original 8MiB limit');
 assert.equal(bytes.length,clip.bytes);assert.equal(sha(bytes),clip.sha256,'Original media bytes changed');
 assert.ok(Number.isFinite(clip.startedAt)&&Number.isFinite(clip.stopRequestedAt)&&clip.stopRequestedAt>clip.startedAt);
 assert.equal(clip.captureWindowMs,clip.stopRequestedAt-clip.startedAt,'Use the original start-to-stop-request clock');
 assert.deepEqual(clip.errors,[]);
}

export async function auditNativeEncodedReport(reportFile,{execute=spawnSync,ffmpegPath=ffmpeg.path}={}){
 const original=await readFile(reportFile),report=JSON.parse(original),directory=path.dirname(path.resolve(reportFile)),dest=path.join(directory,'encoded-clips');
 const cases=[...(report.cases??[]),...(report.manualCases??[]),...(report.outcomeCases??[])];
 assert.ok(cases.length>0,'No newly acquired native clips to verify');
 if(process.env.V177_EXPECTED_HEAD_SHA)assert.equal(report.head,process.env.V177_EXPECTED_HEAD_SHA);
 await mkdir(dest,{recursive:true});const results=[];
 const run=args=>{
  const r=execute(ffmpegPath,args,{encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024,timeout:5000});
  assert.equal(r.error,undefined,String(r.error));assert.equal(r.status,0,r.stderr);
  assert.equal(r.stderr.trim(),'','Native demux/decode errors must remain zero');return r.stdout;
 };
 for(const row of cases){
  const clip=row.nativeClip,key=row.caseId??clip?.metadata?.caseId;
  assert.match(key??'',/^forms-(?:[1-9]|1[0-2]):[a-z0-9-]+:[a-z-]+:(?:1280x720|844x390|844x340)$/u);
  const result={caseId:key,source:clip?.file??null,sourceSha256:clip?.sha256??null,failures:[]};
  try{
   const file=path.resolve(clip.file);assert.ok(file.startsWith(directory+path.sep),'Clip must belong to this report directory');
   const bytes=await readFile(file);assertNativeEncodedBytes(bytes,clip);
   assert.equal(clip.metadata.caseId,key,'Original case owner changed');
   const crc=run(['-hide_banner','-v','error','-copyts','-i',file,'-map','0:v:0','-map','0:a:0?','-c','copy','-f','framecrc','pipe:1']);
   const crcFile=path.join(dest,key.replaceAll(':','__')+'.framecrc');await writeFile(crcFile,crc,{flag:'wx'});
   result.framecrc={file:crcFile,sha256:sha(crc)};result.timeline=nativeEncodedTimeline(crc,clip.captureWindowMs);
   result.failures.push(...result.timeline.failures);
   const progress=run(['-hide_banner','-v','error','-copyts','-threads','1','-i',file,'-map','0:v:0','-vsync','0','-enc_time_base:v','1:1000','-threads','1','-progress','pipe:1','-nostats','-f','null','-']);
   const frames=Number([...progress.matchAll(/^frame=(\d+)$/gmu)].at(-1)?.[1]);
   assert.ok(progress.includes('progress=end'));assert.equal(frames,result.timeline.frames,'Decoded frames must match the native packet count');
   result.decode={frames,completed:true,errors:0,progressSha256:sha(progress)};
   result.recorderStopEventLatencyMs=clip.stoppedAt-clip.stopRequestedAt;
  }catch(error){result.failures.push(String(error));}
  result.encodedPtsVerified=result.failures.length===0;results.push(result);
  console.log(JSON.stringify({caseId:key,passed:result.encodedPtsVerified,frames:result.timeline?.frames,maxGapMs:result.timeline?.maxGapMs,failures:result.failures}));
 }
 assert.equal(sha(await readFile(reportFile)),sha(original),'The original diagnostic report must remain unchanged');
 const audit={schema:'v177-native-encoded-clips/v1',head:report.head,runId:process.env.GITHUB_RUN_ID??null,originalReport:{file:path.resolve(reportFile),sha256:sha(original)},
  limits:NATIVE_ENCODED_LIMITS,sourceSha256:sha(await readFile(new URL(import.meta.url))),results,
  summary:{cases:results.length,passed:results.filter(r=>r.encodedPtsVerified).length,failed:results.filter(r=>!r.encodedPtsVerified).length},
  thresholdRelaxed:false,deadlineRelaxed:false,originalReportRewritten:false,
  originalSpeedAccepted:false,naturalnessAccepted:false,physicalSavedAudioAccepted:false,wholeGameAccepted:false};
 await writeFile(path.join(directory,'encoded-audit.json'),JSON.stringify(audit,null,2)+'\n',{flag:'wx'});return audit;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const result=await auditNativeEncodedReport(process.argv[2]);if(result.summary.failed)process.exitCode=1;
}
