import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const root = process.cwd();
const sourceDir = path.join(root, "assets/source/v090/characters");
const publicDir = path.join(root, "public/art/v090/characters");
const cell = Object.freeze({ width: 480, height: 448, inset: 16 });
const states = Object.freeze(["idle", "walk-a", "walk-b", "attack-a", "attack-b", "hit", "death"]);
const identity = Object.freeze({
  file: "mayo-chan-identity-master-r1.png",
  sha256: "dcbe04ca93d758da12e3c073c3b4fb36e5b8854ffcfcfcb6c1357596b589849c",
});
const sheets = Object.freeze([
  Object.freeze({
    id: "normal",
    file: "mayo-chan-combat-poses-source-r1.png",
    sha256: "fe9c29393e8da17ba6f72be33498a96b6ea3212ffb0125f738ab10aac453ff63",
    size: [2172, 724],
    bounds: [[24, 250], [285, 330], [595, 330], [885, 390], [1250, 310], [1505, 300], [1755, 405]],
    output: "mayo-chan-battle-r1.png",
  }),
  Object.freeze({
    id: "feral",
    file: "mayo-chan-feral-poses-source-r1.png",
    sha256: "b6e86d70fcd761ed80197a20c0ee386eeab45ea3820815bc25db8856b2e5aa74",
    size: [2153, 730],
    bounds: [[20, 300], [315, 330], [620, 335], [920, 315], [1195, 325], [1475, 325], [1765, 380]],
    output: "mayo-chan-feral-battle-r1.png",
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
  if (largest.length === 0) throw new Error("Mayo pose contains no visible subject");
  const keep = new Uint8Array(pixelCount);
  for (const pixel of largest) keep[pixel] = 1;
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    if (keep[pixel]) continue;
    const channel = pixel * 4;
    decoded.data.fill(0, channel, channel + 4);
  }
  return sharp(decoded.data, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

async function buildPortraitAndCard(identityPath) {
  const portraitPath = path.join(publicDir, "portraits/mayo-chan-event-portrait-r1.webp");
  const cardPath = path.join(publicDir, "cards/mayo-chan-formation-card-r1.webp");
  await sharp(identityPath)
    .resize(512, 640, { fit: "cover", position: "centre", kernel: sharp.kernel.lanczos3 })
    .webp({ quality: 94, effort: 6 })
    .toFile(portraitPath);
  const cardSubject = await sharp(identityPath)
    .resize(512, 512, { fit: "cover", position: "centre", kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  const overlay = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
      <rect x="16" y="16" width="10" height="480" rx="5" fill="#e2ba4b"/>
      <path d="M286 332h210v164H258l28-164z" fill="#090d12" fill-opacity=".9" stroke="#e2ba4b" stroke-width="5"/>
      <path d="M335 395c0-35 25-64 56-64s56 29 56 64c0 31-25 51-56 51s-56-20-56-51z" fill="none" stroke="#f4df9a" stroke-width="10"/>
      <path d="m347 354-18-29 39 14m67 15 18-29-39 14" fill="none" stroke="#f4df9a" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="372" cy="387" r="6" fill="#cb593d"/><circle cx="410" cy="387" r="6" fill="#cb593d"/>
      <path d="M381 407h20M391 397v20" stroke="#e2ba4b" stroke-width="7" stroke-linecap="round"/>
      <path d="M327 443h128" stroke="#cb593d" stroke-width="7" stroke-linecap="round"/>
      <text x="474" y="480" text-anchor="end" font-family="Arial,sans-serif" font-weight="900" font-size="22" letter-spacing="1.5" fill="#fff">FERAL RESCUE</text>
    </svg>
  `);
  await sharp(cardSubject)
    .composite([{ input: overlay }])
    .webp({ quality: 93, effort: 6 })
    .toFile(cardPath);
  return Object.freeze({ portraitPath, cardPath });
}

async function buildBattleAtlas(sheet) {
  const inputPath = path.join(sourceDir, sheet.file);
  const outputPath = path.join(publicDir, sheet.output);
  await verifyHash(inputPath, sheet.sha256);
  const poses = await blueScreenCutout(inputPath);
  if (poses.info.width !== sheet.size[0] || poses.info.height !== sheet.size[1]) {
    throw new Error(`Unexpected Mayo ${sheet.id} pose geometry ${poses.info.width}x${poses.info.height}`);
  }
  const composites = [];
  for (let column = 0; column < states.length; column += 1) {
    const [left, width] = sheet.bounds[column];
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
      width: cell.width * states.length,
      height: cell.height * 2,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(outputPath);

  const decoded = await sharp(outputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const visible = {};
  for (let row = 0; row < 2; row += 1) {
    const direction = row === 0 ? "right" : "left";
    visible[direction] = states.map((state, column) => {
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
      if (right < left || bottom < top) throw new Error(`No visible Mayo ${sheet.id} pixels for ${direction}/${state}`);
      return [left, top, right, bottom];
    });
  }
  return Object.freeze({ outputPath, visible });
}

const identityPath = path.join(sourceDir, identity.file);
await verifyHash(identityPath, identity.sha256);
const cardResult = await buildPortraitAndCard(identityPath);
const atlases = {};
for (const sheet of sheets) atlases[sheet.id] = await buildBattleAtlas(sheet);

console.log(JSON.stringify({
  message: "Built Version 0.9.0 Mayo-chan normal and feral assets.",
  result: {
    portrait: path.relative(root, cardResult.portraitPath),
    card: path.relative(root, cardResult.cardPath),
    normalBattle: path.relative(root, atlases.normal.outputPath),
    normalVisible: atlases.normal.visible,
    feralBattle: path.relative(root, atlases.feral.outputPath),
    feralVisible: atlases.feral.visible,
  },
}, null, 2));
