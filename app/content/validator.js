import {
  CONTENT_COLLECTIONS,
  CONTENT_SCHEMAS,
  CONTENT_SCHEMA_VERSION,
  STABLE_CONTENT_ID_PATTERN,
} from "./schema.js";
import { deepFreeze } from "./freeze.js";

function issue(code, collection, id, message) {
  return Object.freeze({ code, collection, id: id ?? null, message });
}

function normalizeAlias(value) {
  return typeof value === "string"
    ? value.trim().toLocaleLowerCase("ja-JP").replace(/[\s\u3000]+/gu, "")
    : "";
}

function hasString(record, field) {
  return typeof record[field] === "string" && record[field].trim().length > 0;
}

function hasNumber(record, field) {
  return Number.isFinite(record[field]);
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function validateRecordShape(collection, record, errors) {
  const schema = CONTENT_SCHEMAS[collection];
  for (const field of schema.requiredStrings ?? []) {
    if (!hasString(record, field)) errors.push(issue("missing-string", collection, record?.id, `Missing string field: ${field}`));
  }
  for (const field of schema.requiredNumbers ?? []) {
    if (!hasNumber(record, field)) errors.push(issue("missing-number", collection, record?.id, `Missing numeric field: ${field}`));
  }
  for (const field of schema.requiredArrays ?? []) {
    if (!Array.isArray(record[field])) errors.push(issue("missing-array", collection, record?.id, `Missing array field: ${field}`));
  }
  for (const field of schema.requiredObjects ?? []) {
    if (!record[field] || typeof record[field] !== "object" || Array.isArray(record[field])) {
      errors.push(issue("missing-object", collection, record?.id, `Missing object field: ${field}`));
    }
  }
}

function buildIds(registry) {
  return Object.fromEntries(CONTENT_COLLECTIONS.map((collection) => (
    [collection, new Set(safeArray(registry[collection])
      .filter((record) => record && typeof record === "object" && !Array.isArray(record))
      .map(({ id }) => id))]
  )));
}

function validRecords(registry, collection) {
  return safeArray(registry[collection])
    .filter((record) => record && typeof record === "object" && !Array.isArray(record));
}

function validateReferences(registry, ids, errors, warnings) {
  const eventIds = ids.events;
  const assetPaths = new Set(validRecords(registry, "assets").map(({ path }) => path));
  const referenced = {
    missions: new Set(),
    waves: new Set(),
    maps: new Set(),
    rewards: new Set(),
    enemies: new Set(),
    assets: new Set(),
  };

  for (const unit of validRecords(registry, "units")) {
    if (!unit.combat) {
      errors.push(issue("missing-unit-combat", "units", unit.id, `Missing combat profile: ${unit.combatKind}`));
    }
    if (unit.combat?.id !== unit.combatKind) {
      errors.push(issue("unit-combat-mismatch", "units", unit.id, `Combat profile mismatch: ${unit.combatKind}`));
    }
    for (const path of safeArray(unit.assetRefs)) {
      referenced.assets.add(path);
      if (!assetPaths.has(path)) errors.push(issue("missing-asset-record", "units", unit.id, `Missing asset record: ${path}`));
    }
  }

  for (const stage of validRecords(registry, "stages")) {
    for (const [collection, reference] of [
      ["missions", stage.missionId],
      ["maps", stage.mapId],
      ["rewards", stage.rewardId],
    ]) {
      referenced[collection].add(reference);
      if (!ids[collection].has(reference)) errors.push(issue("broken-reference", "stages", stage.id, `Missing ${collection} reference: ${reference}`));
    }
    for (const stageId of safeArray(stage.prerequisiteStageIds)) {
      if (!ids.stages.has(stageId)) errors.push(issue("broken-stage-reference", "stages", stage.id, `Missing prerequisite stage: ${stageId}`));
    }
    for (const stageId of safeArray(stage.nextUnlocks?.stageIds)) {
      if (!ids.stages.has(stageId)) errors.push(issue("broken-stage-reference", "stages", stage.id, `Missing unlocked stage: ${stageId}`));
    }
    for (const unitId of [
      ...safeArray(stage.nextUnlocks?.unitIds),
      ...safeArray(stage.nextUnlocks?.discoveredUnitIds),
      ...safeArray(stage.nextUnlocks?.recruitableUnitIds),
    ]) {
      if (!ids.units.has(unitId)) errors.push(issue("broken-unit-reference", "stages", stage.id, `Missing unlocked unit: ${unitId}`));
    }
    for (const enemyId of safeArray(stage.enemyKinds)) {
      referenced.enemies.add(enemyId);
      if (!ids.enemies.has(enemyId)) errors.push(issue("broken-enemy-reference", "stages", stage.id, `Missing enemy: ${enemyId}`));
    }
    for (const waveId of safeArray(stage.waveIds)) {
      referenced.waves.add(waveId);
      if (!ids.waves.has(waveId)) errors.push(issue("broken-wave-reference", "stages", stage.id, `Missing wave: ${waveId}`));
    }
    for (const eventId of [stage.preBattleEventId, stage.postBattleEventId].filter(Boolean)) {
      if (!eventIds.has(eventId)) errors.push(issue("broken-event-reference", "stages", stage.id, `Missing event: ${eventId}`));
    }
  }

  for (const wave of validRecords(registry, "waves")) {
    if (!ids.stages.has(wave.stageId)) errors.push(issue("broken-stage-reference", "waves", wave.id, `Missing stage: ${wave.stageId}`));
    for (const enemyId of safeArray(wave.enemyKinds)) {
      referenced.enemies.add(enemyId);
      if (!ids.enemies.has(enemyId)) errors.push(issue("broken-enemy-reference", "waves", wave.id, `Missing enemy: ${enemyId}`));
    }
    for (const spawn of safeArray(wave.spawns)) {
      if (!spawn || typeof spawn !== "object" || Array.isArray(spawn)) {
        errors.push(issue("invalid-spawn", "waves", wave.id, "Spawn must be an object"));
        continue;
      }
      if (!ids.enemies.has(spawn.enemyId)) errors.push(issue("broken-enemy-reference", "waves", wave.id, `Missing spawn enemy: ${spawn.enemyId}`));
      if (!Number.isInteger(spawn.count) || spawn.count < 1) errors.push(issue("invalid-spawn-count", "waves", wave.id, `Invalid spawn count for ${spawn.enemyId}`));
    }
  }

  for (const mission of validRecords(registry, "missions")) {
    if (!ids.stages.has(mission.stageId)) errors.push(issue("broken-stage-reference", "missions", mission.id, `Missing stage: ${mission.stageId}`));
  }
  for (const map of validRecords(registry, "maps")) {
    if (!ids.stages.has(map.stageId)) errors.push(issue("broken-stage-reference", "maps", map.id, `Missing stage: ${map.stageId}`));
    for (const path of safeArray(map.assetRefs)) {
      referenced.assets.add(path);
      if (!assetPaths.has(path)) errors.push(issue("missing-asset-record", "maps", map.id, `Missing asset record: ${path}`));
    }
  }
  for (const reward of validRecords(registry, "rewards")) {
    if (!ids.stages.has(reward.stageId)) errors.push(issue("broken-stage-reference", "rewards", reward.id, `Missing stage: ${reward.stageId}`));
  }
  for (const acquisition of validRecords(registry, "acquisition")) {
    if (!ids.units.has(acquisition.unitId)) errors.push(issue("broken-unit-reference", "acquisition", acquisition.id, `Missing unit: ${acquisition.unitId}`));
    const stageId = acquisition.unlock?.stageId;
    if (stageId && !ids.stages.has(stageId)) errors.push(issue("broken-stage-reference", "acquisition", acquisition.id, `Missing stage: ${stageId}`));
  }
  for (const upgrade of validRecords(registry, "upgrades")) {
    if (!ids.units.has(upgrade.unitId)) errors.push(issue("broken-unit-reference", "upgrades", upgrade.id, `Missing unit: ${upgrade.unitId}`));
  }

  for (const collection of ["missions", "waves", "maps", "rewards", "enemies"]) {
    for (const id of ids[collection]) {
      if (collection === "enemies" && validRecords(registry, "enemies").find((enemy) => enemy.id === id)?.runtimeGenerated) continue;
      if (!referenced[collection].has(id)) warnings.push(issue("unused-content-candidate", collection, id, `Unreferenced ${collection} record`));
    }
  }

  return referenced;
}

export function validateContentRegistry(registry, { physicalAssetPaths = null } = {}) {
  const errors = [];
  const warnings = [];

  if (!registry || typeof registry !== "object") {
    return deepFreeze({ ok: false, errors: [issue("invalid-registry", null, null, "Registry must be an object")], warnings: [] });
  }
  if (registry.contentSchemaVersion !== CONTENT_SCHEMA_VERSION) {
    errors.push(issue("schema-version", null, null, `Expected content schema ${CONTENT_SCHEMA_VERSION}`));
  }

  for (const collection of CONTENT_COLLECTIONS) {
    const records = registry[collection];
    if (!Array.isArray(records)) {
      errors.push(issue("missing-collection", collection, null, "Collection must be an array"));
      continue;
    }
    const seenIds = new Set();
    const aliasOwners = new Map();
    for (const record of records) {
      if (!record || typeof record !== "object" || Array.isArray(record)) {
        errors.push(issue("invalid-record", collection, null, "Record must be an object"));
        continue;
      }
      validateRecordShape(collection, record, errors);
      if (!hasString(record, "id")) continue;
      if (!STABLE_CONTENT_ID_PATTERN.test(record.id)) errors.push(issue("invalid-id", collection, record.id, "Stable ID has an invalid format"));
      if (seenIds.has(record.id)) errors.push(issue("duplicate-id", collection, record.id, "Duplicate stable ID"));
      seenIds.add(record.id);
      for (const alias of [record.id, ...safeArray(record.aliases)]) {
        const key = normalizeAlias(alias);
        if (!key) continue;
        const owner = aliasOwners.get(key);
        if (owner && owner !== record.id) errors.push(issue("duplicate-alias", collection, record.id, `Alias collides with ${owner}: ${alias}`));
        aliasOwners.set(key, record.id);
      }
    }
  }

  const ids = buildIds(registry);
  validateReferences(registry, ids, errors, warnings);

  const missingPhysicalAssets = [];
  const unusedPhysicalAssetCandidates = [];
  if (physicalAssetPaths) {
    const registeredRelativePaths = new Set(validRecords(registry, "assets")
      .filter(({ path }) => typeof path === "string")
      .map(({ path }) => path.replace(/^\/+/u, "")));
    for (const asset of validRecords(registry, "assets")) {
      if (typeof asset.path !== "string") continue;
      const relativePath = asset.path.replace(/^\/+/u, "");
      if (!physicalAssetPaths.has(relativePath)) {
        missingPhysicalAssets.push(relativePath);
        errors.push(issue("missing-physical-asset", "assets", asset.id, `Missing public asset: ${asset.path}`));
      }
    }
    for (const relativePath of physicalAssetPaths) {
      if (!registeredRelativePaths.has(relativePath)) unusedPhysicalAssetCandidates.push(relativePath);
    }
  }

  return deepFreeze({
    ok: errors.length === 0,
    errors,
    warnings,
    counts: Object.fromEntries(CONTENT_COLLECTIONS.map((collection) => [collection, registry[collection]?.length ?? 0])),
    assetAudit: {
      missingPhysicalAssets: missingPhysicalAssets.sort((left, right) => left.localeCompare(right, "en")),
      unusedPhysicalAssetCandidates: unusedPhysicalAssetCandidates.sort((left, right) => left.localeCompare(right, "en")),
    },
  });
}
