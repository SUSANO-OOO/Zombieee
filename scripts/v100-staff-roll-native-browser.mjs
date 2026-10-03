import assert from "node:assert/strict";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { createDefaultV100Save, normalizeV100Save, serializeV100Save } from "../app/v100Save.js";
import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";
import { pwaBrowserType } from "./pwa-browser-runtime.mjs";
import { inspectStaffRoll } from "./v100-staff-roll-audit.mjs";
import { startNativeAudioQaOrigin } from "./native-audio-qa-origin.mjs";
import { nativeAudioTailSeekControl } from "./native-audio-tail-seek-control.mjs";

const upstreamOrigin = new URL(process.env.V100_CAMPAIGN_QA_BASE_URL ?? "http://127.0.0.1:4177/");
assert.ok(["127.0.0.1", "localhost"].includes(upstreamOrigin.hostname));
// Native WebKit media requests can bypass page.route. Hold or fail them at
// an owned loopback proxy so the loading/failure evidence covers real media.
let holdSong = false, failSongResponse = false;
const transport = await startNativeAudioQaOrigin(upstreamOrigin, { mode: () => failSongResponse ? "fail" : holdSong ? "hold" : "ready" });
const origin = transport.origin;
const engine = process.env.V100_STAFF_ROLL_ENGINE ?? "webkit";
const selection = process.env.V100_STAFF_ROLL_ONLY ?? "all";
assert.ok(["all", "regression", "fallback", "unavailable"].includes(selection), `Unknown staff-roll selection: ${selection}`);
const onlyRegression = selection === "regression";
const out = path.resolve(process.env.V100_STAFF_ROLL_OUT ?? "outputs/v100-staff-roll-native");
await mkdir(out, { recursive: true });
const report = { engine, status: "failed", selection, onlyRegression, build: await productionBuildIdentity(), evidenceKind: "seeded staff-roll media and lifecycle QA; no campaign or physical-device completion claim", cases: [] };
const browser = await (await pwaBrowserType(engine)).launch({ headless: true });

async function openCase(name, { muted = false, reducedMotion = false, failSong = false, delaySong = false, nodeIndex = 0 } = {}) {
  holdSong = delaySong; failSongResponse = failSong;
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const result = { name, status: "failed", errors: [], mediaSamples: [], nativeEnded: [] };
  report.cases.push(result);
  page.on("pageerror", error => result.errors.push(String(error)));
  page.on("console", message => { if (message.type() === "error" && !failSong) result.errors.push(message.text()); });
  page.on("response", response => { if (response.status() >= 400 && !(failSong && response.url().includes("/credits/"))) result.errors.push(`${response.status()} ${response.url()}`); });
  const save = normalizeV100Save({ ...createDefaultV100Save({ playerName: "１２文字の主人公名です" }), campaignStarted: true,
    settings: { ...createDefaultV100Save().settings, bgmEnabled: !muted, reducedMotion },
    flowState: { phase: "credits", eventId: "v100:event:credits", stageId: null, stageNumber: null, nodeIndex, finalized: true, firstClear: false, destination: "credits" } });
  await context.addInitScript(({ origin, serialized }) => {
    if (location.origin !== origin) return;
    for (const key of ["nishijin-campaign-v100", "nishijin-campaign-v100:mirror", "nishijin-campaign-v100:last-known-good"]) localStorage.setItem(key, serialized);
    window.__creditMediaProof = { ended: [], samples: [] };
    document.addEventListener("ended", event => { if (event.target instanceof HTMLAudioElement && event.target.closest(".v100-staff-roll")) window.__creditMediaProof.ended.push({ time: event.target.currentTime, duration: event.target.duration, ended: event.target.ended }); }, true);
    setInterval(() => { const root = document.querySelector(".v100-staff-roll"), audio = root?.querySelector("audio"); if (audio) window.__creditMediaProof.samples.push({ scene: root.getAttribute("data-v100-node-index"), time: audio.currentTime, duration: audio.duration, paused: audio.paused, progress: root.getAttribute("data-v100-credit-progress") }); }, 1000);
  }, { origin: origin.origin, serialized: serializeV100Save(save) });
  await page.goto(new URL("?event-audio-qa=1", origin).href, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "ブラウザで遊ぶ", exact: true }).click();
  await page.locator(".v100-staff-roll").waitFor({ state: "visible" });
  return { page, context, result, releaseSong: () => { holdSong = false; transport.release(); } };
}

async function readClock(page) {
  return page.locator(".v100-staff-roll").evaluate(root => { const audio = root.querySelector("audio"), track = root.querySelector(".v100-credit-roll-track"); return { time: audio.currentTime, paused: audio.paused, progress: root.getAttribute("data-v100-credit-progress"), transform: track.style.transform, state: root.getAttribute("data-v100-credit-audio") }; });
}
async function readNativeMedia(page) {
  return page.locator(".v100-staff-roll audio").evaluate(audio => ({ time: audio.currentTime, duration: audio.duration, paused: audio.paused,
    seeking: audio.seeking, ended: audio.ended, networkState: audio.networkState, readyState: audio.readyState,
    error: audio.error && { code: audio.error.code, message: audio.error.message },
    buffered: [...Array(audio.buffered.length)].map((_, i) => [audio.buffered.start(i), audio.buffered.end(i)]),
    seekable: [...Array(audio.seekable.length)].map((_, i) => [audio.seekable.start(i), audio.seekable.end(i)]) }));
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

try {
  if (["all", "regression"].includes(selection)) {
    report.nativeTailControl = {};
    await nativeAudioTailSeekControl(browser, origin, transport.song.path, report.nativeTailControl);
  }
  if (selection === "all") {
  const { page, context, result, releaseSong } = await openCase("full-song-with-loading-pause-rotation-pagehide", { delaySong: true });
  try {
    await page.waitForTimeout(3500);
    result.loading = await readClock(page);
    result.loading.heldNativeRequests = transport.heldRequests();
    assert.ok(transport.heldRequests() > 0);
    assert.equal(result.loading.progress, "0.0000"); assert.equal(result.loading.time, 0);
    releaseSong();
    result.initial = await inspectStaffRoll(page, { playerName: "１２文字の主人公名です" });
    await page.screenshot({ path: path.join(out, `${engine}-initial.png`) });
    result.pause = await frozen(page, () => page.getByRole("button", { name: "一時停止", exact: true }).click());
    await page.getByRole("button", { name: "再開", exact: true }).click();
    await page.waitForFunction(() => !document.querySelector(".v100-staff-roll audio").paused);
    result.rotation = await frozen(page, () => page.setViewportSize({ width: 390, height: 844 }));
    await page.screenshot({ path: path.join(out, `${engine}-portrait-paused.png`) });
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForFunction(() => !document.querySelector(".v100-staff-roll audio").paused);
    result.pageHide = await frozen(page, () => page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide"))));
    result.pageHide.evidence = "synthetic lifecycle event; no physical screen-lock claim";
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow")));
    await page.waitForFunction(() => !document.querySelector(".v100-staff-roll audio").paused);
    await page.getByRole("button", { name: "素材クレジット", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor({ state: "visible" });
    assert.ok((await dialog.innerText()).includes("追憶の幻想世界"));
    await page.screenshot({ path: path.join(out, `${engine}-rights.png`) });
    await dialog.getByRole("button", { name: "閉じる", exact: true }).click();
    await page.getByRole("button", { name: "再開", exact: true }).click();
    console.log(JSON.stringify({ engine, status: "listening-to-full-song", seeks: 0 }));
    await page.locator('[data-v100-surface="epilogue"]').waitFor({ state: "visible", timeout: 360000 });
    const proof = await page.evaluate(() => ({ ...window.__creditMediaProof, save: JSON.parse(localStorage.getItem("nishijin-campaign-v100")) }));
    result.nativeEnded = proof.ended; result.mediaSamples = proof.samples;
    assert.equal(proof.ended.length, 1); assert.equal(proof.ended[0].ended, true);
    assert.ok(proof.ended[0].time > 315 && proof.ended[0].time < 317);
    assert.equal(new Set(proof.samples.map(row => row.scene)).size, 11);
    assert.ok(proof.save.readStoryEventIds.includes("v100:event:credits"));
    assert.equal(proof.save.flowState.phase, "epilogue");
    assert.deepEqual(result.errors, []); result.status = "passed";
    await page.screenshot({ path: path.join(out, `${engine}-epilogue.png`) });
  } catch (error) {
    result.failureClock = await readClock(page).catch(() => null);
    result.failureAudio = await page.locator(".v100-staff-roll audio").evaluate(audio => ({ time: audio.currentTime, duration: audio.duration, paused: audio.paused, networkState: audio.networkState, readyState: audio.readyState, error: audio.error && { code: audio.error.code, message: audio.error.message }, buffered: [...Array(audio.buffered.length)].map((_, i) => [audio.buffered.start(i), audio.buffered.end(i)]) })).catch(() => null);
    await page.screenshot({ path: path.join(out, `${engine}-failed.png`) }).catch(() => {});
    throw error;
  } finally { releaseSong(); await context.close(); await writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2)); }

  }
  if (!onlyRegression) for (const [name, options] of [["muted-reduced-motion", { muted: true, reducedMotion: true }], ["audio-unavailable", { failSong: true }]]) {
    if (selection === "unavailable" && !options.failSong) continue;
    const { page, context, result } = await openCase(name, options);
    try {
      await page.waitForFunction(expected => document.querySelector(".v100-staff-roll")?.getAttribute("data-v100-credit-audio") === expected, options.muted ? "muted" : "unavailable");
      const before = await readClock(page); await page.waitForTimeout(1300); const after = await readClock(page);
      assert.equal(after.paused, true); assert.ok(Number(after.progress) > Number(before.progress));
      if (options.reducedMotion) assert.equal(await page.locator(".v100-credit-shot").first().evaluate(element => getComputedStyle(element).transform), "none");
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
    } finally { await context.close(); }
  }
  if (["all", "regression"].includes(selection)) for (const name of ["saved-scene-resume", "ended-during-save", "completion-save-failure"]) {
    const { page, context, result } = await openCase(name, { nodeIndex: name === "saved-scene-resume" ? 6 : 0 });
    try {
      result.initial = await inspectStaffRoll(page, { index: name === "saved-scene-resume" ? 6 : 0, playerName: "１２文字の主人公名です" });
      await page.waitForFunction(() => document.documentElement.dataset.pwaSaveMutationPending === "false");
      if (name === "saved-scene-resume") {
        assert.ok(result.initial.audio.currentTime > 170);
        await page.getByRole("button", { name: "スキップ", exact: true }).click();
      } else if (name === "ended-during-save") {
        // Prepare both native seek targets before holding a real save. Media
        // readiness cannot consume the product's six-second storage timeout.
        // Native engines may stop prebuffering halfway through a long track.
        // A real preparatory seek loads its tail before the save is held.
        result.prepareSeek = await page.locator(".v100-staff-roll audio").evaluate(audio => {
          const target = audio.duration * 9.1 / 11; audio.currentTime = target; return { target, immediate: audio.currentTime };
        });
        await page.waitForFunction(target => {
          const root = document.querySelector(".v100-staff-roll"), audio = root.querySelector("audio");
          return !audio.seeking && !audio.paused && Math.abs(audio.currentTime - target) < 3 && root.dataset.v100NodeIndex === "9" && document.documentElement.dataset.pwaSaveMutationPending === "false";
        }, result.prepareSeek.target, { timeout: 15000 });
        await page.waitForFunction(() => {
          const audio = document.querySelector(".v100-staff-roll audio");
          const contains = (ranges, target) => [...Array(ranges.length)].some((_, i) => ranges.start(i) <= target && ranges.end(i) >= target);
          return Number.isFinite(audio.duration) && [audio.duration * 10.1 / 11, audio.duration - 1]
            .every(target => contains(audio.buffered, target) && contains(audio.seekable, target));
        }, undefined, { timeout: 20000 });
        result.beforeHold = await readNativeMedia(page);
        result.seek = await page.evaluate(() => {
          const original = IDBFactory.prototype.open, held = [], proof = { opens: [], successes: [], errors: [], ended: [], busy: [], releases: [] };
          window.__creditSaveHoldProof = proof;
          const observer = new MutationObserver(() => proof.busy.push({ at: performance.now(), pending: document.documentElement.dataset.pwaSaveMutationPending }));
          observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-pwa-save-mutation-pending"] });
          document.addEventListener("ended", event => {
            if (event.target instanceof HTMLAudioElement && event.target.closest(".v100-staff-roll")) proof.ended.push({ at: performance.now(), time: event.target.currentTime, duration: event.target.duration, ended: event.target.ended, pending: document.documentElement.dataset.pwaSaveMutationPending });
          }, { capture: true });
          window.__releaseCreditSave = () => {
            IDBFactory.prototype.open = original;
            proof.releases.push({ at: performance.now(), held: held.length });
            for (const resume of held.splice(0)) resume();
            observer.disconnect();
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
          const audio = document.querySelector(".v100-staff-roll audio"), before = audio.currentTime, target = audio.duration * 10.1 / 11;
          audio.currentTime = target;
          return { before, target, immediate: audio.currentTime };
        });
        await page.waitForFunction(target => {
          const audio = document.querySelector(".v100-staff-roll audio");
          return !audio.seeking && Math.abs(audio.currentTime - target) < 2 && document.documentElement.dataset.pwaSaveMutationPending === "true" && window.__heldCreditSaves.length > 0;
        }, result.seek.target, { timeout: 3000 });
        result.afterHold = await readNativeMedia(page);
        // The independent controls require real EOF after a one-second tail.
        // Keep the native-ended wait and product storage timeout unchanged.
        await page.locator(".v100-staff-roll audio").evaluate(audio => { audio.currentTime = audio.duration - 1; });
        await page.waitForFunction(() => window.__creditSaveHoldProof.ended.length === 1, undefined, { timeout: 2000 });
        result.busyAtEnd = await page.evaluate(() => window.__creditSaveHoldProof.ended[0].pending);
        assert.equal(result.busyAtEnd, "true");
        await page.evaluate(() => window.__releaseCreditSave());
        result.holdProof = await page.evaluate(() => window.__creditSaveHoldProof);
        assert.deepEqual(result.holdProof.errors, []);
        assert.equal(result.holdProof.ended[0].ended, true);
        assert.ok(Math.abs(result.holdProof.ended[0].time - result.holdProof.ended[0].duration) < .5);
        assert.ok(result.holdProof.opens.every(row => row.nativeRequest));
        assert.ok(result.holdProof.successes.every(row => row.handlerType === "function"));
        assert.equal(result.holdProof.releases[0].held, result.holdProof.successes.length);
        assert.ok(result.holdProof.releases[0].at - result.holdProof.opens[0].at < 6000, JSON.stringify(result.holdProof));
      } else {
        await page.evaluate(() => {
          const set = Storage.prototype.setItem, put = IDBObjectStore.prototype.put;
          window.__creditSaveFailures = 0;
          window.__restoreCreditStorage = () => { Storage.prototype.setItem = set; IDBObjectStore.prototype.put = put; };
          Storage.prototype.setItem = function (key, value) { if (String(key).startsWith("nishijin-campaign-v100")) { window.__creditSaveFailures++; throw new DOMException("expected save failure fixture", "QuotaExceededError"); } return set.call(this, key, value); };
          IDBObjectStore.prototype.put = function (...args) { if (this.transaction.db.name.includes("v100")) { window.__creditSaveFailures++; throw new DOMException("expected save failure fixture", "QuotaExceededError"); } return put.apply(this, args); };
          const audio = document.querySelector(".v100-staff-roll audio"); audio.currentTime = audio.duration - 1;
        });
        await page.locator(".v100-staff-roll").getByRole("button", { name: "続ける", exact: true }).waitFor({ state: "visible" });
        await page.waitForFunction(() => document.documentElement.dataset.pwaSaveMutationPending === "false");
        const attempts = await page.evaluate(() => window.__creditSaveFailures);
        await page.waitForTimeout(1200);
        assert.equal(await page.evaluate(() => window.__creditSaveFailures), attempts);
        assert.ok(attempts > 0);
        result.failedSaveAttempts = attempts;
        await page.screenshot({ path: path.join(out, `${engine}-save-failure.png`) });
        await page.evaluate(() => window.__restoreCreditStorage());
        await page.locator(".v100-staff-roll").getByRole("button", { name: "続ける", exact: true }).click();
      }
      await page.locator('[data-v100-surface="epilogue"]').waitFor({ state: "visible", timeout: 15000 });
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("nishijin-campaign-v100")));
      assert.equal(saved.flowState.phase, "epilogue");
      assert.equal(saved.readStoryEventIds.filter(id => id === "v100:event:credits").length, 1);
      result.evidence = "seeded saved cursor or synthetic EOF seek and isolated storage fault; separate from full-song proof";
      assert.deepEqual(result.errors, []); result.status = "passed";
    } catch (error) {
      result.failureClock = await readClock(page).catch(() => null);
      result.failureAudio = await readNativeMedia(page).catch(() => null);
      result.failureHold = await page.evaluate(() => window.__creditSaveHoldProof ?? null).catch(() => null);
      await page.screenshot({ path: path.join(out, `${engine}-${name}-failed.png`) }).catch(() => {});
      throw error;
    } finally { await context.close(); }
  }
  assert.equal(report.cases.length, { all: 6, regression: 3, fallback: 2, unavailable: 1 }[selection]);
  report.status = "passed";
} catch (error) { report.error = String(error); throw error; }
finally { await browser.close(); await transport.close(); await writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2)); }
console.log(JSON.stringify({ status: report.status, cases: report.cases.length, report: path.join(out, "report.json") }));
