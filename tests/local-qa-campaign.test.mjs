import assert from "node:assert/strict";
import test from "node:test";

import { CAMPAIGN_STAGE_IDS } from "../app/campaign.js";
import {
  LOCAL_QA_GATE_EATER_STATE,
  LOCAL_QA_CAMPAIGN_SCREENS,
  LOCAL_QA_CAMPAIGN_STAGE_ALIASES,
  LOCAL_QA_MODES,
  LOCAL_QA_STATION_STATES,
  measureCommandEconomy,
  resolveLocalQaMode,
  resolveLocalQaSafeArea,
  resolveLocalQaScenario,
} from "../app/localQa.js";

const STAGE_1 = CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET;
const STAGE_2 = CAMPAIGN_STAGE_IDS.SAWARA_WARD_OFFICE;
const STAGE_3 = CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE;
const STAGE_4 = CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_GATE;
const STAGE_5 = CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_PLATFORM;
const STAGE_6 = CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_TUNNEL;

test("local battle QA modes remain host-gated and include lifecycle evidence", () => {
  assert.deepEqual(LOCAL_QA_MODES, ["endgame", "takuya-entrance", "ai-reacquire", "roles", "supplies", "airstrike", "crawler", "loadout", "dialogue", "stress", "lifecycle", "barks", "sprites"]);
  for (const mode of LOCAL_QA_MODES) {
    assert.equal(resolveLocalQaMode("localhost", `?qa=${mode}`), mode);
    assert.equal(resolveLocalQaMode("127.0.0.1", `?qa=${mode}`), mode);
  }
  assert.equal(resolveLocalQaMode("localhost", "?qa=flow&screen=map"), null);
  assert.equal(resolveLocalQaMode("localhost", "?qa=defense"), null);
  assert.equal(resolveLocalQaMode("localhost", "?qa=station&stage=4&state=start"), null);
  assert.equal(resolveLocalQaMode("example.com", "?qa=endgame"), null);
});

test("iPhone landscape safe-area simulation is exact and localhost-only", () => {
  assert.deepEqual(resolveLocalQaSafeArea("localhost", "?qa=flow&screen=title&safe=iphone-landscape"), { top: 0, right: 44, bottom: 21, left: 44 });
  assert.equal(resolveLocalQaSafeArea("127.0.0.1", "?safe=unknown"), null);
  assert.equal(resolveLocalQaSafeArea("example.com", "?safe=iphone-landscape"), null);
  assert.equal(resolveLocalQaSafeArea("localhost", "?safe=iphone-landscape&safe=iphone-landscape"), null);
});

test("flow QA accepts every allowlisted campaign screen on both local hosts", () => {
  assert.deepEqual(LOCAL_QA_CAMPAIGN_SCREENS, ["title", "intro", "map", "details", "personnel", "formation", "result"]);
  for (const hostname of ["localhost", "127.0.0.1"]) {
    for (const screen of LOCAL_QA_CAMPAIGN_SCREENS) {
      assert.deepEqual(resolveLocalQaScenario(hostname, `?qa=flow&screen=${screen}`), {
        mode: "flow",
        screen,
        stageId: STAGE_1,
        stars: 0,
      });
    }
  }
});

test("flow QA resolves short stage aliases through a closed allowlist", () => {
  assert.deepEqual(LOCAL_QA_CAMPAIGN_STAGE_ALIASES, {
    1: STAGE_1,
    2: STAGE_2,
    3: STAGE_3,
    4: STAGE_4,
    5: STAGE_5,
    6: STAGE_6,
  });
  for (const [alias, stageId] of [
    [1, STAGE_1],
    [2, STAGE_2],
    [3, STAGE_3],
    [4, STAGE_4],
    [5, STAGE_5],
    [6, STAGE_6],
  ]) {
    assert.equal(resolveLocalQaScenario("localhost", `?qa=flow&screen=details&stage=${alias}`).stageId, stageId);
  }
});

test("flow QA accepts each full stable campaign stage ID", () => {
  for (const stageId of [STAGE_1, STAGE_2, STAGE_3, STAGE_4, STAGE_5, STAGE_6]) {
    assert.deepEqual(resolveLocalQaScenario("localhost", `?qa=flow&screen=formation&stage=${stageId}&stars=2`), {
      mode: "flow",
      screen: "formation",
      stageId,
      stars: 2,
    });
  }
});

test("flow QA accepts only exact integer star values zero through three", () => {
  for (const stars of [0, 1, 2, 3]) {
    assert.equal(resolveLocalQaScenario("localhost", `?qa=flow&screen=result&stars=${stars}`).stars, stars);
  }
  for (const stars of ["-1", "4", "1.0", "03", "", "NaN", "2%20"]) {
    assert.equal(resolveLocalQaScenario("localhost", `?qa=flow&screen=result&stars=${stars}`), null);
  }
});

test("defense QA selects the fixed 180-second defense stage", () => {
  const expected = { mode: "defense", screen: "battle", stageId: STAGE_2, stars: 0 };
  assert.deepEqual(resolveLocalQaScenario("localhost", "?qa=defense"), expected);
  assert.deepEqual(resolveLocalQaScenario("localhost", "?qa=defense&stage=2"), expected);
  assert.deepEqual(resolveLocalQaScenario("127.0.0.1", `?qa=defense&stage=${STAGE_2}`), expected);
  assert.equal(resolveLocalQaScenario("localhost", "?qa=defense&stage=1"), null);
  assert.equal(resolveLocalQaScenario("localhost", "?qa=defense&stage=3"), null);
  assert.equal(resolveLocalQaScenario("localhost", "?qa=defense&screen=map"), null);
  assert.equal(resolveLocalQaScenario("localhost", "?qa=defense&stars=3"), null);
});

test("story QA opens every canonical event only on an exact local host", async () => {
  const { STORY_EVENT_IDS } = await import("../app/storyEvents.js");
  for (const eventId of STORY_EVENT_IDS) {
    assert.deepEqual(resolveLocalQaScenario("localhost", `?qa=story&event=${eventId}`), {
      mode: "story",
      screen: "event",
      stageId: STAGE_1,
      stars: 0,
      eventId,
    });
  }
  assert.equal(resolveLocalQaScenario("localhost", "?qa=story&event=missing"), null);
  assert.equal(resolveLocalQaScenario("example.com", `?qa=story&event=${STORY_EVENT_IDS[0]}`), null);
  assert.equal(resolveLocalQaScenario("localhost", `?qa=story&event=${STORY_EVENT_IDS[0]}&screen=event`), null);
});

test("station QA exposes only the three station stages and deterministic battle states", () => {
  assert.deepEqual(LOCAL_QA_STATION_STATES, ["start", "near-win", "near-loss"]);
  for (const hostname of ["localhost", "127.0.0.1"]) {
    for (const [stage, stageId] of [
      [4, STAGE_4],
      [5, STAGE_5],
      [6, STAGE_6],
    ]) {
      for (const state of LOCAL_QA_STATION_STATES) {
        assert.deepEqual(resolveLocalQaScenario(hostname, `?qa=station&stage=${stage}&state=${state}`), {
          mode: "station",
          screen: "battle",
          stageId,
          stars: 0,
          state,
        });
      }
    }
  }
});

test("the Gate Eater regression battle is available only for Stage 6 on localhost", () => {
  assert.equal(LOCAL_QA_GATE_EATER_STATE, "boss-regression");
  assert.deepEqual(resolveLocalQaScenario("localhost", "?qa=station&stage=6&state=boss-regression"), {
    mode: "station",
    screen: "battle",
    stageId: STAGE_6,
    stars: 0,
    state: "boss-regression",
  });
  assert.equal(resolveLocalQaScenario("localhost", "?qa=station&stage=5&state=boss-regression"), null);
  assert.equal(resolveLocalQaScenario("example.com", "?qa=station&stage=6&state=boss-regression"), null);
});

test("mission QA starts every Stage 1-6 battle through one localhost-only contract", () => {
  for (const hostname of ["localhost", "127.0.0.1"]) {
    for (const [stage, stageId] of [
      [1, STAGE_1],
      [2, STAGE_2],
      [3, STAGE_3],
      [4, STAGE_4],
      [5, STAGE_5],
      [6, STAGE_6],
    ]) {
      assert.deepEqual(resolveLocalQaScenario(hostname, `?qa=mission&stage=${stage}&state=start`), {
        mode: "mission",
        screen: "battle",
        stageId,
        stars: 0,
        state: "start",
      });
    }
  }
  for (const search of [
    "?qa=mission&stage=7&state=start",
    "?qa=mission&stage=1",
    "?qa=mission&stage=1&state=near-win",
    "?qa=mission&stage=1&state=start&screen=battle",
    "?qa=mission&stage=1&state=start&stars=0",
  ]) {
    assert.equal(resolveLocalQaScenario("localhost", search), null, search);
  }
});

test("station QA rejects non-station stages, unknown states, and ambiguous parameters", () => {
  for (const search of [
    "?qa=station&stage=1&state=start",
    "?qa=station&stage=2&state=near-win",
    "?qa=station&stage=3&state=near-loss",
    `?qa=station&stage=${STAGE_4}&state=start`,
    "?qa=station&stage=4",
    "?qa=station&state=start",
    "?qa=station&stage=4&state=win",
    "?qa=station&stage=4&state=START",
    "?qa=station&stage=4&state=",
    "?qa=station&qa=station&stage=4&state=start",
    "?qa=station&stage=4&stage=5&state=start",
    "?qa=station&stage=4&state=start&state=near-win",
    "?qa=station&stage=4&state=start&screen=battle",
    "?qa=station&stage=4&state=start&stars=0",
    "?qa=station&stage=4&state=start&event=prologue-opening",
  ]) {
    assert.equal(resolveLocalQaScenario("localhost", search), null, search);
  }
});

test("campaign QA is unavailable away from the exact local host allowlist", () => {
  for (const hostname of ["example.com", "localhost.example", "0.0.0.0", "::1", "LOCALHOST", ""]) {
    assert.equal(resolveLocalQaScenario(hostname, "?qa=flow&screen=map&stage=1&stars=3"), null);
    assert.equal(resolveLocalQaScenario(hostname, "?qa=defense"), null);
    assert.equal(resolveLocalQaScenario(hostname, "?qa=station&stage=4&state=start"), null);
    assert.equal(resolveLocalQaScenario(hostname, "?qa=mission&stage=1&state=start"), null);
  }
});

test("invalid, ambiguous, and unknown campaign QA parameters are rejected", () => {
  for (const search of [
    "",
    "?qa=flow",
    "?qa=flow&screen=battle",
    "?qa=flow&screen=MAP",
    "?qa=flow&screen=map&stage=7",
    "?qa=flow&screen=map&stage=../../save",
    "?qa=flow&screen=map&stage=",
    "?qa=unknown&screen=map",
    "?qa=flow&qa=defense&screen=map",
    "?qa=flow&screen=map&screen=result",
    "?qa=flow&screen=map&stage=1&stage=2",
    "?qa=flow&screen=map&stars=1&stars=2",
    "?qa=flow&screen=map&event=prologue-opening",
    "?qa=flow&screen=map&state=start",
    "?qa=defense&state=start",
    "?qa=story&event=prologue-opening&state=start",
    "?qa=story&event=prologue-opening&event=prologue-ending",
  ]) {
    assert.equal(resolveLocalQaScenario("localhost", search), null, search);
  }
});

test("command economy measurement preserves the opening and regeneration while measuring the 150 cap", () => {
  const immediate = measureCommandEconomy({
    durationSeconds: 0,
    deployments: [{ id: "opening-heavy", at: 0, cost: 70 }],
  });
  assert.equal(immediate.initialCommand, 70);
  assert.equal(immediate.regenPerSecond, 3.5);
  assert.equal(immediate.commandMax, 150);
  assert.equal(immediate.firstDeploymentSeconds, 0);
  assert.equal(immediate.successfulDeployments, 1);
  assert.equal(immediate.finalCommand, 0);

  const noSpend = measureCommandEconomy({ durationSeconds: 60 });
  assert.equal(noSpend.finalCommand, 150);
  assert.ok(Math.abs(noSpend.cappedSeconds - (60 - 80 / 3.5)) < 1e-9);
  assert.ok(Math.abs(noSpend.overflowCommand - 130) < 1e-9);
  assert.ok(Math.abs(noSpend.overflowRate - 130 / 210) < 1e-9);
});

test("command economy measurement proves planned medium-pair and low-triple bursts fit under the cap", () => {
  const measured = measureCommandEconomy({
    durationSeconds: 60,
    deployments: [
      { id: "medium-1", at: 23, cost: 70 },
      { id: "medium-2", at: 23, cost: 65 },
      { id: "low-1", at: 60, cost: 25 },
      { id: "low-2", at: 60, cost: 45 },
      { id: "low-3", at: 60, cost: 50 },
    ],
  });

  assert.equal(measured.successfulDeployments, 5);
  assert.equal(measured.failedDeployments, 0);
  assert.equal(measured.spentCommand, 255);
  assert.equal(measured.firstDeploymentSeconds, 23);
  assert.ok(Math.abs(measured.finalCommand - 24.5) < 1e-9);
  assert.ok(Math.abs(measured.cappedSeconds - (23 - 80 / 3.5)) < 1e-9);
  assert.ok(Math.abs(measured.overflowCommand - .5) < 1e-9);
  assert.deepEqual(measured.attempts.map(({ id, deployed }) => [id, deployed]), [
    ["medium-1", true],
    ["medium-2", true],
    ["low-1", true],
    ["low-2", true],
    ["low-3", true],
  ]);
});
