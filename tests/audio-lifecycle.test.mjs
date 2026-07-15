import assert from "node:assert/strict";
import test from "node:test";

import {
  AUDIO_MIXER_STATES,
  createAudioMixer,
  createAudioRequestGate,
  runGuardedAudioRequest,
} from "../app/audioMixer.js";

class FakeParam {
  constructor(value = 1) { this.value = value; }
  setValueAtTime(value) { this.value = value; }
  linearRampToValueAtTime(value) { this.value = value; }
  cancelScheduledValues() {}
}

class FakeNode {
  constructor() { this.connections = []; }
  connect(node) { this.connections.push(node); return node; }
  disconnect() { this.connections = []; }
}

class FakeGain extends FakeNode {
  constructor() { super(); this.gain = new FakeParam(); }
}

class FakeSource extends FakeNode {
  constructor(context) {
    super();
    this.context = context;
    this.loop = false;
    this.playbackRate = { value: 1 };
    this.onended = null;
  }
  start() { this.started = true; }
  stop() { this.onended?.(); }
}

class FakeContext extends EventTarget {
  constructor(order = []) {
    super();
    this.order = order;
    this.state = "suspended";
    this.currentTime = 1;
    this.destination = new FakeNode();
    this.gains = [];
    this.sources = [];
    this.resumeCount = 0;
    this.closeCount = 0;
    this.failResume = false;
  }
  createGain() { const gain = new FakeGain(); this.gains.push(gain); return gain; }
  createDynamicsCompressor() { return null; }
  createStereoPanner() { return null; }
  createBufferSource() { const source = new FakeSource(this); this.sources.push(source); return source; }
  decodeAudioData() { return Promise.resolve({ duration: 1 }); }
  async resume() {
    this.order.push("resume");
    this.resumeCount += 1;
    if (this.failResume) throw new Error("gesture required");
    this.state = "running";
    this.dispatchEvent(new Event("statechange"));
  }
  async close() {
    this.closeCount += 1;
    this.state = "closed";
    this.dispatchEvent(new Event("statechange"));
  }
  setState(state) {
    this.state = state;
    this.dispatchEvent(new Event("statechange"));
  }
}

class FakeDocument extends EventTarget {
  constructor() {
    super();
    this.visibilityState = "visible";
  }
  fireVisibility(state = "visible") {
    this.visibilityState = state;
    this.dispatchEvent(new Event("visibilitychange"));
  }
}

class FakeWindow extends EventTarget {
  constructor() {
    super();
    this.document = new FakeDocument();
  }
  fire(name) { this.dispatchEvent(new Event(name)); }
}

function manifest() {
  return {
    assets: [
      { id: "music", category: "bgm", sources: [{ src: "/audio/music.mp3" }, { src: "/audio/music.ogg" }] },
      { id: "loop-source", category: "weapons", sources: [{ src: "/audio/loop.mp3" }] },
    ],
    aliases: [{ id: "logical-loop", targetId: "loop-source", loop: true, instanceKey: "battle-loop", maxInstances: 1 }],
    scenes: [{ id: "title", bgm: "music" }],
  };
}

const fetcher = async () => ({
  ok: true,
  status: 200,
  arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
});

async function flush() {
  for (let index = 0; index < 8; index += 1) await new Promise((resolve) => setImmediate(resolve));
}

test("a cancelled app audio request cannot revive after delayed unlock", async () => {
  const gate = createAudioRequestGate();
  let releaseUnlock;
  let plays = 0;
  let fallbacks = 0;
  const pending = runGuardedAudioRequest({
    gate,
    unlock: () => new Promise((resolve) => { releaseUnlock = resolve; }),
    play: async () => { plays += 1; return "played"; },
    fallback: () => { fallbacks += 1; return "fallback"; },
  });
  while (!releaseUnlock) await Promise.resolve();

  // Pause, withdrawal, result, mute, and disposal all invalidate through this
  // same gate before stopping active mixer voices.
  gate.cancelPending();
  releaseUnlock(true);

  assert.equal(await pending, null);
  assert.equal(plays, 0);
  assert.equal(fallbacks, 0);
});

test("a cancelled or muted app audio request cannot revive a fallback", async () => {
  for (const mode of ["cancelled", "muted"]) {
    const gate = createAudioRequestGate();
    let releaseUnlock;
    let muted = false;
    let fallbacks = 0;
    const pending = runGuardedAudioRequest({
      gate,
      unlock: () => new Promise((resolve) => { releaseUnlock = resolve; }),
      play: async () => null,
      fallback: () => { fallbacks += 1; },
      isMuted: () => muted,
    });
    while (!releaseUnlock) await Promise.resolve();
    if (mode === "cancelled") gate.cancelPending();
    else muted = true;
    releaseUnlock(false);
    assert.equal(await pending, null);
    assert.equal(fallbacks, 0, `${mode} request stayed silent`);
  }
});

test("the first pointer gesture synchronously creates and resumes context, while paired touch is deduplicated", async () => {
  const order = [];
  const context = new FakeContext(order);
  let contextCreations = 0;
  const mixer = createAudioMixer({
    manifest: manifest(),
    fetcher,
    contextFactory: () => {
      order.push("create");
      contextCreations += 1;
      return context;
    },
  });
  const windowTarget = new FakeWindow();
  mixer.attachUnlock(windowTarget);
  assert.equal(mixer.getAudioStatus().needsGesture, false);
  await mixer.setScene("title");

  windowTarget.fire("pointerdown");
  windowTarget.fire("touchend");
  assert.deepEqual(order.slice(0, 2), ["create", "resume"]);
  assert.equal(contextCreations, 1);
  assert.equal(context.resumeCount, 1);
  await flush();
  assert.equal(mixer.getSceneState().sceneId, "title");
  assert.equal(context.sources.length, 1);
  assert.equal(mixer.getAudioStatus().state, AUDIO_MIXER_STATES.RUNNING);
  await mixer.dispose();
});

test("statechange, pageshow, and visible visibilitychange recover suspended and interrupted contexts", async () => {
  const context = new FakeContext();
  const mixer = createAudioMixer({ manifest: manifest(), fetcher, contextFactory: () => context, logger: { warn() {} } });
  const windowTarget = new FakeWindow();
  mixer.attachUnlock(windowTarget);
  const states = [];
  mixer.subscribeStatus((status) => states.push(status.state));
  assert.equal(await mixer.enableAudio(), true);

  context.setState("suspended");
  await flush();
  assert.equal(context.state, "running");
  context.setState("interrupted");
  await flush();
  assert.equal(context.state, "running");
  context.state = "suspended";
  windowTarget.fire("pageshow");
  await flush();
  assert.equal(context.state, "running");
  context.state = "interrupted";
  windowTarget.document.fireVisibility("hidden");
  await flush();
  assert.equal(context.state, "interrupted");
  windowTarget.document.fireVisibility("visible");
  await flush();
  assert.equal(context.state, "running");
  assert.ok(states.includes(AUDIO_MIXER_STATES.RECOVERY_NEEDED));
  assert.equal(context.resumeCount, 5);
  await mixer.dispose();
});

test("failed recovery reports a gesture requirement and the manual enable API can recover", async () => {
  const context = new FakeContext();
  context.failResume = true;
  const mixer = createAudioMixer({ manifest: manifest(), fetcher, contextFactory: () => context, logger: { warn() {} } });
  const windowTarget = new FakeWindow();
  mixer.attachUnlock(windowTarget);
  windowTarget.fire("pointerdown");
  windowTarget.fire("touchend");
  await flush();
  assert.equal(context.resumeCount, 1);
  assert.deepEqual(mixer.getAudioStatus(), {
    state: AUDIO_MIXER_STATES.FAILED,
    contextState: "suspended",
    needsGesture: true,
    reason: "gesture:pointerdown",
    error: "gesture required",
  });

  context.failResume = false;
  assert.equal(await mixer.enableAudio(), true);
  assert.equal(context.resumeCount, 2);
  assert.equal(mixer.getAudioStatus().state, AUDIO_MIXER_STATES.RUNNING);
  await mixer.dispose();
});

test("a closed context is replaced, its graph is rebuilt, and the desired scene is replayed", async () => {
  const contexts = [];
  const mixer = createAudioMixer({
    manifest: manifest(),
    fetcher,
    contextFactory: () => {
      const context = new FakeContext();
      contexts.push(context);
      return context;
    },
  });
  await mixer.setScene("title");
  assert.equal(await mixer.enableAudio(), true);
  assert.equal(mixer.getSceneState().sceneId, "title");

  contexts[0].setState("closed");
  await flush();
  assert.equal(contexts.length, 2);
  assert.notEqual(mixer.master, null);
  assert.ok(contexts[1].gains.length > 0);
  assert.equal(contexts[1].resumeCount, 1);
  assert.equal(contexts[1].sources.length, 1);
  assert.equal(mixer.getSceneState().sceneId, "title");
  await mixer.dispose();
});

test("logical aliases apply loop and instance defaults while reusing the target asset", async () => {
  const context = new FakeContext();
  const mixer = createAudioMixer({ manifest: manifest(), fetcher, contextFactory: () => context });
  assert.equal(await mixer.enableAudio(), true);
  const handle = await mixer.play("logical-loop");
  assert.equal(handle.cueId, "logical-loop");
  assert.equal(handle.assetId, "loop-source");
  assert.equal(context.sources[0].loop, true);
  assert.equal(mixer.stopInstance("battle-loop"), 1);
  assert.equal(mixer.getDiagnostics().activeVoices, 0);
  await mixer.dispose();
});

test("stopping a loop instance cancels an unresolved reservation before it can create a voice", async () => {
  const context = new FakeContext();
  let releaseFetch;
  const delayedFetcher = async () => new Promise((resolve) => {
    releaseFetch = () => resolve({
      ok: true,
      status: 200,
      arrayBuffer: async () => new Uint8Array([1]).buffer,
    });
  });
  const mixer = createAudioMixer({ manifest: manifest(), fetcher: delayedFetcher, contextFactory: () => context });
  assert.equal(await mixer.enableAudio(), true);
  const pending = mixer.play("logical-loop");
  while (!releaseFetch) await Promise.resolve();
  assert.equal(mixer.stopInstance("battle-loop"), 0);
  releaseFetch();
  assert.equal(await pending, null);
  assert.equal(context.sources.length, 0);
  await mixer.dispose();
});
