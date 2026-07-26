import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

if (!process.env.BOSS_QA_BASE_URL) {
  throw new Error("BOSS_QA_BASE_URL is required; use the isolated QA runner");
}
const baseUrl = new URL(process.env.BOSS_QA_BASE_URL);
if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname)) {
  throw new Error(`Boss QA routes are local-only; refusing non-local URL ${baseUrl}`);
}

const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href)
  : await import("playwright");

const browserTypes = { chromium: playwright.chromium, webkit: playwright.webkit };
const engines = (process.env.BOSS_QA_ENGINES ?? "chromium,webkit")
  .split(",")
  .map((engine) => engine.trim())
  .filter(Boolean);
for (const engine of engines) {
  if (!browserTypes[engine]) throw new Error(`Unknown BOSS_QA_ENGINES value: ${engine}`);
}

const evidenceDir = path.resolve(process.env.BOSS_QA_EVIDENCE_DIR ?? "outputs/boss-foundation-browser-smoke");
const timeout = Math.max(5_000, Number(process.env.BOSS_QA_TIMEOUT_MS) || 35_000);
const viewports = [
  { width: 1280, height: 720 },
  { width: 844, height: 390 },
  { width: 844, height: 340 },
];
const bossCases = [
  {
    kind: "takuya",
    name: "TAKUYA",
    telegraphKind: "ground-ellipse",
    params: { qa: "mission", stage: "3", state: "start", safe: "iphone-landscape" },
  },
  {
    kind: "gate-eater",
    name: "改札喰い",
    telegraphKind: "lane-rectangle",
    params: { qa: "station", stage: "6", state: "start", safe: "iphone-landscape" },
  },
];
const results = [];

await mkdir(evidenceDir, { recursive: true });

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function caseUrl(params) {
  const url = new URL(baseUrl);
  url.search = new URLSearchParams(params).toString();
  return String(url);
}

function createDiagnostics(page) {
  const diagnostics = {
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
    httpErrors: [],
    warnings: [],
  };
  const pendingRequests = new Set();
  page.on("request", (request) => pendingRequests.add(request));
  page.on("requestfinished", (request) => pendingRequests.delete(request));
  page.on("console", (message) => {
    if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
    if (message.type() === "warning"
      && !message.text().includes("was preloaded using link preload but not used")) {
      diagnostics.warnings.push(message.text());
    }
  });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(String(error)));
  page.on("requestfailed", (request) => {
    pendingRequests.delete(request);
    diagnostics.requestFailures.push(`${request.url()} :: ${request.failure()?.errorText ?? "unknown"}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) diagnostics.httpErrors.push(`${response.status()} ${response.url()}`);
    if (response.status() < 400
      && (response.request().resourceType() === "media" || response.url().includes("/audio/"))) {
      pendingRequests.delete(response.request());
    }
  });
  return { diagnostics, pendingRequests };
}

function assertDiagnostics(diagnostics, pendingRequests) {
  invariant(
    pendingRequests.size === 0,
    `pending requests: ${JSON.stringify([...pendingRequests].map((request) => ({
      type: request.resourceType(),
      url: request.url(),
    })))}`,
  );
  invariant(diagnostics.consoleErrors.length === 0, `console errors: ${JSON.stringify(diagnostics.consoleErrors)}`);
  invariant(diagnostics.pageErrors.length === 0, `page errors: ${JSON.stringify(diagnostics.pageErrors)}`);
  invariant(diagnostics.requestFailures.length === 0, `request failures: ${JSON.stringify(diagnostics.requestFailures)}`);
  invariant(diagnostics.httpErrors.length === 0, `HTTP errors: ${JSON.stringify(diagnostics.httpErrors)}`);
  invariant(diagnostics.warnings.length === 0, `console warnings: ${JSON.stringify(diagnostics.warnings)}`);
}

async function waitForPendingRequests(pendingRequests, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (pendingRequests.size > 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

async function readEvidence(page, bossCase) {
  return page.evaluate((expected) => {
    const bridge = window.__ASHFALL_BATTLE_QA__;
    if (!bridge?.getBossFoundationProof || !bridge?.getSnapshot) {
      throw new Error("Boss foundation QA bridge unavailable");
    }
    const proof = bridge.getBossFoundationProof(expected.kind);
    const snapshot = bridge.getSnapshot();
    const bossHud = document.querySelector(".boss-hud");
    const battlefield = document.querySelector(".battlefield");
    const hudRect = bossHud?.getBoundingClientRect() ?? null;
    const fieldRect = battlefield?.getBoundingClientRect() ?? null;
    const visibleHudRects = [...document.querySelectorAll(".top-hud, .health-hud, .crawler-alert, .battle-barks")]
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
      fieldRect: fieldRect ? {
        left: fieldRect.left,
        top: fieldRect.top,
        right: fieldRect.right,
        bottom: fieldRect.bottom,
      } : null,
      visibleHudRects,
      dimensions: {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        documentWidth: document.documentElement.scrollWidth,
        documentHeight: document.documentElement.scrollHeight,
      },
    };
  }, bossCase);
}

function rectanglesOverlap(left, right) {
  return left.left < right.right - 1
    && left.right > right.left + 1
    && left.top < right.bottom - 1
    && left.bottom > right.top + 1;
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
      for (const bossCase of bossCases) {
        const name = `${engine}-${bossCase.kind}-${viewport.width}x${viewport.height}`;
        const context = await browser.newContext({ viewport });
        const page = await context.newPage();
        const { diagnostics, pendingRequests } = createDiagnostics(page);
        try {
          await page.goto(caseUrl(bossCase.params), { waitUntil: "domcontentloaded", timeout });
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
          await page.waitForFunction(
            (kind) => {
              const proof = window.__ASHFALL_BATTLE_QA__?.getBossFoundationProof?.(kind);
              return proof?.bossId && proof.gateEntering === true && proof.combatReady === false;
            },
            bossCase.kind,
            { timeout },
          );
          const entryEvidence = await readEvidence(page, bossCase);
          const entryProof = entryEvidence.proof;
          invariant(entryProof.entranceCount === 1, `${name}: entrance did not fire exactly once`);
          invariant(entryProof.lastEntrance?.kind === bossCase.kind, `${name}: entrance kind mismatch`);
          invariant(entryProof.lastEntrance?.warningLabel === setup.warningLabel, `${name}: shared warning label not used`);
          invariant(entryProof.gateEntering === true && entryProof.combatReady === false,
            `${name}: boss skipped the right-edge entry state`);
          invariant(["right-edge", "right-edge-outside"].includes(entryProof.entryMode),
            `${name}: boss did not use a right-edge spawn profile`);
          invariant(entryProof.hud === null && entryProof.telegraph === null,
            `${name}: entry boss exposed combat UI before full-body readiness`);
          invariant(entryProof.bossAttack === 0 && entryProof.bossTargetId === null,
            `${name}: entry boss attacked or acquired a target`);
          invariant(entryProof.bossHp === entryProof.bossMaxHp,
            `${name}: entry boss was targetable before combat-ready`);
          invariant(entryProof.banner?.text === setup.warningLabel,
            `${name}: entrance warning was not visible during entry`);
          await page.evaluate(
            (bossId) => window.__ASHFALL_BATTLE_QA__.accelerateBossFoundationEntry(bossId),
            entryProof.bossId,
          );
          await page.waitForFunction(
            (kind) => {
              const proof = window.__ASHFALL_BATTLE_QA__?.getBossFoundationProof?.(kind);
              return proof?.combatReady === true && proof.gateEntering === false;
            },
            bossCase.kind,
            { timeout },
          );
          const readyEvidence = await readEvidence(page, bossCase);
          const readyProof = readyEvidence.proof;
          invariant(Math.abs(readyProof.bossX - readyProof.combatReadyX) <= .01,
            `${name}: full-body combat-ready point was not reached exactly`);
          invariant(readyProof.hud?.enemyKind === bossCase.kind,
            `${name}: boss HUD did not appear at combat-ready`);

          const challenge = await page.evaluate(
            ({ bossId, humanId }) => window.__ASHFALL_BATTLE_QA__
              .startBossFoundationBarrierChallenge(bossId, humanId),
            { bossId: readyProof.bossId, humanId: readyProof.humanId },
          );
          invariant(challenge, `${name}: barrier challenge could not start`);
          await page.waitForFunction(
            (kind) => {
              const barrier = window.__ASHFALL_BATTLE_QA__?.getBossFoundationProof?.(kind)?.barrier;
              return barrier?.attempted === true && barrier?.resultingX !== null;
            },
            bossCase.kind,
            { timeout },
          );
          const barrierEvidence = await readEvidence(page, bossCase);
          const barrierProof = barrierEvidence.proof;
          invariant(barrierProof.barrier?.blocked === true,
            `${name}: runtime high-speed pass-through barrier did not engage`);
          invariant(
            barrierProof.bossX - barrierProof.humanX + .01
              >= barrierProof.bossBodyRadius + barrierProof.humanBodyRadius + 2,
            `${name}: runtime barrier left the ally inside or beyond the boss body`,
          );

          const armed = await page.evaluate(
            ({ bossId, humanId }) => window.__ASHFALL_BATTLE_QA__
              .armBossFoundationTelegraph(bossId, humanId),
            { bossId: readyProof.bossId, humanId: readyProof.humanId },
          );
          invariant(armed?.warningSeconds > 0, `${name}: real telegraph could not be armed`);
          await page.waitForFunction(
            (kind) => Boolean(window.__ASHFALL_BATTLE_QA__?.getBossFoundationProof?.(kind)?.telegraph),
            bossCase.kind,
            { timeout },
          );
          await page.waitForTimeout(100);
          const finalEvidence = await readEvidence(page, bossCase);
          await waitForPendingRequests(pendingRequests);
          const screenshotPath = path.join(evidenceDir, `${name}.png`);
          await page.screenshot({ path: screenshotPath, fullPage: false });

          const { proof, snapshot, hudRect, dimensions } = finalEvidence;
          invariant(proof.kind === bossCase.kind, `${name}: proof kind mismatch`);
          invariant(proof.hud?.enemyKind === bossCase.kind, `${name}: shared boss HUD kind mismatch`);
          invariant(proof.hud?.phase?.phase === 2, `${name}: phase was not derived from HP`);
          invariant(proof.telegraph?.kind === bossCase.telegraphKind, `${name}: telegraph mismatch`);
          invariant(proof.telegraph.remainingSeconds > 0
            && proof.telegraph.remainingSeconds <= armed.warningSeconds,
          `${name}: telegraph did not follow the canonical real windup`);
          invariant(finalEvidence.bossHudText.includes(bossCase.name), `${name}: boss name absent from HUD`);
          invariant(finalEvidence.bossHudText.includes("第2段階"), `${name}: phase absent from HUD`);
          invariant(snapshot.geometry?.offFloorCount === 0, `${name}: combat-ready body was off floor`);
          invariant(proof.groundedAtY === proof.bossY, `${name}: boss foot anchor changed`);
          if (viewport.width === 844) {
            invariant(
              proof.renderedBodyHeight >= 110 && proof.renderedBodyHeight <= 135,
              `${name}: compact body height ${proof.renderedBodyHeight} outside 110-135px acceptance band`,
            );
            invariant(
              Math.abs(proof.renderedBodyHeight - proof.display.compactBodyHeight) <= 3,
              `${name}: compact renderer diverged from boss display contract`,
            );
          } else {
            invariant(
              Math.abs(proof.renderedBodyHeight - proof.display.standardBodyHeight) <= 3,
              `${name}: standard renderer diverged from boss display contract`,
            );
          }
          invariant(hudRect?.width > 0 && hudRect?.height > 0, `${name}: dedicated boss HUD not visible`);
          invariant(
            hudRect.left >= -1 && hudRect.top >= -1
              && hudRect.right <= viewport.width + 1 && hudRect.bottom <= viewport.height + 1,
            `${name}: boss HUD outside viewport`,
          );
          const overlapping = finalEvidence.visibleHudRects
            .filter((rect) => !String(rect.className).includes("boss-hud"))
            .filter((rect) => rectanglesOverlap(hudRect, rect));
          if (proof.banner?.rect) {
            invariant(!rectanglesOverlap(hudRect, proof.banner.rect),
              `${name}: boss HUD overlapped the active warning banner`);
          }
          invariant(overlapping.length === 0, `${name}: boss HUD overlap ${JSON.stringify(overlapping)}`);
          const safeInset = viewport.width === 844 ? 44 : 0;
          invariant(hudRect.left >= safeInset - 1 && hudRect.right <= viewport.width - safeInset + 1,
            `${name}: boss HUD entered the horizontal safe area`);
          for (const evidence of [entryEvidence, finalEvidence]) {
            for (const rect of evidence.visibleHudRects
              .filter(({ className }) => String(className).includes("battle-barks"))) {
              invariant(rect.left >= safeInset - 1 && rect.right <= viewport.width - safeInset + 1,
                `${name}: battle bark entered the horizontal safe area`);
            }
          }
          invariant(
            dimensions.documentWidth <= viewport.width && dimensions.documentHeight <= viewport.height,
            `${name}: page overflow ${dimensions.documentWidth}x${dimensions.documentHeight}`,
          );
          await page.waitForFunction(
            (kind) => window.__ASHFALL_BATTLE_QA__?.getBossFoundationProof?.(kind)?.telegraph === null,
            bossCase.kind,
            { timeout },
          );
          const endedProof = (await readEvidence(page, bossCase)).proof;
          invariant(endedProof.entranceCount === 1,
            `${name}: pause-safe entrance receipt replayed during one encounter`);
          await waitForPendingRequests(pendingRequests, 10_000);
          assertDiagnostics(diagnostics, pendingRequests);
          results.push({
            name,
            status: "passed",
            renderedBodyHeight: proof.renderedBodyHeight,
            entry: {
              mode: entryProof.entryMode,
              combatReady: entryProof.combatReady,
              bossHp: entryProof.bossHp,
              entrance: entryProof.lastEntrance,
            },
            telegraph: proof.telegraph,
            telegraphEnded: endedProof.telegraph === null,
            barrier: barrierProof.barrier,
            hudRect,
            screenshotPath,
          });
        } catch (error) {
          results.push({ name, status: "failed", error: String(error), diagnostics });
        } finally {
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
}

const fullEngineMatrix = engines.length === Object.keys(browserTypes).length
  && Object.keys(browserTypes).every((engine) => engines.includes(engine));
const reportPath = path.join(
  evidenceDir,
  fullEngineMatrix ? "report.json" : `report-${engines.join("-")}.json`,
);
await writeFile(reportPath, `${JSON.stringify(results, null, 2)}\n`, "utf8");
const failures = results.filter(({ status }) => status !== "passed");
if (failures.length > 0) {
  throw new Error(`Boss foundation browser smoke failed (${failures.length}/${results.length}): ${reportPath}`);
}
console.log(`Boss foundation browser smoke passed (${results.length}/${results.length}): ${reportPath}`);
