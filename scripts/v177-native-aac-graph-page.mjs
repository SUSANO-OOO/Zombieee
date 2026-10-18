// Raw ESM diagnostic page; imports resolve through the guarded source-only server.
import {AudioMixer} from '../app/audioMixer.js';
import {prepareGraphOutput,createGraphState,within,graphErrorText} from './v177-native-aac-graph-output.mjs';
import {GRAPH_LIMITS as L,assertGraphObservation} from './v177-native-aac-graph-contract.mjs';
const state=createGraphState(),warm=document.querySelector('#warm'),start=document.querySelector('#start'),rifle=document.querySelector('#rifle');
let context,mixer,output,completing=false,resolveComplete;globalThis.__graphState=state;globalThis.__graphCompletion=new Promise(resolve=>{resolveComplete=resolve;});
function fail(error){if(output)output.fail(error);else{const text=graphErrorText(error);state.primaryError??=text;if(state.errors.length<16)state.errors.push(text);state.status='failed';}}
const ms=()=>performance.now()-state.startedAt;
function originalVoice(handle,request){
  if(!handle)throw new Error('Original AudioMixer returned no voice');const voice=mixer.activeVoices.get(handle.id);if(!voice||voice.assetId!==handle.assetId)throw new Error('Actual original mixer voice receipt absent');
  return{...request,voiceId:handle.id,assetId:voice.assetId,cueId:voice.cueId,category:voice.category,sourceStartedAtContext:voice.startedAt,voiceGain:voice.volume,
    firstInputFrame:Math.round(voice.startedAt*state.sampleRate)-state.originFrame,observedAtMs:ms(),diagnostics:mixer.getDiagnostics()};
}
async function analyseContent(parts,pcmParts){
  const bytes=await new Blob(parts).arrayBuffer(),offline=new OfflineAudioContext(2,1,state.sampleRate),decoded=await within(offline.decodeAudioData(bytes),3000,'Post-observation AAC decode');
  const reference=new Float32Array(state.inputFrames);pcmParts.forEach((part,index)=>reference.set(new Float32Array(part.buffer,part.byteOffset,1024),index*1024));
  const data=decoded.getChannelData(0),begin=Math.max(4096,state.bgm.firstInputFrame+4096),end=Math.min(reference.length-4096,data.length-4096);
  if(end<=begin)throw new Error('Insufficient actual PCM/AAC signal interval');
  const corr=lag=>{let dot=0,aa=0,bb=0;for(let i=begin;i<end;i+=16){const j=i+lag;if(j<0||j>=data.length)continue;const a=data[j],b=reference[i];dot+=a*b;aa+=a*a;bb+=b*b;}return dot/Math.sqrt(aa*bb||1);};
  let best={lagSamples:0,correlation:-1};for(let lag=-4096;lag<=4096;lag+=32){const correlation=corr(lag);if(correlation>best.correlation)best={lagSamples:lag,correlation};}
  const coarse=best.lagSamples;for(let lag=coarse-31;lag<=coarse+31;lag++){const correlation=corr(lag);if(correlation>best.correlation)best={lagSamples:lag,correlation};}
  let energy=0,peak=0;for(let channel=0;channel<decoded.numberOfChannels;channel++)for(const v of decoded.getChannelData(channel)){energy+=v*v;peak=Math.max(peak,Math.abs(v));}
  return{...best,rms:Math.sqrt(energy/decoded.length/decoded.numberOfChannels),peak,sampleRate:decoded.sampleRate,channels:decoded.numberOfChannels,duration:decoded.duration,
    scope:'Native AAC decoded after clock observation, correlated with actual postbus Worklet PCM; no independent local decode, isolated rifle residual, speaker or Control Center evidence'};
}
async function persist(){
  const evidence=output?.evidence()??{pcmParts:[],encodedParts:[],muxedParts:[]},receipts=[];
  for(const [name,parts]of [['postbus-pcm.f32-planar.bin',evidence.pcmParts],['native-packets.aac.bin',evidence.encodedParts],['native-stream.m4a',evidence.muxedParts]]){
    const response=await within(fetch('/__v177-aac-graph/evidence/'+name,{method:'POST',body:new Blob(parts)}),2000,'Raw evidence upload');if(!response.ok)throw new Error('Raw evidence upload failed '+response.status);receipts.push(await response.json());
  }
  state.artifacts=receipts;const body=JSON.stringify(state,null,2);const response=await within(fetch('/__v177-aac-graph/evidence/raw.json',{method:'POST',headers:{'Content-Type':'application/json'},body}),2000,'Raw JSON upload');if(!response.ok)throw new Error('Raw JSON upload failed '+response.status);return[...receipts,await response.json()];
}
async function complete(){
  if(completing)return;completing=true;warm.disabled=start.disabled=rifle.disabled=true;
  try{
    if(!state.primaryError){await output.finish();const evidence=output.evidence();state.content=await analyseContent(evidence.muxedParts,evidence.pcmParts);
      if(state.effect){const position=(state.effect.firstInputFrame+Math.max(0,state.content.lagSamples))/state.sampleRate;const reached=state.playheads.find(row=>row.time>=position);state.effect.positionSeconds=position;state.effect.observedByNativePlayheadAtMs=reached?.ms??null;state.effect.latencyMs=reached?reached.ms-state.effect.requestedAtMs:null;}
      state.status='complete';}
  }catch(error){fail(error);}
  finally{
    try{if(mixer)await within(mixer.dispose(),L.cleanupMs,'Original AudioMixer cleanup');else await output?.cleanup();if(context&&context.state!=='closed')await within(context.close(),L.cleanupMs,'Experimental context cleanup');await output?.cleanup();if(context&&context.state!=='closed')throw new Error('Actual context remained open');}
    catch(error){fail(error);state.cleanup??={completed:false,errors:[]};state.cleanup.completed=false;state.cleanup.errors.push(String(error));}
    try{if(!state.primaryError){state.observation=assertGraphObservation(state);state.observationGate='source-bound-graph-clock-pass-not-original-matrix-or-product-acceptance';}else state.observationGate='failed';}
    catch(error){fail(error);state.observationGate='failed';}
    try{state.saved=await persist();}catch(error){fail(error);state.persistenceFailure=String(error);}
    globalThis.__graphResult=state;document.documentElement.dataset.graphComplete='1';resolveComplete({status:state.status,primaryError:state.primaryError,persistenceFailure:state.persistenceFailure??null});
  }
}
try{
  const manifestResponse=await fetch('/__v177-aac-graph/manifest.json');if(!manifestResponse.ok)throw new Error('Pinned original manifest unavailable');const manifest=await manifestResponse.json();
  const NativeContext=globalThis.AudioContext??globalThis.webkitAudioContext;if(!NativeContext)throw new Error('Actual realtime AudioContext unavailable');context=new NativeContext();state.realtimeAudioContexts++;state.contextCountScope='probe-owned successful realtime constructor calls; original mixer identity/count separately bound';state.contextOptions='default constructor; actual sampleRate authoritative';
  output=await prepareGraphOutput(context,{state,workletUrl:'/__v177-aac-graph/probe/v177-native-aac-graph-worklet.mjs'});
  mixer=new AudioMixer({manifest,contextFactory:()=>context,enableAcknowledgementTone:false,logger:{warn:(...args)=>{state.mixerWarnings??=[];if(state.mixerWarnings.length<16)state.mixerWarnings.push(args.map(String));}}});
  mixer.attachLifecycle({windowTarget:globalThis,documentTarget:document});state.originalSettings=mixer.getSettings();
  const preloaded=await mixer.preloadAssets(['music-v100-score-normal','weapon-rifle-01']);if(preloaded.failed.length)throw new Error('Original asset fetch failed '+JSON.stringify(preloaded));
  warm.disabled=false;document.documentElement.dataset.graphPrepared='1';
  warm.onclick=async event=>{warm.disabled=true;try{
    if(!event.isTrusted)throw new Error('Warm input was not trusted');state.startedFromTrustedWarmClick=true;state.warmRequestedAt=performance.now();
    const unlocked=await mixer.unlock({reason:'one-prewarmed-graph-diagnostic'});if(!unlocked||!state.processorReady)throw new Error('Actual original mixer/output/processor warm-up did not finish');
    const decoded=await mixer.preloadAssets(['music-v100-score-normal','weapon-rifle-01']);if(decoded.failed.length)throw new Error('Original source decode failed '+JSON.stringify(decoded));
    state.warmReadyAtMs=ms();state.mixerContextSame=mixer.context===context;state.warmDiagnostics=mixer.getDiagnostics();state.status='warm-ready';start.disabled=false;
  }catch(error){fail(error);void complete();}};
  start.onclick=async event=>{start.disabled=true;try{
    if(!event.isTrusted)throw new Error('BGM input was not trusted');const request={trusted:event.isTrusted,requestedAtMs:ms(),requestedAtContext:context.currentTime};state.bgm=originalVoice(await mixer.play('music-v100-score-normal'),request);
    state.activeWindowStartedAtMs=ms();state.status='observing';rifle.disabled=false;setTimeout(()=>void complete(),L.caseMs);
  }catch(error){fail(error);void complete();}};
  rifle.onclick=async event=>{rifle.disabled=true;try{if(!event.isTrusted)throw new Error('Rifle input was not trusted');const request={trusted:event.isTrusted,requestedAtMs:ms(),requestedAtContext:context.currentTime};state.effect=originalVoice(await mixer.play('weapon-rifle-01'),request);}catch(error){fail(error);void complete();}};
}catch(error){fail(error);void complete();}