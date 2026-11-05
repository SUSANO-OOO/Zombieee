import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync('app/AshfallGame.tsx', 'utf8');
const tree = ts.createSourceFile('AshfallGame.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const matches = [];
function visit(node) {
  if (ts.isPropertyAssignment(node) && node.name.getText(tree) === 'createLocalRecordingTap') matches.push(node.initializer);
  ts.forEachChild(node, visit);
}
visit(tree); assert.equal(matches.length, 1);
const code = ts.transpile(`(${matches[0].getText(tree)})`, { target: ts.ScriptTarget.ES2022 });
function setup({ local = true, state = 'running', limiter = true } = {}) {
  const calls = [], connections = new Set(); let failure = null;
  const track = { stop() { calls.push('stop'); } };
  const destination = { stream: { getTracks: () => [track] } };
  const sourceNode = {
    connect(to) { calls.push('connect'); connections.add(to); },
    disconnect(to) {
      calls.push('disconnect');
      if (failure) throw failure;
      if (!connections.delete(to)) throw Object.assign(Error('not connected'), { name: 'InvalidAccessError' });
    },
  };
  const mixer = { context: { state, createMediaStreamDestination: () => destination },
    limiter: limiter ? sourceNode : null, master: limiter ? { connect() { throw Error('wrong output'); } } : sourceNode };
  const create = vm.runInNewContext(code, { isLocalQa: local, mixer });
  return { create, calls, destination, connections, dispose() { connections.clear(); mixer.context = null; },
    fail(error) { failure = error; } };
}

test('local tap uses the final output and releases only its own connection once', () => {
  for (const limiter of [true, false]) {
    const s = setup({ limiter }); const unrelated = {}; s.connections.add(unrelated);
    const tap = s.create(); assert.equal(tap.stream, s.destination.stream);
    tap.release(); tap.release();
    assert.deepEqual(s.calls, ['connect', 'disconnect', 'stop']);
    assert.ok(s.connections.has(unrelated));
  }
});

test('releasing after battle mixer disposal stops the recording track without a second-disconnect failure', () => {
  const s = setup(), tap = s.create(); s.dispose();
  assert.doesNotThrow(() => tap.release()); tap.release();
  assert.deepEqual(s.calls, ['connect', 'disconnect', 'stop']);
});

test('unexpected cleanup errors remain failures while recording tracks still stop', () => {
  const s = setup(), tap = s.create(), failure = Object.assign(Error('unexpected audio error'), { name: 'InvalidStateError' });
  s.fail(failure); assert.throws(() => tap.release(), error => error === failure);
  assert.deepEqual(s.calls, ['connect', 'disconnect', 'stop']);
});

test('remote, absent, suspended and closed mixers cannot create a recording tap', () => {
  for (const options of [{ local: false }, { state: 'suspended' }, { state: 'closed' }]) {
    const s = setup(options); assert.throws(s.create, /running local game mixer/); assert.deepEqual(s.calls, []);
  }
  const s = setup(); s.dispose(); assert.throws(s.create, /running local game mixer/); assert.deepEqual(s.calls, []);
});
