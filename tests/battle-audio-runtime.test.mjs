import test from "node:test";
import assert from "node:assert/strict";

import {
  BATTLE_AUDIO_RUNTIME_LIMITS,
  battleAudioRuntimeSnapshot,
  battleSemanticReceiptKey,
  createBattleAudioRuntime,
  resetBattleAudioRuntime,
  scheduleDelayedBattleAudioCue,
  stopBattleAudioRuntime,
  takeDueBattleAudioCues,
  tryConsumeSemanticReceipt,
} from "../app/battleAudioRuntime.js";

test("semantic receipt keys are generation-scoped and consumed before request", () => {
  const runtime = createBattleAudioRuntime();
  assert.equal(battleSemanticReceiptKey({ battleGeneration: 0, semantic: "ability-root", receiptId: "r1" }), "battle:0:ability-root:r1");
  assert.equal(tryConsumeSemanticReceipt(runtime, { semantic: "ability-root", receiptId: "r1" }), true);
  assert.equal(tryConsumeSemanticReceipt(runtime, { semantic: "ability-root", receiptId: "r1" }), false);
  assert.equal(runtime.playedSemanticReceipts.size, 1);
});

test("voice completion and retry do not reopen a consumed semantic receipt", () => {
  const runtime = createBattleAudioRuntime();
  assert.equal(tryConsumeSemanticReceipt(runtime, { semantic: "support-inbound", receiptId: "pod-1" }), true);
  assert.equal(tryConsumeSemanticReceipt(runtime, { semantic: "support-inbound", receiptId: "pod-1" }), false);
  assert.equal(tryConsumeSemanticReceipt(runtime, { semantic: "support-inbound", receiptId: "pod-1" }), false);
});

test("generation reset clears ledger and delayed cues without touching save data", () => {
  const runtime = createBattleAudioRuntime();
  scheduleDelayedBattleAudioCue(runtime, {
    ownerId: "fighter-1", activationId: 3, semantic: "ability-impact", receiptId: "r1", cueId: "cue", dueSimulationTime: 1,
  });
  tryConsumeSemanticReceipt(runtime, { semantic: "ability-root", receiptId: "r0" });
  const generation = resetBattleAudioRuntime(runtime, "retry");
  assert.equal(generation, 1);
  assert.deepEqual(battleAudioRuntimeSnapshot(runtime).delayedCues, []);
  assert.equal(runtime.playedSemanticReceipts.size, 0);
  assert.equal(tryConsumeSemanticReceipt(runtime, { semantic: "ability-root", receiptId: "r0" }), true);
});

test("delayed cue requires owner, activation, generation, and simulation time preflight", () => {
  const runtime = createBattleAudioRuntime();
  assert.equal(scheduleDelayedBattleAudioCue(runtime, {
    ownerId: "fighter-1", activationId: 4, semantic: "ability-impact", receiptId: "r1", cueId: "cue", dueSimulationTime: 1,
  }), true);
  assert.deepEqual(takeDueBattleAudioCues(runtime, {
    simulationTime: 1,
    resolveOwner: () => ({ alive: true, retreat: false, activationId: 4, phase: "active" }),
  }).map((entry) => entry.cueId), ["cue"]);
  assert.equal(takeDueBattleAudioCues(runtime, { simulationTime: 2 }).length, 0);
  assert.equal(scheduleDelayedBattleAudioCue(runtime, {
    ownerId: "fighter-2", activationId: 5, semantic: "ability-impact", receiptId: "r2", cueId: "cue", dueSimulationTime: 3,
  }), true);
  assert.equal(takeDueBattleAudioCues(runtime, {
    simulationTime: 3,
    resolveOwner: () => ({ alive: true, retreat: true, activationId: 5, phase: "active" }),
  }).length, 0);
});

test("pause, hidden, result, and disposal stop delayed requests", () => {
  const runtime = createBattleAudioRuntime();
  scheduleDelayedBattleAudioCue(runtime, {
    ownerId: "fighter-1", activationId: 0, semantic: "defeat", receiptId: "r1", cueId: "cue", dueSimulationTime: 1,
  });
  assert.deepEqual(takeDueBattleAudioCues(runtime, { simulationTime: 1, isBattleActive: false }), []);
  stopBattleAudioRuntime(runtime, "pagehide");
  assert.deepEqual(takeDueBattleAudioCues(runtime, { simulationTime: 1 }), []);
  assert.equal(runtime.diagnostics.some(({ code }) => code === "battle-audio-stopped"), true);
});

test("semantic ledger fails closed at 4096 without eviction and bounds diagnostics", () => {
  const runtime = createBattleAudioRuntime();
  for (let index = 0; index < BATTLE_AUDIO_RUNTIME_LIMITS.MAX_SEMANTIC_RECEIPTS; index += 1) {
    assert.equal(tryConsumeSemanticReceipt(runtime, { semantic: "support-complete", receiptId: `r-${index}` }), true);
  }
  assert.equal(tryConsumeSemanticReceipt(runtime, { semantic: "support-complete", receiptId: "new" }), false);
  assert.equal(runtime.playedSemanticReceipts.size, BATTLE_AUDIO_RUNTIME_LIMITS.MAX_SEMANTIC_RECEIPTS);
  assert.equal(tryConsumeSemanticReceipt(runtime, { semantic: "support-complete", receiptId: "new-2" }), false);
  assert.equal(runtime.diagnostics.filter(({ code }) => code === "semantic-receipt-ledger-capacity").length, 1);
});
