// Diagnostic-only runtime comparison. Never imported by production or required CI.
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, readdir, readlink, stat, writeFile, copyFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";

export const SOURCE_HEAD = "0588b5a195137a41faa6b716d7b9c855e3f9cc0e";
export const SOURCE_TREE = "c259aac5d79b315583de8f090532d9dae0a872c2";
export const DIAGNOSTIC_PATHS = Object.freeze([
  ".github/workflows/v100-webkit-port-comparison.yml",
  "scripts/webkit-port-diagnostic.mjs",
  "tests/diagnostic-only/webkit-port-diagnostic.test.mjs",
]);
export function assertDiagnosticDiff(paths) {
  assert.deepEqual([...paths].sort(), [...DIAGNOSTIC_PATHS].sort(), "only the exact diagnostic files may differ");
}
export function assertPortSnapshot(s) {
  assert.equal(s.platform, "darwin");
  assert.equal(s.arch, "x64");
  assert.match(s.osVersion, /^15\./u);
  assert.equal(s.node, "v22.13.0");
  assert.equal(s.playwright, "1.56.1");
  assert.equal(s.revision, "2215");
  assert.equal(s.browserVersion, "26.0");
  assert.equal(s.sourceHead, SOURCE_HEAD);
  assert.equal(s.sourceTree, SOURCE_TREE);
  assert.equal(s.parentHead, SOURCE_HEAD);
  for (const key of ["WEBKIT_SKIA_ENABLE_CPU_RENDERING", "WEBKIT_SKIA_CPU_PAINTING_THREADS", "WEBKIT_SKIA_GPU_PAINTING_THREADS", "PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH", "PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD", "PLAYWRIGHT_HOST_PLATFORM_OVERRIDE"]) {
    assert.equal(s.env[key], undefined, `unplanned diagnostic override: ${key}`);
  }
}
export function diagnosticCases(lane, output) {
  const base = { DEBUG: "pw:browser" };
  if (lane === "phase-g") return [{
    label: "ordered-1", args: ["scripts/run-browser-qa-with-server.mjs", "scripts/v100-phase-g-production-matrix.mjs"],
    env: { ...base, V100_PHASE_G_ONLY: "battle-extra", V100_PHASE_G_ONLY_ENGINE: "webkit",
      V100_PHASE_G_SEQUENCE_ID: "macos-port-diagnostic-1", V100_PHASE_G_EVIDENCE_DIR: path.join(output, "ordered-1") },
  }];
  if (lane === "enemy") return [["red-panther-smg", "844x340"], ["takuya-omega", "844x390"]].map(([kind, viewport]) => ({
    label: `${kind}-${viewport}`, args: ["scripts/run-v0995-enemy-runtime-bounded.mjs"],
    env: { ...base, V0995_ENEMY_QA_ENGINES: "webkit", V0995_ENEMY_QA_KINDS: kind,
      V0995_ENEMY_QA_VIEWPORTS: viewport, V0995_ENEMY_QA_EVIDENCE_DIR: path.join(output, `${kind}-${viewport}`) },
  }));
  if (lane === "deployment") return [["kumaverson", "667x375"], ["brawler", "932x430"]].map(([unit, viewport]) => ({
    label: `${unit}-${viewport}`, args: ["scripts/run-browser-qa-with-server.mjs", "scripts/v099-final-remediation-browser-smoke.mjs"],
    env: { ...base, V099_FINAL_REMEDIATION_QA_ENGINES: "webkit", V099_FINAL_REMEDIATION_QA_CASES: "deployment",
      V099_FINAL_REMEDIATION_QA_DEPLOYMENT_UNITS: unit, V099_FINAL_REMEDIATION_QA_VIEWPORTS: viewport,
      V099_FINAL_REMEDIATION_QA_TIMEOUT_MS: "60000", V099_FINAL_REMEDIATION_QA_EVIDENCE_DIR: path.join(output, `${unit}-${viewport}`) },
  }));
  throw new Error(`unplanned diagnostic lane: ${lane}`);
}
export async function runFiniteCases(cases, execute) {
  const results = [];
  for (const entry of cases) {
    const result = await execute(entry);
    results.push({ label: entry.label, ...result, acceptanceEligible: false });
    if (result.code !== 0 || result.signal) break;
  }
  return results;
}
async function hashFile(file) {
  const hash = createHash("sha256");
  for await (const bytes of createReadStream(file)) hash.update(bytes);
  return hash.digest("hex");
}
async function installationIdentity(root, directory = root) {
  const rows = [];
  const entries = (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const file = path.join(directory, entry.name);
    const relative = path.relative(root, file).replaceAll("\\", "/");
    if (entry.isSymbolicLink()) rows.push({ path: relative, link: await readlink(file) });
    else if (entry.isDirectory()) rows.push(...await installationIdentity(root, file));
    else if (entry.isFile()) rows.push({ path: relative, bytes: (await stat(file)).size, sha256: await hashFile(file) });
  }
  return rows;
}
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
async function preflight(output) {
  const { webkit } = await import("playwright");
  const packagePath = import.meta.resolve("playwright-core/package.json");
  const packageData = JSON.parse(await readFile(new URL(packagePath), "utf8"));
  const registry = JSON.parse(await readFile(new URL("browsers.json", packagePath), "utf8"));
  const metadata = registry.browsers.find(b => b.name === "webkit");
  const snapshot = {
    platform: process.platform, arch: process.arch, node: process.version,
    osVersion: execFileSync("sw_vers", ["-productVersion"], { encoding: "utf8" }).trim(),
    playwright: packageData.version, revision: metadata.revision, browserVersion: metadata.browserVersion,
    sourceHead: SOURCE_HEAD, sourceTree: git("rev-parse", `${SOURCE_HEAD}^{tree}`), parentHead: git("rev-parse", "HEAD^"),
    env: process.env,
  };
  assertPortSnapshot(snapshot);
  assertDiagnosticDiff(git("diff", "--name-only", SOURCE_HEAD, "HEAD").split(/\r?\n/u));
  assert.equal(git("status", "--porcelain", "--untracked-files=no"), "", "tracked checkout changed");
  const executable = webkit.executablePath();
  assert.equal(path.basename(path.dirname(executable)), "webkit-2215");
  const files = await installationIdentity(path.dirname(executable));
  const receipt = { ...snapshot, env: undefined, executable, diagnosticHead: git("rev-parse", "HEAD"),
    diagnosticTree: git("rev-parse", "HEAD^{tree}"), runnerImage: process.env.ImageVersion ?? null,
    installationSha256: createHash("sha256").update(JSON.stringify(files)).digest("hex"), installationFiles: files,
    build: await productionBuildIdentity(), acceptanceEligible: false };
  await writeFile(path.join(output, "identity.json"), JSON.stringify(receipt, null, 2) + "\n");
  const browser = await webkit.launch();
  try {
    assert.equal(browser.version(), "26.0");
    const page = await browser.newPage();
    receipt.capabilities = await page.evaluate(() => ({ audioContext: typeof AudioContext, canvas: Boolean(document.createElement("canvas").getContext("2d")) }));
    assert.equal(receipt.capabilities.audioContext, "function");
    assert.equal(receipt.capabilities.canvas, true);
  } finally { await browser.close(); }
  await writeFile(path.join(output, "identity.json"), JSON.stringify(receipt, null, 2) + "\n");
  return receipt;
}
async function captureCrashReports(since, output) {
  const root = path.join(os.homedir(), "Library", "Logs", "DiagnosticReports");
  const receipts = [];
  for (const name of await readdir(root).catch(() => [])) {
    if (!/(?:WebKit|Playwright).*\.(?:ips|crash)$/iu.test(name)) continue;
    const file = path.join(root, name), info = await stat(file);
    if (!info.isFile() || info.mtimeMs < since) continue;
    const receipt = { name, bytes: info.size, modifiedAt: info.mtime.toISOString(), sha256: await hashFile(file), copied: false };
    if (info.size <= 4 * 1024 * 1024) {
      await copyFile(file, path.join(output, name));
      receipt.copied = true;
    }
    receipts.push(receipt);
  }
  return receipts;
}
async function executeCase(entry, output) {
  const log = createWriteStream(path.join(output, `${entry.label}.log`), { flags: "wx" });
  const child = spawn(process.execPath, entry.args, { env: { ...process.env, ...entry.env }, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false });
  child.stdout.pipe(process.stdout); child.stderr.pipe(process.stderr);
  const result = await new Promise(resolve => {
    child.once("error", e => resolve({ code: null, signal: null, error: String(e) }));
    child.once("close", (code, signal) => resolve({ code, signal }));
  });
  await new Promise(resolve => log.end(resolve));
  return result;
}
async function main() {
  const lane = process.argv[2], output = path.resolve("outputs/webkit-port-comparison", lane);
  const cases = diagnosticCases(lane, output), startedAt = Date.now();
  await mkdir(output, { recursive: true });
  const report = { lane, sourceHead: SOURCE_HEAD, acceptanceEligible: false, startedAt: new Date(startedAt).toISOString() };
  try {
    const identity = await preflight(output);
    report.installationSha256 = identity.installationSha256;
    report.results = await runFiniteCases(cases, entry => executeCase(entry, output));
    report.status = report.results.length === cases.length && report.results.every(r => r.code === 0 && !r.signal) ? "diagnostic-complete" : "diagnostic-failure";
  } catch (error) { report.error = String(error); report.status = "diagnostic-preflight-or-host-failure"; }
  try { report.crashReports = await captureCrashReports(startedAt, output); }
  catch (error) { report.crashReportReadError = String(error); }
  await writeFile(path.join(output, "diagnostic-summary.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report));
  process.exitCode = report.status === "diagnostic-complete" ? 0 : 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
