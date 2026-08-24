import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { productionEnemyRuntimeContract } from "../app/productionEnemyRuntime.js";
import { productionVisualIntegrityInventory } from "../app/visualIntegrityInventory.js";
import {
  parseWebKitHostProcStat,
  webKitHostProcessRole,
  webKitHostTelemetryValidity,
} from "../scripts/webkit-host-resource-telemetry.mjs";

const enemyHarness = await readFile(new URL("../scripts/v0995-enemy-runtime-browser-smoke.mjs", import.meta.url), "utf8");
const visualHarness = await readFile(new URL("../scripts/v0995-visual-integrity-browser-smoke.mjs", import.meta.url), "utf8");
const finalRemediationHarness = await readFile(new URL("../scripts/v099-final-remediation-browser-smoke.mjs", import.meta.url), "utf8");
const boundedDeploymentHarness = await readFile(new URL("../scripts/run-v099-deployment-units-bounded.mjs", import.meta.url), "utf8");
const hostTelemetrySource = await readFile(new URL("../scripts/webkit-host-resource-telemetry.mjs", import.meta.url), "utf8");
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
  assert.match(visualHarness, /import \{ createWebKitHostResourceTelemetry \} from "\.\/webkit-host-resource-telemetry\.mjs"/u);
  assert.match(visualHarness, /label: `\$\{engineName\}-visual-integrity`/u);
  assert.match(visualHarness, /attemptCount: 1/u);
  assert.match(visualHarness, /terminalFailure/u);
  assert.match(visualHarness, /hostResourceTelemetryResults/u);
  assert.match(visualHarness, /page\.on\("crash"/u);
  assert.match(visualHarness, /browser\.on\("disconnected"/u);
  assert.match(visualHarness, /const launchCaseBrowser = async \(details\)/u);
  assert.match(visualHarness, /const closeCaseBrowser = async \(details\)/u);
  assert.equal((visualHarness.match(/await launchCaseBrowser\(caseDetails\)/gu) ?? []).length, 2);
  assert.equal((visualHarness.match(/await closeCaseBrowser\(caseDetails\)/gu) ?? []).length, 2);
  assert.match(visualHarness, /for \(const viewport of viewports\) \{[\s\S]*?await launchCaseBrowser\(caseDetails\);[\s\S]*?await closeCaseBrowser\(caseDetails\);/u);
  assert.match(visualHarness, /for \(const faultViewport of faultViewports\) \{[\s\S]*?await launchCaseBrowser\(caseDetails\);[\s\S]*?await closeCaseBrowser\(caseDetails\);/u);
  assert.doesNotMatch(visualHarness, /try \{\r?\n\s*browser = await browserType\.launch/u);
  assert.doesNotMatch(visualHarness, /attempt < 2|retrying .* transient browser closure|isTransientBrowserClosure/u);
});

test("r6 deployment diagnostics are bounded and preserve the existing acceptance contract", () => {
  assert.match(finalRemediationHarness, /import \{ createWebKitHostResourceTelemetry \} from "\.\/webkit-host-resource-telemetry\.mjs"/u);
  assert.match(boundedDeploymentHarness, /import \{ createWebKitHostResourceTelemetry \} from "\.\/webkit-host-resource-telemetry\.mjs"/u);
  assert.match(finalRemediationHarness, /caseType === "deployment"[\s\S]*await createWebKitHostResourceTelemetry\(\{/u);
  assert.match(finalRemediationHarness, /hostResourceTelemetry\?\.event\(event/u);
  assert.match(finalRemediationHarness, /await hostResourceTelemetry\?\.stop\(\{/u);
  assert.match(finalRemediationHarness, /hostResourceTelemetry: hostResourceTelemetry\?\.reference\(\) \?\? null/u);
  assert.match(boundedDeploymentHarness, /label: "bounded-deployment-parent"/u);
  assert.match(boundedDeploymentHarness, /createHostResourceTelemetry = createWebKitHostResourceTelemetry/u);
  assert.match(boundedDeploymentHarness, /createHostResourceTelemetry !== createWebKitHostResourceTelemetry && typeof runAttempt !== "function"/u);
  assert.match(boundedDeploymentHarness, /await createHostResourceTelemetry\(\{/u);
  assert.ok(boundedDeploymentHarness.indexOf("await createHostResourceTelemetry({")
    < boundedDeploymentHarness.indexOf("for (const kind of kinds)"));
  assert.match(boundedDeploymentHarness, /hostResourceTelemetry\.event\("unit-child-start"/u);
  assert.match(boundedDeploymentHarness, /hostResourceTelemetry\.event\("unit-child-exit"/u);
  assert.match(boundedDeploymentHarness, /catch \(error\) \{[\s\S]*status: "runner-error"[\s\S]*throw error/u);
  assert.match(boundedDeploymentHarness, /finally \{[\s\S]*hostResourceTelemetry\.stop\(\{/u);
  assert.match(boundedDeploymentHarness, /hostResourceTelemetry: hostResourceTelemetry\.reference\(\)/u);
  assert.match(hostTelemetrySource, /WEBKIT_HOST_RESOURCE_TELEMETRY_INTERVAL_MS = 500/u);
  const parsedStat = parseWebKitHostProcStat(`321 (WPEWeb)Process) S ${Array.from({ length: 25 }, (_, index) => index + 1).join(" ")}`);
  assert.deepEqual(parsedStat, {
    pid: 321,
    name: "WPEWeb)Process",
    state: "S",
    ppid: 1,
    startTicks: 19,
    virtualBytes: 20,
  });
  assert.equal(webKitHostProcessRole("WPEWebProcess"), "webkit-web-content");
  assert.equal(webKitHostProcessRole("WPENetworkProcess"), "webkit-network");
  assert.equal(webKitHostProcessRole("WPEGPUProcess"), "webkit-gpu");
  assert.deepEqual(webKitHostTelemetryValidity({ supported: false, rootObservedCount: 0, webContentObservedCount: 0 }), {
    valid: null,
    invalidReason: null,
  });
  assert.deepEqual(webKitHostTelemetryValidity({ supported: true, rootObservedCount: 0, webContentObservedCount: 0 }), {
    valid: false,
    invalidReason: "root-process-never-observed",
  });
  assert.deepEqual(webKitHostTelemetryValidity({ supported: true, rootObservedCount: 1, webContentObservedCount: 0 }), {
    valid: false,
    invalidReason: "webkit-web-content-never-observed",
  });
  assert.deepEqual(webKitHostTelemetryValidity({ supported: true, rootObservedCount: 1, webContentObservedCount: 1 }), {
    valid: true,
    invalidReason: null,
  });
  assert.match(hostTelemetrySource, /linux-proc-cgroup-unavailable/u);
  assert.match(hostTelemetrySource, /pid === rootPid \? `\$\{PROC_ROOT\}\/self`/u);
  assert.match(hostTelemetrySource, /root-process-never-observed/u);
  assert.match(hostTelemetrySource, /webkit-web-content-never-observed/u);
  assert.match(hostTelemetrySource, /status = writeError \? "failed" : invalidReason \? "invalid" : "complete"/u);
  assert.match(hostTelemetrySource, /boundedProcParentIndex/u);
  assert.match(hostTelemetrySource, /lastKnownWebKitRoleSet/u);
  assert.match(hostTelemetrySource, /disappearedRoles/u);
  assert.match(hostTelemetrySource, /descendantLeftovers/u);
  assert.match(hostTelemetrySource, /persistedEntries\.length !== expectedEntryCount/u);
  assert.match(hostTelemetrySource, /normalized\.startsWith\("webkitweb"\)/u);
  assert.doesNotMatch(hostTelemetrySource, /node:child_process|\bspawn\s*\(|\bexec\s*\(|process\.env|page\.|mouse\.|keyboard\.|evaluate\s*\(/u);
  assert.match(boundedDeploymentHarness, /hostResourceTelemetryValid/u);
  assert.match(boundedDeploymentHarness, /hostResourceTelemetryInvalidReason/u);
  assert.match(boundedDeploymentHarness, /failed at \$\{failedAt\}/u);
  const fighterAudit = gameSource.match(/function fighterUnitLayerPixelAudit[\s\S]+?(?=\r?\nfunction drawEnemyCombatReadabilityVfx)/u)?.[0] ?? "";
  assert.match(fighterAudit, /canvas\.width = width;[\s\S]*canvas\.height = height;/u);
  assert.match(fighterAudit, /foregroundCanvas\.width = width;[\s\S]*foregroundCanvas\.height = height;/u);
  assert.match(fighterAudit, /compositeCanvas\.width = width;[\s\S]*compositeCanvas\.height = height;/u);
  assert.equal((fighterAudit.match(/\.translate\(-left, -top\)/gu) ?? []).length, 3);
  assert.match(fighterAudit, /ctx\.translate\(-left, -top\);[\s\S]*drawSpriteFighter/u);
  assert.match(fighterAudit, /foregroundContext\.translate\(-left, -top\);[\s\S]*drawCrawlerForegroundMask/u);
  assert.match(fighterAudit, /compositeContext\.translate\(-left, -top\);[\s\S]*drawCrawler\(compositeContext/u);
  assert.match(fighterAudit, /ctx\.getImageData\(0, 0, width, height\)/u);
  assert.match(fighterAudit, /foregroundContext\.getImageData\(0, 0, width, height\)/u);
  assert.match(fighterAudit, /compositeContext\.getImageData\(0, 0, width, height\)/u);
  assert.doesNotMatch(fighterAudit, /(?:canvas|foregroundCanvas|compositeCanvas)\.(?:width|height) = [WH];/u);
  assert.match(finalRemediationHarness, /WEBKIT_HOST_TELEMETRY_INVALID/u);
  assert.match(finalRemediationHarness, /priorFailure\.hostResourceTelemetryFailure/u);
  assert.match(finalRemediationHarness, /DIAGNOSTIC_TRACE_INTERVAL_MS = 250/);
  assert.match(finalRemediationHarness, /DIAGNOSTIC_TRACE_MAX_SAMPLES = 160/);
  assert.match(finalRemediationHarness, /function createSetupTrace\(/);
  assert.match(finalRemediationHarness, /battleApiPresent/);
  assert.match(finalRemediationHarness, /assetApiPresent/);
  assert.match(finalRemediationHarness, /consoleErrorCount/);
  assert.match(finalRemediationHarness, /pendingRequestCount/);
  assert.match(finalRemediationHarness, /setupTraceFailureScreenshot/);
  const boundedTrace = finalRemediationHarness.match(/function createBoundedTrace[\s\S]+?(?=\nfunction setupRuntimeState)/u)?.[0] ?? "";
  assert.match(boundedTrace, /automaticInterval = true/u);
  assert.match(boundedTrace, /if \(automaticInterval\) \{[\s\S]*void capture\(\);[\s\S]*setInterval/u);
  assert.match(boundedTrace, /captureMode: automaticInterval \? "automatic-interval" : "cooperative-main-flow"/u);
  assert.match(boundedTrace, /captureAttemptCount/u);
  assert.match(boundedTrace, /overlapWaitCount/u);
  assert.match(finalRemediationHarness, /function createDeploymentTrace\(/);
  assert.match(finalRemediationHarness, /expectedCheckpoint/);
  const deploymentTrace = finalRemediationHarness.match(/function createDeploymentTrace[\s\S]+?(?=\nfunction validateDeploymentCheckpoint)/u)?.[0] ?? "";
  assert.match(deploymentTrace, /computedProgress/u);
  assert.match(deploymentTrace, /readableSnapshot/u);
  assert.match(deploymentTrace, /getCrawlerDeploymentProofSnapshot/u);
  assert.match(deploymentTrace, /automaticInterval: false/u);
  assert.match(deploymentTrace, /capture: trace\.capture/u);
  assert.doesNotMatch(deploymentTrace, /setInterval|void capture\(\)/u);
  assert.doesNotMatch(deploymentTrace, /auditFighterUnitLayer|finalCompositePixels|getImageData/u);
  assert.doesNotMatch(deploymentTrace, /getSnapshot/u);
  const firstFrame = finalRemediationHarness.match(/async function queueAndPauseAtFirstDeploymentFrame[\s\S]+?(?=\nfunction createDeploymentTrace)/u)?.[0] ?? "";
  assert.match(finalRemediationHarness, /DEPLOYMENT_FIRST_FRAME_SAMPLE_INTERVAL_MS = 100/u);
  assert.match(firstFrame, /hostTurn\(DEPLOYMENT_FIRST_FRAME_SAMPLE_INTERVAL_MS\)/u);
  assert.match(firstFrame, /getCrawlerDeploymentProofSnapshot/u);
  assert.match(firstFrame, /progress === 0/u);
  assert.match(firstFrame, /captureTrace = null/u);
  assert.ok((firstFrame.match(/if \(captureTrace\) await captureTrace\(\)/gu) ?? []).length >= 3);
  assert.equal((firstFrame.match(/auditFighterUnitLayer/gu) ?? []).length, 1);
  assert.doesNotMatch(firstFrame, /requestAnimationFrame|getSnapshot|page\.waitForTimeout/u);
  const checkpoint = finalRemediationHarness.match(/async function pauseAtDeploymentCheckpoint[\s\S]+?(?=\nasync function queueAndPauseAtFirstDeploymentFrame)/u)?.[0] ?? "";
  assert.equal((checkpoint.match(/armCrawlerDeploymentCheckpoint/gu) ?? []).length, 1);
  assert.match(checkpoint, /getCrawlerDeploymentProofSnapshot/u);
  assert.match(checkpoint, /v099-crawler-deployment-checkpoint-receipt\/v1/u);
  assert.match(checkpoint, /checkpointReceipt/u);
  assert.match(checkpoint, /hostTurn\(DEPLOYMENT_FIRST_FRAME_SAMPLE_INTERVAL_MS\)/u);
  assert.match(checkpoint, /captureTrace = null/u);
  assert.equal((checkpoint.match(/if \(captureTrace\) await captureTrace\(\)/gu) ?? []).length, 3);
  assert.equal((checkpoint.match(/auditFighterUnitLayer/gu) ?? []).length, 1);
  assert.doesNotMatch(checkpoint, /setRepresentativeSixProofPaused\(true\)|requiredProgress|requestAnimationFrame|getSnapshot|waitForFunction|page\.waitForTimeout/u);
  const canvasCapture = finalRemediationHarness.match(/async function deploymentCanvasPng[\s\S]+?(?=\nasync function crawlerRuntimeContactSheet)/u)?.[0] ?? "";
  assert.match(canvasCapture, /canvas\.battlefield\.active/u);
  assert.match(canvasCapture, /canvas\.toDataURL\("image\/png"\)/u);
  assert.match(canvasCapture, /metadata\.format === "png"/u);
  assert.match(canvasCapture, /metadata\.width === serialized\.width/u);
  assert.match(canvasCapture, /await writeFile\(screenshotPath, bytes\)/u);
  assert.doesNotMatch(canvasCapture, /page\.screenshot|locator\(.+screenshot/u);
  const deploymentContactSheet = finalRemediationHarness.match(/async function deploymentRuntimeContactSheet[\s\S]+?(?=\nasync function evidenceSha256)/u)?.[0] ?? "";
  assert.match(deploymentContactSheet, /deploymentRuntimeContactSheet\(name, family, kind, viewport, entries\)/u);
  assert.match(deploymentContactSheet, /\$\{name\}-deployment-\$\{family\}-\$\{kind\}-contact-sheet\.png/u);
  assert.doesNotMatch(deploymentContactSheet, /\$\{name\}-deployment-\$\{family\}-contact-sheet\.png/u);
  const artifactIntegrity = finalRemediationHarness.match(/function collectDeploymentArtifactInventory[\s\S]+?(?=\nasync function enterLegacyQaBattle)/u)?.[0] ?? "";
  assert.match(artifactIntegrity, /v099-deployment-artifact-integrity\/v1/u);
  assert.match(artifactIntegrity, /pathOccurrences/u);
  assert.match(artifactIntegrity, /duplicatePaths/u);
  assert.match(artifactIntegrity, /await stat\(path\.resolve\(entry\.path\)\)/u);
  assert.match(artifactIntegrity, /!file\.isFile\(\) \|\| file\.size <= 0/u);
  assert.match(artifactIntegrity, /await evidenceSha256\(entry\.path\)/u);
  assert.match(artifactIntegrity, /diskSha256 !== entry\.recordedSha256/u);
  assert.match(artifactIntegrity, /diskShaVerifiedCount/u);
  assert.match(artifactIntegrity, /diagnosticLimit = 64/u);
  assert.doesNotMatch(artifactIntegrity, /canonicalAxes|new Set\([^)]*recordedSha256/u);
  const deploymentCase = finalRemediationHarness.match(/async function runDeploymentCase[\s\S]+?(?=\nconst buildIdentityAtStart)/u)?.[0] ?? "";
  assert.match(finalRemediationHarness, /finiteAssets \|\| \(caseTypes\.length === 1[\s\S]*parameters\.qaHudFiniteAssets = "1"/u);
  assert.match(finalRemediationHarness, /async function waitForBattleReadiness/u);
  const battleReadiness = finalRemediationHarness.match(/async function waitForBattleReadiness[\s\S]+?(?=\nasync function nextRender)/u)?.[0] ?? "";
  assert.match(battleReadiness, /Date\.now\(\) - startedAt < timeout/u);
  assert.match(battleReadiness, /battle readiness timed out/u);
  assert.match(finalRemediationHarness, /asset\?\.state === "error"/u);
  assert.match(finalRemediationHarness, /getFailedPaths/u);
  assert.match(finalRemediationHarness, /setup\.diagnostics\.requestFailureDetails\.length > 0[\s\S]*getHistory/u);
  assert.match(finalRemediationHarness, /historyRead: historyRequired/u);
  assert.match(deploymentCase, /finiteAssets: true/u);
  assert.match(deploymentCase, /ensureUnitRenderProofAsset\(kind\)/u);
  assert.match(deploymentCase, /deploymentCanvasPng/u);
  assert.match(deploymentCase, /canvasCapture/u);
  assert.ok((deploymentCase.match(/activeDeploymentTrace\.capture/gu) ?? []).length >= 5);
  assert.match(deploymentCase, /captureMode === "cooperative-main-flow"/u);
  assert.match(deploymentCase, /overlapWaitCount === 0/u);
  assert.match(deploymentCase, /const receipt = checkpointIndex === 0 \? null : evidence\.checkpointReceipt/u);
  assert.match(deploymentCase, /receipt\?\.schema === "v099-crawler-deployment-checkpoint-receipt\/v1"/u);
  assert.match(deploymentCase, /receipt\.fighterId === fighterId/u);
  assert.match(deploymentCase, /receipt\.kind === unit\.kind/u);
  assert.match(deploymentCase, /receipt\.checkpoint === checkpoint\.id/u);
  assert.match(deploymentCase, /receipt\.x === evidence\.fighter\?\.x/u);
  assert.match(deploymentCase, /receipt\.y === evidence\.fighter\?\.y/u);
  assert.match(deploymentCase, /receipt\.computedProgress === evidence\.observedProgress/u);
  assert.match(deploymentCase, /receipt\.computedProgress \+ 1e-6 >= checkpoint\.progress/u);
  assert.match(deploymentCase, /checkpointReceipt: serializedCheckpointReceipt/u);
  assert.match(deploymentCase, /\$\{name\}-deployment-\$\{unit\.family\}-\$\{unit\.kind\}-\$\{checkpointIndex\}-\$\{checkpoint\.id\}\.png/u);
  assert.match(deploymentCase, /deploymentRuntimeContactSheet\([\s\S]*name,[\s\S]*unit\.family,[\s\S]*unit\.kind,[\s\S]*viewport/u);
  assert.doesNotMatch(deploymentCase, /\$\{name\}-deployment-\$\{unit\.family\}-\$\{checkpointIndex\}/u);
  assert.match(deploymentCase, /schema: receipt\.schema[\s\S]*fighterId: receipt\.fighterId[\s\S]*kind: receipt\.kind[\s\S]*checkpoint: receipt\.checkpoint[\s\S]*x: receipt\.x[\s\S]*y: receipt\.y[\s\S]*computedProgress: receipt\.computedProgress[\s\S]*battleTime: receipt\.battleTime[\s\S]*gateEntering: receipt\.gateEntering[\s\S]*combatReady: receipt\.combatReady[\s\S]*entryRampCleared: receipt\.entryRampCleared/u);
  assert.doesNotMatch(deploymentCase, /checkpointReceipt:\s*evidence\.checkpointReceipt|checkpointArm|readableSnapshot|getSnapshot|requestAnimationFrame|page\.waitForTimeout/u);
  assert.match(gameSource, /getCrawlerDeploymentProofSnapshot:[\s\S]*schema: "v099-crawler-deployment-snapshot\/v1"/u);
  const deploymentArm = gameSource.match(/armCrawlerDeploymentCheckpoint:[\s\S]+?(?=\r?\n      armRepresentativeSixPhasePause:)/u)?.[0] ?? "";
  assert.match(deploymentArm, /CRAWLER_DEPLOYMENT_CHECKPOINTS\.find/u);
  assert.match(deploymentArm, /candidate\.id !== "fully-inside"/u);
  assert.match(deploymentArm, /minimumProgress: checkpointDefinition\.progress/u);
  assert.match(deploymentArm, /qaArmedCrawlerDeploymentCheckpointRef\.current/u);
  assert.match(deploymentArm, /g\.paused = false/u);
  assert.doesNotMatch(deploymentArm, /fighter\.(?:x|y|speed|gateEntrySpeed)\s*=/u);
  const deploymentLatch = gameSource.match(/const armedCheckpoint = qaArmedCrawlerDeploymentCheckpointRef\.current;[\s\S]+?qaArmedCrawlerDeploymentCheckpointRef\.current = null;/u)?.[0] ?? "";
  assert.match(deploymentLatch, /crawlerDeploymentPlanForFighter\(f\)\.checkpoint/u);
  assert.match(deploymentLatch, /computedProgress \+ 1e-6 >= armedCheckpoint\.minimumProgress/u);
  assert.match(deploymentLatch, /g\.paused = true/u);
  assert.match(deploymentLatch, /v099-crawler-deployment-checkpoint-receipt\/v1/u);
  assert.match(deploymentLatch, /qaFrozenCrawlerDeploymentFighterIdRef\.current = f\.id/u);
  assert.doesNotMatch(deploymentLatch, /f\.(?:x|y|speed|gateEntrySpeed)\s*=/u);
  const deploymentSnapshot = gameSource.match(/getCrawlerDeploymentProofSnapshot:[\s\S]+?(?=\r?\n      getPhaseGCombatSnapshot:)/u)?.[0] ?? "";
  assert.match(deploymentSnapshot, /computedProgress/u);
  assert.match(deploymentSnapshot, /checkpointArm/u);
  assert.match(deploymentSnapshot, /checkpointReceipt/u);
  assert.match(deploymentSnapshot, /animationPose/u);
  assert.doesNotMatch(deploymentSnapshot, /getImageData|campaignSave|fighterRenderAuditHistory|saveBoundary/u);
  assert.match(finalRemediationHarness, /finalCompositePixels/);
  assert.match(finalRemediationHarness, /failureScreenshot: result\.failureScreenshot/);
  assert.match(firstFrame, /Date\.now\(\) - startedAt < timeout/u);
  assert.match(checkpoint, /Date\.now\(\) - startedAt < timeout/u);
  assert.match(finalRemediationHarness, /CRAWLER_DEPLOYMENT_CHECKPOINTS\.entries\(\)/);
  const summaryFinalization = finalRemediationHarness.match(/const buildIdentityAtEnd[\s\S]*$/u)?.[0] ?? "";
  assert.match(summaryFinalization, /deploymentScreenshotCount/u);
  assert.match(summaryFinalization, /deploymentContactSheetCount/u);
  assert.match(summaryFinalization, /inspectDeploymentArtifactIntegrity\(results\)/u);
  assert.match(summaryFinalization, /checkpointMatchesDeploymentSummary/u);
  assert.match(summaryFinalization, /contactSheetMatchesDeploymentSummary/u);
  assert.match(summaryFinalization, /checkpointMatchesRouteScreenshotCount/u);
  assert.match(summaryFinalization, /contactSheetMatchesRouteContactSheetCount/u);
  assert.match(summaryFinalization, /summary\.deploymentArtifactIntegrity/u);
  assert.match(summaryFinalization, /invariant\(summary\.deploymentArtifactIntegrity\.ok/u);
  assert.ok(
    summaryFinalization.indexOf("await writeFile(summaryPath")
      < summaryFinalization.indexOf("invariant(summary.deploymentArtifactIntegrity.ok"),
    "failure summary must be persisted before the fail-closed integrity gate",
  );
  assert.ok(
    summaryFinalization.indexOf("invariant(summary.deploymentArtifactIntegrity.ok")
      < summaryFinalization.indexOf("if (canonicalAxes)"),
    "artifact integrity must gate filtered/noncanonical routes before canonical-only counts",
  );
});
