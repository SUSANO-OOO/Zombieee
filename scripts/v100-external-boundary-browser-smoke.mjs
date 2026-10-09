import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { chromium, webkit } from "playwright";
import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";
import { createDefaultCampaignSave, migrateCampaignSave, serializeCampaignSave, setFormationPresetUnits, setFormationPersonalEquipmentSlot, setFormationTacticalEquipmentSlot, getFormationPresetEquipmentSnapshot, CAMPAIGN_UNIT_IDS } from "../app/campaign.js";
import { createDefaultV100Save, serializeV100Save, V100_PRIMARY_STORAGE_KEY } from "../app/v100Save.js";
import { V100_STAGE_IDS } from "../app/v100Registry.js";

const origin = new URL(process.env.V100_CAMPAIGN_QA_BASE_URL);
assert.ok(["localhost", "127.0.0.1"].includes(origin.hostname));
const out = path.resolve(process.env.V100_EXTERNAL_BOUNDARY_EVIDENCE_DIR ?? "outputs/v100-external-boundary");
await fs.mkdir(out, { recursive: false });
const sha = value => crypto.createHash("sha256").update(value ?? "<absent>").digest("hex");
const keys = ["nishijin-campaign-v1", "nishijin-campaign-v1::last-known-good", "nishijin-campaign-v1::pre-migration"];
const engines=(process.env.V100_EXTERNAL_BOUNDARY_ENGINES ?? "chromium,webkit").split(",");
assert.ok(engines.length>0 && new Set(engines).size===engines.length && engines.every(e=>["chromium","webkit"].includes(e)));
const viewportFilter=process.env.V100_EXTERNAL_BOUNDARY_VIEWPORT ?? null;
if(viewportFilter) assert.ok(["1280x720","844x390","844x340"].includes(viewportFilter));
const audioPolicy=process.env.V100_EXTERNAL_BOUNDARY_AUDIO_POLICY ?? "required";
assert.ok(["required","windows-storage-only"].includes(audioPolicy));
if(audioPolicy === "windows-storage-only") assert.equal(process.platform,"win32");
const lane=process.env.V100_EXTERNAL_BOUNDARY_LANE ?? "boundary";
assert.ok(["boundary","settlement"].includes(lane));
const report = { lane, engines, viewportFilter, audioPolicy, host:{platform:process.platform,node:process.version}, engineVersions:{}, fullAcceptance:false, scope: "Actual production external-battle boundary; disclosed synthetic V1/legacy fixtures and explicit native IDB abort/transaction hold; no combat mutators", build: await productionBuildIdentity(), cases: [], error: null };
const v1 = createDefaultV100Save({ playerName: "境界診断", settings: { bgmEnabled: false, sfxEnabled: false, graphicsQuality: "power-save", autoSkipReadStory: true } });
v1.campaignStarted = true;
v1.flowState = { ...v1.flowState, phase: "formation", destination: "formation", stageId: V100_STAGE_IDS[0], stageNumber: 1 };
const v1Serialized = serializeV100Save(v1);
function legacyFixture(equipped) {
  let save = migrateCampaignSave({ ...createDefaultCampaignSave(), campaignStarted: true, equipmentInventory: equipped ? [
    { equipmentId: "field-machete", quantity: 1 }, { equipmentId: "tactical-supply-cache", quantity: 1 },
  ] : [], settings: { ...createDefaultCampaignSave().settings, bgmEnabled: true, sfxEnabled: true, graphicsQuality: "high" } });
  save = setFormationPresetUnits(save, "formation-preset-1", [CAMPAIGN_UNIT_IDS.PAISEN]);
  if (equipped) {
    save = setFormationPersonalEquipmentSlot(save, { presetId: "formation-preset-1", unitId: CAMPAIGN_UNIT_IDS.PAISEN, slotIndex: 0, equipmentId: "field-machete" });
    save = setFormationTacticalEquipmentSlot(save, { presetId: "formation-preset-1", slotIndex: 0, equipmentId: "tactical-supply-cache" });
  }
  const equipment = getFormationPresetEquipmentSnapshot(save);
  if (equipped) {
    assert.ok(equipment.personalEquipmentByUnit[CAMPAIGN_UNIT_IDS.PAISEN].includes("field-machete"));
    assert.ok(equipment.tacticalEquipmentIds.includes("tactical-supply-cache"));
  }
  return { serialized: serializeCampaignSave(save), equipment, settings: save.settings };
}
async function oldBytes(page) {
  const raw = await page.evaluate(async keys => {
    const local = Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)]));
    const indexed = await new Promise((resolve, reject) => {
      const request = indexedDB.open("nishijin-campaign-backup");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result, tx = db.transaction("saves", "readonly"), values = {};
        for (const key of keys) { const read = tx.objectStore("saves").get(key); read.onsuccess = () => { values[key] = read.result ?? null; }; }
        tx.oncomplete = () => { db.close(); resolve(values); }; tx.onabort = () => reject(tx.error);
      };
    });
    return { local, indexed };
  }, keys);
  return Object.fromEntries(Object.entries(raw).map(([store, values]) => [store, Object.fromEntries(Object.entries(values).map(([key, bytes]) => [key, { sha256: sha(bytes), bytes: bytes?.length ?? 0 }]))]));
}
async function audioIdle(page, record, label) {
  if (!record.nativeAudioSupported) {
    assert.equal(audioPolicy,"windows-storage-only"); assert.equal(process.platform,"win32"); assert.equal(record.engine,"webkit");
    const d=await page.evaluate(() => {const d=window.__ASHFALL_AUDIO_QA__.getDiagnostics();return {cache:d.cache,failedAssets:d.failedAssets,warningTotal:d.warningTotal,audioState:d.audioState};});
    assert.deepEqual(d.failedAssets,[]);
    (record.audioBoundaries ??= []).push({label,status:"unsupported-native-web-audio",...d});
    return;
  }
  await page.waitForFunction(() => {
    const d=window.__ASHFALL_AUDIO_QA__?.getDiagnostics();
    if (!d) return false;
    if (d.failedAssets.length || d.warningTotal) throw new Error("Audio failed before " + "settled boundary: " + JSON.stringify(d.failedAssets));
    return d.activePreloads === 0 && d.queuedPreloads === 0 && d.cache.loading === 0;
  });
  const state=await page.evaluate(() => { const d=window.__ASHFALL_AUDIO_QA__.getDiagnostics(); return {activePreloads:d.activePreloads,queuedPreloads:d.queuedPreloads,failedAssets:d.failedAssets,warningTotal:d.warningTotal,cache:d.cache}; });
  (record.audioBoundaries ??= []).push({label,...state});
}
async function snapshot(page) {
  // React publishes the read-only QA bridge after its committed DOM/state.
  // Wait for that observer to reflect the durable V1 settings before comparing.
  await page.waitForFunction(key => {
    const s=window.__ASHFALL_BATTLE_QA__?.getSnapshot();
    const saved=JSON.parse(localStorage.getItem(key) ?? "null");
    return s?.settings && saved?.settings && Object.keys(s.settings).length >= 7
      && Object.entries(s.settings).every(([name,value]) => saved.settings[name] === value);
  }, V100_PRIMARY_STORAGE_KEY, {polling:100});
  return page.evaluate(() => {
    const s = window.__ASHFALL_BATTLE_QA__.getSnapshot();
    return { resultId: s.resultId, stageId: s.stageId, time: s.time, running: s.running, paused: s.paused, energy: s.energy, formationKinds: s.formationKinds, settings: s.settings, equipmentInventory: s.equipmentInventory,
      humans: s.fighters.filter(f => f.side === "human").map(f => ({ id: f.id, kind: f.kind, damage: f.damage, maxHp: f.maxHp, attackEvery: f.attackEvery })),
      graphics: window.__ASHFALL_BATTLE_QA__.getPerformanceSnapshot().graphicsProfile };
  });
}
try {
  for (const engine of engines) {
    const browser = await ({ chromium, webkit }[engine]).launch();
    report.engineVersions[engine]=browser.version();
    try {
      for (const viewport of (lane === "settlement" ? [{width:1280,height:720}] : [{width:1280,height:720},{width:844,height:390},{width:844,height:340}].filter(v=>!viewportFilter || `${v.width}x${v.height}`===viewportFilter))) for (const equipped of (lane === "settlement" ? [false] : [false, true])) {
        const fixture = legacyFixture(equipped);
        const record = { engine, viewport, name: `${engine}-${viewport.width}x${viewport.height}-${equipped ? "legacy-equipped-corrupt-primary" : "legacy-neutral"}`, fixture: { legacySha256: sha(fixture.serialized), v100Sha256: sha(v1Serialized), legacyEquipment: fixture.equipment, legacySettings: fixture.settings, v100Settings: v1.settings }, errors: [], status: "running" };
        report.cases.push(record);
        const context = await browser.newContext({ viewport, hasTouch:viewport.width<1000 });
        await context.route("**/__v100-boundary-seed", route => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>isolated seed</title>" }));
        await context.addInitScript(({ qaOrigin, keys }) => {
          if (location.origin !== qaOrigin || location.pathname === "/__v100-boundary-seed") return;
          window.__OLD_SAVE_WRITES__ = [];
          const transaction = IDBDatabase.prototype.transaction;
          IDBDatabase.prototype.transaction = function (stores, mode) {
            const tx = Reflect.apply(transaction, this, arguments);
            if (this.name === "nishijin-campaign-v100" && mode === "readwrite" && window.__V1_SETTINGS_FAULT__) tx.abort();
            return tx;
          };
          const record = (kind, key, value) => { if (window.__OLD_SAVE_WRITES__.length < 100) window.__OLD_SAVE_WRITES__.push({ kind, key: key ?? null, bytes: typeof value === "string" ? value.length : null, at: performance.now() }); };
          for (const method of ["setItem", "removeItem"]) {
            const original = Storage.prototype[method];
            Storage.prototype[method] = function (key, value) { if (this === localStorage && keys.includes(key)) record(`localStorage.${method}`, key, value); return Reflect.apply(original, this, arguments); };
          }
          const clear = Storage.prototype.clear;
          Storage.prototype.clear = function () { if (this === localStorage && keys.some(key => this.getItem(key) !== null)) record("localStorage.clear", null, null); return Reflect.apply(clear, this, arguments); };
          for (const method of ["put", "add", "delete", "clear"]) {
            const original = IDBObjectStore.prototype[method];
            IDBObjectStore.prototype[method] = function (value, key) { if (this.transaction.db.name === "nishijin-campaign-backup") record(`indexedDB.${method}`, method === "delete" ? value : key, value); return Reflect.apply(original, this, arguments); };
          }
        }, { qaOrigin: origin.origin, keys });
        const page = await context.newPage();
        page.setDefaultTimeout(45000);
        page.on("console", m => { if (m.type() === "error") record.errors.push({ type: "console", message: m.text() }); });
        page.on("pageerror", e => record.errors.push({ type: "page", message: String(e) }));
        page.on("requestfailed", r => record.errors.push({ type: "request", url: r.url(), error: r.failure()?.errorText }));
        page.on("response", r => { if (r.status() >= 400) record.errors.push({ type: "http", status: r.status(), url: r.url() }); });
        try {
          await page.goto(new URL("/__v100-boundary-seed", origin).href);
          record.audioCapability=await page.evaluate(() => ({audioContext:typeof AudioContext,webkitAudioContext:typeof window.webkitAudioContext,offlineAudioContext:typeof OfflineAudioContext,secureContext:isSecureContext}));
          record.nativeAudioSupported=record.audioCapability.audioContext === "function" || record.audioCapability.webkitAudioContext === "function";
          if (!record.nativeAudioSupported) {
            assert.equal(audioPolicy,"windows-storage-only","Native Web Audio is required; no playback substitution is accepted");
            assert.equal(engine,"webkit"); assert.equal(process.platform,"win32");
            record.pendingAcceptance="native WebKit audio on the canonical macOS runtime";
          }
          await page.evaluate(async ({ keys, legacy, key, v1, equipped }) => {
            for (const name of keys) localStorage.setItem(name, legacy);
            if (equipped) localStorage.setItem(keys[0], "explicit-corrupt-legacy-primary");
            localStorage.setItem(key, v1);
            await new Promise((resolve, reject) => {
              const request = indexedDB.open("nishijin-campaign-backup", 1);
              request.onupgradeneeded = () => request.result.createObjectStore("saves");
              request.onerror = () => reject(request.error);
              request.onsuccess = () => { const db = request.result, tx = db.transaction("saves", "readwrite"); for (const key of keys) if (!equipped || key !== keys[0]) tx.objectStore("saves").put(legacy, key); tx.oncomplete = () => { db.close(); resolve(); }; tx.onabort = () => reject(tx.error); };
            });
          }, { keys, legacy: fixture.serialized, key: V100_PRIMARY_STORAGE_KEY, v1: v1Serialized, equipped });
          record.before = await oldBytes(page);
          await page.goto(new URL("/v100", origin).href, { waitUntil: "domcontentloaded" });
          await page.waitForFunction(() => document.querySelector(".v100-shell") || document.querySelector("[role=dialog][aria-label='ゲームデータの準備'] button"));
          const offer = page.getByRole("button", { name: "ブラウザで遊ぶ", exact: true });
          if (await offer.isVisible()) await offer.click();
          await page.locator('.v100-shell[data-v100-phase="formation"]').waitFor();
          await page.waitForFunction(() => document.documentElement.dataset.pwaSaveMutationPending === "false");
          record.writesBeforeBattle = await page.evaluate(() => window.__OLD_SAVE_WRITES__);
          await page.getByRole("button", { name: "戦闘へ", exact: true }).click();
          await page.waitForFunction(() => window.__ASHFALL_ASSET_QA__?.getBattleMountState?.().battleMounted === true && window.__ASHFALL_BATTLE_QA__?.getSnapshot().time >= 1);
          record.beforeDeployment = await snapshot(page);
          await page.locator('.unit-card[data-kind="brawler"]').click();
          await page.waitForFunction(() => window.__ASHFALL_BATTLE_QA__?.getSnapshot().fighters.some(f => f.side === "human" && f.kind === "brawler"));
          await page.getByRole("button", { name: "一時停止", exact: true }).click();
          record.afterDeployment = await snapshot(page);
          const pause = page.getByRole("dialog", { name: "一時停止メニュー", exact:true });
          assert.equal(record.afterDeployment.humans[0].damage, 26);
          assert.equal(record.afterDeployment.graphics.requestedMode, "power-save");
          for (const key of Object.keys(record.afterDeployment.settings)) assert.equal(record.afterDeployment.settings[key], v1.settings[key]);
          assert.deepEqual(record.afterDeployment.equipmentInventory, []);
          assert.ok(Math.abs(record.beforeDeployment.energy - 3 * record.beforeDeployment.time - 70) < 0.001);
          assert.deepEqual(record.writesBeforeBattle, []);
          const v1Save = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), V100_PRIMARY_STORAGE_KEY);
          const saved = await v1Save();
          const samePausedRun = async () => {
            const current = await snapshot(page);
            assert.equal(current.resultId, record.afterDeployment.resultId);
            assert.equal(current.time, record.afterDeployment.time);
            assert.equal(current.paused, true);
            assert.deepEqual(current.humans, record.afterDeployment.humans);
          };
          await page.evaluate(() => { window.__V1_SETTINGS_FAULT__ = true; });
          await pause.getByRole("button", { name: "BGMを有効にする", exact:true }).click();
          const retry = page.getByRole("button", { name: "設定の保存を再試行", exact:true });
          await retry.waitFor();
          assert.deepEqual((await v1Save()).settings, saved.settings);
          assert.equal((await v1Save()).revision, saved.revision);
          await samePausedRun();
          await page.evaluate(() => { window.__V1_SETTINGS_FAULT__ = false; });
          await retry.click();
          await pause.getByRole("button", { name: "BGMをミュート", exact:true }).waitFor();
          assert.equal((await v1Save()).settings.bgmEnabled, true);
          assert.equal((await v1Save()).revision, saved.revision + 1);
          await samePausedRun();

          // Keep a genuine IDB write transaction ahead of the requested save.
          await page.evaluate(() => new Promise((resolve,reject) => {
            window.__V1_SETTINGS_HOLD__ = true;
            const request = indexedDB.open("nishijin-campaign-v100");
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
              const db=request.result, tx=db.transaction(["saves","entitlements"],"readwrite"), store=tx.objectStore("saves");
              const keepAlive = () => { const read=store.get("current"); read.onsuccess=() => { resolve(); if(window.__V1_SETTINGS_HOLD__) keepAlive(); }; };
              keepAlive(); tx.oncomplete=() => db.close(); tx.onabort=() => reject(tx.error);
            };
          }));
          await pause.getByRole("slider",{name:"BGM音量",exact:true}).press("Home");
          await page.getByRole("status").filter({hasText:"設定を保存しています"}).waitFor();
          assert.equal(await page.evaluate(() => document.documentElement.dataset.pwaSaveMutationPending), "true");
          await pause.getByRole("button",{name:"作戦を再開",exact:true}).click();
          await samePausedRun();
          await page.evaluate(() => { window.__V1_SETTINGS_HOLD__ = false; });
          await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).settings.bgmVolume === 0 && document.documentElement.dataset.pwaSaveMutationPending === "false", V100_PRIMARY_STORAGE_KEY);
          await pause.getByRole("button",{name:"BGMを有効にする",exact:true}).waitFor();
          await samePausedRun();
          await pause.getByRole("slider",{name:"BGM音量",exact:true}).press("End");
          await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).settings.bgmVolume === 1 && document.documentElement.dataset.pwaSaveMutationPending === "false", V100_PRIMARY_STORAGE_KEY);
          await pause.getByRole("button",{name:"効果音を有効にする",exact:true}).click();
          await pause.getByRole("button",{name:"効果音をミュート",exact:true}).waitFor();
          await pause.locator("[data-graphics-quality-control]").click();
          await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).settings.graphicsQuality === "auto" && document.documentElement.dataset.pwaSaveMutationPending === "false", V100_PRIMARY_STORAGE_KEY);
          await samePausedRun();
          await pause.getByRole("button",{name:"初回のみ",exact:true}).click();
          await pause.getByRole("button",{name:"通信を簡略表示",exact:true}).waitFor();
          assert.equal((await v1Save()).settings.battleEventMode,"compact");
          await samePausedRun();
          record.afterSettings = await snapshot(page);
          const settings = (await v1Save()).settings;
          assert.equal(record.afterSettings.graphics.requestedMode, "auto");
          assert.equal(record.afterSettings.settings.bgmVolume, 1);
          assert.equal(record.afterSettings.settings.sfxEnabled, true);
          const imagePath = path.join(out, record.name+"-saved-settings.png");
          await audioIdle(page,record,"capture");
          const image=await page.screenshot({path:imagePath,timeout:45000,animations:"disabled"});
          record.image={file:imagePath,sha256:sha(image),width:image.readUInt32BE(16),height:image.readUInt32BE(20)};
          record.writesBeforeNavigation=await page.evaluate(() => window.__OLD_SAVE_WRITES__);
          assert.deepEqual(record.writesBeforeNavigation,[]);
          if (lane === "settlement") {
            const changed = await v1Save();
            assert.ok(changed.revision > saved.revision);
            await pause.getByRole("button",{name:"作戦を再開",exact:true}).click();
            await page.locator('.v100-shell[data-v100-phase="result"]').waitFor({state:"visible",timeout:120000});
            const settled=await v1Save();
            const result=settled.pendingResult ?? settled.lastResult;
            assert.ok(result); assert.equal(typeof result.won,"boolean");
            assert.equal(result.resultId,record.afterDeployment.resultId);
            assert.equal(result.stageId,record.afterDeployment.stageId);
            if(result.won) { assert.deepEqual(result,settled.pendingResult); assert.equal(settled.caps,saved.caps); assert.deepEqual(settled.completedStageIds,saved.completedStageIds); }
            else assert.deepEqual(result,settled.lastResult);
            assert.deepEqual(settled.settings,settings);
            record.naturalResult=result;
            record.resultStoredAs=result.won?"pendingResult":"lastResult";
            record.resultRevision=settled.revision;
          } else {
          await audioIdle(page,record,"loadout");
          await pause.getByRole("button",{name:"編成画面へ戻る",exact:true}).click();
          await page.getByRole("button",{name:"実行する",exact:true}).click();
          await page.locator('.v100-shell[data-v100-phase="formation"]').waitFor();
          await page.getByRole("button",{name:"戦闘へ",exact:true}).click();
          await page.waitForFunction(() => window.__ASHFALL_ASSET_QA__?.getBattleMountState?.().battleMounted === true);
          await page.getByRole("button",{name:"一時停止",exact:true}).click();
          const nextRun=await snapshot(page);
          assert.notEqual(nextRun.resultId,record.afterDeployment.resultId);
          assert.deepEqual(nextRun.settings, record.afterSettings.settings);
          await audioIdle(page,record,"restart");
          await pause.getByRole("button",{name:"ステージを最初からやり直す",exact:true}).click();
          await page.getByRole("button",{name:"実行する",exact:true}).click();
          await page.waitForFunction(previous => window.__ASHFALL_ASSET_QA__?.getBattleMountState?.().battleMounted === true && window.__ASHFALL_BATTLE_QA__?.getSnapshot().resultId !== previous, nextRun.resultId);
          record.restartRun=await snapshot(page);
          assert.notEqual(record.restartRun.resultId,nextRun.resultId);
          assert.deepEqual((await v1Save()).settings, settings);
          assert.deepEqual(await oldBytes(page),record.before);
          record.writesBeforeReload=await page.evaluate(() => window.__OLD_SAVE_WRITES__);
          assert.deepEqual(record.writesBeforeReload,[]);
          await page.waitForLoadState("networkidle");
          await audioIdle(page,record,"reload");
          await page.reload({waitUntil:"domcontentloaded"});
          await page.waitForFunction(() => document.querySelector(".v100-shell") || document.querySelector("[role=dialog][aria-label='ゲームデータの準備'] button"));
          const reloadOffer = page.getByRole("button", { name: "ブラウザで遊ぶ", exact: true });
          if (await reloadOffer.isVisible()) await reloadOffer.click();
          await page.waitForFunction(() => window.__ASHFALL_ASSET_QA__?.getBattleMountState?.().battleMounted === true);
          record.reloadedRun=await snapshot(page);
          assert.deepEqual(record.reloadedRun.settings,record.afterSettings.settings);
          assert.deepEqual((await v1Save()).settings,settings);
          }
          if (lane === "boundary") await audioIdle(page,record,"complete");
          record.after = await oldBytes(page);
          record.writesAfterBattle = await page.evaluate(() => window.__OLD_SAVE_WRITES__);
          record.v100SettingsAfter = await page.evaluate(key => JSON.parse(localStorage.getItem(key)).settings, V100_PRIMARY_STORAGE_KEY);
          record.durableSettingsAfter = await page.evaluate(() => new Promise((resolve,reject) => {
            const request=indexedDB.open("nishijin-campaign-v100");
            request.onerror=() => reject(request.error);
            request.onsuccess=() => { const db=request.result, tx=db.transaction("saves","readonly"), read=tx.objectStore("saves").get("current"); let settings; read.onsuccess=() => { settings=JSON.parse(read.result.serialized).settings; }; tx.oncomplete=() => { db.close(); resolve(settings); }; tx.onabort=() => reject(tx.error); };
          }));
          assert.deepEqual(record.durableSettingsAfter,record.v100SettingsAfter);
          assert.equal(record.durableSettingsAfter.autoSkipReadStory,true);
          record.oldBytesChanged = JSON.stringify(record.before) !== JSON.stringify(record.after);
          record.oldWriteAttemptCount = record.writesAfterBattle.length;
          assert.equal(record.oldBytesChanged, false);
          assert.equal(record.oldWriteAttemptCount, 0);
          assert.deepEqual(record.errors, []);
          record.status = record.nativeAudioSupported ? "passed" : "storage-only";
        } catch (error) {
          record.status = "failed"; record.error = String(error); record.errorStack = error.stack;
          record.visibleText = (await page.locator("body").innerText().catch(() => "")).slice(0, 3000);
          try { const file=path.join(out,record.name+"-failure.png"), bytes=await page.screenshot({path:file,timeout:45000,animations:"disabled"}); record.failureImage={file,sha256:sha(bytes),width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)}; } catch(e) { record.failureImageError=String(e); }
          throw error;
        } finally {
          await context.close();
          await fs.writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2));
        }
      }
    } finally { await browser.close(); }
  }
  assert.equal(report.cases.length,engines.length * (lane === "settlement" ? 1 : viewportFilter ? 2 : 6));
  report.fullAcceptance=engines.length === 2 && !viewportFilter && report.cases.every(record => record.status === "passed");
} catch (error) { report.error = String(error); process.exitCode = 1; }
finally { report.buildAfter = await productionBuildIdentity(); await fs.writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ cases: report.cases.map(c => ({ engine: c.engine, name: c.name, status: c.status, oldWriteAttemptCount: c.oldWriteAttemptCount, errors: c.errors.length })), audioPolicy:report.audioPolicy,fullAcceptance:report.fullAcceptance,error: report.error })); }
