import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {applyV177ReactionRepairs,V177_REACTION_KINDS} from './v177-reaction-source-repairs.mjs';

const root=process.cwd(),folder='assets/source/v100/sprite-repairs/reactions';
const selected=process.argv.find(a=>a.startsWith('--kind='))?.slice(7),pngOnly=process.argv.includes('--png-only');
if(selected&&!V177_REACTION_KINDS.includes(selected))throw new RangeError('Unknown reaction kind');
if(selected&&!pngOnly)throw new Error('Full transport contract generation requires all four reaction kinds');
const inputs=JSON.parse(await readFile(path.join(root,folder,'inputs.json'),'utf8')),records=[];
for(const kind of V177_REACTION_KINDS.filter(k=>!selected||k===selected)){
  const assetPath=kind==='kumaverson'?'/art/v060/characters/kumaverson-battle-v1.png':`/art/v090/characters/${kind}-battle-r1.png`;
  const source=kind==='kumaverson'?path.join(root,folder,'kumaverson-approved-nonreaction-baseline-r1.png'):path.join(root,'public'+assetPath);
  const sourceData=await readFile(source);
  if(kind==='kumaverson'&&createHash('sha256').update(sourceData).digest('hex')!==inputs.inputs.find(i=>i.path===folder+'/kumaverson-approved-nonreaction-baseline-r1.png')?.sha256)throw new Error('Approved Kuma baseline changed');
  const png=await applyV177ReactionRepairs(kind,sourceData,root);await mkdir(path.dirname(path.join(root,'public'+assetPath)),{recursive:true});await writeFile(path.join(root,'public'+assetPath),png);
  if(pngOnly)continue;
  const sourcePath='/pwa-optimized'+assetPath.replace(/\.png$/u,'.webp'),webp=await sharp(png).webp({lossless:true,effort:6}).toBuffer();await mkdir(path.dirname(path.join(root,'public'+sourcePath)),{recursive:true});await writeFile(path.join(root,'public'+sourcePath),webp);
  const previous=inputs.transportBaselines.find(a=>a.path===assetPath);if(!previous)throw new Error('Missing pinned published transport');
  const next={path:assetPath,sourcePath,bytes:webp.length,hash:'sha256-'+createHash('sha256').update(webp).digest('hex'),criticality:previous.criticality};records.push({path:assetPath,previous,next,delta:next.bytes-previous.bytes});
}
if(!pngOnly){
  const additions=records.filter(r=>!r.path.includes('miyamoto-musashi'));
  await writeFile(path.join(root,'scripts/v177-reaction-repair-asset-contract.mjs'),`// Exact published-to-repaired reaction transports; master PNG hashes are separate.\nexport const V177_REACTION_SPRITE_REPLACEMENTS = Object.freeze(${JSON.stringify(additions,null,2)});\n`);
  const {buildV100SpriteRepairs}=await import('./build-v100-sprite-repairs.mjs');await buildV100SpriteRepairs();
}
console.log(JSON.stringify({reactionKinds:selected?[selected]:V177_REACTION_KINDS,pngOnly,changedStates:['hit','death'],otherCellsPreserved:10,nativeAcceptance:false}));
