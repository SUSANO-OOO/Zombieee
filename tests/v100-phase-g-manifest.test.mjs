import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { V100_COMBAT_FX_AUDIT, V100_COMBAT_FX_INVENTORY } from "../app/v100CombatPresentation.js";

const manifest = JSON.parse(await readFile(new URL("../docs/qa/v100/phase-g-screenshot-manifest.json", import.meta.url), "utf8"));
const coreViewports = new Set(["1280x720", "844x390", "844x340"]);
const extraViewports = new Set(["667x375", "736x414", "932x430"]);
const coreStates = ["title-name", "dialogue-left", "dialogue-right", "map-normal", "map-locked-boss", "formation", "personnel", "support-vehicle-management", "battle-normal", "battle-boss", "result-win", "result-lose", "ending", "credits", "epilogue-postgame", "data-management-modal"];
const combatActors = ["brute", "ranger", "walker", "spitter", "grappler", "red-panther-knife", "red-panther-smg", "red-panther-shield", "red-panther-commander", "takuya", "mugarian-president-mutated", "takuya-omega", "support-healing", "vehicle-barrage", "stage-nishijin-station-gate", "status-mission-target"];
const causalSequence = ["source", "prep", "travel", "contact", "impact", "target-reaction", "aftermath"];

test("Phase G requires the 48 core and 6 additional production screenshot rows", () => {
  assert.equal(manifest.schemaVersion, 2);
  assert.equal(manifest.route, "/Zombieee/v100");
  assert.equal(manifest.totalScreenshots, 54);
  assert.equal(manifest.runtimeContractVersion, 1);
  assert.equal(manifest.entries.length, 54);
  assert.deepEqual(new Set(manifest.requiredEngines), new Set(["chromium", "webkit"]));
  assert.deepEqual(new Set(manifest.requiredCoreViewports), coreViewports);
  assert.deepEqual(new Set(manifest.additionalBattleViewports), extraViewports);
  assert.deepEqual(manifest.requiredCoreStates, coreStates);
  assert.equal(manifest.entries.filter(({ category }) => category === "core").length, 48);
  assert.equal(manifest.entries.filter(({ category }) => category === "battle-extra").length, 6);
  assert.equal(new Set(manifest.entries.map(({ id }) => id)).size, 54);
  assert.equal(new Set(manifest.entries.map(({ evidence }) => evidence)).size, 54);
  for (const state of coreStates) {
    const rows = manifest.entries.filter((entry) => entry.category === "core" && entry.state === state);
    assert.equal(rows.length, 3, `${state} row count`);
    assert.deepEqual(new Set(rows.map(({ viewport }) => viewport)), coreViewports, `${state} viewport set`);
    assert.ok(rows.every(({ engine }) => engine === "chromium"), `${state} engine`);
  }
  const extras = manifest.entries.filter(({ category }) => category === "battle-extra");
  assert.deepEqual(new Set(extras.map(({ viewport }) => viewport)), extraViewports);
  assert.deepEqual(new Set(extras.map(({ engine }) => engine)), new Set(["chromium", "webkit"]));
  assert.ok(manifest.entries.every(({ evidence }) => evidence.startsWith("outputs/v100-phase-g/")));
});

test("Phase G maps all 16 real-combat evidence rows to the audited production inventory", () => {
  assert.equal(manifest.combatEvidenceCount, 16);
  assert.equal(manifest.combatEvidence.length, 16);
  assert.deepEqual(new Set(manifest.combatEvidence.map(({ actor }) => actor)), new Set(combatActors));
  const inventoryActors = new Set(V100_COMBAT_FX_INVENTORY.map(({ actor }) => actor));
  const battleEvidencePaths = new Set(manifest.entries.filter(({ category }) => category === "battle-extra").map(({ evidence }) => evidence));
  for (const evidence of manifest.combatEvidence) {
    assert.ok(inventoryActors.has(evidence.actor), `${evidence.id} actor`);
    assert.ok(battleEvidencePaths.has(evidence.evidence), `${evidence.id} screenshot`);
    for (const field of ["action", "source", "contactImpact", "reaction", "state"]) assert.equal(typeof evidence[field], "string", `${evidence.id} ${field}`);
    assert.ok(Array.isArray(evidence.seVfx) && evidence.seVfx.length > 0, `${evidence.id} SE/VFX`);
    assert.deepEqual(evidence.runtimeSequence, causalSequence, `${evidence.id} causal sequence`);
  }
  assert.equal(V100_COMBAT_FX_AUDIT.ok, true, V100_COMBAT_FX_AUDIT.errors.join(", "));
  assert.equal(V100_COMBAT_FX_AUDIT.unclassifiedCount, 0);
  assert.equal(V100_COMBAT_FX_AUDIT.unfinishedRefineCount, 0);
  assert.equal(V100_COMBAT_FX_AUDIT.replaceIncompleteCount, 0);
  assert.equal(V100_COMBAT_FX_INVENTORY.filter(({ productionVisible }) => productionVisible === false).length, 1);
  assert.equal(V100_COMBAT_FX_INVENTORY.filter(({ productionVisible, primitive }) => productionVisible !== false && primitive === "debug-marker").length, 0);
});
