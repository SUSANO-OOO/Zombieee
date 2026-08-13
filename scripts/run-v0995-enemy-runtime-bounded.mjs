import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OPERATION_TARGET_CLOSED = "(?:page|browser|browserContext|context|locator|elementHandle)\\.[a-zA-Z]+:\\s*Target (?:page, context or browser has been closed|crashed)";
const DIRECT_TARGET_CLOSED_LINE = new RegExp(`^(?:Error:\\s*)?${OPERATION_TARGET_CLOSED}$`, "u");
const LABELED_TARGET_CLOSED_LINE = new RegExp(`^(?:Error:\\s*)?(?:[a-z]+-\\d+x\\d+\\/[a-z0-9-]+|[a-z]+\\/\\d+x\\d+\\/[a-z0-9-]+(?:\\/[a-z0-9-]+)?):\\s*(?:Error:\\s*)?${OPERATION_TARGET_CLOSED}$`, "u");
const TARGET_CRASHED_LINE = /^(?:Error:\s*)?Target crashed$/u;

export function isRetryableTargetClosedLog(log) {
  return String(log).split(/\r?\n/u)
    .map((line) => line.trim())
    .some((line) => TARGET_CRASHED_LINE.test(line)
      || DIRECT_TARGET_CLOSED_LINE.test(line)
      || LABELED_TARGET_CLOSED_LINE.test(line));
}

function runProcess({ cwd, env, command, args, onOutput }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let output = "";
    const consume = (chunk, stream) => {
      const text = chunk.toString();
      output += text;
      stream.write(text);
      onOutput?.(text);
    };
    child.stdout.on("data", (chunk) => consume(chunk, process.stdout));
    child.stderr.on("data", (chunk) => consume(chunk, process.stderr));
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve({ code, signal, output }));
  });
}

export async function runBoundedEnemyRuntime({
  cwd = process.cwd(),
  env = process.env,
  evidenceRoot = env.V0995_ENEMY_QA_EVIDENCE_DIR,
  maxAttempts = 2,
  runAttempt,
} = {}) {
  if (!evidenceRoot) throw new Error("V0995_ENEMY_QA_EVIDENCE_DIR is required");
  if (maxAttempts !== 2) throw new Error("enemy runtime bounded runner requires exactly two maximum attempts");
  const root = path.resolve(cwd, evidenceRoot);
  await mkdir(root, { recursive: true });
  const attempts = [];
  const execute = runAttempt ?? (async ({ attemptDir }) => runProcess({
    cwd,
    env: {
      ...env,
      V0995_ENEMY_QA_EVIDENCE_DIR: attemptDir,
      V0995_ENEMY_QA_COMPACT_DIR: path.join(attemptDir, "compact"),
    },
    command: process.execPath,
    args: ["scripts/run-browser-qa-with-server.mjs", "scripts/v0995-enemy-runtime-browser-smoke.mjs"],
  }));

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const attemptDir = path.join(root, `attempt-${attempt}`);
    await mkdir(attemptDir, { recursive: true });
    const execution = await execute({ attempt, attemptDir });
    await writeFile(path.join(attemptDir, "runner.log"), execution.output ?? "", "utf8");
    const retryableTargetClosed = execution.code !== 0 && isRetryableTargetClosedLog(execution.output);
    attempts.push({ attempt, code: execution.code, signal: execution.signal ?? null, retryableTargetClosed });
    if (execution.code === 0) {
      const report = { status: "passed", attempts };
      await writeFile(path.join(root, "bounded-summary.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
      return report;
    }
    if (attempt !== 1 || !retryableTargetClosed) break;
    console.warn("Retrying once after an exact hosted-WebKit target-closed incident; every product assertion remains required.");
  }
  const report = { status: "failed", attempts };
  await writeFile(path.join(root, "bounded-summary.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  throw new Error(`bounded enemy runtime evidence failed after ${attempts.length} attempt(s)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runBoundedEnemyRuntime();
}
