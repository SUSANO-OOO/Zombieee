import { createHash } from "node:crypto";
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
  if (process.argv[2] === "--webkit-rendering") await verifyWebKitRenderingRuntime();
  else await verifyPlaywrightContainerRuntime();
}
