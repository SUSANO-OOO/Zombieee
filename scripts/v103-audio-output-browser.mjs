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
    let failure;
    try {
      await page.addInitScript(seedV100BrowserSaveOnce, serializeV100Save(save));
      await page.goto(new URL("v100", origin).href);
      const play = page.getByRole("button", { name: "ブラウザで遊ぶ", exact: true });
      await play.or(page.locator(".v100-start-screen")).first().waitFor();
      if (await play.isVisible()) await play.click();
      await enterV100FromTitle(page);
      await page.getByRole("button", { name: "戦闘へ", exact: true }).click();
      await page.waitForFunction(() => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().running);
      async function waitForOutputs() {
        await page.waitForFunction(() => {
          const battle = window.__ASHFALL_AUDIO_QA__?.getDiagnostics();
          const ui = window.__V100_EVENT_AUDIO_QA__?.getDiagnostics();
          return battle?.activeBgmVoices === 1 && ui?.activeSceneVoices === 0
            && [battle, ui].every(owner => owner.contextState === "running" && !owner.output?.paused
              && owner.duplicateLoopInstanceKeys.length === 0
              && [...document.querySelectorAll("audio[data-game-audio-output]")]
                .some(audio => audio.srcObject?.id === owner.output?.streamId && !audio.paused && audio.srcObject.active));
        }, null, { timeout: 20000 });
      }
      await waitForOutputs();
      async function capture(label) {
        const sample = await page.evaluate(async () => {
          const sinks = [...document.querySelectorAll("audio[data-game-audio-output]")];
          const active = sinks.filter(audio => !audio.paused && audio.srcObject?.active);
          // The parent event/UI mixer remains mounted while the battle child
          // owns a separate mixer. Bind each real sink to its own context.
          const owners = { battle: window.__ASHFALL_AUDIO_QA__.getDiagnostics(),
            ui: window.__V100_EVENT_AUDIO_QA__.getDiagnostics() };
          const ids = Object.values(owners).map(owner => owner.output?.streamId);
          if (ids.some(id => !id) || new Set(ids).size !== 2 || active.length !== 2)
            throw new Error(`Expected one output per battle/UI owner, got ${active.length}`);
          if (ids.some(id => active.filter(audio => audio.srcObject.id === id).length !== 1))
            throw new Error("Native output does not match its owning context");
          if (Object.values(owners).some(owner => owner.output.mode !== "media-stream"
            || owner.contextState !== "running" || owner.duplicateLoopInstanceKeys.length))
            throw new Error(`Invalid or duplicated owner mix: ${JSON.stringify(Object.fromEntries(Object.entries(owners)
              .map(([name, owner]) => [name, { state: owner.contextState, output: owner.output, duplicates: owner.duplicateLoopInstanceKeys }])) )}`);
          if (owners.ui.activeSceneVoices !== 0 || owners.battle.activeBgmVoices !== 1)
            throw new Error("Departing scene or duplicate battle music is still active");
          const sink = active.find(audio => audio.srcObject.id === owners.battle.output.streamId), stream = sink.srcObject;
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
          // Decode saved bytes without opening another hardware audio session
          // that could interrupt the very outputs being measured on WebKit.
          const decoder = new OfflineAudioContext(2, 1, 44100);
          {
            const buffer = await decoder.decodeAudioData(bytes.slice(0));
            let sum = 0, peak = 0, count = 0;
            for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
              const values = buffer.getChannelData(channel);
              for (const value of values) { sum += value * value; peak = Math.max(peak, Math.abs(value)); count += 1; }
            }
            return { mimeType: recorder.mimeType, bytes: Array.from(new Uint8Array(bytes)),
              rms: Math.sqrt(sum / count), peak, duration: buffer.duration, sampleRate: buffer.sampleRate,
              channels: buffer.numberOfChannels, outputs: active.length, paused: sink.paused,
              owners: Object.fromEntries(Object.entries(owners).map(([name, owner]) => [name, {
                contextState: owner.contextState, output: owner.output, activeSceneVoices: owner.activeSceneVoices,
                activeBgmVoices: owner.activeBgmVoices, duplicateLoopInstanceKeys: owner.duplicateLoopInstanceKeys,
              }])) };
          }
        });
        const { bytes, ...signal } = sample;
        assert.ok(bytes.length > 1000, `${label}: encoded output is empty`);
        assert.ok(signal.duration >= 1.8 && signal.duration <= 3.5, `${label}: invalid encoded duration`);
        assert.ok(signal.rms > .0001 && signal.peak > .001, `${label}: recorded mix is silent`);
        assert.equal(signal.outputs, 2); assert.equal(signal.paused, false);
        const file = `${width}x${height}-${label}.${signal.mimeType.includes("mp4") ? "m4a" : "webm"}`;
        await writeFile(`${out}/${file}`, Buffer.from(bytes));
        row.recordings.push({ label, file, bytes: bytes.length, ...signal });
      }
      await capture("battle");
      await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
      row.hidden = await page.evaluate(() => [...document.querySelectorAll("audio[data-game-audio-output]")].every(audio => audio.paused));
      assert.equal(row.hidden, true);
      await page.evaluate(() => window.dispatchEvent(new Event("pageshow")));
      await waitForOutputs();
      await capture("recovered");
      await page.screenshot({ path: `${out}/${width}x${height}.png` });
    } catch (error) {
      failure = error; row.failure = String(error);
      row.output = await page.evaluate(() => ({
        text: document.body.innerText.slice(0, 2000),
        owners: { battle: window.__ASHFALL_AUDIO_QA__?.getDiagnostics(), ui: window.__V100_EVENT_AUDIO_QA__?.getDiagnostics() },
        sinks: [...document.querySelectorAll("audio[data-game-audio-output]")].map(audio => ({
          paused: audio.paused, readyState: audio.readyState, active: audio.srcObject?.active,
          tracks: audio.srcObject?.getAudioTracks().map(track => ({ readyState: track.readyState, muted: track.muted })),
        })),
      })).catch(() => null);
      await page.screenshot({ path: `${out}/${width}x${height}-failure.png` }).catch(() => {});
    } finally {
      try { await requests.closeContext(context); }
      catch (error) { row.cleanupError = String(error); failure ??= error; }
      row.requests = requests.report;
      if (requests.report.unexpectedFailures.length) failure ??= new Error("Unexpected browser request failure");
    }
    if (failure) throw failure;
  }
  assert.deepEqual(report.errors, []); report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = String(error);
} finally {
  try { await browser.close(); }
  catch (error) { report.cleanupError = String(error); report.status = "failed"; report.failure ??= String(error); }
  await writeFile(`${out}/summary.json`, JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ engine, status: report.status, cases: report.cases.length, errors: report.errors.length }));
if (report.status !== "passed") process.exitCode = 1;
