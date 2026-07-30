import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const [proofScope, baselineArgument, retryArgument, outputArgument] = process.argv.slice(2);
if (!["representative-six", "remaining-ten"].includes(proofScope)
  || !baselineArgument
  || !retryArgument
  || !outputArgument) {
  throw new Error(
    "Usage: node scripts/v095-merge-representative-qa-evidence.mjs "
    + "<representative-six|remaining-ten> <baseline-summary> <retry-summary> <output>",
  );
}

const canonicalEngines = ["chromium", "webkit"];
const canonicalViewports = ["844x390", "844x340"];

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function viewportKey(viewport) {
  return `${viewport.width}x${viewport.height}`;
}

function caseKey(result) {
  return `${result.engine}/${viewportKey(result.viewport)}`;
}

function diagnosticCount(result) {
  return Object.values(result.diagnostics ?? {}).reduce(
    (total, entries) => total + (Array.isArray(entries) ? entries.length : 0),
    0,
  );
}

async function readSummary(argument) {
  const absolutePath = path.resolve(argument);
  const bytes = await readFile(absolutePath);
  return {
    absolutePath,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    summary: JSON.parse(bytes.toString("utf8")),
  };
}

function validate(source, expectedCaseCount = null) {
  const { absolutePath, summary } = source;
  invariant(summary.proofScope === proofScope, `${absolutePath}: proofScope mismatch`);
  invariant(Array.isArray(summary.results) && summary.results.length > 0,
    `${absolutePath}: empty results`);
  if (expectedCaseCount !== null) {
    invariant(summary.results.length === expectedCaseCount,
      `${absolutePath}: expected ${expectedCaseCount} canonical cases`);
  }
  const keys = summary.results.map(caseKey);
  invariant(new Set(keys).size === keys.length, `${absolutePath}: duplicate case key`);
  invariant(summary.results.every((result) => (
    canonicalEngines.includes(result.engine)
      && canonicalViewports.includes(viewportKey(result.viewport))
  )), `${absolutePath}: non-canonical case`);
  invariant(summary.results.every((result) => diagnosticCount(result) === 0),
    `${absolutePath}: browser diagnostics were not clean`);
  invariant(
    /^[a-f0-9]{64}$/u.test(summary.buildIdentity?.combinedSha256 ?? ""),
    `${absolutePath}: build identity missing`,
  );
}

const baseline = await readSummary(baselineArgument);
const retry = await readSummary(retryArgument);
validate(baseline, canonicalEngines.length * canonicalViewports.length);
validate(retry);
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
invariant(baselineFailures.length > 0, "Merge requires a baseline with failures");
invariant(retry.summary.results.every(({ status }) => status === "passed"),
  "Focused retry contains a failed case");
invariant([...retryByKey.keys()].every((key) => baselineFailures.includes(key)),
  "Focused retry contains a case that was not a baseline failure");
for (const failedKey of baselineFailures) {
  invariant(retryByKey.has(failedKey), `Missing retry for ${failedKey}`);
}

const expectedKeys = canonicalEngines.flatMap((engine) => (
  canonicalViewports.map((viewport) => `${engine}/${viewport}`)
));
const cases = expectedKeys.map((key) => {
  const retryResult = retryByKey.get(key);
  const result = retryResult ?? baselineByKey.get(key);
  invariant(result, `Missing canonical case ${key}`);
  return {
    key,
    source: retryResult ? "focused-retry" : "full-baseline",
    status: result.status,
    unitCount: result.representativeKinds?.length ?? 0,
    qualityProofCount: result.qualityProofs?.length ?? 0,
    speedProofCount: result.speedProofs?.length ?? 0,
    diagnosticCount: diagnosticCount(result),
  };
});
invariant(cases.every(({ status }) => status === "passed"),
  "Merged evidence still contains failed cases");

const output = {
  generatedAt: new Date().toISOString(),
  proofScope,
  strategy: "canonical-full-baseline-plus-focused-failure-revalidation",
  expectedTotal: expectedKeys.length,
  total: cases.length,
  passed: cases.length,
  failed: 0,
  baseline: {
    path: path.relative(process.cwd(), baseline.absolutePath).replaceAll("\\", "/"),
    sha256: baseline.sha256,
    generatedAt: baseline.summary.generatedAt,
    passed: baseline.summary.totals?.passed ?? null,
    failed: baseline.summary.totals?.failed ?? null,
    buildIdentity: baseline.summary.buildIdentity,
  },
  focusedRetry: {
    path: path.relative(process.cwd(), retry.absolutePath).replaceAll("\\", "/"),
    sha256: retry.sha256,
    generatedAt: retry.summary.generatedAt,
    passed: retry.summary.totals?.passed ?? null,
    failed: retry.summary.totals?.failed ?? null,
    buildIdentity: retry.summary.buildIdentity,
  },
  baselineFailureKeys: baselineFailures,
  revalidatedBaselineFailureCount: baselineFailures.length,
  cases,
};

const outputPath = path.resolve(outputArgument);
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  output: path.relative(process.cwd(), outputPath).replaceAll("\\", "/"),
  proofScope,
  passed: output.passed,
  failed: output.failed,
  revalidatedBaselineFailureCount: output.revalidatedBaselineFailureCount,
}, null, 2));
