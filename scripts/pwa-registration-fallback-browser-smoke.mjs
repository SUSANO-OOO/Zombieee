// A failed worker registration must not strand a standalone online player.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { silenceBrowserOutput } from "./silent-browser-output.mjs";

const base = process.env.PWA_REGISTRATION_FALLBACK_BASE_URL;
assert.ok(base, "PWA_REGISTRATION_FALLBACK_BASE_URL is required");
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 844, height: 340 },
  hasTouch: true,
  isMobile: true,
});
await context.addInitScript(() => {
  window.__pwaRegistrationAttempts = 0;
  Object.defineProperty(navigator, "standalone", { configurable: true, get: () => true });
  Object.defineProperty(navigator.serviceWorker, "register", {
    configurable: true,
    value: () => { window.__pwaRegistrationAttempts += 1; return Promise.reject(new Error("simulated registration rejection")); },
  });
});
const page = await context.newPage();
await silenceBrowserOutput(page);
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
try {
  const deadline = Date.now() + 30_000;
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "スマホに保存する準備ができませんでした", exact: true }).waitFor({ timeout: Math.max(1, deadline - Date.now()) });
  const before = await page.evaluate(() => ({
    gameMounted: Boolean(document.querySelector(".v100-shell")),
    gateVisible: Boolean(document.querySelector(".pwa-gate")),
    attempts: window.__pwaRegistrationAttempts,
    detail: document.querySelector(".pwa-gate details")?.textContent,
  }));
  assert.equal(before.gameMounted, false);
  assert.equal(before.gateVisible, true);
  assert.equal(before.attempts, 1);
  assert.match(before.detail, /simulated registration rejection/u);
  await page.getByRole("button", { name: "保存の準備をやり直す", exact: true }).click();
  await page.waitForFunction(() => window.__pwaRegistrationAttempts === 2, null, { timeout: Math.max(1, deadline - Date.now()) });
  await page.getByRole("heading", { name: "スマホに保存する準備ができませんでした", exact: true }).waitFor({ timeout: Math.max(1, deadline - Date.now()) });
  assert.equal(await page.locator(".v100-shell").count(), 0);
  await page.getByRole("button", { name: "保存せずに試す", exact: true }).click();
  await page.locator(".v100-shell").first().waitFor({ timeout: Math.max(1, deadline - Date.now()) }).catch(async (error) => {
    const diagnostic = await page.evaluate(() => ({
      title: document.title,
      body: document.body.innerText.slice(0, 800),
      classes: [...document.querySelectorAll("[class]")].slice(0, 20).map((node) => node.className),
    }));
    throw new Error(`${error.message}\n${JSON.stringify(diagnostic)}\n${JSON.stringify(errors)}`);
  });
  // The game shell and registration-failure notice are rendered by separate
  // async effects. Require both within the original 30-second budget.
  await page.locator(".pwa-notice").waitFor({ state: "visible", timeout: Math.max(1, deadline - Date.now()) });
  const state = await page.evaluate(() => ({
    standalone: Boolean(navigator.standalone),
    gameMounted: Boolean(document.querySelector(".v100-shell")),
    gateVisible: Boolean(document.querySelector(".pwa-gate")),
    warning: document.querySelector(".pwa-notice")?.textContent ?? "",
  }));
  assert.equal(state.standalone, true);
  assert.equal(state.gameMounted, true);
  assert.equal(state.gateVisible, false);
  assert.match(state.warning, /オフライン用の設定に失敗しました/u);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ status: "passed", before, retried: true, explicitOnlineChoice: true, offlineAccepted: false, state, errors }, null, 2));
} finally {
  await browser.close();
}

// Retain the existing CI entry and deadlines, then cover the original phone
// installation path and the boundary between transfer and durable commit.
await import("./pwa-first-install-recovery-browser-smoke.mjs");
await import("./pwa-finalize-rejection-browser-smoke.mjs");
