import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultV100Save, normalizeV100Save } from "../app/v100Save.js";
import { V100_STAGE_IDS } from "../app/v100Registry.js";
import { v100ProductionSessionFor } from "../app/v100BattleAdapter.js";
import { createBattleBarkRuntime, queueBattleBark } from "../app/battleBarks.js";
import { publicDisplayText } from "../app/publicDisplayNames.js";
import { beginV100StageAttempt, completeV100Event, createV100StoryFlowState, enterV100Battle, leaveV100Preparation, v100StoryFlowCheckpoint } from "../app/v100StoryFlow.js";
import { createV100BattleResult, recordV100PendingResult, finalizeV100PendingResult } from "../app/v100Transactions.js";
import { v100RewardPresentationFor } from "../app/v100RewardPresentation.js";

test("preparation can return to map without creating a victory or discarding event history", () => {
  const start = createV100StoryFlowState({ playerName: "テスト", flowState: { phase: "map" } });
  const pre = beginV100StageAttempt(start, V100_STAGE_IDS[0]).state;
  const ready = completeV100Event(pre).state;
  const returned = leaveV100Preparation(ready);
  assert.equal(returned.accepted, true);
  assert.equal(returned.state.phase, "map");
  assert.equal(returned.state.pendingResult, null);
  assert.deepEqual(returned.state.completedStageIds, []);
  assert.deepEqual(returned.state.readStoryEventIds, ready.readStoryEventIds);
  const checkpoint = v100StoryFlowCheckpoint(returned.state);
  assert.equal(createV100StoryFlowState({ playerName: "テスト", ...checkpoint }).phase, "map");
  const battle = enterV100Battle(ready).state;
  assert.equal(leaveV100Preparation(battle).accepted, false);
  assert.equal(leaveV100Preparation(battle).state, battle);
});

test("battle barks respect recruited units and Ikura's separate rescue milestone", () => {
  const initial = createDefaultV100Save();
  const session = save => v100ProductionSessionFor({ save, stageId: V100_STAGE_IDS[0] });
  const bark = (trigger, speakerKind, allowedSpeakerKinds) => queueBattleBark({
    runtime: createBattleBarkRuntime(), event: { trigger, speakerKind }, random: () => 0, allowedSpeakerKinds,
  });
  const first = session(initial).barkSpeakerKinds;
  assert.equal(bark("ally-down", "medic", first).shown, false);
  assert.equal(bark("crawler-barrage", "guide", first).shown, false);
  assert.equal(bark("role-cue", "brawler", first).shown, true);
  const rescued = session(normalizeV100Save({ ...initial, completedStageIds: [V100_STAGE_IDS[0]] })).barkSpeakerKinds;
  assert.equal(bark("crawler-barrage", "guide", rescued).shown, true);
  assert.equal(bark("ally-down", "medic", rescued).shown, false);
  const recruited = session(normalizeV100Save({ ...initial, completedStageIds: [V100_STAGE_IDS[0]], registeredUnitIds: [...initial.registeredUnitIds, "unit-nao"], ownedUnitIds: [...initial.ownedUnitIds, "unit-nao"] })).barkSpeakerKinds;
  assert.equal(bark("ally-down", "medic", recruited).shown, true);
  assert.equal(bark("ally-down", "medic", undefined).shown, true, "legacy callers retain their existing catalog");
});

test("V1 display names cover operational subtitles while preserving legacy labels and IDs", () => {
  const options = { crawlerLabel: "装甲車両" };
  assert.equal(publicDisplayText("移動拠点、砲撃姿勢へ。", options), "装甲車両、砲撃姿勢へ。");
  assert.equal(publicDisplayText("移動拠点火器を展開", options), "装甲車両火器を展開");
  assert.equal(publicDisplayText("ナオ // 移動拠点から出撃", options), "ナオ // 装甲車両から出撃");
  assert.equal(publicDisplayText("CRAWLER HP", options), "装甲車両耐久");
  assert.equal(publicDisplayText("CRAWLER HP"), "移動拠点耐久");
  assert.equal(publicDisplayText("/art/crawler/移動拠点.webp", options), "/art/crawler/移動拠点.webp");
});

test("reward presentation reads only the finalized transaction and never predicts unlocks", () => {
  const initial = createDefaultV100Save();
  const result = createV100BattleResult({ stageId: V100_STAGE_IDS[0], battleRunId: "first-sortie", won: true, objectiveComplete: true, vehicleHp: 408, vehicleMaxHp: 680, elapsedSeconds: 132 });
  const pending = recordV100PendingResult(initial, result);
  assert.equal(pending.applied, true);
  assert.equal(v100RewardPresentationFor(pending.save.pendingResult), null);
  assert.equal(pending.save.caps, 0);
  const final = finalizeV100PendingResult(pending.save);
  assert.equal(final.applied, true);
  assert.deepEqual(v100RewardPresentationFor(final.save.lastResult), { stageNumber: 1, rewardCaps: 90, unlocks: ["ナオの配備登録"] });
  assert.equal(finalizeV100PendingResult(final.save).applied, false);
  assert.equal(final.save.caps, 90);
  assert.equal(v100RewardPresentationFor({ ...final.save.lastResult, won: false }), null);
});

test("reloading a settled first clear resumes confirmation and the Stage 30 ending without paying twice", () => {
  for (const number of [1, 30]) {
    const stageId = V100_STAGE_IDS[number - 1];
    const initial = normalizeV100Save({ ...createDefaultV100Save(), playerName: "テスト", availableStageIds: V100_STAGE_IDS });
    const result = createV100BattleResult({ stageId, battleRunId: `resume-${number}`, won: true, objectiveComplete: true, bossDefeated: true, vehicleHp: 408, vehicleMaxHp: 680 });
    const settled = finalizeV100PendingResult(recordV100PendingResult(initial, result).save).save;
    const saved = normalizeV100Save({ ...settled,
      readStoryEventIds: [...settled.readStoryEventIds, `v100:event:s${String(number).padStart(2, "0")}:post`],
      flowState: { phase: "first-clear-post", eventId: `v100:event:s${String(number).padStart(2, "0")}:first-clear-post`, stageId, firstClear: true },
    });
    assert.equal(saved.pendingResult, null);
    const restored = createV100StoryFlowState(JSON.parse(JSON.stringify(saved)));
    assert.equal(restored.pendingResult.battleRunId, result.battleRunId);
    const continued = completeV100Event(restored);
    assert.equal(continued.accepted, true);
    assert.equal(continued.state.phase, number === 30 ? "ending" : "map");
    assert.equal(finalizeV100PendingResult(saved).applied, false);
    assert.equal(saved.caps, settled.caps);
    const wrongStage = createV100StoryFlowState({ ...saved, lastResult: { ...saved.lastResult, stageId: "unknown" } });
    assert.equal(completeV100Event(wrongStage).accepted, false);
    const unread = createV100StoryFlowState({ ...saved, readStoryEventIds: [] });
    assert.equal(completeV100Event(unread).accepted, false);
  }
});
