import { once } from "node:events";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";

const target = process.argv[2];
if (!target) throw new Error("Usage: node scripts/run-browser-qa-with-server.mjs <qa-script>");

async function reserveQaPort(requestedPort) {
  return new Promise((resolve, reject) => {
    const reservation = createServer();
    reservation.unref();
    reservation.once("error", (error) => {
      reject(new Error(
        requestedPort
          ? `LOCAL_QA_PORT ${requestedPort} is unavailable; refusing to reuse an unknown server`
          : `Could not reserve an isolated QA port: ${String(error)}`,
      ));
    });
    reservation.listen({ host: "127.0.0.1", port: requestedPort || 0, exclusive: true }, () => {
      const address = reservation.address();
      const port = typeof address === "object" && address ? address.port : null;
      reservation.close((error) => {
        if (error) reject(error);
        else resolve(String(port));
      });
    });
  });
}

const requestedPort = Number(process.env.LOCAL_QA_PORT) || 0;
const port = await reserveQaPort(requestedPort);
const origin = `http://127.0.0.1:${port}/`;
process.env.COMBAT_PRESENTATION_QA_BASE_URL = origin;
process.env.MOBILE_LIFECYCLE_QA_BASE_URL = origin;
process.env.SAVE_MIGRATION_QA_BASE_URL = origin;
process.env.BATTLE_SPACE_QA_BASE_URL = origin;
process.env.AI_MISSION_QA_BASE_URL = origin;
process.env.STATION_QA_BASE_URL = origin;
process.env.P5_QA_BASE_URL = origin;
process.env.PROGRESSION_QA_BASE_URL = origin;
const server = spawn(process.execPath, [
  "scripts/run-vinext.mjs",
  "start",
  "--host",
  "127.0.0.1",
  "--port",
  port,
], {
  cwd: process.cwd(),
  env: process.env,
  stdio: ["ignore", "inherit", "inherit"],
});

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`QA server exited with ${server.exitCode}`);
    try {
      const response = await fetch(origin);
      if (response.ok) {
        if (server.exitCode !== null) throw new Error(`QA server exited with ${server.exitCode}`);
        return;
      }
    } catch {
      // The production server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`QA server did not become ready at ${origin}`);
}

try {
  await waitForServer();
  await import(pathToFileURL(path.resolve(target)).href);
} finally {
  if (server.exitCode === null) server.kill();
  await Promise.race([
    once(server, "exit"),
    new Promise((resolve) => setTimeout(resolve, 3_000)),
  ]);
  if (server.exitCode === null) server.kill("SIGKILL");
}
