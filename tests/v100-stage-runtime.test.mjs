import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  V100_PHASE2_STAGE_NUMBERS,
  V100_STAGE_RUNTIME,
  validateV100StageRuntimeRegistry,
  v100StageAudioFor,
  v100StageRequiredAssetPaths,
} from "../app/v100StageRuntime.js";
import { createBattleDefinition } from "../app/battleDefinitions.js";
import { V100_STAGES } from "../app/v100Registry.js";
import { V100_STORY_EVENTS } from "../app/v100StoryEvents.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("V1.0.0 Stage Runtime closes the Phase 2 production contract", async () => {
  const contract = validateV100StageRuntimeRegistry();
  assert.equal(contract.ok, true, contract.errors.join(", "));
  assert.equal(contract.stageCount, 30);
  assert.deepEqual(V100_PHASE2_STAGE_NUMBERS, Array.from({ length: 20 }, (_, index) => index + 1));

  for (const stageNumber of V100_PHASE2_STAGE_NUMBERS) {
    const stage = V100_STAGES[stageNumber - 1];
    const runtime = V100_STAGE_RUNTIME[stage.id];
    assert.equal(runtime.stageNumber, stageNumber);
    assert.ok(runtime.backgroundPath);
    assert.equal(runtime.storyEventIds.length, 3);
    assert.ok(runtime.objective.states.length >= 4);
    assert.equal(v100StageAudioFor(stage.id, "pre"), runtime.audio.scenes.pre);
    assert.equal(v100StageAudioFor(stage.id, "battle"), runtime.audio.scenes.battle);
    assert.equal(v100StageAudioFor(stage.id, "post"), runtime.audio.scenes.post);
    for (const assetPath of v100StageRequiredAssetPaths(stage.id)) {
      assert.equal(await readFile(path.join(ROOT, "public", assetPath.replace(/^\//u, ""))).then(() => true, () => false), true, `${stage.id} asset ${assetPath}`);
    }
  }
});

test("V1.0.0 boss runtime reserves the production boss audio owner until death", () => {
  for (const stage of V100_STAGES.filter(({ missionType }) => missionType === "boss")) {
    const runtime = V100_STAGE_RUNTIME[stage.id];
    assert.equal(runtime.audio.bossOwnsProductionSceneUntilDeath, true, stage.id);
    assert.equal(runtime.audio.scenes.battle, "story-boss");
    assert.deepEqual(runtime.objective.states.slice(-6), ["entrance", "telegraph", "phase", "hit", "death", "defeat"]);
  }
});

test("Stage 30 has no mid-battle story dialogue event", () => {
  const midBattle = Object.values(V100_STORY_EVENTS).find((event) => event.stageNumber === 30 && event.kind === "mid-battle");
  assert.equal(midBattle, undefined);
  assert.equal(V100_STAGE_RUNTIME["stage-nishijin-defense-line-takuya-omega"].storyEventIds.length, 3);
});

test("V100 battle definitions are explicitly injected without replacing legacy shared stages", () => {
  const sharedStageId = "stage-nishijin-defense-line-takuya";
  const legacy = createBattleDefinition(sharedStageId);
  const v100 = createBattleDefinition(sharedStageId, { v100: true });
  assert.equal(legacy.baseMaxHp, 520);
  assert.equal(v100.baseMaxHp, 680);
  assert.equal(v100.displayName, "西新防衛線・TAKUYA");
  assert.notDeepEqual(v100.timeline, legacy.timeline);
});
