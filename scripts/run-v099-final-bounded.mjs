import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { onlyAbortedStaticStreams } from "./v099-final-bounded-contract.mjs";

const evidenceRoot = path.resolve(
  process.env.V099_FINAL_REMEDIATION_QA_EVIDENCE_DIR ?? "outputs/v099-final-bounded",
);

await mkdir(evidenceRoot, { recursive: true });

function runAttempt(attemptDir) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      "scripts/run-browser-qa-with-server.mjs",
      "scripts/v099-final-remediation-browser-smoke.mjs",
    ], {
      cwd: process.cwd(),
      env: { ...process.env, V099_FINAL_REMEDIATION_QA_EVIDENCE_DIR: attemptDir },
      stdio: "inherit",
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
}

const attempts = [];
for (let attempt = 1; attempt <= 2; attempt += 1) {
  const attemptDir = path.join(evidenceRoot, `attempt-${attempt}`);
  await mkdir(attemptDir, { recursive: true });
  const execution = await runAttempt(attemptDir);
  const summary = JSON.parse(await readFile(path.join(attemptDir, "summary.json"), "utf8"));
  const retryableStaticStreamAbort = execution.code !== 0 && onlyAbortedStaticStreams(summary);
  attempts.push({ attempt, ...execution, retryableStaticStreamAbort, summary });
  if (execution.code === 0) {
    const report = { status: "passed", attempts };
    await writeFile(path.join(evidenceRoot, "bounded-summary.json"), `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({ status: report.status, attempts: attempts.length }, null, 2));
    process.exit(0);
  }
  if (attempt !== 1 || !retryableStaticStreamAbort) break;
  console.warn("Retrying the complete HUD matrix once after an all-axis static-stream abort; every product assertion remains required.");
}

const report = { status: "failed", attempts };
await writeFile(path.join(evidenceRoot, "bounded-summary.json"), `${JSON.stringify(report, null, 2)}\n`);
throw new Error(`bounded final-remediation QA failed after ${attempts.length} attempt(s)`);
