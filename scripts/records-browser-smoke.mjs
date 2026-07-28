import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  CAMPAIGN_STAGES,
  CAMPAIGN_UNITS,
  createDefaultCampaignSave,
  reviseCampaignSave,
  serializeCampaignSave,
} from "../app/campaign.js";
import {
  createDefaultCampaignRecords,
  recordCampaignOperation,
} from "../app/campaignRecords.js";
import { BOSS_DEFINITIONS } from "../app/bossFoundation.js";
import { ENEMY_CONTENT } from "../app/content/enemyCatalog.js";
import { OUTBREAK_MISSIONS } from "../app/outbreakMissions.js";

if (!process.env.RECORDS_QA_BASE_URL) throw new Error("RECORDS_QA_BASE_URL is required");
const baseUrl = new URL(process.env.RECORDS_QA_BASE_URL);
if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname)) {
  throw new Error(`Records QA is local-only: ${baseUrl}`);
}

const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href)
  : await import("playwright");
const engines = (process.env.RECORDS_QA_ENGINES ?? "chromium,webkit")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const browserTypes = { chromium: playwright.chromium, webkit: playwright.webkit };
const viewports = [
  { width: 1280, height: 720 },
  { width: 844, height: 390 },
  { width: 844, height: 340 },
];
const timeout = Math.max(12_000, Number(process.env.RECORDS_QA_TIMEOUT_MS) || 45_000);
const evidenceDir = path.resolve(
  process.env.RECORDS_QA_EVIDENCE_DIR ?? "outputs/records-browser-smoke",
);
const saveKey = "nishijin-campaign-v1";
const enemyKinds = [...new Set([
  ...ENEMY_CONTENT.map(({ id }) => id),
  ...BOSS_DEFINITIONS.map(({ enemyKind }) => enemyKind),
])];
const enemyDefeatsByKind = Object.fromEntries(enemyKinds.map((kind, index) => [kind, index + 1]));
const unitStats = {
  damageByUnit: Object.fromEntries(CAMPAIGN_UNITS.map((unit, index) => [unit.combatKind, 1200 + index * 173])),
  damageTakenByUnit: Object.fromEntries(CAMPAIGN_UNITS.map((unit, index) => [unit.combatKind, 280 + index * 37])),
  healingByUnit: Object.fromEntries(CAMPAIGN_UNITS.map((unit, index) => [unit.combatKind, unit.combatKind === "nao" || index % 5 === 0 ? 510 + index * 21 : 0])),
};
let records = recordCampaignOperation(createDefaultCampaignRecords(), {
  resultId: "records-qa-campaign",
  operationId: CAMPAIGN_STAGES.at(-1).id,
  category: "campaign",
  won: true,
  battleSeconds: 4_721,
  kills: 94,
  bossKills: 3,
  unitsLost: 2,
  capsEarned: 1_180,
  encounteredEnemyKinds: enemyKinds,
  enemyDefeatsByKind,
  unitStats,
  completedAt: "2026-07-27T08:00:00.000Z",
});
records = recordCampaignOperation(records, {
  resultId: "records-qa-survival",
  operationId: "survival-wave-21",
  category: "survival",
  outcome: "withdrawn",
  battleSeconds: 1_382,
  kills: 61,
  bossKills: 4,
  reachedWave: 26,
  capsEarned: 760,
  encounteredEnemyKinds: enemyKinds.slice(0, 6),
  enemyDefeatsByKind: Object.fromEntries(enemyKinds.slice(0, 6).map((kind) => [kind, 4])),
  unitStats,
  completedAt: "2026-07-27T09:00:00.000Z",
});
records = recordCampaignOperation(records, {
  resultId: "records-qa-outbreak",
  operationId: OUTBREAK_MISSIONS[0].id,
  category: "outbreak",
  won: true,
  battleSeconds: 216,
  kills: 18,
  bossKills: 1,
  capsEarned: OUTBREAK_MISSIONS[0].baseRewardCaps,
  encounteredEnemyKinds: [OUTBREAK_MISSIONS[0].boss.enemyKind],
  enemyDefeatsByKind: { [OUTBREAK_MISSIONS[0].boss.enemyKind]: 1 },
  unitStats,
  completedAt: "2026-07-27T10:00:00.000Z",
});
const defaultSave = createDefaultCampaignSave();
const seededSave = reviseCampaignSave({
  ...defaultSave,
  campaignStarted: true,
  completedStageIds: CAMPAIGN_STAGES.map(({ id }) => id),
  unlockedStageIds: CAMPAIGN_STAGES.map(({ id }) => id),
  ownership: CAMPAIGN_UNITS.map(({ id }) => id),
  discovery: CAMPAIGN_UNITS.map(({ id }) => id),
  bestStarsByStage: Object.fromEntries(CAMPAIGN_STAGES.map(({ id }) => [id, 3])),
  records,
  survival: {
    ...defaultSave.survival,
    highestWave: 26,
    highestKills: 61,
    highestBossKills: 4,
    totalRuns: 3,
    totalKills: 133,
    totalBossKills: 7,
  },
  outbreaks: {
    ...defaultSave.outbreaks,
    clearedMissionIds: OUTBREAK_MISSIONS.map(({ id }) => id),
    survivalBossKinds: OUTBREAK_MISSIONS.map(({ boss }) => boss.enemyKind),
    bossDefeatCounts: Object.fromEntries(OUTBREAK_MISSIONS.map(({ boss }, index) => [boss.enemyKind, index + 1])),
  },
}, { updatedAt: "2026-07-27T10:01:00.000Z" });
const serializedSeed = serializeCampaignSave(seededSave);
const results = [];
await mkdir(evidenceDir, { recursive: true });

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function diagnosticsFor(page) {
  const diagnostics = { consoleErrors: [], pageErrors: [], requestFailures: [], httpErrors: [] };
  page.on("console", (message) => {
    if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(String(error)));
  page.on("requestfailed", (request) => {
    diagnostics.requestFailures.push(`${request.url()} :: ${request.failure()?.errorText ?? "unknown"}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) diagnostics.httpErrors.push(`${response.status()} ${response.url()}`);
  });
  return diagnostics;
}

async function openRecords(page) {
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
    key: saveKey,
    value: serializedSeed,
  });
  await page.goto(String(baseUrl), { waitUntil: "domcontentloaded", timeout });
  await page.locator("button.title-start").waitFor({ state: "visible", timeout });
  await page.locator("button.title-start").click();
  await page.locator(".map-screen").waitFor({ state: "visible", timeout });
  await page.locator("button.records-entry").click();
  await page.locator(".records-screen").waitFor({ state: "visible", timeout });
}

async function layoutEvidence(page, contentSelector) {
  return page.evaluate((selector) => {
    const root = document.querySelector(".records-screen");
    const content = document.querySelector(selector);
    const tabs = [...document.querySelectorAll(".records-tabs button")];
    const back = document.querySelector(".records-screen .campaign-back");
    const rootRect = root?.getBoundingClientRect();
    const contentRect = content?.getBoundingClientRect();
    return {
      viewport: { width: innerWidth, height: innerHeight },
      document: {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      },
      root: rootRect && {
        left: rootRect.left,
        top: rootRect.top,
        right: rootRect.right,
        bottom: rootRect.bottom,
      },
      content: contentRect && {
        left: contentRect.left,
        top: contentRect.top,
        right: contentRect.right,
        bottom: contentRect.bottom,
        clientHeight: content.clientHeight,
        scrollHeight: content.scrollHeight,
      },
      tabHeights: tabs.map((tab) => tab.getBoundingClientRect().height),
      backHeight: back?.getBoundingClientRect().height ?? 0,
    };
  }, contentSelector);
}

async function artEvidence(page, selector) {
  return page.evaluate(async (targetSelector) => {
    const entries = [...document.querySelectorAll(targetSelector)];
    return Promise.all(entries.map(async (entry) => {
      const art = entry.querySelector(".compendium-art");
      const artLayer = art?.querySelector("i");
      const style = artLayer ? getComputedStyle(artLayer) : null;
      const backgroundImage = style?.backgroundImage ?? "";
      const imageUrl = backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1] ?? "";
      const image = imageUrl ? await new Promise((resolve) => {
        const probe = new Image();
        probe.onload = () => resolve({ ok: true, width: probe.naturalWidth, height: probe.naturalHeight });
        probe.onerror = () => resolve({ ok: false, width: 0, height: 0 });
        probe.src = imageUrl;
      }) : { ok: false, width: 0, height: 0 };
      return {
        locked: entry.getAttribute("data-locked"),
        label: entry.querySelector("h2")?.textContent ?? "",
        image,
        backgroundSize: style?.backgroundSize ?? "",
        backgroundPosition: style?.backgroundPosition ?? "",
      };
    }));
  }, selector);
}

for (const engine of engines) {
  const browserType = browserTypes[engine];
  if (!browserType) throw new Error(`Unknown RECORDS_QA_ENGINES value: ${engine}`);
  const browser = await browserType.launch({ headless: true });
  try {
    for (const viewport of viewports) {
      const name = `${engine}-records-${viewport.width}x${viewport.height}`;
      const context = await browser.newContext({ viewport, hasTouch: true });
      const page = await context.newPage();
      const diagnostics = diagnosticsFor(page);
      try {
        await openRecords(page);
        const summaryText = await page.locator(".records-summary").innerText();
        invariant(summaryText.includes("20/20"), `${name}: campaign completion summary missing`);
        invariant(summaryText.includes("WAVE 26"), `${name}: Survival summary missing`);
        invariant(summaryText.includes("2勝 / 0敗") && summaryText.includes("撤退 1"), `${name}: operation summary missing`);
        invariant(await page.locator(".records-unit-stats tbody tr").count() === CAMPAIGN_UNITS.length, `${name}: per-unit rows incomplete`);
        const summaryLayout = await layoutEvidence(page, ".records-summary");
        invariant(summaryLayout.tabHeights.every((height) => height >= 44), `${name}: records tab below 44px`);
        invariant(summaryLayout.backHeight >= 44, `${name}: back target below 44px`);
        invariant(summaryLayout.document.width <= viewport.width && summaryLayout.document.height <= viewport.height, `${name}: summary document overflow`);
        invariant(summaryLayout.root?.right <= viewport.width && summaryLayout.root?.bottom <= viewport.height, `${name}: summary root overflow`);
        const summaryPath = path.join(evidenceDir, `${name}-summary.png`);
        await page.screenshot({ path: summaryPath, fullPage: false });

        await page.getByRole("button", { name: "ユニット図鑑" }).click();
        await page.locator(".unit-compendium").waitFor({ state: "visible", timeout });
        invariant(await page.locator(".unit-compendium > article").count() === CAMPAIGN_UNITS.length,
          `${name}: unit compendium count mismatch`);
        const unitText = await page.locator(".unit-compendium").innerText();
        invariant(unitText.includes("光刃解放") && unitText.includes("全弾制圧") && unitText.includes("凶暴マヨ"),
          `${name}: canonical manual ability explanations missing`);
        invariant(unitText.includes("プラズマブレード") && unitText.includes("回転弾倉式グレネードランチャー"),
          `${name}: canonical newcomer weapon information missing`);
        const unitLayout = await layoutEvidence(page, ".unit-compendium");
        invariant(unitLayout.document.width <= viewport.width && unitLayout.document.height <= viewport.height,
          `${name}: unit compendium document overflow`);
        const unitPath = path.join(evidenceDir, `${name}-unit.png`);
        await page.screenshot({ path: unitPath, fullPage: false });

        await page.getByRole("button", { name: "敵図鑑" }).click();
        await page.locator(".enemy-compendium").waitFor({ state: "visible", timeout });
        const enemyArt = await artEvidence(page, ".enemy-compendium > article");
        const expectedEnemyCount = ENEMY_CONTENT.filter(({ id }) => (
          !BOSS_DEFINITIONS.some(({ enemyKind }) => enemyKind === id)
        )).length;
        invariant(enemyArt.length === expectedEnemyCount, `${name}: enemy compendium count ${enemyArt.length}/${expectedEnemyCount}`);
        invariant(enemyArt.every(({ locked }) => locked === "false"), `${name}: encountered enemy remained locked`);
        invariant(enemyArt.every(({ image }) => image.ok && image.width > 0 && image.height > 0), `${name}: enemy atlas decode failed`);
        invariant(enemyArt.every(({ backgroundSize }) => backgroundSize !== "contain"), `${name}: full atlas leaked into enemy card`);
        invariant(enemyArt.every(({ backgroundPosition }) => backgroundPosition !== "50% 50%"), `${name}: enemy atlas crop lost`);
        const enemyLayout = await layoutEvidence(page, ".enemy-compendium");
        invariant(enemyLayout.document.width <= viewport.width && enemyLayout.document.height <= viewport.height, `${name}: enemy compendium document overflow`);
        const enemyPath = path.join(evidenceDir, `${name}-enemy.png`);
        await page.screenshot({ path: enemyPath, fullPage: false });

        await page.getByRole("button", { name: "BOSS図鑑" }).click();
        await page.locator(".boss-compendium").waitFor({ state: "visible", timeout });
        const bossArt = await artEvidence(page, ".boss-compendium > article");
        invariant(bossArt.length === BOSS_DEFINITIONS.length, `${name}: boss compendium count ${bossArt.length}/${BOSS_DEFINITIONS.length}`);
        invariant(bossArt.every(({ locked }) => locked === "false"), `${name}: defeated boss remained locked`);
        invariant(bossArt.every(({ image }) => image.ok && image.width > 0 && image.height > 0), `${name}: boss art decode failed`);
        const bossText = await page.locator(".boss-compendium").innerText();
        invariant(!bossText.includes("解析中") && !bossText.includes("未発見"), `${name}: defeated boss intel remained hidden`);
        const bossLayout = await layoutEvidence(page, ".boss-compendium");
        invariant(bossLayout.document.width <= viewport.width && bossLayout.document.height <= viewport.height, `${name}: boss compendium document overflow`);
        const bossPath = path.join(evidenceDir, `${name}-boss.png`);
        await page.screenshot({ path: bossPath, fullPage: false });

        invariant(diagnostics.consoleErrors.length === 0, `${name}: console ${diagnostics.consoleErrors}`);
        invariant(diagnostics.pageErrors.length === 0, `${name}: page ${diagnostics.pageErrors}`);
        invariant(diagnostics.requestFailures.length === 0, `${name}: request ${diagnostics.requestFailures}`);
        invariant(diagnostics.httpErrors.length === 0, `${name}: HTTP ${diagnostics.httpErrors}`);
        results.push({ name, status: "passed", summaryPath, unitPath, enemyPath, bossPath });
      } catch (error) {
        results.push({ name, status: "failed", error: String(error), diagnostics });
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}

const reportPath = path.join(evidenceDir, "report.json");
await writeFile(reportPath, `${JSON.stringify(results, null, 2)}\n`, "utf8");
const failures = results.filter(({ status }) => status !== "passed");
if (failures.length > 0) {
  throw new Error(`Records browser smoke failed (${failures.length}/${results.length}): ${reportPath}`);
}
console.log(`Records browser smoke passed (${results.length}/${results.length}): ${reportPath}`);
