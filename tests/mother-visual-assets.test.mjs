import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import sharp from "sharp";

import { bossDefinitionForEnemyKind } from "../app/bossFoundation.js";
import {
  SPRITE_STATES,
  spriteFrameFor,
  spriteSheetPath,
} from "../app/spriteManifest.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const LEDGER_PATH = path.join(ROOT, "docs", "BOSS_VISUAL_ASSETS_0.9.0.json");

async function fileAudit(relativePath) {
  const absolutePath = path.join(ROOT, ...relativePath.split("/"));
  const bytes = await readFile(absolutePath);
  const metadata = await sharp(bytes).metadata();
  return {
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.length,
    dimensions: [metadata.width, metadata.height],
  };
}

test("all four revised boss identity masters are fixed to the Producer-approved revisions", async () => {
  const ledger = JSON.parse(await readFile(LEDGER_PATH, "utf8"));
  assert.equal(ledger.schemaVersion, 1);
  assert.equal(ledger.producerApproval.date, "2026-07-27");
  assert.equal(ledger.rightsProvenance.origin, "OpenAI ImageGen under Producer direction");
  assert.equal(ledger.rightsProvenance.producerDirected, true);
  assert.equal(ledger.rightsProvenance.thirdPartyDownloadedVisuals, false);
  assert.match(ledger.rightsProvenance.licenseStatus, /project-original/);
  assert.deepEqual(
    ledger.identityMasters.map(({ kind }) => kind),
    ["mother", "ooguchi", "gairen", "futago"],
  );
  for (const record of ledger.identityMasters) {
    assert.equal(record.status, "producer-approved");
    const audit = await fileAudit(record.path);
    assert.equal(audit.sha256, record.sha256, record.kind);
    assert.deepEqual(audit.dimensions, record.dimensions, record.kind);
  }
});

test("Mother identity derivatives and battle atlas are deterministic and runtime-bound", async () => {
  const ledger = JSON.parse(await readFile(LEDGER_PATH, "utf8"));
  const verticalSlice = ledger.motherVerticalSlice;
  const poseAudit = await fileAudit(verticalSlice.poseSource.path);
  assert.equal(poseAudit.sha256, verticalSlice.poseSource.sha256);
  assert.deepEqual(poseAudit.dimensions, verticalSlice.poseSource.dimensions);
  for (const record of verticalSlice.generatedAssets) {
    const audit = await fileAudit(record.path);
    assert.equal(audit.sha256, record.sha256, record.role);
    assert.equal(audit.bytes, record.bytes, record.role);
    assert.deepEqual(audit.dimensions, record.dimensions, record.role);
  }
  assert.equal(spriteSheetPath("mother"), "/art/v090/bosses/mother-battle-r1.png");
  for (const state of SPRITE_STATES) {
    for (const direction of ["left", "right"]) {
      const frame = spriteFrameFor("mother", state, direction);
      assert.equal(frame.path, spriteSheetPath("mother"));
      assert.equal(frame.gutter.bottom, 16);
    }
  }
  const definition = bossDefinitionForEnemyKind("mother");
  assert.equal(definition.prototypeStatus, "producer-approved");
  assert.equal(definition.compendium.assetPath, "/art/v090/bosses/mother-compendium-r1.webp");
});

test("Ooguchi, Gairen, and Futago derivatives are exact and runtime-bound", async () => {
  const ledger = JSON.parse(await readFile(LEDGER_PATH, "utf8"));
  assert.deepEqual(
    ledger.anomalyBossProduction.map(({ kind }) => kind),
    ["ooguchi", "gairen", "futago"],
  );
  assert.equal(ledger.anomalyBossQa.status, "verified");
  assert.deepEqual(ledger.anomalyBossQa.browsers, ["chromium", "webkit"]);
  assert.deepEqual(ledger.anomalyBossQa.viewports, ["1280x720", "844x390", "844x340"]);
  assert.equal(ledger.anomalyBossQa.casesPassed, 18);
  assert.equal(ledger.anomalyBossQa.casesFailed, 0);
  for (const record of ledger.anomalyBossProduction) {
    assert.equal(record.status, "verified", record.kind);
    const poseAudit = await fileAudit(record.poseSource.path);
    assert.equal(poseAudit.sha256, record.poseSource.sha256, record.kind);
    assert.deepEqual(poseAudit.dimensions, record.poseSource.dimensions, record.kind);
    for (const asset of record.generatedAssets) {
      const audit = await fileAudit(asset.path);
      assert.equal(audit.sha256, asset.sha256, `${record.kind}/${asset.role}`);
      assert.equal(audit.bytes, asset.bytes, `${record.kind}/${asset.role}`);
      assert.deepEqual(audit.dimensions, asset.dimensions, `${record.kind}/${asset.role}`);
    }
    assert.equal(
      spriteSheetPath(record.kind),
      `/art/v090/bosses/${record.kind}-battle-r1.png`,
    );
    for (const state of SPRITE_STATES) {
      for (const direction of ["left", "right"]) {
        const frame = spriteFrameFor(record.kind, state, direction);
        assert.equal(frame.path, spriteSheetPath(record.kind));
        assert.equal(frame.gutter.bottom, 16);
      }
    }
    const definition = bossDefinitionForEnemyKind(record.kind);
    assert.equal(definition.workingName, false);
    assert.equal(definition.prototypeStatus, "producer-approved");
    assert.equal(
      definition.compendium.assetPath,
      `/art/v090/bosses/${record.kind}-compendium-r1.webp`,
    );
  }
});
