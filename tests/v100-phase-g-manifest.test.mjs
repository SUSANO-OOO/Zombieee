import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { V100_COMBAT_FX_AUDIT, V100_COMBAT_FX_INVENTORY } from "../app/v100CombatPresentation.js";
import { deriveV100ProductionEnemyCoverage, V100_REPRESENTATIVE_COMBAT_CONTRACT } from "../app/v100PhaseGContract.js";
import { validateProductionEnemyRuntimeShards } from "../scripts/v0995-enemy-runtime-shards.mjs";

const manifest = JSON.parse(await readFile(new URL("../docs/qa/v100/phase-g-screenshot-manifest.json", import.meta.url), "utf8"));
const coreViewports = new Set(["1280x720", "844x390", "844x340"]);
const extraViewports = new Set(["667x375", "736x414", "932x430"]);
const coreStates = ["title-name", "dialogue-left", "dialogue-right", "map-normal", "map-locked-boss", "formation", "personnel", "support-vehicle-management", "battle-normal", "battle-boss", "result-win", "result-lose", "ending", "credits", "epilogue-postgame", "data-management-modal"];
const combatActors = V100_REPRESENTATIVE_COMBAT_CONTRACT.map(({ actor }) => actor);
const causalSequence = ["source", "prep", "travel", "contact", "impact", "target-reaction", "aftermath"];
const evidencePrefixes = new Set(manifest.entries.map(({ evidence }) => {
  const normalized = String(evidence).replaceAll("\\", "/");
  const separator = normalized.lastIndexOf("/");
  return separator >= 0 ? normalized.slice(0, separator + 1) : "";
}));
const evidencePrefix = evidencePrefixes.size === 1 ? [...evidencePrefixes][0] : "";

test("stored Phase G evidence retains its original schema coverage; current acceptance is validated separately", () => {
  // Preserve the historical report unchanged until a new whole matrix succeeds.
  // The release validator accepts only schema 4 and all 55 current captures.
  assert.ok([3, 4].includes(manifest.schemaVersion));
  const extraCount = manifest.schemaVersion === 4 ? 7 : 6;
  const totalCount = 48 + extraCount;
  assert.equal(manifest.route, "/Zombieee/v100");
  assert.equal(manifest.totalScreenshots, totalCount);
  assert.equal(manifest.runtimeContractVersion, 2);
  assert.equal(manifest.entries.length, totalCount);
  assert.deepEqual(new Set(manifest.requiredEngines), new Set(["chromium", "webkit"]));
  assert.deepEqual(new Set(manifest.requiredCoreViewports), coreViewports);
  assert.deepEqual(new Set(manifest.additionalBattleViewports), extraViewports);
  assert.deepEqual(manifest.requiredCoreStates, coreStates);
  assert.equal(manifest.entries.filter(({ category }) => category === "core").length, 48);
  assert.equal(manifest.entries.filter(({ category }) => category === "battle-extra").length, extraCount);
  assert.equal(new Set(manifest.entries.map(({ id }) => id)).size, totalCount);
  assert.equal(new Set(manifest.entries.map(({ evidence }) => evidence)).size, totalCount);
  for (const state of coreStates) {
    const rows = manifest.entries.filter((entry) => entry.category === "core" && entry.state === state);
    assert.equal(rows.length, 3, `${state} row count`);
    assert.deepEqual(new Set(rows.map(({ viewport }) => viewport)), coreViewports, `${state} viewport set`);
    assert.ok(rows.every(({ engine }) => engine === "chromium"), `${state} engine`);
  }
  const extras = manifest.entries.filter(({ category }) => category === "battle-extra");
  assert.deepEqual(new Set(extras.map(({ viewport }) => viewport)), extraViewports);
  assert.deepEqual(new Set(extras.map(({ engine }) => engine)), new Set(["chromium", "webkit"]));
  assert.ok(evidencePrefix.startsWith("outputs/"));
  assert.ok(manifest.entries.every(({ evidence }) => evidence.startsWith(evidencePrefix)));
  const expectedEnemyCoverage = deriveV100ProductionEnemyCoverage();
  const shardContract = validateProductionEnemyRuntimeShards();
  assert.equal(manifest.enemyRuntimeCoverage.expectedCount, expectedEnemyCoverage.expectedCount);
  assert.deepEqual(manifest.enemyRuntimeCoverage.requiredEnemyKinds, expectedEnemyCoverage.requiredEnemyKinds);
  assert.equal(manifest.enemyRuntimeCoverage.shardCount, 6);
  assert.equal(manifest.enemyRuntimeCoverage.shardContractValid, true);
  assert.equal(shardContract.valid, true);
});

test("Phase G maps all 16 real-combat evidence rows to the audited production inventory", () => {
  assert.equal(manifest.combatEvidenceCount, 16);
  assert.equal(manifest.combatEvidence.length, 16);
  assert.deepEqual(new Set(manifest.combatEvidence.map(({ actor }) => actor)), new Set(combatActors));
  const inventoryActors = new Set(V100_COMBAT_FX_INVENTORY.map(({ actor }) => actor));
  // Representative combat proof may link to either the three core battle
  // states or one of the additional battle-extra captures. Both are
  // production battle mounts; restricting this audit to the extras would
  // reject the canonical ranged-enemy and TAKUYA-Ω core captures.
  const battleStates = new Set(["battle-normal", "battle-boss", "battle-extra"]);
  const battleEvidencePaths = new Set(manifest.entries.filter(({ state }) => battleStates.has(state)).map(({ evidence }) => evidence));
  for (const evidence of manifest.combatEvidence) {
    assert.ok(inventoryActors.has(evidence.actor), `${evidence.id} actor`);
    assert.ok(battleEvidencePaths.has(evidence.evidence), `${evidence.id} screenshot`);
    for (const field of ["action", "source", "contactImpact", "reaction", "state"]) assert.equal(typeof evidence[field], "string", `${evidence.id} ${field}`);
    assert.ok(Array.isArray(evidence.seVfx) && evidence.seVfx.length > 0, `${evidence.id} SE/VFX`);
    assert.deepEqual(evidence.runtimeSequence, causalSequence, `${evidence.id} causal sequence`);
    assert.equal(typeof evidence.captureVariant, "string", `${evidence.id} capture variant`);
    assert.equal(typeof evidence.runtimeEvidence, "string", `${evidence.id} runtime evidence`);
  }
  assert.equal(V100_COMBAT_FX_AUDIT.ok, true, V100_COMBAT_FX_AUDIT.errors.join(", "));
  assert.equal(V100_COMBAT_FX_AUDIT.unclassifiedCount, 0);
  assert.equal(V100_COMBAT_FX_AUDIT.unfinishedRefineCount, 0);
  assert.equal(V100_COMBAT_FX_AUDIT.replaceIncompleteCount, 0);
  assert.equal(V100_COMBAT_FX_INVENTORY.filter(({ productionVisible }) => productionVisible === false).length, 1);
  assert.equal(V100_COMBAT_FX_INVENTORY.filter(({ productionVisible, primitive }) => productionVisible !== false && primitive === "debug-marker").length, 0);
});
