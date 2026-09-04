import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import crypto from "node:crypto";
import { build } from "esbuild";
import { chromium, webkit } from "playwright";
import { createDefaultCampaignSave, computeCampaignSaveIntegrity } from "../app/campaign.js";
import { createCampaignManualExport } from "../app/campaignStorage.js";

// These are explicit storage fixtures. They do not claim production gameplay or PWA acceptance.
const out = path.resolve(process.env.V100_DURABLE_EVIDENCE_DIR ?? "outputs/v100-durable-storage");
await fs.mkdir(out, { recursive: false });
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const bundle = await build({ stdin: { contents: 'export * from "./app/v100CampaignStorage.js"; export {createDefaultV100Save, applyV100SaveMutation, claimV100LegacyGift, serializeV100Save} from "./app/v100Save.js";', resolveDir: process.cwd() }, bundle: true, write: false, format: "iife", globalName: "V100StorageFixture", platform: "browser" });
const html = `<!doctype html><meta charset="utf-8"><title>Explicit native storage fixture</title><p id="fixture-document">Native V1 storage fixture</p><script>${bundle.outputFiles[0].text}</script>`;
const legacyValue = { ...createDefaultCampaignSave(), campaignStarted: true, caps: 777, settings: { ...createDefaultCampaignSave().settings, bgmEnabled: false, bgmVolume: 0.2 }, autoSkipReadStory: true };
const legacy = JSON.stringify({ ...legacyValue, integrity: computeCampaignSaveIntegrity(legacyValue) });
const legacyExport = createCampaignManualExport(legacy);
const report = { scope: "native IndexedDB fixtures using actual bundled module; not product runtime or physical-device QA", bundleSha256: sha(bundle.outputFiles[0].contents), sources: {}, cases: [], error: null };
for (const file of ["app/v100CampaignStorage.js", "app/v100Save.js", "scripts/v100-durable-storage-browser-smoke.mjs"]) report.sources[file] = sha(await fs.readFile(file));
const worker = "self.addEventListener('install',event=>event.waitUntil(caches.open('native-storage-fixture').then(cache=>cache.add('/storage-fixture')).then(()=>self.skipWaiting())));self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));self.addEventListener('fetch',event=>{if(new URL(event.request.url).pathname==='/storage-fixture')event.respondWith(caches.match('/storage-fixture').then(response=>response||fetch(event.request)));});";
async function boot(page, url, reload = false) {
  if (reload) await page.reload(); else await page.goto(url);
  await page.evaluate(() => {
    window.fixtureAssert = (condition, message) => { if (!condition) throw new Error(message); };
    window.fixtureRecord = (dbName, store, key, value, create = false) => new Promise((resolve, reject) => {
      const request = create ? indexedDB.open(dbName, 1) : indexedDB.open(dbName);
      request.onupgradeneeded = () => { if (!create) { request.transaction.abort(); return; } request.result.createObjectStore(store); };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(store, value === undefined ? "readonly" : "readwrite");
        const operation = value === undefined ? key === undefined ? tx.objectStore(store).getAllKeys() : tx.objectStore(store).get(key) : tx.objectStore(store).put(value, key);
        let found;
        operation.onsuccess = () => { found = operation.result; };
        tx.oncomplete = () => { db.close(); resolve(found); };
        tx.onabort = () => { db.close(); reject(tx.error ?? new Error("fixture-aborted")); };
      };
    });
  });
}
async function withCase(browser, engine, name, execute) {
  const record = { name: `${engine}-${name}`, status: "running", errors: [], evidence: null };
  report.cases.push(record);
  const server = http.createServer((request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Content-Type", request.url === "/fixture-sw.js" ? "text/javascript" : "text/html");
    response.end(request.url === "/fixture-sw.js" ? worker : html);
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const fixture = { url: `http://127.0.0.1:${server.address().port}/storage-fixture`, responses: [], stop: async () => {
    if (server.listening) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  } };
  const context = await browser.newContext();
  context.on("page", page => {
    page.on("response", response => { if (response.url() === fixture.url) fixture.responses.push({ status: response.status(), fromServiceWorker: response.fromServiceWorker() }); });
    page.on("pageerror", error => record.errors.push(String(error)));
    page.on("console", message => { if (message.type() === "error") record.errors.push(message.text()); });
    page.on("requestfailed", request => record.errors.push(`${request.url()}: ${request.failure()?.errorText}`));
  });
  try {
    const page = await context.newPage(); await boot(page, fixture.url);
    record.evidence = await execute(page, context, fixture);
    assert.deepEqual(record.errors, []);
    record.status = "passed";
  } catch (error) { record.status = "failed"; throw error; }
  finally { await context.close(); await fixture.stop(); }
}
try {
  for (const [engine, launcher] of [["chromium", chromium], ["webkit", webkit]]) {
    const browser = await launcher.launch({ headless: true });
    try {
      await withCase(browser, engine, "concurrent-writers-and-origin-unavailable-reload", async (page, context, fixture) => {
        const original = await page.evaluate(async () => (await window.V100StorageFixture.readV100BrowserSave()).save);
        const second = await context.newPage(); await boot(second, fixture.url);
        const write = (target, caps) => target.evaluate(async ({ original, caps }) => {
          const api = window.V100StorageFixture;
          const next = api.applyV100SaveMutation(original, save => ({ ...save, caps })).save;
          const written = await api.persistV100BrowserSave(next, globalThis, { expectedRevision: original.revision, ownerId: String(caps) });
          return { ok: written.ok, reason: written.reason, caps: written.save?.caps };
        }, { original, caps });
        const writes = await Promise.all([write(page, 17), write(second, 29)]);
        assert.equal(writes.filter(value => value.ok).length, 1);
        assert.equal(writes.find(value => !value.ok).reason, "stale-writer");
        await second.close();
        await page.evaluate(async () => {
          await navigator.serviceWorker.register("/fixture-sw.js"); await navigator.serviceWorker.ready;
          if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true }));
        });
        await fixture.stop();
        let originUnavailable = false;
        try { await fetch(fixture.url); } catch (error) { originUnavailable = error.cause?.code === "ECONNREFUSED"; }
        assert.equal(originUnavailable, true, "fixture origin must actually be unreachable");
        // Actual origin is stopped. Windows WebKit emulated-offline navigation failed in retained diagnostics.
        // This cache owner is fixture-only; production PWA/device acceptance remains separate.
        await boot(page, fixture.url, true);
        assert.equal(fixture.responses.at(-1).fromServiceWorker, true);
        assert.equal(await page.locator("#fixture-document").textContent(), "Native V1 storage fixture");
        return page.evaluate(async writes => {
          const api = window.V100StorageFixture, check = window.fixtureAssert;
          const loaded = await api.readV100BrowserSave();
          check(loaded.save.caps === writes.find(value => value.ok).caps, "origin-unavailable cached reload lost winning save");
          const next = api.applyV100SaveMutation(loaded.save, save => ({ ...save, caps: save.caps + 1 })).save;
          const written = await api.persistV100BrowserSave(next, globalThis, { expectedRevision: loaded.save.revision, ownerId: "reloaded" });
          check(written.ok, "reload inherited a dead-tab lease");
          check(localStorage.getItem("nishijin-campaign-v100:owner") === null, "general persistent lease exists");
          return { writes, revision: written.save.revision, caps: written.save.caps, originUnavailableReload: true, documentFromServiceWorker: true, navigatorOnline: navigator.onLine };
        }, writes);
      });
      for (const source of ["ls-primary", "ls-last-known-good", "ls-pre-migration", "idb-primary", "idb-last-known-good", "idb-pre-migration"]) {
        await withCase(browser, engine, `legacy-${source}`, async page => page.evaluate(async ({ source, legacy }) => {
          const api = window.V100StorageFixture, check = window.fixtureAssert;
          const suffix = source.split("-").slice(1).join("-");
          const key = `nishijin-campaign-v1${suffix === "primary" ? "" : `::${suffix}`}`;
          if (source.startsWith("ls")) localStorage.setItem(key, legacy);
          else await window.fixtureRecord("nishijin-campaign-backup", "saves", key, legacy, true);
          const initialized = await api.readV100BrowserSave();
          check(initialized.ok && initialized.save.legacy.eligible, "real legacy source not eligible");
          check(initialized.save.caps === 0 && !initialized.save.campaignStarted, "legacy progression leaked");
          check(initialized.save.settings.bgmEnabled === false && initialized.save.settings.bgmVolume === 0.2 && initialized.save.settings.autoSkipReadStory === true, "safe settings not copied");
          const granted = await api.claimV100BrowserGift(globalThis, { ownerId: "first", screen: "title" });
          check(granted.ok && granted.save.caps === 180 && granted.popup, "legacy grant not durable");
          const raw = source.startsWith("ls") ? localStorage.getItem(key) : await window.fixtureRecord("nishijin-campaign-backup", "saves", key);
          check(raw === legacy, "legacy bytes modified");
          return { source, caps: granted.save.caps, legacyBytesPreserved: true, settingsCopied: true };
        }, { source, legacy }));
      }
      await withCase(browser, engine, "atomic-gift-popup-and-older-import", async (page, context, fixture) => {
        await page.evaluate(legacy => localStorage.setItem("nishijin-campaign-v1", legacy), legacy);
        const oldExport = await page.evaluate(async () => { const api = window.V100StorageFixture; return api.exportV100BrowserSave((await api.readV100BrowserSave()).save); });
        const second = await context.newPage(); await boot(second, fixture.url);
        const claim = (target, ownerId) => target.evaluate(ownerId => window.V100StorageFixture.claimV100BrowserGift(globalThis, { ownerId, screen: "title" }), ownerId);
        const claims = await Promise.all([claim(page, "one"), claim(second, "two")]);
        assert.equal(claims.filter(value => value.popup).length, 1);
        assert.ok(claims.every(value => value.ok && value.save.caps === 180));
        return page.evaluate(async ({ claims, oldExport }) => {
          const api = window.V100StorageFixture, check = window.fixtureAssert;
          const first = claims.find(value => value.popup).popup;
          check(!(await api.acknowledgeV100BrowserGift(globalThis, { ...first, screen: "title", painted: false })).ok, "unpainted acknowledgement accepted");
          check(!(await api.acknowledgeV100BrowserGift(globalThis, { ...first, ownerId: "wrong", screen: "title", painted: true })).ok, "foreign owner acknowledged");
          await api.releaseV100PopupOwnership(globalThis, "wrong");
          check((await window.fixtureRecord(api.V100_DATABASE_NAME, "entitlements", "v100:release-gift:legacy-180:v1")).ownerId === first.ownerId, "foreign release changed owner");
          await api.releaseV100PopupOwnership(globalThis, first.ownerId);
          const reclaimed = await api.claimV100BrowserGift(globalThis, { ownerId: "reclaimed", screen: "title" });
          check(reclaimed.popup && reclaimed.save.caps === 180, "unpainted popup not reclaimable");
          const row = await window.fixtureRecord(api.V100_DATABASE_NAME, "entitlements", "v100:release-gift:legacy-180:v1");
          await window.fixtureRecord(api.V100_DATABASE_NAME, "entitlements", "v100:release-gift:legacy-180:v1", { ...row, expiresAt: Date.now() - 1 });
          const expired = await api.claimV100BrowserGift(globalThis, { ownerId: "after-expiry", screen: "title" });
          check(expired.popup && expired.popup.claimId !== reclaimed.popup.claimId, "expired owner not replaceable");
          const acknowledged = await api.acknowledgeV100BrowserGift(globalThis, { ...expired.popup, screen: "title", painted: true });
          check(acknowledged.ok && acknowledged.save.legacy.popupAcknowledged, "popup acknowledgement missing");
          const restored = await api.restoreV100BrowserSave(oldExport, globalThis, { expectedRevision: acknowledged.save.revision, ownerId: "restorer" });
          check(restored.ok && restored.save.caps === 0 && restored.save.revision > acknowledged.save.revision, "older import did not restore selected balance");
          const final = await api.claimV100BrowserGift(globalThis, { ownerId: "again", screen: "title" });
          check(final.ok && final.save.caps === 0 && final.popup === null && final.save.legacy.popupAcknowledged, "older import duplicated entitlement or popup");
          return { concurrentOwners: 1, grantCaps: 180, restoredCaps: final.save.caps, popupAcknowledged: true, revision: final.save.revision };
        }, { claims, oldExport });
      });
      for (const withSaveGift of [false, true]) await withCase(browser, engine, `pending-reconcile-${withSaveGift}`, async page => page.evaluate(async ({ legacy, withSaveGift }) => {
        const api = window.V100StorageFixture, check = window.fixtureAssert;
        localStorage.setItem("nishijin-campaign-v1", legacy);
        const initial = await api.readV100BrowserSave();
        if (withSaveGift) {
          const gifted = api.claimV100LegacyGift(initial.save).save;
          check((await api.persistV100BrowserSave(gifted, globalThis, { expectedRevision: initial.save.revision })).ok, "seed gifted save failed");
        }
        await window.fixtureRecord(api.V100_DATABASE_NAME, "entitlements", "v100:release-gift:legacy-180:v1", { state: "pending", popupAcknowledged: false });
        const claimed = await api.claimV100BrowserGift(globalThis, { ownerId: "pending", screen: "title" });
        check(claimed.ok && claimed.save.caps === 180 && claimed.popup, "pending reconciliation lost or duplicated grant");
        return { withSaveGift, caps: claimed.save.caps, state: (await window.fixtureRecord(api.V100_DATABASE_NAME, "entitlements", "v100:release-gift:legacy-180:v1")).state };
      }, { legacy, withSaveGift }));
      await withCase(browser, engine, "transaction-abort-mirror-fault-and-corrupt-recovery", async page => page.evaluate(async legacy => {
        const api = window.V100StorageFixture, check = window.fixtureAssert;
        localStorage.setItem("nishijin-campaign-v1", legacy);
        const initial = await api.readV100BrowserSave();
        const originalPut = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function (...args) {
          const request = originalPut.apply(this, args);
          if (this.transaction.db.name === api.V100_DATABASE_NAME) this.transaction.abort();
          return request;
        };
        const failed = await api.claimV100BrowserGift(globalThis, { ownerId: "abort", screen: "title" });
        IDBObjectStore.prototype.put = originalPut;
        check(!failed.ok, "aborted transaction reported success");
        check((await api.readV100BrowserSave()).save.caps === 0, "aborted save leaked");
        check(!(await window.fixtureRecord(api.V100_DATABASE_NAME, "entitlements", "v100:release-gift:legacy-180:v1")), "aborted entitlement leaked");
        const originalSet = Storage.prototype.setItem;
        Storage.prototype.setItem = function () { throw new DOMException("explicit mirror fault", "QuotaExceededError"); };
        const next = api.applyV100SaveMutation(initial.save, save => ({ ...save, caps: 37 })).save;
        const committed = await api.persistV100BrowserSave(next, globalThis, { expectedRevision: initial.save.revision });
        Storage.prototype.setItem = originalSet;
        check(committed.ok && !committed.mirrorSaved && committed.save.caps === 37, "mirror failure misreported durable commit");
        check((await api.readV100BrowserSave()).save.caps === 37, "stale mirror overrode durable save");
        const original = await window.fixtureRecord(api.V100_DATABASE_NAME, "saves", "current");
        await window.fixtureRecord(api.V100_DATABASE_NAME, "saves", "current", { ...original, serialized: original.serialized.replace('"caps":37', '"caps":999') });
        const corrupt = await api.readV100BrowserSave();
        check(!corrupt.ok && corrupt.recovery?.candidate?.caps === 0, "corrupt durable current was silently replaced by mirror");
        const backup = api.exportV100BrowserSave(corrupt.recovery.candidate);
        check(!(await api.restoreV100BrowserSave(backup, globalThis, { recoveryToken: "wrong" })).ok, "wrong recovery token accepted");
        const recovered = await api.restoreV100BrowserSave(backup, globalThis, { recoveryToken: corrupt.recovery.token });
        check(recovered.ok && recovered.save.caps === 0, "explicit previous snapshot recovery failed");
        const archivedKey = (await window.fixtureRecord(api.V100_DATABASE_NAME, "saves")).find(key => String(key).startsWith("corrupt:"));
        check(archivedKey && (await window.fixtureRecord(api.V100_DATABASE_NAME, "saves", archivedKey)).serialized === original.serialized.replace('"caps":37', '"caps":999'), "recovery destroyed corrupt current bytes");
        check(localStorage.getItem("nishijin-campaign-v1") === legacy, "legacy bytes changed");
        return { transactionAborted: true, mirrorDegradedButCommitted: true, corruptionDetected: true, recoveredCaps: recovered.save.caps };
      }, legacy));
      await withCase(browser, engine, "manual-history-and-invalid-existing-mirrors", async page => page.evaluate(async legacyExport => {
        const api = window.V100StorageFixture, check = window.fixtureAssert;
        localStorage.setItem(api.V100_DATABASE_NAME, "{corrupt");
        const corrupt = await api.readV100BrowserSave();
        check(!corrupt.ok && corrupt.recovery, "corrupt-only mirrors reset to default");
        check(corrupt.recovery.raw.includes("{corrupt"), "corrupt mirror bytes missing from recovery export");
        const explicit = await api.restoreV100BrowserSave(api.exportV100BrowserSave(api.createDefaultV100Save()), globalThis, { recoveryToken: corrupt.recovery.token });
        check(explicit.ok, "explicit valid backup recovery failed");
        check((await window.fixtureRecord(api.V100_DATABASE_NAME, "saves", "bootstrap-corrupt-mirrors"))[api.V100_DATABASE_NAME] === "{corrupt", "explicit recovery destroyed corrupt mirror bytes");
        const before = explicit.save;
        check(!(await api.registerV100LegacyHistory('{"revision":1}', globalThis, { expectedRevision: before.revision })).ok, "invalid history accepted");
        const registered = await api.registerV100LegacyHistory(legacyExport, globalThis, { expectedRevision: before.revision });
        check(registered.ok && registered.save.legacy.eligible, "verified manual legacy export rejected");
        check(JSON.stringify(registered.save.settings) === JSON.stringify(before.settings) && registered.save.caps === before.caps, "manual history changed active progression/settings");
        const denied = await api.claimV100BrowserGift(globalThis, { ownerId: "manual", screen: "personnel" });
        check(!denied.ok && denied.reason === "unsafe-screen", "unsafe popup screen allowed");
        const granted = await api.claimV100BrowserGift(globalThis, { ownerId: "manual", screen: "title" });
        check(granted.ok && granted.save.caps === 180, "manual-history gift missing");
        return { corruptMirrorFailedClosed: true, manualHistoryVerified: true, unsafeScreenRejected: true, caps: granted.save.caps };
      }, legacyExport));
    } finally { await browser.close(); }
  }
} catch (error) { report.error = { message: String(error), stack: error.stack }; process.exitCode = 1; }
finally {
  await fs.writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2), { flag: "wx" });
  console.log(JSON.stringify({ passed: report.cases.filter(value => value.status === "passed").length, total: report.cases.length, error: report.error?.message ?? null, report: path.join(out, "report.json") }));
}
