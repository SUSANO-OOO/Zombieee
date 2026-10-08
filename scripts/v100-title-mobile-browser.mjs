import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { pwaBrowserType } from "./pwa-browser-runtime.mjs";

const root = process.cwd();
const url = new URL(process.env.V100_TITLE_QA_URL ?? "http://127.0.0.1:62075/v100");
assert.ok(["127.0.0.1", "localhost"].includes(url.hostname), "Save fixtures are local only");
const out = path.resolve(process.env.V100_TITLE_QA_OUT ?? "outputs/v100-title-mobile");
await mkdir(out, { recursive: true });
await assert.rejects(readFile(path.join(out, "report.json")), "Preserve earlier reports");
const engines = (process.env.V100_TITLE_QA_ENGINES ?? "chromium,webkit").split(",");
const dimensions = (process.env.V100_TITLE_QA_SIZES ?? "1280x720,844x390,844x340,390x844").split(",").map(size => {
  const [width, height] = size.split("x").map(Number); return { width, height };
});
const report = { status: "failed", url: url.href, sourceKind: "Current compiled production game and native IndexedDB; service workers blocked in this UI fixture to route source modules. Setup progress is synthetic. No PWA installation, natural victory or physical speaker claim.", head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", windowsHide: true }).trim(), blobs: {}, cases: [] };
for (const file of ["app/V100Campaign.tsx", "app/V100TitleScreen.tsx", "app/v100TitleScreen.css", "app/v100CampaignStorage.js", "app/V100ModesView.tsx", "app/v100MobileLayout.css", "app/AshfallGame.tsx", "scripts/v100-title-mobile-browser.mjs"]) report.blobs[file] = createHash("sha256").update(await readFile(path.join(root, file))).digest("hex");
const persist = () => writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2));
const button = (page, name) => page.getByRole("button", { name, exact: true });
const ready = page => page.waitForFunction(() => document.querySelector(".v100-shell") && document.documentElement.dataset.pwaSaveMutationPending === "false");
async function dismissFixtureNotice(page) {
  const close = page.locator('.pwa-notice[role="status"]').filter({ hasText: "オフライン用の設定に失敗しました" }).getByRole("button", { name: "閉じる", exact: true });
  if (await close.isVisible()) await close.click();
}
async function entry(page) {
  await page.locator(".fiction-notice").waitFor({ state: "visible" });
  await button(page, "続ける").click();
  const offer = button(page, "ブラウザで遊ぶ");
  await page.waitForFunction(() => document.querySelector(".v100-shell") || document.querySelector("[role=dialog][aria-label='ゲームデータの準備'] button"));
  if (await offer.isVisible()) await offer.click();
  await ready(page);
  await page.locator(".v100-start-screen").waitFor({ state: "visible" });
  await dismissFixtureNotice(page);
}
async function helper(page, action) {
  return page.evaluate(async action => {
    const storage = await import("/__v100_title_helper/app/v100CampaignStorage.js");
    const model = await import("/__v100_title_helper/app/v100Save.js");
    const current = (await storage.readV100BrowserSave()).save;
    if (action === "read") return current;
    if (action === "archive") return storage.readV100NewGameArchive();
    if (action === "seed") {
      const next = model.applyV100SaveMutation(current, draft => ({ ...draft, campaignStarted: true, playerName: "試遊確認", caps: 235, eventCursor: null,
        flowState: { ...draft.flowState, phase: "map" }, settings: { ...draft.settings, autoSkipReadStory: true },
      }));
      return storage.persistV100BrowserSave(next.save, globalThis, { expectedRevision: current.revision });
    }
    if (action === "seed-event" || action === "seed-read-event") {
      const flow = await import("/__v100_title_helper/app/v100StoryFlow.js");
      const stageId = current.availableStageIds[0], eventId = "v100:event:s01:pre";
      const transition = flow.beginV100StageAttempt(flow.createV100StoryFlowState({ ...current, flowState: { phase: "map" }, eventCursor: null }), stageId);
      const checkpoint = flow.v100StoryFlowCheckpoint(transition.state, 0);
      const next = model.applyV100SaveMutation(current, draft => ({ ...draft, ...checkpoint,
        readStoryEventIds: action === "seed-read-event" ? [...new Set([...draft.readStoryEventIds, eventId])] : draft.readStoryEventIds.filter(id => id !== eventId),
      }));
      return storage.persistV100BrowserSave(next.save, globalThis, { expectedRevision: current.revision });
    }
    if (action === "seed-result") {
      const tx = await import("/__v100_title_helper/app/v100Transactions.js");
      const result = tx.createV100BattleResult({ stageId: current.availableStageIds[0], battleRunId: "qa:title:loss", won: false });
      const next = model.applyV100SaveMutation(current, draft => ({ ...draft, eventCursor: null, pendingResult: null, lastResult: result,
        flowState: { ...draft.flowState, phase: "result", eventId: null, stageId: result.stageId, stageNumber: result.stageNumber, nodeIndex: 0, finalized: false },
      }));
      return storage.persistV100BrowserSave(next.save, globalThis, { expectedRevision: current.revision });
    }
    if (action === "seed-gift") {
      const granted = model.claimV100LegacyGift({ ...current, legacy: { ...current.legacy, eligible: true } });
      const acknowledged = model.acknowledgeV100LegacyGiftPopup(granted.save, { screen: "title" });
      return storage.persistV100BrowserSave(acknowledged.save, globalThis, { expectedRevision: current.revision });
    }
    if (action === "seed-long-unit") {
      const unitId = "unit-crazy-king";
      const next = model.applyV100SaveMutation(current, draft => ({ ...draft,
        ownedUnitIds: [...new Set([...draft.ownedUnitIds, unitId])], registeredUnitIds: [...new Set([...draft.registeredUnitIds, unitId])],
        formationSlots: draft.formationSlots.map((id, index) => index === 3 ? unitId : id),
      }));
      return storage.persistV100BrowserSave(next.save, globalThis, { expectedRevision: current.revision });
    }
    if (action === "duplicate-gift") return storage.claimV100BrowserGift(globalThis, { ownerId: "qa:no-second-grant", screen: "title" });
    if (action === "stale-new") return storage.startNewV100BrowserCampaign(globalThis, { confirmed: true, expectedRevision: current.revision - 1 });
    if (action === "abort-new") {
      const original = IDBObjectStore.prototype.add;
      IDBObjectStore.prototype.add = function (value, key) {
        if (String(key).startsWith("new-game:revision:")) { this.transaction.abort(); throw new Error("QA-owned archive write failure"); }
        return original.call(this, value, key);
      };
      try { return await storage.startNewV100BrowserCampaign(globalThis, { confirmed: true, expectedRevision: current.revision }); }
      finally { IDBObjectStore.prototype.add = original; }
    }
    if (action === "advance-save") return storage.persistV100BrowserSave(model.applyV100SaveMutation(current, draft => ({ ...draft, caps: draft.caps + 1 })).save, globalThis, { expectedRevision: current.revision });
  }, action);
}
async function advance(page, phase) {
  for (let step = 0; step < 180; step++) {
    await ready(page);
    if (await page.locator(".v100-shell").getAttribute("data-v100-phase") === phase) return;
    const before = await page.locator("[data-v100-node-index]").first().getAttribute("data-v100-node-index");
    await page.locator(".v100-event-actions .v100-primary").click();
    await page.waitForFunction(({ phase, before }) => document.querySelector(".v100-shell")?.dataset.v100Phase === phase || document.querySelector("[data-v100-node-index]")?.dataset.v100NodeIndex !== before, { phase, before });
  }
  throw new Error(`Did not reach ${phase}`);
}
async function picture(page, file) {
  await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
  await page.waitForFunction(() => [...document.querySelectorAll('.v100-slot.filled .v100-slot-portrait img')].every(image => image.dataset.loaded === "true" && getComputedStyle(image).visibility === "visible"));
  await dismissFixtureNotice(page);
  await page.screenshot({ path: path.join(out, file) });
}
try {
  for (const engine of engines) {
    const browser = await (await pwaBrowserType(engine)).launch({ headless: true, ...(engine === "chromium" ? { channel: "msedge", args: ["--mute-audio"] } : {}) });
    try {
      for (const viewport of dimensions) {
        const id = `${engine}-${viewport.width}x${viewport.height}`;
        const result = { id, status: "failed", browser: browser.version(), viewport, errors: [] }; report.cases.push(result);
        const context = await browser.newContext({ viewport, hasTouch: viewport.width < 1000, isMobile: viewport.width < 1000, acceptDownloads: true, serviceWorkers: "block" });
        const page = await context.newPage();
        page.on("pageerror", error => result.errors.push(String(error)));
        page.on("console", message => { if (message.type() === "error") result.errors.push(message.text()); });
        page.on("response", response => { if (response.status() >= 400) result.errors.push(`HTTP ${response.status()} ${response.url()}`); });
        page.on("requestfailed", request => { if (!/ABORT|cancel/i.test(request.failure()?.errorText ?? "")) result.errors.push(`${request.url()} ${request.failure()?.errorText}`); });
        await context.route(/\/__v100_title_helper\//, async route => {
          const relative = decodeURIComponent(new URL(route.request().url()).pathname.split("/__v100_title_helper/")[1]);
          const file = path.resolve(root, relative);
          assert.ok(file.startsWith(path.join(root, "app") + path.sep) && file.endsWith(".js"));
          await route.fulfill({ status: 200, contentType: "text/javascript", body: await readFile(file) });
        });
        await context.addInitScript(() => {
          window.__qaMedia = [];
          const play = HTMLMediaElement.prototype.play;
          HTMLMediaElement.prototype.play = function () { this.muted = true; if (!window.__qaMedia.includes(this)) window.__qaMedia.push(this); return play.call(this); };
        });
        try {
          await page.goto(url.href, { waitUntil: "domcontentloaded" });
          await entry(page);
          await page.evaluate(() => document.fonts.ready);
          const titleState = await page.evaluate(() => {
            const h1 = document.querySelector("#v100-start-title"), rect = h1.getBoundingClientRect();
            return { text: h1.textContent, font: getComputedStyle(h1).fontFamily, fontLoaded: document.fonts.check('400 40px "New Tegomin Title"', "西新世紀末物語"), width: rect.width, left: rect.left, right: rect.right,
              media: window.__qaMedia.map(media => ({ paused: media.paused, connected: media.isConnected })), overflow: document.documentElement.scrollWidth > innerWidth, battle: document.documentElement.dataset.pwaBattleActive };
          });
          assert.equal(titleState.text, "西新世紀末物語"); assert.equal(titleState.fontLoaded, true); assert.equal(titleState.overflow, false); assert.equal(titleState.battle, "false"); assert.ok(titleState.media.every(media => media.paused));
          assert.ok(titleState.left >= 0 && titleState.right <= viewport.width);
          assert.equal(await button(page, "続きから").isEnabled(), false);
          for (const name of ["初めから", "続きから", "設定", "クレジット"]) {
            const box = await button(page, name).boundingBox();
            assert.ok(box.height >= 44 && box.y >= 0 && box.y + box.height <= viewport.height, `${name} outside usable viewport: ${JSON.stringify(box)}`);
          }
          result.title = titleState;
          await picture(page, `${id}-title.png`);
          await button(page, "設定").click();
          await page.getByLabel("演出の動きを抑える").check();
          await button(page, "設定を保存").click(); await ready(page);
          await button(page, "タイトルへ").click();
          assert.equal((await helper(page, "read")).settings.reducedMotion, true);
          assert.equal(await page.locator(".v100-start-screen").getAttribute("data-reduced-motion"), "true");
          await button(page, "クレジット").click(); await page.locator(".v100-staff-roll").waitFor({ state: "visible" });
          await button(page, "タイトルへ").click();
          await page.waitForFunction(() => window.__qaMedia.every(media => media.paused));
          if (viewport.height > viewport.width) {
            await page.setViewportSize({ width: viewport.height, height: viewport.width });
            result.gameplayRotation = { width: viewport.height, height: viewport.width };
          }

          // One fresh story path; the remaining cases use the same storage API for a map fixture.
          if (engine === "chromium" && viewport.width === 1280) {
            await button(page, "初めから").click();
            await page.getByLabel("呼ばれたい名前", { exact: true }).fill("試遊確認");
            await button(page, "この名前で作戦を始める").click();
            await advance(page, "map"); result.freshStoryToMap = true;
          }
          assert.equal((await helper(page, "seed")).ok, true);
          if (viewport.height === 340) assert.equal((await helper(page, "seed-long-unit")).ok, true);
          await page.reload({ waitUntil: "domcontentloaded" }); await entry(page);
          const saved = await helper(page, "read");
          await page.waitForTimeout(650);
          assert.deepEqual(await helper(page, "read"), saved, "Title must not advance a stored event or battle");
          assert.equal(await button(page, "続きから").isEnabled(), true);
          await button(page, "続きから").click(); await page.locator(".v100-map-layout").waitFor({ state: "visible" });
          result.resume = (await helper(page, "read")).flowState.phase;
          await button(page, "車両").click();
          result.header = await page.evaluate(() => {
            const caps = document.querySelector(".v100-caps-balance").getBoundingClientRect(), menu = document.querySelector(".v100-menu-launch").getBoundingClientRect(), modes = document.querySelector(".v100-modes-launch").getBoundingClientRect();
            return { caps: { left: caps.left, right: caps.right }, modes: { left: modes.left, right: modes.right }, menu: { left: menu.left, right: menu.right }, backmarks: document.querySelectorAll(".v100-backmark").length };
          });
          assert.equal(result.header.backmarks, 0); assert.ok(result.header.caps.right <= result.header.modes.left && result.header.modes.right <= result.header.menu.left);
          await picture(page, `${id}-vehicle.png`);
          await button(page, "モード選択").click();
          await page.locator("[data-mode-tab=overview]").waitFor({ state: "visible" });
          assert.equal(await page.locator(".v100-mode-entry").count(), 2);
          await picture(page, `${id}-modes.png`);
          await page.locator(".v100-mode-survival").click(); await page.locator("[data-v100-survival=hub]").waitFor({ state: "visible" });
          await button(page, "モード選択へ").click();
          await page.locator(".v100-mode-outbreak").click(); await page.locator("[data-mode-tab=outbreak]").waitFor({ state: "visible" });
          await button(page, "モード選択へ").click(); await button(page, "作戦地図へ").click();
          await dismissFixtureNotice(page);
          if (viewport.width > viewport.height) {
            await button(page, "この作戦を編成").click(); await advance(page, "formation");
            await picture(page, `${id}-formation.png`);
            result.portraits = await page.locator(".v100-slot.filled .v100-slot-portrait img").evaluateAll(images => images.map(image => {
              const rect = image.getBoundingClientRect(), parent = image.parentElement.getBoundingClientRect(), style = getComputedStyle(image);
              return { width: rect.width, height: rect.height, frameWidth: parent.width, frameHeight: parent.height, fit: style.objectFit, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight };
            }));
            assert.ok(result.portraits.every(image => image.width >= 50 && image.height >= 80 && image.fit === "cover" && image.naturalWidth > 0));
            await page.locator(".v100-slot.filled").first().click(); await page.locator(".v100-command-formation.picker-open").waitFor({ state: "visible" }); await picture(page, `${id}-picker.png`);
            await button(page, "編成に戻る").click();
            await button(page, "戦闘へ").click(); await page.locator(".game-frame").waitFor({ state: "visible" });
            await page.locator(".unit-card .portrait > img").first().waitFor({ state: "visible" });
            await picture(page, `${id}-battle.png`);
            result.battlePortraits = await page.locator(".unit-card .portrait > img").evaluateAll(images => images.map(image => ({ width: image.clientWidth, height: image.clientHeight, fit: getComputedStyle(image).objectFit, src: image.getAttribute("src") })));
            assert.ok(result.battlePortraits.length >= 4 && result.battlePortraits.every(image => image.width > 35 && image.height > 44 && image.fit === "cover"));
            result.battleCopy = await page.locator('.unit-card[data-kind]').evaluateAll(cards => cards.map(card => {
              const name = card.querySelector('.card-copy b'), cost = card.querySelector('.cost');
              return { name: name.textContent, nameBottom: name.getBoundingClientRect().bottom, costTop: cost.getBoundingClientRect().top };
            }));
            assert.ok(result.battleCopy.every(card => card.nameBottom <= card.costTop), "Unit name and command cost must not overlap");
            if (viewport.height === 340) assert.ok(result.battleCopy.some(card => card.name === "クレイジーキング"));
          }
          await page.reload({ waitUntil: "domcontentloaded" }); await entry(page);
          let before = await helper(page, "read");
          await page.waitForTimeout(650);
          assert.deepEqual(await helper(page, "read"), before, "Stored battle must remain stopped on the title");
          assert.equal(await page.locator(".game-frame").count(), 0);
          assert.equal(await page.locator(".v100-event-actions").count(), 0);
          assert.equal(await page.locator(".v100-shell").getAttribute("data-v100-phase"), "title");
          if (before.flowState.phase === "battle") {
            await button(page, "続きから").click(); await page.locator(".game-frame").waitFor({ state: "visible" });
            await page.locator(".unit-card .portrait > img").first().waitFor({ state: "visible" });
            assert.equal((await helper(page, "read")).flowState.phase, "battle");
            await page.reload({ waitUntil: "domcontentloaded" }); await entry(page);
            result.battleResume = true;
          }
          if (engine === "chromium" && viewport.width === 1280) {
            result.storedEventResume = [];
            for (const fixture of ["seed-event", "seed-read-event", "seed-result"]) {
              assert.equal((await helper(page, fixture)).ok, true);
              await page.reload({ waitUntil: "domcontentloaded" }); await entry(page);
              const frozen = await helper(page, "read");
              await page.waitForTimeout(650);
              assert.deepEqual(await helper(page, "read"), frozen);
              assert.equal(await page.locator(".v100-event-actions").count(), 0);
              assert.ok(await page.evaluate(() => window.__qaMedia.every(media => media.paused)));
              await button(page, "続きから").click();
              await page.locator(fixture === "seed-read-event" ? '.v100-command-formation' : fixture === "seed-result" ? '[data-v100-phase="result"]' : '[data-v100-phase="event"] .v100-event-actions').waitFor({ state: "visible" });
              result.storedEventResume.push(fixture);
              await page.reload({ waitUntil: "domcontentloaded" }); await entry(page);
            }
            assert.equal((await helper(page, "seed-gift")).ok, true);
            await page.reload({ waitUntil: "domcontentloaded" }); await entry(page);
            before = await helper(page, "read");
            assert.equal(before.legacy.entitlementClaimed, true); assert.equal(before.legacy.popupAcknowledged, true);
          }
          assert.equal((await helper(page, "stale-new")).reason, "stale-writer"); assert.deepEqual(await helper(page, "read"), before);
          assert.equal((await helper(page, "abort-new")).ok, false); assert.deepEqual(await helper(page, "read"), before, "Failed backup must keep old campaign");
          await button(page, "初めから").click(); await button(page, "戻る").click(); assert.deepEqual(await helper(page, "read"), before, "Cancel new game keeps the save");
          await button(page, "初めから").click(); await button(page, "バックアップして初めから").click();
          await page.getByLabel("呼ばれたい名前", { exact: true }).waitFor({ state: "visible" });
          const fresh = await helper(page, "read"), archive = await helper(page, "archive");
          assert.equal(fresh.campaignStarted, false); assert.equal(fresh.caps, 0); assert.deepEqual(fresh.settings, before.settings); assert.deepEqual(archive.save, before);
          await helper(page, "advance-save"); assert.deepEqual((await helper(page, "archive")).save, before, "Archive survives later autosaves");
          if (engine === "chromium" && viewport.width === 1280) {
            const carried = await helper(page, "duplicate-gift");
            assert.equal(carried.ok, true); assert.equal(carried.save.caps, 1); assert.equal(carried.save.legacy.entitlementClaimed, true);
            await page.reload({ waitUntil: "domcontentloaded" }); await entry(page);
            await button(page, "データ管理").click();
            const downloadReady = page.waitForEvent("download");
            await button(page, "「初めから」の直前のセーブを書き出す").click();
            const download = await downloadReady, downloaded = await download.path();
            assert.deepEqual(JSON.parse(JSON.parse(await readFile(downloaded, "utf8")).serialized), before);
            const priorRestore = await helper(page, "read");
            await page.getByLabel("セーブを復元", { exact: true }).setInputFiles(downloaded);
            await page.waitForFunction(async expected => {
              const storage = await import("/__v100_title_helper/app/v100CampaignStorage.js");
              const state = await storage.readV100BrowserSave();
              return state.ok && state.save.revision > expected.revision && state.save.caps === expected.caps && state.save.playerName === expected.playerName;
            }, { revision: priorRestore.revision, caps: before.caps, playerName: before.playerName });
            const restored = await helper(page, "read");
            assert.equal(restored.caps, before.caps); assert.equal(restored.playerName, before.playerName); assert.deepEqual(restored.flowState, before.flowState);
            assert.deepEqual(restored.ownedUnitIds, before.ownedUnitIds); assert.deepEqual(restored.settings, before.settings);
            result.archiveUiRestore = true; result.giftDidNotRepeat = true;
          }
          result.newGameBackup = { oldRevision: before.revision, newRevision: fresh.revision, archiveSurvived: true, failedWritePreservedSave: true };
          assert.deepEqual(result.errors, []);
          result.status = "passed";
        } catch (error) { result.error = String(error.stack ?? error); await page.screenshot({ path: path.join(out, `${id}-failure.png`) }).catch(() => {}); }
        finally { await context.close(); await persist(); }
      }
    } finally { await browser.close(); }
  }
  report.status = report.cases.every(result => result.status === "passed") ? "passed" : "failed";
} finally { await persist(); }
console.log(JSON.stringify({ status: report.status, cases: report.cases.map(result => ({ id: result.id, status: result.status, error: result.error?.split("\n")[0] })), report: path.join(out, "report.json") }));
if (report.status !== "passed") process.exitCode = 1;
