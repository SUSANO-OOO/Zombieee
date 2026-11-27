// Transport bundles save request overhead. Every file is still hashed and stored
// separately by the PWA. Keep the existing preferred-source transport intact so
// an update that adds fallback sounds only downloads the small new bundle.

import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { INSTALL_AUDIO_ASSETS, NAO_REACTION_PATHS } from "../app/productionAudio.js";
import { V104_SHORT_HEAVY_DEATH_PATHS } from "../app/v104CombatAudio.js";
import { recordedHurtFiles } from "../app/v100RecordedHurtTakes.js";
import { selectPreferredAudioSource } from "../app/pwaAssetManifest.js";
import { FALLBACK_AUDIO_BUNDLE_NAME, v100OfflineAudioFallbacks } from "./pwa-audio-fallbacks.mjs";

const root = process.cwd();
const publicDir = path.join(root, "public");
const bundleDir = path.join(publicDir, "pwa-bundles");
const checkOnly = process.argv.includes("--check");

async function buildAudioBundle(name, entries) {
  const bundlePath = "/pwa-bundles/" + name + ".bin";
  const outputPath = path.join(bundleDir, name + ".bin");
  const indexPath = path.join(bundleDir, name + ".json");
  const chunks = [];
  const assets = {};
  let offset = 0;

  for (const { id, source } of entries) {
    if (!source) throw new Error(`Audio cue ${id} has no playable source`);
    const sourcePath = path.join(publicDir, source.src.replace(/^\//, ""));
    const body = await readFile(sourcePath);
    const hash = `sha256-${createHash("sha256").update(body).digest("hex")}`;
    assets[source.src] = { id, offset, bytes: body.byteLength, hash };
    chunks.push(body);
    offset += body.byteLength;
  }

  const body = Buffer.concat(chunks);
  const index = { schema: "zombieee-pwa-audio-bundle/1", bundlePath, bytes: body.byteLength, assets };
  const serialized = `${JSON.stringify(index, null, 2)}\n`;
  const currentBody = await readFile(outputPath).catch((error) => {
    if (error.code !== "ENOENT") throw error;
    return null;
  });
  const currentIndex = await readFile(indexPath, "utf8").catch((error) => {
    if (error.code !== "ENOENT") throw error;
    return null;
  });

  const bodyChanged = !currentBody || !currentBody.equals(body);
  const indexChanged = currentIndex !== serialized;
  if (!checkOnly) {
    await mkdir(bundleDir, { recursive: true });
    if (bodyChanged) await writeFile(outputPath, body);
    if (indexChanged) await writeFile(indexPath, serialized, "utf8");
  }
  await stat(outputPath);
  await stat(indexPath);
  if (checkOnly && (bodyChanged || indexChanged)) {
    throw new Error(`The PWA audio transport bundle is out of date: ${bundlePath}`);
  }
  console.log(JSON.stringify({
    checkOnly,
    bundlePath,
    bytes: body.byteLength,
    assetCount: Object.keys(assets).length,
    savedFiles: Number(bodyChanged) + Number(indexChanged),
  }, null, 2));
}

// Fetch the new takes individually when updating an existing installation.
const directVoicePaths = new Set([...V104_SHORT_HEAVY_DEATH_PATHS, ...recordedHurtFiles, ...NAO_REACTION_PATHS]);
const bundledAudio = INSTALL_AUDIO_ASSETS.map(({ id, sources }) => ({
  id,
  source: selectPreferredAudioSource(sources),
})).filter(({ source }) => !directVoicePaths.has(source?.src));
await buildAudioBundle("audio-v1", bundledAudio);
await buildAudioBundle(FALLBACK_AUDIO_BUNDLE_NAME, v100OfflineAudioFallbacks());
