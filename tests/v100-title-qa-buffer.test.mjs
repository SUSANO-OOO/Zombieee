import test from 'node:test';
import assert from 'node:assert/strict';
import { enterV100FromBufferedTitle, v100TitleMusicIsBuffered } from '../scripts/v100-title-qa-entry.mjs';

const fixture = () => ({ intro: 'complete', error: null, duration: 58.2, networkState: 1, readyState: 4, ranges: [[0, 58.2]] });

test('title buffering accepts complete contiguous native media after the intro', () => {
  assert.equal(v100TitleMusicIsBuffered(fixture()), true);
  assert.equal(v100TitleMusicIsBuffered({ ...fixture(), ranges: [[0, 20], [20, 58.2]] }), true);
});

for (const [name, change] of [
  ['pre-gesture state', { intro: 'waiting' }],
  ['partial data', { readyState: 2 }],
  ['loading request', { networkState: 2 }],
  ['decode error', { error: { code: 3 } }],
  ['unknown duration', { duration: NaN }],
  ['infinite stream', { duration: Infinity }],
  ['empty duration', { duration: 0 }],
  ['no ranges', { ranges: [] }],
  ['partial range', { ranges: [[0, 58.1]] }],
  ['missing beginning', { ranges: [[1, 58.2]] }],
  ['range gap', { ranges: [[0, 20], [20.01, 58.2]] }],
  ['invalid range', { ranges: [[0, Infinity]] }],
]) test(name + ' cannot dismiss the title owner', () => {
  assert.equal(v100TitleMusicIsBuffered({ ...fixture(), ...change }), false);
});

function fakePage({ fail = false } = {}) {
  const calls = [];
  const page = {
    locator: selector => ({ waitFor: async () => { calls.push(selector.includes('complete') ? 'intro-complete' : 'visible'); } }),
    waitForFunction: async predicate => {
      if (predicate === v100TitleMusicIsBuffered) { calls.push('buffer'); if (fail) throw new Error('native buffer timeout'); }
    },
    getByRole: (_, { name }) => ({ isVisible: async () => true, isEnabled: async () => true, click: async () => { calls.push(name); } }),
    evaluate: async () => ({ intro: 'complete', media: { networkState: 2, ranges: [[0, 7]] } }),
  };
  return { page, calls };
}

test('stable entry waits for native buffering after the real intro gesture and before Continue', async () => {
  const { page, calls } = fakePage();
  await enterV100FromBufferedTitle(page);
  assert.ok(calls.indexOf('タップして開始') < calls.indexOf('buffer'));
  assert.ok(calls.indexOf('intro-complete') < calls.indexOf('buffer'));
  assert.ok(calls.indexOf('buffer') < calls.indexOf('続きから'));
});

test('timeout preserves native state and leaves Continue untouched', async () => {
  const { page, calls } = fakePage({ fail: true });
  await assert.rejects(enterV100FromBufferedTitle(page), /networkState.*2.*ranges.*0,7/);
  assert.equal(calls.includes('続きから'), false);
});
