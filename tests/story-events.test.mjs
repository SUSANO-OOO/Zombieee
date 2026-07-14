import assert from "node:assert/strict";
import test from "node:test";

import { STORY_EVENTS, getStoryEvent, storyEventLog } from "../app/storyEvents.js";

test("defines the short replaceable early-access event set", () => {
  assert.deepEqual(Object.keys(STORY_EVENTS), [
    "intro",
    "stage-nishijin-pre",
    "stage-nishijin-post",
    "stage-sawara-pre",
    "stage-sawara-post",
    "stage-takuya-pre",
    "stage-takuya-post",
  ]);
  for (const event of Object.values(STORY_EVENTS)) {
    assert.ok(event.background);
    assert.ok(event.lines.length >= 2 && event.lines.length <= 3);
    for (const line of event.lines) {
      assert.ok(line.speaker);
      assert.ok(line.role);
      assert.ok(line.text);
      assert.ok(["left", "right"].includes(line.side));
      assert.ok(line.portrait);
      assert.ok(line.expression);
    }
  }
});

test("returns bounded conversation log entries without mutating event data", () => {
  assert.equal(getStoryEvent("missing"), null);
  assert.equal(storyEventLog("intro", 0).length, 1);
  assert.equal(storyEventLog("intro", 1).length, 2);
  assert.equal(storyEventLog("intro").length, 3);
  assert.equal(storyEventLog("missing").length, 0);
  assert.equal(STORY_EVENTS.intro.lines.length, 3);
});
