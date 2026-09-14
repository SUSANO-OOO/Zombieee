import {createHash} from 'node:crypto';
import {copyFile,mkdir,readFile,writeFile} from 'node:fs/promises';
import sharp from 'sharp';
const specifications=[
 {id:'contact',input:'C:/Users/okait/.codex/generated_images/01a079d3-063c-7401-963b-c507867eead5/exec-94e25378-a789-470c-b6c1-78301c000dc5.png',prompt:"Use case: stylized-concept. Asset type: six-frame contact-impact sprite sheet for a grounded realistic side-view Japanese post-apocalyptic action game. Create exactly a 1536x1024 PNG containing three columns and two rows of 512x512 cells. All six cells are chronological frames of ONE short non-fiery punch/blunt-weapon contact burst: initial compact pale gray-white compression, short asymmetric spray of fine dust/sweat/fabric lint, expanding micro-particles, rapidly dissipating wisps, only a few faint specks in final frame. Fixed contact origin at the center (256,256) of every cell, primary energy travels toward the right. Keep generous completely transparent gutters, effects confined within central 340x340 of every cell. Genuinely transparent background with real PNG alpha, no checkerboard pixels, no backdrop. Realistic practical fine particulate VFX with a subtle bright initial contact core, readable at 40–65 screen pixels. Neutral warm off-white and muted gray; no orange fire, no rocks, no gravel, no ground plane, no blood, no explosive fireball, no magic aura, no drawn lines or geometric stars, no circles, no shockwave rings, no characters, no weapons, no text, no border. This is a brief physical contact accent, not a projectile or a sustained effect. Smooth chronological expansion then dissipation, constant camera and anchor.",anchor:{x:228,y:270}},
 {id:'ground-impact',input:'outputs/completion/vfx-candidates/ground-impact-six-frames-r1.png',prompt:JSON.parse(await readFile('outputs/completion/vfx-candidates/ground-impact-provenance-r1.json','utf8')).prompt,anchor:{x:256,y:360}},
];
await mkdir('assets/source/v100/vfx/generated',{recursive:true});await mkdir('public/art/v100/combat-vfx',{recursive:true});
const record=async file=>{const data=await readFile(file);return{file,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')}};
for(const spec of specifications){
 const source=`assets/source/v100/vfx/generated/${spec.id}-six-frames-r1.png`,target=`public/art/v100/combat-vfx/${spec.id}-six-frames-r1.webp`;
 // Copy a generated candidate once. Rebuilds are reproducible from the retained source.
 try{await readFile(source);}catch(error){if(error.code!=='ENOENT')throw error;await copyFile(spec.input,source);}
 const image=sharp(source),metadata=await image.metadata();
 if(metadata.width!==1536||metadata.height!==1024||!metadata.hasAlpha)throw Error('Expected six authored RGBA cells: '+source);
 const {data,info}=await image.ensureAlpha().raw().toBuffer({resolveWithObject:true});let alphaMin=255,alphaMax=0,edgeVisibleMax=0,edgeVisibleTotal=0,edgeCount=0;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
  const i=(y*info.width+x)*4,a=data[i+3];alphaMin=Math.min(alphaMin,a);alphaMax=Math.max(alphaMax,a);
  if(x%512>=12&&x%512<500&&y%512>=12&&y%512<500)continue;
  for(let c=0;c<3;c++){const v=data[i+c]*a/255;edgeVisibleMax=Math.max(edgeVisibleMax,v);edgeVisibleTotal+=v;edgeCount++;}
 }
 if(alphaMin!==0||alphaMax<32||edgeVisibleMax>8||edgeVisibleTotal/edgeCount>=1)throw Error(JSON.stringify({id:spec.id,alphaMin,alphaMax,edgeVisibleMax,edgeVisibleMean:edgeVisibleTotal/edgeCount}));
 await sharp(source).webp({lossless:true,effort:6}).toFile(target);
 const provenance={generator:'Built-in image_gen',prompt:spec.prompt,source:await record(source),output:await record(target),geometry:{columns:3,rows:2,cellSize:512,contactAnchor:spec.anchor},alpha:{min:alphaMin,max:alphaMax,edgeVisibleMax,edgeVisibleMean:edgeVisibleTotal/edgeCount},adaptation:'Original fractional alpha and visible RGB retained; lossless WebP encoding only. No background removal or pixel painting.',status:'Local candidate. Runtime, actual-play visual acceptance and release are recorded separately.'};
 await writeFile(`assets/source/v100/vfx/generated/${spec.id}-provenance-r1.json`,JSON.stringify(provenance,null,2)+'\n');console.log(JSON.stringify(provenance));
}
