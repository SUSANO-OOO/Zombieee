import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {QUALITY_CHARACTER_BASE_ATLASES,QUALITY_CHARACTER_HEAD_ATLASES} from '../app/qualityCharacterAtlases.js';
import {withQualitySidearmAtlas} from '../app/qualitySidearmAtlas.js';

const check=process.argv.includes('--check'),hash=b=>createHash('sha256').update(b).digest('hex');
const root='assets/source/quality-20261028/identity';
const plan=JSON.parse(await readFile(`${root}/battle-neck-calibration-r4.json`));
const review=process.env.QUALITY_NECK_REVIEW_OUT??'output/quality-20261028/battle-neck-calibration-r4-r1';
if(!check)await mkdir(review);
const emit=async(file,b)=>{const bytes=Buffer.from(b);if(check)assert.deepEqual(await readFile(file),bytes,file);else await writeFile(file,bytes);};
const updates={},entries=[];
const project=(m,p)=>[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];
function similarity(fromA,fromB,toA,toB){
 const sx=fromB[0]-fromA[0],sy=fromB[1]-fromA[1],dx=toB[0]-toA[0],dy=toB[1]-toA[1],den=sx*sx+sy*sy;
 assert.ok(den>0);const a=(dx*sx+dy*sy)/den,b=(dy*sx-dx*sy)/den;
 return[a,b,-b,a,toA[0]-a*fromA[0]+b*fromA[1],toA[1]-b*fromA[0]-a*fromA[1]];
}
async function compositeParts(image,parts){
 const layers=[];for(const p of parts){const s=p.source,d=p.destination;layers.push({input:await sharp(image).extract({left:s.x,top:s.y,width:s.w,height:s.h})
  .resize(Math.round(d.w),Math.round(d.h),{fit:'fill'}).png().toBuffer(),left:Math.round(d.x),top:Math.round(d.y)});}
 return sharp({create:{width:480,height:448,channels:4,background:'#28313a'}}).composite(layers).png().toBuffer();
}
for(const row of plan.entries){
 const originalAtlas=QUALITY_CHARACTER_BASE_ATLASES[row.kind],atlas=withQualitySidearmAtlas(row.kind,QUALITY_CHARACTER_HEAD_ATLASES[row.kind]);
 assert.ok(originalAtlas&&atlas,row.kind);
 const originalParts=originalAtlas.parts??originalAtlas.upperRig.parts,parts=atlas.parts??atlas.upperRig.parts;
 const oldHead=originalParts.find(p=>p.bone==='head'),head=parts.find(p=>p.bone==='head');assert.ok(oldHead&&head);
 const original=await readFile('public'+originalAtlas.path),base=await readFile('public'+atlas.path),source=await readFile(row.sourcePath);
 assert.equal(hash(original),row.baseAtlasSha256,`${row.kind}: original head/collar source`);
 assert.equal(hash(source),row.sourceSha256,`${row.kind}: generated identity source`);
 const matrix=similarity(row.sourceSeam,row.sourceFaceCenter,row.targetSkinSeam,row.targetFaceCenter);
 const b=row.sourceVisibleBounds,corners=[[b.left,b.top],[b.left+b.width,b.top],[b.left,b.top+b.height],[b.left+b.width,b.top+b.height]].map(p=>project(matrix,p));
 const left=Math.floor(Math.min(...corners.map(p=>p[0])))-3,top=Math.floor(Math.min(...corners.map(p=>p[1])))-3;
 const w=Math.ceil(Math.max(...corners.map(p=>p[0])))-left+3,h=Math.ceil(Math.max(...corners.map(p=>p[1])))-top+3;
 const m=[...matrix];m[4]-=left;m[5]-=top;
 const info=await sharp(source).metadata();
 const imageSvg=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}"><image width="${info.width}" height="${info.height}" transform="matrix(${m.join(' ')})" xlink:href="data:image/png;base64,${source.toString('base64')}"/></svg>`);
 const headPng=await sharp(imageSvg).png().toBuffer();
 const raw=await sharp(base).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 for(let y=0;y<head.source.h;y++)raw.data.fill(0,((head.source.y+y)*raw.info.width+head.source.x)*4,((head.source.y+y)*raw.info.width+head.source.x+head.source.w)*4);
 const items=[{...head,name:head.name,bone:'head',input:headPng,width:w,height:h,destination:{x:left,y:top,w,h},upper:head.upper}];
 const polygons=[...(row.garmentPolygons??[]),...(row.lowerNeckPolygon?[row.lowerNeckPolygon]:[])];
 let garmentPixels=0;
 if(polygons.length){
  const s=oldHead.source,d=oldHead.destination;
  const paths=polygons.map(poly=>`<polygon points="${poly.map(p=>[(p[0]-d.x)*s.w/d.w,(p[1]-d.y)*s.h/d.h].join(',')).join(' ')}" fill="white"/>`).join('');
  const mask=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${s.w}" height="${s.h}">${paths}</svg>`);
  const originalTile=await sharp(original).extract({left:s.x,top:s.y,width:s.w,height:s.h}).png().toBuffer();
  const garment=await sharp(originalTile).composite([{input:mask,blend:'dest-in'}]).png().toBuffer();
  const gp=await sharp(garment).ensureAlpha().raw().toBuffer();for(let i=3;i<gp.length;i+=4)if(gp[i]>=8)garmentPixels++;
  assert.ok(garmentPixels>0,`${row.kind}: preserve original collar/accessory`);
  items.push({...head,name:'source-neck-garment',bone:'spine',input:garment,width:s.w,height:s.h,destination:{...d},upper:true});
 }
 const ordered=[];
 for(const p of parts){
  if(p===head){ordered.push(...[...items].reverse());continue;}
  const s=p.source;ordered.push({...p,width:s.w,height:s.h,input:await sharp(base).extract({left:s.x,top:s.y,width:s.w,height:s.h}).png().toBuffer(),originalPart:p});
 }
 // Rigid atlases can repack their owned rectangles. Ranger retains legacy
 // mesh/sprite UVs, so only that texture appends its calibrated upper layers.
 const materialOverrides=row.kind==='babayaga'?JSON.parse(await readFile('assets/source/quality-20261028/babayaga-material-r2/provenance.json')):null;
 for(const override of materialOverrides?.outputs??[]){
  const item=ordered.find(p=>p.name===override.name);assert.ok(item);
  const png=await readFile(override.file);assert.equal(hash(png),override.sha256);
  assert.equal(item.width,override.width);assert.equal(item.height,override.height);
  item.input=png;item.materialCorrection=override;
 }
 const packItems=atlas.parts?ordered:items,newWidth=atlas.parts?512:raw.info.width;
 let x=2,y=atlas.parts?2:raw.info.height+2,rowHeight=0;
 for(const item of packItems){assert.ok(item.width<=newWidth);if(x+item.width>newWidth){x=2;y+=rowHeight+2;rowHeight=0;}
  item.source={x,y,w:item.width,h:item.height};x+=item.width+2;rowHeight=Math.max(rowHeight,item.height);}
 const newHeight=y+rowHeight+2;
 // Direct copies preserve every low-alpha body channel. A source-over pass
 // premultiplies and rounds unrelated original pixels even on a clear canvas.
 const extended=Buffer.alloc(newWidth*newHeight*4);if(!atlas.parts)raw.data.copy(extended);
 for(const item of packItems){
  const tile=await sharp(item.input).ensureAlpha().raw().toBuffer();
  for(let py=0;py<item.height;py++)tile.copy(extended,((item.source.y+py)*newWidth+item.source.x)*4,py*item.width*4,(py+1)*item.width*4);
 }
 const packed=await sharp(extended,{raw:{width:newWidth,height:newHeight,channels:4}}).webp({lossless:true,effort:6}).toBuffer();
 const outputParts=ordered.map(item=>({...item.originalPart,...(item.bone==='head'||item.name==='source-neck-garment'?head:{}),name:item.name,bone:item.bone,source:item.source,destination:item.destination,upper:item.upper}));
 for(const item of ordered.filter(i=>i.originalPart)){
  const output=outputParts.find(p=>p.name===item.name);
  assert.deepEqual({...output,source:item.originalPart.source},item.originalPart,`${row.kind}/${item.name}: preserve every pose-owner and material flag`);
 }
 const assetPath=`/art/v100/joints/${row.kind}-quality-neck-r4.webp`;
 updates[row.kind]={path:assetPath,parts:outputParts,decodedWidth:newWidth,decodedHeight:newHeight,decodedBytes:newWidth*newHeight*4,headRig:atlas.parts?'standard':'ranger-upper',neckAttachment:{parent:'spine',pivot:row.targetSkinSeam}};
 const actual=await sharp(packed).ensureAlpha().raw().toBuffer();let unchangedPixels=0;
 for(const item of ordered.filter(i=>i.originalPart)){
  const expectedTile=await sharp(item.input).ensureAlpha().raw().toBuffer(),s=item.source;
  for(let py=0;py<s.h;py++)for(let px=0;px<s.w;px++){
   const i=(py*s.w+px)*4,j=((s.y+py)*newWidth+s.x+px)*4;
   assert.equal(actual[j+3],expectedTile[i+3],`${row.kind}/${item.name}: original alpha`);
   if(expectedTile[i+3]){if(!item.materialCorrection)unchangedPixels++;for(let c=0;c<3;c++)assert.equal(actual[j+c],expectedTile[i+c],`${row.kind}/${item.name}: original visible RGB`);}
  }
 }
 if(!atlas.parts){
  const before=await sharp(base).ensureAlpha().raw().toBuffer();
  for(let py=0;py<raw.info.height;py++)for(let px=0;px<raw.info.width;px++){
   if(px>=head.source.x&&px<head.source.x+head.source.w&&py>=head.source.y&&py<head.source.y+head.source.h)continue;
   const i=(py*raw.info.width+px)*4;assert.equal(actual[i+3],before[i+3],'Ranger legacy/mesh alpha');
   if(before[i+3])for(let c=0;c<3;c++)assert.equal(actual[i+c],before[i+c],'Ranger legacy/mesh RGB');
  }
 }
 entries.push({...row,basePath:atlas.path,baseSha256:hash(base),matrix,scale:Math.hypot(matrix[0],matrix[1]),rotationRadians:Math.atan2(matrix[1],matrix[0]),assetPath,sha256:hash(packed),bytes:packed.length,
  headDestination:items[0].destination,headSource:items[0].source,garmentPixels,unchangedVisibleNonHeadPixels:unchangedPixels,
  materialCorrections:materialOverrides?.outputs??[],
  acceptance:'placement candidate; original-speed, whole-character and Producer acceptance pending'});
 await emit('public'+assetPath,packed);
 if(!check){
  await writeFile(`${review}/${row.kind}-before.png`,await compositeParts(base,parts));
  await writeFile(`${review}/${row.kind}-after.png`,await compositeParts(packed,outputParts));
  await writeFile(`${review}/${row.kind}-head.png`,headPng);
 }
}
await emit('app/qualityBattleHeadCalibrationData.js','// Generated calibrated head placement and original collar ownership; pose arrays remain in the base atlas.\nexport const QUALITY_BATTLE_HEAD_CALIBRATIONS = '+JSON.stringify(updates)+';\n');
await emit(`${root}/battle-neck-calibration-r4-provenance.json`,JSON.stringify({generator:'scripts/build-quality-battle-neck-calibration.mjs',method:plan.method,precision:plan.precision,
 scope:'Thirteen head placements; complete Kuma combat model and original dog/toy heads are separate. Neither manual landmarks nor texture packing accept motion or likeness.',entries},null,2)+'\n');
console.log(JSON.stringify({check,heads:entries.length,originalGarmentsRestored:entries.filter(e=>e.garmentPixels>0).length,bytes:entries.reduce((n,e)=>n+e.bytes,0),review:check?null:review}));
