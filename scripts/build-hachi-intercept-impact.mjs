import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const sourceFolder='assets/source/quality-20261126/hachi-intercept-impact-r1';
const masterPath=sourceFolder+'/master.png';
const promptPath=sourceFolder+'/prompt.txt';
const runtimePath='/art/quality-20261126/vfx/hachi-intercept-six-r1.webp';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const master=await readFile(masterPath);
assert.equal(hash(master),'29c924ecccec9ffafeeed1133bb97fcd4ee054129517a398c558a05465e3ff3a');
const metadata=await sharp(master).metadata();
assert.deepEqual([metadata.width,metadata.height,metadata.hasAlpha],[1536,1024,true]);

const cellSize=256, sourceSize=512, gutter=12, innerSize=cellSize-2*gutter;
const composites=[], anchors=[];
for(let cell=0;cell<6;cell++){
 const left=cell%3*sourceSize, top=Math.floor(cell/3)*sourceSize;
 const rgba=await sharp(master).extract({left,top,width:sourceSize,height:sourceSize}).ensureAlpha().raw().toBuffer();
 let mass=0, sumX=0, sumY=0;
 for(let y=0;y<sourceSize;y++){
  for(let x=0;x<sourceSize;x++){
   const i=(y*sourceSize+x)*4, a=rgba[i+3];
   const edge=Math.min(x,y,sourceSize-1-x,sourceSize-1-y);
   // Taper the source's mist at cell edges before adding a clear atlas gutter.
   rgba[i+3]=Math.round(a*Math.min(1,edge/24)**2*Math.min(1,a/48));
   const intensity=Math.min(rgba[i],rgba[i+1],rgba[i+2]);
   if(cell<3&&a>=216&&intensity>=226&&x<203&&y>=316&&y<402){
    const weight=(intensity-214)*a/255;
    mass+=weight;
    sumX+=(x+.5)*weight;
    sumY+=(y+.5)*weight;
   }
  }
 }
 if(cell<3){
  assert.ok(mass>0,'Missing bright contact center in cell '+cell);
  anchors.push([sumX/mass,sumY/mass].map(value=>Number(((gutter+value*innerSize/sourceSize)/cellSize).toFixed(8))));
 }else anchors.push(anchors[2]);
 const image=await sharp(rgba,{raw:{width:sourceSize,height:sourceSize,channels:4}}).resize(innerSize,innerSize).png().toBuffer();
 composites.push({input:image,left:cell%3*cellSize+gutter,top:Math.floor(cell/3)*cellSize+gutter});
}
const width=768,height=512;
const encoded=await sharp({create:{width,height,channels:4,background:{r:0,g:0,b:0,alpha:0}}})
 .composite(composites).webp({quality:94,alphaQuality:100,effort:6}).toBuffer();
const decoded=await sharp(encoded).ensureAlpha().raw().toBuffer();
for(let cell=0;cell<6;cell++){
 const left=cell%3*cellSize,top=Math.floor(cell/3)*cellSize;
 let visible=0;
 for(let y=0;y<cellSize;y++){
  for(let x=0;x<cellSize;x++){
   const alpha=decoded[((top+y)*width+left+x)*4+3];
   if(x<gutter||y<gutter||x>=cellSize-gutter||y>=cellSize-gutter)assert.equal(alpha,0);
   visible+=alpha>=40?1:0;
  }
 }
 assert.ok(visible>100,'Missing painted cell '+cell);
}
const material={id:'v100-hachi-intercept-impact',path:runtimePath,hash:'sha256-'+hash(encoded),width,height,columns:3,rows:2,worldSize:174,anchors};
const prompt=Buffer.from((await readFile(promptPath,'utf8')).replaceAll('\r\n','\n'));
const provenance={
 creator:'OpenAI built-in image_gen under project direction. Atlas preparation by Codex.',
 license:'Project-original generated material art under the game asset policy',
 rights:{commercialUse:true,modification:true,redistribution:true,basis:'Project-original output without external reference artwork'},
 producerApproval:'The active mobile game goal requests dedicated material animation for manual abilities.',
 generation:{mode:'built-in image_gen',characterReferences:[],promptPath,promptSha256:hash(prompt)},
 source:{path:masterPath,bytes:master.length,sha256:hash(master),width:1536,height:1024,hasAlpha:true},
 processing:{script:'scripts/build-hachi-intercept-impact.mjs',sourceCellSize:sourceSize,transparentGutter:gutter},
 output:{...material,bytes:encoded.length},runtimeAssetCount:1,logicalBytes:encoded.length,distinctBytes:encoded.length,
};
const provenancePath=sourceFolder+'/provenance.json';
const provenanceBytes=Buffer.from(JSON.stringify(provenance,null,2)+'\n');
if(process.argv.includes('--verify')){
 const {V100_MANUAL_IMPACT_ART}=await import('../app/v100ManualImpactArt.js');
 assert.deepEqual(V100_MANUAL_IMPACT_ART.scout,material);
 assert.deepEqual(await readFile('public'+runtimePath),encoded);
 assert.deepEqual(JSON.parse(await readFile(provenancePath,'utf8')),provenance);
}else{
 await mkdir(path.dirname('public'+runtimePath),{recursive:true});
 await writeFile('public'+runtimePath,encoded,{flag:'wx'});
 await writeFile(provenancePath,provenanceBytes,{flag:'wx'});
}
console.log(JSON.stringify({material,bytes:encoded.length}));
