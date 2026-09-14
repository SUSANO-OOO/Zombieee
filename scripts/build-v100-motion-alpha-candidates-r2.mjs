import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const CELL_WIDTH = 544;
const CELL_HEIGHT = 512;
const ATLAS_HEIGHT = CELL_HEIGHT * 2;
const GUTTER = 16;
const OUT_ROOT = "outputs/completion/motion-alpha-candidates-r2";
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

function absolute(p) { return path.join(ROOT, p.replaceAll("/", path.sep)); }
async function sha256(p) { return crypto.createHash("sha256").update(await fs.readFile(p)).digest("hex"); }

// The authored sources are either true RGBA or opaque renders with a pale,
// neutral checkerboard matte.  The old cleaner only flood-filled the latter
// from the outside when alpha was present, leaving large enclosed matte gaps.
// This repair keeps the same pale predicate, but also removes only sizable
// enclosed components that match the measured border matte palette.  Small
// neutral highlights remain authored pixels.
function repairPaleMatte(data, width, height) {
  const rgba = Buffer.from(data);
  let hasTransparency = false;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 255) { hasTransparency = true; break; }
  const borderLuma = [];
  const neutral = (offset) => {
    const r = data[offset], g = data[offset + 1], b = data[offset + 2];
    const luma = (r * 299 + g * 587 + b * 114) / 1000;
    return { luma, spread: Math.max(r, g, b) - Math.min(r, g, b), r, g, b };
  };
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    if (x !== 0 && x !== width - 1 && y !== 0 && y !== height - 1) continue;
    const n = neutral((y * width + x) * 4);
    if (data[(y * width + x) * 4 + 3] === 255 && n.spread <= 16 && n.luma >= 190) borderLuma.push(n.luma);
  }
  if (!borderLuma.length) return { rgba, stats: { hasTransparency, repairedPixels: 0, enclosedComponents: 0, borderComponents: 0 } };
  borderLuma.sort((a, b) => a - b);
  const paletteMedian = borderLuma[Math.floor(borderLuma.length / 2)];
  const matte = (index) => {
    const alpha = data[index * 4 + 3];
    if (alpha !== 255) return false;
    const n = neutral(index * 4);
    return n.spread <= 16 && n.luma >= 190 && Math.abs(n.luma - paletteMedian) <= 50;
  };
  const visited = new Uint8Array(width * height);
  const components = [];
  for (let start = 0; start < width * height; start += 1) {
    if (visited[start] || !matte(start)) continue;
    const stack = [start]; visited[start] = 1; const pixels = [];
    let touchesBorder = false;
    while (stack.length) {
      const index = stack.pop(); pixels.push(index);
      const x = index % width; const y = Math.floor(index / width);
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) touchesBorder = true;
      for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
        if (!dx && !dy) continue;
        const nx = x + dx; const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = ny * width + nx;
        if (!visited[next] && matte(next)) { visited[next] = 1; stack.push(next); }
      }
    }
    components.push({ pixels, touchesBorder });
  }
  let repairedPixels = 0, enclosedComponents = 0, borderComponents = 0;
  for (const component of components) {
    const repair = component.touchesBorder || (!hasTransparency && component.pixels.length >= 16) || (hasTransparency && component.pixels.length >= 16);
    if (!repair) continue;
    if (component.touchesBorder) borderComponents += 1; else enclosedComponents += 1;
    for (const index of component.pixels) { rgba[index * 4 + 3] = 0; repairedPixels += 1; }
  }
  return { rgba, stats: { hasTransparency, repairedPixels, enclosedComponents, borderComponents, borderPaletteMedianLuma: paletteMedian, matteComponents: components.length } };
}

function alphaBounds(data, width, height) {
  let minX = width, minY = height, maxX = -1, maxY = -1, alphaPixels = 0;
  for (let i = 0; i < width * height; i += 1) if (data[i * 4 + 3]) {
    const x = i % width, y = Math.floor(i / width); alphaPixels += 1;
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  return maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1, alphaPixels };
}

async function cleanFrame(relativePath) {
  const sourcePath = absolute(relativePath);
  const { data, info } = await sharp(sourcePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const repaired = repairPaleMatte(data, info.width, info.height);
  const clean = await sharp(repaired.rgba, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  const { data: cleanData, info: cleanInfo } = await sharp(clean).raw().toBuffer({ resolveWithObject: true });
  const bounds = alphaBounds(cleanData, cleanInfo.width, cleanInfo.height);
  if (!bounds) throw new Error(`empty repaired frame: ${relativePath}`);
  return { buffer: await sharp(clean).extract({ left: bounds.x, top: bounds.y, width: bounds.width, height: bounds.height }).png().toBuffer(), sourceRelativePath: relativePath, sourceSize: { width: info.width, height: info.height }, sourceBounds: bounds, repair: repaired.stats };
}

async function place(frame, scale) {
  const m = await sharp(frame.buffer).metadata();
  const width = Math.max(1, Math.round(Number(m.width) * scale));
  const height = Math.max(1, Math.round(Number(m.height) * scale));
  if (width > CELL_WIDTH - GUTTER * 2 || height > CELL_HEIGHT - GUTTER * 2) throw new Error(`frame exceeds cell: ${frame.sourceRelativePath}`);
  const resized = await sharp(frame.buffer).resize({ width, height, fit: "fill", kernel: "lanczos3" }).png().toBuffer();
  const left = Math.floor((CELL_WIDTH - width) / 2); const top = CELL_HEIGHT - height - GUTTER;
  return { buffer: await sharp({ create: { width: CELL_WIDTH, height: CELL_HEIGHT, channels: 4, background: TRANSPARENT } }).composite([{ input: resized, left, top }]).png().toBuffer(), contentRect: { x: left, y: top, width, height }, renderedSize: { width, height } };
}

const DEFINITIONS = [
  ["bosses/mugarian-president-mutated", "mugarian-president-mutated", "mugarian-president-mutated-identity-master-r4.png", ["entrance", "idle", "move", "attack", "hit", "phase", "death", "defeat"]],
  ["bosses/takuya-omega", "takuya-omega", "takuya-omega-identity-master-r2.png", ["entrance", "idle", "move", "attack", "hit", "phase", "death", "defeat"]],
  ["enemies/red-panther-knife", "red-panther-knife", "red-panther-knife-identity-master-r1.png", ["idle", "move", "attack", "hit", "death"]],
  ["enemies/red-panther-shield", "red-panther-shield", "red-panther-shield-identity-master-r1.png", ["idle", "move", "attack", "hit", "death"]],
  ["enemies/red-panther-smg", "red-panther-smg", "red-panther-smg-identity-master-r1.png", ["idle", "move", "attack", "hit", "death"]],
  ["enemies/red-panther-commander", "red-panther-commander", "red-panther-commander-identity-master-r1.png", ["idle", "move", "attack", "hit", "death"]],
];

async function buildOne([outStem, name, identity, states]) {
  const dir = `assets/source/v100/runtime/motion/${name}`;
  const frames = [];
  for (const state of states) frames.push(await cleanFrame(`${dir}/${state}-left-authored-v1.png`));
  const references = frames.filter((_, i) => ["idle", "move", "entrance"].includes(states[i]));
  const identityRef = references.length ? references : frames;
  const referenceHeight = Math.max(...identityRef.map((f) => f.sourceBounds.height));
  const maximumHeight = Math.max(...frames.map((f) => f.sourceBounds.height));
  const scale = Math.min((CELL_HEIGHT - GUTTER * 2) / maximumHeight, 468 / referenceHeight);
  const placed = []; for (const frame of frames) placed.push(await place(frame, scale));
  const layers = [];
  for (let i = 0; i < placed.length; i += 1) { const left = i * CELL_WIDTH; layers.push({ input: await sharp(placed[i].buffer).flop().png().toBuffer(), left, top: 0 }); layers.push({ input: placed[i].buffer, left, top: CELL_HEIGHT }); }
  const atlas = await sharp({ create: { width: CELL_WIDTH * states.length, height: ATLAS_HEIGHT, channels: 4, background: TRANSPARENT } }).composite(layers).png().toBuffer();
  const outputRelativePath = `${OUT_ROOT}/${outStem}-battle-r2.png`; const outputPath = absolute(outputRelativePath); await fs.mkdir(path.dirname(outputPath), { recursive: true }); await fs.writeFile(outputPath, atlas);
  const sourcePaths = frames.map((f) => f.sourceRelativePath);
  const metadata = { format: "nishijin-v100-motion-atlas-alpha-candidate", version: 2, repair: "bounded-pale-matte-component-segmentation", cell: { width: CELL_WIDTH, height: CELL_HEIGHT }, atlas: { width: CELL_WIDTH * states.length, height: ATLAS_HEIGHT }, commonScale: scale, sourceDirection: "left-authored", directionRows: { left: "authored", right: "derived-horizontal-flip" }, identityMaster: `assets/source/v100/enemies/${identity}`, identityMasterSha256: await sha256(absolute(`assets/source/v100/enemies/${identity}`)), sources: await Promise.all(frames.map(async (f) => ({ path: f.sourceRelativePath, sha256: await sha256(absolute(f.sourceRelativePath)), sourceSize: f.sourceSize, sourceBounds: f.sourceBounds, repair: f.repair }))), frames: states.map((state, i) => ({ state, contentRect: placed[i].contentRect, renderedSize: placed[i].renderedSize, clipped: false })), sha256: crypto.createHash("sha256").update(atlas).digest("hex") };
  await fs.writeFile(absolute(`${OUT_ROOT}/${outStem}-battle-r2-metadata.json`), `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  return { name, outputRelativePath, metadata, identity, sourcePaths };
}

async function contactSheets(records) {
  const backgrounds = [{ name: "dark", color: { r: 8, g: 10, b: 18, alpha: 1 } }, { name: "light", color: { r: 244, g: 244, b: 240, alpha: 1 } }, { name: "colored", color: { r: 55, g: 86, b: 112, alpha: 1 } }];
  for (const bg of backgrounds) {
    const tiles = [];
    for (const record of records) {
      const image = await sharp(absolute(record.outputRelativePath)).flatten({ background: bg.color }).resize({ width: 720 }).png().toBuffer();
      tiles.push(image);
    }
    const tileWidth = 720, tileHeight = 169, cols = 2, rows = Math.ceil(tiles.length / cols);
    const composites = []; for (let i = 0; i < tiles.length; i += 1) composites.push({ input: tiles[i], left: (i % cols) * tileWidth, top: Math.floor(i / cols) * tileHeight });
    const out = `${OUT_ROOT}/contact-sheet-${bg.name}.png`; await sharp({ create: { width: cols * tileWidth, height: rows * tileHeight, channels: 4, background: bg.color } }).composite(composites).png().toFile(absolute(out));
  }
}

async function main() {
  const records = []; for (const definition of DEFINITIONS) records.push(await buildOne(definition)); await contactSheets(records);
  const audit = { format: "nishijin-v100-motion-alpha-candidate-audit", version: 2, generatedBy: "scripts/build-v100-motion-alpha-candidates-r2.mjs", immutableSources: true, validation: { sourceHashesRecorded: true, candidateDimensions: "544px cells x 512px; two rows; no clipping", repairScope: "only neutral pale matte components (border flood plus enclosed component size >= 16)", darkBodyAndColoredDetailsUntouchedByPredicate: true, ambiguousFrames: [] }, candidates: records.map((r) => ({ name: r.name, output: r.outputRelativePath, outputSha256: r.metadata.sha256, identityMaster: r.identity, sources: r.metadata.sources })), contactSheets: ["dark", "light", "colored"].map((name) => `${OUT_ROOT}/contact-sheet-${name}.png`) };
  await fs.writeFile(absolute(`${OUT_ROOT}/motion-alpha-candidates-r2-audit.json`), `${JSON.stringify(audit, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(audit, null, 2));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(e.stack || e.message); process.exitCode = 1; });
