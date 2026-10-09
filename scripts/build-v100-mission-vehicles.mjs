import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";

const folder = "assets/source/v100/mission-completion";
const records = [];
for (const [state, name] of [["intact", "sealed-refrigerated-truck-intact-v1.png"], ["damaged", "sealed-refrigerated-truck-damaged-r1.png"]]) {
  const source = `${folder}/${name}`, bytes = await readFile(source), metadata = await sharp(bytes).metadata();
  assert.equal(metadata.width,1672); assert.equal(metadata.height,941);
  assert.equal(metadata.hasAlpha,state === "intact");
  // Lossless format conversion only. The damaged author image has an opaque
  // preview background; the actual renderer uses the intact authored alpha
  // as its mask, retaining the exact same vehicle silhouette between states.
  const encoded = await sharp(bytes).webp({ lossless:true }).toBuffer();
  const output = `public/art/v100/mission-objects/sealed-transport-${state}-v1.webp`;
  await mkdir("public/art/v100/mission-objects",{recursive:true});
  await writeFile(output,encoded);
  records.push({state,source,sourceSha256:createHash("sha256").update(bytes).digest("hex"),output,path:`/${output.slice(7)}`,bytes:encoded.length,hash:`sha256-${createHash("sha256").update(encoded).digest("hex")}`,width:metadata.width,height:metadata.height,sourceHasAlpha:metadata.hasAlpha});
}
const backgroundSource=`${folder}/s26-bay-evacuation-yard-clean-v1.png`,background=await readFile(backgroundSource);
const encodedBackground=await sharp(background).webp({quality:92}).toBuffer();
const backgroundOutput="public/art/v100/stages/s26-bay-evacuation-yard-clean-v1.webp";
await writeFile(backgroundOutput,encodedBackground);
records.push({state:"clean-battlefield",source:backgroundSource,sourceSha256:createHash("sha256").update(background).digest("hex"),output:backgroundOutput,path:`/${backgroundOutput.slice(7)}`,bytes:encodedBackground.length,hash:`sha256-${createHash("sha256").update(encodedBackground).digest("hex")}`});
const coreSource=`${folder}/research-core-targets-v1.png`,coreBytes=await readFile(coreSource),coreMetadata=await sharp(coreBytes).metadata();
assert.equal(coreMetadata.hasAlpha,true);
const encodedCore=await sharp(coreBytes).webp({lossless:true}).toBuffer(),coreOutput="public/art/v100/mission-objects/research-core-targets-v1.webp";
await writeFile(coreOutput,encodedCore);
records.push({state:"research-core-two-targets-four-states",source:coreSource,promptRecord:`${folder}/research-core-prompt.json`,sourceSha256:createHash("sha256").update(coreBytes).digest("hex"),output:coreOutput,path:`/${coreOutput.slice(7)}`,bytes:encodedCore.length,hash:`sha256-${createHash("sha256").update(encodedCore).digest("hex")}`,width:coreMetadata.width,height:coreMetadata.height,columns:4,rows:2,sourceHasAlpha:true});
const coreBackgroundSource=`${folder}/research-core-background-v1.png`,coreBackgroundBytes=await readFile(coreBackgroundSource);
const coreBackground=await sharp(coreBackgroundBytes).webp({quality:92}).toBuffer(),coreBackgroundOutput="public/art/v100/stages/s29-underground-research-core-v1.webp";
await writeFile(coreBackgroundOutput,coreBackground);
records.push({state:"underground-research-core-background",source:coreBackgroundSource,promptRecord:`${folder}/research-core-background-prompt.json`,sourceSha256:createHash("sha256").update(coreBackgroundBytes).digest("hex"),output:coreBackgroundOutput,path:`/${coreBackgroundOutput.slice(7)}`,bytes:coreBackground.length,hash:`sha256-${createHash("sha256").update(coreBackground).digest("hex")}`});
await writeFile(`${folder}/runtime-provenance.json`,JSON.stringify({generator:"built-in image_gen",promptSet:`${folder}/prompt-set.json`,encoding:"vehicle states: lossless WebP; clean background: quality92 WebP; no resizing or painting outside image_gen",composition:"damaged RGB authored state composited through the intact RGBA silhouette at runtime",records},null,2)+"\n");
console.log(JSON.stringify(records,null,2));
