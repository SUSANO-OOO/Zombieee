import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const provenancePath = path.join(root, "assets/source/v100/runtime/v100-runtime-assets-provenance.json");
const provenance = JSON.parse(await readFile(provenancePath, "utf8"));
const definitions = [
  ["bosses/mugarian-president-mutated", "mugarian-president-mutated-battle-v2", "mugarian-president-mutated-battle-v1"],
  ["bosses/takuya-omega", "takuya-omega-battle-v2", "takuya-omega-battle-v1"],
  ["enemies/red-panther-commander", "red-panther-commander-battle-v2", "red-panther-commander-battle-v1"],
  ["enemies/red-panther-knife", "red-panther-knife-battle-v2", "red-panther-knife-battle-v1"],
  ["enemies/red-panther-shield", "red-panther-shield-battle-v2", "red-panther-shield-battle-v1"],
  ["enemies/red-panther-smg", "red-panther-smg-battle-v2", "red-panther-smg-battle-v1"],
];
for (const [directory, v2Stem, v1Stem] of definitions) {
  const folder = directory.split("/")[0];
  const v1Path = `/public/art/v100/${folder}/${v1Stem}.png`;
  const v2Path = `/public/art/v100/${folder}/${v2Stem}.png`;
  const old = provenance.outputs[v1Path];
  delete provenance.outputs[`/public/art/v100/${directory}/${v2Stem}.png`];
  const metadataPath = path.join(root, `public/art/v100/${folder}/${v2Stem}-metadata.json`);
  const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
  const pngPath = path.join(root, `public/art/v100/${folder}/${v2Stem}.png`);
  const png = await readFile(pngPath);
  const byState = new Map(metadata.sources.map((source) => [path.basename(source.path).replace("-left-authored-v1.png", ""), source]));
  provenance.outputs[v2Path] = {
    ...old,
    path: v2Path,
    sha256: createHash("sha256").update(png).digest("hex"),
    metadataPath: `/public/art/v100/${folder}/${v2Stem}-metadata.json`,
    commonScale: metadata.commonScale,
    cell: metadata.cell,
    noClipping: metadata.noClipping,
    frameMetadata: metadata.frames.map((frame) => {
      const source = byState.get(frame.state);
      return { state: frame.state, source: source.path, sourceSize: source.sourceSize, sourceBounds: source.sourceBounds, contentRect: frame.contentRect, renderedSize: frame.renderedSize, row: { left: "authored", right: "derived-horizontal-flip" }, clipped: frame.clipped };
    }),
    sources: [...metadata.sources.map((source) => source.path), metadata.identityMaster],
    sourceDirection: metadata.sourceDirection,
    directionRows: metadata.directionRows,
    identityMaster: metadata.identityMaster,
    identityMasterSha256: metadata.identityMasterSha256,
    semanticStates: old?.semanticStates ?? metadata.frames.map((frame) => ({ state: frame.state, rightRow: `${frame.state}:right`, leftRow: `${frame.state}:left` })),
    repair: metadata.repair,
    reviewedGapSeedCount: metadata.sources.reduce((sum, source) => sum + (source.repair.seedCount ?? 0), 0),
  };
}
await writeFile(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`);
console.log(JSON.stringify({ added: definitions.map(([, stem]) => `/public/art/v100/${stem}.png`), preservedV1: true }, null, 2));
