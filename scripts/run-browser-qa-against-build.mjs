import { once } from "node:events";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";

const target = process.argv[2];
const buildRoot = path.resolve(process.argv[3] ?? ".");
if (!target || process.argv.length < 4) {
  throw new Error("Usage: node scripts/run-browser-qa-against-build.mjs <qa-script> <build-root>");
}

const port = await new Promise((resolve, reject) => {
  const reservation = createServer();
  reservation.once("error", reject);
  reservation.listen({ host: "127.0.0.1", port: 0, exclusive: true }, () => {
    const address = reservation.address();
    const value = typeof address === "object" && address ? address.port : null;
    reservation.close((error) => error ? reject(error) : resolve(value));
  });
});
const origin = `http://127.0.0.1:${port}/`;
process.env.P5_QA_BASE_URL = origin;
const server = spawn(process.execPath, [
  "scripts/run-vinext.mjs", "start", "--host", "127.0.0.1", "--port", String(port),
], { cwd: buildRoot, env: process.env, stdio: ["ignore", "inherit", "inherit"] });

try {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`QA server exited with ${server.exitCode}`);
    try {
      const response = await fetch(origin);
      if (response.ok) break;
    } catch {
      // The exact-root production server is starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (Date.now() >= deadline) throw new Error(`QA server did not become ready at ${origin}`);
  await import(pathToFileURL(path.resolve(target)).href);
} finally {
  if (server.exitCode === null) server.kill();
  await Promise.race([once(server, "exit"), new Promise((resolve) => setTimeout(resolve, 3_000))]);
  if (server.exitCode === null) server.kill("SIGKILL");
}
