import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {V177_JOINT_ATLASES} from '../app/v177JointPresentation.js';

const root=process.cwd(),check=process.argv.includes('--check');
const folder='assets/source/quality-20261114/tatara-impact-r1';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const recipe=JSON.parse(await readFile(path.join(root,folder,'selected-recipe.json'),'utf8'));
const masterPath=folder+'/tatara-r1-master.png',master=await readFile(path.join(root,masterPath));
assert.equal(sha(master),recipe.masterSha256,'Selected Tatara master changed');
assert.ok(master.length<25*1024*1024,'Master requires storage review');
const metadata=await sharp(master).metadata();
assert.deepEqual([metadata.width,metadata.height,metadata.hasAlpha],[1536,1024,true]);
const raw=await sharp(master).ensureAlpha().raw().toBuffer();
for(let cell=0;cell<6;cell++)for(let y=0;y<512;y++)for(let x=0;x<512;x++){
 if(x>=4&&x<508&&y>=4&&y<508)continue;
 assert.ok(raw[((Math.floor(cell/3)*512+y)*1536+cell%3*512+x)*4+3]<=32,
  'Painted cell must not have a hard clipped edge');
}
assert.ok([recipe.anchorX,recipe.anchorY].every(n=>Number.isFinite(n)&&n>=0&&n<=1));
async function emit(relative,bytes){
 const file=path.join(root,relative);
 if(check){
  const actual=await readFile(file);
  const normalized=/\.(?:js|json)$/.test(relative)?Buffer.from(actual.toString('utf8').replaceAll('\r\n','\n')):actual;
  assert.deepEqual(normalized,bytes,relative+' differs from selected source');
 }else{await mkdir(path.dirname(file),{recursive:true});await writeFile(file,bytes);}
}
const bytes=await sharp(master).webp({quality:92,alphaQuality:100,effort:6}).toBuffer();
const assetPath='/art/quality-20261114/vfx/tatara-ground-six-r1.webp';
const art={brute:{id:'v100-tatara-manual-impact',path:assetPath,hash:'sha256-'+sha(bytes),
 columns:3,rows:2,anchorX:recipe.anchorX,anchorY:recipe.anchorY}};
await emit('public'+assetPath,bytes);
const musashiFolder='assets/source/quality-20261114/musashi-impact-r1';
const musashiRecipe=JSON.parse(await readFile(path.join(root,musashiFolder,'selected-recipe.json'),'utf8'));
const musashiMaster=await readFile(path.join(root,musashiRecipe.masterPath));
assert.equal(sha(musashiMaster),musashiRecipe.masterSha256,'Selected Musashi master changed');
assert.ok(musashiMaster.length<25*1024*1024,'Master requires storage review');
const musashiMetadata=await sharp(musashiMaster).metadata();
assert.deepEqual([musashiMetadata.width,musashiMetadata.height,musashiMetadata.hasAlpha],[1536,1024,true]);
const musashiRaw=await sharp(musashiMaster).ensureAlpha().raw().toBuffer();
const musashiCells=[];
for(let cell=0;cell<6;cell++){
 const ox=cell%3*512,oy=Math.floor(cell/3)*512,stride=513,integral=new Float64Array(stride*stride);
 let margin=0,visible=0;
 for(let y=0;y<512;y++){
  let row=0;
  for(let x=0;x<512;x++){
   const i=((oy+y)*1536+ox+x)*4,a=musashiRaw[i+3];
   if(x<32||x>=480||y<32||y>=480)margin=Math.max(margin,a);
   if(a>32)visible++;
   row+=(musashiRaw[i]*.2126+musashiRaw[i+1]*.7152+musashiRaw[i+2]*.0722)*a/255;
   integral[(y+1)*stride+x+1]=integral[y*stride+x+1]+row;
  }
 }
 assert.ok(margin<=32&&visible>0,'Musashi requires real paint and32px transparent gutters');
 let anchor;
 if(cell<3){
  let best=-1,cx=0,cy=0;
  for(let y=240;y<=380;y++)for(let x=100;x<=300;x++){
   const value=integral[(y+6)*stride+x+6]-integral[(y-5)*stride+x+6]
    -integral[(y+6)*stride+x-5]+integral[(y-5)*stride+x-5];
   if(value>best){best=value;cx=x;cy=y;}
  }
  assert.ok(best>0);let mass=0,px=0,py=0;
  for(let y=cy-5;y<=cy+5;y++)for(let x=cx-5;x<=cx+5;x++){
   const i=((oy+y)*1536+ox+x)*4,w=(musashiRaw[i]*.2126+musashiRaw[i+1]*.7152+musashiRaw[i+2]*.0722)*musashiRaw[i+3]/255;
   mass+=w;px+=(x+.5)*w;py+=(y+.5)*w;
  }
  anchor=[px/mass/512,py/mass/512];
 }else anchor=[...musashiCells[2].anchor];
 assert.ok(anchor.every(n=>Number.isFinite(n)&&n>0&&n<1));
 musashiCells.push({frame:cell,maxMarginAlpha:margin,visiblePixels:visible,anchor});
}
const musashiBytes=await sharp(musashiMaster).resize(768,512).webp({quality:92,alphaQuality:100,effort:6}).toBuffer();
const musashiPath='/art/quality-20261114/vfx/musashi-contact-six-r2.webp';
art['miyamoto-musashi']={id:'v100-musashi-manual-impact',path:musashiPath,hash:'sha256-'+sha(musashiBytes),
 width:768,height:512,columns:3,rows:2,worldSize:musashiRecipe.worldSize,anchors:musashiCells.map(c=>c.anchor)};
await emit('public'+musashiPath,musashiBytes);
const musashiBody=V177_JOINT_ATLASES['miyamoto-musashi'];
await emit(musashiFolder+'/provenance-r1.json',Buffer.from(JSON.stringify({
 generator:'scripts/build-v100-manual-impact-art.mjs',
 creator:'OpenAI built-in image_gen under Producer direction; deterministic smartphone WebP packaging by Codex',
 license:'Project-original generated material artwork under existing game asset policy; no third-party download',
 rights:{commercialUse:true,modification:true,redistribution:true,basis:'Original material-only contact created for this project'},
 producerApproval:'Current smartphone goal requests bespoke manual ability VFX without geometric markers; candidate, not final motion/audio/device acceptance',
 source:{path:musashiRecipe.masterPath,bytes:musashiMaster.length,sha256:sha(musashiMaster)},
 prompt:{path:musashiRecipe.promptPath,sha256:sha(Buffer.from((await readFile(path.join(root,musashiRecipe.promptPath),'utf8')).replaceAll('\r\n','\n')))},
 generation:{mode:'built-in image_gen generation and referenced edit',model:'Selected by host; no model name asserted',characterReferences:[]},
 currentBody:{path:musashiBody.path,sha256:sha(await readFile(path.join(root,'public'+musashiBody.path))),weaponBone:musashiBody.weaponBone},
 calibration:musashiRecipe.calibration,cells:musashiCells,output:{...art['miyamoto-musashi'],bytes:musashiBytes.length},
 runtimeAssetCount:1,logicalBytes:musashiBytes.length,distinctBytes:musashiBytes.length,estimatedDecodedRgbaBytes:768*512*4,
 scope:'Material-only contact at the existing actual counter or fallback damage target. Existing dual blades, body, contact point, damage, range, clock, audio, rewards and save retained. Missing or late optional art uses the existing physical contact raster, never the former X glyph. Old glyph file remains retained but is not decoded for current V1 battles.'
},null,2)+'\n'));
await emit('app/v100ManualImpactArt.js',Buffer.from('// Generated data only. PwaGate must not import the battle renderer.\nexport const V100_MANUAL_IMPACT_ART=Object.freeze('+JSON.stringify(art,null,2)+');\n'));
const provenance={generator:'scripts/build-v100-manual-impact-art.mjs',
 creator:'OpenAI built-in image_gen under Producer direction; deterministic WebP packaging by Codex',
 license:'Project-original generated artwork under existing game asset policy; no third-party download',
 rights:{commercialUse:true,modification:true,redistribution:true,basis:'Original effect artwork created for this project'},
 producerApproval:'Current smartphone goal requests bespoke manual ability animations; candidate, not final visual/audio/device acceptance',
 source:{path:masterPath,bytes:master.length,sha256:sha(master)},
 prompt:{path:recipe.promptPath,sha256:sha(Buffer.from((await readFile(path.join(root,recipe.promptPath),'utf8')).replaceAll('\r\n','\n')))},
 generation:{mode:'built-in image_gen generation',model:'Selected by host; no model name asserted',characterReferences:[]},
 calibration:recipe.calibration,
 output:{path:assetPath,bytes:bytes.length,sha256:sha(bytes),width:1536,height:1024,columns:3,rows:2,
  anchorX:recipe.anchorX,anchorY:recipe.anchorY},
 runtimeAssetCount:1,logicalBytes:bytes.length,distinctBytes:bytes.length,estimatedDecodedRgbaBytes:1536*1024*4,
 scope:'Optional Tatara ground contact only. Same physical hammer socket, 180px size and .60s contact lifetime. Body, weapon, damage, timing, audio, rewards and save remain unchanged.'};
await emit(folder+'/provenance-r1.json',Buffer.from(JSON.stringify(provenance,null,2)+'\n'));
console.log(JSON.stringify({check,assets:2,bytes:bytes.length+musashiBytes.length,tataraSha256:sha(bytes),musashiSha256:sha(musashiBytes)},null,2));
