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
const availableViewports = [
  { width: 1280, height: 720 },
  { width: 844, height: 390 },
  { width: 844, height: 340 },
];
const requestedViewportKeys = new Set((process.env.V099_PRESENTATION_QA_VIEWPORTS ?? "1280x720,844x390,844x340")
  .split(",").map((value) => value.trim()).filter(Boolean));
const viewports = availableViewports.filter(({ width, height }) => requestedViewportKeys.has(`${width}x${height}`));
if (viewports.length !== requestedViewportKeys.size) {
  throw new Error(`Unknown V099_PRESENTATION_QA_VIEWPORTS value: ${[...requestedViewportKeys].join(", ")}`);
}
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
const bossDefeatKeyframes = [
  { elapsed: .05, stage: "stagger", majorBurstActive: false },
  { elapsed: .30, stage: "small-chain", majorBurstActive: false },
  { elapsed: .90, stage: "medium", majorBurstActive: false },
  { elapsed: 1.08, stage: "major", majorBurstActive: true },
  { elapsed: 1.70, stage: "residue", majorBurstActive: true },
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

async function clientPointForWorld(page, point) {
  const box = await page.locator("canvas.battlefield").boundingBox();
  invariant(box, "battlefield canvas has no display box");
  const scale = Math.max(box.width / 960, box.height / 540);
  return {
    x: box.x + (box.width - 960 * scale) / 2 + point.x * scale,
    y: box.y + (box.height - 540 * scale) / 2 + point.y * scale,
  };
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
        const bossKeyframes = [];
        for (const keyframe of bossDefeatKeyframes) {
          const priorRenderFrames = await page.evaluate(
            () => window.__ASHFALL_BATTLE_QA__.getPerformanceSnapshot().renderFrames,
          );
          const proof = await page.evaluate((elapsed) => {
            const bridge = window.__ASHFALL_BATTLE_QA__;
            bridge.prepareV099PresentationProof("boss-defeat");
            return bridge.advanceV099PresentationProof(elapsed)[0];
          }, keyframe.elapsed);
          invariant(proof?.snapshot?.bossStage === keyframe.stage,
            `${name}/boss@${keyframe.elapsed}: expected ${keyframe.stage}, got ${proof?.snapshot?.bossStage}`);
          invariant(proof.snapshot.majorBurstActive === keyframe.majorBurstActive,
            `${name}/boss@${keyframe.elapsed}: major burst timing drift`);
          await page.waitForFunction(
            (prior) => window.__ASHFALL_BATTLE_QA__.getPerformanceSnapshot().renderFrames > prior,
            priorRenderFrames,
            { timeout },
          );
          const screenshotPath = path.join(evidenceDir, `${name}-boss-defeat-${keyframe.elapsed.toFixed(2)}s.png`);
          await page.screenshot({ path: screenshotPath });
          bossKeyframes.push({ ...keyframe, snapshot: proof.snapshot, screenshotPath });
        }
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

        await page.evaluate(() => window.__ASHFALL_AUDIO_QA__?.resetCueRequests?.());
        const crawlerInputPrepared = await page.evaluate(
          () => window.__ASHFALL_BATTLE_QA__.prepareV099CrawlerInputProof(),
        );
        invariant(crawlerInputPrepared.ability.phase === "ready", `${name}: production G path was not ready`);
        await page.keyboard.press("g");
        await page.waitForFunction(
          () => window.__ASHFALL_BATTLE_QA__.getSnapshot().crawlerAbility.phase === "deploying",
          undefined,
          { timeout, polling: 5 },
        );
        const crawlerPhaseScreenshots = {};
        crawlerPhaseScreenshots.deploying = path.join(evidenceDir, `${name}-crawler-input-deploying.png`);
        await page.screenshot({ path: crawlerPhaseScreenshots.deploying });
        await page.waitForFunction(
          () => window.__ASHFALL_BATTLE_QA__.getSnapshot().crawlerAbility.phase === "firing",
          undefined,
          { timeout, polling: 5 },
        );
        crawlerPhaseScreenshots.firing = path.join(evidenceDir, `${name}-crawler-input-firing.png`);
        await page.screenshot({ path: crawlerPhaseScreenshots.firing });
        await page.waitForFunction(
          () => window.__ASHFALL_BATTLE_QA__.getSnapshot().crawlerAbility.phase === "recovering",
          undefined,
          { timeout, polling: 5 },
        );
        crawlerPhaseScreenshots.recovering = path.join(evidenceDir, `${name}-crawler-input-recovering.png`);
        await page.screenshot({ path: crawlerPhaseScreenshots.recovering });
        await page.waitForFunction(
          () => window.__ASHFALL_BATTLE_QA__.getSnapshot().crawlerAbility.phase === "cooldown"
            && window.__ASHFALL_BATTLE_QA__.getSnapshot().pendingWeaponHits.length === 0,
          undefined,
          { timeout, polling: 5 },
        );
        const crawlerInputAfter = await page.evaluate(() => ({
          snapshot: window.__ASHFALL_BATTLE_QA__.getSnapshot(),
          audioRequests: window.__ASHFALL_AUDIO_QA__?.getCueRequests?.() ?? [],
        }));
        for (const target of crawlerInputPrepared.targets) {
          const afterTarget = crawlerInputAfter.snapshot.fighters.find(({ id }) => id === target.id);
          invariant(afterTarget?.hp === target.initialHp - 52,
            `${name}: production G damage was not applied exactly once to ${target.kind}`);
        }
        for (const cueId of ["weapon-barrage"]) {
          invariant(crawlerInputAfter.audioRequests.filter((request) => request.cueId === cueId).length === 1,
            `${name}: production G cue ${cueId} was not requested exactly once: ${JSON.stringify(crawlerInputAfter.audioRequests)}`);
        }

        await page.evaluate(() => window.__ASHFALL_AUDIO_QA__?.resetCueRequests?.());
        const airstrikePrepared = await page.evaluate(
          () => window.__ASHFALL_BATTLE_QA__.prepareV099AirstrikeInputProof(),
        );
        await page.keyboard.press("q");
        invariant(await page.locator("button.support-btn.airstrike").evaluate((button) => button.classList.contains("selected")),
          `${name}: Q did not select airstrike`);
        const airstrikeClient = await clientPointForWorld(page, {
          x: airstrikePrepared.targetX,
          y: airstrikePrepared.targetY,
        });
        await page.mouse.click(airstrikeClient.x, airstrikeClient.y);
        const airstrikePhases = [];
        for (const phase of ["radio", "targeting", "inbound", "impact", "returning", "idle"]) {
          await page.waitForFunction(
            (expected) => window.__ASHFALL_BATTLE_QA__.getSnapshot().airstrike.phase === expected,
            phase,
            { timeout, polling: 5 },
          );
          if (phase === "inbound") {
            await page.waitForTimeout(260);
            invariant((await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot().airstrike.phase)) === "inbound",
              `${name}: airstrike inbound visual window ended too early`);
          }
          const snapshot = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
          const screenshotPath = ["radio", "inbound", "impact"].includes(phase)
            ? path.join(evidenceDir, `${name}-airstrike-input-${phase}.png`)
            : null;
          if (screenshotPath) await page.screenshot({ path: screenshotPath });
          airstrikePhases.push({ phase, runtime: snapshot.airstrike, screenshotPath });
        }
        const airstrikeInputAfter = await page.evaluate(() => ({
          snapshot: window.__ASHFALL_BATTLE_QA__.getSnapshot(),
          audioRequests: window.__ASHFALL_AUDIO_QA__?.getCueRequests?.() ?? [],
        }));
        invariant(airstrikeInputAfter.snapshot.supportGauge === airstrikePrepared.supportGauge - 60,
          `${name}: production Q gauge changed by an unexpected amount`);
        for (const target of airstrikePrepared.targets) {
          const afterTarget = airstrikeInputAfter.snapshot.fighters.find(({ id }) => id === target.id);
          invariant(afterTarget?.hp === target.initialHp - 145,
            `${name}: production airstrike damage was not applied exactly once to ${target.kind}`);
        }
        for (const cueId of ["ui-select", "support-airstrike", "support-explosion"]) {
          invariant(airstrikeInputAfter.audioRequests.filter((request) => request.cueId === cueId).length === 1,
            `${name}: production airstrike cue ${cueId} was not requested exactly once: ${JSON.stringify(airstrikeInputAfter.audioRequests)}`);
        }

        for (const kind of ["brute", "brawler"]) {
          await page.locator(`button.unit-card[data-kind="${kind}"]`).click();
        }
        await page.waitForFunction(
          () => [...document.querySelectorAll("button.unit-card[aria-disabled='true']")]
            .some((card) => card.getAttribute("data-block-reason") === "指揮不足"),
          undefined,
          { timeout },
        );
        const disabledReadability = await page.evaluate(() => {
          const objective = document.querySelector(".stats-strip .objective");
          const objectiveRect = objective?.getBoundingClientRect();
          const objectiveRange = document.createRange();
          if (objective) objectiveRange.selectNodeContents(objective);
          const objectiveTextRect = objective ? objectiveRange.getBoundingClientRect() : null;
          return ({
          cards: [...document.querySelectorAll("button.unit-card[aria-disabled='true']")]
            .map((card) => {
              const state = card.querySelector(".card-state");
              const rect = state?.getBoundingClientRect();
              return {
                kind: card.getAttribute("data-kind"),
                reason: card.getAttribute("data-block-reason"),
                stateText: state?.textContent?.trim() ?? null,
                stateFontSize: state ? Number.parseFloat(getComputedStyle(state).fontSize) : null,
                stateFits: state ? state.scrollWidth <= state.clientWidth + 1 : null,
                stateRect: rect ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom } : null,
              };
            }),
          support: [...document.querySelectorAll("button.support-btn")].map((button) => {
            const detail = button.querySelector("small");
            const buttonRect = button.getBoundingClientRect();
            const detailRect = detail?.getBoundingClientRect();
            return {
              label: button.querySelector("b")?.textContent?.trim() ?? null,
              reason: detail?.textContent?.trim() ?? null,
              fontSize: detail ? Number.parseFloat(getComputedStyle(detail).fontSize) : null,
              contained: detailRect
                ? detailRect.left >= buttonRect.left - 1 && detailRect.right <= buttonRect.right + 1
                  && detailRect.top >= buttonRect.top - 1 && detailRect.bottom <= buttonRect.bottom + 1
              : false,
            };
          }),
          objective: objective && objectiveRect && objectiveTextRect ? {
            text: objective.textContent?.trim() ?? "",
            fontSize: Number.parseFloat(getComputedStyle(objective).fontSize),
            clientWidth: objective.clientWidth,
            scrollWidth: objective.scrollWidth,
            rect: { left: objectiveRect.left, right: objectiveRect.right },
            textRect: { left: objectiveTextRect.left, right: objectiveTextRect.right },
            viewportWidth: window.innerWidth,
          } : null,
        });
        });
        const commandBlockedCards = disabledReadability.cards.filter(({ reason }) => reason === "指揮不足");
        invariant(commandBlockedCards.length > 0,
          `${name}: actual command-insufficient input produced no disabled card`);
        invariant(commandBlockedCards.every(({ stateText, stateFontSize, stateFits }) => (
          stateText === "指揮不足" && stateFontSize >= 12 && stateFits === true
        )), `${name}: disabled unit reason is clipped or undersized: ${JSON.stringify(commandBlockedCards)}`);
        invariant(disabledReadability.support.every(({ fontSize, contained }) => fontSize >= 12 && contained),
          `${name}: support reason is clipped or undersized: ${JSON.stringify(disabledReadability.support)}`);
        invariant(disabledReadability.objective
            && disabledReadability.objective.fontSize >= 14
            && disabledReadability.objective.scrollWidth <= disabledReadability.objective.clientWidth + 1
            && disabledReadability.objective.textRect.left >= disabledReadability.objective.rect.left - 1
            && disabledReadability.objective.textRect.right <= disabledReadability.objective.rect.right + 1
            && disabledReadability.objective.textRect.left >= -1
            && disabledReadability.objective.textRect.right <= disabledReadability.objective.viewportWidth + 1,
          `${name}: objective text is clipped or undersized: ${JSON.stringify(disabledReadability.objective)}`);
        const disabledReadabilityScreenshot = path.join(evidenceDir, `${name}-mobile-disabled-readability.png`);
        await page.screenshot({ path: disabledReadabilityScreenshot });

        await page.evaluate(() => window.__ASHFALL_AUDIO_QA__?.resetCueRequests?.());
        const terminalPrepared = await page.evaluate(
          () => window.__ASHFALL_BATTLE_QA__.prepareV099TerminalBossDefeatProof(),
        );
        await page.waitForFunction(
          () => {
            const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
            return snapshot.over === true
              && snapshot.resultPresented === false
              && snapshot.battlePresentation.effects.some((effect) => effect.kind === "boss-defeat");
          },
          undefined,
          { timeout, polling: 5 },
        );
        const terminalStart = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
        await page.waitForTimeout(900);
        const terminalMid = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
        invariant(terminalMid.screen === "battle" && terminalMid.resultPresented === false,
          `${name}: terminal boss result mounted before the 2.6s sequence completed`);
        invariant(terminalMid.time === terminalStart.time,
          `${name}: gameplay time advanced during terminal boss presentation hold`);
        invariant(terminalMid.battlePresentation.effects.some((effect) => effect.kind === "boss-defeat" && effect.elapsed > 0),
          `${name}: terminal boss presentation did not advance under its hold`);
        const terminalScreenshot = path.join(evidenceDir, `${name}-terminal-boss-hold.png`);
        await page.screenshot({ path: terminalScreenshot });
        await page.waitForFunction(
          () => window.__ASHFALL_BATTLE_QA__.getSnapshot().resultPresented === true,
          undefined,
          { timeout: Math.max(timeout, 8_000), polling: 5 },
        );
        const terminalEnd = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
        invariant(terminalEnd.time === terminalStart.time,
          `${name}: gameplay resumed before terminal result publication`);
        invariant(diagnostics.consoleErrors.length === 0, `${name}: console errors ${JSON.stringify(diagnostics.consoleErrors)}`);
        invariant(diagnostics.pageErrors.length === 0, `${name}: page errors ${JSON.stringify(diagnostics.pageErrors)}`);
        invariant(diagnostics.httpErrors.length === 0, `${name}: HTTP errors ${JSON.stringify(diagnostics.httpErrors)}`);
        invariant(diagnostics.requestFailures.length === 0, `${name}: request failures ${JSON.stringify(diagnostics.requestFailures)}`);
        results.push({
          name,
          status: "passed",
          cases,
          bossKeyframes,
          drumStates,
          drumScreenshot,
          crawlerCases,
          crawlerInput: { prepared: crawlerInputPrepared, after: crawlerInputAfter, screenshots: crawlerPhaseScreenshots },
          airstrikeInput: { prepared: airstrikePrepared, phases: airstrikePhases, after: airstrikeInputAfter },
          disabledReadability: { ...disabledReadability, screenshotPath: disabledReadabilityScreenshot },
          terminalBoss: { prepared: terminalPrepared, start: terminalStart, mid: terminalMid, end: terminalEnd, terminalScreenshot },
          diagnostics,
        });
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
