import assert from "node:assert/strict";
import test from "node:test";

import { createAudioManifest } from "../app/audioManifest.js";
import { createAudioMixer } from "../app/audioMixer.js";

class FakeParam {
  constructor(value = 0) {
    this.value = value;
    this.events = [];
  }

  setValueAtTime(value, at) {
    this.value = value;
    this.events.push({ kind: "set", value, at });
  }

  linearRampToValueAtTime(value, at) {
    this.value = value;
    this.events.push({ kind: "ramp", value, at });
  }

  cancelScheduledValues(at) {
    this.events.push({ kind: "cancel", at });
  }
}

class FakeNode {
  constructor() {
    this.connections = [];
    this.disconnected = false;
  }

  connect(node) {
    this.connections.push(node);
    return node;
  }

  disconnect() {
    this.disconnected = true;
    this.connections = [];
  }
}

class FakeGain extends FakeNode {
  constructor() {
    super();
    this.gain = new FakeParam(1);
  }
}

class FakeStereoPanner extends FakeNode {
  constructor() {
    super();
    this.pan = new FakeParam(0);
  }
}

class FakeCompressor extends FakeNode {
  constructor() {
    super();
    this.threshold = new FakeParam();
    this.knee = new FakeParam();
    this.ratio = new FakeParam();
    this.attack = new FakeParam();
    this.release = new FakeParam();
  }
}

class FakeBufferSource extends FakeNode {
  constructor(context) {
    super();
    this.context = context;
    this.buffer = null;
    this.loop = false;
    this.playbackRate = { value: 1 };
    this.onended = null;
    this.startAt = null;
    this.offset = null;
    this.stopAt = null;
  }

  start(at, offset = 0) {
    this.startAt = at;
    this.offset = offset;
  }

  stop(at = this.context.currentTime) {
    this.stopAt = at;
    if (at <= this.context.currentTime) this.onended?.();
  }

  end() {
    this.onended?.();
  }
}

class FakeAudioContext {
  constructor() {
    this.state = "suspended";
    this.currentTime = 1;
    this.destination = new FakeNode();
    this.gains = [];
    this.panners = [];
    this.sources = [];
    this.compressors = [];
    this.resumeCount = 0;
    this.closeCount = 0;
    this.decodeCount = 0;
    this.rejectedCodes = new Set();
  }

  createGain() {
    const node = new FakeGain();
    this.gains.push(node);
    return node;
  }

  createStereoPanner() {
    const node = new FakeStereoPanner();
    this.panners.push(node);
    return node;
  }

  createDynamicsCompressor() {
    const node = new FakeCompressor();
    this.compressors.push(node);
    return node;
  }

  createBufferSource() {
    const node = new FakeBufferSource(this);
    this.sources.push(node);
    return node;
  }

  decodeAudioData(raw) {
    this.decodeCount += 1;
    const code = new Uint8Array(raw)[0];
    if (this.rejectedCodes.has(code)) return Promise.reject(new Error(`unsupported format ${code}`));
    return Promise.resolve({ duration: 1, code });
  }

  async resume() {
    this.resumeCount += 1;
    this.state = "running";
  }

  async close() {
    this.closeCount += 1;
    this.state = "closed";
  }
}

class FakeEventTarget {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(name, listener) {
    const listeners = this.listeners.get(name) ?? new Set();
    listeners.add(listener);
    this.listeners.set(name, listeners);
  }

  removeEventListener(name, listener) {
    this.listeners.get(name)?.delete(listener);
  }

  fire(name) {
    for (const listener of [...(this.listeners.get(name) ?? [])]) listener({ type: name });
  }

  listenerCount() {
    return [...this.listeners.values()].reduce((total, listeners) => total + listeners.size, 0);
  }
}

function createTestManifest() {
  return createAudioManifest({
    assets: [
      { id: "bgm-title", category: "bgm", sources: [{ src: "/audio/bgm-title.ogg" }], gain: 0.7 },
      { id: "bgm-battle", category: "bgm", sources: [{ src: "/audio/bgm-battle.ogg" }], gain: 0.75 },
      { id: "ambience-rain", category: "ambience", sources: [{ src: "/audio/ambience-rain.ogg" }] },
      { id: "ambience-wind", category: "ambience", sources: [{ src: "/audio/ambience-wind.ogg" }] },
      { id: "ui-click", category: "ui", sources: [{ src: "/audio/ui-click.ogg" }], cooldownMs: 100 },
      { id: "weapon-a", category: "weapons", sources: [{ src: "/audio/weapon-a.ogg" }], gain: 0.5 },
      { id: "weapon-b", category: "weapons", sources: [{ src: "/audio/weapon-b.ogg" }], gain: 0.5 },
      { id: "melee-hit", category: "melee", sources: [{ src: "/audio/melee-hit.ogg" }] },
      { id: "voice-a", category: "humanVoices", sources: [{ src: "/audio/voice-a.ogg" }] },
      { id: "voice-b", category: "humanVoices", sources: [{ src: "/audio/voice-b.ogg" }] },
      { id: "monster-growl", category: "monsters", sources: [{ src: "/audio/monster-growl.ogg" }] },
      { id: "support-airstrike", category: "support", sources: [{ src: "/audio/support-airstrike.ogg" }] },
    ],
    pools: [
      { id: "weapon-variations", category: "weapons", assetIds: ["weapon-a", "weapon-b"], strategy: "round-robin" },
      { id: "voice-variations", category: "humanVoices", assetIds: ["voice-a", "voice-b"], strategy: "shuffle" },
    ],
    scenes: [
      { id: "title", bgm: "bgm-title", ambience: ["ambience-rain"], preload: ["ui-click"], crossfadeMs: 100 },
      { id: "battle", bgm: "bgm-battle", ambience: ["ambience-wind"], preload: ["weapon-variations"], crossfadeMs: 180 },
    ],
  });
}

function makeFetcher({ fail = new Set() } = {}) {
  const paths = [];
  const codes = new Map();
  return {
    paths,
    fetcher: async (path) => {
      paths.push(path);
      if (fail.has(path)) return { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) };
      if (!codes.has(path)) codes.set(path, codes.size + 1);
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => new Uint8Array([codes.get(path), 7, 9]).buffer,
      };
    },
  };
}

async function flushAsyncWork() {
  for (let index = 0; index < 6; index += 1) await new Promise((resolve) => setImmediate(resolve));
}

test("scene assets preload without AudioContext and pending music starts only after a user gesture", async () => {
  const context = new FakeAudioContext();
  const target = new FakeEventTarget();
  const network = makeFetcher();
  let contextCreations = 0;
  const mixer = createAudioMixer({
    manifest: createTestManifest(),
    contextFactory: () => {
      contextCreations += 1;
      return context;
    },
    fetcher: network.fetcher,
  });
  mixer.attachUnlock(target);
  await mixer.setScene("title");
  assert.equal(contextCreations, 0);
  assert.deepEqual(network.paths.sort(), [
    "/audio/ambience-rain.ogg",
    "/audio/bgm-title.ogg",
  ]);
  assert.equal(mixer.getDiagnostics().cache.fetched, 2);
  target.fire("pointerdown");
  await flushAsyncWork();
  assert.equal(contextCreations, 1);
  assert.equal(context.resumeCount, 1);
  assert.equal(mixer.unlocked, true);
  assert.equal(mixer.getSceneState().sceneId, "title");
  assert.equal(mixer.getSceneState().bgmAssetId, "bgm-title");
  assert.deepEqual(mixer.getSceneState().ambienceAssetIds, ["ambience-rain"]);
  assert.equal(target.listenerCount(), 0);
  assert.equal(context.sources.length, 2);
  await flushAsyncWork();
  assert.equal(network.paths.includes("/audio/ui-click.ogg"), true);
  await mixer.dispose();
  assert.equal(context.closeCount, 1);
});

test("a newer scene requested during gesture unlock supersedes the pre-gesture pending scene", async () => {
  const context = new FakeAudioContext();
  const network = makeFetcher();
  const mixer = createAudioMixer({ manifest: createTestManifest(), contextFactory: () => context, fetcher: network.fetcher });
  await mixer.setScene("title");

  const originalDecode = context.decodeAudioData.bind(context);
  let releaseTitleDecode;
  const titleDecodeStarted = new Promise((resolve) => {
    context.decodeAudioData = (raw, success, failure) => {
      const code = new Uint8Array(raw)[0];
      if (code !== 1) return originalDecode(raw, success, failure);
      return new Promise((release) => {
        releaseTitleDecode = () => {
          originalDecode(raw, success, failure).then(release, failure);
          resolve();
        };
      });
    };
  });

  const unlocking = mixer.unlock();
  while (!releaseTitleDecode) await Promise.resolve();
  const newer = mixer.setScene("battle");
  releaseTitleDecode();
  await titleDecodeStarted;
  await Promise.all([unlocking, newer]);
  assert.equal(mixer.getSceneState().sceneId, "battle");
  assert.equal(mixer.getSceneState().bgmAssetId, "bgm-battle");
  await mixer.dispose();
});

test("variation pools avoid one-sample repetition while cooldown, volume, and pan remain bounded", async () => {
  const context = new FakeAudioContext();
  const network = makeFetcher();
  const mixer = createAudioMixer({ manifest: createTestManifest(), contextFactory: () => context, fetcher: network.fetcher });
  await mixer.unlock();
  const first = await mixer.play("weapon-variations", { volume: 0.5, pan: -0.65 });
  const second = await mixer.play("weapon-variations", { pan: 2 });
  assert.equal(first.assetId, "weapon-a");
  assert.equal(second.assetId, "weapon-b");
  assert.equal(context.sources[0].connections[0].gain.value, 0.25);
  assert.equal(context.panners[0].pan.value, -0.65);
  assert.equal(context.panners[1].pan.value, 1);

  const uiFirst = await mixer.play("ui-click");
  const uiBlocked = await mixer.play("ui-click");
  assert.ok(uiFirst);
  assert.equal(uiBlocked, null);
  context.currentTime += 0.101;
  assert.ok(await mixer.play("ui-click"));
  await mixer.dispose();
});

test("campaign-compatible BGM and SFX settings update independent mixer buses", async () => {
  const context = new FakeAudioContext();
  const network = makeFetcher();
  const mixer = createAudioMixer({ manifest: createTestManifest(), contextFactory: () => context, fetcher: network.fetcher });
  await mixer.unlock();
  mixer.setCategoryVolume("bgm", 0.5);
  mixer.setSettings({ masterVolume: 0.8, bgmVolume: 0.4, sfxVolume: 0.5, ambienceVolume: 0.6 });
  assert.equal(mixer.master.gain.value, 0.8);
  assert.equal(mixer.buses.bgm.gain.value, 0.2);
  assert.equal(mixer.buses.ambience.gain.value, 0.3);
  assert.equal(mixer.buses.weapons.gain.value, 0.41);
  mixer.setSettings({ bgmEnabled: false, sfxEnabled: false });
  assert.equal(mixer.buses.bgm.gain.value, 0);
  assert.equal(mixer.buses.ambience.gain.value, 0);
  assert.equal(mixer.buses.ui.gain.value, 0);
  mixer.setSettings({ muted: true });
  assert.equal(mixer.master.gain.value, 0);
  await mixer.dispose();
});

test("polyphony and per-cue caps reject low priority noise and displace an older low priority voice", async () => {
  const context = new FakeAudioContext();
  const network = makeFetcher();
  const mixer = createAudioMixer({
    manifest: createTestManifest(),
    contextFactory: () => context,
    fetcher: network.fetcher,
    maxVoices: 2,
  });
  await mixer.unlock();
  const first = await mixer.play("weapon-a", { priority: 10, instanceKey: "first" });
  context.currentTime += 0.01;
  const second = await mixer.play("melee-hit", { priority: 20, instanceKey: "second" });
  assert.ok(first);
  assert.ok(second);
  assert.equal(await mixer.play("monster-growl", { priority: 5, instanceKey: "third" }), null);
  const high = await mixer.play("support-airstrike", { priority: 90, instanceKey: "major" });
  assert.ok(high);
  assert.equal(context.sources[0].stopAt, context.currentTime);
  assert.equal(mixer.getDiagnostics().activeVoices, 2);

  const replacement = await mixer.play("support-airstrike", {
    priority: 100,
    instanceKey: "major",
    maxInstances: 1,
  });
  assert.ok(replacement);
  assert.notEqual(replacement.id, high.id);
  assert.equal(mixer.getDiagnostics().activeVoices, 2);
  await mixer.dispose();
});

test("scene transitions crossfade once, dialogue and major cues duck music, and same-scene calls do not double play", async () => {
  const context = new FakeAudioContext();
  const network = makeFetcher();
  const mixer = createAudioMixer({ manifest: createTestManifest(), contextFactory: () => context, fetcher: network.fetcher });
  await mixer.unlock();
  await mixer.setScene("title", { crossfadeMs: 100 });
  assert.equal(context.sources.length, 2);
  const titleState = mixer.getSceneState();
  await mixer.setScene("title", { crossfadeMs: 100 });
  assert.equal(context.sources.length, 2);
  assert.deepEqual(mixer.getSceneState(), titleState);

  await mixer.setScene("battle", { crossfadeMs: 200 });
  assert.equal(context.sources.length, 4);
  assert.equal(context.sources[0].stopAt, context.currentTime + 0.21);
  assert.equal(context.sources[1].stopAt, context.currentTime + 0.21);
  assert.equal(mixer.getSceneState().bgmAssetId, "bgm-battle");
  const duckEventsBefore = mixer.musicDuck.gain.events.length;
  mixer.setDialogueDucking(true, { level: 0.4, fadeMs: 80 });
  mixer.duckMusic({ level: 0.2, attackMs: 20, holdMs: 300, releaseMs: 150 });
  const duckEvents = mixer.musicDuck.gain.events.slice(duckEventsBefore);
  assert.equal(duckEvents.some((event) => event.kind === "ramp" && event.value === 0.4), true);
  assert.equal(duckEvents.some((event) => event.kind === "ramp" && event.value === 0.2), true);
  assert.equal(duckEvents.at(-1).value, 0.4);
  mixer.setDialogueDucking(false);
  assert.equal(mixer.musicDuck.gain.events.at(-1).value, 1);
  await mixer.dispose();
  assert.equal(mixer.getDiagnostics().activeVoices, 0);
});

test("different scenes sharing one BGM preserve the existing loop without self-crossfading", async () => {
  const context = new FakeAudioContext();
  const { fetcher } = makeFetcher();
  const manifest = createAudioManifest({
    assets: [{ id: "shared-map", category: "bgm", sources: [{ src: "/audio/shared-map.ogg" }], loop: true }],
    scenes: [
      { id: "map", bgm: "shared-map", crossfadeMs: 200 },
      { id: "loadout", bgm: "shared-map", crossfadeMs: 200 },
    ],
  });
  const mixer = createAudioMixer({ manifest, contextFactory: () => context, fetcher });
  await mixer.unlock();
  await mixer.setScene("map");
  const mapState = mixer.getSceneState();
  assert.equal(context.sources.length, 1);
  await mixer.setScene("loadout");
  assert.equal(context.sources.length, 1);
  assert.equal(context.sources[0].stopAt, null);
  assert.equal(mixer.getSceneState().sceneId, "loadout");
  assert.equal(mixer.getSceneState().bgmAssetId, mapState.bgmAssetId);
  await mixer.dispose();
});

test("slow optional scene preload never blocks the first BGM frame", async () => {
  const context = new FakeAudioContext();
  let releaseOptional;
  const optionalStarted = new Promise((resolve) => {
    releaseOptional = () => resolve({
      ok: true,
      status: 200,
      arrayBuffer: async () => new Uint8Array([9, 7, 9]).buffer,
    });
  });
  const fetcher = async (path) => {
    if (path === "/audio/optional.ogg") return optionalStarted;
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () => new Uint8Array([8, 7, 9]).buffer,
    };
  };
  const manifest = createAudioManifest({
    assets: [
      { id: "immediate-bgm", category: "bgm", sources: [{ src: "/audio/immediate.ogg" }], loop: true },
      { id: "optional-cue", category: "ui", sources: [{ src: "/audio/optional.ogg" }] },
    ],
    scenes: [{ id: "battle", bgm: "immediate-bgm", preload: ["optional-cue"], crossfadeMs: 0 }],
  });
  const mixer = createAudioMixer({ manifest, contextFactory: () => context, fetcher });
  await mixer.unlock();
  await mixer.setScene("battle");
  assert.equal(context.sources.length, 1);
  assert.equal(context.sources[0].loop, true);
  releaseOptional();
  await flushAsyncWork();
  await mixer.dispose();
});

test("one-shot result music keeps the manifest non-loop setting", async () => {
  const context = new FakeAudioContext();
  const { fetcher } = makeFetcher();
  const manifest = createAudioManifest({
    assets: [{ id: "result-sting", category: "bgm", sources: [{ src: "/audio/result-sting.ogg" }], loop: false }],
    scenes: [{ id: "result", bgm: "result-sting", crossfadeMs: 0 }],
  });
  const mixer = createAudioMixer({ manifest, contextFactory: () => context, fetcher });
  await mixer.unlock();
  await mixer.setScene("result");
  assert.equal(context.sources.length, 1);
  assert.equal(context.sources[0].loop, false);
});

test("a scene BGM source failure invokes only the explicit procedural fallback hook", async () => {
  const context = new FakeAudioContext();
  const manifest = createAudioManifest({
    assets: [{ id: "broken-bgm", category: "bgm", sources: [{ src: "/audio/broken-bgm.ogg" }], loop: true }],
    scenes: [{ id: "broken-scene", bgm: "broken-bgm", crossfadeMs: 0 }],
  });
  const { fetcher } = makeFetcher({ fail: new Set(["/audio/broken-bgm.ogg"]) });
  const mixer = createAudioMixer({ manifest, contextFactory: () => context, fetcher, logger: { warn: () => undefined } });
  await mixer.unlock();
  let fallbackCount = 0;
  const state = await mixer.setScene("broken-scene", { onBgmLoadFailure: () => { fallbackCount += 1; } });
  assert.equal(fallbackCount, 1);
  assert.equal(state.bgmAssetId, null);
  assert.equal(mixer.getDiagnostics().activeVoices, 0);
  await mixer.dispose();
});

test("the latest scene request cancels an older async transition without starting duplicate loops", async () => {
  const context = new FakeAudioContext();
  const network = makeFetcher();
  let releaseBattleMusic;
  const fetcher = async (path, options) => {
    if (path === "/audio/bgm-battle.ogg") await new Promise((resolve) => { releaseBattleMusic = resolve; });
    return network.fetcher(path, options);
  };
  const mixer = createAudioMixer({ manifest: createTestManifest(), contextFactory: () => context, fetcher });
  await mixer.unlock();
  await mixer.setScene("title");
  const olderTransition = mixer.setScene("battle");
  await Promise.resolve();
  assert.equal(typeof releaseBattleMusic, "function");
  await mixer.setScene("title");
  releaseBattleMusic();
  await olderTransition;
  assert.equal(mixer.getSceneState().sceneId, "title");
  assert.equal(mixer.getSceneState().bgmAssetId, "bgm-title");
  assert.equal(context.sources.length, 2);
  await mixer.dispose();
});

test("load and decode failures stay silent, cache the failure, and emit only bounded warnings", async () => {
  const manifest = createAudioManifest({
    assets: [
      {
        id: "broken",
        category: "ui",
        sources: [{ src: "/audio/broken.ogg" }, { src: "/audio/broken.mp3" }],
      },
      {
        id: "healthy",
        category: "ui",
        sources: [{ src: "/audio/healthy.ogg" }],
        cooldownMs: 1000,
      },
    ],
  });
  const context = new FakeAudioContext();
  const network = makeFetcher({ fail: new Set(["/audio/broken.ogg", "/audio/broken.mp3"]) });
  const warnings = [];
  const mixer = createAudioMixer({
    manifest,
    contextFactory: () => context,
    fetcher: network.fetcher,
    logger: { warn: (...args) => warnings.push(args) },
    maxWarningsTotal: 2,
    maxWarningsPerKey: 1,
  });
  await mixer.unlock();
  let brokenFallbacks = 0;
  let healthyFallbacks = 0;
  assert.equal(await mixer.play("broken", { onLoadFailure: () => { brokenFallbacks += 1; } }), null);
  assert.equal(brokenFallbacks, 1);
  assert.equal(await mixer.play("broken"), null);
  assert.equal(network.paths.length, 2);
  assert.equal(warnings.length, 1);
  assert.equal(await mixer.play("unknown"), null);
  assert.equal(await mixer.play("unknown"), null);
  assert.equal(warnings.length, 2);
  assert.equal(mixer.getDiagnostics().warningTotal, 2);
  assert.equal(mixer.getDiagnostics().cache.failed, 1);
  assert.ok(await mixer.play("healthy", { onLoadFailure: () => { healthyFallbacks += 1; } }));
  assert.equal(await mixer.play("healthy", { onLoadFailure: () => { healthyFallbacks += 1; } }), null);
  assert.equal(healthyFallbacks, 0);
  await mixer.dispose();
});

test("a browser decode failure falls through to the next repository-local source format", async () => {
  const manifest = createAudioManifest({
    assets: [{
      id: "multi-format",
      category: "ui",
      sources: [{ src: "/audio/multi-format.ogg" }, { src: "/audio/multi-format.m4a" }],
    }],
  });
  const context = new FakeAudioContext();
  context.rejectedCodes.add(1);
  const network = makeFetcher();
  const warnings = [];
  const mixer = createAudioMixer({
    manifest,
    contextFactory: () => context,
    fetcher: network.fetcher,
    logger: { warn: (...args) => warnings.push(args) },
  });
  await mixer.unlock();
  const handle = await mixer.play("multi-format");
  assert.ok(handle);
  assert.deepEqual(network.paths, ["/audio/multi-format.ogg", "/audio/multi-format.m4a"]);
  assert.equal(context.decodeCount, 2);
  assert.equal(warnings.length, 0);
  assert.equal(mixer.getDiagnostics().cache.ready, 1);
  await mixer.dispose();
});

test("stopping a category cancels its pending lazy cue before it can leak into the next screen", async () => {
  const context = new FakeAudioContext();
  let announceFetch;
  const fetchStarted = new Promise((resolve) => { announceFetch = resolve; });
  let releaseFetch;
  const fetcher = async () => {
    announceFetch();
    return new Promise((resolve) => {
      releaseFetch = () => resolve({
        ok: true,
        status: 200,
        arrayBuffer: async () => new Uint8Array([4, 7, 9]).buffer,
      });
    });
  };
  const mixer = createAudioMixer({ manifest: createTestManifest(), contextFactory: () => context, fetcher });
  await mixer.unlock();
  const pending = mixer.play("weapon-a");
  await fetchStarted;
  mixer.stopAll({ category: "weapons" });
  releaseFetch();
  assert.equal(await pending, null);
  assert.equal(context.sources.length, 0);
  assert.equal(mixer.getDiagnostics().activeVoices, 0);
  await mixer.dispose();
});

test("disposing during a pending fetch never revives synthesized fallback or a voice", async () => {
  const context = new FakeAudioContext();
  let announceFetch;
  const fetchStarted = new Promise((resolve) => { announceFetch = resolve; });
  let releaseFetch;
  const fetcher = async () => {
    announceFetch();
    return new Promise((resolve) => {
      releaseFetch = () => resolve({
        ok: true,
        status: 200,
        arrayBuffer: async () => new Uint8Array([5, 7, 9]).buffer,
      });
    });
  };
  const mixer = createAudioMixer({ manifest: createTestManifest(), contextFactory: () => context, fetcher });
  await mixer.unlock();
  let fallbackCount = 0;
  const pending = mixer.play("weapon-a", { onLoadFailure: () => { fallbackCount += 1; } });
  await fetchStarted;
  await mixer.dispose();
  releaseFetch();
  assert.equal(await pending, null);
  assert.equal(fallbackCount, 0);
  assert.equal(context.sources.length, 0);
  assert.equal(mixer.getDiagnostics().activeVoices, 0);
});

test("dedupe keys prevent double playback and dispose performs idempotent voice and context cleanup", async () => {
  const context = new FakeAudioContext();
  const target = new FakeEventTarget();
  const network = makeFetcher();
  const mixer = createAudioMixer({ manifest: createTestManifest(), contextFactory: () => context, fetcher: network.fetcher });
  const detach = mixer.attachUnlock(target);
  await mixer.unlock();
  const [first, duplicate] = await Promise.all([
    mixer.play("bgm-title", { loop: true, dedupeKey: "preview:title" }),
    mixer.play("bgm-title", { loop: true, dedupeKey: "preview:title" }),
  ]);
  assert.equal(first.id, duplicate.id);
  assert.equal(context.sources.length, 1);
  first.stop();
  first.stop();
  assert.equal(mixer.getDiagnostics().activeVoices, 0);
  assert.ok(await mixer.play("voice-variations"));
  assert.ok(await mixer.play("support-airstrike"));
  await mixer.dispose();
  await mixer.dispose();
  detach();
  assert.equal(mixer.getDiagnostics().activeVoices, 0);
  assert.equal(mixer.getDiagnostics().disposed, true);
  assert.equal(context.closeCount, 1);
  assert.equal(target.listenerCount(), 0);
  assert.equal(await mixer.play("ui-click"), null);
});
