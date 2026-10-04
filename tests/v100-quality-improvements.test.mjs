import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createDefaultV100Save } from "../app/v100Save.js";
import { V100_STAGES } from "../app/v100Registry.js";
import { v100MapStageName, v100StageDiscovered } from "../app/v100MapDisclosure.js";
import { v100StoryPageFor } from "../app/v100StoryPages.js";
import { v100StoryEventView } from "../app/v100StoryEvents.js";
import { v100UnitPresentation } from "../app/v100UnitPresentation.js";
import { v100DamageTextPosition } from "../app/v100DamageTextPlacement.js";
import { v100RewardPresentationFor } from "../app/v100RewardPresentation.js";
import { V100_CREDITS_SONG, V100_CREDITS_CUES, v100StaffRollFrame, v100StaffRollResumeSeconds, v100StaffRollSections } from "../app/v100StaffRoll.js";
import { V100_CREDITS_FILM } from "../app/v100CreditsFilm.js";
import { V100_SOUND_CREDITS } from "../app/v100CreditSources.js";
import { v100MissionThreatsFor } from "../app/v100MissionBriefing.js";
import { v100BattleDefinitionFor } from "../app/v100BattleAdapter.js";

test("a fresh map discloses no future operation names; S27 reveals the formal unit only on arrival", () => {
  const save = createDefaultV100Save();
  assert.equal(v100StageDiscovered(save, V100_STAGES[0].id), true);
  for (const stage of V100_STAGES.slice(1)) {
    assert.equal(v100StageDiscovered(save, stage.id), false);
    assert.match(v100MapStageName(stage, save), /^未確認区域 S\d{2}$/u);
    assert.doesNotMatch(v100MapStageName(stage, save), /RED PANTHER|TAKUYA/u);
  }
  const stage = V100_STAGES[26];
  save.availableStageIds.push(stage.id);
  assert.equal(v100MapStageName(stage, save), stage.displayName);
  save.availableStageIds = []; save.completedStageIds.push(stage.id);
  assert.equal(v100MapStageName(stage, save), stage.displayName);
});

test("introductory pages preserve text, order, boundaries and every old resume cursor", () => {
  for (const eventId of ["v100:event:prologue", "v100:event:s01:pre"]) {
    const event = v100StoryEventView(eventId, "１２文字の主人公名です");
    const covered = [], pages = [];
    for (let index = 0; index < event.nodes.length;) {
      const page = v100StoryPageFor(eventId, event.nodes, index);
      const displayed = [...page.leadingActions, page.node];
      covered.push(...displayed); pages.push(page);
      assert.ok(page.endIndex - page.startIndex <= 2);
      if (page.leadingActions.length) {
        assert.ok(displayed.every(node => node.sceneTag === event.nodes[index].sceneTag));
        assert.ok(displayed.every(node => ["action", "dialogue"].includes(node.kind)));
        assert.ok(displayed.reduce((n, node) => n + Array.from(node.text).length, 0) <= 90);
      }
      index = page.endIndex + 1;
    }
    assert.deepEqual(covered, event.nodes);
    assert.ok(pages.length < event.nodes.length);
    for (let oldCursor = 0; oldCursor < event.nodes.length; oldCursor += 1) {
      const resumed = v100StoryPageFor(eventId, event.nodes, oldCursor);
      assert.equal(resumed.startIndex, oldCursor);
      assert.deepEqual([...resumed.leadingActions, resumed.node], event.nodes.slice(oldCursor, resumed.endIndex + 1));
    }
  }
  const ending = v100StoryEventView("v100:event:ending", "指揮官");
  for (let index = 0; index < ending.nodes.length; index++) assert.equal(v100StoryPageFor(ending.id, ending.nodes, index).endIndex, index);
});

test("Hachi's first two paid upgrades improve real attack output as well as HP and defense", () => {
  const save = createDefaultV100Save();
  const output = [];
  for (const level of [1, 2, 3, 4]) {
    save.unitLevels["unit-hachi"] = level;
    const info = v100UnitPresentation(save, "unit-hachi");
    output.push(info.current.damage);
    assert.equal(info.current.attackEvery, .62);
    if (level < 4) assert.ok(info.next.damage > info.current.damage);
  }
  assert.deepEqual(output, [11, 11.22, 11.44, 12]);
  assert.equal(Math.ceil(114 / output[0]), 11);
  assert.equal(Math.ceil(114 / output[2]), 10);
});

test("simultaneous damage labels separate at insertion without rewriting their values", () => {
  const labels = [];
  for (let i = 0; i < 5; i++) {
    const position = v100DamageTextPosition(200, 250, "125", labels);
    assert.ok(Math.abs(position.x - 200) <= 32 && Math.abs(position.y - 250) <= 48);
    assert.ok(labels.every(label => Math.abs(label.y - position.y) >= 15 || Math.abs(label.x - position.x) >= 35));
    labels.push({ ...position, value: "125", life: .6 });
  }
  assert.deepEqual(v100DamageTextPosition(200, 250, "125", [{ x: 200, y: 250, value: "125", life: .01 }]), { x: 200, y: 250 });
  const japanese = v100DamageTextPosition(200, 250, "踏みとどまる", [{ x: 265, y: 250, value: "踏みとどまる", life: .6 }]);
  assert.ok(Math.abs(japanese.y - 250) >= 15, "full-width status label overlaps a nearby label");
});

test("only a durable first-clear result presents a newly unlocked unit", () => {
  const stage = V100_STAGES.find(stage => stage.firstClearPayload.includes("unit-nao"));
  const result = { stageId: stage.id, won: true, firstClear: true, finalizedAt: "2026-10-03T00:00:00Z", rewardCaps: 18 };
  assert.deepEqual(v100RewardPresentationFor(result).unlockedUnitIds, ["unit-nao"]);
  assert.deepEqual(v100RewardPresentationFor({ ...result, firstClear: false }).unlockedUnitIds, []);
  assert.equal(v100RewardPresentationFor({ ...result, finalizedAt: undefined }), null);
  assert.equal(v100RewardPresentationFor({ ...result, won: false }), null);
});

test("the full song visits all 11 canonical montage scenes and ends at its boundary", () => {
  const event = v100StoryEventView("v100:event:credits", "花影");
  assert.equal(event.nodes.length, 11);
  for (let index = 0; index < event.nodes.length; index++) {
    const resume = v100StaffRollResumeSeconds(index, event.nodes.length);
    const frame = v100StaffRollFrame(resume + .01, V100_CREDITS_SONG.duration, event.nodes.length);
    assert.equal(frame.index, index); assert.equal(frame.ended, false);
  }
  const final = v100StaffRollFrame(V100_CREDITS_SONG.duration + 10, V100_CREDITS_SONG.duration, event.nodes.length);
  assert.equal(final.index, 10); assert.equal(final.progress, 1); assert.equal(final.ended, true);
  assert.equal(v100StaffRollFrame(0, 0, 0).progress, 0);
  const credits = v100StaffRollSections("花影").flatMap(section => section.lines).join("\n");
  assert.match(credits, /音楽：魔王魂/u); assert.match(credits, /追憶の幻想世界/u); assert.match(credits, /花影/u);
  assert.doesNotMatch(JSON.stringify(v100StaffRollSections()), /あなた/u);
  assert.equal(v100StaffRollSections().some(section => section.title === "指揮官"), false);
  for (const source of V100_SOUND_CREDITS) assert.ok(credits.includes(source.author));
  for (const name of ["いくらちゃん", "宮本武蔵", "TKY", "タクヤ", "セガワ特級博士", "ザキミヤの娘"]) assert.ok(credits.includes(name));
});

test("montage resume follows the same cue boundary when a decoder reports a different duration", () => {
  const duration = 315.82;
  assert.ok(V100_CREDITS_CUES.every((time, index) => index === 0 || time > V100_CREDITS_CUES[index - 1]));
  for (let index = 1; index < 11; index++) {
    const start = v100StaffRollResumeSeconds(index, 11, duration);
    assert.equal(v100StaffRollFrame(start - .001, duration, 11).index, index - 1);
    assert.equal(v100StaffRollFrame(start + .001, duration, 11).index, index);
  }
  const visited = new Set();
  for (let time = 0; time <= duration; time += .1) {
    const frame = v100StaffRollFrame(time, duration, 11);
    visited.add(frame.shotIndex);
    assert.equal(V100_CREDITS_FILM[frame.shotIndex].sceneIndex, frame.index);
  }
  assert.equal(visited.size, V100_CREDITS_FILM.length);
  assert.ok(V100_CREDITS_FILM.every(shot => !shot.actors.includes("unit-miyamoto-musashi")));
});

test("sortie threats describe enemies that actually enter the stage, including the S5 charge", () => {
  for (const stage of V100_STAGES) {
    const enemies = new Set(v100BattleDefinitionFor(stage.id).timeline.flatMap(wave => wave.units));
    for (const threat of v100MissionThreatsFor(stage.id)) {
      assert.ok(enemies.has(threat.id), `${stage.id}: ${threat.id}`);
      if (stage.number < 27) assert.doesNotMatch(threat.name, /RED PANTHER/u);
    }
  }
  const fifth = v100MissionThreatsFor(V100_STAGES[4].id);
  assert.ok(fifth.some(threat => threat.id === "sprinter" && threat.purpose.includes("固有技")));
});

test("the ending song is the official original and one optional offline asset with attribution", async () => {
  const data = await readFile(`public${V100_CREDITS_SONG.src}`);
  assert.equal(createHash("sha256").update(data).digest("hex"), V100_CREDITS_SONG.sha256);
  assert.equal(data.length, 6309936);
  const manifest = JSON.parse(await readFile("public/asset-manifest.json", "utf8"));
  const assets = manifest.assets.filter(asset => asset.path === V100_CREDITS_SONG.src);
  assert.equal(assets.length, 1); assert.equal(assets[0].criticality, "optional");
  assert.equal(assets[0].audioChannel, "bgm"); assert.equal(assets[0].bundlePath, undefined);
  const credits = await readFile("app/V100AssetCredits.tsx", "utf8");
  assert.match(credits, /音楽：魔王魂/u); assert.match(credits, /V100_CREDITS_SONG\.terms/u);
});

test("DPR2 is an explicit high-quality CI acceptance window with preserved evidence", async () => {
  const workflow = await readFile(".github/workflows/ci.yml", "utf8");
  const step = workflow.slice(workflow.indexOf("- name: Measure 844x390 WebKit performance at DPR2"), workflow.indexOf("- name: Preserve measured WebKit performance before diagnostics"));
  assert.match(step, /V100_DEVICE_RUNTIME_DPR: "2"/u);
  assert.doesNotMatch(step, /continue-on-error|QUALITY_DIAGNOSTIC|PAINT_ISOLATION/u);
  assert.equal(workflow.match(/outputs\/v100-device-runtime\/webkit-844x390-dpr2/gu).length, 3);
});
