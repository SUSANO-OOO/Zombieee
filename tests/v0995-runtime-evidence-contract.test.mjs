import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { productionEnemyRuntimeContract } from "../app/productionEnemyRuntime.js";
import { productionVisualIntegrityInventory } from "../app/visualIntegrityInventory.js";

const enemyHarness = await readFile(new URL("../scripts/v0995-enemy-runtime-browser-smoke.mjs", import.meta.url), "utf8");
const visualHarness = await readFile(new URL("../scripts/v0995-visual-integrity-browser-smoke.mjs", import.meta.url), "utf8");
const finalRemediationHarness = await readFile(new URL("../scripts/v099-final-remediation-browser-smoke.mjs", import.meta.url), "utf8");
const gameSource = await readFile(new URL("../app/AshfallGame.tsx", import.meta.url), "utf8");

test("F3 runtime evidence is finite, uses production draw/runtime, and observes every semantic state", () => {
  const runtimeContract = productionEnemyRuntimeContract();
  const inventoryKinds = productionVisualIntegrityInventory().enemies.map(({ kind }) => kind);
  assert.deepEqual(new Set(inventoryKinds), new Set(runtimeContract.requiredEnemyKinds));
  assert.equal(runtimeContract.unknownReachableKinds.length, 0);
  assert.equal(runtimeContract.missingBossKinds.length, 0);
  assert.match(enemyHarness, /const fullInventory = productionVisualIntegrityInventory/);
  assert.match(enemyHarness, /const runtimeContract = productionEnemyRuntimeContract/);
  assert.match(enemyHarness, /const missingKinds = requiredKinds.filter/);
  assert.match(enemyHarness, /const duplicateCoverage = fullInventory/);
  assert.match(enemyHarness, /const unknownInventoryKinds = fullInventory/);
  assert.match(enemyHarness, /const runtimeSpriteStateMissing = runtimeContract.spriteRequirements/);
  assert.match(enemyHarness, /V0995_ENEMY_QA_KINDS/);
  assert.match(enemyHarness, /requestedKinds\.every\(\(kind\) => requiredSet\.has\(kind\)\)/);
  for (const state of ["move", "attack", "hit", "die"]) {
    assert.match(enemyHarness, new RegExp(`"${state}"`));
  }
  assert.match(enemyHarness, /prepareEnemyFacingRuntimeProof/);
  assert.match(enemyHarness, /ensureEnemyFacingProofAsset/);
  assert.match(gameSource, /ensureUnitRenderProofAsset:[\s\S]*?requireDecode:\s*true[\s\S]*?decodedBattleImagesRef\.current\.add\(image\)/u);
  assert.match(visualHarness, /ensureUnitRenderProofAsset\("engineer"\)/u);
  assert.match(enemyHarness, /actualXDelta/);
  assert.match(enemyHarness, /targetX/);
  assert.match(enemyHarness, /sourceRow/);
  assert.match(enemyHarness, /renderWidth/);
  assert.match(enemyHarness, /groundAnchor/);
  assert.match(enemyHarness, /runtime\.some\(\(\{ renderHistory, corpseRenderHistory \}\)/);
  assert.doesNotMatch(enemyHarness, /runtime\.every\(\(\{ renderHistory, corpseRenderHistory \}\)/);
  assert.match(enemyHarness, /for \(const kind of inventory\) \{[\s\S]*?const context = await browser\.newContext\(\{ viewport \}\)/);
  assert.match(enemyHarness, /finally \{[\s\S]*?await context\.close\(\)/);
  assert.match(enemyHarness, /observeStrictCanvasClip\(/);
  assert.match(enemyHarness, /element\.isConnected/);
  assert.match(enemyHarness, /element\.matches\("canvas\.battlefield\.active"\)/);
  assert.match(enemyHarness, /strictCanvasScreenshotClip\(observation, viewport\)/);
  assert.match(enemyHarness, /page\.screenshot\(\{ path: screenshotFile, clip, timeout \}\)/);
  assert.match(enemyHarness, /attemptCount: 1/);
  assert.match(enemyHarness, /diagnosticsFor\(page\)/);
  assert.match(enemyHarness, /calibrate\("post-navigation"\)/);
  assert.match(enemyHarness, /sealSetup\(\)/);
  assert.match(enemyHarness, /classifySupersededAssetRequestFailures/);
  assert.match(enemyHarness, /reconcilePageClockRequestFailures/);
  assert.match(enemyHarness, /phase = "post-ready"/);
  assert.match(enemyHarness, /post-ready diagnostics/);
  assert.doesNotMatch(enemyHarness, /locator\("canvas\.battlefield\.active"\)\.screenshot/);
  assert.match(gameSource, /const enemy = spawnEnemy\(g, kind, lane\)/);
  assert.match(gameSource, /loadImageWithTimeout\(\{[\s\S]*?src: path,[\s\S]*?requireDecode: true/);
  assert.match(gameSource, /includeAllSprites: localQaRequested[\s\S]*?&& !finiteEnemyRuntimeQa[\s\S]*?&& !finiteVisualIntegrityQa/);
  assert.match(gameSource, /getRequiredPlan:[\s\S]*?const finiteHud = parameters\.get\("qaHudFiniteAssets"\) === "1"[\s\S]*?localHost/);
  assert.match(gameSource, /g\.pendingWeaponHits\.push/);
  assert.doesNotMatch(enemyHarness, /result direct|delete.*enemy|drawImage\(/i);
});

test("F4 fault evidence gates the actual mount and verifies mutable final pixels", () => {
  assert.match(visualHarness, /getBattleMountState/);
  assert.match(visualHarness, /startAssetFaultProof/);
  assert.match(visualHarness, /canPlay === false && blocked\.mount\.battleMounted === false/);
  assert.match(visualHarness, /fallbackDrawCount === 0/);
  assert.match(visualHarness, /setStationMissionPixelAuditState/);
  assert.match(visualHarness, /mutable mission states collapsed to the same authored pixels/);
  assert.match(visualHarness, /retrySession\.total === intendedFailurePaths\.size/);
  assert.match(visualHarness, /retrySession\.status === "ready"/);
  for (const mode of ["decode-reject", "decode-timeout"]) {
    assert.match(visualHarness, new RegExp(`"${mode}"`, "u"));
  }
  assert.match(visualHarness, /terminalSession\.failures\[0\]\.reason === expectedFailureReason/);
  assert.match(visualHarness, /getDecodedRequiredPaths/);
  assert.match(visualHarness, /missingDecodedSuccesses\.length === 0/);
  assert.match(visualHarness, /prepareCrawlerDefenseProof/);
  assert.match(visualHarness, /queueCrawlerDefenseUnit\("engineer", 1\)/);
  assert.match(visualHarness, /Monkey approved atlas was not consumed by the production renderer/);
  assert.match(visualHarness, /finalCompositePixels\?\.singleUnitSilhouette === true/);
  assert.doesNotMatch(visualHarness, /campaign-primary/);
  assert.match(gameSource, /screen !== "battle" \|\| !assetsReady \|\| assetError/);
});

test("r6 deployment diagnostics are bounded and preserve the existing acceptance contract", () => {
  assert.match(finalRemediationHarness, /DIAGNOSTIC_TRACE_INTERVAL_MS = 250/);
  assert.match(finalRemediationHarness, /DIAGNOSTIC_TRACE_MAX_SAMPLES = 160/);
  assert.match(finalRemediationHarness, /function createSetupTrace\(/);
  assert.match(finalRemediationHarness, /battleApiPresent/);
  assert.match(finalRemediationHarness, /assetApiPresent/);
  assert.match(finalRemediationHarness, /consoleErrorCount/);
  assert.match(finalRemediationHarness, /pendingRequestCount/);
  assert.match(finalRemediationHarness, /setupTraceFailureScreenshot/);
  assert.match(finalRemediationHarness, /function createDeploymentTrace\(/);
  assert.match(finalRemediationHarness, /expectedCheckpoint/);
  assert.match(finalRemediationHarness, /finalCompositePixels/);
  assert.match(finalRemediationHarness, /failureScreenshot: result\.failureScreenshot/);
  assert.match(finalRemediationHarness, /maximumMs: timeout/);
  assert.match(finalRemediationHarness, /CRAWLER_DEPLOYMENT_CHECKPOINTS\.entries\(\)/);
});
