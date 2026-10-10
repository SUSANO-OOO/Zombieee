// Stream the original files through Web Audio. iPhone locks the native media
// volume, so its setter cannot implement either the mix or a fade envelope.
// The native elements still own playback, seeking, buffering and their clocks.
import { createPlaybackAudioSession } from "./audioSession.js";
import { createAudioOutput } from "./audioOutput.js";

const graphs = new WeakMap();
const mediaOwners = new WeakMap();
const outputs = new WeakMap();
let sharedContext = null;
let owners = 0;
let closeTimer = null;

const clamp = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const disconnect = node => { try { node?.disconnect(); } catch { /* Already disconnected. */ } };
const setGain = (graph, value) => {
  // These envelopes are sampled by the player's animation clock. Keep a
  // current value instead of accumulating one automation event per frame.
  // Clearing old automation also makes the final zero synchronous on exit.
  graph.gain.gain.cancelScheduledValues?.(0);
  graph.gain.gain.value = value;
};
function defaultFactory() {
  const Constructor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (!Constructor) throw new Error("Web Audio is unavailable");
  return new Constructor();
}

export function endingAudioState(audio) {
  const graph = graphs.get(audio);
  return graph ? { gain: graph.gain.gain.value, context: graph.context.state } : null;
}

export function createEndingAudioMix(elements, {
  contextFactory = defaultFactory,
  canPlay = audio => !audio.paused && !audio.ended,
  onRecoveryState = () => {},
  navigatorTarget = globalThis.navigator,
  windowTarget = globalThis.window,
} = {}) {
  const media = elements.filter(Boolean);
  const levels = new Map(media.map(audio => [audio, 0]));
  const activeMedia = new Set();
  const owner = {};
  for (const audio of media) mediaOwners.set(audio, owner);
  let disposed = false;
  let watchedContext = null, removeStateListener = () => {};
  let recoveryPending = false, recoveryAttempted = false, recoveryState = null;
  owners += 1;
  clearTimeout(closeTimer);
  closeTimer = null;

  const eligible = audio => !disposed && mediaOwners.get(audio) === owner
    && activeMedia.has(audio) && !audio.ended && canPlay(audio);
  const playbackSession = createPlaybackAudioSession({
    navigatorTarget, windowTarget,
    canRecover: () => media.some(eligible),
    onRecover: () => {
      // Recheck native media too: the context can remain running while the OS
      // pauses an element. Finished or cancelled one-shots remain ineligible.
      if (watchedContext) watchContext(watchedContext, true);
    },
  });
  const notify = state => {
    if (disposed || recoveryState === state) return;
    recoveryState = state;
    onRecoveryState(state);
  };
  const silence = audio => {
    const graph = graphs.get(audio);
    if (mediaOwners.get(audio) !== owner || (graph && graph.owner !== owner)) return;
    if (graph) setGain(graph, 0);
    audio.pause();
  };
  async function resumeContext(context) {
    let timer;
    try {
      // Start synchronously inside a gesture when one is available. Never
      // create a second context or an acknowledgement sound to recover it.
      await Promise.race([context.resume(), new Promise((_, reject) => {
        timer = setTimeout(() => reject(new DOMException("Tap to enable sound", "NotAllowedError")), 2000);
      })]);
      if (context.state !== "running") throw new DOMException("Tap to enable sound", "NotAllowedError");
    } finally { clearTimeout(timer); }
  }
  function watchContext(context, recoverNow = false) {
    if (watchedContext === context && !recoverNow) return;
    removeStateListener();
    watchedContext = context;
    const stateChange = () => {
      if (disposed || watchedContext !== context) return;
      for (const audio of activeMedia) if (!eligible(audio)) silence(audio);
      const active = media.filter(eligible);
      if (!active.length) return;
      if (context.state === "running") {
        if (recoveryPending) return;
        if (!active.some(audio => audio.paused) && !outputs.get(context)?.needsRecovery()) {
          recoveryAttempted = false;
          for (const audio of active) setVolume(audio, levels.get(audio));
          notify("running");
          return;
        }
      } else if (context.state === "closed") {
        for (const audio of active) silence(audio);
        notify("unavailable");
        return;
      }
      if (["running", "interrupted", "suspended"].includes(context.state) && !recoveryPending && !recoveryAttempted) {
        recoveryPending = true;
        recoveryAttempted = true;
        notify("recovering");
        const resume = Promise.all([
          context.state === "running" ? Promise.resolve() : resumeContext(context),
          outputs.get(context)?.prepare(),
        ]);
        void resume.then(async () => {
          if (disposed) return;
          // The OS may pause native media as well as interrupt Web Audio.
          // Continue only the current owner's eligible tracks at their cursors.
          await Promise.all(active.map(async audio => {
            if (eligible(audio) && audio.paused) await audio.play();
            if (!eligible(audio)) silence(audio);
          }));
          if (disposed) return;
          for (const audio of active) {
            if (eligible(audio)) setVolume(audio, levels.get(audio));
            else silence(audio);
          }
          if (media.some(eligible)) { recoveryAttempted = false; notify("running"); }
        }).catch(() => {
          if (!disposed && media.some(eligible)) notify("gesture");
        }).finally(() => { recoveryPending = false; });
      }
    };
    context.addEventListener?.("statechange", stateChange);
    removeStateListener = () => context.removeEventListener?.("statechange", stateChange);
    // Foreground notifications can arrive in separate tasks. A failed native
    // replay stays latched until an explicit play succeeds; focus alone must
    // not turn it into repeated autoplay attempts.
    if (recoverNow) stateChange();
  }

  function setVolume(audio, value) {
    if (disposed || !levels.has(audio)) return;
    const volume = clamp(value);
    levels.set(audio, volume);
    const graph = graphs.get(audio);
    if (graph && graph.context.state !== "closed") { graph.owner = owner; setGain(graph, volume); }
    // Before the first play, desktop native media also starts at the right
    // level. Once routed, leave the native volume at unity to avoid two gains.
    audio.volume = graph ? 1 : volume;
  }

  async function play(audio) {
    if (disposed || !levels.has(audio)) return;
    playbackSession.prepare();
    // Some desktop WebKit ports provide native MP3 media without Web Audio.
    // Their native volume is writable; retain that existing playback path.
    if (!globalThis.AudioContext && !globalThis.webkitAudioContext && contextFactory === defaultFactory) {
      audio.volume = levels.get(audio);
      if (Math.abs(audio.volume - levels.get(audio)) > .001) throw new Error("Audio volume cannot be controlled");
      await audio.play();
      if (disposed && mediaOwners.get(audio) === owner) audio.pause();
      if (!disposed) activeMedia.add(audio);
      return;
    }
    if (!sharedContext || sharedContext.state === "closed") sharedContext = contextFactory();
    const context = sharedContext;
    if (!outputs.has(context)) outputs.set(context, createAudioOutput(context, {
      navigatorTarget, windowTarget,
      canPlay: () => context.state !== "closed" && owners > 0,
      onInterrupted: () => context.dispatchEvent?.(new Event("statechange")),
    }));
    const output = outputs.get(context);
    watchContext(context);
    let graph = graphs.get(audio);
    if (!graph) {
      const gain = context.createGain();
      gain.gain.value = levels.get(audio);
      const source = context.createMediaElementSource(audio);
      graph = { context, source, gain, owner };
      graphs.set(audio, graph);
    }
    if (graph.context !== context || graph.context.state === "closed") throw new Error("This media element has a closed audio graph");
    graph.owner = owner;
    setGain(graph, levels.get(audio));
    disconnect(graph.source);
    disconnect(graph.gain);
    graph.source.connect(graph.gain);
    graph.gain.connect(output.destination);
    audio.volume = 1;
    // Invoke both APIs before yielding so a tap can unlock both on iPhone.
    const resume = context.state === "running" ? Promise.resolve() : resumeContext(context);
    const outputReady = output.prepare();
    const nativePlay = audio.play().then(() => { if (disposed && mediaOwners.get(audio) === owner) audio.pause(); });
    await Promise.all([nativePlay, resume, outputReady]);
    if (!disposed && context.state !== "running") throw new DOMException("Tap to enable sound", "NotAllowedError");
    if (!disposed) { activeMedia.add(audio); recoveryAttempted = false; notify("running"); }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    playbackSession.dispose();
    removeStateListener();
    activeMedia.clear();
    for (const audio of media) {
      const graph = graphs.get(audio);
      if (graph?.owner === owner) {
        setGain(graph, 0);
        disconnect(graph.source);
        disconnect(graph.gain);
      }
      if (!graph || graph.owner === owner) { audio.pause(); audio.volume = 0; }
    }
    owners -= 1;
    if (owners === 0) {
      const context = sharedContext;
      outputs.get(context)?.pause();
      // React mounts the postcredits player after disposing the credits.
      // Keep its unlocked context across that handoff, then close at the end.
      closeTimer = setTimeout(() => {
        if (owners || sharedContext !== context) return;
        sharedContext = null;
        outputs.get(context)?.dispose();
        outputs.delete(context);
        if (context?.state !== "closed") void context?.close().catch(() => {});
      }, 100);
    }
  }
  const needsRecovery = audio => !disposed && graphs.has(audio)
    && (graphs.get(audio).context.state !== "running" || outputs.get(graphs.get(audio).context)?.needsRecovery());
  return { setVolume, play, needsRecovery, dispose };
}
