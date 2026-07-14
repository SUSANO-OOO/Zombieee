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

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));

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

    this.context = null;
    this.master = null;
    this.limiter = null;
    this.buses = {};
    this.musicDuck = null;
    this.disposed = false;
    this.unlockCleanup = null;
    this.unlockPromise = null;
    this.assetCache = new Map();
    this.activeVoices = new Map();
    this.lastPlayedAt = new Map();
    this.poolState = new Map();
    this.pendingDedupe = new Map();
    this.categoryGenerations = Object.fromEntries(AUDIO_CATEGORIES.map((category) => [category, 0]));
    this.warningCounts = new Map();
    this.warningTotal = 0;
    this.voiceSequence = 0;
    this.sceneTransitionToken = 0;
    this.pendingScene = null;
    this.sceneState = { sceneId: null, bgm: null, ambience: [] };
    this.persistentDuckLevel = 1;
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

  attachUnlock(target = globalThis.window) {
    if (this.disposed || !target?.addEventListener) return () => undefined;
    this.unlockCleanup?.();
    let active = true;
    const listener = () => {
      if (!active) return;
      void this.unlock();
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
    return cleanup;
  }

  async unlock() {
    if (this.disposed) return false;
    if (this.unlockPromise) return this.unlockPromise;
    this.unlockPromise = (async () => {
      try {
        if (!this.context || this.context.state === "closed") {
          this.context = this.contextFactory();
          this.#createGraph();
        }
        if (this.context.state !== "running" && typeof this.context.resume === "function") await this.context.resume();
        if (this.context.state !== "running") throw new Error(`AudioContext remained ${String(this.context.state)}`);
        this.unlockCleanup?.();
        await Promise.all([...this.assetCache.keys()].map((assetId) => this.#decodeAsset(assetId)));
        const pendingScene = this.pendingScene;
        this.pendingScene = null;
        if (pendingScene) await this.setScene(pendingScene.sceneId, pendingScene.options);
        return true;
      } catch (error) {
        this.#warn("audio-context-unlock", "Audio could not be unlocked; gameplay will continue silently.", error);
        return false;
      } finally {
        this.unlockPromise = null;
      }
    })();
    return this.unlockPromise;
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
    setParamValue(this.musicDuck.gain, 1, context.currentTime);
    this.musicDuck.connect(this.master);
    for (const category of AUDIO_CATEGORIES) {
      const bus = context.createGain();
      this.buses[category] = bus;
      bus.connect(category === "bgm" ? this.musicDuck : this.master);
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

  #expandCueIds(cueIds) {
    const expanded = new Set();
    for (const cueId of cueIds) {
      const asset = this.manifest.assetById[cueId];
      const pool = this.manifest.poolById[cueId];
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
      this.#warn(`decode:${assetId}`, `Failed to decode ${assetId}; the cue will remain silent.`, lastError);
      return null;
    })().finally(() => {
      cacheEntry.decodePromise = null;
    });
    return cacheEntry.decodePromise;
  }

  async preloadAssets(cueIds) {
    if (this.disposed) return { loaded: [], failed: [] };
    const assetIds = this.#expandCueIds(Array.isArray(cueIds) ? cueIds : []);
    const loaded = [];
    const failed = [];
    await Promise.all(assetIds.map(async (assetId) => {
      const entry = await this.#fetchAsset(assetId);
      if (!entry) {
        failed.push(assetId);
        return;
      }
      if (this.context && this.context.state !== "closed") {
        const decoded = await this.#decodeAsset(assetId);
        if (!decoded) {
          failed.push(assetId);
          return;
        }
      }
      loaded.push(assetId);
    }));
    return { loaded, failed };
  }

  async preloadScene(sceneId, { includeOptional = true } = {}) {
    const scene = this.manifest.sceneById[sceneId];
    if (!scene) {
      this.#warn(`unknown-scene:${String(sceneId)}`, `Unknown audio scene ${String(sceneId)} was ignored.`);
      return { loaded: [], failed: [] };
    }
    return this.preloadAssets([
      scene.bgm,
      ...scene.ambience,
      ...(includeOptional ? scene.preload : []),
    ].filter(Boolean));
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
    const direct = this.manifest.assetById[cueId];
    if (direct) return { cueId, asset: direct, pool: null };
    const pool = this.manifest.poolById[cueId];
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
    return { cueId, asset: this.manifest.assetById[assetId], pool };
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
    const { cueId, asset, pool } = resolved;
    const context = this.context;
    const priority = clamp(options.priority ?? pool?.priority ?? asset.priority, 0, 1000);
    const instanceKey = options.instanceKey ?? cueId;
    const maxInstances = Math.max(1, Math.floor(options.maxInstances ?? pool?.maxInstances ?? asset.maxInstances));
    if (!this.#reserveVoiceSlot({ priority, instanceKey, maxInstances })) return null;
    const source = context.createBufferSource();
    const gain = context.createGain();
    const panner = typeof context.createStereoPanner === "function" ? context.createStereoPanner() : null;
    const now = context.currentTime;
    const volume = clamp(asset.gain * (Number.isFinite(options.volume) ? options.volume : 1), 0, 2);
    const fadeInSeconds = Math.max(0, options.fadeInMs ?? 0) / 1000;
    source.buffer = buffer;
    source.loop = options.loop ?? asset.loop;
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
    const direct = this.manifest.assetById[cueId];
    const pool = this.manifest.poolById[cueId];
    const pooledCooldown = pool
      ? Math.max(0, ...pool.assetIds.map((assetId) => this.manifest.assetById[assetId].cooldownMs))
      : 0;
    const cooldownMs = Math.max(0, options.cooldownMs ?? pool?.cooldownMs ?? direct?.cooldownMs ?? pooledCooldown);
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
    if (!buffer || this.disposed || !this.unlocked || this.categoryGenerations[resolved.asset.category] !== categoryGeneration) {
      // Only an actual source load/decode failure authorizes a caller's
      // synthesized fallback. Cooldown, polyphony, disposal, and category
      // cancellation remain intentionally silent.
      const sourceFailed = this.assetCache.get(resolved.asset.id)?.status === "failed";
      if (!buffer
        && !this.disposed
        && this.unlocked
        && this.categoryGenerations[resolved.asset.category] === categoryGeneration
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
    const duplicate = this.#findVoice((voice) => !voice.cleaned && voice.dedupeKey === options.dedupeKey);
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
    if (sceneId === this.sceneState.sceneId && (this.sceneState.bgm || this.sceneState.ambience.length > 0)) {
      return this.getSceneState();
    }
    const scene = this.manifest.sceneById[sceneId];
    if (!scene) {
      this.#warn(`unknown-scene:${String(sceneId)}`, `Unknown audio scene ${String(sceneId)} was ignored.`);
      return null;
    }
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
    void this.preloadAssets(scene.preload);
    return this.getSceneState();
  }

  async stopScene({ fadeMs = 250 } = {}) {
    this.sceneTransitionToken += 1;
    this.pendingScene = null;
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

  setDialogueDucking(enabled, { level = 0.45, fadeMs = 120 } = {}) {
    this.persistentDuckLevel = enabled ? clamp(level, 0.05, 1) : 1;
    if (!this.context || !this.musicDuck) return;
    const now = this.context.currentTime;
    cancelParamSchedule(this.musicDuck.gain, now);
    setParamValue(this.musicDuck.gain, Math.max(0.0001, this.musicDuck.gain.value ?? 1), now);
    rampParamValue(this.musicDuck.gain, this.persistentDuckLevel, now + Math.max(0, fadeMs) / 1000);
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
      this.sceneState = { sceneId: null, bgm: null, ambience: [] };
    }
  }

  getDiagnostics() {
    const cache = { loading: 0, fetched: 0, ready: 0, failed: 0, idle: 0 };
    for (const entry of this.assetCache.values()) cache[entry.status] = (cache[entry.status] ?? 0) + 1;
    return {
      unlocked: this.unlocked,
      contextState: this.context?.state ?? null,
      disposed: this.disposed,
      activeVoices: this.activeVoices.size,
      sceneId: this.sceneState.sceneId,
      cache,
      warningTotal: this.warningTotal,
    };
  }

  async dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.sceneTransitionToken += 1;
    this.pendingScene = null;
    this.unlockCleanup?.();
    this.stopAll();
    for (const bus of Object.values(this.buses)) safeDisconnect(bus);
    safeDisconnect(this.musicDuck);
    safeDisconnect(this.master);
    safeDisconnect(this.limiter);
    const context = this.context;
    this.buses = {};
    this.musicDuck = null;
    this.master = null;
    this.limiter = null;
    this.assetCache.clear();
    this.lastPlayedAt.clear();
    this.poolState.clear();
    this.pendingDedupe.clear();
    if (context && context.state !== "closed" && this.closeContextOnDispose && typeof context.close === "function") {
      try {
        await context.close();
      } catch (error) {
        this.#warn("audio-context-close", "AudioContext cleanup failed.", error);
      }
    }
    this.context = null;
  }
}

export function createAudioMixer(options) {
  return new AudioMixer(options);
}
