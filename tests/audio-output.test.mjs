import assert from "node:assert/strict";
import test from "node:test";
import { createAudioOutput, usesNativeMediaOutput } from "../app/audioOutput.js";
import { createAudioMixer } from "../app/audioMixer.js";
import { createEndingAudioMix, endingAudioState } from "../app/endingAudioMix.js";

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
function fixture() {
  const order = [], elements = [], tracks = [], nodes = [];
  const doc = new EventTarget(); doc.visibilityState = "visible";
  doc.body = { appendChild(audio) { elements.push(audio); } };
  doc.createElement = () => {
    const audio = new EventTarget();
    Object.assign(audio, { paused: true, plays: 0, pauses: 0, srcObject: null, removed: false,
      setAttribute() {}, remove() { this.removed = true; },
      play() { this.plays += 1; order.push("play"); this.paused = false; return Promise.resolve(); },
      pause() { this.pauses += 1; const changed = !this.paused; this.paused = true;
        if (changed) this.dispatchEvent(new Event("pause")); },
    });
    return audio;
  };
  const rotation = new EventTarget(); rotation.matches = false;
  const win = new EventTarget(); win.document = doc;
  win.navigator = { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 26_7_1 like Mac OS X)", audioSession: { type: "auto" } };
  win.matchMedia = () => rotation;
  const node = () => {
    const result = { connections: [], gain: { value: 1, setValueAtTime(v) { this.value = v; },
      cancelScheduledValues() {}, linearRampToValueAtTime(v) { this.value = v; } },
      connect(target) { this.connections.push(target); return target; }, disconnect() { this.connections = []; } };
    nodes.push(result); return result;
  };
  const context = new EventTarget();
  Object.assign(context, { currentTime: 0, state: "suspended", destination: node(),
    createGain: node, createDynamicsCompressor: () => null,
    createMediaElementSource(audio) { const source = node(); source.audio = audio; return source; },
    createMediaStreamDestination() {
      const destination = node(), track = { stops: 0, stop() { this.stops += 1; } };
      tracks.push(track); destination.stream = { getTracks: () => [track] }; return destination;
    },
    async resume() { order.push("resume"); this.state = "running"; this.dispatchEvent(new Event("statechange")); },
    async suspend() { this.state = "suspended"; this.dispatchEvent(new Event("statechange")); },
    async close() { this.state = "closed"; this.dispatchEvent(new Event("statechange")); },
  });
  return { context, doc, win, rotation, elements, tracks, order, nodes,
    options: { navigatorTarget: win.navigator, windowTarget: win } };
}

test("iPhone/iPad output preserves a single native media route without requesting a microphone", async () => {
  const f = fixture(), output = createAudioOutput(f.context, f.options);
  assert.equal(f.elements.length, 1);
  assert.equal(output.snapshot().mode, "media-stream");
  assert.notEqual(output.destination, f.context.destination);
  assert.equal(output.destination.connections.length, 1);
  assert.equal(output.destination.connections[0].stream, f.elements[0].srcObject);
  assert.equal(f.elements[0].plays, 0, "Construction must not autoplay");
  const first = output.prepare(), second = output.prepare();
  assert.equal(first, second); assert.equal(f.elements[0].plays, 1);
  await first; await output.prepare();
  assert.equal(f.elements[0].plays, 1);
  assert.equal(f.elements[0].volume, 1); assert.equal(f.elements[0].muted, false);
  output.dispose(); output.dispose();
  assert.equal(f.elements[0].srcObject, null); assert.equal(f.tracks[0].stops, 1);
  assert.equal(f.elements[0].removed, true); assert.deepEqual(output.destination.connections, []);
});

test("desktop, missing APIs and failed media construction keep the existing direct route", async () => {
  assert.equal(usesNativeMediaOutput({ userAgent: "Macintosh", maxTouchPoints: 5 }), true);
  assert.equal(usesNativeMediaOutput({ userAgent: "Macintosh", maxTouchPoints: 0 }), false);
  for (const setup of [f => { f.win.navigator.userAgent = "Windows NT"; },
    f => { f.context.createMediaStreamDestination = undefined; },
    f => { f.doc.createElement = () => { throw new Error("unsupported"); }; }]) {
    const f = fixture(); setup(f);
    const output = createAudioOutput(f.context, f.options);
    assert.equal(output.destination, f.context.destination); assert.equal(await output.prepare(), true);
    assert.equal(f.elements.length, 0); output.dispose();
    for (const track of f.tracks) assert.equal(track.stops, 1);
  }
});

test("a denied or hanging play stays bounded and cannot create a second audible route", async () => {
  for (const failure of ["denied", "hang"]) {
    const f = fixture(), output = createAudioOutput(f.context, { ...f.options, timeoutMs: 5 });
    const audio = f.elements[0];
    let finish;
    audio.play = () => failure === "denied" ? Promise.reject(new DOMException("gesture", "NotAllowedError"))
      : new Promise(resolve => { finish = () => { audio.paused = false; resolve(); }; });
    await assert.rejects(output.prepare(), { name: "NotAllowedError" });
    assert.equal(audio.paused, true); assert.equal(output.needsRecovery(), true);
    assert.equal(output.destination.connections.includes(f.context.destination), false);
    finish?.(); await wait(0); assert.equal(audio.paused, true, "A late play must be stopped");
    output.dispose();
  }
});

test("background, portrait and disposal cancel pending plays and never stop reusable tracks before disposal", async () => {
  for (const transition of ["hidden", "portrait", "pagehide", "dispose"]) {
    const f = fixture(), output = createAudioOutput(f.context, f.options), audio = f.elements[0];
    let finish;
    audio.play = () => new Promise(resolve => { finish = () => { audio.paused = false; resolve(); }; });
    const starting = output.prepare();
    if (transition === "hidden") { f.doc.visibilityState = "hidden"; f.doc.dispatchEvent(new Event("visibilitychange")); }
    if (transition === "portrait") { f.rotation.matches = true; f.rotation.dispatchEvent(new Event("change")); }
    if (transition === "pagehide") f.win.dispatchEvent(new Event("pagehide"));
    if (transition === "dispose") output.dispose();
    await assert.rejects(starting, { name: "AbortError" });
    finish(); await wait(0);
    assert.equal(audio.paused, true);
    assert.equal(f.tracks[0].stops, transition === "dispose" ? 1 : 0);
    output.dispose(); assert.equal(f.tracks[0].stops, 1);
  }
});

test("the game mixer unlocks native output and context in one task and recovers a paused output", async () => {
  const f = fixture(); delete f.win.navigator.audioSession;
  const mixer = createAudioMixer({ contextFactory: () => f.context,
    enableAcknowledgementTone: false, logger: { warn() {} } });
  mixer.attachUnlock(f.win);
  const unlocked = mixer.unlock();
  assert.deepEqual(f.order, ["play", "resume"]);
  assert.equal(await unlocked, true);
  assert.equal(mixer.audioOutput.snapshot().mode, "media-stream");
  assert.equal(mixer.master.connections[0].connections.includes(f.context.destination), false);
  // An older iOS without AudioSession must recover in the lifecycle listener
  // itself, before the later-created output's pageshow listener runs.
  f.win.dispatchEvent(new Event("pagehide")); await wait(0);
  assert.equal(f.elements[0].paused, true);
  f.win.dispatchEvent(new Event("pageshow")); await wait(0);
  assert.equal(f.elements[0].paused, false);
  assert.equal(mixer.getAudioStatus().state, "running");
  f.elements[0].pause(); await wait(0);
  assert.equal(f.elements[0].paused, false);
  f.doc.visibilityState = "hidden"; f.doc.dispatchEvent(new Event("visibilitychange")); await wait(0);
  assert.equal(f.elements[0].paused, true); assert.equal(f.tracks[0].stops, 0);
  await mixer.dispose(); assert.equal(f.tracks[0].stops, 1);
});

test("credits and postcredits share one media output while preserving gains, cursors and owner handoff", async () => {
  const f = fixture(); f.context.state = "running";
  const music = f.doc.createElement(), ending = f.doc.createElement();
  music.currentTime = 100; ending.currentTime = 4;
  const first = createEndingAudioMix([music], { ...f.options, contextFactory: () => f.context, canPlay: () => true });
  first.setVolume(music, .12); await first.play(music);
  assert.equal(f.elements.length, 1); const sink = f.elements[0];
  assert.equal(endingAudioState(music).gain, .12);
  first.dispose(); assert.equal(sink.paused, true);
  const next = createEndingAudioMix([ending], { ...f.options, contextFactory: () => f.context, canPlay: () => true });
  next.setVolume(ending, .2); await next.play(ending);
  assert.equal(f.elements.length, 1); assert.equal(sink.paused, false);
  assert.equal(music.currentTime, 100); assert.equal(ending.currentTime, 4);
  assert.equal(endingAudioState(ending).gain, .2);
  next.dispose(); await wait(120);
  assert.equal(sink.paused, true); assert.equal(sink.srcObject, null); assert.equal(f.tracks[0].stops, 1);
});

test("same-task ending handoff cannot inherit the previous owner's cancelled output promise", async () => {
  const f = fixture(); f.context.state = "running";
  const music = f.doc.createElement(), ending = f.doc.createElement();
  const first = createEndingAudioMix([music], { ...f.options, contextFactory: () => f.context, canPlay: () => true });
  const cancelled = first.play(music).then(() => "played", error => error.name);
  first.dispose();
  const next = createEndingAudioMix([ending], { ...f.options, contextFactory: () => f.context, canPlay: () => true });
  next.setVolume(ending, .2); await next.play(ending);
  assert.equal(await cancelled, "AbortError");
  assert.equal(f.elements.length, 1); assert.equal(f.elements[0].plays, 2);
  assert.equal(f.elements[0].paused, false); assert.equal(f.tracks[0].stops, 0);
  assert.equal(endingAudioState(ending).gain, .2);
  next.dispose(); await wait(120); assert.equal(f.tracks[0].stops, 1);
});

test("title-style synchronous pageshow playback clears the output guard before its late listener", async () => {
  const f = fixture(); delete f.win.navigator.audioSession; f.context.state = "running";
  const music = f.doc.createElement();
  const mix = createEndingAudioMix([music], { ...f.options, contextFactory: () => f.context, canPlay: () => true });
  let showPlay;
  f.win.addEventListener("pageshow", () => { showPlay = mix.play(music); });
  mix.setVolume(music, .12); await mix.play(music);
  f.win.dispatchEvent(new Event("pagehide"));
  assert.equal(f.elements[0].paused, true);
  f.win.dispatchEvent(new Event("pageshow")); await showPlay;
  assert.equal(f.elements[0].paused, false); assert.equal(endingAudioState(music).gain, .12);
  mix.dispose(); await wait(120);
});

test("replacing a closed ending context releases its old media element and tracks", async () => {
  const f = fixture(), nextFixture = fixture(); f.context.state = "running"; nextFixture.context.state = "running";
  let created = 0;
  const music = f.doc.createElement(), ending = f.doc.createElement();
  const mix = createEndingAudioMix([music, ending], { ...f.options,
    contextFactory: () => ++created === 1 ? f.context : nextFixture.context, canPlay: () => true });
  await mix.play(music); await f.context.close();
  await mix.play(ending);
  assert.equal(f.elements[0].removed, true); assert.equal(f.elements[0].srcObject, null); assert.equal(f.tracks[0].stops, 1);
  assert.equal(f.elements.length, 2); assert.equal(f.elements[1].paused, false);
  mix.dispose(); await wait(120); assert.equal(nextFixture.tracks[0].stops, 1);
});
