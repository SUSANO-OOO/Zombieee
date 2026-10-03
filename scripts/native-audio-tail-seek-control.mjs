import assert from "node:assert/strict";

// Fixed, product-independent controls for the EOF fixture. Every condition uses
// a fresh context, the original MP3, native seeks and trusted native events.
// The former 100ms target is diagnostic; the one-second target must end within
// the fixture's unchanged two-second observation window, with and without IDB.
export async function nativeAudioTailSeekControl(browser, origin, songPath, report) {
  report.cases = [];
  report.status = "failed";
  for (const tailSeconds of [.1, 1]) for (const holdSave of [false, true]) {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const page = await context.newPage();
    const result = { tailSeconds, holdSave, status: "failed" };
    report.cases.push(result);
    try {
      const url = new URL("__qa-native-media-tail-control", origin).href;
      // Only the HTML control is fulfilled. Native media still traverses the
      // owned HTTP origin and its verified Content-Length/Range transport.
      await page.route(url, route => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Native media tail control</title><button>Play original song</button><audio preload=metadata></audio>" }));
      await page.goto(url);
      await page.evaluate(songUrl => {
        const audio = document.querySelector("audio");
        const proof = window.__nativeTailProof = { events: [], samples: [], playErrors: [], ended: [], save: null };
        for (const type of ["playing", "seeking", "seeked", "waiting", "canplay", "pause", "ended", "error"]) audio.addEventListener(type, event => {
          const row = { at: performance.now(), type, trusted: event.isTrusted, time: audio.currentTime, duration: audio.duration, paused: audio.paused, seeking: audio.seeking, ended: audio.ended, savePending: proof.save?.pending ?? false };
          proof.events.push(row); if (type === "ended") proof.ended.push(row);
        });
        setInterval(() => proof.samples.push({ at: performance.now(), time: audio.currentTime, paused: audio.paused, seeking: audio.seeking, readyState: audio.readyState }), 50);
        audio.volume = .576; audio.src = songUrl;
        document.querySelector("button").onclick = () => audio.play().catch(error => proof.playErrors.push(String(error)));
      }, new URL(songPath, origin).href);
      await page.getByRole("button", { name: "Play original song" }).click();
      await page.waitForFunction(() => { const audio = document.querySelector("audio"); return audio.currentTime > 0 && !audio.paused && Number.isFinite(audio.duration); }, undefined, { timeout: 15000 });
      await page.evaluate(() => { const audio = document.querySelector("audio"); audio.currentTime = audio.duration * 9.1 / 11; });
      await page.waitForFunction(() => {
        const audio = document.querySelector("audio"), ranges = audio.buffered;
        return !audio.seeking && !audio.paused && Math.abs(audio.currentTime - audio.duration * 9.1 / 11) < 3
          && [...Array(ranges.length)].some((_, i) => ranges.start(i) <= audio.duration * 10.1 / 11 && ranges.end(i) >= audio.duration);
      }, undefined, { timeout: 20000 });
      await page.evaluate(hold => {
        const audio = document.querySelector("audio"), proof = window.__nativeTailProof;
        audio.currentTime = audio.duration * 10.1 / 11;
        if (!hold) return;
        const save = proof.save = { openedAt: performance.now(), nativeRequest: false, held: false, pending: true, callbackCount: 0, errors: [] };
        const request = indexedDB.open("native-media-tail-control", 1);
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
      }, holdSave);
      await page.waitForFunction(hold => {
        const audio = document.querySelector("audio");
        return !audio.seeking && !audio.paused && Math.abs(audio.currentTime - audio.duration * 10.1 / 11) < 2
          && (!hold || window.__nativeTailProof.save.held);
      }, holdSave, { timeout: 3000 });
      result.target = await page.evaluate(tail => {
        const audio = document.querySelector("audio"), target = audio.duration - tail;
        window.__nativeTailProof.eofSeekAt = performance.now(); audio.currentTime = target; return target;
      }, tailSeconds);
      result.observedEnded = await page.waitForFunction(() => window.__nativeTailProof.ended.length === 1, undefined, { timeout: 2000 }).then(() => true, () => false);
      result.beforeRelease = await page.evaluate(() => {
        const audio = document.querySelector("audio"), proof = window.__nativeTailProof;
        return { time: audio.currentTime, duration: audio.duration, paused: audio.paused, seeking: audio.seeking, ended: audio.ended, error: audio.error && { code: audio.error.code, message: audio.error.message }, pending: proof.save?.pending ?? false };
      });
      if (holdSave) {
        await page.evaluate(() => window.__releaseNativeTailSave());
        await page.waitForFunction(() => !window.__nativeTailProof.save.pending, undefined, { timeout: 2000 });
      }
      result.proof = await page.evaluate(() => window.__nativeTailProof);
      assert.deepEqual(result.proof.playErrors, []);
      if (holdSave) {
        assert.equal(result.beforeRelease.pending, true);
        assert.equal(result.proof.save.nativeRequest, true);
        assert.equal(result.proof.save.handlerType, "function");
        assert.equal(result.proof.save.callbackCount, 1);
        assert.equal(result.proof.save.value, "native round trip");
        assert.deepEqual(result.proof.save.errors, []);
        assert.ok(result.proof.save.releasedAt - result.proof.save.openedAt < 6000);
      }
      result.status = result.observedEnded ? "passed" : "no-native-ended";
      if (tailSeconds === 1) {
        assert.equal(result.observedEnded, true, JSON.stringify(result.beforeRelease));
        assert.equal(result.proof.ended[0].trusted, true);
        assert.equal(result.proof.ended[0].ended, true);
        assert.equal(result.proof.ended[0].savePending, holdSave);
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
