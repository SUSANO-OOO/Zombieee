import assert from "node:assert/strict";

// Support readiness is a boundary, not a permanent prohibition after spending it.
export function assertRecoveryDeferredThroughInput({ initial, rows, acceptedState }) {
  assert.ok(Number.isFinite(initial?.time) && Number.isFinite(acceptedState?.time));
  assert.ok(acceptedState.time >= initial.time);
  const beforeInput = rows.filter(row => row.time >= initial.time && row.time <= acceptedState.time);
  assert.ok(beforeInput.some(row => row.time < acceptedState.time), "Missing observation before the accepted input");
  for (const row of [initial, ...beforeInput, acceptedState]) {
    assert.equal(row.commandRecovery?.used, false, "Recovery used before support was spent");
    assert.equal(row.commandRecovery.active, false, "Recovery active while support was available");
    assert.equal(row.commandRecovery.additionalCommand, 0, "Extra command before support was spent");
  }
  return { throughTime: acceptedState.time, samples: beforeInput.length + 2 };
}
