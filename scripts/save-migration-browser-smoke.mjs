import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  CAMPAIGN_SAVE_SCHEMA_VERSION,
  computeCampaignSaveIntegrity,
} from "../app/campaign.js";

const baseUrl = new URL(process.env.SAVE_MIGRATION_QA_BASE_URL
  ?? process.env.COMBAT_PRESENTATION_QA_BASE_URL
  ?? "http://127.0.0.1:4177/");
if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname)) {
  throw new Error(`Save migration QA is local-only; refusing ${baseUrl}`);
}

const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href)
  : await import("playwright");
const engineName = process.env.SAVE_MIGRATION_QA_ENGINE ?? "chromium";
const browserType = playwright[engineName];
if (!browserType) throw new Error(`Unknown SAVE_MIGRATION_QA_ENGINE: ${engineName}`);

const SAVE_KEY = "nishijin-campaign-v1";
const PRE_MIGRATION_KEY = `${SAVE_KEY}::pre-migration`;
const LAST_KNOWN_GOOD_KEY = `${SAVE_KEY}::last-known-good`;
const DATABASE_NAME = "nishijin-campaign-backup";
const STORE_NAME = "saves";
const CURRENT_SCHEMA_VERSION = CAMPAIGN_SAVE_SCHEMA_VERSION;
const RELEASE_071_SHA = "8e9a7717f6b24719271c3892b3873a66a2241c9c";
const timeout = Math.max(10_000, Number(process.env.SAVE_MIGRATION_QA_TIMEOUT_MS) || 30_000);
const evidenceDir = path.resolve(
  process.env.SAVE_MIGRATION_QA_EVIDENCE_DIR ?? "outputs/save-migration-browser-smoke",
);
const [viewportWidth, viewportHeight] = (process.env.SAVE_MIGRATION_QA_VIEWPORT ?? "844x390")
  .split("x")
  .map(Number);
if (!Number.isFinite(viewportWidth) || !Number.isFinite(viewportHeight)) {
  throw new Error("SAVE_MIGRATION_QA_VIEWPORT must use WIDTHxHEIGHT");
}

const stageIds = [
  "stage-nishijin-shopping-street",
  "stage-sawara-ward-office",
  "stage-nishijin-defense-line-takuya",
  "stage-nishijin-station-gate",
  "stage-nishijin-station-platform",
  "stage-nishijin-station-tunnel-seal",
];
const unitIds = [
  "unit-paisen",
  "unit-hachi",
  "unit-mizuchi",
  "unit-nao",
  "unit-tatara",
  "unit-crazy-king",
  "unit-kumaverson",
  "unit-babayaga",
  "unit-raider",
  "unit-gantetsu",
  "unit-monkey",
];
const release071Fixture = {
  schemaVersion: 5,
  revision: 41,
  updatedAt: "2026-07-22T12:34:56.000Z",
  integrity: "",
  campaignStarted: true,
  storyScriptVersion: "outbreak-origin-v8",
  readStoryEventIds: ["prologue-opening-v070", "stage-nishijin-pre-v070"],
  autoSkipReadStory: true,
  processedResultIds: ["release-071-result-stage-1", "release-071-result-stage-2"],
  processedAcquisitionIds: ["release-071-recruit-tatara"],
  completedStageIds: stageIds.slice(0, 5),
  bestStarsByStage: Object.fromEntries(stageIds.slice(0, 5).map((stageId, index) => [stageId, (index % 3) + 1])),
  claimedStarRewardsByStage: Object.fromEntries(stageIds.slice(0, 5).map((stageId) => [stageId, [1]])),
  caps: 987,
  supplies: 987,
  unlockedStageIds: stageIds,
  ownership: unitIds,
  discovery: unitIds,
  recruitable: [],
  unlockedUnitIds: unitIds,
  formationPresets: [
    { id: "formation-preset-1", displayName: "部隊1", unitIds: unitIds.slice(0, 7) },
    { id: "formation-preset-2", displayName: "部隊2", unitIds: unitIds.slice(4, 11) },
    { id: "formation-preset-3", displayName: "部隊3", unitIds: [unitIds[0], unitIds[4], unitIds[8]] },
  ],
  selectedFormationPresetId: "formation-preset-2",
  selectedPresetId: "formation-preset-2",
  lastSelectedStageId: stageIds[5],
  settings: {
    bgmEnabled: false,
    sfxEnabled: true,
    bgmVolume: 0.35,
    sfxVolume: 0.6,
    reducedMotion: true,
    battleEventMode: "compact",
  },
};
// Field set and insertion order are copied from the serializer shipped at the
// fixed v0.7.1 release commit. Its integrity must be valid before v7 migration.
release071Fixture.integrity = computeCampaignSaveIntegrity(release071Fixture);
const release071Serialized = JSON.stringify(release071Fixture);
const corruptLocal = "{\"schemaVersion\":5,\"caps\":";
const corruptIndexed = "not-json-indexed";

await mkdir(evidenceDir, { recursive: true });

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

async function seedPage(page, { local = null, indexed = null } = {}) {
  const seedUrl = new URL("__save_seed__", baseUrl);
  await page.route(String(seedUrl), (route) => route.fulfill({
    status: 200,
    contentType: "text/html",
    body: "<!doctype html><title>save seed</title>",
  }));
  await page.goto(String(seedUrl), { waitUntil: "domcontentloaded", timeout });
  await page.unroute(String(seedUrl));
  await page.evaluate(async ({
    databaseName,
    storeName,
    saveKey,
    localSerialized,
    indexedSerialized,
  }) => {
    localStorage.clear();
    await new Promise((resolve) => {
      const request = indexedDB.deleteDatabase(databaseName);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    });
    if (localSerialized !== null) localStorage.setItem(saveKey, localSerialized);
    if (indexedSerialized !== null) {
      await new Promise((resolve, reject) => {
        const request = indexedDB.open(databaseName, 1);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(storeName)) {
            request.result.createObjectStore(storeName);
          }
        };
        request.onerror = () => reject(request.error ?? new Error("seed IndexedDB open failed"));
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction(storeName, "readwrite");
          transaction.objectStore(storeName).put(indexedSerialized, saveKey);
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error ?? new Error("seed IndexedDB write failed"));
        };
      });
    }
  }, {
    databaseName: DATABASE_NAME,
    storeName: STORE_NAME,
    saveKey: SAVE_KEY,
    localSerialized: local,
    indexedSerialized: indexed,
  });
}

async function readStorage(page) {
  return page.evaluate(async ({ databaseName, storeName, keys }) => {
    const indexed = {};
    await new Promise((resolve) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(storeName)) {
          request.result.createObjectStore(storeName);
        }
      };
      request.onerror = () => resolve();
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction(storeName, "readonly");
        const store = transaction.objectStore(storeName);
        let remaining = keys.length;
        for (const key of keys) {
          const getRequest = store.get(key);
          getRequest.onsuccess = () => {
            indexed[key] = typeof getRequest.result === "string" ? getRequest.result : null;
            remaining -= 1;
            if (remaining === 0) {
              database.close();
              resolve();
            }
          };
          getRequest.onerror = () => {
            indexed[key] = null;
            remaining -= 1;
            if (remaining === 0) {
              database.close();
              resolve();
            }
          };
        }
      };
    });
    return {
      local: Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)])),
      indexed,
    };
  }, {
    databaseName: DATABASE_NAME,
    storeName: STORE_NAME,
    keys: [SAVE_KEY, PRE_MIGRATION_KEY, LAST_KNOWN_GOOD_KEY],
  });
}

function parseSave(serialized, label) {
  invariant(typeof serialized === "string" && serialized.length > 0, `${label} is missing`);
  try {
    return JSON.parse(serialized);
  } catch {
    throw new Error(`${label} is not valid JSON`);
  }
}

function assertMigratedSave(save, label, { allowNewRevision = false } = {}) {
  invariant(save.schemaVersion === CURRENT_SCHEMA_VERSION, `${label} schema ${save.schemaVersion}`);
  if (allowNewRevision) {
    invariant(save.revision > release071Fixture.revision, `${label} did not create a newer revision`);
    invariant(Number.isFinite(Date.parse(save.updatedAt)), `${label} did not create a valid updatedAt`);
  } else {
    invariant(save.revision === release071Fixture.revision, `${label} revision changed`);
    invariant(save.updatedAt === release071Fixture.updatedAt, `${label} updatedAt changed`);
  }
  invariant(save.campaignStarted === true, `${label} campaignStarted changed`);
  invariant(JSON.stringify(save.completedStageIds) === JSON.stringify(release071Fixture.completedStageIds),
    `${label} completed stages changed`);
  invariant(JSON.stringify(save.bestStarsByStage) === JSON.stringify(release071Fixture.bestStarsByStage),
    `${label} stars changed`);
  invariant(JSON.stringify(save.claimedStarRewardsByStage) === JSON.stringify(release071Fixture.claimedStarRewardsByStage),
    `${label} claimed star rewards changed`);
  invariant(save.caps === release071Fixture.caps && save.supplies === release071Fixture.caps,
    `${label} caps changed`);
  invariant(JSON.stringify(save.unlockedStageIds) === JSON.stringify(release071Fixture.unlockedStageIds),
    `${label} stage unlocks changed`);
  invariant(JSON.stringify(save.ownership) === JSON.stringify(release071Fixture.ownership),
    `${label} ownership changed`);
  invariant(JSON.stringify(save.discovery) === JSON.stringify(release071Fixture.discovery),
    `${label} discovery changed`);
  invariant(save.selectedFormationPresetId === release071Fixture.selectedFormationPresetId,
    `${label} selected formation changed`);
  invariant(save.lastSelectedStageId === release071Fixture.lastSelectedStageId,
    `${label} selected stage changed`);
  invariant(JSON.stringify(save.readStoryEventIds) === JSON.stringify(release071Fixture.readStoryEventIds),
    `${label} read events changed`);
  invariant(JSON.stringify(save.processedResultIds) === JSON.stringify(release071Fixture.processedResultIds),
    `${label} result receipts changed`);
  invariant(JSON.stringify(save.processedAcquisitionIds) === JSON.stringify(release071Fixture.processedAcquisitionIds),
    `${label} acquisition receipts changed`);
  invariant(Array.isArray(save.processedUpgradeIds) && save.processedUpgradeIds.length === 0,
    `${label} upgrade receipts were not initialized safely`);
  invariant(JSON.stringify(save.recruitable) === JSON.stringify(release071Fixture.recruitable),
    `${label} recruitable roster changed`);
  invariant(JSON.stringify(save.formationPresets) === JSON.stringify(release071Fixture.formationPresets),
    `${label} formation presets changed`);
  invariant(save.autoSkipReadStory === true, `${label} story setting changed`);
  invariant(save.settings.bgmEnabled === false, `${label} BGM setting changed`);
  invariant(save.settings.bgmVolume === release071Fixture.settings.bgmVolume,
    `${label} BGM volume changed`);
  invariant(save.settings.sfxEnabled === true && save.settings.sfxVolume === 0.6,
    `${label} battle voice/SFX setting changed`);
  invariant(save.settings.reducedMotion === true && save.settings.battleEventMode === "compact",
    `${label} accessibility/story settings changed`);
  invariant(save.unitRanks
    && JSON.stringify(Object.keys(save.unitRanks).sort()) === JSON.stringify([...unitIds].sort())
    && Object.values(save.unitRanks).every((rank) => rank === 0),
    `${label} rank defaults were not added safely`);
  invariant(save.eventFoundation?.schemaVersion === 1, `${label} event progress was not initialized safely`);
  invariant(!Object.hasOwn(save, "visualOverrides"), `${label} persisted obsolete visual fields`);
  invariant(typeof save.integrity === "string" && save.integrity.startsWith("fnv1a32:"),
    `${label} current integrity stamp missing`);
}

async function waitForTitleReady(page, expectedLabel) {
  await page.locator(".title-screen-v060").waitFor({ state: "visible", timeout });
  await page.waitForFunction(
    (label) => {
      const button = document.querySelector(".title-start");
      return button && !button.disabled && button.textContent?.includes(label);
    },
    expectedLabel,
    { timeout },
  );
}

async function waitForMigratedReplicas(page) {
  const deadline = Date.now() + timeout;
  let stableReads = 0;
  let stableSerialized = null;
  let lastStorage = null;
  while (Date.now() < deadline) {
    const storage = await readStorage(page);
    const localSerialized = storage.local[SAVE_KEY];
    const indexedSerialized = storage.indexed[SAVE_KEY];
    let currentAndEqual = false;
    try {
      currentAndEqual = typeof localSerialized === "string"
        && localSerialized === indexedSerialized
        && JSON.parse(localSerialized).schemaVersion === CURRENT_SCHEMA_VERSION;
    } catch {
      currentAndEqual = false;
    }
    if (currentAndEqual) {
      stableReads = localSerialized === stableSerialized ? stableReads + 1 : 1;
      stableSerialized = localSerialized;
      lastStorage = storage;
      if (stableReads >= 3) return lastStorage;
    } else {
      stableReads = 0;
      stableSerialized = null;
      lastStorage = storage;
    }
    await page.waitForTimeout(100);
  }
  const localSchema = (() => {
    try { return JSON.parse(lastStorage?.local?.[SAVE_KEY] ?? "").schemaVersion; } catch { return null; }
  })();
  const indexedSchema = (() => {
    try { return JSON.parse(lastStorage?.indexed?.[SAVE_KEY] ?? "").schemaVersion; } catch { return null; }
  })();
  throw new Error(
    `Campaign replicas did not settle at schema ${CURRENT_SCHEMA_VERSION} `
    + `(local=${String(localSchema)}, indexed=${String(indexedSchema)})`,
  );
}

function createDiagnostics(page) {
  const state = { consoleErrors: [], pageErrors: [], requestFailures: [], httpErrors: [] };
  page.on("console", (message) => {
    if (message.type() === "error") state.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => state.pageErrors.push(String(error)));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown";
    if (failure !== "net::ERR_ABORTED") state.requestFailures.push(`${request.url()} :: ${failure}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) state.httpErrors.push(`${response.status()} ${response.url()}`);
  });
  return state;
}

function assertDiagnostics(diagnostics, label) {
  for (const [kind, entries] of Object.entries(diagnostics)) {
    invariant(entries.length === 0, `${label} ${kind}: ${JSON.stringify(entries)}`);
  }
}

const browser = await browserType.launch({ headless: true });
const results = [];
let exportedBackup = null;

async function runCase(name, seed, verify) {
  const context = await browser.newContext({
    viewport: { width: viewportWidth, height: viewportHeight },
    acceptDownloads: true,
  });
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);
  const result = { name, status: "failed" };
  try {
    await seedPage(page, seed);
    const response = await page.goto(String(baseUrl), { waitUntil: "domcontentloaded", timeout });
    invariant(response?.ok(), `${name} navigation failed: HTTP ${response?.status()}`);
    const evidence = await verify(page);
    await page.waitForLoadState("networkidle", { timeout: Math.min(timeout, 5_000) }).catch(() => undefined);
    await page.waitForTimeout(100);
    assertDiagnostics(diagnostics, name);
    Object.assign(result, { status: "passed", evidence });
  } catch (error) {
    result.error = String(error);
    try {
      result.storage = await readStorage(page);
      await page.screenshot({ path: path.join(evidenceDir, `${name}-FAILED.png`) });
    } catch {
      // The page can fail before the target origin is ready.
    }
  } finally {
    result.diagnostics = diagnostics;
    results.push(result);
    await context.close();
  }
}

try {
  await runCase("fresh-save", {}, async (page) => {
    await waitForTitleReady(page, "物語を始める");
    const storage = await waitForMigratedReplicas(page);
    const local = parseSave(storage.local[SAVE_KEY], "fresh localStorage");
    const indexed = parseSave(storage.indexed[SAVE_KEY], "fresh IndexedDB");
    invariant(local.schemaVersion === CURRENT_SCHEMA_VERSION, "fresh local schema mismatch");
    invariant(indexed.schemaVersion === CURRENT_SCHEMA_VERSION, "fresh IndexedDB schema mismatch");
    invariant(local.campaignStarted === false && indexed.campaignStarted === false,
      "fresh save was silently started");
    invariant(storage.local[PRE_MIGRATION_KEY] === null && storage.indexed[PRE_MIGRATION_KEY] === null,
      "fresh save created a fake pre-migration snapshot");
    return { schemaVersion: local.schemaVersion, campaignStarted: local.campaignStarted };
  });

  for (const source of ["localStorage", "indexedDB"]) {
    await runCase(`release-071-${source}`, {
      local: source === "localStorage" ? release071Serialized : null,
      indexed: source === "indexedDB" ? release071Serialized : null,
    }, async (page) => {
      await waitForTitleReady(page, "物語を続ける");
      const storage = await waitForMigratedReplicas(page);
      const local = parseSave(storage.local[SAVE_KEY], `${source} migrated localStorage`);
      const indexed = parseSave(storage.indexed[SAVE_KEY], `${source} migrated IndexedDB`);
      assertMigratedSave(local, `${source} localStorage`);
      assertMigratedSave(indexed, `${source} IndexedDB`);
      invariant(storage.local[PRE_MIGRATION_KEY] === release071Serialized,
        `${source} local pre-migration snapshot changed`);
      invariant(storage.indexed[PRE_MIGRATION_KEY] === release071Serialized,
        `${source} IndexedDB pre-migration snapshot changed`);
      invariant(typeof storage.local[LAST_KNOWN_GOOD_KEY] === "string",
        `${source} local last-known-good snapshot missing`);
      invariant(typeof storage.indexed[LAST_KNOWN_GOOD_KEY] === "string",
        `${source} IndexedDB last-known-good snapshot missing`);

      if (source === "localStorage") {
        const downloadPromise = page.waitForEvent("download", { timeout });
        await page.getByRole("button", { name: "バックアップを書き出す", exact: true }).click();
        const download = await downloadPromise;
        invariant(download.suggestedFilename() === `nishijin-campaign-v${CURRENT_SCHEMA_VERSION}-backup.json`,
          `stale export filename: ${download.suggestedFilename()}`);
        exportedBackup = await download.createReadStream().then(async (stream) => {
          const chunks = [];
          for await (const chunk of stream) chunks.push(chunk);
          return Buffer.concat(chunks).toString("utf8");
        });
        const envelope = JSON.parse(exportedBackup);
        assertMigratedSave(JSON.parse(envelope.serialized), "manual export");
      }
      return {
        schemaVersion: local.schemaVersion,
        revision: local.revision,
        caps: local.caps,
        preMigrationSnapshotPreserved: true,
        lastKnownGoodPresent: true,
      };
    });
  }

  for (const validSource of ["localStorage", "indexedDB"]) {
    await runCase(`one-corrupt-replica-valid-${validSource}`, {
      local: validSource === "localStorage" ? release071Serialized : corruptLocal,
      indexed: validSource === "indexedDB" ? release071Serialized : corruptIndexed,
    }, async (page) => {
      await waitForTitleReady(page, "物語を続ける");
      const storage = await waitForMigratedReplicas(page);
      const local = parseSave(storage.local[SAVE_KEY], "recovered localStorage");
      const indexed = parseSave(storage.indexed[SAVE_KEY], "recovered IndexedDB");
      assertMigratedSave(local, "recovered localStorage");
      assertMigratedSave(indexed, "recovered IndexedDB");
      invariant(storage.local[PRE_MIGRATION_KEY] === release071Serialized,
        `${validSource} local pre-migration snapshot changed`);
      invariant(storage.indexed[PRE_MIGRATION_KEY] === release071Serialized,
        `${validSource} IndexedDB pre-migration snapshot changed`);
      return { recoveredFrom: validSource, schemaVersion: local.schemaVersion };
    });
  }

  const tamperedRelease071 = JSON.stringify({
    ...release071Fixture,
    revision: release071Fixture.revision + 10,
    caps: release071Fixture.caps + 10_000,
    supplies: release071Fixture.supplies + 10_000,
  });
  await runCase("tampered-schema5-replica", {
    local: tamperedRelease071,
    indexed: release071Serialized,
  }, async (page) => {
    await waitForTitleReady(page, "物語を続ける");
    const storage = await waitForMigratedReplicas(page);
    const local = parseSave(storage.local[SAVE_KEY], "tamper recovery localStorage");
    const indexed = parseSave(storage.indexed[SAVE_KEY], "tamper recovery IndexedDB");
    assertMigratedSave(local, "tamper recovery localStorage");
    assertMigratedSave(indexed, "tamper recovery IndexedDB");
    invariant(local.caps === release071Fixture.caps, "tampered schema5 economy was adopted");
    return { tamperedReplicaRejected: true, recoveredFrom: "indexedDB" };
  });

  await runCase("both-corrupt", {
    local: corruptLocal,
    indexed: corruptIndexed,
  }, async (page) => {
    await page.getByRole("alert", { name: "セーブデータ復旧" }).waitFor({ state: "visible", timeout });
    const storage = await readStorage(page);
    invariant(storage.local[SAVE_KEY] === corruptLocal, "both-corrupt localStorage was overwritten");
    invariant(storage.indexed[SAVE_KEY] === corruptIndexed, "both-corrupt IndexedDB was overwritten");
    invariant(storage.local[PRE_MIGRATION_KEY] === null && storage.indexed[PRE_MIGRATION_KEY] === null,
      "both-corrupt case created a misleading migration snapshot");
    invariant(await page.getByRole("button", { name: "完全初期化", exact: true }).count() === 1,
      "both-corrupt recovery does not expose explicit reset");
    invariant(await page.getByRole("button", { name: "候補データを書き出す", exact: true }).count() === 1,
      "both-corrupt recovery does not expose raw export");
    return { automaticReset: false, localPreserved: true, indexedPreserved: true };
  });

  await runCase("manual-import-release-071", {}, async (page) => {
    await waitForTitleReady(page, "物語を始める");
    await page.locator("input.campaign-save-file").setInputFiles({
      name: "nishijin-campaign-v5-backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(release071Serialized, "utf8"),
    });
    await waitForTitleReady(page, "物語を続ける");
    const storage = await waitForMigratedReplicas(page);
    const local = parseSave(storage.local[SAVE_KEY], "legacy-import localStorage");
    const indexed = parseSave(storage.indexed[SAVE_KEY], "legacy-import IndexedDB");
    assertMigratedSave(local, "legacy-import localStorage", { allowNewRevision: true });
    assertMigratedSave(indexed, "legacy-import IndexedDB", { allowNewRevision: true });
    invariant(storage.local[PRE_MIGRATION_KEY] === release071Serialized,
      "legacy-import local pre-migration snapshot changed");
    invariant(storage.indexed[PRE_MIGRATION_KEY] === release071Serialized,
      "legacy-import IndexedDB pre-migration snapshot changed");
    return { revision: local.revision, preMigrationSnapshotPreserved: true };
  });

  if (typeof exportedBackup === "string" && exportedBackup.length > 0) {
    await runCase("manual-import", {}, async (page) => {
      await waitForTitleReady(page, "物語を始める");
      const input = page.locator("input.campaign-save-file");
      await input.setInputFiles({
        name: `nishijin-campaign-v${CURRENT_SCHEMA_VERSION}-backup.json`,
        mimeType: "application/json",
        buffer: Buffer.from(exportedBackup, "utf8"),
      });
      await waitForTitleReady(page, "物語を続ける");
      const storage = await waitForMigratedReplicas(page);
      const local = parseSave(storage.local[SAVE_KEY], "imported localStorage");
      const indexed = parseSave(storage.indexed[SAVE_KEY], "imported IndexedDB");
      assertMigratedSave(local, "imported localStorage", { allowNewRevision: true });
      assertMigratedSave(indexed, "imported IndexedDB", { allowNewRevision: true });
      invariant(local.revision > release071Fixture.revision, "manual import did not create a newer durable revision");
      invariant(local.integrity === indexed.integrity, "manual import replicas diverged");
      return { revision: local.revision, bothReplicas: true, integrityVerified: true };
    });
  } else {
    results.push({
      name: "manual-import",
      status: "failed",
      error: "Manual export was not captured for import QA",
      diagnostics: {
        consoleErrors: [],
        pageErrors: [],
        requestFailures: [],
        httpErrors: [],
      },
    });
  }
} finally {
  await browser.close();
}

const summary = {
  baseUrl: String(baseUrl),
  engine: engineName,
  generatedAt: new Date().toISOString(),
  releaseFixture: {
    tag: "v0.7.1",
    releaseSha: RELEASE_071_SHA,
    sourceSchemaVersion: release071Fixture.schemaVersion,
    targetSchemaVersion: CURRENT_SCHEMA_VERSION,
  },
  viewport: { width: viewportWidth, height: viewportHeight },
  passed: results.filter(({ status }) => status === "passed").length,
  failed: results.filter(({ status }) => status === "failed").length,
  results,
};
await writeFile(path.join(evidenceDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify(summary, null, 2));
if (summary.failed > 0) {
  throw new Error(
    `Save migration browser smoke failed ${summary.failed}/${results.length}; see ${path.join(evidenceDir, "summary.json")}`,
  );
}
