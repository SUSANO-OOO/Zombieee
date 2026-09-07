import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const names = ["kumaya-before-outbreak-v1", "kumaya-reopened-v1"];
const records = [];
await mkdir("public/art/v100/story", { recursive: true });
for (const name of names) {
  const source = `assets/source/v100/story/${name}.png`;
  const output = `public/art/v100/story/${name}.webp`;
  const bytes = await readFile(source);
  // Re-encode only: preserve the selected composition and all source pixels.
  await sharp(bytes).webp({ quality: 86, effort: 6 }).toFile(output);
  const encoded = await readFile(output);
  const { width, height } = await sharp(encoded).metadata();
  records.push({ source, sourceSha256: createHash("sha256").update(bytes).digest("hex"), output, sha256: createHash("sha256").update(encoded).digest("hex"), bytes: encoded.length, width, height });
}
await writeFile("assets/source/v100/story/provenance.json", JSON.stringify({
  method: "OpenAI built-in ImageGen; project-original environment artwork; no people or private identity input",
  direction: "Kumaya before the outbreak and the same room reopened thirty days after Nishijin's liberation; preserve the canonical story and all existing character identities",
  generatedAt: "2026-09-07", generatedBy: "scripts/build-v100-story-backgrounds.mjs", records,
}, null, 2) + "\n");
console.log(JSON.stringify(records));
