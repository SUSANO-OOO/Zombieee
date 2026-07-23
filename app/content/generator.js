import { deepFreeze } from "./freeze.js";
import { CONTENT_SCHEMA_VERSION } from "./schema.js";

function sortedClone(value) {
  if (Array.isArray(value)) return value.map(sortedClone);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortedClone(value[key])]));
}

export function stableSerialize(value) {
  return `${JSON.stringify(sortedClone(value), null, 2)}\n`;
}

function assertFixtureId(id, label) {
  if (typeof id !== "string" || !id.startsWith("fixture-")) {
    throw new RangeError(`${label} id must start with fixture-`);
  }
}

function emptyCollections() {
  return {
    upgrades: [],
    events: [],
    sideEvents: [],
    challenges: [],
    timedEvents: [],
    assets: [],
  };
}

export function generateContentFixture(spec) {
  if (!spec || spec.fixture !== true) throw new RangeError("Generator accepts fixture input only");
  assertFixtureId(spec.unit?.id, "Unit");
  assertFixtureId(spec.enemy?.id, "Enemy");
  assertFixtureId(spec.stage?.id, "Stage");

  const unit = {
    id: spec.unit.id,
    displayName: spec.unit.displayName,
    combatKind: spec.unit.id,
    aiProfile: spec.unit.aiProfile ?? "frontline",
    aliases: spec.unit.aliases ?? [],
    combat: {
      id: spec.unit.id,
      hp: spec.unit.hp,
      damage: spec.unit.damage,
      range: spec.unit.range,
      attackEvery: spec.unit.attackEvery,
      cost: spec.unit.cost,
    },
    unlock: { type: "fixture" },
    assetRefs: [],
  };
  const enemy = {
    id: spec.enemy.id,
    displayName: spec.enemy.displayName,
    aliases: spec.enemy.aliases ?? [],
    aiProfile: spec.enemy.aiProfile ?? "nearest",
    hp: spec.enemy.hp,
    hpPerWave: spec.enemy.hpPerWave ?? 0,
    speed: spec.enemy.speed,
    damage: spec.enemy.damage,
    range: spec.enemy.range,
    attackEvery: spec.enemy.attackEvery,
    bodyRadius: spec.enemy.bodyRadius,
    laneSpeed: spec.enemy.laneSpeed,
    spawnClass: spec.enemy.spawnClass ?? "normal",
  };
  const stageId = spec.stage.id;
  const missionId = `mission:${stageId}`;
  const mapId = `map:${stageId}`;
  const rewardId = `reward:${stageId}`;
  const waveId = `${stageId}-wave-01`;
  const stage = {
    id: stageId,
    displayName: spec.stage.displayName,
    stageNumber: spec.stage.stageNumber,
    missionId,
    mapId,
    rewardId,
    enemyKinds: [enemy.id],
    prerequisiteStageIds: [],
    waveIds: [waveId],
    nextUnlocks: {
      stageIds: [],
      unitIds: [],
      discoveredUnitIds: [],
      recruitableUnitIds: [],
    },
  };
  const registry = {
    contentSchemaVersion: CONTENT_SCHEMA_VERSION,
    units: [unit],
    enemies: [enemy],
    stages: [stage],
    missions: [{
      id: missionId,
      stageId,
      displayName: spec.stage.objective,
      missionType: spec.stage.missionType,
      objective: spec.stage.objective,
      objectiveConfig: spec.stage.objectiveConfig ?? { target: "fixture-target" },
    }],
    waves: [{
      id: waveId,
      stageId,
      waveNumber: 1,
      atSeconds: spec.stage.firstWaveAtSeconds ?? 5,
      enemyKinds: [enemy.id],
      spawns: [{ enemyId: enemy.id, count: spec.stage.enemyCount ?? 1, laneHints: [] }],
    }],
    maps: [{
      id: mapId,
      stageId,
      displayName: spec.stage.displayName,
      theme: { id: `theme:${stageId}`, tags: ["fixture"] },
      visualSignature: { fixture: true },
      assetRefs: [],
    }],
    difficulty: [{
      id: "difficulty:fixture",
      displayName: "Fixture",
      enemyHpMultiplier: 1,
      enemyDamageMultiplier: 1,
      rewardMultiplier: 1,
    }],
    rewards: [{
      id: rewardId,
      stageId,
      baseReward: spec.stage.baseReward ?? 1,
      firstTimeStarRewards: { 1: 1, 2: 1, 3: 1 },
    }],
    acquisition: [{
      id: `acquisition:${unit.id}`,
      unitId: unit.id,
      type: "fixture",
      unlock: { type: "fixture" },
    }],
    ...emptyCollections(),
    saves: [{
      id: "save:fixture-v1",
      schemaVersion: 1,
      contentSchemaVersion: CONTENT_SCHEMA_VERSION,
    }],
  };
  return deepFreeze(registry);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function generateContentFixtureFiles(spec) {
  const registry = generateContentFixture(spec);
  const unit = registry.units[0];
  const enemy = registry.enemies[0];
  const stage = registry.stages[0];
  const gallery = `<!doctype html>
<html lang="ja">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Content fixture gallery</title></head>
<body data-fixture="true">
  <main>
    <h1>Content fixture gallery</h1>
    <article data-kind="unit"><h2>${escapeHtml(unit.displayName)}</h2><code>${escapeHtml(unit.id)}</code></article>
    <article data-kind="enemy"><h2>${escapeHtml(enemy.displayName)}</h2><code>${escapeHtml(enemy.id)}</code></article>
    <article data-kind="stage"><h2>${escapeHtml(stage.displayName)}</h2><code>${escapeHtml(stage.id)}</code></article>
  </main>
</body>
</html>
`;
  return deepFreeze({
    "fixture-registry.json": stableSerialize(registry),
    "unit.json": stableSerialize(unit),
    "enemy.json": stableSerialize(enemy),
    "stage.json": stableSerialize(stage),
    "qa-gallery.html": gallery,
  });
}

function padded(index) {
  return String(index + 1).padStart(3, "0");
}

export function createSyntheticContentRegistry({
  unitCount = 100,
  enemyCount = 100,
  stageCount = 100,
} = {}) {
  const units = Array.from({ length: unitCount }, (_, index) => {
    const id = `synthetic-unit-${padded(index)}`;
    return {
      id,
      displayName: `Synthetic Unit ${padded(index)}`,
      combatKind: id,
      aiProfile: "frontline",
      aliases: [],
      combat: { id, hp: 100, damage: 10, range: 50, attackEvery: 1, cost: 10 },
      unlock: { type: "synthetic" },
      assetRefs: [],
    };
  });
  const enemies = Array.from({ length: enemyCount }, (_, index) => ({
    id: `synthetic-enemy-${padded(index)}`,
    displayName: `Synthetic Enemy ${padded(index)}`,
    aliases: [],
    aiProfile: "nearest",
    hp: 100,
    hpPerWave: 1,
    speed: 10,
    damage: 10,
    range: 25,
    attackEvery: 1,
    bodyRadius: 10,
    laneSpeed: 10,
    spawnClass: "normal",
  }));
  const stages = [];
  const missions = [];
  const waves = [];
  const maps = [];
  const rewards = [];
  for (let index = 0; index < stageCount; index += 1) {
    const suffix = padded(index);
    const stageId = `synthetic-stage-${suffix}`;
    const enemyId = enemies[index % enemies.length]?.id;
    const missionId = `mission:${stageId}`;
    const waveId = `${stageId}-wave-01`;
    const mapId = `map:${stageId}`;
    const rewardId = `reward:${stageId}`;
    stages.push({
      id: stageId,
      displayName: `Synthetic Stage ${suffix}`,
      stageNumber: index + 1,
      missionId,
      mapId,
      rewardId,
      enemyKinds: [enemyId],
      prerequisiteStageIds: index > 0 ? [`synthetic-stage-${padded(index - 1)}`] : [],
      waveIds: [waveId],
      nextUnlocks: { stageIds: [], unitIds: [], discoveredUnitIds: [], recruitableUnitIds: [] },
    });
    missions.push({ id: missionId, stageId, displayName: `Mission ${suffix}`, missionType: "synthetic", objective: "Synthetic objective", objectiveConfig: { target: "synthetic" } });
    waves.push({ id: waveId, stageId, waveNumber: 1, atSeconds: 5, enemyKinds: [enemyId], spawns: [{ enemyId, count: 1, laneHints: [] }] });
    maps.push({ id: mapId, stageId, displayName: `Map ${suffix}`, theme: { id: `theme:${stageId}` }, visualSignature: { synthetic: true }, assetRefs: [] });
    rewards.push({ id: rewardId, stageId, baseReward: 1, firstTimeStarRewards: { 1: 1, 2: 1, 3: 1 } });
  }
  return deepFreeze({
    contentSchemaVersion: CONTENT_SCHEMA_VERSION,
    units,
    enemies,
    stages,
    missions,
    waves,
    maps,
    difficulty: [{ id: "difficulty:synthetic", displayName: "Synthetic", enemyHpMultiplier: 1, enemyDamageMultiplier: 1, rewardMultiplier: 1 }],
    rewards,
    acquisition: units.map((unit) => ({ id: `acquisition:${unit.id}`, unitId: unit.id, type: "synthetic", unlock: { type: "synthetic" } })),
    ...emptyCollections(),
    saves: [{ id: "save:synthetic-v1", schemaVersion: 1, contentSchemaVersion: CONTENT_SCHEMA_VERSION }],
  });
}
