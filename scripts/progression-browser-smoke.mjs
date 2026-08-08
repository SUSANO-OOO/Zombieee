import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { UNIT_CARDS } from "../app/gameRules.js";
import { applyUnitLevelProgression } from "../app/unitProgression.js";
import { CAMPAIGN_UNITS } from "../app/campaign.js";
import { dismissInstallOffer } from "./pwa-gate-qa.mjs";

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

async function activate(page, locator, useTouch) {
  await locator.waitFor({ state: "visible", timeout });
  if (!useTouch) {
    await locator.click();
    return;
  }
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  invariant(box && box.width > 0 && box.height > 0, "touch target has no visible bounds");
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

async function enterBattle(page, useTouch) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const screen = await page.locator(".game-shell").getAttribute("data-screen");
    if (screen === "battle") return;
    if (screen === "loadout") {
      const deploy = page.getByRole("button", { name: /この編成で出撃/u });
      if (await deploy.count() === 1 && await deploy.isEnabled()) await activate(page, deploy, useTouch);
    } else if (screen === "event") {
      const advance = page.locator('button[aria-label="セリフを送る"]');
      if (await advance.count() === 1) await activate(page, advance, useTouch);
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
        const context = await browser.newContext({
          viewport,
          hasTouch: viewport.safeArea,
          isMobile: viewport.safeArea,
        });
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
          await dismissInstallOffer(page, { timeout: Math.min(timeout, 5_000) });
          await page.waitForFunction((expectedCount) => (
            document.querySelector(".game-shell")?.getAttribute("data-screen") === "personnel"
            && document.querySelectorAll(".formation-unit-card").length === expectedCount
          ), CAMPAIGN_UNITS.length, { timeout });
          const visualCards = await page.evaluate(() => {
            const portraits = [...document.querySelectorAll(".formation-portrait")];
            return {
              total: portraits.length,
              withArt: portraits.filter((portrait) => {
                const image = getComputedStyle(portrait).backgroundImage;
                return image.includes("/art/v080/characters/cards/")
                  || image.includes("/art/v090/characters/cards/");
              }).length,
              minimumWidth: Math.min(...portraits.map((portrait) => portrait.getBoundingClientRect().width)),
              minimumHeight: Math.min(...portraits.map((portrait) => portrait.getBoundingClientRect().height)),
            };
          });
          invariant(visualCards.total === CAMPAIGN_UNITS.length && visualCards.withArt === CAMPAIGN_UNITS.length,
            `purpose-specific visual cards missing: ${JSON.stringify(visualCards)}`);
          invariant(visualCards.minimumWidth >= 64 && visualCards.minimumHeight >= 64,
            `visual cards are too small to identify: ${JSON.stringify(visualCards)}`);
          invariant(await page.locator('.formation-unit-select[style*="-r2.webp"]').count() === 11,
            "upper-body r2 formation/personnel card set is not active");
          invariant(await page.locator('.formation-unit-select[style*="/art/v090/characters/cards/"]').count() === 5,
            "approved 0.9.0 identity-master derivatives are not active");
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

          await activate(page, page.getByRole("button", { name: "Level", exact: true }), viewport.safeArea);
          await page.waitForFunction((expectedCount) => document.querySelectorAll(".formation-unit-upgrade").length === expectedCount,
            CAMPAIGN_UNITS.length, { timeout });
          const before = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
          const concurrentUpgradeIds = await page.locator(".formation-unit-upgrade:not(:disabled)").evaluateAll((buttons) => buttons
            .slice(0, 2)
            .map((button) => button.closest(".formation-unit-card")?.querySelector("[data-unit-id]")?.getAttribute("data-unit-id"))
            .filter(Boolean));
          invariant(concurrentUpgradeIds.length === 2, `two concurrent upgrade targets missing: ${JSON.stringify(concurrentUpgradeIds)}`);
          const firstUpgrade = page.locator(`.formation-unit-card:has([data-unit-id="${concurrentUpgradeIds[0]}"]) .formation-unit-upgrade`);
          const costLabel = await firstUpgrade.locator("b").innerText();
          invariant(costLabel.includes("40キャップ"), `catch-up price missing: ${costLabel}`);
          const upgradeCueStart = await page.evaluate(() => window.__ASHFALL_AUDIO_QA__?.getCueRequests?.().length ?? 0);
          await page.evaluate(() => {
            const buttons = [...document.querySelectorAll(".formation-unit-upgrade:not(:disabled)")].slice(0, 2);
            buttons[0]?.click();
            buttons[0]?.click();
            buttons[1]?.click();
          });
          await page.waitForFunction(
            ({ firstId, secondId, levels }) => {
              const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
              return Boolean(snapshot
                && snapshot.unitLevels[firstId] === levels[firstId] + 1
                && snapshot.unitLevels[secondId] === levels[secondId] + 1);
            },
            { firstId: concurrentUpgradeIds[0], secondId: concurrentUpgradeIds[1], levels: before.unitLevels },
            { timeout },
          );
          await page.locator('.upgrade-feedback[data-level="normal"]').waitFor({ state: "visible", timeout });
          const normalFeedback = await page.locator('.upgrade-feedback[data-level="normal"]').innerText();
          invariant(normalFeedback.includes("Lv2 強化完了"), `normal upgrade feedback missing: ${normalFeedback}`);
          invariant(normalFeedback.includes("HP ") && normalFeedback.includes("攻撃 ") && normalFeedback.includes("防御 "),
            `normal stat delta missing: ${normalFeedback}`);
          await page.waitForTimeout(700);
          const after = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
          const upgradedUnitIds = Object.keys(after.unitLevels).filter((unitId) => after.unitLevels[unitId] !== before.unitLevels[unitId]);
          const upgradedUnitId = concurrentUpgradeIds[0];
          invariant(JSON.stringify(upgradedUnitIds.sort()) === JSON.stringify([...concurrentUpgradeIds].sort()),
            `concurrent upgrades changed unexpected units: ${JSON.stringify({ before: before.unitLevels, after: after.unitLevels })}`);
          invariant(concurrentUpgradeIds.every((unitId) => after.unitLevels[unitId] === before.unitLevels[unitId] + 1),
            `a concurrent upgrade applied more than once: ${JSON.stringify({ before: before.unitLevels, after: after.unitLevels })}`);
          invariant(before.caps - after.caps === 80, `concurrent caps spend mismatch ${before.caps} -> ${after.caps}`);
          const upgradeCues = (await page.evaluate(() => window.__ASHFALL_AUDIO_QA__?.getCueRequests?.() ?? [])).slice(upgradeCueStart);
          const semanticUpgradeCues = upgradeCues.filter((entry) => entry.cueId === "sfx-v070-power-switch");
          invariant(semanticUpgradeCues.length === 2, `concurrent upgrade cue count mismatch: ${JSON.stringify(upgradeCues)}`);
          invariant(upgradeCues.filter((entry) => entry.cueId === "ui-select").length === 0,
            `generic selection cue leaked into upgrade transaction: ${JSON.stringify(upgradeCues)}`);
          const upgradeText = await page.locator(".formation-unit-card").first().innerText();
          invariant(upgradeText.includes("Lv 2 / 上限 5"), `Level UI missing: ${upgradeText}`);
          invariant(upgradeText.includes("HP +3%"), `HP growth UI missing: ${upgradeText}`);
          invariant(upgradeText.includes("攻撃 +3%"), `damage growth UI missing: ${upgradeText}`);
          invariant(upgradeText.includes("防御 1.5%軽減"), `defense growth UI missing: ${upgradeText}`);
          invariant(!upgradeText.includes("射程 +"), `range must not grow: ${upgradeText}`);

          const ariaDisabledProof = await page.evaluate(() => [...document.querySelectorAll('button[aria-disabled="true"]')].map((button) => {
            const style = getComputedStyle(button);
            return {
              text: button.textContent?.trim() ?? "",
              opacity: style.opacity,
              cursor: style.cursor,
              filter: style.filter,
            };
          }));
          invariant(ariaDisabledProof.length > 0
            && ariaDisabledProof.every(({ opacity, cursor, filter }) => Number(opacity) < 1 && cursor === "not-allowed" && filter !== "none"),
          `aria-disabled visual state is incomplete: ${JSON.stringify(ariaDisabledProof)}`);
          const lockedUpgrade = page.locator('.formation-unit-upgrade[aria-disabled="true"]:not(:disabled)').first();
          await lockedUpgrade.waitFor({ state: "visible", timeout });
          await lockedUpgrade.focus();
          await page.keyboard.press("Tab");
          await page.keyboard.press("Shift+Tab");
          const lockedFocusProof = await lockedUpgrade.evaluate((button) => {
            const style = getComputedStyle(button);
            return {
              focusVisible: button.matches(":focus-visible"),
              outlineWidth: style.outlineWidth,
              boxShadow: style.boxShadow,
              opacity: style.opacity,
              cursor: style.cursor,
            };
          });
          invariant(lockedFocusProof.focusVisible
            && lockedFocusProof.outlineWidth !== "0px"
            && lockedFocusProof.opacity !== "1"
            && lockedFocusProof.cursor === "not-allowed",
          `aria-disabled focus state is incomplete: ${JSON.stringify(lockedFocusProof)}`);
          const rejectionBefore = await page.evaluate(() => ({
            snapshot: window.__ASHFALL_BATTLE_QA__.getSnapshot(),
            cues: window.__ASHFALL_AUDIO_QA__?.getCueRequests?.() ?? [],
          }));
          const rejectOne = async (inputMode) => {
            const cueCount = await page.evaluate(() => window.__ASHFALL_AUDIO_QA__?.getCueRequests?.().length ?? 0);
            if (inputMode === "touch") {
              const bounds = await lockedUpgrade.boundingBox();
              invariant(bounds, "locked upgrade touch target has no visible bounds");
              await page.touchscreen.tap(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
            }
            else if (inputMode === "keyboard-enter") {
              await lockedUpgrade.focus();
              await page.keyboard.press("Enter");
            } else if (inputMode === "keyboard-space") {
              await lockedUpgrade.focus();
              await page.keyboard.press("Space");
            } else await lockedUpgrade.evaluate((button) => button.click());
            await page.waitForFunction((expected) => (window.__ASHFALL_AUDIO_QA__?.getCueRequests?.().length ?? 0) === expected + 1,
              cueCount, { timeout });
            const cues = await page.evaluate(() => window.__ASHFALL_AUDIO_QA__?.getCueRequests?.() ?? []);
            invariant(cues.slice(cueCount).filter((entry) => entry.cueId === "ui-error").length === 1,
              `${inputMode}: reject cue was not exactly one`);
          };
          await rejectOne(viewport.safeArea ? "touch" : "mouse");
          await rejectOne("keyboard-enter");
          await rejectOne("keyboard-space");
          const rejectionAfter = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
          invariant(rejectionAfter.caps === rejectionBefore.snapshot.caps
            && JSON.stringify(rejectionAfter.unitLevels) === JSON.stringify(rejectionBefore.snapshot.unitLevels),
          `rejected upgrade mutated save: ${JSON.stringify({ before: rejectionBefore.snapshot, after: rejectionAfter })}`);

          let expectedBattleLevel = 2;
          let maxFeedback = null;
          if (engine === "chromium" && viewport.width === 1280 && viewport.height === 720) {
            const upgradedCard = page.locator(`.formation-unit-card:has([data-unit-id="${upgradedUnitId}"])`);
            for (const expectedLevel of [3, 4, 5]) {
              const button = upgradedCard.locator(".formation-unit-upgrade");
              await button.waitFor({ state: "visible", timeout });
              await page.waitForFunction(
                ({ unitId, level }) => window.__ASHFALL_BATTLE_QA__.getSnapshot().unitLevels[unitId] === level - 1,
                { unitId: upgradedUnitId, level: expectedLevel },
                { timeout },
              );
              await activate(page, button, viewport.safeArea);
              await page.waitForFunction(
                ({ unitId, level }) => window.__ASHFALL_BATTLE_QA__.getSnapshot().unitLevels[unitId] === level,
                { unitId: upgradedUnitId, level: expectedLevel },
                { timeout },
              );
              await upgradedCard.locator('.upgrade-feedback[data-level="normal"]').waitFor({ state: "visible", timeout });
              await page.waitForTimeout(700);
            }
            await upgradedCard.locator(".formation-unit-upgrade").waitFor({ state: "visible", timeout });
            const capText = await upgradedCard.locator(".formation-unit-upgrade").innerText();
            invariant(capText.includes("Level上限 5") && capText.includes("Stage進行"), `Level cap UI missing: ${capText}`);
            maxFeedback = capText;
            expectedBattleLevel = 5;
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

          await activate(page, page.getByRole("button", { name: "← 地図へ", exact: true }), viewport.safeArea);
          const mapNavigation = await page.evaluate(() => {
            const regions = [...document.querySelectorAll(".map-region-tabs button")];
            const regionStrip = document.querySelector(".map-region-tabs");
            const operationStrip = document.querySelector(".map-operation-tabs");
            const specialOperations = [...document.querySelectorAll(".map-operation-tabs .special-operation")];
            const stageActions = [...document.querySelectorAll(".stage-actions button")];
            const stageDetail = document.querySelector(".stage-detail");
            const stageDetailRect = stageDetail?.getBoundingClientRect();
            const stageActionRect = stageActions[0]?.getBoundingClientRect();
            const topValues = regions.map((button) => Math.round(button.getBoundingClientRect().top));
            return {
              regionCount: regions.length,
              uniqueRegionRows: [...new Set(topValues)].length,
              stripScrollable: (regionStrip?.scrollWidth ?? 0) >= (regionStrip?.clientWidth ?? 0),
              operationHeight: operationStrip?.getBoundingClientRect().height ?? 0,
              regionButtonHeights: regions.map((button) => button.getBoundingClientRect().height),
              operationButtonHeights: [...document.querySelectorAll(".map-operation-tabs button")]
                .map((button) => button.getBoundingClientRect().height),
              stageActionVisible: Boolean(stageDetailRect && stageActionRect
                && stageActionRect.top >= stageDetailRect.top
                && stageActionRect.bottom <= stageDetailRect.bottom
                && stageActionRect.top >= 0
                && stageActionRect.bottom <= window.innerHeight),
              stageDetailText: stageDetail?.innerText ?? "",
              stageDetailScrollable: (stageDetail?.scrollHeight ?? 0) > (stageDetail?.clientHeight ?? 0),
              specialLabels: specialOperations.map((button) => button.textContent?.trim() ?? ""),
              stageActionLabels: stageActions.map((button) => button.textContent?.trim() ?? ""),
              documentWidth: document.documentElement.scrollWidth,
              documentHeight: document.documentElement.scrollHeight,
            };
          });
          invariant(mapNavigation.regionCount === 6 && mapNavigation.uniqueRegionRows === 1,
            `region strip wrapped: ${JSON.stringify(mapNavigation)}`);
          invariant(mapNavigation.stripScrollable && mapNavigation.operationHeight >= 44,
            `map navigation is not touch-safe: ${JSON.stringify(mapNavigation)}`);
          invariant(mapNavigation.regionButtonHeights.every((height) => height >= 44)
            && mapNavigation.operationButtonHeights.every((height) => height >= 44),
          `map navigation buttons are below the 44px touch gate: ${JSON.stringify(mapNavigation)}`);
          invariant(mapNavigation.specialLabels.some((label) => label.includes("SURVIVAL"))
            && mapNavigation.specialLabels.some((label) => label.includes("OUTBREAK")),
          `special operations are not separated: ${JSON.stringify(mapNavigation)}`);
          invariant(mapNavigation.stageActionLabels.length === 1
            && mapNavigation.stageActionLabels[0].includes("この作戦を編成")
            && mapNavigation.stageActionVisible,
          `stage detail still mixes global operations: ${JSON.stringify(mapNavigation)}`);
          invariant(["目的", "基本報酬", "次の未取得星報酬", "星判定"]
            .every((label) => mapNavigation.stageDetailText.includes(label)),
          `stage detail information became inaccessible: ${JSON.stringify(mapNavigation)}`);
          const bayRegionTab = page.getByRole("button", { name: /^湾岸/ }).first();
          await activate(page, bayRegionTab, viewport.safeArea);
          await page.waitForFunction(() => document.querySelector(".nishijin-map")?.getAttribute("data-region") === "region-bay-quarantine", undefined, { timeout });
          const bayMap = await page.evaluate(() => ({
            region: document.querySelector(".nishijin-map")?.getAttribute("data-landmark-region"),
            source: document.querySelector(".nishijin-map")?.getAttribute("data-landmark-source"),
            missing: document.querySelector(".nishijin-map")?.getAttribute("data-landmark-missing"),
            labels: [...document.querySelectorAll(".map-landmark")].map((element) => element.textContent?.trim() ?? ""),
            documentWidth: document.documentElement.scrollWidth,
          }));
          invariant(bayMap.region === "region-bay-quarantine" && bayMap.source === "explicit" && bayMap.missing === "false",
            `bay map landmark resolution is not explicit: ${JSON.stringify(bayMap)}`);
          invariant(["湾岸タワー", "市民資料館", "海浜連絡橋", "河口防潮門"].every((label) => bayMap.labels.some((entry) => entry.includes(label)))
            && bayMap.labels.every((entry) => !entry.includes("西新")),
          `bay map labels are incorrect or borrowed: ${JSON.stringify(bayMap)}`);
          invariant(bayMap.documentWidth <= viewport.width, `bay map overflow: ${JSON.stringify(bayMap)}`);
          await page.screenshot({ path: path.join(evidenceDir, `${name}-bay-map.png`) });
          for (const [stageName, stagePattern] of [
            ["Stage 17", /湾岸タワー・非常回廊/u],
            ["Stage 20", /河口防潮門・最終封鎖/u],
          ]) {
            const stageNode = page.getByRole("button", { name: stagePattern });
            await activate(page, stageNode, viewport.safeArea);
            const selectedBayStage = await page.locator(".stage-node.selected").innerText();
            invariant(stagePattern.test(selectedBayStage), `${stageName} was not selected in bay region: ${selectedBayStage}`);
            await page.screenshot({ path: path.join(evidenceDir, `${name}-${stageName.replace(/ /gu, "-").toLowerCase()}-map.png`) });
          }
          await activate(page, page.getByRole("button", { name: /^西新/u }).first(), viewport.safeArea);
          await activate(page, page.getByRole("button", { name: /西新駅・改札区域/u }), viewport.safeArea);
          await page.waitForFunction(() => document.querySelector(".nishijin-map")?.getAttribute("data-region") === "region-nishijin", undefined, { timeout });
          const compactDetailScrollProof = await page.evaluate(() => {
            const detail = document.querySelector(".stage-detail");
            const criteria = document.querySelector(".stage-detail .star-criteria");
            const action = document.querySelector(".stage-actions button");
            if (!detail || !criteria || !action) return null;
            detail.scrollTop = detail.scrollHeight;
            const detailRect = detail.getBoundingClientRect();
            const criteriaRect = criteria.getBoundingClientRect();
            const actionRect = action.getBoundingClientRect();
            const proof = {
              criteriaVisible: getComputedStyle(criteria).display !== "none"
                && criteriaRect.bottom > detailRect.top
                && criteriaRect.top < detailRect.bottom,
              stickyActionVisible: actionRect.top >= detailRect.top - 1 && actionRect.bottom <= detailRect.bottom + 6,
              detailRect: { top: detailRect.top, bottom: detailRect.bottom },
              actionRect: { top: actionRect.top, bottom: actionRect.bottom },
            };
            detail.scrollTop = 0;
            return proof;
          });
          invariant(!mapNavigation.stageDetailScrollable
            || (compactDetailScrollProof?.criteriaVisible && compactDetailScrollProof?.stickyActionVisible),
          `compact stage detail cannot expose information while retaining its CTA: ${JSON.stringify(compactDetailScrollProof)}`);
          invariant(mapNavigation.documentWidth <= viewport.width && mapNavigation.documentHeight <= viewport.height,
            `map viewport overflow: ${JSON.stringify(mapNavigation)}`);
          await page.screenshot({ path: path.join(evidenceDir, `${name}-map-navigation.png`) });
          await activate(page, page.getByRole("button", { name: "この作戦を編成", exact: true }), viewport.safeArea);
          await page.waitForFunction(() => document.querySelector(".game-shell")?.getAttribute("data-screen") === "loadout",
            undefined, { timeout });
          const selectedUnit = page.locator('.formation-unit-select[aria-pressed="true"]').first();
          const unselectedUnit = page.locator('.formation-unit-select[aria-pressed="false"]').first();
          await selectedUnit.waitFor({ state: "visible", timeout });
          await unselectedUnit.waitFor({ state: "visible", timeout });
          const deselectionProof = await unselectedUnit.evaluate((button) => ({
            ariaPressed: button.getAttribute("aria-pressed"),
            buttonSelected: button.getAttribute("data-selected"),
            cardSelected: button.closest(".formation-unit-card")?.getAttribute("data-selected"),
            mark: button.querySelector(".formation-selection-mark")?.textContent?.trim() ?? "",
            cardOpacity: getComputedStyle(button.closest(".formation-unit-card")).opacity,
          }));
          const selectionProof = await selectedUnit.evaluate((button) => {
            const card = button.closest(".formation-unit-card");
            const style = getComputedStyle(button);
            return {
              ariaPressed: button.getAttribute("aria-pressed"),
              buttonSelected: button.getAttribute("data-selected"),
              cardSelected: card?.getAttribute("data-selected"),
              mark: button.querySelector(".formation-selection-mark")?.textContent?.trim() ?? "",
              boxShadow: style.boxShadow,
              cardOpacity: getComputedStyle(card).opacity,
            };
          });
          invariant(deselectionProof.ariaPressed === "false"
            && deselectionProof.buttonSelected === "false"
            && deselectionProof.cardSelected === "false"
            && deselectionProof.mark === ""
            && Number(deselectionProof.cardOpacity) < Number(selectionProof.cardOpacity)
            && selectionProof.ariaPressed === "true"
            && selectionProof.buttonSelected === "true"
            && selectionProof.cardSelected === "true"
            && selectionProof.boxShadow !== "none",
          `formation selection lacks visible and semantic confirmation: ${JSON.stringify({ deselectionProof, selectionProof })}`);
          await enterBattle(page, viewport.safeArea);
          const brawlerButton = page.locator('button.unit-card[data-kind="brawler"]');
          await brawlerButton.waitFor({ state: "visible", timeout });
          await activate(page, brawlerButton, viewport.safeArea);
          await page.waitForFunction(() => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().fighters
            .some((fighter) => fighter.side === "human" && fighter.kind === "brawler"), undefined, { timeout });
          const battle = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
          const fighter = battle.fighters.find((candidate) => candidate.side === "human" && candidate.kind === "brawler");
          const baseCard = UNIT_CARDS.find((card) => card.kind === "brawler");
          const expected = applyUnitLevelProgression(baseCard, expectedBattleLevel);
          invariant(fighter.progressionLevel === expectedBattleLevel, `battle Level mismatch: ${JSON.stringify(fighter)}`);
          invariant(
            fighter.maxHp === expected.hp
              && fighter.damage === expected.damage
              && Math.abs(fighter.defense - expected.defense) < 1e-9,
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
          invariant(Math.abs(damageProof.trained.defense - expected.defense) < 1e-9,
            `trained defense mismatch: ${JSON.stringify(damageProof)}`);
          invariant(damageProof.baseline.targetDamage === 50 * (1 - damageProof.baseline.defense),
            `baseline live damage mismatch: ${JSON.stringify(damageProof)}`);
          invariant(damageProof.trained.targetDamage <= damageProof.baseline.targetDamage,
            `defense did not reduce or preserve live damage: ${JSON.stringify(damageProof)}`);
          invariant(
            damageProof.trained.targetDamage === 50 * (1 - expected.defense)
              && damageProof.baseline.targetDamage === 50 * (1 - damageProof.baseline.defense),
            `live damage values mismatch: ${JSON.stringify(damageProof)}`);

          await activate(page, page.getByRole("button", { name: "一時停止", exact: true }), viewport.safeArea);
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
          await activate(page, page.getByRole("button", { name: "作戦を再開", exact: true }), viewport.safeArea);

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
            inputMode: viewport.safeArea ? "touch" : "mouse",
            visualCards,
            concurrentUpgradeIds,
            upgradeCueDelta: {
              semanticUpgrade: semanticUpgradeCues.length,
              genericSelection: upgradeCues.filter((entry) => entry.cueId === "ui-select").length,
            },
            ariaDisabledProof,
            lockedFocusProof,
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
