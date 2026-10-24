import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const webkitRevision = "5a73a281aa54a019d11a86612dfcbc8582ea84ca";
const webkitSource = file => `https://github.com/WebKit/WebKit/blob/${webkitRevision}/${file}`;
export const NATIVE_AUDIO_CAPABILITY_RUNTIME = Object.freeze({ packageVersion: "1.63.0", revision: "2359", browserVersion: "26.6" });
export const NATIVE_AUDIO_CAPABILITY_CONTEXT = Object.freeze({ viewport: Object.freeze({ width: 844, height: 390 }),
  isMobile: true, hasTouch: true, serviceWorkers: "block",
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 26_7_1 like Mac OS X) AppleWebKit/605.1.15 Version/26.7 Mobile/15E148 Safari/604.1" });
export const NATIVE_AUDIO_CAPABILITY_SOURCES = Object.freeze([
  { id: "pcm-registration", url: "https://www.w3.org/TR/2026/DNOTE-webcodecs-pcm-codec-registration-20260608/",
    scope: "Draft registers pcm-s16 as interleaved signed 16-bit PCM. It does not require PCM encoding support or specify an MP4 MIME codec token." },
  { id: "opus-registration", url: "https://www.w3.org/TR/2026/DNOTE-webcodecs-opus-codec-registration-20260924/",
    scope: "Draft defines opus encoder configuration and frameDuration in microseconds. Support remains implementation-dependent." },
  { id: "cocoa-codec-parser", url: webkitSource("Source/WebCore/platform/audio/cocoa/AudioDecoderCocoa.cpp#L135"),
    scope: "Pinned WebKit source recognizes pcm-s16, opus and mp4a AAC codec names; it is not evidence about the installed iPhone build." },
  { id: "cocoa-encoder", url: webkitSource("Source/WebCore/platform/audio/cocoa/AudioEncoderCocoa.cpp#L107"),
    scope: "Pinned Cocoa encoder validates codec names with the shared parser and handles PCM output descriptions and Opus configuration." },
  { id: "webkit-media-formats", url: "https://webkit.org/blog/16574/webkit-features-in-safari-18-4/",
    scope: "Documents PCM/ALAC recording and fragmented MP4 use with SourceBuffer; it does not promise audio-only PCM streaming latency or OS recording." },
  { id: "webkit-pcm-mse-test", url: webkitSource("LayoutTests/http/wpt/mediarecorder/MediaRecorder-AV-audio-video-dataavailable.html#L87"),
    scope: "The official test records video/mp4; codecs=avc1.42000a,pcm and appends the completed file to a video/mp4 SourceBuffer. Audio-only codec=pcm is a query hypothesis, not a documented equivalent of WebCodecs pcm-s16." },
]);

export const NATIVE_AUDIO_ENCODER_QUERIES = Object.freeze([
  { id: "pcm-s16-48k-stereo", sourceIds: ["pcm-registration", "cocoa-codec-parser", "cocoa-encoder"],
    configuration: { codec: "pcm-s16", sampleRate: 48000, numberOfChannels: 2 } },
  { id: "aac-lc-48k-stereo", sourceIds: ["cocoa-codec-parser", "cocoa-encoder"],
    configuration: { codec: "mp4a.40.2", sampleRate: 48000, numberOfChannels: 2, bitrate: 192000, aac: { format: "aac" } } },
  { id: "opus-10ms-48k-stereo", sourceIds: ["opus-registration", "cocoa-codec-parser", "cocoa-encoder"],
    configuration: { codec: "opus", sampleRate: 48000, numberOfChannels: 2, bitrate: 192000, opus: { format: "opus", frameDuration: 10000 } } },
]);
export const NATIVE_AUDIO_MIME_QUERIES = Object.freeze([
  { id: "mp4-container", mimeType: "audio/mp4", sourceIds: ["webkit-media-formats"], scope: "Container-only query; codec support cannot be inferred." },
  { id: "pcm-audio-mp4-hypothesis", mimeType: 'audio/mp4; codecs="pcm"', sourceIds: ["webkit-pcm-mse-test"], scope: "Audio-only combination to investigate; not the WebCodecs pcm-s16 token." },
  { id: "pcm-av-mp4-control", mimeType: 'video/mp4; codecs="avc1.42000a,pcm"', sourceIds: ["webkit-pcm-mse-test"], scope: "Official recorder test configuration; static support is not a streaming test." },
  { id: "aac-audio-mp4", mimeType: 'audio/mp4; codecs="mp4a.40.2"', sourceIds: ["cocoa-codec-parser", "webkit-media-formats"], scope: "Existing AAC diagnostic MIME control." },
  { id: "opus-audio-mp4", mimeType: 'audio/mp4; codecs="opus"', sourceIds: ["cocoa-codec-parser", "webkit-media-formats"], scope: "Audio-only container/codec query; encoding and playback are separate capabilities." },
  { id: "opus-audio-webm", mimeType: 'audio/webm; codecs="opus"', sourceIds: ["webkit-media-formats"], scope: "WebM/Opus query; no decoding, muxing or latency is measured." },
]);

const acceptance = () => ({ productionBackendAccepted: false, physicalRecordingAccepted: false,
  latencyAccepted: false, wholeGameAccepted: false, gameBackendChanged: false, productionGameLoaded: false });

export function assertNativeAudioCapabilitiesHost(platform, env) {
  if (platform !== "darwin" || env?.GITHUB_ACTIONS !== "true" || env?.RUNNER_OS !== "macOS") {
    throw new Error("Native audio capability diagnostic is hosted macOS/GitHub Actions only; local browser, game and audio launch is prohibited");
  }
}

// Serialized into an empty HTTPS page. Proxies block construction without changing
// the receiver used by native static capability methods. No media is created.
export function installNativeAudioCapabilityGuard() {
  const activity = { constructorAttempts: {}, mediaElementAttempts: 0, playAttempts: 0, loadAttempts: 0 };
  Object.defineProperty(globalThis, "__V177_NATIVE_AUDIO_CAPABILITY_ACTIVITY", { value: activity });
  for (const name of ["AudioContext", "webkitAudioContext", "OfflineAudioContext", "webkitOfflineAudioContext",
    "AudioEncoder", "AudioDecoder", "AudioData", "MediaRecorder", "MediaSource", "ManagedMediaSource", "Audio"]) {
    const Native = globalThis[name];
    if (typeof Native !== "function") continue;
    const reject = () => { activity.constructorAttempts[name] = (activity.constructorAttempts[name] ?? 0) + 1;
      throw new Error("Media construction is forbidden in this capability-only diagnostic: " + name); };
    globalThis[name] = new Proxy(Native, { construct: reject, apply: reject,
      get(target, key) { const value = Reflect.get(target, key, target);
        return ["isConfigSupported", "isTypeSupported"].includes(key) && typeof value === "function" ? value.bind(target) : value; } });
  }
  for (const name of ["createElement", "createElementNS"]) {
    const original = document[name];
    document[name] = function (...args) {
      const tag = String(args[name === "createElement" ? 0 : 1]).toLowerCase();
      if (["audio", "video"].includes(tag)) { activity.mediaElementAttempts++;
        throw new Error("Media elements are forbidden in this capability-only diagnostic"); }
      return Reflect.apply(original, this, args);
    };
  }
  for (const name of ["play", "load"]) {
    if (!globalThis.HTMLMediaElement?.prototype) continue;
    globalThis.HTMLMediaElement.prototype[name] = function () {
      activity[name === "play" ? "playAttempts" : "loadAttempts"]++;
      throw new Error("Media playback/loading is forbidden in this capability-only diagnostic");
    };
  }
}

// Self-contained and mockable. API absence, a false answer and an API exception
// remain different observations. None of them establishes a usable audio route.
export async function probeNativeAudioCapabilities({ encoderQueries, mimeQueries, timeoutMs = 3000 }) {
  const clone = value => JSON.parse(JSON.stringify(value));
  const describe = error => ({ name: String(error?.name ?? "Error"), message: String(error?.message ?? error) });
  const rows = [];
  async function query(apiName, methodName, value, metadata) {
    const row = { ...clone(metadata), api: apiName + "." + methodName, status: "api-unavailable", supported: null };
    rows.push(row);
    let timer;
    try {
      const api = globalThis[apiName], method = api?.[methodName];
      if (typeof method !== "function") { row.reason = api ? "static-method-missing" : "api-missing"; return; }
      const result = await Promise.race([Promise.resolve(Reflect.apply(method, api, [clone(value)])), new Promise((_, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error("Static capability query timed out"), { name: "ApiQueryTimeoutError" })), timeoutMs);
      })]);
      const supported = methodName === "isConfigSupported" ? result?.supported : result;
      if (typeof supported !== "boolean" || (methodName === "isConfigSupported" && (!result?.config || typeof result.config !== "object"))) {
        row.status = "invalid-response"; row.error = { name: "InvalidCapabilityResponse", message: "Static API did not return its required boolean/configuration shape" }; return;
      }
      row.supported = supported; row.status = supported ? "supported" : "unsupported";
      if (methodName === "isConfigSupported") row.normalizedConfiguration = clone(result.config);
    } catch (error) { row.status = "api-exception"; row.error = describe(error); }
    finally { clearTimeout(timer); }
  }
  for (const item of encoderQueries) await query("AudioEncoder", "isConfigSupported", item.configuration, item);
  for (const api of ["MediaSource", "ManagedMediaSource", "MediaRecorder"]) {
    for (const item of mimeQueries) await query(api, "isTypeSupported", item.mimeType, item);
  }
  return { schemaVersion: 1, diagnosticOnly: true, productionBackendAccepted: false,
    physicalRecordingAccepted: false, latencyAccepted: false, wholeGameAccepted: false,
    gameBackendChanged: false, productionGameLoaded: false,
    environment: { isSecureContext: globalThis.isSecureContext === true, userAgent: globalThis.navigator?.userAgent ?? null,
      mediaElements: globalThis.document?.querySelectorAll?.("audio,video").length ?? null }, rows,
    activity: clone(globalThis.__V177_NATIVE_AUDIO_CAPABILITY_ACTIVITY ?? null) };
}

export function validateNativeAudioCapabilities(result) {
  const errors = [];
  if (result?.schemaVersion !== 1 || result?.diagnosticOnly !== true) errors.push("Invalid diagnostic schema");
  for (const key of Object.keys(acceptance())) if (result?.[key] !== false) errors.push("Acceptance must remain false: " + key);
  if (result?.environment?.isSecureContext !== true) errors.push("Capability page was not a secure context");
  if (result?.environment?.mediaElements !== 0) errors.push("Capability page contained media elements or was not inspected");
  const expected = NATIVE_AUDIO_ENCODER_QUERIES.map(item => ({ ...item, api: "AudioEncoder.isConfigSupported" }));
  for (const api of ["MediaSource", "ManagedMediaSource", "MediaRecorder"]) {
    expected.push(...NATIVE_AUDIO_MIME_QUERIES.map(item => ({ ...item, api: api + ".isTypeSupported" })));
  }
  const rows = Array.isArray(result?.rows) ? result.rows : [];
  if (rows.length !== expected.length) errors.push("Missing or extra static capability observations");
  expected.forEach((item, index) => {
    const row = rows[index];
    if (!row || row.id !== item.id || row.api !== item.api
      || JSON.stringify(row.configuration ?? row.mimeType) !== JSON.stringify(item.configuration ?? item.mimeType)
      || JSON.stringify(row.sourceIds) !== JSON.stringify(item.sourceIds)) errors.push("Query binding mismatch at " + index);
    if (["supported", "unsupported"].includes(row?.status)) {
      if (row.supported !== (row.status === "supported")) errors.push("Invalid boolean result at " + index);
      if (item.configuration && (!row.normalizedConfiguration || Array.isArray(row.normalizedConfiguration)
        || ["codec", "sampleRate", "numberOfChannels"].some(key => row.normalizedConfiguration[key] !== item.configuration[key]))) errors.push("Invalid normalized encoder configuration at " + index);
    } else if (["api-unavailable", "api-exception"].includes(row?.status)) {
      if (row.supported !== null || (row.status === "api-exception" && (typeof row.error?.name !== "string" || typeof row.error?.message !== "string"))) errors.push("Invalid unavailable/exception result at " + index);
      if (row.status === "api-unavailable" && !["api-missing", "static-method-missing"].includes(row.reason)) errors.push("Missing API availability reason at " + index);
    } else errors.push("Invalid API response at " + index);
  });
  const activity = result?.activity;
  if (!activity || typeof activity.constructorAttempts !== "object" || activity.constructorAttempts === null || Array.isArray(activity.constructorAttempts)
    || Object.values(activity.constructorAttempts).some(count => count !== 0)
    || [activity.mediaElementAttempts, activity.playAttempts, activity.loadAttempts].some(count => count !== 0)) errors.push("Media creation or playback occurred, or activity guard was missing");
  return { valid: errors.length === 0, errors };
}

export async function observeNativeAudioCapabilities(browserType, host) {
  assertNativeAudioCapabilitiesHost(host?.platform, host?.env);
  const report = { ...acceptance(), diagnosticOnly: true, status: "starting", result: null,
    browserVersion: null, contextOptions: NATIVE_AUDIO_CAPABILITY_CONTEXT,
    requests: [], errors: [], cleanup: { context: "not-created", browser: "not-created" } };
  const url = "https://v177-audio-capabilities.invalid/";
  let browser, context, closingBrowser = false;
  const failure = (kind, error) => report.errors.push({ kind, message: String(error?.message ?? error) });
  try {
    browser = await browserType.launch({ headless: true });
    browser.on("disconnected", () => { if (!closingBrowser) failure("browser-disconnected", "Native WebKit disconnected unexpectedly"); });
    report.browserVersion = browser.version();
    assert.equal(report.browserVersion, NATIVE_AUDIO_CAPABILITY_RUNTIME.browserVersion, "Native browser version differs from its pin");
    context = await browser.newContext({ ...NATIVE_AUDIO_CAPABILITY_CONTEXT });
    await context.addInitScript(installNativeAudioCapabilityGuard);
    await context.route("**/*", async route => {
      try {
        const requestUrl = route.request().url(); report.requests.push(requestUrl);
        if (requestUrl !== url) { failure("unexpected-request", requestUrl); await route.abort(); return; }
        await route.fulfill({ contentType: "text/html", body: '<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; img-src data:"><link rel="icon" href="data:,"><title>Static native audio capabilities</title>' });
      } catch (error) {
        failure("route-driver", error);
        try { await route.abort(); } catch (abortError) { failure("route-cleanup", abortError); }
      }
    });
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    page.on("pageerror", error => failure("pageerror", error));
    page.on("crash", () => failure("page-crash", "Capability page crashed"));
    page.on("console", message => { if (message.type() === "error") failure("console-error", message.text()); });
    page.on("requestfailed", request => failure("requestfailed", request.url() + " " + request.failure()?.errorText));
    page.on("response", response => { if (response.status() >= 400) failure("http-error", response.status() + " " + response.url()); });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    report.result = await page.evaluate(probeNativeAudioCapabilities, { encoderQueries: NATIVE_AUDIO_ENCODER_QUERIES, mimeQueries: NATIVE_AUDIO_MIME_QUERIES });
    const validation = validateNativeAudioCapabilities(report.result);
    validation.errors.forEach(error => failure("result-validation", error));
    if (report.requests.length !== 1 || report.requests[0] !== url) failure("request-contract", "Expected exactly one intercepted diagnostic document request");
  } catch (error) { failure("driver-or-browser", error); }
  finally {
    if (context) {
      try { await context.close(); report.cleanup.context = "completed"; }
      catch (error) { report.cleanup.context = "failed"; failure("context-cleanup", error); }
    }
    if (browser) {
      closingBrowser = true;
      try { await browser.close(); report.cleanup.browser = "completed"; }
      catch (error) { report.cleanup.browser = "failed"; failure("browser-cleanup", error); }
    }
  }
  report.status = report.errors.length ? "failed" : "completed-diagnostic";
  return report;
}

export async function runHostedNativeAudioCapabilities() {
  // Must run before the dynamic browser/runtime import and before any output writes.
  assertNativeAudioCapabilitiesHost(process.platform, process.env);
  const git = args => execFileSync("git", args, { encoding: "utf8" }).trim();
  const head = git(["rev-parse", "HEAD"]), expectedHead = process.env.V177_EXPECTED_HEAD_SHA;
  assert.match(expectedHead ?? "", /^[a-f0-9]{40}$/u, "An exact PR head is required");
  assert.equal(head, expectedHead, "Checked-out source is not the exact PR head");
  assert.ok(["pull_request","workflow_dispatch"].includes(process.env.GITHUB_EVENT_NAME), "Only an exact candidate diagnostic event may run");
  const out = process.env.V177_NATIVE_AUDIO_CAPABILITIES_OUT ?? "outputs/v177-native-audio-capabilities";
  const report = { schemaVersion: 1, ...acceptance(), diagnosticOnly: true, status: "starting", at: new Date().toISOString(),
    scope: "Static API answers in hosted native macOS WebKit with the existing AAC probe's iPhone UA/mobile/touch conditions; the backend remains macOS, not physical iOS. No AudioContext, encoder, recorder, media element, game, audio playback, muxing, latency or iPhone Control Center recording is exercised.",
    provenance: { head, tree: git(["rev-parse", "HEAD^{tree}"]), parents: git(["show", "-s", "--format=%P", "HEAD"]),
      expectedHead, platform: process.platform, arch: process.arch, node: process.version, runnerOS: process.env.RUNNER_OS,
      githubRunId: process.env.GITHUB_RUN_ID ?? null, githubRunAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
      repository: process.env.GITHUB_REPOSITORY ?? null, workflow: process.env.GITHUB_WORKFLOW ?? null },
    runtime: NATIVE_AUDIO_CAPABILITY_RUNTIME, sources: NATIVE_AUDIO_CAPABILITY_SOURCES,
    sourcePins: [], rawCapabilityArtifact: null, observation: null, errors: [] };
  await mkdir(out + "/source", { recursive: true });
  try {
    for (const file of ["scripts/v177-native-audio-capabilities.mjs", "tests/v177-native-audio-capabilities.test.mjs",
      ".github/workflows/native-audio-capabilities.yml", "scripts/pwa-browser-runtime.mjs", "package-lock.json",
      "scripts/pwa-native-runtime/package.json", "scripts/pwa-native-runtime/package-lock.json",
      "scripts/pwa-native-runtime/node_modules/playwright/package.json", "scripts/pwa-native-runtime/node_modules/playwright-core/browsers.json"]) {
      const bytes = await readFile(file), retainedFile = "source/repo__" + file.replaceAll("/", "__");
      await writeFile(path.join(out, retainedFile), bytes, { flag: "wx" });
      report.sourcePins.push({ file, retainedFile, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
    }
    const { pwaBrowserType, PWA_WEBKIT_RUNTIME } = await import("./pwa-browser-runtime.mjs");
    assert.deepEqual(PWA_WEBKIT_RUNTIME, NATIVE_AUDIO_CAPABILITY_RUNTIME, "Shared native runtime pin changed");
    report.observation = await observeNativeAudioCapabilities(await pwaBrowserType("webkit"), { platform: process.platform, env: process.env });
    if (report.observation.result) {
      const raw = Buffer.from(JSON.stringify(report.observation.result, null, 2) + "\n");
      await writeFile(out + "/capabilities-raw.json", raw, { flag: "wx" });
      report.rawCapabilityArtifact = { file: "capabilities-raw.json", bytes: raw.length, sha256: createHash("sha256").update(raw).digest("hex") };
    }
    report.errors.push(...report.observation.errors);
  } catch (error) { report.errors.push({ kind: "host-or-runtime", message: String(error?.message ?? error) }); }
  report.status = report.errors.length ? "failed" : "completed-diagnostic";
  await writeFile(out + "/report.json", JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ head, status: report.status, ...acceptance(), apiExceptions: report.observation?.result?.rows.filter(row => row.status === "api-exception").length ?? null }));
  if (report.status === "failed") process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await runHostedNativeAudioCapabilities().catch(error => {
    console.error(JSON.stringify({ status: "failed", ...acceptance(), error: String(error?.message ?? error) }));
    process.exitCode = 1;
  });
}
