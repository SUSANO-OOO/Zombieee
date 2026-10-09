import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyEntryNativePreload } from '../scripts/pwa-entry-native-preload.mjs';

const phase = 'candidate-entry';
const browser = { diagnosticPhase: phase };
const server = { diagnosticPhase: phase, method: 'GET', secFetchMode: 'no-cors' };
const check = (cached, browserRequests = [browser], serverRequests = []) => verifyEntryNativePreload({ browserRequests, serverRequests, cacheByPhase: { [phase]: new Set(cached ? ['title-hash'] : []) }, hash: 'title-hash' });

test('a missing unchanged voice can preload once before update planning', () => {
  assert.equal(check(false, [browser], [server]).valid, true);
  assert.equal(check(false, [browser], [server, server]).valid, false);
  assert.equal(check(false, [], [server]).valid, false);
});

test('an already cached voice cannot fetch again on a native preload', () => {
  assert.equal(check(true).valid, true);
  assert.equal(check(true, [browser], [server]).valid, false);
  assert.equal(check(true, [browser, browser]).valid, false);
});

test('a later entry uses its own earlier cache snapshot', () => {
  const nextBrowser = { diagnosticPhase: 'recovery-entry' };
  const input = { browserRequests: [browser, nextBrowser], serverRequests: [server],
    cacheByPhase: { [phase]: new Set(), 'recovery-entry': new Set(['title-hash']) }, hash: 'title-hash' };
  assert.equal(verifyEntryNativePreload(input).valid, true);
  assert.equal(verifyEntryNativePreload({ ...input, serverRequests: [server, { ...server, diagnosticPhase: 'recovery-entry' }] }).valid, false);
  assert.equal(verifyEntryNativePreload({ ...input, cacheByPhase: { [phase]: new Set() } }).valid, false);
});
