import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";

const root = process.cwd();
const execFileAsync = promisify(execFile);
const outputDir = path.resolve(root, "docs/qa/v095/rc");
const normalPerformancePath = path.resolve(
  root,
  process.env.V095_RC_NORMAL_PERFORMANCE
    ?? "outputs/v095-rc/performance-normal-stress-auto-15m.json",
);
const survivalAutoPerformancePath = path.resolve(
  root,
  process.env.V095_RC_SURVIVAL_AUTO_PERFORMANCE
    ?? "outputs/v095-rc/performance-survival-wave20-auto-15m.json",
);
const powerSavePerformancePath = path.resolve(
  root,
  process.env.V095_RC_POWER_SAVE_PERFORMANCE
    ?? "outputs/v095-rc/performance-survival-wave20-power-save-15m.json",
);
const finalBrowserQaPaths = {
  representativeSix: path.resolve(root, "outputs/v095-representative-six/summary.json"),
  remainingTen: path.resolve(root, "outputs/v095-remaining-ten/summary.json"),
  enemyVfx: path.resolve(root, "outputs/v095-enemy-vfx-browser-smoke/summary.json"),
  residualBugs: path.resolve(root, "outputs/v095-residual-bugs-browser-smoke/summary.json"),
  employmentUnlock: path.resolve(root, "outputs/v095-employment-unlock/summary.json"),
  saveMigration: path.resolve(root, "outputs/save-migration-browser-matrix/summary.json"),
  mobileLifecycle: path.resolve(root, "outputs/v095-rc/mobile-lifecycle/summary.json"),
  assetDecode: path.resolve(root, "outputs/v095-rc/asset-decode/summary.json"),
  crawlerDefense: path.resolve(root, "outputs/v095-rc/crawler-defense/summary.json"),
  battleSpace: path.resolve(root, "outputs/battle-space-browser-smoke/summary.json"),
  bossFoundation: path.resolve(root, "outputs/boss-foundation-browser-smoke/report.json"),
  bossAnomalies: path.resolve(root, "outputs/v095-rc/boss-anomalies/report.json"),
  survivalWaves: path.resolve(root, "outputs/v095-rc/survival-wave-progression-final/summary.json"),
  outbreak: path.resolve(root, "outputs/outbreak-runtime-browser-smoke/report.json"),
  combatPresentation: path.resolve(root, "outputs/combat-presentation-browser-smoke/summary.json"),
};

const representativeUnits = [
  "scout",
  "gunner",
  "crazy-king",
  "tky",
  "mrs-chiha",
  "mayo-chan",
];
const remainingUnits = [
  "brawler",
  "ranger",
  "medic",
  "brute",
  "kumaverson",
  "babayaga",
  "guardian",
  "engineer",
  "zakimiya",
  "miyamoto-musashi",
];
const unitLabels = new Map([
  ["scout", "HACHI"],
  ["gunner", "IKURA"],
  ["crazy-king", "CRAZY KING"],
  ["tky", "TKY"],
  ["mrs-chiha", "MRS. CHIHA"],
  ["mayo-chan", "MAYO"],
  ["brawler", "PASEN"],
  ["ranger", "SUNA"],
  ["medic", "AOI"],
  ["brute", "GOTZ"],
  ["kumaverson", "KUMAVERSON"],
  ["babayaga", "BABAYAGA"],
  ["guardian", "GUARDIAN"],
  ["engineer", "ENGINEER"],
  ["zakimiya", "ZAKIMIYA"],
  ["miyamoto-musashi", "MUSASHI"],
]);

const vfxFrames = [
  ["ordinary-walker-warning-low-hp-frame-0", "WALKER WARNING + LOW HP"],
  ["enemy-spitter-frame-0", "SPITTER PROJECTILE"],
  ["enemy-ooze-frame-0", "OOZE PROJECTILE"],
  ["enemy-resonator-frame-1", "RESONATOR PROJECTILE"],
  ["enemy-choir-knot-frame-0", "CHOIR KNOT PROJECTILE"],
  ["boss-mother-warning-frame-1", "MOTHER WARNING"],
  ["boss-gairen-low-hp-frame-1", "GAIREN CRITICAL"],
  ["crawler-door-frame-0", "CRAWLER DOOR"],
  ["crawler-firing-frame-1", "CRAWLER FIRING"],
  ["crawler-hit-frame-0", "CRAWLER HIT"],
  ["crawler-critical-frame-0", "CRAWLER CRITICAL"],
  ["crawler-repair-frame-0", "CRAWLER REPAIR"],
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function sha256(filePath) {
  const bytes = await readFile(filePath);
  return createHash("sha256").update(bytes).digest("hex");
}

async function gitOutput(...args) {
  const { stdout } = await execFileAsync("git", args, { cwd: root });
  return stdout.trim();
}

function relative(filePath) {
  return path.relative(root, filePath).replaceAll("\\", "/");
}

async function requireFile(filePath) {
  await access(filePath);
  return filePath;
}

function imageLabelSvg(width, height, label, background = "#15191d") {
  return Buffer.from(
    `<svg width="${width}" height="${height}">
      <rect width="100%" height="100%" rx="5" fill="${background}"/>
      <text x="10" y="${Math.round(height * .68)}" fill="#f2f5f5"
        font-family="Arial, sans-serif" font-size="14" font-weight="700">${escapeXml(label)}</text>
    </svg>`,
  );
}

function diagnosticEntryCount(value) {
  if (!value || typeof value !== "object") return 0;
  return Object.values(value).reduce(
    (total, entries) => total + (Array.isArray(entries) ? entries.length : 0),
    0,
  );
}

function resultDiagnosticCount(results) {
  return results.reduce(
    (total, result) => total + diagnosticEntryCount(result?.diagnostics),
    0,
  );
}

function relativeDifference(left, right) {
  const maximum = Math.max(Math.abs(left), Math.abs(right), 1);
  return Math.abs(left - right) / maximum;
}

async function buildAllSixteenSheet() {
  const units = [...representativeUnits, ...remainingUnits];
  const cardWidth = 340;
  const cardHeight = 220;
  const headerHeight = 28;
  const shotWidth = 165;
  const shotHeight = 164;
  const shotLabelHeight = 24;
  const gap = 4;
  const columns = 4;
  const rows = Math.ceil(units.length / columns);
  const sheetWidth = columns * cardWidth;
  const sheetHeight = rows * cardHeight;
  const composites = [];
  const sources = [];

  for (let index = 0; index < units.length; index += 1) {
    const unit = units[index];
    const sourceDir = path.resolve(
      root,
      representativeUnits.includes(unit)
        ? "outputs/v095-representative-six"
        : "outputs/v095-remaining-ten",
    );
    const attackCandidates = [
      `chromium-844x390-dpr3-auto-${unit}-05-attack-active.png`,
      `chromium-844x390-dpr3-auto-${unit}-04-attack-active.png`,
    ];
    let attackPath = null;
    for (const candidate of attackCandidates) {
      try {
        attackPath = await requireFile(path.join(sourceDir, candidate));
        break;
      } catch {
        // Try the next authored active frame name.
      }
    }
    assert(attackPath, `Missing normal-attack active frame for ${unit}`);
    const specialPath = await requireFile(path.join(
      sourceDir,
      unit === "babayaga"
        ? "webkit-844x390-dpr3-auto-babayaga-special-1x.png"
        : `chromium-844x390-dpr3-auto-${unit}-special-1x.png`,
    ));
    sources.push(attackPath, specialPath);

    const left = (index % columns) * cardWidth;
    const top = Math.floor(index / columns) * cardHeight;
    composites.push({
      input: imageLabelSvg(cardWidth - gap, headerHeight, `${String(index + 1).padStart(2, "0")}  ${unitLabels.get(unit) ?? unit}`),
      left,
      top,
    });

    for (const [column, [source, label]] of [
      [0, [attackPath, "NORMAL ATTACK"]],
      [1, [specialPath, "MANUAL SPECIAL"]],
    ]) {
      const shotLeft = left + column * (shotWidth + gap);
      const image = await sharp(source)
        .resize(shotWidth, shotHeight, { fit: "cover", position: "centre" })
        .png()
        .toBuffer();
      composites.push({ input: image, left: shotLeft, top: top + headerHeight });
      composites.push({
        input: imageLabelSvg(shotWidth, shotLabelHeight, label, "#242a2f"),
        left: shotLeft,
        top: top + headerHeight + shotHeight,
      });
    }
  }

  const outputPath = path.join(outputDir, "all-sixteen-animation-evidence.png");
  await sharp({
    create: {
      width: sheetWidth,
      height: sheetHeight,
      channels: 4,
      background: "#0b0e10",
    },
  }).composite(composites).png().toFile(outputPath);
  return { outputPath, sources, units };
}

async function buildVfxSheet() {
  const sourceDir = path.resolve(root, "outputs/v095-enemy-vfx-browser-smoke");
  const cardWidth = 340;
  const cardHeight = 220;
  const shotHeight = 190;
  const columns = 4;
  const rows = Math.ceil(vfxFrames.length / columns);
  const composites = [];
  const sources = [];

  for (let index = 0; index < vfxFrames.length; index += 1) {
    const [basename, label] = vfxFrames[index];
    const source = await requireFile(path.join(sourceDir, `chromium-1280x720-${basename}.png`));
    sources.push(source);
    const left = (index % columns) * cardWidth;
    const top = Math.floor(index / columns) * cardHeight;
    const image = await sharp(source)
      .resize(cardWidth - 4, shotHeight, { fit: "cover", position: "centre" })
      .png()
      .toBuffer();
    composites.push({ input: image, left, top });
    composites.push({
      input: imageLabelSvg(cardWidth - 4, cardHeight - shotHeight, label, "#20262b"),
      left,
      top: top + shotHeight,
    });
  }

  const outputPath = path.join(outputDir, "vfx-enemy-boss-crawler-evidence.png");
  await sharp({
    create: {
      width: columns * cardWidth,
      height: rows * cardHeight,
      channels: 4,
      background: "#0b0e10",
    },
  }).composite(composites).png().toFile(outputPath);
  return { outputPath, sources };
}

await mkdir(outputDir, { recursive: true });

const [
  allSixteenSummary,
  representativeSummary,
  remainingSummary,
  enemyVfxSummary,
  v090Baseline,
  normalPerformance,
  survivalAutoPerformance,
  powerSavePerformance,
  finalRepresentative,
  finalRemaining,
  finalEnemyVfx,
  finalResidualBugs,
  finalEmploymentUnlock,
  finalSaveMigration,
  finalMobileLifecycle,
  finalAssetDecode,
  finalCrawlerDefense,
  finalBattleSpace,
  finalBossFoundation,
  finalBossAnomalies,
  finalSurvivalWaves,
  finalOutbreak,
  finalCombatPresentation,
] = await Promise.all([
  readJson(path.resolve(root, "docs/qa/v095/all-sixteen-animation-summary.json")),
  readJson(path.resolve(root, "docs/qa/v095/representative-six/representative-six-summary.json")),
  readJson(path.resolve(root, "docs/qa/v095/remaining-ten/remaining-ten-summary.json")),
  readJson(path.resolve(root, "docs/qa/v095/enemy-vfx/enemy-vfx-summary.json")),
  readJson(path.resolve(root, "docs/qa/v095/baseline/v090-performance-baseline.json")),
  readJson(normalPerformancePath),
  readJson(survivalAutoPerformancePath),
  readJson(powerSavePerformancePath),
  readJson(finalBrowserQaPaths.representativeSix),
  readJson(finalBrowserQaPaths.remainingTen),
  readJson(finalBrowserQaPaths.enemyVfx),
  readJson(finalBrowserQaPaths.residualBugs),
  readJson(finalBrowserQaPaths.employmentUnlock),
  readJson(finalBrowserQaPaths.saveMigration),
  readJson(finalBrowserQaPaths.mobileLifecycle),
  readJson(finalBrowserQaPaths.assetDecode),
  readJson(finalBrowserQaPaths.crawlerDefense),
  readJson(finalBrowserQaPaths.battleSpace),
  readJson(finalBrowserQaPaths.bossFoundation),
  readJson(finalBrowserQaPaths.bossAnomalies),
  readJson(finalBrowserQaPaths.survivalWaves),
  readJson(finalBrowserQaPaths.outbreak),
  readJson(finalBrowserQaPaths.combatPresentation),
]);

assert(allSixteenSummary.units === 16, "All-sixteen summary does not cover 16 units");
assert(allSixteenSummary.failedBrowserCases === 0, "All-sixteen summary has browser failures");
assert(allSixteenSummary.captures === 708, "All-sixteen summary capture count drifted");
assert(representativeSummary.browserMatrix.failed === 0, "Representative-six browser matrix failed");
assert(remainingSummary.browserMatrix.failed === 0, "Remaining-ten browser matrix failed");
assert(enemyVfxSummary.browserQa.enemyVfx.failed === 0, "Enemy/VFX browser matrix failed");
assert(normalPerformance.gate?.passed === true, "Normal-stress performance gate failed");
assert(normalPerformance.requestedScenario === "normal-stress", "Normal performance scenario mismatch");
assert(survivalAutoPerformance.gate?.passed === true, "Auto Survival performance gate failed");
assert(
  survivalAutoPerformance.requestedScenario === "survival-wave20-stress"
    && survivalAutoPerformance.requestedGraphicsQuality === "auto",
  "Auto Survival performance scenario mismatch",
);
assert(powerSavePerformance.gate?.passed === true, "Power-save Survival performance gate failed");
assert(
  powerSavePerformance.requestedScenario === "survival-wave20-stress",
  "Power-save performance scenario mismatch",
);
assert(
  powerSavePerformance.requestedGraphicsQuality === "power-save",
  "Power-save report did not request power-save",
);
assert(
  powerSavePerformance.runtimePerformance?.effectiveRenderHz <= 33,
  "Power-save render cadence did not reach the 30 fps band",
);
for (const [label, report] of [
  ["Auto", survivalAutoPerformance],
  ["Power-save", powerSavePerformance],
]) {
  assert(
    report.scenario?.repreparations === 0
      && report.scenario?.finalProof?.phase === "in-wave"
      && report.scenario?.finalProof?.over === false,
    `${label} Survival report did not stay in one continuous Wave 20 battle`,
  );
  assert(
    report.scenario.finalProof.livingHumanFighters
      >= report.scenario.initialProof.preparation.initialHumanFighters
      && report.scenario.finalProof.livingEnemyFighters
        >= report.scenario.initialProof.preparation.initialEnemyFighters
      && report.scenario.finalProof.baseHp === report.scenario.finalProof.baseMaxHp
      && report.scenario.finalProof.humanAttackSequences > 0
      && report.scenario.finalProof.enemyAttackSequences > 0,
    `${label} Survival report did not retain equivalent active gameplay`,
  );
}
assert(
  survivalAutoPerformance.durationMs === powerSavePerformance.durationMs
    && survivalAutoPerformance.viewport.width === powerSavePerformance.viewport.width
    && survivalAutoPerformance.viewport.height === powerSavePerformance.viewport.height
    && survivalAutoPerformance.deviceScaleFactor === powerSavePerformance.deviceScaleFactor
    && survivalAutoPerformance.scenario.initialProof.preparation.initialHumanFighters
      === powerSavePerformance.scenario.initialProof.preparation.initialHumanFighters
    && survivalAutoPerformance.scenario.initialProof.preparation.initialEnemyFighters
      === powerSavePerformance.scenario.initialProof.preparation.initialEnemyFighters
    && survivalAutoPerformance.scenario.initialProof.preparation.initialBattlefieldObjects
      === powerSavePerformance.scenario.initialProof.preparation.initialBattlefieldObjects,
  "Auto and Power-save Survival reports are not same-condition evidence",
);
assert(
  survivalAutoPerformance.scenario.finalProof.phase
      === powerSavePerformance.scenario.finalProof.phase
    && survivalAutoPerformance.scenario.finalProof.currentWave
      === powerSavePerformance.scenario.finalProof.currentWave
    && survivalAutoPerformance.scenario.finalProof.over
      === powerSavePerformance.scenario.finalProof.over
    && survivalAutoPerformance.scenario.finalProof.won
      === powerSavePerformance.scenario.finalProof.won,
  "Auto and Power-save changed the Survival gameplay outcome",
);
assert(
  relativeDifference(
    survivalAutoPerformance.scenario.finalProof.humanAttackSequences,
    powerSavePerformance.scenario.finalProof.humanAttackSequences,
  ) <= .02
    && relativeDifference(
      survivalAutoPerformance.scenario.finalProof.enemyAttackSequences,
      powerSavePerformance.scenario.finalProof.enemyAttackSequences,
    ) <= .02,
  "Auto and Power-save changed combat activity by more than 2%",
);
assert(
  finalRepresentative.totals?.cases === 4
    && finalRepresentative.totals?.passed === 4
    && finalRepresentative.totals?.failed === 0,
  "Final representative-six browser rerun is incomplete",
);
assert(
  finalRemaining.totals?.cases === 4
    && finalRemaining.totals?.passed === 4
    && finalRemaining.totals?.failed === 0,
  "Final remaining-ten browser rerun is incomplete",
);
assert(
  finalEnemyVfx.total === 6 && finalEnemyVfx.passed === 6 && finalEnemyVfx.failed === 0,
  "Final Enemy/VFX browser rerun is incomplete",
);
assert(
  diagnosticEntryCount(finalEnemyVfx.diagnostics) === 0
    && resultDiagnosticCount(finalEnemyVfx.results ?? []) === 0,
  "Final Enemy/VFX browser rerun has diagnostics",
);
assert(
  finalResidualBugs.total === 96
    && finalResidualBugs.passed === 96
    && finalResidualBugs.failed === 0,
  "Final residual-bug browser rerun is incomplete",
);
assert(
  resultDiagnosticCount(finalResidualBugs.results ?? []) === 0,
  "Final residual-bug browser rerun has diagnostics",
);
const employmentResults = [
  ...(finalEmploymentUnlock.results ?? []),
  ...(finalEmploymentUnlock.waveEntryResults ?? []),
];
assert(
  employmentResults.length === 8
    && employmentResults.every(({ status }) => status === "passed"),
  "Final employment/Mayo browser rerun is incomplete",
);
assert(
  resultDiagnosticCount(employmentResults) === 0,
  "Final employment/Mayo browser rerun has diagnostics",
);
const saveRows = finalSaveMigration.results ?? [];
const savePassedCases = saveRows.reduce((total, row) => total + (row.passed ?? 0), 0);
const saveFailedCases = saveRows.reduce((total, row) => total + (row.failed ?? 0), 0);
assert(
  finalSaveMigration.passed === 6
    && finalSaveMigration.failed === 0
    && saveRows.length === 6
    && savePassedCases === 78
    && saveFailedCases === 0,
  "Final save migration/origin matrix is incomplete",
);
assert(
  finalMobileLifecycle.runMode === "diagnostic"
    && finalMobileLifecycle.failed === 0
    && finalMobileLifecycle.results?.length === 4
    && finalMobileLifecycle.passed + finalMobileLifecycle.passedWithCapabilityGaps === 4,
  "Final mobile lifecycle diagnostic is incomplete",
);
assert(
  resultDiagnosticCount(finalMobileLifecycle.results ?? []) === 0,
  "Final mobile lifecycle diagnostic has browser diagnostics",
);
assert(
  finalAssetDecode.result?.status === "passed"
    && finalAssetDecode.result?.failures?.length === 0
    && diagnosticEntryCount(finalAssetDecode.diagnostics) === 0,
  "Final asset decode browser smoke failed",
);
assert(
  finalCrawlerDefense.total === 240
    && finalCrawlerDefense.passed === 240
    && finalCrawlerDefense.failed === 0
    && finalCrawlerDefense.passThroughs === 0
    && finalCrawlerDefense.objectiveDirects === 0
    && resultDiagnosticCount(finalCrawlerDefense.results ?? []) === 0,
  "Final CRAWLER defense matrix failed",
);
assert(
  finalBattleSpace.passed === 4
    && finalBattleSpace.failed === 0
    && resultDiagnosticCount(finalBattleSpace.results ?? []) === 0,
  "Final battle-space browser smoke failed",
);
assert(
  finalBossFoundation.length === 12
    && finalBossFoundation.every(({ status }) => status === "passed"),
  "Final boss-foundation browser smoke failed",
);
assert(
  finalBossAnomalies.length === 18
    && finalBossAnomalies.every(({ status }) => status === "passed"),
  "Final boss-anomaly browser smoke failed",
);
assert(
  finalSurvivalWaves.passed === 2
    && finalSurvivalWaves.failed === 0
    && resultDiagnosticCount(finalSurvivalWaves.results ?? []) === 0,
  "Final Survival Wave 1-5 browser smoke failed",
);
assert(
  finalOutbreak.length === 6
    && finalOutbreak.every(({ status }) => status === "passed")
    && finalOutbreak.some(({ fullRuntime }) => fullRuntime?.resultId),
  "Final Outbreak browser smoke failed",
);
assert(
  finalCombatPresentation.passed === 4
    && finalCombatPresentation.failed === 0
    && resultDiagnosticCount(finalCombatPresentation.results ?? []) === 0,
  "Final combat presentation browser smoke failed",
);

const allSixteenSheet = await buildAllSixteenSheet();
const vfxSheet = await buildVfxSheet();
const normalRenderHz = normalPerformance.runtimePerformance?.effectiveRenderHz ?? null;
const survivalAutoRenderHz =
  survivalAutoPerformance.runtimePerformance?.effectiveRenderHz ?? null;
const powerSaveRenderHz = powerSavePerformance.runtimePerformance?.effectiveRenderHz ?? null;
const renderWorkProxy = (report) => (
  report.runtimePerformance.renderFrameDelta
  * report.runtimePerformance.after.graphicsProfile.dprCap ** 2
  * report.runtimePerformance.after.graphicsProfile.effectDensity
);
const survivalAutoRenderWorkProxy = renderWorkProxy(survivalAutoPerformance);
const powerSaveRenderWorkProxy = renderWorkProxy(powerSavePerformance);
const renderLoadReductionPercent = survivalAutoRenderWorkProxy && powerSaveRenderWorkProxy
  ? (
    survivalAutoRenderWorkProxy - powerSaveRenderWorkProxy
  ) / survivalAutoRenderWorkProxy * 100
  : null;
assert(
  renderLoadReductionPercent !== null && renderLoadReductionPercent >= 25,
  "Power-save did not reduce render cadence by at least 25% versus Auto",
);

const branch = await gitOutput("branch", "--show-current");
const sourceHeadSha = await gitOutput("rev-parse", "HEAD");
const integrationBaseSha = await gitOutput(
  "merge-base",
  "HEAD",
  "origin/integration/0.9.5",
);
assert(branch === "codex/0.9.5-rc", `Unexpected evidence branch: ${branch}`);
assert(
  integrationBaseSha === "9c576b1acb89c5b05a47213fa0c8f450b8d6136c",
  `Unexpected integration base: ${integrationBaseSha}`,
);

const sourceHashes = {};
for (const source of [...allSixteenSheet.sources, ...vfxSheet.sources]) {
  sourceHashes[relative(source)] = await sha256(source);
}

const summary = {
  evidenceVersion: 1,
  version: "0.9.5-rc",
  generatedAt: new Date().toISOString(),
  branch,
  sourceHeadSha,
  integrationBaseSha,
  animationEvidence: {
    units: allSixteenSheet.units,
    unitCount: allSixteenSheet.units.length,
    sourceBrowserCases: allSixteenSummary.browserCases,
    sourceCaptures: allSixteenSummary.captures,
    normalAttackRuntimeProofs: allSixteenSummary.normalAttackRuntimeProofs,
    specialRecoveryProofs: allSixteenSummary.totalSpecialRecoveryProofs,
    failures: {
      browser: allSixteenSummary.failedBrowserCases,
      groundAnchor: allSixteenSummary.groundAnchorFailures,
      visualOffFloor: allSixteenSummary.visualOffFloorFailures,
      weaponCues: allSixteenSummary.missingProductionWeaponCues,
    },
    contactSheet: relative(allSixteenSheet.outputPath),
    contactSheetSha256: await sha256(allSixteenSheet.outputPath),
  },
  vfxEvidence: {
    ordinaryEnemyKinds: enemyVfxSummary.browserQa.enemyVfx.ordinaryEnemyKinds.length,
    projectileKinds: enemyVfxSummary.browserQa.enemyVfx.projectileKinds.length,
    crawlerStates: enemyVfxSummary.browserQa.enemyVfx.crawlerStates.length,
    bossFoundationCases: enemyVfxSummary.browserQa.bossFoundation.passed,
    bossAnomalyCases: enemyVfxSummary.browserQa.bossAnomalies.passed,
    productionProjectileTransactions:
      enemyVfxSummary.browserQa.enemyVfx.productionProjectileTransactions,
    productionCrawlerTransactions:
      enemyVfxSummary.browserQa.enemyVfx.productionCrawlerTransactions,
    continuousSequences: enemyVfxSummary.browserQa.enemyVfx.continuousSequences,
    contactSheet: relative(vfxSheet.outputPath),
    contactSheetSha256: await sha256(vfxSheet.outputPath),
  },
  performanceComparison: {
    baseline: {
      version: v090Baseline.baselineVersion,
      releaseSha: v090Baseline.baselineReleaseSha,
      medianFrameMs: v090Baseline.medianFrameMs,
      p95FrameMs: v090Baseline.p95FrameMs,
      maxFrameGapMs: v090Baseline.maxFrameGapMs,
      retainedHeapGrowthPercent: v090Baseline.retainedHeapGrowthPercent,
      memoryProxyGrowthPercent: v090Baseline.memoryProxyGrowthPercent,
      effectiveRenderHz: v090Baseline.renderFrameDelta / (v090Baseline.durationMs / 1_000),
    },
    rcNormalStressAuto: {
      medianFrameMs: normalPerformance.medianFrameMs,
      p95FrameMs: normalPerformance.p95FrameMs,
      maxFrameGapMs: normalPerformance.maxFrameGapMs,
      retainedHeapGrowthPercent: normalPerformance.retainedHeapGrowthPercent,
      memoryProxyGrowthPercent: normalPerformance.memoryProxyGrowthPercent,
      effectiveSimulationHz: normalPerformance.runtimePerformance.effectiveSimulationHz,
      effectiveRenderHz: normalRenderHz,
      gatePassed: normalPerformance.gate.passed,
    },
    rcSurvivalWave20Auto: {
      medianFrameMs: survivalAutoPerformance.medianFrameMs,
      p95FrameMs: survivalAutoPerformance.p95FrameMs,
      maxFrameGapMs: survivalAutoPerformance.maxFrameGapMs,
      retainedHeapGrowthPercent: survivalAutoPerformance.retainedHeapGrowthPercent,
      memoryProxyGrowthPercent: survivalAutoPerformance.memoryProxyGrowthPercent,
      effectiveSimulationHz:
        survivalAutoPerformance.runtimePerformance.effectiveSimulationHz,
      effectiveRenderHz: survivalAutoRenderHz,
      gatePassed: survivalAutoPerformance.gate.passed,
      scenarioRepreparations: survivalAutoPerformance.scenario.repreparations,
      renderWorkProxy: Number(survivalAutoRenderWorkProxy.toFixed(2)),
    },
    rcSurvivalWave20PowerSave: {
      medianFrameMs: powerSavePerformance.medianFrameMs,
      p95FrameMs: powerSavePerformance.p95FrameMs,
      maxFrameGapMs: powerSavePerformance.maxFrameGapMs,
      retainedHeapGrowthPercent: powerSavePerformance.retainedHeapGrowthPercent,
      memoryProxyGrowthPercent: powerSavePerformance.memoryProxyGrowthPercent,
      effectiveSimulationHz: powerSavePerformance.runtimePerformance.effectiveSimulationHz,
      effectiveRenderHz: powerSaveRenderHz,
      renderToSimulationRatio:
        powerSavePerformance.runtimePerformance.renderToSimulationRatio,
      gatePassed: powerSavePerformance.gate.passed,
      scenarioRepreparations: powerSavePerformance.scenario.repreparations,
      renderWorkProxy: Number(powerSaveRenderWorkProxy.toFixed(2)),
    },
    sameScenarioAutoToPowerSaveRenderWorkProxyReductionPercent:
      Number(renderLoadReductionPercent.toFixed(2)),
    sameScenarioGameplayOutcomeMatched: true,
  },
  finalBrowserQa: {
    representativeSix: {
      passed: finalRepresentative.totals.passed,
      failed: finalRepresentative.totals.failed,
    },
    remainingTen: {
      passed: finalRemaining.totals.passed,
      failed: finalRemaining.totals.failed,
    },
    enemyVfx: {
      passed: finalEnemyVfx.passed,
      failed: finalEnemyVfx.failed,
      diagnostics: 0,
    },
    residualBugs: {
      passed: finalResidualBugs.passed,
      failed: finalResidualBugs.failed,
      diagnostics: 0,
    },
    employmentAndMayo: {
      passed: employmentResults.length,
      failed: 0,
      diagnostics: 0,
    },
    saveMigrationAndOrigin: {
      matrixRowsPassed: finalSaveMigration.passed,
      matrixRowsFailed: finalSaveMigration.failed,
      casesPassed: savePassedCases,
      casesFailed: saveFailedCases,
    },
    mobileLifecycle: {
      runMode: finalMobileLifecycle.runMode,
      passed: finalMobileLifecycle.passed,
      passedWithCapabilityGaps: finalMobileLifecycle.passedWithCapabilityGaps,
      failed: finalMobileLifecycle.failed,
      coverageGaps: [...new Set(
        finalMobileLifecycle.results.flatMap(({ coverageGaps = [] }) => coverageGaps),
      )],
      diagnostics: 0,
    },
    assetDecode: {
      audioDecoded: finalAssetDecode.result.audioDecoded,
      portraitsDecoded: finalAssetDecode.result.portraitDecoded,
      imagesDecoded: finalAssetDecode.result.imageDecoded,
      failures: finalAssetDecode.result.failures.length,
      diagnostics: 0,
    },
    crawlerDefense: {
      passed: finalCrawlerDefense.passed,
      failed: finalCrawlerDefense.failed,
      passThroughs: finalCrawlerDefense.passThroughs,
      objectiveDirects: finalCrawlerDefense.objectiveDirects,
      diagnostics: 0,
    },
    battleSpace: {
      passed: finalBattleSpace.passed,
      failed: finalBattleSpace.failed,
      diagnostics: 0,
    },
    bossFoundation: {
      passed: finalBossFoundation.length,
      failed: 0,
    },
    bossAnomalies: {
      passed: finalBossAnomalies.length,
      failed: 0,
    },
    survivalWaves: {
      passed: finalSurvivalWaves.passed,
      failed: finalSurvivalWaves.failed,
      diagnostics: 0,
    },
    outbreak: {
      passed: finalOutbreak.length,
      failed: 0,
      fullRuntimeSettlements: finalOutbreak.filter(({ fullRuntime }) => fullRuntime?.resultId).length,
    },
    combatPresentation: {
      passed: finalCombatPresentation.passed,
      failed: finalCombatPresentation.failed,
      diagnostics: 0,
    },
  },
  rawEvidence: {
    normalPerformance: {
      path: relative(normalPerformancePath),
      sha256: await sha256(normalPerformancePath),
    },
    survivalAutoPerformance: {
      path: relative(survivalAutoPerformancePath),
      sha256: await sha256(survivalAutoPerformancePath),
    },
    powerSavePerformance: {
      path: relative(powerSavePerformancePath),
      sha256: await sha256(powerSavePerformancePath),
    },
    finalBrowserQa: Object.fromEntries(await Promise.all(
      Object.entries(finalBrowserQaPaths).map(async ([key, filePath]) => [
        key,
        {
          path: relative(filePath),
          sha256: await sha256(filePath),
        },
      ]),
    )),
    sourceFrameSha256: sourceHashes,
  },
  capabilityBoundary: {
    physicalSmartphoneHeatVerified: false,
    nativeSafariVerified: false,
    physicalSpeakerVerified: false,
    physicalTouchRotationLockRecoveryVerified: false,
  },
};

const summaryPath = path.join(outputDir, "rc-summary.json");
await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  summary: relative(summaryPath),
  allSixteenSheet: relative(allSixteenSheet.outputPath),
  vfxSheet: relative(vfxSheet.outputPath),
  renderLoadReductionPercent:
    summary.performanceComparison.sameScenarioAutoToPowerSaveRenderWorkProxyReductionPercent,
}, null, 2));
