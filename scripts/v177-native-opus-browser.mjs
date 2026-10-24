import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { OpusWebmMuxer } from "./v177-opus-webm-muxer.mjs";
import { assertNativeOpusHost, installNativeOpusGuard, runNativeOpusProbe, decodeNativeOpusContent,
  analyseOpusPcm, evaluateNativeOpusEvidence, nativeOpusProbeCases, nativeOpusAcceptance,
  NATIVE_OPUS_RUNTIME, NATIVE_OPUS_CONTEXT, NATIVE_OPUS_SOURCES } from "./v177-native-opus-probe.mjs";

// Exact original MP3s from the previous native AAC diagnostic. Do not import or
// serve the game to obtain them. A changed source requires a new reviewed pin.
export const NATIVE_OPUS_ASSETS = Object.freeze([
  { id: "music-v100-score-normal", source: "/audio/v100/score/normal.mp3", bytes: 1536879,
    expectedSha256: "71fe28ebf9c2b02844b38b0526ef45a31143e02c021c40533c623bcd8cd324fe" },
  { id: "weapon-rifle-01", source: "/audio/v100/foley/rifle.mp3", bytes: 6225,
    expectedSha256: "805eacd7367c72d2e96628d8bc8d539f8401d225164c8def9caaad9eb726e96f" },
]);
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const NATIVE_OPUS_ORIGIN = "https://v177-native-opus.invalid";
const NATIVE_OPUS_MODULE_URL = NATIVE_OPUS_ORIGIN + "/v177-opus-webm-muxer.mjs";

// The WebKit route observes blob module loads too. Serve the pinned module as
// one explicit same-origin fixture instead of weakening the request allowlist.
export function nativeOpusFixtureResponse({url,method}, {muxerSource,sources}) {
  assert.equal(method,"GET","Unexpected diagnostic request method");
  if(url===NATIVE_OPUS_ORIGIN+"/")return {contentType:"text/html",body:'<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;self&#39; &#39;unsafe-eval&#39;; connect-src &#39;self&#39;; media-src blob:; img-src data:"><link rel="icon" href="data:,"><title>Native Opus diagnostic</title><button id="start-probe">Start native Opus probe</button><button id="weapon-probe">Fire existing rifle effect</button>'};
  if(url===NATIVE_OPUS_MODULE_URL){
    assert.ok(typeof muxerSource==='string'&&muxerSource.length>0,"Pinned muxer module is missing");
    return {contentType:"text/javascript",headers:{"Cache-Control":"no-store"},body:muxerSource};
  }
  const original=sources.find(input=>input.url===url);
  assert.ok(original,"Unexpected request: "+url);
  return {contentType:"audio/mpeg",body:original.data};
}

// All original fields/bytes are retained before remux, decode or acceptance
// checks. The separate binary offsets bind each original packet and segment.
export async function retainNativeOpusRaw(label, state, writeArtifact) {
  const artifacts = [], packets = [], segments = [];
  let packetOffset = 0, segmentOffset = 0;
  const packetParts = state.packets.map(packet => { const data = Buffer.from(packet.data);
    packets.push({ ...packet, data: undefined, offset: packetOffset, bytes: data.length, sha256: sha(data) });
    packetOffset += data.length; return data; });
  const segmentParts = state.segments.map(segment => { const data = Buffer.from(segment.data);
    segments.push({ ...segment, data: undefined, offset: segmentOffset, bytes: data.length, sha256: sha(data) });
    segmentOffset += data.length; return data; });
  const encoded = Buffer.concat(segmentParts);
  artifacts.push(await writeArtifact(label + "-packets.bin", Buffer.concat(packetParts)));
  artifacts.push(await writeArtifact(label + "-reference.f32le", Buffer.from(state.referencePcm)));
  artifacts.push(await writeArtifact(label + "-background.f32le", Buffer.from(state.backgroundPcm)));
  artifacts.push(await writeArtifact(label + "-stream.webm", encoded));
  const { referencePcm, backgroundPcm, ...metadata } = state;
  const raw = { ...metadata, packets, segments,
    originalStorage: { packets: label + "-packets.bin", generatedSegments: label + "-stream.webm",
      reference: label + "-reference.f32le", background: label + "-background.f32le",
      referenceBytes: referencePcm.length, backgroundBytes: backgroundPcm.length,
      note: "Native output callback copies original bytes, timestamps, durations and decoder description before inspection. These files are saved before Node remux, decode and evidence checks. Generated segments can include unappended pending segments after failure; appends records each native append call and return." } };
  artifacts.push(await writeArtifact(label + "-raw.json", Buffer.from(JSON.stringify(raw, null, 2) + "\n")));
  return { artifacts, encoded };
}

export function verifyNativeOpusRemux(state, encoded) {
  assert.ok(state.configurations.length > 0 && state.packets.length > 0, "Original native packet/configuration is missing");
  const config = state.configurations[0], muxer = new OpusWebmMuxer(config.description, config);
  const parts = [Buffer.from(muxer.initializationSegment)];
  for (const packet of state.packets) parts.push(Buffer.from(muxer.segment({
    data: Uint8Array.from(packet.data), timestamp: packet.timestamp, duration: packet.duration })));
  assert.equal(state.segments.length, parts.length, "Appended segment count differs from the original native packets");
  assert.equal(state.appends?.length, parts.length, "Not every generated segment was submitted to the native SourceBuffer");
  state.appends.forEach((append, index) => {
    assert.equal(append.segment, index, "Native append order changed"); assert.equal(append.returned, true, "Native append did not return successfully");
  });
  parts.forEach((part, index) => assert.deepEqual(part, Buffer.from(state.segments[index].data), "Appended segment changed at " + index));
  assert.deepEqual(Buffer.concat(parts), encoded, "Retained WebM is not the exact appended stream");
  const { original, ...header } = muxer.header;
  return { nativePacketCount: state.packets.length, segmentCount: parts.length, originalOpusHeadSha256: sha(original),
    ...header, nativeTimestampsRetained: true, timestampCorrectionUs: 0, playbackRate: 1,
    endPadding: "No native end-padding metadata was supplied; no padding is inferred, stripped or timestamped differently." };
}

export async function observeNativeOpusStreams(browserType, host, { muxerSource, sourceInputs, writeArtifact }) {
  assertNativeOpusHost(host?.platform, host?.env);
  assert.equal(typeof writeArtifact, "function", "Original evidence writer is required before a browser can launch");
  const report = { schemaVersion: 1, ...nativeOpusAcceptance(), diagnosticOnly: true, status: "starting",
    contextOptions: NATIVE_OPUS_CONTEXT, browserVersion: null, cases: [], errors: [], cleanup: { browser: "not-created" } };
  const origin = NATIVE_OPUS_ORIGIN, documentUrl = origin + "/";
  report.muxerModule={url:NATIVE_OPUS_MODULE_URL,bytes:Buffer.byteLength(muxerSource),sha256:sha(Buffer.from(muxerSource))};
  let browser, closingBrowser = false;
  const failure = (kind, error) => report.errors.push({ kind, message: String(error?.message ?? error) });
  try {
    browser = await browserType.launch({ headless: true });
    browser.on("disconnected", () => { if (!closingBrowser) failure("browser-disconnected", "Native WebKit disconnected unexpectedly"); });
    report.browserVersion = browser.version();
    assert.equal(report.browserVersion, NATIVE_OPUS_RUNTIME.browserVersion, "Native WebKit browser version differs from the runtime pin");
    for (const scenario of nativeOpusProbeCases()) {
      const label = scenario.route + "-" + scenario.mix, row = { ...scenario, ...nativeOpusAcceptance(),
        feasibility: "starting", requests: [], errors: [], artifacts: [], cleanup: { context: "not-created" } };
      report.cases.push(row);
      let context, page, state, savedRaw = false;
      const error = (kind, value) => row.errors.push({ kind, message: String(value?.message ?? value) });
      try {
        context = await browser.newContext({ ...NATIVE_OPUS_CONTEXT });
        await context.addInitScript(installNativeOpusGuard);
        const sources = sourceInputs.map((input, index) => ({ ...input, url: origin + "/source/" + index + ".mp3" }));
        await context.route("**/*", async intercepted => {
          const request = intercepted.request(), url = request.url(); row.requests.push({ url, method: request.method() });
          try {
            await intercepted.fulfill(nativeOpusFixtureResponse({url,method:request.method()},{muxerSource,sources}));
          } catch (caught) { error("route-driver", caught);
            try { await intercepted.abort(); } catch (abortError) { error("route-cleanup", abortError); } }
        });
        page = await context.newPage(); page.setDefaultTimeout(15000);
        page.on("pageerror", caught => error("pageerror", caught));
        page.on("crash", () => error("page-crash", "Native diagnostic page crashed"));
        page.on("console", message => { if (message.type() === "error") error("console-error", message.text()); });
        page.on("requestfailed", request => error("requestfailed", request.url() + " " + request.failure()?.errorText));
        page.on("response", response => { if (response.status() >= 400) error("http-error", response.status() + " " + response.url()); });
        await page.goto(documentUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
        await page.evaluate(({ implementation, args }) => {
          globalThis.__V177_NATIVE_OPUS_RESULT = null;
          const run = (0, eval)("(" + implementation + ")");
          globalThis.__V177_NATIVE_OPUS_PROMISE = run(args).then(result => { globalThis.__V177_NATIVE_OPUS_RESULT = result; });
        }, { implementation: runNativeOpusProbe.toString(), args: { muxerUrl:NATIVE_OPUS_MODULE_URL,
          sourceUrls: sources.map(({ data, ...input }) => { void data; return input; }), ...scenario } });
        await page.waitForFunction(() => document.documentElement.dataset.probeReady === "1" || globalThis.__V177_NATIVE_OPUS_RESULT, null, { timeout: 15000 });
        if (!await page.evaluate(() => Boolean(globalThis.__V177_NATIVE_OPUS_RESULT))) {
          await page.getByRole("button", { name: "Start native Opus probe", exact: true }).click();
          await page.waitForFunction(() => globalThis.__V177_NATIVE_OPUS_STATE?.startedFromNativeClick === true
            || globalThis.__V177_NATIVE_OPUS_RESULT, null, { timeout: 15000 });
          if (scenario.mix === "bgm-se") {
            await page.waitForTimeout(1000);
            if (!await page.evaluate(() => Boolean(globalThis.__V177_NATIVE_OPUS_RESULT))) {
              await page.getByRole("button", { name: "Fire existing rifle effect", exact: true }).click();
            }
          }
        }
        await page.waitForFunction(() => Boolean(globalThis.__V177_NATIVE_OPUS_RESULT), null, { timeout: 15000 });
        state = await page.evaluate(() => globalThis.__V177_NATIVE_OPUS_RESULT);
        const saved = await retainNativeOpusRaw(label, state, writeArtifact); savedRaw = true; row.artifacts.push(...saved.artifacts);
        row.status = state.status; row.encoderSupport = state.encoderSupport ?? null; row.mediaSourceSupported = state.mediaSourceSupported ?? null;
        row.activity = state.activity; row.inputFrames = state.inputFrames; row.probeErrors = state.errors; row.probeCleanupErrors = state.cleanupErrors;
        assert.equal(state.schemaVersion, 1); assert.equal(state.diagnosticOnly, true);
        for (const key of Object.keys(nativeOpusAcceptance())) assert.equal(state[key], false, "Acceptance must remain false: " + key);
        assert.equal(state.activity?.realtimeAudioContextAttempts, 0); assert.equal(state.activity?.microphoneAttempts, 0);
        assert.equal(state.errors.length, 0, "Native API/stream failure retained in raw evidence");
        assert.equal(state.cleanupErrors.length, 0, "Native probe cleanup failed");
        if (state.status.startsWith("unsupported-")) { row.feasibility = "unsupported"; }
        else {
          assert.equal(state.status, "complete", "Native Opus stream did not finish");
          row.packetProof = verifyNativeOpusRemux(state, saved.encoded);
          const decoded = await page.evaluate(decodeNativeOpusContent, Array.from(saved.encoded));
          for (let channel = 0; channel < decoded.channelData.length; channel++) {
            row.artifacts.push(await writeArtifact(label + "-decoded-channel" + channel + ".f32le", Buffer.from(decoded.channelData[channel])));
          }
          row.content = analyseOpusPcm({ decoded, reference: state.referencePcm, background: state.backgroundPcm, effect: state.effect });
          row.evidence = evaluateNativeOpusEvidence(state, row.content);
          assert.equal(row.evidence.passed, true, row.evidence.errors.join("; "));
          row.feasibility = "native-probe-passed-not-production-or-physical-acceptance";
        }
        assert.equal(row.requests.filter(request => request.url === documentUrl).length, 1, "Diagnostic document request count changed");
        assert.equal(row.requests.filter(request => request.url === NATIVE_OPUS_MODULE_URL).length,
          state.moduleRequested?1:0,"Pinned module request count changed");
        for (const original of sources) assert.equal(row.requests.filter(request => request.url === original.url).length,
          state.sourceSignals ? 1 : 0, "Original source request count changed");
      } catch (caught) {
        error("driver-or-probe", caught); row.feasibility = "failed";
        if (!savedRaw && page) {
          try {
            state = await page.evaluate(() => { const value = globalThis.__V177_NATIVE_OPUS_STATE;
              if (value) value.stopRequested = true; return value ?? null; });
            if (state) {
              state.referencePcm ??= []; state.backgroundPcm ??= [];
              const saved = await retainNativeOpusRaw(label, state, writeArtifact); row.artifacts.push(...saved.artifacts);
              row.partialRaw = true; savedRaw = true;
            }
          } catch (rawError) { error("partial-raw-retention", rawError); }
        }
      } finally {
        if (context) {
          try { await context.close(); row.cleanup.context = "completed"; }
          catch (caught) { row.cleanup.context = "failed"; error("context-cleanup", caught); }
        }
        if (row.errors.length) row.feasibility = "failed";
        await writeArtifact(label + "-case.json", Buffer.from(JSON.stringify(row, null, 2) + "\n"));
      }
    }
  } catch (caught) { failure("browser-or-driver", caught); }
  finally {
    if (browser) { closingBrowser = true;
      try { await browser.close(); report.cleanup.browser = "completed"; }
      catch (caught) { report.cleanup.browser = "failed"; failure("browser-cleanup", caught); } }
  }
  if (report.cases.length !== 4) failure("case-contract", "All four bounded native cases were not attempted");
  report.status = report.errors.length || report.cases.some(row => row.feasibility === "failed") ? "failed" : "completed-diagnostic";
  return report;
}

export async function runHostedNativeOpusDiagnostic() {
  // Both host and exact source are checked BEFORE importing any browser runtime.
  assertNativeOpusHost(process.platform, process.env);
  const git = args => execFileSync("git", args, { encoding: "utf8" }).trim();
  const head = git(["rev-parse", "HEAD"]), expectedHead = process.env.V177_EXPECTED_HEAD_SHA;
  assert.equal(head, expectedHead, "Checked-out source is not the exact PR head");
  const out = process.env.V177_NATIVE_OPUS_OUT ?? "outputs/v177-native-opus";
  const report = { schemaVersion: 1, ...nativeOpusAcceptance(), diagnosticOnly: true, status: "starting", at: new Date().toISOString(),
    scope: "Four-second original BGM/rifle mixes, raw 10ms WebCodecs Opus -> live unprimed WebM MediaSource/ManagedMediaSource on hosted macOS native WebKit. iPhone UA/mobile/touch do not make this physical iOS. No realtime AudioContext, microphone, game server or game is loaded. This cannot certify saved Control Center audio or whole-game quality.",
    provenance: { head, tree: git(["rev-parse", "HEAD^{tree}"]), parents: git(["show", "-s", "--format=%P", "HEAD"]),
      expectedHead, platform: process.platform, arch: process.arch, node: process.version, runnerOS: process.env.RUNNER_OS,
      githubRunId: process.env.GITHUB_RUN_ID ?? null, githubRunAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
      repository: process.env.GITHUB_REPOSITORY ?? null, workflow: process.env.GITHUB_WORKFLOW ?? null },
    runtime: NATIVE_OPUS_RUNTIME, sources: NATIVE_OPUS_SOURCES, sourcePins: [], originalAssets: [], observation: null, errors: [] };
  await mkdir(path.join(out, "source"), { recursive: true });
  const writeArtifact = async (file, bytes) => { await writeFile(path.join(out, file), bytes, { flag: "wx" });
    return { file, bytes: bytes.length, sha256: sha(bytes) }; };
  try {
    const sourceFiles = ["scripts/v177-opus-webm-muxer.mjs", "scripts/v177-native-opus-probe.mjs", "scripts/v177-native-opus-browser.mjs",
      "tests/v177-opus-webm-muxer.test.mjs", "tests/v177-native-opus-probe.test.mjs", ".github/workflows/native-opus-streaming.yml",
      "scripts/pwa-browser-runtime.mjs", "package-lock.json", "scripts/pwa-native-runtime/package.json", "scripts/pwa-native-runtime/package-lock.json",
      "scripts/pwa-native-runtime/node_modules/playwright/package.json", "scripts/pwa-native-runtime/node_modules/playwright-core/browsers.json",
      "app/productionAudio.js", "app/v100SoundDesign.js"];
    for (const file of sourceFiles) {
      const artifact = await writeArtifact("source/repo__" + file.replaceAll("/", "__"), await readFile(file));
      report.sourcePins.push({ source: file, ...artifact });
    }
    const sourceInputs = [];
    for (const original of NATIVE_OPUS_ASSETS) {
      const data = await readFile("public" + original.source);
      assert.equal(data.length, original.bytes, "Original licensed source length changed");
      assert.equal(sha(data), original.expectedSha256, "Original licensed source bytes changed");
      const artifact = await writeArtifact("source/repo__public" + original.source.replaceAll("/", "__"), data);
      report.originalAssets.push({ ...original, ...artifact }); sourceInputs.push({ ...original, data });
    }
    const muxerSource = await readFile("scripts/v177-opus-webm-muxer.mjs", "utf8");
    const { pwaBrowserType, PWA_WEBKIT_RUNTIME } = await import("./pwa-browser-runtime.mjs");
    assert.deepEqual(PWA_WEBKIT_RUNTIME, NATIVE_OPUS_RUNTIME, "Native runtime pin changed");
    report.observation = await observeNativeOpusStreams(await pwaBrowserType("webkit"),
      { platform: process.platform, env: process.env }, { muxerSource, sourceInputs, writeArtifact });
    if (report.observation.status === "failed") report.errors.push({ kind: "native-diagnostic", message: "Native diagnostic failed; original bytes and failed/unsupported cases are retained" });
  } catch (caught) { report.errors.push({ kind: "host-runtime-or-source", message: String(caught?.message ?? caught) }); }
  report.status = report.errors.length ? "failed" : "completed-diagnostic";
  await writeArtifact("report.json", Buffer.from(JSON.stringify(report, null, 2) + "\n"));
  console.log(JSON.stringify({ head, status: report.status, ...nativeOpusAcceptance(),
    cases: report.observation?.cases.map(({ route, mix, feasibility, evidence }) => ({ route, mix, feasibility,
      startupMs: evidence?.startupMs ?? null, firstAdvanceMs: evidence?.firstAdvanceMs ?? null,
      effectLatencyMs: evidence?.effectLatencyMs ?? null, clock: evidence?.clock ?? null })) ?? [] }));
  if (report.status === "failed") process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await runHostedNativeOpusDiagnostic().catch(error => {
    console.error(JSON.stringify({ status: "failed", ...nativeOpusAcceptance(), error: String(error?.message ?? error) })); process.exitCode = 1;
  });
}
