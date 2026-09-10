import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const out='public/art/v100/combat-vfx';
await mkdir(out,{recursive:true});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const frames=Array.from({length:30},(_,i)=>`assets/source/v100/vfx/rubberduck/${String(i+1).padStart(4,'0')}.png`);
for(const file of frames){const m=await sharp(file).metadata();if(m.width!==128||m.height!==128||!m.hasAlpha)throw new Error(file);}
await sharp({create:{width:768,height:640,channels:4,background:{r:0,g:0,b:0,alpha:0}}})
 .composite(frames.map((input,i)=>({input,left:i%6*128,top:Math.floor(i/6)*128})))
 .webp({quality:92,alphaQuality:100}).toFile(out+'/explosion-fire-smoke.webp');
const textures=['blackSmoke01','blackSmoke05','whitePuff00'];
for(const name of textures)await sharp(`assets/source/v100/vfx/kenney-smoke/${name}.png`).resize({width:128}).webp({quality:92,alphaQuality:100}).toFile(out+'/'+name+'.webp');
const sources=[...frames,...textures.map(n=>`assets/source/v100/vfx/kenney-smoke/${n}.png`)];
const files=[out+'/explosion-fire-smoke.webp',...textures.map(n=>out+'/'+n+'.webp')];
await writeFile('assets/source/v100/vfx/runtime-provenance.json',JSON.stringify({
 sources:[
  {creator:'rubberduck',title:'25 special effects rendered with blender',license:'CC0-1.0',url:'https://opengameart.org/content/25-special-effects-rendered-with-blender',archive:'outputs/completion/rubberduck-volumetrics.zip',selected:'effect-images/explosion/fire+smoke/0001.png through 0030.png'},
  {creator:'Kenney',title:'Smoke Particles',license:'CC0-1.0',url:'https://kenney.nl/assets/smoke-particles',notice:'kenney-smoke/license.txt'}
 ],
 adaptation:'Original alpha preserved. Atlas packing, uniform resize and WebP encoding only. Timing, placement and opacity are runtime animation.',
 sourceFiles:await Promise.all(sources.map(async file=>({file,sha256:hash(await readFile(file))}))),
 files:await Promise.all(files.map(async file=>{const b=await readFile(file);return{file,bytes:b.length,sha256:hash(b)}}))
},null,2)+'\n');
console.log(JSON.stringify({files}));
