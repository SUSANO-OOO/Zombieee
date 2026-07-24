import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import * as battleBarks from "../app/battleBarks.js";
import * as campaign from "../app/campaign.js";
import * as productionAudio from "../app/productionAudio.js";
import * as stageResults from "../app/stageResultFacts.js";
import * as story from "../app/storyEvents.js";
import * as storyFlow from "../app/storyFlow.js";

const EXPECTED_STORY_EVENT_IDS = Object.freeze([
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
]);

const CANONICAL_SCENARIO_PARTS = Object.freeze([
  "../docs/SCENARIO_0.7.0_PART1_PROLOGUE_STAGE1.md",
  "../docs/SCENARIO_0.7.0_PART2_STAGE2_STAGE3.md",
  "../docs/SCENARIO_0.7.0_PART3_STATION_ENDING_SOUND.md",
]);

const EXPECTED_STAGE_FLOW_EVENTS = Object.freeze({
  [campaign.CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET]: Object.freeze([
    "stage-nishijin-pre-v070",
    "stage-nishijin-alert-v070",
    "stage-nishijin-post-v070",
    "stage-nishijin-defeat-v070",
    "stage-nishijin-retry-v070",
    "stage-nishijin-replay-v070",
  ]),
  [campaign.CAMPAIGN_STAGE_IDS.SAWARA_WARD_OFFICE]: Object.freeze([
    "stage-sawara-pre-v070",
    "stage-sawara-alert-v070",
    "stage-sawara-post-v070",
    "stage-sawara-defeat-v070",
    "stage-sawara-retry-v070",
    "stage-sawara-replay-v070",
  ]),
  [campaign.CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE]: Object.freeze([
    "stage-takuya-pre-v070",
    "stage-takuya-warning-v070",
    "stage-takuya-final-v070",
    "stage-takuya-base-remains-v070",
    "stage-takuya-post-v070",
    "stage-takuya-defeat-v070",
    "stage-takuya-defeat-after-boss-v070",
    "stage-takuya-retry-v070",
    "stage-takuya-replay-v070",
  ]),
  [campaign.CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_GATE]: Object.freeze([
    "stage-station-gate-pre-v070",
    "stage-station-gate-alert-v070",
    "stage-station-gate-post-v070",
    "stage-station-gate-defeat-v070",
    "stage-station-gate-retry-v070",
    "stage-station-gate-replay-v070",
  ]),
  [campaign.CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_PLATFORM]: Object.freeze([
    "stage-station-platform-pre-v070",
    "stage-station-platform-alert-v070",
    "stage-station-platform-post-v070",
    "stage-station-platform-defeat-v070",
    "stage-station-platform-retry-v070",
    "stage-station-platform-replay-v070",
  ]),
  [campaign.CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_TUNNEL]: Object.freeze([
    "stage-station-tunnel-pre-v070",
    "stage-station-tunnel-power-v070",
    "stage-station-escape-v070",
    "stage-station-tunnel-post-v070",
    "stage-station-tunnel-defeat-v070",
    "stage-station-tunnel-retry-v070",
    "stage-station-tunnel-replay-v070",
  ]),
});

const EXPECTED_AUDIO_SCENE_IDS = Object.freeze([
  "title",
  "intro",
  "map",
  "loadout",
  "stage1",
  "stage2",
  "stage3",
  "station-gate",
  "station-platform",
  "station-tunnel",
  "boss",
  "victory",
  "defeat",
  "silence-prologue-title",
  "story-kumaya-daily",
  "story-kumaya-crisis",
  "story-collapse-montage",
  "story-crawler-montage",
  "story-crawler-signal",
  "story-stage1-pre",
  "story-stage1-battle",
  "story-stage1-post",
  "story-stage2-pre",
  "story-stage2-battle",
  "story-stage2-post",
  "story-stage3-pre",
  "story-stage3-battle",
  "story-boss",
  "silence-stage3-entrance",
  "silence-stage3-final",
  "story-stage3-post",
  "story-station-briefing",
  "story-station-gate-pre",
  "story-station-gate-battle",
  "story-station-gate-post",
  "story-station-platform-pre",
  "story-station-platform-battle",
  "story-station-platform-post",
  "story-station-tunnel-pre",
  "story-station-tunnel-battle",
  "silence-station-seal",
  "story-station-return",
  "story-chapter-ending",
]);

const EXPECTED_STORY_AUDIO_SCENES = Object.freeze({
  "prologue-kumaya-v070": "story-kumaya-daily",
  "prologue-collapse-montage-v070": "story-collapse-montage",
  "prologue-crawler-montage-v070": "story-crawler-montage",
  "crawler-signal-v070": "story-crawler-signal",
  "prologue-skip-summary-v070": "story-crawler-signal",
  "stage-nishijin-pre-v070": "story-stage1-pre",
  "stage-nishijin-alert-v070": "story-stage1-battle",
  "stage-nishijin-post-v070": "story-stage1-post",
  "stage-nishijin-defeat-v070": "defeat",
  "stage-nishijin-retry-v070": "story-stage1-battle",
  "stage-nishijin-replay-v070": "story-stage1-battle",
  "stage-sawara-pre-v070": "story-stage2-pre",
  "stage-sawara-alert-v070": "story-stage2-battle",
  "stage-sawara-post-v070": "story-stage2-post",
  "stage-sawara-defeat-v070": "defeat",
  "stage-sawara-retry-v070": "story-stage2-battle",
  "stage-sawara-replay-v070": "story-stage2-battle",
  "stage-takuya-pre-v070": "story-stage3-pre",
  "stage-takuya-warning-v070": "story-boss",
  "stage-takuya-final-v070": "silence-stage3-final",
  "stage-takuya-base-remains-v070": "story-stage3-battle",
  "stage-takuya-post-v070": "story-stage3-post",
  "stage-takuya-defeat-v070": "defeat",
  "stage-takuya-defeat-after-boss-v070": "defeat",
  "stage-takuya-retry-v070": "story-stage3-battle",
  "stage-takuya-replay-v070": "story-stage3-battle",
  "station-briefing-v070": "story-station-briefing",
  "stage-station-gate-pre-v070": "story-station-gate-pre",
  "stage-station-gate-alert-v070": "story-station-gate-battle",
  "stage-station-gate-post-v070": "story-station-gate-post",
  "stage-station-gate-defeat-v070": "defeat",
  "stage-station-gate-retry-v070": "story-station-gate-battle",
  "stage-station-gate-replay-v070": "story-station-gate-battle",
  "stage-station-platform-pre-v070": "story-station-platform-pre",
  "stage-station-platform-alert-v070": "story-station-platform-battle",
  "stage-station-platform-post-v070": "story-station-platform-post",
  "stage-station-platform-defeat-v070": "defeat",
  "stage-station-platform-retry-v070": "story-station-platform-battle",
  "stage-station-platform-replay-v070": "story-station-platform-battle",
  "stage-station-tunnel-pre-v070": "story-station-tunnel-pre",
  "stage-station-tunnel-power-v070": "story-station-tunnel-battle",
  "stage-station-escape-v070": "story-station-tunnel-battle",
  "stage-station-tunnel-post-v070": "story-station-return",
  "stage-station-tunnel-defeat-v070": "defeat",
  "stage-station-tunnel-retry-v070": "story-station-tunnel-battle",
  "stage-station-tunnel-replay-v070": "story-station-tunnel-battle",
  "chapter-ending-v070": "story-chapter-ending",
});

const FORBIDDEN_PLAYER_FACING_NAMES = Object.freeze([
  /センセイ/u,
  /医療支援/u,
  /ノイズ/u,
  /ロッカ/u,
  /橘[\s\u3000]*迅/u,
  /黒木[\s\u3000]*凛/u,
  /白石[\s\u3000]*直人/u,
  /大庭[\s\u3000]*豪/u,
  /真壁[\s\u3000]*玲奈/u,
  /水城[\s\u3000]*奈々/u,
]);

const EXPECTED_CHARACTER_SPEAKERS = Object.freeze([
  "パイセン",
  "ハチ",
  "ミズチ",
  "ナオ",
  "タタラ",
  "クレイジーキング",
  "クマバーソン",
  "ババヤガ",
  "レイダー",
  "ガンテツ",
  "モンキー",
  "いくらちゃん",
]);

function flattenStrings(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(flattenStrings);
  if (!value || typeof value !== "object") return [];
  return Object.values(value).flatMap(flattenStrings);
}

function assertNoForbiddenPlayerFacingNames(values, label) {
  const text = flattenStrings(values).join("\n");
  for (const forbidden of FORBIDDEN_PLAYER_FACING_NAMES) {
    assert.doesNotMatch(text, forbidden, `${label} exposes ${forbidden}`);
  }
}

function normalizeCanonicalSpeaker(speaker) {
  return speaker
    .replace(/^医療支援$/u, "ナオ")
    .replace(/^ノイズ(?=（|$)/u, "いくらちゃん")
    .replace(/（無線）$/u, "")
    .replace(/の無線$/u, "");
}

function parseCanonicalEvents(source) {
  const events = new Map();
  let currentEventId = null;
  for (const line of source.split(/\r?\n/u)) {
    const eventMatch = line.match(/^## event: `([^`]+)`$/u);
    if (eventMatch) {
      currentEventId = eventMatch[1];
      if (events.has(currentEventId)) throw new Error(`Duplicate canonical event ${currentEventId}`);
      events.set(currentEventId, []);
      continue;
    }
    if (/^#{1,3}\s/u.test(line)) {
      currentEventId = null;
      continue;
    }
    if (!currentEventId) continue;
    const dialogueMatch = line.match(/^\*\*(.+?)\*\*「([\s\S]+)」$/u);
    if (!dialogueMatch) continue;
    events.get(currentEventId).push(Object.freeze({
      speaker: normalizeCanonicalSpeaker(dialogueMatch[1]),
      text: dialogueMatch[2].replace(/`([^`]+)`/gu, "$1"),
    }));
  }
  return events;
}

function dialogueBySpeaker() {
  const grouped = {};
  for (const eventId of story.STORY_EVENT_IDS) {
    for (const [index, line] of story.STORY_EVENTS[eventId].lines.entries()) {
      (grouped[line.speaker] ??= []).push({
        eventId,
        index,
        speaker: line.speaker,
        text: line.text,
      });
    }
  }
  return grouped;
}

function playerFacingCampaignStrings() {
  return [
    ...campaign.CAMPAIGN_STAGES.flatMap((stage) => [
      stage.displayName,
      stage.location,
      stage.missionType,
      stage.objective,
      stage.description,
    ]),
    ...campaign.CAMPAIGN_UNITS.flatMap((unit) => [
      unit.displayName,
      unit.roleName,
      unit.deploymentHint,
      unit.description,
      unit.weaponName,
      ...flattenStrings(unit.appearanceAudit),
    ]),
    campaign.CAMPAIGN_GUIDE.displayName,
    campaign.CAMPAIGN_GUIDE.roleName,
    campaign.CAMPAIGN_GUIDE.location,
  ];
}

test("P5 implements the fixed outbreak-origin-v8 event ledger and every canonical spoken line", async () => {
  assert.equal(story.STORY_SCRIPT_VERSION, "outbreak-origin-v8");
  assert.deepEqual(story.STORY_EVENT_IDS, EXPECTED_STORY_EVENT_IDS);
  assert.equal(new Set(story.STORY_EVENT_IDS).size, EXPECTED_STORY_EVENT_IDS.length);
  assert.deepEqual(Object.keys(story.STORY_EVENTS), EXPECTED_STORY_EVENT_IDS);

  const canonical = new Map();
  for (const relativePath of CANONICAL_SCENARIO_PARTS) {
    const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
    for (const [eventId, lines] of parseCanonicalEvents(source)) {
      assert.equal(canonical.has(eventId), false, `canonical event ${eventId} appears in one PART only`);
      canonical.set(eventId, lines);
    }
  }
  for (const [eventId, canonicalLines] of canonical) {
    assert.ok(story.STORY_EVENTS[eventId], `${eventId} is implemented`);
    const implementedLines = story.STORY_EVENTS[eventId].lines;
    for (const canonicalLine of canonicalLines) {
      const matches = implementedLines.filter((line) => (
        line.speaker === canonicalLine.speaker && line.text === canonicalLine.text
      ));
      assert.equal(matches.length, 1, `${eventId} preserves ${canonicalLine.speaker}: ${canonicalLine.text}`);
    }
  }
});

test("the exported speaker ledger accounts for every line and contains no retired player-facing name", (t) => {
  assert.ok(story.STORY_DIALOGUE_BY_SPEAKER, "STORY_DIALOGUE_BY_SPEAKER is exported");
  const derived = dialogueBySpeaker();
  assert.deepEqual(story.STORY_DIALOGUE_BY_SPEAKER, derived);
  assert.equal(Object.isFrozen(story.STORY_DIALOGUE_BY_SPEAKER), true);
  for (const [speaker, lines] of Object.entries(story.STORY_DIALOGUE_BY_SPEAKER)) {
    assert.equal(Object.isFrozen(lines), true, `${speaker} list is frozen`);
    assert.ok(lines.length > 0, `${speaker} has at least one line`);
    for (const line of lines) {
      assert.equal(Object.isFrozen(line), true, `${speaker}/${line.eventId}/${line.index} is frozen`);
      assert.equal(story.STORY_EVENTS[line.eventId].lines[line.index].speaker, speaker);
      assert.equal(story.STORY_EVENTS[line.eventId].lines[line.index].text, line.text);
    }
  }
  for (const speaker of EXPECTED_CHARACTER_SPEAKERS) {
    assert.ok(story.STORY_DIALOGUE_BY_SPEAKER[speaker]?.length > 0, `${speaker} has authored dialogue`);
  }

  const storyLines = Object.values(story.STORY_EVENTS).flatMap((event) => (
    event.lines.flatMap((line) => [line.speaker, line.role, line.text])
  ));
  const barkLines = battleBarks.APPROVED_BATTLE_BARK_LINES.flatMap((line) => [line.speaker, line.text]);
  const resultLines = campaign.CAMPAIGN_STAGES.flatMap((stage) => [
    ...stageResults.stageResultFacts({ stageId: stage.id, won: true, firstClear: true }),
    ...stageResults.stageResultFacts({ stageId: stage.id, won: true, firstClear: false }),
  ]);
  assertNoForbiddenPlayerFacingNames([
    story.PROLOGUE_SYNOPSIS,
    storyLines,
    barkLines,
    resultLines,
    playerFacingCampaignStrings(),
  ], "production text");

  const counts = Object.fromEntries(
    Object.entries(derived).map(([speaker, lines]) => [speaker, lines.length]),
  );
  t.diagnostic(`P5 speaker line counts: ${JSON.stringify(counts)}`);
});

test("Stage 1-6 preserve complete story routes while Stage 7-16 remain battle-first", () => {
  assert.deepEqual(
    Object.keys(storyFlow.STAGE_STORY_FLOWS),
    campaign.CAMPAIGN_STAGES.map((stage) => stage.id),
  );
  assert.deepEqual(new Set(storyFlow.listStoryFlowEventIds()), new Set(EXPECTED_STORY_EVENT_IDS));

  for (const stage of campaign.CAMPAIGN_STAGES.slice(0, 6)) {
    const flow = storyFlow.STAGE_STORY_FLOWS[stage.id];
    const firstAttempt = storyFlow.getStageEntryStoryEventId({
      stageId: stage.id,
      completedStageIds: [],
      readStoryEventIds: [],
    });
    const retry = storyFlow.getStageEntryStoryEventId({
      stageId: stage.id,
      completedStageIds: [],
      readStoryEventIds: flattenStrings(flow.pre),
    });
    const replay = storyFlow.getStageEntryStoryEventId({
      stageId: stage.id,
      completedStageIds: [stage.id],
      readStoryEventIds: [],
    });
    const defeat = storyFlow.getStageResultStoryEventIds({ stageId: stage.id, won: false });
    const specialDefeat = storyFlow.getStageResultStoryEventIds({
      stageId: stage.id,
      won: false,
      bossDefeated: true,
      enemyBaseDestroyed: false,
    });
    const victory = storyFlow.getStageResultStoryEventIds({
      stageId: stage.id,
      won: true,
      completedStageIds: [],
    });
    const flowEventIds = new Set([
      ...flattenStrings(flow),
      ...flattenStrings(firstAttempt),
      ...flattenStrings(retry),
      ...flattenStrings(replay),
      ...flattenStrings(defeat),
      ...flattenStrings(specialDefeat),
      ...flattenStrings(victory),
    ].filter((value) => story.STORY_EVENTS[value]));
    for (const eventId of EXPECTED_STAGE_FLOW_EVENTS[stage.id]) {
      assert.equal(flowEventIds.has(eventId), true, `${stage.displayName} reaches ${eventId}`);
    }
    for (const field of ["pre", "post", "defeat", "retry", "replay"]) {
      assert.ok(flow[field], `${stage.displayName}.${field} is defined`);
    }

    for (const [label, eventIds] of [["first attempt", firstAttempt], ["retry", retry], ["replay", replay]]) {
      const resolvedEventIds = flattenStrings(eventIds);
      assert.ok(resolvedEventIds.length > 0, `${stage.displayName} ${label} has story`);
      for (const eventId of resolvedEventIds) {
        assert.ok(story.STORY_EVENTS[eventId], `${stage.displayName} ${label} resolves ${eventId}`);
      }
    }

    assert.ok(defeat.length > 0, `${stage.displayName} has defeat story`);
    assert.ok(victory.length > 0, `${stage.displayName} has first-clear story`);
    for (const eventId of [...defeat, ...victory]) {
      assert.ok(story.STORY_EVENTS[eventId], `${stage.displayName} result resolves ${eventId}`);
    }
    assert.deepEqual(
      storyFlow.getStageResultStoryEventIds({
        stageId: stage.id,
        won: true,
        completedStageIds: [stage.id],
      }),
      [],
      `${stage.displayName} replay does not repeat first-clear result story`,
    );
    assert.deepEqual(stageResults.stageResultFacts({
      stageId: stage.id,
      won: false,
      firstClear: true,
    }), [], `${stage.displayName} defeat reports no completion facts`);
  }

  for (const stage of campaign.CAMPAIGN_STAGES.slice(6)) {
    const flow = storyFlow.STAGE_STORY_FLOWS[stage.id];
    assert.deepEqual(flow, {
      pre: [],
      replay: null,
      battle: [],
      post: [],
      defeat: null,
      retry: null,
    });
    assert.deepEqual(storyFlow.getStageEntryStoryEventIds({
      stageId: stage.id,
      completedStageIds: [],
      readStoryEventIds: [],
    }), []);
    assert.deepEqual(storyFlow.getStageResultStoryEventIds({ stageId: stage.id, won: true }), []);
    assert.deepEqual(storyFlow.getStageResultStoryEventIds({ stageId: stage.id, won: false }), []);
  }

  for (const stageId of [
    campaign.CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET,
    campaign.CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_GATE,
    campaign.CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_PLATFORM,
    campaign.CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_TUNNEL,
  ]) {
    assert.ok(stageResults.stageResultFacts({
      stageId,
      won: true,
      firstClear: true,
    }).length > 0, `${campaign.CAMPAIGN_STAGE_BY_ID[stageId].displayName} reports mission facts`);
  }

  const stageSixResult = storyFlow.getStageResultStoryEventIds({
    stageId: campaign.CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_TUNNEL,
    won: true,
    completedStageIds: [],
  });
  assert.deepEqual(stageSixResult, [
    "stage-station-tunnel-post-v070",
    "chapter-ending-v070",
  ]);
});

test("every P5 audio scene resolves, Stage 1-6 route distinctly, and story events use their authored mix", () => {
  const sceneIds = productionAudio.PRODUCTION_AUDIO_MANIFEST.scenes.map((scene) => scene.id);
  assert.deepEqual(sceneIds, EXPECTED_AUDIO_SCENE_IDS);
  assert.equal(new Set(sceneIds).size, EXPECTED_AUDIO_SCENE_IDS.length);

  const stageSceneIds = campaign.CAMPAIGN_STAGES.map((stage) => (
    productionAudio.sceneIdForScreen("battle", stage.id, { musicMode: "normal" })
  ));
  assert.deepEqual(stageSceneIds, [
    "stage1",
    "stage2",
    "stage3",
    "station-gate",
    "station-platform",
    "station-tunnel",
    "stage2",
    "stage1",
    "station-platform",
    "station-gate",
    "stage3",
    "station-tunnel",
    "stage1",
    "stage2",
    "stage3",
    "station-tunnel",
  ]);
  assert.equal(new Set(stageSceneIds).size, 6);

  assert.equal(typeof productionAudio.sceneIdForStoryEvent, "function");
  assert.deepEqual(Object.keys(EXPECTED_STORY_AUDIO_SCENES), [...story.STORY_EVENT_IDS]);
  assert.deepEqual(productionAudio.STORY_AUDIO_EVENT_SCENE_IDS, EXPECTED_STORY_AUDIO_SCENES);
  assert.equal(productionAudio.STORY_AUDIO_SCENE_RULES.length, EXPECTED_STORY_EVENT_IDS.length);
  assert.equal(productionAudio.STORY_AUDIO_SCENE_RULES.every(({ match }) => match === "exact"), true);
  for (const [eventId, initialSceneId] of Object.entries(EXPECTED_STORY_AUDIO_SCENES)) {
    assert.equal(productionAudio.sceneIdForStoryEvent(eventId), initialSceneId, eventId);
    assert.ok(sceneIds.includes(initialSceneId), `${eventId} resolves production scene ${initialSceneId}`);
    for (const [lineIndex] of story.STORY_EVENTS[eventId].lines.entries()) {
      const expectedLineSceneId = eventId === "prologue-kumaya-v070" && lineIndex >= 17
        ? "story-kumaya-crisis"
        : initialSceneId;
      assert.equal(
        productionAudio.sceneIdForStoryEvent(eventId, lineIndex),
        expectedLineSceneId,
        `${eventId}/${lineIndex} uses its authored line scene`,
      );
      assert.equal(
        productionAudio.sceneIdForScreen("event", campaign.INITIAL_STAGE_ID, { eventId, storyLineIndex: lineIndex }),
        expectedLineSceneId,
        `${eventId}/${lineIndex} uses the same line scene through screen routing`,
      );
    }
    assert.equal(
      productionAudio.sceneIdForScreen("event", campaign.INITIAL_STAGE_ID, { eventId }),
      initialSceneId,
      `${eventId} uses the same scene through screen routing`,
    );
  }
  assert.deepEqual(productionAudio.STORY_AUDIO_PHASE_RULES, [
    { eventId: "prologue-kumaya-v070", fromLineIndex: 17, sceneId: "story-kumaya-crisis" },
    {
      eventId: "prologue-collapse-montage-v070",
      fromLineIndex: 4,
      sceneId: "silence-prologue-title",
      holdMs: 2000,
    },
    {
      eventId: "stage-station-escape-v070",
      fromLineIndex: 5,
      sceneId: "silence-station-seal",
      holdMs: 2500,
    },
  ]);
  for (const [eventId, lineCount, silenceSceneId, holdMs] of [
    ["prologue-collapse-montage-v070", 4, "silence-prologue-title", 2000],
    ["stage-station-escape-v070", 5, "silence-station-seal", 2500],
  ]) {
    assert.equal(story.STORY_EVENTS[eventId].lines.length, lineCount);
    assert.equal(story.STORY_EVENTS[eventId].presentation.silenceAfterMs, holdMs);
    assert.equal(productionAudio.sceneIdForStoryEvent(eventId, lineCount - 1), EXPECTED_STORY_AUDIO_SCENES[eventId]);
    assert.equal(productionAudio.sceneIdForStoryEvent(eventId, lineCount), silenceSceneId);
    assert.equal(
      productionAudio.sceneIdForScreen("event", campaign.INITIAL_STAGE_ID, {
        eventId,
        storyLineIndex: lineCount,
      }),
      silenceSceneId,
    );
  }
  for (const [screen, expected] of [
    ["title", "title"],
    ["map", "map"],
    ["loadout", "loadout"],
  ]) {
    assert.equal(productionAudio.sceneIdForScreen(screen), expected);
  }
  assert.equal(productionAudio.sceneIdForScreen("result", null, { won: true }), "victory");
  assert.equal(productionAudio.sceneIdForScreen("result", null, { won: false }), "defeat");
  assert.equal(
    productionAudio.sceneIdForScreen("battle", campaign.CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE, { musicMode: "boss" }),
    "boss",
  );

  assert.deepEqual(productionAudio.STORY_AUDIO_MIX, {
    dialogueBgmDuckDb: -4,
    dialogueBgmDuckLevel: 0.630957,
    importantAmbienceDuckDb: -2,
    importantAmbienceDuckLevel: 0.794328,
    dialogueReleaseMs: 350,
  });
});

test("StoryScreen reports every line boundary and holds authored silence before completing", async () => {
  const [screensSource, gameSource] = await Promise.all([
    readFile(new URL("../app/CampaignScreens.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/AshfallGame.tsx", import.meta.url), "utf8"),
  ]);
  assert.ok(screensSource.includes("onStoryAudioPositionChange(event.id, index);"));
  assert.ok(screensSource.includes("onStoryAudioPositionChange(event.id, event.lines.length);"));
  assert.ok(screensSource.includes("window.setTimeout(completeOnce, holdMs);"));
  assert.ok(screensSource.includes("disabled={silenceTail} aria-busy={silenceTail}"));
  assert.ok(gameSource.includes("setStoryAudioPosition((current) =>"));
  assert.ok(gameSource.includes("storyAudioPosition.eventId === eventId ? storyAudioPosition.lineIndex : 0"));
  assert.ok(gameSource.includes("{ won: outcome, musicMode: desiredMusicModeRef.current, eventId, storyLineIndex }"));
  assert.ok(gameSource.includes("sceneIdForScreen(screen, selectedStageId, musicState)"));
});

test("TAKUYA entrance owns an audible 3.4 second silence-scene cut before boss music", async () => {
  assert.deepEqual(productionAudio.TAKUYA_ENTRANCE_AUDIO, {
    cueId: "sfx-v070-takuya-entrance",
    silenceSceneId: "silence-stage3-entrance",
    durationSeconds: 3.4,
  });
  const entranceScene = productionAudio.PRODUCTION_AUDIO_MANIFEST.sceneById["silence-stage3-entrance"];
  assert.equal(entranceScene.bgm, undefined);
  assert.deepEqual(entranceScene.preload, ["sfx-v070-takuya-entrance"]);
  assert.equal(
    productionAudio.PRODUCTION_AUDIO_MANIFEST.assetById["sfx-v070-takuya-entrance"].category,
    "monsters",
  );
  const gameSource = await readFile(new URL("../app/AshfallGame.tsx", import.meta.url), "utf8");
  assert.match(gameSource, /g\.takuyaEntranceAudioRemaining = TAKUYA_ENTRANCE_AUDIO\.durationSeconds/u);
  assert.match(gameSource, /playProductionCue\(TAKUYA_ENTRANCE_AUDIO\.cueId, W \/ 2/u);
  assert.match(gameSource, /takuyaEntranceAudioActive[\s\S]*TAKUYA_ENTRANCE_AUDIO\.silenceSceneId/u);
  assert.match(gameSource, /if \(battleSilenceSceneId\(g\)\) return/u);
});

test("P5 preserves battle voices while authored story dialogue has no voiceover or TTS contract", async () => {
  for (const event of Object.values(story.STORY_EVENTS)) {
    assert.equal(event.presentation.characterVoice, false, `${event.id} disables story dialogue voiceover`);
  }

  const storySceneIds = productionAudio.PRODUCTION_AUDIO_MANIFEST.scenes
    .map(({ id }) => id)
    .filter((id) => id === "intro" || id.startsWith("story-") || id.startsWith("silence-"));
  assert.equal(storySceneIds.length, 31);
  for (const sceneId of storySceneIds) {
    const scene = productionAudio.PRODUCTION_AUDIO_MANIFEST.sceneById[sceneId];
    const cueIds = [scene.bgm, ...scene.ambience, ...scene.preload].filter(Boolean);
    for (const cueId of cueIds) {
      const cue = productionAudio.PRODUCTION_AUDIO_MANIFEST.assetById[cueId]
        ?? productionAudio.PRODUCTION_AUDIO_MANIFEST.poolById[cueId];
      assert.notEqual(cue?.category, "humanVoices", `${sceneId} must not bind battle voice cue ${cueId}`);
      assert.doesNotMatch(cueId, /(?:voiceover|speech|tts)/iu, `${sceneId} must not bind dialogue read-aloud cue`);
    }
  }

  const v070Assets = productionAudio.PRODUCTION_AUDIO_MANIFEST.assets.filter((asset) => (
    asset.sources.some(({ src }) => src.startsWith("/audio/v070/"))
  ));
  assert.equal(v070Assets.some(({ category }) => category === "humanVoices"), false);
  for (const asset of v070Assets) {
    assert.doesNotMatch(asset.id, /(?:voiceover|speech|tts)/iu);
    for (const { src } of asset.sources) assert.doesNotMatch(src, /(?:voiceover|speech|tts)/iu);
  }

  const battleVoiceAssets = productionAudio.PRODUCTION_AUDIO_MANIFEST.assets
    .filter(({ category }) => category === "humanVoices");
  const battleVoicePools = productionAudio.PRODUCTION_AUDIO_MANIFEST.pools
    .filter(({ category }) => category === "humanVoices");
  assert.ok(battleVoiceAssets.length > 0, "existing battle voice assets remain in the manifest");
  assert.ok(battleVoicePools.length > 0, "existing generic battle voice pools remain in the manifest");
  const existingBattleVoiceKinds = [...new Set(campaign.CAMPAIGN_UNITS.map(({ combatKind }) => combatKind))];
  for (const kind of existingBattleVoiceKinds) {
    for (const event of ["deploy", "attack", "hurt", "death"]) {
      const cueId = productionAudio.humanVoiceCueForUnit(kind, event);
      assert.ok(cueId, `${kind}/${event} battle voice cue remains`);
      const cue = productionAudio.PRODUCTION_AUDIO_MANIFEST.assetById[cueId]
        ?? productionAudio.PRODUCTION_AUDIO_MANIFEST.poolById[cueId];
      assert.equal(cue?.category, "humanVoices", `${kind}/${event} resolves a battle voice asset or pool`);
    }
    assert.equal(productionAudio.humanVoiceCueForUnit(kind, "speech"), null, `${kind} has no story speech cue`);
    assert.equal(productionAudio.humanVoiceCueForUnit(kind, "voiceover"), null, `${kind} has no story voiceover cue`);
    assert.equal(productionAudio.humanVoiceCueForUnit(kind, "tts"), null, `${kind} has no story TTS cue`);
  }
  for (const kind of Object.keys(productionAudio.UNIT_AUDIO_CUE_CONTRACTS)) {
    for (const event of ["deploy", "attack", "hurt", "death"]) {
      const cueId = productionAudio.unitAudioCueFor(kind, "voice", event);
      assert.equal(cueId, productionAudio.humanVoiceCueForUnit(kind, event), `${kind}/${event} dedicated voice API agrees`);
      assert.equal(productionAudio.PRODUCTION_AUDIO_MANIFEST.assetById[cueId]?.category, "humanVoices");
    }
  }

  const gameSource = await readFile(new URL("../app/AshfallGame.tsx", import.meta.url), "utf8");
  assert.match(gameSource, /unitAudioCueFor\(kind, "voice", "deploy"\) \|\| humanVoiceCueForUnit\(kind, "deploy"\)/u);
  assert.match(gameSource, /humanVoiceCueForUnit\(f\.kind, "attack"\)/u);
  assert.match(gameSource, /humanVoiceCueForUnit\(target\.kind, "hurt"\)/u);
  assert.match(gameSource, /humanVoiceCueForUnit\(fighter\.kind, "death"\)/u);
  const controlStart = gameSource.indexOf('{audioUnlockVisible && <button');
  const controlEnd = gameSource.indexOf("</button>}", controlStart);
  assert.ok(controlStart >= 0 && controlEnd > controlStart, "audio enable control exists");
  const controlSource = gameSource.slice(controlStart, controlEnd);
  assert.match(controlSource, /戦闘ボイス/u);
});
