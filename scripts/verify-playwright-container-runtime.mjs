import { existsSync, realpathSync } from "node:fs";
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
  await verifyPlaywrightContainerRuntime();
}
