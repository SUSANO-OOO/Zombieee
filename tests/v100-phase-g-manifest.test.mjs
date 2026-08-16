import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { V100_COMBAT_FX_AUDIT, V100_COMBAT_FX_INVENTORY } from "../app/v100CombatPresentation.js";

const manifest = JSON.parse(await readFile(new URL("../docs/qa/v100/phase-g-screenshot-manifest.json", import.meta.url), "utf8"));
const requiredViewports = new Set(["667x375", "736x414", "844x340", "844x390", "932x430", "1280x720"]);
const requiredSequence = ["source", "prep", "travel", "contact", "impact", "target-reaction", "aftermath"];

test("Phase G keeps the 54-entry cross-engine screenshot manifest intact", () => {
  assert.equal(manifest.route, "/Zombieee/v100");
  assert.equal(manifest.totalScreenshots, 54);
  assert.equal(manifest.entries.length, 54);
  assert.equal(manifest.entries.filter(({ category }) => category === "combat-fx").length, 16);
  assert.deepEqual(new Set(manifest.requiredEngines), new Set(["chromium", "webkit"]));
  assert.deepEqual(new Set(manifest.requiredViewports), requiredViewports);
  assert.equal(new Set(manifest.entries.map(({ id }) => id)).size, manifest.entries.length);
  for (const entry of manifest.entries) {
    assert.ok(entry.evidence, `${entry.id} evidence path`);
    assert.ok(requiredViewports.has(entry.viewport), `${entry.id} viewport`);
    if (entry.category === "combat-fx") {
      assert.ok(entry.actor, `${entry.id} actor`);
      assert.ok(entry.runtimeSequence.length >= 6, `${entry.id} bounded runtime sequence`);
      assert.deepEqual(entry.runtimeSequence, entry.runtimeSequence.filter((value, index) => entry.runtimeSequence.indexOf(value) === index));
    }
  }
});

test("Phase G FX entries map to audited production actors and identity locks", () => {
  assert.equal(V100_COMBAT_FX_AUDIT.ok, true);
  const actors = new Set(V100_COMBAT_FX_INVENTORY.map(({ actor }) => actor));
  for (const entry of manifest.entries.filter(({ category }) => category === "combat-fx")) {
    assert.ok(actors.has(entry.actor), `${entry.id} is not in the combat inventory`);
    assert.deepEqual(entry.runtimeSequence, entry.runtimeSequence.filter((value) => requiredSequence.includes(value)));
  }
  const presidentEntries = manifest.entries.filter(({ actor }) => actor === "mugarian-president-mutated");
  const omegaEntries = manifest.entries.filter(({ actor }) => actor === "takuya-omega");
  assert.equal(presidentEntries.length, 4);
  assert.equal(omegaEntries.length, 4);
  assert.ok(presidentEntries.every(({ identity }) => identity === "4 rooted arms / 4 hands"));
  assert.ok(omegaEntries.every(({ identity }) => identity === "2 rooted arms / 2 hands / giant weapon"));
});
