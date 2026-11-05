import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import ts from 'typescript';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const out = path.resolve(process.env.QUALITY_RECORDING_TAP_OUT ?? 'output/playwright/quality-recording-tap-r2');
await mkdir(out, { recursive: false });
const current = await readFile('app/AshfallGame.tsx', 'utf8');
const previous = execFileSync('git', ['show', 'HEAD:app/AshfallGame.tsx'], { encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
function extract(source) {
  const tree = ts.createSourceFile('AshfallGame.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), matches = [];
  function visit(node) {
    if (ts.isPropertyAssignment(node) && node.name.getText(tree) === 'createLocalRecordingTap') matches.push(node.initializer);
    ts.forEachChild(node, visit);
  }
  visit(tree); assert.equal(matches.length, 1);
  return ts.transpile(`(${matches[0].getText(tree)})`, { target: ts.ScriptTarget.ES2022 });
}
const bundle = await build({ entryPoints: ['app/audioMixer.js'], bundle: true, write: false, format: 'iife', globalName: 'RecordingTestAudio', platform: 'browser' });
await writeFile(path.join(out, 'mixer.js'), bundle.outputFiles[0].contents);
await writeFile(path.join(out, 'before-tap.js'), extract(previous));
await writeFile(path.join(out, 'after-tap.js'), extract(current));
await writeFile(path.join(out, 'harness.mjs'), await readFile(new URL(import.meta.url)));
const report = { scope: 'Short synthetic-tone lifecycle check of the actual production mixer and extracted local recording bridge in native Chromium. No game battle, gameplay injection, listening or full-game acceptance.',
  sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim(),
  currentSourceSha256: createHash('sha256').update(current).digest('hex'), cases: [] };
const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  for (const [name, code, disposeFirst, expected] of [
    ['before-dispose', extract(previous), true, 'InvalidAccessError'],
    ['after-dispose', extract(current), true, null],
    ['after-active', extract(current), false, null],
  ]) {
    const page = await browser.newPage();
    try {
      await page.addScriptTag({ content: bundle.outputFiles[0].text });
      const capture = await page.evaluate(async ({ code, disposeFirst }) => {
        const mixer = window.RecordingTestAudio.createAudioMixer({ enableAcknowledgementTone: false, closeContextOnDispose: false });
        if (!await mixer.unlock()) throw Error('native context did not unlock');
        const context = mixer.context;
        const create = new Function('mixer', 'isLocalQa', 'return ' + code)(mixer, true);
        const tap = create(), oscillator = context.createOscillator();
        oscillator.connect(mixer.master); oscillator.start();
        const recorder = new MediaRecorder(tap.stream, { mimeType: 'audio/webm;codecs=opus' }), chunks = [];
        recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
        const stopped = new Promise(resolve => { recorder.onstop = resolve; });
        recorder.start(); await new Promise(resolve => setTimeout(resolve, 300));
        oscillator.stop();
        if (disposeFirst) await mixer.dispose();
        recorder.stop(); await stopped;
        window.__TAP_LIFECYCLE__ = { mixer, context, tap };
        return { bytes: Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer())), disposed: mixer.disposed, tracksBefore: tap.stream.getTracks().map(t => t.readyState) };
      }, { code, disposeFirst });
      const bytes = Buffer.from(capture.bytes), file = path.join(out, name + '.webm');
      await writeFile(file, bytes); assert.ok((await readFile(file)).equals(bytes));
      const cleanup = await page.evaluate(async () => {
        const { mixer, context, tap } = window.__TAP_LIFECYCLE__;
        let cleanupError = null, repeatError = null;
        try { tap.release(); } catch (e) { cleanupError = e.name; }
        try { tap.release(); } catch (e) { repeatError = e.name; }
        const tracksAfter = tap.stream.getTracks().map(t => t.readyState);
        tap.stream.getTracks().forEach(t => t.stop());
        await mixer.dispose(); await context.close();
        return { cleanupError, repeatError, tracksAfter };
      });
      const { bytes: ignoredBytes, ...metadata } = capture;
      void ignoredBytes;
      const row = { name, ...metadata, ...cleanup, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
      report.cases.push(row);
      assert.ok(bytes.length > 1000);
      assert.equal(row.cleanupError, expected); assert.equal(row.repeatError, expected);
      assert.deepEqual(row.tracksAfter, [expected ? 'live' : 'ended']);
    } finally { await page.close(); }
  }
  report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = String(error); throw error; }
finally {
  await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify(report));
