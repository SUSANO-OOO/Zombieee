import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const frozenPath = path.join(root, "dist/client/asset-manifest.json");
const outputPath = path.join(root, "public/asset-manifest.json");
const definitions = [
  ["/art/v100/bosses/mugarian-president-mutated-battle-v1.png", "/art/v100/bosses/mugarian-president-mutated-battle-v2.png"],
  ["/art/v100/bosses/takuya-omega-battle-v1.png", "/art/v100/bosses/takuya-omega-battle-v2.png"],
  ["/art/v100/enemies/red-panther-commander-battle-v1.png", "/art/v100/enemies/red-panther-commander-battle-v2.png"],
  ["/art/v100/enemies/red-panther-knife-battle-v1.png", "/art/v100/enemies/red-panther-knife-battle-v2.png"],
  ["/art/v100/enemies/red-panther-shield-battle-v1.png", "/art/v100/enemies/red-panther-shield-battle-v2.png"],
  ["/art/v100/enemies/red-panther-smg-battle-v1.png", "/art/v100/enemies/red-panther-smg-battle-v2.png"],
];
const frozen = JSON.parse(await readFile(frozenPath, "utf8"));
const assets = frozen.assets.map((asset) => ({ ...asset }));
const byPath = new Map(assets.map((asset) => [asset.path, asset]));
const removals = [];
const additions = [];
for (const [oldPath, newPath] of definitions) {
  const old = byPath.get(oldPath);
  if (!old) throw new Error(`Frozen manifest missing ${oldPath}`);
  const transportPath = `/pwa-optimized${newPath.replace(/\.png$/u, ".webp")}`;
  const transport = await readFile(path.join(root, "public", transportPath.replace(/^\//u, "")));
  const replacement = { ...old, path: newPath, bytes: transport.byteLength, hash: `sha256-${createHash("sha256").update(transport).digest("hex")}`, sourcePath: transportPath };
  const index = assets.findIndex((asset) => asset.path === oldPath);
  assets[index] = replacement;
  byPath.delete(oldPath);
  byPath.set(newPath, replacement);
  removals.push(old);
  additions.push(replacement);
}
const manifest = { ...frozen, assets };
await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
const reviewDir = path.join(root, "outputs/completion/v100-motion-adoption-review");
await mkdir(reviewDir, { recursive: true });
await writeFile(path.join(reviewDir, "motion-manifest-replacement-evidence.json"), `${JSON.stringify({ format: "v100-motion-manifest-replacements", frozenManifest: "dist/client/asset-manifest.json", removals, additions, samePathChangedCount: 0, oldTransportBytes: removals.reduce((sum, asset) => sum + asset.bytes, 0), newTransportBytes: additions.reduce((sum, asset) => sum + asset.bytes, 0), transportDelta: additions.reduce((sum, asset) => sum + asset.bytes, 0) - removals.reduce((sum, asset) => sum + asset.bytes, 0) }, null, 2)}\n`);
console.log(JSON.stringify({ removed: removals.length, added: additions.length, samePathChangedCount: 0 }, null, 2));
