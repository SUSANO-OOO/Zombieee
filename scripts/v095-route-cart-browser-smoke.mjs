import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { CAMPAIGN_STAGES } from "../app/campaign.js";

const baseUrl = new URL(process.env.V095_ROUTE_CART_QA_BASE_URL ?? "http://127.0.0.1:4177/");
if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname)) {
  throw new Error(`Route/cart QA is local-only; refusing ${baseUrl}`);
}

const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href)
  : await import("playwright");
const browserTypes = { chromium: playwright.chromium, webkit: playwright.webkit };
const engines = (process.env.V095_ROUTE_CART_QA_ENGINES ?? "chromium,webkit")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
if (engines.length === 0 || engines.some((engine) => !browserTypes[engine])) {
  throw new Error(`Unknown or empty V095_ROUTE_CART_QA_ENGINES: ${engines.join(",")}`);
}

const canonicalViewports = [
  { width: 1280, height: 720 },
  { width: 844, height: 390 },
  { width: 844, height: 340 },
];
const requestedViewportIds = (process.env.V095_ROUTE_CART_QA_VIEWPORTS
  ?? "1280x720,844x390,844x340")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const viewports = canonicalViewports.filter(({ width, height }) => (
  requestedViewportIds.includes(`${width}x${height}`)
));
if (viewports.length !== requestedViewportIds.length) {
  throw new Error(`Unknown V095_ROUTE_CART_QA_VIEWPORTS: ${requestedViewportIds.join(",")}`);
}

const requestedStages = (process.env.V095_ROUTE_CART_QA_STAGES ?? "9,12")
  .split(",")
  .map((value) => Number(value.trim()))
  .filter(Number.isInteger);
const stages = requestedStages.map((number) => {
  const definition = CAMPAIGN_STAGES[number - 1];
  if (!definition) throw new Error(`Unknown V095_ROUTE_CART_QA_STAGES entry: ${number}`);
  return { number, id: definition.id };
});
const evidenceDir = path.resolve(
  process.env.V095_ROUTE_CART_QA_EVIDENCE_DIR ?? "outputs/v095-route-cart-browser-smoke",
);
const timeout = Math.min(
  60_000,
  Math.max(20_000, Number(process.env.V095_ROUTE_CART_QA_TIMEOUT_MS) || 32_000),
);
const cartStates = [
  "start",
  "moving",
  "stalled",
  "damaged",
  "result-won",
  "result-lost",
];
const results = [];

await mkdir(evidenceDir, { recursive: true });

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function caseUrl(stageId) {
  const url = new URL(baseUrl);
  url.search = new URLSearchParams({
    qa: "mission",
    stage: stageId,
    state: "start",
    safe: "iphone-landscape",
  }).toString();
  return String(url);
}

function diagnosticsFor(page) {
  const diagnostics = {
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
    httpErrors: [],
  };
  page.on("console", (message) => {
    if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(String(error)));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown";
    if (failure !== "net::ERR_ABORTED") {
      diagnostics.requestFailures.push(`${request.url()} :: ${failure}`);
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 400) diagnostics.httpErrors.push(`${response.status()} ${response.url()}`);
  });
  return diagnostics;
}

function assertDiagnostics(diagnostics) {
  for (const [kind, entries] of Object.entries(diagnostics)) {
    invariant(entries.length === 0, `${kind}: ${JSON.stringify(entries)}`);
  }
}

async function captureCanvas(page, fileName) {
  const absolutePath = path.join(evidenceDir, fileName);
  const buffer = await page.locator("canvas.battlefield.active").screenshot({
    path: absolutePath,
    animations: "allow",
  });
  return {
    path: path.relative(process.cwd(), absolutePath).replaceAll("\\", "/"),
    sha256: createHash("sha256").update(buffer).digest("hex"),
  };
}

for (const engine of engines) {
  const browser = await browserTypes[engine].launch({ headless: true });
  try {
    for (const viewport of viewports) {
      for (const stage of stages) {
        const caseName = `${engine}-stage${stage.number}-${viewport.width}x${viewport.height}`;
        const context = await browser.newContext({ viewport });
        const page = await context.newPage();
        const diagnostics = diagnosticsFor(page);
        const result = {
          engine,
          stage: stage.number,
          stageId: stage.id,
          viewport,
          status: "failed",
        };
        try {
          const response = await page.goto(caseUrl(stage.id), {
            waitUntil: "domcontentloaded",
            timeout,
          });
          invariant(response?.ok(), `${caseName}: navigation HTTP ${response?.status()}`);
          await page.waitForFunction(
            (stageId) => {
              const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
              return snapshot?.screen === "battle"
                && snapshot.stageId === stageId
                && snapshot.running === true
                && snapshot.escortMissionObject?.assetLoaded === true;
            },
            stage.id,
            { timeout },
          );

          const prepared = await page.evaluate(
            () => window.__ASHFALL_BATTLE_QA__.prepareNavigationRouteReleaseProof(),
          );
          invariant(prepared?.fighterId && prepared?.threatId,
            `${caseName}: navigation proof fixture unavailable`);
          await page.waitForFunction(
            (fighterId) => {
              const qa = window.__ASHFALL_BATTLE_QA__;
              const fighter = qa.getSnapshot().fighters.find(({ id }) => id === fighterId);
              const reachedTerminalDetour = fighter?.navigationRecovery?.recoveryCount >= 3
                && fighter.navigationRecovery.recoveryExhausted === true
                && fighter.navigationRecovery.terminalFallbackSeconds > 0;
              if (reachedTerminalDetour) qa.setRepresentativeSixProofPaused(true);
              return reachedTerminalDetour;
            },
            prepared.fighterId,
            { timeout, polling: 20 },
          );
          const terminalSnapshot = await page.evaluate(
            () => window.__ASHFALL_BATTLE_QA__.getSnapshot(),
          );
          const terminalFighter = terminalSnapshot.fighters.find(
            ({ id }) => id === prepared.fighterId,
          );
          invariant(terminalFighter.navigationRecovery.recoveryCount >= 3
            && terminalFighter.navigationRecovery.recoveryExhausted === true
            && terminalFighter.navigationRecovery.terminalFallbackSeconds > 0,
          `${caseName}: terminal detour chronology was not observed`);
          const terminalFrame = await captureCanvas(page, `${caseName}-route-terminal.png`);
          await page.evaluate(
            () => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(false),
          );
          await page.waitForFunction(
            (fighterId) => window.__ASHFALL_BATTLE_QA__.getSnapshot()
              .navigationRouteReleases.some((entry) => entry.fighterId === fighterId),
            prepared.fighterId,
            { timeout, polling: 20 },
          );
          const releaseSnapshot = await page.evaluate(
            () => window.__ASHFALL_BATTLE_QA__.getSnapshot(),
          );
          const releaseAudit = releaseSnapshot.navigationRouteReleases.find(
            ({ fighterId }) => fighterId === prepared.fighterId,
          );
          invariant(releaseAudit?.routeReleaseCount > 0,
            `${caseName}: route release was not recorded`);
          invariant(releaseAudit.before.targetId === prepared.threatId
            && releaseAudit.before.crawlerDefenseTargetId === prepared.threatId,
          `${caseName}: live target/CRAWLER claim was not armed before release`);
          invariant(releaseAudit.before.targetObjectId === 777_777,
            `${caseName}: object reservation was not armed before release`);
          invariant(releaseAudit.before.attackWindup > 0
            && releaseAudit.before.attackWindupTargetId === prepared.threatId,
          `${caseName}: attack transaction was not armed before release`);
          invariant(releaseAudit.after.targetId === null
            && releaseAudit.after.targetObjectId === null
            && releaseAudit.after.crawlerDefenseTargetId === null
            && releaseAudit.after.attackWindup === 0
            && releaseAudit.after.attackWindupTargetId === null
            && releaseAudit.after.attackFacingDirection === null
            && releaseAudit.after.retargetIn === 0
            && releaseAudit.after.nextLaneDecisionAt === 0
            && releaseAudit.after.aiMoveDirection === 0,
          `${caseName}: caller did not atomically release the stale route`);
          invariant(releaseAudit.after.recoveryExhausted === false
            && releaseAudit.after.recoveryLane === null
            && releaseAudit.after.routeReleaseRequested === true,
          `${caseName}: navigation recovery remained terminal after release`);
          const releaseFrame = await captureCanvas(page, `${caseName}-route-release.png`);

          const resumed = await page.evaluate(
            () => window.__ASHFALL_BATTLE_QA__.resumeNavigationRouteReleaseProof(),
          );
          invariant(resumed?.fighterId === prepared.fighterId,
            `${caseName}: navigation proof could not resume`);
          await page.waitForFunction(
            ({ fighterId, threatId, releaseX, releaseAttackSequence, initialThreatHp }) => {
              const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
              const fighter = snapshot.fighters.find(({ id }) => id === fighterId);
              const threat = snapshot.fighters.find(({ id }) => id === threatId);
              return Boolean(
                fighter
                && Math.abs(fighter.x - releaseX) > 8
                && fighter.attackSequence > releaseAttackSequence
                && (!threat || threat.hp < initialThreatHp),
              );
            },
            resumed,
            { timeout, polling: 20 },
          );
          const resumedSnapshot = await page.evaluate(
            () => window.__ASHFALL_BATTLE_QA__.getSnapshot(),
          );
          const resumedFighter = resumedSnapshot.fighters.find(
            ({ id }) => id === prepared.fighterId,
          );
          const resumedThreat = resumedSnapshot.fighters.find(
            ({ id }) => id === prepared.threatId,
          );
          const resumedFrame = await captureCanvas(page, `${caseName}-route-resumed.png`);

          const cartFrames = [];
          for (const state of cartStates) {
            const configured = await page.evaluate(
              (requestedState) => window.__ASHFALL_BATTLE_QA__
                .prepareEscortMissionObjectState(requestedState),
              state,
            );
            invariant(configured?.state === state,
              `${caseName}/${state}: cart state fixture unavailable`);
            await page.waitForFunction(
              (requestedState) => {
                const object = window.__ASHFALL_BATTLE_QA__.getSnapshot().escortMissionObject;
                return object?.visualState === requestedState;
              },
              state,
              { timeout, polling: 20 },
            );
            await page.waitForTimeout(80);
            const snapshot = await page.evaluate(
              () => window.__ASHFALL_BATTLE_QA__.getSnapshot(),
            );
            const object = snapshot.escortMissionObject;
            invariant(object.assetId === "maintenance-cart"
              && object.assetPath === "/art/v095/mission-objects/maintenance-cart-v1.png"
              && object.assetLoaded === true
              && object.naturalWidth === 480
              && object.naturalHeight === 168
              && object.geometricFallbackAllowed === false,
            `${caseName}/${state}: production cart identity changed`);
            invariant(object.objectiveMarkerVisible === !state.startsWith("result-"),
              `${caseName}/${state}: objective marker lifecycle mismatch`);
            const frame = await captureCanvas(page, `${caseName}-cart-${state}.png`);
            cartFrames.push({
              state,
              ...frame,
              object,
            });
          }
          invariant(new Set(cartFrames.map(({ object }) => object.assetPath)).size === 1,
            `${caseName}: cart identity changed between states`);
          invariant(new Set(cartFrames.map(({ sha256 }) => sha256)).size >= 5,
            `${caseName}: cart states did not render distinct player-facing frames`);

          const dimensions = await page.evaluate(() => ({
            innerWidth: window.innerWidth,
            innerHeight: window.innerHeight,
            documentWidth: document.documentElement.scrollWidth,
            documentHeight: document.documentElement.scrollHeight,
          }));
          invariant(dimensions.innerWidth === viewport.width
            && dimensions.innerHeight === viewport.height
            && dimensions.documentWidth <= viewport.width
            && dimensions.documentHeight <= viewport.height,
          `${caseName}: viewport overflow ${JSON.stringify(dimensions)}`);
          assertDiagnostics(diagnostics);
          Object.assign(result, {
            status: "passed",
            routeRelease: {
              prepared,
              terminal: {
                battleTime: terminalSnapshot.time,
                navigationRecovery: terminalFighter.navigationRecovery,
                frame: terminalFrame,
              },
              audit: releaseAudit,
              releaseFrame,
              resumed: {
                ...resumed,
                finalX: resumedFighter?.x ?? null,
                finalAttackSequence: resumedFighter?.attackSequence ?? null,
                finalThreatHp: resumedThreat?.hp ?? 0,
              },
              resumedFrame,
            },
            cartFrames,
            dimensions,
            diagnostics,
          });
        } catch (error) {
          result.error = String(error);
          result.diagnostics = diagnostics;
          try {
            result.failureSnapshot = await page.evaluate(
              () => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.() ?? null,
            );
            await page.screenshot({
              path: path.join(evidenceDir, `${caseName}-FAILED.png`),
            });
          } catch {
            // The page can fail before the local QA bridge is ready.
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
  generatedAt: new Date().toISOString(),
  baseUrl: String(baseUrl),
  total: results.length,
  passed: results.filter(({ status }) => status === "passed").length,
  failed: results.filter(({ status }) => status === "failed").length,
  results,
};
const summaryPath = path.join(evidenceDir, "summary.json");
await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
if (summary.failed > 0) {
  throw new Error(`Route/cart QA failed ${summary.failed}/${summary.total}; see ${summaryPath}`);
}
