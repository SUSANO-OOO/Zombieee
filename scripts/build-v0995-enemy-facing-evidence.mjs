import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import {
  PRODUCTION_ENEMY_SOURCE_FACING,
  V0995_INFECTED_FACING_KINDS,
} from "../app/enemyFacingContract.js";
import { SPRITE_MANIFEST } from "../app/spriteManifest.js";

const root = process.cwd();
const outputDir = path.join(root, "docs", "qa", "v0995", "enemy-facing");
const stateLabels = Object.freeze(["idle", "walk-a", "walk-b", "attack-a", "attack-b", "hit", "death"]);
const atlasCell = Object.freeze({ width: 480, height: 448 });
const evidenceCell = Object.freeze({ width: 192, height: 179 });
const labelHeight = 54;

await mkdir(outputDir, { recursive: true });

function labelSvg(kind, direction, contract) {
  const label = `${kind} / ${direction} / source=${contract.sourceFacing}`;
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${evidenceCell.width * stateLabels.length}" height="${labelHeight}">
      <rect width="100%" height="100%" fill="#11171a"/>
      <text x="16" y="24" fill="#e8d6b0" font-family="Arial,sans-serif" font-size="17" font-weight="700">${label}</text>
      <text x="16" y="44" fill="#8fbcc7" font-family="Arial,sans-serif" font-size="12">${stateLabels.join(" | ")}</text>
    </svg>
  `);
}

async function atlasRow(kind, direction) {
  const contract = PRODUCTION_ENEMY_SOURCE_FACING[kind];
  const atlasPath = path.join(root, "public", SPRITE_MANIFEST[kind].path.replace(/^\//, ""));
  const rowIndex = direction === "right" ? 0 : 1;
  const cells = [];
  for (let column = 0; column < stateLabels.length; column += 1) {
    cells.push({
      input: await sharp(atlasPath)
        .extract({
          left: column * atlasCell.width,
          top: rowIndex * atlasCell.height,
          width: atlasCell.width,
          height: atlasCell.height,
        })
        .resize(evidenceCell.width, evidenceCell.height, { fit: "contain", kernel: sharp.kernel.lanczos3 })
        .png()
        .toBuffer(),
      left: column * evidenceCell.width,
      top: labelHeight,
    });
  }
  return sharp({
    create: {
      width: evidenceCell.width * stateLabels.length,
      height: labelHeight + evidenceCell.height,
      channels: 4,
      background: { r: 7, g: 10, b: 12, alpha: 1 },
    },
  })
    .composite([{ input: labelSvg(kind, direction, contract), left: 0, top: 0 }, ...cells])
    .png()
    .toBuffer();
}

const rows = [];
for (const kind of V0995_INFECTED_FACING_KINDS) {
  for (const direction of ["left", "right"]) {
    rows.push(await atlasRow(kind, direction));
  }
}

const sheetWidth = evidenceCell.width * stateLabels.length;
const rowHeight = labelHeight + evidenceCell.height;
const sheetPath = path.join(outputDir, "v0995-enemy-semantic-facing-contact-sheet.png");
await sharp({
  create: {
    width: sheetWidth,
    height: rowHeight * rows.length,
    channels: 4,
    background: { r: 7, g: 10, b: 12, alpha: 1 },
  },
})
  .composite(rows.map((input, index) => ({ input, left: 0, top: index * rowHeight })))
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile(sheetPath);

const inventory = Object.fromEntries(Object.entries(PRODUCTION_ENEMY_SOURCE_FACING).map(([kind, contract]) => [kind, {
  ...contract,
  runtimeAtlas: SPRITE_MANIFEST[kind]?.path ?? null,
}]));
const inventoryPath = path.join(outputDir, "source-facing-inventory.json");
await writeFile(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`, "utf8");

const sheetBytes = await readFile(sheetPath);
console.log(JSON.stringify({
  contactSheet: path.relative(root, sheetPath).replaceAll("\\", "/"),
  contactSheetBytes: sheetBytes.length,
  inventory: path.relative(root, inventoryPath).replaceAll("\\", "/"),
  kinds: V0995_INFECTED_FACING_KINDS.length,
  rows: rows.length,
}, null, 2));
