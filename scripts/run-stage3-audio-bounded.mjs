import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { isRetryableTargetClosedLog } from "./run-v0995-enemy-runtime-bounded.mjs";
import { createWebKitHostResourceTelemetry } from "./webkit-host-resource-telemetry.mjs";

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

export function isRetryableTargetClosed(summary, mode = "final") {
  if (!["entrance", "final"].includes(mode)) return false;
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
  const expectedKind = mode === "entrance" ? "takuya-entrance-audio" : "takuya-final-audio";
  const allowedPhases = mode === "entrance"
    ? ["navigation", "entrance-start", "entrance-restart", "boss-music-duck-release"]
    : ["navigation", "final-cut", "final-fifo"];
  return failure.kind === expectedKind
    && allowedPhases.includes(failure.phase)
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

export async function runStage3AudioBounded({
  baseRoot = process.argv[2] ? path.resolve(process.argv[2]) : null,
  mode = process.env.P5_QA_BATTLE_AUDIO_CASES ?? "final",
  evidenceRoot = path.resolve(process.env.P5_QA_EVIDENCE_DIR ?? `outputs/p5-stage3-${mode}-bounded`),
  executeAttempt = runAttempt,
  createHostResourceTelemetry = createWebKitHostResourceTelemetry,
} = {}) {
  if (!["entrance", "final"].includes(mode)) {
    throw new Error(`Stage 3 bounded mode must be entrance or final, received ${mode}`);
  }
  if (typeof createHostResourceTelemetry !== "function") {
    throw new Error("Stage 3 telemetry factory must be a function");
  }
  if (createHostResourceTelemetry !== createWebKitHostResourceTelemetry && executeAttempt === runAttempt) {
    throw new Error("Stage 3 telemetry override requires an injected executeAttempt");
  }
  await mkdir(evidenceRoot, { recursive: true });
  const hostResourceTelemetry = await createHostResourceTelemetry({
    evidenceDir: evidenceRoot,
    label: `stage3-${mode}-bounded-parent`,
    referenceRoot: evidenceRoot,
    metadata: {
      owner: "stage3-audio-bounded-parent",
      mode,
      route: baseRoot ? "exact-base" : "candidate",
      maximumAttemptCount: 1,
    },
  });
  const attempts = [];
  let routePassed = false;
  let primaryError = null;
  let hostResourceTelemetrySummary = null;
  let hostResourceTelemetryStopError = null;
  try {
    for (let attempt = 1; attempt <= 1; attempt += 1) {
      const attemptDir = path.join(evidenceRoot, `attempt-${attempt}`);
      await mkdir(attemptDir, { recursive: true });
      hostResourceTelemetry.event("attempt-child-start", { attempt, mode });
      let execution;
      try {
        execution = await executeAttempt(baseRoot, attemptDir);
      } catch (error) {
        hostResourceTelemetry.event("attempt-child-exit", { attempt, mode, status: "runner-error" });
        throw error;
      }
      hostResourceTelemetry.event("attempt-child-exit", {
        attempt,
        mode,
        code: execution.code,
        signal: execution.signal ?? null,
      });
      const summaryPath = path.join(attemptDir, "summary.json");
      const summary = JSON.parse(await readFile(summaryPath, "utf8"));
      const retryableTargetClosed = execution.code !== 0 && isRetryableTargetClosed(summary, mode);
      attempts.push({ attempt, attemptDir, ...execution, retryableTargetClosed, summary });
      if (execution.code === 0) {
        routePassed = true;
        break;
      }

      break;
    }
  } catch (error) {
    primaryError = error;
  } finally {
    try {
      hostResourceTelemetrySummary = await hostResourceTelemetry.stop({
        event: "bounded-parent-complete",
        mode,
        attemptCount: attempts.length,
        routePassed,
      });
    } catch (error) {
      hostResourceTelemetryStopError = String(error);
      if (primaryError) {
        primaryError.hostResourceTelemetryFailure = {
          code: "WEBKIT_HOST_TELEMETRY_PERSISTENCE_FAILED",
          error: hostResourceTelemetryStopError,
        };
      }
    }
  }

  const hostResourceTelemetryValid = hostResourceTelemetrySummary?.supported === false
    || (hostResourceTelemetrySummary?.supported === true
      && hostResourceTelemetrySummary.status === "complete"
      && hostResourceTelemetrySummary.valid === true);
  const complete = routePassed
    && primaryError === null
    && hostResourceTelemetryStopError === null
    && hostResourceTelemetryValid;
  const report = {
    status: complete ? "passed" : "failed",
    mode,
    baseRoot,
    attempts,
    runnerError: primaryError ? String(primaryError) : null,
    hostResourceTelemetry: hostResourceTelemetry.reference(),
    hostResourceTelemetryStatus: hostResourceTelemetrySummary?.status ?? "failed",
    hostResourceTelemetryValidity: hostResourceTelemetrySummary?.valid ?? null,
    hostResourceTelemetryInvalidReason: hostResourceTelemetrySummary?.invalidReason ?? null,
    hostResourceTelemetryStopError,
  };
  await writeFile(path.join(evidenceRoot, "bounded-summary.json"), `${JSON.stringify(report, null, 2)}\n`);
  if (complete) {
    console.log(JSON.stringify({ status: report.status, mode, attempts: attempts.length, baseRoot }, null, 2));
    return report;
  }
  if (primaryError) throw primaryError;
  if (routePassed) throw new Error(`bounded Stage 3 ${mode} failed at host-resource-telemetry`);
  throw new Error(`bounded Stage 3 ${mode} failed after ${attempts.length} attempt(s)`);
}

export const runStage3FinalBounded = runStage3AudioBounded;

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runStage3AudioBounded();
}
