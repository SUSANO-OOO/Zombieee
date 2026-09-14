import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

import { productionEnemyRuntimeContract } from "../app/productionEnemyRuntime.js";
import { productionVisualIntegrityInventory } from "../app/visualIntegrityInventory.js";
import { SPRITE_STATES, spriteFrameFor } from "../app/spriteManifest.js";
import { dismissInstallOffer } from "./pwa-gate-qa.mjs";
import {
  classifySupersededAssetRequestFailures,
  reconcilePageClockRequestFailures,
  strictCanvasScreenshotClip,
  enemyRuntimeFailureRecord,
} from "./v0995-qa-evidence-contract.mjs";

const baseUrl = new URL(process.env.V0995_ENEMY_QA_BASE_URL ?? "http://127.0.0.1:4177/");
if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname)) throw new Error("v0995 enemy runtime QA is local-only");
const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href)
  : await import("playwright");
const engines = (process.env.V0995_ENEMY_QA_ENGINES ?? "chromium,webkit").split(",").map((value) => value.trim()).filter(Boolean);
const viewports = (process.env.V0995_ENEMY_QA_VIEWPORTS ?? "844x340,844x390,1280x720")
  .split(",").map((entry) => {
    const [width, height] = entry.split("x").map(Number);
    return { width, height };
  });
const outputDir = path.resolve(process.env.V0995_ENEMY_QA_EVIDENCE_DIR ?? "outputs/v0995-enemy-runtime");
const compactDir = path.resolve(process.env.V0995_ENEMY_QA_COMPACT_DIR ?? "docs/qa/v0995/enemy-facing");
const timeout = Math.max(10_000, Number(process.env.V0995_ENEMY_QA_TIMEOUT_MS) || 45_000);
await mkdir(outputDir, { recursive: true });
await mkdir(compactDir, { recursive: true });

const invariant = (condition, message) => { if (!condition) throw new Error(message); };
const runtimeContract = productionEnemyRuntimeContract();
const fullInventory = productionVisualIntegrityInventory().enemies.map(({ kind }) => kind);
const requiredKinds = runtimeContract.requiredEnemyKinds;
const requiredSet = new Set(requiredKinds);
const registrySet = new Set(runtimeContract.registryKinds);
const inventorySet = new Set(fullInventory);
const missingKinds = requiredKinds.filter((kind) => !inventorySet.has(kind));
const duplicateCoverage = fullInventory
  .filter((kind, index) => fullInventory.indexOf(kind) !== index)
  .filter((kind, index, values) => values.indexOf(kind) === index);
const unknownInventoryKinds = fullInventory.filter((kind) => !registrySet.has(kind));
const extraInventoryKinds = fullInventory.filter((kind) => !requiredSet.has(kind));
const runtimeSpriteStateMissing = runtimeContract.spriteRequirements
  .filter(({ error, states, sheet }) => (
    Boolean(error) || !sheet || states.length !== SPRITE_STATES.length
      || states.some(({ left, right }) => (
        !left?.path || !right?.path
        || !left?.sourceRect || !right?.sourceRect
        || ![left.sourceRect.x, left.sourceRect.y, left.sourceRect.w, left.sourceRect.h,
          right.sourceRect.x, right.sourceRect.y, right.sourceRect.w, right.sourceRect.h].every(Number.isFinite)
      ))
  ))
  .map(({ kind, error }) => ({ kind, error }));
invariant(requiredKinds.length > 0, "production enemy runtime contract resolved no required enemies/bosses");
invariant(runtimeContract.unknownReachableKinds.length === 0,
  `runtime stage plan contains unregistered kinds: ${runtimeContract.unknownReachableKinds.join(",")}`);
invariant(runtimeContract.missingBossKinds.length === 0,
  `runtime stage plan omits registered bosses: ${runtimeContract.missingBossKinds.join(",")}`);
invariant(missingKinds.length === 0, `production sprite inventory is missing required kinds: ${missingKinds.join(",")}`);
invariant(duplicateCoverage.length === 0, `production sprite inventory duplicates coverage: ${duplicateCoverage.join(",")}`);
invariant(unknownInventoryKinds.length === 0, `production sprite inventory has unregistered kinds: ${unknownInventoryKinds.join(",")}`);
invariant(extraInventoryKinds.length === 0, `production sprite inventory has non-reachable extra kinds: ${extraInventoryKinds.join(",")}`);
invariant(runtimeSpriteStateMissing.length === 0,
  `required runtime sprite/state is missing: ${JSON.stringify(runtimeSpriteStateMissing)}`);
const requestedKinds = (process.env.V0995_ENEMY_QA_KINDS ?? requiredKinds.join(","))
  .split(",").map((value) => value.trim()).filter(Boolean);
invariant(requestedKinds.length > 0 && new Set(requestedKinds).size === requestedKinds.length,
  "V0995_ENEMY_QA_KINDS must be a non-empty unique subset");
invariant(requestedKinds.every((kind) => requiredSet.has(kind)),
  `V0995_ENEMY_QA_KINDS contains an unknown production kind: ${requestedKinds.filter((kind) => !requiredSet.has(kind)).join(",")}`);
const inventory = requestedKinds;
const phases = ["move", "attack", "hit", "die"];
const results = [];
const representativeShots = [];

function diagnosticsFor(page) {
  let phase = "setup";
  const requestStartedAt = new WeakMap();
  const pageClockCalibrations = [];
  const diagnostics = { consoleErrors: [], pageErrors: [], requestFailures: [], requestFailureDetails: [], httpErrors: [] };
  page.on("console", (message) => { if (message.type() === "error") diagnostics.consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(String(error)));
  page.on("request", (request) => requestStartedAt.set(request, Date.now()));
  page.on("requestfailed", (request) => {
    const detail = { url: request.url(), errorText: request.failure()?.errorText ?? "unknown", startedAt: requestStartedAt.get(request) ?? Date.now(), failedAt: Date.now(), phase };
    diagnostics.requestFailures.push(`${detail.url} :: ${detail.errorText}`);
    diagnostics.requestFailureDetails.push(detail);
  });
  page.on("response", (response) => { if (response.status() >= 400) diagnostics.httpErrors.push(`${response.status()} ${response.url()}`); });
  return {
    diagnostics,
    calibrate: async (label) => {
      const nodeBefore = Date.now();
      const pageNow = await page.evaluate(() => Date.now());
      const nodeAfter = Date.now();
      pageClockCalibrations.push({ label, nodeBefore, nodeAfter, pageNow });
    },
    sealSetup: async () => {
      const asset = await page.evaluate(() => ({
        state: window.__ASHFALL_ASSET_QA__?.getState?.() ?? null,
        history: window.__ASHFALL_ASSET_QA__?.getHistory?.() ?? [],
        requiredSprites: window.__ASHFALL_ASSET_QA__?.getRequiredPlan?.().sprites ?? [],
        loadedSpriteKeys: window.__ASHFALL_ASSET_QA__?.getLoadedSpriteKeys?.() ?? [],
      }));
      const nodeBefore = Date.now();
      const pageNow = await page.evaluate(() => Date.now());
      const nodeAfter = Date.now();
      pageClockCalibrations.push({ label: "terminal-ready", nodeBefore, nodeAfter, pageNow });
      const setup = structuredClone(diagnostics);
      setup.requestFailureDetails = reconcilePageClockRequestFailures({ failures: setup.requestFailureDetails, calibrations: pageClockCalibrations }).failures;
      const classification = classifySupersededAssetRequestFailures({ failures: setup.requestFailureDetails, history: asset.history, requiredSprites: asset.requiredSprites, loadedSpriteKeys: asset.loadedSpriteKeys, terminalState: asset.state });
      invariant(setup.consoleErrors.length === 0 && setup.pageErrors.length === 0 && setup.httpErrors.length === 0, `setup emitted non-cancellable diagnostics ${JSON.stringify(setup)}`);
      invariant(classification.rejected.length === 0, `unmatched setup request failure ${JSON.stringify(classification.rejected)}`);
      for (const entries of Object.values(diagnostics)) entries.length = 0;
      phase = "post-ready";
      return { asset, rawDiagnostics: setup, acceptedSupersededFailures: classification.accepted, pageClockCalibrations };
    },
  };
}

async function observeStrictCanvasClip(page, viewport, label) {
  const canvas = await page.waitForSelector("canvas.battlefield.active", {
    state: "attached",
    timeout,
  });
  const startedAt = Date.now();
  const deadline = startedAt + Math.min(timeout, 5_000);
  const observations = [];
  while (Date.now() <= deadline) {
    const observation = await canvas.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        attached: element.isConnected,
        active: element.matches("canvas.battlefield.active"),
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      };
    }).catch((error) => ({ error: String(error) }));
    observations.push({ at: Date.now() - startedAt, ...observation });
    if (observation.attached && observation.active
      && [observation.x, observation.y, observation.width, observation.height].every(Number.isFinite)
      && observation.width > 0 && observation.height > 0) {
      return {
        clip: strictCanvasScreenshotClip(observation, viewport),
        observations,
        elapsedMs: Date.now() - startedAt,
      };
    }
    await page.waitForTimeout(16);
  }
  throw new Error(`${label}: active canvas never exposed finite attached geometry ${JSON.stringify(observations.slice(-8))}`);
}

function assertRenderSequence({ engine, viewport, kind, phase, samples }) {
  const label = `${engine}/${viewport.width}x${viewport.height}/${kind}/${phase}`;
  invariant(samples.length >= 2, `${label}: fewer than two runtime samples`);
  const runtime = samples.map(({ audit }) => audit).filter(Boolean);
  // The first telemetry poll can land between the simulation mutation and its
  // next rAF paint (most often in WebKit). Require an actual production paint
  // in the sampled sequence; do not misclassify that pre-paint sample as a
  // product failure. The stricter phase-specific audit below still requires an
  // asset-backed semantic row from the real renderer.
  invariant(runtime.some(({ renderHistory, corpseRenderHistory }) => renderHistory.length > 0 || corpseRenderHistory.length > 0), `${label}: production renderer was not observed`);
  const phaseStates = phase === "move" ? new Set(["start-move", "move", "idle"])
    : phase === "attack" ? new Set(["wind-up", "active", "recovery"])
      : phase === "hit" ? new Set(["hit-light", "hit-heavy"])
        : new Set(["death"]);
  const relevant = runtime.flatMap(({ renderHistory, corpseRenderHistory }) => phase === "die" ? corpseRenderHistory : renderHistory)
    .filter(({ assetReady, requestedState, spriteState }) => assetReady && (phase === "die" ? spriteState === "death" : phaseStates.has(requestedState)));
  invariant(relevant.length > 0, `${label}: no asset-backed render audit ${JSON.stringify(runtime.at(-1)?.renderHistory?.slice(-4))}`);
  const expectedDirection = "left";
  invariant(relevant.every(({ direction }) => direction === expectedDirection), `${label}: render direction flicker ${JSON.stringify(relevant.map(({ direction }) => direction))}`);
  const expectedRows = new Set((phase === "die" ? ["death"] : phase === "move" ? ["idle", "walk-a", "walk-b"] : phase === "hit" ? ["hit"] : ["attack-a", "attack-b"])
    .map((state) => spriteFrameFor(kind, state, expectedDirection).sourceRect.y));
  invariant(relevant.every(({ sourceRow }) => expectedRows.has(sourceRow)), `${label}: semantic row drift ${JSON.stringify(relevant.map(({ sourceRow }) => sourceRow))}`);
  invariant(relevant.every(({ renderWidth, renderHeight }) => Number(renderWidth) > 0 && Number(renderHeight) > 0), `${label}: invalid render scale`);
  const scalePairs = relevant.map(({ renderWidth, renderHeight }) => renderWidth / renderHeight);
  invariant(Math.max(...scalePairs) / Math.min(...scalePairs) <= 1.04, `${label}: aspect/scale drift`);
  invariant(relevant.every(({ groundAnchor }) => Number.isFinite(groundAnchor)), `${label}: missing authored ground anchor`);
  if (phase === "move") {
    invariant(runtime.some(({ fighter }) => fighter && fighter.actualXDelta < -.05), `${label}: actual X delta never moved toward the player base`);
  }
  if (phase === "attack") {
    invariant(runtime.some(({ fighter }) => fighter && fighter.targetId && fighter.targetX < fighter.x), `${label}: actual target was not left of attacker`);
    invariant(runtime.some(({ fighter }) => fighter && (fighter.attackSequence > 0 || fighter.attackWindup > 0 || fighter.attack > 0)), `${label}: normal attack runtime was not observed`);
  }
  if (phase === "hit") invariant(runtime.some(({ fighter }) => fighter && (fighter.flash > 0 || fighter.hp < fighter.maxHp)), `${label}: production damage reaction was not observed`);
  if (phase === "die") invariant(runtime.some(({ corpse }) => corpse?.state), `${label}: production death lifecycle was not observed`);
}

for (const engine of engines) {
  const browserType = playwright[engine];
  invariant(browserType, `unknown browser ${engine}`);
  const browser = await browserType.launch({ headless: true });
  let primaryError = null;
  try {
    for (const viewport of viewports) {
      for (const kind of inventory) {
        // A context owns exactly one audited production atlas. This prevents a
        // hosted WebKit evidence process from retaining every previously
        // decoded high-resolution atlas while preserving the same production
        // simulation, renderer, semantic checks and four phase screenshots.
        const context = await browser.newContext({ viewport });
        let caseError = null;
        let diagnosticControl = null;
        let activeEvidence = { engine, viewport, kind, phase: "setup" };
        try {
          const page = await context.newPage();
          diagnosticControl = diagnosticsFor(page);
          const url = new URL(baseUrl);
          url.search = new URLSearchParams({ qa: "mission", stage: "3", state: "start", qaEnemyRuntime: "1" }).toString();
          const response = await page.goto(url.href, { waitUntil: "domcontentloaded", timeout });
          invariant(response?.ok(), `${engine}/${viewport.width}x${viewport.height}/${kind}: navigation failed`);
          await diagnosticControl.calibrate("post-navigation");
          await dismissInstallOffer(page, { timeout });
          await page.waitForFunction(() => document.documentElement.dataset.assetLoadState === "ready"
            && typeof window.__ASHFALL_BATTLE_QA__?.prepareEnemyFacingRuntimeProof === "function"
            && typeof window.__ASHFALL_BATTLE_QA__?.ensureEnemyFacingProofAsset === "function", null, { timeout }).catch(async (error) => {
            const debug = await page.evaluate(() => ({
              href: location.href,
              screen: document.querySelector(".game-shell")?.getAttribute("data-screen") ?? null,
              assetState: document.documentElement.dataset.assetLoadState ?? null,
              asset: window.__ASHFALL_ASSET_QA__?.getState?.() ?? null,
              battleBridge: typeof window.__ASHFALL_BATTLE_QA__?.prepareEnemyFacingRuntimeProof,
              body: document.body.innerText.slice(0, 500),
            }));
            throw new Error(`runtime bridge timeout ${JSON.stringify(debug)}`, { cause: error });
          });
          console.log(`[v0995-enemy-runtime] ${engine}/${viewport.width}x${viewport.height}/${kind}`);
          const asset = await page.evaluate((candidate) => window.__ASHFALL_BATTLE_QA__.ensureEnemyFacingProofAsset(candidate), kind);
          invariant(asset.kind === kind && asset.width > 0 && asset.height > 0, `${engine}/${viewport.width}x${viewport.height}/${kind}: production sprite did not decode ${JSON.stringify(asset)}`);
          const assetSetupBoundary = await diagnosticControl.sealSetup();
          for (const phase of phases) {
            activeEvidence = { engine, viewport, kind, phase, assetSetupBoundary, prepared: null, samples: [], capture: null };
            const prepared = await page.evaluate(({ kind, phase }) => window.__ASHFALL_BATTLE_QA__.prepareEnemyFacingRuntimeProof({ kind, phase }), { kind, phase });
            activeEvidence.prepared = prepared;
            const samples = activeEvidence.samples;
            const started = performance.now();
            while (performance.now() - started < (phase === "attack" ? 2_600 : 1_500)) {
              await page.waitForTimeout(40);
              const audit = await page.evaluate((fighterId) => window.__ASHFALL_BATTLE_QA__.getEnemyFacingRuntimeAudit(fighterId), prepared.fighterId);
              samples.push({ at: performance.now() - started, audit });
              if (samples.length >= 2 && phase === "move" && audit.fighter?.actualXDelta < -.05 && audit.renderHistory.length >= 3) break;
              if (samples.length >= 2 && phase === "attack" && audit.fighter && (audit.fighter.attackSequence > 0 || audit.fighter.attack > 0) && audit.renderHistory.length >= 3) break;
              if (samples.length >= 2 && phase === "hit" && audit.fighter && audit.fighter.hp < audit.fighter.maxHp && audit.renderHistory.length >= 3) break;
              if (samples.length >= 2 && phase === "die" && audit.corpse && audit.corpseRenderHistory.length >= 2) break;
            }
            assertRenderSequence({ engine, viewport, kind, phase, samples });
            const screenshotFile = path.join(outputDir, `${engine}-${viewport.width}x${viewport.height}-${kind}-${phase}.png`);
            const canvasObservation = await observeStrictCanvasClip(
              page,
              viewport,
              `${engine}/${viewport.width}x${viewport.height}/${kind}/${phase}`,
            );
            const clip = canvasObservation.clip;
            activeEvidence.capture = { status: "pending", screenshotFile, canvasObservation, clip };
            const captureStartedAt = Date.now();
            const preCapture = await page.evaluate((fighterId) => (
              window.__ASHFALL_BATTLE_QA__.getEnemyFacingRuntimeAudit(fighterId)
            ), prepared.fighterId);
            activeEvidence.capture.preCapture = preCapture;
            activeEvidence.capture.startedAt = captureStartedAt;
            await page.screenshot({ path: screenshotFile, clip, timeout });
            activeEvidence.capture.status = "screenshot-written";
            const postCapture = await page.evaluate((fighterId) => (
              window.__ASHFALL_BATTLE_QA__.getEnemyFacingRuntimeAudit(fighterId)
            ), prepared.fighterId);
            activeEvidence.capture.postCapture = postCapture;
            const capture = {
              mode: "strict-page-clip",
              attemptCount: 1,
              startedAt: new Date(captureStartedAt).toISOString(),
              elapsedMs: Date.now() - captureStartedAt,
              clip,
              canvasObservation,
              pre: {
                fighter: preCapture?.fighter ?? null,
                renderCount: preCapture?.renderHistory?.length ?? 0,
                corpseRenderCount: preCapture?.corpseRenderHistory?.length ?? 0,
              },
              post: {
                fighter: postCapture?.fighter ?? null,
                renderCount: postCapture?.renderHistory?.length ?? 0,
                corpseRenderCount: postCapture?.corpseRenderHistory?.length ?? 0,
              },
            };
            if (["walker", "resonator", "takuya"].includes(kind) && ["move", "attack", "die"].includes(phase)) representativeShots.push(screenshotFile);
            results.push({ engine, viewport, kind, phase, prepared, samples, capture, assetSetupBoundary, screenshot: path.relative(process.cwd(), screenshotFile).replaceAll("\\", "/") });
          }
          const postReady = diagnosticControl.diagnostics;
          invariant(Object.values(postReady).every((entries) => entries.length === 0), `${engine}/${viewport.width}x${viewport.height}/${kind}: post-ready diagnostics ${JSON.stringify(postReady)}`);
        } catch (error) {
          caseError = error;
          try {
            await writeFile(path.join(outputDir, "enemy-runtime-failure.json"), `${JSON.stringify(enemyRuntimeFailureRecord({
              error, active: activeEvidence, results, diagnostics: diagnosticControl?.diagnostics,
            }), null, 2)}\n`);
          } catch (persistenceError) {
            console.error("enemy runtime failure evidence persistence failed", persistenceError);
          }
          throw error;
        } finally {
          try { await context.close(); } catch (cleanupError) {
            if (!caseError) throw cleanupError;
            console.error("enemy runtime secondary context cleanup failure", cleanupError);
          }
        }
      }
    }
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    try { await browser.close(); } catch (cleanupError) {
      if (!primaryError) throw cleanupError;
      console.error("enemy runtime secondary browser cleanup failure", cleanupError);
    }
  }
}

const rawFile = path.join(outputDir, "enemy-runtime-report.json");
await writeFile(rawFile, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  runtimeContract: {
    requiredKinds,
    missingKinds,
    duplicateCoverage,
    unknownInventoryKinds,
    extraInventoryKinds,
    runtimeSpriteStateMissing,
    unknownReachableKinds: runtimeContract.unknownReachableKinds,
    missingBossKinds: runtimeContract.missingBossKinds,
  },
  fullInventory,
  inventory,
  results,
}, null, 2)}\n`);
const compact = {
  generatedAt: new Date().toISOString(),
  fullInventoryCount: fullInventory.length,
  inventoryCount: inventory.length,
  requiredInventoryCount: requiredKinds.length,
  missingKinds,
  duplicateCoverage,
  unknownInventoryKinds,
  extraInventoryKinds,
  runtimeSpriteStateMissing,
  engines,
  viewports,
  phases,
  caseCount: results.length,
  allAssetBacked: results.every(({ samples }) => samples.some(({ audit }) => audit.renderHistory.some(({ assetReady }) => assetReady) || audit.corpseRenderHistory.some(({ assetReady }) => assetReady))),
  failures: [],
};
const compactFile = path.join(compactDir, "runtime-summary.json");
await writeFile(compactFile, `${JSON.stringify(compact, null, 2)}\n`);
const tiles = representativeShots.slice(0, 9);
if (tiles.length > 0) {
  const width = 320;
  const height = 180;
  const inputs = await Promise.all(tiles.map(async (file, index) => ({
    input: await sharp(file).resize(width, height, { fit: "cover" }).png().toBuffer(),
    left: (index % 3) * width,
    top: Math.floor(index / 3) * height,
  })));
  await sharp({ create: { width: width * 3, height: height * Math.ceil(inputs.length / 3), channels: 4, background: "#111" } })
    .composite(inputs).png().toFile(path.join(compactDir, "runtime-representative-contact-sheet.png"));
}
const digest = createHash("sha256").update(await readFile(rawFile)).digest("hex");
console.log(JSON.stringify({ status: "passed", cases: results.length, expected: engines.length * viewports.length * inventory.length * phases.length, rawFile, compactFile, digest }, null, 2));
