#!/usr/bin/env node

import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import sharp from "sharp";

const CANVAS = Object.freeze({ width: 512, height: 640 });
const INNER = Object.freeze({ width: 480, height: 600, left: 16, top: 20 });

function parseArgs(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) {
      throw new Error("Usage: build-v070-portrait.mjs --input <rgba.png> --output <portrait.webp> --crop <x,y,width,height>");
    }
    values.set(key.slice(2), value);
  }
  const input = values.get("input");
  const output = values.get("output");
  const cropText = values.get("crop");
  if (!input || !output || !cropText) {
    throw new Error("Usage: build-v070-portrait.mjs --input <rgba.png> --output <portrait.webp> --crop <x,y,width,height>");
  }
  const cropValues = cropText.split(",").map((value) => Number.parseInt(value, 10));
  if (cropValues.length !== 4 || cropValues.some((value) => !Number.isInteger(value) || value < 0)) {
    throw new Error("--crop must be x,y,width,height using non-negative integers");
  }
  const [left, top, width, height] = cropValues;
  if (width <= 0 || height <= 0) throw new Error("Crop width and height must be positive");
  return {
    input: path.resolve(input),
    output: path.resolve(output),
    crop: { left, top, width, height },
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await access(options.input);
  const metadata = await sharp(options.input, { failOn: "error" }).metadata();
  if (!metadata.hasAlpha) throw new Error("Input must have an alpha channel");
  if (options.crop.left + options.crop.width > metadata.width
    || options.crop.top + options.crop.height > metadata.height) {
    throw new Error("Crop exceeds the input image bounds");
  }

  const subject = await sharp(options.input, { failOn: "error" })
    .extract(options.crop)
    .resize({
      width: INNER.width,
      height: INNER.height,
      fit: "contain",
      position: "centre",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer();

  await mkdir(path.dirname(options.output), { recursive: true });
  await sharp({
    create: {
      width: CANVAS.width,
      height: CANVAS.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: subject, left: INNER.left, top: INNER.top }])
    .webp({ lossless: true, effort: 6 })
    .toFile(options.output);

  const result = await sharp(options.output, { failOn: "error" }).metadata();
  if (result.width !== CANVAS.width || result.height !== CANVAS.height || !result.hasAlpha) {
    throw new Error("Portrait output failed the 512x640 alpha contract");
  }
  process.stdout.write(`${path.relative(process.cwd(), options.output).replaceAll("\\", "/")}\n`);
}

await main();
