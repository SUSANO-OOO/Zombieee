import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { isRetryableTargetClosedLog } from "./run-v0995-enemy-runtime-bounded.mjs";

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
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const attemptDir = path.join(root, stateId, `attempt-${attempt}`);
      await mkdir(attemptDir, { recursive: true });
      const execution = await (runAttempt ?? runProcess)({ cwd, env, stateId, attempt, attemptDir });
      await writeFile(path.join(attemptDir, "runner.log"), execution.output ?? "", "utf8");
      const summary = await readFile(path.join(attemptDir, "summary.json"), "utf8")
        .then(JSON.parse)
        .catch(() => null);
      const passed = execution.code === 0 && isolatedHudStatePassed(summary, stateId);
      const failureText = `${execution.output ?? ""}\n${summary?.results?.[0]?.error ?? ""}\n${summary?.cases?.[0]?.error ?? ""}`;
      const retryableTargetClosed = execution.code !== 0 && isRetryableTargetClosedLog(failureText);
      attempts.push({ attempt, code: execution.code, signal: execution.signal ?? null, passed, retryableTargetClosed, summary });
      if (passed) break;
      if (attempt !== 1 || !retryableTargetClosed) break;
      console.warn(`Retrying HUD state ${stateId} once after an exact hosted-WebKit target-closed incident.`);
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
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const attemptDir = path.join(root, `attempt-${attempt}`);
    await mkdir(attemptDir, { recursive: true });
    const execution = await (runAttempt ?? runProcess)({ cwd, env, stateId, attempt, attemptDir });
    await writeFile(path.join(attemptDir, "runner.log"), execution.output ?? "", "utf8");
    const summary = await readFile(path.join(attemptDir, "summary.json"), "utf8")
      .then(JSON.parse)
      .catch(() => null);
    const passed = execution.code === 0 && isolatedHudStatePassed(summary, stateId);
    const failureText = `${execution.output ?? ""}\n${summary?.results?.[0]?.error ?? ""}\n${summary?.cases?.[0]?.error ?? ""}`;
    const retryableTargetClosed = execution.code !== 0 && isRetryableTargetClosedLog(failureText);
    attempts.push({ attempt, code: execution.code, signal: execution.signal ?? null, passed, retryableTargetClosed, summary });
    if (passed) break;
    if (attempt !== 1 || !retryableTargetClosed) break;
    console.warn(`Retrying HUD state ${stateId} once after an exact hosted-WebKit target-closed incident.`);
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
