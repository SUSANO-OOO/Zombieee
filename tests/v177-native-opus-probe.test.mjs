import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import ts from "typescript";
import { assertNativeOpusHost, installNativeOpusGuard, runNativeOpusProbe, nativeOpusAcceptance, nativeOpusProbeCases,
  NATIVE_OPUS_CONFIGURATION, NATIVE_OPUS_CONTEXT, NATIVE_OPUS_RUNTIME, nativeOpusClockEvidence,
  evaluateNativeOpusEvidence, nativeOpusPacketEvidence, analyseOpusPcm } from "../scripts/v177-native-opus-probe.mjs";
import { observeNativeOpusStreams, retainNativeOpusRaw, verifyNativeOpusRemux, nativeOpusFixtureResponse, NATIVE_OPUS_ASSETS } from "../scripts/v177-native-opus-browser.mjs";
import { OpusWebmMuxer } from "../scripts/v177-opus-webm-muxer.mjs";

const host = { platform: "darwin", env: { GITHUB_ACTIONS: "true", RUNNER_OS: "macOS", GITHUB_EVENT_NAME: "pull_request", V177_EXPECTED_HEAD_SHA: "a".repeat(40) } };
const activity = () => ({ realtimeAudioContextAttempts: 0, microphoneAttempts: 0 });
const unsupported = () => ({ schemaVersion: 1, diagnosticOnly: true, ...nativeOpusAcceptance(),
  status: "unsupported-encoder", packets: [], configurations: [], segments: [], referencePcm: [], backgroundPcm: [],
  errors: [], cleanupErrors: [], activity: activity() });
const writer = rows => async (file, data) => { rows.push({ file, data: Buffer.from(data) });
  return { file, bytes: data.length, sha256: createHash("sha256").update(data).digest("hex") }; };

async function globals(values, fn) {
  const original = new Map(Object.keys(values).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(values)) Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  try { return await fn(); } finally {
    for (const [key, descriptor] of original) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  }
}

test("host guard rejects local, non-PR, missing, simulated or nonexact environments", () => {
  assert.doesNotThrow(() => assertNativeOpusHost(host.platform, host.env));
  for (const platform of ["win32", "linux", undefined]) assert.throws(() => assertNativeOpusHost(platform, host.env));
  for (const change of [{ GITHUB_ACTIONS: undefined }, { GITHUB_ACTIONS: "false" }, { RUNNER_OS: "Windows" },
    { GITHUB_EVENT_NAME: "workflow_dispatch" }, { V177_EXPECTED_HEAD_SHA: "HEAD" }, { V177_EXPECTED_HEAD_SHA: "a".repeat(39) }]) {
    assert.throws(() => assertNativeOpusHost("darwin", { ...host.env, ...change }));
  }
});

test("CLI on this local host fails before runtime import, output writes or browser launch", () => {
  assert.throws(() => execFileSync(process.execPath, ["scripts/v177-native-opus-browser.mjs"], {
    cwd: new URL("..", import.meta.url), encoding: "utf8", env: { ...process.env, GITHUB_ACTIONS: "false" }, stdio: "pipe",
  }), error => error.status === 1 && error.stderr.includes("local browser, game and audio launch is prohibited"));
});

test("serialized browser guard blocks both realtime constructors and microphone methods", async () => {
  let constructed = 0, microphoneCalls = 0;
  class ForbiddenNative { constructor() { constructed++; } }
  const navigator = { mediaDevices: { getUserMedia() { microphoneCalls++; } }, webkitGetUserMedia() { microphoneCalls++; } };
  await globals({ AudioContext: ForbiddenNative, webkitAudioContext: ForbiddenNative, navigator, __V177_NATIVE_OPUS_ACTIVITY: undefined }, async () => {
    const install = (0, eval)("(" + installNativeOpusGuard.toString() + ")"); install();
    assert.throws(() => new globalThis.AudioContext(), /Realtime/);
    assert.throws(() => globalThis.webkitAudioContext(), /Realtime/);
    await assert.rejects(navigator.mediaDevices.getUserMedia({ audio: true }), /Microphone/);
    await assert.rejects(navigator.webkitGetUserMedia({ audio: true }), /Microphone/);
    assert.deepEqual(globalThis.__V177_NATIVE_OPUS_ACTIVITY, { realtimeAudioContextAttempts: 2, microphoneAttempts: 2 });
  });
  assert.equal(constructed, 0); assert.equal(microphoneCalls, 0);
});

async function staticProbe({ response = { supported: true, config: structuredClone(NATIVE_OPUS_CONFIGURATION) }, sourceSupport = true, exception, missing = false }) {
  let constructions = 0, sourceQueries = 0;
  class Encoder {
    constructor() { constructions++; throw new Error("No real encoder may be constructed in this mock test"); }
    static async isConfigSupported(configuration) { assert.deepEqual(configuration, NATIVE_OPUS_CONFIGURATION); if (exception) throw exception; return response; }
  }
  class Source { constructor() { constructions++; } static isTypeSupported() { sourceQueries++; return sourceSupport; } }
  const values = { AudioEncoder: missing ? undefined : Encoder, AudioData: class {}, ManagedMediaSource: Source,
    isSecureContext: true, __V177_NATIVE_OPUS_ACTIVITY: activity(), __V177_NATIVE_OPUS_STATE: undefined };
  const result = await globals(values, async () => {
    // Deliberately serialize to prove there is no outer acceptance/config closure.
    const run = (0, eval)("(" + runNativeOpusProbe.toString() + ")");
    return run({ muxerUrl: "", sourceUrls: [], route: "ManagedMediaSource", mix: "bgm", variant: "live-unprimed-10ms" });
  });
  return { result, constructions, sourceQueries };
}

test("API absence, unsupported and thrown support queries remain separate, silent observations", async () => {
  const absent = await staticProbe({ missing: true }); assert.equal(absent.result.status, "unsupported-encoder-api");
  const no = await staticProbe({ response: { supported: false, config: NATIVE_OPUS_CONFIGURATION } }); assert.equal(no.result.status, "unsupported-encoder");
  const thrown = await staticProbe({ exception: Object.assign(new Error("native query failed"), { name: "OperationError" }) });
  assert.equal(thrown.result.status, "failed"); assert.equal(thrown.result.errors[0].name, "OperationError");
  for (const row of [absent, no, thrown]) { assert.equal(row.constructions, 0); assert.equal(row.sourceQueries, 0);
    for (const value of Object.values(nativeOpusAcceptance())) assert.equal(value, false); }
});

test("supported does not authorize construction when recognized format or 10ms fields were dropped", async () => {
  for (const change of [{ opus: { format: "opus" } }, { opus: { format: "opus", frameDuration: 20000 } },
    { opus: { format: "ogg", frameDuration: 10000 } }, { bitrate: 128000 }, { sampleRate: 44100 }]) {
    const row = await staticProbe({ response: { supported: true, config: { ...NATIVE_OPUS_CONFIGURATION, ...change } } });
    assert.equal(row.result.status, "unsupported-normalized-configuration"); assert.equal(row.constructions, 0); assert.equal(row.sourceQueries, 0);
  }
  const noSource = await staticProbe({ sourceSupport: false });
  assert.equal(noSource.result.status, "unsupported-media-source"); assert.equal(noSource.constructions, 0); assert.equal(noSource.sourceQueries, 1);
  const invalid = await staticProbe({ response: { supported: "true", config: NATIVE_OPUS_CONFIGURATION } });
  assert.equal(invalid.result.status, "failed"); assert.equal(invalid.constructions, 0);
});

function goodState(mix = "bgm") {
  return { schemaVersion: 1, diagnosticOnly: true, ...nativeOpusAcceptance(), status: "complete", mix,
    errors: [], cleanupErrors: [], activity: activity(), sampleRate: 48000, inputFrames: 192000, inputDuration: 4,
    startedFromNativeClick: true, explicitLiveDuration: "Infinity", encoderSupport: { supported: true, config: NATIVE_OPUS_CONFIGURATION },
    nativeHeader: { preSkipSamples: 312, codecDelayNs: 6500000 },
    packets: Array.from({ length: 400 }, (_, i) => ({ timestamp: i * 10000, duration: 10000, framing: { durationUs: 10000 } })),
    events: [{ event: "playing", ms: 50, time: 0 }],
    playheads: Array.from({ length: 400 }, (_, i) => ({ ms: i * 10, time: Math.max(0, i * 10 - 50) / 1000,
      encodedFrames: (i + 1) * 480, playbackRate: 1 })),
    finalMedia: { time: 4, ended: true, muted: false, volume: 1, playbackRate: 1 },
    ...(mix === "bgm-se" ? { effect: { requestedAtMs: 1000, firstInputFrame: 48000 } } : {}) };
}
const content = () => ({ duration: 4, sampleRate: 48000, channels: 2, rms: .05, peak: .3, correlation: .99, effectCorrelation: .9, lagSamples: 0 });

test("every raw input-period native clock sample keeps the original 150ms criterion", () => {
  assert.equal(nativeOpusClockEvidence(goodState()).accepted, true);
  const frozen = goodState(); frozen.playheads.forEach(row => { row.time = row.ms < 400 ? 0 : (row.ms - 400) / 1000; });
  frozen.playheads.push({ ms: 4500, time: 4, finalDrain: true });
  const evidence = nativeOpusClockEvidence(frozen); assert.equal(evidence.accepted, false); assert.ok(Math.abs(evidence.maximumDelayMs - 400) < 1e-9);
  assert.equal(evidence.observedSamples, 400); assert.ok(evidence.outsideBudget > 0);
  for (const change of [{ ms: NaN }, { time: -1 }, { time: 1 }, { encodedFrames: .5 }, { playbackRate: 1.1 }]) {
    const bad = goodState(); Object.assign(bad.playheads[10], change); assert.equal(nativeOpusClockEvidence(bad).accepted, false);
  }
  const ahead = goodState(); ahead.playheads[0].encodedFrames = 48000; assert.equal(nativeOpusClockEvidence(ahead).accepted, false);
});

test("diagnostic evidence cannot promote static support, early playing or physical acceptance", () => {
  const passed = evaluateNativeOpusEvidence(goodState(), content()); assert.equal(passed.passed, true);
  assert.equal(passed.firstAdvanceMs, 60); assert.equal(passed.clock.budgetMs, 150);
  for (const key of Object.keys(nativeOpusAcceptance())) { const bad = goodState(); bad[key] = true;
    assert.equal(evaluateNativeOpusEvidence(bad, content()).passed, false); }
  const delayed = goodState(); delayed.playheads.forEach(row => { row.time = Math.max(0, row.ms - 400) / 1000; });
  const failure = evaluateNativeOpusEvidence(delayed, content()); assert.equal(failure.startupMs, 50); assert.equal(failure.firstAdvanceMs, 410);
  assert.equal(failure.passed, false); assert.ok(failure.errors.some(message => message.includes("advance within 150ms")));
});

test("native negative origins and flush tails remain original observations rather than unsupported routes", () => {
  for (const offset of [-6500, 0, 6500]) {
    const state = goodState(); state.packets.forEach(packet => { packet.timestamp += offset; });
    state.packets.push({ timestamp: state.packets.at(-1).timestamp + 10000, duration: 10000, framing: { durationUs: 10000 } });
    const result = evaluateNativeOpusEvidence(state, content()); assert.equal(result.passed, true);
    assert.equal(result.packetClock.firstTimestampUs, offset); assert.equal(result.packetClock.flushTailPackets, 1);
    assert.equal(result.packetClock.timestampCorrectionUs, 0);
    assert.deepEqual(result.packetClock.declaredWebmPresentationIntervalUs, [offset - 6500, offset + 4010000 - 6500]);
    assert.equal(state.packets[0].timestamp, offset, "Packet evidence did not mutate native timestamps");
  }
  const late = goodState(); late.packets.forEach(packet => { packet.timestamp += 400000; });
  assert.equal(nativeOpusPacketEvidence(late).passed, false, "Native presentation interval cannot conceal 400ms displacement");
  const inconsistent = goodState(); inconsistent.nativeHeader.codecDelayNs = 0;
  assert.equal(nativeOpusPacketEvidence(inconsistent).passed, false);
});

test("startup, stream coverage, content, TOC, cleanup and underflow failures remain failures", () => {
  const changes = [state => { state.events[0].ms = 151; }, state => { state.packets[5].framing.durationUs = 20000; },
    state => { state.packets[5].timestamp++; }, state => { state.packets = []; }, state => { state.playheads.pop(); },
    state => { state.inputFrames = 191520; }, state => { state.cleanupErrors.push({ message: "close failed" }); },
    state => { state.activity.microphoneAttempts = 1; }, state => { state.finalMedia.volume = 0; },
    state => { state.events.push({ event: "waiting", ms: 1500, time: 1.45 }); }];
  for (const change of changes) { const state = goodState(); change(state); assert.equal(evaluateNativeOpusEvidence(state, content()).passed, false); }
  for (const change of [{ duration: 4.6 }, { duration: NaN }, { rms: 0 }, { peak: 1.1 }, { correlation: .7 }]) {
    assert.equal(evaluateNativeOpusEvidence(goodState(), { ...content(), ...change }).passed, false);
  }
  assert.equal(evaluateNativeOpusEvidence(null, null).passed, false);
});

test("rifle criterion preserves source presence and <=150ms native playhead response", () => {
  const state = goodState("bgm-se"); assert.equal(evaluateNativeOpusEvidence(state, content()).effectLatencyMs, 50);
  for (const change of [{ effectCorrelation: .6 }, { lagSamples: 7200 }]) assert.equal(evaluateNativeOpusEvidence(state, { ...content(), ...change }).passed, false);
  delete state.effect; assert.equal(evaluateNativeOpusEvidence(state, content()).passed, false);
});

test("pure PCM analysis distinguishes original background plus rifle from missing rifle content", () => {
  const frames = 192000, bgm = new Float32Array(frames * 2), ref = new Float32Array(frames * 2), mixed = new Float32Array(frames), backgroundOnly = new Float32Array(frames);
  let random = 17;
  for (let i = 0; i < frames; i++) {
    random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
    const music = Math.sin(i * .071) * .03 + (random / 4294967296 - .5) * .02;
    const position = i - 48000, rifle = position >= 0 && position < 24000 ? Math.sin(position * .47) * .12 * Math.exp(-position / 4000) : 0;
    for (let channel = 0; channel < 2; channel++) { bgm[i * 2 + channel] = music; ref[i * 2 + channel] = music + rifle; }
    mixed[i] = music + rifle; backgroundOnly[i] = music;
  }
  const bytes = value => new Uint8Array(value.buffer);
  const analyse = pcm => analyseOpusPcm({ decoded: { sampleRate: 48000, channels: 2, length: frames, duration: 4,
    channelData: [bytes(pcm), bytes(pcm)] }, reference: bytes(ref), background: bytes(bgm), effect: { firstInputFrame: 48000 } });
  const present = analyse(mixed); assert.equal(present.lagSamples, 0); assert.ok(present.correlation > .999 && present.effectCorrelation > .999);
  const absent = analyse(backgroundOnly); assert.ok(absent.effectCorrelation < .6);
  mixed[10] = NaN; assert.throws(() => analyse(mixed), /nonfinite/);
});

function rawFixture() {
  const description = new Uint8Array(19); description.set(new TextEncoder().encode("OpusHead")); description[8] = 1; description[9] = 2;
  const view = new DataView(description.buffer); view.setUint16(10, 312, true); view.setUint32(12, 48000, true);
  const config = { codec: "opus", sampleRate: 48000, numberOfChannels: 2, description: [...description] };
  const muxer = new OpusWebmMuxer(description, config), data = Uint8Array.of(0x94, 4, 5);
  return { ...unsupported(), status: "failed", errors: [{ message: "measured clock failure" }], configurations: [config],
    packets: [{ data: [...data], timestamp: 0, duration: 10000, type: "key", atMs: 40 }],
    appends: [{ segment: 0, returned: true }, { segment: 1, returned: true }],
    segments: [{ data: [...muxer.initializationSegment], atMs: 40 }, { data: [...muxer.segment({ data, timestamp: 0, duration: 10000 })], atMs: 40 }],
    referencePcm: [1, 2, 3, 4], backgroundPcm: [4, 3, 2, 1] };
}

test("original native bytes and failed raw metadata are saved before remux validation", async () => {
  const rows = [], state = rawFixture(), saved = await retainNativeOpusRaw("failed-native", state, writer(rows));
  assert.equal(rows.length, 5); assert.deepEqual(rows[0].data, Buffer.from([0x94, 4, 5]));
  const raw = JSON.parse(rows[4].data); assert.equal(raw.status, "failed"); assert.equal(raw.errors[0].message, "measured clock failure");
  assert.equal(raw.packets[0].timestamp, 0); assert.equal(raw.packets[0].duration, 10000);
  assert.equal(raw.packets[0].offset, 0); assert.equal(raw.packets[0].bytes, 3); assert.deepEqual(raw.configurations[0].description, state.configurations[0].description);
  assert.equal(verifyNativeOpusRemux(state, saved.encoded).codecDelayNs, 6500000);
  state.packets[0].duration = 20000; assert.throws(() => verifyNativeOpusRemux(state, saved.encoded), /TOC/);
  assert.equal(JSON.parse(rows[4].data).packets[0].duration, 10000, "Failed later checks do not rewrite the native original");
});

function mockBrowser(options = {}) {
  const calls = { launch: 0, contexts: 0, closed: 0 };
  const type = { async launch() {
    calls.launch++; if (options.launchFailure) throw new Error("browser launch failed");
    return { on() {}, version: () => NATIVE_OPUS_RUNTIME.browserVersion, async newContext(contextOptions) {
      assert.deepEqual(contextOptions, NATIVE_OPUS_CONTEXT); calls.contexts++; let intercept;
      const page = { on() {}, setDefaultTimeout() {}, async goto(url) {
        const request = target => ({ request: () => ({ url: () => target, method: () => "GET" }), async fulfill() {}, async abort() {} });
        await intercept(request(url)); if (options.unexpectedRequest) await intercept(request("https://outside.invalid/game"));
      }, async evaluate(fn, args) {
        if (args?.implementation) return undefined;
        if (fn.toString().includes("Boolean(")) return true;
        return unsupported();
      }, async waitForFunction() {} };
      return { async addInitScript(fn) { assert.equal(fn, installNativeOpusGuard); }, async route(pattern, fn) { assert.equal(pattern, "**/*"); intercept = fn; },
        async newPage() { return page; }, async close() { calls.closed++; if (options.contextCloseFailure) throw new Error("context cleanup failed"); } };
    }, async close() { if (options.browserCloseFailure) throw new Error("browser cleanup failed"); } };
  } };
  return { type, calls };
}
const sourceInputs = () => NATIVE_OPUS_ASSETS.map(asset => ({ ...asset, data: Buffer.alloc(0) }));

test("owned route serves the exact pinned muxer as a same-origin JavaScript module",async()=>{
  const muxerSource=await readFile(new URL('../scripts/v177-opus-webm-muxer.mjs',import.meta.url),'utf8');
  const fixtures={muxerSource,sources:[{url:'https://v177-native-opus.invalid/source/0.mp3',data:Buffer.from([1,2,3])}]};
  const moduleFixture=nativeOpusFixtureResponse({url:'https://v177-native-opus.invalid/v177-opus-webm-muxer.mjs',method:'GET'},fixtures);
  assert.equal(moduleFixture.body,muxerSource);assert.equal(moduleFixture.contentType,'text/javascript');
  assert.equal(moduleFixture.headers['Cache-Control'],'no-store');
  // Parse the exact served bytes in Node; this creates no browser, encoder,
  // audio element or AudioContext. Native CSP/import still requires remote QA.
  const exported=await import('data:text/javascript;base64,'+Buffer.from(moduleFixture.body).toString('base64'));
  assert.equal(typeof exported.OpusWebmMuxer,'function');
  const document=nativeOpusFixtureResponse({url:'https://v177-native-opus.invalid/',method:'GET'},fixtures);
  const csp=document.body.match(/content="(default-src[^"]+)"/u)[1];
  assert.match(csp,/script-src &#39;self&#39; &#39;unsafe-eval&#39;;/u);
  assert.match(csp,/media-src blob:;/u);assert.doesNotMatch(csp,/script-src[^;]*blob:/u);
  assert.deepEqual(nativeOpusFixtureResponse({url:fixtures.sources[0].url,method:'GET'},fixtures).body,Buffer.from([1,2,3]));
});

test("module fix preserves rejection of the original blob request and all foreign or altered fixtures",()=>{
  const fixtures={muxerSource:'export const fixed = true;',sources:[]};
  for(const url of ['blob:https://v177-native-opus.invalid/old-owned-module',
    'https://outside.invalid/v177-opus-webm-muxer.mjs','https://v177-native-opus.invalid/v177-opus-webm-muxer.mjs?other=1',
    'https://v177-native-opus.invalid/another-module.mjs'])
    assert.throws(()=>nativeOpusFixtureResponse({url,method:'GET'},fixtures),/Unexpected request/u);
  assert.throws(()=>nativeOpusFixtureResponse({url:'https://v177-native-opus.invalid/v177-opus-webm-muxer.mjs',method:'POST'},fixtures),/method/u);
  assert.throws(()=>nativeOpusFixtureResponse({url:'https://v177-native-opus.invalid/v177-opus-webm-muxer.mjs',method:'GET'},
    {...fixtures,muxerSource:''}),/missing/u);
});

test("the actual probe avoids native control resources while keeping its owned Start/Fire gesture and unchanged audio settings",()=>{
  const tree=ts.createSourceFile('probe.mjs',runNativeOpusProbe.toString(),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  const fn=tree.statements[0],block=fn.body.statements.find(ts.isTryStatement).tryBlock.statements;
  const start=block.findIndex(node=>node.getText(tree).startsWith('audio = document.createElement'));
  const end=block.findIndex(node=>node.getText(tree)==='source = new Source();');
  assert.ok(start>=0&&end>=start);
  const requests=[],elements=[];let constructed=0;
  const audio={controls:false,remove(){}};
  const document={createElement:kind=>{assert.equal(kind,'audio');return audio;},body:{append:element=>{
    elements.push(element);if(element.controls)requests.push('blob:https://v177-native-opus.invalid/native-control-icon');
  }}};
  class Source{constructor(){constructed++;}}
  const initialize=new Function('document','Source','let audio,source;'+block.slice(start,end+1).map(node=>node.getText(tree)).join('\n')+';return {audio,source};');
  const actual=initialize(document,Source);
  assert.equal(actual.audio,audio);assert.equal(constructed,1);assert.equal(audio.controls,false);
  assert.equal(elements.length,0);assert.equal(requests.length,0);
  assert.equal(audio.muted,false);assert.equal(audio.volume,1);assert.equal(audio.playbackRate,1);
  assert.equal(audio.preload,'auto');assert.equal(audio.disableRemotePlayback,true);
  const fixtures={muxerSource:'export const fixed=true;',sources:[]};
  const html=nativeOpusFixtureResponse({url:'https://v177-native-opus.invalid/',method:'GET'},fixtures).body;
  assert.match(html,/id="start-probe"/u);assert.match(html,/id="weapon-probe"/u);
  assert.throws(()=>nativeOpusFixtureResponse({url:'blob:https://v177-native-opus.invalid/native-control-icon',method:'GET'},fixtures),/Unexpected request/u);
});

test("mock driver retains all four unsupported observations without creating media or promoting acceptance", async () => {
  const mock = mockBrowser(), rows = [];
  const report = await observeNativeOpusStreams(mock.type, host, { muxerSource: "", sourceInputs: sourceInputs(), writeArtifact: writer(rows) });
  assert.equal(report.status, "completed-diagnostic"); assert.equal(report.cases.length, 4);
  assert.ok(report.cases.every(row => row.feasibility === "unsupported" && row.artifacts.length === 5 && row.requests.length === 1));
  assert.equal(mock.calls.closed, 4); for (const key of Object.keys(nativeOpusAcceptance())) assert.equal(report[key], false);
});

test("unexpected driver/request/cleanup exceptions fail closed, preserving completed raw observations", async () => {
  for (const options of [{ launchFailure: true }, { unexpectedRequest: true }, { contextCloseFailure: true }, { browserCloseFailure: true }]) {
    const mock = mockBrowser(options), rows = [];
    const report = await observeNativeOpusStreams(mock.type, host, { muxerSource: "", sourceInputs: sourceInputs(), writeArtifact: writer(rows) });
    assert.equal(report.status, "failed");
    if (!options.launchFailure) assert.equal(rows.filter(row => row.file.endsWith("-raw.json")).length, 4);
  }
  const mock = mockBrowser(); await assert.rejects(observeNativeOpusStreams(mock.type, { ...host, platform: "win32" }, {
    muxerSource: "", sourceInputs: [], writeArtifact: writer([]) }), /hosted macOS/); assert.equal(mock.calls.launch, 0);
});

test("workflow retains read-only exact head, bounded runtime and independent path-scoped scheduling", async () => {
  const workflow = await readFile(new URL("../.github/workflows/native-opus-streaming.yml", import.meta.url), "utf8");
  assert.match(workflow, /contents: read/u); assert.match(workflow, /cancel-in-progress: false/u);
  assert.match(workflow, /timeout-minutes: 15/u); assert.match(workflow, /runs-on: macos-15-intel/u);
  assert.match(workflow, /ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/u); assert.match(workflow, /fetch-depth: 2/u);
  assert.match(workflow, /persist-credentials: false/u); assert.doesNotMatch(workflow, /workflow_dispatch|pull_request_target|npm run build|server|qa-with-server/u);
  assert.equal((workflow.match(/^      - '/gmu) ?? []).length, 6);
  const source = await readFile(new URL("../scripts/v177-native-opus-browser.mjs", import.meta.url), "utf8");
  assert.ok(source.indexOf("assert.equal(head, expectedHead") < source.indexOf('await import("./pwa-browser-runtime.mjs")'));
  assert.match(source, /source\/repo__/u); assert.doesNotMatch(source, /from ["']\.\.\/app\//u);
  assert.deepEqual(nativeOpusProbeCases().map(row => row.variant), Array(4).fill("live-unprimed-10ms"));
});
