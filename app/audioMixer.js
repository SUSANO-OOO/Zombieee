import { AUDIO_CATEGORIES, createAudioManifest } from "./audioManifest.js";

const DEFAULT_CATEGORY_VOLUMES = Object.freeze({
  bgm: 1,
  ambience: 1,
  ui: 0.8,
  weapons: 0.82,
  melee: 0.84,
  humanVoices: 0.9,
  monsters: 0.86,
  support: 0.9,
});

export const AUDIO_MIXER_STATES = Object.freeze({
  LOCKED: "locked",
  UNLOCKING: "unlocking",
  RUNNING: "running",
  RECOVERY_NEEDED: "recovery-needed",
  FAILED: "failed",
  DISPOSED: "disposed",
});

export function createAudioRequestGate() {
  let generation = 0;
  return Object.freeze({
    capture: () => generation,
    cancelPending: () => {
      generation += 1;
      return generation;
    },
    isCurrent: (requestGeneration) => requestGeneration === generation,
  });
}

export async function runGuardedAudioRequest({
  gate,
  unlock,
  play,
  fallback = null,
  isMuted = () => false,
} = {}) {
  if (!gate || typeof gate.capture !== "function" || typeof gate.isCurrent !== "function") {
    throw new TypeError("A valid audio request gate is required");
  }
  if (typeof unlock !== "function" || typeof play !== "function") {
    throw new TypeError("Audio request unlock and play callbacks are required");
  }
  const requestGeneration = gate.capture();
  const isCurrent = () => gate.isCurrent(requestGeneration) && !isMuted();
  const guardedFallback = (...args) => {
    if (isCurrent() && typeof fallback === "function") return fallback(...args);
    return null;
  };
  try {
    const unlocked = await unlock();
    if (!isCurrent()) return null;
    if (!unlocked) return guardedFallback();
    return await play(guardedFallback);
  } catch (error) {
    return guardedFallback(error);
  }
}

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));

const PRELOAD_PRIORITIES = Object.freeze({
  background: 0,
  normal: 1,
  critical: 2,
});

function preloadPriority(value) {
  return PRELOAD_PRIORITIES[value] ?? PRELOAD_PRIORITIES.normal;
}

function defaultContextFactory() {
  const AudioContextConstructor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (!AudioContextConstructor) throw new Error("Web Audio API is not available");
  return new AudioContextConstructor();
}

function defaultFetcher(...args) {
  if (typeof globalThis.fetch !== "function") throw new Error("fetch is not available");
  return globalThis.fetch(...args);
}

function safeDisconnect(node) {
  try {
    node?.disconnect?.();
  } catch {
    // A browser may throw when an already-disconnected node is disconnected.
  }
}

function setParamValue(param, value, at) {
  if (typeof param?.setValueAtTime === "function") param.setValueAtTime(value, at);
  else if (param) param.value = value;
}

function rampParamValue(param, value, at) {
  if (typeof param?.linearRampToValueAtTime === "function") param.linearRampToValueAtTime(value, at);
  else setParamValue(param, value, at);
}

function cancelParamSchedule(param, at) {
  param?.cancelScheduledValues?.(at);
}

export class AudioMixer {
  constructor({
    manifest,
    contextFactory = defaultContextFactory,
    fetcher = defaultFetcher,
    logger = globalThis.console,
    random = Math.random,
    maxVoices = 24,
    maxWarningsTotal = 12,
    maxWarningsPerKey = 1,
    closeContextOnDispose = true,
    gestureDedupeMs = 750,
    maxPreloadConcurrency = 4,
    unlockTimeoutMs = 2000,
    clock = Date.now,
    onAssetFailure = null,
  } = {}) {
    this.manifest = createAudioManifest(manifest ?? {});
    this.contextFactory = contextFactory;
    this.fetcher = fetcher;
    this.logger = logger;
    this.random = random;
    this.maxVoices = Math.max(1, Math.floor(maxVoices));
    this.maxWarningsTotal = Math.max(0, Math.floor(maxWarningsTotal));
    this.maxWarningsPerKey = Math.max(0, Math.floor(maxWarningsPerKey));
    this.closeContextOnDispose = closeContextOnDispose;
    this.gestureDedupeMs = Math.max(0, Number.isFinite(gestureDedupeMs) ? gestureDedupeMs : 750);
    this.maxPreloadConcurrency = Math.max(1, Math.min(16, Math.floor(
      Number.isFinite(maxPreloadConcurrency) ? maxPreloadConcurrency : 4,
    )));
    this.unlockTimeoutMs = Math.max(1, Math.min(30000, Math.floor(
      Number.isFinite(unlockTimeoutMs) ? unlockTimeoutMs : 2000,
    )));
    this.clock = typeof clock === "function" ? clock : Date.now;
    this.onAssetFailure = typeof onAssetFailure === "function" ? onAssetFailure : null;

    this.context = null;
    this.contextGeneration = 0;
    this.contextCreateCount = 0;
    this.master = null;
    this.limiter = null;
    this.buses = {};
    this.musicDuck = null;
    this.ambienceDuck = null;
    this.disposed = false;
    this.unlockCleanup = null;
    this.unlockTarget = null;
    this.lifecycleCleanup = null;
    this.contextStateCleanup = null;
    this.unlockPromise = null;
    this.lastGestureAt = -Infinity;
    this.lastGestureFamily = null;
    this.statusListeners = new Set();
    this.audioStatus = Object.freeze({
      state: AUDIO_MIXER_STATES.LOCKED,
      contextState: null,
      needsGesture: false,
      reason: "initial",
      error: null,
    });
    this.assetCache = new Map();
    this.preloadQueue = [];
    this.preloadTasks = new Map();
    this.activePreloads = 0;
    this.preloadSequence = 0;
    this.activeVoices = new Map();
    this.lastPlayedAt = new Map();
    this.poolState = new Map();
    this.pendingDedupe = new Map();
    this.instanceGenerations = new Map();
    this.categoryGenerations = Object.fromEntries(AUDIO_CATEGORIES.map((category) => [category, 0]));
    this.warningCounts = new Map();
    this.warningTotal = 0;
    this.voiceSequence = 0;
    this.sceneTransitionToken = 0;
    this.pendingScene = null;
    this.desiredScene = null;
    this.sceneState = { sceneId: null, bgm: null, ambience: [] };
    this.persistentDuckLevel = 1;
    this.persistentAmbienceDuckLevel = 1;
    this.categoryVolumes = { ...DEFAULT_CATEGORY_VOLUMES };
    this.settings = {
      muted: false,
      masterVolume: 0.9,
      bgmEnabled: true,
      sfxEnabled: true,
      bgmVolume: 0.75,
      sfxVolume: 1,
      ambienceVolume: 0.55,
    };
  }

  get unlocked() {
    return Boolean(this.context && this.context.state === "running");
  }

  getAudioStatus() {
    return this.audioStatus;
  }

  subscribeStatus(listener, { emitCurrent = true } = {}) {
    if (typeof listener !== "function") return () => undefined;
    this.statusListeners.add(listener);
    if (emitCurrent) {
      try { listener(this.audioStatus); } catch { /* Status observers are optional. */ }
    }
    return () => this.statusListeners.delete(listener);
  }

  #setAudioStatus(state, { reason = null, error = null, needsGesture = false } = {}) {
    const next = Object.freeze({
      state,
      contextState: this.context?.state ?? null,
      needsGesture: Boolean(needsGesture),
      reason,
      error: error instanceof Error ? error.message : error ? String(error) : null,
    });
    const previous = this.audioStatus;
    if (previous.state === next.state
      && previous.contextState === next.contextState
      && previous.needsGesture === next.needsGesture
      && previous.reason === next.reason
      && previous.error === next.error) return;
    this.audioStatus = next;
    for (const listener of [...this.statusListeners]) {
      try { listener(next); } catch { /* Status observers must not break audio. */ }
    }
  }

  #isDuplicateGesture(event) {
    const family = event?.type?.startsWith("pointer") ? "pointer" : event?.type?.startsWith("touch") ? "touch" : null;
    if (!family) return false;
    const at = Number(this.clock());
    const duplicate = this.lastGestureFamily && this.lastGestureFamily !== family && at - this.lastGestureAt <= this.gestureDedupeMs;
    if (!duplicate) {
      this.lastGestureFamily = family;
      this.lastGestureAt = at;
    }
    return Boolean(duplicate);
  }

  #installUnlockListeners() {
    const target = this.unlockTarget;
    if (this.disposed || this.unlockCleanup || !target?.addEventListener) return;
    let active = true;
    const listener = (event) => {
      if (!active || this.#isDuplicateGesture(event)) return;
      const unlockControl = event?.target?.closest?.('[data-audio-unlock-control="true"]')
        ?? event?.composedPath?.().some((node) => node?.dataset?.audioUnlockControl === "true");
      if (unlockControl) return;
      void this.unlock({ reason: `gesture:${String(event?.type ?? "unknown")}` });
    };
    const eventNames = ["pointerdown", "touchend", "keydown"];
    for (const eventName of eventNames) target.addEventListener(eventName, listener, { capture: true, passive: true });
    const cleanup = () => {
      if (!active) return;
      active = false;
      for (const eventName of eventNames) target.removeEventListener(eventName, listener, { capture: true });
      if (this.unlockCleanup === cleanup) this.unlockCleanup = null;
    };
    this.unlockCleanup = cleanup;
  }

  attachUnlock(target = globalThis.window) {
    if (this.disposed || !target?.addEventListener) return () => undefined;
    this.unlockCleanup?.();
    this.unlockTarget = target;
    this.#installUnlockListeners();
    const documentTarget = target?.document ?? (target === globalThis.window ? globalThis.document : null);
    if (documentTarget?.addEventListener) this.attachLifecycle({ windowTarget: target, documentTarget });
    let detached = false;
    return () => {
      if (detached) return;
      detached = true;
      if (this.unlockTarget !== target) return;
      this.unlockCleanup?.();
      this.unlockTarget = null;
      this.lifecycleCleanup?.();
    };
  }

  attachLifecycle({ windowTarget = globalThis.window, documentTarget = globalThis.document } = {}) {
    if (this.disposed) return () => undefined;
    this.lifecycleCleanup?.();
    let active = true;
    const recover = (reason) => {
      if (!active || this.disposed) return;
      void this.recoverAudio({ reason });
    };
    const onPageShow = () => recover("pageshow");
    const onVisibilityChange = () => {
      if (!documentTarget || documentTarget.visibilityState === undefined || documentTarget.visibilityState === "visible") {
        recover("visibilitychange");
      }
    };
    windowTarget?.addEventListener?.("pageshow", onPageShow, { capture: true, passive: true });
    documentTarget?.addEventListener?.("visibilitychange", onVisibilityChange, { capture: true, passive: true });
    const cleanup = () => {
      if (!active) return;
      active = false;
      windowTarget?.removeEventListener?.("pageshow", onPageShow, { capture: true });
      documentTarget?.removeEventListener?.("visibilitychange", onVisibilityChange, { capture: true });
      if (this.lifecycleCleanup === cleanup) this.lifecycleCleanup = null;
    };
    this.lifecycleCleanup = cleanup;
    return cleanup;
  }

  #attachContextStateListener(context) {
    this.contextStateCleanup?.();
    const listener = () => this.#handleContextStateChange(context);
    if (typeof context?.addEventListener === "function") {
      context.addEventListener("statechange", listener);
      const cleanup = () => {
        context.removeEventListener?.("statechange", listener);
        if (this.contextStateCleanup === cleanup) this.contextStateCleanup = null;
      };
      this.contextStateCleanup = cleanup;
      return;
    }
    if (context && "onstatechange" in context) {
      const previous = context.onstatechange;
      context.onstatechange = listener;
      const cleanup = () => {
        if (context.onstatechange === listener) context.onstatechange = previous ?? null;
        if (this.contextStateCleanup === cleanup) this.contextStateCleanup = null;
      };
      this.contextStateCleanup = cleanup;
    }
  }

  #handleContextStateChange(context) {
    if (this.disposed || context !== this.context) return;
    if (context.state === "running") {
      // resume() may dispatch statechange before the gesture unlock pipeline has
      // started its confirmation tone and queued the pending critical scene.
      // The explicit unlock branch publishes RUNNING at that stable boundary.
      if (this.unlockPromise) return;
      // A resume promise can settle or dispatch statechange after its timeout.
      // Preserve the actionable failure UI until a fresh user retry confirms
      // the graph and starts its tone explicitly.
      if (this.audioStatus.state === AUDIO_MIXER_STATES.FAILED && this.audioStatus.needsGesture) return;
      this.#setAudioStatus(AUDIO_MIXER_STATES.RUNNING, { reason: "context-statechange" });
      return;
    }
    if (["suspended", "interrupted", "closed"].includes(context.state)) {
      this.#setAudioStatus(AUDIO_MIXER_STATES.RECOVERY_NEEDED, {
        reason: `context-${context.state}`,
        needsGesture: true,
      });
      this.#installUnlockListeners();
      void this.recoverAudio({ reason: `context-${context.state}` });
    }
  }

  #releaseContextGraph() {
    this.sceneTransitionToken += 1;
    for (const category of AUDIO_CATEGORIES) this.categoryGenerations[category] += 1;
    for (const voice of [...this.activeVoices.values()]) this.#cleanupVoice(voice);
    this.pendingDedupe.clear();
    this.lastPlayedAt.clear();
    this.sceneState = { sceneId: null, bgm: null, ambience: [] };
    for (const bus of Object.values(this.buses)) safeDisconnect(bus);
    safeDisconnect(this.musicDuck);
    safeDisconnect(this.ambienceDuck);
    safeDisconnect(this.master);
    safeDisconnect(this.limiter);
    this.buses = {};
    this.musicDuck = null;
    this.ambienceDuck = null;
    this.master = null;
    this.limiter = null;
    this.contextStateCleanup?.();
    this.context = null;
  }

  #createContextAndGraph() {
    if (this.context || this.master) this.#releaseContextGraph();
    const context = this.contextFactory();
    this.contextGeneration += 1;
    this.contextCreateCount += 1;
    this.context = context;
    this.#attachContextStateListener(context);
    this.#createGraph();
    if (this.desiredScene && !this.pendingScene) this.pendingScene = this.desiredScene;
    return context;
  }

  async #resumeContextWithTimeout(context) {
    const resumePromise = Promise.resolve(context.resume());
    let timeoutId = null;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = globalThis.setTimeout(() => {
        const error = new Error(`AudioContext resume timed out after ${this.unlockTimeoutMs}ms`);
        error.name = "TimeoutError";
        reject(error);
      }, this.unlockTimeoutMs);
    });
    try {
      await Promise.race([resumePromise, timeoutPromise]);
    } finally {
      if (timeoutId !== null) globalThis.clearTimeout(timeoutId);
    }
  }

  async unlock({ reason = "unlock" } = {}) {
    if (this.disposed) return false;
    if (this.unlockPromise) return this.unlockPromise;
    this.#setAudioStatus(AUDIO_MIXER_STATES.UNLOCKING, { reason });
    let settleUnlock;
    const task = new Promise((resolve) => { settleUnlock = resolve; });
    this.unlockPromise = task;
    void (async () => {
      try {
        if (!this.context || this.context.state === "closed") {
          this.#createContextAndGraph();
        }
        if (this.context.state !== "running" && typeof this.context.resume === "function") {
          await this.#resumeContextWithTimeout(this.context);
        }
        if (this.context.state !== "running") throw new Error(`AudioContext remained ${String(this.context.state)}`);
        this.unlockCleanup?.();
        const pendingScene = this.pendingScene;
        // This oscillator starts synchronously on the resumed production graph,
        // providing an audible enable acknowledgement without another context.
        if (!this.playTestTone({ respectSettings: false })) {
          throw new Error("The audio confirmation tone could not start");
        }
        this.pendingScene = null;
        // Decode and scene playback may finish after enableAudio() resolves. The
        // critical scene queue is entered before optional cache warming so music
        // and ambience retain priority without extending the gesture pipeline.
        if (pendingScene) {
          void this.setScene(pendingScene.sceneId, pendingScene.options).catch((error) => {
            this.#warn("scene-after-unlock", "The pending audio scene could not start after unlock.", error);
          });
        }
        // RUNNING observers may start optional battle loops. Publish only after
        // the pending scene has entered the critical queue so they cannot jump
        // ahead of the first music and ambience decode.
        this.#setAudioStatus(AUDIO_MIXER_STATES.RUNNING, { reason });
        // Previously fetched optional assets warm in the bounded background
        // queue. unlock() intentionally resolves without waiting for them.
        const cachedAssetIds = [...this.assetCache.keys()];
        if (cachedAssetIds.length > 0) {
          void this.#preloadAssetIds(cachedAssetIds, { priority: "background" });
        }
        return true;
      } catch (error) {
        this.#setAudioStatus(AUDIO_MIXER_STATES.FAILED, { reason, error, needsGesture: true });
        this.#installUnlockListeners();
        this.#warn("audio-context-unlock", "Audio could not be unlocked; gameplay will continue silently.", error);
        return false;
      }
    })().then((result) => {
      if (this.unlockPromise === task) this.unlockPromise = null;
      settleUnlock(result);
    }, () => {
      if (this.unlockPromise === task) this.unlockPromise = null;
      settleUnlock(false);
    });
    return task;
  }

  enableAudio() {
    return this.unlock({ reason: "manual-enable" });
  }

  async recoverAudio({ reason = "manual-recovery" } = {}) {
    if (this.disposed) return false;
    if (!this.context) {
      this.#setAudioStatus(AUDIO_MIXER_STATES.LOCKED, { reason });
      this.#installUnlockListeners();
      return false;
    }
    if (this.context.state === "running") {
      if (this.audioStatus.state === AUDIO_MIXER_STATES.FAILED
        || this.audioStatus.state === AUDIO_MIXER_STATES.RECOVERY_NEEDED) {
        return this.unlock({ reason });
      }
      this.#setAudioStatus(AUDIO_MIXER_STATES.RUNNING, { reason });
      return true;
    }
    this.#setAudioStatus(AUDIO_MIXER_STATES.RECOVERY_NEEDED, { reason, needsGesture: true });
    return this.unlock({ reason });
  }

  #createGraph() {
    const context = this.context;
    if (!context || this.master) return;
    this.master = context.createGain();
    this.limiter = typeof context.createDynamicsCompressor === "function" ? context.createDynamicsCompressor() : null;
    if (this.limiter) {
      setParamValue(this.limiter.threshold, -3, context.currentTime);
      setParamValue(this.limiter.knee, 12, context.currentTime);
      setParamValue(this.limiter.ratio, 8, context.currentTime);
      setParamValue(this.limiter.attack, 0.003, context.currentTime);
      setParamValue(this.limiter.release, 0.18, context.currentTime);
      this.master.connect(this.limiter);
      this.limiter.connect(context.destination);
    } else {
      this.master.connect(context.destination);
    }
    this.musicDuck = context.createGain();
    setParamValue(this.musicDuck.gain, this.persistentDuckLevel, context.currentTime);
    this.musicDuck.connect(this.master);
    this.ambienceDuck = context.createGain();
    setParamValue(this.ambienceDuck.gain, this.persistentAmbienceDuckLevel, context.currentTime);
    this.ambienceDuck.connect(this.master);
    for (const category of AUDIO_CATEGORIES) {
      const bus = context.createGain();
      this.buses[category] = bus;
      bus.connect(category === "bgm" ? this.musicDuck : category === "ambience" ? this.ambienceDuck : this.master);
    }
    this.#applySettings();
  }

  setSettings(nextSettings = {}) {
    if (!nextSettings || typeof nextSettings !== "object") return this.getSettings();
    const booleanKeys = ["muted", "bgmEnabled", "sfxEnabled"];
    const volumeKeys = ["masterVolume", "bgmVolume", "sfxVolume", "ambienceVolume"];
    for (const key of booleanKeys) {
      if (typeof nextSettings[key] === "boolean") this.settings[key] = nextSettings[key];
    }
    for (const key of volumeKeys) {
      if (Number.isFinite(nextSettings[key])) this.settings[key] = clamp(nextSettings[key], 0, 1);
    }
    this.#applySettings();
    return this.getSettings();
  }

  getSettings() {
    return { ...this.settings };
  }

  getSharedAudioGraph() {
    if (!this.context || !this.master) return null;
    return Object.freeze({
      context: this.context,
      generation: this.contextGeneration,
      categoryInputs: Object.freeze({ ...this.buses }),
    });
  }

  playTestTone({
    frequency = 660,
    duration = 0.09,
    volume = 0.12,
    respectSettings = true,
  } = {}) {
    const context = this.context;
    const uiBus = this.buses.ui;
    if (this.disposed
      || context?.state !== "running"
      || !uiBus
      || typeof context.createOscillator !== "function"
      || typeof context.createGain !== "function") return false;
    if (respectSettings && (this.settings.muted
      || !this.settings.sfxEnabled
      || this.settings.masterVolume <= 0
      || this.settings.sfxVolume <= 0
      || this.categoryVolumes.ui <= 0)) return false;

    const now = context.currentTime;
    const toneDuration = clamp(duration, 0.02, 2);
    const toneVolume = clamp(volume, 0, 1);
    let oscillator = null;
    let gain = null;
    try {
      oscillator = context.createOscillator();
      gain = context.createGain();
      oscillator.type = "sine";
      setParamValue(oscillator.frequency, clamp(frequency, 80, 2400), now);
      setParamValue(gain.gain, toneVolume, now);
      rampParamValue(gain.gain, 0.0001, now + toneDuration);
      oscillator.connect(gain);
      // The unlock acknowledgement must remain audible even when a legacy
      // save left master/SFX buses at zero. It stays on this context and
      // limiter; ordinary test tones continue through the UI bus.
      gain.connect(respectSettings ? uiBus : (this.limiter ?? context.destination));
      oscillator.onended = () => {
        safeDisconnect(oscillator);
        safeDisconnect(gain);
      };
      oscillator.start(now);
      oscillator.stop(now + toneDuration);
      return true;
    } catch (error) {
      safeDisconnect(oscillator);
      safeDisconnect(gain);
      this.#warn("test-tone", "The audio test tone could not start.", error);
      return false;
    }
  }

  setCategoryVolume(category, volume) {
    if (!AUDIO_CATEGORIES.includes(category)) throw new RangeError(`Unknown audio category: ${String(category)}`);
    this.categoryVolumes[category] = clamp(volume, 0, 1);
    this.#applySettings();
  }

  #applySettings() {
    if (!this.context || !this.master) return;
    const at = this.context.currentTime;
    setParamValue(this.master.gain, this.settings.muted ? 0 : this.settings.masterVolume, at);
    for (const category of AUDIO_CATEGORIES) {
      let volume = this.categoryVolumes[category];
      if (category === "bgm") volume = this.settings.bgmEnabled ? volume * this.settings.bgmVolume : 0;
      else if (category === "ambience") volume = this.settings.sfxEnabled ? volume * this.settings.ambienceVolume * this.settings.sfxVolume : 0;
      else volume = this.settings.sfxEnabled ? volume * this.settings.sfxVolume : 0;
      setParamValue(this.buses[category]?.gain, clamp(volume, 0, 1), at);
    }
  }

  #warn(key, message, error) {
    const count = this.warningCounts.get(key) ?? 0;
    if (count >= this.maxWarningsPerKey || this.warningTotal >= this.maxWarningsTotal) return;
    this.warningCounts.set(key, count + 1);
    this.warningTotal += 1;
    this.logger?.warn?.(`[audio] ${message}`, error instanceof Error ? error.message : error);
  }

  #reportAssetFailure(assetId, phase, error) {
    try {
      this.onAssetFailure?.(Object.freeze({
        assetId,
        phase,
        error: error instanceof Error ? error.message : error ? String(error) : "unknown audio source failure",
      }));
    } catch {
      // Player-facing failure reporting must not interrupt mixer cleanup.
    }
  }

  #expandCueIds(cueIds) {
    const expanded = new Set();
    for (const cueId of cueIds) {
      const alias = this.manifest.aliasById[cueId];
      const targetId = alias?.targetId ?? cueId;
      const asset = this.manifest.assetById[targetId];
      const pool = this.manifest.poolById[targetId];
      if (asset) expanded.add(asset.id);
      else if (pool) pool.assetIds.forEach((assetId) => expanded.add(assetId));
      else this.#warn(`unknown-cue:${String(cueId)}`, `Unknown audio cue ${String(cueId)} was ignored.`);
    }
    return [...expanded];
  }

  async #fetchAsset(assetId) {
    const asset = this.manifest.assetById[assetId];
    if (!asset) {
      this.#warn(`unknown-asset:${String(assetId)}`, `Unknown audio asset ${String(assetId)} was ignored.`);
      return null;
    }
    let entry = this.assetCache.get(assetId);
    if (entry?.raw || entry?.buffer) return entry;
    if (entry?.status === "failed") return null;
    if (entry?.fetchPromise) return entry.fetchPromise;
    entry = entry ?? {
      status: "idle",
      raw: null,
      buffer: null,
      source: null,
      nextSourceIndex: 0,
      fetchPromise: null,
      decodePromise: null,
    };
    this.assetCache.set(assetId, entry);
    entry.status = "loading";
    entry.fetchPromise = (async () => {
      let lastError = null;
      for (let sourceIndex = entry.nextSourceIndex; sourceIndex < asset.sources.length; sourceIndex += 1) {
        const source = asset.sources[sourceIndex];
        entry.nextSourceIndex = sourceIndex + 1;
        try {
          const response = await this.fetcher(source.src, { credentials: "same-origin" });
          if (!response?.ok) throw new Error(`HTTP ${String(response?.status ?? "failure")}`);
          const raw = await response.arrayBuffer();
          if (!(raw instanceof ArrayBuffer) || raw.byteLength === 0) throw new Error("empty audio response");
          entry.raw = raw;
          entry.source = source.src;
          entry.status = "fetched";
          return entry;
        } catch (error) {
          lastError = error;
        }
      }
      entry.status = "failed";
      this.#reportAssetFailure(assetId, "load", lastError);
      this.#warn(`load:${assetId}`, `Failed to load ${assetId}; the cue will remain silent.`, lastError);
      return null;
    })().finally(() => {
      entry.fetchPromise = null;
    });
    return entry.fetchPromise;
  }

  #decodeRaw(raw) {
    return new Promise((resolve, reject) => {
      try {
        let settled = false;
        const succeed = (buffer) => {
          if (settled) return;
          settled = true;
          resolve(buffer);
        };
        const fail = (error) => {
          if (settled) return;
          settled = true;
          reject(error);
        };
        const result = this.context.decodeAudioData(raw.slice(0), succeed, fail);
        if (result?.then) result.then(succeed, fail);
      } catch (error) {
        reject(error);
      }
    });
  }

  async #decodeAsset(assetId) {
    let entry = await this.#fetchAsset(assetId);
    if (!entry || entry.status === "failed") return null;
    if (entry.buffer) return entry.buffer;
    if (!this.context || this.context.state === "closed") return null;
    if (entry.decodePromise) return entry.decodePromise;
    const asset = this.manifest.assetById[assetId];
    const cacheEntry = entry;
    cacheEntry.decodePromise = (async () => {
      let lastError = null;
      while (entry?.raw) {
        try {
          const buffer = await this.#decodeRaw(entry.raw);
          entry.buffer = buffer;
          entry.status = "ready";
          return buffer;
        } catch (error) {
          lastError = error;
          entry.raw = null;
          entry.source = null;
          entry.status = "idle";
          if (entry.nextSourceIndex >= asset.sources.length) break;
          entry = await this.#fetchAsset(assetId);
          if (!entry) return null;
        }
      }
      entry.status = "failed";
      this.#reportAssetFailure(assetId, "decode", lastError);
      this.#warn(`decode:${assetId}`, `Failed to decode ${assetId}; the cue will remain silent.`, lastError);
      return null;
    })().finally(() => {
      cacheEntry.decodePromise = null;
    });
    return cacheEntry.decodePromise;
  }

  #sortPreloadQueue() {
    this.preloadQueue.sort((left, right) => right.priority - left.priority || left.sequence - right.sequence);
  }

  #settlePreloadTask(item, loaded) {
    if (item.settled) return;
    item.settled = true;
    if (item.started) this.activePreloads = Math.max(0, this.activePreloads - 1);
    if (this.preloadTasks.get(item.assetId) === item) this.preloadTasks.delete(item.assetId);
    item.resolve(Boolean(loaded));
    this.#drainPreloadQueue();
  }

  #drainPreloadQueue() {
    while (!this.disposed
      && this.activePreloads < this.maxPreloadConcurrency
      && this.preloadQueue.length > 0) {
      const item = this.preloadQueue.shift();
      item.started = true;
      this.activePreloads += 1;
      void (async () => {
        const entry = await this.#fetchAsset(item.assetId);
        if (!entry || this.disposed) return false;
        if (this.context && this.context.state !== "closed") {
          return Boolean(await this.#decodeAsset(item.assetId));
        }
        return true;
      })().then(
        (loaded) => this.#settlePreloadTask(item, loaded),
        () => this.#settlePreloadTask(item, false),
      );
    }
  }

  #queuePreloadAsset(assetId, { priority = "normal" } = {}) {
    const numericPriority = preloadPriority(priority);
    const existing = this.preloadTasks.get(assetId);
    if (existing) {
      if (!existing.started && numericPriority > existing.priority) {
        existing.priority = numericPriority;
        this.#sortPreloadQueue();
      }
      return existing.promise;
    }
    let resolveTask;
    const promise = new Promise((resolve) => { resolveTask = resolve; });
    const item = {
      assetId,
      priority: numericPriority,
      sequence: ++this.preloadSequence,
      started: false,
      settled: false,
      promise,
      resolve: resolveTask,
    };
    this.preloadTasks.set(assetId, item);
    this.preloadQueue.push(item);
    this.#sortPreloadQueue();
    this.#drainPreloadQueue();
    return promise;
  }

  async #preloadAssetIds(assetIds, options = {}) {
    if (this.disposed) return { loaded: [], failed: [] };
    const uniqueAssetIds = [...new Set(Array.isArray(assetIds) ? assetIds : [])];
    const outcomes = await Promise.all(uniqueAssetIds.map((assetId) => this.#queuePreloadAsset(assetId, options)));
    return {
      loaded: uniqueAssetIds.filter((_, index) => outcomes[index]),
      failed: uniqueAssetIds.filter((_, index) => !outcomes[index]),
    };
  }

  async preloadAssets(cueIds, { priority = "normal" } = {}) {
    if (this.disposed) return { loaded: [], failed: [] };
    const assetIds = this.#expandCueIds(Array.isArray(cueIds) ? cueIds : []);
    return this.#preloadAssetIds(assetIds, { priority });
  }

  async retryFailedAssets(cueIds = null, { priority = "critical" } = {}) {
    if (this.disposed) return { loaded: [], failed: [] };
    const requestedCueIds = Array.isArray(cueIds) ? cueIds : typeof cueIds === "string" ? [cueIds] : [];
    const candidateAssetIds = cueIds == null
      ? [...this.assetCache.entries()].filter(([, entry]) => entry.status === "failed").map(([assetId]) => assetId)
      : this.#expandCueIds(requestedCueIds);
    const settlingTasks = candidateAssetIds
      .map((assetId) => this.preloadTasks.get(assetId)?.promise)
      .filter(Boolean);
    if (settlingTasks.length > 0) await Promise.all(settlingTasks);
    if (this.disposed) return { loaded: [], failed: [] };
    const retryAssetIds = candidateAssetIds.filter((assetId) => this.assetCache.get(assetId)?.status === "failed");
    for (const assetId of retryAssetIds) this.assetCache.delete(assetId);
    return this.#preloadAssetIds(retryAssetIds, { priority });
  }

  async retryFailedAudio({ priority = "critical" } = {}) {
    if (this.disposed) return false;
    if (this.getDiagnostics().cache.failed === 0) return true;
    const result = await this.retryFailedAssets(null, { priority });
    if (result.failed.length > 0) return false;
    const desired = this.desiredScene;
    if (!desired || !this.unlocked) return true;
    const state = await this.setScene(desired.sceneId, desired.options);
    const scene = this.manifest.sceneById[desired.sceneId];
    return !scene?.bgm || Boolean(state?.bgmAssetId);
  }

  async preloadScene(sceneId, { includeOptional = true } = {}) {
    const scene = this.manifest.sceneById[sceneId];
    if (!scene) {
      this.#warn(`unknown-scene:${String(sceneId)}`, `Unknown audio scene ${String(sceneId)} was ignored.`);
      return { loaded: [], failed: [] };
    }
    const criticalAssetIds = this.#expandCueIds([scene.bgm, ...scene.ambience].filter(Boolean));
    const criticalAssets = new Set(criticalAssetIds);
    const optionalAssetIds = includeOptional
      ? this.#expandCueIds(scene.preload).filter((assetId) => !criticalAssets.has(assetId))
      : [];
    const [criticalResult, optionalResult] = await Promise.all([
      this.#preloadAssetIds(criticalAssetIds, { priority: "critical" }),
      this.#preloadAssetIds(optionalAssetIds, { priority: "normal" }),
    ]);
    return {
      loaded: [...criticalResult.loaded, ...optionalResult.loaded],
      failed: [...criticalResult.failed, ...optionalResult.failed],
    };
  }

  #refillShufflePool(pool, state) {
    const queue = [...pool.assetIds];
    for (let index = queue.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(clamp(this.random(), 0, 0.999999) * (index + 1));
      [queue[index], queue[swapIndex]] = [queue[swapIndex], queue[index]];
    }
    if (pool.avoidImmediateRepeat && queue.length > 1 && queue[0] === state.lastAssetId) {
      [queue[0], queue[1]] = [queue[1], queue[0]];
    }
    state.queue = queue;
  }

  #resolveCue(cueId) {
    const alias = this.manifest.aliasById[cueId] ?? null;
    const targetId = alias?.targetId ?? cueId;
    const direct = this.manifest.assetById[targetId];
    if (direct) return { cueId, asset: direct, pool: null, alias };
    const pool = this.manifest.poolById[targetId];
    if (!pool) {
      this.#warn(`unknown-cue:${String(cueId)}`, `Unknown audio cue ${String(cueId)} was ignored.`);
      return null;
    }
    const state = this.poolState.get(pool.id) ?? { index: 0, lastAssetId: null, queue: [] };
    let assetId;
    if (pool.strategy === "round-robin") {
      assetId = pool.assetIds[state.index % pool.assetIds.length];
      state.index += 1;
    } else if (pool.strategy === "random") {
      const choices = pool.avoidImmediateRepeat && pool.assetIds.length > 1
        ? pool.assetIds.filter((candidate) => candidate !== state.lastAssetId)
        : pool.assetIds;
      assetId = choices[Math.floor(clamp(this.random(), 0, 0.999999) * choices.length)];
    } else {
      if (state.queue.length === 0) this.#refillShufflePool(pool, state);
      assetId = state.queue.shift();
    }
    state.lastAssetId = assetId;
    this.poolState.set(pool.id, state);
    return { cueId, asset: this.manifest.assetById[assetId], pool, alias };
  }

  #findVoice(predicate) {
    for (const voice of this.activeVoices.values()) {
      if (predicate(voice)) return voice;
    }
    return null;
  }

  #oldestLowestPriority(voices) {
    return [...voices].sort((left, right) => left.priority - right.priority || left.startedAt - right.startedAt)[0] ?? null;
  }

  #reserveVoiceSlot({ priority, instanceKey, maxInstances }) {
    let liveVoices = [...this.activeVoices.values()].filter((voice) => !voice.stopping);
    const sameInstance = liveVoices.filter((voice) => voice.instanceKey === instanceKey);
    if (sameInstance.length >= maxInstances) {
      const victim = this.#oldestLowestPriority(sameInstance);
      if (!victim || victim.priority >= priority) return false;
      this.#stopVoice(victim, 0);
      liveVoices = [...this.activeVoices.values()].filter((voice) => !voice.stopping);
    }
    if (liveVoices.length >= this.maxVoices) {
      const victim = this.#oldestLowestPriority(liveVoices);
      if (!victim || victim.priority >= priority) return false;
      this.#stopVoice(victim, 0);
    }
    return true;
  }

  #cleanupVoice(voice) {
    if (!voice || voice.cleaned) return;
    voice.cleaned = true;
    this.activeVoices.delete(voice.id);
    safeDisconnect(voice.source);
    safeDisconnect(voice.gain);
    safeDisconnect(voice.panner);
    if (this.sceneState.bgm?.id === voice.id) this.sceneState.bgm = null;
    this.sceneState.ambience = this.sceneState.ambience.filter((candidate) => candidate.id !== voice.id);
  }

  #stopVoice(voice, fadeMs = 0) {
    if (!voice || voice.cleaned) return;
    const now = this.context?.currentTime ?? 0;
    const seconds = Math.max(0, fadeMs) / 1000;
    if (voice.stopping) {
      if (seconds === 0) {
        try {
          voice.source.stop(now);
        } catch {
          // Cleanup below is still required if the source has already stopped.
        }
        this.#cleanupVoice(voice);
      }
      return;
    }
    voice.stopping = true;
    try {
      if (seconds > 0) {
        cancelParamSchedule(voice.gain.gain, now);
        setParamValue(voice.gain.gain, Math.max(0.0001, voice.gain.gain.value ?? voice.volume), now);
        rampParamValue(voice.gain.gain, 0.0001, now + seconds);
        voice.source.stop(now + seconds + 0.01);
      } else {
        voice.source.stop(now);
        this.#cleanupVoice(voice);
      }
    } catch {
      this.#cleanupVoice(voice);
    }
  }

  #createVoice(resolved, buffer, options) {
    const { cueId, asset, pool, alias } = resolved;
    const context = this.context;
    const priority = clamp(options.priority ?? alias?.priority ?? pool?.priority ?? asset.priority, 0, 1000);
    const instanceKey = options.instanceKey ?? alias?.instanceKey ?? cueId;
    const maxInstances = Math.max(1, Math.floor(options.maxInstances ?? alias?.maxInstances ?? pool?.maxInstances ?? asset.maxInstances));
    if (!this.#reserveVoiceSlot({ priority, instanceKey, maxInstances })) return null;
    const source = context.createBufferSource();
    const gain = context.createGain();
    const panner = typeof context.createStereoPanner === "function" ? context.createStereoPanner() : null;
    const now = context.currentTime;
    const volume = clamp(asset.gain * (Number.isFinite(options.volume) ? options.volume : 1), 0, 2);
    const fadeInSeconds = Math.max(0, options.fadeInMs ?? 0) / 1000;
    source.buffer = buffer;
    source.loop = options.loop ?? alias?.loop ?? asset.loop;
    if (source.playbackRate && Number.isFinite(options.playbackRate)) source.playbackRate.value = clamp(options.playbackRate, 0.5, 2);
    if (fadeInSeconds > 0) {
      setParamValue(gain.gain, 0.0001, now);
      rampParamValue(gain.gain, Math.max(0.0001, volume), now + fadeInSeconds);
    } else {
      setParamValue(gain.gain, volume, now);
    }
    source.connect(gain);
    if (panner) {
      setParamValue(panner.pan, clamp(options.pan ?? 0, -1, 1), now);
      gain.connect(panner);
      panner.connect(this.buses[asset.category]);
    } else {
      gain.connect(this.buses[asset.category]);
    }
    const id = `voice-${++this.voiceSequence}`;
    const voice = {
      id,
      cueId,
      assetId: asset.id,
      category: asset.category,
      priority,
      instanceKey,
      dedupeKey: options.dedupeKey ?? null,
      source,
      gain,
      panner,
      volume,
      loop: source.loop,
      startedAt: now,
      stopping: false,
      cleaned: false,
      handle: null,
    };
    const handle = Object.freeze({
      id,
      cueId,
      assetId: asset.id,
      category: asset.category,
      stop: (fadeMs = 0) => this.#stopVoice(voice, fadeMs),
    });
    voice.handle = handle;
    source.onended = () => this.#cleanupVoice(voice);
    this.activeVoices.set(id, voice);
    try {
      source.start(now, Math.max(0, options.offsetSeconds ?? 0));
      if (Number.isFinite(options.durationSeconds) && options.durationSeconds > 0) source.stop(now + options.durationSeconds);
    } catch (error) {
      this.#cleanupVoice(voice);
      this.#warn(`play:${asset.id}`, `Failed to start ${asset.id}; the cue was skipped.`, error);
      return null;
    }
    return handle;
  }

  async #playCue(cueId, options) {
    if (this.disposed || !this.unlocked) return null;
    const alias = this.manifest.aliasById[cueId] ?? null;
    const targetId = alias?.targetId ?? cueId;
    const direct = this.manifest.assetById[targetId];
    const pool = this.manifest.poolById[targetId];
    const pooledCooldown = pool
      ? Math.max(0, ...pool.assetIds.map((assetId) => this.manifest.assetById[assetId].cooldownMs))
      : 0;
    const cooldownMs = Math.max(0, options.cooldownMs ?? alias?.cooldownMs ?? pool?.cooldownMs ?? direct?.cooldownMs ?? pooledCooldown);
    const instanceKey = options.instanceKey ?? alias?.instanceKey ?? cueId;
    const instanceGeneration = this.instanceGenerations.get(instanceKey) ?? 0;
    const nowMs = this.context.currentTime * 1000;
    const reservation = Symbol(cueId);
    const last = this.lastPlayedAt.get(cueId);
    if (last && last.at + cooldownMs > nowMs) return null;
    this.lastPlayedAt.set(cueId, { at: nowMs, reservation });
    const resolved = this.#resolveCue(cueId);
    if (!resolved?.asset) {
      if (this.lastPlayedAt.get(cueId)?.reservation === reservation) this.lastPlayedAt.delete(cueId);
      return null;
    }
    const categoryGeneration = this.categoryGenerations[resolved.asset.category];
    const buffer = await this.#decodeAsset(resolved.asset.id);
    if (!buffer
      || this.disposed
      || !this.unlocked
      || this.categoryGenerations[resolved.asset.category] !== categoryGeneration
      || (this.instanceGenerations.get(instanceKey) ?? 0) !== instanceGeneration) {
      // Only an actual source load/decode failure authorizes a caller's
      // synthesized fallback. Cooldown, polyphony, disposal, and category
      // cancellation remain intentionally silent.
      const sourceFailed = this.assetCache.get(resolved.asset.id)?.status === "failed";
      if (!buffer
         && !this.disposed
         && this.unlocked
         && this.categoryGenerations[resolved.asset.category] === categoryGeneration
        && (this.instanceGenerations.get(instanceKey) ?? 0) === instanceGeneration
        && sourceFailed
        && typeof options.onLoadFailure === "function") {
        try { options.onLoadFailure(resolved.asset.id); } catch { /* Fallbacks are optional. */ }
      }
      if (this.lastPlayedAt.get(cueId)?.reservation === reservation) this.lastPlayedAt.delete(cueId);
      return null;
    }
    const handle = this.#createVoice(resolved, buffer, options);
    if (!handle && this.lastPlayedAt.get(cueId)?.reservation === reservation) this.lastPlayedAt.delete(cueId);
    if (handle && options.duck) this.duckMusic(options.duck);
    return handle;
  }

  async play(cueId, options = {}) {
    if (!options.dedupeKey) return this.#playCue(cueId, options);
    const duplicate = this.#findVoice((voice) => !voice.cleaned && !voice.stopping && voice.dedupeKey === options.dedupeKey);
    if (duplicate) return duplicate.handle;
    const pending = this.pendingDedupe.get(options.dedupeKey);
    if (pending) return pending;
    const task = this.#playCue(cueId, options);
    this.pendingDedupe.set(options.dedupeKey, task);
    try {
      return await task;
    } finally {
      if (this.pendingDedupe.get(options.dedupeKey) === task) this.pendingDedupe.delete(options.dedupeKey);
    }
  }

  async setScene(sceneId, options = {}) {
    if (this.disposed) return null;
    const token = ++this.sceneTransitionToken;
    // A request arriving after the context starts running supersedes any
    // pre-gesture scene that unlock() may still be decoding.
    if (this.unlocked) this.pendingScene = null;
    const scene = this.manifest.sceneById[sceneId];
    if (!scene) {
      this.#warn(`unknown-scene:${String(sceneId)}`, `Unknown audio scene ${String(sceneId)} was ignored.`);
      return null;
    }
    const bgmVoice = this.sceneState.bgm ? this.activeVoices.get(this.sceneState.bgm.id) : null;
    const liveAmbienceCount = this.sceneState.ambience.filter((handle) => {
      const voice = this.activeVoices.get(handle.id);
      return voice && !voice.cleaned && !voice.stopping;
    }).length;
    const sameSceneComplete = sceneId === this.sceneState.sceneId
      && (!scene.bgm || Boolean(bgmVoice && !bgmVoice.cleaned && !bgmVoice.stopping))
      && liveAmbienceCount === scene.ambience.length;
    if (sameSceneComplete) return this.getSceneState();
    this.desiredScene = { sceneId, options: { ...options } };
    if (!this.unlocked) {
      this.pendingScene = { sceneId, options: { ...options } };
      await this.preloadScene(sceneId, { includeOptional: false });
      return null;
    }
    // BGM and scene ambience are the transition-critical assets. Optional
    // combat/UI cues warm in the background and remain lazy-loadable, so a
    // slow SFX cannot hold the first music frame or create an iPhone decode burst.
    await this.preloadScene(sceneId, { includeOptional: false });
    if (this.disposed || token !== this.sceneTransitionToken) return null;
    const fadeMs = Math.max(0, options.crossfadeMs ?? scene.crossfadeMs);
    const directBgmAsset = scene.bgm ? this.manifest.assetById[scene.bgm] : null;
    const nextBgm = scene.bgm ? await this.play(scene.bgm, {
      loop: directBgmAsset?.loop ?? true,
      fadeInMs: fadeMs,
      priority: 1000,
      cooldownMs: 0,
      maxInstances: 2,
      instanceKey: "scene:bgm",
      // Adjacent screens may intentionally share one continuous track (for
      // example map and formation). Deduplicate by asset so that transition
      // updates the scene identity without restarting/self-crossfading it.
      dedupeKey: `scene:bgm:${scene.bgm}`,
      onLoadFailure: options.onBgmLoadFailure,
    }) : null;
    if (token !== this.sceneTransitionToken) {
      nextBgm?.stop(0);
      return null;
    }
    const nextAmbience = [];
    for (const ambienceCue of scene.ambience) {
      const handle = await this.play(ambienceCue, {
        loop: true,
        fadeInMs: Math.min(400, fadeMs),
        priority: 120,
        cooldownMs: 0,
        maxInstances: 2,
        instanceKey: `scene:ambience:${ambienceCue}`,
        dedupeKey: `scene:ambience:${sceneId}:${ambienceCue}`,
      });
      if (handle) nextAmbience.push(handle);
    }
    if (token !== this.sceneTransitionToken) {
      nextBgm?.stop(0);
      nextAmbience.forEach((handle) => handle.stop(0));
      return null;
    }
    const previous = this.sceneState;
    this.sceneState = { sceneId, bgm: nextBgm, ambience: nextAmbience };
    if (previous.bgm?.id !== nextBgm?.id) previous.bgm?.stop(fadeMs);
    previous.ambience.filter((handle) => !nextAmbience.some((next) => next.id === handle.id)).forEach((handle) => handle.stop(Math.min(400, fadeMs)));
    void this.preloadAssets(scene.preload, { priority: "background" });
    return this.getSceneState();
  }

  async stopScene({ fadeMs = 250 } = {}) {
    this.sceneTransitionToken += 1;
    this.pendingScene = null;
    this.desiredScene = null;
    const previous = this.sceneState;
    this.sceneState = { sceneId: null, bgm: null, ambience: [] };
    previous.bgm?.stop(fadeMs);
    previous.ambience.forEach((handle) => handle.stop(fadeMs));
  }

  getSceneState() {
    return {
      sceneId: this.sceneState.sceneId,
      bgmAssetId: this.sceneState.bgm?.assetId ?? null,
      ambienceAssetIds: this.sceneState.ambience.map((handle) => handle.assetId),
    };
  }

  setDialogueDucking(enabled, { level = 0.62, ambienceLevel = 0.8, fadeMs = 320 } = {}) {
    this.persistentDuckLevel = enabled ? clamp(level, 0.05, 1) : 1;
    this.persistentAmbienceDuckLevel = enabled ? clamp(ambienceLevel, 0.05, 1) : 1;
    if (!this.context || !this.musicDuck || !this.ambienceDuck) return;
    const now = this.context.currentTime;
    cancelParamSchedule(this.musicDuck.gain, now);
    setParamValue(this.musicDuck.gain, Math.max(0.0001, this.musicDuck.gain.value ?? 1), now);
    rampParamValue(this.musicDuck.gain, this.persistentDuckLevel, now + Math.max(0, fadeMs) / 1000);
    cancelParamSchedule(this.ambienceDuck.gain, now);
    setParamValue(this.ambienceDuck.gain, Math.max(0.0001, this.ambienceDuck.gain.value ?? 1), now);
    rampParamValue(this.ambienceDuck.gain, this.persistentAmbienceDuckLevel, now + Math.max(0, fadeMs) / 1000);
  }

  duckMusic({ level = 0.3, attackMs = 30, holdMs = 350, releaseMs = 220 } = {}) {
    if (!this.context || !this.musicDuck) return;
    const now = this.context.currentTime;
    const attackEnd = now + Math.max(0, attackMs) / 1000;
    const holdEnd = attackEnd + Math.max(0, holdMs) / 1000;
    const releaseEnd = holdEnd + Math.max(0, releaseMs) / 1000;
    const duckLevel = Math.min(this.persistentDuckLevel, clamp(level, 0.05, 1));
    cancelParamSchedule(this.musicDuck.gain, now);
    setParamValue(this.musicDuck.gain, Math.max(0.0001, this.musicDuck.gain.value ?? 1), now);
    rampParamValue(this.musicDuck.gain, duckLevel, attackEnd);
    setParamValue(this.musicDuck.gain, duckLevel, holdEnd);
    rampParamValue(this.musicDuck.gain, this.persistentDuckLevel, releaseEnd);
  }

  stopAll({ fadeMs = 0, category = null } = {}) {
    if (category && Object.prototype.hasOwnProperty.call(this.categoryGenerations, category)) {
      this.categoryGenerations[category] += 1;
    } else if (!category) {
      for (const knownCategory of AUDIO_CATEGORIES) this.categoryGenerations[knownCategory] += 1;
    }
    for (const voice of [...this.activeVoices.values()]) {
      if (!category || voice.category === category) this.#stopVoice(voice, fadeMs);
    }
    if (!category || category === "bgm" || category === "ambience") {
      this.sceneTransitionToken += 1;
      this.pendingScene = null;
      this.desiredScene = null;
      this.sceneState = { sceneId: null, bgm: null, ambience: [] };
    }
  }

  stopInstance(instanceKey, { fadeMs = 0 } = {}) {
    if (typeof instanceKey !== "string" || instanceKey.length === 0) return 0;
    this.instanceGenerations.set(instanceKey, (this.instanceGenerations.get(instanceKey) ?? 0) + 1);
    let stopped = 0;
    for (const voice of [...this.activeVoices.values()]) {
      if (voice.instanceKey !== instanceKey) continue;
      stopped += 1;
      this.#stopVoice(voice, fadeMs);
    }
    return stopped;
  }

  hasInstance(instanceKey) {
    if (typeof instanceKey !== "string" || instanceKey.length === 0) return false;
    if (this.pendingDedupe.has(instanceKey)) return true;
    return [...this.activeVoices.values()].some((voice) => !voice.cleaned
      && !voice.stopping && voice.instanceKey === instanceKey);
  }

  stopInstances(instanceKeys, options = {}) {
    const keys = [...new Set(Array.isArray(instanceKeys) ? instanceKeys : [])];
    return keys.reduce((total, instanceKey) => total + this.stopInstance(instanceKey, options), 0);
  }

  getDiagnostics() {
    const cache = { loading: 0, fetched: 0, ready: 0, failed: 0, idle: 0 };
    for (const entry of this.assetCache.values()) cache[entry.status] = (cache[entry.status] ?? 0) + 1;
    const active = [...this.activeVoices.values()].filter((voice) => !voice.cleaned && !voice.stopping);
    const loopInstanceCounts = new Map();
    for (const voice of active.filter((candidate) => candidate.loop)) {
      loopInstanceCounts.set(voice.instanceKey, (loopInstanceCounts.get(voice.instanceKey) ?? 0) + 1);
    }
    return {
      unlocked: this.unlocked,
      contextState: this.context?.state ?? null,
      contextGeneration: this.contextGeneration,
      contextCreateCount: this.contextCreateCount,
      unlockTimeoutMs: this.unlockTimeoutMs,
      disposed: this.disposed,
      activeVoices: active.length,
      activeLoopVoices: active.filter((voice) => voice.loop).length,
      activeSceneVoices: active.filter((voice) => voice.instanceKey?.startsWith("scene:")).length,
      duplicateLoopInstanceKeys: [...loopInstanceCounts.entries()]
        .filter(([, count]) => count > 1)
        .map(([instanceKey]) => instanceKey),
      sceneId: this.sceneState.sceneId,
      desiredSceneId: this.desiredScene?.sceneId ?? null,
      audioState: this.audioStatus.state,
      needsGesture: this.audioStatus.needsGesture,
      cache,
      maxPreloadConcurrency: this.maxPreloadConcurrency,
      activePreloads: this.activePreloads,
      queuedPreloads: this.preloadQueue.length,
      warningTotal: this.warningTotal,
    };
  }

  async dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.sceneTransitionToken += 1;
    this.pendingScene = null;
    this.desiredScene = null;
    this.unlockCleanup?.();
    this.unlockTarget = null;
    this.lifecycleCleanup?.();
    this.contextStateCleanup?.();
    this.stopAll();
    this.preloadQueue.length = 0;
    for (const item of [...this.preloadTasks.values()]) this.#settlePreloadTask(item, false);
    this.preloadTasks.clear();
    for (const bus of Object.values(this.buses)) safeDisconnect(bus);
    safeDisconnect(this.musicDuck);
    safeDisconnect(this.ambienceDuck);
    safeDisconnect(this.master);
    safeDisconnect(this.limiter);
    const context = this.context;
    this.buses = {};
    this.musicDuck = null;
    this.ambienceDuck = null;
    this.master = null;
    this.limiter = null;
    this.assetCache.clear();
    this.lastPlayedAt.clear();
    this.poolState.clear();
    this.pendingDedupe.clear();
    this.instanceGenerations.clear();
    if (context && context.state !== "closed" && this.closeContextOnDispose && typeof context.close === "function") {
      try {
        await context.close();
      } catch (error) {
        this.#warn("audio-context-close", "AudioContext cleanup failed.", error);
      }
    }
    this.context = null;
    this.#setAudioStatus(AUDIO_MIXER_STATES.DISPOSED, { reason: "dispose" });
    this.statusListeners.clear();
  }
}

export function createAudioMixer(options) {
  return new AudioMixer(options);
}
