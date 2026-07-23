import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

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

function normalizeReleaseTitle(source) {
  const renderedTitles = source.match(/<title>[^<]*<\/title>/gu) ?? [];
  if (renderedTitles.length !== 1) {
    throw new Error(`Expected one rendered title, found ${renderedTitles.length}`);
  }
  const releaseTitle = `<title>西新世紀末物語｜アーリーアクセス版 ${escapeHtmlAttribute(releaseVersion)}</title>`;
  return source.replace(renderedTitles[0], releaseTitle);
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
html = normalizeReleaseTitle(html);

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
}, null, 2));
