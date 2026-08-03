import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const candidateDir = path.join(root, "assets", "source", "brand", "candidates", "v099", "v2");
const outputDir = path.resolve(process.env.V099_ICON_CANDIDATE_V2_OUTPUT_DIR
  ?? path.join(root, "outputs", "v099-icon-candidates-v2"));
const ledger = JSON.parse(await readFile(path.join(candidateDir, "candidate-ledger.json"), "utf8"));
const canvas = ledger.maskable.canvas;
const safeRadius = ledger.maskable.safeRadius;

await mkdir(outputDir, { recursive: true });

function digest(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function distanceFromCenter(point) {
  return Math.hypot(point.x - canvas / 2, point.y - canvas / 2);
}

function outputRecord(file, buffer) {
  return { file, bytes: buffer.length, sha256: digest(buffer) };
}

async function roundedPreview(master, size = 512) {
  const radius = Math.round(size * .225);
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" fill="white"/></svg>`);
  return sharp(master)
    .resize(size, size)
    .ensureAlpha()
    .composite([{ input: mask, blend: "dest-in" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function circlePreview(master, size = 512) {
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 6}" fill="white"/></svg>`);
  return sharp(master)
    .resize(size, size)
    .ensureAlpha()
    .composite([{ input: mask, blend: "dest-in" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function homePreview(rounded, theme) {
  const width = 844;
  const height = 390;
  const dark = theme === "dark";
  const background = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${dark ? "#07100f" : "#d7e0dc"}"/>
        <stop offset=".55" stop-color="${dark ? "#14201d" : "#aabbb5"}"/>
        <stop offset="1" stop-color="${dark ? "#281815" : "#ead0b7"}"/>
      </linearGradient>
      <filter id="blur"><feGaussianBlur stdDeviation="28"/></filter>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#bg)"/>
    <circle cx="690" cy="90" r="170" fill="${dark ? "#5a2e22" : "#f4b986"}" opacity=".32" filter="url(#blur)"/>
    <path d="M0 322H844" stroke="${dark ? "#ca7045" : "#7d4a32"}" stroke-width="10" opacity=".36"/>
    <g fill="${dark ? "#dce8e2" : "#26342f"}" opacity=".15">
      <rect x="362" y="87" width="132" height="132" rx="30"/><rect x="530" y="87" width="132" height="132" rx="30"/><rect x="698" y="87" width="96" height="96" rx="24"/>
      <rect x="362" y="249" width="112" height="18" rx="9"/><rect x="530" y="249" width="112" height="18" rx="9"/>
    </g>
  </svg>`);
  const icon = await sharp(rounded).resize(224, 224).png().toBuffer();
  return sharp(background)
    .composite([{ input: icon, left: 78, top: 76 }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function evidenceOverlay(master, candidate, type) {
  const featureMarkup = Object.entries(candidate.featurePoints).map(([name, point]) => `
    <circle cx="${point.x}" cy="${point.y}" r="14" fill="none" stroke="${name === "mouth" ? "#f2c76d" : "#89e5ba"}" stroke-width="8"/>
    <path d="M${point.x - 24} ${point.y}H${point.x + 24}M${point.x} ${point.y - 24}V${point.x} ${point.y + 24}" stroke="${name === "mouth" ? "#f2c76d" : "#89e5ba"}" stroke-width="5"/>`).join("");
  const overlay = type === "safe"
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas}" height="${canvas}"><circle cx="512" cy="512" r="${safeRadius}" fill="none" stroke="#89e5ba" stroke-width="10" stroke-dasharray="20 14"/>${featureMarkup}</svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas}" height="${canvas}"><rect x="${candidate.faceBounds.x}" y="${candidate.faceBounds.y}" width="${candidate.faceBounds.width}" height="${candidate.faceBounds.height}" fill="none" stroke="#ef985d" stroke-width="10" stroke-dasharray="22 14"/></svg>`;
  return sharp(master).composite([{ input: Buffer.from(overlay) }]).png({ compressionLevel: 9 }).toBuffer();
}

const results = [];
for (const candidate of ledger.candidates) {
  const sourcePath = path.join(candidateDir, candidate.source);
  const source = await readFile(sourcePath);
  const sourceMeta = await sharp(source).metadata();
  if (sourceMeta.width !== sourceMeta.height || (sourceMeta.width ?? 0) < canvas) {
    throw new Error(`${candidate.id}: generated source must be square and at least ${canvas}px`);
  }
  if (digest(source) !== candidate.generatedSourceSha256) {
    throw new Error(`${candidate.id}: generated source hash drift`);
  }
  if (candidate.faceCoveragePercent < 70 || candidate.faceCoveragePercent > 85) {
    throw new Error(`${candidate.id}: face coverage is outside 70-85%`);
  }
  for (const required of ledger.maskable.requiredFeatures) {
    const point = candidate.featurePoints[required];
    if (!point || distanceFromCenter(point) > safeRadius) {
      throw new Error(`${candidate.id}: ${required} is outside the maskable safe zone`);
    }
  }

  const master = await sharp(source)
    .resize(canvas, canvas, { fit: "cover", position: "centre" })
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();
  if (digest(master) !== candidate.masterSha256) {
    throw new Error(`${candidate.id}: 1024px master hash drift`);
  }
  await writeFile(path.join(candidateDir, candidate.master), master);

  const outputs = {};
  for (const size of [1024, 192, 48]) {
    const image = size === 1024
      ? master
      : await sharp(master).resize(size, size).png({ compressionLevel: 9, palette: false }).toBuffer();
    const file = `${candidate.id}-${size}.png`;
    await writeFile(path.join(outputDir, file), image);
    outputs[String(size)] = outputRecord(file, image);
  }

  const rounded = await roundedPreview(master);
  const roundedFile = `${candidate.id}-rounded-512.png`;
  await writeFile(path.join(outputDir, roundedFile), rounded);
  outputs.rounded = outputRecord(roundedFile, rounded);

  const maskable = await circlePreview(master);
  const maskableFile = `${candidate.id}-maskable-circle-512.png`;
  await writeFile(path.join(outputDir, maskableFile), maskable);
  outputs.maskable = outputRecord(maskableFile, maskable);

  for (const theme of ["light", "dark"]) {
    const preview = await homePreview(rounded, theme);
    const file = `${candidate.id}-home-${theme}-844x390.png`;
    await writeFile(path.join(outputDir, file), preview);
    outputs[`home${theme[0].toUpperCase()}${theme.slice(1)}`] = outputRecord(file, preview);
  }

  const safeOverlay = await evidenceOverlay(master, candidate, "safe");
  const safeFile = `${candidate.id}-safe-zone-1024.png`;
  await writeFile(path.join(outputDir, safeFile), safeOverlay);
  outputs.safeZone = outputRecord(safeFile, safeOverlay);

  const coverageOverlay = await evidenceOverlay(master, candidate, "coverage");
  const coverageFile = `${candidate.id}-face-coverage-1024.png`;
  await writeFile(path.join(outputDir, coverageFile), coverageOverlay);
  outputs.faceCoverage = outputRecord(coverageFile, coverageOverlay);

  results.push({
    ...candidate,
    source: {
      file: candidate.source,
      width: sourceMeta.width,
      height: sourceMeta.height,
      bytes: source.length,
      sha256: digest(source),
    },
    master: {
      file: candidate.master,
      width: canvas,
      height: canvas,
      bytes: master.length,
      sha256: digest(master),
    },
    safeZone: {
      radiusPx: safeRadius,
      featureDistancesPx: Object.fromEntries(Object.entries(candidate.featurePoints).map(([name, point]) => [
        name,
        Number(distanceFromCenter(point).toFixed(1)),
      ])),
    },
    outputs,
  });
}

const report = {
  version: ledger.version,
  status: ledger.status,
  gateA: ledger.gateA,
  productionDistributionChanged: false,
  publicFiles: ledger.publicFiles,
  runtimeReferences: ledger.runtimeReferences,
  generatedAt: new Date().toISOString(),
  candidates: results,
};
await writeFile(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);

const cardWidth = 760;
const cardHeight = 1320;
const contact = sharp({
  create: { width: cardWidth * results.length, height: cardHeight, channels: 4, background: "#070a09" },
});
const composites = [];
for (let index = 0; index < results.length; index += 1) {
  const result = results[index];
  const x = index * cardWidth;
  const hero = await sharp(await readFile(path.join(outputDir, result.outputs["1024"].file))).resize(500, 500).png().toBuffer();
  const rounded = await sharp(await readFile(path.join(outputDir, result.outputs.rounded.file))).resize(170, 170).png().toBuffer();
  const maskable = await sharp(await readFile(path.join(outputDir, result.outputs.maskable.file))).resize(170, 170).png().toBuffer();
  const small192 = await sharp(await readFile(path.join(outputDir, result.outputs["192"].file))).resize(128, 128).png().toBuffer();
  const small48 = await sharp(await readFile(path.join(outputDir, result.outputs["48"].file))).resize(144, 144, { kernel: "nearest" }).png().toBuffer();
  const light = await sharp(await readFile(path.join(outputDir, result.outputs.homeLight.file))).resize(330, 152).png().toBuffer();
  const dark = await sharp(await readFile(path.join(outputDir, result.outputs.homeDark.file))).resize(330, 152).png().toBuffer();
  const colors = result.primaryColors.map((color, colorIndex) => `<rect x="${48 + colorIndex * 70}" y="1260" width="54" height="24" rx="6" fill="${color}" stroke="#e8d5b8" stroke-width="1"/>`).join("");
  const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cardWidth}" height="${cardHeight}">
    <rect x="18" y="18" width="724" height="1284" rx="28" fill="#111615" stroke="#8f5e3c" stroke-width="3"/>
    <text x="42" y="62" fill="#f1d7ad" font-family="sans-serif" font-size="30" font-weight="700">${result.id}</text>
    <text x="42" y="98" fill="#9eb7ae" font-family="sans-serif" font-size="20">${result.direction}</text>
    <text x="42" y="1150" fill="#f1d7ad" font-family="monospace" font-size="18">face ${result.faceCoveragePercent}% / safe r=${result.safeZone.radiusPx}</text>
    <text x="42" y="1184" fill="#9eb7ae" font-family="monospace" font-size="16">eye ${result.safeZone.featureDistancesPx.abnormalEye}px / mouth ${result.safeZone.featureDistancesPx.mouth}px</text>
    <text x="42" y="1220" fill="#9eb7ae" font-family="sans-serif" font-size="16">48px: ${result.majorShapesAt48.join(" / ")}</text>
    ${colors}
  </svg>`);
  composites.push({ input: label, left: x, top: 0 });
  composites.push({ input: hero, left: x + 130, top: 122 });
  composites.push({ input: rounded, left: x + 42, top: 652 });
  composites.push({ input: maskable, left: x + 225, top: 652 });
  composites.push({ input: small192, left: x + 426, top: 674 });
  composites.push({ input: small48, left: x + 572, top: 666 });
  composites.push({ input: light, left: x + 42, top: 852 });
  composites.push({ input: dark, left: x + 388, top: 852 });
}
await contact
  .composite(composites)
  .png({ compressionLevel: 9 })
  .toFile(path.join(outputDir, "gate-a-icon-v2-contact-sheet.png"));

console.log(JSON.stringify(report, null, 2));
