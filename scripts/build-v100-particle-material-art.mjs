import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root=process.cwd(),check=process.argv.includes('--check');
const folder='assets/source/quality-20261114/material-particles-r1';
const sha=b=>createHash('sha256').update(b).digest('hex');
const masterPath=folder+'/master-r1.png',master=await readFile(path.join(root,masterPath));
assert.equal(sha(master),'bf02fddb4ad5c7924d216192091960ab770f9572508aebac6b2faa21706f94e9');
const metadata=await sharp(master).metadata();
assert.deepEqual([metadata.width,metadata.height,metadata.hasAlpha],[1536,1024,true]);
const raw=await sharp(master).ensureAlpha().raw().toBuffer();
for(let cell=0;cell<6;cell++)for(let y=0;y<512;y++)for(let x=0;x<512;x++){
 if(x>=4&&x<508&&y>=4&&y<508)continue;
 assert.ok(raw[((Math.floor(cell/3)*512+y)*1536+cell%3*512+x)*4+3]<=32,'Cell edge must retain transparent padding');
}
async function emit(relative,bytes){
 const file=path.join(root,relative);
 if(check){const actual=await readFile(file);assert.deepEqual(/\.(?:js|json)$/.test(relative)?Buffer.from(actual.toString('utf8').replaceAll('\r\n','\n')):actual,bytes,relative);}
 else{await mkdir(path.dirname(file),{recursive:true});await writeFile(file,bytes);}
}
// 256px cells retain their original alpha and texture while keeping phone GPU memory bounded.
const bytes=await sharp(master).resize(768,512).webp({quality:92,alphaQuality:100,effort:6}).toBuffer();
const assetPath='/art/quality-20261114/vfx/particle-materials-six-r1.webp';
const art={particles:{id:'v100-particle-materials',path:assetPath,hash:'sha256-'+sha(bytes),columns:3,rows:2,width:768,height:512}};
await emit('public'+assetPath,bytes);
await emit('app/v100ParticleMaterialArt.js',Buffer.from('// Generated data only. Safe for the installation gate.\nexport const V100_PARTICLE_MATERIAL_ART=Object.freeze('+JSON.stringify(art,null,2)+');\n'));
const promptPath=folder+'/prompt-r1.txt';
await emit(folder+'/provenance-r1.json',Buffer.from(JSON.stringify({
 generator:'scripts/build-v100-particle-material-art.mjs',creator:'OpenAI built-in image_gen under Producer direction',
 license:'Project-original generated artwork under existing game asset policy',
 rights:{commercialUse:true,modification:true,redistribution:true,basis:'Original effect artwork created for this project'},
 generation:{mode:'built-in image_gen generation',model:'Selected by host; no model name asserted',characterReferences:[]},
 source:{path:masterPath,bytes:master.length,sha256:sha(master)},
 prompt:{path:promptPath,sha256:sha(Buffer.from((await readFile(path.join(root,promptPath),'utf8')).replaceAll('\r\n','\n')))},
 output:{path:assetPath,bytes:bytes.length,sha256:sha(bytes),width:768,height:512,columns:3,rows:2},
 materials:['concrete','oxidized-steel','charcoal-ember','burnt-fabric','ash','organic-spatter'],
 estimatedDecodedRgbaBytes:768*512*4,
 scope:'Phone V1 shared micro-particle paint only. Existing random calls, emitters, positions, speeds, lifetimes, counts, pool, damage and saves remain unchanged. Candidate, not final motion/listening/device acceptance.'
},null,2)+'\n'));
console.log(JSON.stringify({check,assets:1,bytes:bytes.length,sha256:sha(bytes)},null,2));
