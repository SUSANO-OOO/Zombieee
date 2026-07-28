import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const survivalGate = await readFile(
  new URL("../scripts/survival-wave-progression-browser-smoke.mjs", import.meta.url),
  "utf8",
);
const infectedGate = await readFile(
  new URL("../scripts/ai-mission-browser-smoke.mjs", import.meta.url),
  "utf8",
);
const infectedWrapper = await readFile(
  new URL("../scripts/v090-infected-browser-smoke.mjs", import.meta.url),
  "utf8",
);

test("RC package scripts expose actual Survival wave and infected ability gates", () => {
  assert.equal(
    packageJson.scripts["qa:survival-waves"],
    "node scripts/run-browser-qa-with-server.mjs scripts/survival-wave-progression-browser-smoke.mjs",
  );
  assert.equal(
    packageJson.scripts["qa:v090-infected-runtime"],
    "node scripts/run-browser-qa-with-server.mjs scripts/v090-infected-browser-smoke.mjs",
  );
});

test("Survival RC gate progresses wave 1-5 without the completion QA hook", () => {
  assert.doesNotMatch(survivalGate, /prepareSurvivalUpgradeProof/);
  assert.match(survivalGate, /run\.lastCompletedWave >= 5/);
  assert.match(survivalGate, /final\.survivalRun\.stats\.bossKills >= 1/);
  assert.match(survivalGate, /\.unit-card:not\(:disabled\)/);
});

test("infected RC gate observes warning and active phases on Stage 17-20", () => {
  assert.match(infectedWrapper, /AI_MISSION_QA_STAGES \?\?= "17,18,19,20"/);
  assert.match(infectedWrapper, /AI_MISSION_QA_INFECTED_ABILITIES = "1"/);
  assert.match(infectedGate, /requestAnimationFrame\(sample\)/);
  assert.match(infectedGate, /phases\.includes\("warning"\) && phases\.includes\("active"\)/);
});
