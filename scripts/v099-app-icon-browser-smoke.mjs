import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium, webkit } from "playwright";

import { V099_APP_ICON_IDENTITY } from "../app/appIconIdentity.js";

const baseUrl = process.env.V099_ICON_QA_BASE_URL;
if (!baseUrl) throw new Error("V099_ICON_QA_BASE_URL is required");
const engineName = process.env.V099_ICON_QA_BROWSER ?? "chromium";
const browserType = { chromium, webkit }[engineName];
if (!browserType) throw new Error(`Unknown V099_ICON_QA_BROWSER: ${engineName}`);
const evidenceDir = path.resolve(process.env.V099_ICON_QA_EVIDENCE_DIR ?? "outputs/v099-app-icon-browser-smoke");
const expected = [
  [V099_APP_ICON_IDENTITY.paths.favicon48, 48],
  [V099_APP_ICON_IDENTITY.paths.appleTouch180, 180],
  [V099_APP_ICON_IDENTITY.paths.icon192, 192],
  [V099_APP_ICON_IDENTITY.paths.maskable192, 192],
  [V099_APP_ICON_IDENTITY.paths.icon512, 512],
  [V099_APP_ICON_IDENTITY.paths.maskable512, 512],
  [V099_APP_ICON_IDENTITY.paths.icon1024, 1024],
];

const browser = await browserType.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, hasTouch: true });
const page = await context.newPage();
const diagnostics = { consoleErrors: [], pageErrors: [], requestFailures: [], httpErrors: [] };
page.on("console", (message) => { if (message.type() === "error") diagnostics.consoleErrors.push(message.text()); });
page.on("pageerror", (error) => diagnostics.pageErrors.push(String(error)));
page.on("requestfailed", (request) => diagnostics.requestFailures.push(`${request.url()} :: ${request.failure()?.errorText}`));
page.on("response", (response) => { if (response.status() >= 400) diagnostics.httpErrors.push(`${response.status()} ${response.url()}`); });

await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 30_000 });
const result = await page.evaluate(async ({ expectedPaths, identity }) => {
  const scope = new URL("./", location.href);
  const assetManifest = await fetch(new URL("asset-manifest.json", scope), { cache: "no-store" }).then((response) => {
    if (!response.ok) throw new Error(`asset manifest HTTP ${response.status}`);
    return response.json();
  });
  const webManifestLink = document.querySelector('link[rel="manifest"]')?.href;
  const webManifest = await fetch(webManifestLink, { cache: "no-store" }).then((response) => {
    if (!response.ok) throw new Error(`web manifest HTTP ${response.status}`);
    return response.json();
  });
  const assetByPath = new Map(assetManifest.assets.map((asset) => [asset.path, asset]));
  const hash = async (bytes) => {
    const value = await crypto.subtle.digest("SHA-256", bytes);
    return `sha256-${[...new Uint8Array(value)].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  };
  const decoded = [];
  for (const [assetPath, size] of expectedPaths) {
    const asset = assetByPath.get(assetPath);
    if (!asset) throw new Error(`${assetPath} missing from asset manifest`);
    const url = new URL(assetPath.replace(/^\/+/, ""), scope);
    if (!url.pathname.startsWith(scope.pathname)) throw new Error(`${assetPath} escaped base path`);
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`${assetPath} HTTP ${response.status}`);
    if (!response.headers.get("content-type")?.startsWith("image/png")) throw new Error(`${assetPath} MIME mismatch`);
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength !== asset.bytes || await hash(bytes) !== asset.hash) throw new Error(`${assetPath} size/hash mismatch`);
    const objectUrl = URL.createObjectURL(new Blob([bytes], { type: "image/png" }));
    try {
      const image = new Image();
      image.src = objectUrl;
      await image.decode();
      if (image.naturalWidth !== size || image.naturalHeight !== size) throw new Error(`${assetPath} dimensions mismatch`);
      decoded.push({ assetPath, size, bytes: bytes.byteLength, hash: asset.hash, url: url.toString() });
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }
  const manifestPaths = webManifest.icons.map(({ src }) => new URL(src, webManifestLink).pathname);
  const expectedManifestPaths = expectedPaths
    .map(([assetPath]) => assetPath)
    .filter((assetPath) => !assetPath.endsWith("-48.png") && !assetPath.includes("apple-touch"))
    .map((assetPath) => new URL(assetPath.replace(/^\/+/, ""), scope).pathname);
  const favicon = document.querySelector('link[rel="icon"]');
  const apple = document.querySelector('link[rel="apple-touch-icon"]');
  return {
    version: assetManifest.version,
    releaseSha: assetManifest.releaseSha,
    startUrl: webManifest.start_url,
    scope: webManifest.scope,
    favicon: { href: favicon?.href ?? null, type: favicon?.type ?? null, sizes: favicon?.sizes?.value ?? null },
    appleTouch: { href: apple?.href ?? null, sizes: apple?.sizes?.value ?? null },
    manifestPaths,
    expectedManifestPaths,
    decoded,
    approvedCandidateInRuntime: JSON.stringify(webManifest).includes(identity.candidateSlug)
      && (favicon?.href ?? "").includes(identity.candidateSlug)
      && (apple?.href ?? "").includes(identity.candidateSlug),
    legacyRuntimeReference: /(?:favicon\.svg|\/icons\/(?:icon|apple-touch-icon))/.test(`${document.head.innerHTML}\n${JSON.stringify(webManifest)}`),
  };
}, {
  expectedPaths: expected,
  identity: { candidateSlug: "infected-face-a2" },
});

const sorted = (items) => [...items].sort();
if (result.startUrl !== "./" || result.scope !== "./"
  || result.favicon.type !== "image/png" || result.favicon.sizes !== "48x48"
  || result.appleTouch.sizes !== "180x180"
  || result.decoded.length !== expected.length
  || JSON.stringify(sorted(result.manifestPaths)) !== JSON.stringify(sorted(result.expectedManifestPaths))
  || !result.approvedCandidateInRuntime || result.legacyRuntimeReference
  || Object.values(diagnostics).some((entries) => entries.length)) {
  throw new Error(`Version 0.9.9.0 icon browser QA failed: ${JSON.stringify({ result, diagnostics })}`);
}

await mkdir(evidenceDir, { recursive: true });
const screenshot = path.join(evidenceDir, `${engineName}-844x390.png`);
await page.screenshot({ path: screenshot, fullPage: true });
const report = { generatedAt: new Date().toISOString(), baseUrl, engine: engineName, physicalIPhoneVerified: false, result, diagnostics, screenshot };
await writeFile(path.join(evidenceDir, `${engineName}.json`), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));

await context.close();
await browser.close();
