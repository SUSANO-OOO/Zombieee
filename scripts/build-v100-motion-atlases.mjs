import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
// Wide cells keep the authored lunge and fall poses at the same vertical
// content scale as standing frames. A narrow square forced wide poses to
// shrink the whole character and weapon just to fit the cell.
const CELL_WIDTH = 1280;
const CELL_HEIGHT = 512;
const ATLAS_HEIGHT = CELL_HEIGHT * 2;
const MOTION_GUTTER = 16;
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

function absolute(relativePath) {
  return path.join(ROOT, relativePath.replaceAll("/", path.sep));
}

async function sha256(filePath) {
  return crypto.createHash("sha256").update(await fs.readFile(filePath)).digest("hex");
}

function isNeutralBright(data, offset) {
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  const spread = Math.max(red, green, blue) - Math.min(red, green, blue);
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000;
  return spread <= 12 && luminance >= 205;
}

function isNeutralDark(data, offset) {
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  const spread = Math.max(red, green, blue) - Math.min(red, green, blue);
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000;
  return spread <= 16 && luminance <= 52;
}

function floodBackground(data, alpha, width, height) {
  const background = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  const enqueue = (x, y) => {
    const index = y * width + x;
    if (background[index] === 1) return;
    if (alpha[index] === 0) return;
    const offset = index * 4;
    if (!isNeutralBright(data, offset) && !isNeutralDark(data, offset)) return;
    background[index] = 1;
    queue[tail] = index;
    tail += 1;
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  while (head < tail) {
    const index = queue[head];
    head += 1;
    const x = index % width;
    const y = Math.floor(index / width);
    for (const [nextX, nextY] of [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
      [x - 1, y - 1],
      [x + 1, y - 1],
      [x - 1, y + 1],
      [x + 1, y + 1],
    ]) {
      if (nextX >= 0 && nextX < width && nextY >= 0 && nextY < height) enqueue(nextX, nextY);
    }
  }

  return background;
}

async function removeCheckerboard(sourcePath) {
  const { data, info } = await sharp(sourcePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alpha = new Uint8Array(info.width * info.height);
  for (let index = 0; index < alpha.length; index += 1) alpha[index] = data[index * 4 + 3];
  const background = floodBackground(data, alpha, info.width, info.height);
  const rgba = Buffer.alloc(info.width * info.height * 4);
  for (let index = 0; index < info.width * info.height; index += 1) {
    const sourceOffset = index * 4;
    const targetOffset = index * 4;
    rgba[targetOffset] = data[sourceOffset];
    rgba[targetOffset + 1] = data[sourceOffset + 1];
    rgba[targetOffset + 2] = data[sourceOffset + 2];
    // Remove only border-connected checkerboard pixels. White hair, blades,
    // eyes and highlights are part of the approved identity and must survive
    // alpha cleanup; deleting every neutral-white pixel silently damages the
    // character design.
    rgba[targetOffset + 3] = alpha[index] < 32 || background[index] === 1 ? 0 : alpha[index];
  }
  return sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

async function removeDetachedGroundShadow(cleanBuffer) {
  const { data, info } = await sharp(cleanBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const visited = new Uint8Array(info.width * info.height);
  const components = [];
  for (let start = 0; start < info.width * info.height; start += 1) {
    if (visited[start] === 1 || data[start * 4 + 3] === 0) continue;
    const queue = [start];
    visited[start] = 1;
    const pixels = [];
    let minX = info.width;
    let minY = info.height;
    let maxX = -1;
    let maxY = -1;
    let sumLuminance = 0;
    let sumSpread = 0;
    while (queue.length > 0) {
      const index = queue.pop();
      pixels.push(index);
      const x = index % info.width;
      const y = Math.floor(index / info.width);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      const offset = index * 4;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      sumLuminance += (red * 299 + green * 587 + blue * 114) / 1000;
      sumSpread += Math.max(red, green, blue) - Math.min(red, green, blue);
      const xStart = Math.max(0, x - 1);
      const xEnd = Math.min(info.width - 1, x + 1);
      const yStart = Math.max(0, y - 1);
      const yEnd = Math.min(info.height - 1, y + 1);
      for (let nextY = yStart; nextY <= yEnd; nextY += 1) {
        for (let nextX = xStart; nextX <= xEnd; nextX += 1) {
          const next = nextY * info.width + nextX;
          if (visited[next] === 1 || data[next * 4 + 3] === 0) continue;
          visited[next] = 1;
          queue.push(next);
        }
      }
    }
    components.push({ pixels, minX, minY, maxX, maxY, sumLuminance, sumSpread });
  }
  for (const component of components) {
    const width = component.maxX - component.minX + 1;
    const height = component.maxY - component.minY + 1;
    const meanLuminance = component.sumLuminance / component.pixels.length;
    const meanSpread = component.sumSpread / component.pixels.length;
    const isGroundShadow = component.maxY >= info.height - 48 && height <= 48 && width >= 40 && meanSpread <= 22 && meanLuminance >= 70;
    if (!isGroundShadow) continue;
    for (const index of component.pixels) data[index * 4 + 3] = 0;
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

function alphaBounds(data, info) {
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;
  let alphaPixels = 0;
  for (let index = 0; index < info.width * info.height; index += 1) {
    if (data[index * 4 + 3] === 0) continue;
    alphaPixels += 1;
    const x = index % info.width;
    const y = Math.floor(index / info.width);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  if (maxX < 0) return null;
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    alphaPixels,
  };
}

async function cleanedSubject(sourceRelativePath) {
  const sourcePath = absolute(sourceRelativePath);
  const clean = await removeDetachedGroundShadow(await removeCheckerboard(sourcePath));
  const { data, info } = await sharp(clean).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const bounds = alphaBounds(data, info);
  if (!bounds || bounds.alphaPixels < 16) throw new Error(`empty motion frame: ${sourceRelativePath}`);
  const subject = await sharp(clean)
    .extract({ left: bounds.x, top: bounds.y, width: bounds.width, height: bounds.height })
    .png()
    .toBuffer();
  return {
    buffer: subject,
    sourceRelativePath,
    sourceSize: { width: info.width, height: info.height },
    sourceBounds: bounds,
  };
}

async function placeSubject(frame, scale) {
  const subjectMetadata = await sharp(frame.buffer).metadata();
  const width = Math.max(1, Math.round(Number(subjectMetadata.width) * scale));
  const height = Math.max(1, Math.round(Number(subjectMetadata.height) * scale));
  const gutter = MOTION_GUTTER;
  if (width > CELL_WIDTH - gutter * 2 || height > CELL_HEIGHT - gutter * 2) {
    throw new Error(`motion frame exceeds calibrated cell: ${frame.sourceRelativePath} rendered=${width}x${height} cell=${CELL_WIDTH}x${CELL_HEIGHT}`);
  }
  const resized = await sharp(frame.buffer)
    .resize({ width, height, fit: "fill", kernel: "lanczos3" })
    .png()
    .toBuffer();
  const left = Math.floor((CELL_WIDTH - width) / 2);
  const top = CELL_HEIGHT - height - gutter;
  if (left < gutter || top < gutter || left + width > CELL_WIDTH - gutter || top + height > CELL_HEIGHT - gutter) {
    throw new Error(`motion frame would clip calibrated gutter: ${frame.sourceRelativePath} rect=${left},${top},${width},${height}`);
  }
  const buffer = await sharp({
    create: { width: CELL_WIDTH, height: CELL_HEIGHT, channels: 4, background: TRANSPARENT },
  })
    .composite([{ input: resized, left, top }])
    .png()
    .toBuffer();
  return {
    buffer,
    contentRect: { x: left, y: top, width, height },
    renderedSize: { width, height },
  };
}

async function buildAtlas({ frameDirectory, outputRelativePath, identityMaster, weaponScalePolicy, states }) {
  const sourcePaths = states.map((state) => `${frameDirectory}/${state}-left-authored-v1.png`);
  const cleanedFrames = [];
  for (let index = 0; index < states.length; index += 1) cleanedFrames.push(await cleanedSubject(sourcePaths[index]));
  const referenceFrames = cleanedFrames.filter((frame, index) => ["idle", "move", "entrance"].includes(states[index]));
  const identityReference = referenceFrames.length > 0 ? referenceFrames : cleanedFrames;
  const referenceHeight = Math.max(...identityReference.map((frame) => frame.sourceBounds.height));
  const maximumHeight = Math.max(...cleanedFrames.map((frame) => frame.sourceBounds.height));
  const maximumWidth = Math.max(...cleanedFrames.map((frame) => frame.sourceBounds.width));
  // One scale is calculated for the complete motion set. The standing/move
  // frames establish the identity body size; attack and death may become
  // wider or lower, but they never get independently shrunk into a cell.
  const scale = Math.min(
    (CELL_HEIGHT - MOTION_GUTTER * 2) / maximumHeight,
    (CELL_WIDTH - MOTION_GUTTER * 2) / maximumWidth,
    468 / referenceHeight,
  );
  if (!Number.isFinite(scale) || scale <= 0) throw new Error(`invalid common motion scale: ${outputRelativePath}`);
  const frames = [];
  for (const frame of cleanedFrames) frames.push(await placeSubject(frame, scale));

  const layers = [];
  for (let index = 0; index < frames.length; index += 1) {
    const left = index * CELL_WIDTH;
    // The authored source is the bottom row. The top row is derived only by
    // horizontal mirroring, so no state can silently change facing direction.
    layers.push({ input: await sharp(frames[index].buffer).flop().png().toBuffer(), left, top: 0 });
    layers.push({ input: frames[index].buffer, left, top: CELL_HEIGHT });
  }
  const atlas = await sharp({
    create: { width: CELL_WIDTH * states.length, height: ATLAS_HEIGHT, channels: 4, background: TRANSPARENT },
  })
    .composite(layers)
    .png()
    .toBuffer();
  const outputPath = absolute(outputRelativePath);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, atlas);
  const metadataRelativePath = outputRelativePath.replace(/\.png$/iu, "-metadata.json");
  const metadataPath = absolute(metadataRelativePath);
  const frameMetadata = states.map((state, index) => ({
    state,
    source: cleanedFrames[index].sourceRelativePath,
    sourceSize: cleanedFrames[index].sourceSize,
    sourceBounds: cleanedFrames[index].sourceBounds,
    contentRect: frames[index].contentRect,
    renderedSize: frames[index].renderedSize,
    row: { left: "authored", right: "derived-horizontal-flip" },
    clipped: false,
  }));
  const persistedMetadata = {
    format: "nishijin-v100-motion-atlas-metadata",
    version: 1,
    cell: { width: CELL_WIDTH, height: CELL_HEIGHT },
    atlas: { width: CELL_WIDTH * states.length, height: ATLAS_HEIGHT },
    commonScale: scale,
    identityReferenceStates: identityReference.map((frame) => frame.sourceRelativePath.split("/").at(-1)?.replace("-left-authored-v1.png", "") ?? ""),
    referenceHeight,
    sourceDirection: "left-authored",
    directionRows: { left: "authored", right: "derived-horizontal-flip" },
    frames: frameMetadata,
    noClipping: frameMetadata.every((frame) => frame.clipped === false),
  };
  await fs.writeFile(metadataPath, `${JSON.stringify(persistedMetadata, null, 2)}\n`, "utf8");
  const metadata = await sharp(atlas).metadata();
  return {
    path: `/${outputRelativePath.replaceAll("\\", "/")}`,
    kind: "runtime-atlas",
    format: "png",
    width: metadata.width,
    height: metadata.height,
    channels: metadata.channels,
    hasAlpha: metadata.hasAlpha === true,
    sha256: crypto.createHash("sha256").update(atlas).digest("hex"),
    metadataPath: `/${metadataRelativePath.replaceAll("\\", "/")}`,
    commonScale: scale,
    cell: { width: CELL_WIDTH, height: CELL_HEIGHT },
    noClipping: true,
    frameMetadata,
    sources: [...sourcePaths, ...(identityMaster ? [identityMaster] : [])],
    sourceDirection: "left-authored",
    directionRows: { right: "derived-horizontal-flip", left: "authored" },
    identityMaster,
    weaponScalePolicy,
    semanticStates: states.map((state) => ({ state, rightRow: `${state}:right`, leftRow: `${state}:left` })),
  };
}

export const V100_MOTION_DEFINITIONS = Object.freeze([
  {
    frameDirectory: "assets/source/v100/runtime/motion/mugarian-president-mutated",
    outputRelativePath: "public/art/v100/bosses/mugarian-president-mutated-battle-v1.png",
    identityMaster: "assets/source/v100/enemies/mugarian-president-mutated-identity-master-r4.png",
    weaponScalePolicy: "identity-master-locked; mutated president preserves the original hooked staff and oversized arm silhouette in every authored state",
    states: ["entrance", "idle", "move", "attack", "hit", "phase", "death", "defeat"],
  },
  {
    frameDirectory: "assets/source/v100/runtime/motion/takuya-omega",
    outputRelativePath: "public/art/v100/bosses/takuya-omega-battle-v1.png",
    identityMaster: "assets/source/v100/enemies/takuya-omega-identity-master-r2.png",
    weaponScalePolicy: "identity-master-locked; oversized serrated greatsword keeps the same blade length and width from hand to near-ankle across every authored state",
    states: ["entrance", "idle", "move", "attack", "hit", "phase", "death", "defeat"],
  },
  {
    frameDirectory: "assets/source/v100/runtime/motion/red-panther-knife",
    outputRelativePath: "public/art/v100/enemies/red-panther-knife-battle-v1.png",
    identityMaster: "assets/source/v100/enemies/red-panther-knife-identity-master-r1.png",
    weaponScalePolicy: "identity-master-locked; serrated combat knife keeps the same blade length, width and hand attachment across all authored states",
    states: ["idle", "move", "attack", "hit", "death"],
  },
  {
    frameDirectory: "assets/source/v100/runtime/motion/red-panther-shield",
    outputRelativePath: "public/art/v100/enemies/red-panther-shield-battle-v1.png",
    identityMaster: "assets/source/v100/enemies/red-panther-shield-identity-master-r1.png",
    weaponScalePolicy: "identity-master-locked; riot shield keeps the same full body-covering rectangle, viewing slit and red claw marks across all authored states",
    states: ["idle", "move", "attack", "hit", "death"],
  },
  {
    frameDirectory: "assets/source/v100/runtime/motion/red-panther-smg",
    outputRelativePath: "public/art/v100/enemies/red-panther-smg-battle-v1.png",
    identityMaster: "assets/source/v100/enemies/red-panther-smg-identity-master-r1.png",
    weaponScalePolicy: "identity-master-locked; compact suppressed SMG keeps the same silhouette, suppressor and magazine scale across all authored states",
    states: ["idle", "move", "attack", "hit", "death"],
  },
  {
    frameDirectory: "assets/source/v100/runtime/motion/red-panther-commander",
    outputRelativePath: "public/art/v100/enemies/red-panther-commander-battle-v1.png",
    identityMaster: "assets/source/v100/enemies/red-panther-commander-identity-master-r1.png",
    weaponScalePolicy: "identity-master-locked; compact sidearm keeps the same silhouette and hand attachment across all authored states",
    states: ["idle", "move", "attack", "hit", "death"],
  },
]);

export async function buildV100MotionAtlases() {
  const records = [];
  for (const motion of V100_MOTION_DEFINITIONS) {
    const sourcePaths = motion.states.map((state) => `${motion.frameDirectory}/${state}-left-authored-v1.png`);
    if (motion.identityMaster) records.push({ source: { path: motion.identityMaster, sha256: await sha256(absolute(motion.identityMaster)) } });
    for (const sourcePath of sourcePaths) {
      records.push({ source: { path: sourcePath, sha256: await sha256(absolute(sourcePath)) } });
    }
    records.push({
      output: await buildAtlas(motion),
    });
  }
  return records;
}

async function main() {
  console.log(JSON.stringify({ records: await buildV100MotionAtlases() }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
