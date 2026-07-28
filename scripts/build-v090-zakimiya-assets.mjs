import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { buildFormationCard, buildIdentityPortrait } from "./v090-identity-derivatives.mjs";

const root = process.cwd();
const sourceDir = path.join(root, "assets/source/v090/characters");
const publicDir = path.join(root, "public/art/v090/characters");
const identityMaster = path.join(sourceDir, "zakimiya-identity-master-r1.png");
const cutoutSource = path.join(sourceDir, "zakimiya-cutout-source-r1.png");
const poseSource = path.join(sourceDir, "zakimiya-combat-poses-source-r1.png");
const sourceHashes = Object.freeze(new Map([
  [identityMaster, "78405e4610f6d8d71c0e094bcf2cf125522ca9b869db2146e39b9e6122ba88d7"],
  [cutoutSource, "50c0e3bd0ff028a700c5051353f8d5d2a3e28c23ec0fda2c5f0cba63d5ed4259"],
  [poseSource, "3413bb6050ecc712254e5250eab452f7f13e506c35fc3f9150fe24d8710170c9"],
]));

const output = Object.freeze({
  portrait: path.join(publicDir, "portraits/zakimiya-event-portrait-r1.webp"),
  card: path.join(publicDir, "cards/zakimiya-formation-card-r1.webp"),
  battle: path.join(publicDir, "zakimiya-battle-r1.png"),
});

await Promise.all([
  mkdir(path.dirname(output.portrait), { recursive: true }),
  mkdir(path.dirname(output.card), { recursive: true }),
  mkdir(path.dirname(output.battle), { recursive: true }),
]);

for (const [sourcePath, expectedHash] of sourceHashes) {
  const digest = createHash("sha256").update(await readFile(sourcePath)).digest("hex");
  if (digest !== expectedHash) {
    throw new Error(`Unapproved Zakimiya source revision: ${path.relative(root, sourcePath)}`);
  }
}

function chromaAlpha(red, green, blue) {
  const distance = Math.hypot(red, green, 255 - blue);
  if (distance <= 52) return 0;
  if (distance >= 128) return 255;
  return Math.round((distance - 52) * 255 / 76);
}

async function blueScreenCutout(inputPath) {
  const decoded = await sharp(inputPath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const rgba = Buffer.alloc(decoded.info.width * decoded.info.height * 4);
  for (let sourceIndex = 0, targetIndex = 0; sourceIndex < decoded.data.length; sourceIndex += 3, targetIndex += 4) {
    const red = decoded.data[sourceIndex];
    const green = decoded.data[sourceIndex + 1];
    const blue = decoded.data[sourceIndex + 2];
    const alpha = chromaAlpha(red, green, blue);
    rgba[targetIndex] = alpha === 0 ? 0 : red;
    rgba[targetIndex + 1] = alpha === 0 ? 0 : green;
    rgba[targetIndex + 2] = alpha === 0 ? 0 : Math.min(blue, Math.max(red, green) + (alpha === 255 ? 18 : 2));
    rgba[targetIndex + 3] = alpha;
  }
  return {
    pixels: rgba,
    info: decoded.info,
    image: sharp(rgba, {
      raw: { width: decoded.info.width, height: decoded.info.height, channels: 4 },
    }),
  };
}

async function keepLargestAlphaComponent(input) {
  const decoded = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = decoded.info;
  const pixelCount = width * height;
  const visited = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let largest = [];
  for (let start = 0; start < pixelCount; start += 1) {
    if (visited[start] || decoded.data[start * 4 + 3] <= 12) continue;
    let head = 0;
    let tail = 0;
    const component = [];
    queue[tail++] = start;
    visited[start] = 1;
    while (head < tail) {
      const pixel = queue[head++];
      component.push(pixel);
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          if (offsetX === 0 && offsetY === 0) continue;
          const nextX = x + offsetX;
          const nextY = y + offsetY;
          if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;
          const next = nextY * width + nextX;
          if (visited[next] || decoded.data[next * 4 + 3] <= 12) continue;
          visited[next] = 1;
          queue[tail++] = next;
        }
      }
    }
    if (component.length > largest.length) largest = component;
  }
  if (largest.length === 0) throw new Error("Pose contains no visible subject");
  const keep = new Uint8Array(pixelCount);
  for (const pixel of largest) keep[pixel] = 1;
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    if (keep[pixel]) continue;
    const channel = pixel * 4;
    decoded.data[channel] = 0;
    decoded.data[channel + 1] = 0;
    decoded.data[channel + 2] = 0;
    decoded.data[channel + 3] = 0;
  }
  return sharp(decoded.data, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

await buildIdentityPortrait({
  inputPath: identityMaster,
  outputPath: output.portrait,
  upperRatio: .8,
});
await buildFormationCard({
  inputPath: identityMaster,
  outputPath: output.card,
  accent: "#e2a64b",
  roleLabel: "WHISKEY",
  upperRatio: .78,
  motif: `
    <g fill="none" stroke="#e2a64b" stroke-width="12" stroke-linecap="round" stroke-linejoin="round">
      <path d="M346 382 390 426"/>
      <path d="m378 364 58 58-32 32-58-58z"/>
      <path d="m427 362 14-29 13 21 19-7-8 26"/>
    </g>
  `,
});

const poses = await blueScreenCutout(poseSource);
if (poses.info.width !== 1536 || poses.info.height !== 1024) {
  throw new Error(`Unexpected Zakimiya pose sheet geometry ${poses.info.width}x${poses.info.height}`);
}

const poseBounds = Object.freeze([
  { left: 0, width: 190 },
  { left: 184, width: 226 },
  { left: 400, width: 238 },
  { left: 612, width: 262 },
  { left: 812, width: 286 },
  { left: 1090, width: 214 },
  { left: 1160, width: 376 },
]);
const battleStates = Object.freeze([
  { id: "idle", shiftX: 0 },
  { id: "walk-a", shiftX: -5 },
  { id: "walk-b", shiftX: 5 },
  { id: "attack-a", shiftX: 3 },
  { id: "attack-b", shiftX: 8 },
  { id: "hit", shiftX: -6 },
  { id: "death", shiftX: 0 },
]);
const cell = Object.freeze({ width: 480, height: 448, inset: 16 });
const composites = [];

for (let column = 0; column < battleStates.length; column += 1) {
  const bounds = poseBounds[column];
  const region = await sharp(poses.pixels, {
    raw: { width: poses.info.width, height: poses.info.height, channels: 4 },
  })
    .extract({ left: bounds.left, top: 0, width: bounds.width, height: poses.info.height })
    .png()
    .toBuffer();
  const isolated = await keepLargestAlphaComponent(region);
  const trimmed = await sharp(isolated)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 4 })
    .png()
    .toBuffer();
  const posed = await sharp(trimmed)
    .resize({
      width: cell.width - cell.inset * 2,
      height: cell.height - cell.inset * 2,
      fit: "inside",
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer();
  const metadata = await sharp(posed).metadata();
  const left = Math.max(cell.inset, Math.min(
    cell.width - cell.inset - metadata.width,
    Math.round((cell.width - metadata.width) / 2 + battleStates[column].shiftX),
  ));
  const top = cell.height - cell.inset - metadata.height;
  composites.push({ input: posed, left: column * cell.width + left, top });
  composites.push({
    input: await sharp(posed).flop().png().toBuffer(),
    left: column * cell.width + left,
    top: cell.height + top,
  });
}

await sharp({
  create: {
    width: cell.width * battleStates.length,
    height: cell.height * 2,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite(composites)
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile(output.battle);

const decodedAtlas = await sharp(output.battle).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
for (let row = 0; row < 2; row += 1) {
  for (let column = 0; column < battleStates.length; column += 1) {
    for (let y = 0; y < cell.height; y += 1) {
      for (let x = 0; x < cell.width; x += 1) {
        const mirroredX = row === 0 ? x : cell.width - 1 - x;
        const remove = (column === 3 && mirroredX > 310 && y > 200)
          || (column === 4 && mirroredX < 160 && y > 200)
          || (column === 5 && mirroredX < 220 && y > 260)
          || (column === 6 && (y < 270 || mirroredX < 220));
        if (!remove) continue;
        const channel = ((row * cell.height + y) * decodedAtlas.info.width + column * cell.width + x) * 4;
        decodedAtlas.data[channel] = 0;
        decodedAtlas.data[channel + 1] = 0;
        decodedAtlas.data[channel + 2] = 0;
        decodedAtlas.data[channel + 3] = 0;
      }
    }
  }
}
await sharp(decodedAtlas.data, {
  raw: { width: decodedAtlas.info.width, height: decodedAtlas.info.height, channels: 4 },
})
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile(output.battle);

const visible = {};
for (let row = 0; row < 2; row += 1) {
  const direction = row === 0 ? "right" : "left";
  visible[direction] = battleStates.map((state, column) => {
    let left = cell.width;
    let top = cell.height;
    let right = -1;
    let bottom = -1;
    for (let y = 0; y < cell.height; y += 1) {
      for (let x = 0; x < cell.width; x += 1) {
        const pixel = ((row * cell.height + y) * decodedAtlas.info.width + column * cell.width + x) * 4;
        if (decodedAtlas.data[pixel + 3] <= 8) continue;
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x + 1);
        bottom = Math.max(bottom, y + 1);
      }
    }
    if (right < left || bottom < top) throw new Error(`No visible Zakimiya pixels for ${direction}/${state.id}`);
    return [left, top, right, bottom];
  });
}

console.log(JSON.stringify({
  message: "Built Version 0.9.0 Zakimiya event portrait, card, and battle atlas.",
  battleVisible: visible,
}, null, 2));
