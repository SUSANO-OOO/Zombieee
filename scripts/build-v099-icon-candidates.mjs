import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const candidateDir = path.join(root, "assets", "source", "brand", "candidates", "v099");
const outputDir = path.resolve(process.env.V099_ICON_CANDIDATE_OUTPUT_DIR
  ?? path.join(root, "outputs", "v099-icon-candidates"));
const ledger = JSON.parse(await readFile(path.join(candidateDir, "candidate-ledger.json"), "utf8"));
const measureSize = 512;
const safeRadius = measureSize * .4;

await mkdir(outputDir, { recursive: true });

function digest(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function markOnlySvg(svg) {
  const match = svg.match(/<g id="mark"[\s\S]*?<\/g>\s*<\/svg>/u);
  if (!match) throw new Error("candidate has no final mark group");
  const defs = svg.match(/<defs>[\s\S]*?<\/defs>/u)?.[0] ?? "";
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${defs}${match[0]}`, "utf8");
}

async function safeAreaEvidence(svg) {
  const { data, info } = await sharp(markOnlySvg(svg), { density: 384 })
    .resize(measureSize, measureSize)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let artworkRadius = 0;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * info.channels + 3] <= 8) continue;
      artworkRadius = Math.max(artworkRadius, Math.hypot(x + .5 - measureSize / 2, y + .5 - measureSize / 2));
    }
  }
  if (artworkRadius > safeRadius) {
    throw new Error(`candidate artwork radius ${artworkRadius.toFixed(1)} exceeds ${safeRadius.toFixed(1)}`);
  }
  return {
    measuredAt: `${measureSize}x${measureSize}`,
    artworkRadiusPx: Number(artworkRadius.toFixed(1)),
    maskableSafeRadiusPx: safeRadius,
  };
}

async function circlePreview(png) {
  const size = 512;
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="256" cy="256" r="250" fill="white"/></svg>`);
  return sharp(png).resize(size, size).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
}

const results = [];
for (const candidate of ledger.candidates) {
  const masterPath = path.join(candidateDir, candidate.master);
  const svg = await readFile(masterPath);
  const source = svg.toString("utf8");
  if (!source.includes(`data-candidate-id="${candidate.id}"`)) {
    throw new Error(`${candidate.id}: candidate ID does not match its master`);
  }
  if (!source.includes('viewBox="0 0 1024 1024"')) {
    throw new Error(`${candidate.id}: master is not a 1024 square`);
  }
  const safeArea = await safeAreaEvidence(source);
  const outputs = {};
  for (const size of [1024, 192, 48]) {
    const png = await sharp(svg, { density: Math.max(192, Math.round(size * .75)) })
      .resize(size, size)
      .png({ compressionLevel: 9, palette: false })
      .toBuffer();
    const file = `${candidate.id}-${size}.png`;
    await writeFile(path.join(outputDir, file), png);
    outputs[String(size)] = { file, bytes: png.length, sha256: digest(png) };
  }
  const maskable = await circlePreview(await readFile(path.join(outputDir, outputs["1024"].file)));
  const maskableFile = `${candidate.id}-maskable-circle-512.png`;
  await writeFile(path.join(outputDir, maskableFile), maskable);
  outputs.maskable = { file: maskableFile, bytes: maskable.length, sha256: digest(maskable) };
  results.push({
    ...candidate,
    masterSha256: digest(svg),
    safeArea,
    outputs,
  });
}

const report = {
  version: ledger.version,
  status: ledger.status,
  productionDistributionChanged: false,
  publicFiles: ledger.publicFiles,
  runtimeReferences: ledger.runtimeReferences,
  generatedAt: new Date().toISOString(),
  candidates: results,
};
await writeFile(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);

const cardWidth = 690;
const cardHeight = 860;
const contact = sharp({
  create: { width: cardWidth * results.length, height: cardHeight, channels: 4, background: "#0b0d0d" },
});
const composites = [];
for (let index = 0; index < results.length; index += 1) {
  const result = results[index];
  const x = index * cardWidth;
  const hero = await sharp(await readFile(path.join(outputDir, result.outputs["1024"].file)))
    .resize(500, 500)
    .png()
    .toBuffer();
  const small192 = await readFile(path.join(outputDir, result.outputs["192"].file));
  const small48 = await readFile(path.join(outputDir, result.outputs["48"].file));
  const maskable = await sharp(await readFile(path.join(outputDir, result.outputs.maskable.file)))
    .resize(192, 192)
    .png()
    .toBuffer();
  const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cardWidth}" height="${cardHeight}">
    <rect x="18" y="18" width="654" height="824" rx="28" fill="#111615" stroke="#c77a3f" stroke-width="3"/>
    <text x="42" y="64" fill="#f0d2a3" font-family="sans-serif" font-size="28" font-weight="700">${result.id}</text>
    <text x="42" y="815" fill="#8da9a1" font-family="monospace" font-size="17">safe ${result.safeArea.artworkRadiusPx}px / ${result.safeArea.maskableSafeRadiusPx}px</text>
  </svg>`);
  composites.push({ input: label, left: x, top: 0 });
  composites.push({ input: hero, left: x + 95, top: 88, gravity: "northwest" });
  composites.push({ input: small192, left: x + 42, top: 612 });
  composites.push({ input: maskable, left: x + 270, top: 612 });
  composites.push({ input: small48, left: x + 558, top: 684 });
}
await contact
  .composite(composites.map((entry) => ({
    ...entry,
    input: Buffer.isBuffer(entry.input) && entry.input.toString("utf8", 0, 4) !== "<svg"
      ? entry.input
      : entry.input,
  })))
  .png({ compressionLevel: 9 })
  .toFile(path.join(outputDir, "gate-a-icon-contact-sheet.png"));

console.log(JSON.stringify(report, null, 2));
