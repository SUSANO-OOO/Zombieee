import { createHash } from "node:crypto";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import {
  RUNTIME_MAX_CATCH_UP_STEPS,
  RUNTIME_SIMULATION_HZ,
} from "../app/renderPerformance.js";
import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";
import { dismissInstallOffer } from "./pwa-gate-qa.mjs";

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
const qaMode = process.env.V095_RESIDUAL_BUGS_QA_MODE ?? "attack";
if (!["attack", "deployment-matrix"].includes(qaMode)) {
  throw new Error(`Unsupported V095_RESIDUAL_BUGS_QA_MODE: ${qaMode}`);
}
const qaScope = process.env.V095_RESIDUAL_BUGS_QA_SCOPE ?? "full";
if (!["full", "focused"].includes(qaScope)) {
  throw new Error(`Unsupported V095_RESIDUAL_BUGS_QA_SCOPE: ${qaScope}`);
}

function parseUniqueAxis(name, rawValue, allowedValues) {
  const values = rawValue.split(",").map((value) => value.trim()).filter(Boolean);
  if (values.length === 0) throw new Error(`${name} must not be empty`);
  if (new Set(values).size !== values.length) {
    throw new Error(`${name} contains duplicates: ${values.join(",")}`);
  }
  const unsupported = values.filter((value) => !allowedValues.includes(value));
  if (unsupported.length > 0) {
    throw new Error(`${name} contains unsupported entries: ${unsupported.join(",")}`);
  }
  return values;
}

function sameAxis(actual, expected) {
  return actual.length === expected.length
    && expected.every((value) => actual.includes(value));
}

const canonicalEngineNames = ["chromium", "webkit"];
const canonicalViewportNames = ["1280x720", "844x390", "844x340"];
const engines = parseUniqueAxis(
  "V095_RESIDUAL_BUGS_QA_ENGINES",
  process.env.V095_RESIDUAL_BUGS_QA_ENGINES ?? canonicalEngineNames.join(","),
  canonicalEngineNames,
);
const configuredViewportNames = parseUniqueAxis(
  "V095_RESIDUAL_BUGS_QA_VIEWPORTS",
  process.env.V095_RESIDUAL_BUGS_QA_VIEWPORTS ?? canonicalViewportNames.join(","),
  canonicalViewportNames,
);
const configuredViewports = configuredViewportNames.map((value) => {
  const match = /^(\d+)x(\d+)$/.exec(value);
  if (!match) throw new Error(`Invalid V095_RESIDUAL_BUGS_QA_VIEWPORTS entry: ${value}`);
  return { width: Number(match[1]), height: Number(match[2]) };
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
const deferredHumanProjectileKinds = new Set([
  "ranger",
  "medic",
  "babayaga",
  "engineer",
]);
const unitKinds = parseUniqueAxis(
  "V095_RESIDUAL_BUGS_QA_UNITS",
  process.env.V095_RESIDUAL_BUGS_QA_UNITS ?? defaultUnitKinds.join(","),
  defaultUnitKinds,
);
const allowedQualities = ["auto", "high", "power-save"];
const requestedQualities = parseUniqueAxis(
  "V095_RESIDUAL_BUGS_QA_QUALITIES",
  process.env.V095_RESIDUAL_BUGS_QA_QUALITIES ?? allowedQualities.join(","),
  allowedQualities,
);
const requestedSpeedValues = parseUniqueAxis(
  "V095_RESIDUAL_BUGS_QA_SPEEDS",
  process.env.V095_RESIDUAL_BUGS_QA_SPEEDS ?? "1,2",
  ["1", "2"],
);
const requestedSpeeds = requestedSpeedValues.map(Number);
const qualities = qaMode === "deployment-matrix" ? requestedQualities : ["auto"];
const speeds = qaMode === "deployment-matrix" ? requestedSpeeds : [1];
const canonicalQualities = qaMode === "deployment-matrix" ? allowedQualities : ["auto"];
const canonicalSpeeds = qaMode === "deployment-matrix" ? [1, 2] : [1];
if (qaScope === "full") {
  if (!sameAxis(engines, canonicalEngineNames)
    || !sameAxis(configuredViewportNames, canonicalViewportNames)
    || !sameAxis(unitKinds, defaultUnitKinds)
    || !sameAxis(qualities, canonicalQualities)
    || !sameAxis(speeds, canonicalSpeeds)) {
    throw new Error(`Full residual QA requires canonical axes: ${JSON.stringify({
      engines,
      viewports: configuredViewportNames,
      units: unitKinds,
      qualities,
      speeds,
    })}`);
  }
}
const continuousDeploymentSequence = (
  process.env.V095_RESIDUAL_BUGS_QA_CONTINUOUS_SEQUENCE === "1"
);
if (continuousDeploymentSequence) {
  const exactSequenceAxes = (
    qaMode === "deployment-matrix"
    && qaScope === "focused"
    && engines.length > 0
    && configuredViewportNames.length > 0
    && unitKinds.length > 0
    && sameAxis(qualities, ["auto"])
    && sameAxis(speeds, [1])
  );
  if (!exactSequenceAxes) {
    throw new Error(
      "Continuous deployment sequence capture requires the focused "
      + "one or more engines/viewports/units at Auto / 1x",
    );
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
    ?? (
      qaMode === "deployment-matrix"
        ? "outputs/v095-residual-bugs-deployment-matrix"
        : "outputs/v095-residual-bugs-browser-smoke"
    ),
);
const results = [];
const diagnosticFailures = [];

await mkdir(evidenceDir, { recursive: true });
const buildIdentityAtStart = await productionBuildIdentity();

async function latestFileMtimeMs(directory) {
  let latest = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      latest = Math.max(latest, await latestFileMtimeMs(entryPath));
    } else if (entry.isFile()) {
      latest = Math.max(latest, (await stat(entryPath)).mtimeMs);
    }
  }
  return latest;
}

const buildSentinelPath = path.resolve("dist/server/index.js");
const buildMtimeMs = (await stat(buildSentinelPath)).mtimeMs;
const latestProductionInputMtimeMs = Math.max(
  await latestFileMtimeMs(path.resolve("app")),
  await latestFileMtimeMs(path.resolve("public")),
  (await stat(path.resolve("package.json"))).mtimeMs,
);
if (buildMtimeMs < latestProductionInputMtimeMs) {
  throw new Error(
    `Production build is stale: ${buildSentinelPath} predates app/public/package inputs`,
  );
}

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

async function selectGraphicsQuality(page, quality, label) {
  await page.evaluate(
    (requestedQuality) => window.__ASHFALL_BATTLE_QA__.setGraphicsQuality(requestedQuality),
    quality,
  );
  await page.waitForFunction(
    (requestedQuality) => (
      document.documentElement.dataset.graphicsQualityRequested === requestedQuality
    ),
    quality,
    { timeout },
  );
  const profile = await page.evaluate(() => ({
    requested: document.documentElement.dataset.graphicsQualityRequested,
    resolved: document.documentElement.dataset.graphicsQualityResolved,
    renderHz: Number(document.documentElement.dataset.graphicsRenderHz),
    dprCap: Number(document.documentElement.dataset.graphicsDprCap),
    width: window.innerWidth,
    height: window.innerHeight,
    deviceMemory: navigator.deviceMemory ?? 8,
    hardwareConcurrency: navigator.hardwareConcurrency ?? 8,
  }));
  const expectedResolved = quality === "high"
    ? "high"
    : quality === "power-save"
      ? "power-save"
      : Math.min(profile.width, profile.height) <= 500
        || profile.deviceMemory <= 4
        || profile.hardwareConcurrency <= 4
        ? "balanced"
        : "high";
  const expectedProfile = {
    high: { renderHz: 60, dprCap: 2 },
    balanced: { renderHz: 45, dprCap: 1.5 },
    "power-save": { renderHz: 30, dprCap: 1 },
  }[expectedResolved];
  invariant(
    profile.requested === quality
      && profile.resolved === expectedResolved
      && profile.renderHz === expectedProfile.renderHz
      && profile.dprCap === expectedProfile.dprCap,
    `${label}: graphics profile mismatch ${JSON.stringify({ profile, expectedResolved, expectedProfile })}`,
  );
  return profile;
}

async function prepareDeploymentSpeed(page, speed, label) {
  await page.evaluate(
    () => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(false),
  );
  const prepared = await page.evaluate(
    () => window.__ASHFALL_BATTLE_QA__.prepareManualAbilitySurvivalProof("scout"),
  );
  invariant(prepared?.ownerIds?.length === 1,
    `${label}: Survival speed fixture unavailable`);
  await page.waitForFunction(
    () => window.__ASHFALL_BATTLE_QA__.getSnapshot().survivalRun?.speed === 1,
    null,
    { timeout },
  );
  if (speed === 2) {
    const speedButton = page.getByRole("button", { name: "2倍", exact: true });
    await speedButton.waitFor({ state: "visible", timeout });
    await speedButton.click();
    await page.waitForFunction(
      () => window.__ASHFALL_BATTLE_QA__.getSnapshot().survivalRun?.speed === 2,
      null,
      { timeout },
    );
  }
  const actualSpeed = await page.evaluate(
    () => window.__ASHFALL_BATTLE_QA__.getSnapshot().survivalRun?.speed ?? null,
  );
  invariant(actualSpeed === speed,
    `${label}: requested ${speed}x but observed ${actualSpeed}x`);
  return actualSpeed;
}

async function captureState(
  page,
  captureContext,
  unitKind,
  fighterId,
  attackerId,
  phase,
) {
  const {
    caseName,
    caseLabel,
    quality,
    speed,
    mode,
  } = captureContext;
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
      manualAbilityControls: [...document.querySelectorAll(".manual-ability-ready")]
        .map((button) => ({
          fighterId: Number(button.getAttribute("data-fighter-id")),
          kind: button.getAttribute("data-ability-kind"),
          disabled: button.matches(":disabled"),
        })),
    };
  }, { id: fighterId, threatId: attackerId });
  const unitLayerAudit = (
    mode === "deployment-matrix"
    && quality === "auto"
    && speed === 1
    && snapshot.fighter
  )
    ? await page.evaluate(
      (id) => window.__ASHFALL_BATTLE_QA__.auditFighterUnitLayer(id),
      snapshot.fighter.id,
    )
    : null;
  const persistScreenshot = (
    mode === "attack"
    && caseName === "chromium-844x390"
    && phase === "attack"
  ) || (
    mode === "deployment-matrix"
    && caseName === "chromium-844x390"
    && quality === "auto"
    && speed === 1
  ) || (
    ["scout", "mayo-chan"].includes(unitKind)
    && ["webkit-1280x720", "webkit-844x340"].includes(caseName)
    && quality === "auto"
    && speed === 1
  );
  const screenshotPath = persistScreenshot
    ? path.join(
      evidenceDir,
      `${mode}-${caseName}-${quality}-${speed}x-${unitKind}-${phase}.png`,
    )
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
    caseLabel,
    phase,
    screenshot: screenshotPath
      ? path.relative(process.cwd(), screenshotPath).replaceAll("\\", "/")
      : null,
    sha256: createHash("sha256").update(buffer).digest("hex"),
    ...snapshot,
    unitLayerAudit,
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
  const renderAudit = capture.fighter.renderAudit;
  invariant(renderAudit?.assetReady === true, `${label}: sprite fallback rendered`);
  invariant(renderAudit.poseOpacity === 1,
    `${label}: actual rendered pose remained translucent`);
  invariant(renderAudit.effectiveOpacity === 1,
    `${label}: actual canvas draw alpha remained translucent`);
  invariant(renderAudit.x === capture.fighter.x && renderAudit.y === capture.fighter.y,
    `${label}: render audit did not match fighter position`);
  invariant(capture.geometry.offFloorCount === 0, `${label}: logical off-floor body`);
  invariant(capture.geometry.visuallyOffFloorCount === 0, `${label}: visual off-floor body`);
  invariant(capture.geometry.debugGeometryRendered === false, `${label}: debug geometry rendered`);
  invariant(capture.fighter.animationPresentation.groundAnchor === 1,
    `${label}: ground anchor changed`);
  invariant(capture.fighter.animationPresentation.pose.offsetY === 0,
    `${label}: contact point lifted`);
  invariant(capture.fighter.animationPresentation.pose.opacity === 1,
    `${label}: playable body remained translucent`);
  if (capture.unitLayerAudit) {
    const audit = capture.unitLayerAudit;
    invariant(audit.actual.nonzeroPixels > 0 && audit.actual.bounds,
      `${label}: production unit layer disappeared`);
    invariant(audit.opaque.nonzeroPixels > 0 && audit.opaque.bounds,
      `${label}: forced-opaque reference layer disappeared`);
    invariant(audit.opacityComparison.maskIoU >= .999,
      `${label}: actual unit silhouette diverged from the opaque reference`);
    invariant(audit.opacityComparison.normalizedAlphaL1 <= .001,
      `${label}: actual unit alpha remained translucent`);
    invariant(audit.alphaOneFromFirstVisibleFrame === true,
      `${label}: first-visible body was not fully opaque`);
    invariant(audit.clipRect === null && audit.clipMode === "none",
      `${label}: legacy rectangle clipping remained active`);
    invariant(audit.unitDrawCount === 1,
      `${label}: unit layer was drawn ${audit.unitDrawCount} times`);
  }
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
        await dismissInstallOffer(page, { timeout });
        await page.waitForFunction(
          (requestedMode) => {
            const qa = window.__ASHFALL_BATTLE_QA__;
            return qa?.getSnapshot?.().running === true
              && typeof qa.prepareCrawlerDefenseProof === "function"
              && typeof qa.queueCrawlerDefenseUnit === "function"
              && typeof qa.setRepresentativeSixProofPaused === "function"
              && (
                requestedMode !== "deployment-matrix"
                || typeof qa.prepareManualAbilitySurvivalProof === "function"
              );
          },
          qaMode,
          { timeout },
        );
        await page.waitForFunction(
          () => Number(document.documentElement.dataset.assetResidentSprites) >= 25,
          null,
          { timeout },
        );

        for (const quality of qualities) {
          const qualityProfile = await selectGraphicsQuality(page, quality, caseName);
          for (const speed of speeds) {
            if (qaMode === "deployment-matrix") {
              await prepareDeploymentSpeed(page, speed, `${caseName}/${quality}/${speed}x`);
            }
            const caseLabel = qaMode === "deployment-matrix"
              ? `${caseName}-${quality}-${speed}x`
              : caseName;
            const captureContext = {
              caseName,
              caseLabel,
              quality,
              speed,
              mode: qaMode,
            };
            for (const unitKind of unitKinds) {
              const unitResult = {
                mode: qaMode,
                engine,
                viewport,
                quality,
                graphicsProfile: qualityProfile,
                speed,
                unitKind,
                status: "failed",
                frames: [],
              };
              try {
            const prepared = await page.evaluate(
              (kind) => window.__ASHFALL_BATTLE_QA__.prepareCrawlerDefenseProof({
                attackerKind: kind === "babayaga" ? "crusher" : "walker",
                lane: 1,
                existingClaim: true,
              }),
              unitKind,
            );
            invariant(Number.isInteger(prepared?.attackerId),
              `${caseLabel}/${unitKind}: threat fixture unavailable`);
            const queued = await page.evaluate(
              ({ kind }) => window.__ASHFALL_BATTLE_QA__.queueCrawlerDefenseUnit(kind, 1),
              { kind: unitKind },
            );
            invariant(queued === true, `${caseLabel}/${unitKind}: deployment queue rejected`);
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
              `${caseLabel}/${unitKind}: deployed identity unavailable`);
            await page.evaluate(
              () => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(true),
            );

            const entryPhase = continuousDeploymentSequence ? "door" : "entry";
            const entry = await captureState(
              page,
              captureContext,
              unitKind,
              fighterId,
              prepared.attackerId,
              entryPhase,
            );
            unitResult.frames.push(entry);
            validateCapturedState(entry, `${caseLabel}/${unitKind}/${entryPhase}`);
            invariant(entry.fighter.gateEntering === true && entry.fighter.combatReady === false,
              `${caseLabel}/${unitKind}: CRAWLER entry state missing`);
            invariant(entry.fighter.animationPresentation.direction === "right",
              `${caseLabel}/${unitKind}: entry faced away from the ramp`);
            await page.evaluate(
              () => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(false),
            );

            if (continuousDeploymentSequence) {
              const sequencePhases = [
                ["boundary", .18],
                ["ramp", .38],
                ["exit", .60],
                ["landing", .82],
              ];
              for (const [phase, minimumProgress] of sequencePhases) {
                const transition = await page.evaluate(async ({
                  id,
                  entryX,
                  progress,
                  maxMs,
                }) => {
                  const startedAt = performance.now();
                  while (performance.now() - startedAt < maxMs) {
                    const qa = window.__ASHFALL_BATTLE_QA__;
                    const snapshot = qa.getSnapshot();
                    const fighter = snapshot.fighters.find((candidate) => candidate.id === id);
                    const travel = Math.max(1, (fighter?.combatReadyX ?? entryX + 1) - entryX);
                    const actualProgress = fighter ? (fighter.x - entryX) / travel : -1;
                    if (
                      fighter?.gateEntering === true
                      && fighter.combatReady === false
                      && actualProgress >= progress
                    ) {
                      qa.setRepresentativeSixProofPaused(true);
                      return {
                        x: fighter.x,
                        y: fighter.y,
                        actualProgress,
                        spriteState: fighter.animationPresentation.sampledSpriteState,
                      };
                    }
                    await new Promise((resolve) => requestAnimationFrame(resolve));
                  }
                  throw new Error(`deployment sequence ${progress} timed out`);
                }, {
                  id: fighterId,
                  entryX: entry.fighter.x,
                  progress: minimumProgress,
                  maxMs: timeout,
                });
                const sequenceFrame = await captureState(
                  page,
                  captureContext,
                  unitKind,
                  fighterId,
                  prepared.attackerId,
                  phase,
                );
                unitResult.frames.push(sequenceFrame);
                validateCapturedState(
                  sequenceFrame,
                  `${caseLabel}/${unitKind}/${phase}`,
                );
                invariant(
                  sequenceFrame.fighter.gateEntering === true
                    && sequenceFrame.fighter.combatReady === false,
                  `${caseLabel}/${unitKind}/${phase}: deployment sequence left the ramp early`,
                );
                invariant(
                  transition.actualProgress >= minimumProgress
                    && sequenceFrame.fighter.x >= entry.fighter.x,
                  `${caseLabel}/${unitKind}/${phase}: deployment sequence did not advance`,
                );
                await page.evaluate(
                  () => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(false),
                );
              }
            }

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
            if (qaMode === "deployment-matrix") {
              await page.waitForFunction(
                (id) => (
                  document.querySelectorAll(
                    `.manual-ability-ready[data-fighter-id='${id}']`,
                  ).length === 1
                ),
                fighterId,
                { timeout, polling: 5 },
              );
            }
            const ready = await captureState(
              page,
              captureContext,
              unitKind,
              fighterId,
              prepared.attackerId,
              "ready",
            );
            unitResult.frames.push(ready);
            validateCapturedState(ready, `${caseLabel}/${unitKind}/ready`);
            invariant(ready.fighter.combatReady === true && ready.fighter.gateEntering === false,
              `${caseLabel}/${unitKind}: combat-ready state regressed after leaving the ramp`);
            invariant(ready.fighter.entryRampCleared === true,
              `${caseLabel}/${unitKind}: combat-ready state skipped the ramp foot`);
            invariant(readyTransition.x >= readyTransition.combatReadyX,
              `${caseLabel}/${unitKind}: combat-ready state remained behind the ramp foot`);
            invariant(
              ready.fighter.renderAudit.renderSequence
                > entry.fighter.renderAudit.renderSequence,
              `${caseLabel}/${unitKind}: ready render sequence did not advance`);
            const locomotionHistory = ready.fighter.renderAuditHistory.filter((audit) => (
              audit.assetReady === true
              && audit.spriteState?.startsWith("walk-")
              && audit.x >= entry.fighter.x
              && audit.x <= readyTransition.x
            ));
            const locomotionSprites = new Set(
              locomotionHistory.map(({ spriteState }) => spriteState),
            );
            invariant(
              locomotionHistory.length > 0
                && [...locomotionSprites].every((spriteState) => (
                  spriteState === "walk-a" || spriteState === "walk-b"
                )),
              `${caseLabel}/${unitKind}: actual canvas draw history missed live locomotion`,
            );
            invariant(
              locomotionHistory.every(({ poseOpacity, effectiveOpacity }) => (
                poseOpacity === 1 && effectiveOpacity === 1
              )),
              `${caseLabel}/${unitKind}: locomotion draw history contained translucent frames`,
            );
            invariant(
              Math.max(...locomotionHistory.map(({ x }) => x))
                - Math.min(...locomotionHistory.map(({ x }) => x)) >= 6,
              `${caseLabel}/${unitKind}: live locomotion draw history did not advance`,
            );
            const entryToReadyMs = (readyTransition.battleTime - entry.battleTime) * 1_000;
            invariant(entryToReadyMs <= 3_000,
              `${caseLabel}/${unitKind}: entry-to-ready ${entryToReadyMs.toFixed(1)}ms`);
            if (qaMode === "deployment-matrix") {
              invariant(new Set(unitResult.frames.map(({ sha256 }) => sha256)).size >= 2,
                `${caseLabel}/${unitKind}: continuous deployment states collapsed`);
              const readyControls = ready.manualAbilityControls.filter(
                ({ fighterId: controlFighterId, kind }) => (
                  controlFighterId === fighterId && kind === unitKind
                ),
              );
              invariant(readyControls.length === 1,
                `${caseLabel}/${unitKind}: ready indicator count ${readyControls.length}`);
              Object.assign(unitResult, {
                status: "passed",
                fighterId,
                attackerId: prepared.attackerId,
                entryToReadyMs: Number(entryToReadyMs.toFixed(1)),
                locomotionDrawCount: locomotionHistory.length,
                locomotionSprites: [...locomotionSprites].sort(),
                readyTransition,
              });
              continue;
            }
            await page.evaluate(
              () => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(false),
            );

            const readySequence = readyTransition.attackSequence;
            const launchTransition = await page.evaluate(async ({
              id,
              attackerId,
              sequence,
              maxMs,
            }) => {
              const startedAt = performance.now();
              while (performance.now() - startedAt < maxMs) {
                const qa = window.__ASHFALL_BATTLE_QA__;
                const snapshot = qa.getSnapshot();
                const fighter = snapshot.fighters.find((candidate) => candidate.id === id);
                const attacker = snapshot.fighters.find((candidate) => candidate.id === attackerId);
                if (fighter?.attackSequence > sequence) {
                  qa.setRepresentativeSixProofPaused(true);
                  return {
                    capturedAt: performance.now(),
                    battleTime: snapshot.time,
                    attackSequence: fighter.attackSequence,
                    attackerHp: attacker?.hp ?? 0,
                    attackerMarked: attacker?.marked ?? 0,
                    attackerFlash: attacker?.flash ?? 0,
                    attackerKnock: attacker?.knock ?? 0,
                    numericDamageTexts: snapshot.damageTexts.filter(({ value }) => (
                      /^-?\d/.test(value)
                    )),
                    pendingImpacts: snapshot.pendingWeaponHits.filter((hit) => (
                      hit.sourceId === id
                      && hit.targetId === attackerId
                      && hit.eventKind === "impact"
                      && hit.applyDamage === true
                    )),
                    attackIdentity: snapshot.attackIdentity.filter(
                      ({ sourceId }) => sourceId === id,
                    ),
                  };
                }
                await new Promise((resolve) => requestAnimationFrame(resolve));
              }
              throw new Error("attack launch transaction timed out");
            }, {
              id: fighterId,
              attackerId: prepared.attackerId,
              sequence: readySequence,
              maxMs: attackProbeMs,
            });
            unitResult.launchTransition = launchTransition;
            if (deferredHumanProjectileKinds.has(unitKind)) {
              invariant(launchTransition.attackerHp === prepared.initialAttackerHp,
                `${caseLabel}/${unitKind}: damage applied before projectile impact`);
              invariant(launchTransition.attackerFlash === 0
                && launchTransition.attackerKnock === 0,
              `${caseLabel}/${unitKind}: hit flash or knock applied before projectile impact`);
              invariant(launchTransition.numericDamageTexts.length === 0,
                `${caseLabel}/${unitKind}: numeric damage text appeared before projectile impact`);
              invariant(launchTransition.pendingImpacts.length === 1,
                `${caseLabel}/${unitKind}: expected one locked impact transaction at projectile launch`);
              invariant(Math.abs(
                launchTransition.pendingImpacts[0].impactDelaySeconds - .12,
              ) < .000_001,
              `${caseLabel}/${unitKind}: projectile transaction lost its 120ms travel contract`);
              if (unitKind === "babayaga") {
                invariant(launchTransition.attackerMarked === 0,
                  `${caseLabel}/${unitKind}: analysis mark applied before projectile impact`);
                const launchAudioAudit = await page.evaluate(({ ownerId, sequence }) => {
                  const requests = window.__ASHFALL_AUDIO_QA__.getCueRequests();
                  return {
                    shotCount: requests.filter(({ dedupeKey }) => (
                      dedupeKey === `babayaga-shot:${ownerId}:${sequence}`
                    )).length,
                    hitCount: requests.filter(({ dedupeKey }) => (
                      dedupeKey === `babayaga-hit:${ownerId}:${sequence}`
                    )).length,
                  };
                }, { ownerId: fighterId, sequence: launchTransition.attackSequence });
                invariant(launchAudioAudit.shotCount === 1
                  && launchAudioAudit.hitCount === 0,
                `${caseLabel}/${unitKind}: shot and hit cues were not separated by impact`);
                unitResult.launchAudioAudit = launchAudioAudit;
              }
            }
            await page.evaluate(
              () => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(false),
            );
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
                    attackerMarked: attacker?.marked ?? 0,
                    attackerFlash: attacker?.flash ?? 0,
                    attackerKnock: attacker?.knock ?? 0,
                    numericDamageTexts: snapshot.damageTexts.filter(({ value }) => (
                      /^-?\d/.test(value)
                    )),
                    pendingImpacts: snapshot.pendingWeaponHits.filter((hit) => (
                      hit.sourceId === id
                      && hit.targetId === attackerId
                      && hit.eventKind === "impact"
                      && hit.applyDamage === true
                    )),
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
            if (unitKind === "babayaga") {
              await page.evaluate(
                () => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(false),
              );
              await page.waitForFunction(
                ({ ownerId, sequence }) => {
                  const requests = window.__ASHFALL_AUDIO_QA__.getCueRequests();
                  const shotKey = `babayaga-shot:${ownerId}:${sequence}`;
                  const hitKey = `babayaga-hit:${ownerId}:${sequence}`;
                  const ready = requests.some(({ dedupeKey }) => dedupeKey === shotKey)
                    && requests.some(({ dedupeKey }) => dedupeKey === hitKey);
                  if (ready) window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(true);
                  return ready;
                },
                { ownerId: fighterId, sequence: attackTransition.attackSequence },
                { timeout, polling: 5 },
              );
              const audioAudit = await page.evaluate(({ ownerId, sequence }) => {
                const requests = window.__ASHFALL_AUDIO_QA__.getCueRequests();
                const shotKey = `babayaga-shot:${ownerId}:${sequence}`;
                const hitKey = `babayaga-hit:${ownerId}:${sequence}`;
                return {
                  shot: requests.filter(({ dedupeKey }) => dedupeKey === shotKey),
                  hit: requests.filter(({ dedupeKey }) => dedupeKey === hitKey),
                  voice: requests.filter(({ dedupeKey }) => (
                    dedupeKey === `babayaga-voice:${ownerId}:${sequence}`
                  )),
                };
              }, { ownerId: fighterId, sequence: attackTransition.attackSequence });
              invariant(audioAudit.shot.length === 1,
                `${caseLabel}/${unitKind}: expected one sequenced shot`);
              invariant(audioAudit.hit.length === 1,
                `${caseLabel}/${unitKind}: expected one sequenced hit`);
              const hitDelayMs = audioAudit.hit[0].at - audioAudit.shot[0].at;
              // The exact 120ms contract is asserted on the simulation transaction above.
              // This wall-clock value only proves cue ordering across variable browser pacing.
              invariant(hitDelayMs >= 25 && hitDelayMs <= 300,
                `${caseLabel}/${unitKind}: hit delay ${hitDelayMs.toFixed(1)}ms`);
              invariant(audioAudit.voice.length <= 1,
                `${caseLabel}/${unitKind}: attack voice duplicated`);
              unitResult.audioAudit = {
                ...audioAudit,
                hitDelayMs: Number(hitDelayMs.toFixed(1)),
              };
            }
            const attack = await captureState(
              page,
              captureContext,
              unitKind,
              fighterId,
              prepared.attackerId,
              "attack",
            );
            unitResult.frames.push(attack);
            validateCapturedState(attack, `${caseLabel}/${unitKind}/attack`);
            invariant(attackTransition.attackSequence > readySequence,
              `${caseLabel}/${unitKind}: attack sequence did not advance`);
            invariant(attackTransition.attackerHp < prepared.initialAttackerHp,
              `${caseLabel}/${unitKind}: real damage was not observed`);
            if (deferredHumanProjectileKinds.has(unitKind)) {
              const damageDelta = prepared.initialAttackerHp - attackTransition.attackerHp;
              const simulationImpactDelayMs = (
                attackTransition.battleTime - launchTransition.battleTime
              ) * 1_000;
              const remainingImpactDelayMs =
                launchTransition.pendingImpacts[0].remainingSeconds * 1_000;
              const maximumObservationOvershootMs =
                RUNTIME_MAX_CATCH_UP_STEPS * (1_000 / RUNTIME_SIMULATION_HZ) + 1;
              invariant(remainingImpactDelayMs > 0 && remainingImpactDelayMs <= 120,
                `${caseLabel}/${unitKind}: captured impact remainder ${remainingImpactDelayMs.toFixed(1)}ms`);
              invariant(
                simulationImpactDelayMs >= remainingImpactDelayMs - 1
                  && simulationImpactDelayMs <= (
                    remainingImpactDelayMs + maximumObservationOvershootMs
                  ),
                `${caseLabel}/${unitKind}: simulation impact delay ${simulationImpactDelayMs.toFixed(1)}ms for ${remainingImpactDelayMs.toFixed(1)}ms remainder`,
              );
              invariant(attackTransition.pendingImpacts.length === 0,
                `${caseLabel}/${unitKind}: locked impact transaction remained after damage`);
              invariant(Math.abs(
                damageDelta - launchTransition.pendingImpacts[0].damage,
              ) < .01,
              `${caseLabel}/${unitKind}: projectile damage transaction was not applied exactly once`);
              invariant(attackTransition.attackerFlash > 0
                && attackTransition.attackerKnock > 0,
              `${caseLabel}/${unitKind}: impact feedback did not land with projectile damage`);
              invariant(attackTransition.numericDamageTexts.length > 0,
                `${caseLabel}/${unitKind}: impact damage text did not land with projectile damage`);
            }
            if (unitKind === "babayaga") {
              invariant(attackTransition.attackerMarked > 0,
                `${caseLabel}/${unitKind}: analysis mark did not land with projectile damage`);
            }
            invariant(attackTransition.direction === "left",
              `${caseLabel}/${unitKind}: attack faced away from the CRAWLER threat`);
            invariant(attackTransition.attackIdentity.length > 0,
              `${caseLabel}/${unitKind}: player-facing attack identity missing`);

            await page.evaluate(
              () => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(false),
            );
            await page.waitForFunction(
              ({ id, sequence }) => {
                const qa = window.__ASHFALL_BATTLE_QA__;
                const fighter = qa.getSnapshot().fighters.find(
                  (candidate) => candidate.id === id,
                );
                const settled = fighter?.attackSequence >= sequence
                  && fighter.attack === 0
                  && fighter.attackWindup === 0
                  && fighter.animationPresentation.moving === false;
                if (settled) qa.setRepresentativeSixProofPaused(true);
                return settled;
              },
              { id: fighterId, sequence: attackTransition.attackSequence },
              { timeout, polling: 5 },
            );
            const attackSettled = await captureState(
              page,
              captureContext,
              unitKind,
              fighterId,
              prepared.attackerId,
              "attack-settled",
            );
            unitResult.frames.push(attackSettled);
            validateCapturedState(
              attackSettled,
              `${caseLabel}/${unitKind}/attack-settled`,
            );
            invariant(
              ["idle", "stop-move", "reload"].includes(
                attackSettled.fighter.animationPresentation.state,
              ),
              `${caseLabel}/${unitKind}: post-attack state was not a live stop`,
            );
            invariant(attackSettled.fighter.animationPresentation.direction === "left",
              `${caseLabel}/${unitKind}: post-attack stop lost target-facing direction`);

            invariant(new Set(unitResult.frames.map(({ sha256 }) => sha256)).size >= 3,
              `${caseLabel}/${unitKind}: continuous states collapsed`);
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
          }
        }
      } finally {
        await context.close();
      }
      if (!diagnosticsClean(diagnostics)) {
        diagnosticFailures.push({ caseName, diagnostics });
      }
    }
  } finally {
    await browser.close();
  }
}

const buildIdentityAtEnd = await productionBuildIdentity();
const buildIdentityStable = (
  buildIdentityAtStart.combinedSha256 === buildIdentityAtEnd.combinedSha256
);
const summary = {
  generatedAt: new Date().toISOString(),
  baseUrl: String(baseUrl),
  mode: qaMode,
  scope: qaScope,
  canonicalAxes: qaScope === "full",
  continuousDeploymentSequence,
  buildFreshness: {
    sentinel: path.relative(process.cwd(), buildSentinelPath).replaceAll("\\", "/"),
    buildMtime: new Date(buildMtimeMs).toISOString(),
    latestProductionInputMtime: new Date(latestProductionInputMtimeMs).toISOString(),
    fresh: buildMtimeMs >= latestProductionInputMtimeMs,
  },
  buildIdentity: buildIdentityAtEnd,
  buildIdentityAtStart,
  buildIdentityStable,
  engines,
  viewports: configuredViewports,
  units: unitKinds,
  qualities,
  speeds,
  expectedTotal: engines.length
    * configuredViewports.length
    * unitKinds.length
    * qualities.length
    * speeds.length,
  total: results.length,
  passed: results.filter(({ status }) => status === "passed").length,
  failed: results.filter(({ status }) => status !== "passed").length,
  attackCases: results.filter(({ mode }) => mode === "attack").length,
  deploymentCases: results.filter(({ mode }) => mode === "deployment-matrix").length,
  missingDamageUnits: results
    .filter(({ mode, status, error }) => (
      mode === "attack"
      && status !== "passed"
      && String(error).includes("actual damage timed out")
    ))
    .map(({ engine, viewport, quality, speed, unitKind }) => (
      `${engine}/${viewport.width}x${viewport.height}/${quality}/${speed}x/${unitKind}`
    )),
  maximumEntryToReadyMs: Math.max(
    0,
    ...results
      .filter(({ status, entryToReadyMs }) => (
        status === "passed" && Number.isFinite(entryToReadyMs)
      ))
      .map(({ entryToReadyMs }) => entryToReadyMs),
  ),
  maximumReadyToDamageMs: Math.max(
    0,
    ...results
      .filter(({ status, readyToDamageMs }) => (
        status === "passed" && Number.isFinite(readyToDamageMs)
      ))
      .map(({ readyToDamageMs }) => readyToDamageMs),
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
  unitLayerAuditCaseCount: results.filter(({ frames }) => (
    frames.length > 0 && frames.every(({ unitLayerAudit }) => Boolean(unitLayerAudit))
  )).length,
  unitLayerAuditFrameCount: results.reduce((total, result) => (
    total + result.frames.filter(({ unitLayerAudit }) => Boolean(unitLayerAudit)).length
  ), 0),
  diagnosticFailures,
  results,
};
const reportPath = path.join(evidenceDir, "summary.json");
await writeFile(reportPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  ...summary,
  results: summary.results.map(({
    mode,
    engine,
    viewport,
    quality,
    speed,
    unitKind,
    status,
    error,
  }) => ({
    mode,
    engine,
    viewport,
    quality,
    speed,
    unitKind,
    status,
    error,
  })),
}, null, 2));
invariant(summary.expectedTotal > 0, "Residual QA matrix must contain cases");
invariant(summary.buildIdentityStable,
  "Production dist changed while the residual QA matrix was running");
invariant(summary.total === summary.expectedTotal,
  `Residual QA matrix produced ${summary.total}/${summary.expectedTotal} cases`);
if (qaScope === "full") {
  const canonicalExpectedTotal = qaMode === "attack" ? 96 : 576;
  invariant(summary.expectedTotal === canonicalExpectedTotal,
    `Canonical ${qaMode} matrix expected ${canonicalExpectedTotal}, got ${summary.expectedTotal}`);
  if (qaMode === "deployment-matrix") {
    const expectedUnitLayerAuditCases = engines.length
      * configuredViewports.length
      * unitKinds.length;
    invariant(summary.unitLayerAuditCaseCount === expectedUnitLayerAuditCases,
      `Canonical deployment matrix produced ${summary.unitLayerAuditCaseCount}/${expectedUnitLayerAuditCases} unit-layer audit cases`);
    invariant(summary.unitLayerAuditFrameCount === expectedUnitLayerAuditCases * 2,
      `Canonical deployment matrix produced ${summary.unitLayerAuditFrameCount}/${expectedUnitLayerAuditCases * 2} unit-layer audit frames`);
  }
}
if (continuousDeploymentSequence) {
  const expectedPhases = ["door", "boundary", "ramp", "exit", "landing", "ready"];
  invariant(
    summary.total === summary.expectedTotal
      && summary.passed === summary.expectedTotal
      && summary.failed === 0,
    `Continuous deployment sequence produced ${summary.passed}/${summary.expectedTotal} passes`,
  );
  for (const result of summary.results) {
    invariant(
      JSON.stringify(result.frames.map(({ phase }) => phase))
        === JSON.stringify(expectedPhases),
      `${result.unitKind}: continuous deployment phases were incomplete`,
    );
    const frameXs = result.frames.map(({ fighter }) => fighter.x);
    invariant(
      frameXs.every((value, index) => index === 0 || value >= frameXs[index - 1]),
      `${result.unitKind}: continuous deployment position moved backwards`,
    );
    invariant(
      result.frames.every(({ fighter }) => (
        fighter.renderAudit.poseOpacity === 1
        && fighter.renderAudit.effectiveOpacity === 1
        && fighter.animationPresentation.pose.opacity === 1
      )),
      `${result.unitKind}: continuous deployment contained a translucent frame`,
    );
    invariant(
      result.locomotionSprites.includes("walk-a")
        && result.locomotionSprites.includes("walk-b"),
      `${result.unitKind}: continuous deployment missed a locomotion frame`,
    );
  }
  invariant(
    summary.unitLayerAuditCaseCount === summary.expectedTotal
      && summary.unitLayerAuditFrameCount === summary.expectedTotal * expectedPhases.length,
    "Continuous deployment sequence did not audit every player-facing frame",
  );
}
if (summary.diagnosticFailures.length > 0) {
  throw new Error(
    `Version 0.9.5 residual-bug QA browser diagnostics failed; see ${reportPath}`,
  );
}
if (summary.failed > 0) {
  throw new Error(`Version 0.9.5 residual-bug QA failed ${summary.failed}/${summary.total}; see ${reportPath}`);
}
