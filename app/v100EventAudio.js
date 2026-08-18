import { createAudioMixer } from "./audioMixer.js";
import { PRODUCTION_AUDIO_MANIFEST } from "./productionAudio.js";

function now() {
  return new Date().toISOString();
}

export function createV100EventAudioOwner({ windowTarget = globalThis.window, onState = null } = {}) {
  const receipts = [];
  const mixer = createAudioMixer({
    manifest: PRODUCTION_AUDIO_MANIFEST,
    maxVoices: 12,
    maxWarningsTotal: 4,
    maxWarningsPerKey: 1,
    logger: null,
  });
  let desired = null;
  let activeScene = null;
  let disposed = false;
  const publish = (state) => {
    try { onState?.(state, snapshot()); } catch { /* QA/UI observers are optional. */ }
  };
  const record = (action, presentation, extra = {}) => {
    const receipt = {
      at: now(),
      action,
      eventId: presentation?.eventId ?? null,
      nodeIndex: presentation?.nodeIndex ?? null,
      category: presentation?.category ?? null,
      sceneId: presentation?.sceneId ?? null,
      transition: presentation?.transition ?? null,
      ...extra,
    };
    receipts.push(receipt);
    if (receipts.length > 160) receipts.splice(0, receipts.length - 160);
    publish(receipt);
    return receipt;
  };
  const unsubscribe = mixer.subscribeStatus((status) => publish({ type: "status", ...status }), { emitCurrent: true });
  const detachUnlock = mixer.attachUnlock(windowTarget);

  async function present(presentation, reason = "node") {
    if (disposed || !presentation?.sceneId) return null;
    const key = `${presentation.eventId}:${presentation.nodeIndex}:${presentation.sceneId}`;
    if (desired?.key === key) return mixer.getSceneState();
    const previous = desired;
    desired = { key, presentation };
    if (previous && previous.presentation.sceneId !== presentation.sceneId) {
      record("transitioned", presentation, { fromSceneId: previous.presentation.sceneId, reason });
    }
    record("requested", presentation, { reason });
    mixer.setDialogueDucking(Boolean(presentation.dialogueDucking), { fadeMs: 180 });
    const state = await mixer.setScene(presentation.sceneId);
    if (disposed || desired?.key !== key) return state;
    if (state?.sceneId === presentation.sceneId) {
      activeScene = { key, presentation };
      record("started", presentation, { bgmAssetId: state.bgmAssetId, ambienceAssetIds: state.ambienceAssetIds });
    } else {
      record("queued", presentation, { audioState: mixer.getAudioStatus().state });
    }
    return state;
  }

  async function activate(presentation) {
    if (disposed) return false;
    const unlocked = await mixer.unlock({ reason: "v100-event-gesture" });
    if (!unlocked) {
      record("unlock-failed", presentation, { audioState: mixer.getAudioStatus().state });
      return false;
    }
    // React owns scene presentation through the event effect. The click path
    // only unlocks the already-requested scene and emits the node cue; calling
    // present here could re-apply a stale node after the state transition.
    if (presentation?.cueId) {
      record("cue-requested", presentation, { cueId: presentation.cueId });
      const handle = await mixer.play(presentation.cueId, {
        dedupeKey: `v100-event:${presentation.eventId}:${presentation.nodeIndex}:${presentation.cueId}`,
        instanceKey: `v100-event-cue:${presentation.eventId}`,
      });
      if (handle) record("cue-started", presentation, { cueId: presentation.cueId });
    }
    return true;
  }

  async function stop(reason = "route-transition") {
    if (disposed) return;
    const previous = activeScene ?? desired;
    if (previous) record("stopped", previous.presentation, { reason });
    activeScene = null;
    desired = null;
    mixer.setDialogueDucking(false, { fadeMs: 120 });
    await mixer.stopScene({ fadeMs: 120 });
  }

  function snapshot() {
    return {
      owner: "v100-event-runtime",
      desired: desired?.presentation ?? null,
      active: activeScene?.presentation ?? null,
      receipts: receipts.map((entry) => ({ ...entry })),
      diagnostics: mixer.getDiagnostics(),
      audioStatus: mixer.getAudioStatus(),
    };
  }

  const qaBridge = {
    unlock: () => mixer.unlock({ reason: "v100-event-qa" }),
    present,
    activate,
    stop,
    getReceipts: () => receipts.map((entry) => ({ ...entry })),
    getSnapshot: snapshot,
    getDiagnostics: () => mixer.getDiagnostics(),
    resetReceipts: () => { receipts.length = 0; return true; },
  };
  if (windowTarget && (windowTarget.location?.hostname === "localhost" || windowTarget.location?.hostname === "127.0.0.1")) {
    windowTarget.__V100_EVENT_AUDIO_QA__ = qaBridge;
  }

  return {
    present,
    activate,
    stop,
    snapshot,
    dispose: async () => {
      if (disposed) return;
      await stop("dispose");
      disposed = true;
      unsubscribe();
      detachUnlock();
      if (windowTarget?.__V100_EVENT_AUDIO_QA__ === qaBridge) delete windowTarget.__V100_EVENT_AUDIO_QA__;
      await mixer.dispose();
    },
  };
}
