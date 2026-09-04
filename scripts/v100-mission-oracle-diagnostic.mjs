import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";
import { CAMPAIGN_STAGES } from "../app/campaign.js";
import { requiredBattleAssetPlan } from "../app/battleAssetPlan.js";
import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";
import { dismissInstallOffer } from "./pwa-gate-qa.mjs";

export const DIAGNOSTIC_SOURCE_HEAD = "ea6b216daadcc9f98b031acf963f69b2f6f6bb64";
export const DIAGNOSTIC_CASES = Object.freeze([
  { engine: "webkit", route: "normal" }, { engine: "webkit", route: "delay-recovery" },
  { engine: "chromium", route: "normal" }, { engine: "chromium", route: "delay-recovery" },
].map(Object.freeze));
export const DIAGNOSTIC_STATES = Object.freeze(["start", "power-1", "power-3"]);
const engines = { chromium, webkit };
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
export async function boundedRead(operation) {
  let timer;
  try {
    return await Promise.race([operation, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("diagnostic read exceeded 2000ms; no further page RPC")), 2000);
    })]);
  } finally { clearTimeout(timer); }
}

export async function persistObservation(directory, state, audit, screenshotBytes) {
  assert(DIAGNOSTIC_STATES.includes(state));
  assert.equal(audit.diagnostic?.diagnosticOnly, true);
  assert.equal(audit.diagnostic?.acceptance, false);
  const images = {};
  for (const [name, encoded] of Object.entries(audit.diagnostic.images)) {
    assert(["expectedWorld","finalBackProjected","actualBacking","directNativeReference","expectedOnlyRoundTrip"].includes(name));
    assert(encoded.startsWith("data:image/png;base64,"));
    const bytes = Buffer.from(encoded.slice("data:image/png;base64,".length), "base64");
    const file = path.join(directory, `${state}-${name}.png`);
    await writeFile(file, bytes, { flag: "wx" });
    images[name] = { path: path.relative(process.cwd(), file).replaceAll("\\", "/"), bytes: bytes.length, sha256: sha256(bytes) };
  }
  assert.equal(Object.keys(images).length, 5);
  const record = { state, original: { ...audit, diagnostic: undefined }, diagnostic: { ...audit.diagnostic, images } };
  // The same-observation raw evidence survives even if the later page screenshot fails.
  await writeFile(path.join(directory, `${state}-observation.json`), JSON.stringify(record, null, 2) + "\n", { flag: "wx" });
  if (screenshotBytes) await writeFile(path.join(directory, `${state}-page.png`), screenshotBytes, { flag: "wx" });
  return record;
}

async function runCase(spec, baseUrl, directory) {
  const browser = await engines[spec.engine].launch({ headless: true });
  const result = { ...spec, attempt: 1, viewport: { width: 844, height: 340 }, observations: [], errors: [], lifecycle: [], failure: null };
  browser.on("disconnected", () => result.lifecycle.push({ event: "disconnected", at: Date.now() }));
  try {
    const context = await browser.newContext({ viewport: result.viewport });
    const page = await context.newPage();
    page.on("pageerror", error => result.errors.push({ type: "page", message: String(error) }));
    page.on("console", message => { if (message.type() === "error") result.errors.push({ type: "console", message: message.text() }); });
    page.on("requestfailed", request => result.errors.push({ type: "request", url: request.url(), failure: request.failure() }));
    page.on("response", response => { if (response.status() >= 400) result.errors.push({ type: "http", status: response.status(), url: response.url() }); });
    page.on("crash", () => result.lifecycle.push({ event: "crash", at: Date.now() }));
    const stage = CAMPAIGN_STAGES.find(({ missionType }) => missionType === "sequential-seal");
    assert(stage);
    const plan = requiredBattleAssetPlan({ stageId: stage.id, formationKinds: ["brawler"], enemyKinds: stage.enemyKinds });
    const faultPath = plan.stageObjects.find(({ category }) => category === "mission").path;
    const url = new URL(baseUrl);
    url.search = new URLSearchParams({ qa: "mission", stage: stage.id, state: "start", qaVisualIntegrity: "1",
      faultNonce: `${spec.engine}-mission-delay` }).toString();
    await page.goto(url.href, { waitUntil: "domcontentloaded" });
    await dismissInstallOffer(page);
    await page.waitForFunction(expectedPath => document.documentElement.dataset.assetLoadState === "ready"
      && window.__ASHFALL_ASSET_QA__?.getRequiredPlan?.().background.path === expectedPath,
    plan.background.path, { timeout: 120000 });
    if (spec.route === "delay-recovery") {
      await page.evaluate(faultPath => {
        const next = new URL(location.href);
        next.searchParams.set("assetTimeout", "400");
        next.searchParams.set("assetFaultPath", faultPath);
        next.searchParams.set("assetFaultMode", "delay");
        history.replaceState(history.state, "", next);
        window.__ASHFALL_ASSET_QA__.startAssetFaultProof();
      }, faultPath);
      await page.waitForFunction(faultPath => document.documentElement.dataset.assetLoadState === "error"
        && window.__ASHFALL_ASSET_QA__.getFailedPaths().includes(faultPath), faultPath, { timeout: 20000 });
      result.blocked = await page.evaluate(() => ({ state: window.__ASHFALL_ASSET_QA__.getState(),
        history: window.__ASHFALL_ASSET_QA__.getHistory(), mount: window.__ASHFALL_ASSET_QA__.getBattleMountState() }));
      assert.equal(result.blocked.mount.battleMounted, false);
      assert.equal(result.blocked.mount.fallbackDrawCount, 0);
      await page.evaluate(() => {
        const url = new URL(location.href);
        url.searchParams.delete("assetFaultPath"); url.searchParams.delete("assetFaultMode");
        history.replaceState(history.state, "", url);
        window.__ASHFALL_ASSET_QA__.retry();
      });
      await page.waitForFunction(() => document.documentElement.dataset.assetLoadState === "ready", null, { timeout: 120000 });
    }
    await page.waitForFunction(() => window.__ASHFALL_ASSET_QA__.getBattleMountState().battleMounted === true, null, { timeout: 30000 });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    for (const state of DIAGNOSTIC_STATES) {
      if (state !== "start") {
        await page.evaluate(state => window.__ASHFALL_BATTLE_QA__.setStationMissionPixelAuditState(state), state);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      }
      const audit = await boundedRead(page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getStationMissionFinalCanvasAudit(true)));
      const record = await persistObservation(directory, state, audit);
      result.observations.push(record);
      const screenshot = await page.screenshot({ path: path.join(directory, `${state}-page.png`), timeout: 10000 });
      record.screenshot = { bytes: screenshot.length, sha256: sha256(screenshot) };
      await writeFile(path.join(directory, `${state}-page-receipt.json`), JSON.stringify(record.screenshot) + "\n", { flag: "wx" });
      // Original red is data for SOL, never turned into acceptance by this driver.
      console.log(JSON.stringify({ ...spec, state, originalPass: audit.pass, originalNear: audit.finalNearMatchRatio,
        directNear: audit.diagnostic.directNative.nearRatio, selfRoundTripNear: audit.diagnostic.expectedOnlyRoundTrip.nearRatio,
        diagnosticOnly: true, acceptance: false }));
    }
  } catch (error) { result.failure = String(error); }
  finally {
    result.lifecycle.push({ event: "cleanup-begin", at: Date.now() });
    try { await browser.close(); } catch (error) { result.cleanupError = String(error); }
    await writeFile(path.join(directory, "case.json"), JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
  }
  if (result.failure || result.cleanupError || result.observations.length !== 3) throw new Error(JSON.stringify(result));
  return result;
}

export async function runDiagnostic({ root = "outputs/v100-mission-oracle", baseUrl = process.env.V0995_VISUAL_QA_BASE_URL,
  executeCase = runCase, buildIdentity = productionBuildIdentity } = {}) {
  assert(baseUrl && ["localhost", "127.0.0.1"].includes(new URL(baseUrl).hostname), "localhost diagnostic only");
  const report = { diagnosticOnly: true, acceptance: false, sourceHead: DIAGNOSTIC_SOURCE_HEAD,
    diagnosticHead: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    platform: process.platform, node: process.version, build: await buildIdentity(), cases: [], failure: null };
  await mkdir(root, { recursive: true });
  try {
    for (const spec of DIAGNOSTIC_CASES) {
      const directory = path.join(root, `${spec.engine}-${spec.route}`);
      await mkdir(directory, { recursive: true });
      const completed = await executeCase(spec, baseUrl, directory);
      assert.equal(completed.engine, spec.engine);
      assert.equal(completed.route, spec.route);
      assert.deepEqual(completed.observations?.map(({ state }) => state), DIAGNOSTIC_STATES,
        "diagnostic case must contain exactly its three ordered observations");
      report.cases.push(completed);
    }
    assert.equal(report.cases.length, 4);
    assert.equal(report.cases.flatMap(({ observations }) => observations).length, 12);
    report.status = "DIAGNOSTIC_COMPLETE_NOT_ACCEPTANCE";
  } catch (error) { report.failure = String(error); report.status = "DIAGNOSTIC_INCOMPLETE"; }
  finally { await writeFile(path.join(root, "report.json"), JSON.stringify(report, null, 2) + "\n", { flag: "wx" }); }
  if (report.failure) throw new Error(report.failure);
  return report;
}

export async function runDiagnosticEntrypoint({ argv = process.argv, execute = runDiagnostic } = {}) {
  const modulePath = fileURLToPath(import.meta.url);
  const runnerPath = fileURLToPath(new URL("./run-browser-qa-with-server.mjs", import.meta.url));
  const direct = argv[1] && path.resolve(argv[1]) === modulePath;
  const runnerImport = argv[1] && path.resolve(argv[1]) === runnerPath
    && argv[2] && path.resolve(argv[2]) === modulePath;
  if (!direct && !runnerImport) return false;
  await execute();
  return true;
}

await runDiagnosticEntrypoint();
