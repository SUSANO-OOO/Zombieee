import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

if (!process.env.EQUIPMENT_RUNTIME_QA_BASE_URL) {
  throw new Error("EQUIPMENT_RUNTIME_QA_BASE_URL is required; use the isolated QA runner");
}
const baseUrl = new URL(process.env.EQUIPMENT_RUNTIME_QA_BASE_URL);
if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname)) {
  throw new Error(`Equipment runtime QA is local-only; refusing ${baseUrl}`);
}
const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href)
  : await import("playwright");
const browserTypes = { chromium: playwright.chromium, webkit: playwright.webkit };
const engines = (process.env.EQUIPMENT_RUNTIME_QA_ENGINES ?? "chromium,webkit")
  .split(",")
  .map((engine) => engine.trim())
  .filter(Boolean);
const viewports = [
  { width: 1280, height: 720, safeArea: false },
  { width: 844, height: 390, safeArea: true },
  { width: 844, height: 340, safeArea: true },
];
const timeout = Math.max(10_000, Number(process.env.EQUIPMENT_RUNTIME_QA_TIMEOUT_MS) || 30_000);
const evidenceDir = path.resolve(
  process.env.EQUIPMENT_RUNTIME_QA_EVIDENCE_DIR ?? "outputs/equipment-runtime-browser-smoke",
);
await mkdir(evidenceDir, { recursive: true });

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function diagnosticsFor(page) {
  const state = {
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
    httpErrors: [],
  };
  page.on("console", (message) => {
    if (message.type() === "error") state.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => state.pageErrors.push(String(error)));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown";
    if (failure !== "net::ERR_ABORTED") {
      state.requestFailures.push(`${request.url()} :: ${failure}`);
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 400) state.httpErrors.push(`${response.status()} ${response.url()}`);
  });
  return state;
}

function assertTacticalEffects(control, equipped, label) {
  invariant(equipped.baseMaxHp > control.baseMaxHp, `${label}: base HP equipment was ignored`);
  invariant(equipped.energy > control.energy, `${label}: initial command equipment was ignored`);
  invariant(
    equipped.supportGauge > control.supportGauge,
    `${label}: initial support equipment was ignored`,
  );
}

function assertOffenseEffects(control, equipped, label) {
  invariant(equipped.fighter.damage > control.fighter.damage, `${label}: damage was unchanged`);
  invariant(equipped.fighter.range > control.fighter.range, `${label}: range was unchanged`);
  invariant(equipped.fighter.speed > control.fighter.speed, `${label}: speed was unchanged`);
  invariant(
    equipped.fighter.laneSpeed > control.fighter.laneSpeed,
    `${label}: lane speed was unchanged`,
  );
  invariant(
    equipped.fighter.attackEvery < control.fighter.attackEvery,
    `${label}: attack interval was unchanged`,
  );
}

function assertDurabilityEffects(control, equipped, label) {
  invariant(equipped.fighter.maxHp > control.fighter.maxHp, `${label}: fighter HP was unchanged`);
  invariant(equipped.fighter.hp === equipped.fighter.maxHp, `${label}: fighter did not deploy at full HP`);
  invariant(equipped.fighter.defense > control.fighter.defense, `${label}: defense was unchanged`);
  invariant(
    equipped.fighter.attackEvery < control.fighter.attackEvery,
    `${label}: quick-loader attack interval was unchanged`,
  );
}

async function runtimeProof(page, input) {
  return page.evaluate((proofInput) => (
    window.__ASHFALL_BATTLE_QA__?.prepareEquipmentRuntimeProof?.(proofInput)
  ), input);
}

const results = [];
for (const engine of engines) {
  const browserType = browserTypes[engine];
  if (!browserType) throw new Error(`Unknown EQUIPMENT_RUNTIME_QA_ENGINES entry: ${engine}`);
  const browser = await browserType.launch({ headless: true });
  try {
    for (const viewport of viewports) {
      const context = await browser.newContext({
        viewport,
        hasTouch: viewport.safeArea,
        isMobile: viewport.safeArea,
      });
      const page = await context.newPage();
      const diagnostics = diagnosticsFor(page);
      const name = `${engine}-${viewport.width}x${viewport.height}`;
      const result = { engine, viewport, status: "failed" };
      try {
        const url = new URL(baseUrl);
        if (viewport.safeArea) url.searchParams.set("safe", "iphone-landscape");
        const response = await page.goto(String(url), {
          waitUntil: "domcontentloaded",
          timeout,
        });
        invariant(response?.ok(), `navigation failed: HTTP ${response?.status()}`);
        await page.waitForFunction(() => Boolean(
          window.__ASHFALL_BATTLE_QA__?.prepareEquipmentRuntimeProof,
        ), undefined, { timeout });

        const standardControl = await runtimeProof(page, {
          mode: "standard",
          equipped: false,
          profile: "offense",
        });
        const standardEquipped = await runtimeProof(page, {
          mode: "standard",
          equipped: true,
          profile: "offense",
        });
        assertTacticalEffects(standardControl, standardEquipped, `${name} standard`);
        assertOffenseEffects(standardControl, standardEquipped, `${name} standard`);

        const survivalControl = await runtimeProof(page, {
          mode: "survival-new",
          equipped: false,
          profile: "durability",
        });
        const survivalNew = await runtimeProof(page, {
          mode: "survival-new",
          equipped: true,
          profile: "durability",
        });
        assertTacticalEffects(survivalControl, survivalNew, `${name} Survival new`);
        assertDurabilityEffects(survivalControl, survivalNew, `${name} Survival new`);
        invariant(
          Object.keys(survivalNew.formation.personalEquipmentByUnit).length === 1
            && survivalNew.formation.tacticalEquipmentIds.length === 2
            && Object.keys(survivalNew.formation.equipmentEnhancementLevels).length === 4,
          `${name}: Survival run-start snapshot is incomplete`,
        );

        const survivalResume = await runtimeProof(page, {
          mode: "survival-resume",
          equipped: true,
          profile: "durability",
        });
        invariant(survivalResume.serializedResume, `${name}: resume path was not serialized`);
        invariant(
          JSON.stringify(survivalResume.fighter) === JSON.stringify(survivalNew.fighter),
          `${name}: resumed fighter stats diverged from run-start snapshot`,
        );
        invariant(
          survivalResume.baseMaxHp === survivalNew.baseMaxHp
            && survivalResume.energy === survivalNew.energy
            && survivalResume.supportGauge === survivalNew.supportGauge,
          `${name}: resumed tactical state diverged from run-start snapshot`,
        );
        invariant(
          JSON.stringify(survivalResume.formation) === JSON.stringify(survivalNew.formation),
          `${name}: serialized checkpoint lost equipment snapshot data`,
        );

        await page.waitForTimeout(50);
        invariant(
          Object.values(diagnostics).every((entries) => entries.length === 0),
          `${name}: browser diagnostics failed ${JSON.stringify(diagnostics)}`,
        );
        result.status = "passed";
        result.standard = { control: standardControl, equipped: standardEquipped };
        result.survival = {
          control: survivalControl,
          newRun: survivalNew,
          resumed: survivalResume,
        };
        result.diagnostics = diagnostics;
      } catch (error) {
        result.error = error instanceof Error ? error.message : String(error);
        result.diagnostics = diagnostics;
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
  passed: results.filter(({ status }) => status === "passed").length,
  failed: results.filter(({ status }) => status !== "passed").length,
  results,
};
await writeFile(
  path.join(evidenceDir, "summary.json"),
  `${JSON.stringify(summary, null, 2)}\n`,
  "utf8",
);
console.log(JSON.stringify(summary, null, 2));
if (summary.failed > 0) process.exitCode = 1;
