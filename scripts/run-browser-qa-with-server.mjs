import { once } from "node:events";
import { spawn } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

const target = process.argv[2];
if (!target) throw new Error("Usage: node scripts/run-browser-qa-with-server.mjs <qa-script>");

function parseRequestedQaPort(rawValue) {
  if (rawValue === undefined) return 0;
  if (!/^\d+$/u.test(rawValue)) throw new Error(`LOCAL_QA_PORT must be an integer from 0 through 65535; received ${JSON.stringify(rawValue)}`);
  const port = Number(rawValue);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error(`LOCAL_QA_PORT must be an integer from 0 through 65535; received ${JSON.stringify(rawValue)}`);
  }
  return port;
}

function parseVinextReadyLine(line) {
  const match = /^\[vinext\] Production server running at http:\/\/([^:/\s]+):(\d+)$/u.exec(line.trim());
  if (!match) {
    if (line.includes("[vinext] Production server running at ")) throw new Error(`Vinext reported an invalid readiness URL: ${line}`);
    return null;
  }
  const port = Number(match[2]);
  if (match[1] !== "127.0.0.1" || !Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Vinext reported an invalid owned listener: ${line}`);
  }
  return `http://127.0.0.1:${port}/`;
}

function createVinextReadyLineParser({ onReady, onError }) {
  let remainder = "";
  return (chunk) => {
    const text = remainder + chunk.toString();
    const lines = text.split(/\r?\n/u);
    remainder = lines.pop() ?? "";
    if (remainder.length > 65_536) {
      onError(new Error("QA server readiness output exceeded bounded buffer"));
      return;
    }
    for (const line of lines) {
      try {
        const origin = parseVinextReadyLine(line);
        if (origin) onReady(origin);
      } catch (error) {
        onError(error);
      }
    }
  };
}

const requestedPort = parseRequestedQaPort(process.env.LOCAL_QA_PORT);
const server = spawn(process.execPath, [
  "scripts/run-vinext.mjs",
  "start",
  "--hostname",
  "127.0.0.1",
  "--port",
  String(requestedPort),
], {
  cwd: process.cwd(),
  env: process.env,
  stdio: ["ignore", "pipe", "inherit"],
});

const serverReady = new Promise((resolve, reject) => {
  let settled = false;
  const settle = (callback, value) => {
    if (settled) return;
    settled = true;
    callback(value);
  };
  server.once("error", (error) => settle(reject, error));
  server.once("exit", (code, signal) => {
    if (code !== null || signal !== null) settle(reject, new Error(`QA server exited before readiness (code=${code}, signal=${signal})`));
  });
  const consumeReadyChunk = createVinextReadyLineParser({
    onReady: (origin) => settle(resolve, origin),
    onError: (error) => settle(reject, error),
  });
  server.stdout.on("data", (chunk) => {
    process.stdout.write(chunk);
    consumeReadyChunk(chunk);
  });
});

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  let readinessTimer;
  let origin;
  try {
    origin = await Promise.race([
      serverReady,
      new Promise((_, reject) => { readinessTimer = setTimeout(() => reject(new Error("QA server did not report readiness within 30 seconds")), 30_000); }),
    ]);
  } finally {
    clearTimeout(readinessTimer);
  }
  while (Date.now() < deadline) {
    if (server.exitCode !== null || server.signalCode !== null) {
      throw new Error(`QA server exited before readiness (code=${server.exitCode}, signal=${server.signalCode})`);
    }
    const actualPort = Number(new URL(origin).port);
    if (requestedPort > 0 && actualPort !== requestedPort) {
      throw new Error(`QA server reported port ${actualPort}, expected explicit LOCAL_QA_PORT ${requestedPort}`);
    }
    try {
      const response = await fetch(origin, { signal: AbortSignal.timeout(Math.max(1, deadline - Date.now())) });
      if (response.ok) {
        if (server.exitCode !== null || server.signalCode !== null) {
          throw new Error(`QA server exited after readiness (code=${server.exitCode}, signal=${server.signalCode})`);
        }
        return origin;
      }
    } catch {
      // The owned production server is still starting its request handler.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`QA server did not become ready at ${origin}`);
}

function applyQaOrigin(origin) {
process.env.COMBAT_PRESENTATION_QA_BASE_URL = origin;
process.env.V099_PRESENTATION_QA_BASE_URL = origin;
process.env.MOBILE_LIFECYCLE_QA_BASE_URL = origin;
process.env.SAVE_MIGRATION_QA_BASE_URL = origin;
process.env.BATTLE_SPACE_QA_BASE_URL = origin;
process.env.AI_MISSION_QA_BASE_URL = origin;
process.env.CRAWLER_DEFENSE_QA_BASE_URL = origin;
process.env.V095_VISUAL_BASELINE_QA_BASE_URL = origin;
process.env.V095_ANIMATION_FOUNDATION_QA_BASE_URL = origin;
process.env.V095_REPRESENTATIVE_SIX_QA_BASE_URL = origin;
process.env.V095_ENEMY_VFX_QA_BASE_URL = origin;
process.env.V095_RESIDUAL_BUGS_QA_BASE_URL = origin;
process.env.V095_ROUTE_CART_QA_BASE_URL = origin;
process.env.V095_EMPLOYMENT_QA_BASE_URL = origin;
process.env.V0951_HOTFIX_QA_BASE_URL = origin;
process.env.V0952_HOTFIX_QA_BASE_URL = origin;
process.env.V096_PWA_QA_BASE_URL = origin;
process.env.PWA_REGISTRATION_FALLBACK_BASE_URL = origin;
process.env.STATION_QA_BASE_URL = origin;
process.env.P5_QA_BASE_URL = origin;
process.env.PROGRESSION_QA_BASE_URL = origin;
process.env.SAVE_BOUNDARY_QA_BASE_URL = origin;
process.env.SURVIVAL_QA_BASE_URL = origin;
process.env.EQUIPMENT_RUNTIME_QA_BASE_URL = origin;
process.env.BOSS_QA_BASE_URL = origin;
process.env.ASSET_DECODE_QA_BASE_URL = origin;
process.env.ZAKIMIYA_QA_BASE_URL = origin;
process.env.NEW_PLAYABLE_HUMANS_QA_BASE_URL = origin;
process.env.MAYO_QA_BASE_URL = origin;
process.env.OUTBREAK_QA_BASE_URL = origin;
process.env.RECORDS_QA_BASE_URL = origin;
process.env.MANUAL_ABILITIES_QA_BASE_URL = origin;
process.env.PWA_TRANSPORT_QA_BASE_URL = origin;
process.env.V099_ICON_QA_BASE_URL = origin;
process.env.ISSUE156_REMEDIATION_QA_BASE_URL = origin;
process.env.V0995_VISUAL_QA_BASE_URL = origin;
process.env.V0995_ENEMY_QA_BASE_URL = origin;
process.env.V100_CAMPAIGN_QA_BASE_URL = origin;
}
try {
  const origin = await waitForServer();
  applyQaOrigin(origin);
  await import(pathToFileURL(path.resolve(target)).href);
} finally {
  if (server.exitCode === null) server.kill();
  await Promise.race([
    once(server, "exit"),
    new Promise((resolve) => setTimeout(resolve, 3_000)),
  ]);
  if (server.exitCode === null) server.kill("SIGKILL");
}
