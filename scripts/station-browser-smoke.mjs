import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const baseUrl = new URL(process.env.STATION_QA_BASE_URL ?? "http://127.0.0.1:4177/");
if (baseUrl.hostname !== "localhost" && baseUrl.hostname !== "127.0.0.1") {
  throw new Error(`Station QA routes are local-only; refusing non-local URL ${baseUrl}`);
}

const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href)
  : await import("playwright");

const browserTypes = {
  chromium: playwright.chromium,
  webkit: playwright.webkit,
};
const requestedEngines = (process.env.STATION_QA_ENGINES ?? "chromium,webkit")
  .split(",")
  .map((engine) => engine.trim())
  .filter(Boolean);
const unknownEngines = requestedEngines.filter((engine) => !browserTypes[engine]);
if (unknownEngines.length > 0) {
  throw new Error(`Unknown STATION_QA_ENGINES value: ${unknownEngines.join(", ")}`);
}

const evidenceDir = path.resolve(process.env.STATION_QA_EVIDENCE_DIR ?? "outputs/station-browser-smoke");
const timeout = Math.max(5_000, Number(process.env.STATION_QA_TIMEOUT_MS) || 30_000);
const viewports = [
  { width: 844, height: 390 },
  { width: 844, height: 340 },
];
const allStages = [
  { number: 4, id: "stage-nishijin-station-gate" },
  { number: 5, id: "stage-nishijin-station-platform" },
  { number: 6, id: "stage-nishijin-station-tunnel-seal" },
];
const requestedStageNumbers = (process.env.STATION_QA_STAGES ?? "4,5,6")
  .split(",")
  .map((stage) => Number(stage.trim()))
  .filter(Number.isInteger);
const stages = allStages.filter((stage) => requestedStageNumbers.includes(stage.number));
const unknownStageNumbers = requestedStageNumbers.filter((number) => !allStages.some((stage) => stage.number === number));
if (stages.length === 0 || unknownStageNumbers.length > 0) {
  throw new Error(`Unknown STATION_QA_STAGES value: ${unknownStageNumbers.join(", ") || "(empty)"}`);
}
const states = ["start", "near-win", "near-loss"];
const results = [];

await mkdir(evidenceDir, { recursive: true });

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function unexpectedWarnings(warnings) {
  return warnings.filter((warning) => !warning.includes("was preloaded using link preload but not used"));
}

function assertDiagnostics(diagnostics, pendingRequestCount = 0) {
  const warnings = unexpectedWarnings(diagnostics.warnings);
  invariant(pendingRequestCount === 0, `pending requests remained at assertion: ${pendingRequestCount}`);
  invariant(diagnostics.consoleErrors.length === 0, `console errors: ${JSON.stringify(diagnostics.consoleErrors)}`);
  invariant(diagnostics.pageErrors.length === 0, `page errors: ${JSON.stringify(diagnostics.pageErrors)}`);
  invariant(diagnostics.requestFailures.length === 0, `request failures: ${JSON.stringify(diagnostics.requestFailures)}`);
  invariant(diagnostics.httpErrors.length === 0, `HTTP errors: ${JSON.stringify(diagnostics.httpErrors)}`);
  invariant(warnings.length === 0, `console warnings: ${JSON.stringify(warnings)}`);
}

function caseUrl(stage, state) {
  const url = new URL(baseUrl);
  url.search = new URLSearchParams({
    qa: "station",
    stage: String(stage.number),
    state,
    safe: "iphone-landscape",
  }).toString();
  return url;
}

function assertSnapshot({
  snapshot,
  dimensions,
  diagnostics,
  pendingRequestCount,
  activity,
  stage,
  state,
  viewport,
}) {
  invariant(snapshot.stageId === stage.id, `stage mismatch: ${snapshot.stageId} !== ${stage.id}`);
  invariant(snapshot.screen === (state === "start" ? "battle" : "result"), `unexpected screen: ${snapshot.screen}`);
  invariant(snapshot.geometry?.viewportId === `${viewport.width}x${viewport.height}`, `geometry viewport mismatch: ${snapshot.geometry?.viewportId}`);
  invariant(snapshot.geometry?.checkedCount > 0, "grounding audit had no active fighters");
  invariant(snapshot.geometry?.offFloorCount === 0, `combat-ready fighters off floor: ${JSON.stringify(snapshot.geometry?.offFloorIds)}`);
  invariant(snapshot.stationMetrics?.offFloorSteps === 0, `runtime grounding clamps detected: ${snapshot.stationMetrics?.offFloorSteps}`);
  invariant(dimensions.innerWidth === viewport.width && dimensions.innerHeight === viewport.height,
    `viewport mismatch: ${dimensions.innerWidth}x${dimensions.innerHeight}`);
  invariant(dimensions.documentWidth <= viewport.width && dimensions.bodyWidth <= viewport.width,
    `horizontal overflow: document=${dimensions.documentWidth}, body=${dimensions.bodyWidth}, viewport=${viewport.width}`);
  invariant(dimensions.documentHeight <= viewport.height && dimensions.bodyHeight <= viewport.height,
    `vertical overflow: document=${dimensions.documentHeight}, body=${dimensions.bodyHeight}, viewport=${viewport.height}`);
  invariant(dimensions.safeAreaSource === "local-qa-iphone-landscape",
    `safe-area preset missing: ${dimensions.safeAreaSource ?? "unset"}`);
  invariant(dimensions.safeArea.left === "44px" && dimensions.safeArea.right === "44px" && dimensions.safeArea.bottom === "21px",
    `safe-area values mismatch: ${JSON.stringify(dimensions.safeArea)}`);
  invariant(dimensions.outsideViewportElements.length === 0,
    `visible battle UI outside viewport: ${JSON.stringify(dimensions.outsideViewportElements)}`);

  if (state === "start") {
    invariant(snapshot.running === true && snapshot.over === false, "start scenario did not remain an active battle");
    invariant(activity?.deployedUnitId !== null && activity?.movementDistance > .25,
      `deployed unit did not move through live geometry: ${JSON.stringify(activity)}`);
  } else {
    const expectedWin = state === "near-win";
    invariant(snapshot.over === true, `${state} scenario did not finish`);
    invariant(snapshot.won === expectedWin, `${state} outcome mismatch: won=${snapshot.won}`);
    invariant(snapshot.resultId && snapshot.processedResultIds?.includes(snapshot.resultId),
      `result receipt was not processed before result UI: ${snapshot.resultId}`);
  }

  if (stage.number === 6 && state === "near-win") {
    const mission = snapshot.stageMission ?? {};
    const container = snapshot.researchContainer;
    invariant(mission.gateEaterContained === true, "Stage 6 Gate Eater was not contained");
    invariant(mission.researchContainerExposed === true && mission.researchContainerContained === true,
      "Stage 6 research container was not exposed and contained");
    invariant(container?.exposed === true && container?.contained === true,
      `Stage 6 research container runtime mismatch: ${JSON.stringify(container)}`);
    invariant(mission.sealed === true, "Stage 6 seal did not complete");
    invariant(mission.returnTargetCount >= 1 && mission.returnedCount >= mission.returnTargetCount,
      `Stage 6 survivors did not all return: ${mission.returnedCount}/${mission.returnTargetCount}`);
  }

  assertDiagnostics(diagnostics, pendingRequestCount);
}

async function readEvidence(page) {
  return page.evaluate(() => {
    const bridge = window.__ASHFALL_BATTLE_QA__;
    if (!bridge || typeof bridge.getSnapshot !== "function") throw new Error("Battle QA bridge unavailable");
    const rootStyle = getComputedStyle(document.documentElement);
    const selectors = [
      ".game-shell",
      ".game-frame",
      ".battlefield",
      ".top-hud",
      ".health-hud",
      ".mission-health",
      ".bottom-hud",
      ".combat-deck",
      ".unit-cards",
      ".support-row",
      ".stats-strip",
      ".enable-audio-button",
      ".campaign-overlay",
      ".result-panel",
    ];
    const outsideViewportElements = selectors.flatMap((selector) => [...document.querySelectorAll(selector)])
      .filter((element) => {
        const style = getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden") return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0
          && (rect.left < -1 || rect.top < -1 || rect.right > window.innerWidth + 1 || rect.bottom > window.innerHeight + 1);
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          selector: element.className,
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
        };
      });
    return {
      snapshot: bridge.getSnapshot(),
      dimensions: {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        documentWidth: document.documentElement.scrollWidth,
        documentHeight: document.documentElement.scrollHeight,
        bodyWidth: document.body.scrollWidth,
        bodyHeight: document.body.scrollHeight,
        viewportSource: document.documentElement.dataset.viewportSource ?? null,
        safeAreaSource: document.documentElement.dataset.safeAreaSource ?? null,
        safeArea: {
          top: rootStyle.getPropertyValue("--app-viewport-safe-top").trim(),
          right: rootStyle.getPropertyValue("--app-viewport-safe-right").trim(),
          bottom: rootStyle.getPropertyValue("--app-viewport-safe-bottom").trim(),
          left: rootStyle.getPropertyValue("--app-viewport-safe-left").trim(),
        },
        outsideViewportElements,
      },
    };
  });
}

for (const engine of requestedEngines) {
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
        for (const state of states) {
          const name = `${engine}-stage${stage.number}-${state}-${viewport.width}x${viewport.height}`;
          const diagnostics = {
            consoleErrors: [],
            pageErrors: [],
            requestFailures: [],
            httpErrors: [],
            warnings: [],
          };
          const context = await browser.newContext({ viewport });
          const page = await context.newPage();
          const pendingRequests = new Set();
          page.on("request", (request) => pendingRequests.add(request));
          page.on("requestfinished", (request) => pendingRequests.delete(request));
          page.on("console", (message) => {
            if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
            if (message.type() === "warning") diagnostics.warnings.push(message.text());
          });
          page.on("pageerror", (error) => diagnostics.pageErrors.push(String(error)));
          page.on("requestfailed", (request) => {
            pendingRequests.delete(request);
            diagnostics.requestFailures.push(`${request.url()} :: ${request.failure()?.errorText ?? "unknown"}`);
          });
          page.on("response", (response) => {
            if (response.status() >= 400) diagnostics.httpErrors.push(`${response.status()} ${response.url()}`);
          });

          const result = {
            engine,
            viewport,
            stage: stage.number,
            stageId: stage.id,
            state,
            scenarioKind: state === "start" ? "live-start-deployment" : "near-terminal-fixture",
            url: String(caseUrl(stage, state)),
            status: "failed",
          };
          try {
            let activity = null;
            let postResult = null;
            const navigation = await page.goto(String(caseUrl(stage, state)), { waitUntil: "domcontentloaded", timeout });
            invariant(navigation?.ok(), `document navigation failed: ${navigation?.status() ?? "no response"}`);
            await page.waitForFunction(
              ({ expectedStageId }) => {
                const bridge = window.__ASHFALL_BATTLE_QA__;
                if (!bridge || typeof bridge.getSnapshot !== "function") return false;
                const snapshot = bridge.getSnapshot();
                return snapshot.stageId === expectedStageId && snapshot.running === true;
              },
              { expectedStageId: stage.id },
              { timeout },
            );

            if (state === "start") {
              await page.locator('.game-shell[data-screen="battle"]').waitFor({ state: "visible", timeout });
              await page.getByRole("button", { name: /ハチ/ }).click({ timeout });
              await page.waitForFunction(
                ({ expectedStageId }) => {
                  const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
                  return snapshot?.stageId === expectedStageId
                    && snapshot.geometry?.checkedCount > 0
                    && snapshot.fighters.some((fighter) => fighter.side === "human" && fighter.combatReady === true);
                },
                { expectedStageId: stage.id },
                { timeout },
              );
              const movementStart = await page.evaluate(() => {
                const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
                const fighter = snapshot.fighters.find((candidate) => candidate.side === "human" && candidate.combatReady === true);
                return fighter ? { id: fighter.id, x: fighter.x, y: fighter.y } : null;
              });
              await page.waitForTimeout(900);
              const movementEnd = await page.evaluate((deployedUnitId) => {
                const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
                const fighter = snapshot.fighters.find((candidate) => String(candidate.id) === String(deployedUnitId));
                return fighter ? { id: fighter.id, x: fighter.x, y: fighter.y } : null;
              }, movementStart?.id ?? null);
              activity = {
                deployedUnitId: movementStart?.id ?? null,
                movementDistance: movementStart && movementEnd
                  ? Math.hypot(movementEnd.x - movementStart.x, movementEnd.y - movementStart.y)
                  : 0,
              };
            } else {
              const expectedWin = state === "near-win";
              await page.waitForFunction(
                ({ expectedStageId, expectedWin }) => {
                  const bridge = window.__ASHFALL_BATTLE_QA__;
                  if (!bridge || typeof bridge.getSnapshot !== "function") return false;
                  const snapshot = bridge.getSnapshot();
                  return snapshot.stageId === expectedStageId
                    && snapshot.over === true
                    && snapshot.won === expectedWin
                    && snapshot.screen === "result";
                },
                { expectedStageId: stage.id, expectedWin },
                { timeout },
              );
            }

            await page.waitForLoadState("networkidle", { timeout: Math.min(timeout, 10_000) });
            await page.waitForTimeout(800);
            const evidence = await readEvidence(page);
            assertSnapshot({
              ...evidence,
              diagnostics,
              pendingRequestCount: pendingRequests.size,
              activity,
              stage,
              state,
              viewport,
            });
            await page.screenshot({ path: path.join(evidenceDir, `${name}.png`) });

            if (state === "near-win") {
              const completedResultId = evidence.snapshot.resultId;
              invariant(completedResultId, "completed battle did not expose a result receipt");
              await page.getByRole("button", { name: "同じ編成で再戦", exact: true }).click({ timeout });
              await page.waitForFunction(
                ({ expectedStageId, completedResultId }) => {
                  const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
                  return snapshot?.stageId === expectedStageId
                    && snapshot.running === true
                    && snapshot.resultId
                    && snapshot.resultId !== completedResultId
                    && snapshot.screen === "battle"
                    && snapshot.over === false
                    && snapshot.processedResultIds?.includes(completedResultId);
                },
                { expectedStageId: stage.id, completedResultId },
                { timeout },
              );
              const retrySnapshot = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
              postResult = {
                action: "retry",
                screen: retrySnapshot.screen,
                previousResultId: completedResultId,
                nextResultId: retrySnapshot.resultId,
              };
              invariant(retrySnapshot.screen === "battle" && retrySnapshot.over === false,
                `retry did not open a fresh battle: ${retrySnapshot.screen}, over=${retrySnapshot.over}`);
              invariant(retrySnapshot.processedResultIds?.includes(completedResultId),
                `retry lost the completed receipt: ${completedResultId}`);
            } else if (state === "near-loss") {
              await page.getByRole("button", { name: "エリアマップへ", exact: true }).click({ timeout });
              await page.locator('.game-shell[data-screen="map"]').waitFor({ state: "visible", timeout });
              postResult = { action: "map", screen: "map" };
            }
            if (postResult) {
              await page.waitForLoadState("networkidle", { timeout: Math.min(timeout, 10_000) });
              await page.waitForTimeout(800);
              assertDiagnostics(diagnostics, pendingRequests.size);
            }

            Object.assign(result, evidence, {
              activity,
              postResult,
              diagnostics: { ...diagnostics, warnings: unexpectedWarnings(diagnostics.warnings) },
              status: "passed",
            });
          } catch (error) {
            result.error = String(error);
            result.diagnostics = { ...diagnostics, warnings: unexpectedWarnings(diagnostics.warnings) };
            try {
              await page.screenshot({ path: path.join(evidenceDir, `${name}-FAILED.png`) });
            } catch {
              // Navigation or browser startup can fail before a screenshot is possible.
            }
          } finally {
            results.push(result);
            await context.close();
          }
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
  passed: results.filter((result) => result.status === "passed").length,
  failed: results.filter((result) => result.status === "failed").length,
  results,
};
await writeFile(path.join(evidenceDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify(summary, null, 2));

if (summary.failed > 0) {
  throw new Error(`Station browser smoke failed ${summary.failed}/${results.length} cases; see ${path.join(evidenceDir, "summary.json")}`);
}
