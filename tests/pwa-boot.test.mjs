import test from 'node:test';
import assert from 'node:assert/strict';
import { readPwaBootState } from '../app/pwaBoot.js';

test('cache inventory failure stays an explicit failure and a later attempt retains the committed manifest', async () => {
  const registration = { scope: '/Zombieee/' }, state = { type: 'pwa:state', active: { version: 'existing', assets: [{ hash: 'preserved' }] } };
  const base = { register: async () => registration, readState: async () => state };
  await assert.rejects(readPwaBootState({ ...base, readHashes: async () => { throw new Error('cache-read-failed'); } }), /cache-read-failed/u);
  const hashes = new Set(['preserved']);
  const retried = await readPwaBootState({ ...base, readHashes: async () => hashes });
  assert.equal(retried.state, state); assert.equal(retried.hashes, hashes);
  assert.equal(state.active.version, 'existing');
});

test('registration, worker state and cache inventory cannot wait without a deadline', async () => {
  const never = () => new Promise(() => {});
  for (const stalled of ['register', 'readState', 'readHashes']) {
    const options = { register: async () => ({}), readState: async () => ({ type: 'pwa:state' }), readHashes: async () => new Set(), timeoutMs: 15, [stalled]: never };
    const at = Date.now(); await assert.rejects(readPwaBootState(options), /pwa-boot-timeout/u);
    assert.ok(Date.now() - at < 1000);
  }
});

test('failed registration can fall back to online play without pretending a pack was read', async () => {
  const result = await readPwaBootState({ register: async () => null, readState: () => { throw Error('must not read'); }, readHashes: () => { throw Error('must not read'); } });
  assert.deepEqual(result, { registration: null });
});

test('a response arriving after timeout cannot publish a late cache state', async () => {
  let release;
  const late = new Promise(resolve => { release = resolve; });
  let published = false;
  await assert.rejects(readPwaBootState({ register: async () => ({}), readState: async () => ({ type: 'pwa:state' }), readHashes: () => late, timeoutMs: 15 }).then(() => { published = true; }), /pwa-boot-timeout/u);
  release(new Set(['late'])); await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(published, false);
});

test('worker inventory lets an installed pack start with one cache read', async () => {
  const hash = 'sha256-' + 'a'.repeat(64);
  const state = { type: 'pwa:state', active: { assets: [{ hash }] }, storedHashes: [hash] };
  const result = await readPwaBootState({
    register: async () => ({ scope: '/Zombieee/' }),
    readState: async () => state,
    readHashes: () => { throw new Error('duplicate cache read'); },
  });
  assert.equal(result.state, state);
  assert.deepEqual(result.hashes, new Set([hash]));
});

test('an empty inventory is honored and a malformed one uses the local read', async () => {
  const hash = 'sha256-' + 'b'.repeat(64);
  const boot = storedHashes => readPwaBootState({
    register: async () => ({}),
    readState: async () => ({ type: 'pwa:state', storedHashes }),
    readHashes: async () => new Set([hash]),
  });
  assert.deepEqual((await boot([])).hashes, new Set());
  assert.deepEqual((await boot([hash, null])).hashes, new Set([hash]));
});

test('an installed worker can recover from its first missing state reply', async () => {
  let calls = 0;
  const active = { assets: [{ hash: 'present' }] };
  const result = await readPwaBootState({
    register: async () => ({ active: {} }),
    readState: async () => ++calls === 1 ? null : { type: 'pwa:state', active },
    readHashes: async () => new Set(['present']),
  });
  assert.equal(calls, 2);
  assert.equal(result.state.active, active);
  assert.deepEqual(result.hashes, new Set(['present']));
});

test('the local state check gives an active worker one recheck within the existing deadline', async () => {
  let calls = 0;
  await assert.rejects(readPwaBootState({
    register: async () => ({ active: {} }),
    readState: async () => { calls++; return { type: 'pwa:error' }; },
    readHashes: () => { throw new Error('inventory must not read after failure'); },
  }), /worker-state-unavailable/u);
  assert.equal(calls, 2);
  calls = 0;
  let settle;
  const late = new Promise(resolve => { settle = resolve; });
  await assert.rejects(readPwaBootState({
    register: async () => ({ active: {} }),
    readState: async () => { calls++; return late; },
    readHashes: () => { throw new Error('late inventory'); },
    timeoutMs: 15,
  }), /pwa-boot-timeout/u);
  settle(null);
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(calls, 1);
});
