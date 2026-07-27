import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourceDir = path.join(root, "assets", "source", "v090", "enemies");
const outputDir = path.join(root, "public", "art", "v090", "enemies");
const SOURCE_SIZE = Object.freeze({ width: 1536, height: 1024 });
const SOURCE_CELL = Object.freeze({ width: 384, height: 512 });
const ATLAS_CELL = Object.freeze({ width: 480, height: 448, inset: 16 });
const STATE_POSE_INDEXES = Object.freeze([0, 1, 1, 2, 3, 5, 7]);

const specs = Object.freeze([
  {
    id: "resonator",
    displayName: "裂声体",
    source: "resonator-infected-pose-sheet-r1.png",
    accent: "#b94f62",
    bodyScale: 0.9,
  },
  {
    id: "cagewalker",
    displayName: "骨檻",
    source: "cagewalker-infected-pose-sheet-r1.png",
    accent: "#d4c39a",
    bodyScale: 0.92,
  },
  {
    id: "spindle",
    displayName: "脊走り",
    source: "spindle-infected-pose-sheet-r1.png",
    accent: "#8f667f",
    bodyScale: 0.92,
  },
  {
    id: "choir-knot",
    displayName: "百面瘤",
    source: "choir-knot-infected-pose-sheet-r1.png",
    accent: "#9b778c",
    bodyScale: 0.91,
  },
  {
    id: "pall-manta",
    displayName: "皮幕",
    source: "pall-manta-infected-pose-sheet-r1.png",
    accent: "#705c69",
    bodyScale: 0.94,
  },
  {
    id: "anchor-bloom",
    displayName: "掌根",
    source: "anchor-bloom-infected-pose-sheet-r1.png",
    accent: "#9d5b66",
    bodyScale: 0.93,
  },
]);

function alphaForNeutral(red, green, blue) {
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const spread = maximum - minimum;
  const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
  if (luminance >= 224 && spread <= 28) return 0;
  if (luminance <= 184 || spread >= 56) return 255;
  const neutral = Math.max(0, Math.min(1, (224 - luminance) / 40));
  const chroma = Math.max(0, Math.min(1, (spread - 28) / 28));
  return Math.round(Math.max(neutral, chroma) * 255);
}

async function removeStudioBackground(input) {
  const decoded = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const rgba = Buffer.alloc(decoded.info.width * decoded.info.height * 4);
  for (let sourceIndex = 0, targetIndex = 0; sourceIndex < decoded.data.length; sourceIndex += 3, targetIndex += 4) {
    const red = decoded.data[sourceIndex];
    const green = decoded.data[sourceIndex + 1];
    const blue = decoded.data[sourceIndex + 2];
    rgba[targetIndex] = red;
    rgba[targetIndex + 1] = green;
    rgba[targetIndex + 2] = blue;
    rgba[targetIndex + 3] = alphaForNeutral(red, green, blue);
  }
  return { data: rgba, info: { ...decoded.info, channels: 4 } };
}

async function stripFloorShadow(input) {
  const decoded = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const floorStart = Math.floor(decoded.info.height * 0.78);
  for (let y = floorStart; y < decoded.info.height; y += 1) {
    for (let x = 0; x < decoded.info.width; x += 1) {
      const channel = (y * decoded.info.width + x) * 4;
      if (decoded.data[channel + 3] <= 8) continue;
      const red = decoded.data[channel];
      const green = decoded.data[channel + 1];
      const blue = decoded.data[channel + 2];
      const spread = Math.max(red, green, blue) - Math.min(red, green, blue);
      const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
      if (luminance < 112 || spread > 44) continue;
      decoded.data[channel] = 0;
      decoded.data[channel + 1] = 0;
      decoded.data[channel + 2] = 0;
      decoded.data[channel + 3] = 0;
    }
  }
  return sharp(decoded.data, {
    raw: {
      width: decoded.info.width,
      height: decoded.info.height,
      channels: 4,
    },
  }).png().toBuffer();
}

async function keepLargestAlphaComponent(input) {
  const decoded = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixelCount = decoded.info.width * decoded.info.height;
  const visited = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let largest = [];
  for (let start = 0; start < pixelCount; start += 1) {
    if (visited[start] || decoded.data[start * 4 + 3] <= 8) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    visited[start] = 1;
    const component = [];
    while (head < tail) {
      const pixel = queue[head++];
      component.push(pixel);
      const x = pixel % decoded.info.width;
      const y = Math.floor(pixel / decoded.info.width);
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          if (offsetX === 0 && offsetY === 0) continue;
          const nextX = x + offsetX;
          const nextY = y + offsetY;
          if (nextX < 0 || nextX >= decoded.info.width || nextY < 0 || nextY >= decoded.info.height) continue;
          const next = nextY * decoded.info.width + nextX;
          if (visited[next] || decoded.data[next * 4 + 3] <= 8) continue;
          visited[next] = 1;
          queue[tail++] = next;
        }
      }
    }
    if (component.length > largest.length) largest = component;
  }
  if (largest.length === 0) throw new Error("Enemy source cell contains no visible subject");
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
  return sharp(decoded.data, {
    raw: {
      width: decoded.info.width,
      height: decoded.info.height,
      channels: 4,
    },
  }).png().toBuffer();
}

async function poseForCell(source, poseIndex) {
  const column = poseIndex % 4;
  const row = Math.floor(poseIndex / 4);
  const cell = await sharp(source.data, {
    raw: {
      width: source.info.width,
      height: source.info.height,
      channels: 4,
    },
  })
    .extract({
      left: column * SOURCE_CELL.width,
      top: row * SOURCE_CELL.height,
      width: SOURCE_CELL.width,
      height: SOURCE_CELL.height,
    })
    .png()
    .toBuffer();
  const isolated = await keepLargestAlphaComponent(cell);
  return sharp(await stripFloorShadow(isolated))
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 3 })
    .png()
    .toBuffer();
}

async function renderAtlas(spec, source) {
  const composites = [];
  for (let column = 0; column < STATE_POSE_INDEXES.length; column += 1) {
    const poseIndex = STATE_POSE_INDEXES[column];
    const pose = await poseForCell(source, poseIndex);
    const resizedBody = await sharp(pose)
      .resize({
        width: Math.round((ATLAS_CELL.width - ATLAS_CELL.inset * 2) * spec.bodyScale),
        height: Math.round((ATLAS_CELL.height - ATLAS_CELL.inset * 2) * spec.bodyScale),
        fit: "inside",
        kernel: sharp.kernel.lanczos3,
      })
      .png()
      .toBuffer();
    const body = await keepLargestAlphaComponent(
      await stripFloorShadow(resizedBody),
    );
    const metadata = await sharp(body).metadata();
    const walkShift = column === 2 ? 7 : column === 1 ? -5 : 0;
    const left = Math.round((ATLAS_CELL.width - metadata.width) / 2 + walkShift);
    const top = ATLAS_CELL.height - ATLAS_CELL.inset - metadata.height;
    composites.push({
      input: body,
      left: column * ATLAS_CELL.width + Math.max(ATLAS_CELL.inset, left),
      top,
    });
    composites.push({
      input: await sharp(body).flop().png().toBuffer(),
      left: column * ATLAS_CELL.width + Math.max(ATLAS_CELL.inset, left),
      top: ATLAS_CELL.height + top,
    });
  }
  const output = path.join(outputDir, `${spec.id}-battle-v1.png`);
  await sharp({
    create: {
      width: ATLAS_CELL.width * STATE_POSE_INDEXES.length,
      height: ATLAS_CELL.height * 2,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(output);
  return output;
}

async function renderCompendium(spec, source) {
  const idle = await poseForCell(source, 0);
  const subject = await sharp(idle)
    .resize(432, 432, { fit: "inside", kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  const metadata = await sharp(subject).metadata();
  const card = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
      <defs>
        <radialGradient id="bg" cx="50%" cy="34%" r="78%">
          <stop offset="0" stop-color="#22272b"/>
          <stop offset="1" stop-color="#080b0d"/>
        </radialGradient>
      </defs>
      <rect width="512" height="512" fill="url(#bg)"/>
      <path d="M18 18h476v476H18z" fill="none" stroke="${spec.accent}" stroke-width="7"/>
      <path d="M34 466h444" stroke="${spec.accent}" stroke-width="3" opacity=".72"/>
    </svg>
  `);
  const output = path.join(outputDir, `${spec.id}-compendium-v1.webp`);
  await sharp(card)
    .composite([{
      input: subject,
      left: Math.round((512 - metadata.width) / 2),
      top: 466 - metadata.height,
    }])
    .webp({ quality: 92, alphaQuality: 100, effort: 6 })
    .toFile(output);
  return output;
}

async function evidenceFor(file) {
  const bytes = await readFile(file);
  const metadata = await sharp(bytes).metadata();
  return Object.freeze({
    path: path.relative(root, file).replaceAll("\\", "/"),
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.length,
    dimensions: [metadata.width, metadata.height],
  });
}

async function visibleRects(atlasPath) {
  const decoded = await sharp(atlasPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const visible = {};
  for (let row = 0; row < 2; row += 1) {
    const direction = row === 0 ? "right" : "left";
    visible[direction] = [];
    for (let column = 0; column < STATE_POSE_INDEXES.length; column += 1) {
      let left = ATLAS_CELL.width;
      let top = ATLAS_CELL.height;
      let right = -1;
      let bottom = -1;
      for (let y = 0; y < ATLAS_CELL.height; y += 1) {
        for (let x = 0; x < ATLAS_CELL.width; x += 1) {
          const channel = (
            (row * ATLAS_CELL.height + y) * decoded.info.width
            + column * ATLAS_CELL.width
            + x
          ) * 4;
          if (decoded.data[channel + 3] <= 8) continue;
          left = Math.min(left, x);
          top = Math.min(top, y);
          right = Math.max(right, x + 1);
          bottom = Math.max(bottom, y + 1);
        }
      }
      if (right < left || bottom < top) throw new Error(`No visible ${direction}/${column} pixels in ${atlasPath}`);
      visible[direction].push([left, top, right, bottom]);
    }
  }
  return Object.freeze(visible);
}

await mkdir(outputDir, { recursive: true });
const outputs = [];
for (const spec of specs) {
  const input = path.join(sourceDir, spec.source);
  const metadata = await sharp(input).metadata();
  if (metadata.width !== SOURCE_SIZE.width || metadata.height !== SOURCE_SIZE.height) {
    throw new Error(`Unexpected ${spec.id} source geometry ${metadata.width}x${metadata.height}`);
  }
  const source = await removeStudioBackground(input);
  const [atlas, compendium] = await Promise.all([
    renderAtlas(spec, source),
    renderCompendium(spec, source),
  ]);
  outputs.push(Object.freeze({
    id: spec.id,
    displayName: spec.displayName,
    source: await evidenceFor(input),
    atlas: await evidenceFor(atlas),
    compendium: await evidenceFor(compendium),
    visible: await visibleRects(atlas),
  }));
}

console.log(JSON.stringify({
  message: `Built ${outputs.length} Version 0.9.0 infected identity sets.`,
  outputs,
}, null, 2));
