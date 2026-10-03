import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer, request as httpRequest } from "node:http";
import { readFile } from "node:fs/promises";
import { V100_ENDING_MUSIC_ADDITION as song } from "./v100-release-asset-contract.mjs";

export function serveNativeAudioQaBytes(request, response, body) {
  if (response.destroyed) return;
  const headers = { "content-type": "audio/mpeg", "accept-ranges": "bytes", "cache-control": "no-store" };
  const match = /^bytes=(\d+)-(\d*)$/u.exec(request.headers.range ?? "");
  let start = 0, end = body.length - 1;
  if (match) { start = Number(match[1]); end = Math.min(end, match[2] ? Number(match[2]) : end); }
  if (start > end || start >= body.length) { response.writeHead(416, { ...headers, "content-range": `bytes */${body.length}` }); response.end(); return; }
  if (match) headers["content-range"] = `bytes ${start}-${end}/${body.length}`;
  headers["content-length"] = end - start + 1;
  response.writeHead(match ? 206 : 200, headers);
  response.end(request.method === "HEAD" ? undefined : body.subarray(start, end + 1));
}

// Vinext streams static files without Content-Length/Range, so Chromium's
// native media seekable range is [0,0]. Pages and the verified SW cache support
// ranges. This owned loopback origin supplies the original MP3 with that HTTP
// transport contract; every app route still comes from the production build.
export async function startNativeAudioQaOrigin(upstreamOrigin, { mode = () => "ready" } = {}) {
  assert.ok(["127.0.0.1", "localhost"].includes(upstreamOrigin.hostname));
  const body = await readFile(new URL(`../public${song.path}`, import.meta.url));
  assert.equal(body.length, song.bytes);
  assert.equal(`sha256-${createHash("sha256").update(body).digest("hex")}`, song.hash);
  let heldRequests = 0;
  const held = [];
  const server = createServer((request, response) => {
    if (new URL(request.url, upstreamOrigin).pathname.endsWith(song.path)) {
      const serve = () => serveNativeAudioQaBytes(request, response, body);
      if (mode() === "fail") { response.writeHead(503, { "content-type": "text/plain" }); response.end("expected media failure fixture"); return; }
      if (mode() === "hold") { heldRequests++; held.push(serve); return; }
      serve(); return;
    }
    const upstream = httpRequest(new URL(request.url, upstreamOrigin), { method: request.method, headers: { ...request.headers, host: upstreamOrigin.host } }, incoming => {
      response.writeHead(incoming.statusCode, incoming.headers); incoming.pipe(response);
    });
    upstream.on("error", () => { if (!response.headersSent) response.writeHead(502); response.end(); });
    response.on("close", () => upstream.destroy());
    if (["GET", "HEAD"].includes(request.method)) upstream.end(); else request.pipe(upstream);
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  return { origin: new URL(`http://127.0.0.1:${server.address().port}/`), song,
    heldRequests: () => heldRequests,
    release: () => { for (const serve of held.splice(0)) serve(); },
    close: async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } };
}
