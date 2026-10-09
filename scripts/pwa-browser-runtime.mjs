import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

// WebKit <= r2327 has a broken on-disk ResourceResponseData codec. A put can
// resolve while the persisted response cannot be decoded by even an immediate
// match. Upstream fixes: playwright#41701 / playwright-browsers#2404.
// Keep the rendering baseline separate; use the unmodified fixed browser for
// real persistent PWA storage. No CacheStorage shim or browser backend flags.
export const PWA_WEBKIT_RUNTIME = Object.freeze({ packageVersion:"1.63.0", revision:"2359", browserVersion:"26.6" });

export async function pwaBrowserType(name) {
  if (name === "chromium") return chromium;
  assert.equal(name,"webkit",`Unknown PWA browser ${name}`);
  const root=new URL("./pwa-native-runtime/node_modules/",import.meta.url);
  const pkg=JSON.parse(await readFile(new URL("playwright/package.json",root)));
  const browsers=JSON.parse(await readFile(new URL("playwright-core/browsers.json",root)));
  assert.equal(pkg.version,PWA_WEBKIT_RUNTIME.packageVersion);
  const webkitRecord=browsers.browsers.find(browser=>browser.name==="webkit");
  assert.equal(webkitRecord.revision,PWA_WEBKIT_RUNTIME.revision);
  assert.equal(webkitRecord.browserVersion,PWA_WEBKIT_RUNTIME.browserVersion);
  const {webkit}=await import(new URL("playwright/index.mjs",root).href);
  assert.ok(webkit.executablePath().includes(`webkit-${PWA_WEBKIT_RUNTIME.revision}`),"PWA requires the fixed revision; an older OS fallback cannot replace it");
  return webkit;
}
