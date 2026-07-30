import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(
  repositoryRoot,
  "public",
  "art",
  "v070",
  "stages",
  "objects",
  "station-platform-objects-v1.png",
);
const outputPath = path.join(
  repositoryRoot,
  "public",
  "art",
  "v095",
  "mission-objects",
  "maintenance-cart-v1.png",
);
const expectedSourceSha256 = "ef316203647e73995714543e87b960441ef029490c1a5b8c270b3d945eb168cb";
const crop = Object.freeze({ left: 90, top: 260, width: 1400, height: 520 });

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const source = await readFile(sourcePath);
const sourceSha256 = sha256(source);
if (sourceSha256 !== expectedSourceSha256) {
  throw new Error(`maintenance cart source changed: ${sourceSha256}`);
}

const extracted = await sharp(source, { failOn: "error" })
  .extract(crop)
  .png()
  .toBuffer();
const output = await sharp(extracted, { failOn: "error" })
  .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .resize({ width: 480, withoutEnlargement: true, kernel: sharp.kernel.lanczos3 })
  .png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
  .toBuffer();
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, output);
const metadata = await sharp(output).metadata();
process.stdout.write(`${JSON.stringify({
  source: path.relative(repositoryRoot, sourcePath).replaceAll("\\", "/"),
  sourceSha256,
  crop,
  output: path.relative(repositoryRoot, outputPath).replaceAll("\\", "/"),
  outputSha256: sha256(output),
  width: metadata.width,
  height: metadata.height,
  bytes: output.byteLength,
})}\n`);
