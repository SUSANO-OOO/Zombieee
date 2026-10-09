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
