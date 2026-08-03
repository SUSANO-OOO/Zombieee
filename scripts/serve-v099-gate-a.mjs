import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(process.argv[2] ?? process.env.V099_GATE_A_DIR
  ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "outputs", "v099-gate-a"));
const host = "127.0.0.1";
const port = Math.max(1024, Number(process.argv[3] ?? process.env.V099_GATE_A_PORT) || 4179);
const mime = new Map([
  [".html", "text/html; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".mp3", "audio/mpeg"],
  [".ogg", "audio/ogg"],
  [".wav", "audio/wav"],
]);

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${host}:${port}`);
    const relative = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname).replace(/^\/+/, "");
    const file = path.resolve(root, relative);
    if (file !== root && !file.startsWith(`${root}${path.sep}`)) throw new Error("path outside candidate root");
    const fileStat = await stat(file);
    if (!fileStat.isFile()) throw new Error("not a file");
    const range = request.headers.range?.match(/^bytes=(\d+)-(\d*)$/u);
    const start = range ? Number(range[1]) : 0;
    const requestedEnd = range?.[2] ? Number(range[2]) : fileStat.size - 1;
    const end = Math.min(fileStat.size - 1, requestedEnd);
    if (range && (!Number.isInteger(start) || start < 0 || start > end)) {
      response.writeHead(416, { "content-range": `bytes */${fileStat.size}` });
      response.end();
      return;
    }
    response.writeHead(range ? 206 : 200, {
      "content-type": mime.get(path.extname(file).toLowerCase()) ?? "application/octet-stream",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "accept-ranges": "bytes",
      "content-length": String(range ? end - start + 1 : fileStat.size),
      ...(range ? { "content-range": `bytes ${start}-${end}/${fileStat.size}` } : {}),
    });
    createReadStream(file, range ? { start, end } : undefined).pipe(response);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
    response.end("Gate A candidate file not found");
  }
});

server.listen(port, host, () => {
  console.log(JSON.stringify({ status: "listening", url: `http://${host}:${port}/`, root, pid: process.pid }));
});
