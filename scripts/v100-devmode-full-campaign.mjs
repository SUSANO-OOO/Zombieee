import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { V100_BOSSES, V100_STAGE_IDS } from "../app/v100Registry.js";
import { v100StoryEventView, V100_STORY_SOURCE_SHA256 } from "../app/v100StoryEvents.js";
import {
  beginV100StageAttempt, completeV100Event, createV100StoryFlowState,
  enterV100Battle, enterV100PostResult, finishV100Battle,
  markV100FlowEventRead, startV100NamedCampaign, v100StoryFlowCheckpoint,
} from "../app/v100StoryFlow.js";
import {
  applyV100SaveMutation, createDefaultV100Save, deserializeV100Save,
  markV100EventRead, serializeV100Save,
} from "../app/v100Save.js";
import {
  createV100BattleResult, finalizeV100PendingResult, recordV100PendingResult,
} from "../app/v100Transactions.js";

// Developer-mode audit: battles receive explicit synthetic victories. This proves
// campaign progression and save receipts, not that a player can win each battle.
const playerName = "試遊指揮官";
const now = "2026-09-26T00:00:00.000Z";
let save = createDefaultV100Save({ playerName, now });
let flow = createV100StoryFlowState();
let eventsVisited = 0;
let nodesVisited = 0;
const stages = [];

function accepted(transition, step) {
  assert.equal(transition.accepted, true, `${step}: ${transition.reason ?? "rejected"}`);
  return transition.state;
}

function reload() {
  const decoded = deserializeV100Save(serializeV100Save(save));
  assert.equal(decoded.ok, true);
  save = decoded.save;
  flow = createV100StoryFlowState(save);
}

function checkpoint() {
  const point = v100StoryFlowCheckpoint(flow);
  const mutation = applyV100SaveMutation(save, (current) => ({
    ...current,
    flowState: point.flowState,
    eventCursor: point.eventCursor,
    campaignStarted: true,
    playerName,
  }), { now });
  assert.equal(mutation.applied, true);
  save = mutation.save;
  reload();
}

function visitEvent(expectedId) {
  assert.equal(flow.eventId, expectedId);
  const view = v100StoryEventView(expectedId, playerName);
  assert.ok(view && (view.nodes.length > 0 || view.finalizeOnly === true), `empty event ${expectedId}`);
  for (const node of view.nodes) {
    assert.equal(typeof node.text, "string");
    assert.equal(node.text.includes("{{PLAYER_NAME}}"), false, expectedId);
  }
  eventsVisited += 1;
  nodesVisited += view.nodes.length;
  checkpoint();
  flow = markV100FlowEventRead(flow, expectedId);
  const read = markV100EventRead(save, expectedId, { now });
  assert.equal(read.applied, true);
  save = read.save;
  flow = accepted(completeV100Event(flow), `complete ${expectedId}`);
}

flow = accepted(startV100NamedCampaign(flow, playerName), "name");
visitEvent("v100:event:prologue");

for (let index = 0; index < V100_STAGE_IDS.length; index += 1) {
  const number = index + 1;
  const stageId = V100_STAGE_IDS[index];
  const slug = `s${String(number).padStart(2, "0")}`;
  flow = accepted(beginV100StageAttempt(flow, stageId), `begin ${slug}`);
  visitEvent(`v100:event:${slug}:pre`);
  flow = accepted(enterV100Battle(flow), `battle ${slug}`);
  const bossDefeated = V100_BOSSES.some((boss) => boss.stageNumber === number);
  const result = createV100BattleResult({
    stageId, battleRunId: `devmode-${slug}`, won: true,
    objectiveComplete: true, bossDefeated,
    vehicleHp: 340, vehicleMaxHp: 680,
    elapsedSeconds: 180, unitDeaths: 1,
  });
  assert.equal(result.won, true);
  const pending = recordV100PendingResult(save, result, { now });
  assert.equal(pending.applied, true, `pending ${slug}: ${pending.reason ?? ""}`);
  save = pending.save;
  checkpoint();
  flow = accepted(finishV100Battle(flow, result), `result ${slug}`);
  flow = accepted(enterV100PostResult(flow), `post ${slug}`);
  visitEvent(`v100:event:${slug}:post`);
  visitEvent(`v100:event:${slug}:first-clear-post`);
  const finalized = finalizeV100PendingResult(save, { result, now });
  assert.equal(finalized.applied, true, `settle ${slug}: ${finalized.reason ?? ""}`);
  save = finalized.save;
  assert.equal(save.completedStageIds.includes(stageId), true);
  assert.equal(save.pendingResult, null);
  assert.equal(finalizeV100PendingResult(save, { result, now }).applied, false);
  checkpoint();
  assert.equal(flow.phase, number === 30 ? "ending" : "map");
  stages.push({ number, stageId, caps: save.caps, rewardCaps: save.lastResult.rewardCaps });
}

visitEvent("v100:event:ending");
visitEvent("v100:event:credits");
visitEvent("v100:event:epilogue");
checkpoint();
assert.equal(flow.destination, "postgame-map");
assert.equal(save.postGameAvailable, true);
assert.equal(save.completedStageIds.length, 30);
assert.equal(eventsVisited, 94);

const report = {
  status: "passed",
  scope: "developer-mode synthetic victories; all story events, save/reload checkpoints, stage unlocks and receipts; not normal-play battle acceptance",
  storySourceSha256: V100_STORY_SOURCE_SHA256,
  playerName,
  eventsVisited,
  nodesVisited,
  syntheticVictories: stages.length,
  finalDestination: flow.destination,
  completedStages: save.completedStageIds.length,
  postGameAvailable: save.postGameAvailable,
  finalCaps: save.caps,
  stages,
};
const output = resolve(process.env.V100_DEVMODE_REPORT ?? "outputs/completion/v100-devmode-full-campaign/report.json");
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ status: report.status, eventsVisited, nodesVisited, syntheticVictories: stages.length, finalDestination: flow.destination, output })}\n`);
