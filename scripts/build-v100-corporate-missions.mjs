import assert from "node:assert/strict";
import {readFile,writeFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import sharp from "sharp";
const folder="assets/source/v100/mission-completion",hash=b=>createHash("sha256").update(b).digest("hex"),records=[];
for(const [sourceName,outputName,alpha] of [
  ["s23-armory-clean-r1.png","stages/s23-armory-clean-v1.webp",false],
  ["s25-executive-lab-clean-r1.png","stages/s25-executive-lab-clean-v1.webp",false],
  ["s27-private-lab-clean-r1.png","stages/s27-private-lab-clean-v1.webp",false],
  ["corporate-control-cutout-r2.png","mission-objects/corporate-control-states-v1.webp",true],
  ["lure-control-cutout-r2.png","mission-objects/lure-control-states-v1.webp",true],
]){
  const source=`${folder}/${sourceName}`,input=await readFile(source),meta=await sharp(input).metadata();
  assert.equal(meta.hasAlpha,alpha);
  const encoded=await sharp(input).webp(alpha?{lossless:true}:{quality:92}).toBuffer();
  if(alpha){
    assert.deepEqual([meta.width,meta.height],[2172,724]);
    const original=await sharp(input).ensureAlpha().raw().toBuffer(),decoded=await sharp(encoded).ensureAlpha().raw().toBuffer();
    for(let i=0;i<original.length;i+=4){assert.equal(decoded[i+3],original[i+3]);if(original[i+3])for(let c=0;c<3;c++)assert.equal(decoded[i+c],original[i+c]);}
  }
  const output=`public/art/v100/${outputName}`;await writeFile(output,encoded);
  records.push({source,sourceSha256:hash(input),output,path:`/art/v100/${outputName}`,bytes:encoded.length,hash:`sha256-${hash(encoded)}`,width:meta.width,height:meta.height,sourceHasAlpha:alpha,visibleRgbaLossless:alpha});
}
await writeFile(`${folder}/corporate-runtime-provenance.json`,JSON.stringify({generator:"built-in image_gen",promptSets:["late-lab-background-prompts.json","corporate-control-prompts.json","corporate-control-cutout-prompt.json","lure-control-prompts.json"],encoding:"Format conversion only: lossless visible RGBA atlas, quality92 backgrounds. No cropping, resizing or painting.",records},null,2)+"\n");
console.log(JSON.stringify(records));
