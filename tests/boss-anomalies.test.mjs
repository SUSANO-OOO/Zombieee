import assert from "node:assert/strict";
import test from "node:test";

import {
  BOSS_ANOMALY_KINDS,
  BOSS_ANOMALY_TUNING,
  advanceBossAnomalyAbility,
  beginBossAnomalyAbility,
  bossAnomalyAreaTargetIds,
  createBossAnomalyRuntime,
  gairenIncomingDamageMultiplier,
  isBossAnomalyKind,
  motherBroodSummonPlan,
  ooguchiChargeStep,
} from "../app/bossAnomalies.js";

const boss = (kind, overrides = {}) => ({
  id: `boss-${kind}`,
  side: "zombie",
  kind,
  hp: 1000,
  maxHp: 1000,
  x: 760,
  y: 282,
  lane: 1,
  combatReady: true,
  ...overrides,
});

const human = (id, x, y, lane = 1) => ({
  id,
  side: "human",
  hp: 100,
  x,
  y,
  lane,
  combatReady: true,
});

test("four anomaly runtimes are immutable, distinct, and reject unavailable bosses", () => {
  assert.deepEqual(BOSS_ANOMALY_KINDS, ["mother", "ooguchi", "gairen", "futago"]);
  assert.equal(new Set(BOSS_ANOMALY_KINDS.map((kind) => (
    BOSS_ANOMALY_TUNING[kind].cooldownSeconds
  ))).size, BOSS_ANOMALY_KINDS.length);
  for (const kind of BOSS_ANOMALY_KINDS) {
    const runtime = createBossAnomalyRuntime(kind);
    assert.equal(runtime.kind, kind);
    assert.equal(runtime.phase, "idle");
    assert.equal(Object.isFrozen(runtime), true);
    assert.equal(isBossAnomalyKind(kind), true);
  }
  assert.equal(isBossAnomalyKind("kurome"), false);
  assert.equal(beginBossAnomalyAbility({
    boss: boss("ooguchi", { combatReady: false }),
    candidates: [human("target", 420, 282)],
  }).ok, false);
});

test("warning target selection is deterministic and ability phases terminate", () => {
  const candidates = [
    human("far", 360, 310, 2),
    human("near-b", 650, 282),
    human("near-a", 650, 282),
  ];
  for (const kind of BOSS_ANOMALY_KINDS) {
    const started = beginBossAnomalyAbility({ boss: boss(kind), candidates });
    assert.equal(started.ok, true);
    assert.equal(started.runtime.phase, "warning");
    if (kind !== "mother") assert.equal(started.runtime.targetId, "near-a");

    const active = advanceBossAnomalyAbility(
      started.runtime,
      BOSS_ANOMALY_TUNING[kind].warningSeconds,
    );
    assert.equal(active.runtime.phase, "active");
    assert.deepEqual(active.events, ["activate"]);

    const recovery = advanceBossAnomalyAbility(
      active.runtime,
      BOSS_ANOMALY_TUNING[kind].activeSeconds,
    );
    assert.equal(recovery.runtime.phase, "recovery");
    assert.deepEqual(recovery.events, ["recover"]);

    const completed = advanceBossAnomalyAbility(
      recovery.runtime,
      BOSS_ANOMALY_TUNING[kind].recoverySeconds,
    );
    assert.equal(completed.runtime.phase, "idle");
    assert.deepEqual(completed.events, ["complete"]);
  }
});

test("Ooguchi charge, Gairen shell, and radial target rules preserve counterplay geometry", () => {
  const ooguchi = boss("ooguchi");
  const charge = ooguchiChargeStep({
    runtime: {
      ...createBossAnomalyRuntime("ooguchi"),
      phase: "active",
      targetId: "front",
      lane: 1,
    },
    boss: ooguchi,
    elapsedSeconds: .5,
    minimumX: 430,
  });
  assert.equal(charge.active, true);
  assert.equal(charge.boss.x, 605);
  assert.equal(charge.targetId, "front");
  assert.equal(ooguchiChargeStep({
    runtime: createBossAnomalyRuntime("ooguchi"),
    boss: ooguchi,
    elapsedSeconds: 1,
  }).active, false);

  const guarded = createBossAnomalyRuntime("gairen");
  assert.equal(gairenIncomingDamageMultiplier({
    runtime: guarded,
    attackerX: 650,
    bossX: 760,
  }), .3);
  assert.equal(gairenIncomingDamageMultiplier({
    runtime: guarded,
    attackerX: 780,
    bossX: 760,
  }), .58);
  assert.equal(gairenIncomingDamageMultiplier({
    runtime: { ...guarded, phase: "active", guarded: false },
    attackerX: 650,
    bossX: 760,
  }), 1.28);

  const candidates = [
    human("inside", 700, 282),
    human("edge", 760, 350, 2),
    human("outside", 500, 282),
    { ...human("dead", 750, 282), hp: 0 },
  ];
  assert.deepEqual(
    bossAnomalyAreaTargetIds({ kind: "mother", boss: boss("mother"), candidates }),
    ["inside", "edge"],
  );
  assert.deepEqual(
    bossAnomalyAreaTargetIds({ kind: "ooguchi", boss: ooguchi, candidates }),
    [],
  );
});

test("Mother brood cap is per owner, deterministic, and ignores ordinary enemies", () => {
  const mother = boss("mother", { id: 42 });
  const ownedBrood = (count) => Array.from({ length: count }, (_, index) => ({
    id: `owned-${index}`,
    side: "zombie",
    kind: BOSS_ANOMALY_TUNING.mother.summonKinds[index % 3],
    hp: 100,
    summonOwnerId: 42,
    summonSource: "mother-brood",
  }));
  const ordinaryEnemies = BOSS_ANOMALY_TUNING.mother.summonKinds.map((kind, index) => ({
    id: `ordinary-${index}`,
    side: "zombie",
    kind,
    hp: 100,
  }));

  const emptyPlan = motherBroodSummonPlan({
    boss: mother,
    candidates: ordinaryEnemies,
    attackSequence: 2,
  });
  assert.equal(emptyPlan.length, 3);
  assert.deepEqual(emptyPlan.map(({ kind }) => kind), ["spindle", "runner", "resonator"]);
  assert.equal(Object.isFrozen(emptyPlan), true);
  assert.deepEqual(
    motherBroodSummonPlan({
      boss: mother,
      candidates: ordinaryEnemies,
      attackSequence: 2,
    }),
    emptyPlan,
  );

  assert.equal(motherBroodSummonPlan({
    boss: mother,
    candidates: ownedBrood(8),
  }).length, 1);
  assert.deepEqual(motherBroodSummonPlan({
    boss: mother,
    candidates: ownedBrood(9),
  }), []);
  assert.equal(motherBroodSummonPlan({
    boss: mother,
    candidates: [
      ...ownedBrood(8),
      ...ordinaryEnemies,
      {
        ...ownedBrood(1)[0],
        id: "other-mother-brood",
        summonOwnerId: 99,
      },
    ],
  }).length, 1);
});
