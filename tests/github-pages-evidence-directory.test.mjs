import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { preparePublicEvidenceDirectory } from "../scripts/github-pages-evidence-directory.mjs";

test("public evidence accepts a fresh directory and the workflow's precreated live log", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "zombieee-pages-evidence-"));
  try {
    await preparePublicEvidenceDirectory(path.join(root, "fresh"));
    const workflow = path.join(root, "workflow"); await mkdir(workflow);
    await writeFile(path.join(workflow, "public-smoke.log"), "live workflow log");
    await preparePublicEvidenceDirectory(workflow);
    assert.equal(await readFile(path.join(workflow, "public-smoke.log"), "utf8"), "live workflow log");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("a prior report or screenshot prevents evidence reuse without overwriting it", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "zombieee-pages-evidence-"));
  try {
    for (const file of ["summary.json", "battle.png"]) {
      const directory = path.join(root, file); await mkdir(directory);
      await writeFile(path.join(directory, file), "retained failed evidence");
      await assert.rejects(preparePublicEvidenceDirectory(directory), /requires fresh evidence/u);
      assert.equal(await readFile(path.join(directory, file), "utf8"), "retained failed evidence");
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
