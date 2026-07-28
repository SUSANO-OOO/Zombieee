import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const root = process.cwd();
const sourceDir = path.join(root, "assets/source/v090/bosses");
const publicDir = path.join(root, "public/art/v090/bosses");
const cell = Object.freeze({ width: 480, height: 448, inset: 16 });
const states = Object.freeze(["idle", "walk-a", "walk-b", "attack-a", "attack-b", "hit", "death"]);
const stateSourceIndexes = Object.freeze([0, 1, 2, 3, 4, 5, 7]);

const bosses = Object.freeze([
  Object.freeze({
    kind: "ooguchi",
    title: "OOGUCHI",
    subtitle: "PREDATION RAM / LANE BREACH",
    palette: Object.freeze({
      core: "#602f2b",
      accent: "#d08a58",
      border: "#8e4939",
    }),
    identity: Object.freeze({
      file: "ooguchi-identity-master-candidate-r1.png",
      sha256: "b4dffa7991c371198c8be84d6e79e5361ecca38fcffb7e7350f9962af7d137e2",
      size: Object.freeze([1774, 887]),
    }),
    poses: Object.freeze({
      file: "ooguchi-pose-sheet-candidate-r1.png",
      sha256: "26ca4df72cda6b63fbf99385bd9a9d4d627c15d4cbd849afc6faee9d5a41fd79",
      size: Object.freeze([1774, 887]),
      normalizedSize: Object.freeze([1776, 888]),
      sourceCell: Object.freeze({ width: 444, height: 444 }),
    }),
  }),
  Object.freeze({
    kind: "gairen",
    title: "GAIREN",
    subtitle: "SHELL CITADEL / CORE EXPOSURE",
    palette: Object.freeze({
      core: "#373831",
      accent: "#c0a26c",
      border: "#77725a",
    }),
    identity: Object.freeze({
      file: "gairen-identity-master-candidate-r1.png",
      sha256: "092929ea415fcb2361bf82bd4efc6d294ea79905d6ae69066315e97ce036a603",
      size: Object.freeze([1536, 1024]),
    }),
    poses: Object.freeze({
      file: "gairen-pose-sheet-candidate-r1.png",
      sha256: "a768592a022e3827242b5d67ad874edf1a530da9e7fe99652e9e99a33f65dd11",
      size: Object.freeze([1536, 1024]),
      normalizedSize: Object.freeze([1536, 1024]),
      sourceCell: Object.freeze({ width: 384, height: 512 }),
    }),
  }),
  Object.freeze({
    kind: "futago",
    title: "FUTAGO",
    subtitle: "FUSED PAIR / CROSS ASSAULT",
    palette: Object.freeze({
      core: "#4b3035",
      accent: "#cb9291",
      border: "#7f555b",
    }),
    identity: Object.freeze({
      file: "futago-identity-master-candidate-r1.png",
      sha256: "1275c61bf8e9636ceb9204a8dcb6b4e0bc2806db8832f58c7c4ecf387b37f74e",
      size: Object.freeze([1536, 1024]),
    }),
    poses: Object.freeze({
      file: "futago-pose-sheet-candidate-r1.png",
      sha256: "315341b661398d01f754a9458d7df56e70b36295258e35e8398c295cf9247e93",
      size: Object.freeze([1536, 1024]),
      normalizedSize: Object.freeze([1536, 1024]),
      sourceCell: Object.freeze({ width: 384, height: 512 }),
    }),
  }),
]);

const expectedGenerated = Object.freeze({
  "ooguchi-identity-master-r1.webp": Object.freeze({
    sha256: "68f967d73db00bb32b3b7474397911ef4210add004402bf749a71d585876cd8b",
    bytes: 78378,
    size: Object.freeze([768, 512]),
  }),
  "ooguchi-compendium-r1.webp": Object.freeze({
    sha256: "bdf84f08b3a311ef516d75dde0327e97a5dc9979d05c59c27b061dc100a3865c",
    bytes: 44978,
    size: Object.freeze([512, 512]),
  }),
  "ooguchi-battle-r1.png": Object.freeze({
    sha256: "02549dd1d2e70eed5cd6efd9478ca8029b4055844781ff379c4e677ba41891e7",
    bytes: 1964744,
    size: Object.freeze([3360, 896]),
  }),
  "gairen-identity-master-r1.webp": Object.freeze({
    sha256: "0049a39685368a772249655d48af179fabd53acd0434595d8e7b0eb7c035c5cd",
    bytes: 122220,
    size: Object.freeze([768, 512]),
  }),
  "gairen-compendium-r1.webp": Object.freeze({
    sha256: "0e76ed1ca4d3d3ac5fcb78151adad02a233d9d9154b4a94e40aa9b20ffd3db64",
    bytes: 63942,
    size: Object.freeze([512, 512]),
  }),
  "gairen-battle-r1.png": Object.freeze({
    sha256: "d2240c879c460dc433e4cf148481ef82972ac502e1d0f0a0565b3b5f0c33369f",
    bytes: 3876191,
    size: Object.freeze([3360, 896]),
  }),
  "futago-identity-master-r1.webp": Object.freeze({
    sha256: "667cf49c513831481c5ba8e7d85b322a68232867900efa49e9f840806901270b",
    bytes: 101252,
    size: Object.freeze([768, 512]),
  }),
  "futago-compendium-r1.webp": Object.freeze({
    sha256: "f94261a5a52a9033a22b34ef653f2b000ff551d93c51bcd80f3e20a7ae952ad9",
    bytes: 50528,
    size: Object.freeze([512, 512]),
  }),
  "futago-battle-r1.png": Object.freeze({
    sha256: "b7c113fc1c223546ca9b33f1256e50784d6e17332bf527467237e05d0ec267d7",
    bytes: 3442611,
    size: Object.freeze([3360, 896]),
  }),
});

await mkdir(publicDir, { recursive: true });

async function verifySource(kind, record) {
  const filePath = path.join(sourceDir, record.file);
  const bytes = await readFile(filePath);
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== record.sha256) {
    throw new Error(`Unapproved ${kind} source revision: ${path.relative(root, filePath)}`);
  }
  const metadata = await sharp(bytes).metadata();
  if (metadata.width !== record.size[0] || metadata.height !== record.size[1]) {
    throw new Error(`Unexpected ${kind} source geometry: ${metadata.width}x${metadata.height}`);
  }
  return filePath;
}

function studioBackgroundAlpha(red, green, blue) {
  const darkest = Math.min(red, green, blue);
  const lightest = Math.max(red, green, blue);
  const chroma = lightest - darkest;
  if (darkest >= 205 && chroma <= 35) return 0;
  if (darkest <= 175 || chroma >= 45) return 255;
  return Math.round((205 - darkest) * 255 / 30);
}

async function studioCutout(input, {
  removeStudioFloor = false,
  sourceCellWidth = null,
  sourceCellHeight = null,
} = {}) {
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
    const authoredY = sourceCellHeight ? pixelY % sourceCellHeight : pixelY;
    const floorThreshold = sourceCellHeight
      ? Math.round(sourceCellHeight * .64)
      : Math.round(decoded.info.height * .64);
    const floorShadow = removeStudioFloor
      && authoredY >= floorThreshold
      && darkest >= 45
      && (saturation <= .11 || (darkest >= 80 && saturation <= .18));
    const alpha = floorShadow ? 0 : studioBackgroundAlpha(red, green, blue);
    rgba[targetIndex] = red;
    rgba[targetIndex + 1] = green;
    rgba[targetIndex + 2] = blue;
    rgba[targetIndex + 3] = alpha;
  }
  if (removeStudioFloor) {
    const floorCellWidth = sourceCellWidth ?? decoded.info.width;
    const floorCellHeight = sourceCellHeight ?? decoded.info.height;
    const columns = Math.floor(decoded.info.width / floorCellWidth);
    for (let y = 0; y < decoded.info.height; y += 1) {
      const localY = y % floorCellHeight;
      if (localY < floorCellHeight * .6) continue;
      for (let column = 0; column < columns; column += 1) {
        const candidates = [];
        for (let localX = 0; localX < floorCellWidth; localX += 1) {
          const x = column * floorCellWidth + localX;
          const offset = (y * decoded.info.width + x) * 4;
          if (rgba[offset + 3] <= 8) continue;
          const lightest = Math.max(rgba[offset], rgba[offset + 1], rgba[offset + 2]);
          const darkest = Math.min(rgba[offset], rgba[offset + 1], rgba[offset + 2]);
          const saturation = lightest > 0 ? (lightest - darkest) / lightest : 0;
          if (darkest >= 95 && saturation <= .25) candidates.push(offset);
        }
        if (candidates.length < floorCellWidth * .08) continue;
        for (const offset of candidates) rgba[offset + 3] = 0;
      }
    }
  }
  return sharp(rgba, {
    raw: { width: decoded.info.width, height: decoded.info.height, channels: 4 },
  }).png().toBuffer();
}

async function keepLargestAlphaComponent(input, kind) {
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
  if (largest.length === 0) throw new Error(`${kind} source contains no visible subject`);
  const keep = new Uint8Array(count);
  for (const pixel of largest) keep[pixel] = 1;
  for (let pixel = 0; pixel < count; pixel += 1) {
    if (keep[pixel]) continue;
    decoded.data.fill(0, pixel * 4, pixel * 4 + 4);
  }
  return sharp(decoded.data, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

async function buildReferenceAssets(definition, identityPath) {
  const referencePath = path.join(publicDir, `${definition.kind}-identity-master-r1.webp`);
  const compendiumPath = path.join(publicDir, `${definition.kind}-compendium-r1.webp`);
  await sharp(identityPath)
    .resize(768, 512, {
      fit: "contain",
      position: "centre",
      background: { r: 245, g: 241, b: 235, alpha: 1 },
      kernel: sharp.kernel.lanczos3,
    })
    .webp({ quality: 94, effort: 6 })
    .toFile(referencePath);

  const subjectCutout = await keepLargestAlphaComponent(
    await studioCutout(identityPath, { removeStudioFloor: true }),
    definition.kind,
  );
  const subject = await sharp(subjectCutout)
    .trim({ background: { r: 255, g: 255, b: 255, alpha: 0 }, threshold: 8 })
    .resize(474, 338, { fit: "inside", kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  const subjectMetadata = await sharp(subject).metadata();
  const overlay = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
      <defs>
        <radialGradient id="bg" cx=".5" cy=".32" r=".78"><stop stop-color="${definition.palette.core}"/><stop offset=".56" stop-color="#171313"/><stop offset="1" stop-color="#080909"/></radialGradient>
        <linearGradient id="bar" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#15100f"/><stop offset=".5" stop-color="${definition.palette.core}"/><stop offset="1" stop-color="#120d0d"/></linearGradient>
        <filter id="glow"><feGaussianBlur stdDeviation="5"/></filter>
      </defs>
      <rect width="512" height="512" fill="url(#bg)"/>
      <g opacity=".2" stroke="${definition.palette.accent}" fill="none">
        <path d="M46 78h420M46 108h420M46 138h420M82 42v315M430 42v315"/>
        <circle cx="256" cy="224" r="190"/><circle cx="256" cy="224" r="154"/>
      </g>
      <ellipse cx="256" cy="354" rx="206" ry="24" fill="#000" opacity=".76" filter="url(#glow)"/>
      <rect x="18" y="18" width="476" height="476" fill="none" stroke="${definition.palette.border}" stroke-width="7"/>
      <path d="M18 18h112M18 18v88M494 494H382M494 494v-88" stroke="${definition.palette.accent}" stroke-width="3"/>
      <path d="M18 368h476v126H18z" fill="url(#bar)" fill-opacity=".97"/>
      <path d="M40 390h58l20 20-20 20H40l20-20z" fill="none" stroke="${definition.palette.accent}" stroke-width="5"/>
      <circle cx="79" cy="410" r="12" fill="${definition.palette.border}"/><circle cx="79" cy="410" r="4" fill="#f4d8ad"/>
      <text x="140" y="405" font-family="Arial,sans-serif" font-weight="900" font-size="28" fill="#fff4df">${definition.title}</text>
      <text x="140" y="436" font-family="Arial,sans-serif" font-weight="700" font-size="14" letter-spacing="1.3" fill="${definition.palette.accent}">${definition.subtitle}</text>
      <text x="474" y="476" text-anchor="end" font-family="Arial,sans-serif" font-weight="700" font-size="13" fill="#cbb7a2">ANOMALOUS BOSS / V0.9.0</text>
    </svg>
  `);
  await sharp(overlay)
    .composite([{
      input: subject,
      left: Math.round((512 - subjectMetadata.width) / 2),
      top: 30 + Math.round((328 - subjectMetadata.height) / 2),
    }])
    .webp({ quality: 93, effort: 6 })
    .toFile(compendiumPath);
  return { referencePath, compendiumPath };
}

async function visibleRects(atlasPath, kind) {
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
      if (right < left || bottom < top) {
        throw new Error(`No visible ${kind} pixels for ${direction}/${state}`);
      }
      return [left, top, right, bottom];
    });
  }
  return visible;
}

async function stripAtlasFloorLines(input) {
  const decoded = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let row = 0; row < 2; row += 1) {
    for (let column = 0; column < states.length; column += 1) {
      for (let localY = Math.round(cell.height * .89); localY < cell.height; localY += 1) {
        const candidates = [];
        const y = row * cell.height + localY;
        for (let localX = 0; localX < cell.width; localX += 1) {
          const x = column * cell.width + localX;
          const offset = (y * decoded.info.width + x) * 4;
          if (decoded.data[offset + 3] <= 8) continue;
          const lightest = Math.max(decoded.data[offset], decoded.data[offset + 1], decoded.data[offset + 2]);
          const darkest = Math.min(decoded.data[offset], decoded.data[offset + 1], decoded.data[offset + 2]);
          const saturation = lightest > 0 ? (lightest - darkest) / lightest : 0;
          if (darkest >= 95 && saturation <= .25) candidates.push(offset);
        }
        if (candidates.length < cell.width * .05) continue;
        for (const offset of candidates) decoded.data[offset + 3] = 0;
      }
    }
  }
  return sharp(decoded.data, {
    raw: {
      width: decoded.info.width,
      height: decoded.info.height,
      channels: 4,
    },
  }).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
}

async function buildBattleAtlas(definition, posePath) {
  const normalized = await sharp(posePath)
    .resize(definition.poses.normalizedSize[0], definition.poses.normalizedSize[1], {
      fit: "fill",
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer();
  const cutout = await studioCutout(normalized, {
    removeStudioFloor: true,
    sourceCellWidth: definition.poses.sourceCell.width,
    sourceCellHeight: definition.poses.sourceCell.height,
  });
  const composites = [];
  for (let stateIndex = 0; stateIndex < states.length; stateIndex += 1) {
    const authoredIndex = stateSourceIndexes[stateIndex];
    const sourceColumn = authoredIndex % 4;
    const sourceRow = Math.floor(authoredIndex / 4);
    const authoredCell = await sharp(cutout)
      .extract({
        left: sourceColumn * definition.poses.sourceCell.width,
        top: sourceRow * definition.poses.sourceCell.height,
        width: definition.poses.sourceCell.width,
        height: definition.poses.sourceCell.height,
      })
      .png()
      .toBuffer();
    const isolated = await keepLargestAlphaComponent(authoredCell, definition.kind);
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
  const atlasPath = path.join(publicDir, `${definition.kind}-battle-r1.png`);
  const atlas = await sharp({
    create: {
      width: cell.width * states.length,
      height: cell.height * 2,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
  await sharp(await stripAtlasFloorLines(atlas)).toFile(atlasPath);
  return {
    atlasPath,
    visible: await visibleRects(atlasPath, definition.kind),
  };
}

async function auditGenerated(filePath) {
  const bytes = await readFile(filePath);
  const metadata = await sharp(bytes).metadata();
  return {
    path: path.relative(root, filePath).replaceAll("\\", "/"),
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.length,
    dimensions: [metadata.width, metadata.height],
  };
}

async function verifyGenerated(record) {
  const expected = expectedGenerated[path.basename(record.path)];
  if (!expected) {
    if (process.env.BOSS_ASSET_REFRESH === "1") return record;
    throw new Error(`No fixed anomaly boss output revision for ${path.basename(record.path)}`);
  }
  if (record.sha256 !== expected.sha256
    || record.bytes !== expected.bytes
    || record.dimensions[0] !== expected.size[0]
    || record.dimensions[1] !== expected.size[1]) {
    throw new Error(`Generated anomaly boss asset drift: ${record.path}`);
  }
  return record;
}

const results = [];
for (const definition of bosses) {
  const identityPath = await verifySource(definition.kind, definition.identity);
  const posePath = await verifySource(definition.kind, definition.poses);
  const reference = await buildReferenceAssets(definition, identityPath);
  const battle = await buildBattleAtlas(definition, posePath);
  const generated = await Promise.all([
    reference.referencePath,
    reference.compendiumPath,
    battle.atlasPath,
  ].map(auditGenerated));
  const fixedOutputs = await Promise.all(generated.map(verifyGenerated));
  results.push({
    kind: definition.kind,
    identity: path.relative(root, reference.referencePath),
    compendium: path.relative(root, reference.compendiumPath),
    battle: path.relative(root, battle.atlasPath),
    visible: battle.visible,
    fixedOutputs,
  });
}

console.log(JSON.stringify({
  message: "Built the Producer-approved Ooguchi, Gairen, and Futago boss assets.",
  results,
}, null, 2));
