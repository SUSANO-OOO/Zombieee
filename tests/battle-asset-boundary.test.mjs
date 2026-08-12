import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ashfallSource = await readFile(new URL("../app/AshfallGame.tsx", import.meta.url), "utf8");

test("finite HUD evidence cannot change the production-host asset plan", () => {
  assert.match(ashfallSource, /finiteHudRuntimeQa = localQaParameters\.get\("qaHudFiniteAssets"\) === "1"/);
  assert.match(ashfallSource, /\["localhost", "127\.0\.0\.1"\]\.includes\(window\.location\.hostname\)/);
  assert.match(ashfallSource, /Boolean\(qaMode \|\| qaScenario\)/);
  assert.match(ashfallSource, /includeAllSprites: Boolean\(qaMode \|\| qaScenario\) && !finiteEnemyRuntimeQa && !finiteHudRuntimeQa/);
});

test("battle readiness uses one closed blocking plan without degraded-ready", () => {
  assert.match(ashfallSource, /const requiredPlan = requiredBattleAssetPlan\(/u);
  assert.match(ashfallSource, /\.\.\.requiredPlan\.sprites\.map/u);
  assert.match(ashfallSource, /\.\.\.stageObjectAssets\.map/u);
  assert.match(ashfallSource, /requiredPlan\.persistent\.find/u);
  assert.doesNotMatch(ashfallSource, /const optionalJobs\s*=/u);
  assert.doesNotMatch(ashfallSource, /state:\s*["']degraded-ready["']/u);
  assert.match(ashfallSource, /requireDecode:\s*targetedFault/u);
});

test("local fault deadlines apply only to the selected required asset", () => {
  assert.match(ashfallSource, /const targetedFault = faultPath === src/);
  assert.match(ashfallSource, /targetedFault && Number\.isFinite\(requested\)/);
  assert.match(ashfallSource, /\.\.\.\(targetedFault\s*\? \{ faultMode \}/);
});

test("final station pixels require the authored silhouette and reject unpainted or primitive-only output", () => {
  assert.match(ashfallSource, /authoredPixelCount > 500 && finalPaintRatio >= \.99 && finalNearMatchRatio >= \.72/);
  const passes = ({ authoredPixelCount, finalPaintRatio, finalNearMatchRatio }) => (
    authoredPixelCount > 500 && finalPaintRatio >= .99 && finalNearMatchRatio >= .72
  );
  assert.equal(passes({ authoredPixelCount: 9613, finalPaintRatio: 1, finalNearMatchRatio: .758 }), true);
  assert.equal(passes({ authoredPixelCount: 9613, finalPaintRatio: .98, finalNearMatchRatio: 1 }), false);
  assert.equal(passes({ authoredPixelCount: 9613, finalPaintRatio: 1, finalNearMatchRatio: .15 }), false);
  assert.equal(passes({ authoredPixelCount: 499, finalPaintRatio: 1, finalNearMatchRatio: 1 }), false);
});

test("production renderers do not synthesize semantic asset placeholders", () => {
  assert.match(
    ashfallSource,
    /drawWorld\([\s\S]*?false,\s*Boolean\(qaMode \|\| qaScenario\),\s*\);/u,
  );
  assert.match(ashfallSource, /else if \(allowDiagnosticFallback\) \{\s*stationMissionDiagnosticFallbackDrawCount \+= 1;\s*ctx\.fillStyle = container\.contained/u);
  assert.match(ashfallSource, /else if \(allowDiagnosticFallback\) \{\s*ctx\.fillStyle = "#5d3329"/u);
  assert.match(ashfallSource, /else if \(allowDiagnosticFallback\) drawDiagnosticStationBackground/u);
  assert.match(ashfallSource, /allowDiagnosticFallback && object\.kind === "drum"/u);
  const missingSpriteBranch = ashfallSource.slice(
    ashfallSource.indexOf("if (!sprite?.complete || !sprite.naturalWidth)"),
    ashfallSource.indexOf("const moving =", ashfallSource.indexOf("if (!sprite?.complete || !sprite.naturalWidth)")),
  );
  assert.match(missingSpriteBranch, /if \(allowDiagnosticFallback\)/u);
  assert.match(missingSpriteBranch, /drawDiagnosticRoleFighter/u);
  assert.match(missingSpriteBranch, /drawDiagnosticStationEnemy/u);
});
