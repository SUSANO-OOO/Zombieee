import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pwaBrowserType } from "./pwa-browser-runtime.mjs";
import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";
import { installRequestFailureAudit } from "./browser-request-failure-audit.mjs";
import { AacFragmentMuxer } from "./v177-aac-fragment-muxer.mjs";
import { runNativeAacProbe, analyseNativeAacContent, assertNativeAacHostedPlatform, nativeAacProbeCases, nativeAacClockEvidence } from "./v177-native-aac-probe.mjs";
import { V100_AUDIO_MANIFEST } from "../app/productionAudio.js";

assertNativeAacHostedPlatform(process.platform);
const origin = new URL(process.env.V100_CAMPAIGN_QA_BASE_URL);
assert.ok(["127.0.0.1", "localhost"].includes(origin.hostname));
const engine = process.env.V103_AUDIO_ENGINE ?? "webkit";
const out = process.env.V177_NATIVE_AAC_OUT ?? "outputs/v177-native-aac";
await mkdir(out, { recursive: true });
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const file = async (name, bytes) => { await writeFile(out + "/" + name, bytes, { flag: "wx" });
  return { file: name, bytes: bytes.length, sha256: sha(bytes) }; };
const music = V100_AUDIO_MANIFEST.assetById["music-v100-score-normal"];
const riflePool = V100_AUDIO_MANIFEST.poolById["weapon-rifle"];
assert.ok(music && riflePool);
const rifle = V100_AUDIO_MANIFEST.assetById[riflePool.assetIds[0]];
const sourceUrls = await Promise.all([music, rifle].map(async asset => {
  const source = asset.sources.find(item => item.type === "audio/mpeg");
  assert.ok(source, "Existing licensed MP3 is required");
  return { id: asset.id, url: new URL(source.src, origin).href, source: source.src,
    expectedSha256: sha(await readFile("public" + source.src)) };
}));
const muxerSource = await readFile(new URL("./v177-aac-fragment-muxer.mjs", import.meta.url), "utf8");
const report = { at: new Date().toISOString(), engine, build: await productionBuildIdentity(),
  diagnosticOnly: true, physicalRecordingAccepted: false, productionBackendAccepted: false,
  scope: "Hosted WebCodecs AAC -> MSE/ManagedMediaSource with no realtime AudioContext, existing BGM and rifle; native playhead/content/latency only",
  cases: [], errors: [] };
const browser = await (await pwaBrowserType(engine)).launch();
try {
  for (const scenario of nativeAacProbeCases()) {
    const {route,mix,variant} = scenario;
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 26_7_1 like Mac OS X) AppleWebKit/605.1.15 Version/26.7 Mobile/15E148 Safari/604.1" });
    const page = await context.newPage(), audit = installRequestFailureAudit(page);
    const row = { route, mix, variant, artifacts: [] }; report.cases.push(row);
    const label = route + (variant === "original" ? "" : "-" + variant) + "-" + mix;
    page.on("pageerror", error => report.errors.push(String(error)));
    page.on("response", response => { if (response.status() >= 400) report.errors.push(response.status() + " " + response.url()); });
    try {
      await context.route("**/__v177-native-aac-probe", request => request.fulfill({ contentType: "text/html",
        body: '<!doctype html><meta charset="utf-8"><title>Native AAC diagnostic</title><button id="start-probe">Start native audio probe</button><button id="weapon-probe">Fire existing rifle effect</button>' }));
      await page.addInitScript(() => {
        globalThis.__v177RealtimeAudioContextAttempts = 0;
        for (const name of ["AudioContext", "webkitAudioContext"]) {
          const Native = globalThis[name]; if (!Native) continue;
          globalThis[name] = new Proxy(Native, { construct() {
            globalThis.__v177RealtimeAudioContextAttempts++;
            throw new Error("Realtime AudioContext is forbidden in this native transport diagnostic");
          } });
        }
      });
      await page.goto(new URL("__v177-native-aac-probe", origin).href);
      await page.evaluate(({ implementation, args }) => {
        globalThis.__v177ProbeResult = null;
        const run = (0, eval)("(" + implementation + ")");
        globalThis.__v177ProbePromise = run(args).then(result => { globalThis.__v177ProbeResult = result; });
      }, { implementation: runNativeAacProbe.toString(), args: { muxerSource, sourceUrls: structuredClone(sourceUrls), ...scenario } });
      await page.waitForFunction(() => document.documentElement.dataset.probeReady === "1" || globalThis.__v177ProbeResult, null, { timeout: 15000 });
      if (!await page.evaluate(() => Boolean(globalThis.__v177ProbeResult))) {
        await page.getByRole("button", { name: "Start native audio probe", exact: true }).click();
        if (mix === "bgm-se") {
          await page.waitForTimeout(1000);
          await page.getByRole("button", { name: "Fire existing rifle effect", exact: true }).click();
        }
      }
      await page.waitForFunction(() => Boolean(globalThis.__v177ProbeResult), null, { timeout: 15000 });
      const result = await page.evaluate(() => globalThis.__v177ProbeResult);
      const { packets, configurations, referencePcm, backgroundPcm, ...metadata } = result;
      const indexes = []; let offset = 0;
      const data = packets.map(packet => {
        const bytes = Buffer.from(packet.data);
        indexes.push({ ...packet, data: undefined, offset, bytes: bytes.length, sha256: sha(bytes) }); offset += bytes.length;
        return bytes;
      });
      // Native bytes/configuration/PCM survive even when clock, mux, decode or latency fails.
      row.artifacts.push(await file(label + "-packets.bin", Buffer.concat(data)));
      row.artifacts.push(await file(label + "-reference.f32le", Buffer.from(referencePcm)));
      row.artifacts.push(await file(label + "-background.f32le", Buffer.from(backgroundPcm)));
      row.artifacts.push(await file(label + "-raw.json", Buffer.from(JSON.stringify({ ...metadata, configurations, packets: indexes }, null, 2))));
      Object.assign(row, metadata);
      if (result.status.startsWith("unsupported-")) { row.feasibility = "unsupported"; continue; }
      assert.equal(result.status, "complete", JSON.stringify(result.errors));
      assert.equal(result.realtimeAudioContexts, 0);
      assert.ok(configurations.length && packets.length);
      const config = configurations[0];
      const muxer = new AacFragmentMuxer(config.description, config);
      const parts = [Buffer.from(muxer.initializationSegment)];
      packets.forEach((packet, index) => {
        assert.ok(Math.abs(packet.timestamp - Math.round(index * 1024 / 48000 * 1e6)) <= 1, "Native timestamp mismatch");
        assert.ok(packet.duration !== null && Math.abs(packet.duration - 1024 / 48000 * 1e6) <= 1, "Native duration mismatch");
        parts.push(Buffer.from(muxer.segment([{ data: Uint8Array.from(packet.data), timestampSamples: index * 1024, durationSamples: 1024 }])));
      });
      const encoded = Buffer.concat(parts);
      row.artifacts.push(await file(label + "-encoded.m4a", encoded));
      row.content = await page.evaluate(analyseNativeAacContent, {
        encoded: Array.from(encoded), reference: referencePcm, background: backgroundPcm, effect: result.effect });
      row.clock = nativeAacClockEvidence(result);
      await writeFile(out + "/summary.json", JSON.stringify(report, null, 2));
      assert.ok(row.content.duration >= 3.5 && row.content.duration <= 4.5, "Native decoded duration invalid");
      assert.ok(row.content.rms > .0001 && row.content.peak > .001, "Native decoded mix silent");
      assert.ok(row.content.correlation > .7, "Decoded AAC does not retain existing music content");
      assert.ok(result.finalMedia.time >= result.inputDuration - .15, "Native playback did not consume the complete stream");
      assert.equal(result.finalMedia.muted, false); assert.equal(result.finalMedia.volume, 1);
      const first = result.events.find(event => event.event === "playing");
      row.startupMs = first?.ms ?? null;
      assert.ok(first && first.ms <= 150, "Native streaming startup exceeds the 150ms diagnostic latency budget");
      const stalls = result.events.filter(event => event.event === "waiting" && event.ms > first.ms
        && event.time < result.inputDuration - .05);
      row.underflows = stalls;
      assert.equal(stalls.length, 0, "Native stream underflowed during continuous input");
      assert.equal(row.clock.accepted, true, "Observed native media clock exceeded the same 150ms streaming budget");
      if (mix === "bgm-se") {
        assert.ok(result.effect, "Native effect click was not recorded");
        assert.ok(row.content.effectCorrelation > .6, "Rifle content absent from decoded mixed AAC");
        const position = (result.effect.firstInputFrame + Math.max(0, row.content.lagSamples)) / 48000;
        const reached = result.playheads.find(sample => sample.time >= position);
        row.effectLatencyMs = reached ? reached.ms - result.effect.requestedAtMs : null;
        assert.ok(row.effectLatencyMs !== null && row.effectLatencyMs >= 0 && row.effectLatencyMs <= 150,
          "Rifle native playhead latency exceeds the 150ms diagnostic budget");
      }
      row.feasibility = "native-probe-passed-not-production-or-physical-acceptance";
    } catch (error) { row.failure = String(error); row.feasibility = "failed"; }
    finally {
      try { await audit.closeContext(context); } catch (error) { row.cleanupFailure = String(error); }
      row.requests = audit.report;
      if (audit.report.unexpectedFailures.length || row.cleanupFailure) row.feasibility = "failed";
      await writeFile(out + "/summary.json", JSON.stringify(report, null, 2));
    }
  }
} finally {
  await browser.close();
  await writeFile(out + "/summary.json", JSON.stringify(report, null, 2));
}
assert.equal(report.errors.length, 0, JSON.stringify(report.errors));
assert.ok(report.cases.every(row => row.feasibility !== "failed"), "Native AAC diagnostic failed; raw evidence retained");
console.log(JSON.stringify({ engine, diagnosticOnly: true, cases: report.cases.map(({ route, mix, feasibility, startupMs, effectLatencyMs }) =>
  ({ route, mix, feasibility, startupMs, effectLatencyMs })), physicalRecordingAccepted: false, productionBackendAccepted: false }));
