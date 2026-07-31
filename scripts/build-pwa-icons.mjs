// Renders the Version 0.9.6 PWA home-screen icons.
//
// Two shapes are produced from one vector source:
// - `any` icons fill the canvas edge to edge, matching the browser tab mark;
// - the `maskable` icon keeps every meaningful pixel inside the 80% safe zone
//   so Android's circular, squircle, and teardrop masks cannot clip the glyph.
//
// Run: node scripts/build-pwa-icons.mjs

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const root = process.cwd();
const outputDir = path.join(root, "public", "icons");

const BACKGROUND = "#0b0d0d";
const PRIMARY = "#e7663f";
const ACCENT = "#f0c56a";

/**
 * The glyph is the CRAWLER silhouette from favicon.svg, drawn on a 64-unit
 * grid. `inset` shrinks it toward the centre for the maskable variant.
 */
function iconSvg({ size, inset = 0, rounded = true }) {
  const scale = (64 - inset * 2) / 64;
  const radius = rounded ? 8 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="${radius}" fill="${BACKGROUND}"/>
  <g transform="translate(${inset} ${inset}) scale(${scale})">
    <path d="M45 16H25c-7 0-11 5-11 12v8c0 7 4 12 11 12h20v-9H27c-3 0-4-2-4-5v-4c0-3 1-5 4-5h18z" fill="${PRIMARY}"/>
    <path d="M32 27h18v10H32z" fill="${ACCENT}"/>
  </g>
</svg>`;
}

async function renderPng(svg, size, file) {
  const buffer = await sharp(Buffer.from(svg)).resize(size, size, { fit: "fill" }).png({ compressionLevel: 9 }).toBuffer();
  await writeFile(path.join(outputDir, file), buffer);
  return { file, bytes: buffer.length };
}

await mkdir(outputDir, { recursive: true });

const written = [];
written.push(await renderPng(iconSvg({ size: 192 }), 192, "icon-192.png"));
written.push(await renderPng(iconSvg({ size: 512 }), 512, "icon-512.png"));
// Maskable icons must survive an aggressive mask: keep the glyph inside 80%
// of the canvas and let the flat background bleed to every edge.
written.push(await renderPng(iconSvg({ size: 512, inset: 7, rounded: false }), 512, "icon-maskable-512.png"));

console.log(JSON.stringify({ outputDir: path.relative(root, outputDir), written }, null, 2));
