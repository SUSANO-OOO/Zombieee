import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { normalizeReleaseTitle } from "./pages-release-identity.mjs";

const root = process.cwd();
const clientDir = path.join(root, "dist", "client");
const serverEntry = path.join(root, "dist", "server", "index.js");
const outputDir = path.join(root, "_site");
const requestedBasePath = process.env.GITHUB_PAGES_BASE_PATH ?? "/Zombieee";
const basePath = requestedBasePath === "/" ? "" : `/${requestedBasePath.replace(/^\/+|\/+$/g, "")}`;
const releaseVersion = process.env.GITHUB_PAGES_RELEASE_VERSION ?? "preview";
const releaseSha = process.env.GITHUB_PAGES_RELEASE_SHA ?? process.env.GITHUB_SHA ?? "local";
const releaseRequestId = process.env.GITHUB_PAGES_REQUEST_ID ?? "local-preview";
const releaseIssueNumber = process.env.GITHUB_PAGES_ISSUE_NUMBER ?? "0";

function escapeHtmlAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

await stat(clientDir);
await stat(serverEntry);
await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
await cp(clientDir, outputDir, { recursive: true });

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

const assets = {
  async fetch(request) {
    const url = new URL(request.url);
    const relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    if (!relativePath) return new Response("Not found", { status: 404 });
    const absolutePath = path.resolve(clientDir, relativePath);
    if (!absolutePath.startsWith(`${path.resolve(clientDir)}${path.sep}`)) {
      return new Response("Invalid path", { status: 400 });
    }
    try {
      const body = await readFile(absolutePath);
      return new Response(body, {
        status: 200,
        headers: { "content-type": contentTypes[path.extname(absolutePath)] ?? "application/octet-stream" },
      });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  },
};

const worker = (await import(`${pathToFileURL(serverEntry).href}?pages=${Date.now()}`)).default;
const rendered = await worker.fetch(new Request("https://pages.invalid/"), { ASSETS: assets });
if (!rendered.ok) throw new Error(`Failed to render the root document: ${rendered.status}`);
let html = await rendered.text();
html = normalizeReleaseTitle(html, releaseVersion);

const topLevelEntries = await readdir(clientDir, { withFileTypes: true });
const directoryPrefixes = topLevelEntries
  .filter((entry) => entry.isDirectory())
  .map((entry) => `/${entry.name}/`);
const rootFiles = topLevelEntries
  .filter((entry) => entry.isFile())
  .map((entry) => `/${entry.name}`);
const absoluteTargets = [...directoryPrefixes, ...rootFiles];

function prefixAbsoluteReferences(source) {
  let result = source;
  absoluteTargets.forEach((target, index) => {
    const protectedMarker = `__GITHUB_PAGES_PROTECTED_${index}__`;
    result = result.replaceAll(`${basePath}${target}`, protectedMarker);
    result = result.replaceAll(target, `${basePath}${target}`);
    result = result.replaceAll(protectedMarker, `${basePath}${target}`);
  });
  return result;
}

function patchVinextPreloadBase(source) {
  if (!basePath) return source;
  const originalHelper = "function(e){return`/`+e}";
  const pagesHelper = `function(e){return\`${basePath}/\`+e}`;
  return source.replaceAll(originalHelper, pagesHelper);
}

html = prefixAbsoluteReferences(html);
html = html.replace(
  "<head>",
  `<head><meta name="github-pages-version" content="${escapeHtmlAttribute(releaseVersion)}"><meta name="github-pages-release" content="${escapeHtmlAttribute(releaseSha)}"><meta name="github-pages-request-id" content="${escapeHtmlAttribute(releaseRequestId)}"><meta name="github-pages-issue" content="${escapeHtmlAttribute(releaseIssueNumber)}"><meta name="github-pages-base" content="${basePath || "/"}/">`,
);

await writeFile(path.join(outputDir, "index.html"), html, "utf8");
await writeFile(path.join(outputDir, "404.html"), html, "utf8");
await writeFile(path.join(outputDir, ".nojekyll"), "", "utf8");

let preloadHelperPatchCount = 0;
async function rewriteCompiledFiles(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await rewriteCompiledFiles(entryPath);
    } else if ([".css", ".html", ".js"].includes(path.extname(entry.name))) {
      const original = await readFile(entryPath, "utf8");
      let rewritten = prefixAbsoluteReferences(original);
      if (path.extname(entry.name) === ".js") {
        const patched = patchVinextPreloadBase(rewritten);
        if (patched !== rewritten) preloadHelperPatchCount += 1;
        rewritten = patched;
      }
      if (rewritten !== original) await writeFile(entryPath, rewritten, "utf8");
    }
  }
}

await rewriteCompiledFiles(outputDir);
if (basePath && preloadHelperPatchCount !== 1) {
  throw new Error(`Expected one vinext preload helper patch, found ${preloadHelperPatchCount}`);
}

const index = await readFile(path.join(outputDir, "index.html"), "utf8");
const requiredReferences = [...index.matchAll(/(?:href|src)="([^"?#]+)["?#]/g)].map((match) => match[1]);
const missing = [];
for (const reference of requiredReferences) {
  if (!reference.startsWith(`${basePath}/`)) continue;
  const relativePath = reference.slice(basePath.length + 1);
  try {
    await stat(path.join(outputDir, relativePath));
  } catch {
    missing.push(reference);
  }
}
if (missing.length) throw new Error(`Missing GitHub Pages assets: ${missing.join(", ")}`);

// --- PWA distribution manifest -------------------------------------------
//
// The manifest is authored with a placeholder release SHA because the release
// commit does not exist until the merge that produces it. This is the one place
// that knows the real SHA, so it is stamped in here.
//
// Everything the PWA trusts is then verified against the bytes this build will
// actually publish: the device rejects any asset whose size or digest differs
// from the manifest, and it has no way to repair a mismatch, so a mismatch must
// fail the release rather than reach a phone.

const manifestPath = path.join(outputDir, "asset-manifest.json");
const distribution = JSON.parse(await readFile(manifestPath, "utf8"));

if (releaseVersion !== "preview" && distribution.version !== releaseVersion) {
  throw new Error(
    `asset-manifest.json declares version ${distribution.version}, but this release is ${releaseVersion}. `
    + "Bump RELEASE_VERSION and regenerate the manifest.",
  );
}

const PLACEHOLDER = "__ZOMBIEEE_RELEASE_SHA__";
if (distribution.releaseSha !== PLACEHOLDER && distribution.releaseSha !== releaseSha) {
  throw new Error(`asset-manifest.json already pins release SHA ${distribution.releaseSha}`);
}
distribution.releaseSha = releaseSha;

const assetProblems = [];
let verifiedBytes = 0;
const bundleBodies = new Map();
async function readTransportBody(asset) {
  if (asset.bundlePath) {
    let bundle = bundleBodies.get(asset.bundlePath);
    if (!bundle) {
      bundle = await readFile(path.join(outputDir, asset.bundlePath.replace(/^\/+/, "")));
      bundleBodies.set(asset.bundlePath, bundle);
    }
    const offset = Number(asset.bundleOffset);
    const length = Number(asset.bundleBytes ?? asset.bytes);
    return bundle.subarray(offset, offset + length);
  }
  const transportPath = asset.sourcePath ?? asset.path;
  return readFile(path.join(outputDir, transportPath.replace(/^\/+/, "")));
}
for (const asset of distribution.assets ?? []) {
  let body;
  try {
    body = await readTransportBody(asset);
  } catch {
    assetProblems.push(`${asset.path}: not published`);
    continue;
  }
  if (body.byteLength !== asset.bytes) {
    assetProblems.push(`${asset.path}: ${asset.bytes} bytes declared, ${body.byteLength} published`);
    continue;
  }
  const digest = `sha256-${createHash("sha256").update(body).digest("hex")}`;
  if (digest !== asset.hash) {
    assetProblems.push(`${asset.path}: digest ${digest} does not match ${asset.hash}`);
    continue;
  }
  verifiedBytes += body.byteLength;
}
if (assetProblems.length) {
  throw new Error(
    `The published pack does not match asset-manifest.json (${assetProblems.length} of `
    + `${distribution.assets?.length ?? 0}):\n  ${assetProblems.slice(0, 20).join("\n  ")}`,
  );
}

await writeFile(manifestPath, `${JSON.stringify(distribution, null, 2)}\n`, "utf8");

const stamped = JSON.parse(await readFile(manifestPath, "utf8"));
if (stamped.releaseSha !== releaseSha || stamped.releaseSha === PLACEHOLDER) {
  throw new Error("asset-manifest.json was not stamped with the release SHA");
}

console.log(JSON.stringify({
  basePath: basePath || "/",
  outputDir,
  renderedBytes: index.length,
  checkedReferences: requiredReferences.length,
  preloadHelperPatchCount,
  releaseVersion,
  releaseSha,
  releaseRequestId,
  releaseIssueNumber,
  distributionAssets: distribution.assets?.length ?? 0,
  distributionBytes: verifiedBytes,
  distributionVersion: distribution.version,
}, null, 2));
