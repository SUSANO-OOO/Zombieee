import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

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
if (unknownEngines.length > 0) throw new Error(`Unknown AI_MISSION_QA_ENGINES: ${unknownEngines.join(", ")}`);

const viewports = [
  { width: 844, height: 390 },
  { width: 844, height: 340 },
];
const allStages = [
  { number: 1, id: "stage-nishijin-shopping-street" },
  { number: 2, id: "stage-sawara-ward-office" },
  { number: 3, id: "stage-nishijin-defense-line-takuya" },
  { number: 4, id: "stage-nishijin-station-gate" },
  { number: 5, id: "stage-nishijin-station-platform" },
  { number: 6, id: "stage-nishijin-station-tunnel-seal" },
];
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
const timeout = Math.max(8_000, Number(process.env.AI_MISSION_QA_TIMEOUT_MS) || 24_000);
const results = [];

await mkdir(evidenceDir, { recursive: true });

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function caseUrl(stage) {
  const url = new URL(baseUrl);
  url.search = new URLSearchParams({
    qa: "mission",
    stage: String(stage.number),
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

          const snapshot = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
          const dimensions = await readViewportEvidence(page);
          const activeFighters = snapshot.fighters.filter((fighter) => fighter.hp > 0 && fighter.combatReady);
          const fighterById = new Map(snapshot.fighters.map((fighter) => [fighter.id, fighter]));
          invariant(snapshot.screen === "battle" && snapshot.running && !snapshot.over, "battle did not remain live");
          invariant(snapshot.geometry?.viewportId === `${viewport.width}x${viewport.height}`, `viewport geometry mismatch: ${snapshot.geometry?.viewportId}`);
          invariant(snapshot.geometry?.offFloorCount === 0, `off-floor fighters: ${JSON.stringify(snapshot.geometry?.offFloorIds)}`);
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
          invariant(snapshot.attackIdentity.every((attack) => attack.targetId === attack.damageTargetId),
            `projectile/damage identity mismatch: ${JSON.stringify(snapshot.attackIdentity)}`);
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
              attackIdentitySamples: snapshot.attackIdentity.length,
            },
            dimensions,
            diagnostics: { ...diagnostics, warnings: unexpectedWarnings(diagnostics.warnings) },
          });
        } catch (error) {
          result.error = String(error);
          result.diagnostics = { ...diagnostics, warnings: unexpectedWarnings(diagnostics.warnings) };
          try {
            result.failureSnapshot = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.() ?? null);
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
