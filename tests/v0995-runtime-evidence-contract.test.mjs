import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { productionEnemyRuntimeContract } from "../app/productionEnemyRuntime.js";
import { productionVisualIntegrityInventory } from "../app/visualIntegrityInventory.js";
import {
  WEBKIT_WAIT_OWNER_DETAIL_LIMIT,
  WEBKIT_WAIT_OWNER_SCHEMA,
  classifyWebKitWaitOwnerReadError,
  parseWebKitHostProcStat,
  parseWebKitWaitOwnerProcIo,
  sanitizeWebKitWaitOwnerStack,
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
  assert.doesNotMatch(visualHarness, /qa\.auditFighterUnitLayer/u);
  assert.match(visualHarness, /runFighterUnitLayerAuditSession\([\s\S]*preparedProof\.fighter\.id/u);
  assert.match(visualHarness, /beginFighterUnitLayerAuditSession/u);
  assert.match(visualHarness, /advanceFighterUnitLayerAuditSession/u);
  assert.match(visualHarness, /finalizeFighterUnitLayerAuditSession/u);
  assert.match(visualHarness, /FIGHTER_UNIT_LAYER_AUDIT_TRANSACTION_TIMEOUT_MS = 2_000/u);
  assert.match(visualHarness, /FIGHTER_UNIT_LAYER_AUDIT_HOST_TURN_MS = 100/u);
  assert.match(visualHarness, /v100-fighter-unit-layer-audit-session\/v1/u);
  assert.match(visualHarness, /visual-integrity-evidence-capture/u);
  assert.match(visualHarness, /v100-visual-integrity-unit-layer-quiescence\/v1/u);
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
  const visualScreenshotQuiescence = visualHarness.match(/async function withVisualIntegrityScreenshotQuiescence[\s\S]+?(?=\nconst diagnostics)/u)?.[0] ?? "";
  assert.match(gameSource, /route: "phase-g" \| "deployment" \| "visual-integrity" \| null/u);
  assert.match(gameSource, /parameters\.get\("qa"\) === "mission" && parameters\.get\("qaVisualIntegrity"\) === "1"[\s\S]*"visual-integrity"/u);
  assert.match(gameSource, /route === "visual-integrity"[\s\S]*\["visual-integrity-evidence-capture"\]/u);
  assert.match(gameSource, /visualIntegrityCapture \? g\.paused/u);
  assert.match(visualScreenshotQuiescence, /arm\.paused === false/u);
  assert.match(visualHarness, /Number\(receipt\.suppressedRenderFrames\) > 0/u);
  assert.match(visualHarness, /Number\(receipt\.renderFrames\) >= Number\(releasedAtRenderFrames\) \+ 3/u);
  assert.match(visualScreenshotQuiescence, /v100-visual-integrity-screenshot-quiescence\/v1/u);
  assert.match(visualHarness, /page\.screenshot\(\{ path: screenshot, timeout: VISUAL_INTEGRITY_SCREENSHOT_TIMEOUT_MS \}\)/u);
  assert.match(visualHarness, /screenshotQuiescence: screenshotEnvelope\.receipt/u);
  assert.match(visualHarness, /VISUAL_INTEGRITY_SCREENSHOT_TIMEOUT_MS = 10_000/u);
  assert.equal((visualHarness.match(/page\.screenshot\(\{ path: screenshot, fullPage: true \}\)/gu) ?? []).length, 1);
  const mutableOwnerTransition = visualHarness.match(/async function transitionVisualIntegrityMutablePresentation[\s\S]+?(?=\nasync function withPrearmedVisualIntegrityScreenshotQuiescence)/u)?.[0] ?? "";
  assert.match(mutableOwnerTransition, /v100-visual-integrity-mutable-state-owner-handoff\/v1/u);
  assert.match(mutableOwnerTransition, /bridge\.setQaPresentationQuiesced\(false, requestedOwner\)[\s\S]*bridge\.setStationMissionPixelAuditState\(requestedState\)[\s\S]*renderFrameDelta === requiredRenderFrameDelta[\s\S]*bridge\.setQaPresentationQuiesced\(true, requestedOwner\)/u);
  assert.match(mutableOwnerTransition, /initialPrearm = previousGeneration === null/u);
  assert.match(mutableOwnerTransition, /transitionPhase = initialPrearm \? "initial-prearm" : "predecessor-released"/u);
  assert.match(mutableOwnerTransition, /before\.active === false[\s\S]*before\.owner === null[\s\S]*before\.route === null[\s\S]*Number\(before\.generation\) === 0/u);
  assert.match(mutableOwnerTransition, /release\.active === false[\s\S]*release\.owner === requestedOwner[\s\S]*release\.route === "visual-integrity"[\s\S]*Number\(release\.generation\) === Number\(previousGeneration\)/u);
  assert.match(mutableOwnerTransition, /phaseIdentityReady = initialPrearm[\s\S]*quiescence\?\.owner === null[\s\S]*quiescence\?\.route === null[\s\S]*Number\(quiescence\?\.generation\) === 0[\s\S]*quiescence\?\.owner === requestedOwner[\s\S]*quiescence\?\.route === "visual-integrity"[\s\S]*Number\(quiescence\?\.generation\) === Number\(previousGeneration\)/u);
  assert.match(mutableOwnerTransition, /requiredRenderFrameDelta = previousGeneration === null \? 2 : 3/u);
  assert.match(mutableOwnerTransition, /transitionPhase,[\s\S]*requiredRenderFrameDelta,[\s\S]*actualRenderFrameDelta: renderFrameDelta/u);
  assert.match(mutableOwnerTransition, /Number\(nextArm\.generation\) === Number\(before\.generation\) \+ 1/u);
  assert.match(mutableOwnerTransition, /Number\(nextArm\.enteredAtRenderFrames\) === Number\(restored\.quiescence\.renderFrames\)/u);
  assert.match(mutableOwnerTransition, /const successorSuppression = await new Promise/u);
  assert.match(mutableOwnerTransition, /Number\(receipt\.suppressedRenderFrames\) > 0[\s\S]*requestAnimationFrame\(observe\)/u);
  assert.match(mutableOwnerTransition, /nextArm,[\s\S]*successorSuppression,/u);
  assert.match(mutableOwnerTransition, /const suppressed = transition\.successorSuppression/u);
  assert.doesNotMatch(mutableOwnerTransition, /await awaitVisualIntegrityPresentationSuppression\([\s\S]*transition\.nextArm\.generation/u);
  assert.doesNotMatch(mutableOwnerTransition, /minimumRenderFrameDelta|maximumRenderFrameDelta|requiredRenderFrameDelta \+ 1|renderFrameDelta <= requiredRenderFrameDelta/u);
  assert.match(visualHarness, /withPrearmedVisualIntegrityScreenshotQuiescence\([\s\S]*Number\(suppressed\?\.suppressedRenderFrames\) > 0/u);
  assert.match(visualHarness, /completeVisualIntegrityScreenshotReceipt\([\s\S]*receipt\.release = successorTransition\.release[\s\S]*receipt\.restored = successorTransition\.restored/u);
  assert.match(visualHarness, /let previousMutableTransition = null[\s\S]*stateTransition = await runHostTelemetryOperation\([\s\S]*"hosted\/mutable-state-owner-handoff"[\s\S]*withPrearmedVisualIntegrityScreenshotQuiescence/u);
  assert.match(visualHarness, /"hosted\/mutable-final-owner-release"[\s\S]*finalRelease: true/u);
  assert.doesNotMatch(visualHarness, /setStationMissionPixelAuditState\(nextState\)[\s\S]*requestAnimationFrame\(\(\) => requestAnimationFrame\(resolve\)\)[\s\S]*withVisualIntegrityScreenshotQuiescence/u);
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
    minorFaults: 7,
    majorFaults: 9,
    userTicks: 11,
    systemTicks: 12,
    threads: 17,
    startTicks: 19,
    virtualBytes: 20,
    delayacctBlkioTicks: null,
  });
  const completeStat = parseWebKitHostProcStat(`654 (WPEWebProcess) D ${Array.from({ length: 45 }, (_, index) => index + 1).join(" ")}`);
  assert.equal(completeStat.delayacctBlkioTicks, 39);
  assert.deepEqual(parseWebKitWaitOwnerProcIo([
    "rchar: 101",
    "wchar: 202",
    "syscr: 3",
    "syscw: 4",
    "read_bytes: 505",
    "write_bytes: 606",
    "cancelled_write_bytes: 7",
  ].join("\n")), {
    rchar: 101,
    wchar: 202,
    syscr: 3,
    syscw: 4,
    read_bytes: 505,
    write_bytes: 606,
    cancelled_write_bytes: 7,
  });
  assert.deepEqual(parseWebKitWaitOwnerProcIo("rchar: 1\nread_bytes: invalid"), {
    rchar: 1,
    wchar: null,
    syscr: null,
    syscw: null,
    read_bytes: null,
    write_bytes: null,
    cancelled_write_bytes: null,
  });
  const boundedStack = sanitizeWebKitWaitOwnerStack(Array.from({ length: 18 }, (_, index) => `line-${index + 1}\u0000`).join("\n"));
  assert.equal(boundedStack.lines.length, 16);
  assert.equal(boundedStack.truncated, true);
  assert.equal(boundedStack.sourceLineCount, 18);
  assert.deepEqual(classifyWebKitWaitOwnerReadError({ code: "EACCES" }), { status: "permission-denied", errorCode: "EACCES" });
  assert.deepEqual(classifyWebKitWaitOwnerReadError({ code: "ENOENT" }), { status: "process-disappeared", errorCode: "ENOENT" });
  assert.deepEqual(classifyWebKitWaitOwnerReadError({ code: "EIO" }), { status: "unavailable", errorCode: "EIO" });
  assert.equal(WEBKIT_WAIT_OWNER_SCHEMA, "v100-webkit-wait-owner/v1");
  assert.equal(WEBKIT_WAIT_OWNER_DETAIL_LIMIT, 64);
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
  assert.deepEqual(webKitHostTelemetryValidity({ supported: true, rootObservedCount: 1, webContentObservedCount: 1, dStateSampleCount: 1, waitOwnerAttemptCount: 0 }), {
    valid: false,
    invalidReason: "d-state-wait-owner-attempt-missing",
  });
  assert.deepEqual(webKitHostTelemetryValidity({ supported: true, rootObservedCount: 1, webContentObservedCount: 1, dStateSampleCount: 1, waitOwnerAttemptCount: 1, waitOwnerCaptureErrorCount: 1 }), {
    valid: false,
    invalidReason: "d-state-wait-owner-capture-error",
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
  assert.match(hostTelemetrySource, /WEBKIT_WAIT_OWNER_SCHEMA = "v100-webkit-wait-owner\/v1"/u);
  assert.match(hostTelemetrySource, /WEBKIT_WAIT_OWNER_DETAIL_LIMIT = 64/u);
  assert.match(hostTelemetrySource, /readWaitOwnerProcFile\(`\$\{processRoot\}\/wchan`\)/u);
  assert.match(hostTelemetrySource, /readWaitOwnerProcFile\(`\$\{processRoot\}\/io`\)/u);
  assert.match(hostTelemetrySource, /delayacctBlkioTicks/u);
  assert.match(hostTelemetrySource, /sanitizeWebKitWaitOwnerStack/u);
  assert.match(hostTelemetrySource, /persistedWaitOwnerAttemptCount !== persistedDStateSampleCount/u);
  assert.match(hostTelemetrySource, /waitChannelFingerprints/u);
  assert.match(hostTelemetrySource, /firstProcIo/u);
  assert.match(hostTelemetrySource, /lastDelayacctBlkioTicks/u);
  assert.match(hostTelemetrySource, /setContext/u);
  assert.match(hostTelemetrySource, /normalized\.startsWith\("webkitweb"\)/u);
  assert.doesNotMatch(hostTelemetrySource, /node:child_process|\bspawn\s*\(|\bexec\s*\(|process\.env|page\.|mouse\.|keyboard\.|evaluate\s*\(/u);
  for (const operation of [
    "deployment/navigation-readiness-asset-boundary",
    "deployment/unit-asset-proof",
    "deployment/fixture-preparation",
    "deployment/first-frame-queue-readback",
    "deployment/checkpoint-advance",
    "deployment/checkpoint-validation",
    "deployment/final-canvas-png",
    "deployment/hash-persistence",
    "deployment/trace-capture",
    "deployment/contact-sheet",
  ]) assert.match(finalRemediationHarness, new RegExp(operation.replaceAll("/", "\\/"), "u"));
  const presentationBridge = gameSource.match(/const qaPresentationQuiescenceSnapshot = \(\) => \{([\s\S]*?)\r?\n    const bridge = \{/u)?.[1] ?? "";
  assert.ok(presentationBridge.length > 0, "missing shared localhost QA presentation quiescence bridge");
  assert.match(presentationBridge, /parameters\.get\("qa"\) === "mission" && parameters\.get\("qaHudFiniteAssets"\) === "1"/u);
  assert.match(presentationBridge, /"deployment-first-frame", "deployment-checkpoint-advance"/u);
  assert.match(presentationBridge, /"deployment-evidence-capture"/u);
  assert.match(presentationBridge, /pausedEvidenceCapture[\s\S]*pausedEvidenceCapture \? !g\.paused : g\.paused/u);
  assert.match(presentationBridge, /schema: "v100-qa-presentation-quiescence\/v1"/u);
  assert.match(presentationBridge, /state\.owner !== requestedOwner \|\| state\.route !== route/u);
  assert.match(presentationBridge, /battleRoot\.getAnimations\(\{ subtree: true \}\)/u);
  assert.doesNotMatch(presentationBridge, /g\.time\s*=|g\.fighters\s*=|\.hp\s*=|\.speed\s*=|eventIndex\s*=/u);
  const crossUnitResumeHarness = finalRemediationHarness.match(/async function resumeDeploymentBattleForNextUnit[\s\S]+?(?=\nasync function armDeploymentPresentationQuiescence)/u)?.[0] ?? "";
  assert.ok(crossUnitResumeHarness.length > 0, "missing bounded cross-unit live-battle resume owner");
  assert.match(crossUnitResumeHarness, /getCrawlerDeploymentProofSnapshot\(\{ kind: previousKind \}\)/u);
  assert.match(crossUnitResumeHarness, /getQaPresentationQuiescence\(\)/u);
  assert.equal((crossUnitResumeHarness.match(/setRepresentativeSixProofPaused\(false\)/gu) ?? []).length, 1);
  assert.equal((crossUnitResumeHarness.match(/hostTurn\(DEPLOYMENT_FIRST_FRAME_SAMPLE_INTERVAL_MS\)/gu) ?? []).length, 1);
  assert.match(crossUnitResumeHarness, /before\.screen === "battle"[\s\S]*before\.running === true[\s\S]*before\.paused === true[\s\S]*before\.over !== true/u);
  assert.match(crossUnitResumeHarness, /before\.fighter\.gateEntering === false[\s\S]*before\.fighter\.combatReady === true[\s\S]*before\.fighter\.entryRampCleared === true/u);
  assert.match(crossUnitResumeHarness, /before\.checkpointReceipt\.checkpoint === "fully-outside"[\s\S]*before\.checkpointReceipt\.computedProgress === 1/u);
  assert.match(crossUnitResumeHarness, /state\.presentation\.active === false[\s\S]*state\.presentation\.route === "deployment"[\s\S]*state\.presentation\.datasetActive === false[\s\S]*state\.documentDatasetActive === false/u);
  assert.match(crossUnitResumeHarness, /state\?\.canvas\?\.connected === true[\s\S]*state\.canvas\.rectWidth > 0[\s\S]*state\.canvas\.rectHeight > 0/u);
  assert.match(crossUnitResumeHarness, /command\?\.commandResult === false/u);
  assert.match(crossUnitResumeHarness, /after\.screen === "battle"[\s\S]*after\.running === true[\s\S]*after\.paused !== true[\s\S]*after\.over !== true/u);
  assert.match(crossUnitResumeHarness, /after\.checkpointArm === null[\s\S]*after\.checkpointReceipt === null/u);
  assert.match(crossUnitResumeHarness, /schema: "v100-deployment-cross-unit-live-resume\/v1"/u);
  assert.match(crossUnitResumeHarness, /previousUnit: \{ family: previousUnit\.family, kind: previousUnit\.kind \}[\s\S]*nextUnit: \{ family: nextUnit\.family, kind: nextUnit\.kind \}/u);
  assert.doesNotMatch(crossUnitResumeHarness, /waitForFunction|waitForTimeout|newPage|newContext|browser\.new|queueCrawlerDefenseUnit|prepareCrawlerDefenseProof|\.(?:paused|running|over)\s*=(?!=)/u);
  const presentationArmHarness = finalRemediationHarness.match(/async function armDeploymentPresentationQuiescence[\s\S]+?(?=\nasync function withDeploymentPresentationQuiescence)/u)?.[0] ?? "";
  assert.ok(presentationArmHarness.length > 0, "missing deployment presentation quiescence arm owner");
  assert.match(presentationArmHarness, /setQaPresentationQuiesced\(true, requestedOwner\)/u);
  assert.match(presentationArmHarness, /requestedCheckpointArm/u);
  assert.match(presentationArmHarness, /armCrawlerDeploymentCheckpoint\([\s\S]*setQaPresentationQuiesced\(true, requestedOwner\)/u);
  assert.match(presentationArmHarness, /armedAtPageTime: Date\.now\(\)/u);
  assert.doesNotMatch(presentationArmHarness, /setQaPresentationQuiesced\?\.\(false|waitForFunction|waitForTimeout|\.time\s*=|fighters\s*=|\.hp\s*=|\.speed\s*=|eventIndex\s*=/u);
  const presentationHarness = finalRemediationHarness.match(/async function withDeploymentPresentationQuiescence[\s\S]+?(?=\nasync function withDeploymentCanvasCaptureQuiescence)/u)?.[0] ?? "";
  assert.ok(presentationHarness.length > 0, "missing deployment presentation quiescence owner");
  assert.match(presentationHarness, /preArmedEnvelope = null/u);
  assert.match(presentationHarness, /preArmedEnvelope === null \|\| checkpointArmRequest === null/u);
  assert.match(presentationHarness, /preArmedEnvelope \?\? await armDeploymentPresentationQuiescence\([\s\S]*checkpointArmRequest/u);
  assert.match(presentationHarness, /setQaPresentationQuiesced\?\.\(false, requestedOwner\)/u);
  assert.match(presentationHarness, /checkpointArm: armEnvelope\.checkpointArm/u);
  assert.match(presentationHarness, /armedAtPageTime: armEnvelope\.armedAtPageTime/u);
  assert.match(presentationHarness, /release\.paused === true/u);
  assert.match(presentationHarness, /releasedAtRenderFrames\) === Number\(release\.enteredAtRenderFrames/u);
  assert.match(presentationHarness, /releasedAtSimulationTicks\) > Number\(release\.enteredAtSimulationTicks/u);
  assert.match(presentationHarness, /const restored = await new Promise\(\(resolve, reject\) =>/u);
  assert.match(presentationHarness, /requestAnimationFrame\(observe\)/u);
  assert.match(presentationHarness, /renderFrameDelta === 3/u);
  assert.match(presentationHarness, /renderFrameDelta > 3[\s\S]*deployment restoration exceeded exactly three production frames/u);
  assert.match(presentationHarness, /const evidencePresentation = bridge\.setQaPresentationQuiesced\(true, evidenceOwner\)/u);
  assert.match(presentationHarness, /Number\(evidencePresentation\.enteredAtRenderFrames\)[\s\S]*=== Number\(restored\.quiescence\.renderFrames\)/u);
  assert.match(presentationHarness, /v100-deployment-restoration-evidence-handoff\/v1/u);
  assert.match(presentationHarness, /preArmedEvidenceCapture: evidenceCaptureEnvelope/u);
  assert.match(presentationHarness, /v100-deployment-presentation-quiescence-receipt\/v1/u);
  assert.doesNotMatch(presentationHarness, /page\.waitForFunction\(\(\{ requestedOwner, releasedRenderFrames \}\)/u);
  const evidenceCaptureHarness = finalRemediationHarness.match(/async function withDeploymentCanvasCaptureQuiescence[\s\S]+?(?=\nasync function refreshDeploymentEvidenceAfterRestoredFrames)/u)?.[0] ?? "";
  assert.ok(evidenceCaptureHarness.length > 0, "missing frozen production-frame capture quiescence owner");
  assert.match(evidenceCaptureHarness, /const owner = "deployment-evidence-capture"/u);
  assert.match(evidenceCaptureHarness, /preArmedEnvelope\?\.schema === "v100-deployment-prearmed-presentation-envelope\/v1"/u);
  assert.match(evidenceCaptureHarness, /const arm = preArmedEnvelope\.presentation/u);
  assert.match(evidenceCaptureHarness, /arm\.paused === true/u);
  assert.match(evidenceCaptureHarness, /release\.paused === true/u);
  assert.match(evidenceCaptureHarness, /releasedAtRenderFrames\) === Number\(release\.enteredAtRenderFrames/u);
  assert.match(evidenceCaptureHarness, /releasedAtSimulationTicks\) === Number\(release\.enteredAtSimulationTicks/u);
  assert.match(evidenceCaptureHarness, /Number\(receipt\.suppressedRenderFrames\) > 0/u);
  assert.match(evidenceCaptureHarness, /timeout: Math\.min\(timeout, 2_000\), polling: 16/u);
  assert.match(evidenceCaptureHarness, /Number\(release\.suppressedRenderFrames\) > 0/u);
  assert.match(evidenceCaptureHarness, /v100-deployment-evidence-capture-quiescence\/v1/u);
  assert.match(evidenceCaptureHarness, /preCapture,/u);
  assert.match(evidenceCaptureHarness, /const releaseReceipt = bridge\.setQaPresentationQuiesced\(false, requestedOwner\)[\s\S]*bridge\.armCrawlerDeploymentCheckpoint\([\s\S]*bridge\.setQaPresentationQuiesced\([\s\S]*"deployment-checkpoint-advance"/u);
  assert.match(evidenceCaptureHarness, /requestedSuccessor\?\.type === "resume"[\s\S]*bridge\.setRepresentativeSixProofPaused\(false\)/u);
  assert.match(evidenceCaptureHarness, /v100-deployment-evidence-successor-handoff\/v1/u);
  assert.match(evidenceCaptureHarness, /nextPresentationEnvelope,/u);
  assert.doesNotMatch(evidenceCaptureHarness, /auditFighterUnitLayer|\.time\s*=|fighters\s*=|\.hp\s*=|\.speed\s*=/u);
  assert.doesNotMatch(presentationHarness, /\.time\s*=|fighters\s*=|\.hp\s*=|\.speed\s*=|eventIndex\s*=|setGraphicsQuality|force\s*:/u);
  const openBattlePageHarness = finalRemediationHarness.match(/async function openBattlePage[\s\S]+?(?=\nasync function clientPointForWorld)/u)?.[0] ?? "";
  assert.ok(openBattlePageHarness.length > 0, "missing battle setup owner");
  const battleReadinessCompleteIndex = openBattlePageHarness.indexOf('"battle readiness complete"');
  const earlyDeploymentGuardIndex = openBattlePageHarness.indexOf("options.earlyDeploymentPresentationQuiescence === true");
  const earlyDeploymentArmIndex = openBattlePageHarness.indexOf("await armDeploymentPresentationQuiescence(", earlyDeploymentGuardIndex);
  const postReadinessIndex = openBattlePageHarness.indexOf('setPhase("post-readiness settling")');
  const assetBoundaryIndex = openBattlePageHarness.indexOf("await sealAssetSetupBoundary(");
  assert.ok(battleReadinessCompleteIndex >= 0
    && battleReadinessCompleteIndex < earlyDeploymentGuardIndex
    && earlyDeploymentGuardIndex < earlyDeploymentArmIndex
    && earlyDeploymentArmIndex < postReadinessIndex
    && postReadinessIndex < assetBoundaryIndex,
  "deployment presentation must arm immediately after battle readiness and before settling/asset sealing");
  assert.match(openBattlePageHarness, /qaMode === "mission"[\s\S]*"deployment-first-frame"/u);
  assert.match(openBattlePageHarness, /deploymentSetupPresentationQuiescenceArm,[\s\S]*catch \(error\)[\s\S]*Object\.assign\(error, \{ deploymentSetupPresentationQuiescenceArm \}\)/u);
  const postRestorationReadback = finalRemediationHarness.match(/async function refreshDeploymentEvidenceAfterRestoredFrames[\s\S]+?(?=\nasync function pauseAtDeploymentCheckpoint)/u)?.[0] ?? "";
  assert.ok(postRestorationReadback.length > 0, "missing post-restoration production snapshot readback");
  assert.equal((postRestorationReadback.match(/getCrawlerDeploymentProofSnapshot/gu) ?? []).length, 1);
  assert.match(postRestorationReadback, /presentation\.restored\?\.renderFrameDelta === 3/u);
  assert.match(postRestorationReadback, /renderFrames\)\s*=== Number\(presentation\.release\?\.releasedAtRenderFrames\) \+ 3/u);
  assert.match(postRestorationReadback, /presentation\.evidenceCaptureArm\.owner === "deployment-evidence-capture"/u);
  assert.match(postRestorationReadback, /refreshed\.presentation\?\.active === true[\s\S]*refreshed\.presentation\.owner === "deployment-evidence-capture"/u);
  assert.match(postRestorationReadback, /refreshed\.screen === "battle"[\s\S]*refreshed\.running === true[\s\S]*refreshed\.paused === true[\s\S]*refreshed\.over !== true/u);
  assert.match(postRestorationReadback, /fighter\.x === previousFighter\?\.x[\s\S]*fighter\.y === previousFighter\?\.y[\s\S]*refreshed\.computedProgress === evidence\?\.observedProgress/u);
  assert.match(postRestorationReadback, /refreshed\.checkpointReceipt === null/u);
  assert.match(postRestorationReadback, /receipt\.fighterId === fighterId[\s\S]*receipt\.kind === unitKind[\s\S]*receipt\.checkpoint === expectedCheckpoint[\s\S]*receipt\.computedProgress === refreshed\.computedProgress/u);
  assert.match(postRestorationReadback, /fighter\.renderAudit\?\.deploymentPlan\?\.checkpoint === expectedCheckpoint[\s\S]*fighter\.renderAudit\?\.poseOpacity === 1[\s\S]*fighter\.renderAudit\?\.effectiveOpacity === 1[\s\S]*fighter\.animationPose\?\.opacity === 1/u);
  assert.match(postRestorationReadback, /v100-deployment-post-restoration-readback\/v1/u);
  assert.doesNotMatch(postRestorationReadback, /auditFighterUnitLayer|requestAnimationFrame|waitForFunction|page\.waitForTimeout|hostTurn|document\.querySelector|setRepresentativeSixProofPaused|armCrawlerDeploymentCheckpoint/u);
  const presentationDeploymentCase = finalRemediationHarness.match(/async function runDeploymentCase[\s\S]+?(?=\nconst buildIdentityAtStart)/u)?.[0] ?? "";
  assert.match(presentationDeploymentCase, /earlyDeploymentPresentationQuiescence: true/u);
  assert.match(presentationDeploymentCase, /deploymentSetupPresentationQuiescenceArm\.armedAtPageTime <= assetSetupBoundary\.boundaryAt/u);
  assert.match(presentationDeploymentCase, /result\.deploymentSetupPresentationQuiescenceArm = deploymentSetupPresentationQuiescenceArm/u);
  assert.match(presentationDeploymentCase, /for \(const \[unitIndex, unit\] of deploymentUnits\.entries\(\)\)/u);
  assert.match(presentationDeploymentCase, /crossUnitLiveResume: null/u);
  assert.match(presentationDeploymentCase, /if \(unitIndex > 0\)[\s\S]*previousUnit\?\.status === "passed"[\s\S]*previousUnit\.checkpoints\.at\(-1\)\?\.checkpoint === "fully-outside"/u);
  assert.match(presentationDeploymentCase, /"deployment\/cross-unit-live-resume"[\s\S]*resumeDeploymentBattleForNextUnit\(/u);
  const crossUnitResumeIndex = presentationDeploymentCase.indexOf('"deployment/cross-unit-live-resume"');
  const deploymentTraceCreateIndex = presentationDeploymentCase.indexOf("activeDeploymentTrace = createDeploymentTrace(", crossUnitResumeIndex);
  const nextPresentationArmIndex = presentationDeploymentCase.indexOf("const firstFrameEnvelope = await withDeploymentPresentationQuiescence(", crossUnitResumeIndex);
  assert.ok(crossUnitResumeIndex >= 0
    && crossUnitResumeIndex < deploymentTraceCreateIndex
    && deploymentTraceCreateIndex < nextPresentationArmIndex,
  "cross-unit resume must finish before the next unit trace and presentation arm");
  assert.match(presentationDeploymentCase, /result\.units\[0\]\?\.crossUnitLiveResume === null[\s\S]*crossUnitLiveResumes\.length === deploymentUnits\.length - 1/u);
  assert.match(presentationDeploymentCase, /receipt\?\.schema === "v100-deployment-cross-unit-live-resume\/v1"/u);
  assert.match(presentationDeploymentCase, /const firstFrameEnvelope = await withDeploymentPresentationQuiescence\([\s\S]*"deployment-first-frame"[\s\S]*queueAndPauseAtFirstDeploymentFrame/u);
  const firstFrameQuiescenceIndex = presentationDeploymentCase.indexOf("const firstFrameEnvelope = await withDeploymentPresentationQuiescence(");
  const firstFrameOwnerIndex = presentationDeploymentCase.indexOf('"deployment-first-frame"', firstFrameQuiescenceIndex);
  const unitAssetProofIndex = presentationDeploymentCase.indexOf('"deployment/unit-asset-proof"', firstFrameOwnerIndex);
  const unitAssetTraceIndex = presentationDeploymentCase.indexOf('traceBoundary: "unit-asset-proof"', unitAssetProofIndex);
  const fixturePreparationIndex = presentationDeploymentCase.indexOf('"deployment/fixture-preparation"', unitAssetTraceIndex);
  const fixtureTraceIndex = presentationDeploymentCase.indexOf('traceBoundary: "fixture-preparation"', fixturePreparationIndex);
  const firstFrameDiagnosticIndex = presentationDeploymentCase.indexOf('"deployment/first-frame-queue-readback"', fixtureTraceIndex);
  const firstFrameQueueIndex = presentationDeploymentCase.indexOf("queueAndPauseAtFirstDeploymentFrame(", firstFrameDiagnosticIndex);
  const firstFrameQuiescenceEnd = presentationDeploymentCase.indexOf("const firstFrameBeforeProductionReadback", firstFrameQueueIndex);
  assert.ok(firstFrameQuiescenceIndex >= 0
    && firstFrameQuiescenceIndex < firstFrameOwnerIndex
    && firstFrameOwnerIndex < unitAssetProofIndex
    && unitAssetProofIndex < unitAssetTraceIndex
    && unitAssetTraceIndex < fixturePreparationIndex
    && fixturePreparationIndex < fixtureTraceIndex
    && fixtureTraceIndex < firstFrameDiagnosticIndex
    && firstFrameDiagnosticIndex < firstFrameQueueIndex
    && firstFrameQueueIndex < firstFrameQuiescenceEnd,
  "deployment presentation quiescence must own exactly five serial diagnostic operations through the first-frame queue");
  const firstFrameQuiescenceRegion = presentationDeploymentCase.slice(firstFrameQuiescenceIndex, firstFrameQuiescenceEnd);
  assert.match(firstFrameQuiescenceRegion, /traceBoundary: "unit-asset-proof"[\s\S]*traceBoundary: "fixture-preparation"/u);
  assert.equal((firstFrameQuiescenceRegion.match(/withDeploymentDiagnosticOperation\(/gu) ?? []).length, 5);
  assert.equal((firstFrameQuiescenceRegion.match(/"deployment\/unit-asset-proof"/gu) ?? []).length, 1);
  assert.equal((firstFrameQuiescenceRegion.match(/"deployment\/trace-capture"/gu) ?? []).length, 2);
  assert.equal((firstFrameQuiescenceRegion.match(/"deployment\/fixture-preparation"/gu) ?? []).length, 1);
  assert.equal((firstFrameQuiescenceRegion.match(/"deployment\/first-frame-queue-readback"/gu) ?? []).length, 1);
  assert.equal((firstFrameQuiescenceRegion.match(/queueAndPauseAtFirstDeploymentFrame\(/gu) ?? []).length, 1);
  assert.match(firstFrameQuiescenceRegion, /null,[\s\S]*unitIndex === 0 \? deploymentSetupPresentationQuiescenceArm : null/u);
  assert.match(firstFrameQuiescenceRegion, /const firstFrame = await withDeploymentDiagnosticOperation\(\s*lifecycle,\s*"deployment\/first-frame-queue-readback",\s*unitDetails,\s*\(\) => queueAndPauseAtFirstDeploymentFrame\(/u);
  assert.doesNotMatch(firstFrameQuiescenceRegion, /withDeploymentDiagnosticOperation\(\s*lifecycle,\s*"deployment\/first-frame-queue-readback",[\s\S]+?\(\) => withDeploymentPresentationQuiescence\(/u);
  assert.doesNotMatch(firstFrameQuiescenceRegion, /\(\) => withDeploymentDiagnosticOperation\([\s\S]+?withDeploymentDiagnosticOperation\(/u);
  assert.doesNotMatch(presentationDeploymentCase.slice(0, firstFrameQuiescenceIndex), /deployment\/unit-asset-proof|deployment\/fixture-preparation/u);
  assert.match(presentationDeploymentCase, /withDeploymentPresentationQuiescence\([\s\S]*"deployment-checkpoint-advance"[\s\S]*pauseAtDeploymentCheckpoint/u);
  assert.match(presentationDeploymentCase, /\(checkpointArm, presentationArm\) => pauseAtDeploymentCheckpoint\([\s\S]*checkpointArm,[\s\S]*presentationArm,[\s\S]*null,[\s\S]*nextCheckpointPresentationEnvelope/u);
  assert.match(presentationDeploymentCase, /let evidenceCaptureEnvelope = firstFrameEnvelope\.preArmedEvidenceCapture/u);
  assert.match(presentationDeploymentCase, /let nextCheckpointPresentationEnvelope = null/u);
  assert.match(presentationDeploymentCase, /evidenceCaptureEnvelope = checkpointEnvelope\.preArmedEvidenceCapture/u);
  assert.match(presentationDeploymentCase, /presentationQuiescence: evidence\.presentationQuiescence \?\? null/u);
  assert.equal((presentationDeploymentCase.match(/refreshDeploymentEvidenceAfterRestoredFrames\(/gu) ?? []).length, 2);
  assert.match(presentationDeploymentCase, /firstFrameBeforeProductionReadback[\s\S]*refreshDeploymentEvidenceAfterRestoredFrames\([\s\S]*"fully-inside",[\s\S]*0,/u);
  assert.match(presentationDeploymentCase, /checkpointBeforeProductionReadback[\s\S]*refreshDeploymentEvidenceAfterRestoredFrames\([\s\S]*checkpoint\.id,[\s\S]*checkpoint\.progress/u);
  assert.match(presentationDeploymentCase, /postRestorationReadback: evidence\.postRestorationReadback \?\? null/u);
  assert.match(presentationDeploymentCase, /withDeploymentCanvasCaptureQuiescence\([\s\S]*deploymentCanvasPng\([\s\S]*evidenceCaptureEnvelope,[\s\S]*successorCheckpoint \? \{/u);
  assert.match(presentationDeploymentCase, /type: "checkpoint",[\s\S]*checkpoint: successorCheckpoint\.id,[\s\S]*minimumProgress: successorCheckpoint\.progress/u);
  assert.match(presentationDeploymentCase, /nextCheckpointPresentationEnvelope = canvasCaptureEnvelope\.nextPresentationEnvelope/u);
  assert.match(presentationDeploymentCase, /final deployment checkpoint retained an unexpected successor owner/u);
  assert.match(presentationDeploymentCase, /evidenceCaptureQuiescence: canvasCaptureEnvelope\.receipt/u);
  const hudDeploymentHarness = finalRemediationHarness.match(/async function captureDeploymentBannerHudState[\s\S]+?(?=\nasync function createDisabledHudState)/u)?.[0] ?? "";
  assert.ok(hudDeploymentHarness.length > 0, "missing shared deployment-banner presentation owner flow");
  assert.equal((hudDeploymentHarness.match(/withDeploymentPresentationQuiescence\(/gu) ?? []).length, 2);
  assert.equal((hudDeploymentHarness.match(/withDeploymentCanvasCaptureQuiescence\(/gu) ?? []).length, 2);
  assert.equal((hudDeploymentHarness.match(/runFighterUnitLayerAuditSession/gu) ?? []).length, 0);
  assert.match(hudDeploymentHarness, /"deployment-first-frame"[\s\S]*queueAndPauseAtFirstDeploymentFrame/u);
  assert.match(hudDeploymentHarness, /firstFrameEnvelope\.preArmedEvidenceCapture[\s\S]*type: "checkpoint"/u);
  assert.match(hudDeploymentHarness, /"deployment-checkpoint-advance"[\s\S]*pauseAtDeploymentCheckpoint/u);
  assert.match(hudDeploymentHarness, /captureHudState\(page, viewport, axisName, stateId, lifecycle\)[\s\S]*firstVisibleEnvelope\.preArmedEvidenceCapture/u);
  assert.match(hudDeploymentHarness, /resumeAfterCapture \? \{ type: "resume" \} : null/u);
  assert.match(hudDeploymentHarness, /v100-deployment-hud-presentation-ownership\/v1/u);
  assert.doesNotMatch(hudDeploymentHarness, /setRepresentativeSixProofPaused\(false\)|page\.waitForFunction/u);
  assert.equal((finalRemediationHarness.match(/captureDeploymentBannerHudState\(\{/gu) ?? []).length, 3);
  for (const operation of [
    "hosted/asset-boundary",
    "hosted/fault-start",
    "hosted/blocked-state-readback",
    "hosted/same-screen-recovery",
    "hosted/final-canvas-audit",
    "hosted/mutable-state-owner-handoff",
    "hosted/mutable-canvas-audit",
    "hosted/page-screenshot",
    "hosted/mutable-final-owner-release",
  ]) assert.match(visualHarness, new RegExp(operation.replaceAll("/", "\\/"), "u"));
  assert.match(finalRemediationHarness, /requestedCheckpoint: checkpoint\.id[\s\S]*withDeploymentDiagnosticOperation\([\s\S]*"deployment\/checkpoint-advance"/u);
  assert.match(boundedDeploymentHarness, /hostResourceTelemetryValid/u);
  assert.match(boundedDeploymentHarness, /hostResourceTelemetryInvalidReason/u);
  assert.match(boundedDeploymentHarness, /failed at \$\{failedAt\}/u);
  const fighterAuditScratch = gameSource.match(/type FighterUnitLayerAuditScratchSurface[\s\S]+?(?=\r?\nfunction fighterUnitLayerAuditRegion)/u)?.[0] ?? "";
  const fighterAudit = gameSource.match(/function fighterUnitLayerAuditRegion[\s\S]+?(?=\r?\nfunction drawEnemyCombatReadabilityVfx)/u)?.[0] ?? "";
  assert.equal((fighterAuditScratch.match(/document\.createElement\("canvas"\)/gu) ?? []).length, 1);
  assert.equal((fighterAuditScratch.match(/getContext\("2d", \{ willReadFrequently: true \}\)/gu) ?? []).length, 1);
  assert.match(fighterAuditScratch, /if \(canvas\.width !== width\) canvas\.width = width/u);
  assert.match(fighterAuditScratch, /if \(canvas\.height !== height\) canvas\.height = height/u);
  assert.match(fighterAudit, /reusableFighterUnitLayerAuditScratchSurface\(width, height\)/u);
  assert.doesNotMatch(fighterAudit, /document\.createElement\("canvas"\)|getContext\("2d"/u);
  assert.match(fighterAudit, /new Uint8ClampedArray\([\s\S]*ctx\.getImageData\(0, 0, width, height\)\.data/u);
  assert.equal((fighterAudit.match(/ctx\.translate\(-left, -top\)/gu) ?? []).length, 3);
  assert.match(fighterAudit, /ctx\.translate\(-left, -top\);[\s\S]*drawSpriteFighter/u);
  assert.match(fighterAudit, /ctx\.translate\(-left, -top\);[\s\S]*drawCrawlerForegroundMask\(ctx/u);
  assert.match(fighterAudit, /ctx\.translate\(-left, -top\);[\s\S]*drawCrawler\(ctx/u);
  assert.match(fighterAudit, /ctx\.getImageData\(0, 0, width, height\)/u);
  assert.match(fighterAudit, /session\.renderedForegroundRgba = captureForeground\(false\)/u);
  assert.match(fighterAudit, /session\.expectedForegroundRgba = captureForeground\(true\)/u);
  assert.match(fighterAudit, /visibleFinalRgba: session\.finalRgba/u);
  assert.match(fighterAudit, /schema: "v100-fighter-unit-layer-audit-scratch\/v1"/u);
  assert.match(fighterAudit, /kind: "detached-dom-canvas"/u);
  assert.match(fighterAudit, /surfaceCount: 1,[\s\S]*contextCount: 1,[\s\S]*passCount: 6/u);
  assert.match(fighterAudit, /schema: "v100-fighter-unit-layer-audit-session\/v1"/u);
  assert.match(gameSource, /FIGHTER_UNIT_LAYER_AUDIT_PASSES = \[/u);
  for (const pass of ["actual-unit", "forced-opaque-unit", "rendered-foreground", "expected-foreground", "final-production-canvas", "authored-composite"]) {
    assert.match(fighterAudit, new RegExp(`"${pass}"`, "u"));
  }
  assert.match(fighterAudit, /function beginFighterUnitLayerPixelAuditSession/u);
  assert.match(fighterAudit, /function advanceFighterUnitLayerPixelAuditSession/u);
  assert.match(fighterAudit, /function finalizeFighterUnitLayerPixelAuditSession/u);
  assert.match(fighterAudit, /finalizedWithoutCanvasDraw: true/u);
  assert.doesNotMatch(fighterAudit, /OffscreenCanvas/u);
  assert.doesNotMatch(fighterAudit, /foregroundCanvas|foregroundContext|finalAuditCanvas|finalAuditContext|compositeCanvas|compositeContext/u);
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
  assert.match(firstFrame, /snapshot\?\.schema === "v099-crawler-deployment-snapshot\/v1"/u);
  assert.match(firstFrame, /snapshot\.banner\?\.includes\("移動拠点から出撃"\) === true/u);
  assert.match(firstFrame, /progress === 0/u);
  assert.match(firstFrame, /captureTrace = null/u);
  assert.match(firstFrame, /expectedPresentationArm = null/u);
  assert.ok((firstFrame.match(/if \(captureTrace\) await captureTrace\(\)/gu) ?? []).length >= 3);
  assert.equal((firstFrame.match(/auditFighterUnitLayer/gu) ?? []).length, 0);
  assert.equal((firstFrame.match(/runFighterUnitLayerAuditSession/gu) ?? []).length, 1);
  assert.match(firstFrame, /v100-deployment-checkpoint-audit-ready\/v1/u);
  assert.doesNotMatch(firstFrame, /beginFighterUnitLayerAuditSession/u);
  assert.doesNotMatch(firstFrame, /candidate\.auditSession/u);
  assert.match(firstFrame, /checkpoint: "fully-inside"[\s\S]*checkpointReceipt: null[\s\S]*presentation: candidate\.presentation/u);
  const firstFrameReadyBranch = firstFrame.match(/if \(candidate\?\.ready === true\) \{[\s\S]+?(?=\n      if \(captureTrace\))/u)?.[0] ?? "";
  assert.doesNotMatch(firstFrameReadyBranch, /hostTurn\(|getCrawlerDeploymentProofSnapshot|page\.evaluate/u);
  assert.doesNotMatch(firstFrame, /document\.querySelector\("\.battle-banner"\)|requestAnimationFrame|getSnapshot|page\.waitForTimeout/u);
  const checkpoint = finalRemediationHarness.match(/async function pauseAtDeploymentCheckpoint[\s\S]+?(?=\nasync function queueAndPauseAtFirstDeploymentFrame)/u)?.[0] ?? "";
  assert.equal((checkpoint.match(/armCrawlerDeploymentCheckpoint/gu) ?? []).length, 1);
  assert.match(checkpoint, /getCrawlerDeploymentProofSnapshot/u);
  assert.match(checkpoint, /v099-crawler-deployment-checkpoint-receipt\/v1/u);
  assert.match(checkpoint, /checkpointReceipt/u);
  assert.match(checkpoint, /hostTurn\(DEPLOYMENT_FIRST_FRAME_SAMPLE_INTERVAL_MS\)/u);
  assert.match(checkpoint, /captureTrace = null/u);
  assert.match(checkpoint, /prearmedCheckpoint = null/u);
  assert.match(checkpoint, /expectedPresentationArm = null/u);
  assert.match(checkpoint, /prearmedCheckpoint \?\? await page\.evaluate/u);
  assert.equal((checkpoint.match(/if \(captureTrace\) await captureTrace\(\)/gu) ?? []).length, 3);
  assert.equal((checkpoint.match(/auditFighterUnitLayer/gu) ?? []).length, 0);
  assert.equal((checkpoint.match(/runFighterUnitLayerAuditSession/gu) ?? []).length, 1);
  assert.match(checkpoint, /Object\.isFrozen\(receipt\)/u);
  assert.match(checkpoint, /snapshot\.checkpointArm !== null/u);
  assert.match(checkpoint, /v100-deployment-checkpoint-audit-ready\/v1/u);
  assert.doesNotMatch(checkpoint, /beginFighterUnitLayerAuditSession/u);
  assert.doesNotMatch(checkpoint, /candidate\.auditSession/u);
  assert.match(checkpoint, /checkpointReceipt: candidate\.checkpointReceipt,[\s\S]*presentation: candidate\.presentation/u);
  const checkpointAcceptedHandoff = checkpoint.match(/invariant\(candidate\.schema === "v100-deployment-checkpoint-audit-ready\/v1"[\s\S]+?(?=\n      return \{)/u)?.[0] ?? "";
  assert.doesNotMatch(checkpointAcceptedHandoff, /hostTurn\(|getCrawlerDeploymentProofSnapshot|page\.evaluate/u);
  const auditRunner = finalRemediationHarness.match(/async function runFighterUnitLayerAuditSession[\s\S]+?(?=\nasync function resumeDeploymentBattleForNextUnit)/u)?.[0] ?? "";
  assert.match(auditRunner, /expectedBinding = null/u);
  assert.match(auditRunner, /const begin = await boundedFighterUnitLayerAuditTransaction/u);
  assert.match(auditRunner, /page\.evaluate\(\(id\) => window\.__ASHFALL_BATTLE_QA__\.beginFighterUnitLayerAuditSession\(id\)/u);
  assert.match(auditRunner, /dedicated unit-layer audit begin drifted from the accepted lean checkpoint/u);
  assert.match(auditRunner, /begin\.quiescence\.owner === expectedBinding\.presentation\?\.owner/u);
  assert.match(finalRemediationHarness, /function validDeploymentAuditScratchReceipt\(audit\)/u);
  assert.match(finalRemediationHarness, /audit\?\.scratchSurface\?\.schema === "v100-fighter-unit-layer-audit-scratch\/v1"/u);
  assert.match(finalRemediationHarness, /audit\.scratchSurface\.surfaceCount === 1/u);
  assert.match(finalRemediationHarness, /audit\.scratchSurface\.contextCount === 1/u);
  assert.match(finalRemediationHarness, /audit\.scratchSurface\.passCount === 6/u);
  assert.match(finalRemediationHarness, /audit\.transportSession\?\.schema === "v100-fighter-unit-layer-audit-session\/v1"/u);
  assert.match(finalRemediationHarness, /FIGHTER_UNIT_LAYER_AUDIT_TRANSACTION_TIMEOUT_MS = 2_000/u);
  assert.match(finalRemediationHarness, /FIGHTER_UNIT_LAYER_AUDIT_TOTAL_TIMEOUT_MS = 10_000/u);
  assert.match(finalRemediationHarness, /page\.evaluate\(\(token\) => window\.__ASHFALL_BATTLE_QA__\.advanceFighterUnitLayerAuditSession\(token\)/u);
  assert.equal((finalRemediationHarness.match(/validDeploymentAuditScratchReceipt\(audit\)/gu) ?? []).length, 4);
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
  assert.doesNotMatch(deploymentCase, /checkpointReceipt:\s*evidence\.checkpointReceipt|readableSnapshot|getSnapshot|requestAnimationFrame|page\.waitForTimeout/u);
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
