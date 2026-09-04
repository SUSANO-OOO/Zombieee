import { once } from "node:events";
import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";

const root = path.resolve("_site");
const basePath = process.env.GITHUB_PAGES_BASE_PATH ?? "/Zombieee";
await stat(path.join(root, "index.html"));
await stat(path.join(root, "v100", "index.html"));

const contentTypes = {
  ".bin": "application/octet-stream",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wav": "audio/wav",
  ".webmanifest": "application/manifest+json",
  ".webp": "image/webp",
};

function safePath(requestPath) {
  let relative = decodeURIComponent(requestPath.slice(basePath.length)).replace(/^\/+/, "");
  if (!relative) relative = "index.html";
  const absolute = path.resolve(root, relative);
  if (!absolute.startsWith(`${root}${path.sep}`)) return null;
  return absolute;
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url ?? "/", "http://localhost");
  if (!requestUrl.pathname.startsWith(`${basePath}/`) && requestUrl.pathname !== basePath) {
    response.writeHead(404).end("Not found");
    return;
  }
  let absolute = safePath(requestUrl.pathname);
  if (!absolute) {
    response.writeHead(400).end("Invalid path");
    return;
  }
  try {
    let metadata = await stat(absolute);
    if (metadata.isDirectory()) {
      absolute = path.join(absolute, "index.html");
      metadata = await stat(absolute);
    }
    response.writeHead(200, {
      "cache-control": "no-store",
      "content-length": metadata.size,
      "content-type": contentTypes[path.extname(absolute)] ?? "application/octet-stream",
    });
    createReadStream(absolute).pipe(response);
  } catch {
    response.writeHead(404).end("Not found");
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string") throw new Error("Pages V1 smoke server did not bind");
const browserBase = `http://localhost:${address.port}${basePath}/`;
const child = spawn(process.execPath, ["scripts/v100-production-browser-smoke.mjs"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    V100_CAMPAIGN_QA_BASE_URL: browserBase,
    V100_CAMPAIGN_QA_REQUIRE_PWA_OFFER: "1",
    V100_CAMPAIGN_QA_EVIDENCE_DIR: process.env.V100_CAMPAIGN_QA_EVIDENCE_DIR ?? "outputs/github-pages-v100-smoke",
  },
  stdio: "inherit",
});
try {
  const [exitCode] = await once(child, "exit");
  if (exitCode !== 0) throw new Error(`V1 Pages browser smoke exited with ${exitCode}`);
} finally {
  if (child.exitCode === null) child.kill();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
console.log(JSON.stringify({ status: "passed", baseUrl: browserBase, route: `${basePath}/v100`, pwaOfferRequired: true }, null, 2));
