import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { V090_UNIT_VISUAL_PROFILES } from "../app/visualProfiles.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const LEDGER_PATH = path.join(ROOT, "docs", "ASSET_APPROVALS_0.9.0.json");

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(target) : [target];
  }));
  return nested.flat();
}

function repositoryPath(absolute) {
  return path.relative(ROOT, absolute).split(path.sep).join("/");
}

function resolvesExclusivelyToMaster(records, assetId, masterId, visited = new Set()) {
  if (assetId === masterId) return true;
  if (visited.has(assetId)) return false;
  const record = records.get(assetId);
  if (!record?.sourceAssetIds?.length) return false;
  const nextVisited = new Set(visited).add(assetId);
  return record.sourceAssetIds.every((sourceId) => (
    records.has(sourceId)
    && resolvesExclusivelyToMaster(records, sourceId, masterId, nextVisited)
  ));
}

test("Version 0.9.0 visual approval ledger covers every active file and exact byte revision", async () => {
  const ledger = JSON.parse(await readFile(LEDGER_PATH, "utf8"));
  assert.equal(ledger.schemaVersion, 1);
  assert.equal(ledger.version, "0.9.0");
  assert.equal(ledger.status, "active-partial");
  assert.deepEqual(ledger.scope, [
    "assets/source/v090/characters/",
    "public/art/v090/characters/",
  ]);
  assert.equal(ledger.rightsProvenance.thirdPartyDownloadedVisuals, false);
  assert.match(ledger.rightsProvenance.publicRedistribution, /producer directly authorized/i);
  assert.match(ledger.rightsProvenance.identityIsolation, /no other character/i);
  assert.deepEqual(
    ledger.rightsProvenance.producerProvidedInputs.map(({ messageReference }) => messageReference),
    [
      "producer-message-2026-07-26-image-1",
      "producer-message-2026-07-26-image-2",
      "producer-message-2026-07-26-image-3",
      "producer-message-2026-07-26-image-4",
      "producer-message-2026-07-26-image-5",
    ],
  );

  const activeFiles = [
    ...await filesBelow(path.join(ROOT, "assets", "source", "v090", "characters")),
    ...await filesBelow(path.join(ROOT, "public", "art", "v090", "characters")),
  ].map(repositoryPath).sort();
  const records = ledger.assets;
  assert.equal(records.length, 49);
  assert.equal(new Set(records.map(({ assetId }) => assetId)).size, records.length);
  assert.equal(new Set(records.map(({ path: assetPath }) => assetPath)).size, records.length);
  assert.deepEqual(records.map(({ path: assetPath }) => assetPath).sort(), activeFiles);

  for (const record of records) {
    assert.equal(record.status, "approved");
    const data = await readFile(path.join(ROOT, record.path));
    const canonicalData = record.path.endsWith(".svg")
      ? Buffer.from(data.toString("utf8").replaceAll("\r\n", "\n"), "utf8")
      : data;
    assert.equal(createHash("sha256").update(canonicalData).digest("hex"), record.sha256, record.path);
    assert.equal(canonicalData.length, record.bytes, record.path);
    const metadata = await sharp(data).metadata();
    assert.equal(metadata.width, record.width, record.path);
    assert.equal(metadata.height, record.height, record.path);
  }
});

test("each active character resolves only to its producer master and both builds fail closed on source revision", async () => {
  const ledger = JSON.parse(await readFile(LEDGER_PATH, "utf8"));
  const v0995Ledger = JSON.parse(await readFile(path.join(ROOT, "docs", "ASSET_APPROVALS_0.9.9.5.json"), "utf8"));
  const records = new Map(ledger.assets.map((record) => [record.assetId, record]));
  const unitContracts = [
    ["zakimiya", "V090-ZAKIMIYA"],
    ["tky", "V090-TKY"],
    ["mrs-chiha", "V090-MRS-CHIHA"],
    ["miyamoto-musashi", "V090-MIYAMOTO-MUSASHI"],
    ["mayo-chan", "V090-MAYO-CHAN"],
  ];
  const registeredPaths = new Set([
    ...ledger.assets.map(({ path: assetPath }) => assetPath),
    ...v0995Ledger.assets.map(({ path: assetPath }) => assetPath),
  ]);
  for (const [kind, prefix] of unitContracts) {
    const masterId = `${prefix}-IDENTITY@r1`;
    const unitRecords = ledger.assets.filter(({ assetId }) => assetId.startsWith(`${prefix}-`));
    for (const record of unitRecords) {
      assert.equal(
        record.assetId === masterId || resolvesExclusivelyToMaster(records, record.assetId, masterId),
        true,
        record.assetId,
      );
    }

    const master = await readFile(path.join(ROOT, records.get(masterId).path));
    const reference = await readFile(path.join(ROOT, records.get(`${prefix}-REFERENCE@r1`).path));
    assert.deepEqual(reference, master);

    const profile = V090_UNIT_VISUAL_PROFILES[kind];
    const runtimePaths = [
      profile.identityMaster.path,
      profile.eventPortrait.path,
      profile.formationCard.path,
      profile.personnelCard.path,
      profile.battleSprite.path,
    ].map((assetPath) => `public${assetPath}`);
    for (const runtimePath of runtimePaths) assert.equal(registeredPaths.has(runtimePath), true, runtimePath);
    if (kind === "mayo-chan") {
      assert.equal(registeredPaths.has(`public${profile.feralBattleSprite.path}`), true);
    }
  }

  const contaminated = new Map(records);
  const mayoPortrait = contaminated.get("V090-MAYO-CHAN-EVENT-PORTRAIT@r1");
  contaminated.set(mayoPortrait.assetId, {
    ...mayoPortrait,
    sourceAssetIds: [...mayoPortrait.sourceAssetIds, "V090-TKY-IDENTITY@r1"],
  });
  assert.equal(
    resolvesExclusivelyToMaster(
      contaminated,
      "V090-MAYO-CHAN-EVENT-PORTRAIT@r1",
      "V090-MAYO-CHAN-IDENTITY@r1",
    ),
    false,
    "a derivative must not mix another character identity source",
  );

  const buildScripts = [
    await readFile(path.join(ROOT, "scripts", "build-v090-zakimiya-assets.mjs"), "utf8"),
    await readFile(path.join(ROOT, "scripts", "build-v090-new-playable-human-assets.mjs"), "utf8"),
    await readFile(path.join(ROOT, "scripts", "build-v090-mayo-assets.mjs"), "utf8"),
  ].join("\n");
  for (const record of ledger.assets.filter(({ kind }) => (
    kind === "producer-identity-master" || kind === "openai-generated-identity-derivative"
  ))) {
    assert.match(buildScripts, new RegExp(record.sha256));
  }
});

test("all five newcomer portraits and formation cards remove the identity-master white field", async () => {
  const kinds = ["zakimiya", "tky", "mrs-chiha", "miyamoto-musashi", "mayo-chan"];
  for (const kind of kinds) {
    const profile = V090_UNIT_VISUAL_PROFILES[kind];
    for (const assetPath of [profile.eventPortrait.path, profile.formationCard.path]) {
      const image = await sharp(path.join(ROOT, "public", ...assetPath.split("/").filter(Boolean)))
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      let visiblePixels = 0;
      for (let offset = 0; offset < image.data.length; offset += 4) {
        const alpha = image.data[offset + 3];
        if (alpha < 220) continue;
        visiblePixels += 1;
      }
      assert.ok(visiblePixels > image.info.width * image.info.height * .28, `${kind}: ${assetPath} has readable subject coverage`);
      for (const [x, y] of [
        [0, 0],
        [image.info.width - 1, 0],
        [0, image.info.height - 1],
        [image.info.width - 1, image.info.height - 1],
      ]) {
        const offset = (y * image.info.width + x) * 4;
        const opaqueWhite = image.data[offset + 3] > 220
          && image.data[offset] > 240
          && image.data[offset + 1] > 240
          && image.data[offset + 2] > 240;
        assert.equal(opaqueWhite, false, `${kind}: ${assetPath} retains the white rectangular master background`);
      }
    }
  }
});
