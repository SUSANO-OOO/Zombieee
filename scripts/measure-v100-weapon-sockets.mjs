import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const cases = [
  ["red-panther-smg-right", "public/art/v100/enemies/red-panther-smg-battle-v2.png", 390, 152, 0],
  ["red-panther-smg-left", "public/art/v100/enemies/red-panther-smg-battle-v2.png", 154, 152, 512],
  ["red-panther-commander-right", "public/art/v100/enemies/red-panther-commander-battle-v2.png", 378, 162, 0],
  ["red-panther-commander-left", "public/art/v100/enemies/red-panther-commander-battle-v2.png", 166, 162, 512],
];
const evidence = [];
for (const [name, relative, x, y, top] of cases) {
  const source = await readFile(path.join(root, relative));
  const { data } = await sharp(source).extract({ left: 2 * 544, top, width: 544, height: 512 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const nearby = [];
  for (let yy = Math.max(0, y - 8); yy <= Math.min(511, y + 8); yy += 1) {
    for (let xx = Math.max(0, x - 8); xx <= Math.min(543, x + 8); xx += 1) {
      const offset = (yy * 544 + xx) * 4;
      if (data[offset + 3] > 0) nearby.push({ dx: xx - x, dy: yy - y, rgba: [...data.subarray(offset, offset + 4)] });
    }
  }
  nearby.sort((a, b) => (Math.abs(a.dx) + Math.abs(a.dy)) - (Math.abs(b.dx) + Math.abs(b.dy)));
  evidence.push({ name, atlas: relative, attackCellIndex: 2, point: [x, y], nearbyOpaqueCount: nearby.length, nearestOpaquePixels: nearby.slice(0, 12) });
}
const output = { format: "v100-source-bound-weapon-socket-evidence", radius: 8, evidence };
await writeFile(path.join(root, "outputs/completion/v100-motion-adoption-review/weapon-socket-evidence.json"), `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify(output, null, 2));
