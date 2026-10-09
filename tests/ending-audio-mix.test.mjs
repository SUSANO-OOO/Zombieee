import test from "node:test";
import assert from "node:assert/strict";
import { createEndingAudioMix, endingAudioState } from "../app/endingAudioMix.js";

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
function contextFixture() {
  const nodes = [];
  const context = {
    state: "running", currentTime: 0, destination: {}, sources: 0, closes: 0,
    createGain() {
      const node = { gain: { value: 1, setValueAtTime(value) { this.value = value; } },
        output: null, connect(target) { this.output = target; }, disconnect() { this.output = null; } };
      nodes.push(node); return node;
    },
    createMediaElementSource(audio) {
      this.sources += 1;
      const node = { audio, output: null, connect(target) { this.output = target; }, disconnect() { this.output = null; } };
      nodes.push(node); return node;
    },
    async resume() { this.state = "running"; },
    async close() { this.state = "closed"; this.closes += 1; },
  };
  return { context, nodes };
}
function lockedMedia(play = async () => {}) {
  return { get volume() { return 1; }, set volume(_) {}, paused: true, playbackRate: 1,
    async play() { this.paused = false; await play(); }, pause() { this.paused = true; } };
}

test("a locked native volume still receives the exact mix and fade through the output gain", async () => {
  const fixture = contextFixture(), audio = lockedMedia();
  const mix = createEndingAudioMix([audio], { contextFactory: () => fixture.context });
  try {
    mix.setVolume(audio, .192); await mix.play(audio);
    assert.equal(audio.volume, 1);
    assert.equal(endingAudioState(audio).gain, .192);
    assert.equal(fixture.nodes[1].output, fixture.nodes[0]);
    assert.equal(fixture.nodes[0].output, fixture.context.destination);
    for (const level of [.144, .096, .048, 0]) {
      mix.setVolume(audio, level);
      assert.equal(endingAudioState(audio).gain, level);
      assert.equal(audio.volume, 1);
    }
    assert.equal(audio.playbackRate, 1);
  } finally { mix.dispose(); }
  assert.equal(audio.paused, true);
  assert.equal(fixture.nodes[0].output, null);
  assert.equal(fixture.nodes[1].output, null);
  await wait(120); assert.equal(fixture.context.closes, 1);
});

test("credits hand the unlocked context to the film and only the last owner closes it", async () => {
  const fixture = contextFixture(), credits = lockedMedia(), music = lockedMedia(), waves = lockedMedia();
  let creates = 0;
  const factory = () => { creates += 1; return fixture.context; };
  const roll = createEndingAudioMix([credits], { contextFactory: factory });
  roll.setVolume(credits, .192); await roll.play(credits); roll.dispose();
  const film = createEndingAudioMix([music, waves], { contextFactory: factory });
  try {
    film.setVolume(music, .76); film.setVolume(waves, .27);
    await Promise.all([film.play(music), film.play(waves)]);
    await wait(120);
    assert.equal(creates, 1); assert.equal(fixture.context.closes, 0);
    assert.equal(endingAudioState(music).gain, .76); assert.equal(endingAudioState(waves).gain, .27);
    film.setVolume(waves, 0); waves.pause();
    await film.play(music);
    assert.equal(fixture.context.sources, 3, "Replay must reuse each element's source");
    assert.equal(waves.paused, true); assert.equal(endingAudioState(waves).gain, 0);
  } finally { film.dispose(); }
  await wait(120); assert.equal(fixture.context.closes, 1);
});

test("a delayed native play cannot make disposed media audible", async () => {
  const fixture = contextFixture(); let resolve;
  const audio = lockedMedia(() => new Promise(done => { resolve = done; }));
  const mix = createEndingAudioMix([audio], { contextFactory: () => fixture.context });
  mix.setVolume(audio, .76);
  const play = mix.play(audio);
  mix.dispose(); resolve(); await play;
  assert.equal(audio.paused, true); assert.equal(endingAudioState(audio).gain, 0);
  assert.ok(fixture.nodes.every(node => !node.output));
  mix.setVolume(audio, 1); await mix.play(audio);
  assert.equal(audio.paused, true); assert.equal(endingAudioState(audio).gain, 0);
  await wait(120);
});

test("a desktop port without Web Audio retains native volume and fails closed if it is locked", async () => {
  assert.equal(globalThis.AudioContext, undefined); assert.equal(globalThis.webkitAudioContext, undefined);
  const native = { volume: 1, paused: true, async play() { this.paused = false; }, pause() { this.paused = true; } };
  const mix = createEndingAudioMix([native]);
  try {
    mix.setVolume(native, .192); await mix.play(native);
    assert.equal(native.paused, false); assert.equal(native.volume, .192);
    mix.setVolume(native, 0); assert.equal(native.volume, 0);
  } finally { mix.dispose(); }
  const locked = lockedMedia(), unavailable = createEndingAudioMix([locked]);
  try {
    unavailable.setVolume(locked, .192);
    await assert.rejects(unavailable.play(locked), /cannot be controlled/);
    assert.equal(locked.paused, true);
  } finally { unavailable.dispose(); }
  await wait(120);
});

test("effect re-setup on the same element cannot be paused by its old play promise", async () => {
  const fixture = contextFixture(); let release, calls = 0;
  const audio = lockedMedia(() => ++calls === 1 ? new Promise(resolve => { release = resolve; }) : Promise.resolve());
  const old = createEndingAudioMix([audio], { contextFactory: () => fixture.context });
  old.setVolume(audio, .192); const pending = old.play(audio); old.dispose();
  const current = createEndingAudioMix([audio], { contextFactory: () => fixture.context });
  try {
    current.setVolume(audio, .27); await current.play(audio);
    release(); await pending;
    assert.equal(audio.paused, false); assert.equal(endingAudioState(audio).gain, .27);
    assert.equal(fixture.context.sources, 1);
  } finally { current.dispose(); }
  await wait(120);
});
