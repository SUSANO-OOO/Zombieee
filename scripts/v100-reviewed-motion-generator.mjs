import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export const CELL_WIDTH = 544;
export const CELL_HEIGHT = 512;
export const GUTTER = 16;

const ROOT = path.resolve(import.meta.dirname, "..");
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

export const MOTION_DEFINITIONS = Object.freeze([
  { name: "mugarian-president-mutated", output: "bosses/mugarian-president-mutated-battle-v2.png", identity: "mugarian-president-mutated-identity-master-r4.png", states: ["entrance", "idle", "move", "attack", "hit", "phase", "death", "defeat"] },
  { name: "takuya-omega", output: "bosses/takuya-omega-battle-v2.png", identity: "takuya-omega-identity-master-r2.png", states: ["entrance", "idle", "move", "attack", "hit", "phase", "death", "defeat"] },
  { name: "red-panther-knife", output: "enemies/red-panther-knife-battle-v2.png", identity: "red-panther-knife-identity-master-r1.png", states: ["idle", "move", "attack", "hit", "death"] },
  { name: "red-panther-shield", output: "enemies/red-panther-shield-battle-v2.png", identity: "red-panther-shield-identity-master-r1.png", states: ["idle", "move", "attack", "hit", "death"] },
  { name: "red-panther-smg", output: "enemies/red-panther-smg-battle-v2.png", identity: "red-panther-smg-identity-master-r1.png", states: ["idle", "move", "attack", "hit", "death"] },
  { name: "red-panther-commander", output: "enemies/red-panther-commander-battle-v2.png", identity: "red-panther-commander-identity-master-r1.png", states: ["idle", "move", "attack", "hit", "death"] },
]);

// Reviewed source-space seed coordinates. The map is the repair contract;
// no output candidate or previous generated file is an input.
export const REVIEWED_GAP_SEEDS = Object.freeze({
  "mugarian-president-mutated": {
    attack: [[565,557],[790,361],[654,738],[1010,861],[360,342],[463,506],[664,242],[759,316],[696,263],[836,927],[103,585],[258,486],[862,787]],
    death: [[92,492],[444,318],[579,448],[180,821],[350,359],[104,664],[195,976],[213,1036],[712,786],[827,828],[171,892],[495,449]],
    defeat: [[400,708],[680,316],[484,405],[562,356],[792,403],[834,800],[863,449],[704,439],[153,755],[467,821]],
    entrance: [[678,474],[143,403],[610,681],[165,793],[649,517],[693,448],[646,176],[797,286],[665,839],[657,950],[140,971],[144,1043]],
    hit: [[410,544],[91,343],[739,529],[181,684],[788,293],[676,575],[880,426],[192,857],[788,666],[606,1004],[725,301],[165,757]],
    idle: [[323,652],[665,467],[567,626],[134,407],[179,811],[682,431],[874,811],[636,511],[808,276],[649,162],[915,434],[937,525],[943,629],[123,612],[735,570],[928,496],[586,658],[658,868],[150,903],[169,1014],[174,1095],[535,1123],[691,1104]],
    move: [[366,616],[639,514],[602,695],[122,449],[659,483],[592,201],[752,299],[936,637],[717,600],[864,497],[720,248],[747,262],[627,636]],
    phase: [[350,677],[81,457],[949,270],[660,625],[849,573],[801,554],[984,421],[882,198],[664,567],[568,340],[731,978],[623,224],[800,325]],
  },
  "takuya-omega": {
    attack: [[981,453],[821,239],[969,500],[714,231],[915,323],[913,564],[958,515],[854,588],[803,298],[882,582]],
    death: [[550,265],[663,360],[277,288],[422,248],[461,284],[597,350],[321,338],[497,294],[608,379],[678,396]],
    defeat: [[326,679],[596,322],[775,388],[555,360],[831,444],[703,376],[743,399],[512,374],[807,444]],
    entrance: [[617,544],[387,661],[927,436],[844,242],[673,71],[804,175],[769,123],[782,170],[710,648],[851,314]],
    hit: [[331,631],[825,240],[688,588],[746,736],[875,404],[901,352],[942,440],[818,291],[722,685]],
    idle: [[364,676],[637,563],[658,48],[687,513],[870,278],[959,531],[780,106],[898,389],[704,677],[914,452]],
    move: [[341,772],[581,118],[777,295],[691,151],[706,200],[878,541],[799,417],[863,545],[724,202],[592,168]],
    phase: [[724,558],[811,270],[723,219],[602,184],[793,270],[940,413],[623,224],[800,325],[856,371],[1015,530]],
  },
  "red-panther-knife": { attack: [[164,672],[256,650]] },
  "red-panther-shield": { move: [[419,295],[243,288]] },
  "red-panther-smg": { attack: [[116,324],[790,592]] },
  "red-panther-commander": { attack: [[143,231]] },
});
function absolute(relative) { return path.join(ROOT, relative.replaceAll("/", path.sep)); }
async function fileSha256(file) { return crypto.createHash("sha256").update(await fs.readFile(file)).digest("hex"); }
function pale(data, offset, relaxed) {
  const r = data[offset], g = data[offset + 1], b = data[offset + 2];
  const luma = (r * 299 + g * 587 + b * 114) / 1000;
  return Math.max(r, g, b) - Math.min(r, g, b) <= (relaxed ? 16 : 12) && luma >= (relaxed ? 190 : 205);
}

function repairSource(data, width, height, alphaAuthored, seeds, relaxedSeeds) {
  const rgba = Buffer.from(data);
  const changed = new Uint8Array(width * height);
  const visited = new Uint8Array(width * height);
  const local = (index) => data[index * 4 + 3] === 255 && pale(data, index * 4, relaxedSeeds);
  const edge = (index) => data[index * 4 + 3] === 255 && pale(data, index * 4, false);
  const seedResults = [];
  const flood = (start, predicate) => {
    if (start < 0 || start >= width * height || visited[start] || !predicate(start)) return 0;
    const queue = [start]; visited[start] = 1; let removed = 0;
    while (queue.length) {
      const index = queue.pop(); rgba[index * 4 + 3] = 0; changed[index] = 1; removed += 1;
      const x = index % width, y = Math.floor(index / width);
      for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = ny * width + nx;
        if (!visited[next] && predicate(next)) { visited[next] = 1; queue.push(next); }
      }
    }
    return removed;
  };
  let edgePixels = 0;
  if (!alphaAuthored) {
    for (let x = 0; x < width; x += 1) { edgePixels += flood(x, edge); edgePixels += flood((height - 1) * width + x, edge); }
    for (let y = 1; y < height - 1; y += 1) { edgePixels += flood(y * width, edge); edgePixels += flood(y * width + width - 1, edge); }
  }
  let seedPixels = 0;
  for (const [x, y] of seeds) { const removed = flood(y * width + x, local); seedPixels += removed; seedResults.push({ seed: [x, y], removed }); }
  let changedPixels = 0, alphaChangesOutsideAllowedMask = 0, rgbChangesOutsideAllowedMask = 0;
  for (let i = 0; i < width * height; i += 1) {
    if (changed[i]) changedPixels += 1;
    if (rgba[i * 4 + 3] !== data[i * 4 + 3] && !changed[i]) alphaChangesOutsideAllowedMask += 1;
    for (let channel = 0; channel < 3; channel += 1) if (rgba[i * 4 + channel] !== data[i * 4 + channel]) rgbChangesOutsideAllowedMask += 1;
  }
  return { rgba, changed, stats: { alphaAuthored, seedPalette: relaxedSeeds ? "luma>=190/chroma<=16" : "luma>=205/chroma<=12", edgePixels, seedPixels, seedCount: seeds.length, seedResults, zeroRemovalSeeds: seedResults.filter((entry) => entry.removed === 0).map((entry) => entry.seed), changedPixels, allowedMaskPixels: changedPixels, alphaChangesOutsideAllowedMask, rgbChangesOutsideAllowedMask } };
}

async function prepareFrame(relativeSource, name, state) {
  const source = absolute(relativeSource);
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alphaAuthored = [...data].some((value, index) => index % 4 === 3 && value < 255);
  const repaired = repairSource(data, info.width, info.height, alphaAuthored, REVIEWED_GAP_SEEDS[name]?.[state] ?? [], name === "mugarian-president-mutated" || name === "takuya-omega");
  const fullBuffer = await sharp(repaired.rgba, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  const { data: cleanData, info: cleanInfo } = await sharp(fullBuffer).raw().toBuffer({ resolveWithObject: true });
  let minX = cleanInfo.width, minY = cleanInfo.height, maxX = -1, maxY = -1, alphaPixels = 0;
  for (let i = 0; i < cleanInfo.width * cleanInfo.height; i += 1) if (cleanData[i * 4 + 3]) { const x = i % cleanInfo.width, y = Math.floor(i / cleanInfo.width); minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); alphaPixels += 1; }
  if (maxX < 0) throw new Error(`empty repaired frame: ${relativeSource}`);
  return { fullBuffer, buffer: await sharp(fullBuffer).extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 }).png().toBuffer(), sourceRelativePath: relativeSource, sourceSize: { width: info.width, height: info.height }, sourceBounds: { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1, alphaPixels }, alphaAuthored, sourceHash: await fileSha256(source), repair: repaired.stats };
}

async function place(frame, scale) {
  const metadata = await sharp(frame.buffer).metadata();
  const width = Math.round(Number(metadata.width) * scale), height = Math.round(Number(metadata.height) * scale);
  if (width > CELL_WIDTH - GUTTER * 2 || height > CELL_HEIGHT - GUTTER * 2) throw new Error(`frame exceeds cell: ${frame.sourceRelativePath}`);
  const resized = await sharp(frame.buffer).resize({ width, height, fit: "fill", kernel: "lanczos3" }).png().toBuffer();
  const left = Math.floor((CELL_WIDTH - width) / 2), top = CELL_HEIGHT - height - GUTTER;
  const buffer = await sharp({ create: { width: CELL_WIDTH, height: CELL_HEIGHT, channels: 4, background: TRANSPARENT } }).composite([{ input: resized, left, top }]).png().toBuffer();
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width, minY = info.height, maxX = -1, maxY = -1;
  for (let index = 0; index < info.width * info.height; index += 1) if (data[index * 4 + 3] !== 0) {
    const x = index % info.width, y = Math.floor(index / info.width);
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  if (maxX < 0) throw new Error(`empty placed frame: ${frame.sourceRelativePath}`);
  return { buffer, placementRect: { x: left, y: top, width, height }, contentRect: { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }, renderedSize: { width, height } };
}

export async function regenerateMotionAtlases(outputDirectory, definitions = MOTION_DEFINITIONS) {
  const outputRoot = path.resolve(outputDirectory);
  const records = [];
  for (const definition of definitions) {
    const frames = [];
    for (const state of definition.states) frames.push(await prepareFrame(`assets/source/v100/runtime/motion/${definition.name}/${state}-left-authored-v1.png`, definition.name, state));
    const referenceFrames = frames.filter((_, index) => ["idle", "move", "entrance"].includes(definition.states[index]));
    const referenceHeight = Math.max(...(referenceFrames.length ? referenceFrames : frames).map((frame) => frame.sourceBounds.height));
    const maximumHeight = Math.max(...frames.map((frame) => frame.sourceBounds.height));
    const scale = Math.min((CELL_HEIGHT - GUTTER * 2) / maximumHeight, 468 / referenceHeight);
    const placed = []; for (let index = 0; index < frames.length; index += 1) {
      const item = await place(frames[index], scale);
      placed.push(item);
    }
    const layers = [];
    for (let index = 0; index < placed.length; index += 1) { const left = index * CELL_WIDTH; layers.push({ input: await sharp(placed[index].buffer).flop().png().toBuffer(), left, top: 0 }, { input: placed[index].buffer, left, top: CELL_HEIGHT }); }
    const atlas = await sharp({ create: { width: CELL_WIDTH * definition.states.length, height: CELL_HEIGHT * 2, channels: 4, background: TRANSPARENT } }).composite(layers).png().toBuffer();
    const output = path.join(outputRoot, definition.output);
    await fs.mkdir(path.dirname(output), { recursive: true }); await fs.writeFile(output, atlas);
    const metadata = { format: "nishijin-v100-motion-atlas-metadata", version: 1, repair: "explicit-reviewed-gap-seeds-local-palette", cell: { width: CELL_WIDTH, height: CELL_HEIGHT }, atlas: { width: CELL_WIDTH * definition.states.length, height: CELL_HEIGHT * 2 }, commonScale: scale, sourceDirection: "left-authored", directionRows: { left: "authored", right: "derived-horizontal-flip" }, noClipping: true, groundAnchorPixels: CELL_HEIGHT - GUTTER, identityMaster: `assets/source/v100/enemies/${definition.identity}`, identityMasterSha256: await fileSha256(absolute(`assets/source/v100/enemies/${definition.identity}`)), sources: frames.map((frame) => ({ path: frame.sourceRelativePath, sha256: frame.sourceHash, sourceSize: frame.sourceSize, sourceBounds: frame.sourceBounds, alphaAuthored: frame.alphaAuthored, repair: frame.repair })), frames: definition.states.map((state, index) => ({ state, contentRect: placed[index].contentRect, renderedSize: placed[index].renderedSize, groundAnchorPixels: CELL_HEIGHT - GUTTER, clipped: false })), sha256: crypto.createHash("sha256").update(atlas).digest("hex") };
    await fs.writeFile(output.replace(/\.png$/iu, "-metadata.json"), `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
    records.push({ definition, output, metadata, frames });
  }
  await fs.writeFile(path.join(outputRoot, "provenance.json"), `${JSON.stringify({ format: "nishijin-v100-reviewed-motion-regeneration", sourceRoot: "assets/source/v100/runtime/motion", records: records.map((record) => ({ name: record.definition.name, output: path.relative(ROOT, record.output).replaceAll(path.sep, "/"), sha256: record.metadata.sha256, sources: record.metadata.sources })) }, null, 2)}\n`, "utf8");
  return records;
}
