import assert from "node:assert/strict";
import { mkdir, readdir } from "node:fs/promises";

export async function preparePublicEvidenceDirectory(directory) {
  await mkdir(directory, { recursive: true });
  // The workflow redirects stdout here before the script starts. Prior evidence must survive.
  assert.deepEqual((await readdir(directory)).filter(name => name !== "public-smoke.log"), [],
    "Public QA requires fresh evidence; only the workflow's live log may already exist");
}
