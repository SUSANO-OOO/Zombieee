import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import sharp from 'sharp';
import {V100_STORY_LOCATION_BACKDROPS} from '../app/v100StoryLocations.js';

const check=process.argv.includes('--check'),records=[];
const folder='assets/source/quality-20261028/locations';
await mkdir('public/art/v100/story-locations',{recursive:true});
for(const {path} of Object.values(V100_STORY_LOCATION_BACKDROPS)){
 const name=path.split('/').at(-1).replace(/\.webp$/u,'.png'),source=`${folder}/${name}`,output=`public${path}`;
 const original=await readFile(source),encoded=await sharp(original).resize({width:1600,withoutEnlargement:true}).webp({quality:86,effort:6}).toBuffer();
 if(check){if(!(await readFile(output)).equals(encoded))throw Error(`Stale location: ${output}`);}else await writeFile(output,encoded);
 const {width,height}=await sharp(encoded).metadata();
 records.push({source,sourceSha256:createHash('sha256').update(original).digest('hex'),output,sha256:createHash('sha256').update(encoded).digest('hex'),bytes:encoded.length,width,height});
}
const provenance={creator:'OpenAI built-in image_gen, directed for this project',source:'Project-original environment illustrations; existing project vehicle used as design reference. No private photos or external downloaded art.',license:'Project-original generated assets; governed by the existing OpenAI service agreement.',commercialUse:true,modification:true,redistribution:true,producerApproval:'2026-10-28 full quality update and adopted-master storage authorization; final visual acceptance pending.',method:'Resize to 1600 px and encode WebP quality 86; no content editing.',runtimeAssetCount:records.length,logicalBytes:records.reduce((s,r)=>s+r.bytes,0),distinctBytes:records.reduce((s,r)=>s+r.bytes,0),records};
const serialized=JSON.stringify(provenance,null,2)+'\n',target=`${folder}/provenance.json`;
if(check){if(await readFile(target,'utf8')!==serialized)throw Error('Stale location provenance');}else await writeFile(target,serialized);
console.log(JSON.stringify({check,count:records.length,bytes:provenance.distinctBytes}));
