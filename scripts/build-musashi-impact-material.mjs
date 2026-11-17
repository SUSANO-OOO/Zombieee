import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const root=process.cwd();
const sourceDir='assets/source/quality-20261117/musashi-impact-r2';
const source=await fs.readFile(path.join(root,sourceDir,'generated-r1.png'));
const hash=b=>createHash('sha256').update(b).digest('hex');
assert.equal(hash(source),'a2b27e807200d9ad1f03d3c6ea5d708deeaa6679853c0cbc6f89496460a8e7ea');
const meta=await sharp(source).metadata();assert.equal(meta.width,1536);assert.equal(meta.height,1024);assert.equal(meta.hasAlpha,true);
const composites=[],anchors=[],observations=[];
for(let cell=0;cell<6;cell++){
 const rect={left:cell%3*512,top:Math.floor(cell/3)*512,width:512,height:512};
 const original=await sharp(source).extract(rect).png().toBuffer();
 const {data}=await sharp(original).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 if(cell<3){
 const pixels=[];for(let y=230;y<512;y++)for(let x=0;x<256;x++){
  const p=(y*512+x)*4,a=data[p+3],light=Math.min(data[p],data[p+1],data[p+2]);
  if(a>=220&&light>=230)pixels.push({x:x+.5,y:y+.5,w:(light-180)**2*a/255});
 }
 assert.ok(pixels.length>0,'Bright physical contact core for cell '+cell);pixels.sort((a,b)=>a.x-b.x);
 const leftCore=pixels[Math.floor(pixels.length*.05)].x,core=pixels.filter(p=>p.x<=leftCore+8);
 const weight=core.reduce((n,p)=>n+p.w,0),xsum=core.reduce((n,p)=>n+p.x*p.w,0),ysum=core.reduce((n,p)=>n+p.y*p.w,0);
 anchors.push([(16+xsum/weight*224/512)/256,(16+ysum/weight*224/512)/256].map(v=>Math.round(v*1e10)/1e10));
 }
 else anchors.push([...anchors[2]]);
 const inner=await sharp(original).resize(224,224,{kernel:'lanczos3'}).png().toBuffer();
 composites.push({input:inner,left:cell%3*256+16,top:Math.floor(cell/3)*256+16});
}
const encoded=await sharp({create:{width:768,height:512,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(composites).webp({quality:94,alphaQuality:100,effort:6}).toBuffer();
const {data,info}=await sharp(encoded).ensureAlpha().raw().toBuffer({resolveWithObject:true});
for(let cell=0;cell<6;cell++){let gutterMax=0,visible=0,transparent=0;for(let y=0;y<256;y++)for(let x=0;x<256;x++){
 const a=data[((Math.floor(cell/3)*256+y)*info.width+cell%3*256+x)*4+3];if(a>32)visible++;if(a===0)transparent++;
 if(x<16||x>=240||y<16||y>=240)gutterMax=Math.max(gutterMax,a);
 }assert.equal(gutterMax,0);assert.ok(visible>0&&transparent>0);observations.push({cell,gutterMax,visibleAlphaOver32:visible,fullyTransparent:transparent});}
const material={id:'v100-musashi-manual-impact',path:'/art/quality-20261117/vfx/musashi-contact-six-r3.webp',hash:'sha256-'+hash(encoded),width:768,height:512,columns:3,rows:2,worldSize:192,anchors};
const old=JSON.parse(await fs.readFile('assets/source/quality-20261114/musashi-impact-r1/provenance-r1.json','utf8'));
const provenance={creator:old.creator,license:old.license,rights:{...old.rights,basis:'Project-original material-only output; the project owns output as between the user and OpenAI to the extent allowed by applicable law. Input reference is the existing project-original sheet.'},producerApproval:'The active smartphone goal authorizes bespoke manual ability VFX without geometric markers. This is a source candidate; final motion/audio/device acceptance and 1.0.9 publication remain unapproved.',terms:{url:'https://openai.com/policies/terms-of-use/',effective:'2026-01-01',checkedOn:'2026-11-17',section:'Content / Ownership of content'},referenceProvenance:'assets/source/quality-20261114/musashi-impact-r1/provenance-r1.json',source:{path:sourceDir+'/generated-r1.png',bytes:source.length,sha256:hash(source),width:1536,height:1024,hasAlpha:true},generation:{mode:'built-in',tool:'image_gen.imagegen',model:'not exposed by the built-in tool',reference:'public/art/quality-20261114/vfx/musashi-contact-six-r2.webp',prompt:sourceDir+'/prompt.txt'},processing:{script:'scripts/build-musashi-impact-material.mjs',cellSourceSize:512,cellInnerSize:224,transparentGutter:16,sharpVersion:sharp.versions.sharp,webp:{quality:94,alphaQuality:100,effort:6},anchorRule:'Alpha>=220, RGB minimum>=230, left half/lower55 percent. Weighted core within8 source pixels of fifth-percentile left bright contact; not the spreading plume centroid. First three frames measured; released remnants retain peak origin.'},currentBody:old.currentBody,logicalPath:material.path,logicalBytes:encoded.length,distinctBytes:encoded.length,logicalSha256:hash(encoded),runtimeAssetCount:1,estimatedDecodedRgbaBytes:1572864,material,observations,humanAccepted:false,scope:'Effect artwork only; approved body, weapons, .22-second visual clock, hit timing and damage remain separate and unchanged.'};
if(process.argv.includes('--refresh-metadata')){
 assert.deepEqual(await fs.readFile('public'+material.path),encoded,'Anchor calibration must not repaint pixels');
 await fs.writeFile(sourceDir+'/provenance-r1.json',JSON.stringify(provenance,null,2)+'\n');
 console.log(JSON.stringify({status:'contact-pivot-calibrated-pixels-unchanged',material}));
}else if(process.argv.includes('--verify')){
 assert.deepEqual(await fs.readFile('public'+material.path),encoded);
 const saved=JSON.parse(await fs.readFile(sourceDir+'/provenance-r1.json','utf8'));assert.deepEqual(saved,provenance);
 console.log(JSON.stringify({status:'reconstructed-byte-identical',path:material.path,bytes:encoded.length,hash:material.hash}));
}else{
 await fs.mkdir(path.dirname('public'+material.path),{recursive:true});await fs.writeFile('public'+material.path,encoded,{flag:'wx'});
 await fs.writeFile(sourceDir+'/provenance-r1.json',JSON.stringify(provenance,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({status:'packed-six-transparent-cells',material,bytes:encoded.length,observations}));
}
