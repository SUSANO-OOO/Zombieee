import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const baseUrl = new URL(process.env.BATTLE_SPACE_QA_BASE_URL ?? "http://127.0.0.1:4177/");
if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname)) {
  throw new Error(`Battle-space QA routes are local-only; refusing ${baseUrl}`);
}

const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href)
  : await import("playwright");
const engines = (process.env.BATTLE_SPACE_QA_ENGINES ?? "chromium,webkit")
  .split(",")
  .map((engine) => engine.trim())
  .filter(Boolean);
const viewports = [
  { width: 844, height: 390 },
  { width: 844, height: 340 },
];
const evidenceDir = path.resolve(process.env.BATTLE_SPACE_QA_EVIDENCE_DIR ?? "outputs/battle-space-browser-smoke");
const timeout = Math.max(5_000, Number(process.env.BATTLE_SPACE_QA_TIMEOUT_MS) || 30_000);
const results = [];

await mkdir(evidenceDir, { recursive: true });

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function qaUrl(parameters) {
  const url = new URL(baseUrl);
  url.search = new URLSearchParams({ ...parameters, safe: "iphone-landscape" }).toString();
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
    // Each scenario intentionally navigates the same page. Chromium reports
    // in-flight audio preloads cancelled by that navigation as ERR_ABORTED.
    if (failure === "net::ERR_ABORTED") return;
    diagnostics.requestFailures.push(`${request.url()} :: ${failure}`);
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

async function openBattle(page, url) {
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout });
  invariant(response?.ok(), `navigation failed: HTTP ${response?.status()}`);
  await page.locator(".game-shell").waitFor({ state: "attached", timeout });
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const screen = await page.locator(".game-shell").getAttribute("data-screen");
    if (screen === "battle") break;
    if (screen === "loadout") {
      const deploy = page.getByRole("button", { name: /この編成で出撃/u });
      if (await deploy.count() === 1 && await deploy.isEnabled()) await deploy.click();
    } else if (screen === "event") {
      const advance = page.locator('button[aria-label="セリフを送る"]');
      if (await advance.count() === 1) await advance.click();
    }
    await page.waitForTimeout(25);
  }
  await page.locator('.game-shell[data-screen="battle"]').waitFor({ state: "visible", timeout: 2_000 });
  await page.waitForFunction(() => typeof window.__ASHFALL_BATTLE_QA__?.getSnapshot === "function", null, { timeout });
}

async function clientPointForWorld(page, point) {
  const canvas = page.locator("canvas.battlefield");
  const box = await canvas.boundingBox();
  invariant(box, "battlefield canvas has no display box");
  const scale = Math.max(box.width / 960, box.height / 540);
  const offsetX = (box.width - 960 * scale) / 2;
  const offsetY = (box.height - 540 * scale) / 2;
  return {
    x: box.x + offsetX + point.x * scale,
    y: box.y + offsetY + point.y * scale,
  };
}

async function clickWorldPoint(page, point) {
  const client = await clientPointForWorld(page, point);
  await page.mouse.click(client.x, client.y);
}

async function placementCase(page) {
  await openBattle(page, qaUrl({ qa: "supplies" }));
  const before = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
  await page.locator("button.support-btn.pod").click();
  const requested = { x: 720, y: 245.25 };
  const client = await clientPointForWorld(page, requested);
  await page.mouse.move(client.x, client.y);
  await page.waitForFunction(
    () => window.__ASHFALL_BATTLE_QA__.getSnapshot().placementIndicator?.valid === true,
    null,
    { timeout },
  );
  const preview = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot().placementIndicator);
  await clickWorldPoint(page, requested);
  await page.waitForFunction(
    (count) => window.__ASHFALL_BATTLE_QA__.getSnapshot().battlefieldObjects.length > count,
    before.battlefieldObjects.length,
    { timeout },
  );
  const snapshot = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
  const placed = snapshot.battlefieldObjects[snapshot.battlefieldObjects.length - 1];
  invariant(Math.abs(placed.x - requested.x) < 0.75, `placement X snapped: ${placed.x}`);
  invariant(Math.abs(placed.y - requested.y) < 0.75, `placement Y snapped: ${placed.y}`);
  invariant(![240, 285, 325, 212, 282, 352].some((center) => Math.abs(placed.y - center) < 0.1),
    `placement retained a visible fixed-lane center: ${placed.y}`);
  invariant(snapshot.battleSpace.playerFacingLaneCount === 0, "player-facing lanes remain enabled");
  invariant(preview.valid === true, "valid placement preview was not shown");
  invariant(Math.abs(preview.y - requested.y) < 0.75, `placement preview Y snapped: ${preview.y}`);
  invariant(!String(preview.reason).includes("レーン"), "placement reason exposed a lane");

  await page.locator("button.support-btn.pod").click();
  const correctionRequested = { x: 250, y: 325 };
  const correctionClient = await clientPointForWorld(page, correctionRequested);
  await page.mouse.move(correctionClient.x, correctionClient.y);
  await page.waitForFunction(
    () => window.__ASHFALL_BATTLE_QA__.getSnapshot().placementIndicator?.reason === "最寄りの配置可能地点へ補正",
    null,
    { timeout },
  );
  const correctedPreview = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot().placementIndicator);
  invariant(correctedPreview.valid === true, "corrected placement preview was not valid");
  invariant(
    Math.hypot(correctedPreview.x - correctionRequested.x, correctedPreview.y - correctionRequested.y) > 0.75,
    "CRAWLER safe-area request was not corrected",
  );
  invariant(!String(correctedPreview.reason).includes("レーン"), "corrected placement reason exposed a lane");
  await clickWorldPoint(page, correctionRequested);
  await page.waitForFunction(
    (count) => window.__ASHFALL_BATTLE_QA__.getSnapshot().battlefieldObjects.length > count,
    snapshot.battlefieldObjects.length,
    { timeout },
  );
  const correctedSnapshot = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
  const correctedPlaced = correctedSnapshot.battlefieldObjects[correctedSnapshot.battlefieldObjects.length - 1];
  invariant(
    Math.hypot(correctedPlaced.x - correctionRequested.x, correctedPlaced.y - correctionRequested.y) > 0.75,
    "corrected placement used the forbidden request point",
  );
  invariant(Math.abs(correctedPlaced.x - correctedPreview.x) < 0.75, "corrected placement X did not match preview");
  invariant(Math.abs(correctedPlaced.y - correctedPreview.y) < 0.75, "corrected placement Y did not match preview");
  return {
    requested,
    placed,
    placementIndicator: preview,
    correction: {
      requested: correctionRequested,
      placed: correctedPlaced,
      placementIndicator: correctedPreview,
    },
    battleSpace: correctedSnapshot.battleSpace,
  };
}

async function airstrikeCase(page) {
  await openBattle(page, qaUrl({ qa: "airstrike" }));
  await page.locator("button.support-btn.airstrike").click();
  const requested = { x: 620, y: 310.25 };
  await clickWorldPoint(page, requested);
  await page.waitForFunction(
    () => Number.isFinite(window.__ASHFALL_BATTLE_QA__.getSnapshot().airstrike.targetY),
    null,
    { timeout },
  );
  const snapshot = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
  invariant(Math.abs(snapshot.airstrike.targetX - requested.x) < 0.75, `airstrike X snapped: ${snapshot.airstrike.targetX}`);
  invariant(Math.abs(snapshot.airstrike.targetY - requested.y) < 0.75, `airstrike Y snapped: ${snapshot.airstrike.targetY}`);
  invariant(snapshot.airstrike.phase !== "idle", "airstrike did not enter its request lifecycle");
  return { requested, airstrike: snapshot.airstrike };
}

async function deploymentAndSpawnCase(page) {
  await openBattle(page, qaUrl({ qa: "station", stage: "4", state: "start" }));
  const closedSnapshot = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
  invariant(closedSnapshot.crawlerDoor.phase === "closed", "CRAWLER door was not closed at rest");
  invariant(closedSnapshot.crawlerDoor.doorProgress === 0, "CRAWLER ramp was visible at rest");
  await page.locator("button.unit-card:not([disabled])").first().click();
  await page.waitForFunction(
    () => ["warning", "opening", "open"].includes(window.__ASHFALL_BATTLE_QA__.getSnapshot().crawlerDoor.phase),
    null,
    { timeout, polling: 10 },
  );
  try {
    await page.waitForFunction(
      () => window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters.some(
        (fighter) => fighter.side === "human" && fighter.spawnPortalId === "crawler-door" && fighter.gateEntering,
      ),
      null,
      { timeout, polling: 10 },
    );
  } catch {
    const snapshot = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
    throw new Error(`CRAWLER run-out entry was not observed: ${JSON.stringify(snapshot.fighters)}`);
  }
  const enteringHuman = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters.find(
    (fighter) => fighter.side === "human" && fighter.spawnPortalId === "crawler-door",
  ));
  const enteringSnapshot = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
  invariant(enteringSnapshot.crawlerDoor.phase === "open", "unit spawned before the CRAWLER door fully opened");
  invariant(enteringSnapshot.crawlerDoor.doorProgress === 1, "unit spawned on a partially opened ramp");
  invariant(enteringHuman.entryDirection === 1, "human did not run outward from the CRAWLER");
  invariant(
    Math.abs(enteringHuman.x - enteringSnapshot.battleSpace.crawlerDoor.x) < 8,
    "human did not originate inside the physical CRAWLER door",
  );
  invariant(
    enteringHuman.entryRampX === enteringSnapshot.battleSpace.crawlerRampFoot.x,
    "human ramp waypoint drifted from the rendered ramp foot",
  );
  invariant(enteringHuman.x < enteringHuman.combatReadyX, "human did not run out toward the battlefield");
  await page.waitForFunction(
    (id) => {
      const fighter = window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters.find((candidate) => candidate.id === id);
      return fighter?.combatReady === true && fighter.gateEntering === false;
    },
    enteringHuman.id,
    { timeout },
  );
  const humanReadySnapshot = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
  invariant(
    humanReadySnapshot.crawlerFootstepCount >= 1,
    "CRAWLER run-out completed without a distance-synchronized footstep cue",
  );
  await page.waitForFunction(
    () => {
      const door = window.__ASHFALL_BATTLE_QA__.getSnapshot().crawlerDoor;
      return door.phase === "closed" && door.doorProgress === 0;
    },
    null,
    { timeout, polling: 10 },
  );

  try {
    await page.waitForFunction(
      () => window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters.some(
        (fighter) => fighter.side === "zombie" && String(fighter.spawnPortalId).startsWith("enemy-portal-") && fighter.gateEntering,
      ),
      null,
      { timeout, polling: 10 },
    );
  } catch {
    const snapshot = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
    throw new Error(`enemy portal entry was not observed: ${JSON.stringify({
      time: snapshot.time,
      eventIndex: snapshot.eventIndex,
      pendingSpawnCount: snapshot.pendingSpawnCount,
      fighters: snapshot.fighters,
    })}`);
  }
  const enteringEnemy = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters.find(
    (fighter) => fighter.side === "zombie" && String(fighter.spawnPortalId).startsWith("enemy-portal-") && fighter.gateEntering,
  ));
  invariant(enteringEnemy.entryDirection === -1, "enemy did not emerge leftward from its base");
  invariant(enteringEnemy.x > enteringEnemy.combatReadyX, "enemy did not begin behind the base opening");
  const finalSnapshot = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
  invariant(finalSnapshot.battleSpace.enemyPortalCount >= 5, "enemy base exposes fewer than five internal portals");
  return {
    enteringHuman,
    enteringEnemy,
    crawlerDoor: humanReadySnapshot.crawlerDoor,
    crawlerFootstepCount: humanReadySnapshot.crawlerFootstepCount,
    battleSpace: finalSnapshot.battleSpace,
  };
}

for (const engine of engines) {
  const browserType = playwright[engine];
  invariant(browserType, `unsupported engine: ${engine}`);
  const browser = await browserType.launch({ headless: true });
  try {
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const diagnostics = diagnosticsFor(page);
      const name = `${engine}-${viewport.width}x${viewport.height}`;
      const result = { engine, viewport, status: "failed" };
      try {
        result.placement = await placementCase(page);
        result.airstrike = await airstrikeCase(page);
        result.deployment = await deploymentAndSpawnCase(page);
        await page.waitForLoadState("networkidle", { timeout: Math.min(timeout, 10_000) });
        assertDiagnostics(diagnostics);
        await page.screenshot({ path: path.join(evidenceDir, `${name}.png`) });
        result.status = "passed";
      } catch (error) {
        result.error = String(error);
        try {
          await page.screenshot({ path: path.join(evidenceDir, `${name}-FAILED.png`) });
        } catch {
          // Browser startup or navigation can fail before a screenshot exists.
        }
      } finally {
        result.diagnostics = diagnostics;
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
  passed: results.filter(({ status }) => status === "passed").length,
  failed: results.filter(({ status }) => status === "failed").length,
  results,
};
await writeFile(path.join(evidenceDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify(summary, null, 2));
if (summary.failed > 0) {
  throw new Error(`Battle-space browser smoke failed ${summary.failed}/${results.length}`);
}
