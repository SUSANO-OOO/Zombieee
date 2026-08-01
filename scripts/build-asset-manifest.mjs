// Generates public/asset-manifest.json for the Version 0.9.8.2 PWA.
//
// The distribution set is derived from the game's own sprite, visual,
// stage-object, and audio manifests rather than from a directory walk, so
// QA-only, development, reference, and unused gallery files never enter the
// pack. Run with `--check` in CI to fail when the committed manifest drifts
// from the sources it is derived from.

import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { RELEASE_VERSION } from "../app/releaseIdentity.js";
import {
  ASSET_MANIFEST_SCHEMA,
  RELEASE_SHA_PLACEHOLDER,
  assertAssetManifest,
  audioChannelFor,
  distinctDownloadBytes,
  formatBytes,
  sortManifestAssets,
  summarizeByCategory,
  summarizeByPack,
} from "../app/pwaAssetManifest.js";
import {
  PWA_INSTALL_PRIORITIES,
  dependencyPathsForOperation,
  tierForAudioId,
  tierForPath,
} from "../app/pwaPlayablePack.js";
import { CAMPAIGN_UNITS } from "../app/campaign.js";
import { isBossEnemyKind } from "../app/bossFoundation.js";
import {
  CHARACTER_PORTRAIT_ART,
  FORMATION_CARD_ART,
  PERSONNEL_CARD_ART,
  PORTRAIT_ART,
  RADIO_PORTRAIT_ART,
  spriteKinds,
  spriteSheetPath,
} from "../app/spriteManifest.js";
import { PRODUCTION_VISUALS, STORY_BACKGROUND_VISUALS } from "../app/productionVisuals.js";
import {
  V075_VISUAL_PROFILES,
  V080_UNIT_VISUAL_PROFILES,
  V090_UNIT_VISUAL_PROFILES,
} from "../app/visualProfiles.js";
import { STAGE_OBJECT_MANIFEST } from "../app/stageObjectManifest.js";
import { PRODUCTION_AUDIO_MANIFEST } from "../app/productionAudio.js";

const root = process.cwd();
const publicDir = path.join(root, "public");
const outputPath = path.join(publicDir, "asset-manifest.json");
const checkOnly = process.argv.includes("--check");

const ASSET_EXTENSION = /\.(webp|png|svg|ogg|mp3|wav)$/i;

/**
 * `art/**\/reference/` holds the authoring identity masters that art direction
 * compares against. They are never drawn at runtime and are several times the
 * size of the portraits actually shipped, so they must not reach a player's
 * device.
 */
const EXCLUDED_PATH = /\/reference\//;

/**
 * Profile keys that point at authoring masters rather than runtime art. These
 * are skipped during sweeps so intent is explicit, with EXCLUDED_PATH as the
 * directory-level backstop.
 */
const EXCLUDED_PROFILE_KEYS = new Set(["identityMaster"]);

/** path -> { pack, category, criticality, installTier, installPriority, ... } */
const entries = new Map();
const excluded = new Set();

/**
 * Records one distribution asset. The first classification wins, so the
 * explicit registrations below take precedence over the generic sweeps.
 */
function record(assetPath, classification) {
  if (typeof assetPath !== "string" || !assetPath.startsWith("/")) return;
  if (!ASSET_EXTENSION.test(assetPath)) return;
  if (EXCLUDED_PATH.test(assetPath)) {
    excluded.add(assetPath);
    return;
  }
  if (entries.has(assetPath)) return;
  entries.set(assetPath, classification);
}

function collectExcluded(value, depth = 0) {
  if (depth > 8 || value == null) return;
  if (typeof value === "string") {
    if (ASSET_EXTENSION.test(value) && value.startsWith("/")) excluded.add(value);
    return;
  }
  if (Array.isArray(value)) return value.forEach((item) => collectExcluded(item, depth + 1));
  if (typeof value === "object") {
    for (const item of Object.values(value)) collectExcluded(item, depth + 1);
  }
}

function resolveClassification(classification, assetPath) {
  return typeof classification === "function" ? classification(assetPath) : classification;
}

function stagedClassification(assetPath, base) {
  const installTier = tierForPath(assetPath);
  return {
    ...base,
    criticality: installTier === "shell" || installTier === "first-play" ? "critical" : "optional",
    installTier,
    installPriority: PWA_INSTALL_PRIORITIES[installTier],
  };
}

function sweep(value, classification, depth = 0) {
  if (depth > 8 || value == null) return;
  if (typeof value === "string") return record(value, resolveClassification(classification, value));
  if (Array.isArray(value)) return value.forEach((item) => sweep(item, classification, depth + 1));
  if (typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (EXCLUDED_PROFILE_KEYS.has(key)) {
        collectExcluded(item);
        continue;
      }
      sweep(item, classification, depth + 1);
    }
  }
}

// --- Playable / boss / enemy classification -------------------------------

const playableKinds = new Set();
for (const unit of CAMPAIGN_UNITS ?? []) {
  for (const alias of unit?.aliases ?? []) {
    if (spriteKinds.includes(alias)) playableKinds.add(alias);
  }
}
// Feral Mayo is a transformation of a playable unit, not a separate enemy.
if (playableKinds.has("mayo-chan")) playableKinds.add("mayo-chan-feral");

function categoryForKind(kind) {
  if (playableKinds.has(kind)) return "unit";
  if (isBossEnemyKind(kind)) return "boss";
  return "enemy";
}

// --- App shell ------------------------------------------------------------

record(PRODUCTION_VISUALS.title, stagedClassification(PRODUCTION_VISUALS.title, { pack: "app-shell", category: "app" }));
record(PRODUCTION_VISUALS.command, stagedClassification(PRODUCTION_VISUALS.command, { pack: "app-shell", category: "app" }));
record("/favicon.svg", stagedClassification("/favicon.svg", { pack: "app-shell", category: "app" }));
// Every icon the web app manifest or the document head points at. An icon that
// is referenced but not registered here is absent from the offline pack, so an
// installed app would go looking for it over a network it may not have.
for (const icon of [
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-1024.png",
  "/icons/icon-maskable-192.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon-180.png",
]) {
  record(icon, stagedClassification(icon, { pack: "app-shell", category: "app" }));
}

// --- Campaign core --------------------------------------------------------

sweep(PRODUCTION_VISUALS.stages, (assetPath) => stagedClassification(assetPath, { pack: "campaign-core", category: "background" }));
sweep(STORY_BACKGROUND_VISUALS, (assetPath) => stagedClassification(assetPath, { pack: "campaign-core", category: "background" }));
sweep(STAGE_OBJECT_MANIFEST, (assetPath) => stagedClassification(assetPath, { pack: "campaign-core", category: "object" }));
// These three battle supplies are direct renderer dependencies, not entries in
// STAGE_OBJECT_MANIFEST, so register them explicitly after the generic sweeps.
for (const assetPath of dependencyPathsForOperation()) {
  if (!assetPath.startsWith("/art/")) {
    record(assetPath, stagedClassification(assetPath, { pack: "campaign-core", category: "object" }));
  }
}

// --- Units, enemies, bosses ----------------------------------------------

for (const kind of spriteKinds) {
  const category = categoryForKind(kind);
  record(spriteSheetPath(kind), stagedClassification(spriteSheetPath(kind), {
    pack: "units",
    category,
  }));
}

// CRAWLER and the infected base are persistent battlefield fixtures.
sweep(V075_VISUAL_PROFILES.crawler, (assetPath) => stagedClassification(assetPath, { pack: "units", category: "unit" }));
sweep(V075_VISUAL_PROFILES.enemyBase, (assetPath) => stagedClassification(assetPath, { pack: "units", category: "enemy" }));

sweep(CHARACTER_PORTRAIT_ART, (assetPath) => stagedClassification(assetPath, { pack: "units", category: "portrait" }));
sweep(PORTRAIT_ART, (assetPath) => stagedClassification(assetPath, { pack: "units", category: "portrait" }));
sweep(FORMATION_CARD_ART, (assetPath) => stagedClassification(assetPath, { pack: "units", category: "portrait" }));
sweep(PERSONNEL_CARD_ART, (assetPath) => stagedClassification(assetPath, { pack: "units", category: "portrait" }));
record(RADIO_PORTRAIT_ART, stagedClassification(RADIO_PORTRAIT_ART, { pack: "units", category: "portrait" }));
sweep(V075_VISUAL_PROFILES, (assetPath) => stagedClassification(assetPath, { pack: "units", category: "portrait" }));
sweep(V080_UNIT_VISUAL_PROFILES, (assetPath) => stagedClassification(assetPath, { pack: "units", category: "portrait" }));
sweep(V090_UNIT_VISUAL_PROFILES, (assetPath) => stagedClassification(assetPath, { pack: "units", category: "portrait" }));

// --- Audio ----------------------------------------------------------------

for (const asset of PRODUCTION_AUDIO_MANIFEST.assets ?? []) {
  const audioChannel = audioChannelFor(asset.category);
  for (const source of asset.sources ?? []) {
    const installTier = tierForAudioId(asset.id);
    record(source.src, {
      pack: "audio",
      category: "audio",
      criticality: installTier === "first-play" ? "critical" : "optional",
      installTier,
      installPriority: PWA_INSTALL_PRIORITIES[installTier],
      audioChannel,
      audioId: asset.id,
      audioType: source.type,
    });
  }
}

// --- Hash and size --------------------------------------------------------

const assets = [];
const missing = [];

for (const [assetPath, classification] of entries) {
  const absolute = path.join(publicDir, assetPath.replace(/^\//, ""));
  try {
    const [stats, body] = await Promise.all([stat(absolute), readFile(absolute)]);
    assets.push({
      path: assetPath,
      bytes: stats.size,
      hash: `sha256-${createHash("sha256").update(body).digest("hex")}`,
      pack: classification.pack,
      category: classification.category,
      criticality: classification.criticality,
      installTier: classification.installTier,
      installPriority: classification.installPriority,
      ...(classification.audioChannel ? { audioChannel: classification.audioChannel } : {}),
      ...(classification.audioId ? { audioId: classification.audioId } : {}),
      ...(classification.audioType ? { audioType: classification.audioType } : {}),
    });
  } catch {
    missing.push(assetPath);
  }
}

if (missing.length > 0) {
  console.error(`Missing distribution assets:\n${missing.map((entry) => `  ${entry}`).join("\n")}`);
  process.exit(1);
}

const manifest = {
  schema: ASSET_MANIFEST_SCHEMA,
  version: RELEASE_VERSION,
  releaseSha: RELEASE_SHA_PLACEHOLDER,
  assets: sortManifestAssets(assets),
};

assertAssetManifest(manifest);

const serialized = `${JSON.stringify(manifest, null, 2)}\n`;

// A path reachable through an authoring-master key may also be registered as
// real runtime art elsewhere. Only paths absent from the final pack were
// genuinely excluded, so report those and not the raw sweep set.
const shippedPaths = new Set(manifest.assets.map((asset) => asset.path));
const excludedPaths = [...excluded].filter((assetPath) => !shippedPaths.has(assetPath)).sort();

const summary = {
  count: manifest.assets.length,
  bytes: distinctDownloadBytes(manifest.assets),
  size: formatBytes(distinctDownloadBytes(manifest.assets)),
  excludedAuthoringMasters: excludedPaths.length,
  excludedPaths,
  byPack: summarizeByPack(manifest.assets),
  byCategory: summarizeByCategory(manifest.assets),
};

if (checkOnly) {
  let current = null;
  try {
    current = await readFile(outputPath, "utf8");
  } catch {
    console.error(`Missing ${path.relative(root, outputPath)}. Run: node scripts/build-asset-manifest.mjs`);
    process.exit(1);
  }
  if (current !== serialized) {
    console.error(
      `${path.relative(root, outputPath)} is out of date.\n`
      + "Regenerate it with: node scripts/build-asset-manifest.mjs",
    );
    process.exit(1);
  }
  console.log(JSON.stringify({ check: "up-to-date", ...summary }, null, 2));
} else {
  await writeFile(outputPath, serialized, "utf8");
  console.log(JSON.stringify({ written: path.relative(root, outputPath), ...summary }, null, 2));
}
