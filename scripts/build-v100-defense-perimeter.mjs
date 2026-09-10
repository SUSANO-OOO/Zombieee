import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const folder='assets/source/v100/mission-completion',source=folder+'/defense-perimeter-states-r1.png',output='public/art/v100/mission-objects/defense-perimeter-states-v1.webp';
const input=await readFile(source),meta=await sharp(input).metadata();assert.equal(meta.hasAlpha,true);assert.deepEqual([meta.width,meta.height],[1983,793]);
const encoded=await sharp(input).webp({lossless:true}).toBuffer(),a=await sharp(input).ensureAlpha().raw().toBuffer(),b=await sharp(encoded).ensureAlpha().raw().toBuffer();let transparent=0;
for(let i=0;i<a.length;i+=4){assert.equal(a[i+3],b[i+3]);if(!a[i+3])transparent++;else for(let c=0;c<3;c++)assert.equal(a[i+c],b[i+c]);}
assert.ok(transparent>1983*793*.25);await writeFile(output,encoded);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),record={source,sourceSha256:hash(input),output,path:output.slice(6),bytes:encoded.length,hash:'sha256-'+hash(encoded),width:1983,height:793,visibleRgbaLossless:true,transparentPixels:transparent};
await writeFile(folder+'/defense-perimeter-provenance.json',JSON.stringify({generator:'built-in image_gen',prompt:'defense-perimeter-prompt.json',encoding:'Format conversion only. Original alpha and visible RGB values retained losslessly. No resizing, cropping or painting.',record},null,2)+'\n');console.log(JSON.stringify(record));
