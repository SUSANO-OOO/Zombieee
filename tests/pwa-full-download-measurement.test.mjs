import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("full-pack measurement is sequential, retains AB/BA samples, and has no success threshold", async () => {
  const source = await readFile(new URL("../scripts/pwa-full-download-measurement.mjs", import.meta.url), "utf8");
  assert.match(source, /MEASURED_PAIR_ORDERS = Object\.freeze\(\["AB", "BA", "AB", "BA", "AB"\]\)/);
  assert.match(source, /warmup\.push\(await measure\("warmup 0\.9\.8\.1/);
  assert.match(source, /for \(const \[index, order\] of MEASURED_PAIR_ORDERS\.entries\(\)\)/);
  assert.match(source, /baselineSummary = summarizeRetainedRuns/);
  assert.match(source, /candidateSummary = summarizeRetainedRuns/);
  assert.match(source, /fullDownloadElapsedMs:[\s\S]*baselineMedian:[\s\S]*candidateMedian:/);
  assert.doesNotMatch(source, /Promise\.all/);
  assert.doesNotMatch(source, /passesFiftyPercentTarget|fifty.?percent|50%/i);
});
