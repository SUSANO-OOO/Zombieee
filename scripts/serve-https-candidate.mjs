// Serves the built _site over HTTPS on the LAN so a physical iPhone or Android
// can install the Version 0.9.6 PWA.
//
// A service worker only registers on a secure origin. localhost is exempt, but
// a phone reaching this machine by IP is not, so the candidate needs real TLS.
// This uses a self-signed certificate: the device must trust it once before the
// PWA will install. That trade-off is documented in the handover notes.

import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:https";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "_site");
const pfxPath = process.env.CANDIDATE_PFX ?? ".https-candidate/candidate.pfx";
const passphrase = process.env.CANDIDATE_PFX_PASSWORD ?? "zombieee096";
const port = Number(process.env.CANDIDATE_PORT ?? 8443);

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
  ".cer": "application/x-x509-ca-cert",
};

const pfx = await readFile(pfxPath);

const server = createServer({ pfx, passphrase }, async (request, response) => {
  const url = new URL(request.url, `https://${request.headers.host}`);
  const decoded = decodeURIComponent(url.pathname);

  // Hand out the trust anchor over the same origin so the device can install it
  // before anything else is attempted.
  if (decoded === "/ca.cer") {
    const body = await readFile(".https-candidate/zombieee-candidate-ca.cer");
    response.writeHead(200, {
      "content-type": "application/x-x509-ca-cert",
      "content-disposition": "attachment; filename=zombieee-candidate-ca.cer",
    });
    response.end(body);
    return;
  }

  let target = path.resolve(root, decoded.replace(/^\/+/, "") || "index.html");
  if (!target.startsWith(root)) {
    response.writeHead(400).end("Invalid path");
    return;
  }

  let stats = await stat(target).catch(() => null);
  if (stats?.isDirectory()) {
    target = path.join(target, "index.html");
    stats = await stat(target).catch(() => null);
  }
  // Single-page app: unknown routes fall back to the shell.
  if (!stats) {
    target = path.join(root, "index.html");
    stats = await stat(target).catch(() => null);
    if (!stats) {
      response.writeHead(404).end("Not found");
      return;
    }
  }

  const extension = path.extname(target).toLowerCase();
  response.writeHead(200, {
    "content-type": CONTENT_TYPES[extension] ?? "application/octet-stream",
    "content-length": String(stats.size),
    // The service worker owns caching; keep the HTTP layer from second-guessing
    // it while a candidate is under test.
    "cache-control": "no-cache",
    "service-worker-allowed": "/",
  });
  createReadStream(target).pipe(response);
});

server.listen(port, "0.0.0.0", () => {
  console.log(JSON.stringify({
    root,
    port,
    urls: [`https://192.168.1.19:${port}/`, `https://localhost:${port}/`],
    caDownload: `https://192.168.1.19:${port}/ca.cer`,
  }, null, 2));
});
