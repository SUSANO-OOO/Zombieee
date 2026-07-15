import assert from "node:assert/strict";
import test from "node:test";

import { allyCorpseVisualCue } from "../app/corpseVisuals.js";

const forbiddenRenderKeys = /remaining|countdown|progress|seconds|label|text/i;

test("ally infection cues are diegetic and expose no timer UI contract", () => {
  const neutral = allyCorpseVisualCue({ id: 1, state: "ally-corpse", warningLevel: "none" }, 1);
  const light = allyCorpseVisualCue({ id: 2, state: "infection-warning", warningLevel: "light" }, 1.25);
  const strong = allyCorpseVisualCue({ id: 2, state: "infection-warning", warningLevel: "strong" }, 1.25);

  for (const cue of [neutral, light, strong]) {
    assert.equal(Object.keys(cue).some((key) => forbiddenRenderKeys.test(key)), false);
  }
  assert.equal(neutral.skinTint, "none");
  assert.equal(neutral.smokePuffs, 0);
  assert.equal(light.skinTint, "light");
  assert.equal(light.smokePuffs, 1);
  assert.equal(strong.skinTint, "strong");
  assert.equal(strong.smokePuffs, 2);
  assert.ok(Math.abs(strong.tremorX) > Math.abs(light.tremorX));
});

test("cremation cues use flames, smoke, and ash posture without a duration display", () => {
  const burning = allyCorpseVisualCue({ id: 4, state: "burning" }, 2);
  const ash = allyCorpseVisualCue({ id: 4, state: "ash" }, 3);

  assert.equal(burning.skinTint, "charred");
  assert.equal(burning.flameTongues, 4);
  assert.equal(burning.smokePuffs, 3);
  assert.equal(ash.skinTint, "ash");
  assert.equal(ash.bodyScaleY, 0.42);
  assert.equal(Object.keys(burning).some((key) => forbiddenRenderKeys.test(key)), false);
  assert.equal(Object.keys(ash).some((key) => forbiddenRenderKeys.test(key)), false);
});
