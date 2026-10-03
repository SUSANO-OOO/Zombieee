import assert from "node:assert/strict";

// Product-independent native controls. Prior playing-seek failures remain in
// the original artifacts. Compare paused/before-play seeks as diagnostics;
// require original-song EOF with no seek at each accelerated fixture rate.
export async function nativeAudioEofControl(browser, origin, songPath, report) {
  report.cases = [];
  report.status = "failed";
  for (const mode of ["paused-seek", "before-play-seek", "accelerated-8", "accelerated-16"]) {
    const rate = mode === "accelerated-8" ? 8 : mode === "accelerated-16" ? 16 : 1;
    const holdSave = rate > 1;
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const page = await context.newPage();
    const result = { mode, rate, holdSave, status: "failed" };
    report.cases.push(result);
    try {
      const url = new URL("__qa-native-media-eof-control", origin).href;
      // Fulfill only this HTML. Original media traverses the owned HTTP origin.
      await page.route(url, route => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Native media EOF control</title><button>Play original song</button><audio preload=metadata></audio>" }));
      await page.goto(url);
      await page.evaluate(songUrl => {
        const audio = document.querySelector("audio");
        const proof = window.__nativeTailProof = { events: [], samples: [], playErrors: [], ended: [], save: null };
        for (const type of ["playing", "seeking", "seeked", "waiting", "canplay", "pause", "ended", "error", "ratechange"]) audio.addEventListener(type, event => {
          const row = { at: performance.now(), type, trusted: event.isTrusted, time: audio.currentTime, duration: audio.duration, rate: audio.playbackRate, paused: audio.paused, seeking: audio.seeking, ended: audio.ended, savePending: proof.save?.pending ?? false };
          proof.events.push(row); if (type === "ended") proof.ended.push(row);
        });
        setInterval(() => proof.samples.push({ at: performance.now(), time: audio.currentTime, rate: audio.playbackRate, paused: audio.paused, seeking: audio.seeking, readyState: audio.readyState }), 50);
        audio.volume = .576; audio.crossOrigin = "anonymous"; audio.src = songUrl;
        document.querySelector("button").onclick = () => audio.play().catch(error => proof.playErrors.push(String(error)));
      }, new URL(songPath, origin).href);
      await page.waitForFunction(() => { const audio = document.querySelector("audio"); return audio.readyState > 0 && Number.isFinite(audio.duration); }, undefined, { timeout: 15000 });
      if (mode !== "before-play-seek") {
        await page.getByRole("button", { name: "Play original song" }).click();
        await page.waitForFunction(() => { const audio = document.querySelector("audio"); return audio.currentTime > 0 && !audio.paused; }, undefined, { timeout: 15000 });
      }
      if (holdSave) {
        await page.evaluate(rate => { document.querySelector("audio").playbackRate = rate; }, rate);
        await page.waitForFunction(() => {
          const audio = document.querySelector("audio");
          return audio.currentTime >= audio.duration * 10 / 11 && !audio.paused && !audio.seeking;
        }, undefined, { timeout: 60000 });
        await page.evaluate(() => {
          const proof = window.__nativeTailProof;
          const save = proof.save = { openedAt: performance.now(), nativeRequest: false, held: false, pending: true, callbackCount: 0, errors: [] };
          const request = indexedDB.open("native-media-eof-control", 1);
          save.nativeRequest = request instanceof IDBOpenDBRequest;
          request.onupgradeneeded = () => request.result.createObjectStore("save");
          request.onerror = () => save.errors.push(String(request.error));
          request.addEventListener("success", event => {
            event.stopImmediatePropagation();
            const handler = request.onsuccess; save.handlerType = typeof handler;
            save.held = true; save.heldAt = performance.now();
            window.__releaseNativeTailSave = () => { save.releasedAt = performance.now(); handler.call(request, event); };
          }, { capture: true, once: true });
          request.onsuccess = () => {
            save.callbackCount++;
            const db = request.result, transaction = db.transaction("save", "readwrite");
            transaction.objectStore("save").put("native round trip", "key");
            transaction.onerror = () => save.errors.push(String(transaction.error));
            transaction.oncomplete = () => {
              const read = db.transaction("save").objectStore("save").get("key");
              read.onerror = () => save.errors.push(String(read.error));
              read.onsuccess = () => { save.value = read.result; save.pending = false; db.close(); };
            };
          };
        });
        await page.waitForFunction(() => {
          const audio = document.querySelector("audio");
          return window.__nativeTailProof.save.held && audio.currentTime >= audio.duration - audio.playbackRate;
        }, undefined, { timeout: 3000 });
      } else {
        result.target = await page.evaluate(() => {
          const audio = document.querySelector("audio"), target = audio.duration - 1;
          audio.pause(); audio.currentTime = target; return target;
        });
        await page.waitForFunction(() => !document.querySelector("audio").seeking, undefined, { timeout: 15000 });
        await page.getByRole("button", { name: "Play original song" }).click();
      }
      result.observedEnded = await page.waitForFunction(() => window.__nativeTailProof.ended.length === 1, undefined, { timeout: 2000 }).then(() => true, () => false);
      result.beforeRelease = await page.evaluate(() => {
        const audio = document.querySelector("audio"), proof = window.__nativeTailProof;
        return { time: audio.currentTime, duration: audio.duration, rate: audio.playbackRate, paused: audio.paused, seeking: audio.seeking, ended: audio.ended, error: audio.error && { code: audio.error.code, message: audio.error.message }, pending: proof.save?.pending ?? false };
      });
      if (holdSave) {
        await page.evaluate(() => window.__releaseNativeTailSave());
        await page.waitForFunction(() => !window.__nativeTailProof.save.pending, undefined, { timeout: 2000 });
      }
      result.proof = await page.evaluate(() => window.__nativeTailProof);
      assert.deepEqual(result.proof.playErrors, []);
      result.status = result.observedEnded ? "passed" : "no-native-ended";
      if (holdSave) {
        assert.equal(result.beforeRelease.pending, true);
        assert.equal(result.beforeRelease.rate, rate);
        assert.equal(result.beforeRelease.error, null);
        assert.equal(result.proof.save.nativeRequest, true);
        assert.equal(result.proof.save.handlerType, "function");
        assert.equal(result.proof.save.callbackCount, 1);
        assert.equal(result.proof.save.value, "native round trip");
        assert.deepEqual(result.proof.save.errors, []);
        assert.ok(result.proof.save.releasedAt - result.proof.save.openedAt < 6000);
        assert.equal(result.proof.events.filter(event => event.type === "seeking").length, 0);
        assert.equal(result.observedEnded, true, JSON.stringify(result.beforeRelease));
        assert.equal(result.proof.ended[0].trusted, true);
        assert.equal(result.proof.ended[0].ended, true);
        assert.equal(result.proof.ended[0].savePending, true);
        assert.ok(result.proof.ended[0].time > 315 && result.proof.ended[0].time < 317);
        assert.ok(Math.abs(result.proof.ended[0].time - result.proof.ended[0].duration) < .5);
      }
    } catch (error) {
      result.error = String(error);
      result.proof ??= await page.evaluate(() => window.__nativeTailProof ?? null).catch(() => null);
      throw error;
    } finally { await context.close(); }
  }
  report.status = "passed";
  return report;
}
