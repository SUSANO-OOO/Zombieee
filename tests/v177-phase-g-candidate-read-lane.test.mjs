import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync('scripts/v100-phase-g-production-matrix.mjs', 'utf8');
const parsed = ts.createSourceFile('matrix.mjs', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const functions = ['phaseGPageInputState', 'withPhaseGPageInputLock'].map(name => (
  parsed.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name).getText(parsed)
));
const operations = [];
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(parsed) === 'candidateSample') {
    operations.push({ name: 'candidate ' + (operations.length + 1), expression: node.initializer.getText(parsed) });
  }
  if (ts.isCallExpression(node) && node.expression.getText(parsed) === 'accelerateBossEntry') {
    let statement = node;
    while (statement.parent && !ts.isExpressionStatement(statement)) statement = statement.parent;
    assert.ok(ts.isExpressionStatement(statement), 'use the actual sustain caller');
    operations.push({ name: 'boss entry ' + (operations.length + 1), expression: statement.expression.getText(parsed) });
  }
  if (ts.isCallExpression(node) && node.expression.getText(parsed) === 'withPhaseGPageInputLock'
    && node.arguments[1]?.getText(parsed) === 'accelerateBossEntry') {
    assert.ok(ts.isAwaitExpression(node.parent), 'use the actual owned sustain caller');
    operations.push({ name: 'boss entry ' + (operations.length + 1), expression: node.parent.getText(parsed) });
  }
  ts.forEachChild(node, visit);
}
visit(parsed);
assert.equal(operations.length, 4, 'exercise both candidate reads and both sustain entry paths');

function harness(operation, page, events) {
  return vm.runInNewContext(functions.join('\n') + '\n({ withPhaseGPageInputLock, read: async () => ('
    + operation.expression + ') })', {
    phaseGPageInputTails: new WeakMap(), page, slot: 1, deployment: 1,
    readBattleDeploymentDiagnostics: async (target, request) => {
      assert.equal(target, page);
      events.push('candidate-read');
      return request;
    },
    accelerateBossEntry: async () => { events.push('entry-read'); return 'entry-observed'; },
  });
}

for (const operation of operations) {
  test('actual ' + operation.name + ' waits until native input has finished', async () => {
    const events = [], page = {}, api = harness(operation, page, events);
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    const input = api.withPhaseGPageInputLock(page, async () => {
      events.push('input-start'); await pending; events.push('input-end');
    });
    await Promise.resolve(); await Promise.resolve();
    const reading = api.read();
    let result;
    try {
      await new Promise(resolve => setImmediate(resolve));
      assert.deepEqual(events, ['input-start'], 'a candidate/entry read cannot overlap pointer preflight or move/down/up');
    } finally {
      release();
      [, result] = await Promise.all([input, reading]);
    }
    assert.equal(events[1], 'input-end');
    assert.equal(events.length, 3, 'each caller issues one original read');
    if (operation.name.startsWith('candidate')) {
      assert.equal(result.requestedSlot, 2);
      assert.equal(result.phase, 'candidate-sample');
    } else assert.equal(result, 'entry-observed');
  });

  test('actual ' + operation.name + ' makes no page read after terminal input failure', async () => {
    const events = [], page = {}, api = harness(operation, page, events);
    const failure = Object.assign(new Error('original terminal pointer failure'), { phaseGTerminalInputFailure: true });
    await assert.rejects(api.withPhaseGPageInputLock(page, async () => { throw failure; }), error => error === failure);
    await assert.rejects(api.read(), error => error === failure);
    assert.deepEqual(events, [], 'terminal cancellation cannot be followed by unowned candidate/entry RPCs');
  });
}
