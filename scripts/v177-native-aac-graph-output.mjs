// Experimental output-only proposal. This module is served raw; no eval/source rewriting.
import {AacFragmentMuxer,normalizeAacDescription} from './v177-aac-fragment-muxer.mjs';
import {GRAPH_LIMITS as L} from './v177-native-aac-graph-contract.mjs';
const outputs=new WeakMap();
export function graphErrorText(error){
  const message=String(error),stack=error instanceof Error?error.stack:null;
  return typeof stack==='string'&&stack&&!stack.includes(message)?message+'\n'+stack:stack||message;
}
function framingFailureReceipt(packet,receivedAtMs,secondary){
  // Keep the first actual failure without PCM, arbitrary nested objects or an
  // unbounded callback history. These are the framer's existing scalar fields.
  const scalar=(value,max=128)=>value===null?null:typeof value==='string'?value.slice(0,max)
    :typeof value==='boolean'||(typeof value==='number'&&Number.isFinite(value))?value:undefined;
  const copy=(source,keys)=>Object.fromEntries(keys.flatMap(key=>{
    const value=scalar(source?.[key],key==='message'?512:128);return value===undefined?[]:[[key,value]];
  }));
  const snapshot=copy(packet.snapshot,['sampleRate','channels','packetFrames','poolPackets','pcmPoolBytes','generation','originFrame','nextSourceFrame','acceptedFrames','emittedPackets','partialFrames','inFlightPackets','freeBuffers','peakInFlightPackets','staleRecycles','finished']);
  snapshot.failure=packet.snapshot?.failure===null?null:copy(packet.snapshot?.failure,
    ['code','acceptedFrames','nextSourceFrame','id','packetIndex','inputFrames','observedSourceFrame','rejectedInputFrames','availableFrames','message']);
  return{receivedAtMs,generation:packet.generation,code:scalar(packet.code),snapshot,secondary};
}
function declaredAacDescription(config){
  // Use the pinned muxer's AAC-LC parser to select the actual rate, without
  // resampling or starting a second encoder/context to obtain an init header.
  for(let index=0;index<15;index++){
    const bits=(2<<11)|(index<<7)|(config.numberOfChannels<<3);
    try{return normalizeAacDescription(Uint8Array.of(bits>>8,bits&255),config).asc;}catch{/* Try the next defined AAC rate. */}
  }
  throw new Error('Actual AAC-LC configuration cannot be initialized');
}
export function graphOutputForContext(context,options={}){const value=outputs.get(context);if(!value)throw new Error('Experimental output was not prewarmed for this exact context');value.configureOwner(options);return value.api;}
export function createGraphState(){return{schema:'v177-real-audio-graph-observation/v1',status:'preparing',route:'MediaSource',variant:'one-prewarmed-original-mixer-bgm-rifle',sampleRate:null,channels:2,realtimeAudioContexts:0,
  startedAt:null,inputFrames:0,pcmBytes:0,encodedBytes:0,muxedBytes:0,pcm:[],packets:[],configurations:[],playheads:[],events:[],transport:[],transportOverflow:0,
  errors:[],primaryError:null,pcmFramingFailure:null,nativeRateRecoveries:[],pendingPcmPackets:0,peakPendingPcmPackets:0,peakEncoderQueue:0,peakPendingSegments:0,peakPendingBytes:0,physicalRecordingAccepted:false,productionBackendAccepted:false,coldAccepted:false,endingAccepted:false,lifecycleAccepted:false,wholeGameAccepted:false};}
export async function within(promise,ms,label){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label+' exceeded '+ms+'ms')),ms);})]);}finally{clearTimeout(timer);}}
export async function prepareGraphOutput(context,{state=createGraphState(),workletUrl,env=globalThis}={}){
  const now=()=>env.performance.now(),check=(ok,message)=>{if(!ok)throw new Error(message);};
  state.sampleRate=context.sampleRate;check(Number.isSafeInteger(state.sampleRate)&&state.sampleRate>=8000&&state.sampleRate<65536,'Actual context.sampleRate is unsupported; no resampling is permitted');
  let audio,source,buffer,encoder,node,input,url,owner={},desired=false,disposed=false,away=false,generation=1,pendingPlay=null,muxer,ended=false,originFrame=null,appendBytes=0;
  const pending=[],queuedPcm=[],pcmParts=[],encodedParts=[],muxedParts=[],removers=[],pcmWaiters=[];let drainingPcm=false,pcmDrainDeadline=null,finishedResolve,finishedReject,initializationReject;
  let mediaProgress=null,lastRateRecoveryAt=-Infinity;
  const finished=new Promise((resolve,reject)=>{finishedResolve=resolve;finishedReject=reject;});void finished.catch(()=>{});
  const ms=()=>state.startedAt===null?null:now()-state.startedAt;
  function fail(error){const text=graphErrorText(error);state.primaryError??=text;if(state.errors.length<16)state.errors.push(text);state.status='failed';for(const waiter of pcmWaiters.splice(0))waiter.reject(error instanceof Error?error:new Error(text));initializationReject?.(error instanceof Error?error:new Error(text));finishedReject(error instanceof Error?error:new Error(text));}
  function record(event,extra={}){if(state.transport.length>=L.transportEvents){state.transportOverflow++;fail(new Error('Bounded transport event capacity exhausted'));return;}state.transport.push({event,at:now(),ms:ms(),contextTime:context.currentTime,mediaTime:audio?.currentTime??null,encodeQueue:encoder?.encodeQueueSize??null,pendingSegments:pending.length,pendingBytes:appendBytes,...extra});}
  const on=(target,name,fn)=>{target.addEventListener(name,fn);const remove=()=>target.removeEventListener(name,fn);removers.push(remove);return remove;};
  const rotation=env.matchMedia?.('(orientation: portrait)');
  const allowed=()=>!disposed&&!away&&env.document.visibilityState!=='hidden'&&!rotation?.matches&&(owner.canPlay?.()??true);
  function pause(){desired=false;generation++;audio?.pause();if(state.startedAt!==null&&!disposed)fail(new Error('Observation was interrupted; recovery is outside this single prewarmed case'));}
  const api={destination:null,prepare(){
    if(state.primaryError)return Promise.reject(new Error(state.primaryError));if(!allowed())return Promise.reject(new Error('Experimental output cannot play in the current lifecycle'));
    if(pendingPlay)return pendingPlay;desired=true;const current=generation;if(state.startedAt===null)state.startedAt=now();record('native-play-call');
    let play;try{play=audio.play();}catch(error){play=Promise.reject(error);}
    void Promise.resolve(play).then(()=>{if(disposed||!desired||current!==generation||!allowed())audio.pause();},()=>{});
    pendingPlay=within(Promise.resolve(play),owner.timeoutMs??2000,'Native output gesture play').then(()=>{check(allowed()&&current===generation&&desired&&!audio.paused,'Native play resolved after cancellation');return true;}).catch(error=>{fail(error);desired=false;audio.pause();throw error;}).finally(()=>{pendingPlay=null;});return pendingPlay;
  },pause,foreground(){away=false;},needsRecovery:()=>!desired||audio?.paused||Boolean(state.primaryError),snapshot:()=>({mode:'experimental-worklet-aac-mse',paused:audio?.paused??null,disposed,generation,experimental:true}),dispose(){void cleanup();}};
  function enqueue(segment){check(pending.length<L.pendingSegments&&appendBytes+segment.byteLength<=L.pendingBytes,'Bounded MSE append queue exhausted');pending.push(segment);appendBytes+=segment.byteLength;state.peakPendingSegments=Math.max(state.peakPendingSegments,pending.length);state.peakPendingBytes=Math.max(state.peakPendingBytes,appendBytes);drain();}
  function retainMuxed(segment){check(state.muxedBytes+segment.byteLength<=L.muxedBytes,'Bounded muxed evidence capacity exhausted');muxedParts.push(segment);state.muxedBytes+=segment.byteLength;enqueue(segment);}
  function drain(){if(disposed||state.primaryError||!buffer||buffer.updating||source.readyState!=='open')return;try{if(pending.length){const segment=pending.shift();appendBytes-=segment.byteLength;record('append-call',{bytes:segment.byteLength});buffer.appendBuffer(segment);}else if(ended){source.endOfStream();record('end-of-stream');}}catch(error){fail(error);}}
  const timeRanges=ranges=>ranges?{length:ranges.length,ranges:Array.from({length:Math.min(4,ranges.length)},(_,i)=>[ranges.start(i),ranges.end(i)])}:null;
  // A native AVF renderer can stop with HTML paused=false and readyState=3.
  // Re-arm the owned normal rate only after actual append ACKs show buffered
  // data beyond a stationary playhead. Preserve every PCM packet and clock.
  function recoverNativeMediaIfStalled(){
    if(!allowed()||!desired||state.primaryError||ended||source.readyState!=='open'
      ||audio.paused||audio.readyState<3||!state.events.some(r=>r.event==='playing'))return;
    const at=now(),time=audio.currentTime;
    check(Number.isFinite(time)&&time>=0,'Native playhead is invalid during buffered recovery');
    if(!mediaProgress||time>mediaProgress.time){mediaProgress={time,at};return;}
    if(time<mediaProgress.time)return; // Keep a regression as raw clock failure.
    const stationaryMs=at-mediaProgress.at;
    if(stationaryMs<50||at-lastRateRecoveryAt<100)return;
    let ahead=0;
    for(let i=0;i<audio.buffered.length;i++)if(audio.buffered.start(i)<=time&&audio.buffered.end(i)>time)
      ahead=Math.max(ahead,audio.buffered.end(i)-time);
    if(ahead<.08)return;
    check(audio.playbackRate===1,'Owned native output rate changed unexpectedly');
    check(state.nativeRateRecoveries.length<L.nativeResumeAttempts,'Bounded native rate recovery attempts exhausted');
    const current=generation,receipt={requestedAtMs:ms(),time,contextTime:context.currentTime,
      stationaryMs,bufferAheadSeconds:ahead,rateBefore:audio.playbackRate,zeroRate:null,restoredRate:null,cancelled:false};
    state.nativeRateRecoveries.push(receipt);lastRateRecoveryAt=at;
    record('native-rate-recovery-request',receipt);
    audio.playbackRate=0;receipt.zeroRate=audio.playbackRate;
    check(receipt.zeroRate===0,'Native zero-rate rearm was not retained');
    if(!allowed()||!desired||disposed||state.primaryError||current!==generation){receipt.cancelled=true;return;}
    audio.playbackRate=1;receipt.restoredRate=audio.playbackRate;
    check(receipt.restoredRate===1,'Native normal-rate restoration was not retained');
    record('native-rate-recovery-return',{...receipt,timeAfter:audio.currentTime});
  }
  function sample(){if(state.startedAt===null)return;state.playheads.push({ms:ms(),time:audio.currentTime,encodedFrames:state.inputFrames,contextTime:context.currentTime,encodeQueueSize:encoder.encodeQueueSize,pendingPcmPackets:queuedPcm.length,pendingSegments:pending.length,pendingBytes:appendBytes,readyState:audio.readyState,paused:audio.paused,playbackRate:audio.playbackRate,
    audioBuffered:timeRanges(audio.buffered),sourceBuffered:timeRanges(buffer?.buffered),mediaSourceDuration:Number.isFinite(source.duration)?source.duration:String(source.duration),sourceMode:buffer?.mode??null,appendWindowStart:buffer?.appendWindowStart??null,appendWindowEnd:buffer?String(buffer.appendWindowEnd):null});}
  function receivePacket(packet){
    // Preserve actual received bytes before any AudioData construction or encoding.
    const bytes=new Uint8Array(packet.buffer);check(state.pcm.length<L.pcmPackets&&state.pcmBytes+bytes.byteLength<=L.pcmBytes,'Bounded raw PCM evidence capacity exhausted');
    pcmParts.push(bytes.slice());state.pcmBytes+=bytes.byteLength;
    const receipt={generation:packet.generation,id:packet.id,packetIndex:packet.packetIndex,firstSourceFrame:packet.firstSourceFrame,timestampUs:packet.timestampUs,durationUs:packet.durationUs,sampleRate:packet.sampleRate,channels:packet.channels,numberOfFrames:packet.numberOfFrames,bytes:bytes.byteLength,receivedAtMs:ms()};
    state.pcm.push(receipt);
    check(packet.generation===1&&packet.sampleRate===state.sampleRate&&packet.channels===2&&packet.numberOfFrames===1024&&bytes.byteLength===8192,'Actual PCM packet layout/rate changed');
    check(packet.packetIndex===state.pcm.length-1&&packet.timestampUs===Math.round(packet.packetIndex*1024/state.sampleRate*1e6),'Missing/duplicate/reordered actual PCM packet');
    originFrame??=packet.firstSourceFrame;state.originFrame=originFrame;check(packet.firstSourceFrame===originFrame+state.inputFrames,'Actual Worklet source clock gap');
    state.inputFrames+=1024;
    const floats=new Float32Array(packet.buffer);for(const v of floats)check(Number.isFinite(v),'Nonfinite actual PCM is retained as failure, never clamped');
    // Waiting jobs retain their original transferred Worklet buffer. No new
    // PCM payload is allocated, and the encoder itself stays capped at4.
    check(queuedPcm.length<L.pcmPoolPackets,'Bounded pending PCM pool exhausted');
    queuedPcm.push({packet,receipt});state.pendingPcmPackets=queuedPcm.length;
    state.peakPendingPcmPackets=Math.max(state.peakPendingPcmPackets,queuedPcm.length);
    drainPcm();
  }
  function drainPcm(){
    if(disposed||state.primaryError||drainingPcm)return;
    drainingPcm=true;
    try{
      while(queuedPcm.length&&encoder.encodeQueueSize<L.encoderQueue){
        assertPcmOwner();
        const {packet,receipt}=queuedPcm.shift();state.pendingPcmPackets=queuedPcm.length;
        const data=new env.AudioData({format:'f32-planar',sampleRate:state.sampleRate,numberOfFrames:1024,numberOfChannels:2,timestamp:packet.timestampUs,data:new Float32Array(packet.buffer)});
        receipt.audioDataReadyAtMs=ms();
        try{
          // AudioData owns its copy; return this same scarce pool buffer before
          // encode(), preserving the existing early-recycle ownership order.
          assertPcmOwner();
          node.port.postMessage({type:'recycle',generation:1,id:packet.id,packetIndex:packet.packetIndex,buffer:packet.buffer},[packet.buffer]);
          receipt.recyclePostedAtMs=ms();
          assertPcmOwner();receipt.encodeCallAtMs=ms();
          try{encoder.encode(data);}finally{receipt.encodeReturnedAtMs=ms();}
        }finally{data.close();}
        state.peakEncoderQueue=Math.max(state.peakEncoderQueue,encoder.encodeQueueSize);sample();
        if(state.primaryError)break;
      }
      if(!queuedPcm.length&&!state.primaryError)for(const waiter of pcmWaiters.splice(0))waiter.resolve();
    }catch(error){fail(error);}
    finally{drainingPcm=false;}
  }
  function assertPcmOwner(){
    check(!disposed&&!state.primaryError,'PCM delivery owner was cancelled');
    check(pcmDrainDeadline===null||now()<pcmDrainDeadline,'Original2s AAC input drain deadline expired');
  }
  function waitForPcmDrain(){
    if(state.primaryError)return Promise.reject(new Error(state.primaryError));
    if(!queuedPcm.length)return Promise.resolve();
    return new Promise((resolve,reject)=>pcmWaiters.push({resolve,reject}));
  }
  async function cleanup(){
    if(disposed)return;disposed=true;desired=false;generation++;queuedPcm.length=0;state.pendingPcmPackets=0;for(const waiter of pcmWaiters.splice(0))waiter.reject(new Error('Owned PCM intake disposed before drain'));state.cleanup??={completed:false,errors:[]};
    const attempt=(label,fn)=>{try{fn();}catch(error){state.cleanup.errors.push({label,error:String(error)});fail(error);}};
    for(const remove of removers)attempt('listener',remove);
    attempt('port',()=>{if(node){node.port.onmessage=null;node.onprocessorerror=null;node.port.close();}});attempt('input-disconnect',()=>input?.disconnect());attempt('node-disconnect',()=>node?.disconnect());
    attempt('encoder-close',()=>{if(encoder&&encoder.state!=='closed')encoder.close();});
    attempt('media-release',()=>{if(audio){audio.pause();audio.removeAttribute('src');audio.load();audio.remove();}});
    attempt('object-url',()=>{if(url)env.URL.revokeObjectURL(url);});outputs.delete(context);state.cleanup.completed=state.cleanup.errors.length===0;
  }
  try{
    check(typeof env.AudioEncoder==='function'&&typeof env.AudioData==='function'&&typeof env.AudioWorkletNode==='function'&&context.audioWorklet,'Required actual graph/codec API absent');
    const config={codec:'mp4a.40.2',sampleRate:state.sampleRate,numberOfChannels:2,bitrate:192000,aac:{format:'aac'}};
    state.encoderSupport=await within(env.AudioEncoder.isConfigSupported(config),L.readyMs,'Encoder support');check(state.encoderSupport.supported,'Actual-rate AAC encoder unsupported');
    const mime='audio/mp4; codecs="mp4a.40.2"';check(typeof env.MediaSource==='function'&&env.MediaSource.isTypeSupported(mime),'MediaSource AAC unsupported');
    audio=env.document.createElement('audio');audio.hidden=true;audio.controls=false;audio.autoplay=false;audio.playsInline=true;audio.disableRemotePlayback=true;audio.preload='auto';audio.volume=1;audio.muted=false;audio.setAttribute('playsinline','');env.document.body.appendChild(audio);
    for(const event of ['playing','waiting','stalled','ended','error'])on(audio,event,()=>{if(state.events.length>=L.transportEvents){fail(new Error('Bounded media event capacity exhausted'));return;}state.events.push({event,ms:ms(),time:audio.currentTime});record('media-'+event);if(event==='error')fail(new Error('Native media element error'));});
    on(audio,'pause',()=>{if(desired&&allowed()){owner.onInterrupted?.();fail(new Error('Unexpected native media pause'));}});
    on(env,'pagehide',()=>{away=true;pause();});on(env,'pageshow',()=>{away=false;});on(env.document,'visibilitychange',()=>{if(!allowed())pause();});if(rotation)on(rotation,'change',()=>{if(!allowed())pause();});
    source=new env.MediaSource();const opened=new Promise((resolve,reject)=>{on(source,'sourceopen',resolve);on(audio,'error',()=>reject(new Error('MSE source open failed')));});
    url=env.URL.createObjectURL(source);audio.src=url;audio.load();await within(opened,L.readyMs,'MSE source open');
    state.durationInitialization={before:Number.isFinite(source.duration)?source.duration:String(source.duration),assignedInfinity:false};
    buffer=source.addSourceBuffer(mime);on(buffer,'updateend',()=>{record('updateend');try{recoverNativeMediaIfStalled();}catch(error){fail(error);}drain();});on(buffer,'error',()=>fail(new Error('Native SourceBuffer error')));
    // Complete container initialization before the trusted warm click starts
    // actual PCM. Previously its first slow updateend filled the eight-segment
    // queue with real encoder output before playback could become ready.
    const description=declaredAacDescription(config);muxer=new AacFragmentMuxer(description,config);state.asc=Array.from(description);
    state.initialization={requestedAt:now(),acknowledged:false,confirmedByActualMetadata:false,audioFrames:0};
    let removeInitialized;
    const initialized=new Promise((resolve,reject)=>{
      initializationReject=reject;
      removeInitialized=on(buffer,'updateend',()=>{state.initialization.acknowledged=true;state.initialization.acknowledgedAt=now();resolve();});
    });
    retainMuxed(muxer.initializationSegment);
    try{await within(initialized,L.readyMs,'MSE initialization');}
    finally{initializationReject=null;removeInitialized();}
    // This is a live output, not a finite file whose duration grows by one AAC
    // frame on every append. Declare that once the metadata append is idle.
    // No clock seek, sample omission or additional prebuffer is introduced.
    source.duration=Infinity;
    state.durationInitialization.assignedInfinity=true;
    state.durationInitialization.afterInitialization=String(source.duration);
    check(source.duration===Infinity,'Native MSE did not retain its live duration');
    encoder=new env.AudioEncoder({error:fail,output:(chunk,metadata)=>{
      // Keep raw encoded bytes/configuration before parsing or mux validation.
      try{
        const bytes=new Uint8Array(chunk.byteLength);chunk.copyTo(bytes);check(state.encodedBytes+bytes.byteLength<=L.encodedBytes&&state.packets.length<L.pcmPackets+4,'Bounded native AAC evidence capacity exhausted');
        encodedParts.push(bytes);state.encodedBytes+=bytes.byteLength;const ordinal=state.packets.length;state.packets.push({timestamp:chunk.timestamp,duration:chunk.duration,type:chunk.type,bytes:bytes.byteLength,offset:state.encodedBytes-bytes.byteLength,atMs:ms()});
        const c=metadata?.decoderConfig;if(c){const description=Array.from(new Uint8Array(c.description??[])),saved={codec:c.codec,sampleRate:c.sampleRate,numberOfChannels:c.numberOfChannels,description,packet:ordinal};state.configurations.push(saved);const normalized=normalizeAacDescription(description,c);
          check(c.sampleRate===state.sampleRate&&c.numberOfChannels===2,'Actual AAC configuration differs from Worklet PCM');
          check(description.length>0&&normalized.asc.every((b,i)=>b===state.asc[i]),'Native AAC configuration changed');state.initialization.confirmedByActualMetadata=true;}
        check(state.initialization.confirmedByActualMetadata,'Native encoder omitted decoder configuration');check(Math.abs(chunk.timestamp-Math.round(ordinal*1024/state.sampleRate*1e6))<=1,'Native AAC packet clock gap or priming representation unsupported');
        check(chunk.duration!==null&&Math.abs(chunk.duration-1024/state.sampleRate*1e6)<=1,'Native AAC duration is not1024 actual-rate samples');
        retainMuxed(muxer.segment([{data:bytes,timestampSamples:ordinal*1024,durationSamples:1024}]));
      }catch(error){fail(error);}
    }});on(encoder,'dequeue',()=>{if(disposed||state.primaryError)return;record('encoder-dequeue');drainPcm();});encoder.configure(config);
    await within(context.audioWorklet.addModule(workletUrl),L.readyMs,'Raw Worklet module load');
    node=new env.AudioWorkletNode(context,'v177-graph-pcm-framer',{numberOfInputs:1,numberOfOutputs:0,channelCount:2,channelCountMode:'explicit',channelInterpretation:'speakers',processorOptions:{generation:1}});
    node.port.onmessage=({data:packet})=>{if(disposed)return;try{check(packet.generation===1,'Stale Worklet generation');if(packet.type==='pcm-processor-ready'){check(packet.sampleRate===state.sampleRate,'Processor actual rate mismatch');state.processorReady=packet;record('processor-ready');}else if(packet.type==='pcm-packet')receivePacket(packet);else if(packet.type==='pcm-framing-error'){
      state.pcmFramingFailure??=framingFailureReceipt(packet,ms(),Boolean(state.primaryError));
      throw new Error('Actual Worklet framing failed: '+JSON.stringify(state.pcmFramingFailure));
    }else if(packet.type==='pcm-finished'){state.finished=packet;finishedResolve(packet);}else throw new Error('Unknown Worklet receipt');}catch(error){fail(error);}};
    node.onprocessorerror=()=>fail(new Error('Actual Worklet processorerror'));input=context.createGain();input.connect(node);api.destination=input;
    const result={api,configureOwner(options){owner=options;},state,origin:()=>originFrame,record,fail,
      evidence:()=>({metadata:state,pcmParts,encodedParts,muxedParts}),
      async finish(){node.port.postMessage({type:'finish',generation:1});await within(finished,2000,'Worklet boundary finish');check(!state.primaryError,'Original Worklet/transport failure retained');pcmDrainDeadline=now()+2000;await within((async()=>{await waitForPcmDrain();check(!disposed&&!state.primaryError&&now()<pcmDrainDeadline,'AAC flush owner expired or was cancelled');await encoder.flush();check(!disposed&&!state.primaryError&&now()<pcmDrainDeadline,'AAC flush owner expired or was cancelled');})(),2000,'Actual AAC flush');check(!state.primaryError,'Original encoder failure retained');ended=true;drain();const deadline=now()+2000;while((pending.length||buffer.updating||source.readyState==='open')&&now()<deadline&&!state.primaryError)await new Promise(resolve=>setTimeout(resolve,5));check(!pending.length&&!buffer.updating&&source.readyState!=='open','Bounded MSE drain failed');while(audio.currentTime<state.inputFrames/state.sampleRate-.05&&now()<deadline&&!state.primaryError)await new Promise(resolve=>setTimeout(resolve,10));sample();state.finalMedia={time:audio.currentTime,duration:audio.duration,ended:audio.ended,paused:audio.paused,volume:audio.volume,muted:audio.muted,readyState:audio.readyState};check(!state.primaryError,'Original native failure retained');},cleanup};
    outputs.set(context,result);state.status='prewarmed-modules-not-running';return result;
  }catch(error){fail(error);await cleanup();throw error;}
}
