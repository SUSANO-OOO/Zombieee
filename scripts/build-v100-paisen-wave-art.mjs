import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {V177_JOINT_ATLASES} from '../app/v177JointPresentation.js';

const root=process.cwd(),check=process.argv.includes('--check');
const folder='assets/source/quality-20261115/paisen-wave-r1';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const recipe=JSON.parse(await readFile(path.join(root,folder,'selected-recipe.json'),'utf8'));
const master=await readFile(path.join(root,recipe.masterPath));
assert.equal(sha(master),recipe.masterSha256,'Selected fist-wave master changed');
assert.ok(master.length<25*1024*1024,'Master requires storage review');
const metadata=await sharp(master).metadata();
assert.deepEqual([metadata.width,metadata.height,metadata.hasAlpha],[1536,1024,true]);
const raw=await sharp(master).ensureAlpha().raw().toBuffer();
const cells=[];
for(let cell=0;cell<6;cell++){
 const ox=cell%3*512,oy=Math.floor(cell/3)*512,stride=513,integral=new Float64Array(stride*stride);
 let borderAlpha=0,visible=0,brightRight=-1;const bright=[];
 for(let y=0;y<512;y++){
  let row=0;
  for(let x=0;x<512;x++){
   const i=((oy+y)*1536+ox+x)*4,a=raw[i+3],luma=raw[i]*.2126+raw[i+1]*.7152+raw[i+2]*.0722;
   if(x<32||x>=480||y<32||y>=480)borderAlpha=Math.max(borderAlpha,a);
   if(a>32)visible++;
   if(a>=220&&luma>=230){bright.push([x,y,luma]);brightRight=Math.max(brightRight,x);}
   row+=luma*a/255;integral[(y+1)*stride+x+1]=integral[y*stride+x+1]+row;
  }
 }
 assert.ok(borderAlpha<=32&&visible>0,'Each cell requires real paint and 32px transparent gutters');
 let anchor;
 if(cell<3){
  assert.ok(brightRight>256,'A flight frame must retain its bright leading front');
  const front=bright.filter(([x])=>x>=brightRight-20),mass=front.reduce((n,p)=>n+p[2],0);
  anchor=[(brightRight-8+.5)/512,front.reduce((n,p)=>n+(p[1]+.5)*p[2],0)/mass/512];
 }else if(cell<5){
  let best=-1,cx=0,cy=0;
  for(let y=170;y<=330;y++)for(let x=cell===3?150:70;x<=300;x++){
   const value=integral[(y+6)*stride+x+6]-integral[(y-5)*stride+x+6]
    -integral[(y+6)*stride+x-5]+integral[(y-5)*stride+x-5];
   if(value>best){best=value;cx=x;cy=y;}
  }
  assert.ok(best>0);let mass=0,px=0,py=0;
  for(let y=cy-5;y<=cy+5;y++)for(let x=cx-5;x<=cx+5;x++){
   const i=((oy+y)*1536+ox+x)*4,w=(raw[i]*.2126+raw[i+1]*.7152+raw[i+2]*.0722)*raw[i+3]/255;
   mass+=w;px+=(x+.5)*w;py+=(y+.5)*w;
  }
  anchor=[px/mass/512,py/mass/512];
 }else anchor=[...cells[4].anchor];
 assert.ok(anchor.every(n=>Number.isFinite(n)&&n>0&&n<1));
 cells.push({frame:cell,borderAlpha,visiblePixels:visible,anchor});
}
const bytes=await sharp(master).resize(768,512).webp({lossless:true,effort:6}).toBuffer();
const assetPath='/art/quality-20261115/vfx/paisen-pressure-six-r3.webp';
const art={id:'v100-paisen-pressure-wave',path:assetPath,hash:'sha256-'+sha(bytes),width:768,height:512,
 columns:3,rows:2,flightFrames:[0,1,2],impactFrames:[3,4,5],anchors:cells.map(c=>c.anchor),
 flightWorldSize:recipe.flightWorldSize,impactWorldSize:recipe.impactWorldSize,flightCycleSeconds:recipe.flightCycleSeconds,
 impactSeconds:recipe.impactSeconds};
async function emit(relative,content){
 const file=path.join(root,relative);
 if(check){const actual=await readFile(file),normalized=/\.(?:js|json)$/.test(relative)?Buffer.from(actual.toString('utf8').replaceAll('\r\n','\n')):actual;assert.deepEqual(normalized,content,relative+' differs from selected source');}
 else{await mkdir(path.dirname(file),{recursive:true});await writeFile(file,content);}
}
await emit('public'+assetPath,bytes);
await emit('app/v100PaisenWaveArt.js',Buffer.from('// Generated material data only; safe for the installation gate.\nexport const V100_PAISEN_WAVE_ART=Object.freeze('+JSON.stringify(art,null,2)+');\n'));
const body=V177_JOINT_ATLASES.brawler;
await emit(folder+'/provenance-r1.json',Buffer.from(JSON.stringify({
 generator:'scripts/build-v100-paisen-wave-art.mjs',creator:'OpenAI built-in image_gen under Producer direction; deterministic smartphone WebP packaging by Codex',
 license:'Project-original generated material under existing asset policy; no third-party download',
 rights:{commercialUse:true,modification:true,redistribution:true,basis:'Original material-only effect created for this project'},
 producerApproval:'Active smartphone goal requests bespoke animated manual abilities; candidate, not final motion/audio/device acceptance',
 source:{path:recipe.masterPath,bytes:master.length,sha256:sha(master)},
 prompt:{path:recipe.promptPath,sha256:sha(Buffer.from((await readFile(path.join(root,recipe.promptPath),'utf8')).replaceAll('\r\n','\n')))},
 generation:{mode:'built-in image_gen generation and referenced transparent edits',model:'Selected by host; no model name asserted',characterReferences:[],reference:{path:recipe.referencePath,sha256:recipe.referenceSha256}},
 rejected:recipe.rejected,calibration:recipe.calibration,cells,
 currentBody:{path:body.path,sha256:sha(await readFile(path.join(root,'public'+body.path)))},
 output:{...art,bytes:bytes.length},runtimeAssetCount:1,logicalBytes:bytes.length,distinctBytes:bytes.length,estimatedDecodedRgbaBytes:768*512*4,
 scope:'Optional Paisen flight/impact material only. Existing fist socket, aim, swept collision, damage, range, speed, knockback, .30s impact lifetime, audio, RNG and save retained. One choice is latched per activation through impact; missing or late optional material keeps the original wave and dust for that burst.'
},null,2)+'\n'));
console.log(JSON.stringify({check,asset:assetPath,bytes:bytes.length,sha256:sha(bytes),cells},null,2));
