import test from "node:test";
import assert from "node:assert/strict";

import { CAMPAIGN_STAGE_IDS } from "../app/campaign.js";
import { stageResultFacts } from "../app/stageResultFacts.js";

const STAGE_1 = CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET;
const STAGE_4 = CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_GATE;
const STAGE_5 = CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_PLATFORM;
const STAGE_6 = CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_TUNNEL;

test("defeats and unknown stages never report completion facts", () => {
  assert.deepEqual(stageResultFacts({
    stageId: STAGE_6,
    won: false,
    firstClear: true,
  }), []);
  assert.deepEqual(stageResultFacts({
    stageId: "stage-unknown",
    won: true,
    firstClear: true,
  }), []);
});

test("stage 1 automatically rescues five survivors on first clear only", () => {
  assert.deepEqual(stageResultFacts({
    stageId: STAGE_1,
    won: true,
    firstClear: true,
  }), ["生存者5名を自動救助"]);
  assert.deepEqual(stageResultFacts({
    stageId: STAGE_1,
    won: true,
    firstClear: false,
  }), []);
});

test("stage 4 always reports relay destruction but never recounts its rescue", () => {
  assert.deepEqual(stageResultFacts({
    stageId: STAGE_4,
    won: true,
    firstClear: true,
  }), ["感染中継点を破壊", "生存者7名を自動救助"]);
  assert.deepEqual(stageResultFacts({
    stageId: STAGE_4,
    won: true,
    firstClear: false,
  }), ["感染中継点を破壊"]);
});

test("stage 5 reports normal platform control and base destruction", () => {
  const completedAssault = {
    completed: true,
    failed: false,
    enemyBaseDestroyed: true,
  };
  assert.deepEqual(stageResultFacts({
    stageId: STAGE_5,
    won: true,
    firstClear: true,
    missionRuntime: completedAssault,
  }), ["ホームを制圧し、感染拠点を破壊", "生存者5名を救助"]);
  assert.deepEqual(stageResultFacts({
    stageId: STAGE_5,
    won: true,
    firstClear: false,
    missionRuntime: completedAssault,
  }), ["ホームを制圧し、感染拠点を破壊"]);
});

test("stage 6 reports the completed sequence and joins Monkey on first clear only", () => {
  const completedSeal = {
    powerActivated: 3,
    gateEaterDefeated: true,
    gateEaterContained: true,
    researchContainerContained: true,
    sealed: true,
    escapeRemaining: 24,
    returnTargetIds: ["a", "b", "c"],
    returnedUnitIds: ["a", "b", "c"],
    returnedCount: 6,
    returnTargetCount: 6,
    completed: true,
    failed: false,
  };
  assert.deepEqual(stageResultFacts({
    stageId: STAGE_6,
    won: true,
    firstClear: false,
  }), [
    "電源を順番に起動（3/3）",
    "改札喰いを撃破し、研究容器を封鎖",
    "45秒の退路を全員で帰還",
  ]);
  assert.deepEqual(stageResultFacts({
    stageId: STAGE_6,
    won: true,
    firstClear: true,
    missionRuntime: completedSeal,
  }), [
    "電源を順番に起動（3/3）",
    "改札喰いを撃破し、研究容器を封鎖",
    "45秒の退路を全員で帰還",
    "モンキーが部隊に加入",
  ]);
  assert.deepEqual(stageResultFacts({
    stageId: STAGE_6,
    won: true,
    firstClear: false,
    missionRuntime: completedSeal,
  }), [
    "電源を順番に起動（3/3）",
    "改札喰いを撃破し、研究容器を封鎖",
    "45秒の退路を全員で帰還",
  ]);
});

test("runtime state suppresses facts that would contradict actual progress", () => {
  assert.deepEqual(stageResultFacts({
    stageId: STAGE_4,
    won: true,
    firstClear: true,
    missionRuntime: { completed: false, failed: false, relayDestroyed: false },
  }), []);
  assert.deepEqual(stageResultFacts({
    stageId: STAGE_5,
    won: true,
    firstClear: true,
    missionRuntime: { completed: true, failed: false, enemyBaseDestroyed: false },
  }), []);
  assert.deepEqual(stageResultFacts({
    stageId: STAGE_6,
    won: true,
    firstClear: true,
    missionRuntime: {
      powerActivated: 3,
      gateEaterContained: false,
      researchContainerContained: false,
      sealed: false,
      escapeRemaining: 45,
      returnedCount: 0,
      returnTargetCount: 6,
      completed: false,
      failed: false,
    },
  }), ["電源を順番に起動（3/3）"]);
});

test("stage 6 partial runtime never overstates containment or full-party return", () => {
  const powerFact = ["電源を順番に起動（3/3）"];
  const containmentFacts = [
    ...powerFact,
    "改札喰いを撃破し、研究容器を封鎖",
  ];

  assert.deepEqual(stageResultFacts({
    stageId: STAGE_6,
    won: true,
    firstClear: true,
    missionRuntime: {
      powerActivated: 3,
      gateEaterDefeated: true,
      gateEaterContained: true,
      sealed: true,
      completed: true,
      escapeRemaining: 0,
      returnedCount: 6,
      returnTargetCount: 6,
    },
  }), powerFact);
  assert.deepEqual(stageResultFacts({
    stageId: STAGE_6,
    won: true,
    firstClear: true,
    missionRuntime: {
      powerActivated: 3,
      gateEaterDefeated: true,
      gateEaterContained: true,
      researchContainerContained: true,
      sealed: false,
      completed: true,
      escapeRemaining: 0,
      returnedCount: 6,
      returnTargetCount: 6,
    },
  }), powerFact);
  assert.deepEqual(stageResultFacts({
    stageId: STAGE_6,
    won: true,
    firstClear: true,
    missionRuntime: {
      powerActivated: 3,
      gateEaterDefeated: true,
      gateEaterContained: true,
      researchContainerContained: true,
      sealed: true,
      completed: true,
      escapeRemaining: 0,
      returnedCount: 5,
      returnTargetCount: 6,
    },
  }), containmentFacts);
  assert.deepEqual(stageResultFacts({
    stageId: STAGE_6,
    won: true,
    firstClear: true,
    missionRuntime: {
      powerActivated: 3,
      gateEaterDefeated: true,
      gateEaterContained: true,
      researchContainerContained: true,
      sealed: true,
      completed: true,
      escapeRemaining: 0,
      returnedCount: 0,
      returnTargetCount: 0,
    },
  }), containmentFacts);
});

test("optional rescue counters cannot overstate first-clear rewards", () => {
  assert.deepEqual(stageResultFacts({
    stageId: STAGE_1,
    won: true,
    firstClear: true,
    missionRuntime: { completed: true, failed: false, rescuedCount: 4 },
  }), []);
  assert.deepEqual(stageResultFacts({
    stageId: STAGE_4,
    won: true,
    firstClear: true,
    missionRuntime: { completed: true, failed: false, relayDestroyed: true, rescueCount: 6 },
  }), ["感染中継点を破壊"]);
});

test("every returned facts array is frozen and calls are deterministic", () => {
  const input = {
    stageId: STAGE_6,
    won: true,
    firstClear: true,
    missionRuntime: {
      powerActivated: 3,
      gateEaterDefeated: true,
      gateEaterContained: true,
      researchContainerContained: true,
      sealed: true,
      escapeRemaining: 0,
      returnedCount: 6,
      returnTargetCount: 6,
      completed: true,
      failed: false,
    },
  };
  const first = stageResultFacts(input);
  const second = stageResultFacts(input);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(stageResultFacts()), true);
  assert.deepEqual(first, second);
  assert.throws(() => first.push("再計上"), TypeError);
});
