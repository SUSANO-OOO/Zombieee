import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

if (!process.env.BOSS_QA_BASE_URL) throw new Error("BOSS_QA_BASE_URL is required");
const baseUrl = new URL(process.env.BOSS_QA_BASE_URL);
if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname)) {
  throw new Error(`Kurome prototype QA is local-only: ${baseUrl}`);
}

const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href)
  : await import("playwright");
const engines = (process.env.KUROME_QA_ENGINES ?? "chromium,webkit")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const browserTypes = { chromium: playwright.chromium, webkit: playwright.webkit };
const viewports = [
  { width: 1280, height: 720 },
  { width: 844, height: 390 },
  { width: 844, height: 340 },
];
const evidenceDir = path.resolve(process.env.KUROME_QA_EVIDENCE_DIR ?? "outputs/kurome-prototype-browser-smoke");
const timeout = Math.max(8_000, Number(process.env.KUROME_QA_TIMEOUT_MS) || 35_000);
const results = [];
await mkdir(evidenceDir, { recursive: true });

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function qaUrl() {
  const url = new URL(baseUrl);
  url.search = new URLSearchParams({
    qa: "mission",
    stage: "3",
    state: "start",
    safe: "iphone-landscape",
  }).toString();
  return String(url);
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

async function evidence(page) {
  return page.evaluate(() => {
    const bridge = window.__ASHFALL_BATTLE_QA__;
    const proof = bridge.getBossFoundationProof("kurome");
    const snapshot = bridge.getSnapshot();
    const bossHud = document.querySelector(".boss-hud");
    const field = document.querySelector(".battlefield");
    const hudRect = bossHud?.getBoundingClientRect() ?? null;
    const fieldRect = field?.getBoundingClientRect() ?? null;
    const worldScale = Number(field?.dataset.worldScale) || 1;
    const worldOffsetX = Number(field?.dataset.worldOffsetX) || 0;
    const worldOffsetY = Number(field?.dataset.worldOffsetY) || 0;
    return {
      proof,
      snapshot,
      bossHudText: bossHud?.textContent ?? "",
      hudRect: hudRect ? {
        left: hudRect.left,
        top: hudRect.top,
        right: hudRect.right,
        bottom: hudRect.bottom,
        width: hudRect.width,
        height: hudRect.height,
      } : null,
      fieldRect: fieldRect ? {
        left: fieldRect.left,
        top: fieldRect.top,
        right: fieldRect.right,
        bottom: fieldRect.bottom,
      } : null,
      humanClientPoint: fieldRect && proof?.humanX !== null && proof?.humanY !== null ? {
        x: fieldRect.left + worldOffsetX + proof.humanX * worldScale,
        y: fieldRect.top + worldOffsetY + (proof.humanY - 30) * worldScale,
      } : null,
      dimensions: {
        width: window.innerWidth,
        height: window.innerHeight,
        documentWidth: document.documentElement.scrollWidth,
        documentHeight: document.documentElement.scrollHeight,
      },
    };
  });
}

for (const engine of engines) {
  const browserType = browserTypes[engine];
  if (!browserType) throw new Error(`Unknown KUROME_QA_ENGINES value: ${engine}`);
  const browser = await browserType.launch({ headless: true });
  try {
    for (const viewport of viewports) {
      const name = `${engine}-kurome-${viewport.width}x${viewport.height}`;
      const context = await browser.newContext({ viewport, hasTouch: true });
      const page = await context.newPage();
      const diagnostics = diagnosticsFor(page);
      try {
        await page.goto(qaUrl(), { waitUntil: "domcontentloaded", timeout });
        await page.waitForFunction(
          () => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().screen === "battle",
          undefined,
          { timeout },
        );
        await page.waitForLoadState("networkidle", { timeout: Math.min(timeout, 10_000) });
        const setup = await page.evaluate(() => (
          window.__ASHFALL_BATTLE_QA__.prepareBossFoundationProof("kurome")
        ));
        await page.waitForFunction(() => {
          const proof = window.__ASHFALL_BATTLE_QA__?.getBossFoundationProof?.("kurome");
          return proof?.bossId && proof.gateEntering && !proof.combatReady;
        }, undefined, { timeout });
        const entry = await evidence(page);
        invariant(entry.proof.prototypeStatus === "producer-approved", `${name}: producer approval lost`);
        invariant(entry.proof.entryMode === "right-edge-outside", `${name}: wrong entry profile`);
        invariant(entry.proof.hud === null && entry.proof.telegraph === null, `${name}: pre-entry combat leak`);
        invariant(entry.proof.bossHp === entry.proof.bossMaxHp, `${name}: entry damage leak`);
        invariant(entry.proof.lastEntrance?.warningLabel === setup.warningLabel, `${name}: warning mismatch`);
        const entryOutsidePath = path.join(evidenceDir, `${name}-right-edge-outside.png`);
        await page.screenshot({ path: entryOutsidePath, fullPage: false });
        await page.evaluate((bossId) => (
          window.__ASHFALL_BATTLE_QA__.accelerateBossFoundationEntry(bossId)
        ), entry.proof.bossId);
        await page.waitForFunction(() => {
          const proof = window.__ASHFALL_BATTLE_QA__?.getBossFoundationProof?.("kurome");
          return proof?.gateEntering
            && !proof.combatReady
            && proof.bossX > proof.combatReadyX
            && proof.bossX <= proof.combatReadyX + 10;
        }, undefined, { timeout });
        const thresholdBefore = await evidence(page);
        invariant(thresholdBefore.proof.hud === null && thresholdBefore.proof.telegraph === null,
          `${name}: pre-threshold combat leak`);
        invariant(thresholdBefore.proof.bossX > thresholdBefore.proof.combatReadyX,
          `${name}: pre-threshold boss already ready`);
        const thresholdBeforePath = path.join(evidenceDir, `${name}-combat-ready-before.png`);
        await page.screenshot({ path: thresholdBeforePath, fullPage: false });
        await page.waitForFunction(() => {
          const proof = window.__ASHFALL_BATTLE_QA__?.getBossFoundationProof?.("kurome");
          return proof?.combatReady && !proof.gateEntering;
        }, undefined, { timeout });
        await page.waitForFunction(() => (
          document.querySelector(".boss-hud")?.textContent?.includes("クロメ")
        ), undefined, { timeout });
        await page.waitForFunction(() => (
          window.__ASHFALL_BATTLE_QA__?.getBossFoundationProof?.("kurome")?.banner === null
        ), undefined, { timeout });
        const ready = await evidence(page);
        invariant(ready.proof.hud?.enemyKind === "kurome", `${name}: boss HUD absent`);
        invariant(ready.bossHudText.includes("クロメ"), `${name}: approved display name absent`);
        invariant(ready.proof.spriteLoadedWidth === 3360, `${name}: candidate atlas unavailable`);
        const bodyMinimum = viewport.width === 844 ? 143 : 130;
        const bodyMaximum = viewport.width === 844 ? 149 : 136;
        invariant(
          ready.proof.renderedBodyHeight >= bodyMinimum && ready.proof.renderedBodyHeight <= bodyMaximum,
          `${name}: body height ${ready.proof.renderedBodyHeight} outside ${bodyMinimum}-${bodyMaximum}`,
        );
        invariant(Math.abs(ready.proof.footAnchorDelta) <= .01, `${name}: foot anchor moved`);
        invariant(Math.abs(ready.proof.renderedVisibleRect?.bottom - ready.proof.bossY) <= .01,
          `${name}: visible feet do not meet ground`);
        invariant(ready.proof.renderedVisibleRect?.right <= 960,
          `${name}: combat-ready before full body entrance`);
        const readyPath = path.join(evidenceDir, `${name}-combat-ready-after.png`);
        await page.screenshot({ path: readyPath, fullPage: false });

        const challenge = await page.evaluate(({ bossId, humanId }) => (
          window.__ASHFALL_BATTLE_QA__.startBossFoundationBarrierChallenge(bossId, humanId)
        ), { bossId: ready.proof.bossId, humanId: ready.proof.humanId });
        invariant(challenge, `${name}: barrier setup failed`);
        await page.waitForFunction(() => (
          window.__ASHFALL_BATTLE_QA__?.getBossFoundationProof?.("kurome")?.barrier?.attempted
        ), undefined, { timeout });
        const barrier = await evidence(page);
        invariant(barrier.proof.barrier?.blocked === true, `${name}: body pass-through`);

        const armedEvade = await page.evaluate(({ bossId, humanId }) => (
          window.__ASHFALL_BATTLE_QA__.armBossFoundationTelegraph(bossId, humanId)
        ), { bossId: ready.proof.bossId, humanId: ready.proof.humanId });
        invariant(armedEvade?.warningSeconds === 1.25, `${name}: warning timing mismatch`);
        await page.waitForFunction(() => {
          const telegraph = window.__ASHFALL_BATTLE_QA__?.getBossFoundationProof?.("kurome")?.telegraph;
          return telegraph?.kind === "tracking-ray"
            && telegraph.locked === false
            && telegraph.remainingSeconds > .43;
        }, undefined, { timeout });
        const trackingEvade = await evidence(page);
        invariant(trackingEvade.proof.telegraph.counterplay.includes("離脱"), `${name}: counterplay absent`);
        const humanBeforeEvade = trackingEvade.proof.humanHp;
        invariant(trackingEvade.humanClientPoint, `${name}: player touch target unavailable`);
        await page.touchscreen.tap(trackingEvade.humanClientPoint.x, trackingEvade.humanClientPoint.y);
        await page.waitForFunction(() => (
          window.__ASHFALL_BATTLE_QA__?.getBossFoundationProof?.("kurome")?.lastCounterplay?.input
            === "battlefield-pointer"
        ), undefined, { timeout });
        const evadeInputPath = path.join(evidenceDir, `${name}-touch-evade.png`);
        await page.screenshot({ path: evadeInputPath, fullPage: false });
        await page.waitForFunction(() => (
          window.__ASHFALL_BATTLE_QA__?.getBossFoundationProof?.("kurome")?.stationPhase === "recovery"
        ), undefined, { timeout });
        const evaded = await evidence(page);
        invariant(evaded.proof.humanHp === humanBeforeEvade, `${name}: leaving locked ray did not evade`);
        invariant(evaded.proof.visionDisruptedRemaining === 0, `${name}: evasion applied interference`);
        invariant(evaded.proof.lastCounterplay?.kind === "kurome-emergency-evade",
          `${name}: player counterplay receipt absent`);

        await page.waitForFunction(() => (
          window.__ASHFALL_BATTLE_QA__?.getBossFoundationProof?.("kurome")?.stationPhase === "idle"
        ), undefined, { timeout });
        const rearm = await page.evaluate(({ bossId, humanId }) => (
          window.__ASHFALL_BATTLE_QA__.armBossFoundationTelegraph(bossId, humanId)
        ), { bossId: ready.proof.bossId, humanId: ready.proof.humanId });
        invariant(rearm?.warningSeconds === 1.25, `${name}: second arming failed`);
        await page.waitForFunction(() => (
          window.__ASHFALL_BATTLE_QA__?.getBossFoundationProof?.("kurome")?.telegraph?.locked === true
        ), undefined, { timeout });
        const telegraphPath = path.join(evidenceDir, `${name}-telegraph.png`);
        await page.screenshot({ path: telegraphPath, fullPage: false });
        const beforeHit = (await evidence(page)).proof.humanHp;
        await page.waitForFunction(() => {
          const proof = window.__ASHFALL_BATTLE_QA__?.getBossFoundationProof?.("kurome");
          return proof?.visionDisruptedRemaining > 0 && proof?.humanHp < 1000;
        }, undefined, { timeout });
        const hit = await evidence(page);
        invariant(hit.proof.humanHp < beforeHit, `${name}: held target took no damage`);
        invariant(hit.proof.visionDisruptedRemaining > 0, `${name}: localized interference absent`);
        const hitPath = path.join(evidenceDir, `${name}-hit.png`);
        await page.screenshot({ path: hitPath, fullPage: false });

        const { hudRect, dimensions } = hit;
        const safeInset = viewport.width === 844 ? 44 : 0;
        invariant(hudRect?.width > 0 && hudRect?.height > 0, `${name}: HUD invisible`);
        invariant(hudRect.left >= safeInset - 1 && hudRect.right <= viewport.width - safeInset + 1,
          `${name}: HUD entered safe area`);
        invariant(dimensions.documentWidth <= viewport.width && dimensions.documentHeight <= viewport.height,
          `${name}: page overflow`);
        invariant(hit.snapshot.geometry?.offFloorCount === 0, `${name}: off-floor fighter`);
        invariant(diagnostics.consoleErrors.length === 0, `${name}: console ${diagnostics.consoleErrors}`);
        invariant(diagnostics.pageErrors.length === 0, `${name}: page ${diagnostics.pageErrors}`);
        invariant(diagnostics.requestFailures.length === 0, `${name}: request ${diagnostics.requestFailures}`);
        invariant(diagnostics.httpErrors.length === 0, `${name}: HTTP ${diagnostics.httpErrors}`);
        results.push({
          name,
          status: "passed",
          renderedBodyHeight: ready.proof.renderedBodyHeight,
          entryMode: entry.proof.entryMode,
          inputMode: "touch",
          barrier: barrier.proof.barrier,
          telegraph: trackingEvade.proof.telegraph,
          counterplay: evaded.proof.lastCounterplay,
          evadeDamage: humanBeforeEvade - evaded.proof.humanHp,
          hitDamage: beforeHit - hit.proof.humanHp,
          interferenceSeconds: hit.proof.visionDisruptedRemaining,
          entryOutsidePath,
          thresholdBeforePath,
          readyPath,
          evadeInputPath,
          telegraphPath,
          hitPath,
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
if (failures.length > 0) {
  throw new Error(`Kurome prototype browser smoke failed (${failures.length}/${results.length}): ${reportPath}`);
}
console.log(`Kurome prototype browser smoke passed (${results.length}/${results.length}): ${reportPath}`);
