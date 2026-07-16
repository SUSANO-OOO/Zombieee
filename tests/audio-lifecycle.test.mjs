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

class FakeOscillator extends FakeNode {
  constructor(context) {
    super();
    this.context = context;
    this.frequency = new FakeParam(440);
    this.type = "sine";
    this.onended = null;
    this.startAt = null;
    this.stopAt = null;
  }
  start(at) {
    this.startAt = at;
    this.context.order.push("tone-start");
  }
  stop(at) { this.stopAt = at; }
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
    this.oscillators = [];
    this.resumeCount = 0;
    this.closeCount = 0;
    this.failResume = false;
  }
  createGain() { const gain = new FakeGain(); this.gains.push(gain); return gain; }
  createDynamicsCompressor() { return null; }
  createStereoPanner() { return null; }
  createBufferSource() { const source = new FakeSource(this); this.sources.push(source); return source; }
  createOscillator() { const oscillator = new FakeOscillator(this); this.oscillators.push(oscillator); return oscillator; }
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
  fire(name, { path = [] } = {}) {
    const event = new Event(name);
    Object.defineProperty(event, "composedPath", { value: () => path });
    this.dispatchEvent(event);
  }
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
  assert.equal(context.oscillators.length, 1);
  assert.equal(order.includes("tone-start"), true);
  assert.equal(mixer.getSceneState().sceneId, "title");
  assert.equal(context.sources.length, 1);
  assert.equal(mixer.getAudioStatus().state, AUDIO_MIXER_STATES.RUNNING);
  await mixer.dispose();
});

test("an explicit audio control owns its pointer and produces one manual unlock tone", async () => {
  const context = new FakeContext();
  let contextCreations = 0;
  const mixer = createAudioMixer({
    manifest: manifest(),
    fetcher,
    contextFactory: () => {
      contextCreations += 1;
      return context;
    },
  });
  const windowTarget = new FakeWindow();
  mixer.attachUnlock(windowTarget);
  windowTarget.fire("pointerdown", { path: [{ dataset: { audioUnlockControl: "true" } }] });
  await flush();
  assert.equal(contextCreations, 0);
  assert.equal(await mixer.enableAudio(), true);
  assert.equal(contextCreations, 1);
  assert.equal(context.resumeCount, 1);
  assert.equal(context.oscillators.length, 1);
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

test("a late resume remains failed until pageshow runs the tone and pending title scene pipeline", async () => {
  const context = new FakeContext();
  let releaseResume;
  context.resume = () => {
    context.resumeCount += 1;
    return new Promise((resolve) => {
      releaseResume = () => {
        context.state = "running";
        context.dispatchEvent(new Event("statechange"));
        resolve();
      };
    });
  };
  const mixer = createAudioMixer({
    manifest: manifest(),
    fetcher,
    contextFactory: () => context,
    logger: { warn() {} },
    unlockTimeoutMs: 15,
  });
  const windowTarget = new FakeWindow();
  mixer.attachUnlock(windowTarget);
  await mixer.setScene("title");

  assert.equal(await mixer.enableAudio(), false);
  assert.equal(context.resumeCount, 1);
  assert.equal(context.oscillators.length, 0);
  assert.equal(mixer.getAudioStatus().state, AUDIO_MIXER_STATES.FAILED);
  assert.equal(mixer.getAudioStatus().needsGesture, true);
  assert.match(mixer.getAudioStatus().error, /resume timed out after 15ms/);
  assert.equal(mixer.getDiagnostics().unlockTimeoutMs, 15);

  releaseResume();
  await flush();
  assert.equal(context.state, "running");
  assert.equal(mixer.getAudioStatus().state, AUDIO_MIXER_STATES.FAILED);
  assert.equal(mixer.getAudioStatus().needsGesture, true);

  windowTarget.fire("pageshow");
  await flush();
  assert.equal(mixer.getAudioStatus().state, AUDIO_MIXER_STATES.RUNNING);
  assert.equal(mixer.getAudioStatus().needsGesture, false);
  assert.equal(context.oscillators.length, 1);
  assert.equal(mixer.getSceneState().sceneId, "title");
  assert.equal(mixer.getDiagnostics().contextCreateCount, 1);
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
  await flush();
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

test("enable resolves after a synchronous audible tone without waiting for pending scene decode", async () => {
  const order = [];
  const context = new FakeContext(order);
  let releaseDecode;
  context.decodeAudioData = () => new Promise((resolve) => { releaseDecode = () => resolve({ duration: 1 }); });
  let contextCreations = 0;
  const mixer = createAudioMixer({
    manifest: manifest(),
    fetcher,
    contextFactory: () => {
      contextCreations += 1;
      return context;
    },
  });
  await mixer.setScene("title");

  assert.equal(await mixer.enableAudio(), true);
  assert.equal(mixer.getAudioStatus().state, AUDIO_MIXER_STATES.RUNNING);
  assert.equal(context.oscillators.length, 1);
  assert.equal(context.oscillators[0].startAt, context.currentTime);
  assert.equal(mixer.getSceneState().sceneId, null);
  while (!releaseDecode) await Promise.resolve();

  const sharedGraph = mixer.getSharedAudioGraph();
  assert.equal(sharedGraph.context, context);
  assert.equal(sharedGraph.generation, 1);
  assert.equal(contextCreations, 1);
  assert.equal(mixer.getDiagnostics().contextCreateCount, 1);
  assert.equal(context.oscillators[0].connections[0].connections[0], context.destination);

  assert.equal(mixer.playTestTone({ frequency: 880, duration: 0.2, volume: 0.25 }), true);
  assert.equal(context.oscillators[1].frequency.value, 880);
  assert.equal(context.oscillators[1].stopAt, context.currentTime + 0.2);
  assert.equal(context.oscillators[1].connections[0].connections[0], sharedGraph.categoryInputs.ui);
  mixer.setSettings({ muted: true });
  assert.equal(mixer.playTestTone(), false);
  assert.equal(mixer.playTestTone({ respectSettings: false }), true);
  assert.equal(contextCreations, 1);

  releaseDecode();
  await flush();
  assert.equal(mixer.getSceneState().sceneId, "title");
  await mixer.dispose();
});

test("the unlock tone bypasses a legacy zeroed mix while ordinary test tones still honor it", async () => {
  const context = new FakeContext();
  const mixer = createAudioMixer({ manifest: manifest(), fetcher, contextFactory: () => context });
  mixer.setSettings({ muted: true, masterVolume: 0, bgmEnabled: false, sfxEnabled: false, bgmVolume: 0, sfxVolume: 0 });
  assert.equal(await mixer.enableAudio(), true);
  assert.equal(context.oscillators.length, 1);
  assert.equal(context.oscillators[0].connections[0].connections[0], context.destination);
  assert.equal(mixer.playTestTone(), false);
  await mixer.dispose();
});

test("a transient confirmation-tone failure retains the pending scene for a clean retry", async () => {
  const context = new FakeContext();
  const createOscillator = context.createOscillator.bind(context);
  let failTone = true;
  context.createOscillator = () => {
    const oscillator = createOscillator();
    if (failTone) {
      failTone = false;
      oscillator.start = () => { throw new Error("transient oscillator failure"); };
    }
    return oscillator;
  };
  const mixer = createAudioMixer({ manifest: manifest(), fetcher, contextFactory: () => context, logger: { warn() {} } });
  await mixer.setScene("title");
  assert.equal(await mixer.enableAudio(), false);
  assert.equal(mixer.getSceneState().sceneId, null);
  assert.equal(await mixer.enableAudio(), true);
  await flush();
  assert.equal(mixer.getSceneState().sceneId, "title");
  assert.equal(context.sources.length, 1);
  await mixer.dispose();
});

test("a fresh mixer after page reload can unlock again without sharing the previous context", async () => {
  const contexts = [];
  for (let reload = 0; reload < 2; reload += 1) {
    const context = new FakeContext();
    contexts.push(context);
    const mixer = createAudioMixer({ manifest: manifest(), fetcher, contextFactory: () => context });
    const windowTarget = new FakeWindow();
    mixer.attachUnlock(windowTarget);
    windowTarget.fire("pointerdown");
    await flush();
    assert.equal(mixer.getAudioStatus().state, AUDIO_MIXER_STATES.RUNNING);
    assert.equal(context.oscillators.length, 1);
    await mixer.dispose();
  }
  assert.notEqual(contexts[0], contexts[1]);
  assert.equal(contexts[0].closeCount, 1);
  assert.equal(contexts[1].closeCount, 1);
});

test("logical aliases apply loop and instance defaults while reusing the target asset", async () => {
  const context = new FakeContext();
  const mixer = createAudioMixer({ manifest: manifest(), fetcher, contextFactory: () => context });
  assert.equal(await mixer.enableAudio(), true);
  const handle = await mixer.play("logical-loop");
  assert.equal(handle.cueId, "logical-loop");
  assert.equal(handle.assetId, "loop-source");
  assert.equal(context.sources[0].loop, true);
  assert.equal(mixer.hasInstance("battle-loop"), true);
  assert.equal(mixer.stopInstance("battle-loop"), 1);
  assert.equal(mixer.hasInstance("battle-loop"), false);
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
