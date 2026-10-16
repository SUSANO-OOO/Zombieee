import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { NATIVE_AUDIO_CAPABILITY_RUNTIME, NATIVE_AUDIO_CAPABILITY_CONTEXT, NATIVE_AUDIO_CAPABILITY_SOURCES,
  NATIVE_AUDIO_ENCODER_QUERIES, NATIVE_AUDIO_MIME_QUERIES, assertNativeAudioCapabilitiesHost,
  installNativeAudioCapabilityGuard, probeNativeAudioCapabilities, validateNativeAudioCapabilities,
  observeNativeAudioCapabilities } from "../scripts/v177-native-audio-capabilities.mjs";

const host = { platform: "darwin", env: { GITHUB_ACTIONS: "true", RUNNER_OS: "macOS" } };
const activity = () => ({ constructorAttempts: {}, mediaElementAttempts: 0, playAttempts: 0, loadAttempts: 0 });
const clone = value => JSON.parse(JSON.stringify(value));
const parameters = () => ({ encoderQueries: clone(NATIVE_AUDIO_ENCODER_QUERIES), mimeQueries: clone(NATIVE_AUDIO_MIME_QUERIES) });
const runProbe = (globals, args = parameters()) => vm.runInNewContext("(" + probeNativeAudioCapabilities.toString() + ")", {
  isSecureContext: true, navigator: { userAgent: "mock-native-webkit" }, document: { querySelectorAll: () => [] },
  __V177_NATIVE_AUDIO_CAPABILITY_ACTIVITY: activity(), setTimeout, clearTimeout, ...globals,
})(args);
function staticApis() {
  class Encoder {
    static async isConfigSupported(config) { assert.equal(this, Encoder); return { supported: config.codec !== "opus", config }; }
    constructor() { throw new Error("No encoder construction is permitted"); }
  }
  class Source { static isTypeSupported(mime) { return mime.includes("mp4a"); } constructor() { throw new Error("No source construction is permitted"); } }
  class Recorder { static isTypeSupported() { return false; } constructor() { throw new Error("No recorder construction is permitted"); } }
  return { AudioEncoder: Encoder, MediaSource: Source, ManagedMediaSource: Source, MediaRecorder: Recorder };
}

test("Host guard rejects every local platform, including macOS outside GitHub Actions", () => {
  for (const platform of ["win32", "linux", "freebsd", undefined]) assert.throws(() => assertNativeAudioCapabilitiesHost(platform, host.env), /hosted macOS/u);
  for (const env of [{}, { GITHUB_ACTIONS: "true" }, { GITHUB_ACTIONS: "false", RUNNER_OS: "macOS" }, { GITHUB_ACTIONS: "true", RUNNER_OS: "Linux" }]) {
    assert.throws(() => assertNativeAudioCapabilitiesHost("darwin", env), /hosted macOS/u);
  }
  assert.doesNotThrow(() => assertNativeAudioCapabilitiesHost(host.platform, host.env));
});

test("CLI rejects the local host before loading browser dependencies or writing artifacts", () => {
  const script = fileURLToPath(new URL("../scripts/v177-native-audio-capabilities.mjs", import.meta.url));
  const child = spawnSync(process.execPath, [script], { encoding: "utf8", timeout: 10000,
    env: { ...process.env, GITHUB_ACTIONS: "false", V177_EXPECTED_HEAD_SHA: "a".repeat(40) } });
  assert.equal(child.status, 1); assert.equal(child.error, undefined);
  const output = JSON.parse(child.stderr.trim());
  assert.match(output.error, /hosted macOS\/GitHub Actions only/u);
  assert.equal(output.productionBackendAccepted, false); assert.equal(output.physicalRecordingAccepted, false);
  assert.equal(output.latencyAccepted, false);
  const source = readFileSync(script, "utf8");
  const start = source.indexOf("export async function runHostedNativeAudioCapabilities");
  assert.ok(source.indexOf("assertNativeAudioCapabilitiesHost(process.platform, process.env)", start)
    < source.indexOf('await import("./pwa-browser-runtime.mjs")', start));
});

test("Static answers preserve exact configurations, source bindings and unsupported booleans", async () => {
  const result = await runProbe(staticApis());
  assert.equal(validateNativeAudioCapabilities(result).valid, true);
  assert.equal(result.rows.length, NATIVE_AUDIO_ENCODER_QUERIES.length + 3 * NATIVE_AUDIO_MIME_QUERIES.length);
  assert.deepEqual(clone(result.rows[0].configuration), NATIVE_AUDIO_ENCODER_QUERIES[0].configuration);
  assert.equal(result.rows[2].status, "unsupported"); assert.equal(result.rows[2].supported, false);
  assert.ok(result.rows.some(row => row.api === "MediaSource.isTypeSupported" && row.status === "supported"));
  assert.ok(result.rows.some(row => row.api === "MediaRecorder.isTypeSupported" && row.status === "unsupported"));
  assert.equal(result.productionBackendAccepted, false); assert.equal(result.latencyAccepted, false);
  assert.equal(result.physicalRecordingAccepted, false); assert.equal(result.wholeGameAccepted, false);
});

test("Missing APIs and static methods are observations rather than a successful backend or driver failure", async () => {
  const result = await runProbe({ AudioEncoder: {}, MediaRecorder: {} });
  assert.equal(validateNativeAudioCapabilities(result).valid, true);
  assert.ok(result.rows.every(row => row.status === "api-unavailable" && row.supported === null));
  assert.equal(result.rows[0].reason, "static-method-missing");
  assert.equal(result.rows[3].reason, "api-missing");
});

test("API exceptions remain distinct from unsupported answers, including throwing API getters", async () => {
  const apis = staticApis();
  apis.AudioEncoder.isConfigSupported = async () => { throw Object.assign(new Error("Native codec query failed"), { name: "OperationError" }); };
  apis.MediaSource.isTypeSupported = () => { throw new TypeError("Native MIME query failed"); };
  const result = await runProbe(apis);
  assert.equal(validateNativeAudioCapabilities(result).valid, true);
  assert.equal(result.rows[0].status, "api-exception"); assert.equal(result.rows[0].supported, null);
  assert.equal(result.rows[0].error.name, "OperationError");
  assert.ok(result.rows.some(row => row.status === "unsupported"));
  const getterGlobals = { isSecureContext: true, document: { querySelectorAll: () => [] }, __V177_NATIVE_AUDIO_CAPABILITY_ACTIVITY: activity(), setTimeout, clearTimeout };
  const getterProbe = vm.runInNewContext("Object.defineProperty(globalThis, 'AudioEncoder', { get() { throw new Error('Access denied'); } }); (" + probeNativeAudioCapabilities.toString() + ")", getterGlobals);
  assert.equal((await getterProbe(parameters())).rows[0].status, "api-exception");
});

test("Hanging static encoder query is bounded and cannot become an unsupported answer", async () => {
  const result = await runProbe({ AudioEncoder: { isConfigSupported: () => new Promise(() => {}) } }, {
    encoderQueries: [clone(NATIVE_AUDIO_ENCODER_QUERIES[0])], mimeQueries: [], timeoutMs: 5,
  });
  assert.equal(result.rows[0].status, "api-exception"); assert.equal(result.rows[0].error.name, "ApiQueryTimeoutError");
  assert.equal(result.rows[0].supported, null);
});

test("Malformed native responses fail validation instead of being coerced to supported", async () => {
  const apis = staticApis();
  apis.AudioEncoder.isConfigSupported = async () => ({ supported: "true", config: {} });
  apis.MediaSource.isTypeSupported = () => 1;
  const result = await runProbe(apis);
  assert.equal(result.rows[0].status, "invalid-response");
  assert.equal(validateNativeAudioCapabilities(result).valid, false);
});

test("Schema is fail-closed against missing, duplicate, rebound or promoted results", async () => {
  const original = await runProbe(staticApis());
  for (const mutate of [result => { result.rows.pop(); }, result => { result.rows[1] = result.rows[0]; },
    result => { result.rows[0].configuration.sampleRate = 44100; }, result => { result.rows[0].sourceIds = []; },
    result => { result.physicalRecordingAccepted = true; }, result => { result.latencyAccepted = true; },
    result => { result.environment.isSecureContext = false; }, result => { result.environment.mediaElements = 1; }, result => { result.activity = null; },
    result => { result.activity.constructorAttempts.AudioEncoder = 1; }, result => { result.activity.playAttempts = 1; },
    result => { result.rows[0].supported = null; }, result => { delete result.rows[0].normalizedConfiguration; },
    result => { result.rows[0].normalizedConfiguration.sampleRate = 44100; }, result => { result.activity.constructorAttempts = []; }]) {
    const changed = clone(original); mutate(changed); assert.equal(validateNativeAudioCapabilities(changed).valid, false);
  }
});

test("Construction/playback guard preserves native static receivers and blocks media before creation", async () => {
  let realConstructions = 0, elementCreations = 0;
  class Encoder { constructor() { realConstructions++; } static async isConfigSupported(config) { assert.equal(this, Encoder); return { supported: true, config }; } }
  class Media { play() { realConstructions++; } load() { realConstructions++; } }
  const sandbox = { AudioEncoder: Encoder, AudioContext: Encoder, MediaRecorder: Encoder,
    HTMLMediaElement: Media, document: { createElement() { elementCreations++; }, createElementNS() { elementCreations++; } } };
  vm.runInNewContext("(" + installNativeAudioCapabilityGuard.toString() + ")()", sandbox);
  assert.equal((await sandbox.AudioEncoder.isConfigSupported({ codec: "pcm-s16" })).supported, true);
  assert.throws(() => new sandbox.AudioEncoder(), /construction is forbidden/u);
  assert.throws(() => new sandbox.AudioContext(), /construction is forbidden/u);
  assert.throws(() => new sandbox.MediaRecorder(), /construction is forbidden/u);
  assert.throws(() => sandbox.document.createElement("audio"), /elements are forbidden/u);
  assert.throws(() => sandbox.document.createElementNS("http://www.w3.org/1999/xhtml", "video"), /elements are forbidden/u);
  assert.throws(() => Media.prototype.play(), /playback\/loading is forbidden/u);
  assert.equal(realConstructions, 0); assert.equal(elementCreations, 0);
  assert.equal(sandbox.__V177_NATIVE_AUDIO_CAPABILITY_ACTIVITY.constructorAttempts.AudioEncoder, 1);
});

function mockBrowser({ errorAt, event, contextCloseError, browserCloseError } = {}) {
  const closed = [], handlers = {}, pageHandlers = {};
  const page = { setDefaultTimeout() {}, on(name, callback) { pageHandlers[name] = callback; },
    async goto() { if (errorAt === "goto") throw new Error("Navigation driver failed");
      await handlers.route({ request: () => ({ url: () => event === "unexpected-request" ? "https://unexpected.invalid/" : "https://v177-audio-capabilities.invalid/" }),
        fulfill: async () => { if (errorAt === "route") throw new Error("Route driver failed"); }, abort: async () => {} });
      if (event === "pageerror") pageHandlers.pageerror(new Error("Unexpected page error"));
      if (event === "requestfailed") pageHandlers.requestfailed({ url: () => "https://unexpected.invalid/", failure: () => ({ errorText: "failed" }) });
      if (event === "disconnected") handlers.disconnected(); },
    async evaluate() { return runProbe(staticApis()); } };
  const context = { async addInitScript() {}, async route(_pattern, callback) { handlers.route = callback; },
    async newPage() { return page; }, async close() { closed.push("context"); if (contextCloseError) throw new Error("Context cleanup failed"); } };
  return { closed, type: { async launch() { if (errorAt === "launch") throw new Error("Launch driver failed");
    return { on(name, callback) { handlers[name] = callback; }, version: () => "26.6", async newContext(options) { assert.deepEqual(options, NATIVE_AUDIO_CAPABILITY_CONTEXT); return context; },
      async close() { closed.push("browser"); if (browserCloseError) throw new Error("Browser cleanup failed"); } }; } } };
}

test("Driver closes resources and records only a completed diagnostic with no acceptance", async () => {
  const fake = mockBrowser(), report = await observeNativeAudioCapabilities(fake.type, host);
  assert.equal(report.status, "completed-diagnostic"); assert.deepEqual(fake.closed, ["context", "browser"]);
  assert.equal(report.productionBackendAccepted, false); assert.equal(report.physicalRecordingAccepted, false);
  assert.equal(report.contextOptions.isMobile, true); assert.equal(report.contextOptions.hasTouch, true);
  assert.match(report.contextOptions.userAgent, /iPhone OS 26_7_1/u);
  const blocked = mockBrowser();
  await assert.rejects(observeNativeAudioCapabilities(blocked.type, { platform: "win32", env: host.env }), /hosted macOS/u);
  assert.deepEqual(blocked.closed, []);
});

test("Unexpected driver, page, request, disconnect and cleanup failures stay failed", async () => {
  for (const options of [{ errorAt: "launch" }, { errorAt: "goto" }, { errorAt: "route" }, { event: "pageerror" },
    { event: "requestfailed" }, { event: "unexpected-request" }, { event: "disconnected" }, { contextCloseError: true }, { browserCloseError: true }]) {
    const fake = mockBrowser(options), report = await observeNativeAudioCapabilities(fake.type, host);
    assert.equal(report.status, "failed"); assert.ok(report.errors.length > 0);
    assert.equal(report.latencyAccepted, false); assert.equal(report.physicalRecordingAccepted, false);
    if (options.errorAt !== "launch") assert.deepEqual(fake.closed, ["context", "browser"]);
  }
});

test("Dedicated workflow binds the exact PR head, read-only permissions, runtime install and no-cancel contract", () => {
  const workflow = readFileSync(new URL("../.github/workflows/native-audio-capabilities.yml", import.meta.url), "utf8");
  assert.match(workflow, /pull_request:\s+paths:/u);
  assert.deepEqual([...workflow.matchAll(/^      - '([^']+)'$/gmu)].map(match => match[1]), [
    ".github/workflows/native-audio-capabilities.yml", "scripts/v177-native-audio-capabilities.mjs", "tests/v177-native-audio-capabilities.test.mjs",
  ]);
  assert.match(workflow, /permissions:\s+contents: read/u); assert.match(workflow, /cancel-in-progress: false/u);
  assert.match(workflow, /runs-on: macos-15-intel/u); assert.match(workflow, /timeout-minutes: 15/u);
  assert.match(workflow, /ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/u);
  assert.match(workflow, /persist-credentials: false/u);
  assert.match(workflow, /V177_EXPECTED_HEAD_SHA: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/u);
  assert.match(workflow, /npm ci --prefix scripts\/pwa-native-runtime/u);
  assert.match(workflow, /pwa-native-runtime\/node_modules\/playwright\/cli\.js install webkit/u);
  assert.match(workflow, /if-no-files-found: error/u);
  assert.doesNotMatch(workflow, /workflow_dispatch|pull_request_target|continue-on-error|contents: write|npm run build|run-browser-qa-with-server/u);
});

test("Source references distinguish PCM encoder tokens from the unproven audio-only MP4 hypothesis", () => {
  assert.deepEqual(NATIVE_AUDIO_ENCODER_QUERIES[0].configuration, { codec: "pcm-s16", sampleRate: 48000, numberOfChannels: 2 });
  const sourceIds = new Set(NATIVE_AUDIO_CAPABILITY_SOURCES.map(source => source.id));
  for (const row of [...NATIVE_AUDIO_ENCODER_QUERIES, ...NATIVE_AUDIO_MIME_QUERIES]) {
    assert.ok(row.sourceIds.length > 0 && row.sourceIds.every(id => sourceIds.has(id)));
  }
  assert.match(NATIVE_AUDIO_MIME_QUERIES.find(row => row.id === "pcm-audio-mp4-hypothesis").scope, /not the WebCodecs/u);
  const nativePackage = JSON.parse(readFileSync(new URL("../scripts/pwa-native-runtime/package.json", import.meta.url), "utf8"));
  assert.equal(nativePackage.dependencies.playwright, NATIVE_AUDIO_CAPABILITY_RUNTIME.packageVersion);
});
