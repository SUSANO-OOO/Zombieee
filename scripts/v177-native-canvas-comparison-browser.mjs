import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { beginV177NativeCanvasClip } from './v177-native-canvas-clips.mjs';
import { closeV177CombatReport } from './v177-combat-workload.mjs';
import { installRequestFailureAudit } from './browser-request-failure-audit.mjs';
import { NATIVE_CAPTURE_COMPARISON_CASES, assertNativeCaptureDiagnosticHost,
  startNativeCanvasCalibration, stopNativeCanvasCalibration,
  nativeCaptureCalibrationObservation } from './v177-native-canvas-comparison.mjs';

assertNativeCaptureDiagnosticHost(process.platform, process.env.GITHUB_ACTIONS);
const { pwaBrowserType, PWA_WEBKIT_RUNTIME } = await import('./pwa-browser-runtime.mjs');
const out = process.env.V177_NATIVE_CAPTURE_OUT ?? 'outputs/v177-native-capture-comparison';
await mkdir(out, { recursive: true });
const git = args => execFileSync('git', args, { encoding: 'utf8' }).trim();
const report = { at: new Date().toISOString(), status: 'running-diagnostic',
  scope: 'Synthetic native RAF canvas capture comparison. Not game/unit quality, original-speed acceptance, or physical iPhone recording.',
  head: git(['rev-parse', 'HEAD']), tree: git(['rev-parse', 'HEAD^{tree}']),
  platform: process.platform, arch: process.arch, node: process.version,
  runtime: PWA_WEBKIT_RUNTIME, viewport: [844, 340], productionBuild: null,
  productionGameLoaded: false, recorderRouteAccepted: false, originalSpeedAccepted: false,
  wholeGameAccepted: false, physicalIphoneRecordingAccepted: false, modes: [], cases: [], errors: [],
  sourcePins: await Promise.all(['scripts/v177-native-canvas-comparison-browser.mjs',
    'scripts/v177-native-canvas-comparison.mjs', 'scripts/v177-native-canvas-clips.mjs'].map(async file =>
    ({ file, sha256: createHash('sha256').update(await readFile(file)).digest('hex') }))) };
const persist = () => writeFile(out + '/report.json', JSON.stringify(report, null, 2) + '\n');
const type = await pwaBrowserType('webkit');
for (const headless of [true, false]) {
  const mode = { headless, status: 'starting' }; report.modes.push(mode);
  let browser;
  try {
    browser = await type.launch({ headless }); mode.version = browser.version();
    for (const scenario of NATIVE_CAPTURE_COMPARISON_CASES.filter(row => row.headless === headless)) {
      const row = { ...scenario, status: 'starting' }; report.cases.push(row);
      let context, requests, calibration, clip, stopped = false;
      try {
        context = await browser.newContext({ viewport: { width: 844, height: 340 },
          isMobile: true, hasTouch: true,
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_7_1 like Mac OS X) AppleWebKit/605.1.15 Version/26.7 Mobile/15E148 Safari/604.1' });
        const page = await context.newPage(); requests = installRequestFailureAudit(page);
        page.on('pageerror', error => report.errors.push(String(error)));
        page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
        page.on('response', response => { if (response.status() >= 400) report.errors.push(String(response.status()) + ' ' + response.url()); });
        const url = 'http://127.0.0.1/__v177-native-capture-comparison';
        await page.route(url, route => route.fulfill({ contentType: 'text/html',
          body: '<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><title>Native capture calibration</title><div class="game-shell"><canvas width="844" height="340"></canvas></div>' }));
        await page.goto(url);
        calibration = await page.locator('.game-shell canvas').evaluateHandle(startNativeCanvasCalibration);
        clip = await beginV177NativeCanvasClip(page, { form: 'native-calibration', phase: 'move',
          fighterId: 0, fixtureGroup: 'base-enemy', diagnosticOnly: true,
          source: 'synthetic-raf-canvas', caseId: scenario.id },
        { directory: out + '/' + scenario.id, engine: 'webkit', requestedMimeType: scenario.mimeType });
        await page.waitForTimeout(2000);
        row.nativeClip = await clip.finish({ completed: true }); clip = null;
        row.sourceObservation = await calibration.evaluate(stopNativeCanvasCalibration); stopped = true;
        row.observation = nativeCaptureCalibrationObservation(row.sourceObservation, row.nativeClip);
        if (row.nativeClip.file) {
          const bytes = await readFile(row.nativeClip.file);
          assert.equal(bytes.length, row.nativeClip.bytes);
          assert.equal(createHash('sha256').update(bytes).digest('hex'), row.nativeClip.sha256);
        }
        row.status = 'observed-diagnostic';
      } catch (error) {
        row.status = 'failed'; row.failure = String(error); report.errors.push(String(error));
      } finally {
        if (clip) {
          try { row.interruptedClip = await clip.finish({ completed: false }); }
          catch (error) { row.clipCleanupError = String(error); report.errors.push(String(error)); }
        }
        if (calibration && !stopped) {
          try { row.interruptedSource = await calibration.evaluate(stopNativeCanvasCalibration); }
          catch (error) { row.sourceCleanupError = String(error); report.errors.push(String(error)); }
        }
        await calibration?.dispose().catch(error => { report.errors.push(String(error)); });
        row.contextCleanup = 'pending'; await persist();
        if (context) {
          try {
            if (requests) await requests.closeContext(context);
            else await context.close();
            row.contextCleanup = 'completed';
          }
          catch (error) { row.contextCleanup = 'failed'; row.cleanupError = String(error); report.errors.push(String(error)); }
          row.requests = requests?.report ?? null;
          if (requests?.report.unexpectedFailures.length) report.errors.push('Unexpected diagnostic request failure');
        }
        await persist();
      }
    }
    mode.status = 'completed-diagnostic';
  } catch (error) {
    mode.status = 'failed'; mode.failure = String(error); report.errors.push(String(error));
  } finally {
    if (browser) {
      await closeV177CombatReport(mode, () => browser.close(), persist);
      if (mode.cleanupError) report.errors.push(mode.cleanupError);
    }
    await persist();
  }
}
report.status = report.errors.length || report.cases.length !== NATIVE_CAPTURE_COMPARISON_CASES.length
  ? 'failed' : 'completed-diagnostic';
await persist();
console.log(JSON.stringify({ head: report.head, status: report.status,
  cases: report.cases.map(row => ({ id: row.id, status: row.status, nativeOutcome: row.observation?.nativeOutcome })),
  recorderRouteAccepted: false, wholeGameAccepted: false }));
if (report.status === 'failed') process.exitCode = 1;
