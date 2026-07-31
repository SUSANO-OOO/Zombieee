// Serves the built _site under the GitHub Pages base path on 127.0.0.1.
//
// The published site lives at /Zombieee/, not at the root, and the service
// worker derives its scope from wherever the document is served. Running the
// PWA QA only at `/` would therefore never exercise the scope the players get.
// 127.0.0.1 is a secure context, so registration behaves as it does over HTTPS
// without asking anyone to trust a certificate.

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "_site");
const rawBase = process.env.PAGES_CANDIDATE_BASE ?? "/Zombieee";
const basePath = rawBase === "/" ? "" : `/${rawBase.replace(/^\/+|\/+$/g, "")}`;
const port = Number(process.env.PAGES_CANDIDATE_PORT ?? 8787);

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ogg": "audio/ogg",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const decoded = decodeURIComponent(url.pathname);

  if (basePath && !decoded.startsWith(`${basePath}/`) && decoded !== basePath) {
    response.writeHead(404).end("Not found");
    return;
  }
  const relative = decoded.slice(basePath.length).replace(/^\/+/, "");

  let target = path.resolve(root, relative || "index.html");
  if (!target.startsWith(root)) {
    response.writeHead(400).end("Invalid path");
    return;
  }

  let stats = await stat(target).catch(() => null);
  if (stats?.isDirectory()) {
    target = path.join(target, "index.html");
    stats = await stat(target).catch(() => null);
  }
  // Single-page app: unknown routes fall back to the shell, as Pages does.
  if (!stats) {
    target = path.join(root, "index.html");
    stats = await stat(target).catch(() => null);
    if (!stats) {
      response.writeHead(404).end("Not found");
      return;
    }
  }

  const body = await readFile(target);
  response.writeHead(200, {
    "content-type": CONTENT_TYPES[path.extname(target).toLowerCase()] ?? "application/octet-stream",
    "content-length": String(body.byteLength),
    // The service worker owns caching; keep the HTTP layer from second-guessing
    // it while a candidate is under test.
    "cache-control": "no-cache",
  });
  response.end(body);
});

server.listen(port, "127.0.0.1", () => {
  console.log(JSON.stringify({ root, basePath: basePath || "/", url: `http://127.0.0.1:${port}${basePath}/` }));
});
