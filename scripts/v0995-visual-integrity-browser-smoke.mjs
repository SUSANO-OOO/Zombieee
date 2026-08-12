import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { CAMPAIGN_STAGES } from "../app/campaign.js";
import { requiredBattleAssetPlan } from "../app/battleAssetPlan.js";
import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";
import { dismissInstallOffer } from "./pwa-gate-qa.mjs";
import sharp from "sharp";

const baseUrl = new URL(process.env.V0995_VISUAL_QA_BASE_URL ?? "http://127.0.0.1:4177/");
if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname)) throw new Error("v0995 visual QA is local-only");
const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href)
  : await import("playwright");
const engines = (process.env.V0995_VISUAL_QA_ENGINES ?? "chromium,webkit").split(",");
const selectedFaultClasses = new Set((process.env.V0995_VISUAL_QA_FAULT_CLASSES ?? "background,unit,later-enemy,mission,support").split(","));
const selectedFaultModes = new Set((process.env.V0995_VISUAL_QA_FAULT_MODES ?? "delay,404,corrupt").split(","));
const viewports = (process.env.V0995_VISUAL_QA_VIEWPORTS ?? "844x340,844x390,1280x720")
  .split(",").map((entry) => {
    const [width, height] = entry.split("x").map(Number);
    return { width, height };
  });
const evidenceDir = path.resolve(process.env.V0995_VISUAL_QA_EVIDENCE_DIR ?? "outputs/v0995-visual-integrity");
const compactDir = path.resolve(process.env.V0995_VISUAL_QA_COMPACT_DIR ?? "docs/qa/v0995/visual-integrity");
await mkdir(evidenceDir, { recursive: true });
await mkdir(compactDir, { recursive: true });

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
          mount: bridge.getBattleMountState(),
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
    for (const fixture of faultClasses.filter(({ className }) => selectedFaultClasses.has(className))) {
      for (const mode of ["delay", "404", "corrupt"].filter((entry) => selectedFaultModes.has(entry))) {
        const faultViewports = fixture.className === "mission" ? viewports : [{ width: 844, height: 390 }];
        for (const faultViewport of faultViewports) {
        const context = await browser.newContext({ viewport: faultViewport });
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
          faultNonce: `${engineName}-${fixture.className}-${mode}`,
        }).toString();
        await page.goto(url.href, { waitUntil: "domcontentloaded" });
        await dismissInstallOffer(page);
        await page.waitForFunction(({ expectedPath }) => document.documentElement.dataset.assetLoadState === "ready"
          && window.__ASHFALL_ASSET_QA__?.getRequiredPlan?.().background.path === expectedPath,
        { expectedPath: fixture.plan.background.path }, { timeout: 120_000 }).catch(async (error) => {
          const debug = await page.evaluate(() => ({
            state: window.__ASHFALL_ASSET_QA__?.getState?.() ?? null,
            history: window.__ASHFALL_ASSET_QA__?.getHistory?.() ?? null,
            requiredBackground: window.__ASHFALL_ASSET_QA__?.getRequiredPlan?.().background.path ?? null,
          }));
          throw new Error(`${engineName}/${fixture.className}/${mode}: baseline ready timeout ${JSON.stringify(debug)}`, { cause: error });
        });
        await page.evaluate(({ path: faultPath, mode: faultMode }) => {
          const next = new URL(window.location.href);
          next.searchParams.set("assetTimeout", "400");
          next.searchParams.set("assetFaultPath", faultPath);
          next.searchParams.set("assetFaultMode", faultMode);
          history.replaceState(history.state, "", next);
          window.__ASHFALL_ASSET_QA__.startAssetFaultProof();
        }, { path: fixture.path, mode });
        await page.waitForFunction(({ expectedPath, faultPath }) => {
          if (document.documentElement.dataset.assetLoadState !== "error") return false;
          const bridge = window.__ASHFALL_ASSET_QA__;
          return bridge?.getRequiredPlan?.().background.path === expectedPath
            && bridge?.getFailedPaths?.().includes(faultPath);
        }, { expectedPath: fixture.plan.background.path, faultPath: fixture.path }, { timeout: 20_000 }).catch(async (error) => {
          const debug = await page.evaluate(() => ({
            state: document.documentElement.dataset.assetLoadState,
            asset: window.__ASHFALL_ASSET_QA__?.getState?.() ?? null,
          }));
          throw new Error(`${engineName}/${fixture.className}/${mode}: terminal timeout ${JSON.stringify(debug)}`, { cause: error });
        });
        const blocked = await page.evaluate(() => ({
          state: window.__ASHFALL_ASSET_QA__.getState(),
          failedPaths: window.__ASHFALL_ASSET_QA__.getFailedPaths(),
          history: window.__ASHFALL_ASSET_QA__.getHistory(),
          mount: window.__ASHFALL_ASSET_QA__.getBattleMountState(),
          assetsState: document.querySelector(".game-frame")?.getAttribute("data-assets-state") ?? null,
          href: window.location.href,
          planBackground: window.__ASHFALL_ASSET_QA__.getRequiredPlan().background.path,
        }));
        invariant(blocked.state.state === "error" && blocked.state.retryAvailable === true, `${engineName}/${fixture.className}/${mode}: not blocked ${JSON.stringify(blocked)}`);
        invariant(blocked.failedPaths.includes(fixture.path), `${engineName}/${fixture.className}/${mode}: fault path absent ${JSON.stringify(blocked)}`);
        const terminalSession = blocked.history.at(-1);
        invariant(terminalSession?.status === "error"
          && terminalSession.failures.length === 1
          && terminalSession.failures[0].path === fixture.path,
        `${engineName}/${fixture.className}/${mode}: unrelated required asset failed ${JSON.stringify(terminalSession)}`);
        invariant(blocked.mount.canPlay === false && blocked.mount.battleMounted === false,
          `${engineName}/${fixture.className}/${mode}/${faultViewport.width}x${faultViewport.height}: fault mounted battle ${JSON.stringify(blocked.mount)}`);
        invariant(blocked.mount.fallbackDrawCount === 0,
          `${engineName}/${fixture.className}/${mode}: production diagnostic fallback drew pixels`);
        const beforeRetry = Object.fromEntries(requestCounts);
        await page.evaluate(() => {
          const url = new URL(window.location.href);
          url.searchParams.delete("assetFaultPath");
          url.searchParams.delete("assetFaultMode");
          history.replaceState(history.state, "", url);
          window.__ASHFALL_ASSET_QA__.retry();
        });
        await page.waitForFunction(() => document.documentElement.dataset.assetLoadState === "ready", null, { timeout: 120_000 }).catch(async (error) => {
          const debug = await page.evaluate(() => ({
            dataset: { ...document.documentElement.dataset },
            state: window.__ASHFALL_ASSET_QA__?.getState?.() ?? null,
            history: window.__ASHFALL_ASSET_QA__?.getHistory?.() ?? null,
            failedPaths: window.__ASHFALL_ASSET_QA__?.getFailedPaths?.() ?? null,
            pendingPaths: window.__ASHFALL_ASSET_QA__?.getPendingPaths?.() ?? null,
          }));
          throw new Error(`${engineName}/${fixture.className}/${mode}: recovery timeout ${JSON.stringify(debug)}`, { cause: error });
        });
        const afterRetry = Object.fromEntries(requestCounts);
        const recovered = await page.evaluate(() => ({
          mount: window.__ASHFALL_ASSET_QA__.getBattleMountState(),
          state: window.__ASHFALL_ASSET_QA__.getState(),
          history: window.__ASHFALL_ASSET_QA__.getHistory(),
          failedPaths: window.__ASHFALL_ASSET_QA__.getFailedPaths(),
          pendingPaths: window.__ASHFALL_ASSET_QA__.getPendingPaths(),
        }));
        await page.waitForFunction(() => window.__ASHFALL_ASSET_QA__.getBattleMountState().battleMounted === true, null, { timeout: 30_000 });
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const finalCanvas = fixture.className === "mission"
          ? await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getStationMissionFinalCanvasAudit())
          : null;
        const mutableMissionStates = [];
        if (finalCanvas) {
          invariant(finalCanvas.pass === true, `${engineName}/${mode}/${faultViewport.width}x${faultViewport.height}: final mission canvas did not contain authored pixels ${JSON.stringify(finalCanvas)}`);
          for (const state of ["start", "power-1", "power-3"]) {
            await page.evaluate((nextState) => window.__ASHFALL_BATTLE_QA__.setStationMissionPixelAuditState(nextState), state);
            await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            const pixelAudit = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getStationMissionFinalCanvasAudit());
            invariant(pixelAudit.pass === true, `${engineName}/${mode}/${state}: authored state missing from final canvas ${JSON.stringify(pixelAudit)}`);
            const screenshot = path.join(evidenceDir, `${engineName}-${faultViewport.width}x${faultViewport.height}-${mode}-${state}.png`);
            await page.screenshot({ path: screenshot });
            mutableMissionStates.push({ state, pixelAudit, screenshot: path.relative(process.cwd(), screenshot).replaceAll("\\", "/") });
          }
          invariant(new Set(mutableMissionStates.map(({ pixelAudit }) => pixelAudit.authoredStateSignature)).size === mutableMissionStates.length,
            `${engineName}/${mode}: mutable mission states collapsed to the same authored pixels`);
        }
        const beforeValues = Object.values(beforeRetry);
        const afterValues = Object.values(afterRetry);
        const requestDelta = [...new Set([...Object.keys(beforeRetry), ...Object.keys(afterRetry)])]
          .filter((key) => (afterRetry[key] ?? 0) > (beforeRetry[key] ?? 0));
        const intendedFailurePaths = new Set(blocked.failedPaths);
        const retrySession = recovered.history.at(-1);
        invariant(retrySession?.reason === "same-screen-retry"
          && retrySession.total === intendedFailurePaths.size
          && retrySession.status === "ready",
        `${engineName}/${fixture.className}/${mode}: failed-only recovery session missing ${JSON.stringify(retrySession)}`);
        faultDiagnostics.push({ engine: engineName, viewport: faultViewport, fixture: { className: fixture.className, stageId: fixture.stageId, path: fixture.path }, mode, blocked, recovered, finalCanvas, mutableMissionStates, beforeRetry, afterRetry, requestDelta, requestSamples: { before: beforeValues.length, after: afterValues.length } });
        await context.close();
        }
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
const compactFile = path.join(compactDir, "summary.json");
await writeFile(compactFile, `${JSON.stringify({
  generatedAt: report.generatedAt,
  build: report.build,
  readyCases: diagnostics.length,
  faultCases: faultDiagnostics.length,
  missionFinalCanvasCases: faultDiagnostics.filter(({ finalCanvas }) => finalCanvas?.pass).length,
  missionFallbackPixelCount: faultDiagnostics.reduce((sum, { blocked }) => sum + Number(blocked.mount?.fallbackDrawCount ?? 0), 0),
  failures: [],
}, null, 2)}\n`);
const representativeMissionImages = faultDiagnostics
  .flatMap(({ mutableMissionStates }) => mutableMissionStates ?? [])
  .slice(0, 3)
  .map(({ screenshot }) => path.resolve(screenshot));
if (representativeMissionImages.length === 3) {
  const panels = await Promise.all(representativeMissionImages.map(async (file) => {
    const image = sharp(file).resize({ width: 640, height: 360, fit: "cover" });
    return { input: await image.png().toBuffer() };
  }));
  await sharp({ create: { width: 640 * panels.length, height: 360, channels: 4, background: "#070a0b" } })
    .composite(panels.map((panel, index) => ({ ...panel, left: index * 640, top: 0 })))
    .png({ compressionLevel: 9 })
    .toFile(path.join(compactDir, "station-mission-state-contact-sheet.png"));
}
const digest = createHash("sha256").update(await readFile(reportFile)).digest("hex");
console.log(JSON.stringify({ status: "passed", cases: diagnostics.length, faultCases: faultDiagnostics.length, report: path.relative(process.cwd(), reportFile).replaceAll("\\", "/"), digest }, null, 2));
