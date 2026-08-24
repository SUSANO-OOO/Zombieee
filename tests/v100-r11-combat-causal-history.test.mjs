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
const impactWithoutReaction = Object.freeze({
  battlePresentationEffects: [{ semantic: "impact" }],
  fighters: [],
  damageTexts: [],
  audioCueRequests: [{ cueId: "weapon-suppressed-hit" }],
});

test("r11 keeps an observed source-target edge after later runtime frames are empty", () => {
  const result = runHistoryProbe({
    observerFrames: [
      {
        time: 12.4,
        attackIdentity: [edge],
        fighters: [{
          id: 25,
          side: "zombie",
          kind: "futago",
          flash: 0.12,
          knock: 0.08,
          animationPresentation: { state: "hurt" },
        }],
        damageTexts: [{ value: "-12" }],
      },
      { time: 12.44, fighters: [], damageTexts: [], attackIdentity: [], pendingWeaponHits: [], battlePresentationEffects: [] },
    ],
    waitSnapshot: { time: 12.48, fighters: [], damageTexts: [], attackIdentity: [], pendingWeaponHits: [], battlePresentationEffects: [] },
    proofSamples: [impactWithoutReaction],
  });
  assert.deepEqual(result.history.sourceToTargetEdges, ["13->25"]);
  assert.deepEqual(result.history.reactionHistory, [
    { battleTime: 12.4, targetId: 25, targetSide: "zombie", targetKind: "futago", channel: "fighter-flash", state: null, value: 0.12 },
    { battleTime: 12.4, targetId: 25, targetSide: "zombie", targetKind: "futago", channel: "fighter-knock", state: null, value: 0.08 },
    { battleTime: 12.4, targetId: 25, targetSide: "zombie", targetKind: "futago", channel: "fighter-animation", state: "hurt", value: null },
  ]);
  assert.deepEqual(result.proof.sourceToTargetEdges, ["13->25"]);
  assert.deepEqual(result.proof.reactionHistory, result.history.reactionHistory);
  assert.deepEqual(result.proof.targetReactionHistory, result.history.reactionHistory);
  assert.equal(result.proof.stages.source, true);
  assert.equal(result.proof.stages.targetReaction, true);
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

  const bounded = runHistoryProbe({
    observerFrames: [{
      time: 20,
      fighters: Array.from({ length: 110 }, (_, index) => ({
        id: index + 1,
        side: "zombie",
        kind: `enemy-${index + 1}`,
        flash: 0.1,
        knock: 0,
      })),
    }],
    waitSnapshot: { time: 20.04, fighters: [], damageTexts: [] },
    proofSamples: [],
  });
  assert.equal(bounded.history.reactionHistory.length, 96);
  assert.deepEqual(bounded.history.reactionHistory.map(({ targetId }) => targetId), Array.from({ length: 96 }, (_, index) => index + 1));
  assert.equal(bounded.history.reactionHistory.some(({ targetId }) => targetId === 97), false);
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
  assert.equal(result.proof.stages.targetReaction, false);
  assert.deepEqual(result.proof.targetReactionHistory, []);
  assert.equal(result.proof.stages.audio, true);
  assert.equal(result.proof.ok, false);

  const noReactionSubstitution = runHistoryProbe({
    observerFrames: [{
      time: 30,
      fighters: [],
      attackIdentity: [],
      pendingWeaponHits: [edge],
      battlePresentationEffects: [{ semantic: "impact" }],
      damageTexts: [],
    }],
    waitSnapshot: { time: 30.04, fighters: [], attackIdentity: [], pendingWeaponHits: [], battlePresentationEffects: [], damageTexts: [] },
    proofSamples: [impactWithoutReaction],
  });
  assert.equal(noReactionSubstitution.proof.stages.source, true);
  assert.equal(noReactionSubstitution.proof.stages.travelOrContact, true);
  assert.equal(noReactionSubstitution.proof.stages.targetReaction, false);
  assert.equal(noReactionSubstitution.proof.stages.audio, true);
  assert.deepEqual(noReactionSubstitution.proof.reactionHistory, []);
  assert.deepEqual(noReactionSubstitution.proof.targetReactionHistory, []);
  assert.equal(noReactionSubstitution.proof.ok, false);

  const damageTextSubstitution = runHistoryProbe({
    observerFrames: [{
      time: 31,
      fighters: [],
      pendingWeaponHits: [edge],
      damageTexts: [
        { value: "-12" },
        { value: "索敵マーク" },
        { value: "救護" },
        { value: "+14" },
      ],
    }],
    waitSnapshot: { time: 31.04, fighters: [], attackIdentity: [], pendingWeaponHits: [], battlePresentationEffects: [], damageTexts: [] },
    proofSamples: [{
      ...impactWithoutReaction,
      damageTexts: [{ value: "-12" }, { value: "索敵マーク" }, { value: "救護" }, { value: "+14" }],
      activityReactionHistory: [
        { channel: "damage-text", targetId: 25, targetSide: "zombie", targetKind: "futago", state: null, value: "-12" },
        { channel: "fighter-flash", targetId: 25, targetSide: "zombie", targetKind: "futago", state: null, value: 0 },
        { channel: "fighter-animation", targetId: 25, targetSide: "zombie", targetKind: "futago", state: "idle", value: null },
      ],
    }],
  });
  assert.equal(damageTextSubstitution.proof.stages.source, true);
  assert.equal(damageTextSubstitution.proof.stages.travelOrContact, true);
  assert.equal(damageTextSubstitution.proof.stages.targetReaction, false);
  assert.equal(damageTextSubstitution.proof.stages.audio, true);
  assert.deepEqual(damageTextSubstitution.history.reactionHistory, []);
  assert.deepEqual(damageTextSubstitution.proof.reactionHistory, []);
  assert.deepEqual(damageTextSubstitution.proof.targetReactionHistory, []);
  assert.equal(damageTextSubstitution.proof.ok, false);

  const unrelatedFighterSubstitution = runHistoryProbe({
    observerFrames: [{
      time: 32,
      fighters: [{ id: 99, side: "zombie", kind: "walker", flash: 0.2, knock: 0 }],
      pendingWeaponHits: [edge],
      damageTexts: [],
    }],
    waitSnapshot: { time: 32.04, fighters: [], attackIdentity: [], pendingWeaponHits: [], battlePresentationEffects: [], damageTexts: [] },
    proofSamples: [impactWithoutReaction],
  });
  assert.equal(unrelatedFighterSubstitution.proof.stages.source, true);
  assert.equal(unrelatedFighterSubstitution.proof.stages.travelOrContact, true);
  assert.equal(unrelatedFighterSubstitution.proof.stages.targetReaction, false);
  assert.equal(unrelatedFighterSubstitution.proof.stages.audio, true);
  assert.equal(unrelatedFighterSubstitution.proof.reactionHistory.length, 1);
  assert.equal(unrelatedFighterSubstitution.proof.reactionHistory[0].targetId, 99);
  assert.deepEqual(unrelatedFighterSubstitution.proof.targetReactionHistory, []);
  assert.equal(unrelatedFighterSubstitution.proof.ok, false);
});
