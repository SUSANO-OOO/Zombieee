// Stream the original files through Web Audio. iPhone locks the native media
// volume, so its setter cannot implement either the mix or a fade envelope.
// The native elements still own playback, seeking, buffering and their clocks.
const graphs = new WeakMap();
const mediaOwners = new WeakMap();
let sharedContext = null;
let owners = 0;
let closeTimer = null;

const clamp = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const disconnect = node => { try { node?.disconnect(); } catch { /* Already disconnected. */ } };
function defaultFactory() {
  const Constructor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (!Constructor) throw new Error("Web Audio is unavailable");
  return new Constructor();
}

export function endingAudioState(audio) {
  const graph = graphs.get(audio);
  return graph ? { gain: graph.gain.gain.value, context: graph.context.state } : null;
}

export function createEndingAudioMix(elements, { contextFactory = defaultFactory } = {}) {
  const media = elements.filter(Boolean);
  const levels = new Map(media.map(audio => [audio, 0]));
  const owner = {};
  for (const audio of media) mediaOwners.set(audio, owner);
  let disposed = false;
  owners += 1;
  clearTimeout(closeTimer);
  closeTimer = null;

  function setVolume(audio, value) {
    if (disposed || !levels.has(audio)) return;
    const volume = clamp(value);
    levels.set(audio, volume);
    const graph = graphs.get(audio);
    if (graph && graph.context.state !== "closed") { graph.owner = owner; graph.gain.gain.setValueAtTime(volume, graph.context.currentTime); }
    // Before the first play, desktop native media also starts at the right
    // level. Once routed, leave the native volume at unity to avoid two gains.
    audio.volume = graph ? 1 : volume;
  }

  async function play(audio) {
    if (disposed || !levels.has(audio)) return;
    // Some desktop WebKit ports provide native MP3 media without Web Audio.
    // Their native volume is writable; retain that existing playback path.
    if (!globalThis.AudioContext && !globalThis.webkitAudioContext && contextFactory === defaultFactory) {
      audio.volume = levels.get(audio);
      if (Math.abs(audio.volume - levels.get(audio)) > .001) throw new Error("Audio volume cannot be controlled");
      await audio.play();
      if (disposed && mediaOwners.get(audio) === owner) audio.pause();
      return;
    }
    if (!sharedContext || sharedContext.state === "closed") sharedContext = contextFactory();
    const context = sharedContext;
    let graph = graphs.get(audio);
    if (!graph) {
      const gain = context.createGain();
      gain.gain.setValueAtTime(levels.get(audio), context.currentTime);
      const source = context.createMediaElementSource(audio);
      graph = { context, source, gain, owner };
      graphs.set(audio, graph);
    }
    if (graph.context !== context || graph.context.state === "closed") throw new Error("This media element has a closed audio graph");
    graph.owner = owner;
    graph.gain.gain.setValueAtTime(levels.get(audio), context.currentTime);
    disconnect(graph.source);
    disconnect(graph.gain);
    graph.source.connect(graph.gain);
    graph.gain.connect(context.destination);
    audio.volume = 1;
    // Invoke both APIs before yielding so a tap can unlock both on iPhone.
    const resume = context.state === "running" ? Promise.resolve() : context.resume();
    const nativePlay = audio.play().then(() => { if (disposed && mediaOwners.get(audio) === owner) audio.pause(); });
    let timer;
    try {
      await Promise.all([nativePlay, Promise.race([resume, new Promise((_, reject) => {
        timer = setTimeout(() => reject(new DOMException("Tap to enable sound", "NotAllowedError")), 2000);
      })])]);
      if (!disposed && context.state !== "running") throw new DOMException("Tap to enable sound", "NotAllowedError");
    } finally { clearTimeout(timer); }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const audio of media) {
      const graph = graphs.get(audio);
      if (graph?.owner === owner) {
        graph.gain.gain.setValueAtTime(0, graph.context.currentTime);
        disconnect(graph.source);
        disconnect(graph.gain);
      }
      if (!graph || graph.owner === owner) { audio.pause(); audio.volume = 0; }
    }
    owners -= 1;
    if (owners === 0) {
      const context = sharedContext;
      // React mounts the postcredits player after disposing the credits.
      // Keep its unlocked context across that handoff, then close at the end.
      closeTimer = setTimeout(() => {
        if (owners || sharedContext !== context) return;
        sharedContext = null;
        if (context?.state !== "closed") void context?.close().catch(() => {});
      }, 100);
    }
  }
  return { setVolume, play, dispose };
}
