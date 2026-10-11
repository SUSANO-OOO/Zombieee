// Explicit source paint and evaluated Blender matrices; no automatic segmentation.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import sharp from 'sharp';

export function validateJointTransform(definition,name,matrix){
 const soft=definition.softBones?.[name];
 if(!soft){assert.ok(Math.abs(matrix[0]*matrix[3]-matrix[1]*matrix[2]-1)<.0001,`Non-rigid evaluated transform: ${name}`);return;}
 const extra=definition.rig.extras?.find(e=>e.name===name);
 assert.ok(extra?.parent==='head'&&extra.softScale&&!/^(?:arm-|leg-|root$|pelvis$|spine$|head$)/.test(name),'Explicit leaf head organ required for soft scale');
 assert.ok(!definition.rig.extras.some(e=>e.parent===name),'Soft organs cannot stretch child anatomy');
 assert.equal(definition.parentAttachments?.[name]?.parent,'head');
 assert.deepEqual(definition.parentAttachments[name].pivot,extra.a);
 assert.ok(soft.minScale>0&&soft.maxScale<=1&&soft.minScale<=soft.maxScale);
 assert.equal(soft.minScale,Math.min(extra.softScale.rest,extra.softScale.active));
 assert.equal(soft.maxScale,Math.max(extra.softScale.rest,extra.softScale.active));
 const sx=Math.hypot(matrix[0],matrix[1]),sy=Math.hypot(matrix[2],matrix[3]);
 assert.ok(sx>=soft.minScale-.0001&&sy>=soft.minScale-.0001&&sx<=soft.maxScale+.0001&&sy<=soft.maxScale+.0001,'Soft organ scale outside authored bounds');
 assert.ok(matrix[0]*matrix[3]-matrix[1]*matrix[2]>0&&Math.abs(matrix[0]*matrix[2]+matrix[1]*matrix[3])<.0001,'Soft organ may scale without shear or inversion');
 assert.ok(definition.parts.some(p=>p.bone===name)&&![...(definition.armConstraints??[]),...(definition.legConstraints??[])].some(a=>[a.parentBone,a.upperBone,a.lowerBone,a.effectorBone].includes(name)),'Soft organ cannot own constrained anatomy');
}

export async function buildRigidJointAtlas({sourceDirectory,assetPath,dataFile,exportName,generator,description,aliases=[],captureAtlas}) {
 const dir=path.resolve(sourceDirectory);
 const d=JSON.parse(await readFile(path.join(dir,'parts.json'))),motionBytes=await readFile(path.join(dir,'motion.json.gz'));
 const motion=JSON.parse(gunzipSync(motionBytes));
 const sha=b=>createHash('sha256').update(b).digest('hex');
 assert.equal(sha(await readFile(path.resolve('public'+d.identityBinding.path))),d.identityBinding.sourceSha256);
 assert.equal(sha(await readFile(path.join(dir,'identity-reference.png'))),d.sourceSha256);
 for(const binding of Object.values(d.poseBindings??{})){
  assert.equal(sha(await readFile(path.resolve('public'+binding.path))),binding.sourceSha256,'Changed original weapon/hand source');
  assert.equal(sha(await readFile(path.join(dir,binding.file))),binding.sha256,'Changed original pose reference');
 }
 if(d.legConstraints){
  assert.equal(d.legConstraints.length,d.rig.legs.length,'Each declared leg requires its own chain');
  const lowerPelvis=d.parts.some(p=>p.bone==='pelvis'&&d.lowerLayers.includes(p.name));
  const owned=new Set();
  for(let i=0;i<d.rig.legs.length;i++){
   const c=d.legConstraints[i],leg=d.rig.legs[i];
   assert.equal(c.parentBone,lowerPelvis?'pelvis':'spine','Leg hip must follow the actual painted body owner');
   assert.equal(c.parentUpper??true,!lowerPelvis,'A lower pelvis retains the gait while the upper torso attacks');
   for(const [key,suffix]of [['upperBone','upper'],['lowerBone','lower'],['effectorBone','foot']]){
    assert.equal(c[key],`leg-${i}-${suffix}`);assert.ok(!owned.has(c[key]),'A limb bone cannot belong to multiple chains');owned.add(c[key]);
    assert.ok(d.parts.some(p=>p.bone===c[key]&&d.lowerLayers.includes(p.name)),'Leg paint must retain the travel/settling owner');
   }
   for(const point of ['hip','knee','ankle'])assert.deepEqual(c[point],leg[point],'Leg constraint must use the frozen anatomical point');
  }
 }
 const width=512,ratio=.5,padding=2,rows=[];let x=padding,y=padding,lineHeight=0;
 for(const name of d.order){
  const p=d.parts.find(p=>p.name===name),bytes=await readFile(path.join(dir,p.file));
  assert.equal(sha(bytes),p.sha256,`Changed source paint: ${name}`);assert.ok(p.bone&&!p.kind,'Only explicitly rigid parts');
  const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let x0=info.width,y0=info.height,x1=-1,y1=-1;
  for(let yy=0;yy<info.height;yy++)for(let xx=0;xx<info.width;xx++)if(data[(yy*info.width+xx)*4+3]>0){x0=Math.min(x0,xx);x1=Math.max(x1,xx);y0=Math.min(y0,yy);y1=Math.max(y1,yy);}
  assert.ok(x1>=x0&&y1>=y0,name);x0=Math.max(0,x0-1);y0=Math.max(0,y0-1);x1=Math.min(info.width-1,x1+1);y1=Math.min(info.height-1,y1+1);
  const destination={x:x0,y:y0,w:x1-x0+1,h:y1-y0+1};
  const w=Math.ceil(destination.w*ratio),h=Math.ceil(destination.h*ratio);
  if(x+w+padding>width){x=padding;y+=lineHeight+padding;lineHeight=0;}
  rows.push({name,bone:p.bone,source:{x,y,w,h},destination,upper:!d.lowerLayers.includes(name),bytes});
  x+=w+padding;lineHeight=Math.max(lineHeight,h);
 }
 // Opt-in packing changes texture positions only, retaining source resolution,
 // drawing order and the byte-identical default layout of existing atlases.
 if(d.atlasPacking){
  assert.equal(d.atlasPacking,'height-descending-shelves','Unknown explicit atlas packing');
  x=padding;y=padding;lineHeight=0;
  for(const row of [...rows].sort((a,b)=>b.source.h-a.source.h||b.source.w-a.source.w||(a.name<b.name?-1:a.name>b.name?1:0))){
   const {w,h}=row.source;
   if(x+w+padding>width){x=padding;y+=lineHeight+padding;lineHeight=0;}
   row.source.x=x;row.source.y=y;x+=w+padding;lineHeight=Math.max(lineHeight,h);
  }
 }
 const height=y+lineHeight+padding;assert.ok(width*height*4<=1024*1024,'Rigid-parts decoded budget');
 const layers=[];
 for(const r of rows){
  const {destination:b,source:s}=r;
  const input=await sharp(r.bytes).extract({left:b.x,top:b.y,width:b.w,height:b.h}).resize(s.w,s.h,{kernel:d.paintStyle==='pixel-art'?'nearest':'lanczos3'}).png().toBuffer();
  layers.push({input,left:s.x,top:s.y});
 }
 const bytes=await sharp({create:{width,height,channels:4,background:'#00000000'}}).composite(layers).webp({lossless:true,effort:6}).toBuffer();
 const actions=new Map(motion.actions.map(a=>[a.name,a]));
 const bones=[...new Set(rows.map(r=>r.bone))],count=30,poses=[],pelvisOffsets=[];
 function pose(frame){
  const dx=frame.bones.root.head[0]-d.rig.root[0];
  for(const [name,attachment]of Object.entries(d.parentAttachments??{})){
   assert.equal(attachment.parent,'head','Only explicitly attached leaf head organs are supported');
   assert.deepEqual(d.interpolationPivots?.[name],attachment.pivot);
   const a=frame.deform[name],b=frame.deform[attachment.parent],[x,y]=attachment.pivot;
   assert.ok(Math.hypot(a[0]*x+a[2]*y+a[4]-b[0]*x-b[2]*y-b[4],a[1]*x+a[3]*y+a[5]-b[1]*x-b[3]*y-b[5])<.001,'Authored head organ attachment must be exact');
  }
  return Object.fromEntries(bones.map(name=>{
   const m=[...frame.deform[name]];m[4]-=dx;
   assert.ok(m.length===6&&m.every(Number.isFinite),`Invalid evaluated transform: ${name}`);
   validateJointTransform(d,name,m);
   return [name,m.map(v=>Math.round(v*1e6)/1e6)];
  }));
 }
 for(const name of ['walk','settle-1','settle-2','settle-3']){
  const frames=actions.get(name).frames,offsets=[];
  for(let i=0;i<count;i++){poses.push(pose(frames[i*2]));offsets.push(Math.round((frames[i*2].bones.pelvis.head[1]-d.pelvisY)*1e6)/1e6);}
  pelvisOffsets.push(offsets);
 }
 const lowerCount=poses.length;
 for(let i=0;i<=count;i++)poses.push(pose(actions.get('attack').frames[i*2]));
 await mkdir(path.resolve('public/art/v100/joints'),{recursive:true});await writeFile(path.resolve('public'+assetPath),bytes);
 const atlas={type:'rigid-parts',key:d.assetKey??`joint-${d.kind}`,path:assetPath,width:d.width,height:d.height,
  frameCount:count,settleLevels:4,cycleDistance:d.motion.walk.spanPx/d.motion.walk.stanceFraction,
  decodedWidth:width,decodedHeight:height,decodedBytes:width*height*4,
  parts:rows.map(row=>({name:row.name,bone:row.bone,source:row.source,destination:row.destination,upper:row.upper})),poses,pelvisOffsets,lowerCount,
  ...(d.parentAttachments?{parentAttachments:d.parentAttachments}:{}),...(d.softBones?{softBones:d.softBones}:{}),
  attackBoundaries:[d.rig.attack.windupEnd,d.rig.attack.activeEnd],muzzle:d.muzzle,weaponBone:d.weaponBone,mouth:d.mouth,armConstraints:d.armConstraints,referenceFrame:d.referenceFrame,
  ...(d.legConstraints?{legConstraints:d.legConstraints}:{}),
  ...(d.paintStyle==='pixel-art'?{paintStyle:'pixel-art'}:{}),
  ...(d.interpolationPivots?{interpolationPivots:d.interpolationPivots}:{})};
 const aliasCode=aliases.map(kind=>`${exportName}[${JSON.stringify(kind)}] = ${exportName}[${JSON.stringify(d.kind)}];\n`).join('');
 if(dataFile)await writeFile(path.resolve(dataFile),`// Generated by ${generator}; real Blender matrices.\nexport const ${exportName} = Object.fromEntries(Object.entries(${JSON.stringify({[d.kind]:atlas})}));\n${aliasCode}`);
 captureAtlas?.(atlas);
 const provenance={schema:'zombieee-joint-atlas/1',kind:d.kind,assetPath,bytes:bytes.length,sha256:sha(bytes),
  ...(d.softBones?{softBones:d.softBones}:{}),...(d.atlasPacking?{atlasPacking:d.atlasPacking}:{}),generatedPartsStudySha256:d.sheetSha256,identitySourceSha256:d.sourceSha256,identityBinding:d.identityBinding,motionSha256:sha(motionBytes),
  ...(d.poseBindings?{originalPoseBindings:d.poseBindings}:{}),
  parts:d.parts.map(({name,file,sha256,original})=>({name,file,sha256,original:Boolean(original)})),
  source:description,...(d.sharedPaintSource?{sharedPaintSource:d.sharedPaintSource}:{}),groundY:d.motion.walk.groundY,decodedBytes:atlas.decodedBytes,poses:poses.length,
  scope:{totalUnits:48,allUnitAcceptance:false,normalPlayAcceptance:false},...(aliases.length?{aliases}:{})};
 await writeFile(path.join(dir,'provenance.json'),JSON.stringify(provenance,null,2)+'\n');
 return {assetPath,bytes:bytes.length,hash:sha(bytes),atlas:[width,height],decodedBytes:atlas.decodedBytes,poses:poses.length};
}
