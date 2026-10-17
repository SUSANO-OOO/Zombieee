import assert from 'node:assert/strict';
import { createReadStream } from 'node:fs';
import { open } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

// Serialized into an otherwise ordinary page. This owns only its passive RAF
// and listeners; no game, clock, canvas, callback or snapshot setter is patched.
export function installNormalFrameObserver() {
  let state=null;
  globalThis.__V177_READ_NORMAL_FRAMES__=function readOwnedNormalFrames(owner,action){
    if(typeof owner!=='string'||!owner)throw new Error('Frame observation owner required');
    if(!['start','drain','stop'].includes(action))throw new Error('Unknown frame observation action');
    if(action==='start'){
      if(state)throw new Error('Existing frame observation cannot be restarted or borrowed');
      const canvas=document.querySelector('.game-shell canvas');
      state={owner,startedAt:performance.now(),timeOrigin:performance.timeOrigin,capacity:4800,
        times:[],overflow:0,totalCallbacks:0,sequence:0,active:true,handle:0,visibilityEvents:[],visibilityOverflow:0,
        initialVisibility:document.visibilityState,performanceBefore:globalThis.__ASHFALL_BATTLE_QA__?.getPerformanceSnapshot?.()??null,
        canvas:canvas?{width:canvas.width,height:canvas.height,dpr:devicePixelRatio}:null};
      const current=state;
      const mark=type=>{
        if(current.visibilityEvents.length<32)current.visibilityEvents.push({type,at:performance.now(),visibilityState:document.visibilityState});
        else current.visibilityOverflow++;
      };
      current.listeners={visibilitychange:()=>mark('visibilitychange'),blur:()=>mark('blur'),pagehide:()=>mark('pagehide')};
      for(const [type,listener] of Object.entries(current.listeners))globalThis.addEventListener(type,listener,{passive:true});
      const tick=at=>{
        if(!current.active)return;
        current.totalCallbacks++;
        if(current.times.length<current.capacity)current.times.push(at);else current.overflow++;
        current.handle=requestAnimationFrame(tick);
      };
      current.handle=requestAnimationFrame(tick);
    }
    if(!state)return null;
    if(state.owner!==owner)throw new Error('Frame observation belongs to another battle');
    const current=state,stopped=action==='stop';
    if(stopped){
      current.active=false;cancelAnimationFrame(current.handle);
      for(const [type,listener] of Object.entries(current.listeners))globalThis.removeEventListener(type,listener);
    }
    const row={owner,sequence:current.sequence++,startedAt:current.startedAt,timeOrigin:current.timeOrigin,
      observedAt:performance.now(),stopped,capacity:current.capacity,times:current.times.splice(0),overflow:current.overflow,
      totalCallbacks:current.totalCallbacks,initialVisibility:current.initialVisibility,visibilityState:document.visibilityState,
      visibilityEvents:current.visibilityEvents.splice(0),visibilityOverflow:current.visibilityOverflow,canvas:current.canvas,
      performanceBefore:current.sequence===1?current.performanceBefore:undefined,
      performanceAfter:stopped?globalThis.__ASHFALL_BATTLE_QA__?.getPerformanceSnapshot?.()??null:undefined};
    if(stopped)state=null;
    return row;
  };
}

export async function createNormalFrameCapture({directory,label,owner}) {
  assert.match(label,/^[a-z0-9-]+$/u);assert.ok(typeof owner==='string'&&owner);
  const file=path.join(directory,label+'-native-frames.jsonl'),handle=await open(file,'wx');
  const intervals=[],errors=[],visibilityEvents=[];
  let successfulWriteBytes=0,chunks=0,count=0,last=null,first=null,origin=null,startedAt=null,endedAt=null,
    overflow=0,nodeOverflow=0,visibilityOverflow=0,callbacks=0,invalid=0,initialVisibility=null,
    finalVisibility=null,canvas=null,before=null,after=null,stopped=false,summary=null,lastObservedAt=null,nodeVisibilityOverflow=0,
    closing=false,finishing=null;
  const capture={
    get summary(){return summary;},
    error(error){errors.push(String(error?.message??error));},
    async record(row){
      assert.equal(summary,null,'Closed frame capture cannot accept late data');
      assert.equal(closing,false,'Closed frame capture cannot accept late data');
      const line=Buffer.from(JSON.stringify(row)+'\n');
      try{await handle.writeFile(line);}catch(error){capture.error(error);throw error;}
      successfulWriteBytes+=line.length;
      if(!row){errors.push('Missing native frame observation');return;}
      if(row.owner!==owner||row.sequence!==chunks)errors.push('Frame owner or sequence mismatch');
      if(chunks===0){origin=row.timeOrigin;startedAt=row.startedAt;initialVisibility=row.initialVisibility;canvas=row.canvas;before=row.performanceBefore??null;}
      if(row.timeOrigin!==origin||row.startedAt!==startedAt)errors.push('Native frame clock changed');
      if(!Number.isFinite(row.observedAt)||row.observedAt<0||(lastObservedAt!==null&&row.observedAt<lastObservedAt))errors.push('Native observation clock regressed');
      lastObservedAt=row.observedAt;
      if(row.capacity!==4800||!Array.isArray(row.times)||row.times.length>4800)errors.push('Invalid bounded native frame buffer');
      if(row.visibilityState!=='visible')errors.push('Native frame observation was not visible');
      if(stopped)errors.push('Native frame observation continued after stop');
      for(const at of Array.isArray(row.times)?row.times:[]){
        if(!Number.isFinite(at)||at<0||(last!==null&&at<=last))invalid++;
        if(last!==null){if(intervals.length<120000)intervals.push(at-last);else nodeOverflow++;}
        first??=at;last=at;count++;
      }
      if(!Number.isSafeInteger(row.overflow)||row.overflow<overflow)errors.push('Invalid cumulative frame overflow');
      if(!Number.isSafeInteger(row.totalCallbacks)||row.totalCallbacks<callbacks)errors.push('Invalid cumulative callback count');
      overflow=row.overflow;callbacks=row.totalCallbacks;
      if(callbacks!==count+overflow)errors.push('Native callbacks were omitted or duplicated');
      if(!Array.isArray(row.visibilityEvents)||!Number.isSafeInteger(row.visibilityOverflow)||row.visibilityOverflow<visibilityOverflow)errors.push('Invalid visibility evidence');
      const events=Array.isArray(row.visibilityEvents)?row.visibilityEvents:[],room=32-visibilityEvents.length;
      visibilityEvents.push(...events.slice(0,room));nodeVisibilityOverflow+=Math.max(0,events.length-room);visibilityOverflow=row.visibilityOverflow;
      finalVisibility=row.visibilityState;chunks++;
      if(row.stopped){stopped=true;endedAt=row.observedAt;after=row.performanceAfter??null;}
    },
    async finish(){
      if(summary)return summary;
      if(finishing)return finishing;
      closing=true;
      finishing=(async()=>{
      try{await handle.close();}catch(error){capture.error(error);}
      let bytes=null,sha256=null,verified=false;
      try{
        const hash=createHash('sha256');let actualBytes=0;
        for await(const chunk of createReadStream(file)){hash.update(chunk);actualBytes+=chunk.length;}
        bytes=actualBytes;sha256=hash.digest('hex');verified=true;
      }catch(error){capture.error(new Error('Raw frame evidence read failed: '+String(error?.message??error)));}
      const gates={stopped,clock:Number.isFinite(origin)&&origin>=0&&Number.isFinite(startedAt)&&startedAt>=0&&Number.isFinite(endedAt)&&endedAt>startedAt,
        sampleCount:count>=300,strictlyIncreasing:invalid===0,overflow:overflow===0&&nodeOverflow===0,
        visible:initialVisibility==='visible'&&finalVisibility==='visible',uninterrupted:visibilityEvents.length===0&&visibilityOverflow===0&&nodeVisibilityOverflow===0,
        canvas:Number.isFinite(canvas?.width)&&canvas.width>0&&Number.isFinite(canvas?.height)&&canvas.height>0,
        completeCallbacks:callbacks===count&&chunks>=2,rawEvidence:verified,errors:errors.length===0};
      const complete=Object.values(gates).every(Boolean),ordered=invalid===0?[...intervals].sort((a,b)=>a-b):[];
      const percentile=f=>ordered[Math.min(ordered.length-1,Math.ceil(ordered.length*f)-1)]??null;
      const medianRafMs=percentile(.5),p95RafMs=percentile(.95),renderDelta=before&&after?after.renderFrames-before.renderFrames:null;
      summary={schema:'v177-passive-normal-frame-observation/v1',owner,
        scope:'First recorded HUD/control read through the final observation read, including UI/recorder/observer overhead. Not the separate fixed30s device gate or whole-battle boundary proof.',
        status:complete?'recorded':'incomplete',raw:{file,bytes,sha256,verified,successfulWriteBytes,chunks},clock:'Native requestAnimationFrame timestamps; no resampling, filtering or per-chunk quantile averaging',
        timeOrigin:origin,startedAt,endedAt,elapsedMs:endedAt===null||startedAt===null?null:endedAt-startedAt,
        firstAt:first,lastAt:last,count,intervalCount:intervals.length,capacity:4800,overflow,nodeOverflow,invalidIntervals:invalid,
        medianRafMs,p95RafMs:complete?p95RafMs:null,partialP95RafMs:complete?null:p95RafMs,
        maxRafMs:ordered.at(-1)??null,p95ReferenceMs:33,p95WithinReference:complete&&p95RafMs!==null&&p95RafMs<=33,
        visibility:{initial:initialVisibility,final:finalVisibility,events:visibilityEvents,overflow:visibilityOverflow,nodeOverflow:nodeVisibilityOverflow},canvas,
        performanceBefore:before,performanceAfter:after,renderDelta,gates,errors,
        performanceAcceptance:false,originalSpeedAccepted:false,physicalSavedAudioAccepted:false,wholeGameAccepted:false};
      return summary;
      })();
      return finishing;
    },
  };
  return capture;
}

// Observation failure remains secondary to the original gameplay failure.
// A late stop cannot touch a different owner; the browser function checks it.
export async function finishNormalFrameCapture(page,capture,owner) {
  if(!capture)return null;if(capture.summary)return capture.summary;
  let timer;
  try{
    const row=await Promise.race([page.evaluate(owner=>globalThis.__V177_READ_NORMAL_FRAMES__?.(owner,'stop')??null,owner),
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Normal frame stop read exceeded1000ms')),1000);})]);
    await capture.record(row);
  }catch(error){capture.error(error);}
  finally{clearTimeout(timer);}
  return capture.finish();
}
