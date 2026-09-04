import assert from "node:assert/strict";
import test from "node:test";

import {
  PLAYWRIGHT_CONTAINER_RUNTIME_CONTRACT,
  assertPlaywrightContainerSnapshot,
  parsePlaywrightContainerEngines,
  assertWebKitRenderingSnapshot,
  WEBKIT_CPU_LIBRARY_SHA256,
} from "../scripts/verify-playwright-container-runtime.mjs";

test("Linux WebKit CPU preflight rejects environment, binary and platform drift before launch", () => {
  const exact = {
    platform: "linux", cpuRendering: "1", cpuPaintingThreads: null, gpuPaintingThreads: null,
    packageVersion: "1.56.1", revision: "2215", browserVersion: "26.0", librarySha256: WEBKIT_CPU_LIBRARY_SHA256,
  };
  assert.deepEqual(assertWebKitRenderingSnapshot(exact), exact);
  for (const [field, values] of Object.entries({
    platform: ["win32", "darwin", null], cpuRendering: [null, undefined, "", "0", "true"],
    cpuPaintingThreads: ["", "0", "1", undefined], gpuPaintingThreads: ["", "0", "1", undefined],
    packageVersion: ["1.56.2"], revision: ["2216"], browserVersion: ["27.0"], librarySha256: [null, "", "0".repeat(64)],
  })) {
    for (const value of values) assert.throws(() => assertWebKitRenderingSnapshot({ ...exact, [field]: value }), field);
  }
});

function exactSnapshot() {
  const contract = PLAYWRIGHT_CONTAINER_RUNTIME_CONTRACT;
  return {
    schema: contract.schema,
    platform: "linux",
    image: contract.image,
    browsersPath: contract.browsersPath,
    packageVersion: contract.packageVersion,
    requestedEngines: "chromium,webkit",
    engines: Object.entries(contract.engines).map(([name, metadata]) => ({
      name,
      revision: metadata.revision,
      metadataVersion: metadata.browserVersion,
      installByDefault: true,
      executablePath: `/ms-playwright/${name}-${metadata.revision}/runtime`,
      executableExists: true,
      runtimeVersion: metadata.browserVersion,
      smoke: "v100-playwright-container-ready",
    })),
  };
}

test("r34 container preflight accepts only the exact image, package, browser, path, and smoke contract", () => {
  const exact = exactSnapshot();
  assert.deepEqual(parsePlaywrightContainerEngines("webkit"), ["webkit"]);
  assert.deepEqual(parsePlaywrightContainerEngines("chromium,webkit"), ["chromium", "webkit"]);
  assert.deepEqual(assertPlaywrightContainerSnapshot(exact), ["chromium", "webkit"]);

  for (const mutate of [
    (snapshot) => { snapshot.platform = "win32"; },
    (snapshot) => { snapshot.image = "mcr.microsoft.com/playwright:latest"; },
    (snapshot) => { snapshot.browsersPath = "/tmp/browsers"; },
    (snapshot) => { snapshot.packageVersion = "1.56.2"; },
    (snapshot) => { snapshot.engines[0].revision = "1195"; },
    (snapshot) => { snapshot.engines[1].metadataVersion = "27.0"; },
    (snapshot) => { snapshot.engines[0].executableExists = false; },
    (snapshot) => { snapshot.engines[1].executablePath = "/tmp/webkit"; },
    (snapshot) => { snapshot.engines[0].runtimeVersion = "0"; },
    (snapshot) => { snapshot.engines[1].smoke = "wrong"; },
  ]) {
    const drift = structuredClone(exact);
    mutate(drift);
    assert.throws(() => assertPlaywrightContainerSnapshot(drift));
  }

  for (const invalid of [undefined, "", "chromium", "webkit,chromium", "webkit,webkit", "firefox"]) {
    assert.throws(() => parsePlaywrightContainerEngines(invalid));
  }
});
