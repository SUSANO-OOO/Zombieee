import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const root = process.cwd();
const sourceDir = path.join(root, "assets/source/v090/bosses");
const publicDir = path.join(root, "public/art/v090/bosses");
const source = Object.freeze({
  identity: Object.freeze({
    file: "mother-identity-master-candidate-r1.png",
    sha256: "f30c9322fec2e3d7b0de897ae5282b7cf3ff9894f896bed0eeca1d655bca640f",
    size: Object.freeze([1536, 1024]),
  }),
  poses: Object.freeze({
    file: "mother-pose-sheet-candidate-r1.png",
    sha256: "3fe0cf591d209588ec36eef688406f716d2a0a387e42f4b5d140af9e4b1fa584",
    size: Object.freeze([1536, 1024]),
  }),
});
const cell = Object.freeze({ width: 480, height: 448, inset: 16 });
const sourceCell = Object.freeze({ width: 384, height: 512 });
const states = Object.freeze(["idle", "walk-a", "walk-b", "attack-a", "attack-b", "hit", "death"]);
// Authored source: idle, walk A, walk B, brood windup, brood eruption,
// impact reaction, recovery, collapse.
const stateSourceIndexes = Object.freeze([0, 1, 2, 3, 4, 5, 7]);
const expectedGenerated = Object.freeze({
  "mother-identity-master-r1.webp": Object.freeze({
    sha256: "b49c9065b5de64963bb00b35bd9b81180e8893e951c57cd8595657be48567454",
    bytes: 114070,
    size: Object.freeze([768, 512]),
  }),
  "mother-compendium-r1.webp": Object.freeze({
    sha256: "be4e936acc72be26520253f97764459464ea5371740e165d4e72ab0a2a23e83c",
    bytes: 54966,
    size: Object.freeze([512, 512]),
  }),
  "mother-battle-r1.png": Object.freeze({
    sha256: "f3b1ba21300495058bdb3fbb445da90bd56fde4cb212eae69f12f4fefb826442",
    bytes: 3085965,
    size: Object.freeze([3360, 896]),
  }),
});

await mkdir(publicDir, { recursive: true });

async function verifySource(record) {
  const filePath = path.join(sourceDir, record.file);
  const digest = createHash("sha256").update(await readFile(filePath)).digest("hex");
  if (digest !== record.sha256) {
    throw new Error(`Unapproved Mother source revision: ${path.relative(root, filePath)}`);
  }
  const metadata = await sharp(filePath).metadata();
  if (metadata.width !== record.size[0] || metadata.height !== record.size[1]) {
    throw new Error(`Unexpected Mother source geometry: ${metadata.width}x${metadata.height}`);
  }
  return filePath;
}

async function verifyGenerated(filePath) {
  const expected = expectedGenerated[path.basename(filePath)];
  if (!expected) throw new Error(`No fixed Mother output revision for ${path.basename(filePath)}`);
  const bytes = await readFile(filePath);
  const digest = createHash("sha256").update(bytes).digest("hex");
  const metadata = await sharp(bytes).metadata();
  if (digest !== expected.sha256
    || bytes.length !== expected.bytes
    || metadata.width !== expected.size[0]
    || metadata.height !== expected.size[1]) {
    throw new Error(`Generated Mother asset drift: ${path.relative(root, filePath)}`);
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
  // The approved sheets use a warm studio-white sweep rather than pure white.
  // Preserve textured bone and flesh while feathering only low-chroma pixels
  // inside that 205-175 luminance band.
  if (darkest >= 205 && chroma <= 35) return 0;
  if (darkest <= 175 || chroma >= 45) return 255;
  return Math.round((205 - darkest) * 255 / 30);
}

async function whiteScreenCutout(input, { removeStudioFloor = false } = {}) {
  const decoded = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const rgba = Buffer.alloc(decoded.info.width * decoded.info.height * 4);
  for (let sourceIndex = 0, targetIndex = 0; sourceIndex < decoded.data.length; sourceIndex += 3, targetIndex += 4) {
    const red = decoded.data[sourceIndex];
    const green = decoded.data[sourceIndex + 1];
    const blue = decoded.data[sourceIndex + 2];
    const lightest = Math.max(red, green, blue);
    const darkest = Math.min(red, green, blue);
    const saturation = lightest > 0 ? (lightest - darkest) / lightest : 0;
    const pixelY = Math.floor((targetIndex / 4) / decoded.info.width);
    const authoredY = pixelY % sourceCell.height;
    const floorShadow = removeStudioFloor
      && authoredY >= 300
      && darkest >= 45
      && (
        saturation <= .11
        || (darkest >= 80 && saturation <= .18)
      );
    const alpha = floorShadow ? 0 : whiteBackgroundAlpha(red, green, blue);
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
  if (largest.length === 0) throw new Error("Mother pose contains no visible subject");
  const keep = new Uint8Array(count);
  for (const pixel of largest) keep[pixel] = 1;
  for (let pixel = 0; pixel < count; pixel += 1) {
    if (keep[pixel]) continue;
    decoded.data.fill(0, pixel * 4, pixel * 4 + 4);
  }
  return sharp(decoded.data, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

async function buildReferenceAssets(identityPath) {
  const referencePath = path.join(publicDir, "mother-identity-master-r1.webp");
  const compendiumPath = path.join(publicDir, "mother-compendium-r1.webp");
  await sharp(identityPath)
    .resize(768, 512, { fit: "cover", position: "centre", kernel: sharp.kernel.lanczos3 })
    .webp({ quality: 94, effort: 6 })
    .toFile(referencePath);
  const subjectCutout = await keepLargestAlphaComponent(await whiteScreenCutout(identityPath));
  const subject = await sharp(subjectCutout)
    .trim({ background: { r: 255, g: 255, b: 255, alpha: 0 }, threshold: 8 })
    .resize(474, 350, { fit: "inside", kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  const subjectMetadata = await sharp(subject).metadata();
  const overlay = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
      <defs>
        <radialGradient id="bg" cx=".52" cy=".34" r=".72"><stop stop-color="#3b2926"/><stop offset=".54" stop-color="#171313"/><stop offset="1" stop-color="#090909"/></radialGradient>
        <linearGradient id="bar" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#1e1110"/><stop offset=".48" stop-color="#321b17"/><stop offset="1" stop-color="#160f0e"/></linearGradient>
        <filter id="glow"><feGaussianBlur stdDeviation="4"/></filter>
      </defs>
      <rect width="512" height="512" fill="url(#bg)"/>
      <g opacity=".18" stroke="#d5a270" fill="none">
        <circle cx="256" cy="226" r="188"/><circle cx="256" cy="226" r="154"/>
        <path d="M52 92h408M52 118h408M52 144h408M88 46v304M424 46v304"/>
      </g>
      <ellipse cx="256" cy="360" rx="205" ry="25" fill="#000" opacity=".72" filter="url(#glow)"/>
      <rect x="18" y="18" width="476" height="476" fill="none" stroke="#8f5148" stroke-width="7"/>
      <path d="M18 18h112M18 18v88M494 494H382M494 494v-88" stroke="#d5a270" stroke-width="3"/>
      <path d="M18 368h476v126H18z" fill="url(#bar)" fill-opacity=".96"/>
      <path d="M40 390h58l20 20-20 20H40l20-20z" fill="none" stroke="#d5a270" stroke-width="5"/>
      <circle cx="79" cy="410" r="12" fill="#8f5148"/><circle cx="79" cy="410" r="4" fill="#f1d2a5"/>
      <text x="140" y="405" font-family="Arial,sans-serif" font-weight="900" font-size="28" fill="#fff3dc">MOTHER</text>
      <text x="140" y="436" font-family="Arial,sans-serif" font-weight="700" font-size="15" letter-spacing="1.8" fill="#d5a270">BROOD-VAULT ANOMALY</text>
      <text x="474" y="476" text-anchor="end" font-family="Arial,sans-serif" font-weight="700" font-size="13" fill="#cbb5a1">AREA DENIAL / REINFORCEMENT</text>
    </svg>
  `);
  await sharp(overlay)
    .composite([{
      input: subject,
      left: Math.round((512 - subjectMetadata.width) / 2),
      top: 34 + Math.round((320 - subjectMetadata.height) / 2),
    }])
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
      if (right < left || bottom < top) throw new Error(`No visible Mother pixels for ${direction}/${state}`);
      return [left, top, right, bottom];
    });
  }
  return visible;
}

async function buildBattleAtlas(posePath) {
  const cutout = await whiteScreenCutout(posePath, { removeStudioFloor: true });
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
  const atlasPath = path.join(publicDir, "mother-battle-r1.png");
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
  message: "Built the producer-approved Mother boss assets.",
  result: {
    identity: path.relative(root, reference.referencePath),
    compendium: path.relative(root, reference.compendiumPath),
    battle: path.relative(root, battle.atlasPath),
    visible: battle.visible,
    fixedOutputs,
  },
}, null, 2));
