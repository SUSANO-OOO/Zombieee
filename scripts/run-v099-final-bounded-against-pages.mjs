import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";

const siteRoot = path.resolve(process.argv[2] ?? "_site");
const expectedVersion = process.env.V099_PAGES_EXPECTED_VERSION?.trim();
const expectedReleaseSha = process.env.V099_PAGES_EXPECTED_RELEASE_SHA?.trim();
if (!expectedVersion || !expectedReleaseSha) {
  throw new Error("V099_PAGES_EXPECTED_VERSION and V099_PAGES_EXPECTED_RELEASE_SHA are required");
}

const index = await readFile(path.join(siteRoot, "index.html"), "utf8");
const manifest = JSON.parse(await readFile(path.join(siteRoot, "asset-manifest.json"), "utf8"));
for (const [name, expected, pattern] of [
  ["version", expectedVersion, /<meta name="github-pages-version" content="([^"]+)"/u],
  ["release SHA", expectedReleaseSha, /<meta name="github-pages-release" content="([^"]+)"/u],
  ["base path", "/Zombieee/", /<meta name="github-pages-base" content="([^"]+)"/u],
]) {
  const actual = index.match(pattern)?.[1];
  if (actual !== expected) throw new Error(`Pages ${name} mismatch: expected ${expected}, got ${actual ?? "missing"}`);
}
if (manifest.version !== expectedVersion || manifest.releaseSha !== expectedReleaseSha) {
  throw new Error(`Pages manifest identity mismatch: ${manifest.version}/${manifest.releaseSha}`);
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
const baseUrl = `http://127.0.0.1:${port}/Zombieee/`;
const server = spawn(process.execPath, ["scripts/serve-pages-candidate.mjs", siteRoot], {
  cwd: process.cwd(),
  env: { ...process.env, PAGES_CANDIDATE_BASE: "/Zombieee", PAGES_CANDIDATE_PORT: String(port) },
  stdio: ["ignore", "inherit", "inherit"],
  windowsHide: true,
});

try {
  const deadline = Date.now() + 30_000;
  let ready = false;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Pages candidate server exited with ${server.exitCode}`);
    try {
      const response = await fetch(baseUrl, { cache: "no-store" });
      if (response.ok) { ready = true; break; }
    } catch {
      // The bounded local server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error(`Pages candidate server did not become ready at ${baseUrl}`);
  const child = spawn(process.execPath, ["scripts/run-v099-final-bounded.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, V099_FINAL_REMEDIATION_QA_BASE_URL: baseUrl },
    stdio: "inherit",
    windowsHide: true,
  });
  const [code, signal] = await once(child, "exit");
  if (code !== 0) throw new Error(`Pages-backed HUD QA exited with ${code ?? signal}`);
} finally {
  if (server.exitCode === null) server.kill();
  await Promise.race([once(server, "exit"), new Promise((resolve) => setTimeout(resolve, 3_000))]);
  if (server.exitCode === null) server.kill("SIGKILL");
}

console.log(JSON.stringify({ status: "passed", siteRoot, baseUrl, expectedVersion, expectedReleaseSha }, null, 2));
