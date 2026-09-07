import assert from "node:assert/strict";
import test from "node:test";
import { access } from "node:fs/promises";
import { V100_STORY_EVENTS } from "../app/v100StoryEvents.js";
import { PRODUCTION_AUDIO_MANIFEST, PRODUCTION_AUDIO_SCENE_IDS } from "../app/productionAudio.js";

import {
  V100_EVENT_PRESENTATION_CATEGORIES,
  v100EventPresentationFor,
} from "../app/v100EventPresentation.js";

test("canonical prologue moves from daily life through crisis, blackout, vehicle and radio scenes", () => {
  const eventId = "v100:event:prologue";
  const nodes = V100_STORY_EVENTS[eventId].nodes;
  const expected = [
    [167, PRODUCTION_AUDIO_SCENE_IDS.STORY_KUMAYA_DAILY],
    [207, PRODUCTION_AUDIO_SCENE_IDS.STORY_KUMAYA_CRISIS],
    [259, PRODUCTION_AUDIO_SCENE_IDS.SILENCE_PROLOGUE_TITLE],
    [261, PRODUCTION_AUDIO_SCENE_IDS.SILENCE_PROLOGUE_TITLE],
    [265, PRODUCTION_AUDIO_SCENE_IDS.STORY_CRAWLER_MONTAGE],
    [289, PRODUCTION_AUDIO_SCENE_IDS.STORY_CRAWLER_SIGNAL],
  ];
  for (const [sourceLine, sceneId] of expected) {
    const node = nodes.find(candidate => candidate.sourceLine === sourceLine);
    assert.ok(node, `canonical scene starts on source line ${sourceLine}`);
    assert.equal(v100EventPresentationFor({ eventId, node }).sceneId, sceneId);
  }
  assert.match(v100EventPresentationFor({ eventId, node: nodes[0] }).backgroundPath, /kumaya-before-outbreak/u);
});

test("every authored credit shot has a real location and ambience without music or character voice", async () => {
  const eventId = "v100:event:credits";
  for (const node of V100_STORY_EVENTS[eventId].nodes) {
    const presentation = v100EventPresentationFor({ eventId, phase: "credits", node });
    assert.equal(presentation.sceneLabel, node.sceneLabel);
    assert.ok(presentation.backgroundPath, `missing background: ${node.sceneLabel}`);
    await access(`public${presentation.backgroundPath}`);
    const scene = PRODUCTION_AUDIO_MANIFEST.sceneById[presentation.sceneId];
    assert.ok(scene, `missing audio scene: ${node.sceneLabel}`);
    assert.equal(scene.bgm ?? null, null);
    assert.ok(scene.ambience.length > 0);
    assert.equal(presentation.cueId, null);
    assert.equal(presentation.portraitOwner, null);
  }
});

test("ending locations follow the source scenes and epilogue returns to the reopened Kumaya", () => {
  const ending = V100_STORY_EVENTS["v100:event:ending"].nodes;
  const backgrounds = [2507, 2529, 2553, 2565].map(sourceLine => v100EventPresentationFor({
    eventId: "v100:event:ending", node: ending.find(node => node.sourceLine === sourceLine),
  }).backgroundPath);
  assert.equal(new Set(backgrounds).size, 4);
  assert.ok(backgrounds.every(background => background && !background.includes("ending-defeat")));
  const node = V100_STORY_EVENTS["v100:event:epilogue"].nodes[0];
  const epilogue = v100EventPresentationFor({ eventId: "v100:event:epilogue", node });
  assert.match(epilogue.backgroundPath, /kumaya-reopened/u);
  assert.equal(epilogue.sceneId, PRODUCTION_AUDIO_SCENE_IDS.STORY_KUMAYA_DAILY);
});

test("V1 event presentation maps canonical story phases to bounded runtime categories", () => {
  const cases = [
    ["v100:event:prologue", "event", "prologue"],
    ["v100:event:s03:pre", "event", "boss-reveal"],
    ["v100:event:s03:post", "post", "battle-post"],
    ["v100:event:ending", "ending", "ending"],
    ["v100:event:credits", "credits", "credits"],
    ["v100:event:epilogue", "epilogue", "epilogue"],
  ];
  for (const [eventId, phase, category] of cases) {
    const presentation = v100EventPresentationFor({ eventId, phase, node: { kind: "dialogue", portraitOwner: "segawa" }, nodeIndex: 0 });
    assert.equal(presentation.category, category);
    assert.ok(V100_EVENT_PRESENTATION_CATEGORIES.includes(presentation.category));
    assert.equal(presentation.audioOwner, "v100-event-runtime");
    assert.equal(typeof presentation.sceneId, "string");
    assert.equal(presentation.transition, "fade-in");
  }
});

test("V1 event presentation uses action cues only for owned scene nodes", () => {
  const marker = v100EventPresentationFor({ eventId: "v100:event:s04:pre", phase: "event", node: { kind: "battle-marker" }, nodeIndex: 2 });
  assert.equal(marker.cueId, "ui-confirm");
  assert.equal(marker.transition, "blackout-reveal");
  const credits = v100EventPresentationFor({ eventId: "v100:event:credits", phase: "credits", node: { kind: "system" }, nodeIndex: 2 });
  assert.equal(credits.cueId, null);
});

test("V1 dialogue portraits retain the legacy left/right speaking positions", () => {
  assert.equal(v100EventPresentationFor({ eventId: "v100:event:prologue", phase: "event", node: { kind: "dialogue", portraitOwner: "unit-paisen" } }).portraitSide, "left");
  assert.equal(v100EventPresentationFor({ eventId: "v100:event:s04:pre", phase: "event", node: { kind: "dialogue", portraitOwner: "unit-babayaga" } }).portraitSide, "left");
  assert.equal(v100EventPresentationFor({ eventId: "v100:event:s04:pre", phase: "event", node: { kind: "dialogue", portraitOwner: "segawa" } }).portraitSide, "right");
});
