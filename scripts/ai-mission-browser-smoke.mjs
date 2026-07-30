import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { CAMPAIGN_STAGES } from "../app/campaign.js";
import { installInfectedAbilityPhaseObserver } from "./infected-ability-phase-observer.mjs";

const baseUrl = new URL(process.env.AI_MISSION_QA_BASE_URL ?? "http://127.0.0.1:4177/");
if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname)) {
  throw new Error(`AI mission QA routes are local-only; refusing ${baseUrl}`);
}

const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href)
  : await import("playwright");
const browserTypes = { chromium: playwright.chromium, webkit: playwright.webkit };
const engines = (process.env.AI_MISSION_QA_ENGINES ?? "chromium,webkit")
  .split(",")
  .map((engine) => engine.trim())
  .filter(Boolean);
const unknownEngines = engines.filter((engine) => !browserTypes[engine]);
if (engines.length === 0 || unknownEngines.length > 0) {
  throw new Error(`Unknown or empty AI_MISSION_QA_ENGINES: ${unknownEngines.join(", ") || "(empty)"}`);
}

const viewportCandidates = [
  { width: 1280, height: 720 },
  { width: 844, height: 390 },
  { width: 844, height: 340 },
];
const requestedViewportIds = (process.env.AI_MISSION_QA_VIEWPORTS ?? "1280x720,844x390,844x340")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const viewports = viewportCandidates.filter(({ width, height }) => (
  requestedViewportIds.includes(`${width}x${height}`)
));
const unknownViewportIds = requestedViewportIds.filter((id) => (
  !viewportCandidates.some(({ width, height }) => id === `${width}x${height}`)
));
if (viewports.length === 0 || unknownViewportIds.length > 0) {
  throw new Error(`Unknown AI_MISSION_QA_VIEWPORTS: ${unknownViewportIds.join(", ") || "(empty)"}`);
}
const expectedEnemyKindsByStage = new Map([
  [17, ["resonator", "cagewalker"]],
  [18, ["spindle", "choir-knot"]],
  [19, ["pall-manta"]],
  [20, ["anchor-bloom"]],
]);
const allStages = CAMPAIGN_STAGES.map((stage, index) => ({
  number: index + 1,
  id: stage.id,
  expectedEnemyKinds: expectedEnemyKindsByStage.get(index + 1),
}));
const requestedStageNumbers = (process.env.AI_MISSION_QA_STAGES ?? "1,2,3,4,5,6")
  .split(",")
  .map((stage) => Number(stage.trim()))
  .filter(Number.isInteger);
const stages = allStages.filter(({ number }) => requestedStageNumbers.includes(number));
const unknownStageNumbers = requestedStageNumbers.filter((number) => !allStages.some((stage) => stage.number === number));
if (stages.length === 0 || unknownStageNumbers.length > 0) {
  throw new Error(`Unknown AI_MISSION_QA_STAGES: ${unknownStageNumbers.join(", ") || "(empty)"}`);
}
const evidenceDir = path.resolve(process.env.AI_MISSION_QA_EVIDENCE_DIR ?? "outputs/ai-mission-browser-smoke");
const configuredTimeout = process.env.AI_MISSION_QA_TIMEOUT_MS;
const parsedTimeout = configuredTimeout === undefined ? 38_000 : Number(configuredTimeout);
if (!Number.isFinite(parsedTimeout) || parsedTimeout <= 0) {
  throw new Error(`AI_MISSION_QA_TIMEOUT_MS must be finite and positive: ${configuredTimeout}`);
}
const timeout = Math.min(2 * 60_000, Math.max(8_000, parsedTimeout));
const requireInfectedAbilityLifecycle = process.env.AI_MISSION_QA_INFECTED_ABILITIES === "1";
const results = [];

await mkdir(evidenceDir, { recursive: true });

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function caseUrl(stage) {
  const url = new URL(baseUrl);
  url.search = new URLSearchParams({
    qa: "mission",
    stage: stage.id,
    state: "start",
    safe: "iphone-landscape",
  }).toString();
  return String(url);
}

function unexpectedWarnings(warnings) {
  return warnings.filter((warning) => !warning.includes("was preloaded using link preload but not used"));
}

function diagnosticsFor(page) {
  const diagnostics = {
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
    httpErrors: [],
    warnings: [],
  };
  page.on("console", (message) => {
    if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
    if (message.type() === "warning") diagnostics.warnings.push(message.text());
  });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(String(error)));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown";
    if (failure !== "net::ERR_ABORTED") diagnostics.requestFailures.push(`${request.url()} :: ${failure}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) diagnostics.httpErrors.push(`${response.status()} ${response.url()}`);
  });
  return diagnostics;
}

function assertDiagnostics(diagnostics) {
  const normalized = { ...diagnostics, warnings: unexpectedWarnings(diagnostics.warnings) };
  for (const [kind, entries] of Object.entries(normalized)) {
    invariant(entries.length === 0, `${kind}: ${JSON.stringify(entries)}`);
  }
}

async function startInfectedAbilityObserver(page, expectedKinds) {
  await page.evaluate(installInfectedAbilityPhaseObserver, expectedKinds);
}

async function waitForInfectedAbilityLifecycle(page, expectedKinds) {
  await page.waitForFunction(
    (kinds) => kinds.every((kind) => {
      const activations = window.__ASHFALL_INFECTED_PHASE_OBSERVER__
        ?.observed?.[kind]?.completedActivations ?? [];
      return activations.some(({ warningAt, activeAt }) => (
        Number.isFinite(warningAt) && Number.isFinite(activeAt) && warningAt < activeAt
      ));
    }),
    expectedKinds,
    { timeout },
  );
  return page.evaluate(() => structuredClone(window.__ASHFALL_INFECTED_PHASE_OBSERVER__.observed));
}

async function readViewportEvidence(page) {
  return page.evaluate(() => {
    const rootStyle = getComputedStyle(document.documentElement);
    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      documentWidth: document.documentElement.scrollWidth,
      documentHeight: document.documentElement.scrollHeight,
      safeAreaSource: document.documentElement.dataset.safeAreaSource ?? null,
      safeArea: {
        left: rootStyle.getPropertyValue("--app-viewport-safe-left").trim(),
        right: rootStyle.getPropertyValue("--app-viewport-safe-right").trim(),
        bottom: rootStyle.getPropertyValue("--app-viewport-safe-bottom").trim(),
      },
    };
  });
}

async function observeDynamicAi(page, durationMs = 2_500) {
  return page.evaluate(async (requestedDurationMs) => {
    const deadline = performance.now() + requestedDurationMs;
    const previousById = new Map();
    let samples = 0;
    let attackIdentitySamples = 0;
    let attackIdentityMismatches = 0;
    let invalidTargetSamples = 0;
    let movementReversals = 0;
    let maximumRecoveryCount = 0;
    let terminalFallbackSamples = 0;
    while (performance.now() < deadline) {
      const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
      const active = snapshot.fighters.filter((fighter) => fighter.hp > 0 && fighter.combatReady);
      const fighterById = new Map(active.map((fighter) => [fighter.id, fighter]));
      samples += 1;
      attackIdentitySamples += snapshot.attackIdentity.length;
      attackIdentityMismatches += snapshot.attackIdentity.filter(
        (attack) => attack.targetId !== attack.damageTargetId,
      ).length;
      for (const fighter of active) {
        maximumRecoveryCount = Math.max(
          maximumRecoveryCount,
          Number(fighter.navigationRecovery?.recoveryCount) || 0,
        );
        if ((fighter.navigationRecovery?.terminalFallbackSeconds ?? 0) > 0) {
          terminalFallbackSamples += 1;
        }
        if (fighter.targetId !== null) {
          const target = fighterById.get(fighter.targetId);
          if (!target || target.side === fighter.side || target.hp <= 0) invalidTargetSamples += 1;
        }
        if (fighter.side !== "human") continue;
        const previous = previousById.get(fighter.id);
        const dx = previous ? fighter.x - previous.x : 0;
        const direction = Math.abs(dx) > .25 ? Math.sign(dx) : previous?.direction ?? 0;
        if (previous?.direction && direction && previous.direction !== direction) {
          movementReversals += 1;
        }
        previousById.set(fighter.id, { x: fighter.x, direction });
      }
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    return {
      durationMs: requestedDurationMs,
      samples,
      attackIdentitySamples,
      attackIdentityMismatches,
      invalidTargetSamples,
      movementReversals,
      maximumRecoveryCount,
      terminalFallbackSamples,
    };
  }, durationMs);
}

for (const engine of engines) {
  let browser;
  try {
    browser = await browserTypes[engine].launch({ headless: true });
  } catch (error) {
    results.push({ engine, status: "failed", error: `browser launch failed: ${String(error)}` });
    continue;
  }

  try {
    for (const viewport of viewports) {
      for (const stage of stages) {
        const name = `${engine}-stage${stage.number}-${viewport.width}x${viewport.height}`;
        const context = await browser.newContext({ viewport });
        const page = await context.newPage();
        const diagnostics = diagnosticsFor(page);
        const result = {
          engine,
          viewport,
          stage: stage.number,
          stageId: stage.id,
          url: caseUrl(stage),
          status: "failed",
        };
        try {
          const response = await page.goto(result.url, { waitUntil: "domcontentloaded", timeout });
          invariant(response?.ok(), `navigation failed: HTTP ${response?.status()}`);
          await page.waitForFunction(
            (expectedStageId) => {
              const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
              return snapshot?.screen === "battle"
                && snapshot.stageId === expectedStageId
                && snapshot.running === true;
            },
            stage.id,
            { timeout },
          );
          if (requireInfectedAbilityLifecycle && stage.expectedEnemyKinds?.length) {
            await startInfectedAbilityObserver(page, stage.expectedEnemyKinds);
          }

          const energyBeforeDeployment = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot().energy);
          await page.locator('button.unit-card[data-kind="scout"]').click({ timeout });
          await page.waitForFunction(
            (previousEnergy) => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().energy < previousEnergy,
            energyBeforeDeployment,
            { timeout: 2_000 },
          );
          const energyAfterScout = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot().energy);
          await page.locator('button.unit-card[data-kind="ranger"]').click({ timeout });
          await page.waitForFunction(
            (previousEnergy) => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().energy < previousEnergy,
            energyAfterScout,
            { timeout: 2_000 },
          );
          await page.waitForFunction(
            (expectedStageId) => {
              const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
              return snapshot?.stageId === expectedStageId
                && snapshot.fighters.filter((fighter) => fighter.side === "human" && fighter.combatReady).length >= 2
                && snapshot.fighters.some((fighter) => fighter.side === "zombie" && fighter.combatReady);
            },
            stage.id,
            { timeout },
          );
          await page.waitForTimeout(1_200);
          if ([9, 12, 19].includes(stage.number)) {
            await page.waitForFunction(() => {
              const formation = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().escortFormation;
              return formation?.units.some(({ x }) => x > formation.cartX + 2);
            }, null, { timeout });
          }
          if (stage.expectedEnemyKinds?.length) {
            await page.waitForFunction(
              (expectedKinds) => {
                const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
                if (!snapshot) return false;
                const seenKinds = new Set([
                  ...snapshot.fighters.map(({ kind }) => kind),
                  ...snapshot.corpses.map(({ kind }) => kind),
                ]);
                return expectedKinds.every((kind) => seenKinds.has(kind));
              },
              stage.expectedEnemyKinds,
              { timeout },
            );
          }
          const infectedAbilityLifecycle = requireInfectedAbilityLifecycle && stage.expectedEnemyKinds?.length
            ? await waitForInfectedAbilityLifecycle(page, stage.expectedEnemyKinds)
            : null;
          const dynamicAi = await observeDynamicAi(
            page,
            stage.number === 1 ? 20_000 : 2_500,
          );

          const snapshot = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
          const dimensions = await readViewportEvidence(page);
          const activeFighters = snapshot.fighters.filter((fighter) => fighter.hp > 0 && fighter.combatReady);
          const fighterById = new Map(snapshot.fighters.map((fighter) => [fighter.id, fighter]));
          invariant(snapshot.screen === "battle" && snapshot.running && !snapshot.over, "battle did not remain live");
          const expectedViewportId = viewport.width === 1280 && viewport.height === 720
            ? "standard"
            : `${viewport.width}x${viewport.height}`;
          invariant(snapshot.geometry?.viewportId === expectedViewportId, `viewport geometry mismatch: ${snapshot.geometry?.viewportId}`);
          invariant(snapshot.geometry?.offFloorCount === 0, `off-floor fighters: ${JSON.stringify(snapshot.geometry?.offFloorIds)}`);
          invariant(snapshot.geometry?.visuallyOffFloorCount === 0,
            `fighters outside authored visual floor: ${JSON.stringify(snapshot.geometry?.visuallyOffFloorIds)}`);
          if (stage.number < 17) {
            invariant(snapshot.geometry?.visualFloor?.authored === false,
              "legacy stage unexpectedly inherited a Version 0.9.0 visual floor");
            invariant(activeFighters.every((fighter) => fighter.renderDepthScale === 1),
              `legacy stage inherited perspective depth: ${JSON.stringify(activeFighters)}`);
          } else {
            invariant(snapshot.geometry?.visualFloor?.authored === true, "Version 0.9.0 visual floor profile missing");
            const scalesByLane = [0, 1, 2].map((lane) => (
              activeFighters
                .filter((fighter) => fighter.lane === lane)
                .map((fighter) => fighter.renderDepthScale)
            )).filter((samples) => samples.length > 0);
            invariant(activeFighters.every((fighter) => (
              Number.isFinite(fighter.renderDepthScale)
              && fighter.renderDepthScale >= snapshot.geometry.visualFloor.farScale
              && fighter.renderDepthScale <= snapshot.geometry.visualFloor.nearScale
            )), "fighter perspective scale left the authored floor range");
            for (let index = 1; index < scalesByLane.length; index += 1) {
              invariant(
                Math.max(...scalesByLane[index - 1]) < Math.min(...scalesByLane[index]),
                `near lane was not rendered larger than far lane: ${JSON.stringify(scalesByLane)}`,
              );
            }
          }
          invariant(snapshot.stationMetrics?.offFloorSteps === 0, `runtime grounding clamps: ${snapshot.stationMetrics?.offFloorSteps}`);
          invariant(activeFighters.every((fighter) => typeof fighter.aiProfile === "string" && fighter.aiProfile.length > 0),
            "an active fighter had no AI profile");
          invariant(activeFighters.every((fighter) => fighter.navigationRecovery
            && Number.isFinite(fighter.navigationRecovery.stuckSeconds)
            && Number.isInteger(fighter.navigationRecovery.recoveryCount)),
          "an active fighter had invalid navigation recovery state");
          invariant(activeFighters.every((fighter) => fighter.targetId === null
            || (fighterById.has(fighter.targetId) && fighterById.get(fighter.targetId).side !== fighter.side)),
          "target identity pointed to a missing or friendly fighter");
          if ([9, 12, 19].includes(stage.number)) {
            const formation = snapshot.escortFormation;
            invariant(formation?.units.some(({ duty }) => duty === "escort-anchor"),
              `escort anchor missing: ${JSON.stringify(formation)}`);
            invariant(formation.units.some(({ duty, destinationX }) => (
              duty !== "escort-anchor" && destinationX > formation.cartX
            )), `escort front destination missing: ${JSON.stringify(formation)}`);
            invariant(formation.units.some(({ x }) => x > formation.cartX + 2),
              `no ally moved ahead of escort object: ${JSON.stringify(formation)}`);
            invariant(new Set(formation.units.map(({ destinationX }) => destinationX)).size > 1,
              `escort roles collapsed to one destination: ${JSON.stringify(formation)}`);
          }
          if ([9, 12].includes(stage.number)) {
            const missionObject = snapshot.escortMissionObject;
            invariant(missionObject?.assetId === "maintenance-cart"
              && missionObject.assetPath === "/art/v095/mission-objects/maintenance-cart-v1.png",
            `maintenance cart identity mismatch: ${JSON.stringify(missionObject)}`);
            invariant(missionObject.assetLoaded === true
              && missionObject.naturalWidth === 480
              && missionObject.naturalHeight === 168,
            `maintenance cart production asset unavailable: ${JSON.stringify(missionObject)}`);
            invariant(missionObject.geometricFallbackAllowed === false,
              "maintenance cart geometric fallback must stay disabled");
            invariant(["start", "moving", "damaged", "stalled"].includes(missionObject.visualState),
              `maintenance cart runtime state missing: ${JSON.stringify(missionObject)}`);
          }
          invariant(snapshot.attackIdentity.every((attack) => attack.targetId === attack.damageTargetId),
            `projectile/damage identity mismatch: ${JSON.stringify(snapshot.attackIdentity)}`);
          if (stage.number === 1) {
            invariant(dynamicAi.attackIdentitySamples > 0,
              `no live attack identity was observed: ${JSON.stringify(dynamicAi)}`);
          }
          invariant(dynamicAi.attackIdentityMismatches === 0,
            `live projectile/damage identity mismatch: ${JSON.stringify(dynamicAi)}`);
          invariant(dynamicAi.invalidTargetSamples === 0,
            `live target pointed to a dead, missing, or friendly fighter: ${JSON.stringify(dynamicAi)}`);
          invariant(dynamicAi.movementReversals <= 8,
            `excessive short-window AI oscillation: ${JSON.stringify(dynamicAi)}`);
          invariant(dimensions.innerWidth === viewport.width && dimensions.innerHeight === viewport.height,
            `layout viewport mismatch: ${dimensions.innerWidth}x${dimensions.innerHeight}`);
          invariant(dimensions.documentWidth <= viewport.width && dimensions.documentHeight <= viewport.height,
            `viewport overflow: ${JSON.stringify(dimensions)}`);
          invariant(dimensions.safeAreaSource === "local-qa-iphone-landscape"
            && dimensions.safeArea.left === "44px"
            && dimensions.safeArea.right === "44px"
            && dimensions.safeArea.bottom === "21px",
          `safe-area mismatch: ${JSON.stringify(dimensions)}`);
          assertDiagnostics(diagnostics);
          await page.screenshot({ path: path.join(evidenceDir, `${name}.png`) });
          Object.assign(result, {
            status: "passed",
            snapshot: {
              time: snapshot.time,
              wave: snapshot.wave,
              activeFighterCount: activeFighters.length,
              humanProfiles: [...new Set(activeFighters.filter(({ side }) => side === "human").map(({ aiProfile }) => aiProfile))],
              enemyProfiles: [...new Set(activeFighters.filter(({ side }) => side === "zombie").map(({ aiProfile }) => aiProfile))],
              aiRecoveries: snapshot.stationMetrics.aiRecoveries,
              attackIdentitySamples: dynamicAi.attackIdentitySamples,
              dynamicAi,
              escortFormation: snapshot.escortFormation,
              escortMissionObject: snapshot.escortMissionObject,
              expectedEnemyKinds: stage.expectedEnemyKinds ?? [],
              infectedAbilityLifecycle,
            },
            dimensions,
            diagnostics: { ...diagnostics, warnings: unexpectedWarnings(diagnostics.warnings) },
          });
        } catch (error) {
          result.error = String(error);
          result.diagnostics = { ...diagnostics, warnings: unexpectedWarnings(diagnostics.warnings) };
          try {
            result.failureSnapshot = await page.evaluate(() => {
              const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
              return snapshot ? {
                screen: snapshot.screen,
                stageId: snapshot.stageId,
                time: snapshot.time,
                wave: snapshot.wave,
                running: snapshot.running,
                over: snapshot.over,
                fighters: snapshot.fighters.map((fighter) => ({
                  id: fighter.id,
                  kind: fighter.kind,
                  side: fighter.side,
                  hp: fighter.hp,
                  combatReady: fighter.combatReady,
                  stationAbility: fighter.stationAbility,
                })),
                infectedAbilityLifecycle: window.__ASHFALL_INFECTED_PHASE_OBSERVER__?.observed ?? null,
              } : null;
            });
          } catch {
            // Navigation can fail before the QA bridge exists.
          }
          try {
            await page.screenshot({ path: path.join(evidenceDir, `${name}-FAILED.png`) });
          } catch {
            // The page may fail before rendering.
          }
        } finally {
          results.push(result);
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
}

const summary = {
  baseUrl: String(baseUrl),
  generatedAt: new Date().toISOString(),
  passed: results.filter(({ status }) => status === "passed").length,
  failed: results.filter(({ status }) => status === "failed").length,
  results,
};
await writeFile(path.join(evidenceDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify(summary, null, 2));

if (summary.failed > 0) {
  throw new Error(`AI mission browser smoke failed ${summary.failed}/${results.length}; see ${path.join(evidenceDir, "summary.json")}`);
}
