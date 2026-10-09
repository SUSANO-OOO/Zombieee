import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../app/v100EventAudio.js', import.meta.url), 'utf8');
const ownerSource = source.slice(source.indexOf('export function createV100EventAudioOwner')).replace('export function', 'function');
const presentation = { eventId: 'v100:event:epilogue', nodeIndex: 0, sceneId: 'story-kumaya-daily', cueId: null };

function fixture() {
  const calls = { scene: 0, unlock: 0, play: 0 };
  let scene = { sceneId: null, bgmAssetId: null, ambienceAssetIds: [] };
  let diagnostics = { contextState: 'suspended', activeSceneVoices: 0, lifecycleHidden: false };
  const mixer = {
    unlocked: false,
    subscribeStatus: () => () => {}, attachUnlock: () => () => {},
    getSettings: () => ({ muted: false, sfxEnabled: true, masterVolume: .9, sfxVolume: .9 }),
    getAudioStatus: () => ({ state: mixer.unlocked ? 'running' : 'locked' }),
    getSceneState: () => ({ ...scene }), getDiagnostics: () => ({ ...diagnostics }),
    setScene: async () => { calls.scene++; return null; },
    setDialogueDucking: () => {}, stopInstance: () => {},
    unlock: async () => { calls.unlock++; return true; },
    play: async () => { calls.play++; return null; },
    stopScene: async () => { scene = { sceneId: null }; diagnostics.activeSceneVoices = 0; },
    dispose: async () => {},
  };
  const create = vm.runInNewContext(`(${ownerSource})`, { createAudioMixer: () => mixer, V100_AUDIO_MANIFEST: {}, now: () => 'fixture' });
  const target = { location: { hostname: 'localhost' }, addEventListener() {}, removeEventListener() {},
    document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} } };
  return { owner: create({ windowTarget: target }), calls, mixer,
    playing: (sceneId = presentation.sceneId, extra = {}) => {
      mixer.unlocked = true;
      scene = { sceneId, bgmAssetId: 'music-v100-score-daily', ambienceAssetIds: ['ambience-v070-kumaya-daily-loop'] };
      diagnostics = { contextState: 'running', activeSceneVoices: 2, lifecycleHidden: false, ...extra };
    } };
}

test('a pre-gesture scene reports its actual asynchronous start without another playback request', async () => {
  const f = fixture();
  await f.owner.present(presentation);
  assert.equal(f.owner.snapshot().active, null);
  assert.equal(f.owner.snapshot().receipts.at(-1).action, 'queued');
  // The mixer starts the already queued scene after unlock, outside present().
  f.playing();
  assert.deepEqual(f.owner.snapshot().active, presentation);
  await f.owner.present(presentation);
  await f.owner.activate(presentation);
  assert.deepEqual(f.calls, { scene: 1, unlock: 0, play: 0 });
});

test('queued, different, interrupted and hidden scenes cannot claim active event audio', async () => {
  const f = fixture();
  await f.owner.present(presentation);
  for (const [sceneId, diagnostics] of [
    ['other-scene', {}], [presentation.sceneId, { activeSceneVoices: 0 }],
    [presentation.sceneId, { contextState: 'suspended' }], [presentation.sceneId, { lifecycleHidden: true }],
  ]) {
    f.playing(sceneId, diagnostics);
    assert.equal(f.owner.snapshot().active, null);
  }
});

test('route stop and disposal cannot revive the last event from a late mixer snapshot', async () => {
  const f = fixture();
  await f.owner.present(presentation);
  f.playing();
  await f.owner.stop('route-transition');
  f.playing();
  assert.equal(f.owner.snapshot().active, null);
  assert.equal(f.owner.snapshot().desired, null);
  await f.owner.dispose();
  assert.equal(f.owner.snapshot().active, null);
  assert.equal(await f.owner.activate(presentation), false);
  assert.deepEqual(f.calls, { scene: 1, unlock: 0, play: 0 });
});

test('a queued scene switch cannot assign the old music to the new event', async () => {
  const f = fixture();
  await f.owner.present(presentation);
  const next = { ...presentation, eventId: 'v100:event:ending', sceneId: 'story-facility' };
  await f.owner.present(next);
  f.playing(presentation.sceneId);
  assert.equal(f.owner.snapshot().active, null);
  f.playing(next.sceneId);
  assert.deepEqual(f.owner.snapshot().active, next);
  const nextNode = { ...next, nodeIndex: 1 };
  await f.owner.present(nextNode);
  assert.deepEqual(f.owner.snapshot().active, nextNode);
  assert.deepEqual(f.calls, { scene: 3, unlock: 0, play: 0 });
});

test('disposal clears event ownership before its asynchronous scene stop settles', async () => {
  const f = fixture();
  await f.owner.present(presentation);
  f.playing();
  let finishStop;
  f.mixer.stopScene = () => new Promise(resolve => { finishStop = resolve; });
  const disposal = f.owner.dispose();
  assert.equal(f.owner.snapshot().desired, null);
  assert.equal(f.owner.snapshot().active, null);
  finishStop();
  await disposal;
  assert.equal(f.owner.snapshot().active, null);
});
