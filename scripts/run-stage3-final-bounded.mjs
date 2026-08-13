import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { isRetryableTargetClosedLog } from "./run-v0995-enemy-runtime-bounded.mjs";

function runAttempt(baseRoot, attemptDir) {
  const args = baseRoot
    ? ["scripts/run-browser-qa-against-build.mjs", "scripts/p5-browser-smoke.mjs", baseRoot]
    : ["scripts/run-browser-qa-with-server.mjs", "scripts/p5-browser-smoke.mjs"];
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      env: { ...process.env, P5_QA_EVIDENCE_DIR: attemptDir },
      stdio: "inherit",
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
}

export function emptyDiagnostics(diagnostics = {}) {
  return [
    "consoleErrors", "pageErrors", "requestFailures", "failedRequestDetails",
    "replacementRequestDetails", "httpErrors", "warnings",
  ]
    .every((key) => (diagnostics[key] ?? []).length === 0)
    && Number(diagnostics.pendingRequestCount ?? 0) === 0;
}

export function isRetryableTargetClosed(summary) {
  const failures = (summary.results ?? []).filter(({ status }) => status === "failed");
  if (summary.failed !== 1 || failures.length !== 1 || (summary.results ?? []).length !== 1) return false;
  const failure = failures[0];
  // A hard WebKit page closure can make the catch-time snapshot unavailable.
  // The fixture captures and strictly validates this stable production boundary
  // immediately before runtime-start, so retain it as the fail-closed proof.
  const setupState = failure.setupDiagnostics?.stableState;
  const state = failure.phase === "navigation"
    ? setupState
    : (failure.failureState ?? setupState);
  const setupRaw = failure.setupDiagnostics?.raw;
  return failure.kind === "takuya-final-audio"
    && ["navigation", "final-cut", "final-fifo"].includes(failure.phase)
    && isRetryableTargetClosedLog(failure.error ?? "")
    && state?.screen === "battle"
    && state?.assetReadiness?.state === "ready"
    && state?.assetReadiness?.pending === 0
    && state?.assetReadiness?.failed === 0
    && state?.battle?.screen === "battle"
    && state?.battle?.over === false
    && emptyDiagnostics(setupRaw)
    && emptyDiagnostics(failure.diagnostics);
}

export async function runStage3FinalBounded({
  baseRoot = process.argv[2] ? path.resolve(process.argv[2]) : null,
  evidenceRoot = path.resolve(process.env.P5_QA_EVIDENCE_DIR ?? "outputs/p5-stage3-final-bounded"),
  executeAttempt = runAttempt,
} = {}) {
  await mkdir(evidenceRoot, { recursive: true });
  const attempts = [];
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const attemptDir = path.join(evidenceRoot, `attempt-${attempt}`);
    await mkdir(attemptDir, { recursive: true });
    const execution = await executeAttempt(baseRoot, attemptDir);
    const summaryPath = path.join(attemptDir, "summary.json");
    const summary = JSON.parse(await readFile(summaryPath, "utf8"));
    const retryableTargetClosed = execution.code !== 0 && isRetryableTargetClosed(summary);
    attempts.push({ attempt, attemptDir, ...execution, retryableTargetClosed, summary });
    if (execution.code === 0) {
      const report = { status: "passed", baseRoot, attempts };
      await writeFile(path.join(evidenceRoot, "bounded-summary.json"), `${JSON.stringify(report, null, 2)}\n`);
      console.log(JSON.stringify({ status: report.status, attempts: attempts.length, baseRoot }, null, 2));
      return report;
    }
    if (attempt !== 1 || !retryableTargetClosed) break;
    console.warn("Retrying once after a clean hosted-WebKit target-closed incident; all product assertions remain required.");
  }
  const report = { status: "failed", baseRoot, attempts };
  await writeFile(path.join(evidenceRoot, "bounded-summary.json"), `${JSON.stringify(report, null, 2)}\n`);
  throw new Error(`bounded Stage 3 final failed after ${attempts.length} attempt(s)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runStage3FinalBounded();
}
