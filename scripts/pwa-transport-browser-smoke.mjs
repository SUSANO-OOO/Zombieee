import { legacyQaUrl } from "./legacy-qa-url.mjs";
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

await page.goto(legacyQaUrl(baseUrl), { waitUntil: "domcontentloaded" });
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
  const AudioContextConstructor = window.AudioContext ?? window.webkitAudioContext;
  const audioDecode = {
    attempted: false,
    supported: Boolean(audioCapability),
    status: "not-attempted",
    capability: {
      audioContextConstructor: typeof AudioContextConstructor === "function",
      decodeAudioData: false,
    },
    decoded: false,
    elementLoaded: false,
    durationSeconds: null,
    failureReason: null,
    error: null,
  };
  const sha256 = async (bytes) => {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return `sha256-${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  };
  if (!audioAsset?.bundlePath) {
    audioDecode.status = "decode-failure";
    audioDecode.failureReason = "missing-bundled-audio";
  } else if (typeof AudioContextConstructor !== "function") {
    // This is the only WebKit headless exemption: the required API is absent,
    // so it is explicitly recorded as not executed rather than as a pass.
    audioDecode.status = "capability-unavailable";
    audioDecode.failureReason = "audio-context-unavailable";
  } else {
    audioDecode.attempted = true;
    let audioContext = null;
    let audioUrl = null;
    try {
      const response = await fetch(transportUrl(audioAsset), { cache: "no-store" });
      if (!response.ok) throw Object.assign(new Error(`${response.status} ${audioAsset.bundlePath}`), { reason: "http" });
      const bundle = await response.arrayBuffer();
      if (bundle.byteLength === 0) throw Object.assign(new Error("empty bundle"), { reason: "empty-body" });
      if (Number.isInteger(audioAsset.bundleLength) && bundle.byteLength !== audioAsset.bundleLength) {
        throw Object.assign(new Error(`bundle length ${bundle.byteLength} !== ${audioAsset.bundleLength}`), { reason: "bundle-length-mismatch" });
      }
      const offset = Number(audioAsset.bundleOffset);
      const length = Number(audioAsset.bundleBytes ?? audioAsset.bytes);
      const end = offset + length;
      if (!Number.isInteger(offset) || !Number.isInteger(length) || offset < 0 || length <= 0 || end > bundle.byteLength) {
        throw Object.assign(new Error("invalid audio slice bounds"), { reason: "slice-length-mismatch" });
      }
      const bytes = bundle.slice(offset, end);
      if (bytes.byteLength === 0) throw Object.assign(new Error("empty audio slice"), { reason: "empty-body" });
      if (bytes.byteLength !== audioAsset.bytes) {
        throw Object.assign(new Error(`slice length ${bytes.byteLength} !== ${audioAsset.bytes}`), { reason: "slice-length-mismatch" });
      }
      if (audioAsset.audioType !== "audio/mpeg") {
        throw Object.assign(new Error(`unexpected audio MIME ${audioAsset.audioType}`), { reason: "mime-mismatch" });
      }
      if (await sha256(bytes) !== audioAsset.hash) {
        throw Object.assign(new Error("audio slice sha256 mismatch"), { reason: "hash-mismatch" });
      }

      audioUrl = URL.createObjectURL(new Blob([bytes], { type: audioAsset.audioType }));
      const probe = new Audio();
      probe.preload = "metadata";
      probe.src = audioUrl;
      audioDecode.elementLoaded = await new Promise((resolve) => {
        const timer = setTimeout(() => resolve(false), 5000);
        probe.addEventListener("loadedmetadata", () => { clearTimeout(timer); resolve(probe.duration > 0); }, { once: true });
        probe.addEventListener("error", () => { clearTimeout(timer); resolve(false); }, { once: true });
      });
      if (!audioDecode.elementLoaded) {
        throw Object.assign(new Error("audio element metadata decode failed"), { reason: "decode-failure" });
      }

      audioContext = new AudioContextConstructor();
      audioDecode.capability.decodeAudioData = typeof audioContext.decodeAudioData === "function";
      if (!audioDecode.capability.decodeAudioData) {
        audioDecode.status = "capability-unavailable";
        audioDecode.failureReason = "decode-api-unavailable";
      } else {
        const decoded = await audioContext.decodeAudioData(bytes.slice(0));
        if (!decoded || !(decoded.duration > 0)) {
          throw Object.assign(new Error("decoded audio has no duration"), { reason: "decode-failure" });
        }
        audioDecode.decoded = true;
        audioDecode.durationSeconds = decoded.duration;
        audioDecode.status = "decode-success";
      }
    } catch (error) {
      audioDecode.status = "decode-failure";
      audioDecode.failureReason = error?.reason ?? "exception";
      audioDecode.error = String(error?.message ?? error);
    } finally {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      try { await audioContext?.close?.(); } catch { /* diagnostic status is already set */ }
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
  && result.audioDecode.status === "capability-unavailable"
  && ["audio-context-unavailable", "decode-api-unavailable"].includes(result.audioDecode.failureReason);
if (!result.pathsAreScoped || result.rasterDecoded !== result.rasterCount
  || (result.audioDecode.status !== "decode-success" && !headlessWebKitAudioException)
  || Object.values(diagnostics).some((entries) => entries.length > 0)) {
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
