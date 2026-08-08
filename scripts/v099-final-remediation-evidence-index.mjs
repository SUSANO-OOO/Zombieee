import { createHash } from "node:crypto";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = path.join(
  ROOT,
  "docs",
  "qa",
  "v099",
  "final-remediation",
  "EVIDENCE_INDEX.json",
);
const RAW_ROOT = path.join(ROOT, "outputs", "v099-final-remediation-evidence-final");
const BROWSER_ROOT = path.join(RAW_ROOT, "browser");
const STAGE3_ROOT = path.join(RAW_ROOT, "stage3-audio");
const AUDIO_ROOT = path.join(ROOT, "docs", "qa", "v099", "final-remediation", "audio");
const EXPECTED_DIST_IDENTITY =
  "3738d4e902bdab35119bdbd33b929f342494cefe168ca8ee41c9dfa6a7d0ddef";

function relativeFromRoot(value) {
  return path.relative(ROOT, value).split(path.sep).join("/");
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(absolute)));
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}

async function fileRecords(directory) {
  const records = [];
  for (const absolute of await walk(directory)) {
    const [buffer, metadata] = await Promise.all([readFile(absolute), stat(absolute)]);
    records.push({
      path: relativeFromRoot(absolute),
      bytes: metadata.size,
      sha256: sha256(buffer),
    });
  }
  return records.sort((a, b) => a.path.localeCompare(b.path));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function zeroRuntimeDiagnostics(result) {
  const diagnostics = result.runtimeDiagnostics ?? result.diagnostics ?? {};
  const arrays = [
    diagnostics.consoleErrors,
    diagnostics.pageErrors,
    diagnostics.requestFailures,
    diagnostics.httpErrors,
    diagnostics.warnings,
  ];
  return arrays.every((value) => !Array.isArray(value) || value.length === 0)
    && Number(diagnostics.pendingRequestCount ?? 0) === 0;
}

function zeroStage3SetupDiagnostics(result) {
  const raw = result.setupDiagnostics?.raw ?? {};
  return [
    raw.consoleErrors,
    raw.pageErrors,
    raw.requestFailures,
    raw.failedRequestDetails,
    raw.httpErrors,
    raw.warnings,
  ].every((value) => Array.isArray(value) && value.length === 0)
    && Number(raw.pendingRequestCount ?? -1) === 0;
}

function retainedStableBootstrapDiagnostics(result) {
  const before = result.bootstrapBoundary?.before;
  const after = result.bootstrapBoundary?.after;
  const raw = result.bootstrapDiagnostics;
  return Number(before?.generation) > 0
    && Number(before?.total) > 0
    && before.generation === after?.generation
    && before.total === after?.total
    && after?.status === "ready"
    && after?.pending === 0
    && after?.failed === 0
    && after?.datasetGeneration === after?.generation
    && after?.stageId === "stage-nishijin-defense-line-takuya"
    && after?.scope === "all-local-qa"
    && Array.isArray(raw?.requestFailures)
    && Array.isArray(raw?.failedRequestDetails)
    && Array.isArray(raw?.consoleErrors)
    && raw.consoleErrors.length === 0
    && Array.isArray(raw?.pageErrors)
    && raw.pageErrors.length === 0
    && Array.isArray(raw?.httpErrors)
    && raw.httpErrors.length === 0
    && Array.isArray(raw?.warnings)
    && raw.warnings.length === 0
    && Number(raw?.pendingRequestCount ?? -1) === 0;
}

const browserSummaryPath = path.join(BROWSER_ROOT, "summary.json");
const stage3SummaryPath = path.join(STAGE3_ROOT, "summary.json");
const [browserSummary, stage3Summary, browserFiles, stage3Files, audioFiles] =
  await Promise.all([
    readFile(browserSummaryPath, "utf8").then(JSON.parse),
    readFile(stage3SummaryPath, "utf8").then(JSON.parse),
    fileRecords(BROWSER_ROOT),
    fileRecords(STAGE3_ROOT),
    fileRecords(AUDIO_ROOT),
  ]);

const browserPngs = browserFiles.filter((entry) => entry.path.endsWith(".png"));
const stage3Pngs = stage3Files.filter((entry) => entry.path.endsWith(".png"));
const browserIdentityStart = browserSummary.buildIdentityAtStart?.combinedSha256;
const browserIdentityEnd = browserSummary.buildIdentityAtEnd?.combinedSha256;
const stage3Results = Array.isArray(stage3Summary.results) ? stage3Summary.results : [];
const browserResults = Array.isArray(browserSummary.results) ? browserSummary.results : [];
const hudStateIds = Object.freeze([
  "stage1-normal",
  "five-units",
  "deployment-banner",
  "manual-ability-banner",
  "objective-full",
  "support-disabled",
  "banner-bark-boss",
  "stage3-boss",
]);
const deploymentFamilies = Object.freeze([
  "hachi",
  "mizuchi",
  "paisen",
  "crazy-king",
  "mayo-chan",
  "tatara",
  "standard-human",
]);
const deploymentCheckpointIds = Object.freeze([
  "fully-inside",
  "first-visible",
  "quarter",
  "half",
  "three-quarters",
  "fully-outside",
]);
const barragePhaseIds = Object.freeze([
  "stowed",
  "hatch-open",
  "turret-rise",
  "aim",
  "firing",
  "recoil",
  "retract",
]);
const airstrikePhaseIds = Object.freeze([
  "stowed",
  "mast-deploy",
  "antenna-extend",
  "targeting",
  "inbound-signal",
  "impact-confirmation",
  "retract",
]);
const browserFileByPath = new Map(browserFiles.map((record) => [record.path, record]));

function assertRecordedScreenshot(entry, label) {
  const record = browserFileByPath.get(entry?.screenshot);
  assert(record, `${label} screenshot is absent from raw evidence`);
  assert(record.sha256 === entry.screenshotSha256, `${label} screenshot hash drifted`);
}

assert(browserSummary.canonicalAxes === true, "browser evidence is not canonical");
assert(browserSummary.expectedCaseCount === 12, "browser expected-case count drifted");
assert(browserSummary.total === 12, "browser total case count drifted");
assert(browserSummary.passed === 12 && browserSummary.failed === 0, "browser QA failed");
assert(browserSummary.screenshotCount === 260, "browser screenshot count drifted");
assert(browserSummary.contactSheetCount === 8, "browser runtime contact-sheet count drifted");
assert(browserPngs.length === 268, "browser PNG evidence count drifted");
assert(browserResults.length === 12, "browser result matrix drifted");
assert(browserSummary.buildIdentityStable === true, "browser build identity changed during QA");
assert(browserIdentityStart === EXPECTED_DIST_IDENTITY, "browser start build identity drifted");
assert(browserIdentityEnd === EXPECTED_DIST_IDENTITY, "browser end build identity drifted");
assert(stage3Summary.battleAudioCaseCount === 8, "Stage 3 case count drifted");
assert(stage3Summary.failed === 0, "Stage 3 audio QA failed");
assert(stage3Summary.battleAudioPassed === 4, "Stage 3 Chromium pass count drifted");
assert(stage3Summary.battleAudioBlocked === 4, "Stage 3 WebKit capability count drifted");
assert(stage3Results.length === 8, "Stage 3 result count drifted");
assert(stage3Pngs.length === 8, "Stage 3 PNG evidence count drifted");
assert(
  stage3Results.every((result) => result.logicStatus === "passed"
    && zeroRuntimeDiagnostics(result)
    && zeroStage3SetupDiagnostics(result)
    && retainedStableBootstrapDiagnostics(result)),
  "Stage 3 runtime, setup, or retained bootstrap evidence failed",
);

const hudResults = browserResults.filter(({ type }) => type === "hud");
assert(hudResults.length === 4, "HUD browser-axis count drifted");
for (const result of hudResults) {
  const label = `${result.engine}/${result.viewport?.width}x${result.viewport?.height}`;
  assert(result.status === "passed" && zeroRuntimeDiagnostics(result), `${label} HUD QA failed`);
  assert(Array.isArray(result.states) && result.states.length === hudStateIds.length,
    `${label} HUD state count drifted`);
  assert(result.states.every((state, index) => state.id === hudStateIds[index]),
    `${label} HUD state order drifted`);
  assert(new Set(result.states.map(({ screenshotSha256 }) => screenshotSha256)).size === hudStateIds.length,
    `${label} HUD screenshots are not distinct`);
  for (const state of result.states) assertRecordedScreenshot(state, `${label}/${state.id}`);
}

const equipmentResults = browserResults.filter(({ type }) => type === "crawler-equipment");
assert(equipmentResults.length === 4, "CRAWLER equipment browser-axis count drifted");
for (const result of equipmentResults) {
  const axisLabel = `${result.engine}/${result.viewport?.width}x${result.viewport?.height}`;
  assert(result.status === "passed" && zeroRuntimeDiagnostics(result), `${axisLabel} equipment QA failed`);
  for (const [kind, phases] of [["barrage", barragePhaseIds], ["airstrike", airstrikePhaseIds]]) {
    const entries = result[kind];
    assert(Array.isArray(entries) && entries.length === phases.length,
      `${axisLabel}/${kind} phase count drifted`);
    assert(entries.every((entry, index) => entry.phase === phases[index]),
      `${axisLabel}/${kind} phase order drifted`);
    assert(new Set(entries.map(({ screenshotSha256 }) => screenshotSha256)).size === phases.length,
      `${axisLabel}/${kind} runtime phase screenshots are not distinct`);
    for (const entry of entries) assertRecordedScreenshot(entry, `${axisLabel}/${kind}/${entry.phase}`);
    const contact = result.contactSheets?.[kind];
    const contactRecord = browserFileByPath.get(contact?.path);
    assert(contactRecord && contactRecord.sha256 === contact.sha256,
      `${axisLabel}/${kind} runtime contact sheet is absent or drifted`);
    assert(contact.columns === phases.length
      && JSON.stringify(contact.phases) === JSON.stringify(phases),
    `${axisLabel}/${kind} runtime contact sheet semantic order drifted`);
  }
}

const deploymentResults = browserResults.filter(({ type }) => type === "deployment");
assert(deploymentResults.length === 4, "deployment browser-axis count drifted");
for (const result of deploymentResults) {
  const axisLabel = `${result.engine}/${result.viewport?.width}x${result.viewport?.height}`;
  assert(result.status === "passed" && zeroRuntimeDiagnostics(result), `${axisLabel} deployment QA failed`);
  assert(Array.isArray(result.units) && result.units.length === deploymentFamilies.length,
    `${axisLabel} deployment family count drifted`);
  for (const [familyIndex, unit] of result.units.entries()) {
    const family = deploymentFamilies[familyIndex];
    const label = `${axisLabel}/${family}`;
    assert(unit.family === family && unit.status === "passed", `${label} deployment family drifted`);
    assert(Array.isArray(unit.checkpoints)
      && unit.checkpoints.length === deploymentCheckpointIds.length,
    `${label} deployment checkpoint count drifted`);
    assert(unit.checkpoints.every((checkpoint, index) => (
      checkpoint.checkpoint === deploymentCheckpointIds[index]
      && checkpoint.observedCheckpoint === deploymentCheckpointIds[index]
    )), `${label} requested/observed deployment checkpoints diverged`);
    const fullyInside = unit.checkpoints[0];
    const firstVisible = unit.checkpoints[1];
    assert(fullyInside.observedProgress === 0, `${label} fully-inside frame is not progress 0`);
    assert(firstVisible.observedProgress >= .08
      && firstVisible.fighter?.x > fullyInside.fighter?.x,
    `${label} first-visible frame did not advance from progress 0`);
    assert(firstVisible.screenshotSha256 !== fullyInside.screenshotSha256,
      `${label} progress-0 and first-visible screenshots are identical`);
    assert(unit.checkpoints.every((checkpoint, index, checkpoints) => (
      index === 0 || checkpoint.fighter?.x + 1e-6 >= checkpoints[index - 1].fighter?.x
    )), `${label} deployment position regressed`);
    for (const checkpoint of unit.checkpoints) {
      assertRecordedScreenshot(checkpoint, `${label}/${checkpoint.checkpoint}`);
    }
  }
}

const allFiles = [...browserFiles, ...stage3Files, ...audioFiles].sort((a, b) =>
  a.path.localeCompare(b.path),
);
const combinedEvidenceSha256 = sha256(
  Buffer.from(allFiles.map(({ path: filePath, bytes, sha256: digest }) =>
    `${filePath}\0${bytes}\0${digest}\n`).join("")),
);

const index = {
  schemaVersion: 1,
  version: "0.9.9.0",
  scope: "Gate B final remediation acceptance evidence",
  rawEvidenceLocation: "outputs/v099-final-remediation-evidence-final (gitignored, retained locally)",
  buildIdentity: EXPECTED_DIST_IDENTITY,
  browser: {
    generatedAt: browserSummary.generatedAt,
    engines: browserSummary.engines,
    viewports: browserSummary.viewports,
    total: browserSummary.total,
    passed: browserSummary.passed,
    failed: browserSummary.failed,
    screenshotCount: browserSummary.screenshotCount,
    buildIdentityStable: browserSummary.buildIdentityStable,
    files: browserFiles.length,
    bytes: browserFiles.reduce((sum, entry) => sum + entry.bytes, 0),
  },
  stage3Audio: {
    generatedAt: stage3Summary.generatedAt,
    engines: stage3Summary.engines,
    viewports: stage3Summary.viewports,
    cases: stage3Summary.battleAudioCaseCount,
    logicPassed: stage3Results.filter((result) => result.logicStatus === "passed").length,
    chromiumAudioPassed: stage3Summary.battleAudioPassed,
    webkitAudioCapabilityBlocked: stage3Summary.battleAudioBlocked,
    failed: stage3Summary.failed,
    files: stage3Files.length,
    bytes: stage3Files.reduce((sum, entry) => sum + entry.bytes, 0),
  },
  audioCaptures: {
    files: audioFiles.length,
    bytes: audioFiles.reduce((sum, entry) => sum + entry.bytes, 0),
  },
  evidenceFiles: allFiles,
  combinedEvidenceSha256,
};

const serialized = `${JSON.stringify(index, null, 2)}\n`;
if (process.argv.includes("--check")) {
  const current = await readFile(OUTPUT, "utf8");
  assert(current === serialized, "EVIDENCE_INDEX.json is stale; regenerate without --check");
  console.log(
    `Evidence index verified: ${allFiles.length} files, ${combinedEvidenceSha256}`,
  );
} else {
  await writeFile(OUTPUT, serialized);
  console.log(
    `Evidence index written: ${relativeFromRoot(OUTPUT)} (${allFiles.length} files, ${combinedEvidenceSha256})`,
  );
}
