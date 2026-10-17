import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
import { load as loadYaml } from 'js-yaml';
import { invokeBrowserQaModule } from '../scripts/browser-qa-entry.mjs';
import { assertV177AuthoredLiveRender } from '../scripts/v177-continuous-render-contract.mjs';
import { V177_JOINT_ATLASES } from '../app/v177JointPresentation.js';
import {
  main, runBrowserQa, nativeGameCaptureBinding, NATIVE_GAME_CAPTURE_PHASES, NATIVE_GAME_CAPTURE_MIME,
  NATIVE_GAME_CAPTURE_SOURCES, captureNativeGameCase, readNativeGameCaptureSample,
  NATIVE_GAME_CAPTURE_FORMS, NATIVE_GAME_CAPTURE_VIEWPORTS, nativeGamePerformanceReceipt,
  withNativeGameCaseDeadline, closeNativeGameContext,
  startNativeGameRafObservation, stopNativeGameRafObservation,
} from '../scripts/v177-native-game-capture-browser.mjs';

const sha = 'a'.repeat(40);
const env = { GITHUB_ACTIONS: 'true', RUNNER_OS: 'macOS', GITHUB_EVENT_NAME: 'pull_request',
  GITHUB_EVENT_PATH: 'original-event.json', V177_EXPECTED_HEAD_SHA: sha };
const guard = { platform: 'darwin', env,
  read: async () => JSON.stringify({ number: 203, pull_request: { head: { sha } } }), head: () => sha };

test('host, original PR event and checkout binding fail before owned-server import', async () => {
  assert.equal((await nativeGameCaptureBinding(guard)).head, sha);
  for (const override of [{ platform: 'win32' }, { platform: 'linux' },
    { env: { ...env, GITHUB_ACTIONS: 'false' } }, { env: { ...env, RUNNER_OS: 'Linux' } },
    { env: { ...env, GITHUB_EVENT_NAME: 'workflow_dispatch' } }, { env: { ...env, V177_EXPECTED_HEAD_SHA: 'bad' } },
    { read: async () => JSON.stringify({ pull_request: { head: { sha: 'b'.repeat(40) } } }) },
    { head: () => 'b'.repeat(40) }]) {
    let loaded = false;
    await assert.rejects(main({ ...guard, ...override, argv: ['node', 'driver'], load: async () => { loaded = true; } }));
    assert.equal(loaded, false);
  }
});

// Execute the unchanged launcher's actual try/finally with inert dependencies.
// No production server, browser, game, audio device or video encoder is started.
const launcherSource = fs.readFileSync('scripts/run-browser-qa-with-server.mjs', 'utf8');
const launcherTree = ts.createSourceFile('launcher.mjs', launcherSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const launcherTry = launcherTree.statements.find(ts.isTryStatement).getText(launcherTree).replace(/\bimport\(/gu, 'loadModule(');
const executeLauncher = new Function('waitForServer', 'applyQaOrigin', 'invokeBrowserQaModule',
  'loadModule', 'pathToFileURL', 'path', 'target', 'server', 'once', 'setTimeout',
  'return (async()=>{' + launcherTry + '})();');

test('the root main path invokes its cached hook once, awaits it, and retains actual launcher cleanup', async () => {
  assert.equal(typeof runBrowserQa, 'function', 'The cached module must expose the actual launcher hook');
  for (const fail of [false, true]) {
    const argv = ['node', 'driver'], events = [], sentinel = new Error('Original capture failure');
    let calls = 0, release, settled = false;
    const pending = main({ ...guard, argv, load: async url => {
      assert.ok(url.endsWith('/run-browser-qa-with-server.mjs'));
      const server = { exitCode: null, kill() { events.push('kill'); this.exitCode = 0; } };
      await executeLauncher(async () => { events.push('ready'); return 'http://127.0.0.1:43123/'; },
        () => events.push('origin'), invokeBrowserQaModule,
        async target => {
          assert.equal(target, pathToFileURL(path.resolve('scripts/v177-native-game-capture-browser.mjs')).href);
          return { runBrowserQa: async () => { calls++; await new Promise(resolve => { release = resolve; });
            if (fail) throw sentinel; events.push('completed'); } };
        }, pathToFileURL, path, argv[2], server,
        async () => { events.push('exit'); }, callback => { callback(); return 0; });
    } }).finally(() => { settled = true; });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls, 1); assert.equal(settled, false); assert.equal(events.includes('kill'), false);
    release();
    if (fail) await assert.rejects(pending, error => error === sentinel); else await pending;
    assert.equal(calls, 1); assert.deepEqual(argv, ['node', 'driver']);
    assert.equal(events.filter(event => event === 'kill').length, 1);
    assert.equal(events.filter(event => event === 'exit').length, 1);
  }
});

test('the real local CLI rejects before imports or output creation and catches its deferred main failure', () => {
  if (process.platform === 'darwin') return;
  const run = spawnSync(process.execPath, ['scripts/v177-native-game-capture-browser.mjs'],
    { encoding: 'utf8', windowsHide: true, env: { ...process.env, ...env } });
  assert.equal(run.status, 1); assert.match(run.stderr, /hosted macOS\/GitHub Actions only/u);
});

const stats = { speed: 50, laneSpeed: 20, damage: 31, range: 70, attackEvery: 1.6, hp: 500, maxHp: 500 };
function fixture(phase, { form = 'abomination', failAt, cleanupFails = false, mutate } = {}) {
  const side = form === 'abomination' ? 'zombie' : 'human', sign = side === 'human' ? 1 : -1;
  const viewport = { width: 844, height: 340 };
  const proof = { fighterId: 8, targetId: 9, kind: form, side, renderKind: form,
    v100TwinPart: null, legacyFusedFixture: false, phase, originalActorStats: stats,
    ...(phase === 'engage' ? { engagement: { productionAttackReach: 120, approachDistance: 55 } } : {}) };
  const bytes = Buffer.from('transport-fixture-only-not-an-encoded-video');
  const events = [], sentinel = new Error('Original sampling failure');
  let index = 0;
  const sample = () => {
    const i = index++, active = phase === 'attack' || phase === 'engage' && i > 12;
    const sequence = active ? Math.floor(i / 5) : 0;
    const x = phase === 'attack' ? 620 : 620 + sign * Math.min(i, phase === 'engage' ? 12 : 30) * .8;
    const row = { at: i * 120, simulationTime: i * .12, running: true, paused: false, route: '/v100', visible: true,
      runtimePerformance: { simulationTicks: i * 7, renderFrames: i * 4, hiddenFrameCallbacks: 0,
        visibilityTransitions: 0, backgroundDurationMs: 0, droppedSimulationSeconds: i * .001,
        scheduledSimulationSteps: i * 7, rafRequests: i * 4 + 1, rafCancellations: 0 },
      geometry: { viewport, devicePixelRatio: 1, canvas: { width: 980, height: 520,
        rect: { x: 0, y: 0, width: 980, height: 520 } } },
      fighter: { id: 8, kind: form, side, renderKind: form, v100TwinPart: null,
        ...stats, x, y: 285, attackSequence: sequence },
      target: { id: 9, kind: side === 'human' ? 'walker' : 'guardian', side: side === 'human' ? 'zombie' : 'human', speed: 0, laneSpeed: 0, damage: 0,
        hp: 1_000_000 - sequence * 31, maxHp: 1_000_000 }, completedAttackImpacts: [],
      renders: [{ renderSequence: i + 1, renderKind: form, assetReady: true, x, y: 285,
        renderWidth: 150, renderHeight: 140, poseScaleX: 1, poseScaleY: 1,
        requestedState: active ? 'active' : 'move', actualXDelta: active ? 0 : sign * .8,
        jointAtlasPath: V177_JOINT_ATLASES[form].path, jointLowerFrame: i,
        jointUpperFrame: 120 + i, renderedWeaponSocket: { x: 600, y: 260 } }] };
    mutate?.(row); return row;
  };
  const page = { async waitForFunction(_fn, actual, options) { assert.equal(actual, proof); assert.equal(options.timeout, 5000); },
    async waitForTimeout(ms) { assert.equal(ms, 120); },
    async evaluate(fn, arg) {
      if (arg?.form === form && fn !== readNativeGameCaptureSample) return proof;
      if (fn === readNativeGameCaptureSample) { if (index === failAt) throw sentinel; return sample(); }
      events.push('paused');
    }, async evaluateHandle(fn) {
      assert.equal(fn, startNativeGameRafObservation);
      return { async evaluate(stop) { assert.equal(stop, stopNativeGameRafObservation);
        if (cleanupFails) throw new Error('Observer cleanup failure');
        return { timeOrigin: 1000, overflow: false, rows: [{ at: 0, renderSequence: 1, renderKind: form },
          { at: 10, renderSequence: 2, renderKind: form }] }; }, async dispose() { events.push('disposed'); } };
    } };
  const deps = { out: '/diagnostic-only', hasV177ContinuousDraw() {}, assertV177AuthoredLiveRender,
    read: async () => bytes, async beginV177NativeCanvasClip(actualPage, metadata, options) {
      assert.equal(actualPage, page); assert.equal(options.requestedMimeType, 'video/webm;codecs=vp8');
      assert.equal(options.engine, 'webkit'); assert.equal(metadata.form, form);
      assert.equal(metadata.fixtureGroup, phase === 'engage' ? 'approach-to-attack' : side === 'human' ? 'authored-form' : 'base-enemy');
      assert.ok(options.directory.includes('844x340'));
      return { async finish({ completed }) { events.push(completed ? 'completed-clip' : 'interrupted-clip');
        return { status: 'recorded', engine: 'webkit', requestedMimeType: NATIVE_GAME_CAPTURE_MIME, mimeType: 'video/webm; codecs=vp8',
          file: 'fixture-original.webm', bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
          width: 980, height: 520, timeOrigin: 1000, originalSpeedAccepted: false, encodedPtsVerified: false }; } };
    } };
  return { page, deps, events, sentinel, row: { form, phase, viewport, samples: [] } };
}

test('all three real-capture driver paths retain original stats, damage and existing continuous contracts', async () => {
  assert.deepEqual(NATIVE_GAME_CAPTURE_PHASES, ['move', 'attack', 'engage']);
  assert.deepEqual(NATIVE_GAME_CAPTURE_FORMS, ['medic', 'ranger', 'engineer', 'abomination']);
  assert.deepEqual(NATIVE_GAME_CAPTURE_VIEWPORTS, [{width:1280,height:720},{width:844,height:390},{width:844,height:340}]);
  for (const form of NATIVE_GAME_CAPTURE_FORMS) for (const phase of NATIVE_GAME_CAPTURE_PHASES) {
    const f = fixture(phase, { form }); await captureNativeGameCase(f.page, f.row, f.deps);
    assert.equal(f.row.status, 'observed-diagnostic');
    assert.equal(f.row.samples.length, phase === 'engage' ? 30 : 15);
    assert.equal(f.events.filter(e => e === 'completed-clip').length, 1);
    assert.ok(f.events.includes('paused') && f.events.includes('disposed'));
    assert.equal(f.row.nativeClip.originalSpeedAccepted, false);
    assert.ok(f.row.performanceReceipt.deltas.renderFrames > 0);
    if (phase !== 'move') assert.ok(f.row.damageReceipt.appliedDamage > 0);
    if (phase === 'engage') assert.deepEqual(f.row.summary.states, ['move', 'active']);
  }
});

test('missing draw, altered actor speed and zero damage cannot become successful game clips', async () => {
  for (const mutate of [row => { row.renders = []; }, row => { row.fighter.speed++; },
    row => { row.target.hp = 1_000_000; }]) {
    const f = fixture('attack', { mutate });
    await assert.rejects(captureNativeGameCase(f.page, f.row, f.deps));
    assert.notEqual(f.row.status, 'observed-diagnostic'); assert.ok(f.events.includes('paused'));
  }
  const late = fixture('attack'); late.row.deadlineExpired = true;
  await assert.rejects(captureNativeGameCase(late.page, late.row, late.deps), /late operation/);
  assert.notEqual(late.row.status, 'observed-diagnostic');
});

test('counter or viewport drift and a different encoded canvas cannot become complete diagnostics', async () => {
  const f = fixture('attack'); await captureNativeGameCase(f.page, f.row, f.deps);
  for (const mutate of [row => { row.samples.at(-1).runtimePerformance.renderFrames = -1; },
    row => { delete row.captureStart.runtimePerformance.droppedSimulationSeconds; },
    row => { row.captureStart.geometry.viewport = {width:1280,height:720}; },
    row => { row.nativeClip.width++; }]) {
    const row = structuredClone(f.row); mutate(row); assert.throws(() => nativeGamePerformanceReceipt(row));
  }
  assert.ok(Math.abs(f.row.performanceReceipt.simulationToNativeRatio - 1) < 2e-15);
  assert.equal(f.row.performanceReceipt.nativeObserverRafGapP95Ms, 10);
});

test('owned Node deadlines preserve timeout ownership, close once and handle late RPC rejection', async () => {
  let fire, rejectRpc, closed = 0, deadlineError, cancelled = 0;
  const pending = withNativeGameCaseDeadline(() => new Promise((_, reject) => { rejectRpc = reject; }), async () => {
    closed++; rejectRpc(new Error('TargetClosed after owner deadline')); throw new Error('close failure');
  }, { schedule(fn, ms) { assert.equal(ms, 30_000); fire = fn; return 1; }, cancel(id) { assert.equal(id, 1); cancelled++; },
    onDeadline(error) { deadlineError = error; } });
  await Promise.resolve(); fire();
  await assert.rejects(pending, error => error === deadlineError && /30s/.test(error.message)
    && /close failure/.test(error.contextCloseError) && error.operationSettledAtOwnerReturn === true);
  assert.equal(closed, 1); assert.equal(cancelled, 1);
  const original = new Error('original capture failure');
  await assert.rejects(withNativeGameCaseDeadline(async () => { throw original; }, () => assert.fail('No timeout close'),
    { schedule: () => 2, cancel: id => assert.equal(id, 2) }), error => error === original);
});

test('an unresponsive owned context close is bounded and cannot be reported as completed', async () => {
  let fire, cancelled = false;
  const pending = closeNativeGameContext({ close: () => new Promise(() => {}) }, null,
    { schedule(fn, ms) { assert.equal(ms, 5_000); fire = fn; return 3; }, cancel(id) { assert.equal(id, 3); cancelled = true; } });
  fire(); await assert.rejects(pending, /exceeded5s/); assert.equal(cancelled, true);
});

test('an original sampling failure survives capture and RAF cleanup errors without skipping cleanup', async () => {
  const f = fixture('attack', { failAt: 3, cleanupFails: true });
  await assert.rejects(captureNativeGameCase(f.page, f.row, f.deps), error => error === f.sentinel);
  assert.deepEqual(f.events, ['interrupted-clip', 'disposed', 'paused']);
  assert.match(f.row.cleanupErrors[0], /Observer cleanup failure/u);
  assert.equal(f.row.originalFailure, String(f.sentinel));
});

test('a sampling error is retained before stalled cleanup and remains primary when its deadline wins', async () => {
  const f = fixture('attack', {failAt:3}); const failures = [];
  let releaseFinish, fire, finishEntered;
  const entered = new Promise(resolve => { finishEntered = resolve; });
  const begin = f.deps.beginV177NativeCanvasClip;
  f.deps.onFailure = error => failures.push(error);
  f.deps.beginV177NativeCanvasClip = async (...args) => {
    const clip = await begin(...args);
    return {...clip, finish: () => { finishEntered(); return new Promise((_, reject) => { releaseFinish = reject; }); }};
  };
  const pending = withNativeGameCaseDeadline(() => captureNativeGameCase(f.page,f.row,f.deps), async () => {
    releaseFinish(new Error('TargetClosed after deadline'));
  }, {schedule(fn,ms){assert.equal(ms,30_000);fire=fn;return 1;},cancel(){},
    onDeadline(error){failures.push(error);}});
  await entered;
  assert.equal(f.row.originalFailure, String(f.sentinel)); assert.equal(failures[0], f.sentinel);
  fire(); await assert.rejects(pending, /30s owned/);
  assert.equal(failures[0], f.sentinel); assert.match(String(failures[1]), /30s owned/);
  assert.equal(f.row.samples.length, 2); assert.match(f.row.cleanupErrors[0], /TargetClosed/);
});

test('the native RAF observer records actual paint receipts without drawing or inventing encoded frames', () => {
  let now = 100, next = 0; const callbacks = new Map();
  const globals = { performance: { timeOrigin: 1000, now: () => now },
    requestAnimationFrame(fn) { callbacks.set(++next, fn); return next; }, cancelAnimationFrame(id) { callbacks.delete(id); },
    window: { __ASHFALL_BATTLE_QA__: { getEnemyFacingRuntimeAudit: () => ({ renderHistory: [{ renderSequence: next, renderKind: 'abomination' }] }) } } };
  Object.defineProperty(globals, 'AudioContext', { get: () => assert.fail('No audio device') });
  const start = vm.runInNewContext('(' + startNativeGameRafObservation.toString() + ')', globals);
  const stop = vm.runInNewContext('(' + stopNativeGameRafObservation.toString() + ')', globals);
  const state = start({ fighterId: 8 });
  for (const at of [117, 151]) { now = at; const [id, fn] = callbacks.entries().next().value; callbacks.delete(id); fn(); }
  const result = stop(state);
  assert.equal(result.rows.length, 2); assert.equal(result.encodedFrameCount, null); assert.equal(result.encodedPtsVerified, false);
  assert.equal(callbacks.size, 0);
});

test('actual sample reads keep the normal and Phase G snapshot APIs distinct', () => {
  let performanceReads = 0;
  const read = vm.runInNewContext('(' + readNativeGameCaptureSample.toString() + ')', {
    performance: { now: () => 123 }, location: { pathname: '/v100' }, document: { visibilityState: 'visible',
      querySelector: selector => { assert.equal(selector, '.game-shell canvas'); return {width:980,height:520,
        getBoundingClientRect: () => ({x:0,y:0,width:844,height:340})}; } },
    window: { innerWidth:844, innerHeight:340, devicePixelRatio:1, __ASHFALL_BATTLE_QA__: {
      getSnapshot: () => ({ time: 4, running: true, paused: false }),
      getPerformanceSnapshot: () => { performanceReads++; return {droppedSimulationSeconds:.2,renderFrames:14}; },
      getPhaseGCombatSnapshot: () => ({ completedAttackImpacts: [{ sourceId: 8, targetId: 9 }, { sourceId: 12, targetId: 9 }] }),
      getEnemyFacingRuntimeAudit: id => ({ fighter: { id }, renderHistory: [] }),
    } },
  });
  const sample = read({ fighterId: 8, targetId: 9 });
  assert.equal(sample.simulationTime, 4); assert.equal(sample.completedAttackImpacts.length, 1);
  assert.equal(sample.completedAttackImpacts[0].sourceId, 8);
  assert.equal(performanceReads, 0);
  const boundary = read({fighterId:8,targetId:9,performanceBoundary:true});
  assert.equal(performanceReads, 1); assert.equal(boundary.runtimePerformance.droppedSimulationSeconds, .2);
  assert.equal(boundary.geometry.viewport.width, 844); assert.equal(boundary.geometry.canvas.width, 980);
  assert.equal(boundary.at, 123); assert.equal(boundary.simulationTime, 4);
});

test('the actual runtime version assertion fails on a different binary before creating its context', () => {
  const source = fs.readFileSync('scripts/v177-native-game-capture-browser.mjs', 'utf8');
  const tree = ts.createSourceFile('capture.mjs', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const entry = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'runBrowserQa');
  let assertion;
  const visit = node => {
    if (ts.isExpressionStatement(node) && node.getText(tree).startsWith('assert.equal(report.browserVersion,')) assertion = node.getText(tree);
    ts.forEachChild(node, visit);
  };
  visit(entry); assert.ok(assertion);
  const check = new Function('assert', 'report', 'deps', assertion);
  check(assert, { browserVersion: '26.6' }, { PWA_WEBKIT_RUNTIME: { browserVersion: '26.6' } });
  assert.throws(() => check(assert, { browserVersion: '26.5' }, { PWA_WEBKIT_RUNTIME: { browserVersion: '26.6' } }));
  assert.ok(source.indexOf(assertion) < source.indexOf('context = await browser.newContext(contextOptions)'));
  assert.match(source, /canvasOnly: true, parallelPlaywrightRecordVideo: false/u);
  assert.match(source, /sameObservationLoadAsLegacyV102: false/u);
  assert.match(source, /codecOnlyCausalComparison: false/u);
});

test('actual runBrowserQa attempts both closes and preserves the primary failure when report writes fail', async () => {
  const source = fs.readFileSync('scripts/v177-native-game-capture-browser.mjs', 'utf8');
  const tree = ts.createSourceFile('capture.mjs', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const entry = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'runBrowserQa');
  for (const mode of ['primary-and-all-cleanup-writes', 'context-checkpoint-write', 'final-write']) {
    const primary = new Error('Original newPage failure'), storage = new Error('ENOSPC: report disk full');
    const closed = [], attemptedReports = [], summaries = [];
    let writes = 0;
    const control = { or() { return this; }, first() { return this; }, async waitFor() {},
      async isVisible() { return false; }, async click() {} };
    const page = { setDefaultTimeout() {}, on() {}, async addInitScript() {}, async goto() {},
      getByRole() { return control; }, locator() { return control; }, async waitForFunction() {}, async evaluate() {} };
    const browser = { on() {}, version: () => '26.6', async newContext(options) {
      assert.equal(options.deviceScaleFactor, 1);
      return { async newPage() { if (mode === 'primary-and-all-cleanup-writes') throw primary; return page; },
        async close() { closed.push('context'); } }; },
      async close() { closed.push('browser'); } };
    const deps = { PWA_WEBKIT_RUNTIME: { browserVersion: '26.6' },
      productionBuildIdentity: async () => ({ combinedSha256: 'b'.repeat(64) }),
      pwaBrowserType: async () => ({ launch: async () => browser }),
      installRequestFailureAudit: () => ({ report: { unexpectedFailures: [] }, closeContext: async c => c.close() }),
      createDefaultV100Save: () => ({}), V100_UNITS: [], V100_STAGE_IDS: ['stage01'],
      normalizeV100Save: value => value, serializeV100Save: JSON.stringify,
      seedV100BrowserSaveOnce() {}, async enterV100FromTitle() {} };
    // Execute the original driver function body with inert IO/browser bindings.
    // Only the resource and persistence paths are mocked; its finally is real.
    const execute = vm.runInNewContext('(' + entry.getText(tree).replace(/^export /u, '') + ')', {
      assert, path, URL, createHash, process: { env: { V100_CAMPAIGN_QA_BASE_URL: 'http://127.0.0.1:43123/' } },
      nativeGameCaptureBinding: async () => ({ head: sha }), dependencies: async () => deps,
      git: () => 'c'.repeat(40), acceptance: () => ({ originalSpeedAccepted: false }),
      NATIVE_GAME_CAPTURE_SOURCES: [], NATIVE_GAME_CAPTURE_PHASES, NATIVE_GAME_CAPTURE_FORMS, NATIVE_GAME_CAPTURE_VIEWPORTS,
      withNativeGameCaseDeadline, closeNativeGameContext,
      captureNativeIncomingStunCase:async (_page,row)=>{row.status='observed-diagnostic';},
      captureNativeTurnedGetupCase:async (_page,row)=>{row.status='observed-diagnostic';},
      startNativeGameRafObservation,stopNativeGameRafObservation,nativeGamePerformanceReceipt,NATIVE_GAME_CAPTURE_MIME,
      mkdir: async () => {}, captureNativeGameCase: async (_page, row) => { row.status = 'observed-diagnostic'; },
      writeFile: async (_file, data) => {
        writes++; attemptedReports.push(JSON.parse(data));
        const report = attemptedReports.at(-1);
        if (mode === 'primary-and-all-cleanup-writes' && writes > 1
          || mode === 'context-checkpoint-write' && report.contexts?.some(owner => owner.cleanup === 'pending')
          || mode === 'final-write' && report.status !== 'running-diagnostic' && report.browserCleanup === 'completed') throw storage;
      },
      console: { log: value => summaries.push(JSON.parse(value)) },
    });
    await assert.rejects(execute, error => error === (mode === 'primary-and-all-cleanup-writes' ? primary : storage));
    assert.deepEqual(closed, ['context', 'context', 'context', 'browser'], mode);
    assert.equal(summaries[0].status, 'failed');
    assert.ok(summaries[0].errors.some(error => error.includes('Report persistence failed: Error: ENOSPC')));
    if (mode === 'primary-and-all-cleanup-writes') assert.ok(summaries[0].errors.includes(String(primary)));
    const finalAttempt = attemptedReports.at(-1);
    assert.equal(finalAttempt.contextCleanup, 'completed'); assert.equal(finalAttempt.browserCleanup, 'completed');
    if (mode !== 'final-write') assert.ok(finalAttempt.persistenceErrors.length > 0);
  }
});

test('the dedicated workflow is path-scoped, read-only, exact-head, built, bounded and never cancels', () => {
  const text = fs.readFileSync('.github/workflows/native-game-capture.yml', 'utf8'), workflow = loadYaml(text);
  assert.deepEqual(workflow.on.pull_request.paths, ['.github/workflows/native-game-capture.yml',
    'scripts/v177-native-game-capture-browser.mjs', 'tests/v177-native-game-capture.test.mjs',
    'scripts/v177-native-incoming-stun.mjs','tests/v177-native-incoming-stun.test.mjs',
    'app/v177IncomingStunProof.js','scripts/v177-native-canvas-clips.mjs',
    'scripts/v177-native-turned-getup.mjs','tests/v177-native-turned-getup.test.mjs','tests/v177-native-canvas-clips.test.mjs',
    'app/v177TurnedGetupProof.js','app/v177TurnedGetupPresentation.js','app/v177TurnedGetupMotion.js',
    'app/v177TurnedGetupHandoff.js','app/v177TurnedGetupDeath.js','app/v177CorpseJointPresentation.js',
    'app/v177JointPresentation.js','tests/v177-settle-continuity.test.mjs','app/corpseVisuals.js','app/AshfallGame.tsx']);
  assert.deepEqual(workflow.permissions, { contents: 'read' }); assert.equal(workflow.concurrency['cancel-in-progress'], false);
  const job = workflow.jobs['native-game-capture']; assert.equal(job['runs-on'], 'macos-15-intel'); assert.equal(job['timeout-minutes'], 15);
  assert.equal(job.steps[0].with.ref, '${{ github.event.pull_request.head.sha }}'); assert.equal(job.steps[0].with['persist-credentials'], false);
  assert.ok(job.steps.some(s => s.run === 'npm run build' && s.env.GITHUB_PAGES_RELEASE_SHA === '${{ github.event.pull_request.head.sha }}'));
  const entry = job.steps.find(s => s.run === 'node scripts/v177-native-game-capture-browser.mjs');
  assert.equal(entry.env.V177_EXPECTED_HEAD_SHA, '${{ github.event.pull_request.head.sha }}');
  assert.doesNotMatch(text, /workflow_dispatch|pull_request_target|continue-on-error|deploy-pages/u);
  for (const source of NATIVE_GAME_CAPTURE_SOURCES) {
    assert.ok(fs.existsSync(source), source); assert.ok(('repo__' + source.replaceAll('/', '__')).startsWith('repo__'));
  }
});
