import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";

const folder = "assets/source/v100/mission-completion";
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const records = [];
for (const entry of [
  { source: "s22-clean-background-r1.png", output: "stages/s22-clinical-clean-v1.webp", alpha: false },
  { source: "s22-control-states-cutout-r5.png", output: "mission-objects/clinical-control-states-v1.webp", alpha: true },
]) {
  const source = `${folder}/${entry.source}`, input = await readFile(source);
  const metadata = await sharp(input).metadata();
  assert.equal(metadata.hasAlpha, entry.alpha);
  if (entry.alpha) assert.deepEqual([metadata.width, metadata.height], [2010, 782]);
  const encoded = await sharp(input).webp(entry.alpha ? { lossless: true } : { quality: 92 }).toBuffer();
  if (entry.alpha) {
    const original = await sharp(input).ensureAlpha().raw().toBuffer();
    const decoded = await sharp(encoded).ensureAlpha().raw().toBuffer();
    for (let i = 0; i < original.length; i += 4) {
      assert.equal(decoded[i + 3], original[i + 3]);
      if (original[i + 3]) for (let channel = 0; channel < 3; channel++) assert.equal(decoded[i + channel], original[i + channel]);
    }
  }
  const output = `public/art/v100/${entry.output}`;
  await writeFile(output, encoded);
  records.push({ source, sourceSha256: hash(input), output, path: `/${output.slice(7)}`,
    bytes: encoded.length, hash: `sha256-${hash(encoded)}`, width: metadata.width, height: metadata.height,
    sourceHasAlpha: metadata.hasAlpha, visibleRgbaLossless: entry.alpha });
}
await writeFile(`${folder}/clinical-runtime-provenance.json`, JSON.stringify({
  generator: "built-in image_gen", promptSet: `${folder}/clinical-prompts.json`,
  encoding: "Format conversion only. Atlas preserves every visible RGBA pixel; background quality92. No cropping, resizing or painting.",
  runtime: "app/v100ClinicalControl.js uses the real defense clock and complete source frames.", records,
}, null, 2) + "\n");
console.log(JSON.stringify(records));
