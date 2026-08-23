import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const CANONICAL_DEPLOYMENT_KINDS = Object.freeze([
  "scout", "ranger", "brawler", "crazy-king", "kumaverson", "mayo-chan", "brute", "medic",
]);

function runProcess({ cwd, env, kind, attemptDir }) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      "scripts/run-browser-qa-with-server.mjs",
      "scripts/v099-final-remediation-browser-smoke.mjs",
    ], {
      cwd,
      env: {
        ...env,
        V099_FINAL_REMEDIATION_QA_CASES: "deployment",
        V099_FINAL_REMEDIATION_QA_DEPLOYMENT_UNITS: kind,
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

function assertUnitPass(summary, kind) {
  if (summary.total !== 1 || summary.passed !== 1 || summary.failed !== 0) return false;
  if (summary.caseTypes?.length !== 1 || summary.caseTypes[0] !== "deployment") return false;
  if (summary.deploymentUnits?.length !== 1 || summary.deploymentUnits[0]?.kind !== kind) return false;
  const result = summary.results?.[0];
  const unit = result?.units?.[0];
  return result?.type === "deployment" && result.status === "passed"
    && result.units?.length === 1 && unit?.kind === kind && unit.status === "passed"
    && unit.checkpoints?.length === 6 && Boolean(unit.contactSheet)
    && Object.values(result.diagnostics ?? {}).every((entries) => entries.length === 0);
}

export async function runCanonicalDeploymentUnits({
  cwd = process.cwd(),
  env = process.env,
  evidenceRoot = env.ISSUE156_WEBKIT_DEPLOYMENT_EVIDENCE_ROOT,
  kinds = CANONICAL_DEPLOYMENT_KINDS,
  runAttempt,
} = {}) {
  if (!evidenceRoot) throw new Error("ISSUE156_WEBKIT_DEPLOYMENT_EVIDENCE_ROOT is required");
  if (kinds.length !== CANONICAL_DEPLOYMENT_KINDS.length
    || new Set(kinds).size !== kinds.length
    || !CANONICAL_DEPLOYMENT_KINDS.every((kind) => kinds.includes(kind))) {
    throw new Error("deployment unit inventory must contain every canonical kind exactly once");
  }
  const root = path.resolve(cwd, evidenceRoot);
  await mkdir(root, { recursive: true });
  const units = [];
  for (const kind of kinds) {
    const attempts = [];
    const attempt = 1;
    const attemptDir = path.join(root, kind, `attempt-${attempt}`);
    await mkdir(attemptDir, { recursive: true });
    const execution = await (runAttempt ?? runProcess)({ cwd, env, kind, attempt, attemptDir });
    await writeFile(path.join(attemptDir, "runner.log"), execution.output ?? "", "utf8");
    const summary = await readFile(path.join(attemptDir, "summary.json"), "utf8")
      .then(JSON.parse)
      .catch(() => null);
    const passed = execution.code === 0 && summary && assertUnitPass(summary, kind);
    attempts.push({ attempt, code: execution.code, signal: execution.signal ?? null, passed, summary });
    units.push({ kind, passed, attempts });
    if (!passed) break;
  }
  const complete = units.length === CANONICAL_DEPLOYMENT_KINDS.length && units.every(({ passed }) => passed);
  const report = { status: complete ? "passed" : "failed", canonicalKinds: CANONICAL_DEPLOYMENT_KINDS, units };
  await writeFile(path.join(root, "bounded-summary.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  if (!complete) throw new Error(`bounded deployment evidence failed at ${units.at(-1)?.kind ?? "inventory"}`);
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runCanonicalDeploymentUnits();
}
