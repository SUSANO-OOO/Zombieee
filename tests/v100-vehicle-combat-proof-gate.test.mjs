import assert from "node:assert/strict";
import test from "node:test";
import { createVehicleCombatProofGate } from "../scripts/v100-vehicle-combat-proof-gate.mjs";

test("observed vehicle action starts one proof before later setup finishes", async () => {
  let captureCount = 0;
  let finish;
  const gate = createVehicleCombatProofGate(() => {
    captureCount += 1;
    return new Promise((resolve) => { finish = resolve; });
  });
  assert.throws(() => gate.result(), /before observed vehicle action/u);
  const first = gate.start();
  assert.strictEqual(gate.start(), first);
  await Promise.resolve();
  assert.equal(captureCount, 1);
  const receipt = { completedImpactProof: { state: "COMPLETE" } };
  finish(receipt);
  assert.strictEqual(await gate.result(), receipt);
  assert.equal(captureCount, 1);
});

test("an early failed proof remains the later failure instead of triggering a retry", async () => {
  const failure = new Error("PROOF_DEADLINE_EXCEEDED");
  let captureCount = 0;
  const gate = createVehicleCombatProofGate(() => { captureCount += 1; throw failure; });
  gate.start();
  await Promise.resolve();
  assert.equal(captureCount, 1);
  await assert.rejects(gate.result(), (error) => error === failure);
  assert.equal(captureCount, 1);
});
