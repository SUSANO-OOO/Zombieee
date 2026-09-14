import {createHash} from 'node:crypto';
import {copyFile,mkdir,readFile,writeFile} from 'node:fs/promises';
import sharp from 'sharp';

const retained='outputs/completion/metal-impact-candidate-r1';
const source='assets/source/v100/vfx/generated/metal-impact-six-r1.png';
const target='public/art/v100/combat-vfx/metal-impact-six-r1.webp';
const usedCells=[1,2,4,5];
const prompt="Use case: stylized-concept. Asset type: six-frame metal-contact visual-effect sprite sheet for a grounded, illustrated side-view post-apocalyptic action game.\nCreate exactly a 1536x1024 transparent PNG with 3 columns and 2 rows of 512x512 cells. Each cell is the next chronological frame of ONE very brief metal-on-metal impact: a tiny white-hot contact flash; a tight asymmetric fan of thin warm-white and dull golden sparks to the right; fine curling metal filings separating; rapid dimming; a few short fading embers; almost extinguished final specks. Total impression is a 0.18-second frying-pan or metal-shield deflection, NOT a firework or explosion.\nUse a fixed contact origin at (180,256) within every cell. Main fan points to the right, spreading less than 90 degrees; energy and brightness must peak only in frames 1 and 2 then decay. Effect contained within x=120..445 and y=100..410, with clear empty gutters. Delicate irregular physically plausible streaks, individual particles, painted light scatter, crisp luminous core; naturally broken edges. No star-shaped symbol, no regular rays, no circle, no shockwave ring, no polygon, no geometric icon, no magical shield, no fireball, no smoke cloud, no rocks, no dust, no ground plane, no weapon, no person, no text or cell borders.\nThe whole background must be genuinely transparent with real PNG alpha. Do not draw checkerboard pixels or a white, gray or black backdrop. Preserve soft semi-transparent luminosity at the particle edges. Maintain the same anchor and camera across all six cells; designed to read at 45–60 screen pixels.";
const expectedSourceSha='c2f1d006ded8fb6ef819d33c6c64c2d1b74a73b3fc70d6d36339543bcdc96274';
await mkdir('assets/source/v100/vfx/generated',{recursive:true});
try{await readFile(source);}catch(error){if(error.code!=='ENOENT')throw error;await copyFile(retained+'/metal-impact-six-r1.png',source);}
if(createHash('sha256').update(await readFile(source)).digest('hex')!==expectedSourceSha)throw Error('Unexpected original metal-contact source.');
const metadata=await sharp(source).metadata();
if(metadata.width!==1536||metadata.height!==1024||!metadata.hasAlpha)throw Error('Expected the six-cell original RGBA source.');
const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const cells=[];
for(const frame of usedCells){
 let maximum=0,total=0,count=0,alphaMin=255,alphaMax=0;
 for(let y=0;y<512;y++)for(let x=0;x<512;x++){
  const i=((Math.floor(frame/3)*512+y)*info.width+frame%3*512+x)*4,a=data[i+3];alphaMin=Math.min(alphaMin,a);alphaMax=Math.max(alphaMax,a);
  if(x>=12&&x<500&&y>=12&&y<500)continue;
  for(let c=0;c<3;c++){const v=data[i+c]*a/255;maximum=Math.max(maximum,v);total+=v;count++;}
 }
 if(alphaMin!==0||alphaMax<32||maximum>8||total/count>=1)throw Error('Visible seam or invalid alpha in metal contact cell '+frame);
 cells.push({frame,edgeVisibleMaximum:maximum,edgeVisibleMean:total/count,alphaMin,alphaMax});
}
await sharp(source).webp({lossless:true,effort:6}).toFile(target);
const record=async file=>{const bytes=await readFile(file);return{file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};};
const candidate={generator:'Built-in image_gen',prompt};
await writeFile('assets/source/v100/vfx/generated/metal-impact-provenance-r1.json',JSON.stringify({generator:candidate.generator,prompt:candidate.prompt,source:await record(source),output:await record(target),geometry:{columns:3,rows:2,cellSize:512,usedCells,anchor:{x:180,y:256},durationSeconds:.16},cells,adaptation:'Lossless WebP encoding only, retaining original RGB and fractional alpha. Runtime uses four authored cells with decaying brightness; cell 0 is excluded because its sparks clip at the right edge. Cell 3 is not used in the short decay. No background removal, recoloring, cropping or character changes.',status:'Local material; runtime and actual-play acceptance recorded separately.'},null,2)+'\n');
console.log(JSON.stringify(await record(target)));
