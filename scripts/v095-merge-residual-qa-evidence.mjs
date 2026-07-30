import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const [mode, baselineArgument, retryArgument, outputArgument] = process.argv.slice(2);
if (!["attack", "deployment-matrix"].includes(mode)
  || !baselineArgument
  || !retryArgument
  || !outputArgument) {
  throw new Error(
    "Usage: node scripts/v095-merge-residual-qa-evidence.mjs "
    + "<attack|deployment-matrix> <baseline-summary> <retry-summary> <output>",
  );
}

const canonicalAxes = {
  engines: ["chromium", "webkit"],
  viewports: ["1280x720", "844x390", "844x340"],
  units: [
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
  ],
  qualities: mode === "attack" ? ["auto"] : ["auto", "high", "power-save"],
  speeds: mode === "attack" ? [1] : [1, 2],
};

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function viewportKey(viewport) {
  return `${viewport.width}x${viewport.height}`;
}

function caseKey(result) {
  return [
    result.engine,
    viewportKey(result.viewport),
    result.quality,
    `${result.speed}x`,
    result.unitKind,
  ].join("/");
}

function observedLocomotionSprites(result) {
  const sprites = new Set(result.locomotionSprites ?? []);
  for (const frame of result.frames ?? []) {
    const spriteState = frame?.fighter?.renderAudit?.spriteState;
    if (spriteState === "walk-a" || spriteState === "walk-b") {
      sprites.add(spriteState);
    }
  }
  return [...sprites].sort();
}

function canonicalKeys() {
  const keys = [];
  for (const engine of canonicalAxes.engines) {
    for (const viewport of canonicalAxes.viewports) {
      for (const quality of canonicalAxes.qualities) {
        for (const speed of canonicalAxes.speeds) {
          for (const unitKind of canonicalAxes.units) {
            keys.push(`${engine}/${viewport}/${quality}/${speed}x/${unitKind}`);
          }
        }
      }
    }
  }
  return keys;
}

async function readSummary(argument) {
  const absolutePath = path.resolve(argument);
  const buffer = await readFile(absolutePath);
  return {
    absolutePath,
    sha256: createHash("sha256").update(buffer).digest("hex"),
    summary: JSON.parse(buffer.toString("utf8")),
  };
}

function validateSummary(source, expectedScope) {
  const { summary, absolutePath } = source;
  invariant(summary.mode === mode, `${absolutePath}: mode mismatch`);
  invariant(summary.scope === expectedScope, `${absolutePath}: scope mismatch`);
  invariant(summary.buildFreshness?.fresh === true, `${absolutePath}: stale build evidence`);
  invariant(
    summary.buildIdentityStable === true
      && summary.buildIdentity?.scope === "dist-recursive"
      && summary.buildIdentityAtStart?.scope === "dist-recursive"
      && /^[a-f0-9]{64}$/u.test(summary.buildIdentity?.combinedSha256 ?? "")
      && summary.buildIdentityAtStart.combinedSha256
        === summary.buildIdentity.combinedSha256,
    `${absolutePath}: stable start/end build identity missing`,
  );
  invariant(Array.isArray(summary.results) && summary.results.length > 0,
    `${absolutePath}: empty result set`);
  invariant((summary.diagnosticFailures?.length ?? 0) === 0,
    `${absolutePath}: browser diagnostics were not clean`);
  const keys = summary.results.map(caseKey);
  invariant(new Set(keys).size === keys.length, `${absolutePath}: duplicate case keys`);
  const allowedKeys = new Set(canonicalKeys());
  invariant(keys.every((key) => allowedKeys.has(key)),
    `${absolutePath}: non-canonical case key`);
  if (expectedScope === "full") {
    invariant(summary.canonicalAxes === true, `${absolutePath}: canonicalAxes missing`);
    invariant(keys.length === allowedKeys.size, `${absolutePath}: full case count mismatch`);
    invariant(keys.every((key) => allowedKeys.has(key)), `${absolutePath}: full axes mismatch`);
  }
}

const baseline = await readSummary(baselineArgument);
const retry = await readSummary(retryArgument);
validateSummary(baseline, "full");
validateSummary(retry, "focused");
invariant(
  baseline.summary.buildIdentity.combinedSha256
    === retry.summary.buildIdentity.combinedSha256,
  "Baseline and focused retry were not run against the exact same build",
);

const baselineByKey = new Map(baseline.summary.results.map((result) => [caseKey(result), result]));
const retryByKey = new Map(retry.summary.results.map((result) => [caseKey(result), result]));
const baselineFailures = baseline.summary.results
  .filter(({ status }) => status !== "passed")
  .map(caseKey);
invariant(baselineFailures.length > 0, "Merge requires a baseline with targeted failures");
for (const failedKey of baselineFailures) {
  const retried = retryByKey.get(failedKey);
  invariant(retried, `Missing focused retry for baseline failure ${failedKey}`);
  invariant(retried.status === "passed",
    `Focused retry still failed ${failedKey}: ${retried.error ?? "unknown"}`);
}
invariant(retry.summary.results.every(({ status }) => status === "passed"),
  "Focused retry contains a failed case");

const expectedKeys = canonicalKeys();
const cases = expectedKeys.map((key) => {
  const retryResult = retryByKey.get(key);
  const baselineResult = baselineByKey.get(key);
  const result = retryResult ?? baselineResult;
  invariant(result, `Canonical case missing after merge: ${key}`);
  return {
    key,
    source: retryResult ? "focused-retry" : "full-baseline",
    status: result.status,
    entryToReadyMs: result.entryToReadyMs ?? null,
    readyToDamageMs: result.readyToDamageMs ?? null,
    locomotionDrawCount: result.locomotionDrawCount ?? null,
    locomotionSprites: observedLocomotionSprites(result),
    screenshotCount: (result.frames ?? []).filter(({ screenshot }) => screenshot).length,
  };
});
invariant(cases.every(({ status }) => status === "passed"),
  "Merged canonical evidence still contains failures");

const allSixteenLocomotionUnion = mode === "deployment-matrix"
  ? canonicalAxes.units.map((unitKind) => {
    const sprites = new Set(
      cases
        .filter(({ key }) => key.endsWith(`/${unitKind}`))
        .flatMap(({ locomotionSprites }) => locomotionSprites),
    );
    const observed = [...sprites].sort();
    return {
      unitKind,
      sprites: observed,
      complete: observed.includes("walk-a") && observed.includes("walk-b"),
    };
  })
  : null;
if (allSixteenLocomotionUnion) {
  invariant(
    allSixteenLocomotionUnion.every(({ complete }) => complete),
    "Merged deployment evidence does not show both walk-a and walk-b for all 16 units",
  );
}

const output = {
  generatedAt: new Date().toISOString(),
  mode,
  strategy: "canonical-full-baseline-plus-focused-failure-revalidation",
  axes: canonicalAxes,
  expectedTotal: expectedKeys.length,
  total: cases.length,
  passed: cases.filter(({ status }) => status === "passed").length,
  failed: cases.filter(({ status }) => status !== "passed").length,
  baseline: {
    path: path.relative(process.cwd(), baseline.absolutePath).replaceAll("\\", "/"),
    sha256: baseline.sha256,
    generatedAt: baseline.summary.generatedAt,
    buildFreshness: baseline.summary.buildFreshness,
    buildIdentityAtStart: baseline.summary.buildIdentityAtStart,
    buildIdentity: baseline.summary.buildIdentity,
    buildIdentityStable: baseline.summary.buildIdentityStable,
    passed: baseline.summary.passed,
    failed: baseline.summary.failed,
  },
  focusedRetry: {
    path: path.relative(process.cwd(), retry.absolutePath).replaceAll("\\", "/"),
    sha256: retry.sha256,
    generatedAt: retry.summary.generatedAt,
    buildFreshness: retry.summary.buildFreshness,
    buildIdentityAtStart: retry.summary.buildIdentityAtStart,
    buildIdentity: retry.summary.buildIdentity,
    buildIdentityStable: retry.summary.buildIdentityStable,
    passed: retry.summary.passed,
    failed: retry.summary.failed,
  },
  baselineFailureKeys: baselineFailures,
  revalidatedBaselineFailureCount: baselineFailures.length,
  reusedBaselinePassCount: cases.filter(({ source }) => source === "full-baseline").length,
  focusedRetryCaseCount: retry.summary.results.length,
  allSixteenLocomotionUnion,
  cases,
};

const outputPath = path.resolve(outputArgument);
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  output: path.relative(process.cwd(), outputPath).replaceAll("\\", "/"),
  mode: output.mode,
  expectedTotal: output.expectedTotal,
  passed: output.passed,
  failed: output.failed,
  revalidatedBaselineFailureCount: output.revalidatedBaselineFailureCount,
  focusedRetryCaseCount: output.focusedRetryCaseCount,
  allSixteenLocomotionComplete: output.allSixteenLocomotionUnion
    ? output.allSixteenLocomotionUnion.every(({ complete }) => complete)
    : null,
}, null, 2));
