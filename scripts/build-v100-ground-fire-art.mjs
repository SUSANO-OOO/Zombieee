import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root=process.cwd(),check=process.argv.includes('--check');
const folder='assets/source/quality-20261115/vfx/ground-fire-bed-r1';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const recipe=JSON.parse(await readFile(path.join(root,folder,'selected-recipe.json'),'utf8'));
const master=await readFile(path.join(root,recipe.masterPath));
assert.equal(sha(master),recipe.masterSha256,'Selected fire master changed');
assert.ok(master.length<25*1024*1024,'Master requires storage review');
const metadata=await sharp(master).metadata();
assert.deepEqual([metadata.width,metadata.height,metadata.hasAlpha],[1536,1024,true]);
assert.ok([recipe.anchorX,recipe.anchorY].every(n=>Number.isFinite(n)&&n>0&&n<1));
const raw=await sharp(master).ensureAlpha().raw().toBuffer();
const cells=[];
for(let cell=0;cell<6;cell++){
 let margin=0,visible=0;
 for(let y=0;y<512;y++)for(let x=0;x<512;x++){
  const alpha=raw[((Math.floor(cell/3)*512+y)*1536+cell%3*512+x)*4+3];
  if(x<32||x>=480||y<32||y>=480)margin=Math.max(margin,alpha);
  if(alpha>32)visible++;
 }
 assert.ok(margin<=32&&visible>0,'Fire requires paint and transparent 32px gutters');
 cells.push({frame:cell,maxMarginAlpha:margin,visiblePixels:visible});
}
async function emit(relative,bytes){
 const file=path.join(root,relative);
 if(check){
  const actual=await readFile(file);
  const normalized=/\.(?:js|json)$/.test(relative)?Buffer.from(actual.toString('utf8').replaceAll('\r\n','\n')):actual;
  assert.deepEqual(normalized,bytes,relative+' differs from selected source');
 }else{await mkdir(path.dirname(file),{recursive:true});await writeFile(file,bytes);}
}
const bytes=await sharp(master).resize(768,512).webp({quality:92,alphaQuality:100,effort:6}).toBuffer();
const assetPath='/art/quality-20261115/vfx/ground-fire-bed-six-r1.webp';
const art={burn:{id:'v100-ground-fire-bed',path:assetPath,hash:'sha256-'+sha(bytes),
 width:768,height:512,columns:3,rows:2,anchorX:recipe.anchorX,anchorY:recipe.anchorY}};
await emit('public'+assetPath,bytes);
await emit('app/v100GroundFireArt.js',Buffer.from('// Generated data only. PwaGate must not import the battle renderer.\nexport const V100_GROUND_FIRE_BED_ART=Object.freeze('+JSON.stringify(art,null,2)+');\n'));
await emit(folder+'/provenance-r1.json',Buffer.from(JSON.stringify({
 generator:'scripts/build-v100-ground-fire-art.mjs',
 creator:'OpenAI built-in image_gen under Producer direction; deterministic smartphone WebP packaging by Codex',
 license:'Project-original generated material artwork under existing game asset policy; no third-party download',
 rights:{commercialUse:true,modification:true,redistribution:true,basis:'Original material-only fire created for this project'},
 producerApproval:'Current smartphone goal requests varied fire, smoke and embers without geometric markers; candidate, not final motion/audio/device acceptance',
 source:{path:recipe.masterPath,bytes:master.length,sha256:sha(master)},
 prompt:{path:recipe.promptPath,sha256:sha(Buffer.from((await readFile(path.join(root,recipe.promptPath),'utf8')).replaceAll('\r\n','\n')))},
 generation:{mode:'built-in image_gen generation',model:'Selected by host; no model name asserted',characterReferences:[]},
 calibration:recipe.calibration,cells,output:{...art.burn,bytes:bytes.length},
 runtimeAssetCount:1,logicalBytes:bytes.length,distinctBytes:bytes.length,estimatedDecodedRgbaBytes:768*512*4,
 scope:'Optional connected fire bed behind actors. Existing burn area, expiry, damage, slow, audio, rewards and saves retained. Source choice is latched for each real burn; old installed packs and late or unavailable art retain the existing thirty-frame fire throughout that burn.'
},null,2)+'\n'));
console.log(JSON.stringify({check,assets:1,bytes:bytes.length,sha256:sha(bytes),cells},null,2));
