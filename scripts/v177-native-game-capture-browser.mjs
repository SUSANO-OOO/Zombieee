import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const NATIVE_GAME_CAPTURE_PHASES = Object.freeze(['move', 'attack', 'engage']);
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
  'app/combatPresentation.js', 'app/v102CombatMotion.js', 'app/AshfallGame.tsx',
]);
const acceptance = () => ({ originalSpeedAccepted: false, encodedPtsVerified: false,
  naturalnessAccepted: false, physicalIphoneRecordingAccepted: false,
  wholeGameAccepted: false, productionCodecChanged: false });
const git = args => execFileSync('git', args, { encoding: 'utf8' }).trim();

export function assertNativeGameCaptureHost(platform, env) {
  assert.ok(platform === 'darwin' && env.GITHUB_ACTIONS === 'true' && env.RUNNER_OS === 'macOS',
    'Native game capture is hosted macOS/GitHub Actions only; local game/browser/audio launch is prohibited');
}
export async function nativeGameCaptureBinding({ platform = process.platform, env = process.env,
  read = readFile, head = () => git(['rev-parse', 'HEAD']) } = {}) {
  assertNativeGameCaptureHost(platform, env);
  assert.equal(env.GITHUB_EVENT_NAME, 'pull_request', 'Native game capture requires a PR event');
  assert.match(env.V177_EXPECTED_HEAD_SHA ?? '', /^[a-f0-9]{40}$/u, 'An exact expected PR head is required');
  assert.ok(env.GITHUB_EVENT_PATH, 'The original PR event is required');
  const event = JSON.parse(await read(env.GITHUB_EVENT_PATH, 'utf8'));
  assert.equal(event.pull_request?.head?.sha, env.V177_EXPECTED_HEAD_SHA, 'Expected head must match the PR event');
  const actualHead = await head();
  assert.equal(actualHead, env.V177_EXPECTED_HEAD_SHA, 'Checkout must be the exact PR head');
  return { head: actualHead, pullRequest: event.number, platform, runnerOS: env.RUNNER_OS };
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
export function startNativeGameRafObservation({ fighterId }) {
  const state = { timeOrigin: performance.timeOrigin, startedAt: performance.now(),
    fighterId, rows: [], overflow: false, stopped: false, raf: null };
  const observe = () => {
    if (state.stopped) return;
    const qa = window.__ASHFALL_BATTLE_QA__;
    const draw = qa.getEnemyFacingRuntimeAudit(fighterId).renderHistory.at(-1);
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
  return { timeOrigin: state.timeOrigin, startedAt: state.startedAt, stoppedAt: state.stoppedAt,
    rows: state.rows, overflow: state.overflow, encodedFrameCount: null, encodedPtsVerified: false,
    scope: 'Native observer RAF callbacks and actual game render receipts; neither is an encoded-frame count' };
}
export function readNativeGameCaptureSample({ fighterId, targetId }) {
  const qa = window.__ASHFALL_BATTLE_QA__, snapshot = qa.getSnapshot();
  const audit = qa.getEnemyFacingRuntimeAudit(fighterId);
  return { at: performance.now(), simulationTime: snapshot.time, running: snapshot.running,
    paused: snapshot.paused, route: location.pathname, visible: document.visibilityState === 'visible',
    fighter: audit.fighter, target: qa.getEnemyFacingRuntimeAudit(targetId).fighter,
    completedAttackImpacts: qa.getPhaseGCombatSnapshot().completedAttackImpacts
      .filter(row => row.sourceId === fighterId && row.targetId === targetId),
    renders: audit.renderHistory.map(r => ({ renderSequence: r.renderSequence, renderKind: r.renderKind,
      assetReady: r.assetReady, x: r.x, y: r.y, renderWidth: r.renderWidth, renderHeight: r.renderHeight,
      poseScaleX: r.poseScaleX, poseScaleY: r.poseScaleY, requestedState: r.requestedState,
      actualXDelta: r.actualXDelta, jointAtlasPath: r.jointAtlasPath, jointLowerFrame: r.jointLowerFrame,
      jointUpperFrame: r.jointUpperFrame, renderedWeaponSocket: r.renderedWeaponSocket })) };
}

export function nativeGameDamageReceipt(row) {
  const first = row.captureStart, last = row.samples.at(-1), proof = row.proof;
  for (const sample of [first, ...row.samples]) {
    assert.equal(sample.target?.id, proof.targetId);
    assert.equal(sample.target.kind, 'guardian'); assert.equal(sample.target.side, 'human');
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

export async function captureNativeGameCase(page, row, deps) {
  const { beginV177NativeCanvasClip, hasV177ContinuousDraw, assertV177AuthoredLiveRender, out } = deps;
  let clip, observation, originalFailure;
  const sampleCount = row.phase === 'engage' ? 30 : 15;
  try {
    row.proof = await page.evaluate(phase => window.__ASHFALL_BATTLE_QA__.prepareV177ContinuousActorProof({ form: 'abomination', phase }), row.phase);
    await page.waitForFunction(hasV177ContinuousDraw, row.proof, { timeout: 5_000 });
    row.captureStart = await page.evaluate(readNativeGameCaptureSample, row.proof);
    observation = await page.evaluateHandle(startNativeGameRafObservation, row.proof);
    clip = await beginV177NativeCanvasClip(page, { form: 'abomination', requestedKind: 'abomination',
      phase: row.phase, fixtureGroup: row.phase === 'engage' ? 'approach-to-attack' : 'base-enemy',
      fighterId: row.proof.fighterId, preparedRenderKind: row.proof.renderKind,
      diagnosticOnly: true, controlledOpponent: true },
    { directory: path.join(out, 'native-canvas-clips'), engine: 'webkit', requestedMimeType: NATIVE_GAME_CAPTURE_MIME });
    for (let i = 0; i < sampleCount; i++) {
      await page.waitForTimeout(120);
      row.samples.push(await page.evaluate(readNativeGameCaptureSample, row.proof));
    }
    const completedClip = clip; clip = null;
    row.nativeClip = await completedClip.finish({ completed: true });
    row.sourceRaf = await observation.evaluate(stopNativeGameRafObservation);
    await observation.dispose(); observation = null;
    assert.equal(row.nativeClip.status, 'recorded', 'All three diagnostic clips require original recorded bytes');
    assert.equal(row.nativeClip.requestedMimeType, NATIVE_GAME_CAPTURE_MIME);
    assert.equal(row.nativeClip.engine, 'webkit');
    assert.match(row.nativeClip.mimeType, /^video\/webm/u);
    assert.ok(Number.isSafeInteger(row.nativeClip.bytes) && row.nativeClip.bytes > 0 && row.nativeClip.bytes <= 8 * 1024 * 1024);
    assert.match(row.nativeClip.sha256, /^[a-f0-9]{64}$/u);
    assert.equal(row.nativeClip.originalSpeedAccepted, false); assert.equal(row.nativeClip.encodedPtsVerified, false);
    assert.equal(row.sourceRaf.timeOrigin, row.nativeClip.timeOrigin);
    assert.equal(row.sourceRaf.overflow, false);
    assert.ok(row.sourceRaf.rows.length >= 2, 'Native RAF observations must be retained separately from encoded frames');
    for (const [i, source] of row.sourceRaf.rows.entries()) {
      assert.ok(Number.isFinite(source.at) && Number.isFinite(source.renderSequence));
      assert.equal(source.renderKind, 'abomination');
      if (i) assert.ok(source.at > row.sourceRaf.rows[i - 1].at);
    }
    const bytes = await (deps.read ?? readFile)(row.nativeClip.file);
    assert.equal(bytes.length, row.nativeClip.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), row.nativeClip.sha256);
    row.summary = assertV177AuthoredLiveRender(row);
    row.damageReceipt = nativeGameDamageReceipt(row);
    row.status = 'observed-diagnostic';
  } catch (error) { originalFailure = error; throw error;
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

export async function runBrowserQa() {
  const binding = await nativeGameCaptureBinding();
  const deps = await dependencies();
  const out = process.env.V177_NATIVE_GAME_CAPTURE_OUT ?? 'outputs/v177-native-game-capture';
  const origin = new URL(process.env.V100_CAMPAIGN_QA_BASE_URL);
  assert.equal(origin.protocol, 'http:'); assert.equal(origin.hostname, '127.0.0.1');
  const report = { at: new Date().toISOString(), ...binding, tree: git(['rev-parse', 'HEAD^{tree}']),
    engine: 'webkit', headless: true, viewport: [844, 340], runtime: deps.PWA_WEBKIT_RUNTIME,
    contextOptions: { viewport: { width: 844, height: 340 }, isMobile: true, hasTouch: true },
    captureConditions: { canvasOnly: true, parallelPlaywrightRecordVideo: false,
      legacyV102ParallelPlaywrightRecordVideo: true, sameObservationLoadAsLegacyV102: false,
      codecOnlyCausalComparison: false },
    build: await deps.productionBuildIdentity(), status: 'running-diagnostic', ...acceptance(),
    scope: 'Three abomination native VP8 availability clips on the real V1 route with original actor stats and an explicitly inert durable guardian opponent. This canvas-only capture omits the legacy v102 harness parallel Playwright recordVideo; its observation load differs, so it is not a codec-only causal comparison with those old MP4 captures. Existing continuous contract thresholds are unchanged. Not all-unit, normal-play, original-speed naturalness, balance or physical audio acceptance.',
    sources: [], cases: [], errors: [], persistenceErrors: [], contextCleanup: 'not-created', browserCleanup: 'not-created' };
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
  let browser, context, requests, closingBrowser = false;
  try {
    browser = await (await deps.pwaBrowserType('webkit')).launch({ headless: true });
    browser.on('disconnected', () => { if (!closingBrowser) report.errors.push('Unexpected native game capture browser disconnect'); });
    report.browserVersion = browser.version();
    assert.equal(report.browserVersion, deps.PWA_WEBKIT_RUNTIME.browserVersion, 'The running native WebKit binary must match the pinned runtime');
    context = await browser.newContext(report.contextOptions);
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
    await page.addInitScript(deps.seedV100BrowserSaveOnce, deps.serializeV100Save(save));
    await page.goto(new URL('v100', origin).href);
    const play = page.getByRole('button', { name: 'ブラウザで遊ぶ', exact: true });
    await play.or(page.locator('.v100-start-screen')).first().waitFor();
    if (await play.isVisible()) await play.click();
    await deps.enterV100FromTitle(page);
    await page.getByRole('button', { name: '戦闘へ', exact: true }).click();
    await page.waitForFunction(() => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().running);
    await page.evaluate(async () => {
      await window.__ASHFALL_BATTLE_QA__.ensureEnemyFacingProofAsset('abomination');
      await window.__ASHFALL_BATTLE_QA__.ensureUnitRenderProofAsset('guardian');
    });
    for (const phase of NATIVE_GAME_CAPTURE_PHASES) {
      const row = { form: 'abomination', phase, status: 'starting', samples: [], ...acceptance() };
      report.cases.push(row);
      try { await captureNativeGameCase(page, row, { ...deps, out }); }
      catch (error) { row.status = 'failed'; row.error = String(error); recordFailure(error); }
      await persist();
    }
  } catch (error) { recordFailure(error); }
  finally {
    if (context) {
      report.contextCleanup = 'pending'; await persist();
      try { if (requests) await requests.closeContext(context); else await context.close(); report.contextCleanup = 'completed'; }
      catch (error) { report.contextCleanup = 'failed'; recordFailure(error); }
      report.requests = requests?.report ?? null;
      if (requests?.report.unexpectedFailures.length) recordFailure(new Error('Unexpected game capture request failure'));
    }
    if (browser) {
      report.browserCleanup = 'pending'; await persist();
      closingBrowser = true;
      try { await browser.close(); report.browserCleanup = 'completed'; }
      catch (error) { report.browserCleanup = 'failed'; recordFailure(error); }
    }
    report.status = report.errors.length || report.cases.length !== 3
      || report.cases.some(row => row.status !== 'observed-diagnostic') ? 'failed' : 'completed-diagnostic';
    await persist();
  }
  console.log(JSON.stringify({ head: report.head, status: report.status, errors: report.errors,
    cases: report.cases.map(row => ({ phase: row.phase, status: row.status })), ...acceptance() }));
  if (primaryFailure) throw primaryFailure;
  if (report.status === 'failed') throw new Error('Native game capture diagnostic failed; retain report and original clips');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  setImmediate(() => { main().catch(error => { console.error(error); process.exitCode = 1; }); });
}
