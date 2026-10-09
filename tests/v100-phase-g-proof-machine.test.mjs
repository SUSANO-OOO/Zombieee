import assert from "node:assert/strict";
import test from "node:test";

import { createV100PhaseGProofMachine } from "../scripts/v100-phase-g-proof-machine.mjs";

const machine = createV100PhaseGProofMachine();
const receipt = (overrides = {}) => ({
  schema: machine.receiptSchema,
  battleGeneration: 7,
  sourceId: 11,
  sourceSide: "zombie",
  sourceKind: "spitter",
  attackSequence: 3,
  targetId: 22,
  targetSide: "human",
  targetKind: "ranger",
  impactOrdinal: 0,
  mode: "projectile",
  committedAtBattleTime: 5.1,
  contactAtBattleTime: 5.5,
  reactionOutcome: "hit",
  audioCueId: "spitter-attack",
  audioReceiptId: "combat-attack:7:11:3",
  audioRequestObserved: true,
  ...overrides,
});
const snapshot = (receipts = []) => ({
  schema: "v100-phase-g-combat-snapshot/v1",
  screen: "battle",
  completedAttackImpacts: receipts,
});
const createProof = (requiredActorKeys = ["zombie:spitter"]) => machine.createProof({
  battleGeneration: 7,
  requiredActorKeys,
  startedAtPageTime: 100,
  startedAtBattleTime: 5,
  deadlineAtPageTime: 4_900,
});

test("accepts one immutable completed-impact receipt without lease or target reservation", () => {
  const accepted = machine.observe(createProof(), {
    snapshot: snapshot([receipt()]),
    pageNow: 240,
  });
  assert.equal(accepted.state, "ATTACK_ACCEPTED");
  assert.ok(Object.isFrozen(accepted));
  assert.deepEqual(accepted.receiptsByActor["zombie:spitter"], receipt());
  assert.equal(machine.impactKeyFor(receipt()), "7:11:3:22:0");
});

test("direct, projectile, delayed, lethal, and multi-hit receipts use the same minimal schema", () => {
  for (const mode of ["direct", "projectile", "delayed"]) {
    assert.equal(machine.receiptValidation(receipt({ mode })).ok, true);
  }
  assert.equal(machine.receiptValidation(receipt({ reactionOutcome: "defeated" })).ok, true);
  assert.notEqual(
    machine.impactKeyFor(receipt({ impactOrdinal: 0 })),
    machine.impactKeyFor(receipt({ impactOrdinal: 1 })),
  );
});

test("a canceled or pre-contact-invalid attack emits no receipt and does not fail before the deadline", () => {
  const observing = machine.observe(createProof(), { snapshot: snapshot([]), pageNow: 1_000 });
  assert.equal(observing.state, "OBSERVING");
  assert.equal(observing.failure, null);
});

test("missing completed impact fails closed only at the unchanged deadline", () => {
  const failed = machine.observe(createProof(), { snapshot: snapshot([]), pageNow: 4_900 });
  assert.equal(failed.state, "FAILED");
  assert.equal(failed.failure.code, "PROOF_DEADLINE_EXCEEDED");
  assert.deepEqual(failed.failure.detail.missingActorKeys, ["zombie:spitter"]);
});

test("source, target, attack, reaction, and exact audio request cannot be mixed", () => {
  for (const invalid of [
    receipt({ sourceId: 0 }),
    receipt({ targetSide: "zombie" }),
    receipt({ attackSequence: 0 }),
    receipt({ audioReceiptId: "combat-attack:7:99:3" }),
    receipt({ reactionOutcome: null }),
    receipt({ audioRequestObserved: false }),
  ]) {
    const failed = machine.observe(createProof(), { snapshot: snapshot([invalid]), pageNow: 500 });
    assert.equal(failed.state, "FAILED");
    assert.equal(failed.failure.code, "COMPLETED_IMPACT_RECEIPT_INVALID");
  }
});

test("two required actors must each own a complete receipt", () => {
  const proof = createProof(["zombie:spitter", "human:ranger"]);
  const one = machine.observe(proof, { snapshot: snapshot([receipt()]), pageNow: 300 });
  assert.equal(one.state, "OBSERVING");
  const two = machine.observe(one, {
    snapshot: snapshot([
      receipt(),
      receipt({
        sourceId: 22,
        sourceSide: "human",
        sourceKind: "ranger",
        attackSequence: 4,
        targetId: 11,
        targetSide: "zombie",
        targetKind: "spitter",
        audioCueId: "ranger-rifle-shot",
        audioReceiptId: "combat-attack:7:22:4",
      }),
    ]),
    pageNow: 450,
  });
  assert.equal(two.state, "ATTACK_ACCEPTED");
  assert.deepEqual(Object.keys(two.receiptsByActor).sort(), ["human:ranger", "zombie:spitter"]);
});

test("stale battle generations are ignored instead of contaminating current proof", () => {
  const proof = machine.observe(createProof(), {
    snapshot: snapshot([receipt({ battleGeneration: 6 })]),
    pageNow: 600,
  });
  assert.equal(proof.state, "OBSERVING");
  assert.deepEqual(proof.receiptsByActor, {});
});

test("completed impacts committed before observation are not reused", () => {
  const proof = machine.observe(createProof(), {
    snapshot: snapshot([receipt({ committedAtBattleTime: 4.9, contactAtBattleTime: 5.2 })]),
    pageNow: 600,
  });
  assert.equal(proof.state, "OBSERVING");
  assert.deepEqual(proof.receiptsByActor, {});
});

test("conflicting payload for one impact identity fails closed", () => {
  const observing = machine.observe(createProof(["human:ranger"]), {
    snapshot: snapshot([receipt()]),
    pageNow: 200,
  });
  const failed = machine.observe(observing, {
    snapshot: snapshot([receipt({ reactionOutcome: "defeated" })]),
    pageNow: 300,
  });
  assert.equal(failed.state, "FAILED");
  assert.equal(failed.failure.code, "CONFLICTING_IMPACT_IDENTITY");
});

test("production screenshot binds only after accepted proof and before the deadline", () => {
  const accepted = machine.observe(createProof(), { snapshot: snapshot([receipt()]), pageNow: 240 });
  const bound = machine.attachScreenshot(accepted, {
    screenshot: { path: "stage06.png", sha256: "a".repeat(64), bytes: 2048 },
    pageNow: 700,
  });
  assert.equal(bound.state, "SCREENSHOT_BOUND");
  assert.deepEqual(bound.screenshot.acceptedImpactKeys, { "zombie:spitter": "7:11:3:22:0" });
  const premature = machine.attachScreenshot(createProof(), {
    screenshot: { sha256: "b".repeat(64), bytes: 2048 },
    pageNow: 300,
  });
  assert.equal(premature.state, "FAILED");
});

test("cleanup receipt is mandatory and completes the four-state flow", () => {
  const accepted = machine.observe(createProof(), { snapshot: snapshot([receipt()]), pageNow: 240 });
  const bound = machine.attachScreenshot(accepted, {
    screenshot: { sha256: "a".repeat(64), bytes: 2048 },
    pageNow: 700,
  });
  const complete = machine.complete(bound, { pageNow: 720, observerStopped: true });
  assert.equal(complete.state, "COMPLETE");
  assert.equal(complete.cleanupReceipt.observerStopped, true);
});

test("the first red is terminal and later evidence cannot rewrite it green", () => {
  const failed = machine.observe(createProof(), { snapshot: snapshot([]), pageNow: 4_900 });
  const unchanged = machine.observe(failed, { snapshot: snapshot([receipt()]), pageNow: 4_901 });
  assert.equal(unchanged, failed);
  assert.equal(unchanged.state, "FAILED");
});
