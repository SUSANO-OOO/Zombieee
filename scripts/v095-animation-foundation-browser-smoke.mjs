import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const baseUrl = new URL(
  process.env.V095_ANIMATION_FOUNDATION_QA_BASE_URL
    ?? process.env.COMBAT_PRESENTATION_QA_BASE_URL
    ?? "http://127.0.0.1:4177/",
);
if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname)) {
  throw new Error(`Animation foundation QA is local-only; refusing ${baseUrl}`);
}

const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href)
  : await import("playwright");
const browserTypes = { chromium: playwright.chromium, webkit: playwright.webkit };
const engines = (process.env.V095_ANIMATION_FOUNDATION_QA_ENGINES ?? "chromium,webkit")
  .split(",")
  .map((engine) => engine.trim())
  .filter(Boolean);
const viewports = [
  { width: 844, height: 390 },
  { width: 844, height: 340 },
];
const evidenceDir = path.resolve(
  process.env.V095_ANIMATION_FOUNDATION_QA_EVIDENCE_DIR
    ?? "outputs/v095-animation-foundation",
);
const timeout = Math.max(
  8_000,
  Number(process.env.V095_ANIMATION_FOUNDATION_QA_TIMEOUT_MS) || 24_000,
);
const results = [];

await mkdir(evidenceDir, { recursive: true });

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function caseUrl() {
  const url = new URL(baseUrl);
  url.search = new URLSearchParams({
    qa: "mission",
    stage: "3",
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

async function nextPaint(page) {
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
}

async function captureState(page, name, fighterId, label) {
  await nextPaint(page);
  const snapshot = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
  const fighter = snapshot.fighters.find((candidate) => candidate.id === fighterId);
  invariant(fighter, `${label}: proof fighter disappeared`);
  invariant(fighter.animationPresentation.groundAnchor === 1, `${label}: ground anchor changed`);
  invariant(fighter.animationPresentation.pose.offsetY === 0, `${label}: contact point lifted`);
  invariant(snapshot.geometry.offFloorCount === 0, `${label}: logical off-floor fighter`);
  invariant(snapshot.geometry.visuallyOffFloorCount === 0, `${label}: visual off-floor fighter`);
  const screenshotPath = path.join(evidenceDir, `${name}-${label}.png`);
  const buffer = await page.locator("canvas").screenshot({ path: screenshotPath });
  return {
    label,
    state: fighter.animationPresentation.state,
    direction: fighter.animationPresentation.direction,
    moving: fighter.animationPresentation.moving,
    deployCompleted: fighter.animationPresentation.deployCompleted,
    gateEntering: fighter.gateEntering,
    elapsedSeconds: fighter.animationPresentation.elapsedSeconds,
    transitionCount: fighter.animationPresentation.transitionCount,
    eventCount: fighter.animationPresentation.eventCount,
    lastEvents: fighter.animationPresentation.lastEvents,
    sampledSpriteState: fighter.animationPresentation.sampledSpriteState,
    groundAnchor: fighter.animationPresentation.groundAnchor,
    pose: fighter.animationPresentation.pose,
    x: fighter.x,
    y: fighter.y,
    canvasSha256: createHash("sha256").update(buffer).digest("hex"),
    screenshot: path.relative(process.cwd(), screenshotPath).replaceAll("\\", "/"),
  };
}

async function step(page, fighterId, action, seconds) {
  const result = await page.evaluate(
    ({ id, requestedAction, elapsed }) => (
      window.__ASHFALL_BATTLE_QA__.stepAnimationFoundationProof(id, requestedAction, elapsed)
    ),
    { id: fighterId, requestedAction: action, elapsed: seconds },
  );
  invariant(result, `${action}: QA step failed`);
  return result;
}

for (const engine of engines) {
  const browserType = browserTypes[engine];
  if (!browserType) {
    results.push({ engine, status: "failed", error: `unknown engine ${engine}` });
    continue;
  }
  let browser;
  try {
    browser = await browserType.launch({ headless: true });
  } catch (error) {
    results.push({ engine, status: "failed", error: `browser launch failed: ${String(error)}` });
    continue;
  }

  try {
    for (const viewport of viewports) {
      const name = `${engine}-${viewport.width}x${viewport.height}-dpr3`;
      const context = await browser.newContext({ viewport, deviceScaleFactor: 3 });
      const page = await context.newPage();
      const diagnostics = diagnosticsFor(page);
      const result = {
        engine,
        viewport,
        deviceScaleFactor: 3,
        url: caseUrl(),
        status: "failed",
      };
      try {
        const response = await page.goto(result.url, { waitUntil: "domcontentloaded", timeout });
        invariant(response?.ok(), `navigation failed: HTTP ${response?.status()}`);
        await page.waitForFunction(
          () => {
            const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
            return snapshot?.screen === "battle"
              && snapshot.running === true
              && typeof window.__ASHFALL_BATTLE_QA__?.prepareAnimationFoundationProof === "function";
          },
          null,
          { timeout },
        );
        await page.waitForFunction(
          () => Number(document.documentElement.dataset.assetResidentSprites) >= 25,
          null,
          { timeout },
        );
        const prepared = await page.evaluate(
          () => window.__ASHFALL_BATTLE_QA__.prepareAnimationFoundationProof("scout", "human"),
        );
        invariant(prepared?.state === "deploy", `deploy fixture failed: ${JSON.stringify(prepared)}`);
        const frames = [];

        await step(page, prepared.fighterId, "deploy", .12);
        frames.push(await captureState(page, name, prepared.fighterId, "01-deploy"));

        await step(page, prepared.fighterId, "deploy-move-right", .1);
        await step(page, prepared.fighterId, "deploy-move-right", .12);
        frames.push(await captureState(page, name, prepared.fighterId, "02-gate-move"));

        await step(page, prepared.fighterId, "stop", .02);
        await step(page, prepared.fighterId, "stop", .08);
        frames.push(await captureState(page, name, prepared.fighterId, "03-stop-move"));
        await step(page, prepared.fighterId, "stop", .12);

        await step(page, prepared.fighterId, "move-right", .05);
        await step(page, prepared.fighterId, "move-right", .13);
        frames.push(await captureState(page, name, prepared.fighterId, "04-start-move"));

        await step(page, prepared.fighterId, "move-right", .2);
        frames.push(await captureState(page, name, prepared.fighterId, "05-move-right"));

        await step(page, prepared.fighterId, "move-left", .02);
        await step(page, prepared.fighterId, "move-left", .07);
        frames.push(await captureState(page, name, prepared.fighterId, "06-turn-left"));

        await step(page, prepared.fighterId, "hit-heavy", .02);
        await step(page, prepared.fighterId, "hit-heavy", .08);
        frames.push(await captureState(page, name, prepared.fighterId, "07-hit-heavy"));

        await step(page, prepared.fighterId, "reload", .02);
        await step(page, prepared.fighterId, "reload", .16);
        frames.push(await captureState(page, name, prepared.fighterId, "08-reload"));

        const expectedStates = [
          "deploy",
          "move",
          "stop-move",
          "start-move",
          "move",
          "turn",
          "hit-heavy",
          "reload",
        ];
        invariant(
          JSON.stringify(frames.map(({ state }) => state)) === JSON.stringify(expectedStates),
          `state sequence mismatch: ${JSON.stringify(frames.map(({ state }) => state))}`,
        );
        invariant(frames[1].gateEntering === true && frames[1].deployCompleted === true,
          `gate route did not continue after deploy: ${JSON.stringify(frames[1])}`);
        invariant(frames[1].sampledSpriteState.startsWith("walk-"),
          `gate route slid on an idle frame: ${JSON.stringify(frames[1])}`);
        invariant(frames[4].direction === "right", "move-right did not lock right facing");
        invariant(frames[5].direction === "left", "turn did not lock left facing");
        invariant(frames[3].lastEvents.some(({ type }) => type === "footstep"),
          `start-move event missing: ${JSON.stringify(frames[3].lastEvents)}`);
        invariant(new Set(frames.map(({ canvasSha256 }) => canvasSha256)).size >= 7,
          "continuous Canvas captures did not produce distinct player-facing states");
        for (const [kind, entries] of Object.entries(diagnostics)) {
          invariant(entries.length === 0, `${kind}: ${JSON.stringify(entries)}`);
        }
        Object.assign(result, {
          status: "passed",
          prepared,
          frames,
          diagnostics,
          assetEvidence: {
            scope: await page.evaluate(() => document.documentElement.dataset.assetResidentScope),
            sprites: await page.evaluate(() => Number(document.documentElement.dataset.assetResidentSprites)),
          },
        });
      } catch (error) {
        result.error = String(error);
        result.diagnostics = diagnostics;
        try {
          result.failureSnapshot = await page.evaluate(
            () => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.() ?? null,
          );
        } catch {
          // Navigation can fail before the local QA bridge exists.
        }
        try {
          await page.screenshot({ path: path.join(evidenceDir, `${name}-FAILED.png`) });
        } catch {
          // Keep the original failure.
        }
      } finally {
        results.push(result);
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}

const summary = {
  generatedAt: new Date().toISOString(),
  baseUrl: String(baseUrl),
  results,
  totals: {
    cases: results.length,
    passed: results.filter(({ status }) => status === "passed").length,
    failed: results.filter(({ status }) => status !== "passed").length,
  },
};
await writeFile(
  path.join(evidenceDir, "summary.json"),
  `${JSON.stringify(summary, null, 2)}\n`,
  "utf8",
);

if (summary.totals.failed > 0) {
  console.error(JSON.stringify(summary, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(summary, null, 2));
}
