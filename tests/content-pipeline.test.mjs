import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  CAMPAIGN_SAVE_SCHEMA_VERSION,
} from "../app/campaign.js";
import {
  runBalanceAudit,
  runCapsEconomyAudit,
  runContentPipelineAudits,
  runSaveMigrationAudit,
} from "../app/content/audits.js";
import {
  ENEMY_CONTENT,
  enemyStatsForWave,
} from "../app/content/enemyCatalog.js";
import {
  EVENT_FOUNDATION_FIXTURE_REGISTRY,
} from "../app/eventFoundation.js";
import {
  createSyntheticContentRegistry,
  generateContentFixture,
  generateContentFixtureFiles,
} from "../app/content/generator.js";
import { createContentLoader } from "../app/content/loader.js";
import {
  migrateContentCollection,
  migrateContentRecord,
} from "../app/content/migration.js";
import {
  CONTENT_REGISTRY,
  CONTENT_REGISTRY_FACTS,
  contentLoader,
} from "../app/content/registry.js";
import { UNIT_CONTENT } from "../app/content/unitCatalog.js";
import { validateContentRegistry } from "../app/content/validator.js";
import {
  UNIT_CARDS,
} from "../app/gameRules.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "..");
const mediaPattern = /\.(?:avif|gif|jpe?g|mp3|ogg|png|svg|webp|wav)$/iu;

async function collectPhysicalAssetPaths(directory, prefix = "") {
  const output = new Set();
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relativePath = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) {
      for (const child of await collectPhysicalAssetPaths(path.join(directory, entry.name), relativePath)) output.add(child);
    } else if (entry.isFile() && mediaPattern.test(entry.name)) {
      output.add(relativePath);
    }
  }
  return output;
}

async function fixtureInput() {
  return JSON.parse(await readFile(
    path.join(testDirectory, "fixtures", "content-pipeline", "drill-input.json"),
    "utf8",
  ));
}

test("production content registry validates every schema and reference", () => {
  const result = validateContentRegistry(CONTENT_REGISTRY);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.counts.units, 11);
  assert.equal(result.counts.enemies, 12);
  assert.equal(result.counts.stages, 6);
  assert.equal(result.counts.waves, 49);
  assert.deepEqual(CONTENT_REGISTRY_FACTS.collectionCounts, result.counts);
});

test("all registered assets exist and unregistered public media are reported as candidates", async () => {
  const physicalAssetPaths = await collectPhysicalAssetPaths(path.join(repositoryRoot, "public"));
  const result = validateContentRegistry(CONTENT_REGISTRY, { physicalAssetPaths });
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.deepEqual(result.assetAudit.missingPhysicalAssets, []);
  assert.equal(Array.isArray(result.assetAudit.unusedPhysicalAssetCandidates), true);
});

test("runtime compatibility exports are the canonical unit and enemy records", () => {
  assert.equal(UNIT_CARDS, UNIT_CONTENT);
  for (const enemy of ENEMY_CONTENT) {
    const wave = 7;
    assert.deepEqual(enemyStatsForWave(enemy.id, wave), {
      hp: Math.round(enemy.hp + enemy.hpPerWave * wave),
      speed: enemy.speed,
      damage: enemy.damage,
      range: enemy.range,
      attackEvery: enemy.attackEvery,
    });
  }
});

test("loader resolves stable IDs, display aliases, and rejects unknown collections", () => {
  assert.equal(contentLoader.resolveId("units", "パイセン"), "unit-paisen");
  assert.equal(contentLoader.get("units", "パイセン")?.displayName, "パイセン");
  assert.equal(contentLoader.has("units", "unknown"), false);
  assert.throws(() => contentLoader.require("units", "unknown"), /Unknown units content/u);
  assert.throws(() => contentLoader.list("not-a-collection"), /Unknown content collection/u);
});

test("validator detects duplicate IDs, alias collisions, broken references, and missing assets", () => {
  const broken = structuredClone(CONTENT_REGISTRY);
  broken.units.push({ ...broken.units[0] });
  broken.enemies[1].aliases = [broken.enemies[0].id];
  broken.stages[0].missionId = "mission:missing";
  broken.units[0].assetRefs = ["/missing-fixture.png"];
  const result = validateContentRegistry(broken, { physicalAssetPaths: new Set() });
  const codes = new Set(result.errors.map(({ code }) => code));
  for (const code of ["duplicate-id", "duplicate-alias", "broken-reference", "missing-asset-record", "missing-physical-asset"]) {
    assert.equal(codes.has(code), true, code);
  }
});

test("validator reports malformed registries instead of throwing", () => {
  const missingCollection = structuredClone(CONTENT_REGISTRY);
  delete missingCollection.assets;
  missingCollection.units.push(null);
  const result = validateContentRegistry(missingCollection, { physicalAssetPaths: new Set() });
  assert.equal(result.ok, false);
  assert.equal(result.errors.some(({ code, collection }) => code === "missing-collection" && collection === "assets"), true);
  assert.equal(result.errors.some(({ code, collection }) => code === "invalid-record" && collection === "units"), true);
});

test("validator fails closed for non-array collections and fields", () => {
  const broken = structuredClone(CONTENT_REGISTRY);
  broken.units = {};
  broken.enemies[0].aliases = {};
  broken.stages[0].enemyKinds = {};
  broken.stages[0].waveIds = "not-an-array";
  broken.waves[0].spawns = {};
  broken.maps[0].assetRefs = {};
  const result = validateContentRegistry(broken, { physicalAssetPaths: new Set() });
  assert.equal(result.ok, false);
  const codes = new Set(result.errors.map(({ code }) => code));
  assert.equal(codes.has("missing-collection"), true);
  assert.equal(codes.has("missing-array"), true);
});

test("validator diagnoses invalid nested spawn records without throwing", () => {
  const broken = structuredClone(CONTENT_REGISTRY);
  broken.waves[0].spawns = [null, "invalid"];
  const result = validateContentRegistry(broken);
  assert.equal(result.ok, false);
  assert.equal(result.errors.filter(({ code }) => code === "invalid-spawn").length, 2);
});

test("event foundation records fail closed when stage or difficulty references are broken", () => {
  const broken = structuredClone(CONTENT_REGISTRY);
  broken.sideEvents = [structuredClone(EVENT_FOUNDATION_FIXTURE_REGISTRY.find(
    ({ eventKind }) => eventKind === "side-mission",
  ))];
  broken.timedEvents = [structuredClone(EVENT_FOUNDATION_FIXTURE_REGISTRY.find(
    ({ eventKind }) => eventKind === "timed-event",
  ))];
  broken.sideEvents[0].mission.stageId = "stage:attacker-controlled";
  broken.timedEvents[0].mission.difficultyId = "difficulty:attacker-controlled";
  const result = validateContentRegistry(broken);
  assert.equal(result.ok, false);
  assert.equal(result.errors.some(({ code, collection }) => (
    code === "broken-stage-reference" && collection === "sideEvents"
  )), true);
  assert.equal(result.errors.some(({ code, collection }) => (
    code === "broken-difficulty-reference" && collection === "timedEvents"
  )), true);
});

test("event family schema rejects missing registration fields and family mismatches", () => {
  const broken = structuredClone(CONTENT_REGISTRY);
  const sideEvent = structuredClone(EVENT_FOUNDATION_FIXTURE_REGISTRY.find(
    ({ eventKind }) => eventKind === "side-mission",
  ));
  delete sideEvent.mission;
  delete sideEvent.schedule;
  delete sideEvent.eventKind;
  broken.sideEvents = [sideEvent];
  broken.events.push({
    id: "battle-event:missing-kind",
    displayName: "Missing kind",
    summary: "Foundation-shaped event missing its discriminator",
    mission: {
      stageId: CONTENT_REGISTRY.stages[0].id,
      difficultyId: CONTENT_REGISTRY.difficulty[0].id,
    },
    schedule: { type: "permanent" },
    rewardPolicy: "none",
    aliases: [],
  });
  broken.challenges = [structuredClone(EVENT_FOUNDATION_FIXTURE_REGISTRY.find(
    ({ eventKind }) => eventKind === "timed-event",
  ))];
  const result = validateContentRegistry(broken);
  assert.equal(result.ok, false);
  const codes = new Set(result.errors.map(({ code }) => code));
  assert.equal(codes.has("missing-string"), true);
  assert.equal(codes.has("missing-object"), true);
  assert.equal(codes.has("event-family-mismatch"), true);
});

test("content migration is stable, idempotent, and preserves legacy aliases", () => {
  const legacy = { kind: "legacy-unit", name: "Legacy Unit", aliases: [" Old ", "Old"] };
  const migrated = migrateContentRecord(legacy, { collection: "units", fromVersion: 0 });
  assert.equal(migrated.id, "legacy-unit");
  assert.equal(migrated.displayName, "Legacy Unit");
  assert.deepEqual(migrated.aliases, ["Old"]);
  assert.deepEqual(
    migrateContentRecord(migrated, { collection: "units", fromVersion: 1 }),
    migrated,
  );
  assert.deepEqual(
    migrateContentCollection([legacy], { collection: "units" }),
    [migrated],
  );
});

test("100 units, 100 enemies, and 100 stages pass schema and reference validation", () => {
  const registry = createSyntheticContentRegistry({
    unitCount: 100,
    enemyCount: 100,
    stageCount: 100,
  });
  const result = validateContentRegistry(registry);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.deepEqual(result.warnings, []);
  assert.equal(result.counts.units, 100);
  assert.equal(result.counts.enemies, 100);
  assert.equal(result.counts.stages, 100);
});

test("fixture generator is deterministic, valid, gallery-ready, and isolated from production", async () => {
  const fixture = await fixtureInput();
  const firstRegistry = generateContentFixture(fixture);
  const secondRegistry = generateContentFixture(fixture);
  assert.deepEqual(firstRegistry, secondRegistry);
  assert.equal(validateContentRegistry(firstRegistry).ok, true);
  const firstFiles = generateContentFixtureFiles(fixture);
  const secondFiles = generateContentFixtureFiles(fixture);
  assert.deepEqual(firstFiles, secondFiles);
  assert.match(firstFiles["qa-gallery.html"], /data-kind="unit"/u);
  assert.match(firstFiles["qa-gallery.html"], /data-kind="enemy"/u);
  assert.match(firstFiles["qa-gallery.html"], /data-kind="stage"/u);
  for (const collection of ["units", "enemies", "stages"]) {
    assert.equal(CONTENT_REGISTRY[collection].some(({ id }) => id.startsWith("fixture-")), false);
  }
  assert.throws(
    () => generateContentFixture({ ...fixture, unit: { ...fixture.unit, id: "production-unit" } }),
    /fixture-/u,
  );
});

test("loader works for generated registries without target-specific runtime code", async () => {
  const registry = generateContentFixture(await fixtureInput());
  const loader = createContentLoader(registry);
  assert.equal(loader.require("units", "fixture-sentinel").id, "fixture-unit-sentinel");
  assert.equal(loader.require("enemies", "fixture-enemy-probe").displayName, "Fixture Probe");
});

test("automated balance, caps economy, and save migration audits all pass", () => {
  const balance = runBalanceAudit();
  const capsEconomy = runCapsEconomyAudit();
  const saveMigration = runSaveMigrationAudit();
  assert.equal(balance.ok, true, JSON.stringify(balance));
  assert.equal(capsEconomy.ok, true, JSON.stringify(capsEconomy));
  assert.equal(capsEconomy.steps.every(({ upgradeApplied, capsAfterUpgrade }) => upgradeApplied && capsAfterUpgrade >= 0), true);
  assert.equal(saveMigration.ok, true, JSON.stringify(saveMigration));
  assert.equal(saveMigration.results.every(({ schemaVersion }) => schemaVersion === CAMPAIGN_SAVE_SCHEMA_VERSION), true);
  assert.equal(runContentPipelineAudits().ok, true);
});
