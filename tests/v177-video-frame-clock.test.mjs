import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';
import {mkdtemp,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createV177VideoFrameClock} from '../scripts/v177-video-frame-clock.mjs';

const require=createRequire(import.meta.url);
const root=path.dirname(require.resolve('playwright-core/package.json'));
const {VideoRecorder}=require(path.join(root,'lib/server/chromium/videoRecorder.js'));
function fixture(){
  const server=new EventEmitter(),writes=[];
  const recorder=new VideoRecorder(server,'unused-no-process-is-launched');
  recorder._process={stdin:{write(bytes,callback){writes.push(bytes);queueMicrotask(()=>callback());}}};
  server.delegate={_mainFrameSession:{_videoRecorder:recorder}};
  const page={_connection:{toImpl:()=>server}};
  return{server,recorder,page,writes,async frame(epochMs){server.emit('screencastframe',{buffer:Buffer.from('fixture-frame'),frameSwapWallTime:epochMs});await Promise.resolve();await recorder._lastWritePromise;}};
}
async function finish(clock){
  const dir=await mkdtemp(path.join(os.tmpdir(),'v177-clock-')),file=path.join(dir,'clock.json');
  const summary=await clock.finish({file,videoPath:'fixture.webm'});return{summary,report:JSON.parse(await readFile(file,'utf8'))};
}
test('actual pinned recorder queue exposes quantization without changing its methods or writes',async()=>{
  const f=fixture(),method=f.recorder.writeFrame;
  await f.frame(1_000_000);
  const clock=createV177VideoFrameClock(f.page,{engine:'chromium',label:'real-class-fixture'}),section=clock.beginSection({form:'scout',phase:'move'});
  for(let i=1;i<=12;i++)await f.frame(1_000_000+i*1000/30);
  clock.endSection(section);
  const {summary,report}=await finish(clock);
  assert.equal(f.recorder.writeFrame,method);assert.equal(summary.status,'observed');assert.equal(summary.frameCount,12);
  assert.equal(f.writes.length,12);assert.equal(report.sections[0].queuedFrames,f.writes.length);
  assert.ok(Math.abs(report.sections[0].nativeElapsedMs-400)<1e-7);
  assert.equal(report.sections[0].queuedElapsedMs,480);assert.ok(Math.abs(report.sections[0].queuedToNativeRatio-1.2)<1e-8);
  assert.equal(report.absoluteVideoPtsKnown,false);assert.equal(report.originalSpeedAccepted,false);
});
test('native25fps intervals remain equal and the listener is removed on finalization',async()=>{
  const f=fixture();await f.frame(2_000_000);const original=f.server.listenerCount('screencastframe');
  const clock=createV177VideoFrameClock(f.page,{engine:'chromium'}),section=clock.beginSection({phase:'attack'});
  assert.equal(f.server.listenerCount('screencastframe'),original+2);
  for(let i=1;i<=10;i++)await f.frame(2_000_000+i*40);
  clock.endSection(section);const {report}=await finish(clock);
  assert.equal(report.sections[0].queuedToNativeRatio,1);assert.equal(f.server.listenerCount('screencastframe'),original);
  await assert.rejects(clock.finish(),/already finalized/u);
});
test('missing native timestamps cannot become a valid clock',async()=>{
  const f=fixture(),clock=createV177VideoFrameClock(f.page,{engine:'chromium'});
  await f.frame(undefined);const {summary}=await finish(clock);assert.equal(summary.status,'invalid');assert.equal(summary.originalSpeedAccepted,false);
});
test('WebKit never inherits the Chromium encoder clock or requests a new screencast',async()=>{
  const page={get _connection(){assert.fail('Unsupported native engine must not be queried');}};
  const {summary}=await finish(createV177VideoFrameClock(page,{engine:'webkit'}));
  assert.equal(summary.status,'unsupported');assert.equal(summary.frameCount,0);assert.equal(summary.originalSpeedAccepted,false);
});
test('bounded observation invalidates a truncated stream rather than accepting it',async()=>{
  const f=fixture(),clock=createV177VideoFrameClock(f.page,{engine:'chromium',maxFrames:1});
  await f.frame(3_000_000);await f.frame(3_000_040);const {summary}=await finish(clock);
  assert.equal(summary.status,'invalid');assert.deepEqual(summary.anomalies,['frame-limit']);assert.equal(summary.frameCount,1);
});
test('several native frame events before one queue drain retain every actual encoder interval',async()=>{
  const f=fixture();await f.frame(4_000_000);
  const clock=createV177VideoFrameClock(f.page,{engine:'chromium'}),section=clock.beginSection({phase:'move'});
  for(let i=1;i<=3;i++)f.server.emit('screencastframe',{buffer:Buffer.from('batched-frame'),frameSwapWallTime:4_000_000+i*40});
  await f.recorder._lastWritePromise;clock.endSection(section,{completed:false});
  const {summary,report}=await finish(clock);
  assert.equal(summary.status,'observed');assert.equal(summary.frameCount,3);assert.equal(f.writes.length,3);
  assert.equal(report.sections[0].queuedFrames,3);assert.equal(report.sections[0].queuedToNativeRatio,1);
  assert.equal(report.sections[0].aborted,true,'An interrupted sampling loop must not become a completed motion segment');
});
