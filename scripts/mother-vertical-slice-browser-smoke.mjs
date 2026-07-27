import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

if (!process.env.BOSS_QA_BASE_URL) throw new Error("BOSS_QA_BASE_URL is required");
const baseUrl = new URL(process.env.BOSS_QA_BASE_URL);
if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname)) {
  throw new Error(`Mother QA is local-only: ${baseUrl}`);
}

const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href)
  : await import("playwright");
const engines = (process.env.MOTHER_QA_ENGINES ?? "chromium,webkit")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const browserTypes = { chromium: playwright.chromium, webkit: playwright.webkit };
const viewports = [
  { width: 1280, height: 720 },
  { width: 844, height: 390 },
  { width: 844, height: 340 },
];
const evidenceDir = path.resolve(process.env.MOTHER_QA_EVIDENCE_DIR ?? "outputs/mother-vertical-slice-browser-smoke");
const timeout = Math.max(8_000, Number(process.env.MOTHER_QA_TIMEOUT_MS) || 35_000);
const results = [];
await mkdir(evidenceDir, { recursive: true });

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function qaUrl() {
  const url = new URL(baseUrl);
  url.search = new URLSearchParams({
    qa: "mission",
    stage: "stage-bay-tower-service",
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
    const proof = bridge.getBossFoundationProof("mother");
    const snapshot = bridge.getSnapshot();
    const bossHud = document.querySelector(".boss-hud");
    const battlefield = document.querySelector(".battlefield");
    const hudRect = bossHud?.getBoundingClientRect() ?? null;
    const fieldRect = battlefield?.getBoundingClientRect() ?? null;
    return {
      proof,
      snapshot,
      bossHudText: bossHud?.textContent ?? "",
      stageText: document.querySelector(".mission-brief, .battlefield")?.textContent ?? "",
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
  if (!browserType) throw new Error(`Unknown MOTHER_QA_ENGINES value: ${engine}`);
  const browser = await browserType.launch({ headless: true });
  try {
    for (const viewport of viewports) {
      const name = `${engine}-mother-${viewport.width}x${viewport.height}`;
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
          window.__ASHFALL_BATTLE_QA__.prepareBossFoundationProof("mother")
        ));
        await page.waitForFunction(() => {
          const proof = window.__ASHFALL_BATTLE_QA__?.getBossFoundationProof?.("mother");
          return proof?.bossId && proof.gateEntering && !proof.combatReady;
        }, undefined, { timeout });
        const entry = await evidence(page);
        invariant(entry.snapshot.stageId === "stage-bay-tower-service", `${name}: wrong Stage 17 battlefield`);
        invariant(entry.proof.prototypeStatus === "producer-approved", `${name}: producer approval lost`);
        invariant(entry.proof.entryMode === "right-edge-outside", `${name}: wrong entry profile`);
        invariant(entry.proof.hud === null && entry.proof.telegraph === null, `${name}: pre-entry combat leak`);
        invariant(entry.proof.bossHp === entry.proof.bossMaxHp, `${name}: entry damage leak`);
        invariant(entry.proof.lastEntrance?.warningLabel === setup.warningLabel, `${name}: warning mismatch`);
        const entryPath = path.join(evidenceDir, `${name}-right-edge-outside.png`);
        await page.screenshot({ path: entryPath, fullPage: false });

        await page.evaluate((bossId) => (
          window.__ASHFALL_BATTLE_QA__.accelerateBossFoundationEntry(bossId)
        ), entry.proof.bossId);
        await page.waitForFunction(() => (
          window.__ASHFALL_BATTLE_QA__?.getBossFoundationProof?.("mother")?.combatReady === true
        ), undefined, { timeout });
        await page.waitForFunction(() => (
          document.querySelector(".boss-hud")?.textContent?.includes("マザー")
        ), undefined, { timeout });
        await page.waitForFunction(() => (
          window.__ASHFALL_BATTLE_QA__?.getBossFoundationProof?.("mother")?.banner === null
        ), undefined, { timeout });
        const ready = await evidence(page);
        invariant(ready.proof.hud?.enemyKind === "mother", `${name}: boss HUD absent`);
        invariant(ready.bossHudText.includes("マザー"), `${name}: boss display name absent`);
        invariant(ready.proof.spriteLoadedWidth === 3360, `${name}: Mother atlas unavailable`);
        const bodyMinimum = viewport.width === 844 ? 150 : 137;
        const bodyMaximum = viewport.width === 844 ? 155 : 141;
        invariant(
          ready.proof.renderedBodyHeight >= bodyMinimum && ready.proof.renderedBodyHeight <= bodyMaximum,
          `${name}: body height ${ready.proof.renderedBodyHeight} outside ${bodyMinimum}-${bodyMaximum}`,
        );
        invariant(Math.abs(ready.proof.footAnchorDelta) <= .01, `${name}: foot anchor moved`);
        invariant(ready.proof.renderedVisibleRect?.right <= 960, `${name}: combat-ready before full-body entry`);
        const readyPath = path.join(evidenceDir, `${name}-combat-ready.png`);
        await page.screenshot({ path: readyPath, fullPage: false });

        const normalAttack = await page.evaluate(({ bossId, humanId }) => (
          window.__ASHFALL_BATTLE_QA__.armMotherNormalAttack(bossId, humanId)
        ), { bossId: ready.proof.bossId, humanId: ready.proof.humanId });
        invariant(normalAttack, `${name}: normal attack setup failed`);
        await page.waitForFunction((beforeHp) => (
          window.__ASHFALL_BATTLE_QA__?.getBossFoundationProof?.("mother")?.humanHp < beforeHp
        ), normalAttack.humanHp, { timeout });
        const normalAttackEvidence = await evidence(page);
        invariant(normalAttackEvidence.proof.humanHp < normalAttack.humanHp, `${name}: normal attack caused no damage`);
        const normalAttackPath = path.join(evidenceDir, `${name}-normal-attack.png`);
        await page.screenshot({ path: normalAttackPath, fullPage: false });

        const armedEvade = await page.evaluate(({ bossId, humanId }) => (
          window.__ASHFALL_BATTLE_QA__.armBossFoundationTelegraph(bossId, humanId)
        ), { bossId: ready.proof.bossId, humanId: ready.proof.humanId });
        invariant(armedEvade?.warningSeconds === 1.1, `${name}: warning timing mismatch`);
        await page.waitForFunction(() => {
          const telegraph = window.__ASHFALL_BATTLE_QA__?.getBossFoundationProof?.("mother")?.telegraph;
          return telegraph?.kind === "brood-radial" && telegraph.remainingSeconds > .45;
        }, undefined, { timeout });
        const warning = await evidence(page);
        invariant(warning.proof.telegraph.counterplay.includes("増殖範囲"), `${name}: counterplay absent`);
        const warningPath = path.join(evidenceDir, `${name}-brood-warning.png`);
        await page.screenshot({ path: warningPath, fullPage: false });
        const beforeEvadeHp = warning.proof.humanHp;
        const moved = await page.evaluate(({ bossId, humanId }) => (
          window.__ASHFALL_BATTLE_QA__.moveMotherProofHumanOutsideBrood(bossId, humanId)
        ), { bossId: ready.proof.bossId, humanId: ready.proof.humanId });
        invariant(moved?.distance > 128, `${name}: Mother evade remained inside brood radius`);
        await page.waitForFunction(() => (
          window.__ASHFALL_BATTLE_QA__?.getBossFoundationProof?.("mother")?.stationPhase === "recovery"
        ), undefined, { timeout });
        const evaded = await evidence(page);
        invariant(evaded.proof.humanHp === beforeEvadeHp, `${name}: leaving brood radius did not evade damage`);
        invariant(evaded.proof.broodCount === 3, `${name}: brood reinforcement count mismatch after evade`);

        await page.waitForFunction(() => (
          window.__ASHFALL_BATTLE_QA__?.getBossFoundationProof?.("mother")?.stationPhase === "idle"
        ), undefined, { timeout });
        const rearm = await page.evaluate(({ bossId, humanId }) => (
          window.__ASHFALL_BATTLE_QA__.armBossFoundationTelegraph(bossId, humanId)
        ), { bossId: ready.proof.bossId, humanId: ready.proof.humanId });
        invariant(rearm?.warningSeconds === 1.1, `${name}: second arming failed`);
        const beforeHit = (await evidence(page)).proof.humanHp;
        await page.waitForFunction((hp) => {
          const proof = window.__ASHFALL_BATTLE_QA__?.getBossFoundationProof?.("mother");
          return proof?.stationPhase === "recovery" && proof?.humanHp < hp && proof?.broodCount === 3;
        }, beforeHit, { timeout });
        const hit = await evidence(page);
        invariant(hit.proof.humanHp < beforeHit, `${name}: held target took no damage`);
        const eruptionPath = path.join(evidenceDir, `${name}-brood-eruption.png`);
        await page.screenshot({ path: eruptionPath, fullPage: false });

        const safeInset = viewport.width === 844 ? 44 : 0;
        invariant(hit.hudRect?.width > 0 && hit.hudRect?.height > 0, `${name}: HUD invisible`);
        invariant(hit.hudRect.left >= safeInset - 1 && hit.hudRect.right <= viewport.width - safeInset + 1,
          `${name}: HUD entered safe area`);
        invariant(hit.dimensions.documentWidth <= viewport.width && hit.dimensions.documentHeight <= viewport.height,
          `${name}: page overflow`);
        invariant(hit.snapshot.geometry?.offFloorCount === 0, `${name}: off-floor fighter`);
        invariant(diagnostics.consoleErrors.length === 0, `${name}: console ${diagnostics.consoleErrors}`);
        invariant(diagnostics.pageErrors.length === 0, `${name}: page ${diagnostics.pageErrors}`);
        invariant(diagnostics.requestFailures.length === 0, `${name}: request ${diagnostics.requestFailures}`);
        invariant(diagnostics.httpErrors.length === 0, `${name}: HTTP ${diagnostics.httpErrors}`);
        results.push({
          name,
          status: "passed",
          stageId: hit.snapshot.stageId,
          renderedBodyHeight: ready.proof.renderedBodyHeight,
          entryMode: entry.proof.entryMode,
          normalAttackDamage: normalAttack.humanHp - normalAttackEvidence.proof.humanHp,
          evadeDamage: beforeEvadeHp - evaded.proof.humanHp,
          broodDamage: beforeHit - hit.proof.humanHp,
          broodCount: hit.proof.broodCount,
          entryPath,
          readyPath,
          normalAttackPath,
          warningPath,
          eruptionPath,
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
  throw new Error(`Mother browser smoke failed (${failures.length}/${results.length}): ${reportPath}`);
}
console.log(`Mother browser smoke passed (${results.length}/${results.length}): ${reportPath}`);
