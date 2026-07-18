#!/usr/bin/env node

import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import sharp from "sharp";

const STATES = Object.freeze(["idle", "walk-a", "walk-b", "attack-a", "attack-b", "hit", "death"]);
const CELL = Object.freeze({ width: 480, height: 448, inset: 16 });

function usage() {
  return "Usage: build-v070-battle-atlas.mjs --input <rgba.png> --output <atlas.png> --centers <x1,x2,x3,x4,x5,x6,x7>";
}

function parseArgs(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) throw new Error(usage());
    values.set(key.slice(2), value);
  }
  const input = values.get("input");
  const output = values.get("output");
  const centers = values.get("centers")?.split(",").map(Number);
  if (!input || !output || centers?.length !== STATES.length
    || centers.some((value) => !Number.isFinite(value) || value < 0)
    || centers.some((value, index) => index > 0 && value <= centers[index - 1])) {
    throw new Error(usage());
  }
  return {
    input: path.resolve(input),
    output: path.resolve(output),
    centers,
  };
}

function findRoot(parents, label) {
  let root = label;
  while (parents[root] !== root) root = parents[root];
  while (parents[label] !== label) {
    const next = parents[label];
    parents[label] = root;
    label = next;
  }
  return root;
}

function union(parents, left, right) {
  const leftRoot = findRoot(parents, left);
  const rightRoot = findRoot(parents, right);
  if (leftRoot !== rightRoot) parents[Math.max(leftRoot, rightRoot)] = Math.min(leftRoot, rightRoot);
}

function labelAlphaComponents(data, width, height) {
  const labels = new Int32Array(width * height);
  const parents = [0];
  let nextLabel = 1;
  const alphaThreshold = 8;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      if (data[pixel * 4 + 3] < alphaThreshold) continue;
      const neighbors = [];
      if (x > 0 && labels[pixel - 1]) neighbors.push(labels[pixel - 1]);
      if (y > 0) {
        if (x > 0 && labels[pixel - width - 1]) neighbors.push(labels[pixel - width - 1]);
        if (labels[pixel - width]) neighbors.push(labels[pixel - width]);
        if (x + 1 < width && labels[pixel - width + 1]) neighbors.push(labels[pixel - width + 1]);
      }
      if (neighbors.length === 0) {
        labels[pixel] = nextLabel;
        parents[nextLabel] = nextLabel;
        nextLabel += 1;
      } else {
        const minimum = Math.min(...neighbors);
        labels[pixel] = minimum;
        for (const neighbor of neighbors) union(parents, minimum, neighbor);
      }
    }
  }

  const components = new Map();
  for (let pixel = 0; pixel < labels.length; pixel += 1) {
    const label = labels[pixel];
    if (!label) continue;
    const root = findRoot(parents, label);
    labels[pixel] = root;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    const component = components.get(root) ?? {
      area: 0,
      sumX: 0,
      minX: width,
      minY: height,
      maxX: -1,
      maxY: -1,
    };
    component.area += 1;
    component.sumX += x;
    component.minX = Math.min(component.minX, x);
    component.minY = Math.min(component.minY, y);
    component.maxX = Math.max(component.maxX, x);
    component.maxY = Math.max(component.maxY, y);
    components.set(root, component);
  }
  return { labels, components };
}

function nearestCenterIndex(x, centers) {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < centers.length; index += 1) {
    const distance = Math.abs(x - centers[index]);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }
  return bestIndex;
}

async function extractGroups(input, data, info, centers) {
  const { labels, components } = labelAlphaComponents(data, info.width, info.height);
  const componentGroups = new Map();
  const minimumComponentArea = 12;
  for (const [label, component] of components) {
    if (component.area < minimumComponentArea) continue;
    componentGroups.set(label, nearestCenterIndex(component.sumX / component.area, centers));
  }

  const bounds = centers.map(() => ({
    minX: info.width,
    minY: info.height,
    maxX: -1,
    maxY: -1,
    area: 0,
  }));
  for (const [label, group] of componentGroups) {
    const component = components.get(label);
    bounds[group].minX = Math.min(bounds[group].minX, component.minX);
    bounds[group].minY = Math.min(bounds[group].minY, component.minY);
    bounds[group].maxX = Math.max(bounds[group].maxX, component.maxX);
    bounds[group].maxY = Math.max(bounds[group].maxY, component.maxY);
    bounds[group].area += component.area;
  }

  return Promise.all(bounds.map(async (bound, group) => {
    if (bound.maxX < bound.minX || bound.maxY < bound.minY || bound.area < 500) {
      throw new Error(`No usable alpha subject for ${STATES[group]}`);
    }
    const width = bound.maxX - bound.minX + 1;
    const height = bound.maxY - bound.minY + 1;
    const rgba = Buffer.alloc(width * height * 4);
    for (let sourceY = bound.minY; sourceY <= bound.maxY; sourceY += 1) {
      for (let sourceX = bound.minX; sourceX <= bound.maxX; sourceX += 1) {
        const sourcePixel = sourceY * info.width + sourceX;
        if (componentGroups.get(labels[sourcePixel]) !== group) continue;
        const targetPixel = (sourceY - bound.minY) * width + sourceX - bound.minX;
        data.copy(rgba, targetPixel * 4, sourcePixel * 4, sourcePixel * 4 + 4);
      }
    }
    const buffer = await sharp(rgba, { raw: { width, height, channels: 4 } }).png().toBuffer();
    return {
      state: STATES[group],
      source: input,
      buffer,
      width,
      height,
      area: bound.area,
      bounds: { x: bound.minX, y: bound.minY, width, height },
    };
  }));
}

async function fitFrame(frame, mirror) {
  const maximum = {
    width: CELL.width - CELL.inset * 2,
    height: CELL.height - CELL.inset * 2,
  };
  const scale = Math.min(1, maximum.width / frame.width, maximum.height / frame.height);
  const width = Math.max(1, Math.round(frame.width * scale));
  const height = Math.max(1, Math.round(frame.height * scale));
  let pipeline = sharp(frame.buffer).resize({
    width,
    height,
    fit: "fill",
    kernel: sharp.kernel.lanczos3,
  });
  if (mirror) pipeline = pipeline.flop();
  return {
    input: await pipeline.png().toBuffer(),
    left: Math.floor((CELL.width - width) / 2),
    top: CELL.height - CELL.inset - height,
    width,
    height,
  };
}

async function assertTransparentPerimeter(atlas, width, height) {
  const { data } = await sharp(atlas).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let row = 0; row < 2; row += 1) {
    for (let column = 0; column < STATES.length; column += 1) {
      const originX = column * CELL.width;
      const originY = row * CELL.height;
      for (let y = 0; y < CELL.height; y += 1) {
        for (let x = 0; x < CELL.width; x += 1) {
          if (x >= CELL.inset && x < CELL.width - CELL.inset
            && y >= CELL.inset && y < CELL.height - CELL.inset) continue;
          const alpha = data[((originY + y) * width + originX + x) * 4 + 3];
          if (alpha !== 0) throw new Error(`Non-transparent perimeter at row ${row}, column ${column}, ${x},${y}`);
        }
      }
    }
  }
  if (height !== CELL.height * 2) throw new Error("Unexpected atlas height");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await access(options.input);
  const decoded = await sharp(options.input, { failOn: "error" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (!decoded.info.width || !decoded.info.height) throw new Error("Input image has no dimensions");
  if (options.centers.some((center) => center >= decoded.info.width)) throw new Error("A center lies outside the input");

  const frames = await extractGroups(options.input, decoded.data, decoded.info, options.centers);
  const atlasWidth = CELL.width * STATES.length;
  const atlasHeight = CELL.height * 2;
  const composites = [];
  for (let column = 0; column < frames.length; column += 1) {
    const right = await fitFrame(frames[column], false);
    const left = await fitFrame(frames[column], true);
    composites.push({ input: right.input, left: column * CELL.width + right.left, top: right.top });
    composites.push({ input: left.input, left: column * CELL.width + left.left, top: CELL.height + left.top });
  }

  await mkdir(path.dirname(options.output), { recursive: true });
  await sharp({
    create: {
      width: atlasWidth,
      height: atlasHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(options.output);

  await assertTransparentPerimeter(options.output, atlasWidth, atlasHeight);
  process.stdout.write(`${JSON.stringify({
    output: path.relative(process.cwd(), options.output).replaceAll("\\", "/"),
    width: atlasWidth,
    height: atlasHeight,
    states: frames.map(({ state, bounds, area }) => ({ state, bounds, area })),
  }, null, 2)}\n`);
}

await main();
