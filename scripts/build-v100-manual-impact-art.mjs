import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

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
console.log(JSON.stringify({check,assets:1,bytes:bytes.length,sha256:sha(bytes)},null,2));
