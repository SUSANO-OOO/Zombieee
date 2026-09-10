import assert from "node:assert/strict";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";

const root = path.resolve("_site"), basePath = "/Zombieee";
const html = await readFile(path.join(root, "index.html"), "utf8");
const metadata = Object.fromEntries(["version", "release", "request-id", "issue"].map(key => {
  const value = html.match(new RegExp(`<meta name="github-pages-${key}" content="([^"]+)">`, "u"))?.[1];
  assert.ok(value, `Missing static ${key}`); return [key, value];
}));
assert.match(metadata.release, /^[a-f0-9]{40}$/u);
assert.match(metadata["request-id"], /^local-v100-rehearsal-[a-z0-9-]+$/u);
assert.equal(metadata.issue, "172");
const types = { ".css": "text/css", ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".png": "image/png", ".svg": "image/svg+xml", ".wav": "audio/wav", ".webmanifest": "application/manifest+json", ".webp": "image/webp" };
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (!url.pathname.startsWith(`${basePath}/`)) { response.writeHead(404).end(); return; }
    const relative = decodeURIComponent(url.pathname.slice(basePath.length)).replace(/^\/+/, "");
    let file = path.resolve(root, relative || "index.html");
    if (!file.startsWith(`${root}${path.sep}`)) { response.writeHead(400).end(); return; }
    let info = await stat(file); if (info.isDirectory()) { file = path.join(file, "index.html"); info = await stat(file); }
    response.writeHead(200, { "cache-control": "no-store", "content-length": info.size, "content-type": types[path.extname(file)] ?? "application/octet-stream" }); createReadStream(file).pipe(response);
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const address = server.address(); assert.ok(address && typeof address === "object");
const url = `http://127.0.0.1:${address.port}${basePath}/`;
const child = spawn(process.execPath, ["scripts/github-pages-public-smoke.mjs"], {
  cwd: process.cwd(), stdio: "inherit", env: { ...process.env,
    GITHUB_PAGES_LOCAL_REHEARSAL: "1", GITHUB_PAGES_PUBLIC_URL: url,
    GITHUB_PAGES_EXPECTED_VERSION: metadata.version, GITHUB_PAGES_EXPECTED_RELEASE_SHA: metadata.release,
    GITHUB_PAGES_EXPECTED_REQUEST_ID: metadata["request-id"], GITHUB_PAGES_EXPECTED_ISSUE_NUMBER: metadata.issue,
  },
});
try { const [code] = await once(child, "exit"); assert.equal(code, 0, "V1 public QA local rehearsal failed"); }
finally { if (child.exitCode === null) child.kill(); await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
console.log(JSON.stringify({ status: "passed-local-rehearsal-only", url, metadata }));
