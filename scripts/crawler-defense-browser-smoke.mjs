import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const baseUrl = new URL(process.env.CRAWLER_DEFENSE_QA_BASE_URL ?? "http://127.0.0.1:4177/");
if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname)) {
  throw new Error(`CRAWLER defense QA routes are local-only; refusing ${baseUrl}`);
}

const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href)
  : await import("playwright");
const browserTypes = { chromium: playwright.chromium, webkit: playwright.webkit };
const engines = (process.env.CRAWLER_DEFENSE_QA_ENGINES ?? "chromium,webkit")
  .split(",")
  .map((engine) => engine.trim())
  .filter(Boolean);
const repetitions = Math.max(1, Number(process.env.CRAWLER_DEFENSE_QA_REPETITIONS) || 10);
const timeout = Math.max(8_000, Number(process.env.CRAWLER_DEFENSE_QA_TIMEOUT_MS) || 24_000);
const evidenceDir = path.resolve(
  process.env.CRAWLER_DEFENSE_QA_EVIDENCE_DIR ?? "outputs/crawler-defense-browser-smoke",
);
const scenarios = [
  { id: "melee", unitKind: "brawler", attackerKind: "walker" },
  { id: "ranged", unitKind: "ranger", attackerKind: "walker" },
  { id: "heavy", unitKind: "brute", attackerKind: "crusher" },
  { id: "support", unitKind: "medic", attackerKind: "walker" },
];
const results = [];

await mkdir(evidenceDir, { recursive: true });

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

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
    if (failure !== "net::ERR_ABORTED") diagnostics.requestFailures.push(`${request.url()} :: ${failure}`);
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

for (const engine of engines) {
  const browserType = browserTypes[engine];
  invariant(browserType, `unsupported engine: ${engine}`);
  const browser = await browserType.launch({ headless: true });
  try {
    for (const scenario of scenarios) {
      for (let repetition = 1; repetition <= repetitions; repetition += 1) {
        const context = await browser.newContext({ viewport: { width: 844, height: 390 } });
        const page = await context.newPage();
        const diagnostics = diagnosticsFor(page);
        const result = {
          engine,
          scenario: scenario.id,
          unitKind: scenario.unitKind,
          attackerKind: scenario.attackerKind,
          repetition,
          passThroughs: 0,
          objectiveDirects: 0,
          status: "failed",
        };
        try {
          const response = await page.goto(caseUrl(), { waitUntil: "domcontentloaded", timeout });
          invariant(response?.ok(), `navigation failed: HTTP ${response?.status()}`);
          await page.waitForFunction(
            () => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().running === true,
            null,
            { timeout },
          );
          const proof = await page.evaluate(
            (attackerKind) => window.__ASHFALL_BATTLE_QA__.prepareCrawlerDefenseProof(attackerKind),
            scenario.attackerKind,
          );
          invariant(Number.isInteger(proof?.attackerId), "CRAWLER attacker setup failed");
          const queued = await page.evaluate(
            (unitKind) => window.__ASHFALL_BATTLE_QA__.queueCrawlerDefenseUnit(unitKind),
            scenario.unitKind,
          );
          invariant(queued === true, `deployment queue rejected ${scenario.unitKind}`);

          await page.waitForFunction(
            (unitKind) => window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters.some(
              (fighter) => fighter.side === "human"
                && fighter.kind === unitKind
                && fighter.spawnPortalId === "crawler-door",
            ),
            scenario.unitKind,
            { timeout, polling: 5 },
          );
          const deploymentId = await page.evaluate(
            (unitKind) => window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters.find(
              (fighter) => fighter.side === "human"
                && fighter.kind === unitKind
                && fighter.spawnPortalId === "crawler-door",
            )?.id ?? null,
            scenario.unitKind,
          );
          invariant(Number.isInteger(deploymentId), "deployed fighter identity missing");

          const decision = await page.evaluate(async ({ deploymentId: id, attackerId, maxMs }) => {
            const samples = [];
            const startedAt = performance.now();
            while (performance.now() - startedAt < maxMs) {
              const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
              const fighter = snapshot.fighters.find((candidate) => candidate.id === id);
              if (!fighter) throw new Error("deployed fighter disappeared before first AI decision");
              samples.push({
                combatReady: fighter.combatReady,
                gateEntering: fighter.gateEntering,
                x: fighter.x,
                targetId: fighter.targetId,
                crawlerDefenseTargetId: fighter.crawlerDefenseTargetId,
                aiDestinationX: fighter.aiDestinationX,
                aiMoveDirection: fighter.aiMoveDirection,
              });
              if (
                fighter.combatReady
                && !fighter.gateEntering
                && (
                  fighter.targetId !== null
                  || fighter.aiDestinationX !== 205
                )
              ) {
                return {
                  attackerId,
                  firstDecision: samples.at(-1),
                  combatReadySamples: samples.filter((sample) => sample.combatReady && !sample.gateEntering),
                  sampleCount: samples.length,
                };
              }
              await new Promise((resolve) => requestAnimationFrame(resolve));
            }
            throw new Error(`first valid AI decision timed out: ${JSON.stringify(samples.slice(-12))}`);
          }, { deploymentId, attackerId: proof.attackerId, maxMs: timeout });

          const first = decision.firstDecision;
          result.objectiveDirects = first.targetId === proof.attackerId ? 0 : 1;
          result.passThroughs = first.aiMoveDirection > 0 || first.aiDestinationX > first.x ? 1 : 0;
          invariant(first.targetId === proof.attackerId,
            `first AI target ${first.targetId} did not intercept CRAWLER attacker ${proof.attackerId}`);
          invariant(first.crawlerDefenseTargetId === proof.attackerId,
            `defense lock ${first.crawlerDefenseTargetId} did not own attacker ${proof.attackerId}`);
          invariant(first.aiMoveDirection <= 0 && first.aiDestinationX <= first.x,
            `deployment advanced toward the forward objective: ${JSON.stringify(first)}`);
          invariant(result.passThroughs === 0, "deployment passed through the CRAWLER attacker");
          invariant(result.objectiveDirects === 0, "deployment went directly to the forward objective");
          assertDiagnostics(diagnostics);
          Object.assign(result, {
            status: "passed",
            attackerId: proof.attackerId,
            deploymentId,
            firstDecision: first,
            sampleCount: decision.sampleCount,
          });
        } catch (error) {
          result.error = String(error);
          try {
            result.failureSnapshot = await page.evaluate(
              () => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.() ?? null,
            );
          } catch {
            // Navigation can fail before the QA bridge exists.
          }
        } finally {
          result.diagnostics = diagnostics;
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
  repetitions,
  total: results.length,
  passed: results.filter(({ status }) => status === "passed").length,
  failed: results.filter(({ status }) => status === "failed").length,
  passThroughs: results.reduce((total, result) => total + result.passThroughs, 0),
  objectiveDirects: results.reduce((total, result) => total + result.objectiveDirects, 0),
  byEngineAndScenario: Object.fromEntries(engines.flatMap((engine) => scenarios.map((scenario) => {
    const matches = results.filter((result) => result.engine === engine && result.scenario === scenario.id);
    return [`${engine}/${scenario.id}`, {
      passed: matches.filter(({ status }) => status === "passed").length,
      total: matches.length,
      passThroughs: matches.reduce((total, result) => total + result.passThroughs, 0),
      objectiveDirects: matches.reduce((total, result) => total + result.objectiveDirects, 0),
    }];
  }))),
  results,
};
await writeFile(path.join(evidenceDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  ...summary,
  results: undefined,
}, null, 2));

if (summary.failed > 0 || summary.passThroughs > 0 || summary.objectiveDirects > 0) {
  throw new Error(`CRAWLER defense browser smoke failed; see ${path.join(evidenceDir, "summary.json")}`);
}
