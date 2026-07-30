import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";
import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";

const root = process.cwd();
const execFileAsync = promisify(execFile);
const outputDir = path.resolve(root, "docs/qa/v095/acceptance-corrections");
const expectedIntegrationBaseSha =
  "5bc0d6b26dbad46501e7f1677af9a3d409dd20dc";

const sourcePaths = {
  residualAttack:
    "outputs/acceptance-final/residual-attack-full-final/summary.json",
  residualDeployment:
    "outputs/acceptance-final/residual-deployment-full-final/summary.json",
  deploymentSequence:
    "outputs/acceptance-final/deployment-sequence-final/summary.json",
  deploymentSequenceBefore:
    "outputs/acceptance-final/deployment-sequence-before-final/summary.json",
  manualAbilities:
    "outputs/acceptance-final/manual-abilities-final/results.json",
  representativeSix:
    "outputs/acceptance-final/representative-six-final/summary.json",
  remainingTen:
    "outputs/acceptance-final/remaining-ten-final/summary.json",
  aiMission: "outputs/acceptance-final/ai-mission-final/summary.json",
  routeCart: "outputs/acceptance-final/route-cart-final/summary.json",
  survival: "outputs/acceptance-final/survival-final/results.json",
  outbreak: "outputs/acceptance-final/outbreak-final/report.json",
  enemyVfx: "outputs/acceptance-final/enemy-vfx-final/summary.json",
  crawlerDefense:
    "outputs/acceptance-final/crawler-defense-final/summary.json",
  battleSpace: "outputs/acceptance-final/battle-space-final/summary.json",
  combatPresentation:
    "outputs/acceptance-final/combat-presentation-final/summary.json",
  mobileLifecycle:
    "outputs/acceptance-final/mobile-lifecycle-final/summary.json",
  assetDecodeAudio:
    "outputs/acceptance-final/asset-decode-audio-final/summary.json",
  saveOrigin: "docs/qa/v095/save-origin/save-origin-summary.json",
  employmentUnlock:
    "docs/qa/v095/employment-unlock/employment-unlock-summary.json",
  priorRc: "docs/qa/v095/rc/rc-summary.json",
  performanceNormal:
    "outputs/acceptance-final/performance-normal-auto-15m-final.json",
  performanceSurvivalAuto:
    "outputs/acceptance-final/performance-survival-auto-15m-final.json",
  performanceSurvivalPowerSave:
    "outputs/acceptance-final/performance-survival-power-save-15m-final.json",
};

const unitKinds = [
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

const unitLabels = new Map([
  ["scout", "HACHI"],
  ["ranger", "SUNA"],
  ["brute", "GOTZ"],
  ["brawler", "PASEN"],
  ["gunner", "IKURA"],
  ["medic", "AOI"],
  ["crazy-king", "CRAZY KING"],
  ["kumaverson", "KUMAVERSON"],
  ["babayaga", "BABAYAGA"],
  ["guardian", "GUARDIAN"],
  ["engineer", "ENGINEER"],
  ["zakimiya", "ZAKIMIYA"],
  ["tky", "TKY"],
  ["mrs-chiha", "MRS. CHIHA"],
  ["miyamoto-musashi", "MUSASHI"],
  ["mayo-chan", "MAYO"],
]);
const representativeUnitKinds = new Set([
  "scout",
  "gunner",
  "crazy-king",
  "tky",
  "mrs-chiha",
  "mayo-chan",
]);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function relative(filePath) {
  return path.relative(root, filePath).replaceAll("\\", "/");
}

function absolute(relativePath) {
  return path.resolve(root, relativePath);
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(absolute(relativePath), "utf8"));
}

async function sha256(filePath) {
  const bytes = await readFile(filePath);
  return createHash("sha256").update(bytes).digest("hex");
}

async function requireFile(filePath) {
  await access(filePath);
  return filePath;
}

async function gitOutput(...args) {
  const { stdout } = await execFileAsync("git", args, { cwd: root });
  return stdout.trim();
}

function diagnosticCount(value) {
  if (Array.isArray(value)) return value.length;
  if (typeof value === "number") return Math.max(0, value);
  if (!value || typeof value !== "object") return 0;
  return Object.values(value).reduce(
    (total, child) => total + diagnosticCount(child),
    0,
  );
}

function resultsDiagnosticCount(results) {
  return results.reduce(
    (total, result) => total + diagnosticCount(result?.diagnostics),
    0,
  );
}

function relativeDifference(left, right) {
  const maximum = Math.max(Math.abs(left), Math.abs(right), 1);
  return Math.abs(left - right) / maximum;
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function labelSvg(width, height, label, background = "#1b2228", fontSize = 14) {
  return Buffer.from(
    `<svg width="${width}" height="${height}">
      <rect width="100%" height="100%" fill="${background}"/>
      <text x="10" y="${Math.round(height * .68)}" fill="#f3f7f7"
        font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="700">${escapeXml(label)}</text>
    </svg>`,
  );
}

async function resizedFrame(source, width, height) {
  return sharp(source)
    .resize(width, height, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();
}

async function buildDeploymentSequenceSheet() {
  const beforeSourceDir = absolute(
    "outputs/acceptance-final/deployment-sequence-before-final",
  );
  const afterSourceDir = absolute(
    "outputs/acceptance-final/deployment-sequence-final",
  );
  const phases = [
    ["door", "DOOR / INSIDE"],
    ["boundary", "BOUNDARY"],
    ["ramp", "RAMP"],
    ["exit", "EXIT"],
    ["landing", "LANDING"],
    ["ready", "READY"],
  ];
  const columns = 2;
  const cardWidth = 960;
  const cardHeight = 250;
  const headerHeight = 28;
  const frameWidth = 154;
  const frameHeight = 84;
  const frameLabelHeight = 24;
  const gap = 4;
  const sequenceGap = 6;
  const composites = [];
  const sources = [];

  for (let index = 0; index < unitKinds.length; index += 1) {
    const unitKind = unitKinds[index];
    const left = (index % columns) * cardWidth;
    const top = Math.floor(index / columns) * cardHeight;
    composites.push({
      input: labelSvg(
        cardWidth - gap,
        headerHeight,
        `${String(index + 1).padStart(2, "0")}  ${unitLabels.get(unitKind)}`,
      ),
      left,
      top,
    });
    for (const [sequenceIndex, sequence] of [
      {
        label: "BEFORE",
        pathFor: (phase) => path.join(beforeSourceDir, `${unitKind}-${phase}.png`),
      },
      {
        label: "AFTER",
        pathFor: (phase) => path.join(
          afterSourceDir,
          `deployment-matrix-chromium-844x390-auto-1x-${unitKind}-${phase}.png`,
        ),
      },
    ].entries()) {
      const frameTop = top
        + headerHeight
        + sequenceIndex * (frameHeight + frameLabelHeight + sequenceGap);
      for (let phaseIndex = 0; phaseIndex < phases.length; phaseIndex += 1) {
        const [phase, phaseLabel] = phases[phaseIndex];
        const source = await requireFile(sequence.pathFor(phase));
        sources.push(source);
        const frameLeft = left + phaseIndex * (frameWidth + gap);
        composites.push({
          input: await resizedFrame(source, frameWidth, frameHeight),
          left: frameLeft,
          top: frameTop,
        });
        composites.push({
          input: labelSvg(
            frameWidth,
            frameLabelHeight,
            `${sequence.label} / ${phaseLabel}`,
            sequence.label === "BEFORE" ? "#55362f" : "#214b3d",
            9,
          ),
          left: frameLeft,
          top: frameTop + frameHeight,
        });
      }
    }
  }

  const outputPath = path.join(outputDir, "all-sixteen-deployment-sequence.png");
  await sharp({
    create: {
      width: columns * cardWidth,
      height: Math.ceil(unitKinds.length / columns) * cardHeight,
      channels: 4,
      background: "#0b0f12",
    },
  }).composite(composites).png().toFile(outputPath);
  return { outputPath, sources };
}

async function buildWalkBeforeAfterSheet() {
  const phases = [
    ["01-idle", "IDLE"],
    ["02-move-right", "WALK RIGHT"],
    ["03-turn-left", "TURN LEFT"],
    ["04-attack-wind-up", "WIND-UP"],
    ["05-attack-active", "ACTIVE"],
    ["06-attack-recovery", "RECOVERY"],
  ];
  const columns = 2;
  const cardWidth = 960;
  const cardHeight = 250;
  const headerHeight = 28;
  const frameWidth = 154;
  const frameHeight = 84;
  const frameLabelHeight = 24;
  const gap = 4;
  const sequenceGap = 6;
  const composites = [];
  const sources = [];

  for (let index = 0; index < unitKinds.length; index += 1) {
    const unitKind = unitKinds[index];
    const proofDirectory = representativeUnitKinds.has(unitKind)
      ? "representative-six"
      : "remaining-ten";
    const left = (index % columns) * cardWidth;
    const top = Math.floor(index / columns) * cardHeight;
    composites.push({
      input: labelSvg(
        cardWidth - gap,
        headerHeight,
        `${String(index + 1).padStart(2, "0")}  ${unitLabels.get(unitKind)}`,
      ),
      left,
      top,
    });
    for (const [sequenceIndex, sequence] of [
      {
        label: "BEFORE",
        sourceRoot: `outputs/v095-${proofDirectory}`,
      },
      {
        label: "AFTER",
        sourceRoot: `outputs/acceptance-final/${proofDirectory}-final`,
      },
    ].entries()) {
      const frameTop = top
        + headerHeight
        + sequenceIndex * (frameHeight + frameLabelHeight + sequenceGap);
      for (let phaseIndex = 0; phaseIndex < phases.length; phaseIndex += 1) {
        const [phase, phaseLabel] = phases[phaseIndex];
        const source = await requireFile(absolute(
          `${sequence.sourceRoot}/chromium-844x390-dpr3-auto-${unitKind}-${phase}.png`,
        ));
        sources.push(source);
        const frameLeft = left + phaseIndex * (frameWidth + gap);
        composites.push({
          input: await resizedFrame(source, frameWidth, frameHeight),
          left: frameLeft,
          top: frameTop,
        });
        composites.push({
          input: labelSvg(
            frameWidth,
            frameLabelHeight,
            `${sequence.label} / ${phaseLabel}`,
            sequence.label === "BEFORE" ? "#55362f" : "#214b3d",
            9,
          ),
          left: frameLeft,
          top: frameTop + frameHeight,
        });
      }
    }
  }

  const outputPath = path.join(outputDir, "all-sixteen-walk-before-after.png");
  await sharp({
    create: {
      width: columns * cardWidth,
      height: Math.ceil(unitKinds.length / columns) * cardHeight,
      channels: 4,
      background: "#0b0f12",
    },
  }).composite(composites).png().toFile(outputPath);
  return { outputPath, sources };
}

async function buildPlayerFacingCorrectionsSheet() {
  const frames = [
    [
      "outputs/acceptance-final/manual-abilities-final/chromium-844x390-ready-1.png",
      "ALL 16 READY ICONS",
    ],
    [
      "outputs/acceptance-final/representative-six-final/chromium-844x390-dpr3-auto-crazy-king-special-1x.png",
      "CRAZY KING ACTIVE",
    ],
    [
      "outputs/acceptance-final/representative-six-final/chromium-844x390-dpr3-auto-crazy-king-special-recovery-1x.png",
      "CRAZY KING PAUSE CONTINUITY",
    ],
    [
      "outputs/acceptance-final/representative-six-final/chromium-844x390-dpr3-auto-crazy-king-06-attack-recovery.png",
      "CRAZY KING BATTLE RECOVERY",
    ],
    [
      "outputs/acceptance-final/representative-six-final/chromium-844x390-dpr3-auto-gunner-05-attack-active.png",
      "RAIDER ATTACK RIGHT",
    ],
    [
      "outputs/acceptance-final/representative-six-final/chromium-844x390-dpr3-auto-gunner-08-retarget-active-left.png",
      "RAIDER RETARGET LEFT",
    ],
    [
      "outputs/acceptance-final/route-cart-final/chromium-stage12-844x390-route-terminal.png",
      "AI TERMINAL RECOVERY",
    ],
    [
      "outputs/acceptance-final/route-cart-final/chromium-stage12-844x390-route-resumed.png",
      "AI ATTACK RESUMED",
    ],
    [
      "outputs/acceptance-final/route-cart-final/chromium-stage12-844x390-cart-start.png",
      "MAINTENANCE CART START",
    ],
    [
      "outputs/acceptance-final/route-cart-final/chromium-stage12-844x390-cart-moving.png",
      "MAINTENANCE CART MOVING",
    ],
    [
      "outputs/acceptance-final/route-cart-final/chromium-stage12-844x390-cart-damaged.png",
      "MAINTENANCE CART DAMAGED",
    ],
  ];
  const columns = 5;
  const cardWidth = 336;
  const imageHeight = 154;
  const labelHeight = 30;
  const cardHeight = imageHeight + labelHeight;
  const composites = [];
  const sources = [];

  for (let index = 0; index < frames.length; index += 1) {
    const [relativePath, label] = frames[index];
    const source = await requireFile(absolute(relativePath));
    sources.push(source);
    const left = (index % columns) * cardWidth;
    const top = Math.floor(index / columns) * cardHeight;
    composites.push({
      input: await resizedFrame(source, cardWidth - 4, imageHeight),
      left,
      top,
    });
    composites.push({
      input: labelSvg(cardWidth - 4, labelHeight, label, "#202830", 12),
      left,
      top: top + imageHeight,
    });
  }

  const outputPath = path.join(outputDir, "player-facing-corrections.png");
  await sharp({
    create: {
      width: columns * cardWidth,
      height: Math.ceil(frames.length / columns) * cardHeight,
      channels: 4,
      background: "#0b0f12",
    },
  }).composite(composites).png().toFile(outputPath);
  return { outputPath, sources };
}

const trackedWorktreeStatus = await gitOutput(
  "status",
  "--porcelain",
  "--untracked-files=no",
);
invariant(
  trackedWorktreeStatus.length === 0,
  "Acceptance evidence must be generated from a committed tracked source state",
);

await mkdir(outputDir, { recursive: true });

const reports = Object.fromEntries(await Promise.all(
  Object.entries(sourcePaths).map(async ([key, relativePath]) => [
    key,
    await readJson(relativePath),
  ]),
));
const sourceHashes = Object.fromEntries(await Promise.all(
  Object.entries(sourcePaths).map(async ([key, relativePath]) => [
    key,
    {
      path: relativePath,
      sha256: await sha256(absolute(relativePath)),
    },
  ]),
));
const reportLockPath =
  "docs/qa/v095/acceptance-corrections/report-lock.json";
const reportLock = await readJson(reportLockPath);
const sourceHeadSha = await gitOutput("rev-parse", "HEAD");
const sourceBranch = await gitOutput("branch", "--show-current");
const lockedProductMergeBase = await gitOutput(
  "merge-base",
  sourceHeadSha,
  reportLock.productSourceCommitSha,
);
invariant(
  reportLock.lockVersion === "0.9.5-acceptance-report-lock-v1"
    && /^[a-f0-9]{40}$/u.test(reportLock.productSourceCommitSha ?? "")
    && lockedProductMergeBase === reportLock.productSourceCommitSha,
  "Acceptance report lock is not an ancestor of the evidence source",
);
const productDiffPaths = (
  await gitOutput(
    "diff",
    "--name-only",
    `${reportLock.productSourceCommitSha}..${sourceHeadSha}`,
  )
).split(/\r?\n/u).filter(Boolean);
const allowedPostProductPaths = [
  /^docs\/qa\/v095\/acceptance-corrections\//u,
  /^docs\/qa\/v095\/rc\/README\.md$/u,
  /^scripts\/v095-acceptance-correction-evidence\.mjs$/u,
  /^scripts\/v095-deployment-baseline-browser-capture\.mjs$/u,
  /^scripts\/v095-merge-(?:representative|residual)-qa-evidence\.mjs$/u,
  /^scripts\/v095-residual-bugs-browser-smoke\.mjs$/u,
  /^tests\/rc-browser-gates\.test\.mjs$/u,
];
invariant(
  productDiffPaths.every((filePath) => (
    allowedPostProductPaths.some((pattern) => pattern.test(filePath))
  )),
  `Product files changed after the locked source commit: ${productDiffPaths
    .filter((filePath) => (
      !allowedPostProductPaths.some((pattern) => pattern.test(filePath))
    ))
    .join(", ")}`,
);
for (const [key, lockedReport] of Object.entries(reportLock.reports ?? {})) {
  invariant(sourceHashes[key], `Locked report key is unknown: ${key}`);
  invariant(
    sourceHashes[key].path === lockedReport.path
      && sourceHashes[key].sha256 === lockedReport.sha256,
    `${key} no longer matches the committed acceptance report lock`,
  );
}
const unlockedLegacyKeys = Object.keys(sourcePaths).filter(
  (key) => !reportLock.reports?.[key],
);
invariant(
  unlockedLegacyKeys.length === 0,
  `Acceptance report lock omitted source reports: ${unlockedLegacyKeys.join(", ")}`,
);

const buildBoundReportKeys = [
  "residualAttack",
  "residualDeployment",
  "deploymentSequence",
  "representativeSix",
  "remainingTen",
  "combatPresentation",
  "assetDecodeAudio",
  "performanceNormal",
  "performanceSurvivalAuto",
  "performanceSurvivalPowerSave",
];
const finalBuildIdentity = reports.residualAttack.buildIdentity?.combinedSha256;
const currentBuildIdentity = await productionBuildIdentity(root);
invariant(
  finalBuildIdentity
    && currentBuildIdentity.scope === "dist-recursive"
    && currentBuildIdentity.combinedSha256 === finalBuildIdentity
    && reportLock.finalProductionBuildSha256 === finalBuildIdentity,
  "Current dist does not match the locked final production build",
);
for (const key of buildBoundReportKeys) {
  const report = reports[key];
  invariant(
    report.buildIdentityStable === true
      && report.buildIdentity?.scope === "dist-recursive"
      && report.buildIdentityAtStart?.combinedSha256 === finalBuildIdentity
      && report.buildIdentity?.combinedSha256 === finalBuildIdentity,
    `${key} is not a stable direct run of the single final production build`,
  );
}

invariant(
  reports.residualAttack.expectedTotal === 96
    && reports.residualAttack.total === 96
    && reports.residualAttack.passed === 96
    && reports.residualAttack.failed === 0
    && reports.residualAttack.mode === "attack"
    && reports.residualAttack.scope === "full"
    && reports.residualAttack.canonicalAxes === true,
  "P0 residual attack evidence is not a direct canonical 96/96 matrix",
);
const locomotionSpritesByUnit = new Map(unitKinds.map((kind) => [kind, new Set()]));
for (const result of reports.residualDeployment.results ?? []) {
  const sprites = locomotionSpritesByUnit.get(result.unitKind);
  for (const sprite of result.locomotionSprites ?? []) sprites?.add(sprite);
}
invariant(
  reports.residualDeployment.expectedTotal === 576
    && reports.residualDeployment.total === 576
    && reports.residualDeployment.passed === 576
    && reports.residualDeployment.failed === 0
    && reports.residualDeployment.mode === "deployment-matrix"
    && reports.residualDeployment.scope === "full"
    && reports.residualDeployment.canonicalAxes === true
    && reports.residualDeployment.unitLayerAuditCaseCount === 96
    && reports.residualDeployment.unitLayerAuditFrameCount === 192
    && [...locomotionSpritesByUnit.values()].every(
      (sprites) => sprites.has("walk-a") && sprites.has("walk-b"),
    ),
  "P0 deployment evidence is not a direct canonical 576/576 all-sixteen matrix",
);
const deploymentSequencePhases = [
  "door",
  "boundary",
  "ramp",
  "exit",
  "landing",
  "ready",
];
const baselineDeploymentFrames = (
  reports.deploymentSequenceBefore.results ?? []
).flatMap(({ frames = [] }) => frames);
const baselineTranslucentFrames = baselineDeploymentFrames.filter(
  ({ fighter }) => (
    Number(fighter?.animationPresentation?.pose?.opacity) < 1
    || Number(fighter?.renderAudit?.poseOpacity) < 1
    || Number(fighter?.renderAudit?.effectiveOpacity) < 1
  ),
);
invariant(
  reports.deploymentSequenceBefore.purpose
      === "technical-rc-before-visual-context"
    && reports.deploymentSequenceBefore.acceptanceGate === false
    && reports.deploymentSequenceBefore.sourceCommit
      === expectedIntegrationBaseSha
    && reports.deploymentSequenceBefore.expectedSourceCommit
      === expectedIntegrationBaseSha
    && reports.deploymentSequenceBefore.engine === "chromium"
    && JSON.stringify(reports.deploymentSequenceBefore.viewport)
      === JSON.stringify({ width: 844, height: 390 })
    && reports.deploymentSequenceBefore.quality === "auto"
    && reports.deploymentSequenceBefore.speed === 1
    && reports.deploymentSequenceBefore.expectedCases === unitKinds.length
    && reports.deploymentSequenceBefore.capturedCases === unitKinds.length
    && reports.deploymentSequenceBefore.expectedFrames
      === unitKinds.length * deploymentSequencePhases.length
    && reports.deploymentSequenceBefore.capturedFrames
      === unitKinds.length * deploymentSequencePhases.length
    && reports.deploymentSequenceBefore.buildIdentityStable === true
    && reports.deploymentSequenceBefore.buildIdentityAtStart?.scope
      === "dist-recursive"
    && reports.deploymentSequenceBefore.buildIdentityAtStart?.combinedSha256
      === reports.deploymentSequenceBefore.buildIdentityAtEnd?.combinedSha256
    && reports.deploymentSequenceBefore.diagnosticCount === 0
    && reports.deploymentSequenceBefore.results.every((result) => (
      result.status === "captured"
      && JSON.stringify(result.frames.map(({ phase }) => phase))
        === JSON.stringify(deploymentSequencePhases)
      && result.frames.every((frame, index) => (
        index === 0 || frame.fighter.x >= result.frames[index - 1].fighter.x
      ))
    ))
    && baselineTranslucentFrames.length > 0,
  "Technical RC deployment baseline is not an exact, stable all-sixteen sequence",
);
invariant(
  reports.deploymentSequence.mode === "deployment-matrix"
    && reports.deploymentSequence.scope === "focused"
    && reports.deploymentSequence.continuousDeploymentSequence === true
    && reports.deploymentSequence.expectedTotal === 16
    && reports.deploymentSequence.total === 16
    && reports.deploymentSequence.passed === 16
    && reports.deploymentSequence.failed === 0
    && reports.deploymentSequence.unitLayerAuditCaseCount === 16
    && reports.deploymentSequence.unitLayerAuditFrameCount === 96
    && JSON.stringify(reports.deploymentSequence.engines) === JSON.stringify(["chromium"])
    && JSON.stringify(reports.deploymentSequence.viewports)
      === JSON.stringify([{ width: 844, height: 390 }])
    && JSON.stringify(reports.deploymentSequence.qualities) === JSON.stringify(["auto"])
    && JSON.stringify(reports.deploymentSequence.speeds) === JSON.stringify([1])
    && reports.deploymentSequence.results.every((result) => (
      JSON.stringify(result.frames.map(({ phase }) => phase))
        === JSON.stringify(deploymentSequencePhases)
      && result.frames.every(({ fighter }) => (
        fighter.renderAudit.poseOpacity === 1
        && fighter.renderAudit.effectiveOpacity === 1
        && fighter.animationPresentation.pose.opacity === 1
      ))
      && result.locomotionSprites.includes("walk-a")
      && result.locomotionSprites.includes("walk-b")
    )),
  "P0 deployment sequence is not a direct six-phase all-sixteen proof",
);

const manualRows = reports.manualAbilities.results ?? [];
const manualActivations = manualRows.reduce(
  (total, row) => total + (row.activations?.length ?? 0),
  0,
);
const manualLifecycleRows = manualRows.filter(({ lifecycle }) => lifecycle);
const crazyKingContinuityRows = manualRows.filter(
  ({ crazyKingIndicatorContinuity }) => crazyKingIndicatorContinuity,
);
const p03LifecycleRows = manualRows.filter(
  ({ p03LifecycleGaps }) => p03LifecycleGaps,
);
const p03LifecycleProofCategories = manualRows.reduce(
  (total, row) => total
    + Object.keys(row.p03LifecycleGaps ?? {}).length,
  0,
);
invariant(
  reports.manualAbilities.cases === 6
    && manualRows.length === 6
    && manualRows.every(({ readyIcons }) => readyIcons?.length === 16)
    && manualActivations === 32
    && manualLifecycleRows.length === 2
    && crazyKingContinuityRows.length === 2
    && p03LifecycleRows.length === 2
    && p03LifecycleProofCategories === 8
    && manualRows.every(({ offFloorCount = 0 }) => offFloorCount === 0)
    && resultsDiagnosticCount(manualRows) === 0,
  "P0 manual ability browser evidence is incomplete",
);

invariant(
  reports.representativeSix.proofScope === "representative-six"
    && reports.representativeSix.totals?.cases === 4
    && reports.representativeSix.totals?.passed === 4
    && reports.representativeSix.totals?.failed === 0
    && resultsDiagnosticCount(reports.representativeSix.results ?? []) === 0,
  "Representative-six correction evidence failed",
);
invariant(
  reports.remainingTen.proofScope === "remaining-ten"
    && reports.remainingTen.totals?.cases === 4
    && reports.remainingTen.totals?.passed === 4
    && reports.remainingTen.totals?.failed === 0
    && resultsDiagnosticCount(reports.remainingTen.results ?? []) === 0,
  "Remaining-ten correction evidence is not a direct 4/4 result",
);

const infectedRows = reports.aiMission.results.filter(
  ({ snapshot }) => snapshot?.infectedAbilityLifecycle,
);
const infectedKinds = new Set();
let infectedActivations = 0;
let infectedLifecycleProofCategories = 0;
for (const row of infectedRows) {
  for (const [kind, lifecycle] of Object.entries(
    row.snapshot.infectedAbilityLifecycle,
  )) {
    infectedKinds.add(kind);
    infectedLifecycleProofCategories += 1;
    invariant(
      lifecycle.firstWarningAt < lifecycle.firstActiveAt,
      `Infected lifecycle warning did not precede active for ${kind}`,
    );
    const completedActivations = lifecycle.completedActivations?.length ?? 0;
    invariant(
      completedActivations >= 1,
      `Infected lifecycle did not complete for ${kind}`,
    );
    infectedActivations += completedActivations;
  }
}
invariant(
  reports.aiMission.passed === 120
    && reports.aiMission.failed === 0
    && reports.aiMission.results.length === 120
    && infectedRows.length === 24
    && infectedKinds.size === 6
    && infectedLifecycleProofCategories === 36
    && infectedActivations >= infectedLifecycleProofCategories
    && resultsDiagnosticCount(reports.aiMission.results) === 0,
  "AI mission matrix or infected lifecycle evidence failed",
);

const routeRows = reports.routeCart.results ?? [];
const cartFrames = routeRows.flatMap(({ cartFrames: frames = [] }) => frames);
const cartStates = new Set(cartFrames.map(({ state }) => state));
invariant(
  reports.routeCart.total === 12
    && reports.routeCart.passed === 12
    && reports.routeCart.failed === 0
    && routeRows.length === 12
    && routeRows.every(({ status }) => status === "passed")
    && routeRows.every(({ routeRelease }) =>
      routeRelease?.terminal?.navigationRecovery?.recoveryCount === 3
      && routeRelease.terminal.navigationRecovery.recoveryExhausted === true
      && routeRelease.audit?.routeReleaseCount === 1
      && routeRelease.resumed?.finalAttackSequence
        > routeRelease.resumed?.releaseAttackSequence
      && routeRelease.resumed?.finalThreatHp
        < routeRelease.resumed?.initialThreatHp)
    && cartFrames.length === 72
    && cartStates.size === 6
    && cartFrames.every(({ object }) =>
      object?.assetLoaded === true
      && object.naturalWidth === 480
      && object.naturalHeight === 168
      && object.geometricFallbackAllowed === false)
    && resultsDiagnosticCount(routeRows) === 0,
  "Route release or maintenance cart evidence failed",
);

invariant(
  reports.survival.length === 6
    && reports.survival.every(({ status }) => status === "passed")
    && reports.survival.every(({ settlementRetryProof }) =>
      settlementRetryProof?.beforeFailure === 0
      && settlementRetryProof.afterFailure === 1
      && settlementRetryProof.whileAwaitingRetry === 1
      && settlementRetryProof.afterManualRetry === 2)
    && resultsDiagnosticCount(reports.survival) === 0,
  "Survival correction evidence failed",
);
invariant(
  reports.outbreak.length === 6
    && reports.outbreak.every(({ status }) => status === "passed")
    && reports.outbreak.filter(({ fullRuntime }) => fullRuntime?.resultId).length === 1,
  "Outbreak correction evidence failed",
);
invariant(
  reports.enemyVfx.total === 6
    && reports.enemyVfx.passed === 6
    && reports.enemyVfx.failed === 0
    && reports.enemyVfx.productionProjectileTransactions === 24
    && reports.enemyVfx.productionCrawlerTransactions === 6
    && reports.enemyVfx.continuousSequences === 24
    && diagnosticCount(reports.enemyVfx.diagnostics) === 0
    && resultsDiagnosticCount(reports.enemyVfx.results ?? []) === 0,
  "Enemy/VFX correction evidence failed",
);
invariant(
  reports.crawlerDefense.total === 240
    && reports.crawlerDefense.passed === 240
    && reports.crawlerDefense.failed === 0
    && reports.crawlerDefense.passThroughs === 0
    && reports.crawlerDefense.objectiveDirects === 0
    && resultsDiagnosticCount(reports.crawlerDefense.results ?? []) === 0,
  "CRAWLER defense correction evidence failed",
);
invariant(
  reports.battleSpace.passed === 4
    && reports.battleSpace.failed === 0
    && resultsDiagnosticCount(reports.battleSpace.results ?? []) === 0,
  "Battle-space correction evidence failed",
);
const deferredProjectileProofs = (reports.combatPresentation.results ?? [])
  .flatMap(({ deferredProjectileProofs: proofs = [] }) => proofs);
const babaSpecialKillProofs = deferredProjectileProofs.filter(
  ({ unitKind, lethal }) => unitKind === "babayaga" && lethal === true,
);
invariant(
  reports.combatPresentation.passed === 4
    && reports.combatPresentation.failed === 0
    && deferredProjectileProofs.length === 36
    && deferredProjectileProofs.every((proof) => (
      proof.launch?.hp === proof.initialTargetHp
      && proof.launch?.numericDamageTexts?.length === 0
      && proof.hpSamples?.length >= 2
      && proof.finalNumericDamageTexts?.length > 0
      && proof.pendingAfterProof === 0
    ))
    && babaSpecialKillProofs.length === 4
    && babaSpecialKillProofs.every((proof) => (
      proof.launch.babaSpecialKillCueCount === 0
      && proof.finalBabaSpecialKillCueCount === 1
      && proof.finalBabaHitCueCount === 1
    ))
    && resultsDiagnosticCount(reports.combatPresentation.results ?? []) === 0,
  "Combat-presentation correction evidence failed",
);
invariant(
  reports.mobileLifecycle.runMode === "diagnostic"
    && reports.mobileLifecycle.failed === 0
    && reports.mobileLifecycle.results?.length === 4
    && reports.mobileLifecycle.passed
      + reports.mobileLifecycle.passedWithCapabilityGaps === 4
    && resultsDiagnosticCount(reports.mobileLifecycle.results) === 0,
  "Mobile lifecycle diagnostic failed",
);
invariant(
  reports.assetDecodeAudio.result?.status === "passed"
    && reports.assetDecodeAudio.result.audioDecoded === 399
    && reports.assetDecodeAudio.result.portraitDecoded === 34
    && reports.assetDecodeAudio.result.imageDecoded === 58
    && reports.assetDecodeAudio.result.failures?.length === 0
    && reports.assetDecodeAudio.result.babaPlayed === true
    && reports.assetDecodeAudio.result.babaDedupeMatched === true
    && reports.assetDecodeAudio.result.babaMetricsPass === true
    && reports.assetDecodeAudio.result.relativeMetricsPass === true
    && reports.assetDecodeAudio.result.weaponProfiles?.babayaga?.assetGain === .95
    && reports.assetDecodeAudio.result.runtimeMixes.every(
      ({ clipSamples }) => clipSamples === 0,
    )
    && diagnosticCount(reports.assetDecodeAudio.diagnostics) === 0,
  "Asset decode or Baba audio evidence failed",
);
invariant(
  reports.saveOrigin.version === "0.9.5"
    && reports.saveOrigin.baseline?.version === "0.9.0"
    && reports.saveOrigin.baseline.sourceSchemaVersion === 13
    && reports.saveOrigin.targetSchemaVersion === 14
    && reports.saveOrigin.migration?.revisionAdvancedOnce === true
    && reports.saveOrigin.migration?.idempotent === true
    && reports.saveOrigin.browserMatrix?.passed === 78
    && reports.saveOrigin.browserMatrix?.failed === 0,
  "Save migration/origin evidence failed",
);
invariant(
  reports.employmentUnlock.employmentBrowserMatrix?.passed === 6
    && reports.employmentUnlock.employmentBrowserMatrix?.failed === 0
    && reports.employmentUnlock.wave20RuntimeEntryMatrix?.passed === 2
    && reports.employmentUnlock.wave20RuntimeEntryMatrix?.failed === 0,
  "Employment/Mayo Wave 20 evidence failed",
);

const {
  performanceNormal,
  performanceSurvivalAuto,
  performanceSurvivalPowerSave,
} = reports;
for (const [label, report] of [
  ["normal Auto", performanceNormal],
  ["Survival Auto", performanceSurvivalAuto],
  ["Survival Power-save", performanceSurvivalPowerSave],
]) {
  invariant(
    report.resultVersion === "0.9.5-acceptance-corrected",
    `${label} tested an unexpected build identity`,
  );
  invariant(report.gate?.passed === true, `${label} performance gate failed`);
  invariant(report.durationMs >= 900_000, `${label} was not a 15-minute run`);
  invariant(
    report.battleCoveragePercent >= 95,
    `${label} did not maintain the required battle coverage`,
  );
  invariant(
    diagnosticCount(report.diagnostics) === 0,
    `${label} has browser diagnostics`,
  );
}
invariant(
  performanceNormal.requestedScenario === "normal-stress"
    && performanceNormal.requestedGraphicsQuality === "auto",
  "Normal performance scenario mismatch",
);
invariant(
  performanceSurvivalAuto.requestedScenario === "survival-wave20-stress"
    && performanceSurvivalAuto.requestedGraphicsQuality === "auto"
    && performanceSurvivalPowerSave.requestedScenario
      === "survival-wave20-stress"
    && performanceSurvivalPowerSave.requestedGraphicsQuality === "power-save",
  "Survival performance scenario mismatch",
);
const stableHarnessKeys = [
  "measurementStartsAfterBattleEntry",
  "frameCapacity",
  "animationFrameDomProbe",
  "runtimeDiagnosticsPollMs",
  "retainedHeapGcCheckpoints",
];
const stableHarnessConfiguration = (report) => Object.fromEntries(
  stableHarnessKeys.map((key) => [key, report.harness?.[key]]),
);
const sameScenarioConditionsMatched = (
  performanceSurvivalAuto.runMode === performanceSurvivalPowerSave.runMode
  && performanceSurvivalAuto.engine === "chromium"
  && performanceSurvivalAuto.engine === performanceSurvivalPowerSave.engine
  && performanceSurvivalAuto.durationMs === performanceSurvivalPowerSave.durationMs
  && sameJson(performanceSurvivalAuto.viewport, performanceSurvivalPowerSave.viewport)
  && performanceSurvivalAuto.deviceScaleFactor
    === performanceSurvivalPowerSave.deviceScaleFactor
  && performanceSurvivalAuto.requestedScenario
    === performanceSurvivalPowerSave.requestedScenario
  && sameJson(
    performanceSurvivalAuto.scenario?.initialProof,
    performanceSurvivalPowerSave.scenario?.initialProof,
  )
  && sameJson(
    stableHarnessConfiguration(performanceSurvivalAuto),
    stableHarnessConfiguration(performanceSurvivalPowerSave),
  )
);
invariant(
  sameScenarioConditionsMatched,
  "Survival Auto and Power-save reports are not same-condition evidence",
);
for (const [label, report] of [
  ["Survival Auto", performanceSurvivalAuto],
  ["Survival Power-save", performanceSurvivalPowerSave],
]) {
  invariant(
    report.scenario?.repreparations === 0
      && report.scenario?.finalProof?.phase === "in-wave"
      && report.scenario.finalProof.over === false
      && report.scenario.finalProof.humanAttackSequences > 0
      && report.scenario.finalProof.enemyAttackSequences > 0,
    `${label} did not preserve one continuous active Wave 20 battle`,
  );
}
const attackActivityMatched = (
  relativeDifference(
    performanceSurvivalAuto.scenario.finalProof.humanAttackSequences,
    performanceSurvivalPowerSave.scenario.finalProof.humanAttackSequences,
  ) <= .02
  && relativeDifference(
    performanceSurvivalAuto.scenario.finalProof.enemyAttackSequences,
    performanceSurvivalPowerSave.scenario.finalProof.enemyAttackSequences,
  ) <= .02
);
invariant(
  attackActivityMatched,
  "Auto and Power-save changed combat activity by more than 2%",
);
const outcomeKeys = [
  "runId",
  "phase",
  "currentWave",
  "reachedWave",
  "lastCompletedWave",
  "runtimeWaveQueued",
  "receiptId",
  "paused",
  "over",
  "won",
  "baseHp",
  "baseMaxHp",
  "livingHumanFighters",
  "livingEnemyFighters",
];
const gameplayOutcome = (report) => Object.fromEntries(
  outcomeKeys.map((key) => [key, report.scenario?.finalProof?.[key]]),
);
const sameScenarioGameplayOutcomeMatched = (
  sameScenarioConditionsMatched
  && attackActivityMatched
  && sameJson(
    gameplayOutcome(performanceSurvivalAuto),
    gameplayOutcome(performanceSurvivalPowerSave),
  )
);
invariant(
  sameScenarioGameplayOutcomeMatched,
  "Auto and Power-save did not preserve the same gameplay outcome",
);
invariant(
  performanceSurvivalPowerSave.runtimePerformance?.effectiveRenderHz <= 33,
  "Power-save did not reach the intended 30 fps render band",
);

const integrationBaseSha = await gitOutput(
  "merge-base",
  "HEAD",
  "origin/integration/0.9.5",
);
invariant(
  sourceBranch === "codex/0.9.5-acceptance-corrections",
  `Unexpected evidence branch: ${sourceBranch}`,
);
invariant(
  integrationBaseSha === expectedIntegrationBaseSha,
  `Unexpected integration base: ${integrationBaseSha}`,
);
const deploymentSheet = await buildDeploymentSequenceSheet();
const walkBeforeAfterSheet = await buildWalkBeforeAfterSheet();
const correctionsSheet = await buildPlayerFacingCorrectionsSheet();
const deploymentFrameHashes = Object.fromEntries(await Promise.all(
  deploymentSheet.sources.map(async (filePath) => [
    relative(filePath),
    await sha256(filePath),
  ]),
));
const walkBeforeAfterFrameHashes = Object.fromEntries(await Promise.all(
  walkBeforeAfterSheet.sources.map(async (filePath) => [
    relative(filePath),
    await sha256(filePath),
  ]),
));
const correctionFrameHashes = Object.fromEntries(await Promise.all(
  correctionsSheet.sources.map(async (filePath) => [
    relative(filePath),
    await sha256(filePath),
  ]),
));

function performanceMetrics(report) {
  return {
    resultVersion: report.resultVersion,
    durationMs: report.durationMs,
    battleCoveragePercent: report.battleCoveragePercent,
    medianFrameMs: report.medianFrameMs,
    p95FrameMs: report.p95FrameMs,
    maxFrameGapMs: report.maxFrameGapMs,
    retainedHeapGrowthPercent: report.retainedHeapGrowthPercent,
    memoryProxyGrowthPercent: report.memoryProxyGrowthPercent,
    effectiveSimulationHz: report.runtimePerformance?.effectiveSimulationHz,
    effectiveRenderHz: report.runtimePerformance?.effectiveRenderHz,
    renderToSimulationRatio: report.runtimePerformance?.renderToSimulationRatio,
    gatePassed: report.gate.passed,
  };
}

const renderWorkProxy = (report) => (
  report.runtimePerformance.renderFrameDelta
  * report.runtimePerformance.after.graphicsProfile.dprCap ** 2
  * report.runtimePerformance.after.graphicsProfile.effectDensity
);
const autoRenderWorkProxy = renderWorkProxy(performanceSurvivalAuto);
const powerSaveRenderWorkProxy = renderWorkProxy(
  performanceSurvivalPowerSave,
);
const renderWorkReductionPercent = (
  1 - powerSaveRenderWorkProxy / autoRenderWorkProxy
) * 100;
invariant(
  Number.isFinite(renderWorkReductionPercent)
    && renderWorkReductionPercent >= 25,
  "Power-save did not reduce the same-scenario render-work proxy by 25%",
);

const summary = {
  evidenceVersion: "0.9.5-producer-acceptance-correction-v1",
  version: "0.9.5",
  generatedAt: new Date().toISOString(),
  branch: sourceBranch,
  sourceHeadSha,
  integrationBaseSha,
  canonicalAuthority: {
    issue: 96,
    commentId: 5124971857,
    url: "https://github.com/SUSANO-OOO/Zombieee/issues/96#issuecomment-5124971857",
  },
  acceptance: {
    p0_1CrawlerDeploymentOpacity: {
      casesPassed: reports.residualDeployment.passed,
      casesFailed: reports.residualDeployment.failed,
      unitLayerAuditCases: reports.residualDeployment.unitLayerAuditCaseCount,
      unitLayerAuditFrames: reports.residualDeployment.unitLayerAuditFrameCount,
      continuousSequenceCases: reports.deploymentSequence.passed,
      continuousSequenceFrames:
        reports.deploymentSequence.unitLayerAuditFrameCount,
      continuousSequencePhases: deploymentSequencePhases,
      beforeSequenceSourceCommit:
        reports.deploymentSequenceBefore.sourceCommit,
      beforeSequenceBuildSha256:
        reports.deploymentSequenceBefore.buildIdentityAtEnd.combinedSha256,
      beforeSequenceFrames: reports.deploymentSequenceBefore.capturedFrames,
      beforeTranslucentFrames: baselineTranslucentFrames.length,
      beforeMinimumPoseOpacity: Math.min(
        ...baselineDeploymentFrames.map(
          ({ fighter }) => fighter.animationPresentation.pose.opacity,
        ),
      ),
      correctedSequenceFrames:
        reports.deploymentSequence.unitLayerAuditFrameCount,
      effectiveOpacity: 1,
    },
    p0_2CrazyKingActiveIndicator: {
      lifecycleCases: crazyKingContinuityRows.length,
      passed: crazyKingContinuityRows.length,
      failed: 0,
    },
    p0_3AllSixteenManualDisplay: {
      browserCases: manualRows.length,
      readyIconsPerCase: 16,
      activations: manualActivations,
      lifecycleCases: manualLifecycleRows.length,
      lifecycleGapCases: p03LifecycleRows.length,
      lifecycleProofCategories: p03LifecycleProofCategories,
      diagnostics: 0,
    },
    p0_4RaiderMotion: {
      representativeCasesPassed: reports.representativeSix.totals.passed,
      representativeCasesFailed: reports.representativeSix.totals.failed,
      rightFacingAttackEvidence: true,
      leftRetargetEvidence: true,
    },
    p0_5BabaSfx: {
      played: reports.assetDecodeAudio.result.babaPlayed,
      dedupeMatched: reports.assetDecodeAudio.result.babaDedupeMatched,
      metricsPassed: reports.assetDecodeAudio.result.babaMetricsPass,
      relativeMetricsPassed:
        reports.assetDecodeAudio.result.relativeMetricsPass,
      assetGain:
        reports.assetDecodeAudio.result.weaponProfiles?.babayaga?.assetGain,
      runtimeMixesWithoutClipping:
        reports.assetDecodeAudio.result.runtimeMixes.length,
    },
    p0_6AllSixteenWalkSlide: {
      casesPassed: reports.residualDeployment.passed,
      casesFailed: reports.residualDeployment.failed,
      unitsWithWalkAAndWalkB:
        [...locomotionSpritesByUnit.values()].filter(
          (sprites) => sprites.has("walk-a") && sprites.has("walk-b"),
        ).length,
      continuousSequenceCases: reports.deploymentSequence.passed,
      continuousSequenceFrames:
        reports.deploymentSequence.unitLayerAuditFrameCount,
      alignedBeforeAfterSequenceFrames:
        reports.deploymentSequenceBefore.capturedFrames
        + reports.deploymentSequence.unitLayerAuditFrameCount,
      normalAttackCasesPassed: reports.residualAttack.passed,
      normalAttackCasesFailed: reports.residualAttack.failed,
      representativeCasesPassed: reports.representativeSix.totals.passed,
      remainingCasesPassed: reports.remainingTen.totals.passed,
    },
    p0_7CartObjectAi: {
      routeCasesPassed: reports.routeCart.passed,
      routeCasesFailed: reports.routeCart.failed,
      terminalRecoveries: routeRows.length,
      routeReleases: routeRows.length,
      resumedAttackAndDamage: routeRows.length,
      cartStateFrames: cartFrames.length,
      cartStates: [...cartStates].sort(),
    },
    p0_8GeneralAi: {
      missionCasesPassed: reports.aiMission.passed,
      missionCasesFailed: reports.aiMission.failed,
      infectedLifecycleCases: infectedRows.length,
      infectedLifecycleProofCategories,
      infectedKinds: [...infectedKinds].sort(),
      completedInfectedActivations: infectedActivations,
    },
    p0_9FormalSmallCart: {
      assetPath: cartFrames[0].object.assetPath,
      naturalWidth: cartFrames[0].object.naturalWidth,
      naturalHeight: cartFrames[0].object.naturalHeight,
      decodedFrames: cartFrames.length,
      geometricFallbackFrames: 0,
    },
  },
  crossAudit: {
    enemyVfx: {
      passed: reports.enemyVfx.passed,
      failed: reports.enemyVfx.failed,
      projectileTransactions:
        reports.enemyVfx.productionProjectileTransactions,
      crawlerTransactions: reports.enemyVfx.productionCrawlerTransactions,
      continuousSequences: reports.enemyVfx.continuousSequences,
      diagnostics: 0,
    },
    crawlerDefense: {
      passed: reports.crawlerDefense.passed,
      failed: reports.crawlerDefense.failed,
      passThroughs: reports.crawlerDefense.passThroughs,
      objectiveDirects: reports.crawlerDefense.objectiveDirects,
      diagnostics: 0,
    },
    battleSpace: {
      passed: reports.battleSpace.passed,
      failed: reports.battleSpace.failed,
      diagnostics: 0,
    },
    combatPresentation: {
      passed: reports.combatPresentation.passed,
      failed: reports.combatPresentation.failed,
      diagnostics: 0,
    },
    survival: {
      passed: reports.survival.length,
      failed: 0,
      atomicRetryReceipts: "0 -> 1 -> 1 -> 2",
      diagnostics: 0,
    },
    outbreak: {
      passed: reports.outbreak.length,
      failed: 0,
      fullRuntimeAtomicSettlements:
        reports.outbreak.filter(({ fullRuntime }) => fullRuntime?.resultId).length,
    },
    mobileLifecycle: {
      runMode: reports.mobileLifecycle.runMode,
      passed: reports.mobileLifecycle.passed,
      passedWithCapabilityGaps:
        reports.mobileLifecycle.passedWithCapabilityGaps,
      failed: reports.mobileLifecycle.failed,
      coverageGaps: [...new Set(
        reports.mobileLifecycle.results.flatMap(
          ({ coverageGaps = [] }) => coverageGaps,
        ),
      )],
      diagnostics: 0,
    },
    assetDecode: {
      audioDecoded: reports.assetDecodeAudio.result.audioDecoded,
      portraitsDecoded: reports.assetDecodeAudio.result.portraitDecoded,
      imagesDecoded: reports.assetDecodeAudio.result.imageDecoded,
      failures: reports.assetDecodeAudio.result.failures.length,
      diagnostics: 0,
    },
    saveMigrationAndOrigin: {
      sourceSchemaVersion:
        reports.saveOrigin.baseline.sourceSchemaVersion,
      targetSchemaVersion: reports.saveOrigin.targetSchemaVersion,
      passed: reports.saveOrigin.browserMatrix.passed,
      failed: reports.saveOrigin.browserMatrix.failed,
      idempotent: reports.saveOrigin.migration.idempotent,
      formalPagesPlayerStorageAccessed:
        reports.saveOrigin.origin.formalPagesPlayerStorageAccessed,
    },
    employmentAndMayo: {
      employmentPassed:
        reports.employmentUnlock.employmentBrowserMatrix.passed,
      employmentFailed:
        reports.employmentUnlock.employmentBrowserMatrix.failed,
      wave20EntryPassed:
        reports.employmentUnlock.wave20RuntimeEntryMatrix.passed,
      wave20EntryFailed:
        reports.employmentUnlock.wave20RuntimeEntryMatrix.failed,
    },
  },
  performanceComparison: {
    baselineVersion090: reports.priorRc.performanceComparison.baseline,
    priorRcNormalStressAuto:
      reports.priorRc.performanceComparison.rcNormalStressAuto,
    correctedNormalStressAuto: performanceMetrics(performanceNormal),
    correctedSurvivalWave20Auto:
      {
        ...performanceMetrics(performanceSurvivalAuto),
        renderWorkProxy: Number(autoRenderWorkProxy.toFixed(2)),
      },
    correctedSurvivalWave20PowerSave:
      {
        ...performanceMetrics(performanceSurvivalPowerSave),
        renderWorkProxy: Number(powerSaveRenderWorkProxy.toFixed(2)),
      },
    sameScenarioAutoToPowerSaveRenderWorkProxyReductionPercent:
      Number(renderWorkReductionPercent.toFixed(2)),
    sameScenarioConditionsMatched,
    sameScenarioGameplayOutcomeMatched,
  },
  evidenceImages: {
    allSixteenDeploymentBeforeAfterSequence: {
      path: relative(deploymentSheet.outputPath),
      sha256: await sha256(deploymentSheet.outputPath),
      sourceFrames: deploymentSheet.sources.length,
      historicalBeforeScope:
        "Exact integration base 5bc0d6b technical-RC capture; comparison context only.",
      correctedAfterScope:
        "Final frozen corrected build; all six phases have effective opacity 1.",
    },
    allSixteenWalkBeforeAfter: {
      path: relative(walkBeforeAfterSheet.outputPath),
      sha256: await sha256(walkBeforeAfterSheet.outputPath),
      sourceFrames: walkBeforeAfterSheet.sources.length,
      historicalBeforeScope:
        "Technical RC visual context only; six aligned motion/attack phases per unit.",
      correctedAfterScope:
        "Final frozen corrected build; six aligned motion/attack phases per unit.",
    },
    playerFacingCorrections: {
      path: relative(correctionsSheet.outputPath),
      sha256: await sha256(correctionsSheet.outputPath),
      sourceFrames: correctionsSheet.sources.length,
    },
  },
  rawEvidence: {
    reports: sourceHashes,
    deploymentFrameSha256: deploymentFrameHashes,
    walkBeforeAfterFrameSha256: walkBeforeAfterFrameHashes,
    correctionFrameSha256: correctionFrameHashes,
  },
  evidencePolicy: {
    reportLock: {
      path: reportLockPath,
      productSourceCommitSha: reportLock.productSourceCommitSha,
      finalProductionBuildSha256: reportLock.finalProductionBuildSha256,
      lockedReportCount: Object.keys(reportLock.reports).length,
      postProductChangedPaths: productDiffPaths,
    },
    finalProductionBuild: {
      identityScope: "dist-recursive",
      combinedSha256: finalBuildIdentity,
      currentDistVerified: currentBuildIdentity.combinedSha256 === finalBuildIdentity,
      directStableReportKeys: buildBoundReportKeys,
      crossBuildMergedEvidenceAccepted: false,
    },
    fullMatrices: [
      "residual attack 96 canonical cases",
      "deployment 576 canonical cases",
      "AI missions 120 canonical cases",
    ],
    directRunPolicy:
      "The named directStableReportKeys embed matching start/end recursive dist hashes. AI mission and feature-specific browser matrices are direct unmerged reports from the same frozen-dist QA window, but their legacy schemas do not independently embed that recursive hash; no stronger cryptographic claim is made.",
    historicalEvidencePolicy:
      "deploymentSequenceBefore is a non-gating visual capture from exact integration commit 5bc0d6b with its own stable recursive dist identity. priorRc is historical technical-RC/performance context from source 277047e. Neither is counted as corrected acceptance evidence.",
    substitutedEvidence: [
      "Headless Chromium/WebKit lifecycle diagnostics substitute for physical smartphone visibility, rotation-lock, speaker, and heat checks.",
      "Stages 14-20 were verified in browser QA; physical smartphone play remains pending.",
    ],
  },
  capabilityBoundary: {
    physicalSmartphoneHeatVerified: false,
    nativeSafariVerified: false,
    physicalSpeakerVerified: false,
    physicalTouchRotationLockRecoveryVerified: false,
    stages14To20PhysicalSmartphoneVerified: false,
  },
};

const summaryPath = path.join(outputDir, "acceptance-summary.json");
await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  summary: relative(summaryPath),
  allSixteenDeploymentSequence: relative(deploymentSheet.outputPath),
  allSixteenWalkBeforeAfter: relative(walkBeforeAfterSheet.outputPath),
  playerFacingCorrections: relative(correctionsSheet.outputPath),
  p0Passed: 9,
  p0Failed: 0,
  performanceGatesPassed: 3,
  renderWorkReductionPercent:
    summary.performanceComparison
      .sameScenarioAutoToPowerSaveRenderWorkProxyReductionPercent,
}, null, 2));
