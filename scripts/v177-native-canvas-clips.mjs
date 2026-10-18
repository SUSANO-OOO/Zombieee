import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';

// These two functions execute only in the existing hosted game page. They
// capture its original canvas track; no copied frames, playback, game-clock
// changes, microphone, audio routing or encoder-frame-rate override is used.
export function startNativeCanvasClip(canvas,{metadata,engine='chromium',requestedMimeType=null,maxBytes=8*1024*1024,maxMs=15_000,stopMs=3_000,realmOwner=null}){
  if(requestedMimeType!==null&&!['video/mp4','video/webm;codecs=vp8','video/webm'].includes(requestedMimeType))throw new RangeError('Unknown diagnostic native container');
  const state={metadata,requestedMimeType,width:canvas?.width,height:canvas?.height,timeOrigin:performance.timeOrigin,
    requestedAt:performance.now(),startedAt:null,stopRequestedAt:null,stoppedAt:null,
    status:'starting',mimeType:null,chunks:[],bytes:0,dataEvents:[],errors:[],maxBytes,stopMs};
  if(realmOwner!==null){
    state.realmOwner=realmOwner;
    state.realmCreated=realmOwner.member({window,document,performance,canvas},'recorder-create');
  }
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
  // Preserve native frames and timing. Compare WebKit's MP4 path in the next
  // hosted run; choosing it does not establish a performance improvement.
  state.mimePreferences=requestedMimeType?[requestedMimeType]:engine==='webkit'?['video/mp4','video/webm;codecs=vp8','video/webm']:['video/webm;codecs=vp8','video/mp4','video/webm'];
  state.mimeType=state.mimePreferences.find(type=>MediaRecorder.isTypeSupported(type))??null;
  if(!state.mimeType){state.status='unsupported';state.errors.push('No supported native video container');return state;}
  try{
    state.stream=canvas.captureStream();
    if(state.stream.getVideoTracks().length!==1||state.stream.getAudioTracks().length!==0)throw Error('Expected only the original canvas video track');
    state.trackSettings={...state.stream.getVideoTracks()[0].getSettings()};
    state.canvas=canvas;
    state.recorder=new MediaRecorder(state.stream,{mimeType:state.mimeType});
    state.listeners=[
      ['start',()=>{
        state.startedAt=performance.now();
        if(state.realmOwner)try{state.realmStarted=state.realmOwner.member({window,document,performance,canvas:document.querySelector('.game-shell canvas')},'recorder-start');}
        catch(error){state.errors.push(String(error));state.stop();}
      }],
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
      if(state.realmOwner)try{state.realmFinished=state.realmOwner.member({window,document,performance,canvas:document.querySelector('.game-shell canvas')},'recorder-finish');}
      catch(error){state.errors.push(String(error));}
      state.status=state.errors.length?'invalid':'recorded';
    }
    const blob=new Blob(state.chunks,{type:state.recorder?.mimeType||state.mimeType||''});
    const bytes=new Uint8Array(await blob.arrayBuffer());
    let binary='';
    for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
    return {schema:'v177-native-canvas-clip/v1',metadata:state.metadata,status:state.status,mimeType:blob.type,mimePreferences:state.mimePreferences??null,requestedMimeType:state.requestedMimeType,
      width:state.width,height:state.height,timeOrigin:state.timeOrigin,requestedAt:state.requestedAt,...(state.realmOwner?{realm:{created:state.realmCreated,started:state.realmStarted??null,finished:state.realmFinished??null}}:{}),
      startedAt:state.startedAt,stopRequestedAt:state.stopRequestedAt,stoppedAt:state.stoppedAt,
      nativeElapsedMs:state.startedAt!==null&&state.stoppedAt!==null?state.stoppedAt-state.startedAt:null,
      captureWindowMs:state.startedAt!==null&&state.stopRequestedAt!==null?state.stopRequestedAt-state.startedAt:null,
      trackSettings:state.trackSettings??null,dataEvents:state.dataEvents,errors:state.errors,completed,
      scope:'Native canvas MediaRecorder bytes and native event times; decoded contents and encoded PTS still require verification',
      originalSpeedAccepted:false,encodedPtsVerified:false,videoBase64:btoa(binary)};
  }finally{clearTimeout(timer);state.cleanup();state.chunks.length=0;}
}

export async function beginV177NativeCanvasClip(page,metadata,{directory,engine,requestedMimeType=null,realmOwner=null}={}){
  assert.match(metadata.form,/^[a-z0-9-]+$/u);assert.ok(['move','attack','engage','incoming-stun','turned-getup','ranger-manual-precision'].includes(metadata.phase));
  const manual=metadata.phase==='ranger-manual-precision';
  if(manual){
    for(const key of ['form','requestedKind','preparedRenderKind','manualAbilityKind'])assert.equal(metadata[key],'ranger');
    assert.equal(metadata.constructorPhase,'engage');assert.equal(metadata.owner,'ranger-manual-precision');
    assert.ok(Number.isSafeInteger(metadata.fighterId)&&metadata.fighterId>=0);
    assert.ok(Number.isSafeInteger(metadata.targetId)&&metadata.targetId>=0&&metadata.targetId!==metadata.fighterId);
    assert.ok(Number.isSafeInteger(metadata.baselineActivationId)&&metadata.baselineActivationId>=0);
    assert.ok(Number.isSafeInteger(metadata.battleGeneration)&&metadata.battleGeneration>=0);
    assert.equal(metadata.diagnosticOnly,true);assert.equal(metadata.controlledOpponent,true);assert.equal(metadata.legacyFusedFixture,false);
    assert.ok(typeof metadata.proofId==='string'&&metadata.proofId.length>0);
    assert.match(metadata.caseId??'',/^forms-(?:[1-9]|1[0-2]):ranger:ranger-manual-precision:(?:1280x720|844x390|844x340)$/u);
    assert.match(metadata.referenceCaseId??'',/^forms-(?:[1-9]|1[0-2]):ranger:engage:(?:1280x720|844x390|844x340)$/u);
    assert.equal(metadata.caseId.replace(':ranger-manual-precision:',':engage:'),metadata.referenceCaseId);
    assert.equal(Object.hasOwn(metadata,'activationId'),false,'Only a real post-input start receipt may bind the new activation');
  }
  const unborn=metadata.phase==='turned-getup';
  if(unborn) {
    for(const key of ['form','requestedKind','preparedRenderKind'])assert.equal(metadata[key],'turned');
    assert.equal(metadata.fighterId,null,'No newborn exists when its corpse recording starts');
    assert.ok(Number.isSafeInteger(metadata.corpseId)&&metadata.corpseId>=0);
    assert.ok([0,1].includes(metadata.variant));assert.equal(metadata.diagnosticOnly,true);
    assert.ok(Number.isSafeInteger(metadata.battleGeneration));assert.equal(metadata.proofId,`${metadata.battleGeneration}:turned-getup:${metadata.corpseId}`);
  }else assert.ok(Number.isFinite(metadata.fighterId));
  assert.ok(['chromium','webkit'].includes(engine));
  assert.ok(requestedMimeType===null||['video/mp4','video/webm;codecs=vp8','video/webm'].includes(requestedMimeType),'Unknown diagnostic native container');
  assert.ok(['base-enemy','authored-form','approach-to-attack','natural-incoming-stun','actual-infection-getup','actual-ranger-manual-precision'].includes(metadata.fixtureGroup));
  assert.equal(metadata.phase==='engage',metadata.fixtureGroup==='approach-to-attack','approach-to-attack recordings must remain distinct from legacy move/attack clips');
  assert.equal(metadata.phase==='incoming-stun',metadata.fixtureGroup==='natural-incoming-stun','Incoming stun recordings require their own natural opponent contract');
  assert.equal(manual,metadata.fixtureGroup==='actual-ranger-manual-precision','Manual precision recordings require their own actual input/activation contract');
  assert.equal(unborn,metadata.fixtureGroup==='actual-infection-getup','Actual infection recordings require their corpse and original birth contract');
  const identity=unborn?`corpse-${metadata.corpseId}-variant-${metadata.variant}`:metadata.fighterId;
  const stem=path.join(directory,`${metadata.fixtureGroup}-${metadata.form}-${metadata.phase}-${identity}`);
  let handle,error,finished=false;
  try{handle=await page.locator('.game-shell canvas').evaluateHandle(startNativeCanvasClip,{metadata,engine,requestedMimeType,...(realmOwner!==null?{realmOwner}:{})});}
  catch(cause){error=String(cause);}
  return {async waitForStart(){
    if(finished||!handle)throw Error('Native canvas recorder did not become available');
    return handle.evaluate(async state=>{
      const requestedAt=performance.now();
      while(performance.now()-requestedAt<1000){
        if(Number.isFinite(state.startedAt)){
          if(state.realmOwner){
            state.realmOwner.check({window,document,performance,canvas:document.querySelector('.game-shell canvas')});
            if(!state.realmStarted||state.errors.length)throw Error('Native realm recorder start failed');
          }
          return {startedAt:state.startedAt,timeOrigin:state.timeOrigin,...(state.realmOwner?{realm:state.realmStarted}:{})};
        }
        if(state.errors.length||state.status!=='starting')throw Error('Native canvas recorder failed before start');
        await new Promise(resolve=>setTimeout(resolve,5));
      }
      throw Error('Native canvas start acknowledgment exceeded1s');
    });
  },async finish({completed}){
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
