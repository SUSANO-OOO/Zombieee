import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function assertEphemeralPerformanceHost(env, platform, arch) {
  assert.equal(platform, "darwin", "Spotlight control requires macOS");
  assert.equal(arch, "arm64", "the authoritative performance host must remain Apple Silicon");
  for (const [key, value] of Object.entries({ GITHUB_ACTIONS: "true", RUNNER_ENVIRONMENT: "github-hosted", RUNNER_OS: "macOS", GITHUB_REPOSITORY: "SUSANO-OOO/Zombieee", GITHUB_EVENT_NAME: "pull_request", GITHUB_JOB: "v100-webkit-frame-control" })) {
    assert.equal(env[key], value, `Spotlight control forbidden outside the ephemeral performance job: ${key}`);
  }
  assert.match(env.GITHUB_RUN_ID ?? "", /^\d+$/u);
  assert.match(env.GITHUB_SHA ?? "", /^[a-f0-9]{40}$/u);
}

export function parseIndexingStatus(output) {
  const volumes = [];
  let mount = null;
  for (const raw of output.split(/\r?\n/u)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("/") && line.endsWith(":")) { assert.equal(mount, null, "mdutil volume has no status before the next header"); mount = line.slice(0, -1); continue; }
    assert.ok(mount, "mdutil status did not identify its volume");
    assert.ok(["Indexing enabled.", "Indexing disabled.", "Spotlight server is disabled."].includes(line), `Unrecognized mdutil status for ${mount}`);
    volumes.push({ mount, enabled: line === "Indexing enabled.", status: line });
    mount = null;
  }
  assert.equal(mount, null, "mdutil volume has no status");
  assert.ok(volumes.length > 0, "mdutil returned no volumes");
  assert.equal(new Set(volumes.map(v => v.mount)).size, volumes.length, "mdutil repeated a volume");
  return volumes;
}

export function restoreEnabledVolumes(volumes, restore) {
  const attempts = [], errors = [];
  for (const volume of volumes.filter(v => v.enabled)) {
    try { restore(volume.mount); attempts.push({ mount: volume.mount, ok: true }); }
    catch (error) { errors.push(error); attempts.push({ mount: volume.mount, ok: false, code: error.code ?? null, status: error.status ?? null }); }
  }
  return { attempts, errors };
}

export function validateBenchmarkPreparationRecord(record, env, platform, arch) {
  assertEphemeralPerformanceHost(env, platform, arch);
  assert.equal(record.run, env.GITHUB_RUN_ID); assert.equal(record.head, env.GITHUB_SHA);
  assert.equal(record.purpose, "benchmark-preparation"); assert.equal(record.state, "paused");
  assert.equal(record.diagnosticOnly, false);
  assert.equal(record.acceptanceOverride, false);
  assert.equal(record.basis.run, 36944517519);
  assert.equal(record.basis.primaryDigest, "fa3a2bf9a5c3ece6ddc63bcaf77c0c03308c7b6d7b6e37bb4699539c6c20f83b");
  assert.equal(record.basis.controlDigest, "41e03d4975a2504984a5f1b98804a3c4aed248186e3f67a0c5bfeeccfcca5b94");
  assert.ok(Array.isArray(record.before) && record.before.length > 0);
  assert.ok(Array.isArray(record.after) && record.after.length > 0);
  for (const volumes of [record.before, record.after]) {
    assert.equal(new Set(volumes.map(v => v.mount)).size, volumes.length);
    assert.ok(volumes.every(v => typeof v.mount === "string" && v.mount.startsWith("/") && typeof v.enabled === "boolean"));
  }
  assert.deepEqual(record.after.map(v => v.mount).sort(), record.before.map(v => v.mount).sort());
  assert.ok(record.after.every(v => !v.enabled), "benchmark preparation left indexing enabled");
  assert.ok(Number.isFinite(Date.parse(record.pausedAt)));
  return record;
}

async function main(mode) {
  assert.ok(["pause", "restore", "prepare-benchmark", "restore-benchmark"].includes(mode), "Usage: v100-macos-indexing-control.mjs pause|restore|prepare-benchmark|restore-benchmark");
  assertEphemeralPerformanceHost(process.env, process.platform, process.arch);
  const workspace = await realpath(process.env.GITHUB_WORKSPACE);
  assert.equal(await realpath(process.cwd()), workspace, "owned checkout required");
  const directory = path.join(workspace, "outputs", "v100-device-runtime");
  const benchmark = mode.endsWith("benchmark");
  const recordPath = path.join(directory, benchmark ? "spotlight-benchmark-preparation.json" : "spotlight-indexing-control.json");
  const options = { encoding: "utf8", timeout: 30_000, maxBuffer: 64 * 1024, env: { ...process.env, LC_ALL: "C" } };
  const status = () => parseIndexingStatus(execFileSync("/usr/bin/mdutil", ["-a", "-s"], options));
  if (mode === "pause" || mode === "prepare-benchmark") {
    await mkdir(directory, { recursive: true });
    const before = status();
    // Preserve the original status before mutation so an always-run step can restore it.
    const record = { run: process.env.GITHUB_RUN_ID, head: process.env.GITHUB_SHA,
      purpose: benchmark ? "benchmark-preparation" : "causal-diagnostic", diagnosticOnly: !benchmark, acceptanceOverride: false,
      ...(benchmark ? { basis: { run: 36944517519, primaryDigest: "fa3a2bf9a5c3ece6ddc63bcaf77c0c03308c7b6d7b6e37bb4699539c6c20f83b", controlDigest: "41e03d4975a2504984a5f1b98804a3c4aed248186e3f67a0c5bfeeccfcca5b94" } } : {}),
      before, attemptedAt: new Date().toISOString(), state: "pause-attempted" };
    await writeFile(recordPath, JSON.stringify(record, null, 2) + "\n", { flag: "wx" });
    execFileSync("/usr/bin/sudo", ["-n", "/usr/bin/mdutil", "-a", "-i", "off"], options);
    const after = status();
    assert.deepEqual(after.map(v => v.mount).sort(), before.map(v => v.mount).sort());
    assert.ok(after.every(v => !v.enabled), "indexing remained enabled");
    Object.assign(record, { after, pausedAt: new Date().toISOString(), state: "paused" });
    await writeFile(recordPath, JSON.stringify(record, null, 2) + "\n");
    console.log(JSON.stringify({ mode, state: record.state, originallyEnabled: before.filter(v => v.enabled).length, volumes: after.length }));
  } else {
    const record = JSON.parse(await readFile(recordPath, "utf8"));
    assert.equal(record.run, process.env.GITHUB_RUN_ID); assert.equal(record.head, process.env.GITHUB_SHA);
    assert.equal(record.purpose, benchmark ? "benchmark-preparation" : "causal-diagnostic");
    Object.assign(record, { restorationStartedAt: new Date().toISOString(), state: "restoration-attempted" });
    await writeFile(recordPath, JSON.stringify(record, null, 2) + "\n");
    const { attempts, errors } = restoreEnabledVolumes(record.before, mount => execFileSync("/usr/bin/sudo", ["-n", "/usr/bin/mdutil", "-i", "on", mount], options));
    let restored = null;
    try {
      restored = status();
      assert.deepEqual(restored.map(v => ({ mount: v.mount, enabled: v.enabled })).sort((a,b) => a.mount.localeCompare(b.mount)), record.before.map(v => ({ mount: v.mount, enabled: v.enabled })).sort((a,b) => a.mount.localeCompare(b.mount)));
    } catch (error) { errors.push(error); record.restorationVerificationError = { code: error.code ?? null, status: error.status ?? null }; }
    Object.assign(record, { restoreAttempts: attempts, restored, restoredAt: new Date().toISOString(), state: errors.length ? "restoration-incomplete" : "restored" });
    await writeFile(recordPath, JSON.stringify(record, null, 2) + "\n");
    console.log(JSON.stringify({ mode, state: record.state, volumes: restored?.length ?? null }));
    if (errors.length) throw new AggregateError(errors, "Not all original Spotlight states were restored; all enabled volumes were attempted and results saved");
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) await main(process.argv[2]);
