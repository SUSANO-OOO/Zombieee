import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const root='assets/source/v105/fist-wave',raw=`${root}/imagegen-r1.png`;
await fs.mkdir(root,{recursive:true});
if(process.argv[2]){
  const selected=await fs.readFile(path.resolve(process.argv[2]));
  const previous=await fs.readFile(raw).catch(()=>null);
  if(previous&&!previous.equals(selected))throw Error('Preserve the selected original; choose a new revision for a different image');
  if(!previous)await fs.writeFile(raw,selected);
}
const file='public/art/v105/combat-vfx/fist-wave-r1.webp';
await fs.mkdir(path.dirname(file),{recursive:true});
await sharp(raw).trim().resize({width:256,height:128,fit:'inside',kernel:'lanczos3'}).webp({lossless:true}).toFile(file);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const bytes=await fs.readFile(file);
await fs.writeFile(`${root}/provenance.json`,JSON.stringify({
  generator:'image_gen; scripts/build-v105-fist-wave-art.mjs performs transparent sprite packaging only',
  identityChange:false,source:'Original generated effect, no character or third-party reference',
  prompt:'Create ONE isolated game VFX sprite: a compact forward-traveling martial-arts fist-pressure wave, facing RIGHT, for a gritty dark post-apocalyptic Japanese 2D side-view action strategy game. This is the projectile released from a powerful fighter\'s fists, not a character or a hand. A dense, readable rounded leading pressure front with irregular flame-like turbulent ivory and amber light, a slightly cyan-white hot core, soft torn smoky streamers and tapered motion streaks trailing LEFT. The leading edge should feel forceful, fast and tangible, not a circular icon. Painterly textured high-quality realistic game VFX, muted gold highlights that fit ruined streets, localized bright core, soft variable-opacity alpha edge. Tight horizontal silhouette about 2:1, centered with transparent padding. Absolutely transparent background. No literal hand or person, no black background, no ground shadow, no neon rings, circles, triangles, polygons, UI frame, star shapes, target markers, text or logos. Single sprite only, no contact sheet or multiple frames. It must remain legible when displayed around 48 by 28 screen pixels.',
  raw,rawSha256:sha(await fs.readFile(raw)),file,bytes:bytes.length,sha256:sha(bytes),
  packaging:'alpha trim, proportional 256x128 containment, lossless WebP',
  anchor:{x:.9,y:.5},collisionRadius:8,travelDirection:'right; rotate about actual collision center',
},null,2)+'\n');
console.log(JSON.stringify({file,bytes:bytes.length,sha256:sha(bytes)}));
