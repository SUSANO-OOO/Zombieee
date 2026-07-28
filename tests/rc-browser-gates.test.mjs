import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { installInfectedAbilityPhaseObserver } from "../scripts/infected-ability-phase-observer.mjs";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const survivalGate = await readFile(
  new URL("../scripts/survival-wave-progression-browser-smoke.mjs", import.meta.url),
  "utf8",
);
const infectedGate = await readFile(
  new URL("../scripts/ai-mission-browser-smoke.mjs", import.meta.url),
  "utf8",
);
const infectedWrapper = await readFile(
  new URL("../scripts/v090-infected-browser-smoke.mjs", import.meta.url),
  "utf8",
);
const infectedObserver = await readFile(
  new URL("../scripts/infected-ability-phase-observer.mjs", import.meta.url),
  "utf8",
);

test("RC package scripts expose actual Survival wave and infected ability gates", () => {
  assert.equal(
    packageJson.scripts["qa:survival-waves"],
    "node scripts/run-browser-qa-with-server.mjs scripts/survival-wave-progression-browser-smoke.mjs",
  );
  assert.equal(
    packageJson.scripts["qa:v090-infected-runtime"],
    "node scripts/run-browser-qa-with-server.mjs scripts/v090-infected-browser-smoke.mjs",
  );
});

test("Survival RC gate progresses wave 1-5 without the completion QA hook", () => {
  assert.doesNotMatch(survivalGate, /prepareSurvivalUpgradeProof/);
  assert.match(survivalGate, /run\.lastCompletedWave >= 5/);
  assert.match(survivalGate, /final\.survivalRun\.stats\.bossKills >= 1/);
  assert.match(survivalGate, /JSON\.stringify\(\[1, 2, 3, 4, 5, 6\]\)/);
  assert.match(survivalGate, /entry\.lastCompletedWave === entry\.wave - 1/);
  assert.match(survivalGate, /\.unit-card:not\(:disabled\)/);
});

test("infected RC gate observes ordered same-fighter activations on Stage 17-20", () => {
  assert.match(infectedWrapper, /AI_MISSION_QA_STAGES \?\?= "17,18,19,20"/);
  assert.match(infectedWrapper, /AI_MISSION_QA_INFECTED_ABILITIES = "1"/);
  assert.match(infectedObserver, /requestAnimationFrame\(sample\)/);
  assert.match(infectedObserver, /completedActivations\.push\(/);
  assert.match(infectedObserver, /fighterEntry\.phase === "warning"/);
  assert.match(infectedGate, /warningAt < activeAt/);
});

test("infected observer rejects a cancelled warning before a later active phase", () => {
  const frames = [];
  let time = 1;
  let phase = "warning";
  globalThis.window = {
    __ASHFALL_BATTLE_QA__: {
      getSnapshot: () => ({
        time,
        fighters: [{ id: 7, kind: "resonator", stationAbility: { phase } }],
      }),
    },
    requestAnimationFrame: (callback) => frames.push(callback),
  };
  try {
    installInfectedAbilityPhaseObserver(["resonator"]);
    frames.shift()();
    time = 2;
    phase = "idle";
    frames.shift()();
    time = 3;
    phase = "active";
    frames.shift()();
    const observed = window.__ASHFALL_INFECTED_PHASE_OBSERVER__.observed.resonator;
    assert.deepEqual(observed.completedActivations, []);

    time = 4;
    phase = "warning";
    frames.shift()();
    time = 5;
    phase = "active";
    frames.shift()();
    assert.deepEqual(observed.completedActivations, [{
      fighterId: "7",
      warningAt: 4,
      activeAt: 5,
    }]);
  } finally {
    delete globalThis.window;
  }
});

test("RC browser gates reject empty engine lists and unbounded timeouts", () => {
  assert.match(survivalGate, /engines\.length === 0/);
  assert.match(survivalGate, /Number\.isFinite\(parsedTimeout\)/);
  assert.match(infectedGate, /engines\.length === 0/);
  assert.match(infectedGate, /Number\.isFinite\(parsedTimeout\)/);
});
