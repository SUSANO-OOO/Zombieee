import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

const repositoryRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

function runHistoryProbe(input) {
  const result = spawnSync(process.execPath, ["scripts/v100-phase-g-production-matrix.mjs"], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      V100_PHASE_G_CAUSAL_HISTORY_PROBE: "1",
      V100_PHASE_G_CAUSAL_HISTORY_PROBE_INPUT: JSON.stringify(input),
    },
    encoding: "utf8",
  });
  const output = `${result.stdout}\n${result.stderr}`;
  assert.equal(result.status, 0, output);
  return JSON.parse(result.stdout.trim());
}

const edge = Object.freeze({ sourceId: 13, targetId: 25, weapon: "suppressed-pistol" });
const impactSample = Object.freeze({
  battlePresentationEffects: [{ semantic: "impact" }],
  fighters: [{ id: 25, side: "zombie", kind: "futago", flash: 0.2, knock: 0 }],
  audioCueRequests: [{ cueId: "weapon-suppressed-hit" }],
});

test("r11 keeps an observed source-target edge after later runtime frames are empty", () => {
  const result = runHistoryProbe({
    observerFrames: [
      { attackIdentity: [edge] },
      { attackIdentity: [], pendingWeaponHits: [], battlePresentationEffects: [] },
    ],
    waitSnapshot: { attackIdentity: [], pendingWeaponHits: [], battlePresentationEffects: [] },
    proofSamples: [impactSample],
  });
  assert.deepEqual(result.history.sourceToTargetEdges, ["13->25"]);
  assert.deepEqual(result.proof.sourceToTargetEdges, ["13->25"]);
  assert.equal(result.proof.stages.source, true);
  assert.equal(result.proof.ok, true);
});

test("r11 wait-for-activity merge cannot replace observer history with an instantaneous snapshot", () => {
  const result = runHistoryProbe({
    observerFrames: [{ pendingWeaponHits: [edge] }],
    waitSnapshot: {
      attackIdentity: [],
      pendingWeaponHits: [],
      battlePresentationEffects: [{ semantic: "support-impact" }],
    },
    proofSamples: [impactSample],
  });
  assert.deepEqual(result.history.sourceToTargetEdges, ["13->25"]);
  assert.match(JSON.stringify(result.history.battlePresentationEffects), /support-impact/u);
  assert.equal(result.proof.stages.source, true);
});

test("r11 serializes stable source attribution from the actual production channel", () => {
  const result = runHistoryProbe({
    observerFrames: [
      { attackIdentity: [edge] },
      { attackIdentity: [edge] },
    ],
    waitSnapshot: { attackIdentity: [], pendingWeaponHits: [], battlePresentationEffects: [] },
    proofSamples: [impactSample],
  });
  assert.deepEqual(result.history.sourceAttribution, [{
    edge: "13->25",
    sourceId: 13,
    targetId: 25,
    channel: "attackIdentity",
  }]);
  assert.equal(result.proof.sourceAttribution.length, 1);
});

test("r11 does not substitute attacker, impact, reaction, or audio evidence for a missing source-target edge", () => {
  const result = runHistoryProbe({
    observerFrames: [{
      attackIdentity: [],
      pendingWeaponHits: [],
      attackingActors: ["zombie:red-panther-commander"],
    }],
    waitSnapshot: { attackIdentity: [], pendingWeaponHits: [], battlePresentationEffects: [] },
    proofSamples: [impactSample],
  });
  assert.deepEqual(result.history.sourceToTargetEdges, []);
  assert.equal(result.proof.stages.source, false);
  assert.equal(result.proof.stages.travelOrContact, true);
  assert.equal(result.proof.stages.targetReaction, true);
  assert.equal(result.proof.stages.audio, true);
  assert.equal(result.proof.ok, false);
});
