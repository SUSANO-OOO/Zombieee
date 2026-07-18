import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  PROLOGUE_SYNOPSIS,
  REPLAY_STORY_EVENT_IDS,
  REQUIRED_STORY_EVENT_IDS,
  STORY_DIALOGUE_BY_SPEAKER,
  STORY_EVENTS,
  STORY_EVENT_IDS,
  STORY_SCRIPT_VERSION,
  STORY_SPEAKER_PROFILES,
  getStoryEvent,
  storyEventLog,
} from "../app/storyEvents.js";
import { PORTRAIT_ART } from "../app/spriteManifest.js";

const EXPECTED_EVENT_IDS = [
  "prologue-kumaya-v070",
  "prologue-collapse-montage-v070",
  "prologue-crawler-montage-v070",
  "crawler-signal-v070",
  "prologue-skip-summary-v070",
  "stage-nishijin-pre-v070",
  "stage-nishijin-alert-v070",
  "stage-nishijin-post-v070",
  "stage-nishijin-defeat-v070",
  "stage-nishijin-retry-v070",
  "stage-nishijin-replay-v070",
  "stage-sawara-pre-v070",
  "stage-sawara-alert-v070",
  "stage-sawara-post-v070",
  "stage-sawara-defeat-v070",
  "stage-sawara-retry-v070",
  "stage-sawara-replay-v070",
  "stage-takuya-pre-v070",
  "stage-takuya-warning-v070",
  "stage-takuya-final-v070",
  "stage-takuya-base-remains-v070",
  "stage-takuya-post-v070",
  "stage-takuya-defeat-v070",
  "stage-takuya-defeat-after-boss-v070",
  "stage-takuya-retry-v070",
  "stage-takuya-replay-v070",
  "station-briefing-v070",
  "stage-station-gate-pre-v070",
  "stage-station-gate-alert-v070",
  "stage-station-gate-post-v070",
  "stage-station-gate-defeat-v070",
  "stage-station-gate-retry-v070",
  "stage-station-gate-replay-v070",
  "stage-station-platform-pre-v070",
  "stage-station-platform-alert-v070",
  "stage-station-platform-post-v070",
  "stage-station-platform-defeat-v070",
  "stage-station-platform-retry-v070",
  "stage-station-platform-replay-v070",
  "stage-station-tunnel-pre-v070",
  "stage-station-tunnel-power-v070",
  "stage-station-escape-v070",
  "stage-station-tunnel-post-v070",
  "stage-station-tunnel-defeat-v070",
  "stage-station-tunnel-retry-v070",
  "stage-station-tunnel-replay-v070",
  "chapter-ending-v070",
];

const EXPECTED_SPEAKER_COUNTS = {
  "いくらちゃん": 23,
  "ガンテツ": 26,
  "クマバーソン": 61,
  "クレイジーキング": 33,
  "システム": 15,
  "タタラ": 2,
  "テレビ音声": 1,
  "ナオ": 11,
  "パイセン": 53,
  "ハチ": 1,
  "ババヤガ": 39,
  "ミズチ": 2,
  "モンキー": 31,
  "レイダー": 1,
  "救難無線": 1,
  "研究補助員": 9,
  "避難者の女性": 2,
  "不明な男": 1,
};

const SCENARIO_FILES = [
  "../docs/SCENARIO_0.7.0_PART1_PROLOGUE_STAGE1.md",
  "../docs/SCENARIO_0.7.0_PART2_STAGE2_STAGE3.md",
  "../docs/SCENARIO_0.7.0_PART3_STATION_ENDING_SOUND.md",
];

const SPEAKER_NORMALIZATION = new Map([
  ["ノイズ", "いくらちゃん"],
  ["ノイズ（無線）", "いくらちゃん"],
  ["医療支援", "ナオ"],
  ["モンキーの無線", "モンキー"],
  ["ガンテツの無線", "ガンテツ"],
]);

function dialogueRows() {
  return STORY_EVENT_IDS.flatMap((eventId) => STORY_EVENTS[eventId].lines.map(({ speaker, text }) => ({
    eventId,
    speaker,
    text,
  })));
}

function rowCounts(rows) {
  const counts = new Map();
  for (const { speaker, text } of rows) {
    const key = `${speaker}\t${text}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function extractCanonicalDialogue(source) {
  const rows = [];
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\*\*(.+?)\*\*(「.*」)$/u);
    if (!match) continue;
    rows.push({
      speaker: SPEAKER_NORMALIZATION.get(match[1]) ?? match[1],
      text: match[2].slice(1, -1).replaceAll("`", ""),
    });
  }
  return rows;
}

test("outbreak-origin-v8 exposes the complete fixed P5 event inventory", () => {
  assert.equal(STORY_SCRIPT_VERSION, "outbreak-origin-v8");
  assert.deepEqual(STORY_EVENT_IDS, EXPECTED_EVENT_IDS);
  assert.equal(new Set(STORY_EVENT_IDS).size, STORY_EVENT_IDS.length);
  assert.deepEqual(Object.keys(STORY_EVENTS), STORY_EVENT_IDS);
  assert.deepEqual(REPLAY_STORY_EVENT_IDS, [
    "stage-nishijin-replay-v070",
    "stage-sawara-replay-v070",
    "stage-takuya-replay-v070",
    "stage-station-gate-replay-v070",
    "stage-station-platform-replay-v070",
    "stage-station-tunnel-replay-v070",
  ]);
  assert.deepEqual(
    REQUIRED_STORY_EVENT_IDS,
    STORY_EVENT_IDS.filter((eventId) => !REPLAY_STORY_EVENT_IDS.includes(eventId)),
  );
});

test("all event and line presentation metadata is immutable and character voice remains disabled", () => {
  for (const [eventId, storyEvent] of Object.entries(STORY_EVENTS)) {
    assert.equal(storyEvent.id, eventId);
    assert.equal(storyEvent.scriptVersion, STORY_SCRIPT_VERSION);
    assert.ok(storyEvent.title.length > 0);
    assert.ok(storyEvent.background.length > 0);
    assert.ok(storyEvent.lines.length > 0);
    assert.equal(storyEvent.presentation.characterVoice, false);
    assert.equal(storyEvent.presentation.visualSource, "approved-existing-or-radio-placeholder");
    assert.ok(storyEvent.presentation.chapter.length > 0);
    assert.ok(storyEvent.presentation.scene.length > 0);
    assert.equal(Object.isFrozen(storyEvent), true);
    assert.equal(Object.isFrozen(storyEvent.lines), true);
    assert.equal(Object.isFrozen(storyEvent.presentation), true);
    assert.equal(Object.isFrozen(storyEvent.presentation.beats), true);
    assert.equal(Object.isFrozen(storyEvent.presentation.results), true);
    assert.equal(Object.isFrozen(storyEvent.presentation.battleBarks), true);
    for (const line of storyEvent.lines) {
      assert.ok(line.speaker.length > 0);
      assert.ok(line.role.length > 0);
      assert.ok(["left", "right"].includes(line.side));
      assert.ok(["dialogue", "caption", "bark"].includes(line.mode));
      assert.ok(PORTRAIT_ART[line.portrait], `${eventId}/${line.speaker} resolves an existing portrait or radio placeholder`);
      assert.equal(Object.isFrozen(line), true);
    }
  }
});

test("redesigned people use the existing radio placeholder until one-image approval", () => {
  for (const speaker of ["ハチ", "ミズチ", "ナオ", "タタラ", "レイダー", "ガンテツ", "モンキー", "いくらちゃん"]) {
    assert.equal(STORY_SPEAKER_PROFILES[speaker].approvedPortrait, false);
    assert.equal(STORY_SPEAKER_PROFILES[speaker].portrait, "radio");
  }
  for (const speaker of ["パイセン", "クマバーソン", "ババヤガ", "クレイジーキング"]) {
    assert.equal(STORY_SPEAKER_PROFILES[speaker].approvedPortrait, true);
    assert.notEqual(STORY_SPEAKER_PROFILES[speaker].portrait, "radio");
  }
});

test("fresh and skipped prologue keep the silent player at the center from Kumaya to day 43", () => {
  const opening = STORY_EVENTS["prologue-kumaya-v070"];
  const collapse = STORY_EVENTS["prologue-collapse-montage-v070"];
  const crawler = STORY_EVENTS["prologue-crawler-montage-v070"];
  const signal = STORY_EVENTS["crawler-signal-v070"];
  const summary = STORY_EVENTS["prologue-skip-summary-v070"];
  const combined = [opening, collapse, crawler, signal, summary]
    .flatMap(({ lines }) => lines.map(({ text }) => text))
    .join("\n");
  assert.match(PROLOGUE_SYNOPSIS.short, /くまや/);
  assert.match(PROLOGUE_SYNOPSIS.short, /四十三日後/);
  assert.match(combined, /CRAWLER/);
  assert.match(combined, /発生から四十三日後/);
  assert.match(combined, /指揮官/);
  assert.match(opening.presentation.beats.join("\n"), /プレイヤー.*肩を掴んで止める/);
  assert.match(opening.presentation.beats.join("\n"), /厨房側の退路/);
  assert.match(crawler.presentation.beats.join("\n"), /燃料、乗員、経路/);
  assert.equal(signal.presentation.playerPresence, "silent-commander");
  assert.equal(STORY_SPEAKER_PROFILES["指揮官"], undefined);
  assert.equal(dialogueRows().some(({ speaker }) => speaker === "指揮官"), false);
});

test("Stage 1 through 6 include pre, combat communication, post, result, defeat, retry, and replay evidence", () => {
  const stages = [
    {
      prefix: "stage-nishijin",
      combat: "stage-nishijin-alert-v070",
      result: "stage-nishijin-post-v070",
      expectedResults: ["生存者五名を救出", "大学病院の搬送箱を回収", "クレイジーキング加入・無料所有"],
      barkLines: 5,
    },
    {
      prefix: "stage-sawara",
      combat: "stage-sawara-alert-v070",
      result: "stage-sawara-post-v070",
      expectedResults: ["T計画の研究記録を回収", "レイダーの情報判明・調達可能"],
      barkLines: 7,
    },
    {
      prefix: "stage-takuya",
      combat: "stage-takuya-warning-v070",
      result: "stage-takuya-post-v070",
      expectedResults: ["TAKUYAを制圧", "病院と西新駅を結ぶ地下輸送経路を発見"],
      barkLines: 7,
    },
    {
      prefix: "stage-station-gate",
      combat: "stage-station-gate-alert-v070",
      result: "stage-station-gate-post-v070",
      expectedResults: ["生存者七名を救出", "ガンテツ加入・無料所有"],
      barkLines: 4,
    },
    {
      prefix: "stage-station-platform",
      combat: "stage-station-platform-alert-v070",
      result: "stage-station-platform-post-v070",
      expectedResults: ["生存者五名を救出", "地下輸送記録を回収"],
      barkLines: 7,
    },
    {
      prefix: "stage-station-tunnel",
      combat: "stage-station-tunnel-power-v070",
      result: "stage-station-tunnel-post-v070",
      expectedResults: ["西新駅地下区域を暫定封鎖", "生存者十二名を救出", "モンキー加入・無料所有"],
      barkLines: 7,
    },
  ];
  for (const stage of stages) {
    for (const suffix of ["pre", "post", "defeat", "retry", "replay"]) {
      assert.ok(STORY_EVENTS[`${stage.prefix}-${suffix}-v070`], `${stage.prefix} has ${suffix}`);
    }
    assert.equal(STORY_EVENTS[stage.combat].presentation.kind, "battle-alert");
    assert.equal(STORY_EVENTS[stage.combat].lines.length, stage.barkLines);
    assert.ok(STORY_EVENTS[stage.combat].presentation.battleBarks.length > 0);
    for (const expected of stage.expectedResults) {
      assert.ok(STORY_EVENTS[stage.result].presentation.results.includes(expected), `${stage.result} contains ${expected}`);
    }
  }
  assert.ok(STORY_EVENTS["stage-takuya-final-v070"]);
  assert.ok(STORY_EVENTS["stage-takuya-base-remains-v070"]);
  assert.ok(STORY_EVENTS["stage-takuya-defeat-after-boss-v070"]);
  assert.ok(STORY_EVENTS["station-briefing-v070"]);
  assert.ok(STORY_EVENTS["stage-station-escape-v070"]);
  assert.deepEqual(STORY_EVENTS["chapter-ending-v070"].presentation.results, [
    "西新駅地下区域　暫定封鎖",
    "生存者十二名を救出",
    "次期調査地点　福岡市西部医科大学附属病院",
  ]);
});

test("battle bark metadata makes deployed-speaker and fixed-NPC exceptions explicit", () => {
  const battleEvents = Object.values(STORY_EVENTS).filter(({ presentation }) => presentation.kind === "battle-alert");
  assert.equal(battleEvents.length, 7);
  for (const storyEvent of battleEvents) {
    for (const contract of storyEvent.presentation.battleBarks) {
      assert.ok(contract.lineIndexes.length > 0);
      assert.equal(Object.isFrozen(contract), true);
      for (const lineIndex of contract.lineIndexes) {
        assert.ok(storyEvent.lines[lineIndex], `${storyEvent.id} bark index ${lineIndex} exists`);
      }
      if (!contract.requiresDeployed) {
        assert.equal(contract.npcSupport || contract.operator, true, `${storyEvent.id}/${contract.trigger} documents its non-deployed exception`);
      } else {
        assert.ok(contract.speakerKind, `${storyEvent.id}/${contract.trigger} names a deployed speaker kind`);
      }
    }
  }
  const stationGateNpc = STORY_EVENTS["stage-station-gate-alert-v070"].presentation.battleBarks
    .find(({ trigger }) => trigger === "grappler-grab");
  assert.equal(stationGateNpc.npcSupport, true);
  const stationOperator = STORY_EVENTS["stage-station-platform-alert-v070"].presentation.battleBarks
    .find((contract) => contract.trigger === "ooze-seen" && contract.operator);
  assert.equal(Boolean(stationOperator), true);
});

test("all canonical 0.7.0 spoken lines are present after required display-name normalization", async () => {
  const canonicalSources = await Promise.all(
    SCENARIO_FILES.map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );
  const canonicalRows = canonicalSources.flatMap(extractCanonicalDialogue);
  const implemented = rowCounts(dialogueRows());
  const expected = rowCounts(canonicalRows);
  assert.equal(canonicalRows.length, 273);
  for (const [row, count] of expected) {
    assert.ok((implemented.get(row) ?? 0) >= count, `missing canonical dialogue: ${row}`);
  }
});

test("the complete speaker-by-speaker dialogue ledger is immutable and exact", () => {
  assert.equal(Object.isFrozen(STORY_DIALOGUE_BY_SPEAKER), true);
  assert.deepEqual(
    Object.fromEntries(Object.entries(STORY_DIALOGUE_BY_SPEAKER).map(([speaker, rows]) => [speaker, rows.length])),
    EXPECTED_SPEAKER_COUNTS,
  );
  const flattened = Object.values(STORY_DIALOGUE_BY_SPEAKER).flat();
  assert.equal(flattened.length, dialogueRows().length);
  for (const rows of Object.values(STORY_DIALOGUE_BY_SPEAKER)) {
    assert.equal(Object.isFrozen(rows), true);
    for (const row of rows) {
      assert.equal(Object.isFrozen(row), true);
      assert.equal(STORY_EVENTS[row.eventId].lines[row.index].speaker, row.speaker);
      assert.equal(STORY_EVENTS[row.eventId].lines[row.index].text, row.text);
    }
  }
  const serialized = STORY_EVENT_IDS
    .flatMap((eventId) => STORY_EVENTS[eventId].lines.map(({ speaker, text }) => `${eventId}\t${speaker}\t${text}`))
    .join("\n");
  assert.equal(
    createHash("sha256").update(serialized).digest("hex"),
    "5b69a3f295546390dbd7bb81b9c6462860ebf2a55c874d6ccef78f9b0be90f8e",
  );
});

test("player-facing story data contains no retired names, role labels, or obsolete Momochihama ending", () => {
  const playerFacing = JSON.stringify({
    synopsis: PROLOGUE_SYNOPSIS,
    profiles: STORY_SPEAKER_PROFILES,
    events: STORY_EVENTS,
  });
  assert.doesNotMatch(
    playerFacing,
    /センセイ|ノイズ|ロッカ|医療支援|水城|白石|真壁|黒木|橘|大庭|百道浜|新たな世界の始まり|prologue-v5/,
  );
  for (const required of ["ナオ", "いくらちゃん", "レイダー", "くまや", "四十三日後", "福岡市西部医科大学附属病院"]) {
    assert.match(playerFacing, new RegExp(required));
  }
});

test("fixed four voices retain their canonical distinguishing lines", () => {
  const lines = Object.fromEntries(Object.entries(STORY_DIALOGUE_BY_SPEAKER).map(([speaker, rows]) => [
    speaker,
    rows.map(({ text }) => text).join("\n"),
  ]));
  assert.match(lines["パイセン"], /一個だけっす/);
  assert.match(lines["パイセン"], /それ禁止っす！/);
  assert.match(lines["クマバーソン"], /食いたきゃ十個作る！/);
  assert.match(lines["クマバーソン"], /拓也や/);
  assert.match(lines["ババヤガ"], /家庭内では上場廃止/);
  assert.match(lines["ババヤガ"], /分かったって。帰るばい/);
  assert.match(lines["クレイジーキング"], /敵カ？/);
  assert.match(lines["クレイジーキング"], /終ワラセル/);
  assert.doesNotMatch(lines["クレイジーキング"], /です|ます/);
});

test("lookup aliases preserve old saves while returning only v8 player-facing events", () => {
  assert.equal(getStoryEvent("missing"), null);
  assert.equal(getStoryEvent("intro"), STORY_EVENTS["prologue-kumaya-v070"]);
  assert.equal(getStoryEvent("prologue-opening"), STORY_EVENTS["prologue-kumaya-v070"]);
  assert.equal(getStoryEvent("stage-nishijin-pre"), STORY_EVENTS["stage-nishijin-pre-v070"]);
  assert.equal(getStoryEvent("stage-takuya-final"), STORY_EVENTS["stage-takuya-final-v070"]);
  assert.equal(getStoryEvent("prologue-ending"), STORY_EVENTS["chapter-ending-v070"]);
  assert.equal(storyEventLog("prologue-kumaya-v070", 0).length, 1);
  assert.equal(storyEventLog("prologue-kumaya-v070", 1).length, 2);
  assert.equal(storyEventLog("intro")[0].id, "prologue-kumaya-v070:0");
  assert.deepEqual(storyEventLog("missing"), []);
});
