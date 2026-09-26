import { spawn } from "node:child_process";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const CANONICAL_HUD_STATES = Object.freeze([
  "stage1-normal",
  "five-units",
  "deployment-banner",
  "manual-ability-banner",
  "objective-full",
  "support-disabled",
  "banner-bark-boss",
  "stage3-boss",
]);

function runProcess({ cwd, env, stateId, attemptDir }) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      "scripts/run-browser-qa-with-server.mjs",
      "scripts/v099-final-remediation-browser-smoke.mjs",
    ], {
      cwd,
      env: {
        ...env,
        V099_FINAL_REMEDIATION_QA_CASES: "hud",
        V099_FINAL_REMEDIATION_QA_HUD_STATES: stateId,
        V099_FINAL_REMEDIATION_QA_EVIDENCE_DIR: attemptDir,
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let output = "";
    const consume = (chunk, stream) => {
      const text = chunk.toString();
      output += text;
      stream.write(text);
    };
    child.stdout.on("data", (chunk) => consume(chunk, process.stdout));
    child.stderr.on("data", (chunk) => consume(chunk, process.stderr));
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve({ code, signal, output }));
  });
}

export function isolatedHudStatePassed(summary, stateId) {
  if (summary?.total !== 1 || summary.passed !== 1 || summary.failed !== 0) return false;
  if (summary.caseTypes?.length !== 1 || summary.caseTypes[0] !== "hud") return false;
  if (summary.hudStateFilterActive !== true
    || summary.hudStates?.length !== 1 || summary.hudStates[0] !== stateId) return false;
  const result = summary.results?.[0];
  return result?.type === "hud" && result.status === "passed"
    && result.states?.length === 1 && result.states[0]?.id === stateId
    && Boolean(result.states[0]?.screenshot)
    && Object.values(result.diagnostics ?? {}).every((entries) => entries.length === 0);
}

function cleanHudDiagnostics(diagnostics) {
  if (!diagnostics || typeof diagnostics !== "object") return false;
  const requiredKeys = ["consoleErrors", "pageErrors", "requestFailures", "httpErrors"];
  return requiredKeys.every((key) => Array.isArray(diagnostics[key]) && diagnostics[key].length === 0)
    && Object.values(diagnostics).every((entries) => Array.isArray(entries) && entries.length === 0);
}

async function evidencePathInside(rootPath, candidatePath) {
  try {
    const [root, candidate] = await Promise.all([
      realpath(rootPath),
      realpath(candidatePath),
    ]);
    const relative = path.relative(root, candidate);
    return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
  } catch {
    return false;
  }
}

async function readLifecycleJsonl(lifecyclePath) {
  try {
    const raw = await readFile(lifecyclePath, "utf8");
    const lines = raw.split(/\r?\n/u).filter((line) => line.trim().length > 0);
    if (lines.length === 0) return null;
    return lines.map((line) => {
      const entry = JSON.parse(line);
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error("invalid lifecycle entry");
      return entry;
    });
  } catch {
    return null;
  }
}

function hasTerminalTargetClosedOrCrash(text) {
  return /Target (?:page, context or browser has been closed|crashed)|Target crashed/i.test(String(text));
}

async function cleanUnexpectedHudCrashRetryable({ cwd, attemptDir, execution, summary, stateId }) {
  if (summary?.total !== 1 || summary.passed !== 0 || summary.failed !== 1) return false;
  if (summary.caseTypes?.length !== 1 || summary.caseTypes[0] !== "hud") return false;
  if (summary.hudStateFilterActive !== true
    || summary.hudStates?.length !== 1 || summary.hudStates[0] !== stateId) return false;
  const result = summary.results?.length === 1 ? summary.results[0] : null;
  if (result?.type !== "hud" || result.status !== "failed") return false;
  if (!cleanHudDiagnostics(result.diagnostics)) return false;
  if (summary.buildIdentityStable !== true) return false;
  const startSha = summary.buildIdentityAtStart?.combinedSha256;
  const endSha = summary.buildIdentityAtEnd?.combinedSha256;
  if (typeof startSha !== "string" || !startSha || startSha !== endSha) return false;
  const terminalText = [
    execution?.output,
    result.error,
    ...(summary.cases ?? []).map((entry) => entry?.error),
  ].filter(Boolean).join("\n");
  if (!hasTerminalTargetClosedOrCrash(terminalText)) return false;
  if (typeof result.lifecycleLog !== "string" || !result.lifecycleLog) return false;
  const resolvedLifecycle = path.resolve(cwd, result.lifecycleLog);
  if (!await evidencePathInside(path.resolve(cwd, attemptDir), resolvedLifecycle)) return false;
  const entries = await readLifecycleJsonl(resolvedLifecycle);
  if (!entries) return false;
  const crashEntries = entries.filter((entry) => entry.event === "page crash" && entry.unexpected === true);
  if (crashEntries.length !== 1) return false;
  const crashIndex = entries.indexOf(crashEntries[0]);
  const beforeCrash = entries.slice(0, crashIndex);
  if (crashEntries[0].normalCleanupStarted === true
    || beforeCrash.some((entry) => entry.normalCleanupStarted === true
      || ["page close begin", "context close begin", "browser close begin", "page close"].includes(entry.event))) {
    return false;
  }
  if (!beforeCrash.some((entry) => entry.event === "battle readiness complete"
    || entry.milestone === "battle readiness complete")) return false;
  if (entries.slice(0, crashIndex + 1).some((entry) => (
    entry.pageDiagnostics && !cleanHudDiagnostics(entry.pageDiagnostics)
  ))) return false;
  return true;
}

export async function runCanonicalHudStates({
  cwd = process.cwd(),
  env = process.env,
  evidenceRoot = env.ISSUE156_WEBKIT_HUD_EVIDENCE_ROOT,
  stateIds = CANONICAL_HUD_STATES,
  runAttempt,
} = {}) {
  if (!evidenceRoot) throw new Error("ISSUE156_WEBKIT_HUD_EVIDENCE_ROOT is required");
  if (stateIds.length !== CANONICAL_HUD_STATES.length
    || new Set(stateIds).size !== stateIds.length
    || !CANONICAL_HUD_STATES.every((stateId) => stateIds.includes(stateId))) {
    throw new Error("HUD state inventory must contain every canonical state exactly once");
  }
  const root = path.resolve(cwd, evidenceRoot);
  await mkdir(root, { recursive: true });
  const states = [];
  for (const stateId of stateIds) {
    const attempts = [];
    for (let attempt = 1; attempt <= 1; attempt += 1) {
      const attemptDir = path.join(root, stateId, `attempt-${attempt}`);
      await mkdir(attemptDir, { recursive: true });
      const execution = await (runAttempt ?? runProcess)({ cwd, env, stateId, attempt, attemptDir });
      await writeFile(path.join(attemptDir, "runner.log"), execution.output ?? "", "utf8");
      const summary = await readFile(path.join(attemptDir, "summary.json"), "utf8")
        .then(JSON.parse)
        .catch(() => null);
      const passed = execution.code === 0 && isolatedHudStatePassed(summary, stateId);
      const retryableTargetClosed = execution.code !== 0 && await cleanUnexpectedHudCrashRetryable({
        cwd,
        attemptDir,
        execution,
        summary,
        stateId,
      });
      attempts.push({ attempt, code: execution.code, signal: execution.signal ?? null, passed, retryableTargetClosed, summary });
      if (passed) break;

      break;
    }
    const passed = attempts.at(-1)?.passed === true;
    states.push({ stateId, passed, attempts });
    if (!passed) break;
  }
  const complete = states.length === CANONICAL_HUD_STATES.length
    && states.every(({ passed }) => passed);
  const report = { status: complete ? "passed" : "failed", canonicalStates: CANONICAL_HUD_STATES, states };
  await writeFile(path.join(root, "bounded-summary.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  if (!complete) throw new Error(`bounded HUD evidence failed at ${states.at(-1)?.stateId ?? "inventory"}`);
  return report;
}

export async function runOneHudStateBounded({
  stateId,
  cwd = process.cwd(),
  env = process.env,
  evidenceRoot = env.ISSUE156_WEBKIT_HUD_EVIDENCE_ROOT,
  runAttempt,
} = {}) {
  if (!CANONICAL_HUD_STATES.includes(stateId)) throw new Error(`unsupported isolated HUD state: ${stateId}`);
  if (!evidenceRoot) throw new Error("ISSUE156_WEBKIT_HUD_EVIDENCE_ROOT is required");
  const root = path.resolve(cwd, evidenceRoot);
  await mkdir(root, { recursive: true });
  const attempts = [];
  for (let attempt = 1; attempt <= 1; attempt += 1) {
    const attemptDir = path.join(root, `attempt-${attempt}`);
    await mkdir(attemptDir, { recursive: true });
    const execution = await (runAttempt ?? runProcess)({ cwd, env, stateId, attempt, attemptDir });
    await writeFile(path.join(attemptDir, "runner.log"), execution.output ?? "", "utf8");
      const summary = await readFile(path.join(attemptDir, "summary.json"), "utf8")
        .then(JSON.parse)
        .catch(() => null);
      const passed = execution.code === 0 && isolatedHudStatePassed(summary, stateId);
      const retryableTargetClosed = execution.code !== 0 && await cleanUnexpectedHudCrashRetryable({
        cwd,
        attemptDir,
        execution,
        summary,
        stateId,
      });
    attempts.push({ attempt, code: execution.code, signal: execution.signal ?? null, passed, retryableTargetClosed, summary });
    if (passed) break;

      break;
  }
  const passed = attempts.at(-1)?.passed === true;
  const report = { status: passed ? "passed" : "failed", stateId, attempts };
  await writeFile(path.join(root, "bounded-summary.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  if (!passed) throw new Error(`bounded HUD evidence failed at ${stateId}`);
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const stateId = process.env.ISSUE156_WEBKIT_HUD_STATE;
  if (stateId) await runOneHudStateBounded({ stateId });
  else await runCanonicalHudStates();
}
