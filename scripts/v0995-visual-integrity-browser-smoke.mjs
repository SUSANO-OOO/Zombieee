import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { CAMPAIGN_STAGES } from "../app/campaign.js";
import { requiredBattleAssetPlan } from "../app/battleAssetPlan.js";
import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";
import { dismissInstallOffer } from "./pwa-gate-qa.mjs";

const baseUrl = new URL(process.env.V0995_VISUAL_QA_BASE_URL ?? "http://127.0.0.1:4177/");
if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname)) throw new Error("v0995 visual QA is local-only");
const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href)
  : await import("playwright");
const engines = (process.env.V0995_VISUAL_QA_ENGINES ?? "chromium,webkit").split(",");
const viewports = (process.env.V0995_VISUAL_QA_VIEWPORTS ?? "844x340,844x390,1280x720")
  .split(",").map((entry) => {
    const [width, height] = entry.split("x").map(Number);
    return { width, height };
  });
const evidenceDir = path.resolve(process.env.V0995_VISUAL_QA_EVIDENCE_DIR ?? "docs/qa/v0995/visual-integrity");
await mkdir(evidenceDir, { recursive: true });

const invariant = (condition, message) => { if (!condition) throw new Error(message); };
const diagnostics = [];
const faultDiagnostics = [];
const missionStage = CAMPAIGN_STAGES.find(({ missionType }) => missionType === "sequential-seal");
const lateEnemyStage = CAMPAIGN_STAGES.find(({ waves }) => waves?.some(({ groups }, index) => (
  index > 0 && groups.length > 0
)));
invariant(missionStage && lateEnemyStage, "fault fixtures require mission and multi-wave stages");
const missionPlan = requiredBattleAssetPlan({
  stageId: missionStage.id,
  formationKinds: ["brawler"],
  enemyKinds: missionStage.enemyKinds,
});
const lateFirstWave = new Set(lateEnemyStage.waves[0].groups.map(({ kind }) => kind));
const laterEnemy = lateEnemyStage.enemyKinds.find((kind) => !lateFirstWave.has(kind)) ?? lateEnemyStage.enemyKinds.at(-1);
const latePlan = requiredBattleAssetPlan({
  stageId: lateEnemyStage.id,
  formationKinds: ["brawler"],
  enemyKinds: lateEnemyStage.enemyKinds,
});
const faultClasses = [
  { className: "background", stageId: missionStage.id, path: missionPlan.background.path, plan: missionPlan },
  { className: "unit", stageId: missionStage.id, path: missionPlan.sprites.find(({ kind }) => kind === "brawler").path, plan: missionPlan },
  { className: "later-enemy", stageId: lateEnemyStage.id, path: latePlan.sprites.find(({ kind }) => kind === laterEnemy).path, plan: latePlan },
  { className: "mission", stageId: missionStage.id, path: missionPlan.stageObjects.find(({ category }) => category === "mission").path, plan: missionPlan },
  { className: "support", stageId: missionStage.id, path: missionPlan.persistent.find(({ category }) => category === "support").path, plan: missionPlan },
];
for (const engineName of engines) {
  const browserType = playwright[engineName];
  invariant(browserType, `unknown browser ${engineName}`);
  const browser = await browserType.launch({ headless: true });
  try {
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const errors = [];
      page.on("console", (message) => { if (message.type() === "error") errors.push(`console:${message.text()}`); });
      page.on("pageerror", (error) => errors.push(`page:${error.message}`));
      page.on("requestfailed", (request) => errors.push(`request:${request.url()}:${request.failure()?.errorText}`));
      const url = new URL(baseUrl);
      url.search = new URLSearchParams({ qa: "battle", stage: CAMPAIGN_STAGES[0].id }).toString();
      await page.goto(url.href, { waitUntil: "domcontentloaded" });
      await dismissInstallOffer(page);
      await page.waitForFunction(() => document.documentElement.dataset.assetLoadState === "ready", null, { timeout: 120_000 });
      const audit = await page.evaluate(() => {
        const bridge = window.__ASHFALL_ASSET_QA__;
        const state = bridge.getState();
        const plan = bridge.getRequiredPlan();
        const sprites = new Set(bridge.getLoadedSpriteKeys());
        const stageObjects = new Set(bridge.getLoadedStageObjectKeys());
        return {
          state,
          plan: { stageId: plan.stageId, paths: plan.paths, sprites: plan.sprites, stageObjects: plan.stageObjects },
          missingSprites: plan.sprites.filter(({ kind }) => !sprites.has(kind)).map(({ kind }) => kind),
          missingStageObjects: plan.stageObjects.filter(({ id }) => !stageObjects.has(id)).map(({ id }) => id),
          canPlay: !document.querySelector(".campaign-primary")?.getAttribute("aria-disabled"),
        };
      });
      invariant(audit.state.state === "ready" && audit.state.failed === 0, JSON.stringify(audit.state));
      invariant(audit.missingSprites.length === 0, `missing sprites ${audit.missingSprites}`);
      invariant(audit.missingStageObjects.length === 0, `missing stage objects ${audit.missingStageObjects}`);
      invariant(errors.length === 0, `${engineName}/${viewport.width}x${viewport.height}: ${errors.join("\n")}`);
      const screenshot = path.join(evidenceDir, `${engineName}-${viewport.width}x${viewport.height}-required-assets.png`);
      await page.screenshot({ path: screenshot, fullPage: true });
      diagnostics.push({ engine: engineName, viewport, audit, errors, screenshot: path.relative(process.cwd(), screenshot).replaceAll("\\", "/") });
      await context.close();
    }
    for (const fixture of faultClasses) {
      for (const mode of ["delay", "404", "corrupt"]) {
        const context = await browser.newContext({ viewport: { width: 844, height: 390 } });
        const page = await context.newPage();
        const requestCounts = new Map();
        page.on("request", (request) => {
          const pathname = new URL(request.url()).pathname;
          requestCounts.set(pathname, (requestCounts.get(pathname) ?? 0) + 1);
        });
        const url = new URL(baseUrl);
        url.search = new URLSearchParams({
          qa: "mission",
          stage: fixture.stageId,
          state: "start",
          assetTimeout: "400",
          assetFaultPath: fixture.path,
          assetFaultMode: mode,
          faultNonce: `${engineName}-${fixture.className}-${mode}`,
        }).toString();
        await page.goto(url.href, { waitUntil: "domcontentloaded" });
        await dismissInstallOffer(page);
        await page.waitForFunction(() => ["error", "ready"].includes(document.documentElement.dataset.assetLoadState), null, { timeout: 20_000 }).catch(async (error) => {
          const debug = await page.evaluate(() => ({
            state: document.documentElement.dataset.assetLoadState,
            asset: window.__ASHFALL_ASSET_QA__?.getState?.() ?? null,
          }));
          throw new Error(`${engineName}/${fixture.className}/${mode}: terminal timeout ${JSON.stringify(debug)}`, { cause: error });
        });
        const blocked = await page.evaluate(() => ({
          state: window.__ASHFALL_ASSET_QA__.getState(),
          failedPaths: window.__ASHFALL_ASSET_QA__.getFailedPaths(),
          assetsState: document.querySelector(".game-frame")?.getAttribute("data-assets-state") ?? null,
          href: window.location.href,
          planBackground: window.__ASHFALL_ASSET_QA__.getRequiredPlan().background.path,
        }));
        invariant(blocked.state.state === "error" && blocked.state.retryAvailable === true, `${engineName}/${fixture.className}/${mode}: not blocked ${JSON.stringify(blocked)}`);
        invariant(blocked.failedPaths.includes(fixture.path), `${engineName}/${fixture.className}/${mode}: fault path absent ${JSON.stringify(blocked)}`);
        const beforeRetry = Object.fromEntries(requestCounts);
        await page.evaluate(() => {
          const url = new URL(window.location.href);
          url.searchParams.delete("assetFaultPath");
          url.searchParams.delete("assetFaultMode");
          history.replaceState(history.state, "", url);
          window.__ASHFALL_ASSET_QA__.retry();
        });
        await page.waitForFunction(() => document.documentElement.dataset.assetLoadState === "ready", null, { timeout: 120_000 });
        const afterRetry = Object.fromEntries(requestCounts);
        // The failed-only selection is asserted directly by asset-load-session
        // tests. Browser request logs can be satisfied from WebKit's decoded
        // image cache, so they are retained as diagnostics rather than used as
        // a false network-count oracle.
        faultDiagnostics.push({ engine: engineName, fixture: { className: fixture.className, stageId: fixture.stageId, path: fixture.path }, mode, blocked, beforeRetry, afterRetry });
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  build: await productionBuildIdentity(),
  diagnostics,
  faultDiagnostics,
};
const reportFile = path.join(evidenceDir, "visual-integrity-report.json");
await writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`);
const digest = createHash("sha256").update(await readFile(reportFile)).digest("hex");
console.log(JSON.stringify({ status: "passed", cases: diagnostics.length, faultCases: faultDiagnostics.length, report: path.relative(process.cwd(), reportFile).replaceAll("\\", "/"), digest }, null, 2));
