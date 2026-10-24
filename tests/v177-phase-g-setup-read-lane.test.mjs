import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync('scripts/v100-phase-g-production-matrix.mjs', 'utf8');
const parsed = ts.createSourceFile('matrix.mjs', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const declarations = ['phaseGPageInputState', 'withPhaseGPageInputLock', 'readPhaseGSustainState']
  .map(name => parsed.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name).getText(parsed));
const readerBindings = [];
let backgroundArguments, manualInput;
function visit(node) {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)
    && ['readSetupRuntime', 'readSetupRuntimeUnlocked', 'readProofActorContactState', 'bossIsLive', 'bossIsLiveUnlocked'].includes(node.name.text)) readerBindings.push('const ' + node.getText(parsed) + ';');
  if (ts.isCallExpression(node) && node.expression.getText(parsed) === 'readPhaseGSustainState') backgroundArguments = node.arguments[1].getText(parsed);
  if (ts.isCallExpression(node) && node.expression.getText(parsed) === 'withPhaseGPageInputLock'
    && node.arguments[1]?.getText(parsed).includes('manualActionEvidence.beforeInput')) manualInput = node.arguments[1].getText(parsed);
  ts.forEachChild(node, visit);
}
visit(parsed);
assert.ok(backgroundArguments && manualInput && readerBindings.length, 'exercise actual battle setup closures and their callers');

function harness(events = [], page = {}, runtime = { screen: 'battle', observation: 'original snapshot' }, bossKind = null) {
  const manualActionEvidence = {};
  const context = {
    phaseGPageInputTails: new WeakMap(), setupObservations: {}, Date, page, bossKind,
    proofActor: 'red-panther-knife', recorder: null,
    readPhaseGSetupRuntime: async () => { events.push('setup-read'); return runtime; },
    deriveV100RuntimeObservation: () => ({ supportActors: [], statusMarkers: [] }),
    withDeploymentPreinputDeadline: async (_, operation) => operation,
    DEPLOYMENT_POINTER_PREFLIGHT_DEADLINE_MS: 500,
    bossIsLive: async () => false,
    observeProofActorAttack: async value => { assert.ok(value, 'missing runtime must not reenter an owned observer'); assert.equal(value, runtime); },
    observeProofUnitAttack: async value => { assert.ok(value, 'missing runtime must not reenter an owned observer'); assert.equal(value, runtime); },
    observeVehicleAction: async value => { assert.ok(value, 'missing runtime must not reenter an owned observer'); assert.equal(value, runtime); },
    manualAbilityKind: 'guardian', manualActionEvidence,
    nativeBattleTap: async () => true,
    manualMarkerDispatchStarted: () => true,
  };
  const api = vm.runInNewContext([...declarations, ...readerBindings].join('\n') + `\n({
    withPhaseGPageInputLock, readSetupRuntime, contact: readProofActorContactState, boss: bossIsLive,
    background: page => readPhaseGSustainState(page, ${backgroundArguments}),
    manual: page => withPhaseGPageInputLock(page, ${manualInput})
  })`, context);
  return { ...api, runtime, manualActionEvidence };
}

test('actual foreground setup reads queue behind a native pointer transaction', async () => {
  const events = [], page = {}, api = harness(events, page);
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const input = api.withPhaseGPageInputLock(page, async () => { events.push('input-start'); await pending; events.push('input-end'); });
  await Promise.resolve(); await Promise.resolve();
  const reading = api.readSetupRuntime();
  try {
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(events, ['input-start'], 'state polling cannot issue an RPC during pointer move/down/up');
  } finally { release(); await Promise.all([input, reading]); }
  assert.deepEqual(events, ['input-start', 'input-end', 'setup-read']);
});

test('the real background observer reads once within its existing input ownership', async () => {
  const events = [];
  const page = { locator: () => ({ isVisible: async () => true }), evaluate: async () => 2 };
  const api = harness(events, page);
  const result = await Promise.race([api.background(page), new Promise(resolve => setImmediate(() => resolve(null)))]);
  assert.ok(result, 'an owned background read must not deadlock on its own input lane');
  assert.equal(result.setupRuntime, api.runtime);
  assert.deepEqual(events, ['setup-read']);
});

test('the real manual input keeps before and after reads inside one owned transaction', async () => {
  const events = [];
  const page = { locator: () => ({ first() { return this; }, count: async () => 1, getAttribute: async () => 'original-owner' }) };
  const api = harness(events, page);
  const result = await Promise.race([api.manual(page), new Promise(resolve => setImmediate(() => resolve(null)))]);
  assert.equal(result, true, 'before/after reads cannot enqueue behind their own manual input');
  assert.equal(api.manualActionEvidence.beforeInput, api.runtime);
  assert.equal(api.manualActionEvidence.afterInput, api.runtime);
  assert.equal(api.manualActionEvidence.ownerId, 'original-owner');
  assert.deepEqual(events, ['setup-read', 'setup-read']);
});

test('an absent background snapshot does not reenter a reader inside the owned input lane', async () => {
  const events = [];
  const page = { locator: () => ({ isVisible: async () => true }), evaluate: async () => 0 };
  const api = harness(events, page, null);
  assert.equal(await api.background(page), null);
  assert.deepEqual(events, ['setup-read']);
});

test('a terminal pointer failure rejects later setup reads without another page RPC', async () => {
  const events = [], page = {}, api = harness(events, page);
  const failure = Object.assign(new Error('owned input timeout'), { phaseGTerminalInputFailure: true });
  await assert.rejects(api.withPhaseGPageInputLock(page, async () => { throw failure; }), error => error === failure);
  await assert.rejects(api.readSetupRuntime(), error => error === failure);
  assert.deepEqual(events, []);
});

for (const reader of ['contact', 'boss']) test(`actual ${reader} state observation cannot overlap a native pointer transaction`, async () => {
  const events = [];
  const page = { evaluate: async () => { events.push(reader + '-read'); return { mounted: true }; } };
  const api = harness(events, page, undefined, 'gate-eater');
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const input = api.withPhaseGPageInputLock(page, async () => { events.push('input-start'); await pending; events.push('input-end'); });
  await Promise.resolve(); await Promise.resolve();
  const reading = api[reader]();
  try {
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(events, ['input-start']);
  } finally { release(); await Promise.all([input, reading]); }
  assert.deepEqual(events, ['input-start', 'input-end', reader + '-read']);
});
