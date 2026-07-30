import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";

const execFile = promisify(execFileCallback);
const expectedSourceCommit = "5bc0d6b26dbad46501e7f1677af9a3d409dd20dc";
const baseUrl = new URL(
  process.env.V095_DEPLOYMENT_BASELINE_URL ?? "http://127.0.0.1:4183/",
);
if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname)) {
  throw new Error(`Version 0.9.5 baseline capture is local-only; refusing ${baseUrl}`);
}

const evidenceDir = path.resolve(
  process.env.V095_DEPLOYMENT_BASELINE_EVIDENCE_DIR
    ?? "outputs/v095-deployment-baseline-sequence",
);
const timeout = Math.max(
  8_000,
  Number(process.env.V095_DEPLOYMENT_BASELINE_TIMEOUT_MS) || 24_000,
);
const unitKinds = [
  "scout",
  "ranger",
  "brute",
  "brawler",
  "gunner",
  "medic",
  "crazy-king",
  "kumaverson",
  "babayaga",
  "guardian",
  "engineer",
  "zakimiya",
  "tky",
  "mrs-chiha",
  "miyamoto-musashi",
  "mayo-chan",
];
const expectedPhases = ["door", "boundary", "ramp", "exit", "landing", "ready"];
const viewport = { width: 844, height: 390 };
const engine = "chromium";
const quality = "auto";
const speed = 1;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

const { stdout: sourceStdout } = await execFile(
  "git",
  ["rev-parse", "HEAD"],
  { cwd: process.cwd(), windowsHide: true },
);
const sourceCommit = sourceStdout.trim();
invariant(
  sourceCommit === expectedSourceCommit,
  `Baseline capture requires ${expectedSourceCommit}, got ${sourceCommit}`,
);

await mkdir(evidenceDir, { recursive: true });
const buildIdentityAtStart = await productionBuildIdentity();
const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href)
  : await import("playwright");

function caseUrl() {
  const url = new URL(baseUrl);
  url.search = new URLSearchParams({
    qa: "mission",
    stage: "1",
    state: "start",
    safe: "iphone-landscape",
  }).toString();
  return String(url);
}

function collectDiagnostics(page) {
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
    if (response.status() >= 400) {
      diagnostics.httpErrors.push(`${response.status()} ${response.url()}`);
    }
  });
  return diagnostics;
}

function diagnosticCount(diagnostics) {
  return Object.values(diagnostics).reduce((total, entries) => total + entries.length, 0);
}

async function nextRender(page) {
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
}

async function captureFrame(page, unitKind, fighterId, phase) {
  await nextRender(page);
  const state = await page.evaluate((id) => {
    const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
    const fighter = snapshot.fighters.find((candidate) => candidate.id === id) ?? null;
    return {
      battleTime: snapshot.time,
      fighter: fighter
        ? {
          id: fighter.id,
          kind: fighter.kind,
          x: fighter.x,
          y: fighter.y,
          combatReadyX: fighter.combatReadyX,
          combatReadyY: fighter.combatReadyY,
          combatReady: fighter.combatReady,
          gateEntering: fighter.gateEntering,
          spawnPortalId: fighter.spawnPortalId,
          entryDirection: fighter.entryDirection,
          animationPresentation: fighter.animationPresentation,
          renderAudit: fighter.renderAudit ?? null,
        }
        : null,
      geometry: snapshot.geometry,
    };
  }, fighterId);
  invariant(state.fighter, `${unitKind}/${phase}: fighter disappeared`);
  const screenshotPath = path.join(evidenceDir, `${unitKind}-${phase}.png`);
  const screenshot = await page.locator("canvas.battlefield.active").screenshot({
    path: screenshotPath,
    animations: "allow",
  });
  return {
    phase,
    screenshot: path.relative(evidenceDir, screenshotPath).replaceAll("\\", "/"),
    sha256: createHash("sha256").update(screenshot).digest("hex"),
    ...state,
  };
}

const browser = await playwright.chromium.launch({ headless: true });
const context = await browser.newContext({ viewport });
const page = await context.newPage();
const diagnostics = collectDiagnostics(page);
const results = [];
try {
  const response = await page.goto(caseUrl(), {
    waitUntil: "domcontentloaded",
    timeout,
  });
  invariant(response?.ok(), `Baseline navigation HTTP ${response?.status()}`);
  await page.waitForFunction(
    () => {
      const qa = window.__ASHFALL_BATTLE_QA__;
      return qa?.getSnapshot?.().running === true
        && typeof qa.prepareCrawlerDefenseProof === "function"
        && typeof qa.queueCrawlerDefenseUnit === "function"
        && typeof qa.setRepresentativeSixProofPaused === "function"
        && typeof qa.setGraphicsQuality === "function";
    },
    null,
    { timeout },
  );
  await page.waitForFunction(
    () => Number(document.documentElement.dataset.assetResidentSprites) >= 25,
    null,
    { timeout },
  );
  await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setGraphicsQuality("auto"));
  await page.waitForFunction(
    () => document.documentElement.dataset.graphicsQualityRequested === "auto",
    null,
    { timeout },
  );

  for (const unitKind of unitKinds) {
    await page.evaluate(
      () => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(false),
    );
    const prepared = await page.evaluate(
      (kind) => window.__ASHFALL_BATTLE_QA__.prepareCrawlerDefenseProof({
        attackerKind: kind === "babayaga" ? "crusher" : "walker",
        lane: 1,
        existingClaim: true,
      }),
      unitKind,
    );
    invariant(
      Number.isInteger(prepared?.attackerId),
      `${unitKind}: threat fixture unavailable`,
    );
    const queued = await page.evaluate(
      (kind) => window.__ASHFALL_BATTLE_QA__.queueCrawlerDefenseUnit(kind, 1),
      unitKind,
    );
    invariant(queued === true, `${unitKind}: deployment queue rejected`);
    await page.waitForFunction(
      (kind) => window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters.some(
        (fighter) => fighter.side === "human"
          && fighter.kind === kind
          && fighter.spawnPortalId === "crawler-door",
      ),
      unitKind,
      { timeout, polling: 5 },
    );
    const fighterId = await page.evaluate(
      (kind) => window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters.find(
        (fighter) => fighter.side === "human"
          && fighter.kind === kind
          && fighter.spawnPortalId === "crawler-door",
      )?.id ?? null,
      unitKind,
    );
    invariant(Number.isInteger(fighterId), `${unitKind}: fighter id unavailable`);
    await page.evaluate(
      () => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(true),
    );

    const frames = [];
    const door = await captureFrame(page, unitKind, fighterId, "door");
    frames.push(door);
    invariant(
      door.fighter.gateEntering === true && door.fighter.combatReady === false,
      `${unitKind}/door: deployment state missing`,
    );
    await page.evaluate(
      () => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(false),
    );

    for (const [phase, minimumProgress] of [
      ["boundary", 0.18],
      ["ramp", 0.38],
      ["exit", 0.60],
      ["landing", 0.82],
    ]) {
      await page.evaluate(async ({ id, entryX, progress, maxMs }) => {
        const startedAt = performance.now();
        while (performance.now() - startedAt < maxMs) {
          const qa = window.__ASHFALL_BATTLE_QA__;
          const snapshot = qa.getSnapshot();
          const fighter = snapshot.fighters.find((candidate) => candidate.id === id);
          const travel = Math.max(1, (fighter?.combatReadyX ?? entryX + 1) - entryX);
          const actualProgress = fighter ? (fighter.x - entryX) / travel : -1;
          if (
            fighter?.gateEntering === true
            && fighter.combatReady === false
            && actualProgress >= progress
          ) {
            qa.setRepresentativeSixProofPaused(true);
            return;
          }
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }
        throw new Error(`deployment sequence ${progress} timed out`);
      }, {
        id: fighterId,
        entryX: door.fighter.x,
        progress: minimumProgress,
        maxMs: timeout,
      });
      const frame = await captureFrame(page, unitKind, fighterId, phase);
      frames.push(frame);
      invariant(
        frame.fighter.gateEntering === true && frame.fighter.combatReady === false,
        `${unitKind}/${phase}: ramp sequence ended early`,
      );
      await page.evaluate(
        () => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(false),
      );
    }

    await page.evaluate(async ({ id, maxMs }) => {
      const startedAt = performance.now();
      while (performance.now() - startedAt < maxMs) {
        const qa = window.__ASHFALL_BATTLE_QA__;
        const snapshot = qa.getSnapshot();
        const fighter = snapshot.fighters.find((candidate) => candidate.id === id);
        if (fighter?.combatReady === true && fighter.gateEntering === false) {
          qa.setRepresentativeSixProofPaused(true);
          return;
        }
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      throw new Error("combat-ready transition timed out");
    }, { id: fighterId, maxMs: timeout });
    const ready = await captureFrame(page, unitKind, fighterId, "ready");
    frames.push(ready);
    invariant(
      ready.fighter.combatReady === true && ready.fighter.gateEntering === false,
      `${unitKind}/ready: combat-ready state missing`,
    );
    invariant(
      JSON.stringify(frames.map(({ phase }) => phase)) === JSON.stringify(expectedPhases),
      `${unitKind}: incomplete baseline phases`,
    );
    invariant(
      frames.every((frame, index) => index === 0 || frame.fighter.x >= frames[index - 1].fighter.x),
      `${unitKind}: baseline sequence moved backwards`,
    );
    results.push({
      unitKind,
      fighterId,
      attackerId: prepared.attackerId,
      status: "captured",
      frames,
    });
  }
} finally {
  await context.close();
  await browser.close();
}

const buildIdentityAtEnd = await productionBuildIdentity();
const buildIdentityStable = (
  buildIdentityAtStart.combinedSha256 === buildIdentityAtEnd.combinedSha256
);
const summary = {
  generatedAt: new Date().toISOString(),
  purpose: "technical-rc-before-visual-context",
  acceptanceGate: false,
  sourceCommit,
  expectedSourceCommit,
  baseUrl: String(baseUrl),
  engine,
  viewport,
  quality,
  speed,
  units: unitKinds,
  expectedPhases,
  expectedCases: unitKinds.length,
  capturedCases: results.length,
  expectedFrames: unitKinds.length * expectedPhases.length,
  capturedFrames: results.reduce((total, result) => total + result.frames.length, 0),
  buildIdentityAtStart,
  buildIdentityAtEnd,
  buildIdentityStable,
  diagnosticCount: diagnosticCount(diagnostics),
  diagnostics,
  results,
};
const reportPath = path.join(evidenceDir, "summary.json");
await writeFile(reportPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  reportPath,
  purpose: summary.purpose,
  sourceCommit,
  buildIdentity: buildIdentityAtEnd.combinedSha256,
  buildIdentityStable,
  capturedCases: summary.capturedCases,
  capturedFrames: summary.capturedFrames,
  diagnosticCount: summary.diagnosticCount,
}, null, 2));

invariant(buildIdentityStable, "Baseline dist changed while capture was running");
invariant(
  summary.capturedCases === summary.expectedCases,
  `Baseline capture produced ${summary.capturedCases}/${summary.expectedCases} cases`,
);
invariant(
  summary.capturedFrames === summary.expectedFrames,
  `Baseline capture produced ${summary.capturedFrames}/${summary.expectedFrames} frames`,
);
invariant(summary.diagnosticCount === 0, "Baseline capture produced browser diagnostics");
