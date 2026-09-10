import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { V100_RUNTIME_ASSET_MANIFEST } from "../app/v100RuntimeAssetManifest.js";
import { SPRITE_MANIFEST } from "../app/spriteManifest.js";
import { V100_WEAPON_SOCKETS } from "../app/v100WeaponSockets.js";

const ROOT = process.cwd();
const files = (relative) => path.join(ROOT, relative.replaceAll("/", path.sep));
const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");
const atlases = [
  ["mugarian-president-mutated", "bosses/mugarian-president-mutated", "boss-mugarian-president-mutated", 8],
  ["takuya-omega", "bosses/takuya-omega", "boss-takuya-omega", 8],
  ["red-panther-knife", "enemies/red-panther-knife", "knife", 5],
  ["red-panther-shield", "enemies/red-panther-shield", "shield", 5],
  ["red-panther-smg", "enemies/red-panther-smg", "smg", 5],
  ["red-panther-commander", "enemies/red-panther-commander", "commander", 5],
];
const rows = [];
for (const [kind, relativeStem, runtimeKey, stateCount] of atlases) {
  const family = relativeStem.startsWith("bosses") ? "bosses" : "enemies";
  const file = `public/art/v100/${family}/${relativeStem.split("/")[1]}-battle-v2.png`;
  const metadataFile = file.replace(/\.png$/, "-metadata.json");
  const metadata = JSON.parse(await readFile(files(metadataFile), "utf8"));
  const png = await readFile(files(file));
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([info.width, info.height], [544 * stateCount, 1024], `${kind} geometry`);
  assert.equal(metadata.commonScale > 0, true, `${kind} scale`);
  assert.equal(metadata.noClipping, true, `${kind} clipping`);
  assert.equal(metadata.frames.length, stateCount, `${kind} state count`);
  let opaque = 0;
  let partial = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 0) opaque += 1;
    if (data[i + 3] > 0 && data[i + 3] < 255) partial += 1;
  }
  assert.ok(opaque > 1000, `${kind} body alpha missing`);
  assert.ok(partial > 0, `${kind} anti-aliased alpha missing`);
  const identityBytes = await readFile(files(metadata.identityMaster));
  assert.equal(sha256(identityBytes), metadata.identityMasterSha256, `${kind} identity hash`);
  for (const source of metadata.sources) {
    assert.equal(sha256(await readFile(files(source.path))), source.sha256, `${kind} source hash ${source.path}`);
    assert.equal(source.repair.alphaChangesOutsideAllowedMask, 0, `${kind} alpha outside mask`);
    assert.equal(source.repair.rgbChangesOutsideAllowedMask, 0, `${kind} RGB outside mask`);
  }
  const v1File = file.replace(/-v2\.png$/, "-v1.png");
  const webpFile = file.replace(/^public\//, "public/pwa-optimized/").replace(/\.png$/, ".webp");
  const v1WebpFile = v1File.replace(/^public\//, "public/pwa-optimized/").replace(/\.png$/, ".webp");
  const webp = await readFile(files(webpFile));
  const v1 = await readFile(files(v1File));
  const v1Webp = await readFile(files(v1WebpFile));
  rows.push({ kind, file, sha256: sha256(png), bytes: png.byteLength, webp: { file: webpFile, sha256: sha256(webp), bytes: webp.byteLength }, v1: { bytes: v1.byteLength, webpBytes: v1Webp.byteLength }, opaque, partial, sourceCount: metadata.sources.length, sourceHashes: metadata.sources.map((source) => source.sha256), reviewedSeedCount: metadata.sources.reduce((sum, source) => sum + (source.repair.seedCount ?? 0), 0) });
  const runtimePath = kind === "mugarian-president-mutated" ? V100_RUNTIME_ASSET_MANIFEST.bosses[runtimeKey]
    : kind === "takuya-omega" ? V100_RUNTIME_ASSET_MANIFEST.bosses[runtimeKey]
      : V100_RUNTIME_ASSET_MANIFEST.redPanther[runtimeKey];
  assert.equal(runtimePath, file.slice("public".length).replaceAll("\\", "/"), `${kind} runtime path`);
  assert.equal(SPRITE_MANIFEST[kind].frames.idle.left.path, runtimePath, `${kind} sprite path`);
}
for (const [kind, sockets] of Object.entries(V100_WEAPON_SOCKETS)) {
  if (!kind.startsWith("red-panther-")) continue;
  assert.match(sockets.path, /battle-v2\.png$/, `${kind} socket path`);
  assert.ok(sockets.left.every(([x, y]) => x >= 0 && x < 544 && y >= 0 && y < 512), `${kind} left socket bounds`);
  assert.ok(sockets.right.every(([x, y]) => x >= 0 && x < 544 && y >= 0 && y < 512), `${kind} right socket bounds`);
}
const summary = { format: "v100-motion-adoption-check", atlases: rows, distributionDelta: {
  pngBytes: rows.reduce((sum, row) => sum + row.bytes - row.v1.bytes, 0),
  webpBytes: rows.reduce((sum, row) => sum + row.webp.bytes - row.v1.webpBytes, 0),
  atlasCount: rows.length,
}, sockets: {
  "red-panther-smg": V100_WEAPON_SOCKETS["red-panther-smg"],
  "red-panther-commander": V100_WEAPON_SOCKETS["red-panther-commander"],
}};
await mkdir(files("outputs/completion/v100-motion-adoption-review"), { recursive: true });
await writeFile(files("outputs/completion/v100-motion-adoption-review/adoption-summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
