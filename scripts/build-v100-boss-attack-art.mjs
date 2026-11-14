import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root=process.cwd(),check=process.argv.includes('--check');
const folder='assets/source/quality-20261114/boss-attacks-r1';
const sha=b=>createHash('sha256').update(b).digest('hex');
const recipes=JSON.parse(await readFile(path.join(root,folder,'selected-recipes.json'),'utf8'));
const kinds=['mother','ooguchi','gairen','futago','mugarian-president-mutated','takuya-omega','takuya','gate-eater','kurome'];
assert.deepEqual(recipes.map(r=>r.kind),kinds);
async function emit(relative,bytes){
 const file=path.join(root,relative);
 if(check){
  const actual=await readFile(file);
  const normalized=/\.(?:js|json)$/.test(relative)?Buffer.from(actual.toString('utf8').replaceAll('\r\n','\n')):actual;
  assert.deepEqual(normalized,bytes,relative+' differs from its selected source');
 }else{await mkdir(path.dirname(file),{recursive:true});await writeFile(file,bytes);}
}
const art={},outputs=[];let totalMasterBytes=0;
for(const recipe of recipes){
 const revision=recipe.revision??1;
 const sourcePath=folder+'/'+recipe.kind+'-r'+revision+'-master.png';
 const master=await readFile(path.join(root,sourcePath));
 assert.equal(sha(master),recipe.masterSha256,'Selected master changed: '+recipe.kind);
 assert.ok(master.length<25*1024*1024,'Master requires storage review');
 totalMasterBytes+=master.length;
 assert.ok(totalMasterBytes<100*1024*1024,'Family requires storage review');
 const metadata=await sharp(master).metadata();
 assert.deepEqual([metadata.width,metadata.height,metadata.hasAlpha],[1536,1024,true]);
 const raw=await sharp(master).ensureAlpha().raw().toBuffer();
 for(let cell=0;cell<6;cell++)for(let y=0;y<512;y++)for(let x=0;x<512;x++){
  if(x>=4&&x<508&&y>=4&&y<508)continue;
  assert.ok(raw[((Math.floor(cell/3)*512+y)*1536+(cell%3)*512+x)*4+3]<=32,
   'Painted cell must not have a hard clipped edge: '+recipe.kind);
 }
 assert.ok([recipe.anchorX,recipe.anchorY].every(n=>Number.isFinite(n)&&n>=0&&n<=1));
 if(recipe.renderWidth!==undefined)assert.ok([recipe.renderWidth,recipe.renderHeight].every(n=>Number.isFinite(n)&&n>0&&n<=512));
 if(recipe.beamStartX!==undefined)assert.ok([recipe.beamStartX,recipe.beamEndX,recipe.beamAxisY,recipe.beamSpanY].every(Number.isFinite)
  &&recipe.beamStartX>=0&&recipe.beamEndX>recipe.beamStartX&&recipe.beamEndX<=1&&recipe.beamAxisY>=0&&recipe.beamAxisY<=1&&recipe.beamSpanY>0&&recipe.beamSpanY<=1);
 const bytes=await sharp(master).webp({quality:92,alphaQuality:100,effort:6}).toBuffer();
 const assetPath='/art/quality-20261114/vfx/'+recipe.kind+'-attack-six-r'+revision+'.webp';
 art[recipe.kind]={id:'v100-boss-attack-'+recipe.kind,path:assetPath,hash:'sha256-'+sha(bytes),
  columns:3,rows:2,anchorX:recipe.anchorX,anchorY:recipe.anchorY,
  ...(recipe.renderWidth!==undefined?{renderWidth:recipe.renderWidth,renderHeight:recipe.renderHeight}:{}),
  ...(recipe.beamStartX!==undefined?{beamStartX:recipe.beamStartX,beamEndX:recipe.beamEndX,beamAxisY:recipe.beamAxisY,beamSpanY:recipe.beamSpanY}:{})};
 await emit('public'+assetPath,bytes);
 const provenance={generator:'scripts/build-v100-boss-attack-art.mjs',
  creator:'OpenAI built-in image_gen under Producer direction; deterministic WebP packaging by Codex',
  license:'Project-original generated artwork under the existing game asset policy; no third-party download',
  rights:{commercialUse:true,modification:true,redistribution:true,basis:'Original effect artwork created for this project'},
  producerApproval:'Current smartphone goal requests bespoke animated boss attacks; candidate, not final visual/audio/device acceptance',
  source:{path:sourcePath,bytes:master.length,sha256:sha(master)},
  prompt:{path:recipe.promptPath,sha256:sha(Buffer.from((await readFile(path.join(root,recipe.promptPath),'utf8')).replaceAll('\r\n','\n')))},
  generation:{mode:recipe.generationMode??'built-in image_gen generation',model:'Selected by host; no model name asserted',characterReferences:[],note:recipe.note,
   ...(recipe.editTarget?{editTarget:recipe.editTarget}:{})},
  ...(recipe.calibration?{calibration:recipe.calibration}:{}),
  output:{path:assetPath,bytes:bytes.length,sha256:sha(bytes),width:1536,height:1024,columns:3,rows:2,anchorX:recipe.anchorX,anchorY:recipe.anchorY},
  runtimeAssetCount:1,logicalBytes:bytes.length,distinctBytes:bytes.length,estimatedDecodedRgbaBytes:1536*1024*4,
  scope:recipe.scope??'Optional visual aftermath for '+recipe.kind+' only; body, warnings, damage, timing, audio, rewards and save are unchanged'};
 await emit(folder+'/'+recipe.kind+'-provenance-r'+revision+'.json',Buffer.from(JSON.stringify(provenance,null,2)+'\n'));
 outputs.push({kind:recipe.kind,bytes:bytes.length,sha256:sha(bytes)});
}
await emit('app/v100BossAttackArt.js',Buffer.from('// Generated data only. PwaGate must not import the battle renderer.\nexport const V100_BOSS_ATTACK_ART=Object.freeze('+JSON.stringify(art,null,2)+');\n'));
console.log(JSON.stringify({check,assets:outputs.length,bytes:outputs.reduce((n,r)=>n+r.bytes,0),outputs},null,2));
