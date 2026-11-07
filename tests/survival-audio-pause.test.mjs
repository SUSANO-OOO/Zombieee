import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { BATTLE_AUDIO_LOOP_CONTRACTS } from '../app/productionAudio.js';

const file = new URL('../app/AshfallGame.tsx', import.meta.url);
const source = ts.createSourceFile(file.pathname, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let resumeSource;
function findResume(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'resumeBattleAudioLoops') {
    assert.ok(ts.isCallExpression(node.initializer));
    resumeSource = node.initializer.arguments[0].getText(source);
  }
  ts.forEachChild(node, findResume);
}
findResume(source);
assert.ok(resumeSource, 'Exercise the real component callback');
const compiled = ts.transpileModule(`globalThis.resume = ${resumeSource};`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;

function fixture({ unlocked = true, burningIds = [] } = {}) {
  const requests = [];
  const stopped = [];
  const instances = new Set();
  const activeBurnLoopIdsRef = { current: new Set(burningIds) };
  const mixer = {
    unlocked,
    hasInstance: key => instances.has(key),
    stopInstance: key => { stopped.push(key); instances.delete(key); },
  };
  const context = vm.createContext({
    productionMixerRef: { current: mixer }, activeBurnLoopIdsRef,
    BATTLE_AUDIO_LOOP_CONTRACTS, W: 844,
    playProductionCue: (cueId, x, options) => {
      requests.push({ cueId, x, ...options });
      instances.add(options.instanceKey);
    },
  });
  vm.runInContext(compiled, context);
  const game = {
    paused: false, over: false,
    fighters: [{ id: 1, side: 'human', kind: 'crazy-king', hp: 100 }],
    corpses: [{ id: 12, x: 200, state: 'burning' }],
  };
  return { game, mixer, requests, stopped, instances, activeBurnLoopIdsRef, resume: context.resume };
}

for (const state of ['paused', 'over']) {
  test(`${state} battle cannot restart weapon or corpse loops through the component callback`, () => {
    const f = fixture({ burningIds: [5] });
    f.game[state] = true;
    f.resume(f.game);
    assert.equal(f.requests.length, 0);
    assert.deepEqual(f.stopped, [], 'The resume guard does not repeatedly cancel menu audio');
    assert.deepEqual([...f.activeBurnLoopIdsRef.current], [5]);
  });
}

test('active battle starts each owned loop once and keeps repeated frame calls idempotent', () => {
  const f = fixture();
  f.resume(f.game);
  f.resume(f.game);
  assert.deepEqual(f.requests.map(x => x.instanceKey), [
    BATTLE_AUDIO_LOOP_CONTRACTS.crazyKingChainsaw.instanceKey,
    `${BATTLE_AUDIO_LOOP_CONTRACTS.corpseBurn.instanceKey}:12`,
  ]);
  assert.deepEqual([...f.activeBurnLoopIdsRef.current], [12]);
});

test('locked active battle keeps desired burn ownership and starts loops after unlock', () => {
  const f = fixture({ unlocked: false, burningIds: [5] });
  f.resume(f.game);
  assert.equal(f.requests.length, 0);
  assert.deepEqual(f.stopped, [`${BATTLE_AUDIO_LOOP_CONTRACTS.corpseBurn.instanceKey}:5`]);
  assert.deepEqual([...f.activeBurnLoopIdsRef.current], [12]);
  f.mixer.unlocked = true;
  f.resume(f.game);
  assert.equal(f.requests.length, 2);
});
