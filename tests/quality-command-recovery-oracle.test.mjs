import test from "node:test";
import assert from "node:assert/strict";
import { assertRecoveryDeferredThroughInput } from "../scripts/quality-command-recovery-oracle.mjs";

const row = (time, patch = {}) => ({ time, commandRecovery: { used: false, active: false, additionalCommand: 0, ...patch } });
test("support oracle permits recovery after the accepted input but rejects premature benefit", () => {
  const input = { initial: row(0), rows: [row(.1), row(3, { used: true, active: true, additionalCommand: 4 })], acceptedState: row(.2) };
  assert.doesNotThrow(() => assertRecoveryDeferredThroughInput(input));
  for (const patch of [{ used: true }, { active: true }, { additionalCommand: .01 }]) {
    assert.throws(() => assertRecoveryDeferredThroughInput({ ...input, rows: [row(.1, patch)] }));
    assert.throws(() => assertRecoveryDeferredThroughInput({ ...input, acceptedState: row(.2, patch) }));
  }
  assert.throws(() => assertRecoveryDeferredThroughInput({ ...input, rows: [row(3)] }));
  assert.throws(() => assertRecoveryDeferredThroughInput({ ...input, rows: [input.acceptedState] }));
  assert.throws(() => assertRecoveryDeferredThroughInput({ ...input, acceptedState: null }));
});
