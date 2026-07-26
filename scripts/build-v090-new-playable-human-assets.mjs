import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const root = process.cwd();
const sourceDir = path.join(root, "assets/source/v090/characters");
const publicDir = path.join(root, "public/art/v090/characters");
const cell = Object.freeze({ width: 480, height: 448, inset: 16 });
const battleStates = Object.freeze([
  "idle",
  "walk-a",
  "walk-b",
  "attack-a",
  "attack-b",
  "hit",
  "death",
]);

const characters = Object.freeze([
  Object.freeze({
    kind: "tky",
    label: "TKY",
    identity: "tky-identity-master-r1.png",
    poses: "tky-combat-poses-source-r1.png",
    identityHash: "6897a7406bcb6fc36b3e376f0f6db8c9240c83641e71e013a6252458531917c8",
    posesHash: "30aac55739f7e13ceb5d026b8fc2ea24d1cb194e737c9fb06e9cfa9a73acdc43",
    poseSize: [1774, 887],
    poseBounds: [
      [0, 230],
      [180, 330],
      [420, 340],
      [650, 470],
      [960, 390],
      [1240, 380],
      [1410, 364],
    ],
    accent: "#ff42c8",
    roleLabel: "LIGHT BLADE",
    cardMotif: `
      <path d="M343 390 448 285" stroke="#fff" stroke-width="13" stroke-linecap="round"/>
      <path d="M343 390 448 285" stroke="#ff42c8" stroke-width="27" stroke-linecap="round" opacity=".72"/>
      <path d="M322 411 353 380" stroke="#c7cbd3" stroke-width="18" stroke-linecap="round"/>
      <path d="M310 423q77 46 162-12" fill="none" stroke="#ff42c8" stroke-width="9" stroke-linecap="round"/>
    `,
  }),
  Object.freeze({
    kind: "mrs-chiha",
    label: "Mrs.チハ",
    identity: "mrs-chiha-identity-master-r1.png",
    poses: "mrs-chiha-combat-poses-source-r1.png",
    identityHash: "5f7b3cb8047804b595d5de57727e34a39fdd7eb6744a2ed859ebd22bb42f3b83",
    posesHash: "7c65486d12449639d919dea2a2306eb01602ffbb0d0f5a826189affa59396304",
    poseSize: [1774, 887],
    poseBounds: [
      [0, 220],
      [170, 330],
      [400, 330],
      [610, 430],
      [880, 520],
      [1190, 410],
      [1390, 384],
    ],
    accent: "#cf9f50",
    roleLabel: "FULL SALVO",
    cardMotif: `
      <circle cx="390" cy="374" r="54" fill="none" stroke="#cf9f50" stroke-width="12"/>
      <circle cx="390" cy="374" r="21" fill="none" stroke="#fff" stroke-width="9"/>
      <path d="M390 320v108M336 374h108M351 335l78 78M429 335l-78 78" stroke="#cf9f50" stroke-width="8"/>
      <circle cx="463" cy="330" r="9" fill="#fff"/><circle cx="465" cy="374" r="9" fill="#fff"/><circle cx="452" cy="415" r="9" fill="#fff"/>
    `,
  }),
  Object.freeze({
    kind: "miyamoto-musashi",
    label: "宮本武蔵",
    identity: "miyamoto-musashi-identity-master-r1.png",
    poses: "miyamoto-musashi-combat-poses-source-r1.png",
    identityHash: "9d2a1ee6e8dd56b5993a1386bcecaa89c219b83cd77a0aaadab080553f6182e9",
    posesHash: "8e3b9f08faf1ff7d5cf2eaabc85ca6c4cdd2b80eaa7fb8718f338afeedb17af5",
    poseSize: [1536, 1024],
    poseBounds: [
      [0, 280],
      [210, 300],
      [420, 300],
      [600, 380],
      [800, 370],
      [1010, 330],
      [1190, 346],
    ],
    accent: "#6b90b2",
    roleLabel: "NITEN ICHIRYU",
    cardMotif: `
      <circle cx="397" cy="375" r="43" fill="none" stroke="#6b90b2" stroke-width="9"/>
      <path d="M327 435 459 303M330 306l130 130" stroke="#fff" stroke-width="11" stroke-linecap="round"/>
      <path d="M312 449l31-31M313 292l31 31" stroke="#6b90b2" stroke-width="17" stroke-linecap="round"/>
    `,
  }),
]);

await Promise.all([
  mkdir(path.join(publicDir, "portraits"), { recursive: true }),
  mkdir(path.join(publicDir, "cards"), { recursive: true }),
]);

async function verifyHash(filePath, expectedHash) {
  const digest = createHash("sha256").update(await readFile(filePath)).digest("hex");
  if (digest !== expectedHash) {
    throw new Error(`Unapproved Version 0.9.0 source revision: ${path.relative(root, filePath)}`);
  }
}

function chromaAlpha(red, green, blue) {
  const distance = Math.hypot(red, green, 255 - blue);
  if (distance <= 48) return 0;
  if (distance >= 124) return 255;
  return Math.round((distance - 48) * 255 / 76);
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
  return Object.freeze({ pixels: rgba, info: decoded.info });
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
    decoded.data.fill(0, channel, channel + 4);
  }
  return sharp(decoded.data, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

async function buildPortraitAndCard(character, identityPath) {
  const portraitPath = path.join(publicDir, `portraits/${character.kind}-event-portrait-r1.webp`);
  const cardPath = path.join(publicDir, `cards/${character.kind}-formation-card-r1.webp`);
  await sharp(identityPath)
    .resize(512, 640, { fit: "cover", position: "north", kernel: sharp.kernel.lanczos3 })
    .webp({ quality: 94, effort: 6 })
    .toFile(portraitPath);
  const cardSubject = await sharp(identityPath)
    .resize(512, 512, { fit: "cover", position: "north", kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  const overlay = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
      <rect x="16" y="16" width="10" height="480" rx="5" fill="${character.accent}"/>
      <path d="M292 330h204v166H264l28-166z" fill="#090d12" fill-opacity=".9" stroke="${character.accent}" stroke-width="5"/>
      ${character.cardMotif}
      <text x="474" y="480" text-anchor="end" font-family="Arial,sans-serif" font-weight="900" font-size="22" letter-spacing="1.5" fill="#fff">${character.roleLabel}</text>
    </svg>
  `);
  await sharp(cardSubject)
    .composite([{ input: overlay }])
    .webp({ quality: 93, effort: 6 })
    .toFile(cardPath);
  return Object.freeze({ portraitPath, cardPath });
}

async function buildBattleAtlas(character, posesPath) {
  const outputPath = path.join(publicDir, `${character.kind}-battle-r1.png`);
  const poses = await blueScreenCutout(posesPath);
  if (poses.info.width !== character.poseSize[0] || poses.info.height !== character.poseSize[1]) {
    throw new Error(`Unexpected ${character.label} pose geometry ${poses.info.width}x${poses.info.height}`);
  }
  const composites = [];
  for (let column = 0; column < battleStates.length; column += 1) {
    const [left, width] = character.poseBounds[column];
    const region = await sharp(poses.pixels, {
      raw: { width: poses.info.width, height: poses.info.height, channels: 4 },
    })
      .extract({ left, top: 0, width, height: poses.info.height })
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
    const cellLeft = Math.round((cell.width - metadata.width) / 2);
    const cellTop = cell.height - cell.inset - metadata.height;
    composites.push({ input: posed, left: column * cell.width + cellLeft, top: cellTop });
    composites.push({
      input: await sharp(posed).flop().png().toBuffer(),
      left: column * cell.width + cellLeft,
      top: cell.height + cellTop,
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
    .toFile(outputPath);

  const decoded = await sharp(outputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let row = 0; row < 2; row += 1) {
    for (let column = 0; column < battleStates.length; column += 1) {
      for (let y = 0; y < cell.height; y += 1) {
        for (let x = 0; x < cell.width; x += 1) {
          const mirroredX = row === 0 ? x : cell.width - 1 - x;
          const remove = character.kind === "tky"
            ? (column === 3 && (
              (mirroredX < 110 && y > 170)
              || mirroredX > 400
            )) || (column === 4 && mirroredX < 220 && y > 170 && y < 225)
            : character.kind === "mrs-chiha"
              ? (column === 5 && mirroredX > 275 && y > 340)
                || (column === 6 && (
                  (mirroredX < 170 && y < 350)
                  || (mirroredX >= 80 && mirroredX < 140 && y >= 350)
                ))
              : character.kind === "miyamoto-musashi"
                ? (column === 5 && mirroredX > 300 && y > 330)
                  || (column === 6 && (y < 300 || mirroredX < 120))
                : false;
          if (!remove) continue;
          const channel = ((row * cell.height + y) * decoded.info.width + column * cell.width + x) * 4;
          decoded.data.fill(0, channel, channel + 4);
        }
      }
    }
  }
  await sharp(decoded.data, {
    raw: { width: decoded.info.width, height: decoded.info.height, channels: 4 },
  })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(outputPath);

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
          const pixel = ((row * cell.height + y) * decoded.info.width + column * cell.width + x) * 4;
          if (decoded.data[pixel + 3] === 0) continue;
          left = Math.min(left, x);
          top = Math.min(top, y);
          right = Math.max(right, x + 1);
          bottom = Math.max(bottom, y + 1);
        }
      }
      if (right < left || bottom < top) throw new Error(`No visible ${character.label} pixels for ${direction}/${state}`);
      return [left, top, right, bottom];
    });
  }
  return Object.freeze({ outputPath, visible });
}

const result = {};
for (const character of characters) {
  const identityPath = path.join(sourceDir, character.identity);
  const posesPath = path.join(sourceDir, character.poses);
  await verifyHash(identityPath, character.identityHash);
  await verifyHash(posesPath, character.posesHash);
  const cardResult = await buildPortraitAndCard(character, identityPath);
  const battleResult = await buildBattleAtlas(character, posesPath);
  result[character.kind] = {
    portrait: path.relative(root, cardResult.portraitPath),
    card: path.relative(root, cardResult.cardPath),
    battle: path.relative(root, battleResult.outputPath),
    battleVisible: battleResult.visible,
  };
}

console.log(JSON.stringify({
  message: "Built Version 0.9.0 TKY, Mrs. Chiha, and Miyamoto Musashi assets.",
  result,
}, null, 2));
