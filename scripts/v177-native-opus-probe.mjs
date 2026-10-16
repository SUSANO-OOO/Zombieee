export const NATIVE_OPUS_RUNTIME = Object.freeze({ packageVersion: "1.63.0", revision: "2359", browserVersion: "26.6" });
export const NATIVE_OPUS_CONTEXT = Object.freeze({ viewport: Object.freeze({ width: 844, height: 390 }),
  isMobile: true, hasTouch: true, serviceWorkers: "block",
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 26_7_1 like Mac OS X) AppleWebKit/605.1.15 Version/26.7 Mobile/15E148 Safari/604.1" });
export const NATIVE_OPUS_CONFIGURATION = Object.freeze({ codec: "opus", sampleRate: 48000, numberOfChannels: 2,
  bitrate: 192000, opus: Object.freeze({ format: "opus", frameDuration: 10000 }) });
export const NATIVE_OPUS_MIME = 'audio/webm; codecs="opus"';
export const nativeOpusAcceptance = () => ({ physicalRecordingAccepted: false, productionBackendAccepted: false,
  latencyAccepted: false, wholeGameAccepted: false, gameBackendChanged: false, productionGameLoaded: false });
export const NATIVE_OPUS_SOURCES = Object.freeze([
  { id: "webcodecs-support", url: "https://www.w3.org/TR/2026/WD-webcodecs-20261007/#dom-audioencoder-isconfigsupported",
    scope: "Only recognized configuration members are returned; supported does not measure encoding, playback, latency or OS capture." },
  { id: "webcodecs-timestamps", url: "https://www.w3.org/TR/2026/WD-webcodecs-20261007/#output-encodedaudiochunks",
    scope: "The specification associates chunk timestamps/durations with input AudioData; it does not justify assuming every implementation emits a zero first timestamp or exactly one output per input. Raw native timestamps remain authoritative observations, with their WebM presentation interval reported separately." },
  { id: "opus-registration", url: "https://www.w3.org/TR/2026/DNOTE-webcodecs-opus-codec-registration-20260924/",
    scope: "Draft specifies raw opus output and frameDuration in microseconds. Actual TOC duration is also inspected." },
  { id: "opus-packets", url: "https://datatracker.ietf.org/doc/html/rfc6716#section-3",
    scope: "TOC configuration and packet framing define the native packet duration; chunk.duration alone is insufficient." },
  { id: "opus-head", url: "https://datatracker.ietf.org/doc/html/rfc7845#section-5.1",
    scope: "Native identification bytes carry pre-skip, input sample rate, output gain and channel mapping, retained unchanged." },
  { id: "webm-mse", url: "https://www.w3.org/TR/mse-byte-stream-format-webm/",
    scope: "MSE WebM initialization and finite Cluster media segments; no game server, file playback substitution or seek is used." },
  { id: "webm-container", url: "https://www.webmproject.org/docs/container/",
    scope: "audio/webm Opus, monotonic timestamps and WebM element semantics. 1us ticks preserve native microseconds exactly instead of the recommended 1ms default." },
  { id: "matroska-elements", url: "https://www.matroska.org/technical/elements.html",
    scope: "CodecDelay is native codec delay in nanoseconds subtracted by the consumer; BlockDuration uses Segment ticks." },
  { id: "matroska-opus-mapping", url: "https://www.ietf.org/archive/id/draft-ietf-cellar-codec-20.html#section-3.4.32",
    scope: "Current work-in-progress mapping specifies original OpusHead, preSkip*1e9/48000 CodecDelay and recommended 80ms SeekPreRoll." },
  { id: "webkit-opus-encoder", url: "https://github.com/WebKit/WebKit/blob/5a73a281aa54a019d11a86612dfcbc8582ea84ca/Source/WebCore/platform/audio/cocoa/AudioEncoderCocoa.cpp",
    scope: "Pinned source uses native preSkip in OpusHead and native packet timestamps/durations. It does not prove the runner or physical iPhone uses this commit." },
  { id: "webkit-codec-delay", url: "https://bugs.webkit.org/show_bug.cgi?id=254222",
    scope: "CodecDelay handling was fixed upstream July 20 2026. Inclusion in pinned browser 26.6 or the user's iOS is not assumed; metadata is never zeroed to hide a consumer discrepancy." },
]);

export function assertNativeOpusHost(platform, env) {
  if (platform !== "darwin" || env?.GITHUB_ACTIONS !== "true" || env?.RUNNER_OS !== "macOS"
    || env?.GITHUB_EVENT_NAME !== "pull_request" || !/^[a-f0-9]{40}$/u.test(env?.V177_EXPECTED_HEAD_SHA ?? "")) {
    throw new Error("Native Opus diagnostic requires hosted macOS/GitHub Actions and an exact PR head; local browser, game and audio launch is prohibited");
  }
}

// Serialized before page code. Offline decoding is allowed; realtime graphs and
// microphone APIs are forbidden even if another part of this diagnostic errs.
export function installNativeOpusGuard() {
  const activity = { realtimeAudioContextAttempts: 0, microphoneAttempts: 0 };
  Object.defineProperty(globalThis, "__V177_NATIVE_OPUS_ACTIVITY", { value: activity });
  for (const name of ["AudioContext", "webkitAudioContext"]) {
    const Native = globalThis[name]; if (typeof Native !== "function") continue;
    const reject = () => { activity.realtimeAudioContextAttempts++;
      throw new Error("Realtime AudioContext is forbidden in the native Opus diagnostic"); };
    globalThis[name] = new Proxy(Native, { construct: reject, apply: reject });
  }
  const rejectMicrophone = () => { activity.microphoneAttempts++;
    return Promise.reject(new Error("Microphone access is forbidden in the native Opus diagnostic")); };
  if (globalThis.navigator?.mediaDevices) Object.defineProperty(navigator.mediaDevices, "getUserMedia", { value: rejectMicrophone });
  for (const name of ["getUserMedia", "webkitGetUserMedia", "mozGetUserMedia"]) {
    if (typeof globalThis.navigator?.[name] === "function") Object.defineProperty(navigator, name, { value: rejectMicrophone });
  }
}

export function nativeOpusProbeCases() {
  return ["ManagedMediaSource", "MediaSource"].flatMap(route => ["bgm", "bgm-se"].map(mix => ({ route, mix, variant: "live-unprimed-10ms" })));
}

// Self-contained for page.evaluate serialization; no module closure references.
export async function runNativeOpusProbe({ muxerUrl, sourceUrls, route, mix, variant }) {
  const state = { schemaVersion: 1, diagnosticOnly: true, physicalRecordingAccepted: false, productionBackendAccepted: false,
    latencyAccepted: false, wholeGameAccepted: false, gameBackendChanged: false, productionGameLoaded: false,
    route, mix, variant, status: "starting", sampleRate: 48000, channels: 2, inputFrames: 0, inputDuration: 4,
    packets: [], configurations: [], segments: [], appends: [], sourceEvents: [], events: [], playheads: [],
    inputs: JSON.parse(JSON.stringify(sourceUrls)), errors: [], cleanupErrors: [] };
  globalThis.__V177_NATIVE_OPUS_STATE = state;
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const describe = error => ({ name: String(error?.name ?? "Error"), message: String(error?.message ?? error) });
  const sampleRate = 48000, framesPerPacket = 480, totalFrames = 192000;
  const reference = new Float32Array(totalFrames * 2), background = new Float32Array(totalFrames * 2);
  let audio, encoder, source, buffer, objectUrl, muxer, transport, startAt = null, nextFrame = 0;
  let seStartFrame = null, fatal = null, finishedEncoding = false;
  const pending = [], ms = () => startAt === null ? null : performance.now() - startAt;
  const fail = error => { const item = describe(error); state.errors.push(item); fatal = item.message; };
  try {
    check(["ManagedMediaSource", "MediaSource"].includes(route) && ["bgm", "bgm-se"].includes(mix)
      && variant === "live-unprimed-10ms", "Invalid bounded diagnostic case");
    check(globalThis.__V177_NATIVE_OPUS_ACTIVITY && globalThis.isSecureContext === true, "Required secure-page guard is missing");
    if (typeof globalThis.AudioEncoder !== "function" || typeof globalThis.AudioEncoder.isConfigSupported !== "function"
      || typeof globalThis.AudioData !== "function") {
      state.status = "unsupported-encoder-api"; return state;
    }
    const configuration = { codec: "opus", sampleRate, numberOfChannels: 2, bitrate: 192000, opus: { format: "opus", frameDuration: 10000 } };
    const supported = await AudioEncoder.isConfigSupported(configuration);
    state.encoderSupport = JSON.parse(JSON.stringify(supported));
    check(typeof supported?.supported === "boolean" && supported.config && typeof supported.config === "object", "Invalid encoder support response");
    if (!supported.supported) { state.status = "unsupported-encoder"; return state; }
    const normalized = supported.config;
    if (normalized.codec !== "opus" || normalized.sampleRate !== sampleRate || normalized.numberOfChannels !== 2
      || normalized.bitrate !== 192000 || normalized.opus?.format !== "opus" || normalized.opus?.frameDuration !== 10000) {
      state.status = "unsupported-normalized-configuration"; return state;
    }
    const Source = globalThis[route], mime = 'audio/webm; codecs="opus"';
    if (typeof Source !== "function" || typeof Source.isTypeSupported !== "function") {
      state.status = "unsupported-media-source-api"; return state;
    }
    state.mediaSourceSupported = Source.isTypeSupported(mime);
    check(typeof state.mediaSourceSupported === "boolean", "Invalid media source support response");
    if (!state.mediaSourceSupported) { state.status = "unsupported-media-source"; return state; }
    check(state.inputs.length === 2 && state.inputs.every(input => /^[a-f0-9]{64}$/u.test(input.expectedSha256)
      && new URL(input.url).origin === location.origin), "Original source binding is missing");
    const decoder = new OfflineAudioContext(2, 1, sampleRate);
    const inputs = await Promise.all(state.inputs.map(async input => {
      const response = await fetch(input.url); check(response.ok, "Original source fetch failed: " + response.status);
      const original = await response.arrayBuffer(), digest = await crypto.subtle.digest("SHA-256", original);
      input.sha256 = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("");
      input.bytes = original.byteLength; check(input.sha256 === input.expectedSha256, "Original asset bytes differ from the source pin");
      return decoder.decodeAudioData(original.slice(0));
    }));
    for (const input of inputs) check(input.sampleRate === sampleRate && input.length > 0, "Offline source decode rate/length mismatch");
    check(inputs[0].length >= totalFrames, "Existing BGM does not cover the four-second diagnostic");
    state.sourceSignals = inputs.map(input => ({ duration: input.duration, channels: input.numberOfChannels, sampleRate: input.sampleRate }));
    check(muxerUrl===location.origin+"/v177-opus-webm-muxer.mjs","Pinned same-origin muxer module is missing");
    state.moduleUrl=muxerUrl;state.moduleRequested=true;
    transport = await import(muxerUrl);state.moduleImported=true;
    audio = document.createElement("audio"); audio.controls = true; audio.disableRemotePlayback = true;
    audio.preload = "auto"; audio.muted = false; audio.volume = 1; audio.playbackRate = 1;
    document.body.append(audio); source = new Source();
    for (const event of ["sourceopen", "sourceended", "sourceclose", "startstreaming", "endstreaming"]) {
      source.addEventListener(event, () => state.sourceEvents.push({ event, ms: ms(), streaming: source.streaming ?? null,
        duration: Number.isFinite(source.duration) ? source.duration : String(source.duration), time: audio.currentTime }));
    }
    for (const event of ["playing", "waiting", "stalled", "ended", "error", "ratechange"]) {
      audio.addEventListener(event, () => state.events.push({ event, ms: ms(), time: audio.currentTime, playbackRate: audio.playbackRate }));
    }
    audio.addEventListener("error", () => fail(new Error("Native audio element error: " + (audio.error?.message ?? audio.error?.code ?? "unknown"))));
    objectUrl = URL.createObjectURL(source);
    const opened = new Promise((resolve, reject) => {
      source.addEventListener("sourceopen", resolve, { once: true });
      audio.addEventListener("error", () => reject(new Error("Native source open error")), { once: true });
    });
    audio.src = objectUrl; audio.load();
    let openTimer;
    try { await Promise.race([opened, new Promise((_, reject) => { openTimer = setTimeout(() => reject(new Error("Native source open timeout")), 5000); })]); }
    finally { clearTimeout(openTimer); }
    source.duration = Infinity; state.explicitLiveDuration = "Infinity";
    buffer = source.addSourceBuffer(mime);
    const drain = () => {
      if (fatal || buffer.updating || source.readyState !== "open") return;
      try {
        if (pending.length) {
          const item = pending.shift(), append = { segment: item.index, ms: ms(), bytes: item.data.length, returned: false };
          state.appends.push(append);
          buffer.appendBuffer(item.data);
          append.returned = true;
        } else if (finishedEncoding) source.endOfStream();
      } catch (error) { fail(error); }
    };
    const queue = data => { const index = state.segments.length;
      state.segments.push({ data: Array.from(data), atMs: ms() }); pending.push({ data, index }); drain(); };
    buffer.addEventListener("updateend", drain);
    buffer.addEventListener("error", () => fail(new Error("Native SourceBuffer error")));
    encoder = new AudioEncoder({ error: fail, output: (chunk, metadata) => {
      // Preserve native packet bytes/times and description BEFORE inspecting or muxing.
      const data = new Uint8Array(chunk.byteLength); chunk.copyTo(data);
      const packet = { timestamp: chunk.timestamp, duration: chunk.duration, type: chunk.type, data: Array.from(data), atMs: ms() };
      state.packets.push(packet);
      const config = metadata?.decoderConfig;
      if (config) {
        const view = config.description;
        const description = view ? Array.from(new Uint8Array(view.buffer ?? view, view.byteOffset ?? 0, view.byteLength)) : [];
        state.configurations.push({ codec: config.codec, sampleRate: config.sampleRate, numberOfChannels: config.numberOfChannels,
          description, packet: state.packets.length - 1 });
      }
      try {
        if (config) {
          const saved = state.configurations.at(-1), header = transport.parseNativeOpusHead(saved.description, saved);
          if (!muxer) {
            muxer = new transport.OpusWebmMuxer(saved.description, saved);
            state.nativeHeader = { ...header, original: Array.from(header.original) }; queue(muxer.initializationSegment);
          } else check(header.original.length === muxer.header.original.length
            && header.original.every((value, i) => value === muxer.header.original[i]), "Native OpusHead changed during the stream");
        }
        check(muxer, "Native encoder omitted its original OpusHead");
        packet.framing = transport.inspectOpusPacket(data);
        queue(muxer.segment({ data, timestamp: chunk.timestamp, duration: chunk.duration }));
      } catch (error) { fail(error); }
    } });
    encoder.configure(configuration);
    const music = [0, 1].map(channel => inputs[0].getChannelData(Math.min(channel, inputs[0].numberOfChannels - 1)));
    const rifle = [0, 1].map(channel => inputs[1].getChannelData(Math.min(channel, inputs[1].numberOfChannels - 1)));
    const sample = finalDrain => {
      const row = { ms: ms(), time: audio.currentTime, playbackRate: audio.playbackRate, paused: audio.paused,
        readyState: audio.readyState, pendingSegments: pending.length, encodeQueueSize: encoder.encodeQueueSize,
        buffered: Array.from({ length: audio.buffered.length }, (_, i) => [audio.buffered.start(i), audio.buffered.end(i)]) };
      if (finalDrain) row.finalDrain = true; else row.encodedFrames = nextFrame;
      state.playheads.push(row);
    };
    const start = document.getElementById("start-probe"), weapon = document.getElementById("weapon-probe");
    check(start && weapon, "Native interaction controls are missing");
    weapon.onclick = () => {
      if (startAt === null || mix !== "bgm-se" || seStartFrame !== null) return;
      seStartFrame = nextFrame; state.effect = { requestedAtMs: ms(), firstInputFrame: seStartFrame, sourceId: state.inputs[1].id };
    };
    document.documentElement.dataset.probeReady = "1";
    let clickTimer;
    try { await new Promise((resolve, reject) => { start.onclick = resolve;
      clickTimer = setTimeout(() => reject(new Error("Native start interaction timed out")), 10000); }); }
    finally { clearTimeout(clickTimer); }
    startAt = performance.now(); state.startedFromNativeClick = true;
    audio.play().catch(fail);
    while (nextFrame < totalFrames && !fatal && !state.stopRequested) {
      const targetMs = nextFrame / sampleRate * 1000, ahead = targetMs - ms();
      if (ahead > 0) await wait(ahead);
      check(encoder.encodeQueueSize <= 32, "Native encoder queue exceeded the bounded diagnostic window");
      const pcm = new Float32Array(framesPerPacket * 2);
      for (let frame = 0; frame < framesPerPacket; frame++) {
        const cursor = nextFrame + frame, effectCursor = seStartFrame === null ? -1 : cursor - seStartFrame;
        for (let channel = 0; channel < 2; channel++) {
          const bgm = music[channel][cursor] * .18;
          const value = bgm + (effectCursor >= 0 ? (rifle[channel][effectCursor] ?? 0) * .5 : 0);
          check(Number.isFinite(value) && Math.abs(value) < 1, "Diagnostic PCM is clipped or not finite");
          pcm[channel * framesPerPacket + frame] = value;
          reference[cursor * 2 + channel] = value; background[cursor * 2 + channel] = bgm;
        }
      }
      const data = new AudioData({ format: "f32-planar", sampleRate, numberOfChannels: 2,
        numberOfFrames: framesPerPacket, timestamp: nextFrame / framesPerPacket * 10000, data: pcm });
      try { encoder.encode(data); } finally { data.close(); }
      nextFrame += framesPerPacket; state.inputFrames = nextFrame; sample(false);
    }
    check(!state.stopRequested, "Driver stopped an incomplete diagnostic"); check(!fatal, fatal);
    await encoder.flush(); check(!fatal, fatal); finishedEncoding = true; drain();
    while (!fatal && ms() < 7500 && (pending.length || buffer.updating || !audio.ended)) { await wait(10); sample(true); }
    check(!fatal, fatal); check(pending.length === 0 && !buffer.updating && source.readyState === "ended", "Native stream append/end did not finish");
    state.finalMedia = { time: audio.currentTime, duration: Number.isFinite(audio.duration) ? audio.duration : String(audio.duration),
      ended: audio.ended, paused: audio.paused, muted: audio.muted, volume: audio.volume, playbackRate: audio.playbackRate, readyState: audio.readyState };
    state.status = "complete";
  } catch (error) { state.status = "failed"; fail(error); }
  finally {
    state.referencePcm = nextFrame === 0 ? [] : Array.from(new Uint8Array(reference.buffer));
    state.backgroundPcm = nextFrame === 0 ? [] : Array.from(new Uint8Array(background.buffer));
    const clean = action => { try { action(); } catch (error) { state.cleanupErrors.push(describe(error)); state.status = "failed"; } };
    clean(() => { if (encoder && encoder.state !== "closed") encoder.close(); });
    clean(() => { if (audio) { audio.pause(); audio.removeAttribute("src"); audio.load(); audio.remove(); } });
    clean(() => { if (objectUrl) URL.revokeObjectURL(objectUrl); });
    state.activity = JSON.parse(JSON.stringify(globalThis.__V177_NATIVE_OPUS_ACTIVITY ?? null));
  }
  return state;
}

// Serialized separately, after the unmodified encoder/stream evidence is saved.
export async function decodeNativeOpusContent(encoded) {
  const decoder = new OfflineAudioContext(2, 1, 48000);
  const decoded = await decoder.decodeAudioData(new Uint8Array(encoded).buffer);
  return { sampleRate: decoded.sampleRate, channels: decoded.numberOfChannels, length: decoded.length, duration: decoded.duration,
    channelData: Array.from({ length: decoded.numberOfChannels }, (_, channel) => Array.from(new Uint8Array(decoded.getChannelData(channel).buffer))) };
}

export function analyseOpusPcm({ decoded, reference, background, effect }) {
  if (decoded?.sampleRate !== 48000 || decoded.channels !== 2 || !Number.isSafeInteger(decoded.length) || decoded.length < 8192
    || !Number.isFinite(decoded.duration) || decoded.channelData?.length !== 2) throw new Error("Invalid native offline decode shape");
  const arrays = [reference, background, ...decoded.channelData];
  if (arrays.some(value => !(value instanceof Uint8Array || Array.isArray(value)) || value.length % 4
    || Array.from(value).some(item => !Number.isInteger(item) || item < 0 || item > 255))) throw new Error("Invalid PCM byte evidence");
  const [ref, bgm, ...channels] = arrays.map(value => new Float32Array(Uint8Array.from(value).buffer));
  if (ref.length !== 384000 || bgm.length !== ref.length || channels.some(value => value.length !== decoded.length)
    || [ref, bgm, ...channels].some(value => value.some(item => !Number.isFinite(item)))) throw new Error("Incomplete or nonfinite PCM evidence");
  const mono = channels[0];
  const correlate = (lag, start = 4096, end = Math.min(ref.length / 2 - 4096, mono.length - 4096), residual = false) => {
    let dot = 0, a2 = 0, b2 = 0;
    for (let i = start; i < end; i += 16) {
      const j = i + lag; if (j < 0 || j >= mono.length) continue;
      const b = ref[i * 2] - (residual ? bgm[i * 2] : 0), a = mono[j] - (residual ? bgm[i * 2] : 0);
      dot += a * b; a2 += a * a; b2 += b * b;
    }
    return dot / Math.sqrt(a2 * b2 || 1);
  };
  let best = { lagSamples: 0, correlation: -1 };
  for (let lag = -4096; lag <= 4096; lag += 32) { const correlation = correlate(lag);
    if (correlation > best.correlation) best = { lagSamples: lag, correlation }; }
  const coarse = best.lagSamples;
  for (let lag = coarse - 31; lag <= coarse + 31; lag++) { const correlation = correlate(lag);
    if (correlation > best.correlation) best = { lagSamples: lag, correlation }; }
  let energy = 0, peak = 0;
  for (const channel of channels) for (const value of channel) { energy += value * value; peak = Math.max(peak, Math.abs(value)); }
  const effectCorrelation = effect ? correlate(best.lagSamples, effect.firstInputFrame,
    Math.min(effect.firstInputFrame + 24000, ref.length / 2 - 4096, mono.length - 4096), true) : null;
  return { duration: decoded.duration, sampleRate: decoded.sampleRate, channels: decoded.channels,
    rms: Math.sqrt(energy / decoded.length / decoded.channels), peak, ...best, effectCorrelation,
    scope: "Native offline decoding of the exact appended WebM correlated with original asset PCM. Lag is content alignment only; native clock timestamps are not adjusted. No speaker or Control Center evidence." };
}

export function nativeOpusClockEvidence(state) {
  const rows = Array.isArray(state?.playheads) ? state.playheads.filter(row => row.encodedFrames !== undefined) : [];
  let previous = null, maximumDelayMs = null, maximumAdvanceMs = null, maximumQueuedInputMs = null;
  let backwards = 0, invalid = state?.sampleRate === 48000 ? 0 : 1, outsideBudget = 0;
  for (const row of rows) {
    if (![row.ms, row.time, row.encodedFrames].every(Number.isFinite) || row.ms < 0 || row.time < 0
      || !Number.isSafeInteger(row.encodedFrames) || row.encodedFrames < 0 || row.playbackRate !== 1) { invalid++; continue; }
    if (previous && (row.ms < previous.ms || row.time < previous.time || row.encodedFrames < previous.encodedFrames)) backwards++;
    const delay = row.ms - row.time * 1000, queued = row.encodedFrames / 48000 * 1000 - row.ms;
    maximumDelayMs = Math.max(maximumDelayMs ?? -Infinity, delay);
    maximumAdvanceMs = Math.max(maximumAdvanceMs ?? -Infinity, -delay);
    maximumQueuedInputMs = Math.max(maximumQueuedInputMs ?? -Infinity, queued);
    if (Math.abs(delay) > 150 || queued > 150) outsideBudget++;
    previous = row;
  }
  return { budgetMs: 150, observedSamples: rows.length, invalid, backwards, outsideBudget,
    maximumDelayMs, maximumAdvanceMs, maximumQueuedInputMs,
    accepted: rows.length > 0 && !invalid && !backwards && !outsideBudget,
    scope: "Every raw native media-clock sample during input, without priming, rate changes, play-event offsets or clock correction. Diagnostic only." };
}

export function nativeOpusPacketEvidence(state) {
  const packets = Array.isArray(state?.packets) ? state.packets : [], errors = [];
  const firstTimestampUs = packets[0]?.timestamp ?? null, header = state?.nativeHeader;
  const validHeader = Number.isSafeInteger(header?.preSkipSamples) && header.preSkipSamples >= 0 && header.preSkipSamples <= 65535
    && header.codecDelayNs === Math.round(header.preSkipSamples * 1e9 / 48000);
  if (!validHeader) errors.push("Original OpusHead/CodecDelay evidence is missing or inconsistent");
  if (!packets.length) errors.push("Native Opus packets are missing");
  let previous = null;
  for (let i = 0; i < packets.length; i++) {
    const packet = packets[i];
    if (!Number.isSafeInteger(packet?.timestamp) || packet?.duration !== 10000 || packet?.framing?.durationUs !== 10000
      || (previous && packet.timestamp !== previous.timestamp + previous.duration)) errors.push("Native packet continuity/TOC differs at " + i);
    previous = packet;
  }
  const nativeEndUs = previous && Number.isSafeInteger(previous.timestamp) && previous.duration === 10000 ? previous.timestamp + previous.duration : null;
  const nativeSpanUs = Number.isSafeInteger(firstTimestampUs) && Number.isSafeInteger(nativeEndUs) ? nativeEndUs - firstTimestampUs : null;
  const codecDelayUs = validHeader ? header.codecDelayNs / 1000 : null;
  const presentationStartUs = nativeSpanUs === null || codecDelayUs === null ? null : firstTimestampUs - codecDelayUs;
  const presentationEndUs = nativeSpanUs === null || codecDelayUs === null ? null : nativeEndUs - codecDelayUs;
  // Retain the same 150ms full-stream coverage criterion, without moving any
  // packet/native clock. Legitimate negative origins and flush tails are kept.
  if (nativeSpanUs === null || nativeSpanUs < 4000000) errors.push("Native packet span does not cover the four-second input");
  if (presentationStartUs === null || Math.abs(presentationStartUs) > 150000
    || presentationEndUs < 3850000) errors.push("Declared WebM presentation interval misses the original 150ms coverage contract");
  return { passed: errors.length === 0, errors, firstTimestampUs, nativeEndUs, nativeSpanUs, codecDelayUs,
    declaredWebmPresentationIntervalUs: [presentationStartUs, presentationEndUs], inputIntervalUs: [0, 4000000],
    nativeZeroOriginObserved: firstTimestampUs === 0, flushTailPackets: Math.max(0, packets.length - 400), timestampCorrectionUs: 0,
    scope: "Native bytes/timestamps are not rebased. Declared WebM presentation interval subtracts original CodecDelay per Matroska. Actual consumer handling and input/content alignment still require native clock and offline decode evidence; zero origin is not a route support requirement." };
}

export function evaluateNativeOpusEvidence(state, content) {
  const errors = [], clock = nativeOpusClockEvidence(state), packetClock = nativeOpusPacketEvidence(state), fail = (ok, message) => { if (!ok) errors.push(message); };
  fail(state?.schemaVersion === 1 && state.diagnosticOnly === true, "Invalid diagnostic schema");
  for (const key of Object.keys(nativeOpusAcceptance())) fail(state?.[key] === false, "Acceptance must remain false: " + key);
  fail(state?.status === "complete" && Array.isArray(state.errors) && state.errors.length === 0
    && Array.isArray(state.cleanupErrors) && state.cleanupErrors.length === 0, "Native probe did not complete cleanly");
  fail(state?.activity?.realtimeAudioContextAttempts === 0 && state?.activity?.microphoneAttempts === 0, "Forbidden media API attempted or guard absent");
  const config = state?.encoderSupport?.config;
  fail(state?.encoderSupport?.supported === true && config?.codec === "opus" && config?.sampleRate === 48000
    && config?.numberOfChannels === 2 && config?.bitrate === 192000 && config?.opus?.format === "opus"
    && config?.opus?.frameDuration === 10000, "Native configuration did not recognize raw 10ms Opus");
  fail(state?.inputFrames === 192000 && state?.inputDuration === 4 && state?.startedFromNativeClick === true
    && state?.explicitLiveDuration === "Infinity", "Input duration, native gesture or live stream changed");
  const playheads = Array.isArray(state?.playheads) ? state.playheads : [];
  fail(packetClock.passed, packetClock.errors.join("; "));
  fail(Number.isFinite(content?.duration) && content.duration >= 3.5 && content.duration <= 4.5, "Native decoded duration outside the original 3.5–4.5s contract");
  fail(content?.sampleRate === 48000 && content?.channels === 2 && content.rms > .0001 && content.peak > .001
    && content.peak <= 1, "Native decoded mix is silent, clipped or malformed");
  fail(content?.correlation > .7, "Original BGM content correlation failed");
  const media = state?.finalMedia;
  fail(Number.isFinite(media?.time) && media.time >= 3.85 && media.muted === false && media.volume === 1
    && media.playbackRate === 1 && media.ended === true, "Native playback did not consume the full stream at its original rate");
  const events = Array.isArray(state?.events) ? state.events : [], first = events.find(event => event.event === "playing");
  const firstAdvance = playheads.find(row => Number.isFinite(row.time) && row.time > 0);
  const startupMs = first?.ms ?? null, firstAdvanceMs = firstAdvance?.ms ?? null;
  fail(Number.isFinite(startupMs) && startupMs >= 0 && startupMs <= 150, "Native playing startup exceeds 150ms or is absent");
  fail(Number.isFinite(firstAdvanceMs) && firstAdvanceMs >= 0 && firstAdvanceMs <= 150, "Native clock did not advance within 150ms");
  const underflows = events.filter(event => event.event === "waiting" && first && event.ms > first.ms && event.time < 3.95);
  fail(underflows.length === 0, "Native stream underflowed during continuous input"); fail(clock.accepted, "Raw native clock exceeded the original 150ms budget");
  fail(clock.observedSamples === 400, "Input-period native clock observations are missing");
  let effectLatencyMs = null;
  if (state?.mix === "bgm-se") {
    const effect = state.effect;
    fail(Number.isFinite(effect?.requestedAtMs) && effect.requestedAtMs >= 0 && Number.isSafeInteger(effect?.firstInputFrame)
      && effect.firstInputFrame >= 0 && effect.firstInputFrame < 168000, "Native rifle click or input placement is missing");
    fail(content?.effectCorrelation > .6, "Original rifle content correlation failed");
    // Positive content lag can only make the measured latency worse; it never
    // shifts the native clock or reduces the original 150ms criterion.
    const position = effect && Number.isFinite(content?.lagSamples) ? (effect.firstInputFrame + Math.max(0, content.lagSamples)) / 48000 : Infinity;
    const reached = playheads.find(row => row.time >= position && row.ms >= effect?.requestedAtMs);
    if (reached) effectLatencyMs = reached.ms - effect.requestedAtMs;
    fail(Number.isFinite(effectLatencyMs) && effectLatencyMs >= 0 && effectLatencyMs <= 150, "Native rifle latency exceeds 150ms or was not observed");
  } else fail(state?.mix === "bgm" && !state.effect, "Unexpected diagnostic mix/effect");
  return { passed: errors.length === 0, errors, clock, packetClock, startupMs, firstAdvanceMs, underflows, effectLatencyMs };
}
