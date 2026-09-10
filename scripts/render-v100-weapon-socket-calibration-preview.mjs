import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const outDir = path.join(root, "outputs/completion/v100-motion-adoption-review");
const cases = [
  { kind: "red-panther-smg", file: "public/art/v100/enemies/red-panther-smg-battle-v2.png", left: [154, 152], right: [390, 152] },
  { kind: "red-panther-commander", file: "public/art/v100/enemies/red-panther-commander-battle-v2.png", left: [166, 162], right: [378, 162] },
];
await mkdir(outDir, { recursive: true });
const width = 1120;
const height = 1120;
const composites = [];
const evidence = [];
for (let index = 0; index < cases.length; index += 1) {
  const entry = cases[index];
  const source = await readFile(path.join(root, entry.file));
  const leftCell = await sharp(source).extract({ left: 2 * 544, top: 512, width: 544, height: 512 }).png().toBuffer();
  const rightCell = await sharp(source).extract({ left: 2 * 544, top: 0, width: 544, height: 512 }).png().toBuffer();
  const x = index * 560;
  composites.push({ input: rightCell, left: x, top: 48 });
  composites.push({ input: leftCell, left: x, top: 592 });
  const points = [
    { direction: "right", point: entry.right, cellTop: 48, color: "#ff3b30" },
    { direction: "left", point: entry.left, cellTop: 592, color: "#00e5ff" },
  ];
  evidence.push({ kind: entry.kind, atlas: entry.file, attackCell: { index: 2, width: 544, height: 512, rightTop: 0, leftTop: 512 }, points });
}
const labels = evidence.flatMap((entry, index) => entry.points.map(({ direction, point, cellTop, color }) => {
  const ox = index * 560;
  return `<circle cx="${ox + point[0]}" cy="${cellTop + point[1]}" r="9" fill="none" stroke="${color}" stroke-width="4"/><line x1="${ox + point[0] - 16}" y1="${cellTop + point[1]}" x2="${ox + point[0] + 16}" y2="${cellTop + point[1]}" stroke="${color}" stroke-width="2"/><line x1="${ox + point[0]}" y1="${cellTop + point[1] - 16}" x2="${ox + point[0]}" y2="${cellTop + point[1] + 16}" stroke="${color}" stroke-width="2"/><text x="${ox + 18}" y="${cellTop + 30}" fill="${color}" font-size="20" font-family="sans-serif">${entry.kind} ${direction} socket (${point[0]},${point[1]})</text>`;
})).join("");
const svg = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${labels}</svg>`);
const canvas = sharp({ create: { width, height, channels: 4, background: { r: 24, g: 32, b: 43, alpha: 1 } } });
await canvas.composite([...composites, { input: svg, left: 0, top: 0 }]).png().toFile(path.join(outDir, "weapon-socket-calibration-v2.png"));
await writeFile(path.join(outDir, "weapon-socket-calibration-v2.json"), `${JSON.stringify({ format: "v100-weapon-socket-calibration", sourceBound: true, cases: evidence }, null, 2)}\n`);
console.log(JSON.stringify({ preview: "outputs/completion/v100-motion-adoption-review/weapon-socket-calibration-v2.png", evidence }, null, 2));
