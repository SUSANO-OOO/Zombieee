import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { createWriteStream } from "node:fs";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseWebKitHostProcStat, createWebKitHostResourceTelemetry } from "../webkit-host-resource-telemetry.mjs";

export const SOURCE_HEAD = "0f6dbad8f8aac90e3b50cdaa2bd233a76d7c173f";
export const WEBKIT_LIBRARY_SHA256 = "daa10258a2161710c7c1d6a3e3f7abe0a100a6f269c00f5843dcd0f7df46ec29";
export const DIAGNOSTIC_PATHS = Object.freeze([
  ".github/workflows/v100-native-diagnostic.yml",
  "scripts/native-diagnostic/observe.mjs",
  "scripts/native-diagnostic/webprocess.gdb",
  "tests/native-diagnostic/native-diagnostic.test.mjs",
]);

export function diagnosticCase(lane, output) {
  const base = { DEBUG: "pw:browser" };
  if (lane === "enemy") return {
    script: "scripts/v0995-enemy-runtime-browser-smoke.mjs",
    env: { ...base, V0995_ENEMY_QA_ENGINES: "webkit", V0995_ENEMY_QA_VIEWPORTS: "844x340",
      V0995_ENEMY_QA_KINDS: "red-panther-smg", V0995_ENEMY_QA_EVIDENCE_DIR: path.join(output, "enemy"),
      V0995_ENEMY_QA_COMPACT_DIR: path.join(output, "enemy-compact") },
  };
  if (lane === "deployment") return {
    script: "scripts/v099-final-remediation-browser-smoke.mjs",
    env: { ...base, V099_FINAL_REMEDIATION_QA_ENGINES: "webkit",
      V099_FINAL_REMEDIATION_QA_VIEWPORTS: "667x375", V099_FINAL_REMEDIATION_QA_CASES: "deployment",
      V099_FINAL_REMEDIATION_QA_DEPLOYMENT_UNITS: "kumaverson",
      V099_FINAL_REMEDIATION_QA_EVIDENCE_DIR: path.join(output, "deployment"),
      V099_FINAL_REMEDIATION_QA_TIMEOUT_MS: "60000" },
  };
  if (lane === "phase-g") return {
    script: "scripts/v100-phase-g-production-matrix.mjs",
    env: { ...base, V100_PHASE_G_ONLY: "battle-extra", V100_PHASE_G_ONLY_ENGINE: "webkit",
      V100_PHASE_G_SEQUENCE_ID: "native-diagnostic-ordered-1",
      V100_PHASE_G_EVIDENCE_DIR: path.join(output, "phase-g") },
  };
  throw new Error(`unsupported diagnostic lane: ${lane}`);
}

export function coreStatus(source) {
  const fields = Object.fromEntries(String(source).split(/\r?\n/u).map((line) => {
    const index = line.indexOf(":");
    return index < 0 ? ["", ""] : [line.slice(0, index), line.slice(index + 1).trim()];
  }));
  return { coreDumping: fields.CoreDumping === undefined ? null : Number(fields.CoreDumping),
    state: fields.State ?? null, threads: fields.Threads ?? null, sigPending: fields.SigPnd ?? null,
    sharedPending: fields.ShdPnd ?? null, nspid: fields.NSpid ?? null };
}

export function assertDiagnosticOnlyDiff(paths) {
  assert(paths.length > 0 && paths.every((entry) => DIAGNOSTIC_PATHS.includes(entry)),
    `diagnostic branch modified candidate bytes: ${JSON.stringify(paths)}`);
}

export function nativeRenderingIdentity(env, librarySha256) {
  assert.equal(env.WEBKIT_SKIA_ENABLE_CPU_RENDERING, "1", "CPU isolation setting missing; no browser started");
  assert.equal(librarySha256, WEBKIT_LIBRARY_SHA256, "fixed WebKit library mismatch; no browser started");
  for (const key of ["WEBKIT_SKIA_GPU_PAINTING_THREADS", "WEBKIT_SKIA_CPU_PAINTING_THREADS"]) {
    assert.equal(env[key], undefined, `unplanned rendering variable: ${key}`);
  }
  return { cpuRendering: "1", librarySha256, intervention: "native-skia-cpu-backend-only" };
}

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
async function descendants(root) {
  // PPid also finds children spawned by a non-main thread; never attach outside
  // this diagnostic command's descendant tree.
  const entries = await Promise.all((await readdir("/proc")).filter((name) => /^\d+$/u.test(name))
    .map(async (pid) => parseWebKitHostProcStat(await readFile(`/proc/${pid}/stat`, "utf8").catch(() => null))));
  const selected = new Set([root]);
  for (let changed = true; changed;) {
    changed = false;
    for (const entry of entries) {
      if (entry && selected.has(entry.ppid) && !selected.has(entry.pid)) {
        selected.add(entry.pid);
        changed = true;
      }
    }
  }
  return entries.filter((entry) => entry && selected.has(entry.pid));
}

async function preflight(output) {
  assert.equal(process.platform, "linux", "native diagnostic requires Linux; no browser started");
  const diff = execFileSync("git", ["diff", "--name-only", SOURCE_HEAD, "HEAD"], { encoding: "utf8" }).trim().split(/\r?\n/u);
  assertDiagnosticOnlyDiff(diff);
  assert.equal(execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], { encoding: "utf8" }).trim(), "",
    "diagnostic checkout has tracked modifications");
  const library = await readFile("/ms-playwright/webkit-2215/minibrowser-wpe/lib/libWPEWebKit-2.0.so.1.7.0");
  const rendering = nativeRenderingIdentity(process.env, createHash("sha256").update(library).digest("hex"));
  const caps = (await readFile("/proc/self/status", "utf8")).match(/^CapEff:\s*([a-f0-9]+)$/mu)?.[1];
  assert(caps && (BigInt(`0x${caps}`) & (1n << 19n)) !== 0n, "SYS_PTRACE diagnostic capability missing");
  const probe = spawn("/bin/sleep", ["2"], { stdio: "ignore" });
  try {
    const result = execFileSync("gdb", ["-q", "-batch", "-x",
      fileURLToPath(new URL("./webprocess.gdb", import.meta.url)), "-p", String(probe.pid)],
      { encoding: "utf8", timeout: 8000, stdio: ["ignore", "pipe", "pipe"] });
    assert.match(result, /NATIVE_DEBUGGER_ATTACHED/u, "native attach preflight failed");
    assert.match(result, /NATIVE_PROCESS_EXITED/u, "native debugger script did not complete benign preflight");
    await writeFile(path.join(output, "native-preflight.txt"), result);
  } finally { probe.kill("SIGTERM"); }
  return { sourceHead: SOURCE_HEAD, rendering,
    diagnosticHead: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    kernel: execFileSync("uname", ["-a"], { encoding: "utf8" }).trim(),
    corePattern: (await readFile("/proc/sys/kernel/core_pattern", "utf8")).trim(),
    gdb: execFileSync("gdb", ["--version"], { encoding: "utf8" }).split("\n")[0],
    debuggerInstrumented: true, acceptanceEligible: false };
}

async function main() {
  const lane = process.argv[2];
  const output = path.resolve("outputs/native-diagnostic", lane);
  const selected = diagnosticCase(lane, output);
  await mkdir(output, { recursive: true });
  const identity = await preflight(output);
  await writeFile(path.join(output, "identity.json"), JSON.stringify(identity, null, 2) + "\n");
  const telemetry = await createWebKitHostResourceTelemetry({ evidenceDir: output, label: "native-diagnostic",
    metadata: { diagnosticOnly: true, lane }, rootPid: process.pid });
  const debuggers = new Map();
  const monitorErrors = [];
  const log = createWriteStream(path.join(output, "original-runner.log"), { flags: "wx" });
  const child = spawn(process.execPath, ["scripts/run-browser-qa-with-server.mjs", selected.script],
    { env: { ...process.env, ...selected.env }, detached: true, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.pipe(log, { end: false });
  child.stderr.pipe(log, { end: false });
  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);
  const done = new Promise((resolve) => {
    child.once("error", (error) => resolve({ code: null, signal: null, error: String(error) }));
    child.once("close", (code, signal) => resolve({ code, signal }));
  });
  let finished = false;
  let outerDeadlineExceeded = false;
  const guard = setTimeout(() => {
    outerDeadlineExceeded = true;
    try { process.kill(-child.pid, "SIGTERM"); } catch { /* already ended */ }
  }, 12 * 60_000);
  const monitor = (async () => {
    while (!finished) {
      try {
        for (const entry of await descendants(child.pid)) {
          if (!/^WPEWeb|^WebKitWeb/u.test(entry.name)) continue;
          const key = `${entry.pid}-${entry.startTicks}`;
          const status = await readFile(`/proc/${entry.pid}/status`, "utf8").catch(() => "");
          await appendFile(path.join(output, "native-status.jsonl"), JSON.stringify({
            at: new Date().toISOString(), key, ...coreStatus(status),
          }) + "\n");
          if (debuggers.has(key)) continue;
          const prefix = path.join(output, key);
          const maps = await readFile(`/proc/${entry.pid}/maps`, "utf8").catch((error) => String(error));
          await writeFile(`${prefix}.maps.txt`, maps);
          const stream = createWriteStream(`${prefix}.gdb.txt`, { flags: "wx" });
          const debuggerProcess = spawn("gdb", ["-q", "-batch", "-x",
            fileURLToPath(new URL("./webprocess.gdb", import.meta.url)), "-p", String(entry.pid)],
          { stdio: ["ignore", "pipe", "pipe"] });
          debuggerProcess.stdout.pipe(stream, { end: false });
          debuggerProcess.stderr.pipe(stream, { end: false });
          const record = { pid: entry.pid, startTicks: entry.startTicks, process: debuggerProcess, completion: null };
          record.completion = new Promise((resolve) => {
            debuggerProcess.once("error", (error) => { stream.end(); resolve({ error: String(error) }); });
            debuggerProcess.once("close", (code, signal) => { stream.end(); resolve({ code, signal }); });
          });
          debuggers.set(key, record);
        }
      } catch (error) { monitorErrors.push(String(error)); }
      await sleep(500);
    }
  })();
  const result = await done;
  finished = true;
  clearTimeout(guard);
  await monitor;
  log.end();
  const debuggerResults = [];
  for (const [key, record] of debuggers) {
    const settled = await Promise.race([record.completion, sleep(3000).then(() => null)]);
    if (!settled) record.process.kill("SIGTERM");
    debuggerResults.push({ key, result: settled ?? { diagnosticCleanupTimeout: true } });
  }
  await telemetry.stop({ lane, result });
  await writeFile(path.join(output, "diagnostic-summary.json"), JSON.stringify({
    ...identity, lane, originalResult: result, outerDeadlineExceeded,
    debuggerResults, monitorErrors, acceptanceEligible: false,
  }, null, 2) + "\n");
  // A diagnostic process pass is never a machine-gate acceptance.
  process.exitCode = result.code === 0 && !outerDeadlineExceeded && monitorErrors.length === 0
    && debuggers.size > 0 ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
