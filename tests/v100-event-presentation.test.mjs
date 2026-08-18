import assert from "node:assert/strict";
import test from "node:test";

import {
  V100_EVENT_PRESENTATION_CATEGORIES,
  v100EventPresentationFor,
} from "../app/v100EventPresentation.js";

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
