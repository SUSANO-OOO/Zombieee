import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import os from "node:os";
import { createReadStream, existsSync, realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium, webkit } from "playwright";

const require = createRequire(import.meta.url);

export const PLAYWRIGHT_CONTAINER_RUNTIME_CONTRACT = Object.freeze({
  schema: "v100-playwright-container-runtime/v1",
  image: "mcr.microsoft.com/playwright:v1.56.1-noble@sha256:f1e7e01021efd65dd1a2c56064be399f3e4de00fd021ac561325f2bfbb2b837a",
  packageVersion: "1.56.1",
  browsersPath: "/ms-playwright",
  engines: Object.freeze({
    chromium: Object.freeze({ revision: "1194", browserVersion: "141.0.7390.37" }),
    webkit: Object.freeze({ revision: "2215", browserVersion: "26.0" }),
  }),
});

const BROWSER_TYPES = Object.freeze({ chromium, webkit });

export const MAC_WEBKIT_FILES = Object.freeze({
  "JavaScriptCore.framework/Versions/A/JavaScriptCore": "2c0770f05fb92d753b14e18374e57320b7708988701e356c050acd56f3c709fd",
  "WebCore.framework/Versions/A/WebCore": "e8b83a90807c970f248ac0de9059f0a253cdbffb9aaa838dffadab80afbea5c8",
  "WebKit.framework/Versions/A/WebKit": "4eaa530e052929987c15fb3408e1d8afb887eca376f206f1acfa63f5ba8cc544",
  "Playwright.app/Contents/MacOS/Playwright": "3686ea5661a4dc6d5e8af1367c23ed25097d8f7ecfeda75c52cea64c3072dd83",
  "pw_run.sh": "a85baad3d8c07173ac387a59b41500c382b21ed692afe0964d29aac247ccc63b",
});
export const MAC_WEBKIT_FORBIDDEN_ENV = Object.freeze([
  "WEBKIT_SKIA_ENABLE_CPU_RENDERING", "WEBKIT_SKIA_CPU_PAINTING_THREADS", "WEBKIT_SKIA_GPU_PAINTING_THREADS",
  "PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH", "PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD", "PLAYWRIGHT_HOST_PLATFORM_OVERRIDE",
  "PLAYWRIGHT_BROWSERS_PATH", "PLAYWRIGHT_DOWNLOAD_HOST", "PLAYWRIGHT_WEBKIT_DOWNLOAD_HOST",
]);

export function assertMacWebKitSnapshot(snapshot, { requireSmoke = false } = {}) {
  assert.equal(snapshot.platform, "darwin");
  assert.equal(snapshot.arch, "x64");
  assert.match(snapshot.osVersion, /^15\./u);
  assert.equal(snapshot.node, "v22.13.0");
  assert.equal(snapshot.packageVersion, "1.56.1");
  assert.equal(snapshot.revision, "2215");
  assert.equal(snapshot.browserVersion, "26.0");
  for (const key of MAC_WEBKIT_FORBIDDEN_ENV) assert.equal(snapshot.env[key], undefined, key);
  assert.equal(snapshot.executableExists, true);
  assert.equal(snapshot.executablePath, path.posix.join(snapshot.expectedRoot, "pw_run.sh"));
  assert.deepEqual(snapshot.files, MAC_WEBKIT_FILES, "macOS WebKit critical runtime hashes");
  if (requireSmoke) {
    assert.equal(snapshot.runtimeVersion, "26.0");
    assert.equal(snapshot.capabilities?.canvas, true);
    assert.equal(snapshot.capabilities?.audioContext, "function");
  }
  return snapshot;
}

export async function verifyMacWebKitRuntime() {
  assert.equal(process.platform, "darwin", "macOS runtime preflight cannot run on another port");
  const coreRoot = path.dirname(require.resolve("playwright-core/package.json"));
  const metadata = JSON.parse(await readFile(path.join(coreRoot, "browsers.json"), "utf8"))
    .browsers.find(({ name }) => name === "webkit");
  const expectedRoot = path.join(os.homedir(), "Library", "Caches", "ms-playwright", "webkit-2215");
  const executablePath = webkit.executablePath();
  const snapshot = {
    platform: process.platform, arch: process.arch, node: process.version,
    osVersion: execFileSync("sw_vers", ["-productVersion"], { encoding: "utf8" }).trim(),
    runnerImage: process.env.ImageVersion ?? null,
    packageVersion: require("playwright/package.json").version,
    revision: metadata?.revision, browserVersion: metadata?.browserVersion,
    env: Object.fromEntries(MAC_WEBKIT_FORBIDDEN_ENV.map(key => [key, process.env[key]])),
    expectedRoot, executablePath: existsSync(executablePath) ? realpathSync(executablePath) : executablePath,
    executableExists: existsSync(executablePath), files: {},
  };
  for (const relative of Object.keys(MAC_WEBKIT_FILES)) {
    const file = path.join(expectedRoot, relative);
    assert.equal(realpathSync(file).startsWith(expectedRoot + path.sep), true, "runtime file outside expected installation");
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(file)) hash.update(chunk);
    snapshot.files[relative] = hash.digest("hex");
  }
  assertMacWebKitSnapshot(snapshot);
  let browser = null;
  try {
    browser = await webkit.launch({ headless: true });
    snapshot.runtimeVersion = browser.version();
    const page = await browser.newPage();
    snapshot.capabilities = await page.evaluate(() => ({
      audioContext: typeof AudioContext,
      canvas: Boolean(document.createElement("canvas").getContext("2d")),
    }));
    assertMacWebKitSnapshot(snapshot, { requireSmoke: true });
  } finally {
    await browser?.close();
    console.log(JSON.stringify({ macWebKitRuntime: snapshot }, null, 2));
  }
  return snapshot;
}

export const WEBKIT_CPU_LIBRARY_SHA256 = "daa10258a2161710c7c1d6a3e3f7abe0a100a6f269c00f5843dcd0f7df46ec29";

export function assertWebKitRenderingSnapshot(snapshot) {
  if (snapshot.platform !== "linux") throw new Error("WebKit CPU rendering contract requires Linux WPE");
  if (snapshot.cpuRendering !== "1") throw new Error("WEBKIT_SKIA_ENABLE_CPU_RENDERING must be exactly 1");
  if (snapshot.cpuPaintingThreads !== null || snapshot.gpuPaintingThreads !== null) {
    throw new Error("WebKit painting-thread overrides are forbidden");
  }
  if (snapshot.packageVersion !== "1.56.1" || snapshot.revision !== "2215" || snapshot.browserVersion !== "26.0") {
    throw new Error("WebKit CPU rendering browser metadata mismatch");
  }
  if (snapshot.librarySha256 !== WEBKIT_CPU_LIBRARY_SHA256) throw new Error("WebKit WPE library SHA256 mismatch");
  return snapshot;
}

export async function verifyWebKitRenderingRuntime() {
  const coreRoot = path.dirname(require.resolve("playwright-core/package.json"));
  const metadata = JSON.parse(await readFile(path.join(coreRoot, "browsers.json"), "utf8"))
    .browsers.find(({ name }) => name === "webkit");
  const libraryPath = path.join(path.dirname(webkit.executablePath()), "minibrowser-wpe/lib/libWPEWebKit-2.0.so.1.7.0");
  const snapshot = {
    platform: process.platform,
    cpuRendering: process.env.WEBKIT_SKIA_ENABLE_CPU_RENDERING ?? null,
    cpuPaintingThreads: process.env.WEBKIT_SKIA_CPU_PAINTING_THREADS ?? null,
    gpuPaintingThreads: process.env.WEBKIT_SKIA_GPU_PAINTING_THREADS ?? null,
    packageVersion: require("playwright/package.json").version,
    revision: metadata?.revision ?? null,
    browserVersion: metadata?.browserVersion ?? null,
    libraryPath,
    librarySha256: null,
  };
  if (process.platform === "linux" && existsSync(libraryPath)) {
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(libraryPath)) hash.update(chunk);
    snapshot.librarySha256 = hash.digest("hex");
  }
  console.log(JSON.stringify({ webkitRendering: snapshot }, null, 2));
  return assertWebKitRenderingSnapshot(snapshot);
}

export function parsePlaywrightContainerEngines(source) {
  if (source !== "webkit" && source !== "chromium,webkit") {
    throw new Error(`V100_PLAYWRIGHT_CONTAINER_ENGINES must be exactly webkit or chromium,webkit; received ${source ?? "<missing>"}`);
  }
  const engines = source.split(",");
  if (new Set(engines).size !== engines.length) {
    throw new Error("Playwright container engines must be unique");
  }
  return engines;
}

export function assertPlaywrightContainerSnapshot(snapshot) {
  const contract = PLAYWRIGHT_CONTAINER_RUNTIME_CONTRACT;
  if (snapshot.platform !== "linux") throw new Error(`Playwright container platform must be linux, received ${snapshot.platform}`);
  if (snapshot.image !== contract.image) throw new Error(`Playwright container image contract mismatch: ${snapshot.image}`);
  if (snapshot.browsersPath !== contract.browsersPath) {
    throw new Error(`PLAYWRIGHT_BROWSERS_PATH must be ${contract.browsersPath}, received ${snapshot.browsersPath}`);
  }
  if (snapshot.packageVersion !== contract.packageVersion) {
    throw new Error(`Playwright package must be ${contract.packageVersion}, received ${snapshot.packageVersion}`);
  }
  const requested = parsePlaywrightContainerEngines(snapshot.requestedEngines);
  if (!Array.isArray(snapshot.engines) || snapshot.engines.length !== requested.length) {
    throw new Error("Playwright container engine evidence count mismatch");
  }
  for (const engineName of requested) {
    const expected = contract.engines[engineName];
    const actual = snapshot.engines.find(({ name }) => name === engineName);
    if (!actual) throw new Error(`Missing Playwright container evidence for ${engineName}`);
    if (actual.revision !== expected.revision || actual.metadataVersion !== expected.browserVersion) {
      throw new Error(`Playwright ${engineName} metadata mismatch: ${actual.revision}/${actual.metadataVersion}`);
    }
    if (actual.installByDefault !== true) throw new Error(`Playwright ${engineName} is not installed by default`);
    if (actual.executableExists !== true) throw new Error(`Playwright ${engineName} executable is missing`);
    const executableRoot = `${contract.browsersPath}/${engineName}-${expected.revision}/`;
    if (!String(actual.executablePath ?? "").replaceAll("\\", "/").startsWith(executableRoot)) {
      throw new Error(`Playwright ${engineName} executable is outside ${executableRoot}`);
    }
    if (actual.runtimeVersion !== undefined && actual.runtimeVersion !== expected.browserVersion) {
      throw new Error(`Playwright ${engineName} runtime version mismatch: ${actual.runtimeVersion}`);
    }
    if (actual.smoke !== undefined && actual.smoke !== "v100-playwright-container-ready") {
      throw new Error(`Playwright ${engineName} local-data smoke failed`);
    }
  }
  return requested;
}

async function collectMetadataSnapshot(requestedEngines) {
  const playwrightPackage = require("playwright/package.json");
  const playwrightCoreRoot = path.dirname(require.resolve("playwright-core/package.json"));
  const browserMetadata = JSON.parse(await readFile(path.join(playwrightCoreRoot, "browsers.json"), "utf8"));
  return {
    schema: PLAYWRIGHT_CONTAINER_RUNTIME_CONTRACT.schema,
    platform: process.platform,
    image: process.env.V100_PLAYWRIGHT_CONTAINER_IMAGE,
    browsersPath: process.env.PLAYWRIGHT_BROWSERS_PATH,
    packageVersion: playwrightPackage.version,
    requestedEngines: process.env.V100_PLAYWRIGHT_CONTAINER_ENGINES,
    engines: requestedEngines.map((name) => {
      const metadata = browserMetadata.browsers.find((entry) => entry.name === name);
      const executablePath = BROWSER_TYPES[name].executablePath();
      return {
        name,
        revision: metadata?.revision ?? null,
        metadataVersion: metadata?.browserVersion ?? null,
        installByDefault: metadata?.installByDefault === true,
        executablePath: existsSync(executablePath) ? realpathSync(executablePath).replaceAll("\\", "/") : executablePath.replaceAll("\\", "/"),
        executableExists: existsSync(executablePath),
      };
    }),
  };
}

export async function verifyPlaywrightContainerRuntime() {
  const requestedEngines = parsePlaywrightContainerEngines(process.env.V100_PLAYWRIGHT_CONTAINER_ENGINES);
  const snapshot = await collectMetadataSnapshot(requestedEngines);
  assertPlaywrightContainerSnapshot(snapshot);
  snapshot.webkitRendering = await verifyWebKitRenderingRuntime();

  for (const engine of snapshot.engines) {
    let browser = null;
    try {
      browser = await BROWSER_TYPES[engine.name].launch({ headless: true });
      const page = await browser.newPage();
      await page.goto("data:text/html,<title>v100-playwright-container-ready</title>");
      engine.runtimeVersion = browser.version();
      engine.smoke = await page.evaluate(() => document.title);
    } finally {
      await browser?.close();
    }
  }

  assertPlaywrightContainerSnapshot(snapshot);
  console.log(JSON.stringify(snapshot, null, 2));
  return snapshot;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === "--macos") await verifyMacWebKitRuntime();
  else if (process.argv[2] === "--webkit-rendering") await verifyWebKitRenderingRuntime();
  else await verifyPlaywrightContainerRuntime();
}
