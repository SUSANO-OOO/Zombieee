// Exercises actual first-install UI with real worker/storage and controlled metadata failures.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { formatBytes, planInstall } from "../app/pwaAssetManifest.js";
import { ASSET_CACHE_NAME, assetCacheKey, resolveAssetUrl } from "../app/pwaAssetStore.js";
import { silenceBrowserOutput } from "./silent-browser-output.mjs";
import { assertPwaInstallCapacity } from "./pwa-install-capacity-qa.mjs";

const base = process.env.PWA_FIRST_INSTALL_BASE_URL ?? process.env.V096_PWA_QA_BASE_URL ?? process.env.PWA_REGISTRATION_FALLBACK_BASE_URL;
assert.ok(base, "PWA_FIRST_INSTALL_BASE_URL is required");
const output = process.env.PWA_FIRST_INSTALL_OUTPUT_DIR;
if (output) await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
let failure;
try {
  const shipped = await (await fetch(new URL("asset-manifest.json", base))).json();
  const expectedCapacityBytes = planInstall(shipped).pendingBytes;
  const metadataCases = process.env.PWA_FIRST_INSTALL_CASE === "commit-only" ? [] : ["network", "html", "pending", "standalone-network", "standalone-html"];
  for (const mode of metadataCases) {
    const context = await browser.newContext({
      viewport: { width: 844, height: 340 }, hasTouch: true, isMobile: true,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1",
    });
    const page = await context.newPage();
    try {
      await silenceBrowserOutput(page);
      await page.addInitScript(({ mode }) => {
        Object.defineProperty(navigator, "standalone", { configurable: true, get: () => mode.startsWith("standalone") });
        window.__pwaMetadataMode = mode;
        const fetchOriginal = window.fetch.bind(window);
        window.fetch = (...args) => {
          const url = new URL(typeof args[0] === "string" ? args[0] : args[0].url, location.href);
          if (url.pathname.endsWith("/asset-manifest.json")) {
            if (window.__pwaMetadataMode.endsWith("network")) return Promise.reject(new TypeError("simulated metadata network failure"));
            if (window.__pwaMetadataMode.endsWith("html")) return Promise.resolve(new Response("<html>Sign in</html>", { headers: { "content-type": "text/html" } }));
            if (window.__pwaMetadataMode === "pending") return new Promise(() => {});
          }
          return fetchOriginal(...args);
        };
      }, { mode });
      const deadline = Date.now() + 25_000;
      const remaining = () => Math.max(1, deadline - Date.now());
      const errors = [];
      page.on("pageerror", error => errors.push(String(error)));
      await page.goto(base, { waitUntil: "domcontentloaded", timeout: remaining() });
      const standalone = mode.startsWith("standalone");
      const retry = page.getByRole("button", { name: standalone ? "再試行" : "容量を再確認", exact: true });
      if (standalone) await page.getByRole("alert").filter({ hasText: "通信を確認して「再試行」を押してください。" }).waitFor({ timeout: remaining() });
      await retry.waitFor({ state: "visible", timeout: remaining() });
      assert.equal(await page.locator(".v100-shell").count(), 0, "first install must not silently enter browser play");
      assert.equal(await page.getByText("ダウンロードする容量を確認しています…", { exact: true }).count(), 0);
      const errorDetails = page.locator(".pwa-gate details").filter({ has: page.getByText("エラーの詳細", { exact: true }) });
      await errorDetails.locator("summary").click();
      const detail = await errorDetails.innerText();
      assert.match(detail, mode.endsWith("html") ? /Webページ/ : mode === "pending" ? /10秒/ : /simulated metadata network failure/);
      if (!standalone) {
        const steps = await page.locator(".pwa-install-steps li").allInnerTexts();
        assert.equal(steps.length, 3);
        assert.doesNotMatch(steps[0], /画面下|画面上/);
        assert.match(steps[2], /追加したアイコン/);
        assert.match(steps[2], /ダウンロードを開始/);
      }
      if (output) await page.screenshot({ path: path.join(output, `${mode}-failed.png`), fullPage: true });
      await page.evaluate(() => { window.__pwaMetadataMode = "ready"; });
      await retry.click({ timeout: remaining() });
      await page.waitForFunction(() => document.documentElement.dataset.pwaManifestState === "ready", null, { timeout: remaining() });
      assert.equal(await retry.count(), 0);
      if (standalone) {
        await page.getByRole("heading", { name: "ゲームデータをダウンロードします", exact: true }).waitFor({ timeout: remaining() });
        await page.getByRole("button", { name: "ダウンロードを開始", exact: true }).waitFor({ timeout: remaining() });
      } else {
        const capacity = page.locator(".pwa-gate .pwa-install-size");
        await capacity.waitFor({ state: "visible", timeout: remaining() });
        assertPwaInstallCapacity(await capacity.innerText(), expectedCapacityBytes);
        assert.equal(await page.locator(".v100-shell").count(), 0);
      }
      const layout = await page.locator(".pwa-gate").evaluate(node => ({ width: node.clientWidth, scrollWidth: node.scrollWidth }));
      assert.ok(layout.scrollWidth <= layout.width + 1, "phone layout must not overflow horizontally");
      if (output) await page.screenshot({ path: path.join(output, `${mode}-recovered.png`), fullPage: true });
      assert.deepEqual(errors, []);
      results.push({ mode, status: "passed", retryInPlace: true, gameDataDownloaded: false, physicalPhone: false, layout });
    } finally { await context.close(); }
  }
  if (metadataCases.length) {
    const context = await browser.newContext({ viewport: { width: 844, height: 340 }, hasTouch: true, isMobile: true });
    try {
      const artwork = shipped.assets.filter(asset => asset.path.endsWith(".webp"));
      const uniqueArtwork = [...new Map(artwork.map(asset => [asset.hash, asset])).values()];
      const assets = uniqueArtwork.sort((a, b) => a.bytes - b.bytes).slice(0, 3)
        .map(asset => Object.fromEntries(Object.entries(asset).filter(([key]) => !key.startsWith("bundle"))));
      assert.equal(assets.length, 3);
      const [retained, ...pending] = assets;
      const assetPaths = assets.map(asset => new URL(resolveAssetUrl(asset.sourcePath ?? asset.path, base)).pathname);
      assert.equal(new Set(assetPaths).size, assets.length);
      const remainingPaths = assetPaths.slice(1);
      const partialBytes = planInstall({ assets: pending }).pendingBytes;
      await context.addInitScript(({ pack, assetPaths, remainingPaths }) => {
        Object.defineProperty(navigator, "standalone", { configurable: true, value: true });
        window.__pwaResumeRequests = [];
        const fetchOriginal = window.fetch.bind(window);
        window.fetch = (...args) => {
          const address = typeof args[0] === "string" ? args[0] : args[0].url ?? args[0].href;
          const url = new URL(address, location.href);
          if (url.pathname.endsWith("/asset-manifest.json")) {
            return Promise.resolve(new Response(JSON.stringify(pack), { headers: { "content-type": "application/json" } }));
          }
          if (assetPaths.includes(url.pathname)) {
            window.__pwaResumeRequests.push(url.pathname);
            if (window.__pwaInterruptFirstDownload && remainingPaths.includes(url.pathname)) {
              return new Promise(() => {});
            }
          }
          return fetchOriginal(...args);
        };
      }, { pack: { ...shipped, assets }, assetPaths, remainingPaths });

      const first = await context.newPage();
      await first.goto(base, { waitUntil: "domcontentloaded", timeout: 30000 });
      await first.evaluate(() => { window.__pwaInterruptFirstDownload = true; });
      await first.getByRole("button", { name: "ダウンロードを開始", exact: true }).tap({ timeout: 30000 });
      const cacheKey = assetCacheKey(retained.hash, base);
      const saveDeadline = Date.now() + 30_000;
      let storedHash = null;
      while (!storedHash && Date.now() < saveDeadline) {
        storedHash = await first.evaluate(async ({ name, key }) => {
          const cache = await caches.open(name);
          return (await cache.match(key))?.headers.get("x-pwa-asset-hash") ?? null;
        }, { name: ASSET_CACHE_NAME, key: cacheKey });
        if (!storedHash) await first.waitForTimeout(100);
      }
      assert.equal(storedHash, retained.hash, "close only after a verified file has been saved");
      await first.close();

      const reopened = await context.newPage();
      const errors = [];
      reopened.on("pageerror", error => errors.push(String(error)));
      await reopened.goto(base, { waitUntil: "domcontentloaded", timeout: 30000 });
      const resume = reopened.getByRole("button", { name: "ダウンロードを再開", exact: true });
      await resume.waitFor({ timeout: 30000 });
      await reopened.getByRole("heading", { name: "ダウンロードの続き", exact: true }).waitFor();
      assert.equal(await reopened.getByRole("button", { name: "ダウンロードを開始", exact: true }).count(), 0);
      assert.equal((await reopened.locator(".pwa-gate .pwa-plan-capacity").textContent()).trim(),
        `残り2件・${formatBytes(partialBytes)}をこの端末へ保存します`);
      if (output) await reopened.screenshot({ path: path.join(output, "partial-reopened.png") });
      await resume.tap();
      await reopened.getByRole("heading", { name: "ダウンロードが完了しました", exact: true }).waitFor({ timeout: 60000 });
      const fetched = await reopened.evaluate(() => window.__pwaResumeRequests);
      assert.deepEqual(fetched.sort(), remainingPaths.sort(), "request each missing file once and keep the saved file");
      const cached = await reopened.evaluate(async name => (await (await caches.open(name)).keys()).map(request => request.url), ASSET_CACHE_NAME);
      assert.deepEqual(cached.sort(), assets.map(asset => assetCacheKey(asset.hash, base)).sort());
      assert.deepEqual(errors, []);
      results.push({ mode: "partial-first-install-resume", status: "passed", retained: retained.path,
        remaining: pending.length, remainingBytes: partialBytes, fetched, syntheticPack: true, physicalPhone: false });
    } finally { await context.close(); }
  }

  // Hold the final cache read after all transport work finishes. Download
  // completion must remain behind durable generation commit, even across frames.
  const context = await browser.newContext({ viewport: { width: 844, height: 340 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  try {
    await silenceBrowserOutput(page);
    const small = { ...shipped, assets: [...shipped.assets].sort((a, b) => a.bytes - b.bytes).slice(0, 3).map(asset => Object.fromEntries(Object.entries(asset).filter(([key]) => !key.startsWith("bundle")))) };
    await page.addInitScript(({ small }) => {
      Object.defineProperty(navigator, "standalone", { configurable: true, get: () => true });
      window.__pwaStorageRequests = [];
      Object.defineProperty(navigator.storage, "persist", {
        configurable: true,
        value: () => {
          window.__pwaStorageRequests.push(navigator.userActivation.isActive);
          return new Promise(() => {});
        },
      });
      const fetchOriginal = window.fetch.bind(window);
      window.fetch = (...args) => {
        const url = new URL(typeof args[0] === "string" ? args[0] : args[0].url, location.href);
        return url.pathname.endsWith("/asset-manifest.json")
          ? Promise.resolve(new Response(JSON.stringify(small), { headers: { "content-type": "application/json" } }))
          : fetchOriginal(...args);
      };
      const keys = Cache.prototype.keys;
      Cache.prototype.keys = function (...args) {
        if (window.__pwaHoldFinalVerification) return new Promise(resolve => {
          window.__pwaReleaseFinalVerification = () => { window.__pwaHoldFinalVerification = false; resolve(keys.apply(this, args)); };
        });
        return keys.apply(this, args);
      };
    }, { small });
    await page.goto(base, { waitUntil: "domcontentloaded", timeout: 30000 });
    const start = page.getByRole("button", { name: "ダウンロードを開始", exact: true });
    await start.waitFor({ timeout: 30000 });
    assert.deepEqual(await page.evaluate(() => window.__pwaStorageRequests), []);
    await page.evaluate(() => { window.__pwaHoldFinalVerification = true; });
    await start.tap();
    await page.waitForFunction(() => typeof window.__pwaReleaseFinalVerification === "function", null, { timeout: 30000 });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const beforeCommit = await page.locator(".pwa-gate").innerText();
    if (output) {
      await page.screenshot({ path: path.join(output, "before-commit.png"), fullPage: true });
      await fs.writeFile(path.join(output, "before-commit.json"), JSON.stringify({ beforeCommit, gameMounted: await page.locator(".v100-shell").count() > 0 }, null, 2) + "\n");
    }
    assert.doesNotMatch(beforeCommit, /ダウンロードが完了しました|ゲームを始める/);
    assert.match(beforeCommit, /保存済みデータを反映しています/);
    assert.match(beforeCommit, /この画面でお待ちください/);
    assert.equal(await page.getByRole("button", { name: "保存済みデータを反映", exact: true }).count(), 0);
    assert.deepEqual(await page.evaluate(() => window.__pwaStorageRequests), [true]);
    await page.evaluate(() => { window.__pwaReleaseFinalVerification(); });
    await page.getByRole("heading", { name: "ダウンロードが完了しました", exact: true }).waitFor({ timeout: 60000 });
    const active = await page.evaluate(async base => {
      const registration = await navigator.serviceWorker.getRegistration(base), channel = new MessageChannel();
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("state timeout")), 10000);
        channel.port1.onmessage = event => { clearTimeout(timer); resolve({ source: event.data.active?.releaseSha, assets: event.data.active?.assets?.length }); };
        registration.active.postMessage({ type: "pwa:get-state" }, [channel.port2]);
      });
    }, base);
    assert.equal(active.source, small.releaseSha);
    assert.equal(active.assets, small.assets.length);
    assert.deepEqual(await page.evaluate(() => window.__pwaStorageRequests), [true]);
    results.push({ mode: "download-commit-boundary", status: "passed", active, persistenceRequestedOnTap: true, syntheticPack: true, physicalPhone: false });
  } finally { await context.close(); }
} catch (error) { failure = error; }
finally {
  await browser.close();
  const report = { status: failure ? "failed" : "passed", results, error: failure?.stack ?? null };
  if (output) await fs.writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report));
}
if (failure) throw failure;
