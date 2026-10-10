import assert from "node:assert/strict";
import test from "node:test";
import { V100_STORY_EVENTS } from "../app/v100StoryEvents.js";
import { v100EventPhaseForId } from "../app/v100Registry.js";
import { createV100DialogueFixture } from "../scripts/v100-dialogue-fixture.mjs";
import { serializeV100Save, deserializeV100Save } from "../app/v100Save.js";

test("every current R9 node has a valid, source-bound presentation checkpoint", () => {
  let checked = 0;
  for (const [eventId, event] of Object.entries(V100_STORY_EVENTS)) {
    for (let nodeIndex = 0; nodeIndex < event.nodes.length; nodeIndex++) {
      const save = createV100DialogueFixture({eventId, nodeIndex});
      const restored = deserializeV100Save(serializeV100Save(save));
      assert.equal(restored.ok, true);
      assert.equal(restored.save.flowState.phase, v100EventPhaseForId(eventId));
      assert.equal(restored.save.flowState.nodeIndex, nodeIndex);
      if (restored.save.flowState.phase === "post") {
        assert.equal(restored.save.pendingResult.won, true);
        assert.equal(restored.save.lastResult, null);
      } else if (restored.save.flowState.phase === "first-clear-post") {
        assert.equal(restored.save.pendingResult, null);
        assert.equal(restored.save.lastResult.won, true);
        assert.equal(typeof restored.save.lastResult.finalizedAt, "string");
      }
      checked++;
    }
  }
  assert.equal(checked, 1126);
});
