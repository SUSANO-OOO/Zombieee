import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { chromium, webkit } from "playwright";
import { createDefaultV100Save, normalizeV100Save, serializeV100Save } from "../app/v100Save.js";
import { V100_STAGE_IDS } from "../app/v100Registry.js";
import { CHARACTER_PORTRAIT_ART } from "../app/spriteManifest.js";
import { nativeBattleTap } from "./v100-normal-tactical-input.mjs";
import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";
import { enterV100FromTitle } from "./v100-title-qa-entry.mjs";
import { installEndingAudioGainObserver } from "./ending-audio-gain-observer.mjs";
import { isOwnedTitleCloseCancellation } from "./owned-title-close-cancellation.mjs";

const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const baseUrl = new URL(process.env.V100_CARD_QA_BASE_URL ?? process.env.V100_CAMPAIGN_QA_BASE_URL);
assert.ok(["localhost", "127.0.0.1"].includes(baseUrl.hostname), "isolated local origin required");
const engine = process.env.V100_CARD_QA_ENGINE ?? "all";
assert.ok(["all", "chromium", "webkit"].includes(engine));
const out = path.resolve(process.env.V100_CARD_QA_OUT ?? "outputs/v100-card-portraits");
await mkdir(out, { recursive: true });
await assert.rejects(readFile(path.join(out, "report.json")), { code: "ENOENT" });
const kinds = ["guardian", "medic", "kumaverson", "brawler"];
const owned = ["unit-gantetsu", "unit-nao", "unit-kumaverson", "unit-paisen"];
const base = createDefaultV100Save({ playerName: "カード表示確認" });
const fixture = normalizeV100Save({ ...base, campaignStarted: true, caps: 0,
  availableStageIds: V100_STAGE_IDS.slice(0, 25), completedStageIds: V100_STAGE_IDS.slice(0, 24),
  ownedUnitIds: owned, registeredUnitIds: owned, levelCap: 30,
  unitLevels: { ...base.unitLevels, ...Object.fromEntries(owned.map(id => [id, 30])) },
  formationSlots: [...owned, null, null, null], vehicle: { ...base.vehicle, upgradeLevel: 5, maxHp: 1080 },
  flowState: { phase: "formation", eventId: null, stageId: V100_STAGE_IDS[24], stageNumber: 25,
    destination: "formation", nodeIndex: 0, firstClear: false, finalized: true } });
assert.deepEqual(fixture.formationSlots, [...owned, null, null, null]);
const raw = serializeV100Save(fixture);
const report = { schema: "v100-card-portrait-visibility/v1", status: "running",
  scope: "Isolated S24-complete/Lv30 fixture; real S25 UI inputs, decoded images and visible-hidden-restored pixel probes. Hidden images are diagnostic only. No physical-device, difficulty or performance acceptance.",
  head: git("rev-parse", "HEAD"), tree: git("rev-parse", "HEAD^{tree}"),
  workingTreePaths: git("diff", "--name-only").split(/\r?\n/u).filter(Boolean),
  sourceFiles: Object.fromEntries(await Promise.all(["app/AshfallGame.tsx", "app/globals.css", "app/battleAssetPlan.js",
    "app/V100TitleMusic.tsx", "app/endingAudioMix.js", "scripts/v100-card-portrait-browser.mjs",
    "scripts/ending-audio-gain-observer.mjs", "scripts/owned-title-close-cancellation.mjs"]
    .map(async file => [file, hash((await readFile(file, "utf8")).replaceAll("\r\n", "\n"))]))),
  fixtureSha256: hash(raw), build: await productionBuildIdentity(), cases: [], errors: [], physicalDeviceVerified: false };
await writeFile(path.join(out, "fixture.json"), raw);

async function pixelChange(a, b, masks) {
  const first = await sharp(a).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const last = await sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual(first.info, last.info);
  let compared = 0, changed = 0;
  const { width, height, channels } = first.info;
  for (let y = 3; y < height - 3; y++) for (let x = 3; x < width - 3; x++) {
    if (masks.some(m => x >= m.x - 3 && x <= m.x + m.width + 3 && y >= m.y - 3 && y <= m.y + m.height + 3)) continue;
    const offset = (y * width + x) * channels;
    compared++;
    if (Math.max(...[0, 1, 2].map(c => Math.abs(first.data[offset + c] - last.data[offset + c]))) >= 12) changed++;
  }
  assert.ok(compared > 300, "portrait probe has too little unmasked image area");
  return { compared, changed, fraction: changed / compared, channelDeltaMinimum: 12, fractionMinimum: .05 };
}
async function persist(bytes, filename) {
  await writeFile(path.join(out, filename), bytes, { flag: "wx" });
  return { file: filename, bytes: bytes.length, sha256: hash(bytes) };
}
async function images(page) {
  return page.locator("button.unit-card[data-portrait=approved]").evaluateAll(async cards => Promise.all(cards.map(async card => {
    const img = card.querySelector(".portrait > img");
    if (!(img instanceof HTMLImageElement)) throw new Error("approved card has no image element");
    await img.decode();
    const rect = img.getBoundingClientRect();
    return { kind: card.dataset.kind, state: card.dataset.state, src: img.getAttribute("src"), currentSrc: img.currentSrc,
      complete: img.complete, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight,
      width: rect.width, height: rect.height, decoded: true };
  })));
}
async function probe(page, row, state, targets) {
  const decoded = await images(page);
  const decodedPaths = await page.evaluate(() => window.__ASHFALL_ASSET_QA__?.getDecodedRequiredPaths?.());
  assert.ok(Array.isArray(decodedPaths), "production decode boundary must be observable");
  assert.equal(decoded.length, 4);
  for (const item of decoded) {
    assert.equal(item.src, new URL(CHARACTER_PORTRAIT_ART[item.kind].slice(1), baseUrl).pathname, "battle cards retain the approved original character portrait");
    assert.equal(item.currentSrc, new URL(item.src, baseUrl).href);
    assert.ok(decodedPaths.includes(CHARACTER_PORTRAIT_ART[item.kind]), `card omitted from critical decode jobs: ${item.kind}`);
    assert.ok(item.complete && item.naturalWidth > 0 && item.naturalHeight > 0 && item.width > 20 && item.height > 30);
  }
  const record = { state, decoded, decodedPaths, probes: [], screenshot: await persist(await page.screenshot({ animations: "disabled" }), `${row.name}-${state}.png`) };
  row.states.push(record);
  for (const kind of targets) {
    const expectedState = state === "returned-ready" ? "ready" : state;
    const card = page.locator(`button.unit-card[data-kind="${kind}"]`);
    assert.equal(await card.getAttribute("data-state"), expectedState, "expected native card state before pixel probe");
    const img = page.locator(`button.unit-card[data-kind="${kind}"] .portrait > img`);
    const geometry = await img.evaluate(el => {
      const card = el.closest("button"), r = el.getBoundingClientRect(), c = card.getBoundingClientRect();
      const cost = card.querySelector(".cost"), timer = card.querySelector(".cooldown-mask small");
      const labels = [cost, timer].filter(Boolean).map(label => {
        const b = label.getBoundingClientRect();
        return { kind: label === cost ? "cost" : "timer", rect: { x: b.x, y: b.y, width: b.width, height: b.height },
          fits: label.scrollWidth <= label.clientWidth + 1 && label.scrollHeight <= label.clientHeight + 1,
          contained: b.left >= c.left && b.right <= c.right && b.top >= c.top && b.bottom <= c.bottom };
      });
      const a = cost.getBoundingClientRect(), b = timer?.getBoundingClientRect();
      const timerCostOverlap = b ? Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
        * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)) : 0;
      const x = Math.ceil(Math.max(r.x, c.x + 3)), y = Math.ceil(r.y + 3);
      const width = Math.floor(Math.min(r.right, c.right - 3) - x), height = Math.floor(r.bottom - y - 3);
      return { clip: { x, y, width, height }, labels, timerCostOverlap, originalStyle: el.getAttribute("style"), masks: [...card.querySelectorAll(".cost,.card-state,.cooldown-mask small")].map(e => {
        const m = e.getBoundingClientRect(); return { x: m.x - x, y: m.y - y, width: m.width, height: m.height };
      }).concat([{ x: c.x - x, y: c.bottom - y - 13, width: c.width, height: 13 }]) };
    });
    assert.ok(geometry.labels.every(label => label.fits && label.contained), "card command cost or timer label is clipped");
    assert.equal(geometry.timerCostOverlap, 0, "cooldown timer hides command-cost text");
    const first = await page.screenshot({ clip: geometry.clip, animations: "disabled" });
    assert.equal(await card.getAttribute("data-state"), expectedState);
    let hidden, restored;
    try {
      await img.evaluate(el => { el.style.visibility = "hidden"; });
      hidden = await page.screenshot({ clip: geometry.clip, animations: "disabled" });
      assert.equal(await card.getAttribute("data-state"), expectedState);
    } finally {
      await img.evaluate((el, original) => { if (original === null) el.removeAttribute("style"); else el.setAttribute("style", original); }, geometry.originalStyle);
    }
    restored = await page.screenshot({ clip: geometry.clip, animations: "disabled" });
    assert.equal(await card.getAttribute("data-state"), expectedState);
    const visibleDifference = await pixelChange(first, hidden, geometry.masks), restoredDifference = await pixelChange(restored, hidden, geometry.masks);
    const restorationDifference = await pixelChange(first, restored, geometry.masks);
    const evidence = { kind, expectedState, geometry, visibleDifference, restoredDifference, restorationDifference,
      visible: await persist(first, `${row.name}-${state}-${kind}-visible.png`),
      hiddenDiagnostic: await persist(hidden, `${row.name}-${state}-${kind}-hidden.png`),
      restored: await persist(restored, `${row.name}-${state}-${kind}-restored.png`) };
    record.probes.push(evidence);
    assert.ok(visibleDifference.fraction >= .05 && restoredDifference.fraction >= .05, `portrait pixels missing: ${row.name}/${state}/${kind}`);
    assert.ok(restorationDifference.fraction <= .01, "native portrait state changed during visible-hidden-restored comparison");
  }
}
const matrix = engine === "chromium"
  ? [340, 390, 430, 720].map(height => ({ engine, width: height === 430 ? 932 : height === 720 ? 1280 : 844, height }))
  : [...[340, 390, 430].map(height => ({ engine: "webkit", width: height === 430 ? 932 : 844, height })), ...(engine === "all" ? [{ engine: "chromium", width: 1280, height: 720 }] : [])];
let currentPage;
try {
  for (const config of matrix) {
    const row = { ...config, name: `${config.engine}-${config.width}x${config.height}`, status: "running",
      phase: "boot", states: [], inputs: [], errors: [], titleRequests: [],
      acceptedCloseCancellations: [], unresolvedErrors: [] };
    report.cases.push(row);
    const browser = await ({ chromium, webkit })[config.engine].launch({ headless: true,
      ...(config.engine === "chromium" ? { args: ["--mute-audio"], ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) } : {}) });
    let context;
    try {
      context = await browser.newContext({ viewport: { width: config.width, height: config.height }, deviceScaleFactor: 1, hasTouch: config.height <= 430, isMobile: config.height <= 430 });
      await context.addInitScript(() => {
        if (typeof AudioNode !== "undefined") {
          const connect = AudioNode.prototype.connect, muters = new WeakMap();
          AudioNode.prototype.connect = function(target, ...args) {
            if (target === this.context.destination) {
              let quiet = muters.get(this.context);
              if (!quiet) { quiet = this.context.createGain(); quiet.gain.value = 0; connect.call(quiet, this.context.destination); muters.set(this.context, quiet); }
              return connect.call(this, quiet, ...args);
            }
            return connect.call(this, target, ...args);
          };
        }
        const play = HTMLMediaElement.prototype.play;
        HTMLMediaElement.prototype.play = function() { this.muted = true; return play.call(this); };
      });
      await context.addInitScript(saveRaw => { for (const key of ["nishijin-campaign-v100", "nishijin-campaign-v100:mirror", "nishijin-campaign-v100:last-known-good"]) localStorage.setItem(key, saveRaw); }, raw);
      const page = currentPage = await context.newPage(); page.setDefaultTimeout(30_000);
      await installEndingAudioGainObserver(page);
      // Weak references and plain removal snapshots preserve native GC behavior.
      // This observer does not alter playback, volume, source, events or clocks.
      await page.addInitScript(() => {
        const records = [];
        const snapshot = audio => ({ src: audio.currentSrc, paused: audio.paused,
          rate: audio.playbackRate, time: audio.currentTime, nativeVolume: audio.volume,
          gain: window.__endingOutputGain?.(audio), connected: audio.isConnected,
          error: audio.error?.message ?? null, observedAt: Date.now() });
        new MutationObserver(() => {
          for (const audio of document.querySelectorAll("audio[data-title-music]")) {
            if (!records.some(record => record.ref.deref() === audio)) records.push({ ref: new WeakRef(audio) });
          }
          for (const record of records) {
            const audio = record.ref.deref();
            if (audio && !audio.isConnected) record.removed = snapshot(audio);
          }
        }).observe(document, { childList: true, subtree: true });
        window.__cardPortraitTitleMedia = () => records.map(record => {
          const audio = record.ref.deref();
          return audio ? { ...snapshot(audio), collected: false } : { ...record.removed, collected: true };
        });
      });
      const requests = new WeakMap(), pending = new Map();
      let requestSequence = 0;
      const observed = request => {
        let record = requests.get(request);
        if (!record) {
          let frame = null;
          try { if (request.frame() === page.mainFrame()) frame = "main"; } catch {}
          record = { id: `request-${++requestSequence}`, url: request.url(),
            resourceType: request.resourceType(), frame, startedAt: Date.now() };
          requests.set(request, record);
        }
        return record;
      };
      const errorRecord = value => ({ ...value, at: Date.now(), phase: row.phase });
      page.on("request", request => {
        const record = observed(request); pending.set(record.id, record);
        if (record.url === new URL("audio/v100/score/horror.mp3", baseUrl).href) row.titleRequests.push(record);
      });
      page.on("requestfinished", request => { pending.delete(observed(request).id); });
      page.on("console", m => { if (m.type() === "error") row.errors.push(errorRecord({ kind: "console", text: m.text() })); });
      page.on("pageerror", e => row.errors.push(errorRecord({ kind: "page", text: String(e) })));
      page.on("requestfailed", request => {
        const record = observed(request);
        row.errors.push(errorRecord({ kind: "request", url: request.url(),
          text: request.failure()?.errorText, request: record }));
        pending.delete(record.id);
      });
      page.on("response", r => { if (r.status() >= 400) row.errors.push(errorRecord({ kind: "http", url: r.url(), status: r.status() })); });
      page.on("crash", () => { row.unexpectedPageLoss = true; row.errors.push(errorRecord({ kind: "crash" })); });
      page.on("close", () => { if (row.phase !== "context-closing") row.unexpectedPageLoss = true; });
      assert.equal((await page.goto(new URL("v100", baseUrl).href, { waitUntil: "domcontentloaded" })).status(), 200);
      await page.getByRole("button", { name: "ブラウザで遊ぶ", exact: true }).click();
      row.phase = "title";
      await enterV100FromTitle(page);
      row.phase = "formation";
      await page.locator(".v100-shell").waitFor({ state: "attached" });
      await page.getByRole("button", { name: "戦闘へ", exact: true }).click();
      await page.waitForFunction(() => document.documentElement.dataset.assetLoadState === "ready");
      row.phase = "battle";
      const guardian = page.locator('button.unit-card[data-kind="guardian"]');
      await page.waitForFunction(() => document.querySelector('button.unit-card[data-kind="guardian"]')?.dataset.state === "ready");
      await probe(page, row, "ready", kinds);
      assert.equal(await nativeBattleTap(page, guardian), true);
      row.inputs.push({ action: "deploy", kind: "guardian" });
      await page.waitForFunction(() => document.querySelector('button.unit-card[data-kind="guardian"]')?.dataset.state === "cooldown");
      await probe(page, row, "cooldown", ["guardian"]);
      for (const kind of ["medic", "kumaverson"]) {
        const card = page.locator(`button.unit-card[data-kind="${kind}"]`);
        await page.waitForFunction(k => document.querySelector(`button.unit-card[data-kind="${k}"]`)?.dataset.state === "ready", kind);
        assert.equal(await nativeBattleTap(page, card), true);
        row.inputs.push({ action: "deploy", kind });
      }
      await page.waitForFunction(() => document.querySelector('button.unit-card[data-kind="brawler"]')?.dataset.state === "insufficient");
      await probe(page, row, "insufficient", ["brawler"]);
      await page.waitForFunction(() => document.querySelector('button.unit-card[data-kind="guardian"]')?.dataset.state === "ready", null, { timeout: 45_000 });
      await probe(page, row, "returned-ready", ["guardian"]);
      await page.waitForLoadState("networkidle", { timeout: 30_000 });
      row.status = "captured";
      row.phase = "captured";
      const native = await page.evaluate(() => window.__cardPortraitTitleMedia());
      row.close = { captureComplete: true, runtimeErrorsBeforeClose: row.errors.length,
        pageWasOpen: !page.isClosed(), unexpectedPageLoss: row.unexpectedPageLoss === true,
        expectedTitleUrl: new URL("audio/v100/score/horror.mp3", baseUrl).href,
        titleMediaCount: native.length, titleMedia: native.length === 1 ? native[0] : null,
        pendingRequestIds: [...pending.keys()], succeeded: false, error: null };
    } catch (error) {
      row.status = "failed"; row.error = String(error);
      if (currentPage && !currentPage.isClosed()) await currentPage.screenshot({ path: path.join(out, `${row.name}-failure.png`) }).catch(() => {});
      throw error;
    } finally {
      row.phase = "context-closing";
      if (row.close) row.close.startedAt = Date.now();
      try {
        await context?.close();
        if (row.close) { row.close.completedAt = Date.now(); row.close.succeeded = true; }
      } catch (error) {
        if (row.close) row.close.error = String(error);
        throw error;
      } finally { row.phase = "closed"; await browser.close(); currentPage = null; }
    }
    row.acceptedCloseCancellations = row.errors.filter(error => isOwnedTitleCloseCancellation(error, row.close));
    row.unresolvedErrors = row.errors.filter(error => !isOwnedTitleCloseCancellation(error, row.close));
    assert.deepEqual(row.unresolvedErrors, []);
    row.status = "passed";
    console.log(JSON.stringify({ case: row.name, states: row.states.length, pixelProbes: row.states.flatMap(s => s.probes).length, status: row.status }));
  }
  for (const row of report.cases) assert.deepEqual(row.unresolvedErrors, []);
  assert.equal((await productionBuildIdentity()).combinedSha256, report.build.combinedSha256);
  report.status = "passed";
} catch (error) {
  report.status = "failed"; report.errors.push(String(error)); process.exitCode = 1;
  if (currentPage && !currentPage.isClosed()) await currentPage.screenshot({ path: path.join(out, "failure.png") }).catch(() => {});
} finally {
  await writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status: report.status, cases: report.cases.map(r => ({ name: r.name, status: r.status, states: r.states.length })), errors: report.errors }));
}
