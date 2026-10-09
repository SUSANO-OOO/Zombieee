import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pwaBrowserType } from "./pwa-browser-runtime.mjs";

// Product-independent control for the native IDBRequest used by the EOF race
// fixture. Keep the browser's own request and handler; delay only its delivery.
const engine = process.env.NATIVE_IDB_PROBE_ENGINE ?? "webkit";
const out = path.resolve(process.env.NATIVE_IDB_PROBE_OUT ?? "outputs/v100-native-pwa/idb-save-hold");
await mkdir(out, { recursive: true });
const report = { engine, status: "failed", requiredMode: "native-capture-hold", cases: [] };
const server = createServer((_request, response) => {
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end("<!doctype html><title>Native IDB callback control</title>");
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const browser = await (await pwaBrowserType(engine)).launch({ headless: true });
try {
  for (const mode of ["own-property-control", "native-capture-hold"]) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const result = { mode, status: "failed" };
    report.cases.push(result);
    try {
      await page.goto(`http://127.0.0.1:${server.address().port}/`);
      result.proof = await page.evaluate(async mode => {
        const proof = { errors: [], held: false, completedBeforeRelease: false, callbackCount: 0 };
        const started = performance.now();
        let release, complete = false;
        const operation = new Promise((resolve, reject) => {
          const request = indexedDB.open(`native-idb-hold-${mode}`, 1);
          proof.nativeRequest = request instanceof IDBOpenDBRequest;
          request.onupgradeneeded = () => request.result.createObjectStore("save");
          request.onerror = () => reject(request.error);
          try {
            if (mode === "own-property-control") {
              let handler;
              Object.defineProperty(request, "onsuccess", { configurable: true, get: () => handler, set: value => { handler = value; } });
              request.addEventListener("success", event => {
                proof.handlerType = typeof handler;
                proof.held = true; proof.heldAt = performance.now();
                release = () => handler?.call(request, event);
              });
            } else {
              request.addEventListener("success", event => {
                event.stopImmediatePropagation();
                const handler = request.onsuccess;
                proof.handlerType = typeof handler;
                proof.held = true; proof.heldAt = performance.now();
                release = () => handler?.call(request, event);
              }, { capture: true, once: true });
            }
            request.onsuccess = () => {
              proof.callbackCount++;
              const db = request.result;
              const transaction = db.transaction("save", "readwrite");
              transaction.objectStore("save").put("native round trip", "key");
              transaction.onerror = () => reject(transaction.error);
              transaction.oncomplete = () => {
                const read = db.transaction("save").objectStore("save").get("key");
                read.onerror = () => reject(read.error);
                read.onsuccess = () => { proof.value = read.result; db.close(); complete = true; resolve(); };
              };
            };
          } catch (error) { proof.errors.push(String(error)); reject(error); }
        });
        // Observe both failure and success without an unhandled rejection.
        const settled = operation.then(() => null, error => String(error));
        while (!release && performance.now() - started < 3000 && proof.errors.length === 0) await new Promise(resolve => setTimeout(resolve, 20));
        if (release) {
          await new Promise(resolve => setTimeout(resolve, 250));
          proof.completedBeforeRelease = complete;
          proof.releasedAt = performance.now(); release();
        }
        const error = await Promise.race([settled, new Promise(resolve => setTimeout(() => resolve("native IDB hold control timed out"), 2000))]);
        if (error && !proof.errors.includes(error)) proof.errors.push(error);
        proof.elapsedMs = performance.now() - started;
        return proof;
      }, mode);
      result.contract = {
        errorsAbsent: result.proof.errors.length === 0,
        nativeRequest: result.proof.nativeRequest === true,
        heldNativeSuccess: result.proof.held === true && result.proof.handlerType === "function",
        heldCallback: result.proof.completedBeforeRelease === false,
        callbackOnce: result.proof.callbackCount === 1,
        nativeRoundTrip: result.proof.value === "native round trip",
        withinStorageTimeout: result.proof.releasedAt - result.proof.heldAt < 6000,
      };
      result.status = Object.values(result.contract).every(Boolean) ? "passed" : "failed";
      if (mode === "native-capture-hold") {
        assert.deepEqual(result.proof.errors, []);
        assert.equal(result.proof.nativeRequest, true);
        assert.equal(result.proof.held, true);
        assert.equal(result.proof.handlerType, "function");
        assert.equal(result.proof.completedBeforeRelease, false);
        assert.equal(result.proof.callbackCount, 1);
        assert.equal(result.proof.value, "native round trip");
        assert.ok(result.proof.releasedAt - result.proof.heldAt < 6000);
        assert.equal(result.status, "passed");
      }
    } finally { await context.close(); }
  }
  report.status = "passed";
} catch (error) { report.error = String(error); throw error; }
finally {
  await browser.close(); await new Promise(resolve => server.close(resolve));
  await writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report));
