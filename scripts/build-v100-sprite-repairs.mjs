import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertV100ArtAllowed } from './rejected-v100-art.mjs';

const root = new URL('../', import.meta.url);
const sources = new URL('assets/source/v100/sprite-repairs/', root);
const sha = data => createHash('sha256').update(data).digest('hex');
const records = [];
const baselineHashes=Object.freeze({
  musashi:'e05b1eedcdae7371b6b4fac63e09c492e907593c4951aaec63a642b9e36637e6',
  president:'6f38bd9479fa2ab739fedfc383525398185519bebd64befaec271fb3eb3c9e5a',
  omega:'16241ef40b809c2258822af01653d3b04cf02c959e835ff2e427a2338d3756c8',
});
async function baseline(name){
  const bytes=await readFile(new URL(`${name}-published-1.0.3.png`,sources));
  if(sha(bytes)!==baselineHashes[name])throw new Error(`Published baseline changed: ${name}`);
  return bytes;
}
// Published transport identities remain fixed across repeat regeneration.
const oldAssets = new Map([
  ['/art/v100/bosses/mugarian-president-mutated-battle-v2.png', { bytes:2317698, hash:'sha256-eaa46570186d3c382956f1ad915f88e279db7c23d13918c3535fde5063c88586', criticality:'critical' }],
  ['/art/v100/bosses/takuya-omega-battle-v2.png', { bytes:2026194, hash:'sha256-69b07efe91c9e97c56bf644dff4c2360ca9b1708239e920280962f01a6b98cd5', criticality:'critical' }],
  ['/art/v090/characters/miyamoto-musashi-battle-r1.png', { bytes:1277560, hash:'sha256-b364a9c87a6641aa30e7cdaf611111ddd058e90a8768a2e92cd306945506a321', criticality:'critical' }],
]);
// Narrow gaps need explicit confirmation when the generated alpha guide is
// displaced by a pixel. These coordinates were checked on the original cells.
const gapSeeds = {
  president: {
    0:[[398,195],[411,213],[202,385],[131,229],[198,204],[136,193],[407,305],[267,360],[144,166],[217,79],[255,390],[214,313],[253,80],[225,94],[244,235]],
    1:[[395,346],[283,356]],
    2:[[243,221],[388,314],[401,241],[272,120],[413,256],[142,220],[387,370],[382,391],[150,194],[156,183],[229,148],[202,353],[393,339],[168,171],[147,208],[223,313],[385,493]],
    4:[[409,210],[111,278],[292,381],[113,244]],
    5:[[394,291],[215,111],[217,181],[409,206],[420,221],[187,127],[394,348],[389,371],[179,111],[401,317],[161,372],[317,176],[329,156]],
    6:[[402,266],[346,242]],
  },
  omega: {
    0:[[218,208],[212,81],[149,176],[170,120],[361,252],[229,211]],
    1:[[188,67],[222,50],[180,69]],
    2:[[146,192],[190,112],[183,117],[222,237],[169,152]],
    3:[[190,337],[161,255]],
    4:[[129,219],[136,211]],
    6:[[305,152],[254,273],[296,153]],
  },
};

function white(data, offset) {
  const r = data[offset], g = data[offset + 1], b = data[offset + 2];
  return data[offset + 3] > 0 && Math.min(r, g, b) >= 150 && Math.max(r, g, b) - Math.min(r, g, b) <= 26;
}
function components(data, width, height) {
  const visited = new Uint8Array(width * height), result = [];
  for (let start = 0; start < visited.length; start++) {
    if (visited[start] || !white(data, start * 4)) continue;
    const queue = [start], pixels = []; visited[start] = 1;
    while (queue.length) {
      const pixel = queue.pop(), x = pixel % width, y = Math.floor(pixel / width); pixels.push(pixel);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if ((!dx && !dy) || nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = ny * width + nx;
        if (!visited[next] && white(data, next * 4)) { visited[next] = 1; queue.push(next); }
      }
    }
    result.push(pixels);
  }
  return result;
}
async function persist(name, assetPath, originalBytes, data, info, details, inputNames) {
  assertV100ArtAllowed(assetPath, sha(originalBytes));
  const png = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  const transport = await sharp(png).webp({ lossless: true, effort: 6 }).toBuffer();
  const destination = new URL(`public${assetPath}`, root), sourcePath = `/pwa-optimized${assetPath.replace(/\.png$/u, '.webp')}`;
  await mkdir(new URL('.', destination), { recursive: true });
  await mkdir(new URL(`public${sourcePath}/..`, root), { recursive: true });
  await writeFile(destination, png); await writeFile(new URL(`public${sourcePath}`, root), transport);
  if(name!=='musashi'){
    const metadataFile=new URL(`public${assetPath.replace(/\.png$/u,'-metadata.json')}`,root);
    const metadata=JSON.parse(await readFile(metadataFile,'utf8'));
    metadata.sha256=sha(png);
    metadata.spriteRepair={provenance:'assets/source/v100/sprite-repairs/provenance.json',publishedBaselineSha256:sha(originalBytes),rgbChanges:0,operation:details.operation};
    await writeFile(metadataFile,`${JSON.stringify(metadata,null,2)}\n`);
  }
  records.push({ name, path: assetPath, sourcePath, originalSha256: sha(originalBytes), pngSha256: sha(png), pngBytes: png.length, hash: `sha256-${sha(transport)}`, bytes: transport.length, previous: oldAssets.get(assetPath), inputs: await Promise.all(inputNames.map(async file => ({ file, sha256: sha(await readFile(new URL(file, sources))) }))), ...details });
}

export async function buildV100SpriteRepairs(){
records.length=0;
for (const [name, kind, guideName] of [['president', 'mugarian-president-mutated', 'president-alpha-guide-r1.png'], ['omega', 'takuya-omega', 'omega-alpha-guide-r1.png']]) {
  const originalBytes = await baseline(name);
  const { data: original, info } = await sharp(originalBytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data: guide } = await sharp(await readFile(new URL(guideName, sources))).resize(2176, 1024, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const result = Buffer.from(original), removed = [];
  for (let column = 0; column < 8; column++) {
    const cell = await sharp(originalBytes).extract({ left: column * 544, top: 0, width: 544, height: 512 }).ensureAlpha().raw().toBuffer();
    for (const pixels of components(cell, 544, 512)) {
      if (pixels.length < 3) continue;
      let guideTransparent = 0, bright = 0;
      for (const pixel of pixels) {
        const x = pixel % 544, y = Math.floor(pixel / 544), guideIndex = ((Math.floor(column / 4) * 512 + y) * 2176 + column % 4 * 544 + x) * 4;
        if (guide[guideIndex + 3] < 96) guideTransparent++;
        if (Math.min(cell[pixel * 4], cell[pixel * 4 + 1], cell[pixel * 4 + 2]) > 210) bright++;
      }
      // Generated pixels are never adopted. Only a pale connected background
      // component confirmed by the edited alpha guide may lose opacity.
      const pixelSet = new Set(pixels);
      const explicitGap = (gapSeeds[name][column] ?? []).some(([x,y]) => pixelSet.has(y*544+x));
      if (!explicitGap && (guideTransparent / pixels.length < .6 || bright / pixels.length < .3)) continue;
      for (const pixel of pixels) {
        const x = pixel % 544, y = Math.floor(pixel / 544);
        result[(y * info.width + column * 544 + x) * 4 + 3] = 0;
        result[((512 + y) * info.width + column * 544 + 543 - x) * 4 + 3] = 0;
      }
      removed.push({ column, pixels: pixels.length, seed: [pixels[0] % 544, Math.floor(pixels[0] / 544)], explicitGap, guideTransparentRatio: guideTransparent / pixels.length });
    }
  }
  if (removed.length < 8) throw new Error(`Insufficient confirmed gap repair: ${name}`);
  for (let i = 0; i < result.length; i++) if (i % 4 !== 3 && original[i] !== result[i]) throw new Error(`Identity RGB changed: ${name}`);
  await persist(name, `/art/v100/bosses/${kind}-battle-v2.png`, originalBytes, result, info, { operation: 'original-RGB-preserved; alpha-only-removal-of-guide-confirmed-pale-components', rgbChanges: 0, removed }, [`${name}-published-1.0.3.png`, guideName]);
}

function inside(x, y, polygon) {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
  }
  return result;
}
{
  const name = 'musashi', originalBytes = await baseline(name);
  const { data: original, info } = await sharp(originalBytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const edit = await sharp(await readFile(new URL('musashi-walk-r2.png', sources))).resize(480, 448, { fit: 'fill' }).ensureAlpha().raw().toBuffer();
  const idleEdit = await sharp(await readFile(new URL('musashi-idle-r2.png', sources))).resize(480,448,{fit:'fill'}).ensureAlpha().raw().toBuffer();
  const result = Buffer.from(original), bladeMask = [[110,239],[122,239],[216,311],[218,324],[203,326],[110,259]];
  let editedPixels = 0;
  for (let y = 0; y < 448; y++) for (let x = 0; x < 480; x++) {
    if (!inside(x + .5, y + .5, bladeMask)) continue;
    const from = (y * 480 + x) * 4, right = (y * info.width + 480 + x) * 4, left = ((448 + y) * info.width + 480 + 479 - x) * 4;
    for (let c = 0; c < 4; c++) result[right + c] = result[left + c] = edit[from + c];
    editedPixels++;
  }
  // Retain the second katana with a complete tip, remove only the adjacent
  // figure's cloak, and preserve all original pixels outside this local patch.
  const neighbourMask = [[312,225],[450,225],[450,355],[358,355],[358,290],[312,260]];
  let neighbourPixels = 0;
  for (let y = 0; y < 448; y++) for (let x = 0; x < 480; x++) {
    if (!inside(x + .5, y + .5, neighbourMask)) continue;
    const from=(y*480+x)*4,right=(y*info.width+x)*4,left=((448+y)*info.width+479-x)*4;
    for(let c=0;c<4;c++)result[right+c]=result[left+c]=idleEdit[from+c];
    neighbourPixels++;
  }
  await persist(name, '/art/v090/characters/miyamoto-musashi-battle-r1.png', originalBytes, result, info, { operation: 'localized-generated-cloak-repair-and-neighbour-removal; all-other-pixels-preserved', bladeMask, neighbourMask, editedPixels, neighbourPixels }, ['musashi-published-1.0.3.png', 'musashi-walk-r2.png','musashi-idle-r2.png']);
}

await writeFile(new URL('provenance.json', sources), `${JSON.stringify({ format: 'nishijin-issue177-sprite-repairs', producerRequest: '2026-10-10: remove white background remnants and Miyamoto Musashi rear stray blade', imageEditing: 'built-in image_gen; generated alpha guides only for bosses; localized cloth patch only for Musashi', records }, null, 2)}\n`);
const runtimeFile=new URL('assets/source/v100/runtime/v100-runtime-assets-provenance.json',root);
const runtime=JSON.parse(await readFile(runtimeFile,'utf8'));
for(const record of records){
  const output=runtime.outputs[`/public${record.path}`];if(!output)continue;
  output.sha256=record.pngSha256;
  output.spriteRepair={provenance:'assets/source/v100/sprite-repairs/provenance.json',publishedBaselineSha256:record.originalSha256,rgbChanges:0};
  for(const input of record.inputs){const sourcePath=`assets/source/v100/sprite-repairs/${input.file}`;runtime.sources[sourcePath]={path:sourcePath,sha256:input.sha256};}
}
runtime.sources=Object.fromEntries(Object.entries(runtime.sources).sort(([a],[b])=>a.localeCompare(b)));
await writeFile(runtimeFile,`${JSON.stringify(runtime,null,2)}\n`);
const replacements = records.map(({ path, sourcePath, hash, bytes, previous }) => ({ path, previous: { path, bytes: previous.bytes, hash: previous.hash, criticality: previous.criticality }, next: { path, sourcePath, bytes, hash, criticality: previous.criticality }, delta: bytes - previous.bytes }));
await writeFile(new URL('scripts/v177-sprite-repair-asset-contract.mjs', root), `// Exact source-bound sprite fixes; no other published art changes.\nexport const V177_SPRITE_REPLACEMENTS = Object.freeze(${JSON.stringify(replacements, null, 2)});\nexport const V177_SPRITE_BYTES_DELTA = ${replacements.reduce((sum, r) => sum + r.delta, 0)};\n`);
return [...records];
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const output=await buildV100SpriteRepairs();
 console.log(JSON.stringify(output.map(({ name, removed, editedPixels, bytes, hash }) => ({ name, removedComponents: removed?.length, editedPixels, bytes, hash })), null, 2));
}
