import assert from "node:assert/strict";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { createDefaultV100Save, normalizeV100Save, serializeV100Save } from "../app/v100Save.js";
import { exportV100BrowserSave } from "../app/v100CampaignStorage.js";
import { V100_CREDITS_DURATION, V100_CREDITS_FADE_SECONDS, v100StaffRollResumeSeconds } from "../app/v100StaffRoll.js";
import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";
import { pwaBrowserType } from "./pwa-browser-runtime.mjs";
import { inspectStaffRoll } from "./v100-staff-roll-audit.mjs";
import { V100_CREDITS_FILM } from "../app/v100CreditsFilm.js";
import { startNativeAudioQaOrigin } from "./native-audio-qa-origin.mjs";
import { nativeAudioEofControl } from "./native-audio-tail-seek-control.mjs";
import { installCreditTransitionAudit, assertCreditTransitionProof } from "./v100-staff-roll-transition-audit.mjs";
import { installEndingAudioGainObserver } from "./ending-audio-gain-observer.mjs";
import { enterV100FromTitle } from "./v100-title-qa-entry.mjs";
import { installRequestFailureAudit, isInjectedMedia503Console, finalizeRequestFailureEvidence } from "./browser-request-failure-audit.mjs";

if (process.platform === "win32") throw new Error("Staff-roll audio QA is hosted-only; game or audio playback on this Windows PC is disabled");

const upstreamOrigin = new URL(process.env.V100_CAMPAIGN_QA_BASE_URL ?? "http://127.0.0.1:4177/");
assert.ok(["127.0.0.1", "localhost"].includes(upstreamOrigin.hostname));
// Native WebKit media requests can bypass page.route. Hold or fail them at
// an owned loopback proxy so the loading/failure evidence covers real media.
let holdSong = false, failSongResponse = false;
const transport = await startNativeAudioQaOrigin(upstreamOrigin, { mode: () => failSongResponse ? "fail" : holdSong ? "hold" : "ready" });
const origin = transport.origin;
const engine = process.env.V100_STAFF_ROLL_ENGINE ?? "webkit";
const channel = process.env.V100_STAFF_ROLL_CHANNEL ?? null;
assert.ok(channel === null || (engine === "chromium" && channel === "msedge"), "Only the installed Edge channel may replace local Chromium; WebKit stays independent");
const selection = process.env.V100_STAFF_ROLL_ONLY ?? "all";
assert.ok(["all", "regression", "fallback", "unavailable"].includes(selection), `Unknown staff-roll selection: ${selection}`);
const onlyRegression = selection === "regression";
const out = path.resolve(process.env.V100_STAFF_ROLL_OUT ?? "outputs/v100-staff-roll-native");
await mkdir(out, { recursive: true });
const report = { engine, status: "failed", selection, onlyRegression, build: await productionBuildIdentity(), evidenceKind: "seeded staff-roll media and lifecycle QA; no campaign or physical-device completion claim", cases: [] };
// Native media clocks and volume checks stay active while automated QA is
// silent on the developer's speakers. Listening tests use the audio capture.
const browser = await (await pwaBrowserType(engine)).launch({ headless: true, ...(channel ? { channel } : {}), ...(engine === "chromium" ? { args: ["--mute-audio"] } : {}) });
report.browser = { engine, channel, version: browser.version() };

async function openCase(name, { muted = false, reducedMotion = false, failSong = false, delaySong = false, nodeIndex = 0 } = {}) {
  holdSong = delaySong; failSongResponse = failSong;
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await installEndingAudioGainObserver(page);
  const requestAudit = installRequestFailureAudit(page);
  const result = { name, status: "failed", errors: [], mediaSamples: [], nativeEnded: [],
    requestFailures: requestAudit.report.unexpectedFailures, requestFailureAudit: requestAudit.report,
    injectedConsoleErrors: [], injectedHttpFailures: [] };
  report.cases.push(result);
  page.on("pageerror", error => result.errors.push(String(error)));
  const injectedSongUrl = failSong ? new URL(transport.song.path, origin).href : undefined;
  page.on("console", message => {
    if (message.type() !== "error") return;
    if (isInjectedMedia503Console(message, injectedSongUrl)) result.injectedConsoleErrors.push({ text: message.text(), location: message.location() });
    else result.errors.push(message.text());
  });
  page.on("response", response => {
    if (response.status() < 400) return;
    if (response.status() === 503 && response.url() === injectedSongUrl) result.injectedHttpFailures.push({ status: response.status(), url: response.url() });
    else result.errors.push(`${response.status()} ${response.url()}`);
  });
  const save = normalizeV100Save({ ...createDefaultV100Save({ playerName: "１２文字の主人公名です" }), campaignStarted: true,
    settings: { ...createDefaultV100Save().settings, bgmEnabled: !muted, reducedMotion },
    flowState: { phase: "credits", eventId: "v100:event:credits", stageId: null, stageNumber: null, nodeIndex, finalized: true, firstClear: false, destination: "credits" } });
  await context.addInitScript(({ origin, serialized }) => {
    if (location.origin !== origin) return;
    for (const key of ["nishijin-campaign-v100", "nishijin-campaign-v100:mirror", "nishijin-campaign-v100:last-known-good"]) localStorage.setItem(key, serialized);
    window.__creditMediaProof = { ended: [], samples: [] };
    // Observe actual media handover without replacing native clocks,
    // events, promises or the existing acceptance deadlines.
    window.__creditMediaTrace = { calls: [], promises: [], events: [] };
    const mediaIds = new WeakMap(); let nextMediaId = 1;
    const mediaState = audio => {
      if (!mediaIds.has(audio)) mediaIds.set(audio, nextMediaId++);
      const root = document.querySelector(".v100-staff-roll");
      return { at: performance.now(), mediaId: mediaIds.get(audio), connected: audio.isConnected,
        current: root?.querySelector("audio") === audio, time: audio.currentTime,
        paused: audio.paused, seeking: audio.seeking, readyState: audio.readyState,
        rate: audio.playbackRate, hidden: document.hidden,
        scene: root?.dataset.v100NodeIndex ?? null, state: root?.dataset.v100CreditAudio ?? null,
        surface: document.querySelector("#v100-campaign")?.dataset.v100Surface ?? null,
        dialogs: [...document.querySelectorAll('[role="dialog"]')].filter(node => node.getClientRects().length > 0).map(node => node.getAttribute("aria-label")),
        savePending: document.documentElement.dataset.pwaSaveMutationPending };
    };
    const isSong = audio => audio instanceof HTMLAudioElement && audio.src.includes("/audio/v100/credits/");
    const append = (type, item) => { if (window.__creditMediaTrace[type].length < 4000) window.__creditMediaTrace[type].push(item); };
    const nativePlay = HTMLMediaElement.prototype.play, nativePause = HTMLMediaElement.prototype.pause;
    HTMLMediaElement.prototype.play = function () {
      if (!isSong(this)) return nativePlay.call(this);
      const call = { type: "play", ...mediaState(this) }; append("calls", call);
      const promise = nativePlay.call(this);
      promise.then(() => append("promises", { callAt: call.at, result: "resolved", ...mediaState(this) }),
        error => append("promises", { callAt: call.at, result: "rejected", error: String(error), ...mediaState(this) }));
      return promise;
    };
    HTMLMediaElement.prototype.pause = function () {
      if (isSong(this)) append("calls", { type: "pause", ...mediaState(this) });
      return nativePause.call(this);
    };
    for (const type of ["loadstart", "loadedmetadata", "play", "playing", "pause", "waiting", "canplay", "stalled", "suspend", "seeking", "seeked", "timeupdate", "error", "ended"]) {
      document.addEventListener(type, event => { if (isSong(event.target)) append("events", { type, trusted: event.isTrusted, ...mediaState(event.target) }); }, true);
    }
    document.addEventListener("ended", event => { if (event.target instanceof HTMLAudioElement && event.target.closest(".v100-staff-roll")) window.__creditMediaProof.ended.push({ time: event.target.currentTime, duration: event.target.duration, rate: event.target.playbackRate, trusted: event.isTrusted, ended: event.target.ended }); }, true);
    window.__creditMediaProof.seeks = [];
    document.addEventListener("seeking", event => { if (event.target instanceof HTMLAudioElement && event.target.closest(".v100-staff-roll")) window.__creditMediaProof.seeks.push({ time: event.target.currentTime, rate: event.target.playbackRate }); }, true);
    setInterval(() => {
      const root = document.querySelector(".v100-staff-roll");
      if (root?.querySelector("audio")) window.__lastCreditAudio = root.querySelector("audio");
      const audio = window.__lastCreditAudio;
      if (audio) window.__creditMediaProof.samples.push({ at: performance.now(), scene: root?.dataset.v100NodeIndex ?? null,
        shot: root?.dataset.v100CreditShotIndex ?? null, time: audio.currentTime, duration: audio.duration,
        rate: audio.playbackRate, volume: audio.volume, gain: window.__endingOutputGain(audio), paused: audio.paused, connected: audio.isConnected,
        outro: root?.classList.contains("v100-credits-outro") ?? false, progress: root?.dataset.v100CreditProgress ?? null });
    }, 100);
  }, { origin: origin.origin, serialized: serializeV100Save(save) });
  if (name === "106-second-edit-with-loading-pause-rotation-pagehide") await installCreditTransitionAudit(page);
  await page.goto(new URL("?event-audio-qa=1", origin).href, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "ブラウザで遊ぶ", exact: true }).click();
  await enterV100FromTitle(page);
  await page.locator(".v100-staff-roll").waitFor({ state: "visible" });
  return { page, context, result, requestAudit, releaseSong: () => { holdSong = false; transport.release(); } };
}

async function readClock(page) {
  return page.locator(".v100-staff-roll").evaluate(root => { const audio = root.querySelector("audio"), track = root.querySelector(".v100-credit-roll-track"); return { time: audio.currentTime, paused: audio.paused, progress: root.getAttribute("data-v100-credit-progress"), transform: track.style.transform, state: root.getAttribute("data-v100-credit-audio") }; });
}
async function readReducedFilmFrame(page) {
  return page.locator(".v100-credit-landscape").evaluate(root => {
    const shotIndex = Number(root.dataset.creditRenderedShotIndex);
    const images = [...root.querySelectorAll(".v100-credit-shot")];
    const active = images.filter(image => Number(image.dataset.creditShotIndex) === shotIndex && Number(getComputedStyle(image).opacity) > .99);
    if (active.length !== 1) return null;
    const image = active[0], style = getComputedStyle(image), matrix = new DOMMatrixReadOnly(style.transform);
    return { shotIndex, src: image.currentSrc, decoded: image.dataset.creditDecoded === "true" && image.complete && image.naturalWidth > 0,
      imageCount: images.length, matrix: [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f],
      origin: style.transformOrigin, position: style.objectPosition,
      hiddenBufferOpacity: images.filter(other => other !== image).map(other => Number(getComputedStyle(other).opacity)) };
  });
}
async function readNativeMedia(page) {
  return page.locator(".v100-staff-roll audio").evaluate(audio => ({ time: audio.currentTime, duration: audio.duration, paused: audio.paused,
    seeking: audio.seeking, ended: audio.ended, rate: audio.playbackRate, volume: audio.volume, gain: window.__endingOutputGain(audio), networkState: audio.networkState, readyState: audio.readyState,
    error: audio.error && { code: audio.error.code, message: audio.error.message },
    buffered: [...Array(audio.buffered.length)].map((_, i) => [audio.buffered.start(i), audio.buffered.end(i)]),
    seekable: [...Array(audio.seekable.length)].map((_, i) => [audio.seekable.start(i), audio.seekable.end(i)]) }));
}
async function setVisualSpeed(page, speed) {
  const root = page.locator(".v100-staff-roll");
  for (let attempt = 0; attempt < 3 && await root.getAttribute("data-v100-credit-speed") !== String(speed); attempt++)
    await root.getByRole("button", { name: /映像と文字の速さ/u }).click();
  assert.equal(await root.getAttribute("data-v100-credit-speed"), String(speed));
  assert.equal(await root.locator("audio").evaluate(audio => audio.playbackRate), 1);
}
async function frozen(page, action) {
  const before = await readClock(page);
  await action();
  await page.waitForTimeout(400);
  const stopped = await readClock(page);
  await page.waitForTimeout(1200);
  const after = await readClock(page);
  assert.equal(after.paused, true);
  assert.ok(Math.abs(after.time - stopped.time) < .1, JSON.stringify({ before, stopped, after }));
  assert.equal(after.progress, stopped.progress);
  return { before, stopped, after };
}

let caseError = null;
try {
  if (["all", "regression"].includes(selection)) {
    report.nativeEofControl = {};
    await nativeAudioEofControl(browser, origin, transport.song.path, report.nativeEofControl);
  }
  if (selection === "all") {
  const { page, context, result, releaseSong, requestAudit } = await openCase("106-second-edit-with-loading-pause-rotation-pagehide", { delaySong: true });
  try {
    await page.waitForTimeout(3500);
    result.loading = await readClock(page);
    result.loading.heldNativeRequests = transport.heldRequests();
    assert.ok(transport.heldRequests() > 0);
    assert.equal(result.loading.progress, "0.0000"); assert.equal(result.loading.time, 0);
    releaseSong();
    result.initial = await inspectStaffRoll(page, { playerName: "１２文字の主人公名です" });
    await page.screenshot({ path: path.join(out, `${engine}-initial.png`) });
    // The cinematic transport only contains speed and skip. The game's
    // existing menu still blocks media and the scroll until the player returns.
    result.menu = await frozen(page, () => page.getByRole("button", { name: "メニュー", exact: true }).click());
    await page.getByRole("dialog", { name: "メニュー", exact: true }).getByRole("button", { name: "ゲームに戻る", exact: true }).click();
    await page.waitForFunction(() => !document.querySelector(".v100-staff-roll audio").paused);
    result.rotation = await frozen(page, () => page.setViewportSize({ width: 390, height: 844 }));
    await page.screenshot({ path: path.join(out, `${engine}-portrait-paused.png`) });
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForFunction(() => !document.querySelector(".v100-staff-roll audio").paused);
    result.pageHide = await frozen(page, () => page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide"))));
    result.pageHide.evidence = "synthetic lifecycle event; no physical screen-lock claim";
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow")));
    await page.waitForFunction(() => !document.querySelector(".v100-staff-roll audio").paused);
    await page.getByRole("button", { name: "メニュー", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "メニュー", exact: true });
    await dialog.waitFor({ state: "visible" });
    await dialog.getByRole("button", { name: "権利・クレジット", exact: true }).click();
    assert.ok((await dialog.innerText()).includes("追憶の幻想世界"));
    await page.screenshot({ path: path.join(out, `${engine}-rights.png`) });
    await dialog.getByRole("button", { name: "ゲームに戻る", exact: true }).click();
    console.log(JSON.stringify({ engine, status: "playing-106-second-edit-at-original-music-speed", seeks: 0 }));
    await page.locator('[data-v100-surface="epilogue"]').waitFor({ state: "visible", timeout: 150000 });
    const proof = await page.evaluate(() => ({ ...window.__creditMediaProof, save: JSON.parse(localStorage.getItem("nishijin-campaign-v100")) }));
    result.nativeEnded = proof.ended; result.mediaSamples = proof.samples;
    assert.deepEqual(proof.ended, [], "The edit fades before the unmodified full song reaches EOF");
    assert.deepEqual(proof.seeks, []);
    assert.ok(proof.samples.every(row => row.rate === 1));
    const nominal = result.initial.audio.gain;
    const fade = proof.samples.filter(row => row.outro && row.gain < nominal - .00001);
    assert.ok(fade.length >= 15, "Observe the gradual actual output gain fade");
    assert.ok(fade[0].time >= V100_CREDITS_DURATION - .1 && fade[0].time < V100_CREDITS_DURATION + .35);
    assert.ok(fade.some(row => row.gain === 0 && row.paused && row.time >= V100_CREDITS_DURATION + V100_CREDITS_FADE_SECONDS - .3));
    assert.ok(fade.every((row, index) => index === 0 || row.gain <= fade[index - 1].gain));
    assert.equal(new Set(proof.samples.filter(row => row.scene !== null).map(row => row.scene)).size, 11);
    assert.equal(new Set(proof.samples.filter(row => row.shot !== null).map(row => row.shot)).size, V100_CREDITS_FILM.length);
    result.fade = { startedAtMusicSeconds: fade[0].time, stopped: fade.find(row => row.gain === 0 && row.paused), samples: fade.length, nominal };
    assert.ok(proof.save.readStoryEventIds.includes("v100:event:credits"));
    assert.equal(proof.save.flowState.phase, "epilogue");
    result.filmTransitions = await page.evaluate(() => window.__creditTransitionProof);
    assertCreditTransitionProof(result.filmTransitions, { shots: V100_CREDITS_FILM.length, cuts: V100_CREDITS_FILM.length - 1 });
    assert.deepEqual(result.errors, []); result.status = "passed";
    await page.screenshot({ path: path.join(out, `${engine}-epilogue.png`) });
  } catch (error) {
    result.filmTransitions = await page.evaluate(() => window.__creditTransitionProof).catch(() => null);
    result.failureClock = await readClock(page).catch(() => null);
    result.failureAudio = await page.locator(".v100-staff-roll audio").evaluate(audio => ({ time: audio.currentTime, duration: audio.duration, paused: audio.paused, networkState: audio.networkState, readyState: audio.readyState, error: audio.error && { code: audio.error.code, message: audio.error.message }, buffered: [...Array(audio.buffered.length)].map((_, i) => [audio.buffered.start(i), audio.buffered.end(i)]) })).catch(() => null);
    await page.screenshot({ path: path.join(out, `${engine}-failed.png`) }).catch(() => {});
    throw error;
  } finally {
    result.mediaTrace = await page.evaluate(() => window.__creditMediaTrace).catch(() => null);
    releaseSong(); await requestAudit.closeContext(context); await writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2));
  }

  }
  if (!onlyRegression) for (const [name, options] of [["muted-reduced-motion", { muted: true, reducedMotion: true }], ["audio-unavailable", { failSong: true }]]) {
    if (selection === "unavailable" && !options.failSong) continue;
    const { page, context, result, requestAudit } = await openCase(name, options);
    try {
      await page.waitForFunction(expected => document.querySelector(".v100-staff-roll")?.getAttribute("data-v100-credit-audio") === expected, options.muted ? "muted" : "unavailable");
      if (options.reducedMotion) await page.waitForFunction(() => {
        const root = document.querySelector(".v100-credit-landscape");
        return root && [...root.querySelectorAll(".v100-credit-shot")].some(image => image.dataset.creditShotIndex === root.dataset.creditRenderedShotIndex && image.dataset.creditDecoded === "true" && image.complete && image.naturalWidth > 0 && Number(getComputedStyle(image).opacity) > .99);
      });
      const filmBefore = options.reducedMotion ? await readReducedFilmFrame(page) : null;
      const before = await readClock(page); await page.waitForTimeout(1300); const after = await readClock(page);
      assert.equal(after.paused, true); assert.ok(Number(after.progress) > Number(before.progress));
      if (options.reducedMotion) {
        const filmAfter = await readReducedFilmFrame(page);
        assert.ok(filmBefore?.decoded && filmAfter?.decoded, "The displayed reduced-motion image must be decoded");
        assert.equal(filmBefore.imageCount, 2);
        assert.equal(filmBefore.shotIndex, 0, "Observe the opening composition before the first cut");
        assert.deepEqual(filmBefore.hiddenBufferOpacity, [0]);
        const scale = V100_CREDITS_FILM[filmBefore.shotIndex].camera?.from ?? 1;
        assert.deepEqual(filmBefore.matrix, [scale, 0, 0, scale, 0, 0], "Reduced motion preserves the chosen static framing");
        assert.deepEqual(filmAfter, filmBefore, "The displayed image, framing and hidden buffer must stay fixed while the roll advances");
        result.reducedMotion = { before: filmBefore, after: filmAfter, observationMs: 1300 };
      }
      result.geometry = await page.locator(".v100-credit-buttons").evaluate(root => [...root.querySelectorAll("button")].map(button => { const r = button.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { label: button.textContent, height: r.height, fits: r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth, reachable: hit === button || button.contains(hit) }; }));
      assert.ok(result.geometry.every(row => row.height >= 44 && row.fits && row.reachable));
      await page.screenshot({ path: path.join(out, `${engine}-${name}.png`) });
      await page.getByRole("button", { name: "スキップ", exact: true }).click();
      await page.locator('[data-v100-surface="epilogue"]').waitFor({ state: "visible" });
      assert.deepEqual(result.errors, []); result.status = "passed";
    } catch (error) {
      result.failureClock = await readClock(page).catch(() => null);
      result.failureAudio = await readNativeMedia(page).catch(() => null);
      await page.screenshot({ path: path.join(out, `${engine}-${name}-failed.png`) }).catch(() => {});
      throw error;
    } finally {
      result.mediaTrace = await page.evaluate(() => window.__creditMediaTrace).catch(() => null);
      await requestAudit.closeContext(context);
    }
  }
  if (["all", "regression"].includes(selection)) for (const name of ["saved-scene-resume", "backup-restores-playing-scene", "ended-during-save", "completion-save-failure"]) {
    const nodeIndex = name === "saved-scene-resume" ? 6 : name === "backup-restores-playing-scene" ? 9 : 0;
    const { page, context, result, requestAudit } = await openCase(name, { nodeIndex });
    try {
      result.initial = await inspectStaffRoll(page, { index: nodeIndex, playerName: "１２文字の主人公名です" });
      await page.waitForFunction(() => document.documentElement.dataset.pwaSaveMutationPending === "false");
      if (name === "saved-scene-resume") {
        assert.ok(Math.abs(result.initial.audio.currentTime - v100StaffRollResumeSeconds(6, 11)) < 3);
        await page.waitForFunction(start => {
          const root = document.querySelector(".v100-staff-roll"), audio = root.querySelector("audio");
          return !audio.paused && !audio.seeking && !audio.error && root.dataset.v100CreditAudio === "playing" && audio.currentTime > start + .5;
        }, result.initial.audio.currentTime, { timeout: 2000 });
        result.resumedPlayback = await readNativeMedia(page);
        await page.getByRole("button", { name: "スキップ", exact: true }).click();
      } else if (name === "backup-restores-playing-scene") {
        await page.evaluate(() => { window.__audioBeforeRestore = document.querySelector(".v100-staff-roll audio"); });
        await page.getByRole("button", { name: "メニュー", exact: true }).click();
        await page.getByRole("button", { name: "データ管理", exact: true }).click();
        const restoreSave = normalizeV100Save({ ...createDefaultV100Save({ playerName: "１２文字の主人公名です" }), campaignStarted: true,
          flowState: { phase: "credits", eventId: "v100:event:credits", stageId: null, stageNumber: null, nodeIndex: 2, finalized: true, firstClear: false, destination: "credits" } });
        await page.getByLabel("セーブを復元", { exact: true }).setInputFiles({ name: "credits-scene-2.json", mimeType: "application/json", buffer: Buffer.from(exportV100BrowserSave(restoreSave)) });
        await page.locator('.v100-staff-roll[data-v100-node-index="2"]').waitFor({ state: "visible" });
        result.restored = await inspectStaffRoll(page, { index: 2, playerName: "１２文字の主人公名です" });
        const expected = v100StaffRollResumeSeconds(2, 11, result.restored.audio.duration);
        assert.ok(Math.abs(result.restored.audio.currentTime - expected) < 3, JSON.stringify({ expected, audio: result.restored.audio }));
        result.replacedMedia = await page.evaluate(() => ({
          replaced: document.querySelector(".v100-staff-roll audio") !== window.__audioBeforeRestore,
          oldPaused: window.__audioBeforeRestore.paused, oldConnected: window.__audioBeforeRestore.isConnected,
          audioElements: document.querySelectorAll(".v100-staff-roll audio").length,
        }));
        assert.deepEqual(result.replacedMedia, { replaced: true, oldPaused: true, oldConnected: false, audioElements: 1 });
        await page.locator(".v100-staff-roll audio").evaluate(audio => { window.__audioAfterRestore = audio; });
        await setVisualSpeed(page, 4);
        await page.waitForFunction(() => {
          const saved = JSON.parse(localStorage.getItem("nishijin-campaign-v100"));
          return document.querySelector(".v100-staff-roll")?.dataset.v100NodeIndex === "3" && saved.flowState.nodeIndex === 3 && document.documentElement.dataset.pwaSaveMutationPending === "false";
        }, undefined, { timeout: 15000 });
        result.afterRestoreCheckpoint = await readNativeMedia(page);
        assert.equal(await page.locator(".v100-staff-roll audio").evaluate(audio => audio === window.__audioAfterRestore), true);
        assert.equal(result.afterRestoreCheckpoint.paused, false);
        assert.ok(result.afterRestoreCheckpoint.time > result.restored.audio.currentTime + 1);
        assert.equal(result.afterRestoreCheckpoint.rate, 1);
        await page.getByRole("button", { name: "スキップ", exact: true }).click();
      } else if (name === "ended-during-save") {
        // Use the real four-times visual control while music remains at 1x.
        // Final scene plus fade is under the unchanged six-second save limit.
        await setVisualSpeed(page, 4);
        await page.waitForFunction(() => {
          const root = document.querySelector(".v100-staff-roll"), audio = root.querySelector("audio");
          const saved = JSON.parse(localStorage.getItem("nishijin-campaign-v100"));
          return !audio.seeking && !audio.paused && audio.playbackRate === 1 && root.dataset.v100CreditSpeed === "4" && root.dataset.v100NodeIndex === "9" && document.documentElement.dataset.pwaSaveMutationPending === "false" && saved.flowState.nodeIndex === 9;
        }, undefined, { timeout: 60000 });
        result.beforeHold = await readNativeMedia(page);
        await page.evaluate(() => {
          const original = IDBFactory.prototype.open, held = [], proof = { opens: [], successes: [], errors: [], ended: [], filmComplete: [], busy: [], releases: [] };
          window.__creditSaveHoldProof = proof;
          const observer = new MutationObserver(() => proof.busy.push({ at: performance.now(), pending: document.documentElement.dataset.pwaSaveMutationPending }));
          observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-pwa-save-mutation-pending"] });
          const film = document.querySelector(".v100-staff-roll");
          const filmObserver = new MutationObserver(() => {
            if (proof.filmComplete.length === 0 && film.dataset.v100CreditProgress === "1.0000" && Number(film.style.getPropertyValue("--credit-curtain")) > .999) {
              const audio = film.querySelector("audio");
              proof.filmComplete.push({ at: performance.now(), pending: document.documentElement.dataset.pwaSaveMutationPending, rate: audio.playbackRate, time: audio.currentTime, paused: audio.paused, volume: audio.volume, gain: window.__endingOutputGain(audio) });
            }
          });
          filmObserver.observe(film, { attributes: true, attributeFilter: ["style", "data-v100-credit-progress"] });
          document.addEventListener("ended", event => {
            if (event.target instanceof HTMLAudioElement && event.target.closest(".v100-staff-roll")) proof.ended.push({ at: performance.now(), time: event.target.currentTime, duration: event.target.duration, rate: event.target.playbackRate, trusted: event.isTrusted, ended: event.target.ended, pending: document.documentElement.dataset.pwaSaveMutationPending });
          }, { capture: true });
          window.__releaseCreditSave = () => {
            IDBFactory.prototype.open = original;
            proof.releases.push({ at: performance.now(), held: held.length });
            for (const resume of held.splice(0)) resume();
            observer.disconnect(); filmObserver.disconnect();
          };
          window.__heldCreditSaves = held;
          IDBFactory.prototype.open = function (...args) {
            const openedAt = performance.now();
            let request;
            try { request = original.apply(this, args); }
            catch (error) { proof.errors.push({ at: openedAt, operation: "open", error: String(error) }); throw error; }
            if (!String(args[0]).includes("v100")) return request;
            proof.opens.push({ at: openedAt, name: String(args[0]), nativeRequest: request instanceof IDBOpenDBRequest });
            for (const type of ["error", "blocked"]) request.addEventListener(type, () => proof.errors.push({ at: performance.now(), operation: type, error: String(request.error) }));
            // Preserve the native IDL onsuccess property. Stop delivery only
            // after genuine native success, then invoke its actual handler once.
            request.addEventListener("success", event => {
              event.stopImmediatePropagation();
              const handler = request.onsuccess;
              proof.successes.push({ at: performance.now(), openedAt, handlerType: typeof handler });
              held.push(() => { try { handler?.call(request, event); } catch (error) { proof.errors.push(String(error)); throw error; } });
            }, { capture: true, once: true });
            return request;
          };
        });
        await page.waitForFunction(() => {
          const audio = document.querySelector(".v100-staff-roll audio");
          return !audio.seeking && document.querySelector(".v100-staff-roll").dataset.v100NodeIndex === "10" && document.documentElement.dataset.pwaSaveMutationPending === "true" && window.__heldCreditSaves.length > 0;
        }, undefined, { timeout: 6000 });
        result.afterHold = await readNativeMedia(page);
        await page.waitForFunction(() => window.__creditSaveHoldProof.filmComplete.length === 1, undefined, { timeout: 6000 });
        result.busyAtEnd = await page.evaluate(() => window.__creditSaveHoldProof.filmComplete[0].pending);
        assert.equal(result.busyAtEnd, "true");
        result.atEnd = await readNativeMedia(page);
        assert.equal(result.atEnd.error, null);
        await page.evaluate(() => window.__releaseCreditSave());
        result.holdProof = await page.evaluate(() => window.__creditSaveHoldProof);
        assert.deepEqual(result.holdProof.errors, []);
        assert.deepEqual(result.holdProof.ended, []);
        assert.equal(result.holdProof.filmComplete[0].rate, 1);
        assert.equal(result.holdProof.filmComplete[0].paused, true);
        assert.equal(result.holdProof.filmComplete[0].gain, 0);
        result.nativeSeeks = await page.evaluate(() => window.__creditMediaProof.seeks);
        assert.deepEqual(result.nativeSeeks, []);
        assert.ok(result.holdProof.opens.every(row => row.nativeRequest));
        assert.ok(result.holdProof.successes.every(row => row.handlerType === "function"));
        assert.equal(result.holdProof.releases[0].held, result.holdProof.successes.length);
        assert.ok(result.holdProof.releases[0].at - result.holdProof.opens[0].at < 6000, JSON.stringify(result.holdProof));
      } else {
        await setVisualSpeed(page, 4);
        await page.waitForFunction(() => {
          const saved = JSON.parse(localStorage.getItem("nishijin-campaign-v100"));
          return document.querySelector(".v100-staff-roll")?.dataset.v100NodeIndex === "10" && document.documentElement.dataset.pwaSaveMutationPending === "false" && saved.flowState.nodeIndex === 10;
        }, undefined, { timeout: 30000 });
        result.beforeFault = await readNativeMedia(page);
        assert.equal(result.beforeFault.error, null);
        assert.ok(result.beforeFault.time < result.beforeFault.duration);
        await page.evaluate(() => {
          const set = Storage.prototype.setItem, put = IDBObjectStore.prototype.put;
          window.__creditSaveFailures = 0;
          window.__restoreCreditStorage = () => { Storage.prototype.setItem = set; IDBObjectStore.prototype.put = put; };
          Storage.prototype.setItem = function (key, value) { if (String(key).startsWith("nishijin-campaign-v100")) { window.__creditSaveFailures++; throw new DOMException("expected save failure fixture", "QuotaExceededError"); } return set.call(this, key, value); };
          IDBObjectStore.prototype.put = function (...args) { if (this.transaction.db.name.includes("v100")) { window.__creditSaveFailures++; throw new DOMException("expected save failure fixture", "QuotaExceededError"); } return put.apply(this, args); };
        });
        await page.locator(".v100-staff-roll").getByRole("button", { name: "続ける", exact: true }).waitFor({ state: "visible" });
        await page.waitForFunction(() => document.documentElement.dataset.pwaSaveMutationPending === "false");
        const attempts = await page.evaluate(() => window.__creditSaveFailures);
        await page.waitForTimeout(1200);
        assert.equal(await page.evaluate(() => window.__creditSaveFailures), attempts);
        assert.ok(attempts > 0);
        result.failedSaveAttempts = attempts;
        result.nativeEnded = await page.evaluate(() => window.__creditMediaProof.ended);
        result.nativeSeeks = await page.evaluate(() => window.__creditMediaProof.seeks);
        assert.deepEqual(result.nativeSeeks, []);
        assert.deepEqual(result.nativeEnded, []);
        assert.equal(await page.locator(".v100-staff-roll audio").evaluate(audio => audio.playbackRate), 1);
        await page.screenshot({ path: path.join(out, `${engine}-save-failure.png`) });
        await page.evaluate(() => window.__restoreCreditStorage());
        await page.locator(".v100-staff-roll").getByRole("button", { name: "続ける", exact: true }).click();
      }
      await page.locator('[data-v100-surface="epilogue"]').waitFor({ state: "visible", timeout: 15000 });
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("nishijin-campaign-v100")));
      assert.equal(saved.flowState.phase, "epilogue");
      assert.equal(saved.readStoryEventIds.filter(id => id === "v100:event:credits").length, 1);
      result.evidence = "seeded saved cursor, or real visual speed control with original native music at 1x and isolated storage fault; separate from the normal 106-second edit proof";
      assert.deepEqual(result.errors, []); result.status = "passed";
    } catch (error) {
      result.failureClock = await readClock(page).catch(() => null);
      result.failureAudio = await readNativeMedia(page).catch(() => null);
      result.failureHold = await page.evaluate(() => window.__creditSaveHoldProof ?? null).catch(() => null);
      await page.screenshot({ path: path.join(out, `${engine}-${name}-failed.png`) }).catch(() => {});
      throw error;
    } finally {
      result.mediaTrace = await page.evaluate(() => window.__creditMediaTrace).catch(() => null);
      await requestAudit.closeContext(context);
    }
  }
  assert.equal(report.cases.length, { all: 7, regression: 4, fallback: 2, unavailable: 1 }[selection]);
} catch (error) { caseError = error; }
finally {
  await finalizeRequestFailureEvidence({ report, browser, transport, error: caseError,
    writeReport: value => writeFile(path.join(out, "report.json"), JSON.stringify(value, null, 2)) });
}
console.log(JSON.stringify({ status: report.status, cases: report.cases.length, report: path.join(out, "report.json") }));
