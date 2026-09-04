import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { chromium, webkit } from "playwright";
import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";
import { createDefaultV100Save, serializeV100Save, V100_PRIMARY_STORAGE_KEY } from "../app/v100Save.js";
import { V100_SUPPORTS } from "../app/v100Registry.js";

const origin = new URL(process.env.V100_CAMPAIGN_QA_BASE_URL ?? "http://127.0.0.1:4177");
assert.ok(["localhost", "127.0.0.1"].includes(origin.hostname));
const out = path.resolve(process.env.V100_SUPPORT_EVIDENCE_DIR ?? "outputs/v100-support-runtime");
await fs.mkdir(out, { recursive: false });
const engines = (process.env.V100_SUPPORT_ENGINES ?? "chromium,webkit").split(",");
assert.ok(engines.length > 0 && engines.every(e => ["chromium", "webkit"].includes(e)));
const audioPolicy = process.env.V100_SUPPORT_AUDIO_POLICY ?? "required";
assert.ok(["required", "windows-storage-only"].includes(audioPolicy));
if (audioPolicy === "windows-storage-only") assert.equal(process.platform, "win32");
const lane = process.env.V100_SUPPORT_LANE ?? "acceptance";
assert.ok(["acceptance", "diagnostic"].includes(lane));
if (lane === "diagnostic") assert.deepEqual(engines, ["chromium"], "Bounded diagnostic is Chromium only");
const viewports = lane === "diagnostic" ? [{ width: 844, height: 390 }] : [{ width: 1280, height: 720 }, { width: 844, height: 390 }, { width: 844, height: 340 }];
const selectedSupports = lane === "diagnostic" ? V100_SUPPORTS.filter(s => s.id === "support-explosive-drum") : [null, ...V100_SUPPORTS];
const report = { lane, audioPolicy, hostPlatform: process.platform, nodeVersion: process.version, fullAcceptance: false, build: await productionBuildIdentity(), scope: "actual support/vehicle actions from isolated owned-support saves; no battle mutation bridge", cases: [], error: null };
const sha = b => crypto.createHash("sha256").update(b).digest("hex");
async function waitAudioIdle(page, record) {
  if (!record.nativeAudioSupported) {
    assert.equal(audioPolicy, "windows-storage-only"); assert.equal(process.platform, "win32"); assert.equal(record.engine, "webkit");
    return;
  }
  await page.waitForFunction(() => {
    const bridge = window.__ASHFALL_AUDIO_QA__, a = bridge?.getDiagnostics?.();
    if (!a) return false;
    if (a.warningTotal || a.failedAssets.length || bridge.getFailureEvents().overflow) throw new Error(JSON.stringify({ diagnostics: a, failures: bridge.getFailureEvents(), status: bridge.getAudioStatus() }));
    return a.activePreloads === 0 && a.queuedPreloads === 0 && a.cache.loading === 0;
  }, null, { timeout: 45000 });
}
async function shot(page, record, label) {
  const readinessStartedAt = Date.now();
  const audioBefore = await page.evaluate(() => window.__ASHFALL_AUDIO_QA__?.getDiagnostics?.());
  if (label !== "failure") {
    // Observe automatic production loading; do not make capture compete with pending media.
    await waitAudioIdle(page, record);
    assert.deepEqual((await page.evaluate(() => window.__ASHFALL_AUDIO_QA__.getDiagnostics())).failedAssets, []);
  }
  const readinessMs = Date.now() - readinessStartedAt;
  const startedAt = Date.now();
  const file = path.join(out, `${record.name}-${label}.png`), bytes = await page.screenshot({ path: file, timeout: 45000, animations: "disabled" });
  record.images.push({ file, label, audioBefore, readinessMs, startedAt, elapsedMs: Date.now() - startedAt, sha256: sha(bytes), width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) });
}
async function read(page) {
  return page.evaluate(() => {
    const s = window.__ASHFALL_BATTLE_QA__.getSnapshot();
    const a = window.__ASHFALL_AUDIO_QA__?.getDiagnostics?.();
    const audio = a ? { contextGeneration: a.contextGeneration, contextState: a.contextState, audioState: a.audioState,
      assetLoadTimeoutMs: a.assetLoadTimeoutMs, assetDecodeTimeoutMs: a.assetDecodeTimeoutMs,
      activePreloads: a.activePreloads, queuedPreloads: a.queuedPreloads, cache: a.cache, failedAssets: a.failedAssets, warningTotal: a.warningTotal,
      failures: window.__ASHFALL_AUDIO_QA__.getFailureEvents(), status: window.__ASHFALL_AUDIO_QA__.getAudioStatus() } : null;
    return { audio, observedAt: Date.now(), stageId: s.stageId, time: s.time, paused: s.paused, over: s.over, scrap: s.scrap, supportGauge: s.supportGauge,
      v100SupportId: s.v100SupportId, supportItemCooldowns: s.supportItemCooldowns, battlefieldObjects: s.battlefieldObjects,
      areaEffects: s.areaEffects, airstrike: s.airstrike, crawlerAbility: s.crawlerAbility, placementIndicator: s.placementIndicator };
  });
}
async function readyCampaign(page) {
  await page.waitForFunction(() => document.documentElement.dataset.pwaSaveMutationPending === "false" && document.querySelector(".v100-shell[data-v100-phase]"));
}
async function clickSaved(page, button) {
  await readyCampaign(page);
  const before = await page.evaluate(key => JSON.parse(localStorage.getItem(key)).revision, V100_PRIMARY_STORAGE_KEY);
  await button.click();
  await page.waitForFunction(({ key, before }) => JSON.parse(localStorage.getItem(key)).revision > before && document.documentElement.dataset.pwaSaveMutationPending === "false", { key: V100_PRIMARY_STORAGE_KEY, before });
}
async function battle(page) {
  await page.goto(new URL("/v100", origin).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelector(".v100-shell") || document.querySelector("[role=dialog][aria-label='ゲームデータの準備'] button"));
  const offer = page.getByRole("button", { name: "ブラウザで遊ぶ", exact: true });
  if (await offer.isVisible()) await offer.click();
  await clickSaved(page, page.getByRole("button", { name: "この作戦を編成", exact: true }));
  for (let n = 0; n < 40; n++) {
    await readyCampaign(page);
    if (await page.locator(".v100-formation-panel").isVisible()) break;
    const skip = page.getByRole("button", { name: "スキップ", exact: true });
    if (await skip.isVisible()) await clickSaved(page, skip); else await clickSaved(page, page.locator(".v100-event-actions .v100-primary"));
  }
  await clickSaved(page, page.getByRole("button", { name: "戦闘へ", exact: true }));
  await page.waitForFunction(() => window.__ASHFALL_ASSET_QA__?.getBattleMountState?.().battleMounted === true && window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().running);
  await page.getByRole("button", { name: "一時停止", exact: true }).waitFor();
}
async function clickWorld(page, x, y) {
  const canvas = page.locator("canvas.battlefield");
  const position = await canvas.evaluate((c, p) => ({ x: Number(c.dataset.worldOffsetX) + p.x * Number(c.dataset.worldScale), y: Number(c.dataset.worldOffsetY) + p.y * Number(c.dataset.worldScale) }), { x, y });
  const box = await canvas.boundingBox();
  assert.ok(position.x > 0 && position.x < box.width && position.y > 0 && position.y < box.height, "Actual world target must be visible");
  await canvas.click({ position });
}
async function tapCoolingControl(page, button) {
  // A physical tap must occur now; locator.click would wait until aria-disabled clears.
  const point = await button.evaluate(element => {
    const r = element.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
    if (!element.contains(document.elementFromPoint(x, y))) throw new Error("Support tap target is obscured");
    return { x, y };
  });
  await page.mouse.click(point.x, point.y);
}
async function pauseCheck(page, record) {
  await page.getByRole("button", { name: "一時停止", exact: true }).click();
  const before = await read(page);
  await page.keyboard.press("g"); await page.keyboard.press("q"); await page.keyboard.press("v"); await page.keyboard.press("m"); await page.keyboard.press("b");
  await page.waitForTimeout(1100);
  const after = await read(page);
  assert.equal(after.paused, true); assert.equal(after.time, before.time);
  assert.equal(after.scrap, before.scrap); assert.equal(after.supportGauge, before.supportGauge);
  assert.deepEqual(after.supportItemCooldowns, before.supportItemCooldowns);
  assert.deepEqual(after.airstrike, before.airstrike); assert.deepEqual(after.crawlerAbility, before.crawlerAbility);
  record.pause = { before, after };
  await page.getByRole("button", { name: "作戦を再開", exact: true }).click();
}

try {
  for (const engine of engines) {
    const browser = await ({ chromium, webkit }[engine]).launch();
    try {
      for (const viewport of viewports) for (const support of selectedSupports) {
        const id = support?.id ?? null;
        const record = { name: `${engine}-${viewport.width}x${viewport.height}-${id ?? "unequipped"}`, engine, viewport, supportId: id,
          browserVersion: browser.version(), fixture: "isolated Stage1 map save; the named support is owned/equipped without claiming natural unlock progression; permanent CAPS0", status: "running", images: [], errors: [] };
        report.cases.push(record);
        const seed = serializeV100Save({ ...createDefaultV100Save({ playerName: "支援監査" }), campaignStarted: true,
          supportPurchaseUnlockedIds: id ? [id] : [], ownedSupportIds: id ? [id] : [], equippedSupportId: id,
          flowState: { phase: "map", destination: "map" } });
        const context = await browser.newContext({ viewport });
        await context.addInitScript(({ key, seed }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, seed); }, { key: V100_PRIMARY_STORAGE_KEY, seed });
        const page = await context.newPage(); page.setDefaultTimeout(45000);
        const requests = new WeakMap(); record.requestTimings = []; record.warnings = [];
        page.on("request", request => {
          if (record.requestTimings.length >= 2048) { record.errors.push({ type: "request-evidence-overflow" }); return; }
          const entry = { url: request.url(), resourceType: request.resourceType(), startedAt: Date.now() };
          requests.set(request, entry); record.requestTimings.push(entry);
        });
        page.on("response", response => { const entry = requests.get(response.request()); if (entry) { entry.status = response.status(); entry.responseAt = Date.now(); } });
        page.on("requestfinished", request => { const entry = requests.get(request); if (entry) { entry.finishedAt = Date.now(); entry.timing = request.timing(); } });
        page.on("requestfailed", request => { const entry = requests.get(request); if (entry) { entry.failedAt = Date.now(); entry.failure = request.failure(); entry.timing = request.timing(); } });
        page.on("console", m => { if (m.type() === "warning") record.warnings.push({ at: Date.now(), text: m.text() }); });
        page.on("console", m => { if (m.type() === "error") record.errors.push({ type: "console", message: m.text() }); });
        page.on("pageerror", e => record.errors.push({ type: "page", message: String(e) }));
        page.on("requestfailed", r => record.errors.push({ type: "request", url: r.url(), error: r.failure()?.errorText }));
        page.on("response", r => { if (r.status() >= 400) record.errors.push({ type: "http", url: r.url(), status: r.status() }); });
        try {
          record.phase = "battle-entry";
          await battle(page); record.initial = await read(page);
          record.nativeAudio = await page.evaluate(() => ({ audioContext: typeof window.AudioContext, webkitAudioContext: typeof window.webkitAudioContext, secureContext: window.isSecureContext }));
          record.nativeAudioSupported = record.nativeAudio.audioContext === "function" || record.nativeAudio.webkitAudioContext === "function";
          if (!record.nativeAudioSupported) {
            assert.equal(audioPolicy, "windows-storage-only", "Native Web Audio is required; unsupported Windows checks are explicitly partial");
            assert.equal(process.platform, "win32"); assert.equal(engine, "webkit");
          }
          assert.equal(record.initial.v100SupportId, id); assert.equal(record.initial.scrap, 120);
          const button = page.locator(".support-btn[data-support-id]");
          assert.equal(await button.getAttribute("data-support-id"), id ?? "none");
          record.phase = "before-first-capture";
          await shot(page, record, "ready");
          record.phase = "support-actions";
          if (!support) {
            assert.equal(await button.isDisabled(), true); assert.match(await button.innerText(), /支援未装備/);
            assert.doesNotMatch(await page.locator(".support-row").innerText(), /投下ポッド/);
            await page.keyboard.press("v"); await clickWorld(page, 490, 350);
            record.rejected = await read(page); assert.equal(record.rejected.scrap, 120); assert.deepEqual(record.rejected.battlefieldObjects, []);
            await pauseCheck(page, record);
          } else {
            assert.match(await button.getAttribute("aria-label"), new RegExp(`${support.displayName} ${support.battleCost}スクラップ`));
            await button.click(); await clickWorld(page, 490, 350);
            await page.waitForFunction(id => window.__ASHFALL_BATTLE_QA__.getSnapshot().battlefieldObjects.some(o => o.v100SupportId === id), id);
            record.placed = await read(page);
            assert.equal(record.placed.scrap, 120 - support.battleCost);
            const kind = id === "support-healing" ? "medical" : "drum", object = record.placed.battlefieldObjects[0];
            const timer = record.placed.supportItemCooldowns[kind];
            assert.ok(timer > support.cooldownSeconds - 1 && timer <= support.cooldownSeconds);
            assert.equal(object.v100SupportId, id);
            await tapCoolingControl(page, button); await clickWorld(page, 630, 350);
            record.duplicate = await read(page); assert.equal(record.duplicate.battlefieldObjects.length, 1); assert.equal(record.duplicate.scrap, record.placed.scrap);
            assert.ok(record.duplicate.time - record.placed.time < 2, "Duplicate input must occur before the cooldown expires");
            if (kind === "drum") {
              await page.waitForFunction(oid => window.__ASHFALL_BATTLE_QA__.getSnapshot().battlefieldObjects.some(o => o.id === oid && o.phase === "active"), object.id);
              await clickWorld(page, object.x, object.y);
              await page.waitForFunction(oid => window.__ASHFALL_BATTLE_QA__.getSnapshot().battlefieldObjects.some(o => o.id === oid && o.phase === "destroying" && o.detonationTriggered === true), object.id);
              record.detonated = await read(page);
              const burns = record.detonated.areaEffects.filter(e => e.kind === "burn" && e.sourceSupplyId === object.id);
              assert.equal(burns.length, id === "support-incendiary-drum" ? 1 : 0);
            } else assert.ok(record.placed.areaEffects.some(e => e.kind === "healing" && e.sourceSupplyId === object.id));
            await shot(page, record, "support-effect");
            if (id === "support-healing") {
              await page.keyboard.press("q"); await clickWorld(page, 650, 350);
              record.vehicleAccepted = await read(page);
              assert.equal(record.vehicleAccepted.supportGauge, 15); assert.equal(record.vehicleAccepted.airstrike.v100, true);
              assert.notEqual(record.vehicleAccepted.airstrike.phase, "idle");
              assert.ok(record.vehicleAccepted.airstrike.cooldownRemaining > 49 && record.vehicleAccepted.airstrike.cooldownRemaining <= 50);
              await page.keyboard.press("q"); await page.keyboard.press("g");
              const denied = await read(page); assert.equal(denied.supportGauge, 15); assert.equal(denied.crawlerAbility.phase, "ready");
              await page.waitForFunction(() => window.__ASHFALL_BATTLE_QA__.getSnapshot().airstrike.phase === "idle");
              record.vehicleStowed = await read(page); assert.ok(record.vehicleStowed.airstrike.cooldownRemaining > 40);
            } else if (id === "support-explosive-drum") {
              await page.keyboard.press("g"); record.vehicleAccepted = await read(page);
              assert.equal(record.vehicleAccepted.supportGauge, 30); assert.equal(record.vehicleAccepted.crawlerAbility.v100, true);
              assert.ok(["deploying", "firing", "recovering"].includes(record.vehicleAccepted.crawlerAbility.phase));
              await page.keyboard.press("g"); await page.keyboard.press("q");
              const denied = await read(page); assert.equal(denied.supportGauge, 30); assert.equal(denied.airstrike.phase, "idle");
              await page.waitForFunction(() => window.__ASHFALL_BATTLE_QA__.getSnapshot().crawlerAbility.phase === "cooldown");
              record.vehicleReload = await read(page);
              assert.ok(record.vehicleReload.crawlerAbility.cooldownRemaining > 37 && record.vehicleReload.crawlerAbility.cooldownRemaining <= 38);
            }
            await pauseCheck(page, record); await shot(page, record, "cooldown");
          }
          record.phase = "final-audio-quiescence";
          await waitAudioIdle(page, record);
          record.final = await read(page);
          const save = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), V100_PRIMARY_STORAGE_KEY);
          assert.equal(save.caps, 0); assert.equal(save.equippedSupportId, id);
          assert.ok(record.final.audio, "Production AudioMixer observation is required");
          assert.deepEqual(record.final.audio.failedAssets, []);
          if (record.nativeAudioSupported) assert.equal(record.final.audio.warningTotal, 0);
          assert.deepEqual(record.final.audio.failures, { events: [], overflow: 0 });
          assert.deepEqual(record.errors, []); record.status = record.nativeAudioSupported ? "passed" : "storage-only";
          console.log(JSON.stringify({ name: record.name, status: record.status, images: record.images.length }));
        } catch (error) { record.status = "failed"; record.error = String(error); record.errorStack = error.stack; record.failureRuntime = await read(page).catch(() => null); await shot(page, record, "failure").catch(() => {}); throw error; }
        finally { await context.close(); await fs.writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2)); }
      }
    } finally { await browser.close(); }
  }
  report.fullAcceptance = lane === "acceptance" && audioPolicy === "required" && process.platform === "darwin" && report.cases.length === 24 && report.cases.every(c => c.status === "passed");
} catch (error) { report.error = String(error); throw error; }
finally { await fs.writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2)); }
