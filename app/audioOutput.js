// Keep the authored mix in Web Audio, but render it as native media on iOS.
// A context owns one output. Never connect its mix to both audible routes.
export function usesNativeMediaOutput(navigatorTarget = globalThis.navigator) {
  return /iP(?:hone|ad|od)/u.test(navigatorTarget?.userAgent ?? "")
    || (/Macintosh/u.test(navigatorTarget?.userAgent ?? "") && navigatorTarget?.maxTouchPoints > 1);
}

const disconnect = node => { try { node?.disconnect(); } catch { /* Already released. */ } };
const abortError = () => new DOMException("Audio output is no longer active", "AbortError");

export function createAudioOutput(context, {
  navigatorTarget = globalThis.navigator,
  windowTarget = globalThis.window,
  documentTarget = windowTarget?.document ?? globalThis.document,
  canPlay = () => true,
  onInterrupted = () => {},
  timeoutMs = 2000,
} = {}) {
  let mode = "direct", input = null, streamNode = null, audio = null;
  let disposed = false, desired = false, pageAway = false, generation = 0, pending = null;
  const rotation = windowTarget?.matchMedia?.("(orientation: portrait)");
  const allowed = () => !disposed && !pageAway && documentTarget?.visibilityState !== "hidden"
    && !rotation?.matches && canPlay();
  const stopMedia = () => {
    if (audio) {
      try { audio.pause(); audio.srcObject = null; } catch { /* Unsupported native media attachment. */ }
      audio.remove?.();
    }
    for (const track of streamNode?.stream?.getTracks?.() ?? []) track.stop();
    disconnect(streamNode);
  };
  try {
    if (usesNativeMediaOutput(navigatorTarget) && context.createMediaStreamDestination && documentTarget?.createElement) {
      streamNode = context.createMediaStreamDestination();
      audio = documentTarget.createElement("audio");
      audio.hidden = true;
      audio.autoplay = false;
      audio.playsInline = true;
      audio.setAttribute("playsinline", "");
      audio.setAttribute("data-game-audio-output", "");
      audio.volume = 1;
      audio.muted = false;
      audio.srcObject = streamNode.stream;
      input = context.createGain();
      input.connect(streamNode);
      documentTarget.body?.appendChild(audio);
      mode = "media-stream";
    }
  } catch {
    stopMedia(); disconnect(input);
    input = null; streamNode = null; audio = null;
  }
  const pause = () => {
    desired = false;
    generation += 1;
    pending?.cancel();
    audio?.pause();
  };
  const onHidden = () => { if (!allowed()) pause(); };
  const onPageHide = () => { pageAway = true; pause(); };
  const onPageShow = () => { pageAway = false; };
  const onPause = () => {
    // A pause initiated by us clears desired first. An OS interruption keeps
    // it set and lets the existing owner perform its bounded recovery.
    if (desired && allowed()) onInterrupted();
  };
  if (audio) {
    audio.addEventListener("pause", onPause);
    windowTarget?.addEventListener?.("pagehide", onPageHide);
    windowTarget?.addEventListener?.("pageshow", onPageShow);
    documentTarget?.addEventListener?.("visibilitychange", onHidden);
    rotation?.addEventListener?.("change", onHidden);
  }

  function prepare() {
    if (!allowed()) return Promise.reject(abortError());
    if (!audio || mode === "direct") return Promise.resolve(true);
    if (pending) return pending.promise;
    desired = true;
    if (!audio.paused) return Promise.resolve(true);
    const current = generation;
    let cancel, timer;
    const cancelled = new Promise((_, reject) => { cancel = () => reject(abortError()); });
    // play() and the owner's AudioContext.resume() must both run in the
    // original gesture task. Do not defer this call through a promise chain.
    let nativePlay;
    try { nativePlay = Promise.resolve(audio.play()); }
    catch (error) { nativePlay = Promise.reject(error); }
    const attempt = {};
    const lateStop = () => { if (!desired || disposed || !allowed()) audio?.pause(); };
    void nativePlay.then(lateStop, lateStop);
    attempt.cancel = cancel;
    attempt.promise = Promise.race([nativePlay, cancelled, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new DOMException("Tap to enable sound", "NotAllowedError")), timeoutMs);
    })]).then(() => {
      if (!allowed() || generation !== current || !desired) throw abortError();
      if (audio.paused) throw new DOMException("Tap to enable sound", "NotAllowedError");
      return true;
    }).catch(error => {
      if (generation === current) { desired = false; audio?.pause(); }
      throw error;
    }).finally(() => {
      clearTimeout(timer);
      if (pending === attempt) pending = null;
    });
    pending = attempt;
    return attempt.promise;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    pause();
    audio?.removeEventListener("pause", onPause);
    windowTarget?.removeEventListener?.("pagehide", onPageHide);
    windowTarget?.removeEventListener?.("pageshow", onPageShow);
    documentTarget?.removeEventListener?.("visibilitychange", onHidden);
    rotation?.removeEventListener?.("change", onHidden);
    stopMedia();
    disconnect(input);
  }
  return {
    destination: input ?? context.destination,
    prepare, pause, dispose,
    foreground: onPageShow,
    needsRecovery: () => mode === "media-stream" && (!desired || audio.paused),
    snapshot: () => ({ mode, paused: audio?.paused ?? null, disposed }),
  };
}
