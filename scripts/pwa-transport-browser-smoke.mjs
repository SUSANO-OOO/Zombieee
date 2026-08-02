// Browser proof for the optimized transport used by the complete first-install pack.
// This is a WebKit/Chromium proxy for Safari decode behavior; it is never a
// physical iPhone memory or thermal result.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, webkit } from "playwright";

const baseUrl = process.env.PWA_TRANSPORT_QA_BASE_URL;
if (!baseUrl) throw new Error("PWA_TRANSPORT_QA_BASE_URL is required");
const engineName = process.env.PWA_TRANSPORT_QA_BROWSER ?? "chromium";
const browserType = { chromium, webkit }[engineName];
if (!browserType) throw new Error(`Unknown PWA_TRANSPORT_QA_BROWSER: ${engineName}`);
const evidenceDir = path.resolve(process.env.PWA_TRANSPORT_QA_EVIDENCE_DIR ?? "outputs/pwa-transport-browser-smoke");
const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const browser = await browserType.launch();
const context = await browser.newContext({
  viewport: { width: 844, height: 390 },
  deviceScaleFactor: 3,
  hasTouch: true,
  userAgent: IPHONE_UA,
});
const page = await context.newPage();
const diagnostics = { consoleErrors: [], pageErrors: [], requestFailures: [], httpErrors: [] };
page.on("console", (message) => {
  if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
});
page.on("pageerror", (error) => diagnostics.pageErrors.push(String(error)));
page.on("requestfailed", (request) => {
  if (request.failure()?.errorText !== "net::ERR_ABORTED") {
    diagnostics.requestFailures.push(`${request.url()} :: ${request.failure()?.errorText ?? "unknown"}`);
  }
});
page.on("response", (response) => {
  if (response.status() >= 400) diagnostics.httpErrors.push(`${response.status()} ${response.url()}`);
});

await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
const result = await page.evaluate(async () => {
  const manifestResponse = await fetch(new URL("asset-manifest.json", location.href), { cache: "no-store" });
  if (!manifestResponse.ok) throw new Error(`asset-manifest.json HTTP ${manifestResponse.status}`);
  const manifest = await manifestResponse.json();
  const base = new URL("./", location.href);
  const transportPath = (asset) => asset.bundlePath ?? asset.sourcePath ?? asset.path;
  const transportUrl = (asset) => new URL(String(transportPath(asset)).replace(/^\/+/, ""), base).toString();
  const pathsAreScoped = [
    "manifest.webmanifest",
    "sw.js",
    "asset-manifest.json",
    ...manifest.assets.map(transportPath),
  ].every((assetPath) => {
    const url = new URL(String(assetPath).replace(/^\/+/, ""), base);
    return url.origin === location.origin && url.pathname.startsWith(base.pathname);
  });

  const memorySample = () => ({
    deviceMemory: navigator.deviceMemory ?? null,
    usedJsHeapBytes: performance.memory?.usedJSHeapSize ?? null,
  });
  const memoryBefore = memorySample();
  const rasterAssets = manifest.assets.filter((asset) => asset.sourcePath?.endsWith(".webp"));
  const rasterDecode = [];
  for (const asset of rasterAssets) {
    const started = performance.now();
    const response = await fetch(transportUrl(asset), { cache: "no-store" });
    if (!response.ok) throw new Error(`${response.status} ${transportPath(asset)}`);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      const image = new Image();
      image.src = objectUrl;
      if (typeof image.decode === "function") await image.decode();
      else await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error(`image load failed: ${asset.sourcePath}`));
      });
      rasterDecode.push({ path: asset.path, sourcePath: asset.sourcePath, width: image.naturalWidth, height: image.naturalHeight, decodeMs: performance.now() - started });
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  const audio = document.createElement("audio");
  const audioCapability = audio.canPlayType("audio/mpeg");
  const audioAsset = manifest.assets.find((asset) => asset.category === "audio");
  let audioDecode = { attempted: false, supported: Boolean(audioCapability), decoded: false, elementLoaded: false, durationSeconds: null, error: null };
  if (audioAsset?.bundlePath) {
    audioDecode.attempted = true;
    try {
      const response = await fetch(transportUrl(audioAsset), { cache: "no-store" });
      if (!response.ok) throw new Error(`${response.status} ${audioAsset.bundlePath}`);
      const bundle = await response.arrayBuffer();
      const offset = Number(audioAsset.bundleOffset);
      const length = Number(audioAsset.bundleBytes ?? audioAsset.bytes);
      const bytes = bundle.slice(offset, offset + length);
      const audioUrl = URL.createObjectURL(new Blob([bytes], { type: "audio/mpeg" }));
      const probe = new Audio();
      probe.preload = "metadata";
      probe.src = audioUrl;
      audioDecode.elementLoaded = await new Promise((resolve) => {
        const timer = setTimeout(() => resolve(false), 5000);
        probe.addEventListener("loadedmetadata", () => { clearTimeout(timer); resolve(probe.duration > 0); }, { once: true });
        probe.addEventListener("error", () => { clearTimeout(timer); resolve(false); }, { once: true });
      });
      if (audioDecode.elementLoaded) {
        audioDecode.decoded = true;
        audioDecode.durationSeconds = probe.duration;
      }
      URL.revokeObjectURL(audioUrl);
      const AudioContextConstructor = window.AudioContext ?? window.webkitAudioContext;
      if (AudioContextConstructor) {
        const audioContext = new AudioContextConstructor();
        const decoded = await audioContext.decodeAudioData(bytes.slice(0));
        audioDecode.decoded = decoded.duration > 0;
        audioDecode.durationSeconds = decoded.duration;
        await audioContext.close();
      }
    } catch (error) {
      audioDecode.error = String(error?.message ?? error);
    }
  }
  const memoryAfter = memorySample();
  return {
    version: manifest.version,
    assetCount: manifest.assets.length,
    rasterCount: rasterAssets.length,
    rasterDecoded: rasterDecode.length,
    rasterDecodeMs: rasterDecode.reduce((sum, asset) => sum + asset.decodeMs, 0),
    maxRasterDecodeMs: Math.max(0, ...rasterDecode.map((asset) => asset.decodeMs)),
    pathsAreScoped,
    memoryBefore,
    memoryAfter,
    memoryMeasurementAvailable: memoryBefore.usedJsHeapBytes != null || memoryAfter.usedJsHeapBytes != null,
    audioCapability,
    audioDecode,
  };
});

const headlessWebKitAudioException = engineName === "webkit"
  && result.audioDecode.supported
  && !result.audioDecode.decoded;
if (!result.pathsAreScoped || result.rasterDecoded !== result.rasterCount || (!result.audioDecode.decoded && !headlessWebKitAudioException) || Object.values(diagnostics).some((entries) => entries.length > 0)) {
  throw new Error(`PWA transport browser QA failed: ${JSON.stringify({ result, diagnostics })}`);
}

await mkdir(evidenceDir, { recursive: true });
const summary = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  engine: engineName,
  physicalIPhoneVerified: false,
  headlessWebKitAudioException,
  result,
  diagnostics,
};
await writeFile(path.join(evidenceDir, `${engineName}.json`), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify(summary, null, 2));

await context.close();
await browser.close();
