import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { UNIT_CARDS } from "../app/gameRules.js";
import { applyUnitProgression } from "../app/unitProgression.js";

if (!process.env.PROGRESSION_QA_BASE_URL) {
  throw new Error("PROGRESSION_QA_BASE_URL is required; use the isolated QA runner");
}
const baseUrl = new URL(process.env.PROGRESSION_QA_BASE_URL);
if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname)) {
  throw new Error(`Progression QA is local-only; refusing ${baseUrl}`);
}
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

const defaultViewports = [
  { width: 1280, height: 720, safeArea: false },
  { width: 844, height: 390, safeArea: true },
  { width: 844, height: 340, safeArea: true },
];
const viewports = process.env.PROGRESSION_QA_VIEWPORTS
  ? process.env.PROGRESSION_QA_VIEWPORTS.split(",").map((entry) => {
    const match = entry.trim().match(/^(\d+)x(\d+)$/);
    if (!match) throw new Error(`Invalid PROGRESSION_QA_VIEWPORTS entry: ${entry}`);
    const width = Number(match[1]);
    const height = Number(match[2]);
    return { width, height, safeArea: width === 844 && (height === 390 || height === 340) };
  })
  : defaultViewports;
const evidenceDir = path.resolve(process.env.PROGRESSION_QA_EVIDENCE_DIR ?? "outputs/progression-browser-smoke");
const timeout = Math.max(8_000, Number(process.env.PROGRESSION_QA_TIMEOUT_MS) || 30_000);
const results = [];
await mkdir(evidenceDir, { recursive: true });

function invariant(condition, message) {
  if (!condition) throw new Error(message);
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
          const visualCards = await page.evaluate(() => {
            const portraits = [...document.querySelectorAll(".formation-portrait")];
            return {
              total: portraits.length,
              withArt: portraits.filter((portrait) => (
                getComputedStyle(portrait).backgroundImage.includes("/art/v080/characters/cards/")
              )).length,
              minimumWidth: Math.min(...portraits.map((portrait) => portrait.getBoundingClientRect().width)),
              minimumHeight: Math.min(...portraits.map((portrait) => portrait.getBoundingClientRect().height)),
            };
          });
          invariant(visualCards.total === 11 && visualCards.withArt === 11,
            `purpose-specific visual cards missing: ${JSON.stringify(visualCards)}`);
          invariant(visualCards.minimumWidth >= 64 && visualCards.minimumHeight >= 64,
            `visual cards are too small to identify: ${JSON.stringify(visualCards)}`);
          invariant(await page.locator('.formation-unit-select[style*="-r2.webp"]').count() === 11,
            "upper-body r2 formation/personnel card set is not active");
          const rosterScroller = page.locator(".personnel-units > div");
          await page.screenshot({ path: path.join(evidenceDir, `${name}-cards-top.png`) });
          await rosterScroller.evaluate((element) => {
            element.scrollTop = element.scrollHeight;
          });
          await page.waitForTimeout(100);
          await page.screenshot({ path: path.join(evidenceDir, `${name}-cards-bottom.png`) });
          await rosterScroller.evaluate((element) => {
            element.scrollTop = 0;
          });

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
          await page.locator('.upgrade-feedback[data-level="normal"]').waitFor({ state: "visible", timeout });
          const normalFeedback = await page.locator('.upgrade-feedback[data-level="normal"]').innerText();
          invariant(normalFeedback.includes("Rank 1 強化完了"), `normal upgrade feedback missing: ${normalFeedback}`);
          invariant(normalFeedback.includes("HP ") && normalFeedback.includes("攻撃 ") && normalFeedback.includes("防御 "),
            `normal stat delta missing: ${normalFeedback}`);
          await page.waitForTimeout(700);
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

          let expectedBattleRank = 1;
          let maxFeedback = null;
          if (engine === "chromium" && viewport.width === 1280 && viewport.height === 720) {
            const upgradedCard = page.locator(`.formation-unit-card:has([data-unit-id="${upgradedUnitId}"])`);
            for (const expectedRank of [2, 3, 4]) {
              const button = upgradedCard.locator(".formation-unit-upgrade");
              await button.waitFor({ state: "visible", timeout });
              await page.waitForFunction(
                ({ unitId, rank }) => window.__ASHFALL_BATTLE_QA__.getSnapshot().unitRanks[unitId] === rank - 1,
                { unitId: upgradedUnitId, rank: expectedRank },
                { timeout },
              );
              await button.click();
              await page.waitForFunction(
                ({ unitId, rank }) => window.__ASHFALL_BATTLE_QA__.getSnapshot().unitRanks[unitId] === rank,
                { unitId: upgradedUnitId, rank: expectedRank },
                { timeout },
              );
              const level = expectedRank === 4 ? "max" : "normal";
              await upgradedCard.locator(`.upgrade-feedback[data-level="${level}"]`).waitFor({ state: "visible", timeout });
              if (expectedRank === 4) {
                maxFeedback = await upgradedCard.locator('.upgrade-feedback[data-level="max"]').innerText();
                invariant(maxFeedback.includes("MAX強化 完了"), `maximum upgrade feedback missing: ${maxFeedback}`);
              }
              await page.waitForTimeout(700);
            }
            expectedBattleRank = 4;
          }

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
          const expected = applyUnitProgression(baseCard, expectedBattleRank);
          invariant(fighter.progressionRank === expectedBattleRank, `battle rank mismatch: ${JSON.stringify(fighter)}`);
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
          invariant(
            damageProof.trained.targetDamage === 50 * (1 - expected.defense)
              && damageProof.baseline.targetDamage === 50,
            `live damage values mismatch: ${JSON.stringify(damageProof)}`);

          await page.getByRole("button", { name: "一時停止", exact: true }).click();
          const pauseMenu = page.getByRole("dialog", { name: "一時停止メニュー" });
          await pauseMenu.waitFor({ state: "visible", timeout });
          const bgmSlider = page.locator('input[data-volume-kind="bgm"]');
          const sfxSlider = page.locator('input[data-volume-kind="sfx"]');
          const initialAudioSettings = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot().settings);
          const bgmPreviewCapability = await page.evaluate(() => Boolean(
            window.AudioContext || window.webkitAudioContext,
          ));
          const setSlider = async (locator, value) => locator.evaluate((input, nextValue) => {
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
            setter.call(input, String(nextValue));
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
          }, value);
          await setSlider(bgmSlider, .25);
          await page.waitForFunction(
            (sfxVolume) => {
              const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
              return snapshot.settings.bgmVolume === .25
                && snapshot.settings.sfxVolume === sfxVolume
                && document.documentElement.dataset.audioBgmVolume === "0.25";
            },
            initialAudioSettings.sfxVolume,
            { timeout },
          );
          try {
            await page.waitForFunction(
              (hasWebAudio) => document.documentElement.dataset.audioBgmPreviewStatus
                === (hasWebAudio ? "played" : "locked"),
              bgmPreviewCapability,
              { timeout },
            );
          } catch (error) {
            const previewState = await page.evaluate(() => ({
              status: document.documentElement.dataset.audioBgmPreviewStatus ?? "missing",
              unlocked: document.documentElement.dataset.audioUnlocked ?? "missing",
              context: document.documentElement.dataset.audioContextState ?? "missing",
              active: document.documentElement.dataset.audioActiveVoices ?? "missing",
              scene: document.documentElement.dataset.audioRuntimeScene ?? "missing",
              mixer: window.__ASHFALL_AUDIO_QA__?.getDiagnostics?.() ?? null,
            }));
            throw new Error(`${String(error)} BGM preview diagnostics: ${JSON.stringify(previewState)}`);
          }
          const bgmPreview = bgmPreviewCapability ? "played" : "headless-web-audio-unavailable";
          await setSlider(sfxSlider, .6);
          await page.waitForFunction(() => {
            const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
            return snapshot.settings.bgmVolume === .25
              && snapshot.settings.sfxVolume === .6
              && document.documentElement.dataset.audioSfxVolume === "0.6";
          }, undefined, { timeout });
          await setSlider(bgmSlider, 0);
          await setSlider(sfxSlider, 0);
          await page.waitForFunction(() => {
            const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
            return snapshot.settings.bgmEnabled === false
              && snapshot.settings.sfxEnabled === false
              && snapshot.settings.bgmVolume === 0
              && snapshot.settings.sfxVolume === 0;
          }, undefined, { timeout });
          invariant((await bgmSlider.getAttribute("aria-valuetext"))?.includes("ミュート"), "BGM zero is not announced as mute");
          invariant((await sfxSlider.getAttribute("aria-valuetext"))?.includes("ミュート"), "SFX zero is not announced as mute");
          await setSlider(bgmSlider, .55);
          await setSlider(sfxSlider, .65);
          await page.waitForFunction(() => {
            const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
            return snapshot.settings.bgmEnabled === true
              && snapshot.settings.sfxEnabled === true
              && snapshot.settings.bgmVolume === .55
              && snapshot.settings.sfxVolume === .65;
          }, undefined, { timeout });
          const audioSettings = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot().settings);
          await page.getByRole("button", { name: "作戦を再開", exact: true }).click();

          for (const [kind, entries] of Object.entries(diagnostics)) {
            invariant(entries.length === 0, `${kind}: ${JSON.stringify(entries)}`);
          }
          Object.assign(result, {
            status: "passed",
            upgradedUnitId,
            capsBefore: before.caps,
            capsAfter: after.caps,
            normalFeedback,
            maxFeedback,
            fighter: {
              kind: fighter.kind,
              progressionRank: fighter.progressionRank,
              maxHp: fighter.maxHp,
              damage: fighter.damage,
              defense: fighter.defense,
            },
            damageProof,
            audioSettings,
            bgmPreview,
            visualCards,
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
