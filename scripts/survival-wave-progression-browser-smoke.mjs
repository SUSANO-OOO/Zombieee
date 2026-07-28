import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { isBossEnemyKind } from "../app/bossFoundation.js";

if (!process.env.SURVIVAL_QA_BASE_URL) {
  throw new Error("SURVIVAL_QA_BASE_URL is required; use the isolated QA runner");
}
const baseUrl = new URL(process.env.SURVIVAL_QA_BASE_URL);
if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname)) {
  throw new Error(`Survival wave QA is local-only; refusing ${baseUrl}`);
}

const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href)
  : await import("playwright");
const browserTypes = { chromium: playwright.chromium, webkit: playwright.webkit };
const engines = (process.env.SURVIVAL_WAVE_QA_ENGINES ?? "chromium,webkit")
  .split(",")
  .map((engine) => engine.trim())
  .filter(Boolean);
const unknownEngines = engines.filter((engine) => !browserTypes[engine]);
if (engines.length === 0 || unknownEngines.length > 0) {
  throw new Error(`Unknown or empty SURVIVAL_WAVE_QA_ENGINES: ${unknownEngines.join(", ") || "(empty)"}`);
}
const viewport = { width: 844, height: 390 };
const configuredTimeout = process.env.SURVIVAL_WAVE_QA_TIMEOUT_MS;
const parsedTimeout = configuredTimeout === undefined ? 5 * 60_000 : Number(configuredTimeout);
if (!Number.isFinite(parsedTimeout) || parsedTimeout <= 0) {
  throw new Error(`SURVIVAL_WAVE_QA_TIMEOUT_MS must be finite and positive: ${configuredTimeout}`);
}
const timeout = Math.min(10 * 60_000, Math.max(30_000, parsedTimeout));
const evidenceDir = path.resolve(
  process.env.SURVIVAL_WAVE_QA_EVIDENCE_DIR ?? "outputs/survival-wave-progression",
);
const results = [];
await mkdir(evidenceDir, { recursive: true });

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function diagnosticsFor(page) {
  const state = { consoleErrors: [], pageErrors: [], requestFailures: [], httpErrors: [] };
  page.on("console", (message) => {
    if (message.type() === "error") state.consoleErrors.push(message.text());
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

async function readSnapshot(page) {
  return page.evaluate(() => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.() ?? null);
}

async function enterSurvival(page) {
  const url = new URL(baseUrl);
  url.search = new URLSearchParams({
    qa: "flow",
    screen: "map",
    stage: "stage-estuary-floodgate-seal",
    stars: "3",
    safe: "iphone-landscape",
  }).toString();
  const response = await page.goto(String(url), { waitUntil: "domcontentloaded", timeout: 30_000 });
  invariant(response?.ok(), `navigation failed: HTTP ${response?.status()}`);
  await page.locator('.game-shell[data-screen="map"]').waitFor();
  await page.getByRole("button", { name: /防衛継続作戦/ }).click();
  await page.locator('.game-shell[data-screen="survival"]').waitFor();
  await page.getByRole("button", { name: "新しいrunを開始", exact: true }).click();
  await page.locator('.game-shell[data-screen="battle"] .survival-hud').waitFor();
}

async function clickAvailableControl(page, selector) {
  const control = page.locator(selector).first();
  if (await control.count() === 0 || !await control.isVisible().catch(() => false)
    || await control.isDisabled().catch(() => true)) return false;
  return control.click({ timeout: 2_000 })
    .then(() => true)
    .catch(() => false);
}

for (const engine of engines) {
  invariant(browserTypes[engine], `Unknown SURVIVAL_WAVE_QA_ENGINES value: ${engine}`);
  const browser = await browserTypes[engine].launch({ headless: true });
  const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  const startedAt = Date.now();
  const waveTimeline = [];
  const encounteredKinds = new Set();
  let lastRecordedWave = null;
  let deploymentCount = 0;
  let manualActivationCount = 0;
  let bossVisibilityProof = null;
  try {
    page.setDefaultTimeout(30_000);
    await enterSurvival(page);
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const snapshot = await readSnapshot(page);
      invariant(snapshot, `${engine}: battle QA snapshot missing`);
      invariant(!snapshot.over, `${engine}: Survival ended before wave 5 (${snapshot.survivalRun?.endReason})`);
      const run = snapshot.survivalRun;
      invariant(run, `${engine}: active Survival run missing`);
      for (const kind of snapshot.fighters.map(({ kind }) => kind)) encounteredKinds.add(kind);
      const activeBoss = snapshot.fighters.find((fighter) => (
        fighter.side === "zombie"
        && fighter.hp > 0
        && fighter.combatReady
        && isBossEnemyKind(fighter.kind)
      ));
      if (activeBoss && !bossVisibilityProof) {
        const renderProof = await page.evaluate(
          (kind) => window.__ASHFALL_BATTLE_QA__?.getBossFoundationProof?.(kind) ?? null,
          activeBoss.kind,
        );
        invariant(renderProof?.bossId === activeBoss.id,
          `${engine}: active wave boss render proof mismatched ${JSON.stringify(renderProof)}`);
        invariant(renderProof.combatReady === true && renderProof.gateEntering === false,
          `${engine}: boss HUD became active before full-body entry ${JSON.stringify(renderProof)}`);
        invariant(renderProof.spriteLoadedWidth > 0 && renderProof.renderedBodyHeight > 0,
          `${engine}: active wave boss sprite did not decode ${JSON.stringify(renderProof)}`);
        invariant(renderProof.renderedVisibleRect
          && renderProof.renderedVisibleRect.left >= 0
          && renderProof.renderedVisibleRect.right <= 960
          && renderProof.renderedVisibleRect.bottom <= 540,
        `${engine}: active wave boss body left the visible battlefield ${JSON.stringify(renderProof)}`);
        bossVisibilityProof = {
          kind: activeBoss.kind,
          bossId: activeBoss.id,
          hp: activeBoss.hp,
          x: activeBoss.x,
          renderedBodyHeight: renderProof.renderedBodyHeight,
          renderedVisibleRect: renderProof.renderedVisibleRect,
          spriteLoadedWidth: renderProof.spriteLoadedWidth,
        };
        await page.screenshot({
          path: path.join(evidenceDir, `${engine}-${viewport.width}x${viewport.height}-wave5-boss-active.png`),
        });
      }
      if (run.currentWave !== lastRecordedWave) {
        lastRecordedWave = run.currentWave;
        waveTimeline.push({
          wave: run.currentWave,
          phase: run.phase,
          lastCompletedWave: run.lastCompletedWave,
          gameTime: snapshot.time,
          kills: run.stats.kills,
          bossKills: run.stats.bossKills,
          wallTimeMs: Date.now() - startedAt,
        });
      }
      if (run.phase === "upgrade-selection" && run.lastCompletedWave >= 5) break;

      if (run.phase === "in-wave") {
        if (await clickAvailableControl(page, ".survival-speed button:nth-child(2)")) {
          await page.waitForTimeout(20);
        }
        const readyAbilities = page.locator(".manual-ability-ready");
        const readyCount = await readyAbilities.count();
        for (let index = readyCount - 1; index >= 0; index -= 1) {
          const ability = readyAbilities.nth(index);
          if (!await ability.isVisible().catch(() => false)) continue;
          await ability.click({ timeout: 2_000 }).catch(() => undefined);
          manualActivationCount += 1;
        }
        if (await clickAvailableControl(page, ".unit-card:not(:disabled)")) deploymentCount += 1;
      }
      await page.waitForTimeout(180);
    }

    const final = await readSnapshot(page);
    invariant(final?.survivalRun?.phase === "upgrade-selection",
      `${engine}: actual wave 1-5 did not reach upgrade selection`);
    invariant(final.survivalRun.lastCompletedWave === 5,
      `${engine}: last completed wave was ${final.survivalRun.lastCompletedWave}`);
    invariant(final.survivalRun.stats.bossKills >= 1,
      `${engine}: wave 5 boss was not defeated`);
    invariant(bossVisibilityProof,
      `${engine}: actual wave 5 never produced a visible combat-ready boss`);
    invariant(final.survivalRun.stats.kills > 0,
      `${engine}: no actual kills were recorded`);
    invariant(JSON.stringify(waveTimeline.map(({ wave }) => wave)) === JSON.stringify([1, 2, 3, 4, 5, 6]),
      `${engine}: wave timeline skipped or reordered a wave: ${JSON.stringify(waveTimeline)}`);
    invariant(waveTimeline.every((entry, index) => (
      entry.lastCompletedWave === entry.wave - 1
      && (index === 0 || (
        entry.gameTime >= waveTimeline[index - 1].gameTime
        && entry.wallTimeMs >= waveTimeline[index - 1].wallTimeMs
        && entry.kills >= waveTimeline[index - 1].kills
        && entry.lastCompletedWave >= waveTimeline[index - 1].lastCompletedWave
      ))
    )), `${engine}: wave progress was not monotonic: ${JSON.stringify(waveTimeline)}`);
    invariant(await page.locator(".survival-upgrade-choices button").count() === 3,
      `${engine}: boss reward did not expose three upgrades`);
    invariant(deploymentCount > 0, `${engine}: no player-facing deployment occurred`);
    invariant(Object.values(diagnostics).every((entries) => entries.length === 0),
      `${engine}: browser diagnostics failed ${JSON.stringify(diagnostics)}`);

    await page.screenshot({
      path: path.join(evidenceDir, `${engine}-${viewport.width}x${viewport.height}-wave5.png`),
    });
    results.push({
      engine,
      viewport,
      status: "passed",
      wallTimeMs: Date.now() - startedAt,
      deploymentCount,
      manualActivationCount,
      bossVisibilityProof,
      waveTimeline,
      final: {
        phase: final.survivalRun.phase,
        currentWave: final.survivalRun.currentWave,
        lastCompletedWave: final.survivalRun.lastCompletedWave,
        kills: final.survivalRun.stats.kills,
        bossKills: final.survivalRun.stats.bossKills,
        crawlerHp: final.survivalRun.crawler.hp,
      },
      encounteredKinds: [...encounteredKinds],
      diagnostics,
    });
  } catch (error) {
    results.push({
      engine,
      viewport,
      status: "failed",
      error: String(error),
      wallTimeMs: Date.now() - startedAt,
      deploymentCount,
      manualActivationCount,
      bossVisibilityProof,
      waveTimeline,
      diagnostics,
      failureSnapshot: await readSnapshot(page)
        .then((snapshot) => ({
          screen: snapshot.screen,
          time: snapshot.time,
          over: snapshot.over,
          fighterCount: snapshot.fighters.length,
          pendingSpawnCount: snapshot.pendingSpawns.length,
          survivalRun: snapshot.survivalRun
            ? {
                phase: snapshot.survivalRun.phase,
                currentWave: snapshot.survivalRun.currentWave,
                lastCompletedWave: snapshot.survivalRun.lastCompletedWave,
                stats: snapshot.survivalRun.stats,
                crawler: snapshot.survivalRun.crawler,
              }
            : null,
        }))
        .catch(() => null),
    });
    await page.screenshot({
      path: path.join(evidenceDir, `${engine}-${viewport.width}x${viewport.height}-FAILED.png`),
    }).catch(() => undefined);
  } finally {
    await context.close();
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
  throw new Error(`Survival actual wave QA failed ${summary.failed}/${results.length}`);
}
