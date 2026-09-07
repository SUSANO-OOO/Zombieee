import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";

const folder = "assets/source/v100/mission-completion";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const records = [];
for (const entry of [
  { source: "node-states-cutout-v1.png", target: "mission-objects/node-states-v1.webp", alpha: true, lossless: true },
  { source: "s16-central-seal-clean-v1.png", target: "stages/s16-central-seal-clean-v1.webp", alpha: false, quality: 92 },
  { source: "s09-hospital-mechanical-room-v1.png", target: "stages/s09-hospital-mechanical-room-v1.webp", alpha: false, quality: 92 },
]) {
  const source = `${folder}/${entry.source}`;
  const input = await readFile(source), metadata = await sharp(input).metadata();
  assert.equal(metadata.hasAlpha, entry.alpha);
  const encoded = await sharp(input).webp(entry.lossless ? { lossless: true } : { quality: entry.quality }).toBuffer();
  const output = `public/art/v100/${entry.target}`;
  await mkdir(output.slice(0, output.lastIndexOf("/")), { recursive: true });
  await writeFile(output, encoded);
  records.push({ source, sourceSha256: hash(input), output, path: `/${output.slice(7)}`,
    bytes: encoded.length, hash: `sha256-${hash(encoded)}`, width: metadata.width,
    height: metadata.height, sourceHasAlpha: metadata.hasAlpha,
    promptRecord: `${folder}/${entry.source.startsWith("s09-") ? "s09-mechanical-prompt.json" : "node-state-prompts.json"}` });
}
await writeFile(`${folder}/node-runtime-provenance.json`, JSON.stringify({
  generator: "built-in image_gen", promptSet: `${folder}/node-state-prompts.json`,
  encoding: "format conversion only; node atlas lossless, background quality92; no cropping/resizing/painting",
  runtime: "app/v100MissionNodes.js owns per-state source crops and physical anchors",
  records,
}, null, 2) + "\n");
console.log(JSON.stringify(records));
