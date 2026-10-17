export function assertNativeAacHostedPlatform(platform) {
  if (platform === "win32") throw new Error("Native AAC diagnostic is hosted-only; local browser/audio launch is prohibited");
}

// Hosted diagnostic only. It never loads the game and creates no realtime AudioContext.
export async function runNativeAacProbe({ muxerSource, sourceUrls, route, mix, variant = 'original', live = false, primeFrames = 0 }) {
  const state = { route, mix, variant, live, primeFrames, managedEvents:[], status: "starting", sampleRate: 48000, channels: 2, packets: [],
    configurations: [], events: [], playheads: [], inputs: [], errors: [], realtimeAudioContexts: 0,
    transportCapacity:1024,transportEvents:[],transportEventOverflow:0,
    physicalRecordingAccepted: false, gameBackendChanged: false };
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  let audio, encoder, source, objectUrl, moduleUrl, buffer, pending = [], muxer, nextFrame = 0;
  let startAt = null, seStartFrame = null, seRequestedAt = null, fatal = null, ended = false;
  const sampleRate = state.sampleRate, framesPerPacket = 1024, totalFrames = 188 * framesPerPacket;
  const recordTransport = (event,details={}) => {
    if(state.transportEvents.length>=state.transportCapacity){state.transportEventOverflow++;return;}
    const ranges=value=>Array.from({length:value?.length??0},(_,i)=>[value.start(i),value.end(i)]);
    const number=value=>Number.isFinite(value)?value:String(value);
    state.transportEvents.push({event,at:performance.now(),ms:startAt===null?null:performance.now()-startAt,
      sourceReadyState:source?.readyState??null,sourceDuration:number(source?.duration),
      bufferUpdating:buffer?.updating??null,sourceBuffered:source?.readyState==='closed'?null:ranges(buffer?.buffered),pendingSegments:pending.length,
      mediaReadyState:audio?.readyState??null,mediaTime:audio?.currentTime??null,mediaDuration:number(audio?.duration),
      paused:audio?.paused??null,buffered:ranges(audio?.buffered),...details});
  };
  const reference = new Float32Array(totalFrames * 2), background = new Float32Array(totalFrames * 2);
  state.inputs = sourceUrls;
  globalThis.__v177RecordTransport=recordTransport;
  globalThis.__v177NativeAacState=state;
  try {
    check(Number.isSafeInteger(primeFrames) && primeFrames >= 0 && primeFrames <= 3072 && primeFrames % 1024 === 0, "Invalid bounded priming window");
    check(typeof AudioEncoder === "function" && typeof AudioData === "function", "WebCodecs audio is unavailable");
    const configuration = { codec: "mp4a.40.2", sampleRate, numberOfChannels: 2, bitrate: 192000,
      aac: { format: "aac" } };
    const supported = await AudioEncoder.isConfigSupported(configuration);
    state.encoderSupport = supported;
    if (!supported.supported) { state.status = "unsupported-encoder"; return state; }
    const Source = globalThis[route];
    const mime = 'audio/mp4; codecs="mp4a.40.2"';
    state.mediaSourceSupported = typeof Source === "function" && Source.isTypeSupported(mime);
    if (!state.mediaSourceSupported) { state.status = "unsupported-media-source"; return state; }
    const decoder = new OfflineAudioContext(2, 1, sampleRate);
    const inputs = await Promise.all(sourceUrls.map(async input => {
      const response = await fetch(input.url);
      check(response.ok, "Source fetch failed: " + response.status);
      const data = await response.arrayBuffer();
      const digest = await crypto.subtle.digest("SHA-256", data);
      input.sha256 = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
      input.bytes = data.byteLength;
      check(input.sha256 === input.expectedSha256, "Fetched source differs from the candidate asset");
      return decoder.decodeAudioData(data.slice(0));
    }));
    for (const input of inputs) check(input.sampleRate === sampleRate, "Source decoder rate mismatch");
    state.sourceSignals = inputs.map(input => ({ duration: input.duration, channels: input.numberOfChannels }));
    moduleUrl = URL.createObjectURL(new Blob([muxerSource], { type: "text/javascript" }));
    const transport = await import(moduleUrl);
    audio = document.createElement("audio");
    audio.controls = true; audio.disableRemotePlayback = true; audio.preload = "auto";
    audio.muted = false; audio.volume = 1;
    document.body.append(audio);
    source = new Source();
    for (const event of ["sourceopen","sourceended","sourceclose","startstreaming","endstreaming"]) source.addEventListener(event, () => {
      state.managedEvents.push({event,ms:startAt === null ? null : performance.now()-startAt,streaming:source.streaming ?? null,duration:Number.isFinite(source.duration)?source.duration:String(source.duration),mediaTime:audio.currentTime});
      recordTransport(event);
    });
    objectUrl = URL.createObjectURL(source);
    const opened = new Promise((resolve, reject) => {
      source.addEventListener("sourceopen", resolve, { once: true });
      audio.addEventListener("error", () => reject(new Error("Native source open error")), { once: true });
    });
    audio.src = objectUrl; audio.load();
    await Promise.race([opened, wait(5000).then(() => { throw new Error("Native source open timeout"); })]);
    state.durationInitialization={before:Number.isFinite(source.duration)?source.duration:String(source.duration),assignedInfinity:live};
    if (live) { source.duration = Infinity; state.explicitLiveDuration = "Infinity"; }
    state.durationInitialization.after=Number.isFinite(source.duration)?source.duration:String(source.duration);
    recordTransport('duration-initialized');
    buffer = source.addSourceBuffer(mime);
    const drain = () => {
      if (fatal || buffer.updating || source.readyState !== "open") return;
      try {
        if (pending.length) {
          const segment=pending.shift();recordTransport('append-call',{bytes:segment.byteLength});
          buffer.appendBuffer(segment);
        }
        else if (ended) source.endOfStream();
      } catch (error) { fatal = String(error); state.errors.push(fatal); }
    };
    for(const event of ['updatestart','update'])buffer.addEventListener(event,()=>recordTransport(event));
    buffer.addEventListener("updateend",()=>{recordTransport('updateend');drain();});
    buffer.addEventListener("error", () => { fatal = "SourceBuffer error"; state.errors.push(fatal); });
    for (const event of ["playing", "waiting", "stalled", "ended", "error"])
      audio.addEventListener(event, () => {state.events.push({ event, ms: startAt === null ? null : performance.now() - startAt, time: audio.currentTime });recordTransport('media-'+event);});
    for(const event of ['loadedmetadata','loadeddata','canplay','canplaythrough','durationchange','play','pause'])
      audio.addEventListener(event,()=>recordTransport('media-'+event));
    encoder = new AudioEncoder({
      error: error => { fatal = String(error); state.errors.push(fatal); },
      output: (chunk, metadata) => {
        // Preserve native bytes and configuration BEFORE parsing, clock checks, or muxing.
        const data = new Uint8Array(chunk.byteLength); chunk.copyTo(data);
        const row = { timestamp: chunk.timestamp, duration: chunk.duration, type: chunk.type,
          data: Array.from(data), atMs: startAt === null ? null : performance.now() - startAt };
        state.packets.push(row);
        try {
          const config = metadata?.decoderConfig;
          if (config) {
            const description = config.description ? Array.from(new Uint8Array(config.description)) : [];
            state.configurations.push({ codec: config.codec, sampleRate: config.sampleRate,
              numberOfChannels: config.numberOfChannels, description, packet: state.packets.length - 1 });
            const normalized = transport.normalizeAacDescription(description, config);
            if (!muxer) {
              muxer = new transport.AacFragmentMuxer(description, config);
              state.normalizedDescription = Array.from(normalized.asc);
              pending.push(muxer.initializationSegment);
            } else check(normalized.asc.every((b, i) => b === state.normalizedDescription[i]), "AAC description changed");
          }
          check(muxer, "Encoder omitted its decoder configuration");
          const ordinal = state.packets.length - 1;
          check(Math.abs(chunk.timestamp - Math.round(ordinal * framesPerPacket / sampleRate * 1e6)) <= 1,
            "Native AAC timestamp is not the measured zero-based packet clock");
          check(chunk.duration !== null && Math.abs(chunk.duration - framesPerPacket / sampleRate * 1e6) <= 1,
            "Native AAC duration differs from 1024 samples");
          pending.push(muxer.segment([{ data, timestampSamples: ordinal * framesPerPacket, durationSamples: framesPerPacket }]));
          drain();
        } catch (error) { fatal = String(error); state.errors.push(fatal); }
      }
    });
    encoder.configure(configuration);
    const encodeBlock = observe => {
      const pcm = new Float32Array(framesPerPacket * 2);
      for (let frame = 0; frame < framesPerPacket; frame++) {
        const cursor = nextFrame + frame;
        for (let channel = 0; channel < 2; channel++) {
          const music = inputs[0].getChannelData(Math.min(channel, inputs[0].numberOfChannels - 1));
          const effect = inputs[1].getChannelData(Math.min(channel, inputs[1].numberOfChannels - 1));
          const bgm = (music[cursor] ?? 0) * .18;
          const effectCursor = seStartFrame === null ? -1 : cursor - seStartFrame;
          const value = bgm + (effectCursor >= 0 ? (effect[effectCursor] ?? 0) * .5 : 0);
          check(Number.isFinite(value) && Math.abs(value) < 1, "Diagnostic PCM clipped or was not finite");
          pcm[channel * framesPerPacket + frame] = value;
          reference[cursor * 2 + channel] = value;
          background[cursor * 2 + channel] = bgm;
        }
      }
      const data = new AudioData({ format: "f32-planar", sampleRate, numberOfFrames: framesPerPacket,
        numberOfChannels: 2, timestamp: Math.round(nextFrame / sampleRate * 1e6), data: pcm });
      try { encoder.encode(data); } finally { data.close(); }
      if (observe) {
      state.playheads.push({ ms: performance.now() - startAt, time: audio.currentTime,
        encodedFrames: nextFrame + framesPerPacket, encodeQueueSize: encoder.encodeQueueSize,
        pendingSegments: pending.length, readyState: audio.readyState, paused: audio.paused,
        buffered: Array.from({ length: audio.buffered.length }, (_, i) => [audio.buffered.start(i), audio.buffered.end(i)]) });
      if (state.effect && state.effect.observedByNativePlayheadAtMs === null
          && audio.currentTime * sampleRate >= state.effect.firstInputFrame)
        state.effect.observedByNativePlayheadAtMs = performance.now() - startAt;
      }
      nextFrame += framesPerPacket;
    };
    const start = document.getElementById("start-probe"), weapon = document.getElementById("weapon-probe");
    check(start && weapon, "Missing native interaction controls");
    weapon.onclick = () => {
      if (startAt === null || mix !== "bgm-se" || seStartFrame !== null) return;
      seRequestedAt = performance.now() - startAt;
      seStartFrame = nextFrame;
      state.effect = { requestedAtMs: seRequestedAt, firstInputFrame: seStartFrame,
        sourceId: sourceUrls[1].id, observedByNativePlayheadAtMs: null };
    };
    if (primeFrames) {
      recordTransport('priming-start');
      const preparingAt = performance.now();
      while (nextFrame < primeFrames && !fatal) encodeBlock(false);
      while (!fatal && (state.packets.length < primeFrames/framesPerPacket || pending.length || buffer.updating || audio.readyState < 1)) {
        check(performance.now()-preparingAt < 2000, "Native priming preparation timed out");
        await wait(5);
      }
      check(!fatal, fatal);
      state.priming = {inputFrames:nextFrame,packets:state.packets.length,prepareMs:performance.now()-preparingAt,mediaPaused:audio.paused,mediaTime:audio.currentTime};
      recordTransport('priming-ready');
    }
    document.documentElement.dataset.probeReady = "1";
    await new Promise(resolve => { start.onclick = resolve; });
    startAt = performance.now();
    state.startedFromNativeClick = true;
    recordTransport('play-call');
    const play = audio.play();
    play.then(()=>recordTransport('play-resolved'),error => { fatal = String(error); state.errors.push(fatal);recordTransport('play-rejected'); });
    while (nextFrame < totalFrames && !fatal) {
      const target = (nextFrame - primeFrames) / sampleRate * 1000;
      if (performance.now() - startAt < target) await wait(target - (performance.now() - startAt));
      encodeBlock(true);
    }
    check(!fatal, fatal);
    await encoder.flush(); check(!fatal, fatal);
    ended = true; drain();
    while (performance.now() - startAt < 7000 && audio.currentTime < totalFrames / sampleRate - .05 && !fatal) {
      await wait(20);
      state.playheads.push({ ms: performance.now() - startAt, time: audio.currentTime, finalDrain: true });
    }
    check(!fatal, fatal);
    state.finalMedia = { time: audio.currentTime, duration: audio.duration, ended: audio.ended,
      paused: audio.paused, muted: audio.muted, volume: audio.volume, readyState: audio.readyState };
    state.inputFrames = nextFrame; state.inputDuration = totalFrames / sampleRate;
    state.status = "complete";
  } catch (error) { state.status = "failed"; state.errors.push(String(error)); }
  finally {
    state.realtimeAudioContexts = globalThis.__v177RealtimeAudioContextAttempts ?? 0;
    state.referencePcm = nextFrame === 0 ? [] : Array.from(new Uint8Array(reference.buffer));
    state.backgroundPcm = nextFrame === 0 ? [] : Array.from(new Uint8Array(background.buffer));
    try { if (encoder && encoder.state !== "closed") encoder.close(); } catch (error) { state.errors.push(String(error)); state.status = "failed"; }
    try { if (audio) { audio.pause(); audio.removeAttribute("src"); audio.load(); audio.remove(); } } catch (error) { state.errors.push(String(error)); state.status = "failed"; }
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    if (moduleUrl) URL.revokeObjectURL(moduleUrl);
    if(globalThis.__v177RecordTransport===recordTransport)delete globalThis.__v177RecordTransport;
    if(globalThis.__v177NativeAacState===state)delete globalThis.__v177NativeAacState;
  }
  return state;
}

export async function analyseNativeAacContent({ encoded, reference, background, effect }) {
  const sampleRate = 48000, decoder = new OfflineAudioContext(2, 1, sampleRate);
  const decoded = await decoder.decodeAudioData(new Uint8Array(encoded).buffer);
  const ref = new Float32Array(new Uint8Array(reference).buffer);
  const bgm = new Float32Array(new Uint8Array(background).buffer);
  const mono = decoded.getChannelData(0);
  const correlate = (lag, start = 4096, end = Math.min(ref.length / 2 - 4096, mono.length - 4096), residual = false) => {
    let dot = 0, a2 = 0, b2 = 0;
    for (let i = start; i < end; i += 16) {
      const j = i + lag; if (j < 0 || j >= mono.length) continue;
      const b = ref[i * 2] - (residual ? bgm[i * 2] : 0);
      const a = mono[j] - (residual ? bgm[i * 2] : 0);
      dot += a * b; a2 += a * a; b2 += b * b;
    }
    return dot / Math.sqrt(a2 * b2 || 1);
  };
  let best = { lagSamples: 0, correlation: -1 };
  for (let lag = -4096; lag <= 4096; lag += 32) {
    const correlation = correlate(lag); if (correlation > best.correlation) best = { lagSamples: lag, correlation };
  }
  const coarse = best.lagSamples;
  for (let lag = coarse - 31; lag <= coarse + 31; lag++) {
    const correlation = correlate(lag); if (correlation > best.correlation) best = { lagSamples: lag, correlation };
  }
  let energy = 0, peak = 0;
  for (let c = 0; c < decoded.numberOfChannels; c++) for (const value of decoded.getChannelData(c)) {
    energy += value * value; peak = Math.max(peak, Math.abs(value));
  }
  const effectCorrelation = effect ? correlate(best.lagSamples, effect.firstInputFrame,
    Math.min(effect.firstInputFrame + 24000, ref.length / 2 - 4096, mono.length - 4096), true) : null;
  return { duration: decoded.duration, sampleRate: decoded.sampleRate, channels: decoded.numberOfChannels,
    rms: Math.sqrt(energy / decoded.length / decoded.numberOfChannels), peak, ...best, effectCorrelation,
    contentScope: "Decoded generated native AAC file correlated with the actual existing BGM and optional rifle PCM; not speaker or Control Center proof" };
}

export function nativeAacProbeCases() {
  return [
    {route:"ManagedMediaSource",variant:"original",live:false,primeFrames:0},
    {route:"ManagedMediaSource",variant:"live",live:true,primeFrames:0},
    {route:"ManagedMediaSource",variant:"live-primed",live:true,primeFrames:3072},
    {route:"MediaSource",variant:"original",live:false,primeFrames:0},
    {route:"ManagedMediaSource",variant:"observer-control",live:false,primeFrames:0,completion:"promise",freshBrowser:true},
    {route:"ManagedMediaSource",variant:"primed",live:false,primeFrames:3072,completion:"promise",freshBrowser:true},
  ].flatMap(scenario => ["bgm","bgm-se"].map(mix => ({...scenario,mix})));
}

// A final advancing clock cannot hide a frozen clock during streaming.
// Apply the same 150ms budget to every observed input-period sample.
export function nativeAacClockEvidence(state) {
  const budgetMs = 150;
  const rows = Array.isArray(state.playheads) ? state.playheads.filter(row => row.encodedFrames !== undefined) : [];
  let previous = null, maximumDelayMs = -Infinity, maximumAdvanceMs = -Infinity;
  let maximumQueuedInputMs = -Infinity, backwards = 0, invalid = Number.isFinite(state.sampleRate) && state.sampleRate > 0 ? 0 : 1, outsideBudget = 0;
  for (const row of rows) {
    if (![row.ms,row.time,row.encodedFrames].every(Number.isFinite) || row.ms < 0 || row.time < 0 || !Number.isSafeInteger(row.encodedFrames) || row.encodedFrames < 0) { invalid++; continue; }
    if (previous && (row.ms < previous.ms || row.time < previous.time)) backwards++;
    const delay = row.ms - row.time * 1000, queued = row.encodedFrames / state.sampleRate * 1000 - row.ms;
    maximumDelayMs = Math.max(maximumDelayMs, delay);
    maximumAdvanceMs = Math.max(maximumAdvanceMs, -delay);
    maximumQueuedInputMs = Math.max(maximumQueuedInputMs, queued);
    if (Math.abs(delay) > budgetMs || queued > budgetMs) outsideBudget++;
    previous = row;
  }
  return { budgetMs, observedSamples:rows.length, invalid, backwards, outsideBudget,
    maximumDelayMs, maximumAdvanceMs, maximumQueuedInputMs,
    accepted:rows.length>0 && invalid===0 && backwards===0 && outsideBudget===0,
    scope:"Native observed media clock only; it does not certify physical speaker or saved Control Center timing" };
}
