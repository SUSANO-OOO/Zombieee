import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { CHARACTER_PORTRAIT_ART } from '../app/spriteManifest.js';

const source = fs.readFileSync('scripts/v100-card-resize-browser.mjs', 'utf8');
const parsed = ts.createSourceFile('card-resize.mjs', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const imageGeometry = parsed.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'imageGeometry');
assert.ok(imageGeometry);
const start = source.indexOf('  const decoded=await page.evaluate(');
const end = source.indexOf('  // Keep a native control before any resize.', start);
assert.ok(start > 0 && end > start);
const acquisition = source.slice(start, end);
const kinds = ['scout', 'brawler', 'kumaverson', 'babayaga'];

function fixture({ rejectDecode = false } = {}) {
  const decoded = new Set(), events = [], row = { geometry: {} };
  const failure = new Error('Original portrait DOM decode failed');
  let captures = 0, frames = 0;
  const page = {
    evaluate: async callback => callback(),
    locator(selector) {
      const kind = /data-kind="([^"]+)"/u.exec(selector)?.[1];assert.ok(kinds.includes(kind));
      const card = { dataset: { kind, state: 'ready' }, querySelectorAll: () => [],
        getBoundingClientRect: () => ({ left: 0, top: 0, right: 80, bottom: 70, x: 0, y: 0, width: 80, height: 70 }) };
      const image = { complete: true, naturalWidth: 128, naturalHeight: 128, parentElement: {}, closest: () => card,
        getAttribute: () => CHARACTER_PORTRAIT_ART[kind],
        getBoundingClientRect: () => ({ left: 0, top: 0, right: 40, bottom: 60, x: 0, y: 0, width: 40, height: 60 }),
        async decode() { events.push('decode-' + kind);await Promise.resolve();if (rejectDecode) throw failure;decoded.add(kind); } };
      return { evaluate: callback => callback(image) };
    },
  };
  const bindings = {
    page, row, kinds, browserName: 'webkit', assert, URL, base: new URL('http://127.0.0.1/'), CHARACTER_PORTRAIT_ART,
    window: { __ASHFALL_ASSET_QA__: { getDecodedRequiredPaths: () => kinds.map(kind => CHARACTER_PORTRAIT_ART[kind]) } },
    getComputedStyle: () => ({ opacity: '1', imageRendering: 'optimizeQuality' }), CSS: { supports: () => true },
    requestAnimationFrame(callback) { frames++;callback(); },
    async capture(_page, _row, name) {
      captures++;events.push('capture-' + name);
      assert.equal(decoded.size, kinds.length, 'the first native PNG must wait for every actual DOM portrait decode');
      assert.ok(frames >= 2, 'decoded portraits must receive the existing two-frame paint boundary before sampling');
      return Buffer.from('native baseline probe');
    },
    cropPortrait: async bytes => bytes,
  };
  return { run: () => vm.runInNewContext(imageGeometry.getText(parsed) + '\n(async()=>{\n' + acquisition + '\nreturn baseline;})()', bindings),
    events, row, failure, captures: () => captures };
}

test('the actual first native portrait sample follows all DOM decodes and a paint boundary', async () => {
  const f = fixture(), baseline = await f.run();
  assert.equal(f.captures(), 1);assert.equal(baseline.size, 4);
  assert.deepEqual(f.events, [...kinds.map(kind => 'decode-' + kind), 'capture-before']);
  for (const kind of kinds) assert.equal(f.row.geometry[kind].src, CHARACTER_PORTRAIT_ART[kind]);
});

test('a rejected original DOM portrait decode cannot produce a baseline screenshot', async () => {
  const f = fixture({ rejectDecode: true });
  await assert.rejects(f.run(), error => error === f.failure);
  assert.equal(f.captures(), 0);
});

test('the actual no-resize control rejects unstable initial paint at the unchanged one-percent gate', () => {
  const gates = [];
  function visit(node) {
    if (ts.isExpressionStatement(node) && node.getText(parsed).includes('initial native portrait baseline is unstable')) gates.push(node);
    ts.forEachChild(node, visit);
  }
  visit(parsed);assert.equal(gates.length, 1, 'an unstable initial sample must not be mislabeled as a resize regression');
  const run = fraction => vm.runInNewContext(gates[0].getText(parsed), { assert, browserName: 'webkit',
    row: { noResizeControl: kinds.map(kind => ({ kind, comparison: { fraction } })) } });
  run(.01);assert.throws(() => run(.010001), /initial native portrait baseline is unstable/u);
});
