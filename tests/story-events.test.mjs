import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  PROLOGUE_SYNOPSIS,
  REPLAY_STORY_EVENT_IDS,
  REQUIRED_STORY_EVENT_IDS,
  STORY_EVENTS,
  STORY_EVENT_IDS,
  STORY_SCRIPT_VERSION,
  getStoryEvent,
  storyEventLog,
} from "../app/storyEvents.js";
import { PORTRAIT_ART } from "../app/spriteManifest.js";

function between(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.ok(startIndex >= 0 && endIndex > startIndex, `canonical section ${start} exists`);
  return source.slice(startIndex + start.length, endIndex);
}

function extractCanonicalDialogue(source) {
  const lines = source.split(/\r?\n/);
  const dialogue = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^\*\*(.+)\*\*$/);
    if (!match) continue;
    const text = lines.slice(index + 1).find((line) => line.trim().length > 0);
    if (text?.startsWith("「") && text.endsWith("」")) dialogue.push([match[1], text.slice(1, -1)]);
  }
  return dialogue;
}

function eventDialogue(eventIds) {
  return eventIds.flatMap((eventId) => STORY_EVENTS[eventId].lines.map(({ speaker, text }) => [speaker, text]));
}

test("prologue-v5 exposes the 36 required events and three replay events", () => {
  assert.equal(STORY_SCRIPT_VERSION, "prologue-v5");
  assert.equal(REQUIRED_STORY_EVENT_IDS.length, 36);
  assert.equal(REPLAY_STORY_EVENT_IDS.length, 3);
  assert.equal(STORY_EVENT_IDS.length, 39);
  assert.equal(new Set(STORY_EVENT_IDS).size, 39);
  assert.deepEqual(new Set(Object.keys(STORY_EVENTS)), new Set(STORY_EVENT_IDS));
  assert.deepEqual(REPLAY_STORY_EVENT_IDS, [
    "stage-nishijin-replay",
    "stage-sawara-replay",
    "stage-takuya-replay",
  ]);
});

test("the required event IDs exactly match the canonical implementation list", async () => {
  const canonical = await readFile(new URL("../docs/SCENARIO_0.6.0_COMPLETE.md", import.meta.url), "utf8");
  const eventStructure = between(canonical, "# 6. Codex実装用イベント構造", "# 7. 実装上の禁止事項");
  const canonicalEventIds = [...eventStructure.matchAll(/^- `([^`]+)`$/gm)].map((match) => match[1]);
  assert.deepEqual(REQUIRED_STORY_EVENT_IDS, canonicalEventIds);
});

test("all 222 fixed spoken lines match the canonical markdown without deletion or paraphrase", async () => {
  const canonical = await readFile(new URL("../docs/SCENARIO_0.6.0_COMPLETE.md", import.meta.url), "utf8");
  const completeScript = extractCanonicalDialogue(between(canonical, "# 3. 完全脚本", "# 4. 再プレイ時の会話"));
  const replayScript = extractCanonicalDialogue(between(canonical, "# 4. 再プレイ時の会話", "# 5. 戦闘中ランダム台詞"));
  const implementedScript = eventDialogue(REQUIRED_STORY_EVENT_IDS.filter((eventId) => eventId !== "prologue-ending"));
  const implementedReplay = eventDialogue(REPLAY_STORY_EVENT_IDS);

  assert.equal(completeScript.length, 215);
  assert.equal(replayScript.length, 7);
  assert.deepEqual(implementedScript, completeScript);
  assert.deepEqual(implementedReplay, replayScript);
});

test("ending event preserves the three canonical title cards", () => {
  assert.deepEqual(STORY_EVENTS["prologue-ending"].lines.map(({ speaker, text }) => [speaker, text]), [
    ["システム", "西新・早良区間　主要避難経路を確保"],
    ["システム", "次の目的地　百道浜"],
    ["システム", "序章　完"],
  ]);
});

test("every event is immutable and supplies complete presentation metadata", () => {
  for (const [eventId, storyEvent] of Object.entries(STORY_EVENTS)) {
    assert.equal(storyEvent.id, eventId);
    assert.equal(storyEvent.scriptVersion, STORY_SCRIPT_VERSION);
    assert.ok(storyEvent.background.length > 0);
    assert.ok(storyEvent.lines.length > 0);
    assert.equal(Object.isFrozen(storyEvent), true);
    assert.equal(Object.isFrozen(storyEvent.lines), true);
    for (const line of storyEvent.lines) {
      assert.ok(line.speaker.length > 0);
      assert.ok(line.role.length > 0);
      assert.ok(["left", "right"].includes(line.side));
      assert.ok(line.portrait.length > 0);
      assert.ok(PORTRAIT_ART[line.portrait], `${eventId}/${line.speaker} resolves a production portrait`);
      assert.ok(line.expression.length > 0);
      assert.ok(line.text.length > 0);
      assert.equal(Object.isFrozen(line), true);
    }
  }
});

test("fixed character, mystery-signal, and sequel facts remain present", () => {
  const allLines = Object.values(STORY_EVENTS).flatMap(({ lines }) => lines);
  const allText = allLines.map(({ text }) => text).join("\n");
  assert.match(PROLOGUE_SYNOPSIS.short, /救難信号/);
  assert.match(allText, /大人二人、子ども一人/);
  assert.match(allText, /燃料がもったいない/);
  assert.match(allText, /牛乳は低脂肪/);
  assert.match(allText, /弁当食うていけや/);
  assert.match(allText, /今のところ、生の通信/);
  assert.match(allText, /百道浜/);
  assert.doesNotMatch(allText, /旧名|登録名|ブギーマン/);
});

test("lookup, legacy intro alias, and progressive logs remain safe", () => {
  assert.equal(getStoryEvent("missing"), null);
  assert.equal(getStoryEvent("intro"), STORY_EVENTS["prologue-opening"]);
  assert.equal(storyEventLog("prologue-opening", 0).length, 1);
  assert.equal(storyEventLog("prologue-opening", 1).length, 2);
  assert.equal(storyEventLog("prologue-opening").length, STORY_EVENTS["prologue-opening"].lines.length);
  assert.equal(storyEventLog("intro")[0].id, "prologue-opening:0");
  assert.deepEqual(storyEventLog("missing"), []);
});
