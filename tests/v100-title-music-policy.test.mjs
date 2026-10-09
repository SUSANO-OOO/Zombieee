import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import { enterV100FromTitle, seedV100BrowserSaveOnce } from '../scripts/v100-title-qa-entry.mjs';

// Exercise the production component's hooks without a browser or audio device.
async function titleFixture() {
  const source = await readFile(new URL('../app/V100TitleMusic.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const audio = { paused: true, dataset: {}, plays: 0, gain: 0, pause() { this.paused = true; } };
  const refs = [], dependencies = [], effects = [], cleanup = [];
  let cursor = 0, disposed = false;
  const surface = { addEventListener() {}, removeEventListener() {} };
  const react = {
    useRef(value) { const index = cursor++; return refs[index] ??= { current: index === 0 ? audio : value }; },
    useLayoutEffect(effect, deps) {
      const index = cursor++;
      if (!dependencies[index] || deps.some((value, n) => value !== dependencies[index][n])) effects.push(() => { cleanup[index]?.(); cleanup[index] = effect(); });
      dependencies[index] = deps;
    },
  };
  const componentModule = { exports: {} };
  vm.runInNewContext(code, { exports: componentModule.exports, module: componentModule,
    require(name) {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }) };
      if (name.endsWith('landscapePolicy.js')) return { LANDSCAPE_BLOCK_QUERY: 'portrait' };
      if (name.endsWith('endingAudioMix.js')) return { createEndingAudioMix: (_, options) => ({
        setVolume(_, gain) { audio.gain = gain; },
        needsRecovery: () => false,
        async play() { assert.equal(options.canPlay(), true); audio.plays++; audio.paused = false; },
        dispose() { disposed = true; },
      }) };
      throw new Error('Unexpected component dependency: ' + name);
    },
    document: { ...surface, hidden: false }, window: { ...surface, matchMedia: () => ({ ...surface, matches: false }) },
    requestAnimationFrame: () => 1, cancelAnimationFrame() {},
  });
  return { audio, get disposed() { return disposed; },
    async render(settings) {
      cursor = 0;
      const element = componentModule.exports.V100TitleMusic({ settings, voiceActive: false });
      while (effects.length) effects.shift()();
      await Promise.resolve();
      return element;
    },
    unmount() { for (const stop of cleanup) stop?.(); },
  };
}

test('disabled title BGM avoids preload and resumes through the same owner when enabled', async () => {
  const fixture = await titleFixture();
  const off = await fixture.render({ bgmEnabled: false, bgmVolume: .8 });
  assert.equal(off.props.preload, 'none'); assert.equal(fixture.audio.plays, 0);
  assert.equal(fixture.audio.paused, true); assert.equal(fixture.audio.gain, 0);
  const on = await fixture.render({ bgmEnabled: true, bgmVolume: .8 });
  assert.equal(on.props.preload, 'auto'); assert.equal(fixture.audio.plays, 1); assert.equal(fixture.audio.paused, false);
  const zero = await fixture.render({ bgmEnabled: true, bgmVolume: 0 });
  assert.equal(zero.props.preload, 'none'); assert.equal(fixture.audio.paused, true); assert.equal(fixture.audio.gain, 0);
  await fixture.render({ bgmEnabled: true, bgmVolume: .5 });
  assert.equal(fixture.audio.plays, 2);
  fixture.unmount(); assert.equal(fixture.disposed, true); assert.equal(fixture.audio.paused, true);
});

test('normal title entry uses the actual intro gesture without requiring full media prefetch', async () => {
  const calls = [];
  const page = {
    locator: selector => ({ waitFor: async () => calls.push(selector) }),
    waitForFunction: async () => calls.push('intro-ready'),
    getByRole: (_, { name }) => ({ isVisible: async () => true, isEnabled: async () => true, click: async () => calls.push(name) }),
  };
  await enterV100FromTitle(page);
  assert.ok(calls.indexOf('タップして開始') < calls.indexOf('続きから'));
  assert.equal(calls.filter(value => value === 'intro-ready').length, 1);
});

test('a repeated init script preserves imported progress, upgrades and receipts on reload', () => {
  const storage = new Map();
  const seed = vm.runInNewContext(`(${seedV100BrowserSaveOnce.toString()})`, {
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
  });
  const initial = JSON.stringify({ caps: 0, completedStageIds: [], receipts: [] });
  seed(initial); assert.equal(storage.size, 3);
  const imported = JSON.stringify({ caps: 30, completedStageIds: ['stage-01', 'stage-02'], unitLevels: { hachi: 2 }, receipts: ['native-result'] });
  for (const key of storage.keys()) storage.set(key, imported);
  seed(initial);
  assert.deepEqual([...storage.values()], [imported, imported, imported]);
});
