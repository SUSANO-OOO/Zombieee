import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const root = process.cwd();
const sourceDir = path.join(root, "assets/source/v090-prototypes/bosses");
const publicDir = path.join(root, "public/art/v090-prototypes/bosses");
const source = Object.freeze({
  identity: Object.freeze({
    file: "kurome-identity-master-candidate-r1.png",
    sha256: "575d7676550e973dbfb4732d86266c85cc00039735174d97c499b71bbc6bcd35",
    size: Object.freeze([1024, 1536]),
  }),
  poses: Object.freeze({
    file: "kurome-pose-sheet-candidate-r1.png",
    sha256: "2a094c73dcad26fcd5d8f25da0001b0891d448799f8d6fd9a123b5136461b2d6",
    size: Object.freeze([1536, 1024]),
  }),
});
const cell = Object.freeze({ width: 480, height: 448, inset: 16 });
const sourceCell = Object.freeze({ width: 384, height: 512 });
const states = Object.freeze(["idle", "walk-a", "walk-b", "attack-a", "attack-b", "hit", "death"]);
// Authored source: idle, walk, tracking windup, beam discharge,
// hit, phase change, recovery, collapse.
const stateSourceIndexes = Object.freeze([0, 1, 6, 2, 3, 4, 7]);
const expectedGenerated = Object.freeze({
  "kurome-identity-candidate-r1.webp": Object.freeze({
    sha256: "c065f94040d82e8d407ff32abb1f826c8f016393a248cf8495a505eafc1838f4",
    bytes: 77856,
    size: Object.freeze([512, 768]),
  }),
  "kurome-compendium-candidate-r1.webp": Object.freeze({
    sha256: "59b842c673e48cd57322c98c8bb8b194ad7f92b6fb98eed0982cdb9faa333790",
    bytes: 55834,
    size: Object.freeze([512, 512]),
  }),
  "kurome-battle-candidate-r1.png": Object.freeze({
    sha256: "6b29b3244d2d17af31603db37719953b578942682e38d42c83f4a15952fb8a4a",
    bytes: 2384701,
    size: Object.freeze([3360, 896]),
  }),
});

await mkdir(publicDir, { recursive: true });

async function verifySource(record) {
  const filePath = path.join(sourceDir, record.file);
  const digest = createHash("sha256").update(await readFile(filePath)).digest("hex");
  if (digest !== record.sha256) {
    throw new Error(`Unapproved Kurome prototype source revision: ${path.relative(root, filePath)}`);
  }
  const metadata = await sharp(filePath).metadata();
  if (metadata.width !== record.size[0] || metadata.height !== record.size[1]) {
    throw new Error(`Unexpected Kurome prototype geometry: ${metadata.width}x${metadata.height}`);
  }
  return filePath;
}

async function verifyGenerated(filePath) {
  const expected = expectedGenerated[path.basename(filePath)];
  if (!expected) throw new Error(`No fixed Kurome output revision for ${path.basename(filePath)}`);
  const bytes = await readFile(filePath);
  const digest = createHash("sha256").update(bytes).digest("hex");
  const metadata = await sharp(bytes).metadata();
  if (digest !== expected.sha256
    || bytes.length !== expected.bytes
    || metadata.width !== expected.size[0]
    || metadata.height !== expected.size[1]) {
    throw new Error(`Generated Kurome prototype drift: ${path.relative(root, filePath)}`);
  }
  return {
    path: path.relative(root, filePath),
    sha256: digest,
    bytes: bytes.length,
    dimensions: expected.size,
  };
}

function whiteBackgroundAlpha(red, green, blue) {
  const darkest = Math.min(red, green, blue);
  const lightest = Math.max(red, green, blue);
  const chroma = lightest - darkest;
  if (darkest >= 225 && chroma <= 24) return 0;
  if (darkest <= 190 || chroma >= 38) return 255;
  return Math.round((225 - darkest) * 255 / 35);
}

async function whiteScreenCutout(input) {
  const decoded = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const rgba = Buffer.alloc(decoded.info.width * decoded.info.height * 4);
  for (let sourceIndex = 0, targetIndex = 0; sourceIndex < decoded.data.length; sourceIndex += 3, targetIndex += 4) {
    const red = decoded.data[sourceIndex];
    const green = decoded.data[sourceIndex + 1];
    const blue = decoded.data[sourceIndex + 2];
    const alpha = whiteBackgroundAlpha(red, green, blue);
    rgba[targetIndex] = red;
    rgba[targetIndex + 1] = green;
    rgba[targetIndex + 2] = blue;
    rgba[targetIndex + 3] = alpha;
  }
  return sharp(rgba, {
    raw: { width: decoded.info.width, height: decoded.info.height, channels: 4 },
  }).png().toBuffer();
}

async function keepLargestAlphaComponent(input) {
  const decoded = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = decoded.info;
  const count = width * height;
  const visited = new Uint8Array(count);
  const queue = new Int32Array(count);
  let largest = [];
  for (let start = 0; start < count; start += 1) {
    if (visited[start] || decoded.data[start * 4 + 3] <= 8) continue;
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
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const next = ny * width + nx;
          if (visited[next] || decoded.data[next * 4 + 3] <= 8) continue;
          visited[next] = 1;
          queue[tail++] = next;
        }
      }
    }
    if (component.length > largest.length) largest = component;
  }
  if (largest.length === 0) throw new Error("Kurome pose contains no visible subject");
  const keep = new Uint8Array(count);
  for (const pixel of largest) keep[pixel] = 1;
  for (let pixel = 0; pixel < count; pixel += 1) {
    if (keep[pixel]) continue;
    decoded.data.fill(0, pixel * 4, pixel * 4 + 4);
  }
  return sharp(decoded.data, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

async function buildReferenceAssets(identityPath) {
  const referencePath = path.join(publicDir, "kurome-identity-candidate-r1.webp");
  const compendiumPath = path.join(publicDir, "kurome-compendium-candidate-r1.webp");
  await sharp(identityPath)
    .resize(512, 768, { fit: "cover", position: "centre", kernel: sharp.kernel.lanczos3 })
    .webp({ quality: 94, effort: 6 })
    .toFile(referencePath);
  const subject = await sharp(identityPath)
    .resize(512, 512, { fit: "cover", position: "centre", kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  const overlay = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
      <defs><linearGradient id="v" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#061117"/><stop offset="1" stop-color="#1b0d27"/></linearGradient></defs>
      <path d="M18 18h476v476H18z" fill="none" stroke="#63e5ef" stroke-width="8"/>
      <path d="M18 350h476v144H18z" fill="url(#v)" fill-opacity=".9"/>
      <path d="M48 385h88l28 28-28 28H48l28-28z" fill="none" stroke="#df65f2" stroke-width="7"/>
      <circle cx="106" cy="413" r="13" fill="#63e5ef"/><circle cx="106" cy="413" r="5" fill="#081119"/>
      <text x="184" y="405" font-family="Arial,sans-serif" font-weight="900" font-size="26" fill="#fff">KUROME</text>
      <text x="184" y="438" font-family="Arial,sans-serif" font-weight="700" font-size="16" letter-spacing="2" fill="#8feef4">WORKING NAME // PROTOTYPE</text>
      <text x="474" y="478" text-anchor="end" font-family="Arial,sans-serif" font-weight="700" font-size="14" fill="#cfc4d8">TRACKING / VISION DISRUPTION</text>
    </svg>
  `);
  await sharp(subject)
    .composite([{ input: overlay }])
    .webp({ quality: 93, effort: 6 })
    .toFile(compendiumPath);
  return { referencePath, compendiumPath };
}

async function visibleRects(atlasPath) {
  const decoded = await sharp(atlasPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
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
          const offset = ((row * cell.height + y) * decoded.info.width + column * cell.width + x) * 4;
          if (decoded.data[offset + 3] <= 8) continue;
          left = Math.min(left, x);
          top = Math.min(top, y);
          right = Math.max(right, x + 1);
          bottom = Math.max(bottom, y + 1);
        }
      }
      if (right < left || bottom < top) throw new Error(`No visible Kurome pixels for ${direction}/${state}`);
      return [left, top, right, bottom];
    });
  }
  return visible;
}

async function buildBattleAtlas(posePath) {
  const cutout = await whiteScreenCutout(posePath);
  const composites = [];
  for (let stateIndex = 0; stateIndex < states.length; stateIndex += 1) {
    const authoredIndex = stateSourceIndexes[stateIndex];
    const sourceColumn = authoredIndex % 4;
    const sourceRow = Math.floor(authoredIndex / 4);
    const authoredCell = await sharp(cutout)
      .extract({
        left: sourceColumn * sourceCell.width,
        top: sourceRow * sourceCell.height,
        width: sourceCell.width,
        height: sourceCell.height,
      })
      .png()
      .toBuffer();
    const isolated = await keepLargestAlphaComponent(authoredCell);
    const pose = await sharp(isolated)
      .trim({ background: { r: 255, g: 255, b: 255, alpha: 0 }, threshold: 8 })
      .resize({
        width: cell.width - cell.inset * 2,
        height: cell.height - cell.inset * 2,
        fit: "inside",
        kernel: sharp.kernel.lanczos3,
      })
      .png()
      .toBuffer();
    const metadata = await sharp(pose).metadata();
    const left = Math.round((cell.width - metadata.width) / 2);
    const top = cell.height - cell.inset - metadata.height;
    // Generated source faces left: keep it in the left-facing row and mirror
    // once for the authored right-facing row.
    composites.push({
      input: await sharp(pose).flop().png().toBuffer(),
      left: stateIndex * cell.width + left,
      top,
    });
    composites.push({
      input: pose,
      left: stateIndex * cell.width + left,
      top: cell.height + top,
    });
  }
  const atlasPath = path.join(publicDir, "kurome-battle-candidate-r1.png");
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
    .toFile(atlasPath);
  return { atlasPath, visible: await visibleRects(atlasPath) };
}

const identityPath = await verifySource(source.identity);
const posePath = await verifySource(source.poses);
const reference = await buildReferenceAssets(identityPath);
const battle = await buildBattleAtlas(posePath);
const fixedOutputs = await Promise.all([
  reference.referencePath,
  reference.compendiumPath,
  battle.atlasPath,
].map(verifyGenerated));

console.log(JSON.stringify({
  message: "Built the producer-review-required Kurome boss prototype assets.",
  result: {
    identity: path.relative(root, reference.referencePath),
    compendium: path.relative(root, reference.compendiumPath),
    battle: path.relative(root, battle.atlasPath),
    visible: battle.visible,
    fixedOutputs,
  },
}, null, 2));
