import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { dismissInstallOffer } from "./pwa-gate-qa.mjs";

const baseUrl = new URL(process.env.V099_PRESENTATION_QA_BASE_URL ?? "http://127.0.0.1:4177/");
if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname)) {
  throw new Error(`0.9.9 presentation QA is local-only; refusing ${baseUrl}`);
}
const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href)
  : await import("playwright");
const browserTypes = { chromium: playwright.chromium, webkit: playwright.webkit };
const engines = (process.env.V099_PRESENTATION_QA_ENGINES ?? "chromium,webkit")
  .split(",").map((value) => value.trim()).filter(Boolean);
const viewports = [
  { width: 1280, height: 720 },
  { width: 844, height: 390 },
  { width: 844, height: 340 },
];
const modesFor = (viewport) => [
  { value: "high", density: 1 },
  { value: "auto", density: viewport.height <= 500 ? .72 : 1 },
  { value: "power-save", density: .48 },
];
const effects = [
  { kind: "boss-entrance", step: .45 },
  { kind: "boss-defeat", step: 1.1 },
  { kind: "small", step: .2 },
  { kind: "medium", step: .3 },
  { kind: "large", step: .42 },
];
const timeout = Math.max(10_000, Number(process.env.V099_PRESENTATION_QA_TIMEOUT_MS) || 30_000);
const evidenceDir = path.resolve(process.env.V099_PRESENTATION_QA_EVIDENCE_DIR ?? "outputs/v099-presentation-browser-smoke");
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
  page.on("requestfailed", (request) => diagnostics.requestFailures.push(`${request.url()} :: ${request.failure()?.errorText ?? "unknown"}`));
  page.on("response", (response) => {
    if (response.status() >= 400) diagnostics.httpErrors.push(`${response.status()} ${response.url()}`);
  });
  return diagnostics;
}

for (const engine of engines) {
  const browserType = browserTypes[engine];
  if (!browserType) throw new Error(`Unknown V099_PRESENTATION_QA_ENGINES value: ${engine}`);
  const browser = await browserType.launch({ headless: true });
  try {
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const diagnostics = diagnosticsFor(page);
      const name = `${engine}-${viewport.width}x${viewport.height}`;
      try {
        const url = new URL(baseUrl);
        url.search = new URLSearchParams({ qa: "mission", stage: "3", state: "start", safe: "iphone-landscape" }).toString();
        await page.goto(String(url), { waitUntil: "domcontentloaded", timeout });
        await dismissInstallOffer(page, { timeout });
        await page.waitForFunction(() => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().screen === "battle", undefined, { timeout });
        await page.waitForLoadState("networkidle", { timeout: Math.min(timeout, 12_000) });
        const baseline = await page.evaluate(() => {
          const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
          return {
            saveCore: JSON.stringify({
              caps: snapshot.caps,
              completedStageIds: snapshot.completedStageIds,
              unlockedStageIds: snapshot.unlockedStageIds,
              unitLevels: snapshot.unitLevels,
            }),
          };
        });
        const cases = [];
        for (const mode of modesFor(viewport)) {
          await page.evaluate((value) => window.__ASHFALL_BATTLE_QA__.setGraphicsQuality(value), mode.value);
          await page.waitForFunction((density) => Math.abs(window.__ASHFALL_BATTLE_QA__.getPerformanceSnapshot().graphicsProfile.effectDensity - density) < .001, mode.density, { timeout });
          for (const effect of effects) {
            const proofRun = await page.evaluate(({ kind, step }) => {
              const bridge = window.__ASHFALL_BATTLE_QA__;
              window.__ASHFALL_AUDIO_QA__?.resetCueRequests?.();
              bridge.prepareV099PresentationProof(kind);
              const before = bridge.getSnapshot();
              const proof = bridge.advanceV099PresentationProof(step);
              const after = bridge.getSnapshot();
              return {
                proof,
                before: { time: before.time, baseHp: before.baseHp, barricadeHp: before.barricadeHp, scrap: before.scrap },
                after: { time: after.time, baseHp: after.baseHp, barricadeHp: after.barricadeHp, scrap: after.scrap },
                audioRequests: window.__ASHFALL_AUDIO_QA__?.getCueRequests?.() ?? [],
              };
            }, effect);
            const { proof, before, after, audioRequests } = proofRun;
            invariant(proof.length === 1, `${name}/${mode.value}/${effect.kind}: one semantic effect was not retained`);
            invariant(proof[0].snapshot, `${name}/${mode.value}/${effect.kind}: render snapshot missing`);
            const snapshot = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
            invariant(snapshot.battlePresentation.semanticReceipts.length === 1, `${name}/${effect.kind}: semantic receipt drift`);
            invariant(after.time === before.time, `${name}/${effect.kind}: visual proof changed battle time`);
            invariant(after.baseHp === before.baseHp && after.barricadeHp === before.barricadeHp && after.scrap === before.scrap,
              `${name}/${effect.kind}: visual proof changed gameplay state`);
            invariant(audioRequests.length === 0, `${name}/${effect.kind}: PR3 visual requested audio ${JSON.stringify(audioRequests)}`);
            const saveCore = JSON.stringify({
              caps: snapshot.caps,
              completedStageIds: snapshot.completedStageIds,
              unlockedStageIds: snapshot.unlockedStageIds,
              unitLevels: snapshot.unitLevels,
            });
            invariant(saveCore === baseline.saveCore, `${name}/${effect.kind}: visual proof changed campaign save core`);
            const screenshotPath = path.join(evidenceDir, `${name}-${mode.value}-${effect.kind}.png`);
            await page.waitForTimeout(80);
            await page.screenshot({ path: screenshotPath });
            cases.push({ mode: mode.value, density: mode.density, kind: effect.kind, screenshotPath, snapshot: proof[0].snapshot });
          }
        }
        await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setGraphicsQuality("high"));
        await page.waitForFunction(() => window.__ASHFALL_BATTLE_QA__.getPerformanceSnapshot().graphicsProfile.effectDensity === 1, undefined, { timeout });
        const drumStates = [];
        drumStates.push(await page.evaluate(() => {
          window.__ASHFALL_AUDIO_QA__?.resetCueRequests?.();
          return window.__ASHFALL_BATTLE_QA__.prepareV099DrumArrivalProof();
        }));
        drumStates.push(await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.advanceV099DrumArrivalProof(.62)));
        drumStates.push(await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.advanceV099DrumArrivalProof(.12)));
        for (const [index, state] of drumStates.entries()) {
          invariant(state, `${name}: drum state ${index} missing`);
          invariant(index === 0 ? state.phase === "dropping" && state.targetable === false : true,
            `${name}: drum started active`);
          invariant(index === 1 ? state.phase === "impact" && state.targetable === false : true,
            `${name}: drum skipped impact boundary`);
        }
        await page.waitForTimeout(80);
        invariant(await page.evaluate(() => (window.__ASHFALL_AUDIO_QA__?.getCueRequests?.() ?? []).length) === 0,
          `${name}: drum arrival visual requested audio`);
        const drumScreenshot = path.join(evidenceDir, `${name}-drum-impact.png`);
        await page.screenshot({ path: drumScreenshot });
        const crawlerCases = [];
        for (const state of ["stored", "firing"]) {
          await page.evaluate((value) => {
            window.__ASHFALL_AUDIO_QA__?.resetCueRequests?.();
            return window.__ASHFALL_BATTLE_QA__.prepareCrawlerVfxProof(value);
          }, state);
          await page.waitForTimeout(80);
          const snapshot = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
          invariant(snapshot.crawlerGrounding.wheelCompression.length === 4, `${name}/${state}: CRAWLER wheel grounding missing`);
          invariant(snapshot.crawlerGrounding.roofHatchOpen === (state === "firing"), `${name}/${state}: CRAWLER hatch state mismatch`);
          invariant(await page.evaluate(() => (window.__ASHFALL_AUDIO_QA__?.getCueRequests?.() ?? []).length) === 0,
            `${name}/${state}: CRAWLER visual requested audio`);
          const screenshotPath = path.join(evidenceDir, `${name}-crawler-${state}.png`);
          await page.screenshot({ path: screenshotPath });
          crawlerCases.push({ state, grounding: snapshot.crawlerGrounding, screenshotPath });
        }
        invariant(diagnostics.consoleErrors.length === 0, `${name}: console errors ${JSON.stringify(diagnostics.consoleErrors)}`);
        invariant(diagnostics.pageErrors.length === 0, `${name}: page errors ${JSON.stringify(diagnostics.pageErrors)}`);
        invariant(diagnostics.httpErrors.length === 0, `${name}: HTTP errors ${JSON.stringify(diagnostics.httpErrors)}`);
        invariant(diagnostics.requestFailures.length === 0, `${name}: request failures ${JSON.stringify(diagnostics.requestFailures)}`);
        results.push({ name, status: "passed", cases, drumStates, drumScreenshot, crawlerCases, diagnostics });
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
if (failures.length > 0) throw new Error(`0.9.9 presentation browser smoke failed (${failures.length}/${results.length}): ${reportPath}`);
console.log(`0.9.9 presentation browser smoke passed (${results.length}/${results.length}): ${reportPath}`);
