import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { bossDefinitionForEnemyKind } from "../app/bossFoundation.js";
import { TAKUYA_SLAM_PRESENTATION, takuyaSlamPresentationPose } from "../app/v100TakuyaPresentation.js";
import { mugarianPresidentCompactScale } from "../app/v100BossPresentation.js";

test("TAKUYA keeps attack-a stable through the full .85 second warning", () => {
  const warningSeconds = bossDefinitionForEnemyKind("takuya").attackTelegraph.warningSeconds;
  assert.equal(warningSeconds, .85);
  for (const remaining of [warningSeconds, .4, .001]) {
    assert.deepEqual(
      takuyaSlamPresentationPose({ kind: "takuya", abilityWindup: remaining, hp: 100 }),
      { spriteState: "attack-a", clip: "wind-up", elapsed: 0 },
    );
  }
});

test("TAKUYA committed slam shows attack-b for .14 then walk-a for .10", () => {
  assert.equal(TAKUYA_SLAM_PRESENTATION.impactSeconds, .24);
  assert.equal(takuyaSlamPresentationPose({ kind: "takuya", remaining: .24, hp: 100 }).spriteState, "attack-b");
  assert.equal(takuyaSlamPresentationPose({ kind: "takuya", remaining: .11, hp: 100 }).spriteState, "attack-b");
  assert.equal(takuyaSlamPresentationPose({ kind: "takuya", remaining: .10, hp: 100 }).spriteState, "walk-a");
  assert.equal(takuyaSlamPresentationPose({ kind: "takuya", remaining: .001, hp: 100 }).spriteState, "walk-a");
  assert.equal(takuyaSlamPresentationPose({ kind: "takuya", remaining: 0, hp: 100 }), null);
});

test("slam pose stays readable over flash, expires, and stays V1-only", async () => {
  assert.equal(takuyaSlamPresentationPose({ kind: "takuya", remaining: .12, hp: 100, flash: .32 }).spriteState, "attack-b");
  assert.equal(takuyaSlamPresentationPose({ kind: "takuya", remaining: .12, hp: 0 }), null);
  assert.equal(takuyaSlamPresentationPose({ kind: "takuya-omega", remaining: .12, hp: 100 }), null);
  const source = await readFile(new URL("../app/AshfallGame.tsx", import.meta.url), "utf8");
  assert.match(source, /if \(g\.definition\.missionConfig\.v100StageNumber\) \{[\s\S]*?f\.takuyaSlamPresentationRemaining = TAKUYA_SLAM_PRESENTATION\.impactSeconds;[\s\S]*?queueV100TakuyaGroundContact\(g, \{ owner: f \}\);[\s\S]*?\}/u);
  assert.match(source, /takuyaSlamPresentationRemaining: fighter\.takuyaSlamPresentationRemaining/u);
  const impact = source.slice(source.indexOf("if (f.kind === \"takuya\")"), source.indexOf("if (f.kind === \"engineer\")"));
  assert.ok(impact.indexOf("damage = enraged ? 28 : 22") < impact.indexOf("f.takuyaSlamPresentationRemaining = TAKUYA_SLAM_PRESENTATION.impactSeconds"));
  assert.ok(impact.includes("radius = enraged ? 145 : 118"));
  assert.ok(impact.includes("v100StageNumber"));
  assert.ok(source.indexOf(": takuyaSlamPose") < source.indexOf(": f.flash > 0"));
  assert.match(source, /pose: TAKUYA_STABLE_POSE/u);
  assert.doesNotMatch(source, /manualAbility.*takuyaSlamPresentation/u);
});

test("president keeps standard scale and follows Omega short-viewport scale", () => {
  assert.equal(mugarianPresidentCompactScale({ compact: false, shortViewport: false }), 1);
  assert.equal(mugarianPresidentCompactScale({ compact: true, shortViewport: false }), .6);
  assert.equal(mugarianPresidentCompactScale({ compact: true, shortViewport: true }), .52);
});

