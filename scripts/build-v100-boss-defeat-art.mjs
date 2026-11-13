// Source-preserving packaging of bespoke painted boss finale atlases.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root=path.resolve(import.meta.dirname,'..'),check=process.argv.includes('--check');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const referencePath='public/art/quality-20261113/vfx/boss-blast-six-r2.webp';
const recipes=[
  {kind:'gate-eater',name:'Gate Eater',anchorY:470/512,
    masterSha256:'cbce750c73d2ba5b1aa1065d93681ed00cb1a079581be851a2e45bc259da9d52',
    intermediateMasterSha256:'762749228cead4c537633bfce40e020bd7304862eeed900bca98a5545c5ae0e8',
    note:'R1 industrial rupture followed by one native layout correction. R1 and failed edge analysis remain local evidence.'},
  {kind:'mother',name:'Mother',anchorY:450/512,
    masterSha256:'9e213b45566f6c8edac59197f3e7d1e540ed58523add269ced72e225a7d84eef',
    intermediateMasterSha256:'ddd8bfcea0eee2185ed4ffe0b1fce9c23b668931849de7280ae0c96155c432f0',
    materialReference:{path:'assets/source/v100/joints/mother-r1/identity-reference.png',sha256:'c11c56474860367a0cb12e05b5164d31161fe45157c3ffd95a52a73613211765'},
    note:'R1 organic rupture followed by one native layout and alpha correction. R1 and failed edge analysis remain local evidence.'},
];
async function emit(relative,data){
  const file=path.join(root,relative);
  if(check){
    const actual=await readFile(file);
    const comparable=/\.(js|json)$/.test(relative)?Buffer.from(actual.toString('utf8').replaceAll('\r\n','\n')):actual;
    assert.deepEqual(comparable,data,relative+' differs from its source');
  }else{await mkdir(path.dirname(file),{recursive:true});await writeFile(file,data);}
}
const art={},outputs=[];
for(const recipe of recipes){
  const sourcePath='assets/source/quality-20261114/vfx/'+recipe.kind+'-rupture-r2.png';
  const promptPath='assets/source/quality-20261114/vfx/'+recipe.kind+'-rupture-prompt-r2.txt';
  const master=await readFile(path.join(root,sourcePath));
  assert.equal(sha(master),recipe.masterSha256,'Selected native master changed: '+recipe.kind);
  if(recipe.materialReference)assert.equal(sha(await readFile(path.join(root,recipe.materialReference.path))),recipe.materialReference.sha256,'Current material identity changed');
  const metadata=await sharp(master).metadata();
  assert.deepEqual([metadata.width,metadata.height,metadata.hasAlpha],[1536,1024,true]);
  const raw=await sharp(master).ensureAlpha().raw().toBuffer();
  for(let cell=0;cell<6;cell++)for(let y=0;y<512;y++)for(let x=0;x<512;x++){
    if(x>=4&&x<508&&y>=4&&y<508)continue;
    const alpha=raw[((Math.floor(cell/3)*512+y)*1536+(cell%3)*512+x)*4+3];
    assert.ok(alpha<=32,'A painted cell must not end with a hard opaque clipped edge');
  }
  const bytes=await sharp(master).webp({quality:92,alphaQuality:100,effort:6}).toBuffer();
  const assetPath='/art/quality-20261114/vfx/'+recipe.kind+'-rupture-six-r2.webp';
  art[recipe.kind]={id:'v100-boss-finale-'+recipe.kind,path:assetPath,hash:'sha256-'+sha(bytes),columns:3,rows:2,anchorX:.5,anchorY:recipe.anchorY};
  await emit('public'+assetPath,bytes);
  const provenance={generator:'scripts/build-v100-boss-defeat-art.mjs',creator:'OpenAI built-in image_gen under Producer direction; deterministic WebP packaging by Codex',
    license:'Project-original generated artwork under the existing game asset policy; no third-party download',
    rights:{commercialUse:true,modification:true,redistribution:true,basis:'Original art created for this project, with the existing project-owned blast as style reference'},
    producerApproval:'Current goal requests bespoke boss effects. This is an implementation candidate, not final visual/audio/device acceptance.',
    source:{path:sourcePath,bytes:master.length,sha256:sha(master)},prompt:{path:promptPath,sha256:sha(Buffer.from((await readFile(path.join(root,promptPath),'utf8')).replaceAll('\r\n','\n')))},
    generation:{mode:'built-in image_gen edit',model:'Selected by host; no model name asserted',reference:{path:referencePath,sha256:sha(await readFile(path.join(root,referencePath)))},
      intermediateMasterSha256:recipe.intermediateMasterSha256,note:recipe.note,
      ...(recipe.materialReference?{materialReference:recipe.materialReference}:{})},
    output:{path:assetPath,bytes:bytes.length,sha256:sha(bytes),width:1536,height:1024,columns:3,rows:2,anchorX:.5,anchorY:recipe.anchorY},
    runtimeAssetCount:1,logicalBytes:bytes.length,distinctBytes:bytes.length,estimatedDecodedRgbaBytes:1536*1024*4,
    scope:recipe.name+' visual finale only. Existing body, defeat receipt, result wait, damage, rewards, random sequence and audio are unchanged.'};
  await emit('assets/source/quality-20261114/vfx/'+recipe.kind+'-rupture-provenance-r2.json',Buffer.from(JSON.stringify(provenance,null,2)+'\n'));
  outputs.push({kind:recipe.kind,bytes:bytes.length,hash:sha(bytes)});
}
await emit('app/v100BossDefeatArt.js',Buffer.from('// Generated from bespoke boss VFX masters. Do not add these to the common every-stage VFX list.\nexport const V100_BOSS_DEFEAT_ART = Object.freeze(Object.fromEntries(Object.entries('+JSON.stringify(art,null,2)+').map(([kind,art])=>[kind,Object.freeze(art)])));\n'));
console.log(JSON.stringify({check,assets:outputs.length,bytes:outputs.reduce((sum,entry)=>sum+entry.bytes,0),outputs}));
