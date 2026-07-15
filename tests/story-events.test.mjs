import assert from "node:assert/strict";
import test from "node:test";

import { PROLOGUE_SYNOPSIS, STORY_EVENTS, getStoryEvent, storyEventLog } from "../app/storyEvents.js";

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

  assert.match(PROLOGUE_SYNOPSIS.short, /早良区役所.*防衛線/);
  assert.match(PROLOGUE_SYNOPSIS.long, /TAKUYA/);

  for (const [eventId, storyEvent] of Object.entries(STORY_EVENTS)) {
    assert.ok(storyEvent.background);
    assert.ok(storyEvent.lines.length >= 10 && storyEvent.lines.length <= 14, `${eventId} has a complete but bounded scene`);
    for (const line of storyEvent.lines) {
      assert.ok(line.speaker);
      assert.ok(line.role);
      assert.ok(line.text);
      assert.ok(Array.from(line.text).length <= 32, `${eventId} keeps dialogue landscape-mobile readable: ${line.text}`);
      assert.ok(["left", "right"].includes(line.side));
      assert.ok(line.portrait);
      assert.ok(line.expression);
    }
  }

  const intro = STORY_EVENTS.intro.lines.map(({ speaker, text }) => `${speaker}:${text}`).join("\n");
  assert.match(intro, /早良区役所/);
  assert.match(intro, /最初だけは録音じゃない/);
  assert.match(intro, /商店街/);

  const nishijinPre = STORY_EVENTS["stage-nishijin-pre"].lines.map(({ speaker, text }) => `${speaker}:${text}`).join("\n");
  assert.match(nishijinPre, /クレイジーキング/);
  assert.match(nishijinPre, /大人二人、子ども一人/);

  const nishijinPost = STORY_EVENTS["stage-nishijin-post"].lines.map(({ speaker, text }) => `${speaker}:${text}`).join("\n");
  assert.match(nishijinPost, /大庭 豪/);
  assert.match(nishijinPost, /区役所/);

  const sawara = [
    ...STORY_EVENTS["stage-sawara-pre"].lines,
    ...STORY_EVENTS["stage-sawara-post"].lines,
  ].map(({ speaker, text }) => `${speaker}:${text}`).join("\n");
  assert.match(sawara, /クマバーソン/);
  assert.match(sawara, /ババヤガ/);
  assert.match(sawara, /真壁 玲奈/);
  assert.match(sawara, /同じ声/);

  const takuya = [
    ...STORY_EVENTS["stage-takuya-pre"].lines,
    ...STORY_EVENTS["stage-takuya-post"].lines,
  ].map(({ speaker, text }) => `${speaker}:${text}`).join("\n");
  assert.match(takuya, /人間じゃない/);
  assert.match(takuya, /百道浜/);
  assert.match(takuya, /こちら移動拠点/);
  assert.doesNotMatch(takuya, /識別名|記録に残|名前があるなら/);
});

test("uses dedicated guide and anonymized radio treatments", async () => {
  const screens = await import("node:fs/promises").then(({ readFile }) => readFile(new URL("../app/CampaignScreens.tsx", import.meta.url), "utf8"));
  const css = await import("node:fs/promises").then(({ readFile }) => readFile(new URL("../app/campaign.css", import.meta.url), "utf8"));
  assert.match(screens, /guide: PRODUCTION_VISUALS\.guide/);
  assert.match(screens, /radio: PRODUCTION_VISUALS\.guide/);
  assert.match(css, /\.event-portrait\.guide,\.event-portrait\.radio/);

  const unknownLines = Object.values(STORY_EVENTS)
    .flatMap((storyEvent) => storyEvent.lines)
    .filter((line) => /不明.*無線/.test(line.speaker));
  assert.equal(unknownLines.length > 0, true);
  assert.equal(unknownLines.every((line) => line.portrait === "radio"), true);
});

test("story copy preserves distinct human voices", () => {
  const allLines = Object.values(STORY_EVENTS).flatMap(({ lines }) => lines);
  const joinFor = (speaker) => allLines.filter((line) => line.speaker === speaker).map(({ text }) => text).join("\n");

  assert.match(joinFor("パイセン"), /いるんすよね|間に合う|今から行きます/);
  assert.match(joinFor("水城 奈々"), /録音じゃない|道は開きました|生の通信/);
  assert.match(joinFor("白石 直人"), /頭は動かさない|結果が出たから/);
  assert.match(joinFor("クマバーソン"), /たい|ばい|と？/);
  assert.match(joinFor("ババヤガ"), /机が泳いでる|家庭です/);
  assert.match(joinFor("真壁 玲奈"), /足りません|責任です/);
  assert.doesNotMatch(allLines.map(({ text }) => text).join("\n"), /(?:死体|感染).{0,12}\d+\s*(?:秒|分)/);
});

test("returns bounded conversation log entries without mutating event data", () => {
  assert.equal(getStoryEvent("missing"), null);
  assert.equal(storyEventLog("intro", 0).length, 1);
  assert.equal(storyEventLog("intro", 1).length, 2);
  assert.equal(storyEventLog("intro").length, STORY_EVENTS.intro.lines.length);
  assert.equal(storyEventLog("missing").length, 0);
  assert.equal(Object.isFrozen(PROLOGUE_SYNOPSIS), true);
  assert.equal(Object.isFrozen(STORY_EVENTS.intro), true);
  assert.equal(Object.isFrozen(STORY_EVENTS.intro.lines), true);
  assert.equal(Object.isFrozen(STORY_EVENTS.intro.lines[0]), true);
});
