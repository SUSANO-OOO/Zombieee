// Self-contained serialized hosted probe. The game and realtime graphs never load.
export async function runNativePcmProbe({sourceUrls,variant,mix}) {
  const state={variant,mix,status:'starting',events:[],playheads:[],inputs:sourceUrls.map(x=>({...x})),errors:[],cleanupErrors:[],
    physicalRecordingAccepted:false,productionBackendAccepted:false,gameBackendChanged:false,wholeGameAccepted:false};
  globalThis.__V177_NATIVE_PCM_STATE=state;
  const check=(yes,message)=>{if(!yes)throw new Error(message);},wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  let audio,startAt=null;
  try {
    check(globalThis.__V177_NATIVE_OPUS_ACTIVITY&&globalThis.isSecureContext,'Required hosted guard is missing');
    const decoder=new OfflineAudioContext(2,1,48000);
    const pcm=await Promise.all(state.inputs.map(async(input,index)=>{
      check(new URL(input.url).origin===location.origin,'Source origin differs');
      const response=await fetch(input.url);check(response.ok,'Source request failed');
      const raw=await response.arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',raw);
      input.sha256=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');input.bytes=raw.byteLength;
      check(input.sha256===input.expectedSha256,'Source hash differs');
      const decoded=await decoder.decodeAudioData(raw.slice(0));check(decoded.sampleRate===48000&&decoded.length>0,'PCM source rate/length differs');
      const frames=index===0?192000:Math.min(192000,decoded.length);if(index===0)check(decoded.length>=frames,'BGM is too short');
      const interleaved=new Float32Array(frames*2);for(let c=0;c<2;c++){const channel=decoded.getChannelData(Math.min(c,decoded.numberOfChannels-1));
        for(let i=0;i<frames;i++)interleaved[i*2+c]=channel[i];}
      input.decoded={frames,channels:2,sampleRate:48000};
      const upload=await fetch('/pcm/'+index,{method:'POST',body:interleaved});check(upload.ok,'PCM upload failed');input.upload=await upload.json();return interleaved;
    }));
    check(pcm.length===2,'Both source inputs are required');
    audio=document.createElement('audio');audio.controls=false;audio.autoplay=false;audio.preload='none';audio.playsInline=true;
    audio.setAttribute('playsinline','');audio.disableRemotePlayback=true;audio.volume=1;audio.muted=false;audio.playbackRate=1;
    for(const event of ['loadstart','loadedmetadata','canplay','playing','waiting','stalled','ended','error'])audio.addEventListener(event,()=>{
      state.events.push({event,ms:startAt===null?null:performance.now()-startAt,time:audio.currentTime,error:audio.error?{code:audio.error.code,message:audio.error.message}:null});
    });
    const start=document.getElementById('start-probe'),weapon=document.getElementById('weapon-probe');check(start&&weapon,'Native buttons are missing');
    let startRequest,playRequest,effectRequest;
    weapon.onclick=event=>{
      if(startAt===null||mix!=='bgm-se'||state.effect)return;
      state.effect={requestedAtMs:performance.now()-startAt,trusted:event.isTrusted,server:null,ackAtMs:null};
      effectRequest=fetch('/effect',{method:'POST'}).then(async r=>{check(r.ok,'Effect request failed');state.effect.server=await r.json();state.effect.ackAtMs=performance.now()-startAt;})
        .catch(error=>state.errors.push(String(error)));
    };
    const begun=new Promise(resolve=>{start.onclick=event=>{if(startAt!==null)return;startAt=performance.now();state.startTrusted=event.isTrusted;
      audio.src='/stream.wav';
      // Both calls occur before yielding the trusted gesture. No preload starts the producer.
      startRequest=fetch('/start',{method:'POST'}).then(async r=>{check(r.ok,'Start request failed');state.startAck=await r.json();state.startAckAtMs=performance.now()-startAt;})
        .catch(error=>state.errors.push(String(error)));
      try{playRequest=Promise.resolve(audio.play()).catch(error=>state.errors.push(String(error)));}catch(error){state.errors.push(String(error));}
      resolve();};});
    document.documentElement.dataset.probeReady='1';await begun;
    while(performance.now()-startAt<7000&&!audio.ended){
      const ms=performance.now()-startAt;state.playheads.push({ms,time:audio.currentTime,paused:audio.paused,readyState:audio.readyState,
        buffered:Array.from({length:audio.buffered.length},(_,i)=>[audio.buffered.start(i),audio.buffered.end(i)])});
      await wait(10);
    }
    // Settled handlers are part of this observation, bounded by the same owner deadline.
    await Promise.race([Promise.all([startRequest,playRequest,effectRequest]),wait(250).then(()=>{throw new Error('Native requests did not settle');})]);
    state.finalMedia={time:audio.currentTime,duration:audio.duration,ended:audio.ended,paused:audio.paused,
      volume:audio.volume,muted:audio.muted,playbackRate:audio.playbackRate};
    state.status=state.errors.length?'failed':'complete';
  }catch(error){state.errors.push(String(error));state.status='failed';}
  finally {
    state.activity={...globalThis.__V177_NATIVE_OPUS_ACTIVITY};
    try{if(audio){audio.pause();audio.removeAttribute('src');audio.load();audio.remove();}}catch(error){state.cleanupErrors.push(String(error));state.status='failed';}
  }
  return state;
}

export function nativePcmClockEvidence(state,server) {
  const budgetMs=150,rows=state.playheads??[],active=rows.filter(r=>r.ms<=4000);
  let invalid=0,backwards=0,outsideBudget=0,maximumDelayMs=-Infinity,maximumAdvanceMs=-Infinity,previous=null;
  for(const row of rows){if(!Number.isFinite(row.ms)||!Number.isFinite(row.time)||row.ms<0||row.time<0){invalid++;continue;}
    if(previous&&(row.ms<previous.ms||row.time<previous.time))backwards++;previous=row;}
  for(const row of active){const delay=row.ms-row.time*1000;maximumDelayMs=Math.max(maximumDelayMs,delay);maximumAdvanceMs=Math.max(maximumAdvanceMs,-delay);if(Math.abs(delay)>budgetMs)outsideBudget++;}
  const gaps=active.slice(1).map((r,i)=>r.ms-active[i].ms),maximumSampleGapMs=gaps.length?Math.max(...gaps):null;
  const coverageAccepted=active.length>=100&&active[0].ms<=150&&active.at(-1).ms>=3850&&maximumSampleGapMs<=150;
  const producerRows=server?.stream?.rows??[],queue=producerRows.map(r=>r.inputFrames/48000*1000-r.ms);
  const producerQueueMs=queue.length?Math.max(...queue):null;
  const producerAccepted=state.variant==='static'?null:queue.length===400&&queue.every(Number.isFinite)&&queue.every(v=>v<=budgetMs);
  return {budgetMs,observedSamples:rows.length,inputPeriodSamples:active.length,invalid,backwards,outsideBudget,maximumDelayMs,maximumAdvanceMs,
    maximumSampleGapMs,coverageAccepted,producerQueueMs,producerAccepted,accepted:coverageAccepted&&invalid===0&&backwards===0&&outsideBudget===0
      &&(state.variant==='static'||producerAccepted===true),
    scope:'Native playhead relative to the browser trusted start; producer queue uses its own Node clock. No browser/Node clock subtraction. Static control has no live queue acceptance. Not physical recorded audio.'};
}
