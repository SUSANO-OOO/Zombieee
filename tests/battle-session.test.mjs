import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  PAUSE_ACTION_IDS,
  createBattleResultId,
  createBattleSessionTransition,
  resolvePauseAction,
} from "../app/battleSession.js";

test("every retry and fresh battle receives a distinct result receipt", () => {
  const deterministicUuid = () => "fixed-uuid";
  const first = createBattleResultId("stage-nishijin", { randomUUID: deterministicUuid });
  const retry = createBattleResultId("stage-nishijin", { randomUUID: deterministicUuid });
  const replay = createBattleResultId("stage-nishijin", { randomUUID: deterministicUuid });

  assert.match(first, /^stage-nishijin:fixed-uuid:/);
  assert.notEqual(retry, first);
  assert.notEqual(replay, retry);
  assert.notEqual(replay, first);
  assert.throws(() => createBattleResultId(""), /stage ID/);
});

test("pause actions cover resume, cancel, restart, loadout, and withdrawal without campaign commits", () => {
  assert.deepEqual(PAUSE_ACTION_IDS, ["pause", "resume", "cancel", "restart", "loadout", "withdraw"]);
  const expected = {
    pause: ["battle", true, false, false],
    resume: ["battle", false, false, false],
    cancel: ["pause", true, false, false],
    restart: ["battle", false, true, true],
    loadout: ["loadout", false, true, false],
    withdraw: ["map", false, true, false],
  };
  for (const [action, [destination, paused, discardBattleState, startFreshBattle]] of Object.entries(expected)) {
    const transition = resolvePauseAction(action);
    assert.equal(transition.destination, destination, `${action} destination`);
    assert.equal(transition.paused, paused, `${action} pause state`);
    assert.equal(transition.discardBattleState, discardBattleState, `${action} local-state disposal`);
    assert.equal(transition.startFreshBattle, startFreshBattle, `${action} restart behavior`);
    assert.equal(transition.preserveSelection, true, `${action} selection preservation`);
    assert.equal(transition.commitResult, false, `${action} cannot award stars, rewards, or unlocks`);
  }
  assert.equal(resolvePauseAction("unknown"), null);
});

test("pause transition execution preserves selection and the exact campaign save", () => {
  const save = {
    processedResultIds: ["old-result"],
    completedStageIds: ["stage-one"],
    bestStarsByStage: { "stage-one": 3 },
    claimedStarRewardsByStage: { "stage-one": 3 },
    supplies: 42,
    unlockedStageIds: ["stage-one", "stage-two"],
    unlockedUnitIds: ["brawler", "scout"],
  };
  const before = structuredClone(save);
  const selection = {
    stageId: "stage-two",
    formationKinds: ["brawler", "scout"],
    selectedSupply: "medical",
    campaignSave: save,
    currentResultId: "stage-two:old",
  };
  for (const action of ["cancel", "loadout", "withdraw"]) {
    const transition = createBattleSessionTransition({ action, ...selection });
    assert.equal(transition.campaignSave, save, `${action} keeps the live save object`);
    assert.deepEqual(transition.campaignSave, before, `${action} does not alter progress`);
    assert.equal(transition.stageId, selection.stageId);
    assert.deepEqual(transition.formationKinds, selection.formationKinds);
    assert.equal(transition.selectedSupply, selection.selectedSupply);
    assert.equal(transition.resultId, selection.currentResultId);
  }
  assert.deepEqual(save, before);

  const restart = createBattleSessionTransition({
    action: "restart",
    ...selection,
    createResultId: (stageId) => `${stageId}:fresh`,
  });
  assert.equal(restart.resultId, "stage-two:fresh");
  assert.notEqual(restart.resultId, selection.currentResultId);
  assert.deepEqual(restart.formationKinds, selection.formationKinds);
  assert.equal(restart.selectedSupply, selection.selectedSupply);
  assert.equal(restart.campaignSave, save);
  assert.equal(restart.commitResult, false);
});

test("the runtime routes destructive pause actions through the no-result contract", async () => {
  const source = await readFile(new URL("../app/AshfallGame.tsx", import.meta.url), "utf8");
  assert.match(source, /resultId = createBattleResultId\(stageId\)/);
  assert.match(source, /resolvePauseAction\(g\.paused \? "resume" : "pause"\)/);
  assert.match(source, /const transition = createBattleSessionTransition\(\{/);
  assert.match(source, /!transition\.discardBattleState \|\| transition\.commitResult/);
  assert.match(source, /transition\.destination === "battle" && transition\.startFreshBattle/);
  assert.match(source, /transition\.destination === "loadout"/);
  assert.match(source, /transition\.destination === "map"\) returnToMap\(transition/);
  assert.match(source, /const battleStageId = qaMode \? CAMPAIGN_STAGE_IDS\.NISHIJIN_DEFENSE_LINE : sessionOverride\?\.stageId \?\? selectedStageId/);
  assert.match(source, /const requestedFormation = sessionOverride\?\.formationKinds \?\? formationKinds/);
  assert.match(source, /const battleSupply = sessionOverride\?\.selectedSupply \?\? selectedSupply/);
  assert.match(source, /sessionOverride\?\.resultId \?\? createBattleResultId\(battleStageId\)/);
  assert.match(source, /initialGame\(transition\.selectedSupply, transition\.stageId, transition\.formationKinds as UnitKind\[\]\)/);
  const returnToMapBody = source.match(/const returnToMap = useCallback\(\(sessionOverride\?: \{[\s\S]*?\n  \}\) => \{([\s\S]*?)\n  \}, \[/)?.[1] ?? "";
  assert.notEqual(returnToMapBody, "", "returnToMap source extraction must remain live");
  assert.match(returnToMapBody, /sessionOverride\?\.selectedSupply \?\? selectedSupply/);
  assert.match(returnToMapBody, /sessionOverride\?\.stageId \?\? selectedStageId/);
  assert.match(returnToMapBody, /sessionOverride\?\.formationKinds \?\? formationKinds/);
  assert.doesNotMatch(returnToMapBody, /resolveStageResult|setCampaignSave/);
});
