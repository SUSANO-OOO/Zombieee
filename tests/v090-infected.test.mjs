import assert from "node:assert/strict";
import test from "node:test";

import {
  V090_INFECTED_DEFINITIONS,
  V090_INFECTED_KINDS,
  advanceV090InfectedAbility,
  anchorBloomReinforcement,
  beginV090InfectedAbility,
  cagewalkerFrontDamageMultiplier,
  createV090InfectedRuntime,
  isV090InfectedKind,
  pallMantaProjectileMultiplier,
  resonatorHowlTargets,
  selectV090InfectedTargets,
  spindleLandingPoint,
} from "../app/v090Infected.js";

const attacker = Object.freeze({
  id: "infected",
  kind: "resonator",
  side: "zombie",
  hp: 100,
  x: 500,
  y: 200,
});

const humans = Object.freeze([
  Object.freeze({ id: "front", side: "human", hp: 100, combatReady: true, x: 380, y: 200 }),
  Object.freeze({ id: "rear", side: "human", hp: 100, combatReady: true, x: 190, y: 210 }),
  Object.freeze({ id: "down", side: "human", hp: 100, combatReady: true, x: 400, y: 290 }),
]);

test("Version 0.9.0 infected registry has six stable, distinct non-boss identities", () => {
  assert.deepEqual(V090_INFECTED_KINDS, [
    "resonator",
    "cagewalker",
    "spindle",
    "choir-knot",
    "pall-manta",
    "anchor-bloom",
  ]);
  assert.equal(new Set(V090_INFECTED_KINDS).size, 6);
  assert.equal(new Set(Object.values(V090_INFECTED_DEFINITIONS).map(({ abilityId }) => abilityId)).size, 6);
  assert.ok(Object.values(V090_INFECTED_DEFINITIONS).every(({ compendiumAsset }) => (
    compendiumAsset.startsWith("/art/v090/enemies/")
  )));
  assert.equal(Object.isFrozen(V090_INFECTED_DEFINITIONS), true);
  assert.equal(isV090InfectedKind("walker"), false);
});

test("ability runtime advances through warning, active, recovery, and idle without mutating input", () => {
  const started = beginV090InfectedAbility({
    kind: "resonator",
    attacker,
    candidates: humans,
  });
  assert.equal(started.ok, true);
  assert.equal(started.runtime.phase, "warning");
  const definition = V090_INFECTED_DEFINITIONS.resonator;
  const beforeBoundary = advanceV090InfectedAbility(
    started.runtime,
    definition.warningSeconds - 0.001,
  );
  assert.equal(beforeBoundary.runtime.phase, "warning");
  assert.deepEqual(beforeBoundary.events, []);
  const activated = advanceV090InfectedAbility(beforeBoundary.runtime, 0.001);
  assert.equal(activated.runtime.phase, "active");
  assert.deepEqual(activated.events, ["activate"]);
  const finished = advanceV090InfectedAbility(
    activated.runtime,
    definition.activeSeconds + definition.recoverySeconds,
  );
  assert.equal(finished.runtime.phase, "idle");
  assert.deepEqual(finished.events, ["recover", "finish"]);
  assert.equal(started.runtime.phase, "warning");
});

test("target selection is deterministic and profile-specific", () => {
  assert.deepEqual(
    selectV090InfectedTargets({ kind: "resonator", attacker, candidates: [...humans].reverse() }),
    ["front"],
  );
  assert.deepEqual(
    selectV090InfectedTargets({ kind: "choir-knot", attacker, candidates: [...humans].reverse() }),
    ["front", "down"],
  );
  assert.deepEqual(
    selectV090InfectedTargets({ kind: "spindle", attacker, candidates: humans }),
    ["rear"],
  );
  const allies = [
    { id: "healthy", side: "zombie", hp: 90, maxHp: 100, x: 470, y: 200 },
    { id: "hurt", side: "zombie", hp: 20, maxHp: 100, x: 510, y: 200 },
    { id: "far", side: "zombie", hp: 1, maxHp: 100, x: 700, y: 200 },
  ];
  assert.deepEqual(
    selectV090InfectedTargets({ kind: "anchor-bloom", attacker, candidates: allies }),
    ["hurt", "healthy"],
  );
});

test("Resonator howl uses a forward widening cone with exact boundaries", () => {
  assert.deepEqual(resonatorHowlTargets({
    attacker,
    candidates: [
      { id: "edge", side: "human", hp: 1, x: 332, y: 200 + 34 + 168 * 0.22 },
      { id: "outside", side: "human", hp: 1, x: 331.999, y: 200 },
      { id: "behind", side: "human", hp: 1, x: 501, y: 200 },
    ],
  }), ["edge"]);
});

test("Cagewalker, Pall Manta, and Anchor Bloom mitigation apply only in their causal geometry", () => {
  assert.equal(cagewalkerFrontDamageMultiplier({
    phase: "active",
    attackerX: 100,
    targetX: 200,
  }), 0.3);
  assert.equal(cagewalkerFrontDamageMultiplier({
    phase: "active",
    attackerX: 201,
    targetX: 200,
  }), 1);
  const shooter = { x: 100, y: 200 };
  const manta = { x: 300, y: 200 };
  const covered = { x: 420, y: 272 };
  assert.equal(pallMantaProjectileMultiplier({
    phase: "active",
    shooter,
    target: covered,
    manta,
  }), 0.32);
  assert.equal(pallMantaProjectileMultiplier({
    phase: "recovery",
    shooter,
    target: covered,
    manta,
  }), 1);
  assert.deepEqual(anchorBloomReinforcement({
    phase: "active",
    anchor: { id: "a", x: 300, y: 200 },
    target: { id: "z", side: "zombie", x: 478, y: 200 },
  }), {
    active: true,
    incomingDamageMultiplier: 0.7,
    healingPerSecond: 7,
  });
});

test("Spindle lands behind the selected human and clamps to battle bounds", () => {
  assert.deepEqual(spindleLandingPoint({
    attacker,
    target: { x: 850, y: 222 },
    maximumX: 870,
  }), { x: 870, y: 222 });
  assert.equal(spindleLandingPoint({ attacker, target: null }), null);
  assert.deepEqual(createV090InfectedRuntime("unknown"), {
    kind: null,
    phase: "idle",
    remainingSeconds: 0,
    targetIds: [],
    resolved: false,
  });
});
