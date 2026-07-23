import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const matrix = [
  { engine: "chromium", viewport: "844x390" },
  { engine: "chromium", viewport: "844x340" },
  { engine: "webkit", viewport: "844x390" },
  { engine: "webkit", viewport: "844x340" },
];
const rootEvidenceDir = path.resolve(
  process.env.SAVE_MIGRATION_QA_EVIDENCE_DIR ?? "outputs/save-migration-browser-matrix",
);
await mkdir(rootEvidenceDir, { recursive: true });

function run(entry) {
  return new Promise((resolve, reject) => {
    const evidenceDir = path.join(rootEvidenceDir, `${entry.engine}-${entry.viewport}`);
    const child = spawn(process.execPath, [
      "scripts/run-browser-qa-with-server.mjs",
      "scripts/save-migration-browser-smoke.mjs",
    ], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        SAVE_MIGRATION_QA_ENGINE: entry.engine,
        SAVE_MIGRATION_QA_VIEWPORT: entry.viewport,
        SAVE_MIGRATION_QA_EVIDENCE_DIR: evidenceDir,
      },
      windowsHide: true,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve(evidenceDir);
      else reject(new Error(
        `${entry.engine}-${entry.viewport} exited with ${code ?? `signal ${signal}`}`,
      ));
    });
  });
}

const results = [];
for (const entry of matrix) {
  const evidenceDir = await run(entry);
  const summary = JSON.parse(await readFile(path.join(evidenceDir, "summary.json"), "utf8"));
  results.push({
    ...entry,
    passed: summary.passed,
    failed: summary.failed,
    evidenceDir,
  });
}

const summary = {
  generatedAt: new Date().toISOString(),
  passed: results.filter(({ failed }) => failed === 0).length,
  failed: results.filter(({ failed }) => failed > 0).length,
  results,
};
await writeFile(
  path.join(rootEvidenceDir, "summary.json"),
  `${JSON.stringify(summary, null, 2)}\n`,
  "utf8",
);
console.log(JSON.stringify(summary, null, 2));
