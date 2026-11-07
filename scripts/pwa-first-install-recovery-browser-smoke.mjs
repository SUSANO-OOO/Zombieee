// Exercises actual first-install UI with real worker/storage and controlled metadata failures.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { silenceBrowserOutput } from "./silent-browser-output.mjs";

const base = process.env.PWA_FIRST_INSTALL_BASE_URL ?? process.env.V096_PWA_QA_BASE_URL ?? process.env.PWA_REGISTRATION_FALLBACK_BASE_URL;
assert.ok(base, "PWA_FIRST_INSTALL_BASE_URL is required");
const output = process.env.PWA_FIRST_INSTALL_OUTPUT_DIR;
if (output) await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
let failure;
try {
  const metadataCases = process.env.PWA_FIRST_INSTALL_CASE === "commit-only" ? [] : ["network", "html", "pending", "standalone-network"];
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
            if (window.__pwaMetadataMode === "html") return Promise.resolve(new Response("<html>Sign in</html>", { headers: { "content-type": "text/html" } }));
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
      if (standalone) await page.getByText("配信データに接続できませんでした。通信環境を確認してください。", { exact: true }).waitFor({ timeout: remaining() });
      await retry.waitFor({ state: "visible", timeout: remaining() });
      assert.equal(await page.locator(".v100-shell").count(), 0, "first install must not silently enter browser play");
      assert.equal(await page.getByText("ダウンロードする容量を確認しています…", { exact: true }).count(), 0);
      const errorDetails = page.locator(".pwa-gate details").filter({ has: page.getByText("エラーの詳細", { exact: true }) });
      await errorDetails.locator("summary").click();
      const detail = await errorDetails.innerText();
      assert.match(detail, mode === "html" ? /Webページ/ : mode === "pending" ? /10秒/ : /simulated metadata network failure/);
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
        assert.match(await page.locator(".pwa-gate").innerText(), /ダウンロード容量：\d/);
        assert.equal(await page.locator(".v100-shell").count(), 0);
      }
      const layout = await page.locator(".pwa-gate").evaluate(node => ({ width: node.clientWidth, scrollWidth: node.scrollWidth }));
      assert.ok(layout.scrollWidth <= layout.width + 1, "phone layout must not overflow horizontally");
      if (output) await page.screenshot({ path: path.join(output, `${mode}-recovered.png`), fullPage: true });
      assert.deepEqual(errors, []);
      results.push({ mode, status: "passed", retryInPlace: true, gameDataDownloaded: false, physicalPhone: false, layout });
    } finally { await context.close(); }
  }
  // Hold the final cache read after all transport work finishes. Download
  // completion must remain behind durable generation commit, even across frames.
  const context = await browser.newContext({ viewport: { width: 844, height: 340 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  try {
    await silenceBrowserOutput(page);
    const shipped = await (await fetch(new URL("asset-manifest.json", base))).json();
    const small = { ...shipped, assets: [...shipped.assets].sort((a, b) => a.bytes - b.bytes).slice(0, 3).map(asset => Object.fromEntries(Object.entries(asset).filter(([key]) => !key.startsWith("bundle")))) };
    await page.addInitScript(({ small }) => {
      Object.defineProperty(navigator, "standalone", { configurable: true, get: () => true });
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
    await page.evaluate(() => { window.__pwaHoldFinalVerification = true; });
    await start.click();
    await page.waitForFunction(() => typeof window.__pwaReleaseFinalVerification === "function", null, { timeout: 30000 });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const beforeCommit = await page.locator(".pwa-gate").innerText();
    if (output) {
      await page.screenshot({ path: path.join(output, "before-commit.png"), fullPage: true });
      await fs.writeFile(path.join(output, "before-commit.json"), JSON.stringify({ beforeCommit, gameMounted: await page.locator(".v100-shell").count() > 0 }, null, 2) + "\n");
    }
    assert.doesNotMatch(beforeCommit, /ダウンロードが完了しました|ゲームを始める/);
    assert.match(beforeCommit, /保存済みデータを反映しています/);
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
    results.push({ mode: "download-commit-boundary", status: "passed", active, syntheticPack: true, physicalPhone: false });
  } finally { await context.close(); }
} catch (error) { failure = error; }
finally {
  await browser.close();
  const report = { status: failure ? "failed" : "passed", results, error: failure?.stack ?? null };
  if (output) await fs.writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report));
}
if (failure) throw failure;
