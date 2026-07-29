import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const baseUrl = new URL(
  process.env.V095_RESIDUAL_BUGS_QA_BASE_URL ?? "http://127.0.0.1:4177/",
);
if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname)) {
  throw new Error(`Version 0.9.5 residual-bug QA is local-only; refusing ${baseUrl}`);
}

const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href)
  : await import("playwright");
const browserTypes = { chromium: playwright.chromium, webkit: playwright.webkit };
const engines = (process.env.V095_RESIDUAL_BUGS_QA_ENGINES ?? "chromium,webkit")
  .split(",")
  .map((engine) => engine.trim())
  .filter(Boolean);
const configuredViewports = (process.env.V095_RESIDUAL_BUGS_QA_VIEWPORTS
  ?? "1280x720,844x390,844x340")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean)
  .map((value) => {
    const [width, height] = value.split("x").map(Number);
    if (!Number.isFinite(width) || !Number.isFinite(height)) {
      throw new Error(`Invalid V095_RESIDUAL_BUGS_QA_VIEWPORTS entry: ${value}`);
    }
    return { width, height };
  });
const defaultUnitKinds = [
  "scout",
  "ranger",
  "brute",
  "brawler",
  "gunner",
  "medic",
  "crazy-king",
  "kumaverson",
  "babayaga",
  "guardian",
  "engineer",
  "zakimiya",
  "tky",
  "mrs-chiha",
  "miyamoto-musashi",
  "mayo-chan",
];
const requestedUnits = (process.env.V095_RESIDUAL_BUGS_QA_UNITS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const unitKinds = requestedUnits.length > 0 ? requestedUnits : defaultUnitKinds;
for (const unitKind of unitKinds) {
  if (!defaultUnitKinds.includes(unitKind)) {
    throw new Error(`Unsupported V095_RESIDUAL_BUGS_QA_UNITS entry: ${unitKind}`);
  }
}
const timeout = Math.max(
  8_000,
  Number(process.env.V095_RESIDUAL_BUGS_QA_TIMEOUT_MS) || 24_000,
);
const attackProbeMs = Math.max(
  2_000,
  Number(process.env.V095_RESIDUAL_BUGS_QA_ATTACK_PROBE_MS) || 6_000,
);
const evidenceDir = path.resolve(
  process.env.V095_RESIDUAL_BUGS_QA_EVIDENCE_DIR
    ?? "outputs/v095-residual-bugs-browser-smoke",
);
const results = [];

await mkdir(evidenceDir, { recursive: true });

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function caseUrl() {
  const url = new URL(baseUrl);
  url.search = new URLSearchParams({
    qa: "mission",
    stage: "1",
    state: "start",
    safe: "iphone-landscape",
  }).toString();
  return String(url);
}

function diagnosticsFor(page) {
  const diagnostics = {
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
    httpErrors: [],
  };
  page.on("console", (message) => {
    if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(String(error)));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown";
    if (failure !== "net::ERR_ABORTED") {
      diagnostics.requestFailures.push(`${request.url()} :: ${failure}`);
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 400) diagnostics.httpErrors.push(`${response.status()} ${response.url()}`);
  });
  return diagnostics;
}

function diagnosticsClean(diagnostics) {
  return Object.values(diagnostics).every((entries) => entries.length === 0);
}

async function nextRender(page) {
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
}

async function captureState(page, name, unitKind, fighterId, attackerId, phase) {
  await nextRender(page);
  const snapshot = await page.evaluate(({ id, threatId }) => {
    const qa = window.__ASHFALL_BATTLE_QA__;
    const current = qa.getSnapshot();
    const fighter = current.fighters.find((candidate) => candidate.id === id) ?? null;
    const attacker = current.fighters.find((candidate) => candidate.id === threatId) ?? null;
    const localBadge = document.querySelector(".local-qa-badge");
    const badgeText = localBadge?.textContent ?? "";
    const visibleText = (document.body.innerText ?? "").replace(badgeText, "");
    const keyboardLabels = visibleText.match(
      /\b(?:WASD|SHIFT|CTRL|CONTROL|SPACE|ENTER|ARROW(?:UP|DOWN|LEFT|RIGHT)?)\b|キーボード|矢印キー/giu,
    ) ?? [];
    const debugLabels = visibleText.match(
      /\b(?:DEBUG|PLACEHOLDER|HITBOX|DUMMY|TEMP(?:ORARY)?)\b/giu,
    ) ?? [];
    return {
      capturedAt: performance.now(),
      battleTime: current.time,
      fighter,
      attacker,
      attackIdentity: current.attackIdentity.filter(({ sourceId }) => sourceId === id),
      crawlerDoor: current.crawlerDoor,
      crawlerVisual: current.crawlerVisual,
      geometry: current.geometry,
      battleSpace: current.battleSpace,
      playerFacingText: {
        keyboardLabels: [...new Set(keyboardLabels)],
        debugLabels: [...new Set(debugLabels)],
      },
    };
  }, { id: fighterId, threatId: attackerId });
  const persistScreenshot = (
    name === "chromium-844x390" && phase === "attack"
  ) || (
    ["scout", "mayo-chan"].includes(unitKind)
    && ["webkit-1280x720", "webkit-844x340"].includes(name)
  );
  const screenshotPath = persistScreenshot
    ? path.join(evidenceDir, `${name}-${unitKind}-${phase}.png`)
    : null;
  const buffer = await page.locator("canvas.battlefield.active").screenshot({
    ...(screenshotPath ? { path: screenshotPath } : {}),
    animations: "allow",
  });
  const metadata = await sharp(buffer).metadata();
  const screenshotWidth = metadata.width ?? 960;
  const screenshotHeight = metadata.height ?? 540;
  const regionLeft = Math.max(0, Math.floor((42 / 960) * screenshotWidth));
  const regionTop = Math.max(0, Math.floor((135 / 540) * screenshotHeight));
  const regionWidth = Math.min(
    screenshotWidth - regionLeft,
    Math.ceil((188 / 960) * screenshotWidth),
  );
  const regionHeight = Math.min(
    screenshotHeight - regionTop,
    Math.ceil((310 / 540) * screenshotHeight),
  );
  const region = await sharp(buffer)
    .extract({
      left: regionLeft,
      top: regionTop,
      width: regionWidth,
      height: regionHeight,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const colors = new Set();
  let alphaZero = 0;
  let visible = 0;
  for (let index = 0; index < region.data.length; index += region.info.channels) {
    const alpha = region.data[index + 3];
    if (alpha === 0) alphaZero += 1;
    else visible += 1;
    colors.add(
      `${region.data[index] >> 4}:${region.data[index + 1] >> 4}:`
      + `${region.data[index + 2] >> 4}:${alpha >> 4}`,
    );
  }
  return {
    phase,
    screenshot: screenshotPath
      ? path.relative(process.cwd(), screenshotPath).replaceAll("\\", "/")
      : null,
    sha256: createHash("sha256").update(buffer).digest("hex"),
    ...snapshot,
    crawlerRegion: {
      sampledPixels: alphaZero + visible,
      alphaZero,
      visible,
      quantizedColorCount: colors.size,
    },
  };
}

function validateCapturedState(capture, label) {
  invariant(capture.fighter, `${label}: deployed fighter disappeared`);
  invariant(capture.geometry.offFloorCount === 0, `${label}: logical off-floor body`);
  invariant(capture.geometry.visuallyOffFloorCount === 0, `${label}: visual off-floor body`);
  invariant(capture.geometry.debugGeometryRendered === false, `${label}: debug geometry rendered`);
  invariant(capture.fighter.animationPresentation.groundAnchor === 1,
    `${label}: ground anchor changed`);
  invariant(capture.fighter.animationPresentation.pose.offsetY === 0,
    `${label}: contact point lifted`);
  invariant(capture.crawlerRegion.alphaZero === 0,
    `${label}: transparent holes remained in the composed CRAWLER region`);
  invariant(capture.crawlerRegion.quantizedColorCount >= 64,
    `${label}: CRAWLER region collapsed into a placeholder-like flat block`);
  invariant(capture.playerFacingText.keyboardLabels.length === 0,
    `${label}: smartphone keyboard labels ${capture.playerFacingText.keyboardLabels.join(",")}`);
  invariant(capture.playerFacingText.debugLabels.length === 0,
    `${label}: player-facing debug labels ${capture.playerFacingText.debugLabels.join(",")}`);
}

for (const engine of engines) {
  const browserType = browserTypes[engine];
  invariant(browserType, `Unsupported engine: ${engine}`);
  const browser = await browserType.launch({ headless: true });
  try {
    for (const viewport of configuredViewports) {
      const caseName = `${engine}-${viewport.width}x${viewport.height}`;
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const diagnostics = diagnosticsFor(page);
      try {
        const response = await page.goto(caseUrl(), {
          waitUntil: "domcontentloaded",
          timeout,
        });
        invariant(response?.ok(), `${caseName}: navigation HTTP ${response?.status()}`);
        await page.waitForFunction(
          () => {
            const qa = window.__ASHFALL_BATTLE_QA__;
            return qa?.getSnapshot?.().running === true
              && typeof qa.prepareCrawlerDefenseProof === "function"
              && typeof qa.queueCrawlerDefenseUnit === "function"
              && typeof qa.setRepresentativeSixProofPaused === "function";
          },
          null,
          { timeout },
        );
        await page.waitForFunction(
          () => Number(document.documentElement.dataset.assetResidentSprites) >= 25,
          null,
          { timeout },
        );

        for (const unitKind of unitKinds) {
          const unitResult = {
            engine,
            viewport,
            unitKind,
            status: "failed",
            frames: [],
          };
          try {
            const prepared = await page.evaluate(
              () => window.__ASHFALL_BATTLE_QA__.prepareCrawlerDefenseProof({
                attackerKind: "walker",
                lane: 1,
                existingClaim: true,
              }),
            );
            invariant(Number.isInteger(prepared?.attackerId),
              `${caseName}/${unitKind}: threat fixture unavailable`);
            const queued = await page.evaluate(
              ({ kind }) => window.__ASHFALL_BATTLE_QA__.queueCrawlerDefenseUnit(kind, 1),
              { kind: unitKind },
            );
            invariant(queued === true, `${caseName}/${unitKind}: deployment queue rejected`);
            await page.waitForFunction(
              (kind) => window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters.some(
                (fighter) => fighter.side === "human"
                  && fighter.kind === kind
                  && fighter.spawnPortalId === "crawler-door",
              ),
              unitKind,
              { timeout, polling: 5 },
            );
            const fighterId = await page.evaluate(
              (kind) => window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters.find(
                (fighter) => fighter.side === "human"
                  && fighter.kind === kind
                  && fighter.spawnPortalId === "crawler-door",
              )?.id ?? null,
              unitKind,
            );
            invariant(Number.isInteger(fighterId),
              `${caseName}/${unitKind}: deployed identity unavailable`);
            await page.evaluate(
              () => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(true),
            );

            const entry = await captureState(
              page,
              caseName,
              unitKind,
              fighterId,
              prepared.attackerId,
              "entry",
            );
            unitResult.frames.push(entry);
            validateCapturedState(entry, `${caseName}/${unitKind}/entry`);
            invariant(entry.fighter.gateEntering === true && entry.fighter.combatReady === false,
              `${caseName}/${unitKind}: CRAWLER entry state missing`);
            invariant(entry.fighter.animationPresentation.direction === "right",
              `${caseName}/${unitKind}: entry faced away from the ramp`);
            await page.evaluate(
              () => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(false),
            );

            await page.waitForFunction(
              ({ id }) => {
                const qa = window.__ASHFALL_BATTLE_QA__;
                const fighter = qa.getSnapshot().fighters.find(
                  (candidate) => candidate.id === id,
                );
                const readyToCapture = fighter?.gateEntering === true
                  && fighter.animationPresentation.moving === true
                  && fighter.animationPresentation.sampledSpriteState.startsWith("walk-")
                  && fighter.x >= 118
                  && fighter.x < fighter.combatReadyX;
                if (readyToCapture) qa.setRepresentativeSixProofPaused(true);
                return readyToCapture;
              },
              { id: fighterId },
              { timeout, polling: 5 },
            );
            const ramp = await captureState(
              page,
              caseName,
              unitKind,
              fighterId,
              prepared.attackerId,
              "ramp",
            );
            unitResult.frames.push(ramp);
            validateCapturedState(ramp, `${caseName}/${unitKind}/ramp`);
            invariant(ramp.fighter.animationPresentation.moving === true,
              `${caseName}/${unitKind}: ramp deployment slid on a non-moving state`);
            invariant(ramp.fighter.animationPresentation.sampledSpriteState.startsWith("walk-"),
              `${caseName}/${unitKind}: ramp deployment used an idle sprite`);
            await page.evaluate(
              () => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(false),
            );

            const readyTransition = await page.evaluate(async ({ id, maxMs }) => {
              const startedAt = performance.now();
              while (performance.now() - startedAt < maxMs) {
                const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
                const fighter = snapshot.fighters.find((candidate) => candidate.id === id);
                if (fighter?.combatReady === true && fighter.gateEntering === false) {
                  window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(true);
                  return {
                    capturedAt: performance.now(),
                    battleTime: snapshot.time,
                    x: fighter.x,
                    y: fighter.y,
                    combatReadyX: fighter.combatReadyX,
                    combatReadyY: fighter.combatReadyY,
                    attackSequence: fighter.attackSequence,
                  };
                }
                await new Promise((resolve) => requestAnimationFrame(resolve));
              }
              throw new Error("combat-ready transition timed out");
            }, { id: fighterId, maxMs: timeout });
            unitResult.readyTransition = readyTransition;
            const ready = await captureState(
              page,
              caseName,
              unitKind,
              fighterId,
              prepared.attackerId,
              "ready",
            );
            unitResult.frames.push(ready);
            validateCapturedState(ready, `${caseName}/${unitKind}/ready`);
            invariant(ready.fighter.combatReady === true && ready.fighter.gateEntering === false,
              `${caseName}/${unitKind}: combat-ready state regressed after leaving the ramp`);
            invariant(ready.fighter.entryRampCleared === true,
              `${caseName}/${unitKind}: combat-ready state skipped the ramp foot`);
            invariant(readyTransition.x >= readyTransition.combatReadyX,
              `${caseName}/${unitKind}: combat-ready state remained behind the ramp foot`);
            const entryToReadyMs = (readyTransition.battleTime - entry.battleTime) * 1_000;
            invariant(entryToReadyMs <= 3_000,
              `${caseName}/${unitKind}: entry-to-ready ${entryToReadyMs.toFixed(1)}ms`);
            await page.evaluate(
              () => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(false),
            );

            const readySequence = readyTransition.attackSequence;
            const attackTransition = await page.evaluate(async ({
              id,
              attackerId,
              sequence,
              initialHp,
              maxMs,
            }) => {
              const startedAt = performance.now();
              while (performance.now() - startedAt < maxMs) {
                const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
                const fighter = snapshot.fighters.find((candidate) => candidate.id === id);
                const attacker = snapshot.fighters.find((candidate) => candidate.id === attackerId);
                if (fighter?.attackSequence > sequence && (!attacker || attacker.hp < initialHp)) {
                  window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(true);
                  return {
                    capturedAt: performance.now(),
                    battleTime: snapshot.time,
                    attackSequence: fighter.attackSequence,
                    direction: fighter.animationPresentation.direction,
                    attackerHp: attacker?.hp ?? 0,
                    attackIdentity: snapshot.attackIdentity.filter(
                      ({ sourceId }) => sourceId === id,
                    ),
                  };
                }
                await new Promise((resolve) => requestAnimationFrame(resolve));
              }
              const finalSnapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
              const finalFighter = finalSnapshot.fighters.find((candidate) => candidate.id === id);
              const finalAttacker = finalSnapshot.fighters.find(
                (candidate) => candidate.id === attackerId,
              );
              throw new Error(`actual damage timed out: ${JSON.stringify({
                fighter: finalFighter,
                attacker: finalAttacker,
                distance: finalFighter && finalAttacker
                  ? Math.hypot(finalFighter.x - finalAttacker.x, finalFighter.y - finalAttacker.y)
                  : null,
              })}`);
            }, {
                id: fighterId,
                attackerId: prepared.attackerId,
                sequence: readySequence,
                initialHp: prepared.initialAttackerHp,
                maxMs: attackProbeMs,
              });
            unitResult.attackTransition = attackTransition;
            const attack = await captureState(
              page,
              caseName,
              unitKind,
              fighterId,
              prepared.attackerId,
              "attack",
            );
            unitResult.frames.push(attack);
            validateCapturedState(attack, `${caseName}/${unitKind}/attack`);
            invariant(attackTransition.attackSequence > readySequence,
              `${caseName}/${unitKind}: attack sequence did not advance`);
            invariant(attackTransition.attackerHp < prepared.initialAttackerHp,
              `${caseName}/${unitKind}: real damage was not observed`);
            invariant(attackTransition.direction === "left",
              `${caseName}/${unitKind}: attack faced away from the CRAWLER threat`);
            invariant(attackTransition.attackIdentity.length > 0,
              `${caseName}/${unitKind}: player-facing attack identity missing`);

            invariant(new Set(unitResult.frames.map(({ sha256 }) => sha256)).size >= 3,
              `${caseName}/${unitKind}: continuous states collapsed`);
            Object.assign(unitResult, {
              status: "passed",
              fighterId,
              attackerId: prepared.attackerId,
              entryToReadyMs: Number(entryToReadyMs.toFixed(1)),
              readyToDamageMs: Number((
                (attackTransition.battleTime - readyTransition.battleTime) * 1_000
              ).toFixed(1)),
              initialAttackerHp: prepared.initialAttackerHp,
              impactAttackerHp: attackTransition.attackerHp,
              readyTransition,
              attackTransition,
            });
          } catch (error) {
            unitResult.error = String(error);
            try {
              unitResult.failureSnapshot = await page.evaluate(
                () => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.() ?? null,
              );
            } catch {
              // Preserve the original failure.
            }
          } finally {
            results.push(unitResult);
          }
        }
      } finally {
        await context.close();
      }
      invariant(diagnosticsClean(diagnostics),
        `${caseName}: browser diagnostics ${JSON.stringify(diagnostics)}`);
    }
  } finally {
    await browser.close();
  }
}

const summary = {
  generatedAt: new Date().toISOString(),
  baseUrl: String(baseUrl),
  engines,
  viewports: configuredViewports,
  units: unitKinds,
  total: results.length,
  passed: results.filter(({ status }) => status === "passed").length,
  failed: results.filter(({ status }) => status !== "passed").length,
  missingDamageUnits: results
    .filter(({ status, error }) => status !== "passed" && String(error).includes("waitForFunction"))
    .map(({ engine, viewport, unitKind }) => `${engine}/${viewport.width}x${viewport.height}/${unitKind}`),
  maximumEntryToReadyMs: Math.max(
    0,
    ...results.filter(({ status }) => status === "passed").map(({ entryToReadyMs }) => entryToReadyMs),
  ),
  maximumReadyToDamageMs: Math.max(
    0,
    ...results.filter(({ status }) => status === "passed").map(({ readyToDamageMs }) => readyToDamageMs),
  ),
  debugGeometryRenderedCount: results.reduce((total, result) => (
    total + result.frames.filter(({ geometry }) => geometry?.debugGeometryRendered === true).length
  ), 0),
  keyboardLabelCount: results.reduce((total, result) => (
    total + result.frames.reduce((frameTotal, frame) => (
      frameTotal + (frame.playerFacingText?.keyboardLabels.length ?? 0)
    ), 0)
  ), 0),
  debugLabelCount: results.reduce((total, result) => (
    total + result.frames.reduce((frameTotal, frame) => (
      frameTotal + (frame.playerFacingText?.debugLabels.length ?? 0)
    ), 0)
  ), 0),
  results,
};
const reportPath = path.join(evidenceDir, "summary.json");
await writeFile(reportPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  ...summary,
  results: summary.results.map(({ engine, viewport, unitKind, status, error }) => ({
    engine,
    viewport,
    unitKind,
    status,
    error,
  })),
}, null, 2));
if (summary.failed > 0) {
  throw new Error(`Version 0.9.5 residual-bug QA failed ${summary.failed}/${summary.total}; see ${reportPath}`);
}
