import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { pwaBrowserType } from "./pwa-browser-runtime.mjs";
import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";
import { enterV100FromTitle, seedV100BrowserSaveOnce } from "./v100-title-qa-entry.mjs";
import { createDefaultV100Save, normalizeV100Save, serializeV100Save } from "../app/v100Save.js";
import { V100_UNITS, V100_STAGE_IDS } from "../app/v100Registry.js";
import { installRequestFailureAudit } from "./browser-request-failure-audit.mjs";

if (process.platform === "win32") throw new Error("Audio QA is hosted-only; local browser and audio playback are disabled");
const origin = new URL(process.env.V100_CAMPAIGN_QA_BASE_URL);
assert.ok(["localhost", "127.0.0.1"].includes(origin.hostname));
const engine = process.env.V103_AUDIO_ENGINE ?? "webkit";
const out = process.env.V103_AUDIO_OUT ?? `outputs/v103-audio-${engine}`;
await mkdir(out, { recursive: true });
const report = { engine, build: await productionBuildIdentity(),
  scope: "Production iPhone-UA media output, native stream encoding and decoded signal. macOS/Linux browser evidence; not iOS Control Center screen recording.",
  cases: [], errors: [] };
const owned = V100_UNITS.map(unit => unit.id);
const save = normalizeV100Save({ ...createDefaultV100Save(), campaignStarted: true, revision: 3,
  ownedUnitIds: owned, registeredUnitIds: owned, formationSlots: owned.slice(0, 7),
  flowState: { phase: "formation", stageId: V100_STAGE_IDS[0], stageNumber: 1, eventId: null,
    destination: "formation", nodeIndex: 0, firstClear: false, finalized: true } });
const browser = await (await pwaBrowserType(engine)).launch();
try {
  for (const [width, height] of [[1280, 720], [844, 390], [844, 340]]) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 26_7_1 like Mac OS X) AppleWebKit/605.1.15 Version/26.7 Mobile/15E148 Safari/604.1" });
    const page = await context.newPage(), requests = installRequestFailureAudit(page);
    const row = { width, height, recordings: [] }; report.cases.push(row);
    page.on("pageerror", error => report.errors.push(String(error)));
    page.on("console", message => { if (message.type() === "error") report.errors.push(message.text()); });
    page.on("response", response => { if (response.status() >= 400) report.errors.push(`${response.status()} ${response.url()}`); });
    try {
      await page.addInitScript(seedV100BrowserSaveOnce, serializeV100Save(save));
      await page.goto(new URL("v100", origin).href);
      const play = page.getByRole("button", { name: "ブラウザで遊ぶ", exact: true });
      await play.or(page.locator(".v100-start-screen")).first().waitFor();
      if (await play.isVisible()) await play.click();
      await enterV100FromTitle(page);
      await page.getByRole("button", { name: "戦闘へ", exact: true }).click();
      await page.waitForFunction(() => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().running);
      await page.waitForFunction(() => [...document.querySelectorAll("audio[data-game-audio-output]")]
        .some(audio => !audio.paused && audio.srcObject?.active), null, { timeout: 20000 });
      async function capture(label) {
        const sample = await page.evaluate(async () => {
          const sinks = [...document.querySelectorAll("audio[data-game-audio-output]")];
          const active = sinks.filter(audio => !audio.paused && audio.srcObject?.active);
          if (active.length !== 1) throw new Error(`Expected one active output, got ${active.length}`);
          const sink = active[0], stream = sink.srcObject;
          if (stream.getAudioTracks().length !== 1 || sink.muted || sink.volume !== 1) throw new Error("Invalid native output");
          const mimeType = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find(type => MediaRecorder.isTypeSupported(type));
          if (!mimeType) throw new Error("Native audio encoding is unavailable");
          const chunks = [], recorder = new MediaRecorder(stream, { mimeType });
          const stopped = new Promise((resolve, reject) => {
            recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
            recorder.onerror = reject; recorder.onstop = resolve;
          });
          recorder.start(); await new Promise(resolve => setTimeout(resolve, 2500)); recorder.stop(); await stopped;
          const bytes = await new Blob(chunks, { type: recorder.mimeType }).arrayBuffer();
          const decoder = new AudioContext();
          try {
            const buffer = await decoder.decodeAudioData(bytes.slice(0));
            let sum = 0, peak = 0, count = 0;
            for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
              const values = buffer.getChannelData(channel);
              for (const value of values) { sum += value * value; peak = Math.max(peak, Math.abs(value)); count += 1; }
            }
            return { mimeType: recorder.mimeType, bytes: Array.from(new Uint8Array(bytes)),
              rms: Math.sqrt(sum / count), peak, duration: buffer.duration, sampleRate: buffer.sampleRate,
              channels: buffer.numberOfChannels, outputs: active.length, paused: sink.paused };
          } finally { await decoder.close(); }
        });
        const { bytes, ...signal } = sample;
        assert.ok(bytes.length > 1000, `${label}: encoded output is empty`);
        assert.ok(signal.duration >= 1.8 && signal.duration <= 3.5, `${label}: invalid encoded duration`);
        assert.ok(signal.rms > .0001 && signal.peak > .001, `${label}: recorded mix is silent`);
        assert.equal(signal.outputs, 1); assert.equal(signal.paused, false);
        const file = `${width}x${height}-${label}.${signal.mimeType.includes("mp4") ? "m4a" : "webm"}`;
        await writeFile(`${out}/${file}`, Buffer.from(bytes));
        row.recordings.push({ label, file, bytes: bytes.length, ...signal });
      }
      await capture("battle");
      await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
      row.hidden = await page.evaluate(() => [...document.querySelectorAll("audio[data-game-audio-output]")].every(audio => audio.paused));
      assert.equal(row.hidden, true);
      await page.evaluate(() => window.dispatchEvent(new Event("pageshow")));
      await page.waitForFunction(() => [...document.querySelectorAll("audio[data-game-audio-output]")]
        .some(audio => !audio.paused && audio.srcObject?.active), null, { timeout: 10000 });
      await capture("recovered");
      await requests.settle();
      assert.deepEqual(requests.report.unexpectedFailures, []);
      await page.screenshot({ path: `${out}/${width}x${height}.png` });
    } finally { requests.stop(); await context.close(); }
  }
  assert.deepEqual(report.errors, []); report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = String(error); throw error;
} finally {
  await browser.close(); await writeFile(`${out}/summary.json`, JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ engine, status: report.status, cases: report.cases.length, errors: report.errors.length }));
