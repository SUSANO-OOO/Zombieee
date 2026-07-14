import assert from "node:assert/strict";
import test from "node:test";

import { STORY_EVENTS, getStoryEvent, storyEventLog } from "../app/storyEvents.js";

test("defines the complete cinematic prologue event set", () => {
  assert.deepEqual(Object.keys(STORY_EVENTS), [
    "intro",
    "stage-nishijin-pre",
    "stage-nishijin-post",
    "stage-sawara-pre",
    "stage-sawara-post",
    "stage-takuya-pre",
    "stage-takuya-post",
  ]);
  for (const [eventId, event] of Object.entries(STORY_EVENTS)) {
    assert.ok(event.background);
    assert.ok(event.lines.length >= 5 && event.lines.length <= 9, `${eventId} has a complete but bounded scene`);
    for (const line of event.lines) {
      assert.ok(line.speaker);
      assert.ok(line.role);
      assert.ok(line.text);
      assert.ok(Array.from(line.text).length <= 32, `${eventId} keeps dialogue landscape-mobile readable: ${line.text}`);
      assert.ok(["left", "right"].includes(line.side));
      assert.ok(line.portrait);
      assert.ok(line.expression);
    }
  }
  assert.ok(STORY_EVENTS.intro.lines.length >= 8);
  assert.match(STORY_EVENTS.intro.lines.at(-1).text, /救助作戦を開始/);
  assert.match(STORY_EVENTS["stage-nishijin-post"].lines.at(-1).text, /大庭/);
  assert.match(STORY_EVENTS["stage-sawara-post"].lines.map(({ speaker, text }) => `${speaker}${text}`).join(""), /真壁/);
  assert.match(STORY_EVENTS["stage-takuya-pre"].lines.map(({ text }) => text).join(""), /TAKUYA/);
  assert.match(STORY_EVENTS["stage-takuya-post"].lines.map(({ text }) => text).join(""), /百道浜.*福岡タワー/);
});

test("uses a dedicated production guide portrait and an anonymized radio treatment", async () => {
  const screens = await import("node:fs/promises").then(({ readFile }) => readFile(new URL("../app/CampaignScreens.tsx", import.meta.url), "utf8"));
  const css = await import("node:fs/promises").then(({ readFile }) => readFile(new URL("../app/campaign.css", import.meta.url), "utf8"));
  assert.match(screens, /guide: PRODUCTION_VISUALS\.guide/);
  assert.match(screens, /radio: PRODUCTION_VISUALS\.guide/);
  assert.match(css, /\.event-portrait\.guide,\.event-portrait\.radio/);
  const unknownLines = Object.values(STORY_EVENTS).flatMap((event) => event.lines).filter((line) => line.speaker === "不明な無線");
  assert.equal(unknownLines.length > 0, true);
  assert.equal(unknownLines.every((line) => line.portrait === "radio"), true);
});

test("story copy preserves character voices and avoids numeric corpse-timer exposition", () => {
  const allLines = Object.values(STORY_EVENTS).flatMap(({ lines }) => lines);
  const pasenLines = allLines.filter(({ speaker }) => speaker === "パイセン").map(({ text }) => text).join("\n");
  const mizukiLines = allLines.filter(({ speaker }) => speaker === "水城 奈々").map(({ text }) => text).join("\n");
  const shiraishiLines = allLines.filter(({ speaker }) => speaker === "白石 直人").map(({ text }) => text).join("\n");
  assert.match(pasenLines, /拳|通さない|返してもらう/);
  assert.match(mizukiLines, /確認|反応|経路|進路/);
  assert.match(shiraishiLines, /生存者|重傷者|呼吸/);
  assert.doesNotMatch(allLines.map(({ text }) => text).join("\n"), /(?:死体|感染).{0,12}\d+\s*(?:秒|分)/);
});

test("returns bounded conversation log entries without mutating event data", () => {
  assert.equal(getStoryEvent("missing"), null);
  assert.equal(storyEventLog("intro", 0).length, 1);
  assert.equal(storyEventLog("intro", 1).length, 2);
  assert.equal(storyEventLog("intro").length, STORY_EVENTS.intro.lines.length);
  assert.equal(storyEventLog("missing").length, 0);
  assert.equal(STORY_EVENTS.intro.lines.length, 9);
  assert.equal(Object.isFrozen(STORY_EVENTS.intro.lines), true);
  assert.equal(Object.isFrozen(STORY_EVENTS.intro.lines[0]), true);
});
