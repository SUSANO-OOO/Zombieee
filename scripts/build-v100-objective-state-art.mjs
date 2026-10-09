import assert from "node:assert/strict";
import {readFile,writeFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import sharp from "sharp";
const folder="assets/source/v100/mission-completion",hash=b=>createHash("sha256").update(b).digest("hex"),records=[];
for(const [sourceName,outputName,width,height]of[
  ["transport-four-cutout-r2.png","transport-states-v1.webp",1536,1024],
  ["maintenance-cart-cutout-r2.png","maintenance-cart-states-v1.webp",1254,1254],
  ["escort-destination-states-r1.png","escort-destination-states-v1.webp",1774,887],
  ["infected-stronghold-states-r1.png","infected-stronghold-states-v1.webp",2073,758],
  ["station-relay-states-spaced-r5.png","station-relay-states-v1.webp",2172,724],
]){
  const source=`${folder}/${sourceName}`,input=await readFile(source),meta=await sharp(input).metadata();
  assert.equal(meta.hasAlpha,true);assert.deepEqual([meta.width,meta.height],[width,height]);
  const encoded=await sharp(input).webp({lossless:true}).toBuffer(),original=await sharp(input).ensureAlpha().raw().toBuffer(),decoded=await sharp(encoded).ensureAlpha().raw().toBuffer();
  let transparent=0;
  for(let i=0;i<original.length;i+=4){assert.equal(decoded[i+3],original[i+3]);if(!original[i+3])transparent++;else for(let c=0;c<3;c++)assert.equal(decoded[i+c],original[i+c]);}
  assert.ok(transparent>width*height*.25,"the atlas background must actually be transparent");
  const output=`public/art/v100/mission-objects/${outputName}`;await writeFile(output,encoded);
  records.push({source,sourceSha256:hash(input),output,path:`/art/v100/mission-objects/${outputName}`,bytes:encoded.length,hash:`sha256-${hash(encoded)}`,width,height,sourceHasAlpha:true,visibleRgbaLossless:true,transparentPixels:transparent});
}
await writeFile(`${folder}/objective-state-runtime-provenance.json`,JSON.stringify({generator:"built-in image_gen",promptSets:["remaining-objective-prompts.json","escort-completion-prompts.json","station-relay-prompts.json"],encoding:"Format conversion only. All alpha bytes and all visible RGB values are lossless. No painting, cropping, resizing or alpha synthesis.",records},null,2)+"\n");
console.log(JSON.stringify(records.map(({path,bytes,hash})=>({path,bytes,hash}))));
