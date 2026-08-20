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
const selectedFaultModes = new Set((process.env.V0995_VISUAL_QA_FAULT_MODES ?? "delay,404,corrupt,decode-reject,decode-timeout").split(","));
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
const transportRetries = [];
const isTransientBrowserClosure = (error) => {
  let current = error;
  for (let depth = 0; current && depth < 4; depth += 1) {
    if (/Target page, context or browser has been closed|Target closed|Browser has been closed/i.test(String(current.message ?? current))) {
      return true;
    }
    current = current.cause;
  }
  return false;
};
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
const runEngine = async (engineName, browserType) => {
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
      url.search = new URLSearchParams({
        qa: "mission",
        stage: CAMPAIGN_STAGES[0].id,
        state: "start",
        qaVisualIntegrity: "1",
      }).toString();
      await page.goto(url.href, { waitUntil: "domcontentloaded" });
      await dismissInstallOffer(page);
      await page.waitForFunction(() => document.documentElement.dataset.assetLoadState === "ready", null, { timeout: 120_000 });
      await page.waitForFunction(() => window.__ASHFALL_ASSET_QA__?.getBattleMountState?.().battleMounted === true, null, { timeout: 30_000 });
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
      let monkeyRenderProof = null;
      if (viewport.width === 844 && viewport.height === 390) {
        monkeyRenderProof = await page.evaluate(async () => {
          const qa = window.__ASHFALL_BATTLE_QA__;
          const asset = await qa.ensureUnitRenderProofAsset("engineer");
          const prepared = qa.prepareCrawlerDefenseProof({ attackerKind: "walker", lane: 1, existingClaim: false });
          if (!Number.isInteger(prepared?.attackerId) || qa.queueCrawlerDefenseUnit("engineer", 1) !== true) {
            throw new Error("Monkey production deployment fixture is unavailable");
          }
          const startedAt = performance.now();
          let released = false;
          let lastObservation = null;
          while (performance.now() - startedAt < 20_000) {
            const fighter = qa.getSnapshot().fighters.find((candidate) => (
              candidate.kind === "engineer"
              && candidate.side === "human"
              && candidate.spawnPortalId === "crawler-door"
            ));
            lastObservation = fighter ? { id: fighter.id, renderAudit: fighter.renderAudit } : null;
            if (fighter && !released) {
              qa.setRepresentativeSixProofPaused(false);
              released = true;
            }
            if (fighter?.renderAudit?.assetReady === true
              && fighter.renderAudit.spriteState
              && fighter.renderAudit.effectiveOpacity === 1) {
              qa.setRepresentativeSixProofPaused(true);
              await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
              const frozen = qa.getSnapshot().fighters.find((candidate) => candidate.id === fighter.id);
              return { asset, fighter: frozen, unitLayer: qa.auditFighterUnitLayer(fighter.id) };
            }
            await new Promise((resolve) => requestAnimationFrame(resolve));
          }
          throw new Error(`Monkey never reached the production battle renderer ${JSON.stringify(lastObservation)}`);
        });
        invariant(monkeyRenderProof.asset?.path === "/art/v070/characters/engineer-battle-v1.png",
          `${engineName}: Monkey renderer resolved ${monkeyRenderProof.asset?.path}`);
        invariant(monkeyRenderProof.fighter?.renderAudit?.assetReady === true,
          `${engineName}: Monkey approved atlas was not consumed by the production renderer`);
        invariant(monkeyRenderProof.unitLayer?.alphaOneFromFirstVisibleFrame === true
          && monkeyRenderProof.unitLayer?.finalCompositePixels?.pass === true
          && monkeyRenderProof.unitLayer?.finalCompositePixels?.singleUnitSilhouette === true,
        `${engineName}: Monkey final-canvas render proof failed ${JSON.stringify(monkeyRenderProof.unitLayer)}`);
      }
      invariant(errors.length === 0, `${engineName}/${viewport.width}x${viewport.height}: ${errors.join("\n")}`);
      const screenshot = path.join(evidenceDir, `${engineName}-${viewport.width}x${viewport.height}-required-assets.png`);
      await page.screenshot({ path: screenshot, fullPage: true });
      diagnostics.push({ engine: engineName, viewport, audit, monkeyRenderProof, errors, screenshot: path.relative(process.cwd(), screenshot).replaceAll("\\", "/") });
      await context.close();
    }
    for (const fixture of faultClasses.filter(({ className }) => selectedFaultClasses.has(className))) {
      for (const mode of ["delay", "404", "corrupt", "decode-reject", "decode-timeout"].filter((entry) => selectedFaultModes.has(entry))) {
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
          qaVisualIntegrity: "1",
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
        if (mode === "decode-reject" || mode === "decode-timeout") {
          await page.evaluate(({ faultPath, faultMode }) => {
          const originalDecode = HTMLImageElement.prototype.decode;
          window.__ASHFALL_QA_RESTORE_DECODE__ = () => {
            Object.defineProperty(HTMLImageElement.prototype, "decode", { configurable: true, value: originalDecode });
            delete window.__ASHFALL_QA_RESTORE_DECODE__;
          };
            Object.defineProperty(HTMLImageElement.prototype, "decode", {
              configurable: true,
              value() {
                const sourcePath = (() => {
                  try { return new URL(this.currentSrc || this.src, location.href).pathname; } catch { return ""; }
                })();
                if (sourcePath === faultPath) {
                  if (faultMode === "decode-timeout") return new Promise(() => {});
                  return Promise.reject(new DOMException("QA decode rejection", "EncodingError"));
                }
                return originalDecode.call(this);
              },
            });
          }, { faultPath: fixture.path, faultMode: mode });
        }
        await page.evaluate(({ path: faultPath, mode: faultMode }) => {
          const next = new URL(window.location.href);
          next.searchParams.set("assetTimeout", "400");
          next.searchParams.set("assetFaultPath", faultPath);
          if (["delay", "404", "corrupt"].includes(faultMode)) next.searchParams.set("assetFaultMode", faultMode);
          else next.searchParams.delete("assetFaultMode");
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
        const expectedFailureReason = mode.startsWith("decode-")
          ? "decode"
          : mode === "delay" ? "timeout" : "http";
        invariant(terminalSession.failures[0].reason === expectedFailureReason,
          `${engineName}/${fixture.className}/${mode}: wrong failure reason ${JSON.stringify(terminalSession.failures[0])}`);
        invariant(blocked.mount.canPlay === false && blocked.mount.battleMounted === false,
          `${engineName}/${fixture.className}/${mode}/${faultViewport.width}x${faultViewport.height}: fault mounted battle ${JSON.stringify(blocked.mount)}`);
        invariant(blocked.mount.fallbackDrawCount === 0,
          `${engineName}/${fixture.className}/${mode}: production diagnostic fallback drew pixels`);
        const decodedBeforeRetry = await page.evaluate(() => window.__ASHFALL_ASSET_QA__.getDecodedRequiredPaths());
        await page.evaluate(() => {
          const url = new URL(window.location.href);
          url.searchParams.delete("assetFaultPath");
          url.searchParams.delete("assetFaultMode");
          history.replaceState(history.state, "", url);
          window.__ASHFALL_QA_RESTORE_DECODE__?.();
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
        const decodedAfterRetry = await page.evaluate(() => window.__ASHFALL_ASSET_QA__.getDecodedRequiredPaths());
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
        const intendedFailurePaths = new Set(blocked.failedPaths);
        const missingDecodedSuccesses = decodedBeforeRetry
          .filter((assetPath) => !intendedFailurePaths.has(assetPath) && !decodedAfterRetry.includes(assetPath));
        invariant(missingDecodedSuccesses.length === 0,
          `${engineName}/${fixture.className}/${mode}: retry discarded a decoded successful asset ${JSON.stringify(missingDecodedSuccesses)}`);
        const retrySession = recovered.history.at(-1);
        invariant(retrySession?.reason === "same-screen-retry"
          && retrySession.total === intendedFailurePaths.size
          && retrySession.status === "ready",
        `${engineName}/${fixture.className}/${mode}: failed-only recovery session missing ${JSON.stringify(retrySession)}`);
        faultDiagnostics.push({ engine: engineName, viewport: faultViewport, fixture: { className: fixture.className, stageId: fixture.stageId, path: fixture.path }, mode, blocked, recovered, finalCanvas, mutableMissionStates, decodedBeforeRetry, decodedAfterRetry, missingDecodedSuccesses, requestCounts: Object.fromEntries(requestCounts) });
        await context.close();
        }
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }
};

for (const engineName of engines) {
  const browserType = playwright[engineName];
  invariant(browserType, `unknown browser ${engineName}`);
  const diagnosticsStart = diagnostics.length;
  const faultDiagnosticsStart = faultDiagnostics.length;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await runEngine(engineName, browserType);
      break;
    } catch (error) {
      diagnostics.length = diagnosticsStart;
      faultDiagnostics.length = faultDiagnosticsStart;
      if (attempt === 0 && isTransientBrowserClosure(error)) {
        const retry = { engine: engineName, attempt: attempt + 1, reason: String(error.message ?? error) };
        transportRetries.push(retry);
        console.warn(`[v0995 visual QA] retrying ${engineName} after transient browser closure: ${retry.reason}`);
        continue;
      }
      throw error;
    }
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  build: await productionBuildIdentity(),
  diagnostics,
  faultDiagnostics,
  transportRetries,
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
  transportRetries,
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
