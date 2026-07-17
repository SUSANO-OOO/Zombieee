import assert from "node:assert/strict";
import test from "node:test";

import { CAMPAIGN_STAGE_IDS } from "../app/campaign.js";
import {
  LOCAL_QA_CAMPAIGN_SCREENS,
  LOCAL_QA_CAMPAIGN_STAGE_ALIASES,
  LOCAL_QA_MODES,
  measureCommandEconomy,
  resolveLocalQaMode,
  resolveLocalQaSafeArea,
  resolveLocalQaScenario,
} from "../app/localQa.js";

const STAGE_1 = CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET;
const STAGE_2 = CAMPAIGN_STAGE_IDS.SAWARA_WARD_OFFICE;
const STAGE_3 = CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE;

test("local battle QA modes remain host-gated and include lifecycle evidence", () => {
  assert.deepEqual(LOCAL_QA_MODES, ["endgame", "ai-reacquire", "roles", "supplies", "airstrike", "crawler", "loadout", "dialogue", "stress", "lifecycle", "barks", "sprites"]);
  for (const mode of LOCAL_QA_MODES) {
    assert.equal(resolveLocalQaMode("localhost", `?qa=${mode}`), mode);
    assert.equal(resolveLocalQaMode("127.0.0.1", `?qa=${mode}`), mode);
  }
  assert.equal(resolveLocalQaMode("localhost", "?qa=flow&screen=map"), null);
  assert.equal(resolveLocalQaMode("localhost", "?qa=defense"), null);
  assert.equal(resolveLocalQaMode("example.com", "?qa=endgame"), null);
});

test("iPhone landscape safe-area simulation is exact and localhost-only", () => {
  assert.deepEqual(resolveLocalQaSafeArea("localhost", "?qa=flow&screen=title&safe=iphone-landscape"), { top: 0, right: 44, bottom: 21, left: 44 });
  assert.equal(resolveLocalQaSafeArea("127.0.0.1", "?safe=unknown"), null);
  assert.equal(resolveLocalQaSafeArea("example.com", "?safe=iphone-landscape"), null);
  assert.equal(resolveLocalQaSafeArea("localhost", "?safe=iphone-landscape&safe=iphone-landscape"), null);
});

test("flow QA accepts every allowlisted campaign screen on both local hosts", () => {
  assert.deepEqual(LOCAL_QA_CAMPAIGN_SCREENS, ["title", "intro", "map", "details", "formation", "result"]);
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
  });
  assert.equal(resolveLocalQaScenario("localhost", "?qa=flow&screen=details&stage=1").stageId, STAGE_1);
  assert.equal(resolveLocalQaScenario("localhost", "?qa=flow&screen=details&stage=2").stageId, STAGE_2);
  assert.equal(resolveLocalQaScenario("localhost", "?qa=flow&screen=details&stage=3").stageId, STAGE_3);
});

test("flow QA accepts each full stable campaign stage ID", () => {
  for (const stageId of [STAGE_1, STAGE_2, STAGE_3]) {
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

test("campaign QA is unavailable away from the exact local host allowlist", () => {
  for (const hostname of ["example.com", "localhost.example", "0.0.0.0", "::1", "LOCALHOST", ""]) {
    assert.equal(resolveLocalQaScenario(hostname, "?qa=flow&screen=map&stage=1&stars=3"), null);
    assert.equal(resolveLocalQaScenario(hostname, "?qa=defense"), null);
  }
});

test("invalid, ambiguous, and unknown campaign QA parameters are rejected", () => {
  for (const search of [
    "",
    "?qa=flow",
    "?qa=flow&screen=battle",
    "?qa=flow&screen=MAP",
    "?qa=flow&screen=map&stage=4",
    "?qa=flow&screen=map&stage=../../save",
    "?qa=flow&screen=map&stage=",
    "?qa=unknown&screen=map",
    "?qa=flow&qa=defense&screen=map",
    "?qa=flow&screen=map&screen=result",
    "?qa=flow&screen=map&stage=1&stage=2",
    "?qa=flow&screen=map&stars=1&stars=2",
    "?qa=flow&screen=map&event=prologue-opening",
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
