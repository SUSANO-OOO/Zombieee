// Web Audio defaults to an ambient iOS session. Classify the game's mixed
// output as playback across both mixers. This category is a compatibility
// measure; it cannot verify the audio in an OS screen-recording file.
const sessions = new WeakMap();

function readSession(navigatorTarget) {
  try { return navigatorTarget?.audioSession ?? null; } catch { return null; }
}

export function createPlaybackAudioSession({
  navigatorTarget = globalThis.navigator,
  windowTarget = globalThis.window,
  documentTarget = windowTarget?.document ?? globalThis.document,
  canRecover = () => true,
  onRecover = () => {},
} = {}) {
  const session = readSession(navigatorTarget);
  const key = session ?? windowTarget ?? {};
  let shared = sessions.get(key);
  if (!shared) {
    let previousType = null;
    try { previousType = session?.type ?? null; } catch { /* Optional API. */ }
    shared = { session, previousType, owners: new Set(), pending: null, pageAway: false, cleanup: null, applied: false };
    sessions.set(key, shared);
    const current = () => sessions.get(key) === shared;
    const eligible = () => [...shared.owners].filter(owner => {
      if (!owner.requested || shared.pageAway || owner.documentTarget?.visibilityState === "hidden") return false;
      try { return owner.canRecover(); } catch { return false; }
    });
    const setType = type => {
      if (!session || !current()) return false;
      try {
        if (session.type !== type) session.type = type;
        return session.type === type;
      } catch { return false; }
    };
    const interrupted = () => {
      try { return session?.state === "interrupted"; } catch { return false; }
    };
    shared.prepare = () => { shared.applied = setType("playback") || shared.applied; };
    shared.restore = () => {
      if (!shared.applied || !session || !current()) return;
      try {
        // Do not overwrite a category chosen by another page feature.
        if (["playback", "ambient"].includes(session.type) && shared.previousType) setType(shared.previousType);
      } catch { /* Session controls are not implemented by every browser. */ }
    };
    shared.recover = () => {
      if (shared.pending) return shared.pending;
      if (!current() || !eligible().length) return Promise.resolve(false);
      if (interrupted()) return Promise.resolve(false);
      // WebKit can retain a stale category while AudioContext still reports
      // running. Reassigning the same value is deduplicated. A bounded category
      // change across a task boundary re-applies the OS route (WebKit 323104).
      const task = (async () => {
        if (session && setType("ambient")) {
          shared.applied = true;
          await new Promise(resolve => setTimeout(resolve, 0));
        }
        if (!current() || interrupted()) return false;
        const owners = eligible();
        if (!owners.length) { shared.restore(); return false; }
        shared.prepare();
        await Promise.allSettled(owners.map(owner => Promise.resolve().then(() => {
          if (current() && !interrupted() && eligible().includes(owner)) return owner.onRecover();
          return false;
        })));
        return true;
      })();
      shared.pending = task;
      void task.finally(() => { if (shared.pending === task) shared.pending = null; });
      return task;
    };
    const recover = () => { void shared.recover(); };
    const hide = () => { shared.pageAway = true; };
    const show = () => { shared.pageAway = false; recover(); };
    const visible = () => { if (documentTarget?.visibilityState !== "hidden") recover(); };
    let lastState;
    try { lastState = session?.state; } catch { /* Type-only implementation. */ }
    const stateChange = () => {
      let state;
      try { state = session?.state; } catch { return; }
      const wasInterrupted = lastState === "interrupted";
      lastState = state;
      if (wasInterrupted && state !== "interrupted") recover();
    };
    windowTarget?.addEventListener?.("focus", recover);
    windowTarget?.addEventListener?.("pagehide", hide);
    windowTarget?.addEventListener?.("pageshow", show);
    documentTarget?.addEventListener?.("visibilitychange", visible);
    session?.addEventListener?.("statechange", stateChange);
    shared.cleanup = () => {
      windowTarget?.removeEventListener?.("focus", recover);
      windowTarget?.removeEventListener?.("pagehide", hide);
      windowTarget?.removeEventListener?.("pageshow", show);
      documentTarget?.removeEventListener?.("visibilitychange", visible);
      session?.removeEventListener?.("statechange", stateChange);
    };
  }
  const owner = { requested: false, canRecover, onRecover, documentTarget };
  shared.owners.add(owner);
  let disposed = false;
  return {
    prepare() {
      if (disposed) return;
      owner.requested = true;
      shared.prepare();
    },
    recover: () => disposed ? Promise.resolve(false) : shared.recover(),
    dispose() {
      if (disposed) return;
      disposed = true;
      shared.owners.delete(owner);
      if (!shared.owners.size) {
        shared.cleanup();
        shared.restore();
        if (sessions.get(key) === shared) sessions.delete(key);
      }
    },
  };
}
