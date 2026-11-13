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
  {kind:'mother',name:'Mother',anchorY:450/512,includesPrelude:true,
    masterSha256:'9e213b45566f6c8edac59197f3e7d1e540ed58523add269ced72e225a7d84eef',
    intermediateMasterSha256:'ddd8bfcea0eee2185ed4ffe0b1fce9c23b668931849de7280ae0c96155c432f0',
    materialReference:{path:'assets/source/v100/joints/mother-r1/identity-reference.png',sha256:'c11c56474860367a0cb12e05b5164d31161fe45157c3ffd95a52a73613211765'},
    note:'R1 organic rupture followed by one native layout and alpha correction. R1 and failed edge analysis remain local evidence.'},
  {"kind":"kurome","name":"Kurome","anchorY":0.87890625,"includesPrelude":true,"revision":1,"generationMode":"built-in image_gen generation with references","masterSha256":"2af1d8eb534fa0acdfa230f7ae67739c1d220e4c12d640096a3c54c7edd95436","materialReference":{"path":"assets/source/v100/joints/kurome-r1/identity-reference.png","sha256":"20232f95175309421f78e2e52220edd3846ecfb468195c739a74b441a520a5e5"},"note":"Single native reference-guided effect-only atlas; R1 selected after cell-edge inspection. Full body identity is unchanged."},
  {"kind":"ooguchi","name":"Ooguchi","anchorY":0.87890625,"includesPrelude":true,"revision":1,"generationMode":"built-in image_gen generation with references","masterSha256":"f7c603b87c9ef598f3d15faa0161310b05ca8ef53b6e6a609c85d4d7a396de8b","materialReference":{"path":"assets/source/v100/joints/ooguchi-r1/identity-reference.png","sha256":"31d8f4f332c5d647ff6115d0229cfe5fe884db3c5bbdd199c9660b1c2496b92d"},"note":"Single native reference-guided effect-only atlas; R1 selected after cell-edge inspection. Full body identity is unchanged."},
  {"kind":"gairen","name":"Gairen","anchorY":0.87890625,"includesPrelude":true,"revision":1,"generationMode":"built-in image_gen generation with references","masterSha256":"c408070ffa37a875560e32747a860bf0295490b8d99dd8d50c87bd839fd30f7b","materialReference":{"path":"assets/source/v100/joints/gairen-r1/identity-reference.png","sha256":"b8cb2167c3a57c3ecfd3add5e3c46748adf9d1dc24e62a3c1e27ff0797fa7ab6"},"note":"Single native reference-guided effect-only atlas; R1 selected after cell-edge inspection. Full body identity is unchanged."},
  {kind:'takuya',name:'TAKUYA',anchorY:450/512,includesPrelude:true,revision:1,
    generationMode:'built-in image_gen generation with references',
    masterSha256:'b0904e15fed274631d672b31666a712056e2b9336492efb3518d431942fee681',
    materialReference:{path:'assets/source/v100/joints/takuya-r1/identity-reference.png',sha256:'12b600124ad71c155fdb50f56df66a9a1e85085976194719f4d44bb7f42e221b'},
    note:'Heavy ground-contact grit and friction sparks only; the human boss and steel weapon remain intact. This is not the playable TKY.'},
  {kind:'mugarian-president-mutated',name:'Mutated President',anchorY:450/512,includesPrelude:true,revision:1,
    generationMode:'built-in image_gen generation with references',
    masterSha256:'94b70cbceb922e174e6b2fdd86aa3b6dbc7af12fa3e1d8328cb06aebf1ce5d37',
    materialReference:{path:'assets/source/v100/joints/mugarian-president-mutated-r1/identity-reference.png',sha256:'7da97f17c9d7facfa318e2afa8ef17c4a030eb5128d60b1101c00628c3c8d351'},
    note:'Existing olive pressure vent, small brass fittings and dust only. Human identity, body and gameplay effects are unchanged.'},
  {kind:'futago',name:'Futago separated A/B',anchorY:450/512,includesPrelude:true,revision:1,
    generationMode:'built-in image_gen generation with references',
    masterSha256:'51af8039549f1bf84ae8fafeeef937f2c5307f7b6c9e44f0020d838f479489d7',
    materialReferences:[
      {path:'assets/source/v100/joints/futago-separated-a-r1/identity-reference.png',sha256:'08bc90fcf191b912d37e0efa431971241337ee9a865b24fdb3e2fb85b0469aef'},
      {path:'assets/source/v100/joints/futago-separated-b-r1/identity-reference.png',sha256:'70959eb24119e652c7e42c34d86f9ae284181e15a23713a1a1609fb5d5f8513a'}],
    note:'Asymmetric copper fissure release and charred bindings follow both current separated forms. The retired fused figure is not a reference.'},
  {kind:'takuya-omega',name:'TAKUYA OMEGA',anchorY:450/512,includesPrelude:true,
    masterSha256:'e88b0d492caaa1655397ed12ec86837eb7d284265c1a1e35ac2ae4ee4f010bc9',
    intermediateMasterSha256:'49e9a3137cc12d6b0b07477550bc83634cb2ae196540368693132fdde3c2374e',
    materialReference:{path:'assets/source/v100/joints/takuya-omega-r3/identity-reference.png',sha256:'5505512cd19684b6dadcc3b9c89b01a1a620c096675f3de35a63a237e75c0487'},
    note:'R1 pressure rupture followed by a native cell-layout correction; R1 and failed edge analysis remain evidence. Only small hardware, smoke and sparks are depicted.'},
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
  const revision=recipe.revision??2;
  const sourcePath='assets/source/quality-20261114/vfx/'+recipe.kind+'-rupture-r'+revision+'.png';
  const promptPath='assets/source/quality-20261114/vfx/'+recipe.kind+'-rupture-prompt-r'+revision+'.txt';
  const master=await readFile(path.join(root,sourcePath));
  assert.equal(sha(master),recipe.masterSha256,'Selected native master changed: '+recipe.kind);
  for(const ref of recipe.materialReferences??(recipe.materialReference?[recipe.materialReference]:[]))
    assert.equal(sha(await readFile(path.join(root,ref.path))),ref.sha256,'Current material identity changed');
  const metadata=await sharp(master).metadata();
  assert.deepEqual([metadata.width,metadata.height,metadata.hasAlpha],[1536,1024,true]);
  const raw=await sharp(master).ensureAlpha().raw().toBuffer();
  for(let cell=0;cell<6;cell++)for(let y=0;y<512;y++)for(let x=0;x<512;x++){
    if(x>=4&&x<508&&y>=4&&y<508)continue;
    const alpha=raw[((Math.floor(cell/3)*512+y)*1536+(cell%3)*512+x)*4+3];
    assert.ok(alpha<=32,'A painted cell must not end with a hard opaque clipped edge');
  }
  const bytes=await sharp(master).webp({quality:92,alphaQuality:100,effort:6}).toBuffer();
  const assetPath='/art/quality-20261114/vfx/'+recipe.kind+'-rupture-six-r'+revision+'.webp';
  art[recipe.kind]={id:'v100-boss-finale-'+recipe.kind,path:assetPath,hash:'sha256-'+sha(bytes),columns:3,rows:2,anchorX:.5,anchorY:recipe.anchorY};
  if(recipe.includesPrelude)art[recipe.kind].includesPrelude=true;
  await emit('public'+assetPath,bytes);
  const provenance={generator:'scripts/build-v100-boss-defeat-art.mjs',creator:'OpenAI built-in image_gen under Producer direction; deterministic WebP packaging by Codex',
    license:'Project-original generated artwork under the existing game asset policy; no third-party download',
    rights:{commercialUse:true,modification:true,redistribution:true,basis:'Original art created for this project, with the existing project-owned blast as style reference'},
    producerApproval:'Current goal requests bespoke boss effects. This is an implementation candidate, not final visual/audio/device acceptance.',
    source:{path:sourcePath,bytes:master.length,sha256:sha(master)},prompt:{path:promptPath,sha256:sha(Buffer.from((await readFile(path.join(root,promptPath),'utf8')).replaceAll('\r\n','\n')))},
    generation:{mode:recipe.generationMode??'built-in image_gen edit',model:'Selected by host; no model name asserted',reference:{path:referencePath,sha256:sha(await readFile(path.join(root,referencePath)))},
      ...(recipe.intermediateMasterSha256?{intermediateMasterSha256:recipe.intermediateMasterSha256}:{}),note:recipe.note,
      ...(recipe.materialReference?{materialReference:recipe.materialReference}:{}),
      ...(recipe.materialReferences?{materialReferences:recipe.materialReferences}:{})},
    output:{path:assetPath,bytes:bytes.length,sha256:sha(bytes),width:1536,height:1024,columns:3,rows:2,anchorX:.5,anchorY:recipe.anchorY,
      ...(recipe.includesPrelude?{includesPrelude:true}:{})},
    runtimeAssetCount:1,logicalBytes:bytes.length,distinctBytes:bytes.length,estimatedDecodedRgbaBytes:1536*1024*4,
    scope:recipe.name+' visual finale only. Existing body, defeat receipt, result wait, damage, rewards, random sequence and audio are unchanged.'};
  await emit('assets/source/quality-20261114/vfx/'+recipe.kind+'-rupture-provenance-r'+revision+'.json',Buffer.from(JSON.stringify(provenance,null,2)+'\n'));
  outputs.push({kind:recipe.kind,bytes:bytes.length,hash:sha(bytes)});
}
await emit('app/v100BossDefeatArt.js',Buffer.from('// Generated from bespoke boss VFX masters. Do not add these to the common every-stage VFX list.\nexport const V100_BOSS_DEFEAT_ART = Object.freeze(Object.fromEntries(Object.entries('+JSON.stringify(art,null,2)+').map(([kind,art])=>[kind,Object.freeze(art)])));\n'));
console.log(JSON.stringify({check,assets:outputs.length,bytes:outputs.reduce((sum,entry)=>sum+entry.bytes,0),outputs}));
