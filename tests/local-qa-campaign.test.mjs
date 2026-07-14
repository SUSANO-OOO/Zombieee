import assert from "node:assert/strict";
import test from "node:test";

import { CAMPAIGN_STAGE_IDS } from "../app/campaign.js";
import {
  LOCAL_QA_CAMPAIGN_SCREENS,
  LOCAL_QA_CAMPAIGN_STAGE_ALIASES,
  LOCAL_QA_MODES,
  resolveLocalQaMode,
  resolveLocalQaSafeArea,
  resolveLocalQaScenario,
} from "../app/localQa.js";

const STAGE_1 = CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET;
const STAGE_2 = CAMPAIGN_STAGE_IDS.SAWARA_WARD_OFFICE;
const STAGE_3 = CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE;

test("local battle QA modes remain host-gated and include lifecycle evidence", () => {
  assert.deepEqual(LOCAL_QA_MODES, ["endgame", "roles", "supplies", "airstrike", "crawler", "loadout", "dialogue", "stress", "lifecycle"]);
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
  ]) {
    assert.equal(resolveLocalQaScenario("localhost", search), null, search);
  }
});
