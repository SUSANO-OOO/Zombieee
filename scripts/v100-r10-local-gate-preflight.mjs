import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const SNAPSHOT_PATH = path.resolve("outputs/v100-r10-local-gate/draft-snapshot.json");
const R10_PACKET_HEAD = "3f4190eb0fa89eef59141692e338ff3a9c81b40b";
const EXPECTED_DIRTY = Object.freeze([
  " M .gitattributes",
  " M scripts/run-v099-hud-states-bounded.mjs",
  " M scripts/v100-phase-g-production-matrix.mjs",
  " M tests/ci-contract.test.mjs",
  " M tests/v099-hud-states-bounded.test.mjs",
  " M tests/v100-phase-g-checkpoint.test.mjs",
].sort());
const HASH_PATHS = Object.freeze([
  ".gitattributes",
  "scripts/run-v099-hud-states-bounded.mjs",
  "scripts/v100-phase-g-production-matrix.mjs",
  "tests/ci-contract.test.mjs",
  "tests/v099-hud-states-bounded.test.mjs",
  "tests/v100-phase-g-checkpoint.test.mjs",
  "package.json",
  "package-lock.json",
]);
const EXPECTED_PACKAGE_HASHES = Object.freeze({
  "package.json": "45144b0bf6813d6b6cc47a79861217fc8fb73c744afbc2731f13bd7f2b6716f6",
  "package-lock.json": "c3167d50451b0887271cf0b06280b6fb1393a497c20229ccc865331e0ee9fcd6",
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function command(commandName, args) {
  return execFileSync(commandName, args, { encoding: "utf8" }).trim();
}

function nodeMeetsRepositoryMinimum() {
  const [major, minor] = process.versions.node.split(".").map(Number);
  return major > 22 || (major === 22 && minor >= 13);
}

async function sha256(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function collectState() {
  const status = execFileSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], { encoding: "utf8" })
    .split(/\r?\n/u)
    .filter(Boolean)
    .sort();
  assert(JSON.stringify(status) === JSON.stringify(EXPECTED_DIRTY), `dirty-path contract mismatch: ${JSON.stringify(status)}`);
  const hashes = {};
  for (const filePath of HASH_PATHS) hashes[filePath] = await sha256(filePath);
  for (const [filePath, expected] of Object.entries(EXPECTED_PACKAGE_HASHES)) {
    assert(hashes[filePath] === expected, `${filePath} hash mismatch: ${hashes[filePath]}`);
  }
  return { head: command("git", ["rev-parse", "HEAD"]), status, hashes };
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function snapshot() {
  const state = await collectState();
  await mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
  await writeFile(SNAPSHOT_PATH, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ status: "V100_R10_DRAFT_SNAPSHOT_OK", snapshotPath: SNAPSHOT_PATH, head: state.head }));
}

async function verifySnapshot() {
  const [before, after] = await Promise.all([readJson(SNAPSHOT_PATH), collectState()]);
  assert(JSON.stringify(after) === JSON.stringify(before), "HEAD, dirty paths, or tracked bytes changed after the r10 snapshot");
  return after;
}

function isAncestor(base, head) {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", base, head], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

async function verifyR11Resume() {
  const [before, after] = await Promise.all([readJson(SNAPSHOT_PATH), collectState()]);
  assert(before.head === R10_PACKET_HEAD, `r10 snapshot head mismatch: ${before.head}`);
  assert(isAncestor(before.head, after.head), `current HEAD ${after.head} does not descend from the proven r10 packet`);
  assert(JSON.stringify(after.status) === JSON.stringify(before.status), "six-path dirty status changed after the proven r10 gate");
  assert(JSON.stringify(after.hashes) === JSON.stringify(before.hashes), "package, lockfile, or six-path bytes changed after the proven r10 gate");
  return after;
}

async function runtimePreflight({ verify = verifySnapshot, status = "V100_R10_LOCAL_GATE_PREFLIGHT_OK" } = {}) {
  const state = await verify();
  assert(nodeMeetsRepositoryMinimum(), `Node ${process.version} is below the repository minimum 22.13.0`);
  assert(process.env.PLAYWRIGHT_BROWSERS_PATH === "0", "PLAYWRIGHT_BROWSERS_PATH must be exactly 0");

  const [{ chromium, webkit }, { default: sharp }, packageJson, packageLock, installedPlaywright, installedSharp] = await Promise.all([
    import("playwright"),
    import("sharp"),
    readJson("package.json"),
    readJson("package-lock.json"),
    readJson("node_modules/playwright/package.json"),
    readJson("node_modules/sharp/package.json"),
  ]);

  assert(packageLock.lockfileVersion === 3, "package-lock.json lockfileVersion must remain 3");
  assert(installedPlaywright.version === packageJson.devDependencies.playwright, "installed Playwright does not match package.json");
  assert(installedPlaywright.version === packageLock.packages["node_modules/playwright"].version, "installed Playwright does not match package-lock.json");
  assert(installedSharp.version === packageLock.packages["node_modules/sharp"].version, "installed sharp does not match package-lock.json");

  const png = await sharp({
    create: { width: 1, height: 1, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).png().toBuffer();
  assert(png.length > 0, "sharp native pipeline returned no bytes");

  const localBrowserRoot = path.resolve("node_modules/playwright-core/.local-browsers");
  const launches = [];
  for (const [name, browserType] of [["chromium", chromium], ["webkit", webkit]]) {
    const executable = path.resolve(browserType.executablePath());
    assert(executable.startsWith(`${localBrowserRoot}${path.sep}`), `${name} is not using the worktree-local browser runtime`);
    assert(existsSync(executable), `${name} executable is missing: ${executable}`);
    const browser = await browserType.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.setContent("<title>v100-r10-preflight</title><main>ok</main>");
      assert(await page.title() === "v100-r10-preflight", `${name} page probe failed`);
    } finally {
      await browser.close();
    }
    launches.push({ name, executable });
  }

  await verify();
  console.log(JSON.stringify({
    status,
    head: state.head,
    node: process.version,
    playwright: installedPlaywright.version,
    sharp: installedSharp.version,
    sharpProbeBytes: png.length,
    launches,
  }));
}

const mode = process.argv[2];
if (mode === "snapshot") await snapshot();
else if (mode === "runtime") await runtimePreflight();
else if (mode === "resume") await runtimePreflight({
  verify: verifyR11Resume,
  status: "V100_R11_RUNTIME_RETURN_PREFLIGHT_OK",
});
else if (mode === "verify") {
  const state = await verifySnapshot();
  console.log(JSON.stringify({ status: "V100_R10_DRAFT_VERIFY_OK", head: state.head }));
} else {
  throw new Error("Usage: node scripts/v100-r10-local-gate-preflight.mjs <snapshot|runtime|resume|verify>");
}
