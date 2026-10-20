import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {captureNativeIncomingStunCase} from './v177-native-incoming-stun.mjs';
import {captureNativeTurnedGetupCase} from './v177-native-turned-getup.mjs';
import {createNativeAllUnitRealmOwner, readNativeAllUnitRealmOwner,
  assertNativeCaptureRealm} from './v177-native-capture-realm.mjs';

export const NATIVE_GAME_CAPTURE_PHASES = Object.freeze(['move', 'attack', 'engage']);
export const NATIVE_GAME_CAPTURE_FORMS = Object.freeze(['medic', 'ranger', 'engineer', 'abomination']);
export const NATIVE_GAME_CAPTURE_VIEWPORTS = Object.freeze([
  Object.freeze({ width: 1280, height: 720 }), Object.freeze({ width: 844, height: 390 }),
  Object.freeze({ width: 844, height: 340 }),
]);
export const NATIVE_GAME_CAPTURE_MIME = 'video/webm;codecs=vp8';
export const NATIVE_GAME_CAPTURE_SOURCES = Object.freeze([
  '.github/workflows/native-game-capture.yml', 'scripts/v177-native-game-capture-browser.mjs',
  'tests/v177-native-game-capture.test.mjs', 'scripts/run-browser-qa-with-server.mjs',
  'scripts/browser-qa-entry.mjs', 'scripts/browser-qa-build-identity.mjs',
  'scripts/pwa-browser-runtime.mjs', 'scripts/pwa-native-runtime/package.json',
  'scripts/pwa-native-runtime/package-lock.json', 'scripts/v177-native-canvas-clips.mjs',
  'scripts/v177-continuous-draw-readiness.mjs', 'scripts/v177-continuous-render-contract.mjs',
  'scripts/v177-enemy-live-render-contract.mjs', 'scripts/v100-title-qa-entry.mjs',
  'app/v177ContinuousProof.js', 'app/v177JointPresentation.js', 'app/v177EnemyJointData.js',
  'app/v177PaintLocomotion.js',
  'tests/v177-settle-continuity.test.mjs',
  'app/combatPresentation.js', 'app/v102CombatMotion.js', 'app/AshfallGame.tsx',
  'app/v177JointData.js', 'app/v177FirearmJointData.js', 'app/v177RangerUpperMotion.js',
  'app/v177RangerLowerMotion.js','app/v177RangerLowerPaint.js','tests/v177-ranger-continuous-lower.test.mjs',
  'app/v177LivingStun.js', 'public/asset-manifest.json',
  'public/art/v100/joints/ranger-r3.webp', 'public/art/v100/joints/medic-r1.webp',
  'public/art/v100/joints/engineer-r1.webp', 'public/art/v100/joints/crusher-r1.webp',
  'scripts/v177-native-incoming-stun.mjs','tests/v177-native-incoming-stun.test.mjs',
  'app/v177IncomingStunProof.js','app/v090Infected.js','app/v177InfectedJointData.js',
  'app/content/enemyCatalog.js','app/content/unitCatalog.js','public/art/v100/joints/spindle-r1.webp',
  'app/v177JointActorHistory.js','app/v177WalkerFloorData.js','app/v177TurnedGetupMotion.js',
  'app/v177TurnedGetupPresentation.js','app/v177TurnedGetupHandoff.js','tests/v177-turned-getup.test.mjs',
  'public/art/v100/joints/walker-r1.webp',
  'app/v177TurnedGetupDeath.js','app/v177CorpseJointPresentation.js',
  'app/v177TurnedGetupProof.js','scripts/v177-native-turned-getup.mjs','tests/v177-native-turned-getup.test.mjs',
  'app/combatLifecycle.js','app/corpseVisuals.js','tests/v177-native-canvas-clips.test.mjs','app/v102CorpsePose.js','app/v102CorpsePoseData.js',
  'public/art/v100/joints/brawler-r1.webp','public/art/v100/characters/paisen-photo-battle-v177.png',
  'scripts/v177-native-capture-realm.mjs', 'scripts/v177-native-allunit-contract.mjs',
  'scripts/v177-native-allunit-manifest.mjs', 'tests/v177-native-capture-realm.test.mjs',
  'tests/helpers/v177-native-capture-realm-fixture.mjs',
]);
const acceptance = () => ({ originalSpeedAccepted: false, encodedPtsVerified: false,
  naturalnessAccepted: false, physicalIphoneRecordingAccepted: false,
  wholeGameAccepted: false, productionCodecChanged: false });
const git = args => execFileSync('git', args, { encoding: 'utf8' }).trim();

export function nativeGameCapturePlan(scope='full'){
  assert.ok(['full','state-supplements'].includes(scope),'Unknown native capture scope');
  return [
    ...(scope==='full'?NATIVE_GAME_CAPTURE_FORMS.flatMap(form=>NATIVE_GAME_CAPTURE_PHASES.map(phase=>({form,phase}))):[]),
    ...[0,1].map(variant=>({form:'turned',phase:'turned-getup',variant})),
    {form:'ranger',phase:'incoming-stun'},
  ];
}

export function assertNativeGameCaptureHost(platform, env) {
  assert.ok(platform === 'darwin' && env.GITHUB_ACTIONS === 'true' && env.RUNNER_OS === 'macOS',
    'Native game capture is hosted macOS/GitHub Actions only; local game/browser/audio launch is prohibited');
}
export async function nativeGameCaptureBinding({ platform = process.platform, env = process.env,
  read = readFile, head = () => git(['rev-parse', 'HEAD']) } = {}) {
  assertNativeGameCaptureHost(platform, env);
  assert.ok(['pull_request','workflow_dispatch'].includes(env.GITHUB_EVENT_NAME), 'Native game capture requires a candidate diagnostic event');
  assert.match(env.V177_EXPECTED_HEAD_SHA ?? '', /^[a-f0-9]{40}$/u, 'An exact expected PR head is required');
  assert.ok(env.GITHUB_EVENT_PATH, 'The original PR event is required');
  const event = JSON.parse(await read(env.GITHUB_EVENT_PATH, 'utf8'));
  const eventHead=env.GITHUB_EVENT_NAME==='pull_request'?event.pull_request?.head?.sha:event.inputs?.expected_head;
  assert.equal(eventHead, env.V177_EXPECTED_HEAD_SHA, 'Expected head must match the original event');
  const actualHead = await head();
  assert.equal(actualHead, env.V177_EXPECTED_HEAD_SHA, 'Checkout must be the exact PR head');
  return { head: actualHead, pullRequest: env.GITHUB_EVENT_NAME==='pull_request'?event.number:null, platform, runnerOS: env.RUNNER_OS };
}

// Deferring the direct CLI entry until module evaluation completes lets the
// unchanged owned-server launcher import this cached module and await its hook.
export async function main({ load = url => import(url), argv = process.argv, ...guard } = {}) {
  await nativeGameCaptureBinding(guard);
  const originalTarget = argv[2], originalLength = argv.length;
  argv[2] = fileURLToPath(import.meta.url);
  try { await load(new URL('./run-browser-qa-with-server.mjs', import.meta.url).href); }
  finally { if (originalLength < 3) argv.length = originalLength; else argv[2] = originalTarget; }
}

// Observe native RAF callbacks and the game's last actual draw receipt. This
// never paints, copies a canvas, replaces RAF, or supplies encoded timestamps.
export function startNativeGameRafObservation({ fighterId, realmOwner = null }) {
  const state = { timeOrigin: performance.timeOrigin, startedAt: performance.now(),
    fighterId, rows: [], overflow: false, stopped: false, raf: null };
  if(realmOwner!==null){
    state.realmOwner=realmOwner;state.realmCanvas=document.querySelector('.game-shell canvas');
    state.realmStarted=realmOwner.member({window,document,performance,canvas:state.realmCanvas},'raf-start');
    state.realmFailure=null;
  }
  const observe = () => {
    if (state.stopped) return;
    if(state.realmOwner)try{state.realmOwner.check({window,document,performance,canvas:document.querySelector('.game-shell canvas')});}
    catch(error){state.realmFailure??=String(error);state.stopped=true;return;}
    const qa = window.__ASHFALL_BATTLE_QA__;
    const draw = qa.getEnemyFacingRuntimeAudit(fighterId, {latestDrawOnly:true}).renderHistory.at(-1);
    if (state.rows.length < 4096) state.rows.push({ at: performance.now(),
      renderSequence: draw?.renderSequence ?? null, renderKind: draw?.renderKind ?? null });
    else state.overflow = true;
    state.raf = requestAnimationFrame(observe);
  };
  state.raf = requestAnimationFrame(observe);
  return state;
}
export function stopNativeGameRafObservation(state) {
  state.stopped = true; state.stoppedAt = performance.now(); cancelAnimationFrame(state.raf);
  let realm;
  if(state.realmOwner){
    let stopped=null;
    try{stopped=state.realmOwner.member({window,document,performance,canvas:document.querySelector('.game-shell canvas')},'raf-stop');}
    catch(error){state.realmFailure??=String(error);}
    realm={started:state.realmStarted,stopped,failure:state.realmFailure};
  }
  return { timeOrigin: state.timeOrigin, startedAt: state.startedAt, stoppedAt: state.stoppedAt,...(realm?{realm}:{}),
    rows: state.rows, overflow: state.overflow, encodedFrameCount: null, encodedPtsVerified: false,
    scope: 'Native observer RAF callbacks and actual game render receipts; neither is an encoded-frame count' };
}
export function readNativeGameCaptureSample({ fighterId, targetId, performanceBoundary = false }) {
  const qa = window.__ASHFALL_BATTLE_QA__, snapshot = qa.getSnapshot();
  const audit = qa.getEnemyFacingRuntimeAudit(fighterId);
  const boundary = performanceBoundary ? (() => {
    const canvas = document.querySelector('.game-shell canvas'), rect = canvas.getBoundingClientRect();
    return { runtimePerformance: qa.getPerformanceSnapshot(),
      geometry: { viewport: { width: window.innerWidth, height: window.innerHeight },
        devicePixelRatio: window.devicePixelRatio, canvas: { width: canvas.width, height: canvas.height,
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } } } };
  })() : {};
  return { at: performance.now(), simulationTime: snapshot.time, running: snapshot.running, ...boundary,
    paused: snapshot.paused, route: location.pathname, visible: document.visibilityState === 'visible',
    fighter: audit.fighter, target: qa.getEnemyFacingRuntimeAudit(targetId).fighter,
    completedAttackImpacts: qa.getPhaseGCombatSnapshot().completedAttackImpacts
      .filter(row => row.sourceId === fighterId && row.targetId === targetId),
    renders: audit.renderHistory.map(r => ({ renderSequence: r.renderSequence, renderKind: r.renderKind,
      assetReady: r.assetReady, x: r.x, y: r.y, renderWidth: r.renderWidth, renderHeight: r.renderHeight,
      poseScaleX: r.poseScaleX, poseScaleY: r.poseScaleY, requestedState: r.requestedState,
      actualXDelta: r.actualXDelta, jointAtlasPath: r.jointAtlasPath, jointLowerFrame: r.jointLowerFrame,
      jointWeightedLowerDrawSucceeded:r.jointWeightedLowerDrawSucceeded,jointWeightedLower:r.jointWeightedLower,
      jointUpperFrame: r.jointUpperFrame, renderedWeaponSocket: r.renderedWeaponSocket })) };
}

export function nativeGameDamageReceipt(row) {
  const first = row.captureStart, last = row.samples.at(-1), proof = row.proof;
  for (const sample of [first, ...row.samples]) {
    assert.equal(sample.target?.id, proof.targetId);
    assert.equal(sample.target.kind, proof.side === 'human' ? 'walker' : 'guardian');
    assert.equal(sample.target.side, proof.side === 'human' ? 'zombie' : 'human');
    for (const key of ['speed', 'laneSpeed', 'damage']) assert.equal(sample.target[key], 0, 'Only the opponent is an inert fixture');
    assert.equal(sample.target.maxHp, 1_000_000);
    assert.equal(sample.fighter.maxHp, proof.originalActorStats.maxHp);
    assert.equal(sample.fighter.hp, proof.originalActorStats.hp, 'The inert opponent must not damage the original actor');
  }
  const damage = first.target.hp - last.target.hp;
  if (row.phase !== 'move') {
    assert.ok(damage > 0, 'A real attack must apply damage during the recorded observation');
    assert.ok(last.fighter.attackSequence > first.fighter.attackSequence, 'Damage requires a new real attack in this capture');
  }
  return { sourceId: proof.fighterId, targetId: proof.targetId, nativeFrom: first.at, nativeTo: last.at,
    beforeTargetHp: first.target.hp, afterTargetHp: last.target.hp, appliedDamage: damage,
    attackSequenceBefore: first.fighter.attackSequence, attackSequenceAfter: last.fighter.attackSequence,
    scope: 'Observed actual HP delta against the explicitly inert durable opponent; not campaign balance acceptance' };
}

export function nativeGamePerformanceReceipt(row) {
  const first = row.captureStart, last = row.samples.at(-1), deltas = {};
  const keys = ['simulationTicks', 'renderFrames', 'hiddenFrameCallbacks', 'visibilityTransitions',
    'backgroundDurationMs', 'droppedSimulationSeconds', 'scheduledSimulationSteps', 'rafRequests', 'rafCancellations'];
  for (const key of keys) {
    const a = first.runtimePerformance?.[key], b = last.runtimePerformance?.[key];
    assert.ok(Number.isFinite(a) && a >= 0 && Number.isFinite(b) && b >= a, 'Missing or regressing real counter: ' + key);
    deltas[key] = b - a;
  }
  for (const sample of [first, last]) {
    assert.deepEqual(sample.geometry?.viewport, row.viewport, 'Capture must use its declared real viewport');
    const canvas = sample.geometry.canvas;
    assert.ok([canvas.width, canvas.height, canvas.rect.width, canvas.rect.height,
      sample.geometry.devicePixelRatio].every(n => Number.isFinite(n) && n > 0));
  }
  assert.equal(first.geometry.canvas.width, last.geometry.canvas.width);
  assert.equal(first.geometry.canvas.height, last.geometry.canvas.height);
  assert.equal(row.nativeClip.width, first.geometry.canvas.width);
  assert.equal(row.nativeClip.height, first.geometry.canvas.height);
  const nativeSeconds = (last.at - first.at) / 1000, simulationSeconds = last.simulationTime - first.simulationTime;
  assert.ok(nativeSeconds > 0 && simulationSeconds >= 0);
  const observed = row.sourceRaf.rows.filter(r => r.at >= first.at && r.at <= last.at);
  const gaps = observed.slice(1).map((r, i) => r.at - observed[i].at).sort((a, b) => a - b);
  return { before: first.runtimePerformance, after: last.runtimePerformance, deltas,
    nativeSeconds, simulationSeconds, simulationToNativeRatio: simulationSeconds / nativeSeconds,
    nativeObserverRafGapP95Ms: gaps.length ? gaps[Math.ceil(gaps.length * .95) - 1] : null,
    nativeObserverCallbacks: observed.length, distinctObservedRenderSequences: new Set(observed.map(r => r.renderSequence)).size,
    geometryBefore: first.geometry, geometryAfter: last.geometry,
    scope: 'Actual cumulative counters at the same two observed simulation/native boundaries; no reset, clock advance, performance or original-speed acceptance' };
}

export async function captureNativeGameCase(page, row, deps) {
  const { beginV177NativeCanvasClip, hasV177ContinuousDraw, assertV177AuthoredLiveRender, out } = deps;
  let clip, observation, realmOwner, originalFailure;
  const sampleCount = row.phase === 'engage' ? 30 : 15;
  try {
    assert.ok(NATIVE_GAME_CAPTURE_FORMS.includes(row.form));
    row.proof = await page.evaluate(({ form, phase }) => window.__ASHFALL_BATTLE_QA__.prepareV177ContinuousActorProof({ form, phase }), { form: row.form, phase: row.phase });
    await page.waitForFunction(hasV177ContinuousDraw, row.proof, { timeout: 5_000 });
    realmOwner = await page.evaluateHandle(createNativeAllUnitRealmOwner);
    row.realmOwner = await realmOwner.evaluate(readNativeAllUnitRealmOwner);
    row.captureStart = await page.evaluate(readNativeGameCaptureSample, { ...row.proof, performanceBoundary: true });
    observation = await page.evaluateHandle(startNativeGameRafObservation, { ...row.proof, realmOwner });
    clip = await beginV177NativeCanvasClip(page, { form: row.form, requestedKind: row.proof.kind,
      phase: row.phase, fixtureGroup: row.phase === 'engage' ? 'approach-to-attack' : row.proof.side === 'human' ? 'authored-form' : 'base-enemy',
      fighterId: row.proof.fighterId, preparedRenderKind: row.proof.renderKind,
      diagnosticOnly: true, controlledOpponent: true },
    { directory: path.join(out, `${row.viewport.width}x${row.viewport.height}`, 'native-canvas-clips'), engine: 'webkit', requestedMimeType: NATIVE_GAME_CAPTURE_MIME, realmOwner });
    for (let i = 0; i < sampleCount; i++) {
      await page.waitForTimeout(120);
      row.samples.push(await page.evaluate(readNativeGameCaptureSample, { ...row.proof, performanceBoundary: i === sampleCount - 1 }));
    }
    const completedClip = clip; clip = null;
    row.nativeClip = await completedClip.finish({ completed: true });
    row.sourceRaf = await observation.evaluate(stopNativeGameRafObservation);
    await observation.dispose(); observation = null;
    assert.equal(row.nativeClip.status, 'recorded', 'Every diagnostic clip requires original recorded bytes');
    assert.equal(row.nativeClip.requestedMimeType, NATIVE_GAME_CAPTURE_MIME);
    assert.equal(row.nativeClip.engine, 'webkit');
    assert.match(row.nativeClip.mimeType, /^video\/webm/u);
    assert.ok(Number.isSafeInteger(row.nativeClip.bytes) && row.nativeClip.bytes > 0 && row.nativeClip.bytes <= 8 * 1024 * 1024);
    assert.match(row.nativeClip.sha256, /^[a-f0-9]{64}$/u);
    assert.equal(row.nativeClip.originalSpeedAccepted, false); assert.equal(row.nativeClip.encodedPtsVerified, false);
    row.realmReceipt = assertNativeCaptureRealm(row);
    assert.equal(row.sourceRaf.overflow, false);
    assert.ok(row.sourceRaf.rows.length >= 2, 'Native RAF observations must be retained separately from encoded frames');
    for (const [i, source] of row.sourceRaf.rows.entries()) {
      assert.ok(Number.isFinite(source.at) && Number.isFinite(source.renderSequence));
      assert.equal(source.renderKind, row.form);
      if (i) assert.ok(source.at > row.sourceRaf.rows[i - 1].at);
    }
    const bytes = await (deps.read ?? readFile)(row.nativeClip.file);
    assert.equal(bytes.length, row.nativeClip.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), row.nativeClip.sha256);
    row.summary = assertV177AuthoredLiveRender(row);
    row.damageReceipt = nativeGameDamageReceipt(row);
    row.performanceReceipt = nativeGamePerformanceReceipt(row);
    assert.notEqual(row.deadlineExpired, true, 'A late operation cannot promote a timed-out capture');
    row.status = 'observed-diagnostic';
  } catch (error) {
    originalFailure = error;
    // Retain the first capture error before cleanup can block. Its owner must
    // receive it even when the outer deadline wins the later Promise race.
    row.originalFailure = String(error); deps.onFailure?.(error); throw error;
  } finally {
    row.cleanupErrors = [];
    if (clip) {
      try { row.interruptedClip = await clip.finish({ completed: false }); }
      catch (error) { row.cleanupErrors.push(String(error)); }
    }
    if (observation) {
      try { row.interruptedSourceRaf = await observation.evaluate(stopNativeGameRafObservation); }
      catch (error) { row.cleanupErrors.push(String(error)); }
      try { await observation.dispose(); } catch (error) { row.cleanupErrors.push(String(error)); }
    }
    if (realmOwner) {
      try { await realmOwner.dispose(); } catch (error) { row.cleanupErrors.push(String(error)); }
    }
    try { await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setEnemyVfxProofPaused(true)); }
    catch (error) { row.cleanupErrors.push(String(error)); }
    if (!originalFailure && row.cleanupErrors.length) throw new Error(row.cleanupErrors.join('; '));
  }
}

async function dependencies() {
  const modules = await Promise.all([
    import('./pwa-browser-runtime.mjs'), import('./v177-native-canvas-clips.mjs'),
    import('./v177-continuous-draw-readiness.mjs'), import('./v177-continuous-render-contract.mjs'),
    import('./browser-qa-build-identity.mjs'), import('./browser-request-failure-audit.mjs'),
    import('./v100-title-qa-entry.mjs'), import('../app/v100Registry.js'), import('../app/v100Save.js'),
  ]);
  return Object.assign({}, ...modules);
}

// page.evaluate is not covered by page.setDefaultTimeout. Close this case's
// owned context on the existing30s operation budget; never retry its capture.
export async function withNativeGameCaseDeadline(action, closeOwnedContext,
  { schedule = setTimeout, cancel = clearTimeout, onDeadline = () => {} } = {}) {
  let timer, timeoutError, closing, operationSettled = false;
  const operation = Promise.resolve().then(action).then(value => { operationSettled = true; return value; },
    error => { operationSettled = true; throw error; });
  const deadline = new Promise((_, reject) => {
    timer = schedule(() => {
      timeoutError = new Error('Native game case exceeded its30s owned operation deadline');
      onDeadline(timeoutError);
      closing = Promise.resolve().then(closeOwnedContext).catch(error => { timeoutError.contextCloseError = String(error); });
      reject(timeoutError);
    }, 30_000);
  });
  try { return await Promise.race([operation, deadline]); }
  finally {
    cancel(timer);
    if (closing) { await closing; timeoutError.operationSettledAtOwnerReturn = operationSettled; }
  }
}

export async function closeNativeGameContext(context, requests,
  { schedule = setTimeout, cancel = clearTimeout } = {}) {
  let timer;
  try {
    await Promise.race([requests ? requests.closeContext(context) : context.close(),
      new Promise((_, reject) => { timer = schedule(() => reject(new Error('Owned native game context close exceeded5s')), 5_000); })]);
  } finally { cancel(timer); }
}

export async function runBrowserQa() {
  const binding = await nativeGameCaptureBinding();
  const event=JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH,'utf8'));
  const captureScope=event.inputs?.capture_scope??'full',plan=nativeGameCapturePlan(captureScope);
  const deps = await dependencies();
  const out = process.env.V177_NATIVE_GAME_CAPTURE_OUT ?? 'outputs/v177-native-game-capture';
  const origin = new URL(process.env.V100_CAMPAIGN_QA_BASE_URL);
  assert.equal(origin.protocol, 'http:'); assert.equal(origin.hostname, '127.0.0.1');
  const report = { at: new Date().toISOString(), ...binding, tree: git(['rev-parse', 'HEAD^{tree}']),
    engine: 'webkit', headless: true, viewports: NATIVE_GAME_CAPTURE_VIEWPORTS,
    forms: [...new Set(plan.map(r=>r.form))],captureScope,plan,runtime: deps.PWA_WEBKIT_RUNTIME,
    captureConditions: { canvasOnly: true, parallelPlaywrightRecordVideo: false,
      legacyV102ParallelPlaywrightRecordVideo: true, sameObservationLoadAsLegacyV102: false,
      codecOnlyCausalComparison: false },
    build: await deps.productionBuildIdentity(), status: 'running-diagnostic', ...acceptance(),
    scope: `${plan.length*3} native VP8 diagnostic clips in three real viewports. State supplements are six pre-aged human corpse fixtures with actual infection/new ID/rise and ordinary movement in both fall variants, plus three original Ranger natural incoming-stun cases. Full scope also retains the original36 priority cases. No QA birth registration, rise-lock injection or manual clock advance. Not all-unit, normal-play, original-speed naturalness, balance or physical audio acceptance.`,
    sources: [], contexts: [], cases: [], errors: [], persistenceErrors: [], contextCleanup: 'not-created', browserCleanup: 'not-created' };
  assert.match(report.build.combinedSha256, /^[a-f0-9]{64}$/u);
  await mkdir(out, { recursive: true });
  for (const file of NATIVE_GAME_CAPTURE_SOURCES) {
    const bytes = await readFile(file), retained = 'repo__' + file.replaceAll('/', '__');
    await writeFile(path.join(out, retained), bytes, { flag: 'wx' });
    report.sources.push({ file, retained, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  const reportFile = path.join(out, 'report.json');
  await writeFile(reportFile, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  let primaryFailure;
  const recordFailure = error => { report.errors.push(String(error)); primaryFailure ??= error; };
  const persist = async () => {
    try { await writeFile(reportFile, JSON.stringify(report, null, 2) + '\n'); }
    catch (error) {
      report.persistenceErrors.push(String(error));
      report.errors.push(`Report persistence failed: ${error}`);
      report.status = 'failed'; primaryFailure ??= error;
    }
  };
  let browser, closingBrowser = false;
  try {
    browser = await (await deps.pwaBrowserType('webkit')).launch({ headless: true });
    browser.on('disconnected', () => { if (!closingBrowser) report.errors.push('Unexpected native game capture browser disconnect'); });
    report.browserVersion = browser.version();
    assert.equal(report.browserVersion, deps.PWA_WEBKIT_RUNTIME.browserVersion, 'The running native WebKit binary must match the pinned runtime');
    for (const viewport of NATIVE_GAME_CAPTURE_VIEWPORTS) {
      const contextOptions = { viewport, isMobile: viewport.width < 1000, hasTouch: viewport.width < 1000, deviceScaleFactor: 1 };
      const owner = { viewport, contextOptions, cleanup: 'not-created', requests: null };
      report.contexts.push(owner);
      let context, requests, closing;
      const closeOwnedContext = () => closing ??= (async () => {
        if (!context) return;
        owner.cleanup = 'pending'; await persist();
        try { await closeNativeGameContext(context, requests); owner.cleanup = 'completed'; }
        catch (error) { owner.cleanup = 'failed'; recordFailure(error); throw error; }
        finally {
          owner.requests = requests?.report ?? null;
          if (requests?.report.unexpectedFailures.length) recordFailure(new Error('Unexpected game capture request failure'));
          await persist();
        }
      })();
      try {
        context = await browser.newContext(contextOptions);
        owner.cleanup = 'open';
        const page = await context.newPage(); page.setDefaultTimeout(30_000);
        requests = deps.installRequestFailureAudit(page);
        page.on('pageerror', error => report.errors.push(String(error)));
        page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
        page.on('response', response => { if (response.status() >= 400) report.errors.push(`${response.status()} ${response.url()}`); });
        const base = deps.createDefaultV100Save(), owned = deps.V100_UNITS.map(unit => unit.id);
        const save = deps.normalizeV100Save({ ...base, campaignStarted: true, revision: 3,
          ownedUnitIds: owned, registeredUnitIds: owned, formationSlots: owned.slice(0, 7),
          flowState: { phase: 'formation', stageId: deps.V100_STAGE_IDS[0], stageNumber: 1,
            eventId: null, destination: 'formation', nodeIndex: 0, firstClear: false, finalized: true } });
        await withNativeGameCaseDeadline(async () => {
          await page.addInitScript(deps.seedV100BrowserSaveOnce, deps.serializeV100Save(save));
          await page.goto(new URL('v100', origin).href);
          const {enterNativeAllUnitSurface}=await import('./v177-native-allunit-browser.mjs');
          await enterNativeAllUnitSurface(page);
          await deps.enterV100FromTitle(page);
          await page.getByRole('button', { name: '戦闘へ', exact: true }).click();
          await page.waitForFunction(() => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().running);
          await page.evaluate(async scope => {
            for (const kind of scope==='full'?['abomination','walker','spindle','turned']:['walker','spindle','turned']) await window.__ASHFALL_BATTLE_QA__.ensureEnemyFacingProofAsset(kind);
            for (const kind of scope==='full'?['guardian','medic','ranger','engineer','brawler']:['guardian','ranger','brawler']) await window.__ASHFALL_BATTLE_QA__.ensureUnitRenderProofAsset(kind);
          },captureScope);
        }, closeOwnedContext, { onDeadline: recordFailure });
        captureCases: for (const {form,phase,variant} of plan) {
          const row = { form, phase, ...(variant===undefined?{}:{variant}), viewport, status: 'starting', samples: [], ...acceptance() };
          report.cases.push(row);
          const capture=phase==='incoming-stun'?captureNativeIncomingStunCase:phase==='turned-getup'?captureNativeTurnedGetupCase:captureNativeGameCase;
          try { await withNativeGameCaseDeadline(() => capture(page, row, { ...deps, out, onFailure: recordFailure,
            startNativeGameRafObservation,stopNativeGameRafObservation,nativeGamePerformanceReceipt,mimeType:NATIVE_GAME_CAPTURE_MIME }), closeOwnedContext,
            { onDeadline: error => { row.deadlineExpired = true; recordFailure(error); } }); }
          catch (error) {
            row.status = 'failed'; row.error = String(error);
            row.operationSettledAtOwnerReturn = error.operationSettledAtOwnerReturn ?? null;
            recordFailure(error); await persist(); break captureCases;
          }
          await persist();
        }
      } catch (error) { recordFailure(error); }
      finally { try { await closeOwnedContext(); } catch { /* original close failure is already retained */ } }
    }
  } catch (error) { recordFailure(error); }
  finally {
    report.contextCleanup = !report.contexts.length ? 'not-created'
      : report.contexts.every(owner => owner.cleanup === 'completed') ? 'completed' : 'failed';
    if (browser) {
      report.browserCleanup = 'pending'; await persist();
      closingBrowser = true;
      try { await browser.close(); report.browserCleanup = 'completed'; }
      catch (error) { report.browserCleanup = 'failed'; recordFailure(error); }
    }
    report.status = report.errors.length || report.cases.length !== NATIVE_GAME_CAPTURE_VIEWPORTS.length * plan.length
      || report.cases.some(row => row.status !== 'observed-diagnostic') ? 'failed' : 'completed-diagnostic';
    await persist();
  }
  console.log(JSON.stringify({ head: report.head, status: report.status, errors: report.errors,
    cases: report.cases.map(row => ({ form: row.form, viewport: row.viewport, phase: row.phase, status: row.status })), ...acceptance() }));
  if (primaryFailure) throw primaryFailure;
  if (report.status === 'failed') throw new Error('Native game capture diagnostic failed; retain report and original clips');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  setImmediate(() => { main().catch(error => { console.error(error); process.exitCode = 1; }); });
}
