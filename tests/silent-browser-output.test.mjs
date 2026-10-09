import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { assertSilentQaHost, installSilentBrowserOutput, silenceBrowserOutput } from '../scripts/silent-browser-output.mjs';

function environment(locked = false) {
  const context = vm.createContext({ DOMException });
  vm.runInContext(`
    globalThis.nativeCalls = 0;
    globalThis.HTMLMediaElement = class {
      muted = false;
      play() { nativeCalls++; return Promise.resolve(); }
    };
    ${locked ? "Object.defineProperty(HTMLMediaElement.prototype, 'play', { writable: false });" : ''}
  `, context);
  return context;
}
const evaluate = (context, fn, argument) => vm.runInContext(`'use strict'; (${fn.toString()})(${JSON.stringify(argument) ?? 'undefined'})`, context);

test('the explicit-play guard rejects calls even when a caller unmutes media', async () => {
  const context = environment();
  evaluate(context, installSilentBrowserOutput, { blockNativePlayback: true });
  vm.runInContext('globalThis.media = new HTMLMediaElement()', context);
  for (let i = 0; i < 3; i++) {
    vm.runInContext('media.muted = false', context);
    await assert.rejects(vm.runInContext('media.play()', context), { name: 'NotSupportedError' });
  }
  assert.equal(vm.runInContext('nativeCalls', context), 0);
  assert.equal(vm.runInContext('__CODEX_SILENT_QA__.blockedNativePlays', context), 3);
  evaluate(context, installSilentBrowserOutput, { blockNativePlayback: true });
  assert.equal(vm.runInContext('HTMLMediaElement.prototype.play === __CODEX_SILENT_QA__.guard', context), true);
});

test('Windows game-browser QA is denied; hosted Linux/macOS remain available', () => {
  assert.throws(() => assertSilentQaHost('win32'), /Local Windows game-browser QA is disabled/);
  assert.doesNotThrow(() => assertSilentQaHost('linux'));
  assert.doesNotThrow(() => assertSilentQaHost('darwin'));
});

test('a page whose native play cannot be guarded is closed before game navigation', async () => {
  const context = environment(true);
  let closed = false;
  const page = {
    context: () => ({ browser: () => ({ browserType: () => ({ name: () => 'webkit' }) }), close: async () => { closed = true; } }),
    addInitScript: async () => {},
    evaluate: async (fn, argument) => evaluate(context, fn, argument),
  };
  await assert.rejects(silenceBrowserOutput(page));
  assert.equal(closed, true);
  assert.equal(vm.runInContext('nativeCalls', context), 0);
});
