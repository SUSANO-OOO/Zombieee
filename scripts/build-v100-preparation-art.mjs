import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const jobs = [
  ['support/medical-station-r1',384],['support/incendiary-drum-r1',384],['equipment/inventory-atlas-r1',1280],
];
const files=[];
for(const [id,width] of jobs){
  const source=`assets/source/v100/${id}.png`,runtime=`public/art/v100/${id}.webp`;
  await mkdir(runtime.slice(0,runtime.lastIndexOf('/')),{recursive:true});
  await sharp(source).resize({width,withoutEnlargement:true}).webp({quality:91,alphaQuality:100}).toFile(runtime);
  const bytes=await readFile(runtime);
  files.push({source,runtime,sourceSha256:createHash('sha256').update(await readFile(source)).digest('hex'),sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length});
}
// No recoloring, identity substitution, inferred background removal or cropping.
await writeFile('assets/source/v100/support/runtime-art-provenance.json',JSON.stringify({generator:'image_gen',adaptation:'Resize and WebP encoding only; original alpha retained',files},null,2)+'\n');
console.log(JSON.stringify(files));
