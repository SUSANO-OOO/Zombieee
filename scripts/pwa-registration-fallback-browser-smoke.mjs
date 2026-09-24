// A failed worker registration must not strand a standalone online player.
import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.PWA_REGISTRATION_FALLBACK_BASE_URL;
assert.ok(base, "PWA_REGISTRATION_FALLBACK_BASE_URL is required");
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 844, height: 340 },
  hasTouch: true,
  isMobile: true,
});
await context.addInitScript(() => {
  Object.defineProperty(navigator, "standalone", { configurable: true, get: () => true });
  Object.defineProperty(navigator.serviceWorker, "register", {
    configurable: true,
    value: () => Promise.reject(new Error("simulated registration rejection")),
  });
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
try {
  const deadline = Date.now() + 30_000;
  await page.goto(base, { waitUntil: "domcontentloaded" });
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
  console.log(JSON.stringify({ status: "passed", state, errors }, null, 2));
} finally {
  await browser.close();
}
