import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { productionVisualIntegrityInventory } from "../app/visualIntegrityInventory.js";

const enemyHarness = await readFile(new URL("../scripts/v0995-enemy-runtime-browser-smoke.mjs", import.meta.url), "utf8");
const visualHarness = await readFile(new URL("../scripts/v0995-visual-integrity-browser-smoke.mjs", import.meta.url), "utf8");
const gameSource = await readFile(new URL("../app/AshfallGame.tsx", import.meta.url), "utf8");

test("F3 runtime evidence is finite, uses production draw/runtime, and observes every semantic state", () => {
  assert.equal(productionVisualIntegrityInventory().enemies.length, 23);
  assert.match(enemyHarness, /const fullInventory = productionVisualIntegrityInventory/);
  assert.match(enemyHarness, /V0995_ENEMY_QA_KINDS/);
  assert.match(enemyHarness, /requestedKinds\.every\(\(kind\) => fullInventory\.includes\(kind\)\)/);
  for (const state of ["move", "attack", "hit", "die"]) {
    assert.match(enemyHarness, new RegExp(`"${state}"`));
  }
  assert.match(enemyHarness, /prepareEnemyFacingRuntimeProof/);
  assert.match(enemyHarness, /ensureEnemyFacingProofAsset/);
  assert.match(enemyHarness, /actualXDelta/);
  assert.match(enemyHarness, /targetX/);
  assert.match(enemyHarness, /sourceRow/);
  assert.match(enemyHarness, /renderWidth/);
  assert.match(enemyHarness, /groundAnchor/);
  assert.match(enemyHarness, /runtime\.some\(\(\{ renderHistory, corpseRenderHistory \}\)/);
  assert.doesNotMatch(enemyHarness, /runtime\.every\(\(\{ renderHistory, corpseRenderHistory \}\)/);
  assert.match(enemyHarness, /for \(const kind of inventory\) \{[\s\S]*?const context = await browser\.newContext\(\{ viewport \}\)/);
  assert.match(enemyHarness, /finally \{[\s\S]*?await context\.close\(\)/);
  assert.match(gameSource, /const enemy = spawnEnemy\(g, kind, lane\)/);
  assert.match(gameSource, /loadImageWithTimeout\(\{[\s\S]*?src: path,[\s\S]*?requireDecode: true/);
  assert.match(gameSource, /includeAllSprites: Boolean\(qaMode \|\| qaScenario\) && !finiteEnemyRuntimeQa/);
  assert.match(gameSource, /g\.pendingWeaponHits\.push/);
  assert.doesNotMatch(enemyHarness, /result direct|delete.*enemy|drawImage\(/i);
});

test("F4 fault evidence gates the actual mount and verifies mutable final pixels", () => {
  assert.match(visualHarness, /getBattleMountState/);
  assert.match(visualHarness, /startAssetFaultProof/);
  assert.match(visualHarness, /canPlay === false && blocked\.mount\.battleMounted === false/);
  assert.match(visualHarness, /fallbackDrawCount === 0/);
  assert.match(visualHarness, /setStationMissionPixelAuditState/);
  assert.match(visualHarness, /mutable mission states collapsed to the same authored pixels/);
  assert.match(visualHarness, /retrySession\.total === intendedFailurePaths\.size/);
  assert.match(visualHarness, /retrySession\.status === "ready"/);
  assert.doesNotMatch(visualHarness, /campaign-primary/);
  assert.match(gameSource, /screen !== "battle" \|\| !assetsReady \|\| assetError/);
});
