// Builds the transport bundle used by the complete first-install download.
//
// The audio mixer still addresses each cue by its original MP3/WAV path. The
// bundle only removes request and header overhead: the PWA download session
// slices, hashes, and stores each cue separately before it commits the full
// manifest. OGG alternatives are intentionally not included in the offline
// pack because Chromium, WebKit, and iPhone Safari support MPEG audio.

import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { PRODUCTION_AUDIO_MANIFEST } from "../app/productionAudio.js";
import { selectPreferredAudioSource } from "../app/pwaAssetManifest.js";

const root = process.cwd();
const publicDir = path.join(root, "public");
const bundleDir = path.join(publicDir, "pwa-bundles");
const bundlePath = "/pwa-bundles/audio-v1.bin";
const outputPath = path.join(publicDir, bundlePath.replace(/^\//, ""));
const indexPath = path.join(bundleDir, "audio-v1.json");
const checkOnly = process.argv.includes("--check");

const chunks = [];
const assets = {};
let offset = 0;

for (const audioAsset of PRODUCTION_AUDIO_MANIFEST.assets ?? []) {
  const source = selectPreferredAudioSource(audioAsset.sources);
  if (!source) throw new Error(`Audio cue ${audioAsset.id} has no playable source`);
  const sourcePath = path.join(publicDir, source.src.replace(/^\//, ""));
  const body = await readFile(sourcePath);
  const hash = `sha256-${createHash("sha256").update(body).digest("hex")}`;
  assets[source.src] = {
    id: audioAsset.id,
    offset,
    bytes: body.byteLength,
    hash,
  };
  chunks.push(body);
  offset += body.byteLength;
}

const body = Buffer.concat(chunks);
const index = {
  schema: "zombieee-pwa-audio-bundle/1",
  bundlePath,
  bytes: body.byteLength,
  assets,
};
const serialized = `${JSON.stringify(index, null, 2)}\n`;

let currentBody = null;
let currentIndex = null;
try { currentBody = await readFile(outputPath); } catch { /* generated below */ }
try { currentIndex = await readFile(indexPath, "utf8"); } catch { /* generated below */ }

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
  throw new Error("The PWA audio transport bundle is out of date");
}

console.log(JSON.stringify({
  checkOnly,
  bundlePath,
  bytes: body.byteLength,
  assetCount: Object.keys(assets).length,
  savedFiles: Number(bodyChanged) + Number(indexChanged),
}, null, 2));
