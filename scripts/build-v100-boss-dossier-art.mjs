// Derive compact dossier figures from the exact identities used by current V1 rigs.
// No illustration is repainted, and the old fused Futago is never a V1 source.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {V177_JOINT_ATLASES} from '../app/v177JointPresentation.js';
import {bossRenderKind} from '../app/bossFoundation.js';
import {V100_BOSSES} from '../app/v100Registry.js';

const root=path.resolve(import.meta.dirname,'..');
const check=process.argv.includes('--check');
const write=process.argv.includes('--write');
const outAt=process.argv.indexOf('--out');
const preview=outAt>=0;
assert.equal(Number(check)+Number(write)+Number(preview),1,'Choose --check, --write, or --out <preview directory>');
const previewRoot=preview?path.resolve(process.argv[outAt+1]):null;
const width=256,height=288;
const kinds=['takuya','gate-eater','kurome','mother','ooguchi','gairen','futago','mugarian-president-mutated','takuya-omega'];
assert.deepEqual(kinds.map(kind=>'boss-'+kind).sort(),V100_BOSSES.map(boss=>boss.id).sort(),'Every current boss has exactly one dossier');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const relative=file=>path.relative(root,file).replaceAll('\\','/');
const entries=[],art={};
async function emit(file,bytes){
  if(check)assert.deepEqual(await readFile(file),bytes,relative(file)+' differs from its source');
  else{await mkdir(path.dirname(file),{recursive:true});await writeFile(file,bytes);}
}

async function sourceFor(kind){
  const atlas=V177_JOINT_ATLASES[kind];assert.ok(atlas?.path,'Current painted joint atlas required: '+kind);
  const part=kind.startsWith('futago-separated-')?kind.at(-1):null;
  const fighter={kind:part?'futago':kind,...(part?{v100TwinPart:part}:{})};
  assert.equal(bossRenderKind(fighter),kind,'Dossier must use the actual current render form');
  const directory=path.join(root,'assets/source/v100/joints',path.basename(atlas.path,'.webp'));
  const provenancePath=path.join(directory,'provenance.json');
  const provenance=JSON.parse(await readFile(provenancePath,'utf8'));
  const texture=await readFile(path.join(root,'public',atlas.path.slice(1)));
  assert.equal(provenance.assetPath,atlas.path);assert.equal(sha(texture),provenance.sha256);
  const sourcePath=path.join(directory,'identity-reference.png'),source=await readFile(sourcePath);
  assert.equal(sha(source),provenance.identitySourceSha256,'The exact original identity must remain unchanged');
  const canonical=await readFile(path.join(root,'public',provenance.identityBinding.path.slice(1)));
  assert.equal(sha(canonical),provenance.identityBinding.sourceSha256,'Canonical identity sheet changed');
  const raw=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let left=raw.info.width,top=raw.info.height,right=-1,bottom=-1;
  for(let y=0;y<raw.info.height;y++)for(let x=0;x<raw.info.width;x++)if(raw.data[(y*raw.info.width+x)*4+3]>0){
    left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);
  }
  assert.ok(right>=left&&bottom>=top,'Nonempty canonical figure required');
  const crop={left,top,width:right-left+1,height:bottom-top+1};
  return {source,crop,receipt:{kind,source:relative(sourcePath),sourceSha256:sha(source),
    provenance:relative(provenancePath),currentTexture:{path:atlas.path,sha256:sha(texture)},
    canonical:provenance.identityBinding,crop}};
}

for(const kind of kinds){
  const sources=await Promise.all((kind==='futago'?['futago-separated-a','futago-separated-b']:[kind]).map(sourceFor));
  let png;
  if(kind==='futago'){
    // Two complete, separate current bodies share one floor and one scale.
    // Preserve both faces and limbs rather than cropping an obsolete fused image.
    const scale=Math.min((width-24)/sources.reduce((sum,s)=>sum+s.crop.width,0),(height-16)/Math.max(...sources.map(s=>s.crop.height)),1);
    const sizes=sources.map(s=>({width:Math.max(1,Math.floor(s.crop.width*scale)),height:Math.max(1,Math.floor(s.crop.height*scale))}));
    let x=Math.floor((width-sizes.reduce((sum,s)=>sum+s.width,0)-8)/2);
    const layers=[];
    for(let i=0;i<sources.length;i++){
      layers.push({input:await sharp(sources[i].source).extract(sources[i].crop).resize(sizes[i]).png().toBuffer(),left:x,top:height-8-sizes[i].height});
      x+=sizes[i].width+8;
    }
    png=await sharp({create:{width,height,channels:4,background:'#00000000'}}).composite(layers).png().toBuffer();
  }else png=await sharp(sources[0].source).extract(sources[0].crop).resize(width,height,{fit:'contain',background:'#00000000',withoutEnlargement:true,kernel:'lanczos3'}).png().toBuffer();
  const bytes=await sharp(png).webp({quality:92,alphaQuality:100,effort:6}).toBuffer();
  const id='boss-'+kind,assetPath='/art/quality-20261114/boss-dossiers/'+id+'.webp';
  art[id]={path:assetPath,hash:'sha256-'+sha(bytes)};
  await emit(preview?path.join(previewRoot,id+'.webp'):path.join(root,'public',assetPath.slice(1)),bytes);
  entries.push({id,assetPath,sha256:sha(bytes),bytes:bytes.length,width,height,inputs:sources.map(s=>s.receipt),
    composition:kind==='futago'?'Current separate A/B bodies; common scale and floor; no overlap':'Complete canonical figure; transparent contain, no repaint'});
}
const provenance={generator:'scripts/build-v100-boss-dossier-art.mjs',
  creator:'Original project artists; deterministic source-preserving derivation by Codex',
  rights:{origin:'Existing source-bound game artwork; no new external material',license:'Inherits the project-original rights and restrictions of the referenced canonical assets',
    commercialUse:'Inherited without expansion',modification:'Only transparent crop, uniform resize, and current twin composition',redistribution:'Runtime derivatives follow the existing project asset policy'},
  producerApproval:'Existing identities and current runtime forms retained; requested full UI finish. This derivation is not a claim of final visual acceptance.',
  dimensions:{width,height},runtimeAssetCount:entries.length,logicalBytes:entries.reduce((sum,e)=>sum+e.bytes,0),
  distinctBytes:[...new Map(entries.map(e=>[e.sha256,e.bytes])).values()].reduce((sum,n)=>sum+n,0),
  estimatedDecodedRgbaBytes:width*height*4*entries.length,
  scope:'Smartphone compendium figures only. Battle, voice, save, rewards, hidden-boss unlocks and identity artwork remain unchanged.',entries};
if(preview)await emit(path.join(previewRoot,'provenance.json'),Buffer.from(JSON.stringify(provenance,null,2)+'\n'));
else{
  await emit(path.join(root,'assets/source/quality-20261114/boss-dossiers/provenance.json'),Buffer.from(JSON.stringify(provenance,null,2)+'\n'));
  await emit(path.join(root,'app/v100BossDossierArt.js'),Buffer.from('// Generated from the current battle identities; see the source-bound dossier provenance.\nexport const V100_BOSS_DOSSIER_ART = Object.freeze('+JSON.stringify(art,null,2)+');\n'));
}
console.log(JSON.stringify({mode:preview?'preview':check?'check':'write',assets:entries.length,bytes:provenance.logicalBytes,estimatedDecodedRgbaBytes:provenance.estimatedDecodedRgbaBytes}));
