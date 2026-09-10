import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  V100_REPRESENTATIVE_COMBAT_CONTRACT,
  validateV100RepresentativeCombatEvidence,
} from "../app/v100PhaseGContract.js";

const fixture = JSON.parse(await readFile(new URL("./fixtures/v100-phase-g-mislabel.json", import.meta.url), "utf8"));
const runtimeFixture = JSON.parse(await readFile(new URL("./fixtures/v100-phase-g-missing-runtime-proof.json", import.meta.url), "utf8"));

test("Phase G rejects a combat evidence row mislabeled with another actor", () => {
  const contract = V100_REPRESENTATIVE_COMBAT_CONTRACT.find(({ id }) => id === fixture.contractId);
  const result = validateV100RepresentativeCombatEvidence({
    contract,
    evidence: fixture.evidence,
    runtimeEvidence: fixture.runtimeEvidence,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("actor mismatch"));
});

test("Phase G rejects a canonical row when the linked production runtime observed another actor", () => {
  const contract = V100_REPRESENTATIVE_COMBAT_CONTRACT.find(({ id }) => id === runtimeFixture.contractId);
  const result = validateV100RepresentativeCombatEvidence({
    contract,
    evidence: runtimeFixture.evidence,
    runtimeEvidence: runtimeFixture.runtimeEvidence,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("runtime actor not observed: zombie:red-panther-knife"));
});
