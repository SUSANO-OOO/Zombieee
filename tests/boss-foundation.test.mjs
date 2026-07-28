import assert from "node:assert/strict";
import test from "node:test";
import {
  BOSS_DEFINITIONS,
  BOSS_FOUNDATION_SCHEMA_VERSION,
  bossCampaignEntry,
  bossDefinitionForEnemyKind,
  bossDefinitionForId,
  bossHudSnapshot,
  bossPhaseForHp,
  bossResultRecord,
  bossTelegraphSnapshot,
  enforceBossBodyBarrier,
  isBossEnemyKind,
} from "../app/bossFoundation.js";
import {
  CAMPAIGN_STAGE_BY_ID,
  CAMPAIGN_STAGE_IDS,
} from "../app/campaign.js";
import { enemyContentFor } from "../app/content/enemyCatalog.js";
import { STATION_ENEMY_TUNING } from "../app/stationEnemyMechanics.js";

const EXISTING_BOSS_KINDS = ["takuya", "gate-eater"];
const NEW_BOSS_KINDS = ["mother", "ooguchi", "gairen", "futago"];
const ALL_BOSS_KINDS = [...EXISTING_BOSS_KINDS, "kurome", ...NEW_BOSS_KINDS];

test("existing bosses own one immutable shared contract with stable result and compendium IDs", () => {
  assert.equal(BOSS_FOUNDATION_SCHEMA_VERSION, 1);
  assert.deepEqual(BOSS_DEFINITIONS.map(({ enemyKind }) => enemyKind), ALL_BOSS_KINDS);
  assert.equal(Object.isFrozen(BOSS_DEFINITIONS), true);
  for (const kind of EXISTING_BOSS_KINDS) {
    const definition = bossDefinitionForEnemyKind(kind);
    assert.equal(bossDefinitionForId(definition.id), definition);
    assert.equal(bossDefinitionForEnemyKind(definition.enemyKind), definition);
    assert.equal(isBossEnemyKind(definition.enemyKind), true);
    assert.match(definition.id, /^boss-/u);
    assert.match(definition.resultId, /^boss-result-/u);
    assert.match(definition.compendiumId, /^boss-compendium-/u);
    assert.equal(definition.entrance.fullBodyRequired, true);
    assert.ok(definition.attackTelegraph.warningSeconds >= .8);
    assert.ok(definition.attackTelegraph.counterplay.length > 0);
    assert.ok(definition.display.compactBodyHeight >= 110);
    assert.ok(definition.display.compactBodyHeight <= 135);
    assert.equal(
      definition.display.hitboxRadius,
      enemyContentFor(definition.enemyKind).bodyRadius,
    );
    assert.equal(definition.combat.attackRange, enemyContentFor(definition.enemyKind).range);
    assert.ok(definition.reward.equipmentId.length > 0);
  }
  assert.equal(isBossEnemyKind("crusher"), false);
  assert.equal(bossDefinitionForEnemyKind("crusher"), null);
  assert.notEqual(
    bossDefinitionForEnemyKind("takuya").entrance.cueId,
    bossDefinitionForEnemyKind("gate-eater").entrance.cueId,
  );
  assert.equal(
    bossDefinitionForEnemyKind("gate-eater").attackTelegraph.warningSeconds,
    STATION_ENEMY_TUNING.ticketGateEater.windupSeconds,
  );
});

test("anomaly bosses keep distinct silhouettes, mechanics, and counterplay contracts", () => {
  assert.deepEqual(
    NEW_BOSS_KINDS.map((kind) => bossDefinitionForEnemyKind(kind).attackTelegraph.kind),
    ["brood-radial", "lane-rectangle", "shell-sweep", "cross-strike"],
  );
  assert.equal(new Set(NEW_BOSS_KINDS.map((kind) => (
    bossDefinitionForEnemyKind(kind).combat.formChange
  ))).size, NEW_BOSS_KINDS.length);
  for (const kind of NEW_BOSS_KINDS) {
    const definition = bossDefinitionForEnemyKind(kind);
    const enemy = enemyContentFor(kind);
    assert.equal(definition.workingName, false);
    assert.equal(definition.prototypeStatus, "producer-approved");
    assert.equal(enemy.prototypeStatus, "producer-approved");
    assert.equal(definition.entrance.fullBodyRequired, true);
    assert.equal(definition.display.sizeClass, "giant-boss");
    assert.ok(definition.display.bodyBounds.width >= 140);
    assert.ok(definition.display.compactBodyHeight >= 130);
    assert.equal(definition.display.hitboxRadius, enemy.bodyRadius);
    assert.equal(definition.combat.attackRange, enemy.range);
    assert.doesNotMatch(definition.compendium.title, /呼称仮/u);
    assert.ok(definition.attackTelegraph.counterplay.length >= 12);
    assert.equal(definition.compendium.assetPath, `/art/v090/bosses/${kind}-compendium-r1.webp`);
    assert.equal(definition.entrance.cueId, `boss-${kind}-entrance`);
  }
  const mother = bossDefinitionForEnemyKind("mother");
  assert.equal(mother.compendium.title, "マザー");
  assert.equal(new Set(NEW_BOSS_KINDS.map((kind) => (
    bossDefinitionForEnemyKind(kind).entrance.cueId
  ))).size, NEW_BOSS_KINDS.length);
});

test("Kurome is producer-approved and has exactly one canonical Stage 20 campaign consumer", () => {
  const definition = bossDefinitionForEnemyKind("kurome");
  assert.equal(definition.id, "boss-kurome-prototype");
  assert.equal(definition.displayName, "クロメ");
  assert.equal(definition.workingName, false);
  assert.equal(definition.prototypeStatus, "producer-approved");
  assert.equal(definition.attackTelegraph.kind, "tracking-ray");
  assert.equal(definition.attackTelegraph.warningSeconds, 1.25);
  assert.equal(definition.attackTelegraph.trackingSeconds, .82);
  assert.equal(definition.display.compactBodyHeight, 146);
  assert.equal(definition.display.standardBodyHeight, 133);
  assert.equal(definition.reward.equipmentId, "boss-resonance-gland");
  assert.equal(enemyContentFor("kurome").prototypeStatus, "producer-approved");
  const consumers = Object.values(CAMPAIGN_STAGE_BY_ID).filter((stage) => (
      stage.boss?.enemyKind === "kurome"
      || stage.waves?.some((wave) => wave.units?.some((unit) => (
        (Array.isArray(unit) ? unit[0] : unit) === "kurome"
      )))
  ));
  assert.deepEqual(consumers.map(({ id }) => id), [CAMPAIGN_STAGE_IDS.ESTUARY_FLOODGATE_SEAL]);
  assert.equal(consumers[0].boss.bossId, definition.id);
  assert.equal(consumers[0].boss.encounterId, "boss-kurome-floodgate");
});

test("campaign encounters reference canonical boss identity while replay encounters stay distinct", () => {
  const takuya = CAMPAIGN_STAGE_BY_ID[CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE].boss;
  const station = CAMPAIGN_STAGE_BY_ID[CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_TUNNEL].boss;
  const central = CAMPAIGN_STAGE_BY_ID[CAMPAIGN_STAGE_IDS.T_PLAN_CENTRAL_SEAL].boss;
  const floodgate = CAMPAIGN_STAGE_BY_ID[CAMPAIGN_STAGE_IDS.ESTUARY_FLOODGATE_SEAL].boss;
  assert.equal(takuya.id, "boss-takuya");
  assert.equal(takuya.bossId, "boss-takuya");
  assert.equal(takuya.encounterId, "boss-takuya");
  assert.equal(station.id, "boss-gate-eater");
  assert.equal(station.resultId, "boss-result-gate-eater");
  assert.equal(central.id, "boss-gate-eater");
  assert.equal(floodgate.id, "boss-kurome-prototype");
  assert.equal(floodgate.encounterId, "boss-kurome-floodgate");
  assert.equal(central.bossId, "boss-gate-eater");
  assert.equal(central.encounterId, "boss-gate-eater-central");
  assert.equal(central.displayName, "改札喰い・再活性体");
  assert.throws(() => bossCampaignEntry("unknown"), /Unknown boss enemy kind/u);
});

test("shared boss phases preserve exact boundary behavior", () => {
  for (const kind of EXISTING_BOSS_KINDS) {
    assert.deepEqual(bossPhaseForHp(100, 100, kind), { phase: 1, label: "第1段階" });
    assert.deepEqual(bossPhaseForHp(75.01, 100, kind), { phase: 1, label: "第1段階" });
    assert.deepEqual(bossPhaseForHp(75, 100, kind), { phase: 2, label: "第2段階" });
    assert.deepEqual(bossPhaseForHp(25.01, 100, kind), { phase: 2, label: "第2段階" });
    assert.deepEqual(bossPhaseForHp(25, 100, kind), { phase: 3, label: "最終段階" });
    assert.deepEqual(bossPhaseForHp(0, 100, kind), { phase: 3, label: "最終段階" });
  }
});

test("boss HUD is dedicated, phased, and hidden until full-body combat-ready", () => {
  for (const kind of EXISTING_BOSS_KINDS) {
    const base = {
      id: `${kind}-fixture`,
      side: "zombie",
      kind,
      hp: 900,
      maxHp: 1200,
      combatReady: true,
      contained: false,
    };
    const hud = bossHudSnapshot(base);
    assert.equal(hud.bossId, bossDefinitionForEnemyKind(kind).id);
    assert.equal(hud.displayName, bossDefinitionForEnemyKind(kind).displayName);
    assert.equal(hud.phase.phase, 2);
    assert.equal(hud.hpRatio, .75);
    assert.equal(Object.isFrozen(hud), true);
    assert.equal(bossHudSnapshot({ ...base, combatReady: false }), null);
    assert.equal(bossHudSnapshot({ ...base, gateEntering: true }), null);
    assert.equal(bossHudSnapshot({ ...base, contained: true }), null);
    assert.equal(bossHudSnapshot({ ...base, hp: 0 }), null);
  }
});

test("TAKUYA and Gate Eater telegraphs share readiness gates and retain specialized counterplay", () => {
  const takuya = bossTelegraphSnapshot({
    side: "zombie",
    kind: "takuya",
    hp: 500,
    maxHp: 1200,
    combatReady: true,
    contained: false,
    abilityWindup: .4,
  });
  assert.equal(takuya.kind, "ground-ellipse");
  assert.equal(takuya.radius, 145);
  assert.equal(takuya.remainingSeconds, .4);
  assert.match(takuya.counterplay, /範囲外/u);

  const gateEater = bossTelegraphSnapshot({
    side: "zombie",
    kind: "gate-eater",
    hp: 1000,
    maxHp: 1800,
    combatReady: true,
    contained: false,
    stationAbility: { phase: "windup", targetX: 240, remainingSeconds: .62 },
  });
  assert.equal(gateEater.kind, "lane-rectangle");
  assert.equal(gateEater.targetX, 240);
  assert.equal(gateEater.laneHalfHeight, 31);
  assert.match(gateEater.counterplay, /側面/u);

  assert.equal(bossTelegraphSnapshot({
    side: "zombie",
    kind: "takuya",
    hp: 100,
    maxHp: 100,
    combatReady: false,
    abilityWindup: .8,
  }), null);
});

test("Kurome telegraph locks a screen-space ray with final-phase pressure", () => {
  const telegraph = bossTelegraphSnapshot({
    side: "zombie",
    kind: "kurome",
    hp: 620,
    maxHp: 2100,
    x: 760,
    y: 270,
    combatReady: true,
    contained: false,
    stationAbility: {
      phase: "locked",
      remainingSeconds: .24,
      targetX: 314,
      targetY: 272,
    },
  });
  assert.equal(telegraph.kind, "tracking-ray");
  assert.equal(telegraph.locked, true);
  assert.equal(telegraph.targetX, 314);
  assert.equal(telegraph.targetY, 272);
  assert.equal(telegraph.beamHalfWidth, 23);
  assert.match(telegraph.counterplay, /離脱/u);
});

test("review-gated anomaly bosses expose warning-only spatial telegraphs", () => {
  for (const kind of NEW_BOSS_KINDS) {
    const definition = bossDefinitionForEnemyKind(kind);
    const telegraph = bossTelegraphSnapshot({
      side: "zombie",
      kind,
      hp: 1200,
      maxHp: enemyContentFor(kind).hp,
      x: 770,
      y: 282,
      combatReady: true,
      contained: false,
      stationAbility: {
        phase: "warning",
        remainingSeconds: .6,
        targetX: 430,
        targetY: 306,
      },
    });
    assert.equal(telegraph.kind, definition.attackTelegraph.kind);
    assert.equal(telegraph.targetX, 430);
    assert.equal(telegraph.targetY, 306);
    assert.equal(telegraph.remainingSeconds, .6);
    assert.equal(
      bossTelegraphSnapshot({
        side: "zombie",
        kind,
        hp: 1200,
        maxHp: enemyContentFor(kind).hp,
        combatReady: true,
        stationAbility: { phase: "active", remainingSeconds: .6 },
      }),
      null,
    );
  }
});

test("boss body barrier prevents ally pass-through without blocking another route", () => {
  const boss = {
    id: "boss",
    side: "zombie",
    kind: "gate-eater",
    hp: 1000,
    combatReady: true,
    contained: false,
    x: 500,
    y: 200,
    bodyRadius: 28,
  };
  const blocked = enforceBossBodyBarrier({
    mover: {
      id: "ally",
      side: "human",
      hp: 100,
      combatReady: true,
      x: 480,
      y: 200,
      bodyRadius: 12,
    },
    boss,
    padding: 2,
  });
  assert.equal(blocked.blocked, true);
  assert.equal(blocked.x, 458);
  const highSpeedBlocked = enforceBossBodyBarrier({
    mover: {
      id: "fast-ally",
      side: "human",
      hp: 100,
      combatReady: true,
      x: 530,
      y: 200,
      bodyRadius: 12,
    },
    boss,
    padding: 2,
    previousX: 450,
  });
  assert.equal(highSpeedBlocked.blocked, true);
  assert.equal(highSpeedBlocked.x, 458);
  const clearRoute = enforceBossBodyBarrier({
    mover: {
      id: "ally",
      side: "human",
      hp: 100,
      combatReady: true,
      x: 490,
      y: 260,
      bodyRadius: 12,
    },
    boss,
    padding: 2,
  });
  assert.equal(clearRoute.blocked, false);
  assert.equal(clearRoute.x, 490);
  assert.equal(enforceBossBodyBarrier({
    mover: { side: "human", hp: 100, combatReady: true, x: 490, y: 200, bodyRadius: 12 },
    boss: { ...boss, combatReady: false },
  }).blocked, false);
});

test("boss result records connect defeat, reward, and compendium without stage-specific IDs", () => {
  for (const kind of EXISTING_BOSS_KINDS) {
    const definition = bossDefinitionForEnemyKind(kind);
    const record = bossResultRecord({
      kind,
      hp: 0,
      maxHp: enemyContentFor(kind).hp,
    });
    assert.deepEqual(record.reward, definition.reward);
    assert.equal(record.bossId, definition.id);
    assert.equal(record.resultId, definition.resultId);
    assert.equal(record.compendiumId, definition.compendiumId);
    assert.equal(record.defeated, true);
    assert.equal(record.phase, 3);
  }
  assert.equal(bossResultRecord({ kind: "walker", hp: 0, maxHp: 10 }), null);
});
