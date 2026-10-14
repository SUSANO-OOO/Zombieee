import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';

// These two functions execute only in the existing hosted game page. They
// capture its original canvas track; no copied frames, playback, game-clock
// changes, microphone, audio routing or encoder-frame-rate override is used.
export function startNativeCanvasClip(canvas,{metadata,maxBytes=8*1024*1024,maxMs=15_000,stopMs=3_000}){
  const state={metadata,width:canvas?.width,height:canvas?.height,timeOrigin:performance.timeOrigin,
    requestedAt:performance.now(),startedAt:null,stopRequestedAt:null,stoppedAt:null,
    status:'starting',mimeType:null,chunks:[],bytes:0,dataEvents:[],errors:[],maxBytes,stopMs};
  let resolveStopped;
  state.stopped=new Promise(resolve=>{resolveStopped=resolve;});
  state.cleanup=()=>{
    clearTimeout(state.limitTimer);
    if(state.cleaned)return;
    state.cleaned=true;
    for(const track of state.stream?.getTracks()??[])track.stop();
    for(const [event,listener] of state.listeners??[])state.recorder.removeEventListener(event,listener);
  };
  state.stop=()=>{
    if(state.stopRequestedAt!==null)return;
    state.stopRequestedAt=performance.now();
    try{if(state.recorder?.state!=='inactive')state.recorder.stop();}
    catch(error){state.errors.push(String(error));resolveStopped();}
  };
  if(typeof MediaRecorder==='undefined'||typeof canvas?.captureStream!=='function'){
    state.status='unsupported';state.errors.push('Native canvas recording API unavailable');return state;
  }
  state.mimeType=['video/webm;codecs=vp8','video/mp4','video/webm'].find(type=>MediaRecorder.isTypeSupported(type))??null;
  if(!state.mimeType){state.status='unsupported';state.errors.push('No supported native video container');return state;}
  try{
    state.stream=canvas.captureStream();
    if(state.stream.getVideoTracks().length!==1||state.stream.getAudioTracks().length!==0)throw Error('Expected only the original canvas video track');
    state.trackSettings={...state.stream.getVideoTracks()[0].getSettings()};
    state.canvas=canvas;
    state.recorder=new MediaRecorder(state.stream,{mimeType:state.mimeType});
    state.listeners=[
      ['start',()=>{state.startedAt=performance.now();}],
      ['dataavailable',event=>{
        if(!event.data?.size)return;
        state.bytes+=event.data.size;
        state.dataEvents.push({at:performance.now(),timecode:Number.isFinite(event.timecode)?event.timecode:null,bytes:event.data.size});
        if(state.bytes>maxBytes){if(!state.errors.includes('clip-byte-limit'))state.errors.push('clip-byte-limit');state.stop();return;}
        state.chunks.push(event.data);
      }],
      ['error',event=>{state.errors.push(String(event.error??'Native recorder error'));state.stop();}],
      ['stop',()=>{state.stoppedAt=performance.now();resolveStopped();}],
    ];
    for(const [event,listener] of state.listeners)state.recorder.addEventListener(event,listener);
    state.recorder.start();
    state.limitTimer=setTimeout(()=>{state.errors.push('clip-time-limit');state.stop();},maxMs);
  }catch(error){state.status='invalid';state.errors.push(String(error));state.cleanup();resolveStopped();}
  return state;
}

export async function finishNativeCanvasClip(state,{completed}){
  let timer;
  try{
    if(state.status==='starting'){
      state.stop();
      await Promise.race([state.stopped,new Promise(resolve=>{timer=setTimeout(()=>{state.errors.push('native-stop-timeout');resolve();},state.stopMs);})]);
      if(state.canvas.width!==state.width||state.canvas.height!==state.height||!state.canvas.isConnected)state.errors.push('Original canvas changed during capture');
      if(!completed)state.errors.push('Sampling window interrupted');
      if(state.startedAt===null||state.stoppedAt===null||!state.chunks.length)state.errors.push('Incomplete native recording events');
      state.status=state.errors.length?'invalid':'recorded';
    }
    const blob=new Blob(state.chunks,{type:state.recorder?.mimeType||state.mimeType||''});
    const bytes=new Uint8Array(await blob.arrayBuffer());
    let binary='';
    for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
    return {schema:'v177-native-canvas-clip/v1',metadata:state.metadata,status:state.status,mimeType:blob.type,
      width:state.width,height:state.height,timeOrigin:state.timeOrigin,requestedAt:state.requestedAt,
      startedAt:state.startedAt,stopRequestedAt:state.stopRequestedAt,stoppedAt:state.stoppedAt,
      nativeElapsedMs:state.startedAt!==null&&state.stoppedAt!==null?state.stoppedAt-state.startedAt:null,
      trackSettings:state.trackSettings??null,dataEvents:state.dataEvents,errors:state.errors,completed,
      scope:'Native canvas MediaRecorder bytes and native event times; decoded contents and encoded PTS still require verification',
      originalSpeedAccepted:false,encodedPtsVerified:false,videoBase64:btoa(binary)};
  }finally{clearTimeout(timer);state.cleanup();state.chunks.length=0;}
}

export async function beginV177NativeCanvasClip(page,metadata,{directory,engine}={}){
  assert.match(metadata.form,/^[a-z0-9-]+$/u);assert.ok(['move','attack'].includes(metadata.phase));
  assert.ok(Number.isFinite(metadata.fighterId));assert.ok(['chromium','webkit'].includes(engine));
  assert.ok(['base-enemy','authored-form'].includes(metadata.fixtureGroup));
  const stem=path.join(directory,`${metadata.fixtureGroup}-${metadata.form}-${metadata.phase}-${metadata.fighterId}`);
  let handle,error,finished=false;
  try{handle=await page.locator('.game-shell canvas').evaluateHandle(startNativeCanvasClip,{metadata});}
  catch(cause){error=String(cause);}
  return {async finish({completed}){
    if(finished)throw Error('Native canvas clip already finalized');finished=true;
    let receipt;
    try{
      receipt=handle?await handle.evaluate(finishNativeCanvasClip,{completed}):{status:'invalid',metadata,errors:[error],originalSpeedAccepted:false,encodedPtsVerified:false};
      const {videoBase64,...details}=receipt;receipt={...details,engine};
      await mkdir(directory,{recursive:true});
      if(videoBase64){
        const bytes=Buffer.from(videoBase64,'base64');
        assert.ok(bytes.length<=8*1024*1024);
        const extension=receipt.mimeType.startsWith('video/mp4')?'mp4':receipt.mimeType.startsWith('video/webm')?'webm':null;
        assert.ok(extension,'Preserve the native container instead of guessing or transcoding');
        const file=stem+'.'+extension;await writeFile(file,bytes,{flag:'wx'});
        receipt.file=file;receipt.bytes=bytes.length;receipt.sha256=createHash('sha256').update(bytes).digest('hex');
      }
      await writeFile(stem+'.json',JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
    }catch(cause){receipt={...receipt,status:'invalid',persistenceOrCaptureError:String(cause),originalSpeedAccepted:false,encodedPtsVerified:false};}
    finally{await handle?.dispose().catch(()=>{});}
    return receipt;
  }};
}
