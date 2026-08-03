import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { dismissInstallOffer } from "./pwa-gate-qa.mjs";

if (!process.env.BOSS_QA_BASE_URL) throw new Error("BOSS_QA_BASE_URL is required");
const baseUrl = new URL(process.env.BOSS_QA_BASE_URL);
if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname)) {
  throw new Error(`Anomaly boss QA is local-only: ${baseUrl}`);
}

const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href)
  : await import("playwright");
const browserTypes = { chromium: playwright.chromium, webkit: playwright.webkit };
const engines = (process.env.BOSS_ANOMALY_QA_ENGINES ?? "chromium,webkit")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const viewports = [
  { width: 1280, height: 720 },
  { width: 844, height: 390 },
  { width: 844, height: 340 },
];
const bossCases = [
  {
    kind: "ooguchi",
    name: "オオグチ",
    stageId: "stage-civic-archive-route",
    telegraphKind: "lane-rectangle",
    standardBodyHeight: 121,
    compactBodyHeight: 132,
  },
  {
    kind: "gairen",
    name: "ガイレン",
    stageId: "stage-coastal-link-bridge",
    telegraphKind: "shell-sweep",
    standardBodyHeight: 152,
    compactBodyHeight: 168,
  },
  {
    kind: "futago",
    name: "フタゴ",
    stageId: "stage-estuary-floodgate-seal",
    telegraphKind: "cross-strike",
    standardBodyHeight: 146,
    compactBodyHeight: 161,
  },
];
const evidenceDir = path.resolve(
  process.env.BOSS_ANOMALY_QA_EVIDENCE_DIR ?? "outputs/boss-anomalies-browser-smoke",
);
const timeout = Math.max(8_000, Number(process.env.BOSS_ANOMALY_QA_TIMEOUT_MS) || 35_000);
const results = [];
await mkdir(evidenceDir, { recursive: true });

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function qaUrl(stageId) {
  const url = new URL(baseUrl);
  url.search = new URLSearchParams({
    qa: "mission",
    stage: stageId,
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

function rectanglesOverlap(left, right) {
  return left.left < right.right - 1
    && left.right > right.left + 1
    && left.top < right.bottom - 1
    && left.bottom > right.top + 1;
}

async function evidence(page, kind) {
  return page.evaluate((bossKind) => {
    const bridge = window.__ASHFALL_BATTLE_QA__;
    const proof = bridge.getBossFoundationProof(bossKind);
    const snapshot = bridge.getSnapshot();
    const bossHud = document.querySelector(".boss-hud");
    const hudRect = bossHud?.getBoundingClientRect() ?? null;
    const visibleHudRects = [...document.querySelectorAll(
      ".top-hud, .health-hud, .crawler-alert, .battle-barks, .survival-hud",
    )]
      .filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          className: element.className,
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
        };
      });
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
      visibleHudRects,
      dimensions: {
        width: window.innerWidth,
        height: window.innerHeight,
        documentWidth: document.documentElement.scrollWidth,
        documentHeight: document.documentElement.scrollHeight,
      },
    };
  }, kind);
}

for (const engine of engines) {
  const browserType = browserTypes[engine];
  if (!browserType) throw new Error(`Unknown BOSS_ANOMALY_QA_ENGINES value: ${engine}`);
  const browser = await browserType.launch({ headless: true });
  try {
    for (const viewport of viewports) {
      for (const bossCase of bossCases) {
        const caseName = `${engine}-${bossCase.kind}-${viewport.width}x${viewport.height}`;
        const context = await browser.newContext({ viewport, hasTouch: true });
        const page = await context.newPage();
        const diagnostics = diagnosticsFor(page);
        try {
          await page.goto(qaUrl(bossCase.stageId), { waitUntil: "domcontentloaded", timeout });
          await dismissInstallOffer(page, { timeout });
          await page.waitForFunction(
            () => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().screen === "battle",
            undefined,
            { timeout },
          );
          await page.waitForLoadState("networkidle", { timeout: Math.min(timeout, 10_000) });
          const setup = await page.evaluate(
            (kind) => window.__ASHFALL_BATTLE_QA__.prepareBossFoundationProof(kind),
            bossCase.kind,
          );
          await page.waitForFunction((kind) => {
            const proof = window.__ASHFALL_BATTLE_QA__?.getBossFoundationProof?.(kind);
            return proof?.bossId && proof.gateEntering && !proof.combatReady;
          }, bossCase.kind, { timeout });
          const entry = await evidence(page, bossCase.kind);
          invariant(entry.snapshot.stageId === bossCase.stageId, `${caseName}: wrong battlefield`);
          invariant(entry.proof.prototypeStatus === "producer-approved", `${caseName}: approval lost`);
          invariant(entry.proof.entryMode === "right-edge-outside", `${caseName}: wrong entry profile`);
          invariant(entry.proof.hud === null && entry.proof.telegraph === null, `${caseName}: pre-entry combat leak`);
          invariant(entry.proof.bossHp === entry.proof.bossMaxHp, `${caseName}: entry damage leak`);
          invariant(entry.proof.lastEntrance?.warningLabel === setup.warningLabel, `${caseName}: warning mismatch`);
          const entryPath = path.join(evidenceDir, `${caseName}-entry.png`);
          await page.screenshot({ path: entryPath, fullPage: false });

          await page.evaluate(
            (bossId) => window.__ASHFALL_BATTLE_QA__.accelerateBossFoundationEntry(bossId),
            entry.proof.bossId,
          );
          await page.waitForFunction((kind) => (
            window.__ASHFALL_BATTLE_QA__?.getBossFoundationProof?.(kind)?.combatReady === true
          ), bossCase.kind, { timeout });
          await page.waitForFunction((name) => (
            document.querySelector(".boss-hud")?.textContent?.includes(name)
          ), bossCase.name, { timeout });
          await page.waitForFunction((kind) => (
            window.__ASHFALL_BATTLE_QA__?.getBossFoundationProof?.(kind)?.banner === null
          ), bossCase.kind, { timeout });
          const ready = await evidence(page, bossCase.kind);
          const expectedHeight = viewport.width === 844
            ? bossCase.compactBodyHeight
            : bossCase.standardBodyHeight;
          invariant(ready.proof.hud?.enemyKind === bossCase.kind, `${caseName}: boss HUD absent`);
          invariant(ready.proof.spriteLoadedWidth === 3360, `${caseName}: battle atlas unavailable`);
          invariant(
            Math.abs(ready.proof.renderedBodyHeight - expectedHeight) <= 6,
            `${caseName}: body height ${ready.proof.renderedBodyHeight} diverged from ${expectedHeight}`,
          );
          invariant(Math.abs(ready.proof.footAnchorDelta) <= .01, `${caseName}: foot anchor moved`);
          invariant(ready.proof.renderedVisibleRect?.right <= 960.01, `${caseName}: partial-body combat-ready`);
          const readyPath = path.join(evidenceDir, `${caseName}-ready.png`);
          await page.screenshot({ path: readyPath, fullPage: false });

          const normalAttack = await page.evaluate(({ bossId, humanId }) => (
            window.__ASHFALL_BATTLE_QA__.armAnomalyBossNormalAttack(bossId, humanId)
          ), { bossId: ready.proof.bossId, humanId: ready.proof.humanId });
          invariant(normalAttack, `${caseName}: normal attack setup failed`);
          await page.waitForFunction(({ kind, beforeHp }) => (
            window.__ASHFALL_BATTLE_QA__?.getBossFoundationProof?.(kind)?.humanHp < beforeHp
          ), { kind: bossCase.kind, beforeHp: normalAttack.humanHp }, { timeout });
          const normalHit = await evidence(page, bossCase.kind);
          invariant(normalHit.proof.humanHp < normalAttack.humanHp, `${caseName}: normal attack caused no damage`);

          await page.waitForFunction((kind) => (
            window.__ASHFALL_BATTLE_QA__?.getBossFoundationProof?.(kind)?.stationPhase === "idle"
          ), bossCase.kind, { timeout });
          const armed = await page.evaluate(({ bossId, humanId }) => (
            window.__ASHFALL_BATTLE_QA__.armBossFoundationTelegraph(bossId, humanId)
          ), { bossId: ready.proof.bossId, humanId: ready.proof.humanId });
          invariant(armed?.warningSeconds > 0, `${caseName}: telegraph setup failed`);
          await page.waitForFunction(({ kind, telegraphKind }) => {
            const proof = window.__ASHFALL_BATTLE_QA__?.getBossFoundationProof?.(kind);
            return proof?.stationPhase === "warning"
              && proof.telegraph?.kind === telegraphKind
              && proof.telegraph.remainingSeconds > .4;
          }, { kind: bossCase.kind, telegraphKind: bossCase.telegraphKind }, { timeout });
          const warning = await evidence(page, bossCase.kind);
          invariant(
            warning.proof.telegraph.counterplay.length >= 8,
            `${caseName}: counterplay absent`,
          );
          if (bossCase.kind === "futago") {
            invariant(warning.proof.stationSplit === true, `${caseName}: split phase not armed below threshold`);
          }
          if (bossCase.kind === "ooguchi") {
            invariant(
              Math.abs(warning.proof.telegraph.targetY - warning.proof.bossY) > 20,
              `${caseName}: alternate-lane charge proof was not armed`,
            );
          }
          const warningPath = path.join(evidenceDir, `${caseName}-warning.png`);
          await page.screenshot({ path: warningPath, fullPage: false });
          const beforeEvadeHp = warning.proof.humanHp;
          const moved = await page.evaluate(({ bossId, humanId }) => (
            window.__ASHFALL_BATTLE_QA__.moveAnomalyProofHumanOutsideTelegraph(bossId, humanId)
          ), { bossId: ready.proof.bossId, humanId: ready.proof.humanId });
          invariant(moved, `${caseName}: evade setup failed`);
          await page.waitForFunction((kind) => (
            window.__ASHFALL_BATTLE_QA__?.getBossFoundationProof?.(kind)?.stationPhase === "recovery"
          ), bossCase.kind, { timeout });
          const evaded = await evidence(page, bossCase.kind);
          invariant(evaded.proof.humanHp === beforeEvadeHp, `${caseName}: warning-safe position was hit`);

          await page.waitForFunction((kind) => (
            window.__ASHFALL_BATTLE_QA__?.getBossFoundationProof?.(kind)?.stationPhase === "idle"
          ), bossCase.kind, { timeout });
          const rearmed = await page.evaluate(({ bossId, humanId }) => (
            window.__ASHFALL_BATTLE_QA__.armBossFoundationTelegraph(bossId, humanId)
          ), { bossId: ready.proof.bossId, humanId: ready.proof.humanId });
          invariant(rearmed?.warningSeconds > 0, `${caseName}: second telegraph setup failed`);
          await page.waitForFunction(({ kind, telegraphKind }) => {
            const proof = window.__ASHFALL_BATTLE_QA__?.getBossFoundationProof?.(kind);
            return proof?.stationPhase === "warning"
              && proof.telegraph?.kind === telegraphKind
              && proof.telegraph.remainingSeconds > .4;
          }, { kind: bossCase.kind, telegraphKind: bossCase.telegraphKind }, { timeout });
          const heldWarning = await evidence(page, bossCase.kind);
          const beforeAbilityHp = heldWarning.proof.humanHp;
          const beforeAbilityX = heldWarning.proof.bossX;
          await page.waitForFunction(({ kind, hp }) => {
            const proof = window.__ASHFALL_BATTLE_QA__?.getBossFoundationProof?.(kind);
            return proof?.humanHp < hp && ["active", "recovery"].includes(proof.stationPhase);
          }, { kind: bossCase.kind, hp: beforeAbilityHp }, { timeout });
          const impact = await evidence(page, bossCase.kind);
          invariant(impact.proof.humanHp < beforeAbilityHp, `${caseName}: ability caused no damage`);
          if (bossCase.kind === "ooguchi") {
            invariant(impact.proof.bossX < beforeAbilityX - 2, `${caseName}: charge did not move`);
            invariant(
              impact.proof.stationTargetIds.includes(String(impact.proof.humanId)),
              `${caseName}: charge receipt did not lock the hit`,
            );
          }
          const impactPath = path.join(evidenceDir, `${caseName}-impact.png`);
          await page.screenshot({ path: impactPath, fullPage: false });

          const safeInset = viewport.width === 844 ? 44 : 0;
          invariant(impact.hudRect?.width > 0 && impact.hudRect?.height > 0, `${caseName}: HUD invisible`);
          invariant(
            impact.hudRect.left >= safeInset - 1
              && impact.hudRect.right <= viewport.width - safeInset + 1,
            `${caseName}: HUD entered safe area`,
          );
          const overlapping = impact.visibleHudRects
            .filter((rect) => !String(rect.className).includes("boss-hud"))
            .filter((rect) => rectanglesOverlap(impact.hudRect, rect));
          invariant(overlapping.length === 0, `${caseName}: HUD overlap ${JSON.stringify(overlapping)}`);
          invariant(
            impact.dimensions.documentWidth <= viewport.width
              && impact.dimensions.documentHeight <= viewport.height,
            `${caseName}: page overflow`,
          );
          invariant(impact.snapshot.geometry?.offFloorCount === 0, `${caseName}: off-floor fighter`);
          invariant(diagnostics.consoleErrors.length === 0, `${caseName}: console ${diagnostics.consoleErrors}`);
          invariant(diagnostics.pageErrors.length === 0, `${caseName}: page ${diagnostics.pageErrors}`);
          invariant(diagnostics.requestFailures.length === 0, `${caseName}: request ${diagnostics.requestFailures}`);
          invariant(diagnostics.httpErrors.length === 0, `${caseName}: HTTP ${diagnostics.httpErrors}`);
          results.push({
            name: caseName,
            status: "passed",
            stageId: impact.snapshot.stageId,
            bodyHeight: ready.proof.renderedBodyHeight,
            normalAttackDamage: normalAttack.humanHp - normalHit.proof.humanHp,
            abilityDamage: beforeAbilityHp - impact.proof.humanHp,
            evadeDamage: beforeEvadeHp - evaded.proof.humanHp,
            split: bossCase.kind === "futago" ? warning.proof.stationSplit : null,
            entryPath,
            readyPath,
            warningPath,
            impactPath,
          });
        } catch (error) {
          results.push({ name: caseName, status: "failed", error: String(error), diagnostics });
        } finally {
          await context.close();
        }
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
  throw new Error(`Anomaly boss browser smoke failed (${failures.length}/${results.length}): ${reportPath}`);
}
console.log(`Anomaly boss browser smoke passed (${results.length}/${results.length}): ${reportPath}`);
