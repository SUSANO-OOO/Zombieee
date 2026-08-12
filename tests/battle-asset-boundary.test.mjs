import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ashfallSource = await readFile(new URL("../app/AshfallGame.tsx", import.meta.url), "utf8");

test("battle readiness uses one closed blocking plan without degraded-ready", () => {
  assert.match(ashfallSource, /const requiredPlan = requiredBattleAssetPlan\(/u);
  assert.match(ashfallSource, /\.\.\.requiredPlan\.sprites\.map/u);
  assert.match(ashfallSource, /\.\.\.stageObjectAssets\.map/u);
  assert.match(ashfallSource, /requiredPlan\.persistent\.find/u);
  assert.doesNotMatch(ashfallSource, /const optionalJobs\s*=/u);
  assert.doesNotMatch(ashfallSource, /state:\s*["']degraded-ready["']/u);
  assert.match(ashfallSource, /requireDecode:\s*true/u);
});

test("production renderers do not synthesize semantic asset placeholders", () => {
  assert.match(
    ashfallSource,
    /drawWorld\([\s\S]*?false,\s*Boolean\(qaMode \|\| qaScenario\),\s*\);/u,
  );
  assert.match(ashfallSource, /else if \(allowDiagnosticFallback\) \{\s*ctx\.fillStyle = container\.contained/u);
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
