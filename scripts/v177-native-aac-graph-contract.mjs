// Output-only proposal. Pure contracts; importing this file launches nothing.
export const GRAPH_LIMITS=Object.freeze({caseMs:6000,maxCaptureMs:8000,rowDeadlineMs:30000,readyMs:5000,completionMs:15000,cleanupMs:2000,
  pcmPackets:512,pcmBytes:4*1024*1024,encoderQueue:4,pendingSegments:8,pendingBytes:256*1024,encodedBytes:1024*1024,muxedBytes:2*1024*1024,transportEvents:2048});
export function assertGraphHostedPlatform(platform,env) {
  if(platform!=='darwin'||env?.GITHUB_ACTIONS!=='true'||env?.RUNNER_OS!=='macOS')throw new Error('Hosted macOS GitHub Actions only; no local browser, audio or server launch');
  if(!/^[0-9a-f]{40}$/.test(env?.V177_GRAPH_EXPECTED_HEAD??''))throw new Error('Exact40-character candidate HEAD is required');
}
export function assertGraphEventBinding(env,actualHead,event=null){
  if(env.GITHUB_EVENT_NAME!=='pull_request'&&env.GITHUB_EVENT_NAME!=='workflow_dispatch')throw new Error('Only exact-head pull_request or manual workflow_dispatch is allowed');
  if(actualHead!==env.V177_GRAPH_EXPECTED_HEAD)throw new Error('Checkout differs from the requested exact candidate HEAD');
  if(env.GITHUB_EVENT_NAME==='pull_request'){
    if(!Number.isSafeInteger(event?.number)||event.number<1||event?.pull_request?.head?.sha!==actualHead)throw new Error('Actual PR payload/head is required before any owned launch');
    return{event:'pull_request',pullRequestNumber:event.number,head:actualHead,exact:true};
  }
  return{event:'workflow_dispatch',pullRequestNumber:null,head:actualHead,exact:true};
}
export function graphClockEvidence(state) {
  const budgetMs=150;
  const rows=Array.isArray(state.playheads)?state.playheads.filter(row=>row.encodedFrames!==undefined):[];
  let previous=null,maximumDelayMs=-Infinity,maximumAdvanceMs=-Infinity,maximumQueuedInputMs=-Infinity,backwards=0,
    invalid=Number.isFinite(state.sampleRate)&&state.sampleRate>0?0:1,outsideBudget=0;
  for(const row of rows){
    if(![row.ms,row.time,row.encodedFrames].every(Number.isFinite)||row.ms<0||row.time<0||!Number.isSafeInteger(row.encodedFrames)||row.encodedFrames<0){invalid++;continue;}
    if(previous&&(row.ms<previous.ms||row.time<previous.time))backwards++;
    const delay=row.ms-row.time*1000,queued=row.encodedFrames/state.sampleRate*1000-row.ms;
    maximumDelayMs=Math.max(maximumDelayMs,delay);maximumAdvanceMs=Math.max(maximumAdvanceMs,-delay);maximumQueuedInputMs=Math.max(maximumQueuedInputMs,queued);
    if(Math.abs(delay)>budgetMs||queued>budgetMs)outsideBudget++;
    previous=row;
  }
  return{budgetMs,observedSamples:rows.length,invalid,backwards,outsideBudget,maximumDelayMs,maximumAdvanceMs,maximumQueuedInputMs,
    accepted:rows.length>0&&invalid===0&&backwards===0&&outsideBudget===0,
    scope:'Native observed media clock only; it does not certify physical speaker or saved Control Center timing'};
}
export function assertGraphObservation(state) {
  const check=(ok,message)=>{if(!ok)throw new Error(message);};
  check(state.status==='complete','Actual graph observation did not complete');check(!state.primaryError&&state.errors.length===0,'Original graph/transport error retained');
  check(state.sampleRate>0&&state.sampleRate<65536,'Actual context rate is unsupported by the original muxer');check(state.realtimeAudioContexts===1,'Exactly one real AudioContext is required');
  check(state.mixerContextSame===true&&state.warmDiagnostics?.contextCreateCount===1&&state.warmDiagnostics?.contextTiming?.sampleRate===state.sampleRate,'Actual original mixer context identity/count/rate receipt missing');
  check(state.processorReady&&state.processorReady.sampleRate===state.sampleRate,'Actual processor ready/rate receipt missing');
  check(state.startedFromTrustedWarmClick&&state.bgm?.trusted&&state.effect?.trusted,'Real trusted warm/BGM/rifle inputs missing');
  check(state.bgm.assetId==='music-v100-score-normal'&&state.effect.assetId==='weapon-rifle-01','Original source identities differ');
  check(state.bgm.voiceId&&state.effect.voiceId&&state.bgm.voiceId!==state.effect.voiceId,'Actual original mixer voice IDs missing');
  check(Number.isFinite(state.effect.firstInputFrame)&&state.effect.firstInputFrame>=0&&state.effect.firstInputFrame<state.inputFrames,'Rifle source clock lies outside actual PCM');
  check(state.pcm.length>0&&state.pcm.length<=GRAPH_LIMITS.pcmPackets&&state.pcmBytes<=GRAPH_LIMITS.pcmBytes,'Raw PCM is absent or unbounded');
  check(state.packets.length>0&&state.encodedBytes<=GRAPH_LIMITS.encodedBytes,'Native AAC bytes absent or unbounded');
  check(state.finished?.status==='framed'&&state.finished.snapshot.partialFrames===0,'Partial PCM cannot be silently omitted or padded');
  check(state.finished.snapshot.acceptedFrames===state.inputFrames&&state.inputFrames===state.pcm.length*1024,'Actual PCM/encoded input receipt disagrees');
  check(state.transportOverflow===0&&state.peakEncoderQueue<=GRAPH_LIMITS.encoderQueue&&state.peakPendingSegments<=GRAPH_LIMITS.pendingSegments&&state.peakPendingBytes<=GRAPH_LIMITS.pendingBytes,'Bounded transport capacity failed');
  const first=state.events.find(row=>row.event==='playing');check(first&&first.ms<=150,'Native startup exceeds the original150ms budget');
  check(!state.events.some(row=>row.event==='waiting'&&row.ms>first.ms&&row.time<state.inputFrames/state.sampleRate-.05),'Native stream underflowed during input');
  const clock=graphClockEvidence(state);check(clock.accepted,'Input-start elapsed clock versus native playhead exceeded the original150ms budget');
  check(state.finalMedia&&!state.finalMedia.muted&&state.finalMedia.volume===1&&state.finalMedia.time>=state.inputFrames/state.sampleRate-.15,'Native playhead did not consume the observed input prefix');
  check(state.effect.latencyMs!==null&&state.effect.latencyMs>=0&&state.effect.latencyMs<=150,'Rifle native playhead observation exceeds the original150ms budget');
  check(state.content?.correlation>.7&&state.content.rms>.0001&&state.content.peak>.001,'Decoded AAC does not retain actual postbus PCM');
  check(state.cleanup?.completed===true,'Experimental resources were not cleaned up');
  return{clock,startupMs:first.ms,seLatencyMs:state.effect.latencyMs,scope:'One prewarmed graph/native clock and postbus-content diagnostic only; isolated SE residual correlation, cold, ending, lifecycle and physical recording are not accepted'};
}