import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { UNIT_CARDS } from "../app/gameRules.js";
import { applyUnitProgression } from "../app/unitProgression.js";

const baseUrl = new URL(process.env.PROGRESSION_QA_BASE_URL ?? "http://127.0.0.1:4177/");
if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname)) {
  throw new Error(`Progression QA is local-only; refusing ${baseUrl}`);
}
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href)
  : await import("playwright");
const browserTypes = { chromium: playwright.chromium, webkit: playwright.webkit };
const engines = (process.env.PROGRESSION_QA_ENGINES ?? "chromium,webkit")
  .split(",")
  .map((engine) => engine.trim())
  .filter(Boolean);
if (engines.some((engine) => !browserTypes[engine])) {
  throw new Error(`Unknown PROGRESSION_QA_ENGINES: ${engines.join(", ")}`);
}

const viewports = [
  { width: 1280, height: 720, safeArea: false },
  { width: 844, height: 390, safeArea: true },
  { width: 844, height: 340, safeArea: true },
];
const evidenceDir = path.resolve(process.env.PROGRESSION_QA_EVIDENCE_DIR ?? "outputs/progression-browser-smoke");
const timeout = Math.max(8_000, Number(process.env.PROGRESSION_QA_TIMEOUT_MS) || 30_000);
const results = [];
await mkdir(evidenceDir, { recursive: true });

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

async function serverIsReady() {
  try {
    const response = await fetch(baseUrl, { signal: AbortSignal.timeout(3_000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function ensureLocalServer() {
  if (await serverIsReady()) return null;
  const logs = [];
  const server = spawn(process.execPath, [
    path.join(projectRoot, "scripts", "run-vinext.mjs"),
    "start",
    "--host",
    baseUrl.hostname,
    "--port",
    baseUrl.port || "80",
  ], {
    cwd: projectRoot,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const capture = (chunk) => {
    logs.push(String(chunk));
    if (logs.length > 20) logs.shift();
  };
  server.stdout.on("data", capture);
  server.stderr.on("data", capture);
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (await serverIsReady()) return server;
    if (server.exitCode !== null) throw new Error(`Progression QA server exited ${server.exitCode}\n${logs.join("")}`);
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  server.kill();
  throw new Error(`Progression QA server timeout\n${logs.join("")}`);
}

async function stopLocalServer(server) {
  if (!server || server.exitCode !== null) return;
  server.kill();
  await Promise.race([
    new Promise((resolve) => server.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
}

function diagnosticsFor(page) {
  const state = { consoleErrors: [], pageErrors: [], requestFailures: [], httpErrors: [], warnings: [] };
  page.on("console", (message) => {
    if (message.type() === "error") state.consoleErrors.push(message.text());
    if (message.type() === "warning" && !message.text().includes("was preloaded using link preload but not used")) {
      state.warnings.push(message.text());
    }
  });
  page.on("pageerror", (error) => state.pageErrors.push(String(error)));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown";
    if (failure !== "net::ERR_ABORTED") state.requestFailures.push(`${request.url()} :: ${failure}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) state.httpErrors.push(`${response.status()} ${response.url()}`);
  });
  return state;
}

async function enterBattle(page) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const screen = await page.locator(".game-shell").getAttribute("data-screen");
    if (screen === "battle") return;
    if (screen === "loadout") {
      const deploy = page.getByRole("button", { name: /この編成で出撃/u });
      if (await deploy.count() === 1 && await deploy.isEnabled()) await deploy.click();
    } else if (screen === "event") {
      const advance = page.locator('button[aria-label="セリフを送る"]');
      if (await advance.count() === 1) await advance.click();
    }
    await page.waitForTimeout(30);
  }
  throw new Error("Progression QA could not enter battle");
}

const server = await ensureLocalServer();
try {
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
        const name = `${engine}-${viewport.width}x${viewport.height}`;
        const context = await browser.newContext({ viewport });
        const page = await context.newPage();
        const diagnostics = diagnosticsFor(page);
        const result = { engine, viewport, status: "failed" };
        try {
          const url = new URL(baseUrl);
          const search = new URLSearchParams({
            qa: "flow",
            screen: "personnel",
            stage: "4",
            stars: "2",
          });
          if (viewport.safeArea) search.set("safe", "iphone-landscape");
          url.search = search.toString();
          const response = await page.goto(String(url), { waitUntil: "domcontentloaded", timeout });
          invariant(response?.ok(), `navigation failed: HTTP ${response?.status()}`);
          await page.waitForFunction(() => (
            document.querySelector(".game-shell")?.getAttribute("data-screen") === "personnel"
            && document.querySelectorAll(".formation-unit-card").length === 11
          ), undefined, { timeout });

          await page.getByRole("button", { name: "強化", exact: true }).click();
          await page.waitForFunction(() => document.querySelectorAll(".formation-unit-upgrade").length === 11, undefined, { timeout });
          const before = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
          const firstUpgrade = page.locator(".formation-unit-upgrade:not(:disabled)").first();
          const costLabel = await firstUpgrade.locator("b").innerText();
          invariant(costLabel.includes("40キャップ"), `catch-up price missing: ${costLabel}`);
          await firstUpgrade.evaluate((button) => {
            button.click();
            button.click();
          });
          await page.waitForFunction(
            (caps) => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().caps < caps,
            before.caps,
            { timeout },
          );
          await page.waitForTimeout(650);
          const after = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
          const upgradedUnitId = Object.keys(after.unitRanks).find((unitId) => after.unitRanks[unitId] !== before.unitRanks[unitId]);
          invariant(Boolean(upgradedUnitId), "no stable unit rank changed");
          invariant(after.unitRanks[upgradedUnitId] === before.unitRanks[upgradedUnitId] + 1, "rank did not increase exactly once");
          invariant(before.caps - after.caps === 40, `caps spend mismatch ${before.caps} -> ${after.caps}`);
          const upgradeText = await page.locator(".formation-unit-card").first().innerText();
          invariant(upgradeText.includes("Rank 1/4"), `rank UI missing: ${upgradeText}`);
          invariant(upgradeText.includes("HP +3%"), `HP growth UI missing: ${upgradeText}`);
          invariant(upgradeText.includes("攻撃 +3%"), `damage growth UI missing: ${upgradeText}`);
          invariant(upgradeText.includes("防御 1.5%軽減"), `defense growth UI missing: ${upgradeText}`);
          invariant(!upgradeText.includes("射程 +"), `range must not grow: ${upgradeText}`);

          const dimensions = await page.evaluate(() => ({
            innerWidth: window.innerWidth,
            innerHeight: window.innerHeight,
            documentWidth: document.documentElement.scrollWidth,
            documentHeight: document.documentElement.scrollHeight,
            safeAreaSource: document.documentElement.dataset.safeAreaSource,
          }));
          invariant(dimensions.documentWidth <= viewport.width && dimensions.documentHeight <= viewport.height,
            `viewport overflow: ${JSON.stringify(dimensions)}`);
          invariant(
            viewport.safeArea
              ? dimensions.safeAreaSource === "local-qa-iphone-landscape"
              : dimensions.safeAreaSource !== "local-qa-iphone-landscape",
            `safe area mismatch: ${JSON.stringify(dimensions)}`,
          );
          await page.screenshot({ path: path.join(evidenceDir, `${name}-upgrade.png`) });

          await page.getByRole("button", { name: "← 地図へ", exact: true }).click();
          await page.getByRole("button", { name: "編成へ進む", exact: true }).click();
          await enterBattle(page);
          const brawlerButton = page.locator('button.unit-card[data-kind="brawler"]');
          await brawlerButton.waitFor({ state: "visible", timeout });
          await brawlerButton.click();
          await page.waitForFunction(() => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().fighters
            .some((fighter) => fighter.side === "human" && fighter.kind === "brawler"), undefined, { timeout });
          const battle = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
          const fighter = battle.fighters.find((candidate) => candidate.side === "human" && candidate.kind === "brawler");
          const baseCard = UNIT_CARDS.find((card) => card.kind === "brawler");
          const expected = applyUnitProgression(baseCard, 1);
          invariant(fighter.progressionRank === 1, `battle rank mismatch: ${JSON.stringify(fighter)}`);
          invariant(fighter.maxHp === expected.hp && fighter.damage === expected.damage && fighter.defense === expected.defense,
            `battle stats mismatch: ${JSON.stringify({ fighter, expected })}`);
          const damageProof = await page.evaluate(() => {
            const bridge = window.__ASHFALL_BATTLE_QA__;
            const baselineId = bridge.spawnHumanForDamageProof("scout");
            const snapshot = bridge.getSnapshot();
            const trained = snapshot.fighters.find((candidate) => (
              candidate.side === "human" && candidate.kind === "brawler"
            ));
            return {
              trained: bridge.applyHumanDamage(trained.id, 50),
              baseline: bridge.applyHumanDamage(baselineId, 50),
            };
          });
          invariant(damageProof.trained.defense === expected.defense, `trained defense mismatch: ${JSON.stringify(damageProof)}`);
          invariant(damageProof.baseline.defense === 0, `baseline defense mismatch: ${JSON.stringify(damageProof)}`);
          invariant(damageProof.trained.targetDamage < damageProof.baseline.targetDamage,
            `defense did not reduce live damage: ${JSON.stringify(damageProof)}`);
          invariant(damageProof.trained.targetDamage === 49.25 && damageProof.baseline.targetDamage === 50,
            `live damage values mismatch: ${JSON.stringify(damageProof)}`);

          for (const [kind, entries] of Object.entries(diagnostics)) {
            invariant(entries.length === 0, `${kind}: ${JSON.stringify(entries)}`);
          }
          Object.assign(result, {
            status: "passed",
            upgradedUnitId,
            capsBefore: before.caps,
            capsAfter: after.caps,
            fighter: {
              kind: fighter.kind,
              progressionRank: fighter.progressionRank,
              maxHp: fighter.maxHp,
              damage: fighter.damage,
              defense: fighter.defense,
            },
            damageProof,
            dimensions,
            diagnostics,
          });
        } catch (error) {
          result.error = String(error);
          result.diagnostics = diagnostics;
          try {
            await page.screenshot({ path: path.join(evidenceDir, `${name}-FAILED.png`) });
          } catch {
            // Navigation can fail before a page exists.
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
} finally {
  await stopLocalServer(server);
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
if (summary.failed > 0) throw new Error(`Progression browser smoke failed ${summary.failed}/${results.length}`);
